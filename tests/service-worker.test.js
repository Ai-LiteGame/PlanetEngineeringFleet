import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';

import { PWA_ASSETS, PWA_CACHE_PREFIX, PWA_CACHE_VERSION } from '../pwa-assets.js';
import {
  PWA_CACHE_NAME,
  activateApp,
  installApp,
  respondToRequest,
  shouldHandleRequest,
} from '../service-worker.js';

const APP_SCOPE = 'https://game.test/app/';

function expectedCacheName(scope, version = PWA_CACHE_VERSION) {
  const scopeUrl = new URL(scope);
  const scopePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
  return `${PWA_CACHE_PREFIX}:${encodeURIComponent(scopePath)}:${version}`;
}

const APP_CACHE_NAME = expectedCacheName(APP_SCOPE);

function requestKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function createMemoryCacheStorage(names = []) {
  const caches = new Map(names.map((name) => [name, new Map()]));
  const storage = {
    addAllError: null,
    addedRequests: [],
    addedUrls: [],
    deletedNames: [],
    globalMatchCalls: 0,
    matchedCacheNames: [],
    openError: null,
    openedNames: [],
    putError: null,
    writtenUrls: [],
    async delete(name) {
      storage.deletedNames.push(name);
      return caches.delete(name);
    },
    async keys() {
      return [...caches.keys()];
    },
    async match(request) {
      storage.globalMatchCalls += 1;
      const key = requestKey(request);
      for (const cache of caches.values()) {
        if (cache.has(key)) return cache.get(key);
      }
      return undefined;
    },
    async open(name) {
      storage.openedNames.push(name);
      if (storage.openError) throw storage.openError;
      if (!caches.has(name)) caches.set(name, new Map());
      const cache = caches.get(name);
      return {
        async addAll(urls) {
          if (storage.addAllError) throw storage.addAllError;
          storage.addedRequests.push(...urls);
          storage.addedUrls.push(...urls.map(requestKey));
          for (const url of urls) cache.set(requestKey(url), { precached: true, url: requestKey(url) });
        },
        async match(request) {
          storage.matchedCacheNames.push(name);
          return cache.get(requestKey(request));
        },
        async put(request, response) {
          if (storage.putError) throw storage.putError;
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
    peek(name, request) {
      return caches.get(name)?.get(requestKey(request));
    },
  };
  return storage;
}

function workerDependencies(storage, fetchRequest) {
  return {
    baseUrl: APP_SCOPE,
    cacheStorage: storage,
    fetchRequest,
  };
}

test('request gate accepts only GET requests within the path-bounded app scope', () => {
  const scope = 'https://game.test/app/';
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://game.test/app/src/app.js' }, scope), true);
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://game.test/app/?view=map' }, scope), true);
  assert.equal(shouldHandleRequest({ method: 'POST', url: 'https://game.test/app/src/app.js' }, scope), false);
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://cdn.test/app/src/app.js' }, scope), false);
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://game.test/application/app.js' }, scope), false);
  assert.equal(shouldHandleRequest({ method: 'GET', url: 'https://game.test/sibling/app.js' }, scope), false);
});

test('install fills one versioned cache with every declared asset', async () => {
  const storage = createMemoryCacheStorage();
  await installApp(storage, APP_SCOPE);
  assert.deepEqual(storage.openedNames, [APP_CACHE_NAME]);
  assert.deepEqual(storage.addedUrls, PWA_ASSETS.map((path) => new URL(path, APP_SCOPE).href));
  assert.equal(storage.addedRequests.every((request) => request.cache === 'reload'), true);
});

test('activation removes only stale caches owned by this app', async () => {
  const staleCacheName = expectedCacheName(APP_SCOPE, 'v1');
  const storage = createMemoryCacheStorage([
    staleCacheName, APP_CACHE_NAME, 'another-app-v1',
  ]);
  await activateApp(storage, APP_SCOPE);
  assert.deepEqual(storage.deletedNames, [staleCacheName]);
});

test('sibling deployment scopes cannot delete or read each other caches', async () => {
  const siblingScope = 'https://game.test/sibling/';
  const siblingCacheName = expectedCacheName(siblingScope);
  const staleAppCacheName = expectedCacheName(APP_SCOPE, 'v1');
  const staleSiblingCacheName = expectedCacheName(siblingScope, 'v1');
  const storage = createMemoryCacheStorage([
    staleAppCacheName,
    APP_CACHE_NAME,
    staleSiblingCacheName,
    siblingCacheName,
  ]);

  await installApp(storage, APP_SCOPE);
  await installApp(storage, siblingScope);
  assert.deepEqual(storage.openedNames, [APP_CACHE_NAME, siblingCacheName]);
  assert.notEqual(APP_CACHE_NAME, siblingCacheName);
  assert.equal(PWA_CACHE_NAME, expectedCacheName('https://game.test/'));

  await activateApp(storage, APP_SCOPE);
  assert.deepEqual(storage.deletedNames, [staleAppCacheName]);
  assert.equal((await storage.keys()).includes(staleSiblingCacheName), true);
  assert.equal((await storage.keys()).includes(siblingCacheName), true);

  const request = { method: 'GET', url: 'https://game.test/app/scope-collision.js' };
  const siblingResponse = { body: 'sibling cache' };
  const networkResponse = { body: 'network', ok: false, type: 'basic' };
  storage.seed(siblingCacheName, request, siblingResponse);
  storage.matchedCacheNames.length = 0;

  assert.equal(
    await respondToRequest(request, workerDependencies(storage, async () => networkResponse)),
    networkResponse,
  );
  assert.deepEqual(storage.matchedCacheNames, [APP_CACHE_NAME]);
  assert.equal(storage.peek(siblingCacheName, request), siblingResponse);
});

test('activation preserves a nested scope whose encoded cache name shares the parent prefix', async () => {
  const nestedScope = 'https://game.test/app/-school/';
  const staleAppCacheName = expectedCacheName(APP_SCOPE, 'v1');
  const nestedCacheName = expectedCacheName(nestedScope);
  const staleNestedCacheName = expectedCacheName(nestedScope, 'v1');
  const storage = createMemoryCacheStorage([
    staleAppCacheName,
    APP_CACHE_NAME,
    staleNestedCacheName,
    nestedCacheName,
  ]);

  await activateApp(storage, APP_SCOPE);

  assert.deepEqual(storage.deletedNames, [staleAppCacheName]);
  assert.equal((await storage.keys()).includes(staleNestedCacheName), true);
  assert.equal((await storage.keys()).includes(nestedCacheName), true);
});

test('cached response takes precedence over a network request', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://game.test/app/src/app.js' };
  const cached = { body: 'cached' };
  storage.seed(APP_CACHE_NAME, request, cached);
  let fetches = 0;

  const response = await respondToRequest(request, workerDependencies(storage, async () => {
    fetches += 1;
    return { body: 'network' };
  }));

  assert.equal(response, cached);
  assert.equal(fetches, 0);
  assert.deepEqual(storage.matchedCacheNames, [APP_CACHE_NAME]);
  assert.equal(storage.globalMatchCalls, 0);
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
    assert.equal(storage.peek(APP_CACHE_NAME, request), cachedCopy);
  }
});

test('same-origin sibling paths bypass the app cache and use the network', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://game.test/application/runtime.js' };
  const cached = { body: 'wrong scoped response' };
  const networkResponse = { body: 'network' };
  storage.seed(APP_CACHE_NAME, request, cached);

  const response = await respondToRequest(request, workerDependencies(storage, async () => networkResponse));

  assert.equal(response, networkResponse);
  assert.deepEqual(storage.openedNames, []);
  assert.equal(storage.globalMatchCalls, 0);
});

