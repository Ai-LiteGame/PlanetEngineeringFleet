import test from 'node:test';
import assert from 'node:assert/strict';

import { getLessonsForProject } from '../src/curriculum/index.js';
import {
  advancePlacement,
  applyPlacementResult,
  buildProjectMapStates,
  createPlacementState,
  lessonForProjectPhase,
  submitPlacementAnswer,
} from '../src/progression.js';
import { createProgressV2 } from '../src/storage.js';

function completedLessonRecord(status = 'practiced') {
  return {
    status,
    viewedAt: 1000,
    completedCount: 1,
    lastCompletedAt: 2000,
    hintCount: 0,
  };
}

test('placement uses six balanced child-playable review interactions without recording', () => {
  const state = createPlacementState(createProgressV2(), 17, 1000);

  assert.equal(state.interactions.length, 6);
  assert.deepEqual(
    state.interactions.map((item) => item.subject),
    ['chinese', 'chinese', 'english', 'english', 'math', 'math'],
  );
  assert.equal(state.interactions.every((item) => item.choices.some((choice) => choice.id === item.answerId)), true);
  assert.equal(JSON.stringify(state).includes('recording'), false);
  assert.equal(JSON.stringify(state).includes('microphone'), false);
});

test('successful placement accelerates the pointer without fabricating learning evidence or rewards', () => {
  const original = createProgressV2({ currentLessonId: 'lesson-001' });
  let state = createPlacementState(original, 17, 1000);
  while (!state.completed) {
    const interaction = state.interactions[state.interactionIndex];
    state = submitPlacementAnswer(state, interaction.answerId);
    state = advancePlacement(state);
  }

  const result = applyPlacementResult(original, state, 2000);
  assert.equal(result.advanced, true);
  assert.equal(result.progress.currentLessonId, 'lesson-031');
  assert.deepEqual(result.progress.lessons, {});
  assert.deepEqual(result.progress.skills, {});
  assert.deepEqual(result.progress.completionIds, []);
  assert.deepEqual(result.progress.honors, []);
  assert.deepEqual(original, createProgressV2({ currentLessonId: 'lesson-001' }));
});

test('placement never records misses or moves the learner backward', () => {
  const original = createProgressV2({ currentLessonId: 'lesson-040' });
  let state = createPlacementState(original, 17, 1000);
  while (!state.completed) {
    state = submitPlacementAnswer(state, 'not-the-answer');
    state = advancePlacement(state);
  }

  const result = applyPlacementResult(original, state, 2000);
  assert.equal(result.advanced, false);
  assert.equal(result.progress.currentLessonId, 'lesson-040');
  assert.deepEqual(result.progress.lessons, {});
  assert.deepEqual(result.progress.skills, {});
  assert.equal(Object.hasOwn(result.progress.placement, 'answers'), false);
  assert.equal(Object.hasOwn(result.progress.placement, 'misses'), false);
});

test('project map exposes completed, review-due, in-progress, learnable and locked states', () => {
  const projectOneLessons = getLessonsForProject('project-001');
  const now = 10 * 86400000;
  const progress = createProgressV2({
    currentLessonId: 'lesson-010',
    lessons: {
      ...Object.fromEntries(projectOneLessons.map((lesson) => [lesson.id, completedLessonRecord()])),
      'lesson-004': {
        ...completedLessonRecord(),
        recentHintTimestamps: [now - (7 * 86400000), now - (7 * 86400000)],
      },
      'lesson-007': {
        status: 'reviewDue', viewedAt: 1000, completedCount: 0, lastCompletedAt: null, hintCount: 0,
      },
    },
  });

  const states = buildProjectMapStates(progress, 'lesson-010', now);
  assert.deepEqual(states.slice(0, 5).map((item) => item.state), [
    'completed', 'reviewDue', 'inProgress', 'learnable', 'locked',
  ]);
});

test('phase replay resolves the requested learn, build or review lesson exactly', () => {
  assert.equal(lessonForProjectPhase('project-001', 'learn').id, 'lesson-001');
  assert.equal(lessonForProjectPhase('project-001', 'build').id, 'lesson-002');
  assert.equal(lessonForProjectPhase('project-001', 'review').id, 'lesson-003');
  assert.equal(lessonForProjectPhase('project-001', 'unknown'), null);
});
