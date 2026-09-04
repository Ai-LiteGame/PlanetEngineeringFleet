import { REGIONS } from '../curriculum/index.js';
import { STAGE_HONOR_MILESTONES, VEHICLE_UPGRADE_MILESTONES } from '../honors.js';
import {
  canonicalVehicleId,
  escapeHtml,
  icon,
  renderUtilityButtons,
  renderVehicle,
  vehicleLabel,
} from './icons.js';

const MEDAL_LABELS = Object.freeze({
  bronze: '铜章',
  silver: '银章',
  gold: '金章',
});

const PAINT_SWATCHES = Object.freeze([
  Object.freeze({ id: 'yellow', label: '工程黄', color: '#f5bf32' }),
  Object.freeze({ id: 'coral', label: '救援红', color: '#df5b4c' }),
  Object.freeze({ id: 'green', label: '森林绿', color: '#3f925f' }),
  Object.freeze({ id: 'blue', label: '海港蓝', color: '#2576ac' }),
  Object.freeze({ id: 'white', label: '冰雪白', color: '#f7faf8' }),
]);

function uniqueVehicleIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(canonicalVehicleId))];
}

function renderFleet(vehicleIds, vehicleUpgrades) {
  return vehicleIds.map((vehicleId) => `
    <li class="garage-vehicle">
      ${renderVehicle(vehicleId, 'garage-vehicle-art', vehicleLabel(vehicleId), vehicleUpgrades)}
      <strong>${escapeHtml(vehicleLabel(vehicleId))}</strong>
    </li>`).join('');
}

function renderUpgrades(unlockedIds) {
  const unlocked = new Set(unlockedIds);
  return VEHICLE_UPGRADE_MILESTONES.map((upgrade) => {
    const isUnlocked = unlocked.has(upgrade.id);
    return `
      <li class="garage-upgrade ${isUnlocked ? 'is-unlocked' : 'is-locked'}">
        <span class="garage-upgrade-mark" aria-hidden="true">${icon(isUnlocked ? 'check' : 'lock')}</span>
        <span><strong>${escapeHtml(upgrade.label)}</strong><small>${isUnlocked ? '已装配' : `完成 ${upgrade.threshold} 个项目解锁`}</small></span>
      </li>`;
  }).join('');
}

function renderMedals(regionMedals) {
  const medalsByRegion = new Map((Array.isArray(regionMedals) ? regionMedals : [])
    .map((entry) => [entry.regionId, entry]));
  return REGIONS.map((region) => {
    const medal = medalsByRegion.get(region.id)?.medal ?? null;
    return `
      <li class="region-honor ${medal ? `is-${medal}` : 'is-pending'}">
        <span class="region-medal" aria-hidden="true">${icon(medal ? 'star' : 'lock')}</span>
        <span><strong>${escapeHtml(region.title)}</strong><small>${MEDAL_LABELS[medal] ?? '完成区域后授章'}</small></span>
      </li>`;
  }).join('');
}

function renderStageHonors(stageHonorIds) {
  const earned = new Set(stageHonorIds);
  return STAGE_HONOR_MILESTONES.map((honor) => `
    <li class="stage-honor ${earned.has(honor.id) ? 'is-earned' : 'is-pending'}">
      ${icon(earned.has(honor.id) ? 'star' : 'lock')}
      <span><strong>${escapeHtml(honor.label)}</strong><small>${earned.has(honor.id) ? '已获得' : `${honor.threshold} 个项目`}</small></span>
    </li>`).join('');
}

export function renderGarage(model = {}) {
  const vehicleIds = uniqueVehicleIds(model.vehicleIds);
  const completedProjectCount = Number.isInteger(model.completedProjectCount)
    ? Math.max(0, model.completedProjectCount)
    : 0;

  return `
    <div class="app-shell garage-shell" data-view="garage">
      <header class="world-topbar">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">工</span><span><strong>星球工程车库</strong><small>我的车队与荣誉</small></span></div>
        <div class="topbar-progress garage-count" aria-label="已完成项目"><strong>${completedProjectCount}</strong><span>/ 90</span></div>
        ${renderUtilityButtons(model.soundEnabled !== false)}
      </header>
      <section class="garage-main" aria-labelledby="garage-title">
        <div class="garage-heading">
          <div><p class="eyebrow">车队基地</p><h1 id="garage-title">我的工程车库</h1></div>
          <button class="secondary-button garage-back" type="button" data-action="close-garage">${icon('map')}<span>回到地图</span></button>
        </div>
        <section class="garage-section" aria-labelledby="fleet-title">
          <div class="garage-section-heading"><h2 id="fleet-title">工程车队</h2><span>${vehicleIds.length} 辆车型</span></div>
          <ul class="garage-fleet">${renderFleet(vehicleIds, model.vehicleUpgrades)}</ul>
          <div class="garage-paints" aria-label="车队颜色">
            ${PAINT_SWATCHES.map((swatch) => `<span class="garage-swatch" role="img" aria-label="${escapeHtml(swatch.label)}" title="${escapeHtml(swatch.label)}" style="--swatch: ${swatch.color}"></span>`).join('')}
          </div>
        </section>
        <section class="garage-section" aria-labelledby="upgrade-title">
          <div class="garage-section-heading"><h2 id="upgrade-title">车辆升级</h2><span>随项目进度自动装配</span></div>
          <ul class="garage-upgrades">${renderUpgrades(model.vehicleUpgrades)}</ul>
        </section>
        <section class="garage-section" aria-labelledby="medal-title">
          <div class="garage-section-heading"><h2 id="medal-title">区域奖章</h2><span>完成区域并掌握技能</span></div>
          <ul class="region-honors">${renderMedals(model.regionMedals)}</ul>
        </section>
        <section class="garage-section" aria-labelledby="stage-title">
          <div class="garage-section-heading"><h2 id="stage-title">阶段荣誉</h2><span>三个成长里程碑</span></div>
          <ul class="stage-honors">${renderStageHonors(model.stageHonorIds)}</ul>
        </section>
      </section>
    </div>`;
}
