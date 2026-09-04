const SUCCESS_THEMES = Object.freeze([
  Object.freeze({ variant: 'gear-burst', glyphs: ['gear', 'star'], message: '齿轮咔嗒，答对啦！' }),
  Object.freeze({ variant: 'star-lift', glyphs: ['star', 'spark'], message: '工程星星升起来啦！' }),
  Object.freeze({ variant: 'like-rally', glyphs: ['like', 'star'], message: '车队都为你点赞！' }),
  Object.freeze({ variant: 'flag-parade', glyphs: ['flag', 'spark'], message: '小旗挥起来，真棒！' }),
  Object.freeze({ variant: 'bolt-spark', glyphs: ['bolt', 'gear'], message: '能量满格，答对啦！' }),
  Object.freeze({ variant: 'helmet-hop', glyphs: ['helmet', 'star'], message: '工程帽跳起庆祝！' }),
  Object.freeze({ variant: 'wheel-spin', glyphs: ['wheel', 'spark'], message: '车轮欢快地转起来！' }),
  Object.freeze({ variant: 'beacon-flash', glyphs: ['beacon', 'star'], message: '工程灯为你闪亮！' }),
  Object.freeze({ variant: 'ribbon-launch', glyphs: ['ribbon', 'gear'], message: '彩带和齿轮一起出发！' }),
  Object.freeze({ variant: 'heart-power', glyphs: ['heart', 'spark'], message: '勇气能量收集成功！' }),
]);

const RETRY_THEMES = Object.freeze([
  Object.freeze({ variant: 'cone-wiggle', glyphs: ['cone', 'spark'], message: '路锥摆一摆，再找找线索。' }),
  Object.freeze({ variant: 'bubble-reset', glyphs: ['bubble', 'star'], message: '线索泡泡来了，再试一次。' }),
  Object.freeze({ variant: 'wheel-bounce', glyphs: ['wheel', 'spark'], message: '小车轮弹一下，继续找。' }),
  Object.freeze({ variant: 'soft-spark', glyphs: ['spark', 'gear'], message: '火花提醒你，再看一看。' }),
  Object.freeze({ variant: 'cloud-puff', glyphs: ['cloud', 'bubble'], message: '小云朵散开，再想一想。' }),
  Object.freeze({ variant: 'toolbox-nudge', glyphs: ['toolbox', 'gear'], message: '工具箱送来一条新线索。' }),
  Object.freeze({ variant: 'sign-sway', glyphs: ['sign', 'spark'], message: '工程牌摇一摇，换个办法。' }),
  Object.freeze({ variant: 'lamp-blink', glyphs: ['lamp', 'star'], message: '提示灯亮了，再找一次。' }),
]);

const SUCCESS_PARTICLE_COUNTS = Object.freeze({
  standard: 12,
  combo: 18,
  super: 24,
  mega: 32,
});

function normalizedStreak(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function successTier(streak) {
  if (streak >= 8) return 'mega';
  if (streak >= 5) return 'super';
  if (streak >= 3) return 'combo';
  return 'standard';
}

function randomIndex(length, random) {
  const sample = Number(random?.());
  const normalized = Number.isFinite(sample) ? Math.min(0.999999, Math.max(0, sample)) : 0;
  return Math.floor(normalized * length);
}

function particleBatch(theme, count, kind, variantIndex) {
  return Array.from({ length: count }, (_, index) => {
    const lane = (index * 37 + variantIndex * 11) % 100;
    const rise = 24 + ((index * 23 + variantIndex * 7) % 50);
    const drift = ((index * 29 + variantIndex * 13) % 110) - 55;
    return Object.freeze({
      glyph: theme.glyphs[index % theme.glyphs.length],
      lane,
      x: kind === 'success' ? drift : Math.round(drift * 0.38),
      y: kind === 'success' ? -rise : -8 - (rise % 18),
      delay: (index % 8) * 45,
      size: 18 + ((index + variantIndex) % 5) * 4,
      rotation: ((index * 71 + variantIndex * 19) % 240) - 120,
    });
  });
}

export function advanceAnswerStreak(currentStreak, { correct, assistance = 0 } = {}) {
  if (correct !== true || assistance !== 0) return 0;
  return normalizedStreak(currentStreak) + 1;
}

export function streakFromAnswers(answers) {
  if (!Array.isArray(answers)) return 0;
  let streak = 0;
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    if (answers[index]?.correct !== true || answers[index]?.assistance !== 0) break;
    streak += 1;
  }
  return streak;
}

export function createAnswerEffect({ correct, streak = 0, random = Math.random } = {}) {
  const kind = correct === true ? 'success' : 'retry';
  const themes = kind === 'success' ? SUCCESS_THEMES : RETRY_THEMES;
  const variantIndex = randomIndex(themes.length, random);
  const theme = themes[variantIndex];
  const safeStreak = normalizedStreak(streak);
  const tier = kind === 'success' ? successTier(safeStreak) : 'retry';
  const count = kind === 'success' ? SUCCESS_PARTICLE_COUNTS[tier] : 10;
  const comboMessage = tier === 'standard'
    ? theme.message
    : `连续答对 ${safeStreak} 次！${theme.message}`;

  return Object.freeze({
    kind,
    tier,
    variant: theme.variant,
    soundVariant: variantIndex,
    message: kind === 'success' ? comboMessage : theme.message,
    particles: Object.freeze(particleBatch(theme, count, kind, variantIndex)),
  });
}

export function settleAnswerFeedbackState(state) {
  return {
    ...state,
    actionActive: false,
    readyToContinue: true,
    answerEffect: null,
  };
}
