import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readBrowserAndOfflineSection() {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const heading = '## 浏览器与离线';
  const start = readme.indexOf(heading);
  assert.notEqual(start, -1, 'README must have a browser and offline section');
  const remainder = readme.slice(start + heading.length);
  const nextSection = remainder.search(/\n## /);
  return nextSection === -1 ? remainder : remainder.slice(0, nextSection);
}

test('README packages both deployable artifacts and preserves the complete relative file tree', async () => {
  const section = await readBrowserAndOfflineSection();
  assert.match(section, /\bnpm run package:pwa\b/);
  assert.match(section, /目录 `dist\/planet-engineering-fleet-pwa\/`/);
  assert.match(section, /压缩包 `dist\/planet-engineering-fleet-pwa\.zip`/);
  assert.match(section, /目录中的全部内容上传到同一个静态站点目录/);
  assert.match(section, /不要只上传 `index\.html`/);
  assert.match(section, /不要改动文件名、相对路径或目录结构/);
  assert.match(section, /根目录或子目录均可[^。]*保留包内的相对路径/);
});

test('README requires secure production hosting and limits localhost to local acceptance', async () => {
  const section = await readBrowserAndOfflineSection();
  assert.match(section, /正式站点必须通过 HTTPS 提供/);
  assert.match(section, /`http:\/\/localhost` 仅用于本机开发和验收/);
  assert.match(section, /解压后的文件不能通过 `file:\/\/` 直接打开[^。]*必须通过 HTTPS 或 `http:\/\/localhost` 提供服务/);
});

test('README distinguishes browser PWA installation from native packages for every platform', async () => {
  const section = await readBrowserAndOfflineSection();
  assert.match(section, /浏览器提供的 PWA 安装[^。]*不是 Android APK、macOS DMG 或 Windows EXE 原生安装包/);
  assert.match(section, /Android 手机和平板[^\n]*Chrome[^\n]*(安装应用|添加到主屏幕)/);
  assert.match(section, /Windows 和 macOS[^\n]*(Chrome 或 Edge)[^\n]*安装图标/);
  assert.match(section, /macOS Sonoma 14 或更新版本[^\n]*Safari 17 或更新版本[^\n]*“文件”[^\n]*“添加到程序坞”/);
  assert.match(section, /iPhone 和 iPad[^\n]*Safari[^\n]*分享[^\n]*添加到主屏幕/);
});

test('README explains first-online caching and the device-local uninstall lifecycle', async () => {
  const section = await readBrowserAndOfflineSection();
  assert.match(section, /首次在线加载并缓存资源后[^。]*网络断开[^。]*继续运行/);
  assert.match(section, /首次打开或发布新版本后[^。]*连接[^。]*服务器一次/);
  assert.match(section, /学习进度只保存在当前设备、当前浏览器和当前站点地址的 Local Storage 中/);
  assert.match(section, /学习记录不会跨设备同步/);
  assert.match(section, /卸载 PWA 不一定会删除浏览器站点数据/);
  assert.match(section, /清除该站点数据会永久删除本机学习记录[^。]*重新安装不会恢复/);
  assert.match(section, /操作前可在成人入口下载 JSON 备份/);
});
