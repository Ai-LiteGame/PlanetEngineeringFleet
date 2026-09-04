# 星球工程车队 PWA 打包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有学习游戏增加跨桌面和移动设备的 PWA 安装、完整离线运行及可部署目录/ZIP 打包能力。

**Architecture:** 根目录的 `pwa-assets.js` 是 Service Worker 与 Node 打包器共享的唯一资源清单。模块化 `service-worker.js` 负责原子预缓存、同源 GET 缓存优先、离线导航回退和旧缓存清理；独立注册模块让不支持 PWA 的浏览器无阻塞降级。Node 打包器只复制清单中的文件到明确的 `dist` 子目录，再调用系统 `zip` 生成平台无关的发布包。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Web App Manifest、Service Worker/Cache Storage、Node.js 18 `node:test`、macOS `sips`、系统 `zip`。

**Spec:** `docs/superpowers/specs/2026-09-04-pwa-packaging-design.md`

## Global Constraints

- 直接在用户指定的当前 `main` 分支实施，不创建工作树或功能分支。
- 运行时不得增加第三方依赖、CDN、远程字体、远程图片或网络 API。
- 不在儿童游戏界面增加安装、更新或网络状态控件。
- 不改变课程、掌握度、荣誉逻辑及 Local Storage 键或数据结构。
- 安装目标是 Windows、macOS、Android 手机/平板和 iPhone/iPad 的现代浏览器；PWA 通过 HTTPS 或 `localhost` 提供。
- 发布产物固定为 `dist/planet-engineering-fleet-pwa/` 与 `dist/planet-engineering-fleet-pwa.zip`。
- 每一项生产代码必须先有观察到预期失败的自动测试。

---

### Task 1: 安装清单、平台元数据与应用图标

**Files:**
- Create: `tests/pwa-metadata.test.js`
- Create: `manifest.webmanifest`
- Create: `pwa-assets.js`
- Create: `src/register-service-worker.js`
- Create: `scripts/icon-sources/app-icon.svg`
- Create: `scripts/icon-sources/app-icon-maskable.svg`
- Create: `assets/icons/icon-192.png`
- Create: `assets/icons/icon-512.png`
- Create: `assets/icons/icon-maskable-512.png`
- Create: `assets/icons/apple-touch-icon-180.png`
- Modify: `index.html`

**Interfaces:**
- Produces: `PWA_CACHE_PREFIX: string`, `PWA_CACHE_VERSION: string`, `PWA_ASSETS: readonly string[]` from `pwa-assets.js`.
- Produces: `registerServiceWorker(container?, logger?): Promise<ServiceWorkerRegistration | null>` from `src/register-service-worker.js`.
- Consumes later: Tasks 2 and 3 import the shared asset constants without duplicating paths.

- [ ] **Step 1: Write the failing metadata and icon tests**

Create `tests/pwa-metadata.test.js` with real JSON/HTML/module/file assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

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
```

Add tests that import `PWA_ASSETS`, assert every value is relative and unique, enumerate the current `index.html`, `styles.css`, manifest, `pwa-assets.js`, `src/**/*.js`, `assets/**/*.svg`, and four runtime PNGs, then assert all current runtime files plus the reserved `./service-worker.js` path are declared. Do not require the reserved worker path to exist until Task 2 creates it. Add a registration test with an injected container to verify `./service-worker.js`, `{ scope: './', type: 'module' }`, null fallback, and warning-only failure behavior.

- [ ] **Step 2: Run the metadata test and verify the expected red state**

Run: `node --test tests/pwa-metadata.test.js`

Expected: FAIL because `manifest.webmanifest`, `pwa-assets.js`, registration module, and PNG icons do not exist and `index.html` has no manifest link.

- [ ] **Step 3: Add manifest, shared asset list, and registration module**

Create a relative-path manifest with this contract:

```json
{
  "id": "./",
  "name": "星球工程车队",
  "short_name": "工程车队",
  "description": "工程车主题的幼小衔接学习游戏",
  "lang": "zh-CN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#f7f7f2",
  "theme_color": "#163653",
  "icons": []
}
```

Populate the three manifest icons exactly as asserted. Create `pwa-assets.js` as an ESM file with a cache prefix scoped to this app, version `v1`, and a frozen explicit list beginning with `./`, `./index.html`, `./styles.css`, `./manifest.webmanifest`, `./service-worker.js`, and `./pwa-assets.js`, followed by every runtime JS/SVG/PNG file.

Create the safe registration boundary:

```js
export async function registerServiceWorker(
  container = globalThis.navigator?.serviceWorker,
  logger = globalThis.console,
) {
  if (!container?.register) return null;
  try {
    return await container.register('./service-worker.js', { scope: './', type: 'module' });
  } catch (error) {
    logger?.warn?.('离线功能暂时不可用。', error);
    return null;
  }
}

