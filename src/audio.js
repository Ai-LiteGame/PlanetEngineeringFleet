import {
  SPEECH_RATE_MULTIPLIERS,
  normalizeSpeechRateMode,
} from './preferences.js';

let soundEnabled = true;
let speechRateMode = 'normal';
let audioContext = null;
let activeSpeech = null;
const nativeSpeechHandler = 'planetEngineeringFleetTts';
const compatibleSpeechHandler = 'planetEngineeringFleetTtsFallback';
const nativeSpeechTimeout = 12000;

export function createFeedbackTonePlan({ kind, tier = 'standard', variant = 0 } = {}) {
  const safeVariant = Number.isInteger(variant) && variant >= 0 ? variant : 0;
  if (kind === 'retry') {
    const base = 196 + (safeVariant % 8) * 17;
    return [
      { frequency: base * 1.18, delay: 0, duration: 0.14, gain: 0.035, type: 'sine' },
      { frequency: base, delay: 0.11, duration: 0.18, gain: 0.028, type: 'triangle' },
    ];
  }

  const base = 440 + (safeVariant % 10) * 21;
  const notes = [1, 1.25, 1.5];
  const extraNotes = { standard: 0, combo: 1, super: 2, mega: 3 }[tier] ?? 0;
  return [...notes, ...Array.from({ length: extraNotes }, (_, index) => 1.75 + index * 0.25)]
    .map((ratio, index) => ({
      frequency: base * ratio,
      delay: index * 0.075,
      duration: 0.17 + Math.min(index, 2) * 0.025,
      gain: tier === 'mega' ? 0.075 : 0.06,
      type: index % 2 === 0 ? 'sine' : 'triangle',
    }));
}
const listeningBridges = new WeakSet();
const pendingNativeSpeech = new Map();
let nativeRequestSequence = 0;

function finishActiveSpeech(completed = false, stopNative = false) {
  const speech = activeSpeech;
  if (stopNative) speech?.stop?.();
  speech?.finish(completed);
}

export function setSoundEnabled(value) {
  soundEnabled = Boolean(value);
  if (!soundEnabled) {
    finishActiveSpeech(false, true);
    try {
      globalThis.speechSynthesis?.cancel();
    } catch {
      // Some WebViews expose speechSynthesis before its native backend is ready.
    }
  }
}

export function setSpeechRateMode(value) {
  speechRateMode = normalizeSpeechRateMode(value);
}

function speechRate(lang) {
  const baseRate = lang.startsWith('en') ? 0.72 : 0.82;
  return Number((baseRate * SPEECH_RATE_MULTIPLIERS[speechRateMode]).toFixed(3));
}

function nativeBridge() {
  const bridge = [nativeSpeechHandler, compatibleSpeechHandler]
    .map((name) => globalThis[name])
    .find((candidate) => (
      (typeof candidate === 'object' || typeof candidate === 'function')
      && candidate !== null
      && typeof candidate.postMessage === 'function'
      && typeof candidate.addEventListener === 'function'
    ));
  if (!bridge) return null;

  if (!listeningBridges.has(bridge)) {
    try {
      bridge.addEventListener('message', (event) => {
        try {
          const response = typeof event.data === 'string'
            ? JSON.parse(event.data)
            : event.data;
          const complete = pendingNativeSpeech.get(response?.id);
          if (complete) complete(response.result);
        } catch {
          // Malformed native responses are ignored and handled by the timeout.
        }
      });
      listeningBridges.add(bridge);
    } catch {
      return null;
    }
  }
  return bridge;
}

function isWebSpeechAvailable() {
  return typeof globalThis.SpeechSynthesisUtterance === 'function'
    && Boolean(globalThis.speechSynthesis);
}

export function isSpeechAvailable() {
  return Boolean(nativeBridge()) || isWebSpeechAvailable();
}

function speakWithWebSpeech(text, lang, rate, pitch) {
  if (!isWebSpeechAvailable()) return Promise.resolve(false);
  try {
    globalThis.speechSynthesis.cancel();
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    return new Promise((resolve) => {
      let settled = false;
      const fallbackTimer = setTimeout(() => finish(false), 10000);
      const finish = (completed) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        utterance.onend = null;
        utterance.onerror = null;
        if (activeSpeech?.utterance === utterance) activeSpeech = null;
        resolve(completed);
      };
      activeSpeech = { utterance, finish };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      try {
        globalThis.speechSynthesis.speak(utterance);
      } catch {
        finish(false);
      }
    });
  } catch {
    return Promise.resolve(false);
  }
}

