export const DEFAULT_SPEECH_RATE_MODE = 'normal';

export const SPEECH_RATE_MULTIPLIERS = Object.freeze({
  slow: 0.85,
  normal: 1,
  fast: 1.15,
});

export function isSpeechRateMode(value) {
  return typeof value === 'string'
    && Object.hasOwn(SPEECH_RATE_MULTIPLIERS, value);
}

export function normalizeSpeechRateMode(value) {
  return isSpeechRateMode(value) ? value : DEFAULT_SPEECH_RATE_MODE;
}
