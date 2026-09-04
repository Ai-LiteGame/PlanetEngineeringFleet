let soundEnabled = true;
let audioContext = null;

export function setSoundEnabled(value) {
  soundEnabled = Boolean(value);
  if (!soundEnabled && 'speechSynthesis' in globalThis) {
    globalThis.speechSynthesis.cancel();
  }
}

export function isSpeechAvailable() {
  return typeof globalThis.SpeechSynthesisUtterance === 'function'
    && Boolean(globalThis.speechSynthesis);
}

export function speak(text, lang = 'zh-CN') {
  if (!soundEnabled || !text || !isSpeechAvailable()) return false;
  try {
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang.startsWith('en') ? 0.72 : 0.82;
    utterance.pitch = 1.08;
    globalThis.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
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