if (globalThis.window) registerServiceWorker();
```

Link the manifest, Apple metadata/icon, and registration module from `index.html` without altering visible markup.

- [ ] **Step 4: Create and render the construction-fleet icons**

Create two standalone 512-square SVG sources using the established solid palette (`#163653`, `#f6c84c`, `#d96552`, `#f7f7f2`) and a centered excavator silhouette. The maskable source keeps all essential vehicle pixels inside the central 60% safe region. Render deterministic PNGs:

```bash
mkdir -p assets/icons
sips -s format png --resampleHeightWidth 512 512 scripts/icon-sources/app-icon.svg --out assets/icons/icon-512.png
sips -s format png --resampleHeightWidth 192 192 scripts/icon-sources/app-icon.svg --out assets/icons/icon-192.png
sips -s format png --resampleHeightWidth 512 512 scripts/icon-sources/app-icon-maskable.svg --out assets/icons/icon-maskable-512.png
sips -s format png --resampleHeightWidth 180 180 scripts/icon-sources/app-icon.svg --out assets/icons/apple-touch-icon-180.png
```

Inspect all four PNGs for nonblank vehicle artwork and safe cropping before continuing.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/pwa-metadata.test.js`

Expected: PASS with manifest, HTML, icon, asset-list, and registration checks green.

Run: `npm test`

Expected: all existing 157 tests plus the new metadata tests pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add index.html manifest.webmanifest pwa-assets.js src/register-service-worker.js scripts/icon-sources assets/icons tests/pwa-metadata.test.js
git commit -m "feat: add installable PWA metadata"
```

---

### Task 2: 原子预缓存与离线请求处理

**Files:**
- Create: `tests/service-worker.test.js`
- Create: `service-worker.js`
- Modify: `pwa-assets.js` only if the Task 1 exact-set test reveals a missing runtime path

**Interfaces:**
- Consumes: `PWA_CACHE_PREFIX`, `PWA_CACHE_VERSION`, `PWA_ASSETS` from Task 1.
- Produces: `PWA_CACHE_NAME`, `shouldHandleRequest(request, origin)`, `installApp(cacheStorage, baseUrl)`, `activateApp(cacheStorage)`, and `respondToRequest(request, dependencies)`.
- Error contract: network failures rethrow unless the request is a navigation and cached `index.html` exists.

- [ ] **Step 1: Write failing Service Worker behavior tests**

Create a small in-memory Cache/CacheStorage test adapter, then assert real exported behavior:

```js
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
```

Add tests for cached response precedence, successful runtime cache writes, cross-origin passthrough, failed navigation fallback to cached `index.html`, and non-navigation network error propagation.

Add one filesystem assertion that every non-root entry in `PWA_ASSETS` now resolves to a regular file. This test must fail specifically because `service-worker.js` is absent before Step 3 and pass after the worker is implemented.

- [ ] **Step 2: Run the worker tests and verify the expected red state**

Run: `node --test tests/service-worker.test.js`

Expected: FAIL because `service-worker.js` and all exported behavior are absent.

- [ ] **Step 3: Implement the testable worker functions**

Use explicit dependency injection so Node tests exercise the same code as the browser worker:

```js
import { PWA_ASSETS, PWA_CACHE_PREFIX, PWA_CACHE_VERSION } from './pwa-assets.js';

export const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`;

export function shouldHandleRequest(request, origin) {
  return request.method === 'GET' && new URL(request.url).origin === origin;
}

