import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { PWA_ASSETS, PWA_CACHE_PREFIX } from '../pwa-assets.js';
import {
  PWA_CACHE_NAME,
  activateApp,
  installApp,
  respondToRequest,
  shouldHandleRequest,
} from '../service-worker.js';

function requestKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function createMemoryCacheStorage(names = []) {
  const caches = new Map(names.map((name) => [name, new Map()]));
  const storage = {
    addedUrls: [],
    deletedNames: [],
    openedNames: [],
    writtenUrls: [],
    async delete(name) {
      storage.deletedNames.push(name);
      return caches.delete(name);
    },
    async keys() {
      return [...caches.keys()];
    },
    async match(request) {
      const key = requestKey(request);
      for (const cache of caches.values()) {
        if (cache.has(key)) return cache.get(key);
      }
      return undefined;
    },
    async open(name) {
      storage.openedNames.push(name);
      if (!caches.has(name)) caches.set(name, new Map());
      const cache = caches.get(name);
      return {
        async addAll(urls) {
          storage.addedUrls.push(...urls);
          for (const url of urls) cache.set(url, { precached: true, url });
        },
        async put(request, response) {
          const key = requestKey(request);
          storage.writtenUrls.push(key);
          cache.set(key, response);
        },
      };
    },
    seed(name, request, response) {
      if (!caches.has(name)) caches.set(name, new Map());
      caches.get(name).set(requestKey(request), response);
    },
  };
  return storage;
}

function workerDependencies(storage, fetchRequest) {
  return {
    baseUrl: 'https://game.test/app/',
    cacheStorage: storage,
    fetchRequest,
  };
}

test('request gate accepts only same-origin GET requests', () => {
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://game.test/src/app.js' }, 'https://game.test'), true);
  assert.equal(shouldHandleRequest({ method: 'POST', url: 'https://game.test/src/app.js' }, 'https://game.test'), false);
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://cdn.test/app.js' }, 'https://game.test'), false);
});

test('install fills one versioned cache with every declared asset', async () => {
  const storage = createMemoryCacheStorage();
  await installApp(storage, 'https://game.test/app/');
  assert.deepEqual(storage.openedNames, [PWA_CACHE_NAME]);
  assert.deepEqual(storage.addedUrls, PWA_ASSETS.map((path) => new URL(path, 'https://game.test/app/').href));
});

test('activation removes only stale caches owned by this app', async () => {
  const storage = createMemoryCacheStorage([
    `${PWA_CACHE_PREFIX}-old`, PWA_CACHE_NAME, 'another-app-v1',
  ]);
  await activateApp(storage);
  assert.deepEqual(storage.deletedNames, [`${PWA_CACHE_PREFIX}-old`]);
});

test('cached response takes precedence over a network request', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://game.test/app/src/app.js' };
  const cached = { body: 'cached' };
  storage.seed(PWA_CACHE_NAME, request, cached);
  let fetches = 0;

  const response = await respondToRequest(request, workerDependencies(storage, async () => {
    fetches += 1;
    return { body: 'network' };
  }));

  assert.equal(response, cached);
  assert.equal(fetches, 0);
});

test('successful same-origin basic and default responses are returned and cached', async () => {
  for (const type of ['basic', 'default']) {
    const storage = createMemoryCacheStorage();
    const request = { method: 'GET', url: `https://game.test/app/src/${type}.js` };
    const cachedCopy = { body: `${type} copy` };
    const networkResponse = {
      body: type,
      ok: true,
      type,
      clone: () => cachedCopy,
    };

    const response = await respondToRequest(request, workerDependencies(storage, async () => networkResponse));

    assert.equal(response, networkResponse);
    assert.deepEqual(storage.writtenUrls, [request.url]);
    assert.equal(await storage.match(request), cachedCopy);
  }
});

