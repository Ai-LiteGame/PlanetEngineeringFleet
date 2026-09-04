import { LESSONS, PROJECTS, REGIONS } from './curriculum/index.js';

export const VEHICLE_UPGRADE_MILESTONES = Object.freeze([
  Object.freeze({ id: 'vehicle:work-light', threshold: 3, label: '工作灯' }),
  Object.freeze({ id: 'vehicle:body-stickers', threshold: 9, label: '车身贴纸' }),
  Object.freeze({ id: 'vehicle:safety-flag', threshold: 18, label: '安全旗' }),
  Object.freeze({ id: 'vehicle:reinforced-tires', threshold: 30, label: '强化轮胎' }),
  Object.freeze({ id: 'vehicle:new-paint', threshold: 45, label: '新涂装' }),
  Object.freeze({ id: 'vehicle:toolbox', threshold: 60, label: '工具箱' }),
  Object.freeze({ id: 'vehicle:region-medallion', threshold: 75, label: '区域纪念章' }),
  Object.freeze({ id: 'vehicle:chief-engineer-beacon', threshold: 90, label: '总工程师冠灯' }),
]);

export const STAGE_HONOR_MILESTONES = Object.freeze([
  Object.freeze({ id: 'stage:kindergarten-engineer', threshold: 30, label: '大班小工程师' }),
  Object.freeze({ id: 'stage:school-transition-engineer', threshold: 60, label: '幼小衔接工程师' }),
  Object.freeze({ id: 'stage:planet-chief-engineer', threshold: 90, label: '星球总工程师' }),
]);

const projectById = new Map(PROJECTS.map((project) => [project.id, project]));
const projectIdsByRegion = new Map(REGIONS.map((region) => [
  region.id,
  PROJECTS.filter((project) => project.regionId === region.id).map((project) => project.id),
]));
const skillIdsByRegion = new Map(REGIONS.map((region) => {
  const projectIds = new Set(projectIdsByRegion.get(region.id));
  const skillIds = new Set(LESSONS
    .filter((lesson) => projectIds.has(lesson.projectId))
    .flatMap((lesson) => [
      ...lesson.newChineseIds,
      ...lesson.newEnglishWordIds,
      ...lesson.newEnglishPatternIds,
      lesson.mathSkillId,
    ])
    .filter(Boolean));
  return [region.id, [...skillIds]];
}));

function uniqueStrings(values) {
  return [...new Set(Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [])];
}

function completedProjectIds(progress) {
  const honorIds = new Set(uniqueStrings(progress?.honors));
  return PROJECTS
    .filter((project) => honorIds.has(`badge:${project.id}`))
    .map((project) => project.id);
}

export function vehicleUnlocks(progress) {
  const completedCount = completedProjectIds(progress).length;
  return VEHICLE_UPGRADE_MILESTONES
    .filter((upgrade) => completedCount >= upgrade.threshold)
    .map((upgrade) => upgrade.id);
}

export function medalForMasteryRatio(masteryRatio) {
  if (masteryRatio >= 0.85) return 'gold';
  if (masteryRatio >= 0.6) return 'silver';
  return 'bronze';
}

export function regionMedal(progress, regionId) {
  const regionalProjectIds = projectIdsByRegion.get(regionId);
  const regionalSkillIds = skillIdsByRegion.get(regionId);
  if (!regionalProjectIds || !regionalSkillIds) return null;

  const honorIds = new Set(uniqueStrings(progress?.honors));
  if (!regionalProjectIds.every((projectId) => honorIds.has(`badge:${projectId}`))) return null;

  const masteredCount = regionalSkillIds.reduce((total, skillId) => (
    total + (progress?.skills?.[skillId]?.status === 'mastered' ? 1 : 0)
  ), 0);
  const masteryRatio = regionalSkillIds.length === 0 ? 0 : masteredCount / regionalSkillIds.length;
  return medalForMasteryRatio(masteryRatio);
}

export function awardLessonCompletion(progress, lesson, _mastery) {
  if (!progress || lesson?.phase !== 'review' || !projectById.has(lesson.projectId)) return progress;

  const originalHonors = Array.isArray(progress.honors) ? progress.honors : [];
  const originalVehicleUpgrades = Array.isArray(progress.vehicleUpgrades) ? progress.vehicleUpgrades : [];
  const previousHonors = uniqueStrings(progress.honors);
  const badgeId = `badge:${lesson.projectId}`;
  const honors = previousHonors.includes(badgeId)
    ? previousHonors
    : [...previousHonors, badgeId];
  const progressWithBadge = { ...progress, honors };
  const completedCount = completedProjectIds(progressWithBadge).length;
  const stageHonorIds = STAGE_HONOR_MILESTONES
    .filter((honor) => completedCount >= honor.threshold)
    .map((honor) => honor.id);
  const nextHonors = [...new Set([...honors, ...stageHonorIds])];
  const nextVehicleUpgrades = [...new Set([
    ...uniqueStrings(progress.vehicleUpgrades),
    ...vehicleUnlocks({ ...progressWithBadge, honors: nextHonors }),
  ])];

  const unchanged = nextHonors.length === originalHonors.length
    && nextHonors.every((honorId, index) => honorId === originalHonors[index])
    && nextVehicleUpgrades.length === originalVehicleUpgrades.length
    && nextVehicleUpgrades.every((upgradeId, index) => upgradeId === originalVehicleUpgrades[index]);
  if (unchanged) return progress;

  return {
    ...progress,
    honors: nextHonors,
    vehicleUpgrades: nextVehicleUpgrades,
  };
}
