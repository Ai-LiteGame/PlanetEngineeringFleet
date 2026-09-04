import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeechCountdown, setSoundEnabled, speak } from '../src/audio.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('speak exposes completion and safely resolves when speech is unavailable', async () => {
  const utteranceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  const synthesisDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis');
  let utterance;

  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: class SpeechSynthesisUtterance {
      constructor(text) { this.text = text; }
    },
  });
  Object.defineProperty(globalThis, 'speechSynthesis', {
    configurable: true,
    value: {
      cancel() {},
      speak(value) { utterance = value; },
    },
  });

  try {
    setSoundEnabled(true);
    let settled = false;
    const completion = speak('bridge', 'en-US').then((value) => {
      settled = true;
      return value;
    });
    await Promise.resolve();
    assert.equal(settled, false);
    utterance.onend();
    assert.equal(await completion, true);

    delete globalThis.SpeechSynthesisUtterance;
    assert.equal(await speak('bridge', 'en-US'), false);
  } finally {
    setSoundEnabled(true);
    if (utteranceDescriptor) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', utteranceDescriptor);
    else delete globalThis.SpeechSynthesisUtterance;
    if (synthesisDescriptor) Object.defineProperty(globalThis, 'speechSynthesis', synthesisDescriptor);
    else delete globalThis.speechSynthesis;
  }
});

test('speech countdown starts after speech and ignores stale rapid restarts', async () => {
  const speeches = [];
  const timers = [];
  let countdownStartCount = 0;
  let readyCount = 0;
  const countdown = createSpeechCountdown({
    speaker() {
      const speech = deferred();
      speeches.push(speech);
      return speech.promise;
    },
    schedule(callback, delay) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearSchedule(timer) { timer.cleared = true; },
    onCountdownStart() { countdownStartCount += 1; },
    onComplete() { readyCount += 1; },
  });

  const firstStart = countdown.start('first', 'en-US');
  assert.equal(timers.length, 0);
  const secondStart = countdown.start('second', 'en-US');
  speeches[0].resolve(true);
  await firstStart;
  assert.equal(timers.length, 0);
  assert.equal(countdownStartCount, 0);

  speeches[1].resolve(true);
  await secondStart;
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 3000);
  assert.equal(countdownStartCount, 1);

  const thirdStart = countdown.start('third', 'en-US');
  assert.equal(timers[0].cleared, true);
  timers[0].callback();
  assert.equal(readyCount, 0);

  speeches[2].resolve(true);
  await thirdStart;
  assert.equal(timers.length, 2);
  assert.equal(countdownStartCount, 2);
  timers[1].callback();
  assert.equal(readyCount, 1);
});
