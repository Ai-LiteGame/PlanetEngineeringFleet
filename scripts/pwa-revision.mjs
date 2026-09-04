import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { PWA_ASSETS, PWA_CACHE_VERSION } from '../pwa-assets.js';

const VERSION_DECLARATION = /export const PWA_CACHE_VERSION = '[^']+';/g;
const NORMALIZED_VERSION_DECLARATION = "export const PWA_CACHE_VERSION = '__PWA_CACHE_VERSION__';";

function addDigestChunk(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(length);
  hash.update(bytes);
}

function normalizeAssetBytes(asset, bytes) {
  if (asset !== './pwa-assets.js') return bytes;
  const source = bytes.toString('utf8');
  if (source.match(VERSION_DECLARATION)?.length !== 1) {
    throw new Error('pwa-assets.js 必须包含唯一的缓存版本声明');
  }
  return Buffer.from(source.replace(VERSION_DECLARATION, NORMALIZED_VERSION_DECLARATION));
}

export async function calculatePwaCacheVersion(entries) {
  const entriesByPath = new Map(entries.map((entry) => [`./${entry.relativePath}`, entry]));
  const hash = createHash('sha256');
  addDigestChunk(hash, 'planet-engineering-fleet-runtime-v1');

  for (const asset of PWA_ASSETS) {
    addDigestChunk(hash, asset);
    if (asset === './') {
      addDigestChunk(hash, Buffer.alloc(0));
      continue;
    }

    const entry = entriesByPath.get(asset);
    if (!entry) throw new Error(`PWA 修订计算缺少资源：${asset}`);
    addDigestChunk(hash, normalizeAssetBytes(asset, await readFile(entry.sourcePath)));
  }

  return `v2-${hash.digest('hex')}`;
}

export async function assertPwaCacheVersion(entries) {
  const expectedVersion = await calculatePwaCacheVersion(entries);
  if (PWA_CACHE_VERSION !== expectedVersion) {
    throw new Error(`PWA 缓存版本与运行时资源不匹配：当前 ${PWA_CACHE_VERSION}，应为 ${expectedVersion}`);
  }
}
