let soundEnabled = true;
let audioContext = null;
let activeSpeech = null;
const nativeSpeechHandler = 'planetEngineeringFleetTts';
const compatibleSpeechHandler = 'planetEngineeringFleetTtsFallback';
const nativeSpeechTimeout = 12000;
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
    rate: lang.startsWith('en') ? 0.72 : 0.82,
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

export function playSuccess() {
  if (!soundEnabled) return false;
  const ctx = context();
  if (!ctx) return false;

  try {
    const start = ctx.currentTime;
    [[523.25, 0], [659.25, 0.12]].forEach(([frequency, delay]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.12, start + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + delay);
      oscillator.stop(start + delay + 0.2);
    });
    return true;
  } catch {
    return false;
  }
}
