import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { PWA_ASSETS } from '../pwa-assets.js';

export const PACKAGE_DIRECTORY_NAME = 'planet-engineering-fleet-pwa';

function rejectUnsafeEntry(entry, seenEntries) {
  if (typeof entry !== 'string' || entry.length === 0) throw new Error('PWA 资源路径无效');
  if (isAbsolute(entry) || /^[A-Za-z]:[\\/]/.test(entry)) throw new Error(`PWA 资源路径不能是绝对路径：${entry}`);

  const segments = entry.split(/[\\/]+/);
  if (segments.includes('..')) throw new Error(`PWA 资源路径不能包含 ..：${entry}`);

  const normalizedEntry = entry.replace(/^\.\//, '');
  const comparableEntry = segments.filter((segment) => segment && segment !== '.').join('/');
  if (seenEntries.has(comparableEntry)) throw new Error(`PWA 资源路径重复：${entry}`);
  seenEntries.add(comparableEntry);
  return normalizedEntry;
}

function ensureWithin(parent, target, label) {
  const pathFromParent = relative(parent, target);
  if (!pathFromParent || pathFromParent === '..' || pathFromParent.startsWith(`..${sep}`) || isAbsolute(pathFromParent)) {
    throw new Error(`${label} 必须位于输出目录内`);
  }
}

export async function collectPackageEntries(projectRoot, assets = PWA_ASSETS) {
  const resolvedProjectRoot = resolve(projectRoot);
  const seenEntries = new Set();
  const entries = [];

  for (const entry of assets) {
    const relativePath = rejectUnsafeEntry(entry, seenEntries);
    if (entry === './') continue;
    const sourcePath = resolve(resolvedProjectRoot, relativePath);
    ensureWithin(resolvedProjectRoot, sourcePath, 'PWA 资源');

    let sourceStats;
    try {
      sourceStats = await lstat(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`PWA 资源缺失：${entry}`);
      throw error;
    }
    if (sourceStats.isSymbolicLink()) throw new Error(`PWA 资源不能是符号链接：${entry}`);
    if (sourceStats.isDirectory()) throw new Error(`PWA 资源不能是目录：${entry}`);
    entries.push({ relativePath, sourcePath });
  }

  return entries;
}

export async function buildPwaDirectory({ projectRoot, outputRoot }) {
  const resolvedOutputRoot = resolve(outputRoot);
  const packageDirectory = resolve(resolvedOutputRoot, PACKAGE_DIRECTORY_NAME);
  ensureWithin(resolvedOutputRoot, packageDirectory, '发布目录');
  const entries = await collectPackageEntries(projectRoot);

  await mkdir(resolvedOutputRoot, { recursive: true });
  await rm(packageDirectory, { recursive: true, force: true });
  await mkdir(packageDirectory, { recursive: true });

  for (const { relativePath, sourcePath } of entries) {
    const destinationPath = resolve(packageDirectory, relativePath);
    ensureWithin(packageDirectory, destinationPath, 'PWA 资源');
    await mkdir(join(destinationPath, '..'), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }

  return packageDirectory;
}

export async function createPwaZip({ outputRoot, packageDirectory }) {
  const resolvedOutputRoot = resolve(outputRoot);
  const expectedPackageDirectory = resolve(resolvedOutputRoot, PACKAGE_DIRECTORY_NAME);
  if (resolve(packageDirectory) !== expectedPackageDirectory) {
    throw new Error('ZIP 打包目录必须是固定的发布目录');
  }

  const zipPath = resolve(resolvedOutputRoot, `${PACKAGE_DIRECTORY_NAME}.zip`);
  await rm(zipPath, { force: true });
  const result = spawnSync('zip', ['-qr', zipPath, PACKAGE_DIRECTORY_NAME], {
    cwd: resolvedOutputRoot,
    encoding: 'utf8',
  });
  if (result.error?.code === 'ENOENT') {
    throw new Error(`系统缺少 zip；静态目录已生成：${packageDirectory}`);
  }
  if (result.status !== 0) throw new Error(result.stderr || 'zip 打包失败');
  return zipPath;
}

async function main() {
  const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const outputRoot = resolve(projectRoot, 'dist');
  const packageDirectory = await buildPwaDirectory({ projectRoot, outputRoot });
  const zipPath = await createPwaZip({ outputRoot, packageDirectory });
  console.log(`静态目录：${packageDirectory}`);
  console.log(`ZIP 文件：${zipPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
