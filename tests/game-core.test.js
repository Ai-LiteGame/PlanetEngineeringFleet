import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  createLessonState,
  createSession,
  submitAnswer,
  advance,
  completeLesson,
  commitLessonCompletion,
  updateMastery,
  questionWeight,
} from '../src/game-core.js';
import {
  createProgressV2,
  loadActiveLesson,
  loadProgress,
  saveActiveLesson,
} from '../src/storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

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

test('leaving a lesson briefing records viewed without recording practice', () => {
  const progress = createProgressV2();
  const briefing = createLessonState('lesson-001', progress, 3, 1000);

  assert.equal(briefing.screen, 'briefing');
  assert.equal(progress.lessons['lesson-001'], undefined);

  const playing = advance(briefing);
  assert.equal(playing.screen, 'playing');
  assert.deepEqual(playing.progress.lessons['lesson-001'], {
    status: 'viewed',
    viewedAt: 1000,
    completedCount: 0,
    lastCompletedAt: null,
  });
  assert.equal(progress.lessons['lesson-001'], undefined);
});

test('wrong answers reveal three help levels without completing the interaction', () => {
  let state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  state = submitAnswer(state, 'wrong').state;
  state = submitAnswer(state, 'wrong-again').state;
  state = submitAnswer(state, 'wrong-third').state;

  assert.equal(state.screen, 'playing');
  assert.equal(state.hintLevel, 3);
  assert.equal(state.answered, false);
  assert.equal(state.demonstratedAnswerId, state.interactions[0].answerId);

  const result = submitAnswer(state, state.interactions[0].answerId);
  assert.equal(result.correct, true);
  assert.equal(result.state.answers[0].assistance, 3);
});

test('lesson answer submission locks until immutable advancement', () => {
  const state = advance(createLessonState('lesson-001', createProgressV2(), 3, 1000));
  const interaction = state.interactions[0];
  const answered = submitAnswer(state, interaction.answerId).state;
  const duplicate = submitAnswer(answered, interaction.answerId).state;

  assert.equal(answered.answered, true);
  assert.equal(answered.locked, true);
  assert.equal(duplicate, answered);

  const next = advance(answered);
  assert.notEqual(next, answered);
  assert.equal(next.interactionIndex, 1);
  assert.equal(next.answered, false);
  assert.equal(next.hintLevel, 0);
  assert.equal(answered.interactionIndex, 0);
});

test('completing a lesson marks viewed and practiced separately and records skill evidence once', () => {
  let state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  while (!state.completed) {
    const interaction = state.interactions[state.interactionIndex];
    state = submitAnswer(state, interaction.answerId).state;
    state = advance(state);
  }

  assert.equal(state.screen, 'projectComplete');
  const progress = completeLesson(state, createProgressV2(), 5000);
  assert.equal(progress.lessons['lesson-001'].completedCount, 1);
  assert.equal(progress.lessons['lesson-001'].status, 'practiced');
  assert.equal(Object.values(progress.skills).every((record) => record.exposures > 0), true);
  assert.deepEqual(progress.completionIds, ['lesson-001:1']);
  assert.deepEqual(progress.lastCompletion, {
    id: 'lesson-001:1',
    lessonId: 'lesson-001',
    completedCount: 1,
    effects: { clearActiveLesson: true },
  });

  const repeated = completeLesson(state, progress, 6000);
  assert.equal(repeated, progress);
  assert.equal(repeated.lessons['lesson-001'].completedCount, 1);
  assert.deepEqual(repeated.completionIds, ['lesson-001:1']);
  assert.equal(advance(state).screen, 'map');
});

test('committing a completed lesson persists progress and clears its active snapshot', () => {
  const storage = memoryStorage();
  let state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  saveActiveLesson(storage, { lessonId: state.lessonId, interactionIndex: 0, seed: state.seed });
  assert.notEqual(loadActiveLesson(storage), null);
  while (!state.completed) {
    state = submitAnswer(state, state.interactions[state.interactionIndex].answerId).state;
    state = advance(state);
  }

  const progress = commitLessonCompletion(state, createProgressV2(), storage, 5000);

  assert.deepEqual(loadProgress(storage), progress);
  assert.equal(loadActiveLesson(storage), null);
});

test('commit orchestration retains the snapshot for an unfinished lesson', () => {
  const storage = memoryStorage();
  const progress = createProgressV2({
    completionIds: ['lesson-001:1'],
    lastCompletion: {
      id: 'lesson-001:1',
      lessonId: 'lesson-001',
      completedCount: 1,
      effects: { clearActiveLesson: true },
    },
  });
  const state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  saveActiveLesson(storage, { lessonId: state.lessonId, interactionIndex: 0, seed: state.seed });

  commitLessonCompletion(state, progress, storage, 5000);

  assert.deepEqual(loadActiveLesson(storage), {
    lessonId: 'lesson-001', interactionIndex: 0, seed: 3,
  });
});

test('a fresh replay receives the next completion id and increments the count', () => {
  const once = createProgressV2({
    lessons: {
      'lesson-001': { status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 5000 },
    },
  });
  let state = createLessonState('lesson-001', once, 8, 6000);
  while (!state.completed) {
    state = submitAnswer(state, state.interactions[state.interactionIndex].answerId).state;
    state = advance(state);
  }

  assert.equal(state.completionId, 'lesson-001:2');
  assert.equal(completeLesson(state, once, 7000).lessons['lesson-001'].completedCount, 2);
});

test('replaying an old lesson does not move the current lesson backward', () => {
  const progress = createProgressV2({
    currentLessonId: 'lesson-100',
    lessons: {
      'lesson-001': { status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 5000 },
    },
  });
  let state = createLessonState('lesson-001', progress, 8, 6000);
  while (!state.completed) {
    state = submitAnswer(state, state.interactions[state.interactionIndex].answerId).state;
    state = advance(state);
  }

  assert.equal(completeLesson(state, progress, 7000).currentLessonId, 'lesson-100');
});
