import { PROJECTS, REGIONS } from './curriculum/index.js';

const ACTION_STATE = Object.freeze({
  dig: Object.freeze({ vehicleSymbolId: 'excavator', actionClass: 'is-digging' }),
  push: Object.freeze({ vehicleSymbolId: 'bulldozer', actionClass: 'is-pushing' }),
  lift: Object.freeze({ vehicleSymbolId: 'crane', actionClass: 'is-lifting' }),
  mix: Object.freeze({ vehicleSymbolId: 'mixer', actionClass: 'is-mixing' }),
  dump: Object.freeze({ vehicleSymbolId: 'dump-truck', actionClass: 'is-dumping' }),
  roll: Object.freeze({ vehicleSymbolId: 'roller', actionClass: 'is-rolling' }),
  load: Object.freeze({ vehicleSymbolId: 'forklift', actionClass: 'is-loading' }),
  spray: Object.freeze({ vehicleSymbolId: 'fire-engine', actionClass: 'is-spraying' }),
  plow: Object.freeze({ vehicleSymbolId: 'snowplow', actionClass: 'is-plowing' }),
  drill: Object.freeze({ vehicleSymbolId: 'tunnel-borer', actionClass: 'is-drilling' }),
});

const ACTION_BY_VEHICLE = Object.freeze({
  excavator: 'dig',
  bulldozer: 'push',
  crane: 'lift',
  mixer: 'mix',
  'dump-truck': 'dump',
  roller: 'roll',
  forklift: 'load',
  'fire-engine': 'spray',
  'fire-truck': 'spray',
  snowplow: 'plow',
  'tunnel-borer': 'drill',
  'tunnel-drill': 'drill',
});

const regionById = new Map(REGIONS.map((region) => [region.id, region]));
const projectsByRegion = new Map(REGIONS.map((region) => [
  region.id,
  PROJECTS.filter((project) => project.regionId === region.id),
]));

const projectForOrdinal = (regionId, projectOrdinal) => {
  const project = PROJECTS[projectOrdinal - 1] ?? null;
  return project?.regionId === regionId ? project : null;
};

const visibleUpgrades = (regionId, completedProjectIds) => {
  const regionalProjectIds = new Set(
    projectsByRegion.get(regionId).map((project) => project.id),
  );
  const completedCount = new Set(
    completedProjectIds.filter((projectId) => regionalProjectIds.has(projectId)),
  ).size;
  const upgradeCount = Math.min(5, Math.ceil(completedCount / 3));

  return Object.freeze(Array.from(
    { length: upgradeCount },
    (_, index) => `${regionId}-upgrade-${index + 1}`,
  ));
};

export function getSceneState(regionId, projectOrdinal, interaction = {}, completedProjectIds = []) {
  if (!regionById.has(regionId)) {
    throw new RangeError(`Unknown region: ${regionId}`);
  }
  if (!Number.isInteger(projectOrdinal) || projectOrdinal < 1 || projectOrdinal > PROJECTS.length) {
    throw new RangeError(`Invalid project ordinal: ${projectOrdinal}`);
  }
  if (!Array.isArray(completedProjectIds)) {
    throw new TypeError('completedProjectIds must be an array');
  }

  const project = projectForOrdinal(regionId, projectOrdinal);
  if (!project) {
    throw new RangeError(`Project ordinal ${projectOrdinal} does not belong to region ${regionId}`);
  }
  const action = interaction?.action ?? ACTION_BY_VEHICLE[project?.vehicle];
  const actionState = ACTION_STATE[action];
  if (!actionState) {
    throw new RangeError(`Unknown action: ${action}`);
  }

  const completedSnapshot = Object.freeze([...completedProjectIds]);
  return Object.freeze({
    regionSymbolId: regionId,
    vehicleSymbolId: actionState.vehicleSymbolId,
    actionClass: actionState.actionClass,
    projectOrdinal,
    completedProjectIds: completedSnapshot,
    visibleUpgradeIds: visibleUpgrades(regionId, completedSnapshot),
  });
}
