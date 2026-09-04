import { escapeHtml, icon, renderUtilityButtons } from './icons.js';

export function renderPlacement(model) {
  const state = model?.state;
  const interaction = model?.interaction;
  if (!state || !interaction) throw new TypeError('Placement view requires an active interaction');
  const choices = interaction.choices.map((choice) => `
    <button class="answer-button" type="button" data-action="placement-answer" data-answer="${escapeHtml(choice.id)}" ${state.answered ? 'disabled' : ''}>
      <span class="answer-visual" aria-hidden="true">${escapeHtml(choice.visual)}</span>
      <span>${escapeHtml(choice.label)}</span>
    </button>`).join('');
  return `
    <div class="app-shell placement-shell" data-view="placement">
      <header class="world-topbar">
        <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">工</span><span><strong>找到适合你的施工起点</strong><small>轻松试一试</small></span></div>
        <div class="topbar-progress"><strong>${state.interactionIndex + 1}</strong><span>/ ${state.interactions.length}</span></div>
        ${renderUtilityButtons(model.soundEnabled !== false)}
      </header>
      <section class="placement-content" aria-labelledby="placement-title">
        <div class="placement-heading">
          <p class="eyebrow">只听、看和选择，不会录音</p>
          <h1 id="placement-title">${escapeHtml(interaction.prompt)}</h1>
          ${interaction.visualPrompt ? `<div class="problem-visual" aria-label="任务图">${escapeHtml(interaction.visualPrompt)}</div>` : ''}
          <button class="speaker-button" type="button" data-action="placement-repeat">${icon('volume')}<span>再听一次</span></button>
        </div>
        <div class="answer-grid">${choices}</div>
        ${state.answered ? `<div class="placement-next"><p role="status">路线线索收集好了，继续看看。</p><button class="primary-button" type="button" data-action="placement-continue">${icon('play')}<span>继续</span></button></div>` : ''}
        <button class="secondary-button" type="button" data-action="placement-exit">${icon('map')}<span>回到地图</span></button>
      </section>
    </div>`;
}
