export async function registerServiceWorker(
  container = globalThis.navigator?.serviceWorker,
  logger = globalThis.console,
) {
  if (!container?.register) return null;
  try {
    return await container.register('./service-worker.js', {
      scope: './',
      type: 'module',
      updateViaCache: 'none',
    });
  } catch (error) {
    logger?.warn?.('离线功能暂时不可用。', error);
    return null;
  }
}

if (globalThis.window) registerServiceWorker();
