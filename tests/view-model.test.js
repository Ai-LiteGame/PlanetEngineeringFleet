import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, submitAnswer, advance } from '../src/game-core.js';
import {
  nextParentTab,
  nextResetConfirmation,
  resetGameStorage,
} from '../src/parent-actions.js';
import {
  ACTIVE_KEY,
  LEGACY_ACTIVE_KEY,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
} from '../src/storage.js';
import {
  getStageProgress,
  getHintView,
  getVehicleActionClass,
  getBridgeVariant,
  isSettingsActivationKey,
} from '../src/view-model.js';

test('stage progress distinguishes done, current, and upcoming stations', () => {
  let state = createSession(2, {});
  for (let index = 0; index < 3; index += 1) {
    state = submitAnswer(state, state.questions.chinese[index].answerId).state;
    state = advance(state);
  }
  assert.deepEqual(getStageProgress(state).map((item) => item.status), [
    'done', 'current', 'upcoming', 'upcoming',
  ]);
});

test('hint view moves from replay guidance to explicit answer guidance', () => {
  const state = createSession(2, {});
  const question = state.questions.chinese[0];
  assert.deepEqual(getHintView({ ...state, hintLevel: 1 }, question), {
    message: '再听一遍，看看哪块施工牌在提醒你。',
    answerId: null,
  });
  assert.deepEqual(getHintView({ ...state, hintLevel: 2 }, question), {
    message: question.hint,
    answerId: question.answerId,
  });
});

test('each station activates its own construction vehicle action', () => {
  assert.equal(getVehicleActionClass('chinese'), 'is-digging');
  assert.equal(getVehicleActionClass('english'), 'is-mixing');
  assert.equal(getVehicleActionClass('math'), 'is-lifting');
  assert.equal(getVehicleActionClass('mixed'), 'is-delivering');
});

test('bridge variant is clamped to the three visible construction phases', () => {
  assert.equal(getBridgeVariant(-1), 0);
  assert.equal(getBridgeVariant(2), 2);
  assert.equal(getBridgeVariant(9), 3);
});

test('adult settings keyboard activation accepts enter and space only', () => {
  assert.equal(isSettingsActivationKey('Enter'), true);
  assert.equal(isSettingsActivationKey(' '), true);
  assert.equal(isSettingsActivationKey('Space'), true);
  assert.equal(isSettingsActivationKey('Escape'), false);
});

test('parent tabs support wrapping arrow navigation plus Home and End', () => {
  assert.equal(nextParentTab('course', 'ArrowRight'), 'settings');
  assert.equal(nextParentTab('settings', 'ArrowRight'), 'course');
  assert.equal(nextParentTab('course', 'ArrowLeft'), 'settings');
  assert.equal(nextParentTab('settings', 'ArrowLeft'), 'course');
  assert.equal(nextParentTab('settings', 'Home'), 'course');
  assert.equal(nextParentTab('course', 'End'), 'settings');
  assert.equal(nextParentTab('course', 'Enter'), 'course');
});

test('reset requires two decisions and removes exactly the four game-owned keys', () => {
  const ownedKeys = [STORAGE_KEY, LEGACY_STORAGE_KEY, ACTIVE_KEY, LEGACY_ACTIVE_KEY];
  const values = new Map([...ownedKeys, 'unrelated.preference'].map((key) => [key, key]));
  const removed = [];
  const storage = {
    removeItem(key) {
      removed.push(key);
      values.delete(key);
    },
  };

  const first = nextResetConfirmation(false);
  assert.deepEqual(first, { armed: true, confirmed: false });
  assert.deepEqual(removed, []);

  const second = nextResetConfirmation(first.armed);
  assert.deepEqual(second, { armed: false, confirmed: true });
  if (second.confirmed) resetGameStorage(storage);

  assert.deepEqual(removed, ownedKeys);
  assert.equal(values.get('unrelated.preference'), 'unrelated.preference');
  assert.deepEqual(ownedKeys.every((key) => !values.has(key)), true);
});
