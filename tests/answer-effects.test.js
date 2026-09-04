import test from 'node:test';
import assert from 'node:assert/strict';

import * as answerEffects from '../src/answer-effects.js';
import {
  advanceAnswerStreak,
  createAnswerEffect,
  streakFromAnswers,
} from '../src/answer-effects.js';

test('only independent correct answers build a streak and every miss resets it', () => {
  assert.equal(advanceAnswerStreak(0, { correct: true, assistance: 0 }), 1);
  assert.equal(advanceAnswerStreak(2, { correct: true, assistance: 0 }), 3);
  assert.equal(advanceAnswerStreak(4, { correct: false, assistance: 0 }), 0);
  assert.equal(advanceAnswerStreak(4, { correct: true, assistance: 1 }), 0);
});

test('restored streak counts only trailing independent correct answers', () => {
  const answers = [
    { correct: true, assistance: 0 },
    { correct: true, assistance: 1 },
    { correct: true, assistance: 0 },
    { correct: true, assistance: 0 },
  ];

  assert.equal(streakFromAnswers(answers), 2);
  assert.equal(streakFromAnswers([...answers, { correct: true, assistance: 2 }]), 0);
  assert.equal(streakFromAnswers(null), 0);
});

test('success effects escalate at streaks three, five and eight with particle batches', () => {
  const standard = createAnswerEffect({ correct: true, streak: 2, random: () => 0 });
  const combo = createAnswerEffect({ correct: true, streak: 3, random: () => 0 });
  const superCombo = createAnswerEffect({ correct: true, streak: 5, random: () => 0 });
  const megaCombo = createAnswerEffect({ correct: true, streak: 8, random: () => 0 });

  assert.deepEqual(
    [standard.tier, combo.tier, superCombo.tier, megaCombo.tier],
    ['standard', 'combo', 'super', 'mega'],
  );
  assert.equal(standard.particles.length, 12);
  assert.equal(combo.particles.length, 18);
  assert.equal(superCombo.particles.length, 24);
  assert.equal(megaCombo.particles.length, 32);
  assert.match(combo.message, /3/);
  assert.match(megaCombo.message, /8/);
});

test('deterministic random samples reach a large success and retry effect library', () => {
  const samples = Array.from({ length: 20 }, (_, index) => index / 20);
  const successVariants = new Set(samples.map((randomValue) => (
    createAnswerEffect({ correct: true, streak: 1, random: () => randomValue }).variant
  )));
  const retryEffects = samples.map((randomValue) => (
    createAnswerEffect({ correct: false, streak: 0, random: () => randomValue })
  ));
  const retryVariants = new Set(retryEffects.map((effect) => effect.variant));

  assert.equal(successVariants.size >= 10, true);
  assert.equal(retryVariants.size >= 8, true);
  assert.equal(retryEffects.every((effect) => effect.particles.length === 10), true);
  assert.equal(retryEffects.every((effect) => !/[错失败笨]/.test(effect.message)), true);
});

test('settling successful feedback removes its one-shot effect before the next render', () => {
  const effect = createAnswerEffect({ correct: true, streak: 3, random: () => 0 });
  assert.equal(typeof answerEffects.settleAnswerFeedbackState, 'function');

  assert.deepEqual(answerEffects.settleAnswerFeedbackState({
    actionActive: true,
    readyToContinue: false,
    answerEffect: effect,
  }), {
    actionActive: false,
    readyToContinue: true,
    answerEffect: null,
  });
});
