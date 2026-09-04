const ICON_PATHS = Object.freeze({
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
  speaker: '<path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  volume: '<path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  muted: '<path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="m17 10 4 4m0-4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  play: '<path d="m9 6 9 6-9 6Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  map: '<path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z"/><path d="M8 3v15m8-12v15"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  replay: '<path d="M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 20h14"/>',
});

const VEHICLE_LABELS = Object.freeze({
  excavator: '挖掘机',
  bulldozer: '推土机',
  crane: '吊车',
  mixer: '搅拌车',
  'dump-truck': '翻斗车',
  roller: '压路机',
  forklift: '叉车',
  'fire-engine': '消防工程车',
  snowplow: '除雪车',
  'tunnel-borer': '隧道钻机',
});

const VEHICLE_UPGRADE_ART = Object.freeze({
  'vehicle:work-light': '<g class="vehicle-upgrade vehicle-upgrade-work-light" fill="#FFF176" stroke="#263F50" stroke-width="4"><circle cx="230" cy="82" r="10"/><path d="M230 65V55M246 71l8-7M214 71l-8-7" fill="none"/></g>',
  'vehicle:body-stickers': '<g class="vehicle-upgrade vehicle-upgrade-body-stickers" fill="#F7F3E8" stroke="#263F50" stroke-width="3"><path d="m162 103 5 9 10 2-7 7 2 10-10-5-9 5 2-10-7-7 10-2Z"/></g>',
  'vehicle:safety-flag': '<g class="vehicle-upgrade vehicle-upgrade-safety-flag" stroke="#263F50" stroke-width="4" stroke-linejoin="round"><path d="M96 104V45"/><path d="M98 47h38l-9 13 9 13H98Z" fill="#F06E52"/></g>',
  'vehicle:reinforced-tires': '<g class="vehicle-upgrade vehicle-upgrade-reinforced-tires" fill="none" stroke="#55D8CC" stroke-width="7"><circle cx="92" cy="137" r="23"/><circle cx="238" cy="137" r="23"/></g>',
  'vehicle:new-paint': '<path class="vehicle-upgrade vehicle-upgrade-paint" d="M76 101H224Q236 101 236 113V126H76Z" fill="#37B8AA" stroke="#263F50" stroke-width="4" opacity=".9"/>',
  'vehicle:toolbox': '<g class="vehicle-upgrade vehicle-upgrade-toolbox" stroke="#263F50" stroke-width="4"><rect x="184" y="105" width="43" height="29" rx="3" fill="#F06E52"/><path d="M196 105v-8h19v8M184 116h43" fill="none"/></g>',
  'vehicle:region-medallion': '<g class="vehicle-upgrade vehicle-upgrade-region-medallion" stroke="#263F50" stroke-width="3"><circle cx="146" cy="116" r="15" fill="#F4B72B"/><path d="m146 106 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#F7F3E8"/></g>',
  'vehicle:chief-engineer-beacon': '<g class="vehicle-upgrade vehicle-upgrade-chief-engineer-beacon" stroke="#263F50" stroke-width="4" stroke-linejoin="round"><path d="M174 76h34l-4-20-8 9-6-13-7 13-9-9Z" fill="#FFF176"/><rect x="173" y="76" width="36" height="9" rx="3" fill="#F06E52"/></g>',
});

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function icon(name, className = '') {
  const paths = ICON_PATHS[name];
  if (!paths) return '';
  return `<svg class="ui-icon ${escapeHtml(className)}" aria-hidden="true" viewBox="0 0 24 24">${paths}</svg>`;
}

export function canonicalVehicleId(vehicleId) {
  if (vehicleId === 'fire-truck') return 'fire-engine';
  if (vehicleId === 'tunnel-drill') return 'tunnel-borer';
  return vehicleId;
}

export function vehicleLabel(vehicleId) {
  return VEHICLE_LABELS[canonicalVehicleId(vehicleId)] ?? '工程车';
}

export function renderVehicle(
  vehicleId,
  className = '',
  label = vehicleLabel(vehicleId),
  upgradeIds = [],
) {
  const symbolId = canonicalVehicleId(vehicleId);
  const unlocked = new Set(Array.isArray(upgradeIds) ? upgradeIds : []);
  const upgradeArt = Object.entries(VEHICLE_UPGRADE_ART)
    .filter(([upgradeId]) => unlocked.has(upgradeId))
    .map(([, markup]) => markup)
    .join('');
  const paintClass = unlocked.has('vehicle:new-paint') ? ' vehicle-has-new-paint' : '';
  return `<svg class="scene-vehicle ${escapeHtml(className)}${paintClass}" viewBox="0 0 320 180" role="img" aria-label="${escapeHtml(label)}"><use href="assets/construction-fleet.svg#${escapeHtml(symbolId)}"></use>${upgradeArt}</svg>`;
}

export function renderWorldScene(scene, options = {}) {
  const className = options.className ?? '';
  const label = options.label ?? '工程施工场景';
  const upgrades = (scene?.visibleUpgradeIds ?? []).map((id) => (
    `<use class="scene-upgrade" href="assets/region-scenes.svg#${escapeHtml(id)}"></use>`
  )).join('');
  const actionClass = options.actionActive ? scene?.actionClass ?? '' : '';

  return `
    <div class="scene-stage ${escapeHtml(className)}">
      <svg class="world-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${escapeHtml(label)}">
        <use class="scene-base" href="assets/region-scenes.svg#${escapeHtml(scene?.regionSymbolId)}"></use>
        ${upgrades}
      </svg>
      ${renderVehicle(scene?.vehicleSymbolId, `scene-vehicle-main ${actionClass}`)}
      <span class="action-dust" aria-hidden="true"></span>
    </div>`;
}

export function renderUtilityButtons(soundEnabled = true) {
  return `
    <div class="utility-actions">
      <button class="icon-button" type="button" data-action="toggle-sound" aria-label="${soundEnabled ? '关闭声音' : '打开声音'}" aria-pressed="${soundEnabled ? 'true' : 'false'}">${icon(soundEnabled ? 'volume' : 'muted')}</button>
      <button class="icon-button" type="button" data-settings-trigger aria-label="长按打开家长设置">${icon('settings')}</button>
    </div>`;
}
