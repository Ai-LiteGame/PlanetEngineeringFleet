import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeechCountdown, setSoundEnabled, speak } from '../src/audio.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function preserveGlobals(names) {
  const descriptors = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  return () => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

test('speak prefers the Flutter native bridge without Web Speech', async () => {
  const restore = preserveGlobals([
    'flutter_inappwebview',
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const bridgeResult = deferred();
  const calls = [];

  Object.defineProperty(globalThis, 'flutter_inappwebview', {
    configurable: true,
    value: {
      callHandler(name, payload) {
        calls.push({ name, payload });
        return bridgeResult.promise;
      },
    },
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const completion = speak('bridge', 'en-US');
    await Promise.resolve();
    assert.deepEqual(calls, [{
      name: 'planetEngineeringFleetTts',
      payload: { text: 'bridge', lang: 'en-US', rate: 0.72, pitch: 1.08 },
    }]);
    bridgeResult.resolve({ ok: true });
    assert.equal(await completion, true);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('speak falls back to Web Speech after native failure', async () => {
  const restore = preserveGlobals([
    'flutter_inappwebview',
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const nativeResults = [
    () => Promise.resolve({ ok: false }),
    () => Promise.reject(new Error('offline')),
  ];
  let utterance;

  Object.defineProperty(globalThis, 'flutter_inappwebview', {
    configurable: true,
    value: { callHandler: () => nativeResults.shift()() },
  });
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
    for (const text of ['false result', 'rejection']) {
      const completion = speak(text, 'zh-CN');
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(utterance.text, text);
      utterance.onend();
      assert.equal(await completion, true);
    }
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('a new native speech request settles the stale request as cancelled', async () => {
  const restore = preserveGlobals([
    'flutter_inappwebview',
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const bridgeResults = [];

  Object.defineProperty(globalThis, 'flutter_inappwebview', {
    configurable: true,
    value: {
      callHandler() {
        const result = deferred();
        bridgeResults.push(result);
        return result.promise;
      },
    },
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const first = speak('first', 'en-US');
    const second = speak('second', 'en-US');
    assert.equal(await first, false);
    bridgeResults[1].resolve({ ok: true });
    assert.equal(await second, true);
    bridgeResults[0].resolve({ ok: true });
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

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