function nextNativeRequestId() {
  nativeRequestSequence += 1;
  return `speech-${Date.now()}-${nativeRequestSequence}`;
}

function postNativeMessage(bridge, message) {
  bridge.postMessage(JSON.stringify(message));
}

function stopNativeSpeech(bridge) {
  try {
    postNativeMessage(bridge, {
      id: nextNativeRequestId(),
      action: 'stop',
    });
  } catch {
    // Stopping is best-effort when the native runtime is shutting down.
  }
}

function speakWithNative(bridge, payload) {
  return new Promise((resolve) => {
    const id = nextNativeRequestId();
    let settled = false;
    let timeout = null;
    const speech = {
      finish(completed) {
        if (settled) return;
        settled = true;
        if (timeout !== null) clearTimeout(timeout);
        pendingNativeSpeech.delete(id);
        if (activeSpeech === speech) activeSpeech = null;
        resolve(completed);
      },
      stop() {
        stopNativeSpeech(bridge);
      },
    };

    const fallback = () => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      pendingNativeSpeech.delete(id);
      if (activeSpeech === speech) activeSpeech = null;
      speakWithWebSpeech(
        payload.text,
        payload.lang,
        payload.rate,
        payload.pitch,
      ).then(resolve);
    };

    activeSpeech = speech;
    pendingNativeSpeech.set(id, (result) => {
      if (result?.ok === true) speech.finish(true);
      else fallback();
    });
    timeout = setTimeout(() => {
      speech.stop();
      fallback();
    }, nativeSpeechTimeout);
    try {
      postNativeMessage(bridge, { id, action: 'speak', payload });
    } catch {
      fallback();
    }
  });
}

export function speak(text, lang = 'zh-CN') {
  if (!soundEnabled || !text) return Promise.resolve(false);

  finishActiveSpeech(false, true);
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    // Native speech remains available even if Web Speech initialization fails.
  }

  const payload = {
    text,
    lang,
    rate: speechRate(lang),
    pitch: 1.08,
  };
  const bridge = nativeBridge();
  return bridge
    ? speakWithNative(bridge, payload)
    : speakWithWebSpeech(text, lang, payload.rate, payload.pitch);
}

export function createSpeechCountdown({
  speaker = speak,
  schedule = setTimeout,
  clearSchedule = clearTimeout,
  duration = 3000,
  onCountdownStart = () => {},
  onComplete = () => {},
} = {}) {
  let generation = 0;
  let timer = null;

  function cancel() {
    generation += 1;
    if (timer !== null) clearSchedule(timer);
    timer = null;
  }

  function start(text, lang) {
    cancel();
    const currentGeneration = generation;
    let speechCompletion;
    try {
      speechCompletion = speaker(text, lang);
    } catch {
      speechCompletion = false;
    }
    return Promise.resolve(speechCompletion)
      .catch(() => false)
      .then(() => {
        if (currentGeneration !== generation) return false;
        onCountdownStart();
        timer = schedule(() => {
          if (currentGeneration !== generation) return;
          timer = null;
          onComplete();
        }, duration);
        return true;
      });
  }

  return Object.freeze({ start, cancel });
}

function context() {
  if (audioContext) return audioContext;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return null;
  try {
    audioContext = new AudioContext();
    return audioContext;
  } catch {
    return null;
  }
}

export function playAnswerFeedback(effect) {
  if (!soundEnabled) return false;
  const ctx = context();
  if (!ctx) return false;

  try {
    const start = ctx.currentTime;
    const tones = createFeedbackTonePlan({
      kind: effect?.kind,
      tier: effect?.tier,
      variant: effect?.soundVariant,
    });
    tones.forEach(({ frequency, delay, duration, gain: peakGain, type }) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + duration + 0.02);
    });
    return true;
  } catch {
    return false;
  }
}

export function playSuccess() {
  return playAnswerFeedback({ kind: 'success', tier: 'standard', soundVariant: 0 });
}
