import { getProject, REGIONS } from '../curriculum/index.js';
import {
  escapeHtml,
  icon,
  renderUtilityButtons,
  renderWorldScene,
  vehicleLabel,
} from './icons.js';

const SUBJECT_LABELS = Object.freeze({
  chinese: '汉字工位',
  english: '英语联络',
  math: '数学测量',
  mixed: '综合配送',
});

const EFFECT_GLYPHS = Object.freeze({
  beacon: '◆',
  bolt: '⚡',
  bubble: '○',
  cloud: '●',
  cone: '▲',
  flag: '⚑',
  gear: '⚙',
  heart: '♥',
  helmet: '⛑',
  lamp: '◎',
  like: '👍',
  ribbon: '✦',
  sign: '▰',
  spark: '★',
  star: '★',
  toolbox: '■',
  wheel: '●',
});

function choicesFor(interaction, hintLevel, answered) {
  if (answered || hintLevel < 2) return interaction.choices;
  const answer = interaction.choices.find((choice) => choice.id === interaction.answerId);
  const distractor = interaction.choices.find((choice) => choice.id !== interaction.answerId);
  return [answer, distractor].filter(Boolean).sort((left, right) => (
    interaction.choices.indexOf(left) - interaction.choices.indexOf(right)
  ));
}

function answerMarkup(interaction, hintLevel, answered) {
  return choicesFor(interaction, hintLevel, answered).map((choice) => {
    const demonstrated = hintLevel >= 3 && choice.id === interaction.answerId && !answered;
    const selected = answered && choice.id === interaction.answerId;
    const classes = ['answer-button'];
    if (demonstrated) classes.push('is-demonstrated');
    if (selected) classes.push('is-correct');
    const label = choice.a11yLabel ?? choice.label;
    return `
      <button type="button" data-action="answer" data-answer="${escapeHtml(choice.id)}" class="${classes.join(' ')}" aria-label="${escapeHtml(label)}"${answered ? ' disabled' : ''}>
        <span class="answer-visual">${escapeHtml(choice.visual)}</span>
        ${choice.label === choice.visual ? '' : `<span class="answer-label">${escapeHtml(choice.label)}</span>`}
      </button>`;
  }).join('');
}

function hintMarkup(interaction, hintLevel, feedbackMessage, feedbackKind) {
  if (feedbackMessage) {
    return `<p class="lesson-feedback ${escapeHtml(feedbackKind)}" role="status">${escapeHtml(feedbackMessage)}</p>`;
  }
  if (hintLevel === 1) {
    return '<p class="lesson-feedback is-hint" role="status">再听一遍，看看工程提示。</p>';
  }
  if (hintLevel === 2) {
    return `<p class="lesson-feedback is-hint" role="status">${escapeHtml(interaction.hint)}</p>`;
  }
  if (hintLevel >= 3) {
    return `<p class="lesson-feedback is-hint" role="status">${escapeHtml(interaction.hint)} 车队长演示好了，请你再选一次。</p>`;
  }
  return '<p class="lesson-feedback" role="status" aria-label="等待作答"></p>';
}

function repeatMarkup(repeatState) {
  if (repeatState === 'ready') return '';
  const demonstrating = repeatState === 'demonstrating';
  return `
    <div class="repeat-rhythm ${demonstrating ? 'is-speaking' : ''}" aria-live="polite">
      <div class="voice-waves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <strong>${demonstrating ? '先听示范，再跟着说' : '轮到你说 · 3 秒'}</strong>
      <span>只给跟说时间，不会录音</span>
    </div>`;
}