test('unsuccessful and non-basic responses are not written to the runtime cache', async () => {
  for (const response of [
    { ok: false, type: 'basic', clone: () => ({}) },
    { ok: true, type: 'opaque', clone: () => ({}) },
  ]) {
    const storage = createMemoryCacheStorage();
    const request = { method: 'GET', url: 'https://game.test/app/src/app.js' };
    assert.equal(await respondToRequest(request, workerDependencies(storage, async () => response)), response);
    assert.deepEqual(storage.writtenUrls, []);
  }
});

test('cross-origin requests pass through without entering the cache', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://cdn.test/app.js' };
  const networkResponse = { body: 'network' };
  let fetches = 0;

  const response = await respondToRequest(request, workerDependencies(storage, async () => {
    fetches += 1;
    return networkResponse;
  }));

  assert.equal(response, networkResponse);
  assert.equal(fetches, 1);
  assert.deepEqual(storage.writtenUrls, []);
  assert.deepEqual(storage.openedNames, []);
});

test('failed navigation falls back to the cached app shell', async () => {
  const storage = createMemoryCacheStorage();
  const fallback = { body: 'app shell' };
  storage.seed(PWA_CACHE_NAME, 'https://game.test/app/index.html', fallback);
  const request = { method: 'GET', mode: 'navigate', url: 'https://game.test/app/lesson' };

  const response = await respondToRequest(request, workerDependencies(storage, async () => {
    throw new Error('offline');
  }));

  assert.equal(response, fallback);
});

test('non-navigation network failures propagate to the caller', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://game.test/app/src/app.js' };
  const networkError = new Error('offline');

  await assert.rejects(
    respondToRequest(request, workerDependencies(storage, async () => { throw networkError; })),
    networkError,
  );
});

test('worker scope binds install, activate, and same-origin fetch handlers', async () => {
  const scopeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ServiceWorkerGlobalScope');
  const selfDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const storage = createMemoryCacheStorage();
  const handlers = new Map();
  let claims = 0;
  let skips = 0;

  class WorkerScope {}
  const worker = new WorkerScope();
  Object.assign(worker, {
    caches: storage,
    clients: { claim: () => { claims += 1; } },
    fetch: async () => ({ ok: true, type: 'basic', clone: () => ({}) }),
    location: { origin: 'https://game.test' },
    registration: { scope: 'https://game.test/app/' },
    skipWaiting: () => { skips += 1; },
    addEventListener(type, handler) { handlers.set(type, handler); },
  });
  Object.defineProperty(globalThis, 'ServiceWorkerGlobalScope', { configurable: true, value: WorkerScope });
  Object.defineProperty(globalThis, 'self', { configurable: true, value: worker });

  try {
    await import(`../service-worker.js?worker-scope=${Date.now()}`);

    let installWork;
    handlers.get('install')({ waitUntil: (promise) => { installWork = promise; } });
    await installWork;
    assert.equal(skips, 1);
    assert.deepEqual(storage.addedUrls, PWA_ASSETS.map((path) => new URL(path, worker.registration.scope).href));

    let activateWork;
    handlers.get('activate')({ waitUntil: (promise) => { activateWork = promise; } });
    await activateWork;
    assert.equal(claims, 1);

    let fetchWork;
    handlers.get('fetch')({
      request: { method: 'GET', url: 'https://game.test/app/runtime.js' },
      respondWith: (promise) => { fetchWork = promise; },
    });
    await fetchWork;
    assert.deepEqual(storage.writtenUrls, ['https://game.test/app/runtime.js']);
  } finally {
    if (scopeDescriptor) Object.defineProperty(globalThis, 'ServiceWorkerGlobalScope', scopeDescriptor);
    else delete globalThis.ServiceWorkerGlobalScope;
    if (selfDescriptor) Object.defineProperty(globalThis, 'self', selfDescriptor);
    else delete globalThis.self;
  }
});

test('every non-root precache asset is a regular file', async () => {
  for (const asset of PWA_ASSETS.filter((path) => path !== './')) {
    assert.equal((await stat(new URL(asset, new URL('../', import.meta.url)))).isFile(), true, asset);
  }
});
