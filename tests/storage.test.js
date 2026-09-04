import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PROGRESS,
  serializeProgress,
  parseProgress,
  loadProgress,
  saveProgress,
  loadActiveStage,
  saveActiveStage,
  clearActiveStage,
} from '../src/storage.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('valid progress survives a serialized round trip', () => {
  const progress = {
    version: 1,
    sessionsCompleted: 2,
    bridgeStage: 2,
    soundEnabled: false,
    skills: { 'zh:桥': { independentStreak: 3, helpStreak: 0, masteredAtSession: 2 } },
  };
  assert.deepEqual(parseProgress(serializeProgress(progress)), progress);
});

test('malformed or incompatible progress falls back to a fresh value', () => {
  assert.deepEqual(parseProgress('{bad json'), DEFAULT_PROGRESS);
  assert.deepEqual(parseProgress('{"version":2}'), DEFAULT_PROGRESS);
  assert.deepEqual(parseProgress('{"version":1,"sessionsCompleted":"two"}'), DEFAULT_PROGRESS);
});

test('storage exceptions do not block loading or saving', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.deepEqual(loadProgress(broken), DEFAULT_PROGRESS);
  assert.equal(saveProgress(broken, DEFAULT_PROGRESS), false);
});

test('load and save use the supplied storage implementation', () => {
  const storage = memoryStorage();
  const progress = { ...DEFAULT_PROGRESS, sessionsCompleted: 1, bridgeStage: 1 };
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(loadProgress(storage), progress);
});

test('active stage snapshot restores only the current station and seed', () => {
  const storage = memoryStorage();
  assert.equal(saveActiveStage(storage, { seed: 81, stage: 'math' }), true);
  assert.deepEqual(loadActiveStage(storage), { seed: 81, stage: 'math' });
  clearActiveStage(storage);
  assert.equal(loadActiveStage(storage), null);
});

test('invalid active stage snapshots are ignored', () => {
  const storage = memoryStorage();
  storage.setItem('space-construction-fleet.active.v1', JSON.stringify({ seed: 4, stage: 'complete' }));
  assert.equal(loadActiveStage(storage), null);
});
