import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PROJECTS, REGIONS } from '../src/curriculum/index.js';
import { getSceneState } from '../src/scene-model.js';

const VEHICLE_IDS = Object.freeze([
  'excavator',
  'bulldozer',
  'crane',
  'mixer',
  'dump-truck',
  'roller',
  'forklift',
  'fire-engine',
  'snowplow',
  'tunnel-borer',
]);

const ACTIONS = Object.freeze([
  'dig',
  'push',
  'lift',
  'mix',
  'dump',
  'roll',
  'load',
  'spray',
  'plow',
  'drill',
]);

const ACTION_CLASSES = Object.freeze([
  'is-digging',
  'is-pushing',
  'is-lifting',
  'is-mixing',
  'is-dumping',
  'is-rolling',
  'is-loading',
  'is-spraying',
  'is-plowing',
  'is-drilling',
]);

const symbolIdsFrom = (svg) => (
  [...svg.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1])
);

const idsFrom = (svg) => new Set(symbolIdsFrom(svg));

const symbolMarkup = (svg, id) => {
  const match = svg.match(new RegExp(`<symbol\\b[^>]*\\bid="${id}"[\\s\\S]*?<\\/symbol>`));
  assert.ok(match, `missing symbol markup for ${id}`);
  return match[0];
};

test('scene model maps every region and action to a renderable symbol', () => {
  for (const region of REGIONS) {
    const regionProjects = PROJECTS.filter((project) => project.regionId === region.id);
    ACTIONS.forEach((action, index) => {
      const scene = getSceneState(region.id, regionProjects[index].ordinal, { action }, []);
      assert.equal(scene.regionSymbolId, region.id);
      assert.equal(scene.vehicleSymbolId, VEHICLE_IDS[index]);
      assert.equal(scene.actionClass, ACTION_CLASSES[index]);
      assert.equal(scene.projectOrdinal, regionProjects[index].ordinal);
    });
  }
});

test('completed projects become immutable visible scene upgrades', () => {
  const completedProjectIds = ['project-001', 'project-002'];
  const scene = getSceneState('sunny-town', 3, { action: 'roll' }, completedProjectIds);

  completedProjectIds.push('project-003');
  assert.deepEqual(scene.completedProjectIds, ['project-001', 'project-002']);
  assert.deepEqual(scene.visibleUpgradeIds, ['sunny-town-upgrade-1']);
  assert.equal(Object.isFrozen(scene), true);
  assert.equal(Object.isFrozen(scene.completedProjectIds), true);
});

test('curriculum vehicle aliases resolve to canonical vehicle symbols', () => {
  const fireProject = PROJECTS.find((project) => project.vehicle === 'fire-truck');
  const drillProject = PROJECTS.find((project) => project.vehicle === 'tunnel-drill');

  assert.equal(
    getSceneState(fireProject.regionId, fireProject.ordinal, {}, []).vehicleSymbolId,
    'fire-engine',
  );
  assert.equal(
    getSceneState(drillProject.regionId, drillProject.ordinal, {}, []).vehicleSymbolId,
    'tunnel-borer',
  );
});

test('scene model rejects unknown regions, actions and project ordinals', () => {
  assert.throws(() => getSceneState('moon-base', 1, { action: 'dig' }, []), /Unknown region/);
  assert.throws(() => getSceneState('sunny-town', 0, { action: 'dig' }, []), /project ordinal/);
  assert.throws(
    () => getSceneState('forest-valley', 1, { action: 'dig' }, []),
    /does not belong to region/,
  );
  assert.throws(() => getSceneState('sunny-town', 1, { action: 'fly' }, []), /Unknown action/);
});

test('SVG symbol IDs are unique within and across local asset files', async () => {
  const [fleet, scenes] = await Promise.all([
    readFile(new URL('../assets/construction-fleet.svg', import.meta.url), 'utf8'),
    readFile(new URL('../assets/region-scenes.svg', import.meta.url), 'utf8'),
  ]);
  const fleetIds = symbolIdsFrom(fleet);
  const sceneIds = symbolIdsFrom(scenes);
  const allIds = [...fleetIds, ...sceneIds];

  assert.equal(new Set(fleetIds).size, fleetIds.length, 'duplicate fleet symbol ID');
  assert.equal(new Set(sceneIds).size, sceneIds.length, 'duplicate region-scene symbol ID');
  assert.equal(new Set(allIds).size, allIds.length, 'symbol IDs must be unique across assets');
});