test('normal and offline-shell lookups cannot collide with a foreign cache', async () => {
  const storage = createMemoryCacheStorage();
  const request = { method: 'GET', url: 'https://game.test/app/runtime.js' };
  const foreignResponse = { body: 'foreign runtime' };
  const networkResponse = {
    body: 'network',
    ok: true,
    type: 'basic',
    clone: () => ({ body: 'network copy' }),
  };
  storage.seed('foreign-cache', request, foreignResponse);

  assert.equal(
    await respondToRequest(request, workerDependencies(storage, async () => networkResponse)),
    networkResponse,
  );
  assert.equal(storage.peek('foreign-cache', request), foreignResponse);
  assert.deepEqual(storage.matchedCacheNames, [APP_CACHE_NAME]);
  assert.equal(storage.globalMatchCalls, 0);

  const navigation = { method: 'GET', mode: 'navigate', url: 'https://game.test/app/lesson' };
  const networkError = new Error('offline');
  storage.seed('foreign-cache', 'https://game.test/app/index.html', { body: 'foreign shell' });
  await assert.rejects(
    respondToRequest(navigation, workerDependencies(storage, async () => { throw networkError; })),
    networkError,
  );
  assert.equal(storage.globalMatchCalls, 0);
});

test('cache clone, open, and put failures never discard a successful network response', async () => {
  for (const failure of ['clone', 'open', 'put']) {
    const storage = createMemoryCacheStorage();
    const request = { method: 'GET', url: `https://game.test/app/${failure}.js` };
    const cacheError = new Error(`${failure} failed`);
    const networkResponse = {
      ok: true,
      type: 'basic',
      clone: () => {
        if (failure === 'clone') throw cacheError;
        return { body: 'copy' };
      },
    };
    if (failure === 'open') storage.openError = cacheError;
    if (failure === 'put') storage.putError = cacheError;
    let fetches = 0;

    const response = await respondToRequest(request, workerDependencies(storage, async () => {
      fetches += 1;
      return networkResponse;
    }));

    assert.equal(response, networkResponse, failure);
    assert.equal(fetches, 1, failure);
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
  storage.seed(APP_CACHE_NAME, 'https://game.test/app/index.html', fallback);
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

    let siblingResponded = false;
    handlers.get('fetch')({
      request: { method: 'GET', url: 'https://game.test/application/runtime.js' },
      respondWith: () => { siblingResponded = true; },
    });
    assert.equal(siblingResponded, false);
  } finally {
    if (scopeDescriptor) Object.defineProperty(globalThis, 'ServiceWorkerGlobalScope', scopeDescriptor);
    else delete globalThis.ServiceWorkerGlobalScope;
    if (selfDescriptor) Object.defineProperty(globalThis, 'self', selfDescriptor);
    else delete globalThis.self;
  }
});

test('failed atomic precache prevents skipWaiting', async () => {
  const scopeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ServiceWorkerGlobalScope');
  const selfDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const storage = createMemoryCacheStorage();
  const handlers = new Map();
  const precacheError = new Error('precache failed');
  let skips = 0;
  storage.addAllError = precacheError;

  class WorkerScope {}
  const worker = new WorkerScope();
  Object.assign(worker, {
    caches: storage,
    clients: { claim: async () => {} },
    fetch: async () => ({ ok: true }),
    location: { origin: 'https://game.test' },
    registration: { scope: 'https://game.test/app/' },
    skipWaiting: () => { skips += 1; },
    addEventListener(type, handler) { handlers.set(type, handler); },
  });
  Object.defineProperty(globalThis, 'ServiceWorkerGlobalScope', { configurable: true, value: WorkerScope });
  Object.defineProperty(globalThis, 'self', { configurable: true, value: worker });

  try {
    await import(`../service-worker.js?failed-install=${Date.now()}`);
    let installWork;
    handlers.get('install')({ waitUntil: (promise) => { installWork = promise; } });
    await assert.rejects(installWork, precacheError);
    assert.equal(skips, 0);
    assert.deepEqual(storage.addedUrls, []);
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