function numericEffectValue(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function answerEffectMarkup(effect) {
  if (!effect || !['success', 'retry'].includes(effect.kind) || !Array.isArray(effect.particles)) {
    return '';
  }
  const tier = ['standard', 'combo', 'super', 'mega', 'retry'].includes(effect.tier)
    ? effect.tier
    : 'standard';
  const effectClasses = [...new Set(['answer-effect-layer', `is-${effect.kind}`, `is-${tier}`])];
  const particles = effect.particles.map((particle, index) => {
    const glyph = EFFECT_GLYPHS[particle?.glyph] ?? EFFECT_GLYPHS.spark;
    const style = [
      `--lane:${numericEffectValue(particle?.lane, index % 100)}`,
      `--x:${numericEffectValue(particle?.x)}`,
      `--y:${numericEffectValue(particle?.y, -30)}`,
      `--delay:${numericEffectValue(particle?.delay)}ms`,
      `--size:${numericEffectValue(particle?.size, 20)}px`,
      `--rotation:${numericEffectValue(particle?.rotation)}deg`,
    ].join(';');
    return `<i class="answer-effect-particle glyph-${escapeHtml(particle?.glyph ?? 'spark')}" style="${style}">${glyph}</i>`;
  }).join('');
  return `
    <div class="${effectClasses.join(' ')}" data-variant="${escapeHtml(effect.variant ?? '')}" aria-hidden="true">
      <strong class="answer-effect-badge">${escapeHtml(effect.message ?? '')}</strong>
      ${particles}
    </div>`;
}

function briefingMarkup(lesson, project) {
  return `
    <section class="lesson-controls briefing-controls" aria-labelledby="lesson-title">
      <p class="eyebrow">${escapeHtml(SUBJECT_LABELS.mixed)} · 第 ${escapeHtml(lesson.ordinal)} 课</p>
      <h1 id="lesson-title">${escapeHtml(lesson.title)}</h1>
      <p>${escapeHtml(project.outcome)}，工程队已经准备好了。</p>
      <button class="primary-button" type="button" data-action="continue-interaction">${icon('play')}<span>开始任务</span></button>
    </section>`;
}

export function renderLesson(model) {
  const lesson = model?.lesson;
  const project = getProject(lesson?.projectId);
  const region = REGIONS.find((item) => item.id === project?.regionId);
  if (!lesson || !project || !region || !model?.scene) {
    throw new TypeError('Lesson view requires valid lesson and scene data');
  }
  const interactionTotal = Number.isInteger(model.interactionTotal) ? model.interactionTotal : 0;
  const interactionIndex = Number.isInteger(model.interactionIndex) ? model.interactionIndex : 0;
  const progressPercent = interactionTotal > 0
    ? Math.min(100, Math.max(0, ((interactionIndex + (model.answered ? 1 : 0)) / interactionTotal) * 100))
    : 0;
  const topbar = `
    <header class="world-topbar lesson-topbar">
      <div class="brand-lockup"><span class="brand-mark" aria-hidden="true">工</span><span><strong>${escapeHtml(region.title)}</strong><small>${escapeHtml(project.title)}</small></span></div>
      <div class="lesson-progress" aria-label="课程进度 ${interactionIndex + 1} / ${interactionTotal}"><span><b>${Math.min(interactionIndex + 1, interactionTotal)}</b> / ${interactionTotal}</span><i style="--progress: ${progressPercent}%"></i></div>
      ${renderUtilityButtons(model.soundEnabled !== false)}
    </header>`;

  if (model.screen === 'briefing' || !model.interaction) {
    return `
      <div class="app-shell lesson-shell is-briefing" data-view="lesson">
        ${topbar}
        ${renderWorldScene(model.scene, { label: `${region.title}${project.title}`, className: 'lesson-scene' })}
        ${briefingMarkup(lesson, project)}
      </div>`;
  }

  const interaction = model.interaction;
  if (!Array.isArray(interaction.choices) || !interaction.speech) {
    throw new TypeError('Lesson interaction is not renderable');
  }
  const isEnglish = interaction.subject === 'english';
  const choicesVisible = !isEnglish || model.repeatState === 'ready' || model.answered;
  const subjectLabel = SUBJECT_LABELS[interaction.subject] ?? '工程任务';
  const speechLabel = isEnglish ? interaction.speech.text : '再听一遍';

  return `
    <div class="app-shell lesson-shell" data-view="lesson" data-subject="${escapeHtml(interaction.subject)}" data-interaction-kind="${escapeHtml(interaction.kind ?? '')}">
      ${answerEffectMarkup(model.answerEffect)}
      ${topbar}
      ${renderWorldScene(model.scene, {
        label: `${region.title}，${vehicleLabel(model.scene.vehicleSymbolId)}正在${project.title}`,
        className: 'lesson-scene',
        actionActive: model.actionActive === true,
      })}
      <section class="lesson-controls" aria-labelledby="mission-title">
        <div class="mission-header">
          <div><p class="eyebrow">${escapeHtml(subjectLabel)} · ${interactionIndex + 1}/${interactionTotal}</p><h1 id="mission-title">${escapeHtml(interaction.prompt)}</h1></div>
          <button class="speaker-button" type="button" data-action="repeat-speech" aria-label="播放题目语音">${icon('speaker')}<span>${escapeHtml(speechLabel)}</span></button>
        </div>
        ${isEnglish ? `<p class="speech-line" lang="en">${escapeHtml(interaction.speech.text)}</p>${repeatMarkup(model.repeatState)}` : ''}
        ${interaction.visualPrompt ? `<div class="problem-visual" aria-label="任务图">${escapeHtml(interaction.visualPrompt)}</div>` : ''}
        ${choicesVisible ? `<div class="answer-grid">${answerMarkup(interaction, model.hintLevel ?? 0, model.answered === true)}</div>` : ''}
        ${hintMarkup(interaction, model.hintLevel ?? 0, model.feedbackMessage, model.feedbackKind)}
        ${model.answered && model.readyToContinue ? `<div class="continue-row"><button class="primary-button" type="button" data-action="continue-interaction">${icon('arrow')}<span>继续施工</span></button></div>` : ''}
      </section>
    </div>`;
}