test('fleet SVG contains stable layered symbols for every vehicle', async () => {
  const fleet = await readFile(new URL('../assets/construction-fleet.svg', import.meta.url), 'utf8');
  const fleetIds = idsFrom(fleet);

  assert.deepEqual(fleetIds, new Set(VEHICLE_IDS));
  for (const vehicleId of VEHICLE_IDS) {
    assert.equal(fleetIds.has(vehicleId), true, `missing vehicle ${vehicleId}`);
    const markup = symbolMarkup(fleet, vehicleId);
    assert.match(markup, /viewBox="0 0 320 180"/);
    for (const className of ['body', 'wheels', 'cab', 'tool', 'lights']) {
      assert.match(markup, new RegExp(`class="[^"]*\\b${className}\\b`));
    }
  }
  assert.doesNotMatch(fleet, /<(?:image|font|filter)\b|\b(?:href|src)="https?:/);
});

test('regional SVG contains layered scenes and progressive outcomes', async () => {
  const scenes = await readFile(new URL('../assets/region-scenes.svg', import.meta.url), 'utf8');
  const sceneIds = idsFrom(scenes);
  const expectedSceneIds = REGIONS.flatMap((region) => [
    region.id,
    ...Array.from({ length: 5 }, (_, index) => `${region.id}-upgrade-${index + 1}`),
  ]);

  assert.deepEqual(sceneIds, new Set(expectedSceneIds));
  for (const region of REGIONS) {
    assert.equal(sceneIds.has(region.id), true, `missing region ${region.id}`);
    const markup = symbolMarkup(scenes, region.id);
    assert.match(markup, /viewBox="0 0 320 180"/);
    for (const className of ['background', 'ground', 'road']) {
      assert.match(markup, new RegExp(`class="[^"]*\\b${className}\\b`));
    }
    for (let upgrade = 1; upgrade <= 5; upgrade += 1) {
      const upgradeId = `${region.id}-upgrade-${upgrade}`;
      assert.equal(sceneIds.has(upgradeId), true, `missing upgrade ${upgradeId}`);
      assert.match(symbolMarkup(scenes, upgradeId), /class="[^"]*\bupgrade\b/);
    }
  }
  assert.equal(
    [...scenes.matchAll(/<symbol\b([^>]*)>/g)].every((match) => (
      match[1].includes('viewBox="0 0 320 180"')
    )),
    true,
  );
  assert.doesNotMatch(scenes, /<(?:image|font|filter)\b|\b(?:href|src)="https?:/);
});

test('every scene model symbol and upgrade ID exists in the SVG assets', async () => {
  const [fleet, scenes] = await Promise.all([
    readFile(new URL('../assets/construction-fleet.svg', import.meta.url), 'utf8'),
    readFile(new URL('../assets/region-scenes.svg', import.meta.url), 'utf8'),
  ]);
  const fleetIds = idsFrom(fleet);
  const sceneIds = idsFrom(scenes);

  for (const region of REGIONS) {
    const regionProjects = PROJECTS.filter((project) => project.regionId === region.id);
    for (const [index, action] of ACTIONS.entries()) {
      const completedProjectIds = PROJECTS
        .filter((project) => project.regionId === region.id)
        .slice(0, index + 1)
        .map((project) => project.id);
      const scene = getSceneState(
        region.id,
        regionProjects[index].ordinal,
        { action },
        completedProjectIds,
      );

      assert.equal(sceneIds.has(scene.regionSymbolId), true);
      assert.equal(fleetIds.has(scene.vehicleSymbolId), true);
      for (const upgradeId of scene.visibleUpgradeIds) {
        assert.equal(scenes.includes(`id="${upgradeId}"`), true, `missing upgrade ${upgradeId}`);
      }
    }
  }
});
