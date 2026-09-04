import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

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

function decodeRgbaPng(bytes) {
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8, 'PNG bit depth');
  assert.equal(bytes[25], 6, 'PNG color type');

  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const compressed = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = compressed[offset];
    offset += 1;
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const previous = y === 0 ? null : pixels.subarray((y - 1) * stride, y * stride);

    for (let x = 0; x < stride; x += 1) {
      const value = compressed[offset + x];
      const left = x < 4 ? 0 : row[x - 4];
      const above = previous?.[x] ?? 0;
      const upperLeft = x < 4 ? 0 : previous?.[x - 4] ?? 0;
      if (filter === 0) row[x] = value;
      if (filter === 1) row[x] = (value + left) & 0xff;
      if (filter === 2) row[x] = (value + above) & 0xff;
      if (filter === 3) row[x] = (value + Math.floor((left + above) / 2)) & 0xff;
      if (filter === 4) {
        const estimate = left + above - upperLeft;
        const leftDistance = Math.abs(estimate - left);
        const aboveDistance = Math.abs(estimate - above);
        const upperLeftDistance = Math.abs(estimate - upperLeft);
        const predictor = leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
          ? left
          : aboveDistance <= upperLeftDistance ? above : upperLeft;
        row[x] = (value + predictor) & 0xff;
      }
    }
    offset += stride;
  }

  return { width, height, pixels };
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

test('maskable PNG keeps excavator paint inside the central 60 percent safe area', async () => {
  const png = decodeRgbaPng(await readFile(new URL('../assets/icons/icon-maskable-512.png', import.meta.url)));
  const boundary = png.width * 0.2;
  const paintedPixels = [];

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      const red = png.pixels[offset];
      const green = png.pixels[offset + 1];
      const blue = png.pixels[offset + 2];
      if ((red === 246 && green === 200 && blue === 76) || (red === 217 && green === 101 && blue === 82)) {
        paintedPixels.push([x, y]);
      }
    }
  }

  const vehiclePixels = [...paintedPixels];
  for (const [paintedX, paintedY] of paintedPixels) {
    for (let y = Math.max(0, paintedY - 12); y <= Math.min(png.height - 1, paintedY + 12); y += 1) {
      for (let x = Math.max(0, paintedX - 12); x <= Math.min(png.width - 1, paintedX + 12); x += 1) {
        const offset = (y * png.width + x) * 4;
        if (png.pixels[offset] === 22 && png.pixels[offset + 1] === 54 && png.pixels[offset + 2] === 83) {
          vehiclePixels.push([x, y]);
        }
      }
    }
  }

  assert.equal(paintedPixels.length > 100, true, 'excavator paint is present');
  const unsafePixels = vehiclePixels.filter(([x, y]) => x < boundary || x >= png.width - boundary || y < boundary || y >= png.height - boundary);
  assert.equal(unsafePixels.length, 0, `unsafe vehicle pixel bounds: ${JSON.stringify({
    left: Math.min(...unsafePixels.map(([x]) => x)),
    right: Math.max(...unsafePixels.map(([x]) => x)),
    top: Math.min(...unsafePixels.map(([, y]) => y)),
    bottom: Math.max(...unsafePixels.map(([, y]) => y)),
  })}`);
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
  assert.deepEqual(calls, [[
    './service-worker.js',
    { scope: './', type: 'module', updateViaCache: 'none' },
  ]]);

  const rejected = { register: async () => { throw new Error('unavailable'); } };
  assert.equal(await registerServiceWorker(rejected, logger), null);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], '离线功能暂时不可用。');
  assert.equal(warnings[0][1] instanceof Error, true);
});
