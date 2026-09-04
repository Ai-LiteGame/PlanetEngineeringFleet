import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

import { PWA_ASSETS, PWA_CACHE_VERSION } from '../pwa-assets.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const versionDeclaration = /export const PWA_CACHE_VERSION = '[^']+';/g;
const normalizedVersionDeclaration = "export const PWA_CACHE_VERSION = '__PWA_CACHE_VERSION__';";

function addDigestChunk(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length);
  hash.update(bytes);
}

async function expectedRuntimeVersion(root) {
  const hash = createHash('sha256');
  addDigestChunk(hash, 'planet-engineering-fleet-runtime-v1');

  for (const asset of PWA_ASSETS) {
    addDigestChunk(hash, asset);
    if (asset === './') {
      addDigestChunk(hash, Buffer.alloc(0));
      continue;
    }

    let bytes = await readFile(join(root, asset.replace(/^\.\//, '')));
    if (asset === './pwa-assets.js') {
      const source = bytes.toString('utf8');
      assert.equal(source.match(versionDeclaration)?.length, 1, 'one cache version declaration');
      bytes = Buffer.from(source.replace(versionDeclaration, normalizedVersionDeclaration));
    }
    addDigestChunk(hash, bytes);
  }

  return `v2-${hash.digest('hex')}`;
}

test('cache version equals an independent digest of the ordered runtime inventory and bytes', async () => {
  assert.equal(PWA_CACHE_VERSION, await expectedRuntimeVersion(projectRoot));
});

test('packaging rejects a realistic runtime mutation until the cache version is updated', async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), 'fleet-pwa-revision-'));
  const temporaryProject = join(workspace, 'project');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(projectRoot, temporaryProject, {
    recursive: true,
    filter: (source) => !['.git', '.superpowers', 'dist', 'node_modules'].includes(relative(projectRoot, source)),
  });
  await appendFile(join(temporaryProject, 'styles.css'), '\n/* temporary runtime mutation */\n');

  const result = spawnSync(process.execPath, ['scripts/package-pwa.mjs'], {
    cwd: temporaryProject,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PWA 缓存版本与运行时资源不匹配/);
});
