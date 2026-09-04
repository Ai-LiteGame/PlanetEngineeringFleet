import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  clearActiveLesson,
  clearActiveStage,
  createProgressV2,
  exportProgress,
  getMigrationBackup,
  loadActiveLesson,
  loadActiveStage,
  loadLegacyProgress,
  loadProgress,
  parseProgress,
  recordLessonViewed,
  resetProgress,
  saveActiveLesson,
  saveActiveStage,
  saveLegacyProgress,
  saveProgress,
} from '../src/storage.js';
import { updateMastery } from '../src/game-core.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('version one progress migrates known skills to schedulable version two IDs', () => {
  const old = JSON.stringify({
    version: 1,
    sessionsCompleted: 4,
    bridgeStage: 3,
    soundEnabled: false,
    skills: {
      'zh:桥': { independentStreak: 3, helpStreak: 0, masteredAtSession: 3 },
      'en:blue': { independentStreak: 1, helpStreak: 0, masteredAtSession: null },
      'math:count': { independentStreak: 1, helpStreak: 1, masteredAtSession: null },
      'mixed:delivery': { independentStreak: 0, helpStreak: 2, masteredAtSession: null },
      'zh:orphan': { independentStreak: 9, helpStreak: 0, masteredAtSession: 4 },
    },
  });

  const progress = parseProgress(old);

  assert.equal(progress.version, 2);
  assert.equal(progress.settings.soundEnabled, false);
  assert.equal(progress.skills['zh-197'].status, 'mastered');
  assert.ok(progress.skills['en-word-060']);
  assert.ok(progress.skills['math-number-sense-1']);
  assert.deepEqual(Object.hasOwn(progress.skills, 'zh:orphan'), false);
  assert.equal(progress.lessons['lesson-001'].status, 'practiced');
  assert.equal(progress.lessons['lesson-001'].completedCount, 1);
});

test('version two progress round trips while de-duplicating honor IDs', () => {
  const progress = createProgressV2();
  progress.lessons['lesson-001'] = {
    status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 2000, hintCount: 4,
  };
  progress.honors = ['badge:bridge', 'badge:bridge', 'badge:crane'];
  progress.completionIds = ['lesson-001:1', 'lesson-001:1'];
  progress.lastCompletion = {
    id: 'lesson-001:1',
    lessonId: 'lesson-001',
    completedCount: 1,
    effects: { clearActiveLesson: true },
  };

  const restored = parseProgress(JSON.stringify(progress));

  assert.deepEqual(restored.honors, ['badge:bridge', 'badge:crane']);
  assert.deepEqual(restored.completionIds, ['lesson-001:1']);
  assert.deepEqual(restored.lastCompletion, progress.lastCompletion);
  assert.equal(restored.lessons['lesson-001'].hintCount, 4);
  assert.equal(restored.storageAvailable, true);
});

test('old version two lesson records load with a zero hint count', () => {
  const progress = createProgressV2({
    lessons: {
      'lesson-001': {
        status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 2000,
      },
    },
  });

  assert.equal(parseProgress(JSON.stringify(progress)).lessons['lesson-001'].hintCount, 0);
});

test('invalid lesson hint counts fall back to fresh progress', () => {
  for (const hintCount of [-1, 1.5, '2']) {
    const malformed = createProgressV2({
      lessons: {
        'lesson-001': {
          status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 2000, hintCount,
        },
      },
    });
    assert.deepEqual(parseProgress(JSON.stringify(malformed)), createProgressV2());
  }
});

test('invalid lesson statuses fall back to a fresh version two value', () => {
  const malformed = {
    ...createProgressV2(),
    lessons: {
      'lesson-001': {
        status: 'complete', viewedAt: null, completedCount: 0, lastCompletedAt: null,
      },
    },
  };

  assert.deepEqual(parseProgress(JSON.stringify(malformed)), createProgressV2());
});

test('migration failures preserve raw input for recovery', () => {
  const corrupted = '{not json';

  assert.deepEqual(parseProgress(corrupted), createProgressV2());
  assert.equal(getMigrationBackup(), corrupted);
});

test('malformed version one sound settings preserve raw input for recovery', () => {
  const malformed = JSON.stringify({
    version: 1, sessionsCompleted: 1, bridgeStage: 1, soundEnabled: 'muted', skills: {},
  });

  assert.deepEqual(parseProgress(malformed), createProgressV2());
  assert.equal(getMigrationBackup(), malformed);
});

test('load prefers version two and migrates version one only when needed', () => {
  const storage = memoryStorage();
  const v2 = createProgressV2();
  v2.currentLessonId = 'lesson-014';
  storage.setItem(STORAGE_KEY, JSON.stringify(v2));
  storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
    version: 1, sessionsCompleted: 1, bridgeStage: 1, soundEnabled: false, skills: {},
  }));

  assert.equal(loadProgress(storage).currentLessonId, 'lesson-014');

  storage.removeItem(STORAGE_KEY);
  assert.equal(loadProgress(storage).settings.soundEnabled, false);
});

test('storage exceptions preserve a usable in-memory value and mark it unavailable', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const progress = createProgressV2();

  assert.equal(loadProgress(broken).storageAvailable, false);
  assert.equal(saveProgress(broken, progress), false);
  assert.equal(progress.storageAvailable, false);
});

