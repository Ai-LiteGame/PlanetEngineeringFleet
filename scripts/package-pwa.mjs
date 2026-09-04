import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { PWA_ASSETS } from '../pwa-assets.js';
import { assertPwaCacheVersion } from './pwa-revision.mjs';

export const PACKAGE_DIRECTORY_NAME = 'planet-engineering-fleet-pwa';

function rejectUnsafeEntry(entry, seenEntries) {
  if (typeof entry !== 'string' || entry.length === 0) throw new Error('PWA 资源路径无效');
  if (isAbsolute(entry) || /^[A-Za-z]:[\\/]/.test(entry)) throw new Error(`PWA 资源路径不能是绝对路径：${entry}`);

  const segments = entry.split(/[\\/]+/);
  if (segments.includes('..')) throw new Error(`PWA 资源路径不能包含 ..：${entry}`);

  const comparableEntry = segments.filter((segment) => segment && segment !== '.').join('/');
  if (seenEntries.has(comparableEntry)) throw new Error(`PWA 资源路径重复：${entry}`);
  seenEntries.add(comparableEntry);
  return comparableEntry;
}

async function inspectDirectory(path, label) {
  const resolvedPath = resolve(path);
  let stats;
  try {
    stats = await lstat(resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${label}不存在：${resolvedPath}`);
    throw error;
  }
  if (stats.isSymbolicLink()) throw new Error(`${label}不能是符号链接：${resolvedPath}`);
  if (!stats.isDirectory()) throw new Error(`${label}必须是目录：${resolvedPath}`);
  return { canonicalPath: await realpath(resolvedPath), resolvedPath };
}

async function rejectSymlinkedDirectoryComponents(path, label, { allowMissingTail = false } = {}) {
  const resolvedPath = resolve(path);
  const root = parse(resolvedPath).root;
  const segments = relative(root, resolvedPath).split(sep).filter(Boolean);
  let currentPath = root;

  for (const segment of segments) {
    currentPath = join(currentPath, segment);
    let stats;
    try {
      stats = await lstat(currentPath);
    } catch (error) {
      if (allowMissingTail && error.code === 'ENOENT') return;
      if (error.code === 'ENOENT') throw new Error(`${label}不存在：${currentPath}`);
      throw error;
    }
    if (stats.isSymbolicLink()) throw new Error(`${label}路径不能包含符号链接：${currentPath}`);
    if (!stats.isDirectory()) throw new Error(`${label}路径必须由目录组成：${currentPath}`);
  }
}

async function inspectOutputDirectory(path, label) {
  await rejectSymlinkedDirectoryComponents(path, label);
  return inspectDirectory(path, label);
}

async function resolveSourceFile(canonicalProjectRoot, relativePath, entry) {
  const segments = relativePath.split('/');
  let sourcePath = canonicalProjectRoot;

  for (const [index, segment] of segments.entries()) {
    sourcePath = join(sourcePath, segment);
    let stats;
    try {
      stats = await lstat(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`PWA 资源缺失：${entry}`);
      throw error;
    }
    if (stats.isSymbolicLink()) throw new Error(`PWA 资源路径不能包含符号链接：${entry}`);
    if (index < segments.length - 1 && !stats.isDirectory()) {
      throw new Error(`PWA 资源父路径必须是目录：${entry}`);
    }
    if (index === segments.length - 1) {
      if (stats.isDirectory()) throw new Error(`PWA 资源不能是目录：${entry}`);
      if (!stats.isFile()) throw new Error(`PWA 资源必须是普通文件：${entry}`);
    }
  }

  const canonicalSourcePath = await realpath(sourcePath);
  ensureWithin(canonicalProjectRoot, canonicalSourcePath, 'PWA 资源');
  return canonicalSourcePath;
}

async function revalidateDeletionTarget(outputRootState) {
  const currentOutputRoot = await inspectOutputDirectory(outputRootState.resolvedPath, '输出目录');
  if (currentOutputRoot.canonicalPath !== outputRootState.canonicalPath) {
    throw new Error('输出目录在打包过程中发生变化');
  }

  const deletionTarget = join(currentOutputRoot.canonicalPath, PACKAGE_DIRECTORY_NAME);
  ensureWithin(currentOutputRoot.canonicalPath, deletionTarget, '发布目录');
  try {
    const stats = await lstat(deletionTarget);
    if (stats.isSymbolicLink()) throw new Error(`发布目录不能是符号链接：${deletionTarget}`);
    if (await realpath(deletionTarget) !== deletionTarget) {
      throw new Error(`发布目录规范路径无效：${deletionTarget}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return deletionTarget;
}

function ensureWithin(parent, target, label) {
  const pathFromParent = relative(parent, target);
  if (!pathFromParent || pathFromParent === '..' || pathFromParent.startsWith(`..${sep}`) || isAbsolute(pathFromParent)) {
    throw new Error(`${label} 必须位于输出目录内`);
  }
}

export async function collectPackageEntries(projectRoot, assets = PWA_ASSETS) {
  const resolvedProjectRoot = resolve(projectRoot);
  const projectRootStats = await inspectDirectory(resolvedProjectRoot, '项目目录');
  const seenEntries = new Set();
  const entries = [];

  for (const entry of assets) {
    const relativePath = rejectUnsafeEntry(entry, seenEntries);
    if (entry === './') continue;
    const sourcePath = await resolveSourceFile(projectRootStats.canonicalPath, relativePath, entry);
    entries.push({ relativePath, sourcePath });
  }

  return entries;
}

export async function buildPwaDirectory({ projectRoot, outputRoot }) {
  const resolvedOutputRoot = resolve(outputRoot);
  const packageDirectory = resolve(resolvedOutputRoot, PACKAGE_DIRECTORY_NAME);
  ensureWithin(resolvedOutputRoot, packageDirectory, '发布目录');

  await rejectSymlinkedDirectoryComponents(resolvedOutputRoot, '输出目录', { allowMissingTail: true });
  await mkdir(resolvedOutputRoot, { recursive: true });
  const outputRootState = await inspectOutputDirectory(resolvedOutputRoot, '输出目录');
  const entries = await collectPackageEntries(projectRoot);
  await assertPwaCacheVersion(entries);
  const canonicalPackageDirectory = await revalidateDeletionTarget(outputRootState);
  await rm(canonicalPackageDirectory, { recursive: true, force: true });
  await mkdir(canonicalPackageDirectory);

  for (const { relativePath, sourcePath } of entries) {
    const destinationPath = resolve(canonicalPackageDirectory, relativePath);
    ensureWithin(canonicalPackageDirectory, destinationPath, 'PWA 资源');
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

  const outputRootState = await inspectOutputDirectory(resolvedOutputRoot, '输出目录');
  const canonicalPackageDirectory = await revalidateDeletionTarget(outputRootState);
  const packageStats = await lstat(canonicalPackageDirectory);
  if (!packageStats.isDirectory()) throw new Error('ZIP 打包目标必须是目录');

  const zipPath = resolve(outputRootState.canonicalPath, `${PACKAGE_DIRECTORY_NAME}.zip`);
  await rm(zipPath, { force: true });
  const result = spawnSync('zip', ['-qr', zipPath, PACKAGE_DIRECTORY_NAME], {
    cwd: outputRootState.canonicalPath,
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
