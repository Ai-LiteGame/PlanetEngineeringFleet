import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function runtimeFiles(directory, suffixes) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await runtimeFiles(path, suffixes));
    if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(`./${path}`);
    }
  }

  return files;
}

test('manifest exposes an installable relative-scope standalone app', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.deepEqual(manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })), [
    { src: 'assets/icons/icon-192.png', sizes: '192x192', purpose: 'any' },
    { src: 'assets/icons/icon-512.png', sizes: '512x512', purpose: 'any' },
    { src: 'assets/icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
  ]);
});

test('HTML links the manifest, Apple icon, and registration module', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+apple-touch-icon-180\.png/);
  assert.match(html, /type="module" src="src\/register-service-worker\.js"/);
});

test('committed PNG icons have their declared dimensions', async () => {
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon-180.png', 180]]) {
    const bytes = await readFile(new URL(`../assets/icons/${name}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size, name);
    assert.equal(bytes.readUInt32BE(20), size, name);
    assert.equal((await stat(new URL(`../assets/icons/${name}`, import.meta.url))).size > 1000, true, name);
  }
});

test('shared asset list declares each current runtime resource exactly once', async () => {
  const { PWA_ASSETS } = await import('../pwa-assets.js');
  assert.equal(PWA_ASSETS.every((asset) => asset.startsWith('./')), true);
  assert.equal(new Set(PWA_ASSETS).size, PWA_ASSETS.length);

  const currentRuntimeFiles = [
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './pwa-assets.js',
    './service-worker.js',
    ...await runtimeFiles('src', ['.js']),
    ...await runtimeFiles('assets', ['.svg']),
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-maskable-512.png',
    './assets/icons/apple-touch-icon-180.png',
  ];

  assert.deepEqual([...PWA_ASSETS].sort(), currentRuntimeFiles.sort());
});

test('service worker registration uses the relative module worker and fails safely', async () => {
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  const { registerServiceWorker } = await import('../src/register-service-worker.js');

  assert.equal(await registerServiceWorker(null, logger), null);
  assert.deepEqual(warnings, []);

  const registration = { scope: 'https://example.test/games/' };
  const calls = [];
  const container = {
    register: async (...args) => {
      calls.push(args);
      return registration;
    },
  };
  assert.equal(await registerServiceWorker(container, logger), registration);
  assert.deepEqual(calls, [['./service-worker.js', { scope: './', type: 'module' }]]);

  const rejected = { register: async () => { throw new Error('unavailable'); } };
  assert.equal(await registerServiceWorker(rejected, logger), null);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], '离线功能暂时不可用。');
  assert.equal(warnings[0][1] instanceof Error, true);
});
