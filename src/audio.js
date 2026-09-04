let soundEnabled = true;
let audioContext = null;
let activeSpeech = null;

function finishActiveSpeech(completed = false) {
  activeSpeech?.finish(completed);
}

export function setSoundEnabled(value) {
  soundEnabled = Boolean(value);
  if (!soundEnabled && 'speechSynthesis' in globalThis) {
    finishActiveSpeech(false);
    globalThis.speechSynthesis.cancel();
  }
}

export function isSpeechAvailable() {
  return typeof globalThis.SpeechSynthesisUtterance === 'function'
    && Boolean(globalThis.speechSynthesis);
}

export function speak(text, lang = 'zh-CN') {
  if (!soundEnabled || !text || !isSpeechAvailable()) return Promise.resolve(false);
  try {
    finishActiveSpeech(false);
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang.startsWith('en') ? 0.72 : 0.82;
    utterance.pitch = 1.08;
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
