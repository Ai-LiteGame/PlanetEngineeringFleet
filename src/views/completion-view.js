import { REGIONS } from '../curriculum/index.js';
import {
  escapeHtml,
  icon,
  renderUtilityButtons,
  renderWorldScene,
  vehicleLabel,
} from './icons.js';

const PHASE_COPY = Object.freeze({
  learn: ['勘察完成', '新知识已经装进工程工具箱'],
  build: ['施工完成', '工程技能又向前走了一步'],
  review: ['项目验收完成', '这个项目的三段任务全部完成'],
});

export function renderCompletion(model) {
  const lesson = model?.lesson;
  const project = model?.project;
  const region = REGIONS.find((item) => item.id === project?.regionId);
  if (!lesson || !project || !region || !model?.scene) {
    throw new TypeError('Completion view requires valid lesson, project and scene data');
  }
  const [title, detail] = PHASE_COPY[lesson.phase] ?? ['课程完成', '工程车队完成了本次任务'];
  const isProjectComplete = model.isProjectComplete === true;

  return `
    <div class="app-shell completion-shell" data-view="completion">
      <header class="world-topbar">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">工</span><span><strong>${escapeHtml(region.title)}</strong><small>${escapeHtml(project.title)}</small></span></div>
        <div class="completion-badge" aria-label="完成"><span>${icon(isProjectComplete ? 'star' : 'check')}</span><strong>完成</strong></div>
        ${renderUtilityButtons(model.soundEnabled !== false)}
      </header>
      ${renderWorldScene(model.scene, {
        label: `${project.title}完成，${vehicleLabel(model.scene.vehicleSymbolId)}正在庆祝`,
        className: 'completion-scene',
        actionActive: true,
      })}
      <section class="completion-controls" aria-labelledby="completion-title">
        <div class="completion-mark" aria-hidden="true">${icon(isProjectComplete ? 'star' : 'check')}</div>
        <div class="completion-copy">
          <p class="eyebrow">第 ${lesson.ordinal} 课</p>
          <h1 id="completion-title">${escapeHtml(title)}</h1>
          <p><strong>${escapeHtml(lesson.title)}</strong></p>
          <p>${escapeHtml(detail)}</p>
        </div>
        <button class="primary-button" type="button" data-action="continue-interaction">
          ${icon('map')}<span>${model.nextLessonId ? '回到地图' : '看看工程世界'}</span>
        </button>
      </section>
    </div>`;
}
