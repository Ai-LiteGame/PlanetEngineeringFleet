import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
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

async function makeTempDirectory(prefix) {
  return realpath(await mkdtemp(join(tmpdir(), prefix)));
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
  const outputRoot = await makeTempDirectory('fleet-pwa-');
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const packageDirectory = await buildPwaDirectory({ projectRoot, outputRoot });
  const entries = (await recursivelyList(packageDirectory)).sort();

  assert.deepEqual(entries, PWA_ASSETS.filter((path) => path !== './').map(normalizeEntry).sort());
  assert.equal(entries.some(isExcluded), false);
  assert.equal(relative(resolve(outputRoot), packageDirectory).startsWith('..'), false);
});

test('collectPackageEntries rejects unsafe, duplicate, missing, and directory asset entries', async (t) => {
  const fixtureRoot = await makeTempDirectory('fleet-pwa-project-');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeAllowedFiles(fixtureRoot);

  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['/index.html']), /绝对路径/);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./src/../app.js']), /\.\./);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./index.html', './index.html']), /重复/);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./missing.js']), /缺失/);

  await rm(join(fixtureRoot, 'src/app.js'));
  await mkdir(join(fixtureRoot, 'src/app.js'));
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./src/app.js']), /目录/);

  await rm(join(fixtureRoot, 'src/app.js'), { recursive: true });
  const fifoResult = spawnSync('mkfifo', [join(fixtureRoot, 'src/app.js')], { encoding: 'utf8' });
  assert.equal(fifoResult.status, 0, fifoResult.stderr);
  await assert.rejects(() => collectPackageEntries(fixtureRoot, ['./src/app.js']), /普通文件/);
});

test('collectPackageEntries rejects a file symlink that targets outside the project', async (t) => {
  const fixtureRoot = await makeTempDirectory('fleet-pwa-project-');
  const externalRoot = await makeTempDirectory('fleet-pwa-external-');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await writeAllowedFiles(fixtureRoot);

  const externalFile = join(externalRoot, 'external.js');
  const linkedAsset = join(fixtureRoot, 'src/app.js');
  await writeFile(externalFile, 'external asset');
  await rm(linkedAsset);
  await symlink(externalFile, linkedAsset);

  await assert.rejects(() => collectPackageEntries(fixtureRoot), /符号链接/);
});

test('directory build rejects a symlinked source parent without copying external bytes', async (t) => {
  const fixtureRoot = await makeTempDirectory('fleet-pwa-project-');
  const externalRoot = await makeTempDirectory('fleet-pwa-external-');
  const outputRoot = await makeTempDirectory('fleet-pwa-output-');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  await writeAllowedFiles(fixtureRoot);

  const externalSourceDirectory = join(externalRoot, 'src');
  await rename(join(fixtureRoot, 'src'), externalSourceDirectory);
  const sentinel = 'external source sentinel';
  await writeFile(join(externalSourceDirectory, 'app.js'), sentinel);
  await symlink(externalSourceDirectory, join(fixtureRoot, 'src'));

  const buildError = await buildPwaDirectory({ projectRoot: fixtureRoot, outputRoot })
    .then(() => null, (error) => error);
  const copiedSentinel = await readFile(
    join(outputRoot, PACKAGE_DIRECTORY_NAME, 'src/app.js'),
    'utf8',
  ).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));

  assert.equal(copiedSentinel, null, 'external source bytes must not enter the package');
  assert.match(buildError?.message ?? '', /符号链接/);
  assert.equal(await readFile(join(externalSourceDirectory, 'app.js'), 'utf8'), sentinel);
});

test('directory build rejects a symlinked output root without deleting its external target', async (t) => {
  const fixtureRoot = await makeTempDirectory('fleet-pwa-project-');
  const workspace = await makeTempDirectory('fleet-pwa-workspace-');
  const externalRoot = await makeTempDirectory('fleet-pwa-external-output-');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await writeAllowedFiles(fixtureRoot);

  const externalPackageDirectory = join(externalRoot, PACKAGE_DIRECTORY_NAME);
  const sentinelPath = join(externalPackageDirectory, 'do-not-delete.txt');
  const sentinel = 'external output sentinel';
  await mkdir(externalPackageDirectory);
  await writeFile(sentinelPath, sentinel);
  const linkedOutputRoot = join(workspace, 'dist');
  await symlink(externalRoot, linkedOutputRoot);

  const buildError = await buildPwaDirectory({ projectRoot: fixtureRoot, outputRoot: linkedOutputRoot })
    .then(() => null, (error) => error);
  const preservedSentinel = await readFile(sentinelPath, 'utf8')
    .catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));

  assert.equal(preservedSentinel, sentinel, 'external output target must remain untouched');
  assert.match(buildError?.message ?? '', /符号链接/);
});

test('directory build rejects a symlinked output parent without deleting its external target', async (t) => {
  const workspace = await makeTempDirectory('fleet-pwa-workspace-');
  const externalRoot = await makeTempDirectory('fleet-pwa-external-output-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));

  const externalOutputRoot = join(externalRoot, 'dist');
  const externalPackageDirectory = join(externalOutputRoot, PACKAGE_DIRECTORY_NAME);
  const sentinelPath = join(externalPackageDirectory, 'do-not-delete.txt');
  const sentinel = 'external output parent sentinel';
  await mkdir(externalPackageDirectory, { recursive: true });
  await writeFile(sentinelPath, sentinel);
  const linkedParent = join(workspace, 'redirect');
  await symlink(externalRoot, linkedParent);

  const buildError = await buildPwaDirectory({
    projectRoot,
    outputRoot: join(linkedParent, 'dist'),
  }).then(() => null, (error) => error);
  const preservedSentinel = await readFile(sentinelPath, 'utf8')
    .catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));

  assert.equal(preservedSentinel, sentinel, 'external output target must remain untouched');
  assert.match(buildError?.message ?? '', /符号链接/);
});

test('package command creates a byte-equivalent ZIP from exactly the shared asset list', async () => {
  const result = spawnSync(process.execPath, ['scripts/package-pwa.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const entries = spawnSync('unzip', ['-Z1', 'dist/planet-engineering-fleet-pwa.zip'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(entries.status, 0, entries.stderr);
  const listedEntries = entries.stdout.split('\n').filter(Boolean);
  assert.equal(listedEntries.every((entry) => entry.startsWith(`${PACKAGE_DIRECTORY_NAME}/`)), true);
  assert.equal(listedEntries.some((entry) => isExcluded(entry)), false);

  const prefix = `${PACKAGE_DIRECTORY_NAME}/`;
  const archivedFiles = listedEntries
    .filter((entry) => !entry.endsWith('/'))
    .map((entry) => entry.slice(prefix.length))
    .sort();
  const expectedFiles = PWA_ASSETS
    .filter((path) => path !== './')
    .map(normalizeEntry)
    .sort();
  assert.deepEqual(archivedFiles, expectedFiles);

  for (const relativePath of expectedFiles) {
    const archived = spawnSync(
      'unzip',
      ['-p', 'dist/planet-engineering-fleet-pwa.zip', `${prefix}${relativePath}`],
      { cwd: projectRoot },
    );
    assert.equal(archived.status, 0, archived.stderr.toString());
    assert.deepEqual(
      archived.stdout,
      await readFile(join(projectRoot, 'dist', PACKAGE_DIRECTORY_NAME, relativePath)),
      relativePath,
    );
  }
});

test('package command reports when zip is unavailable after building the static directory', async (t) => {
  const workspace = await makeTempDirectory('fleet-pwa-cli-');
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