test('a live legacy session saves its completed-session progress without v2 normalization', () => {
  const storage = memoryStorage();
  const sessionProgress = updateMastery(
    { version: 1, sessionsCompleted: 2, bridgeStage: 2, soundEnabled: false, skills: {} },
    [{ skillId: 'zh:桥', correct: true, assistance: 0 }],
  );

  assert.equal(saveLegacyProgress(storage, sessionProgress), true);
  assert.deepEqual(loadLegacyProgress(storage), sessionProgress);
});

test('every storage API handles a throwing localStorage getter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('blocked'); },
  });

  try {
    const progress = createProgressV2();
    const cases = [
      ['loadProgress', () => loadProgress(), (value) => assert.equal(value.storageAvailable, false)],
      ['saveProgress', () => saveProgress(undefined, progress), (value) => assert.equal(value, false)],
      ['loadLegacyProgress', () => loadLegacyProgress(), (value) => assert.equal(value.version, 1)],
      ['saveLegacyProgress', () => saveLegacyProgress(undefined, {
        version: 1, sessionsCompleted: 0, bridgeStage: 0, soundEnabled: true, skills: {},
      }), (value) => assert.equal(value, false)],
      ['resetProgress', () => resetProgress(), (value) => assert.equal(value, false)],
      ['saveActiveLesson', () => saveActiveLesson(undefined, {
        lessonId: 'lesson-001', interactionIndex: 0, seed: 1, answers: [],
      }), (value) => assert.equal(value, false)],
      ['loadActiveLesson', () => loadActiveLesson(), (value) => assert.equal(value, null)],
      ['clearActiveLesson', () => clearActiveLesson(), (value) => assert.equal(value, false)],
      ['saveActiveStage', () => saveActiveStage(undefined, { seed: 1, stage: 'chinese' }), (value) => assert.equal(value, false)],
      ['loadActiveStage', () => loadActiveStage(), (value) => assert.equal(value, null)],
      ['clearActiveStage', () => clearActiveStage(), (value) => assert.equal(value, false)],
    ];

    for (const [name, invoke, verify] of cases) {
      assert.doesNotThrow(() => verify(invoke()), name);
    }
    assert.equal(progress.storageAvailable, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('lesson snapshot round trips sanitized stable state including prior answers', () => {
  const storage = memoryStorage();
  const answers = [{
    interactionId: 'lesson-014:chinese:1',
    subject: 'chinese',
    skillIds: ['zh-001'],
    correct: true,
    assistance: 1,
    attempts: 2,
    animationFrame: 42,
  }];

  assert.equal(saveActiveLesson(storage, {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17, answers, animationFrame: 999,
  }), true);
  assert.equal(storage.getItem(ACTIVE_KEY).includes('animationFrame'), false);
  assert.deepEqual(loadActiveLesson(storage), {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17,
    answers: [{
      interactionId: 'lesson-014:chinese:1',
      subject: 'chinese',
      skillIds: ['zh-001'],
      correct: true,
      assistance: 1,
      attempts: 2,
    }],
  });
  assert.notEqual(loadActiveLesson(storage).answers, answers);
  assert.notEqual(loadActiveLesson(storage).answers[0].skillIds, answers[0].skillIds);
});

test('old active lesson snapshots remain loadable with an empty answer history', () => {
  const storage = memoryStorage();
  storage.setItem(ACTIVE_KEY, JSON.stringify({
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17,
  }));

  assert.deepEqual(loadActiveLesson(storage), {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17, answers: [],
  });
});

test('invalid active lesson snapshots are ignored', () => {
  const storage = memoryStorage();
  storage.setItem(ACTIVE_KEY, JSON.stringify({ lessonId: 'lesson-014', interactionIndex: -1, seed: 4 }));

  assert.equal(loadActiveLesson(storage), null);
});

test('completion effects can clear the active lesson snapshot', () => {
  const storage = memoryStorage();
  saveActiveLesson(storage, { lessonId: 'lesson-014', interactionIndex: 4, seed: 17 });

  assert.equal(clearActiveLesson(storage), true);
  assert.equal(loadActiveLesson(storage), null);
});

test('export produces indented parseable version two JSON without transient data', () => {
  const progress = createProgressV2();
  progress.recordings = ['audio data'];
  progress.browser = { userAgent: 'test' };

  const json = exportProgress(progress);
  const value = JSON.parse(json);

  assert.match(json, /\n  "version": 2/);
  assert.equal(value.version, 2);
  assert.equal(value.recordings, undefined);
  assert.equal(value.browser, undefined);
  assert.equal(typeof value.exportedAt, 'number');
  assert.equal(parseProgress(json).version, 2);
});

test('watching a briefing records viewed without recording practice', () => {
  const progress = recordLessonViewed(createProgressV2(), 'lesson-001', 2000);

  assert.equal(progress.lessons['lesson-001'].status, 'viewed');
  assert.equal(progress.lessons['lesson-001'].viewedAt, 2000);
  assert.equal(progress.lessons['lesson-001'].completedCount, 0);
  assert.equal(progress.lessons['lesson-001'].lastCompletedAt, null);
  assert.equal(progress.lessons['lesson-001'].hintCount, 0);
});
