import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVE_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createProgressV2,
  exportProgress,
  getMigrationBackup,
  loadActiveLesson,
  loadProgress,
  parseProgress,
  recordLessonViewed,
  saveActiveLesson,
  saveProgress,
} from '../src/storage.js';

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
  progress.honors = ['badge:bridge', 'badge:bridge', 'badge:crane'];

  const restored = parseProgress(JSON.stringify(progress));

  assert.deepEqual(restored.honors, ['badge:bridge', 'badge:crane']);
  assert.equal(restored.storageAvailable, true);
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

test('lesson snapshot round trips only stable state', () => {
  const storage = memoryStorage();

  assert.equal(saveActiveLesson(storage, {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17, animationFrame: 999,
  }), true);
  assert.equal(storage.getItem(ACTIVE_KEY).includes('animationFrame'), false);
  assert.deepEqual(loadActiveLesson(storage), {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17,
  });
});

test('invalid active lesson snapshots are ignored', () => {
  const storage = memoryStorage();
  storage.setItem(ACTIVE_KEY, JSON.stringify({ lessonId: 'lesson-014', interactionIndex: -1, seed: 4 }));

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
});
