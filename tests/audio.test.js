import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeechCountdown, setSoundEnabled, speak } from '../src/audio.js';

const nativeSpeechHandler = 'planetEngineeringFleetTts';
const compatibleSpeechHandler = 'planetEngineeringFleetTtsFallback';

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

function fakeNativeBridge(onMessage) {
  const listeners = new Set();
  return {
    addEventListener(type, listener) {
      if (type === 'message') listeners.add(listener);
    },
    postMessage(message) {
      onMessage(JSON.parse(message), (response) => {
        for (const listener of listeners) {
          listener({ data: JSON.stringify(response) });
        }
      });
    },
  };
}

test('speak prefers the origin-restricted Flutter message bridge without Web Speech', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const calls = [];

  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => calls.push({ message, reply })),
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const completion = speak('bridge', 'en-US');
    await Promise.resolve();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].message.action, 'speak');
    assert.deepEqual(calls[0].message.payload, {
      text: 'bridge', lang: 'en-US', rate: 0.72, pitch: 1.08,
    });
    assert.equal(typeof calls[0].message.id, 'string');
    calls[0].reply({ id: calls[0].message.id, result: { ok: true } });
    assert.equal(await completion, true);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('speak prefers the restricted bridge over the compatible bridge', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    compatibleSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const primaryCalls = [];
  const compatibleCalls = [];
  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => primaryCalls.push({ message, reply })),
  });
  Object.defineProperty(globalThis, compatibleSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => compatibleCalls.push({ message, reply })),
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const completion = speak('手', 'zh-CN');
    assert.equal(primaryCalls.length, 1);
    assert.equal(compatibleCalls.length, 0);
    primaryCalls[0].reply({
      id: primaryCalls[0].message.id,
      result: { ok: true },
    });
    assert.equal(await completion, true);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('speak uses the compatible Flutter bridge when the restricted bridge is unavailable', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    compatibleSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const calls = [];
  delete globalThis[nativeSpeechHandler];
  Object.defineProperty(globalThis, compatibleSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => calls.push({ message, reply })),
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const completion = speak('excavator', 'en-US');
    assert.equal(calls[0].message.action, 'speak');
    calls[0].reply({ id: calls[0].message.id, result: { ok: true } });
    assert.equal(await completion, true);

    const stopped = speak('bulldozer', 'en-US');
    setSoundEnabled(false);
    assert.equal(await stopped, false);
    assert.deepEqual(calls.slice(1).map(({ message }) => message.action), [
      'speak',
      'stop',
    ]);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('speak falls back to Web Speech after native failure', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  let utterance;

  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => {
      reply({ id: message.id, result: { ok: false, reason: 'speech-failed' } });
    }),
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
    const completion = speak('native failure', 'zh-CN');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(utterance.text, 'native failure');
    utterance.onend();
    assert.equal(await completion, true);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('a new native speech request settles the stale request as cancelled', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const bridgeCalls = [];

  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => bridgeCalls.push({ message, reply })),
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const first = speak('first', 'en-US');
    const second = speak('second', 'en-US');
    assert.equal(await first, false);
    assert.deepEqual(bridgeCalls.map(({ message }) => message.action), [
      'speak',
      'stop',
      'speak',
    ]);
    const secondCall = bridgeCalls[2];
    secondCall.reply({ id: secondCall.message.id, result: { ok: true } });
    assert.equal(await second, true);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('turning sound off stops active native speech', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
  ]);
  const bridgeCalls = [];
  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => bridgeCalls.push({ message, reply })),
  });
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.speechSynthesis;

  try {
    setSoundEnabled(true);
    const completion = speak('stop me', 'en-US');
    setSoundEnabled(false);
    assert.equal(await completion, false);
    assert.deepEqual(bridgeCalls.map(({ message }) => message.action), ['speak', 'stop']);
  } finally {
    setSoundEnabled(true);
    restore();
  }
});

test('a stalled native bridge times out, stops native speech, and falls back', async () => {
  const restore = preserveGlobals([
    nativeSpeechHandler,
    'SpeechSynthesisUtterance',
    'speechSynthesis',
    'setTimeout',
    'clearTimeout',
  ]);
  const bridgeCalls = [];
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  let utterance;

  Object.defineProperty(globalThis, nativeSpeechHandler, {
    configurable: true,
    value: fakeNativeBridge((message, reply) => bridgeCalls.push({ message, reply })),
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
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { timer.cleared = true; };

  try {
    setSoundEnabled(true);
    const completion = speak('timeout', 'en-US');
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 12000);
    const timeout = timers[0].callback;
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
    timeout();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(bridgeCalls.map(({ message }) => message.action), ['speak', 'stop']);
    assert.equal(utterance.text, 'timeout');
    utterance.onend();
    assert.equal(await completion, true);
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
