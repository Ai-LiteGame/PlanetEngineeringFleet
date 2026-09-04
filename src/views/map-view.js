import { getLesson, getLessonsForProject, getProject, PROJECTS } from '../curriculum/index.js';
import { getSceneState } from '../scene-model.js';
import {
  escapeHtml,
  icon,
  renderUtilityButtons,
  renderVehicle,
} from './icons.js';

const PHASE_LABELS = Object.freeze({ learn: '勘察', build: '施工', review: '验收' });

const STATE_LABELS = Object.freeze({
  completed: '已完成',
  reviewDue: '待复习',
  inProgress: '施工中',
  learnable: '可学习',
  locked: '未开放',
});

const STATE_ICONS = Object.freeze({
  completed: 'check',
  reviewDue: 'replay',
  inProgress: 'play',
  learnable: 'play',
  locked: 'lock',
});

function projectNode(project, currentProjectId, state) {
  const id = escapeHtml(project.id);
  const label = `${project.ordinal}号工程：${project.title}`;
  if (state !== 'locked') {
    const current = project.id === currentProjectId;
    return `
      <button class="project-node is-${escapeHtml(state)} ${current ? 'is-current' : ''}" type="button" data-action="open-project" data-project="${id}" data-state="${escapeHtml(state)}" ${current ? 'aria-current="step"' : ''} aria-label="${STATE_LABELS[state]}，${escapeHtml(label)}" title="${escapeHtml(project.title)}">
        ${icon(STATE_ICONS[state])}<span>${project.ordinal}</span>
      </button>`;
  }
  return `
    <span class="project-node is-locked" data-project="${id}" data-state="locked" aria-disabled="true" aria-label="尚未开放的${escapeHtml(label)}" title="${escapeHtml(project.title)}">
      ${icon('lock')}<span>${project.ordinal}</span>
    </span>`;
}

function phaseReplay(project, availableLessonIds) {
  if (!project || availableLessonIds.length === 0) return '';
  const available = new Set(availableLessonIds);
  return `
    <div class="phase-replay" aria-label="选择${escapeHtml(project.title)}的课程阶段">
      <strong>${escapeHtml(project.title)}</strong>
      ${getLessonsForProject(project.id).filter((lesson) => available.has(lesson.id)).map((lesson) => `
        <button class="phase-button" type="button" data-action="open-lesson" data-lesson="${escapeHtml(lesson.id)}">
          ${icon(lesson.phase === 'review' ? 'replay' : 'play')}<span>${escapeHtml(PHASE_LABELS[lesson.phase])}</span>
        </button>`).join('')}
    </div>`;
}

function regionLandmark(region, currentRegionId, completedProjectIds, currentProject, assetsAvailable) {
  const projects = PROJECTS.filter((project) => project.regionId === region.id);
  const completedCount = projects.filter((project) => completedProjectIds.has(project.id)).length;
  const isCurrent = region.id === currentRegionId;
  const isComplete = completedCount === projects.length;
  const status = isComplete ? '已完成' : isCurrent ? '正在施工' : completedCount > 0 ? '施工中' : '待开放';
  const activeVehicle = assetsAvailable && isCurrent && currentProject
    ? renderVehicle(currentProject.vehicle, 'map-current-vehicle is-working')
    : '';
  const sceneProject = projects.find((project) => !completedProjectIds.has(project.id)) ?? projects.at(-1);
  const scene = assetsAvailable
    ? getSceneState(region.id, sceneProject.ordinal, {}, [...completedProjectIds])
    : null;
  const upgradeLayers = (scene?.visibleUpgradeIds ?? []).map((id) => (
    `<use class="scene-upgrade" href="assets/region-scenes.svg#${escapeHtml(id)}"></use>`
  )).join('');
  const visual = scene
    ? `<svg class="region-landmark-scene" viewBox="0 0 320 180" aria-hidden="true"><use href="assets/region-scenes.svg#${escapeHtml(scene.regionSymbolId)}"></use>${upgradeLayers}</svg>`
    : `<div class="region-landmark-fallback" aria-hidden="true">${icon(isComplete ? 'check' : isCurrent ? 'play' : 'map')}</div>`;

  return `
    <li class="region-landmark ${isCurrent ? 'is-current' : ''} ${isComplete ? 'is-complete' : ''}" data-region="${escapeHtml(region.id)}">
      ${visual}
      ${activeVehicle}
      <div class="region-label">
        <strong>${escapeHtml(region.title)}</strong>
        <span>${status} · ${completedCount}/${projects.length}</span>
      </div>
    </li>`;
}