export async function activateApp(cacheStorage) {
  const names = await cacheStorage.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(`${PWA_CACHE_PREFIX}-`) && name !== PWA_CACHE_NAME)
    .map((name) => cacheStorage.delete(name)));
}
```

`installApp` opens exactly `PWA_CACHE_NAME` and passes absolute app-scope URLs to `addAll`. `respondToRequest` checks the request gate, prefers `cacheStorage.match`, fetches on a miss, writes only successful same-origin basic/default responses, and falls back to cached `index.html` only for navigation requests.

- [ ] **Step 4: Bind worker lifecycle events without breaking Node imports**

Guard browser-only event registration with `globalThis.ServiceWorkerGlobalScope` and `globalThis.self instanceof ServiceWorkerGlobalScope`. Bind:

```js
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
```

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/service-worker.test.js`

Expected: all request, install, activation, cache, fallback, and error tests pass.

Run: `npm test`

Expected: the complete suite passes with no warnings or unhandled rejections.

- [ ] **Step 6: Commit Task 2**

```bash
git add service-worker.js pwa-assets.js tests/service-worker.test.js
git commit -m "feat: add offline PWA cache"
```

---

### Task 3: 可重复的发布目录与 ZIP 打包器

**Files:**
- Create: `tests/pwa-package.test.js`
- Create: `scripts/package-pwa.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `PWA_ASSETS` from Task 1.
- Produces: `PACKAGE_DIRECTORY_NAME`, `collectPackageEntries(projectRoot)`, `buildPwaDirectory({ projectRoot, outputRoot })`, and `createPwaZip({ outputRoot, packageDirectory })`.
- CLI: `npm run package:pwa` rebuilds both required artifacts and exits nonzero with a specific message if `zip` is unavailable.

- [ ] **Step 1: Write failing package-content tests**

Create `tests/pwa-package.test.js` using a temporary output root and the real project files:

```js
test('directory build copies exactly the shared PWA asset list', async (t) => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'fleet-pwa-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const packageDirectory = await buildPwaDirectory({ projectRoot, outputRoot });
  assert.deepEqual(await recursivelyList(packageDirectory),
    PWA_ASSETS.filter((path) => path !== './').map(normalizeEntry).sort());
});

