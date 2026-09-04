import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { PWA_ASSETS } from '../pwa-assets.js';
import {
  PACKAGE_DIRECTORY_NAME,
  buildPwaDirectory,
  collectPackageEntries,
} from '../scripts/package-pwa.mjs';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const excludedSegments = ['.git', '.superpowers', 'tests', 'docs', 'scripts', 'node_modules'];

function normalizeEntry(path) {
  return path.replace(/^\.\//, '');
}

function isExcluded(path) {
  return path.endsWith('.map') || path.split('/').some((segment) => excludedSegments.includes(segment));
}

async function recursivelyList(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await recursivelyList(join(directory, entry.name), `${path}/`));
    if (entry.isFile()) files.push(path);
  }

  return files;
}

async function writeAllowedFiles(root, entries = PWA_ASSETS) {
  for (const entry of entries.filter((path) => path !== './')) {
    const path = join(root, normalizeEntry(entry));
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, entry);
  }
}

test('directory build copies exactly the shared PWA asset list', async (t) => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'fleet-pwa-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const packageDirectory = await buildPwaDirectory({ projectRoot, outputRoot });
  const entries = (await recursivelyList(packageDirectory)).sort();

  assert.deepEqual(entries, PWA_ASSETS.filter((path) => path !== './').map(normalizeEntry).sort());
  assert.equal(entries.some(isExcluded), false);
  assert.equal(relative(resolve(outputRoot), packageDirectory).startsWith('..'), false);
});

test('collectPackageEntries rejects unsafe, duplicate, missing, and directory asset entries', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'fleet-pwa-project-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeAllowedFiles(fixtureRoot);

  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['/index.html']), /绝对路径/);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./src/../app.js']), /\.\./);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./index.html', './index.html']), /重复/);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./missing.js']), /缺失/);

  await rm(join(fixtureRoot, 'src/app.js'));
  await mkdir(join(fixtureRoot, 'src/app.js'));
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./src/app.js']), /目录/);
});

test('package command creates a ZIP with one stable top-level directory', () => {
  const result = spawnSync(process.execPath, ['scripts/package-pwa.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const entries = spawnSync('unzip', ['-Z1', 'dist/planet-engineering-fleet-pwa.zip'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(entries.status, 0, entries.stderr);
  const listedEntries = entries.stdout.split('\n').filter(Boolean);
  assert.equal(listedEntries.every((entry) => entry.startsWith(`${PACKAGE_DIRECTORY_NAME}/`)), true);
  assert.equal(listedEntries.some((entry) => isExcluded(entry)), false);
});

test('package command reports when zip is unavailable after building the static directory', async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), 'fleet-pwa-cli-'));
  const temporaryProject = join(workspace, 'project');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(projectRoot, temporaryProject, {
    recursive: true,
    filter: (source) => !['.git', 'dist', 'node_modules'].includes(relative(projectRoot, source)),
  });

  const result = spawnSync(process.execPath, ['scripts/package-pwa.mjs'], {
    cwd: temporaryProject,
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /系统缺少 zip；静态目录已生成：/);
});
