import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