export function renderMap(model) {
  const regions = Array.isArray(model?.regions) ? model.regions : [];
  const completedProjectIds = new Set(model?.completedProjectIds ?? []);
  const suppliedStates = new Map((model?.projectStates ?? []).map((item) => [item.projectId, item]));
  const currentProject = getProject(model?.currentProjectId);
  const currentLesson = getLesson(model?.currentLessonId);
  if (!currentProject || !currentLesson || currentProject.regionId !== model?.currentRegionId) {
    throw new TypeError('Map requires a valid current course position');
  }
  const currentRegion = regions.find((region) => region.id === model.currentRegionId);
  if (!currentRegion) throw new TypeError('Map requires its current region');

  // Resolve through the scene model here as well as in lessons so global project ordinals are exercised.
  const currentScene = getSceneState(
    currentRegion.id,
    currentProject.ordinal,
    {},
    [...completedProjectIds],
  );
  const regionProjects = PROJECTS.filter((project) => project.regionId === currentRegion.id);
  const detailsForProject = (project) => {
    const supplied = suppliedStates.get(project.id);
    if (supplied) {
      return {
        ...supplied,
        availableLessonIds: Array.isArray(supplied.availableLessonIds)
          ? supplied.availableLessonIds
          : supplied.state === 'completed'
            ? getLessonsForProject(project.id).map((lesson) => lesson.id)
            : [],
      };
    }
    return {
      projectId: project.id,
      state: completedProjectIds.has(project.id) ? 'completed' : project.id === currentProject.id ? 'learnable' : 'locked',
      availableLessonIds: completedProjectIds.has(project.id)
        ? getLessonsForProject(project.id).map((lesson) => lesson.id)
        : project.id === currentProject.id ? [currentLesson.id] : [],
    };
  };
  const stateForProject = (project) => detailsForProject(project).state;
  const selectedProject = getProject(model.selectedProjectId) ?? currentProject;
  const selectedDetails = detailsForProject(selectedProject);
  const localProjectIndex = regionProjects.findIndex((project) => project.id === currentProject.id) + 1;
  const phase = PHASE_LABELS[currentLesson.phase] ?? '学习';
  const assetsAvailable = model.assetsAvailable !== false;
  const storageWarning = model.storageAvailable === false
    ? '<p class="storage-warning" role="status">本次记录不会保存</p>'
    : '';
  const errorNotice = model.errorMessage
    ? `<div class="map-notice" role="alert"><span>${escapeHtml(model.errorMessage)}</span>${assetsAvailable ? '' : `<button class="secondary-button" type="button" data-action="retry-assets">${icon('replay')}<span>重试场景</span></button>`}</div>`
    : '';

  return `
    <div class="app-shell map-shell" data-view="map" data-current-lesson="${escapeHtml(currentLesson.id)}">
      <header class="world-topbar">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">工</span><span><strong>星球工程车队</strong><small>${escapeHtml(currentRegion.title)}</small></span></div>
        <div class="topbar-progress" aria-label="当前区域项目进度"><strong>${localProjectIndex}</strong><span>/ ${regionProjects.length}</span></div>
        ${renderUtilityButtons(model.soundEnabled !== false)}
      </header>
      <section class="world-map" aria-labelledby="map-title">
        <div class="map-heading">
          <div>
            <p class="eyebrow">第 ${currentProject.ordinal} 号工程 · ${phase}</p>
            <h1 id="map-title">${escapeHtml(currentProject.title)}</h1>
            <p>${escapeHtml(currentProject.outcome)}</p>
          </div>
          <div class="map-actions">
            ${model.placementAvailable ? `<button class="secondary-button placement-button" type="button" data-action="start-placement">${icon('map')}<span>找找我的起点</span></button>` : ''}
            <button class="secondary-button garage-button" type="button" data-action="open-garage">
              ${icon('star')}<span>我的车库</span>
            </button>
            <button class="primary-button continue-course" type="button" data-action="continue-course">
              ${icon('play')}<span>继续施工</span>
            </button>
          </div>
        </div>
        ${storageWarning}${errorNotice}
        <ol class="region-map" aria-label="六大工程区域">
          ${regions.map((region) => regionLandmark(region, model.currentRegionId, completedProjectIds, currentProject, assetsAvailable)).join('')}
        </ol>
        <section class="project-route" aria-labelledby="route-title">
          <div class="route-heading">
            <div><p class="eyebrow">当前路线</p><h2 id="route-title">${escapeHtml(currentRegion.title)}</h2></div>
            <div class="route-vehicle" aria-label="当前车辆">${assetsAvailable ? renderVehicle(currentScene.vehicleSymbolId, '') : icon('map')}<span>${escapeHtml(currentProject.title)}</span></div>
          </div>
          <div class="route-line" aria-label="区域项目节点">
            ${regionProjects.map((project) => projectNode(project, currentProject.id, stateForProject(project))).join('')}
          </div>
          ${selectedDetails.state === 'locked' ? '' : phaseReplay(selectedProject, selectedDetails.availableLessonIds ?? [])}
          <p class="route-legend"><span><i class="legend-dot complete"></i>已完成</span><span><i class="legend-dot review-due"></i>待复习</span><span><i class="legend-dot in-progress"></i>施工中</span><span><i class="legend-dot current"></i>可学习</span><span><i class="legend-dot locked"></i>未开放</span></p>
        </section>
      </section>
    </div>`;
}