test('package command creates a ZIP with one stable top-level directory', () => {
  const result = spawnSync(process.execPath, ['scripts/package-pwa.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const entries = spawnSync('unzip', ['-Z1', 'dist/planet-engineering-fleet-pwa.zip'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(entries.status, 0, entries.stderr);
  assert.equal(entries.stdout.split('\n').filter(Boolean).every((entry) => entry.startsWith('planet-engineering-fleet-pwa/')), true);
});
```

Also assert that `.git`, `.superpowers`, `tests`, `docs`, `scripts`, `node_modules`, and source maps never occur in directory or ZIP entries.

- [ ] **Step 2: Run the package tests and verify the expected red state**

Run: `node --test tests/pwa-package.test.js`

Expected: FAIL because `scripts/package-pwa.mjs`, exported build functions, and package script do not exist.

- [ ] **Step 3: Implement safe allowlist-only directory construction**

Resolve `outputRoot`, then resolve only `outputRoot/planet-engineering-fleet-pwa`. Refuse to remove a target that is equal to `outputRoot` or escapes it. Remove and recreate that exact package directory, then copy each non-`./` entry while preserving relative parents. Before copying, reject absolute paths, `..` segments, duplicate entries, missing files, and directories in `PWA_ASSETS`.

The CLI resolves the repository root from `import.meta.url`, uses `<repo>/dist`, and logs both resulting artifact paths.

- [ ] **Step 4: Implement ZIP generation and package scripts**

Invoke `zip` without a shell:

```js
const result = spawnSync('zip', ['-qr', zipPath, PACKAGE_DIRECTORY_NAME], {
  cwd: outputRoot,
  encoding: 'utf8',
});
if (result.error?.code === 'ENOENT') {
  throw new Error(`系统缺少 zip；静态目录已生成：${packageDirectory}`);
}
if (result.status !== 0) throw new Error(result.stderr || 'zip 打包失败');
```

Add `"package:pwa": "node scripts/package-pwa.mjs"` to `package.json` and `dist/` to `.gitignore`.

- [ ] **Step 5: Run focused, package, and full verification**

Run: `node --test tests/pwa-package.test.js`

Expected: all allowlist, path-safety, directory, ZIP, and exclusion tests pass.

Run: `npm run package:pwa`

Expected: both required artifacts exist and the command reports their absolute paths.

Run: `npm test`

Expected: the complete suite passes.

- [ ] **Step 6: Commit Task 3**

```bash
git add .gitignore package.json scripts/package-pwa.mjs tests/pwa-package.test.js
git commit -m "build: package deployable PWA bundle"
```

---

### Task 4: 安装文档与真实在线/离线验收

**Files:**
- Create: `tests/pwa-documentation.test.js`
- Modify: `README.md`
- Verify only: `dist/planet-engineering-fleet-pwa/`
- Verify only: `dist/planet-engineering-fleet-pwa.zip`

**Interfaces:**
- Consumes: the manifest, worker, package command, and artifacts from Tasks 1–3.
- Produces: adult-facing platform installation/deployment instructions and final browser evidence.

- [ ] **Step 1: Write the failing documentation test**

```js
test('README documents packaging, secure hosting, installation, and local-only progress', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const expected of [
    'npm run package:pwa',
    'planet-engineering-fleet-pwa.zip',
    'HTTPS',
    'Android 手机和平板',
    'Windows 和 macOS',
    'iPhone 和 iPad',
    '添加到主屏幕',
    '学习记录不会跨设备同步',
  ]) assert.match(readme, new RegExp(expected));
});
```

- [ ] **Step 2: Run the documentation test and verify the expected red state**

Run: `node --test tests/pwa-documentation.test.js`

Expected: FAIL because README does not yet document the packaging command or platform installation flow.

- [ ] **Step 3: Add concise adult installation and deployment instructions**

Update README’s browser/offline section with the package command, the two artifact paths, HTTPS/localhost requirement, static-host upload rule, platform-specific browser menu instructions, first-online-load requirement, uninstall implications, and the exact statement that learning records do not sync across devices.

- [ ] **Step 4: Run automated verification on the final tree**

Run: `node --test tests/pwa-documentation.test.js`

Expected: PASS.

Run: `npm run package:pwa`

Expected: directory and ZIP regenerate successfully.

Run: `npm test`

Expected: all legacy and PWA tests pass with zero failures.

Run: `node --check src/app.js`

Expected: exit 0.

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 5: Verify installability and offline reload in the browser**

Serve `dist/planet-engineering-fleet-pwa/` on an unused localhost port. At `1280x800` and `390x844`:

1. Load the app and verify `manifest.webmanifest` returns valid JSON and all declared icon requests succeed with nonzero natural dimensions.
2. Wait for `navigator.serviceWorker.ready`, reload once, and verify `navigator.serviceWorker.controller` is present.
3. Verify the active cache name equals the exported cache name and every `PWA_ASSETS` URL is present.
4. Stop only the package test server, reload while offline, and verify the map, lesson, course table, SVG scenes, vehicle art, and Local Storage progress remain usable.
5. Confirm no application console errors, page-level horizontal overflow, blank canvas/SVG/image, or visible control smaller than 56 CSS pixels.
6. Restart the normal source preview server and leave `http://localhost:4173/` available to the user.

- [ ] **Step 6: Inspect final artifacts and commit Task 4**

Run: `unzip -t dist/planet-engineering-fleet-pwa.zip`

Expected: `No errors detected in compressed data`.

Run: `git status --short`

Expected before commit: only README and the documentation test are tracked changes; `dist/` remains ignored.

```bash
git add README.md tests/pwa-documentation.test.js
git commit -m "docs: explain PWA installation and deployment"
```

- [ ] **Step 7: Final completion gate**

Run `npm test`, `npm run package:pwa`, `unzip -t dist/planet-engineering-fleet-pwa.zip`, `git diff --check`, and `git status --short --branch` again after the final commit. Report exact test counts, artifact sizes and paths, verified devices/viewports, current branch/commit, and whether anything was pushed.
