export async function registerServiceWorker(
  container = globalThis.navigator?.serviceWorker,
  logger = globalThis.console,
  reloadPage = () => globalThis.location?.reload?.(),
) {
  if (!container?.register) return null;

  const shouldReloadOnUpdate = Boolean(container.controller);
  let hasReloaded = false;
  if (shouldReloadOnUpdate && container.addEventListener) {
    container.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      reloadPage();
    });
  }

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
