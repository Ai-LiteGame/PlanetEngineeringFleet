import { PWA_ASSETS, PWA_CACHE_PREFIX, PWA_CACHE_VERSION } from './pwa-assets.js';

function normalizedScopePath(appScope) {
  const pathname = new URL(appScope).pathname;
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function cacheNamespaceForScope(appScope) {
  return `${PWA_CACHE_PREFIX}:${encodeURIComponent(normalizedScopePath(appScope))}:`;
}

export function getPwaCacheName(appScope) {
  return `${cacheNamespaceForScope(appScope)}${PWA_CACHE_VERSION}`;
}

export const PWA_CACHE_NAME = getPwaCacheName('https://pwa.invalid/');

export function shouldHandleRequest(request, appScope) {
  if (request.method !== 'GET') return false;

  try {
    const requestUrl = new URL(request.url);
    const scopeUrl = new URL(appScope);
    if (requestUrl.origin !== scopeUrl.origin) return false;
    const scopePath = normalizedScopePath(appScope);
    return requestUrl.pathname === scopeUrl.pathname || requestUrl.pathname.startsWith(scopePath);
  } catch {
    return false;
  }
}

export async function installApp(cacheStorage, baseUrl) {
  const cache = await cacheStorage.open(getPwaCacheName(baseUrl));
  await cache.addAll(PWA_ASSETS.map((path) => new URL(path, baseUrl).href));
}

export async function activateApp(cacheStorage, baseUrl) {
  const cacheNamespace = cacheNamespaceForScope(baseUrl);
  const cacheName = getPwaCacheName(baseUrl);
  const names = await cacheStorage.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(cacheNamespace) && name !== cacheName)
    .map((name) => cacheStorage.delete(name)));
}

export async function respondToRequest(request, { cacheStorage, fetchRequest, baseUrl }) {
  if (!shouldHandleRequest(request, baseUrl)) return fetchRequest(request);

  const cacheName = getPwaCacheName(baseUrl);
  let cache;
  try {
    cache = await cacheStorage.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
  } catch {
    cache = undefined;
  }

  let response;
  try {
    response = await fetchRequest(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      try {
        cache ??= await cacheStorage.open(cacheName);
        const fallback = await cache.match(new URL('./index.html', baseUrl).href);
        if (fallback) return fallback;
      } catch {
        // The original network error remains authoritative when cache lookup also fails.
      }
    }
    throw error;
  }

  if (response.ok && ['basic', 'default'].includes(response.type)) {
    try {
      const cachedCopy = response.clone();
      cache ??= await cacheStorage.open(cacheName);
      await cache.put(request, cachedCopy);
    } catch {
      // Runtime caching is best-effort; the successful network response remains usable.
    }
  }
  return response;
}

if (
  typeof globalThis.ServiceWorkerGlobalScope !== 'undefined'
  && globalThis.self instanceof globalThis.ServiceWorkerGlobalScope
) {
  const worker = globalThis.self;

  worker.addEventListener('install', (event) => {
    event.waitUntil(installApp(worker.caches, worker.registration.scope).then(() => worker.skipWaiting()));
  });
  worker.addEventListener('activate', (event) => {
    event.waitUntil(activateApp(worker.caches, worker.registration.scope).then(() => worker.clients.claim()));
  });
  worker.addEventListener('fetch', (event) => {
    if (shouldHandleRequest(event.request, worker.registration.scope)) {
      event.respondWith(respondToRequest(event.request, {
        cacheStorage: worker.caches,
        fetchRequest: worker.fetch.bind(worker),
        baseUrl: worker.registration.scope,
      }));
    }
  });
}
