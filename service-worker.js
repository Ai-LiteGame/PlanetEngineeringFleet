import { PWA_ASSETS, PWA_CACHE_PREFIX, PWA_CACHE_VERSION } from './pwa-assets.js';

export const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`;

export function shouldHandleRequest(request, origin) {
  return request.method === 'GET' && new URL(request.url).origin === origin;
}

export async function installApp(cacheStorage, baseUrl) {
  const cache = await cacheStorage.open(PWA_CACHE_NAME);
  await cache.addAll(PWA_ASSETS.map((path) => new URL(path, baseUrl).href));
}

export async function activateApp(cacheStorage) {
  const names = await cacheStorage.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(`${PWA_CACHE_PREFIX}-`) && name !== PWA_CACHE_NAME)
    .map((name) => cacheStorage.delete(name)));
}

export async function respondToRequest(request, { cacheStorage, fetchRequest, baseUrl }) {
  const origin = new URL(baseUrl).origin;
  if (!shouldHandleRequest(request, origin)) return fetchRequest(request);

  const cachedResponse = await cacheStorage.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const response = await fetchRequest(request);
    if (response.ok && ['basic', 'default'].includes(response.type)) {
      const cache = await cacheStorage.open(PWA_CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const fallback = await cacheStorage.match(new URL('./index.html', baseUrl).href);
      if (fallback) return fallback;
    }
    throw error;
  }
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
    event.waitUntil(activateApp(worker.caches).then(() => worker.clients.claim()));
  });
  worker.addEventListener('fetch', (event) => {
    if (shouldHandleRequest(event.request, worker.location.origin)) {
      event.respondWith(respondToRequest(event.request, {
        cacheStorage: worker.caches,
        fetchRequest: worker.fetch.bind(worker),
        baseUrl: worker.registration.scope,
      }));
    }
  });
}
