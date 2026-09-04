import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  createSession,
  submitAnswer,
  advance,
  updateMastery,
  questionWeight,
} from '../src/game-core.js';

test('initial state waits at the intro without a running session', () => {
  assert.deepEqual(createInitialState(), {
    stage: 'intro',
    stageIndex: -1,
    questionIndex: 0,
    questions: {},
    attempts: 0,
    hintLevel: 0,
    stars: [],
    completed: false,
    locked: false,
    answered: false,
    sessionAnswers: [],
    seed: 0,
  });
});

test('a session contains three questions for each learning stage', () => {
  const state = createSession(7, {});
  assert.deepEqual(Object.keys(state.questions), ['chinese', 'english', 'math', 'mixed']);
  assert.equal(Object.values(state.questions).every((items) => items.length === 3), true);
});

test('same seed produces the same question order', () => {
  const first = createSession(42, {});
  const second = createSession(42, {});
  assert.deepEqual(first.questions, second.questions);
});

test('wrong answers increase hints but never stars', () => {
  const state = createSession(7, {});
  const result = submitAnswer(state, 'not-the-answer');
  assert.equal(result.correct, false);
  assert.equal(result.state.hintLevel, 1);
  assert.deepEqual(result.state.stars, []);
  assert.equal(result.state.answered, false);
});

test('correct answer locks the question until advance', () => {
  const state = createSession(7, {});
  const question = state.questions.chinese[0];
  const result = submitAnswer(state, question.answerId);
  assert.equal(result.correct, true);
  assert.equal(result.state.answered, true);
  assert.equal(result.state.locked, true);
  assert.equal(result.state.sessionAnswers.length, 1);

  const duplicate = submitAnswer(result.state, question.answerId);
  assert.equal(duplicate.state.sessionAnswers.length, 1);
});

test('three correct answers advance to the next station and award one star', () => {
  let state = createSession(7, {});
  for (let index = 0; index < 3; index += 1) {
    const question = state.questions.chinese[index];
    state = submitAnswer(state, question.answerId).state;
    state = advance(state);
  }
  assert.equal(state.stage, 'english');
  assert.deepEqual(state.stars, ['chinese']);
  assert.equal(state.questionIndex, 0);
});

test('completing mixed marks the session complete', () => {
  let state = createSession(7, {});
  for (const stage of ['chinese', 'english', 'math', 'mixed']) {
    for (let index = 0; index < 3; index += 1) {
      const question = state.questions[stage][index];
      state = submitAnswer(state, question.answerId).state;
      state = advance(state);
    }
  }
  assert.equal(state.stage, 'complete');
  assert.equal(state.completed, true);
  assert.deepEqual(state.stars, ['chinese', 'english', 'math']);
  assert.equal(state.sessionAnswers.length, 12);
});

test('hints stop at level two and a later correct answer remains valid', () => {
  let state = createSession(9, {});
  state = submitAnswer(state, 'wrong').state;
  state = submitAnswer(state, 'wrong-again').state;
  state = submitAnswer(state, 'still-wrong').state;
  assert.equal(state.hintLevel, 2);

  const result = submitAnswer(state, state.questions.chinese[0].answerId);
  assert.equal(result.correct, true);
  assert.equal(result.state.sessionAnswers[0].assistance, 2);
});

test('three independent answers mark a skill as mastered', () => {
  const progress = updateMastery(
    { version: 1, sessionsCompleted: 2, bridgeStage: 2, skills: {} },
    [0, 1, 2].map(() => ({ skillId: 'zh:桥', correct: true, assistance: 0 })),
  );
  assert.equal(progress.skills['zh:桥'].independentStreak, 3);
  assert.equal(progress.skills['zh:桥'].masteredAtSession, 3);
  assert.equal(progress.sessionsCompleted, 3);
  assert.equal(progress.bridgeStage, 3);
});

test('assisted answers reset the independent streak and build a help streak', () => {
  const progress = updateMastery(
    {
      version: 1,
      sessionsCompleted: 1,
      bridgeStage: 1,
      skills: { 'zh:桥': { independentStreak: 2, helpStreak: 0, masteredAtSession: null } },
    },
    [{ skillId: 'zh:桥', correct: true, assistance: 1 }],
  );
  assert.deepEqual(progress.skills['zh:桥'], {
    independentStreak: 0,
    helpStreak: 1,
    masteredAtSession: null,
  });
});

test('mastered skills receive extra review weight at spaced session offsets', () => {
  const progress = {
    skills: { 'zh:桥': { independentStreak: 3, helpStreak: 0, masteredAtSession: 3 } },
  };
  const question = { skillId: 'zh:桥' };
  assert.equal(questionWeight(question, progress, 5), 2);
  assert.equal(questionWeight(question, progress, 6), 1);
  assert.equal(questionWeight(question, progress, 7), 2);
  assert.equal(questionWeight({ skillId: 'zh:水' }, progress, 7), 4);
});
