import {
  STAGES,
  createInitialState,
  createSession,
  currentQuestion,
  submitAnswer,
  advance,
  updateMastery,
} from './game-core.js';
import { STAGE_META } from './content.js';
import {
  loadLegacyProgress,
  saveLegacyProgress,
  resetProgress,
  loadActiveStage,
  saveActiveStage,
  clearActiveStage,
} from './storage.js';
import {
  getStageProgress,
  getHintView,
  getVehicleActionClass,
  getBridgeVariant,
  isSettingsActivationKey,
} from './view-model.js';
import { speak, playSuccess, setSoundEnabled } from './audio.js';

const app = document.querySelector('#app');
const settingsDialog = document.querySelector('#settings-dialog');
const soundToggle = document.querySelector('#sound-toggle');
const learningSummary = document.querySelector('#learning-summary');
const resetButton = document.querySelector('#reset-progress');

let progress = loadLegacyProgress();
let state = createInitialState();
let repeatState = 'idle';
let readyToContinue = false;
let feedbackMessage = '';
let feedbackKind = '';
let actionClass = '';
let stationCelebration = null;
let sessionFinalized = false;
let continueTimer = null;
let repeatTimer = null;
let settingsHoldTimer = null;
let resetArmed = false;

setSoundEnabled(progress.soundEnabled);
soundToggle.checked = progress.soundEnabled;

const restored = loadActiveStage();
if (restored) {
  const stageIndex = STAGES.indexOf(restored.stage);
  const restoredSession = createSession(restored.seed, progress);
  state = {
    ...restoredSession,
    stage: restored.stage,
    stageIndex,
    questionIndex: 0,
    stars: STAGES.slice(0, stageIndex).filter((stage) => stage !== 'mixed'),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function icon(name) {
  const paths = {
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    speaker: '<path d="M5 9v6h4l5 4V5L9 9H5Z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    shield: '<path d="M12 3 4 6v5c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10V6l-8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name] || ''}</svg>`;
}

function vehicle(name, className = '') {
  const label = {
    excavator: '挖掘机', mixer: '搅拌车', crane: '吊车', 'dump-truck': '翻斗车',
  }[name];
  return `<svg class="vehicle ${className}" role="img" aria-label="${label}"><use href="assets/construction-fleet.svg#${name}"></use></svg>`;
}

function bridgeMarkup(stage) {
  const value = getBridgeVariant(stage);
  return `
    <div class="bridge" data-stage="${value}" role="img" aria-label="彩虹桥工程进度 ${value}/3">
      <span class="bridge-light one"></span><span class="bridge-light two"></span><span class="bridge-light three"></span>
      <span class="bridge-deck"></span><span class="bridge-pillar left"></span><span class="bridge-pillar right"></span>
    </div>`;
}

function topbarMarkup(showProgress = true) {
  const stageItems = showProgress && state.stage !== 'intro'
    ? getStageProgress(state).map((item, index) => `
      <div class="progress-stop ${item.status}" aria-label="${item.shortTitle}：${item.status === 'done' ? '完成' : item.status === 'current' ? '进行中' : '未开始'}">
        <span class="progress-dot">${item.status === 'done' ? '✓' : index + 1}</span>
        <span class="progress-label">${item.shortTitle}</span>
      </div>`).join('')
    : '';
  return `
    <header class="topbar">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">工</span>
        <span class="brand-copy"><strong>星球工程车队</strong><span>GREEN SPROUT BUILDERS</span></span>
      </div>
      <nav class="stage-progress" aria-label="本局任务进度">${stageItems}</nav>
      <button class="icon-button" data-settings-trigger aria-label="长按打开家长设置">${icon('settings')}</button>
    </header>`;
}

function sceneMarkup({ title, subtitle, vehicleName = 'excavator', sceneClass = '' }) {
  const secondVehicle = vehicleName === 'dump-truck' ? 'excavator' : 'dump-truck';
  return `
    <section id="scene" class="scene ${sceneClass}" aria-label="绿芽星彩虹桥工地">
      <div class="site-sign"><p class="eyebrow">${state.stage === 'intro' ? '今日工程' : '正在施工'}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>
      <span class="planet" aria-hidden="true"></span>
      <span class="cloud cloud-one" aria-hidden="true"></span><span class="cloud cloud-two" aria-hidden="true"></span>
      ${bridgeMarkup(progress.bridgeStage)}
      <span class="road-dashes" aria-hidden="true"></span>
      <div class="vehicle-lane">${vehicle(vehicleName, 'vehicle-main')}${vehicle(secondVehicle, 'vehicle-secondary')}</div>
    </section>`;
}

function appShell(scene, content, shellClass = '') {
  return `<div class="app-shell ${shellClass}">${topbarMarkup()}${scene}<section class="content-band"><div class="content-inner">${content}</div></section></div>`;
}

function renderIntro() {
  const scene = sceneMarkup({
    title: '为绿芽星修一座彩虹桥',
    subtitle: '四台工程车都准备好了。',
    vehicleName: 'excavator',
  });
  const content = `
    <p class="eyebrow">工程队集合</p>
    <div class="mission-header"><div><h2>准备好了吗？一起开工吧！</h2><p>一小局完成识字、英语和数学三个任务。</p></div></div>
    <div class="intro-actions">
      <button id="start-game" class="primary-button">开始施工</button>
      <span class="mission-note">${icon('shield')}不计时，不扣分，可以反复听</span>
    </div>`;
  app.innerHTML = appShell(scene, content, 'intro');
}

function patternMarkup(question) {
  if (!question.pattern) return '';
  const token = (name) => {
    const symbol = { yellow: '●', blue: '●', red: '●', circle: '●', triangle: '▲', square: '■', '?': '?' }[name] || name;
    return `<span class="pattern-token token-${name}">${symbol}</span>`;
  };
  return `<div class="pattern-strip" aria-label="题目规律">${question.pattern.map(token).join('')}</div>`;
}

function answerMarkup(question) {
  const hint = getHintView(state, question);
  return question.choices.map((choice) => `
    <button class="answer-button ${hint.answerId === choice.id ? 'is-hint' : ''}" data-answer="${escapeHtml(choice.id)}" data-choice-id="${escapeHtml(choice.id)}" ${state.locked ? 'disabled' : ''} aria-label="${escapeHtml(choice.a11yLabel)}">
      <span class="answer-visual">${escapeHtml(choice.visual)}</span>
      ${choice.label === choice.visual ? '' : `<span class="answer-label">${escapeHtml(choice.label)}</span>`}
    </button>`).join('');
}

function repeatPanel(question) {
  if (!question.requiresRepeat || repeatState === 'ready') return '';
  const speaking = repeatState === 'speaking';
  return `
    <div class="repeat-panel ${speaking ? 'is-speaking' : ''}">
      <button id="repeat-after-me" class="mic-button" ${speaking ? 'disabled' : ''} aria-label="听示范并跟读，不会录音">
        ${icon('mic')}
        <span>${speaking ? '一起说…' : '点一下，跟我说'}</span>
      </button>
      <div class="voice-waves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <p>${speaking ? '慢慢说，不着急' : '不会录音，也不会给发音打分'}</p>
    </div>`;
}

function renderQuestion() {
  const question = currentQuestion(state);
  const meta = STAGE_META[state.stage];
  const hint = getHintView(state, question);
  const choicesVisible = !question.requiresRepeat || repeatState === 'ready' || state.answered;
  const total = state.questions[state.stage].length;
  const scene = sceneMarkup({
    title: meta.title,
    subtitle: `${meta.vehicleName}任务 ${state.questionIndex + 1} / ${total}`,
    vehicleName: meta.vehicle,
    sceneClass: actionClass,
  });
  const content = `
    <div class="mission-header">
      <div><p class="eyebrow">${meta.shortTitle} · 第 ${state.questionIndex + 1} 题</p><h2 id="mission">${escapeHtml(question.prompt)}</h2>${question.displaySpeech ? `<p class="english-line">${escapeHtml(question.displaySpeech)}</p>` : ''}</div>
      <button id="repeat-speech" class="speaker-button" aria-label="再听一遍">${icon('speaker')}</button>
    </div>
    ${patternMarkup(question)}
    ${repeatPanel(question)}
    ${choicesVisible ? `<div id="answers" class="answer-grid">${answerMarkup(question)}</div>` : ''}
    <p id="feedback" class="feedback ${feedbackKind}" role="status">${escapeHtml(feedbackMessage || hint.message)}</p>
    ${state.answered && readyToContinue ? `<div class="continue-row"><button id="continue-game" class="primary-button">继续施工</button></div>` : ''}`;
  app.innerHTML = appShell(scene, content);
}

function renderStationComplete(stageName) {
  const finished = STAGE_META[stageName];
  const next = STAGE_META[state.stage];
  const scene = sceneMarkup({
    title: `${finished.vehicleName}任务完成！`,
    subtitle: `获得一颗${finished.shortTitle}能力星`,
    vehicleName: finished.vehicle,
    sceneClass: 'is-celebrating',
  });
  const content = `
    <div class="station-complete">
      <div class="earned-star" aria-hidden="true">★</div>
      <div><p class="eyebrow">完成一站</p><h2>${finished.shortTitle}能力星点亮了</h2><p>下一站，${next.vehicleName}正在等你。</p></div>
    </div>
    <div class="continue-row"><button id="next-station" class="primary-button">去${next.title}</button></div>`;
  app.innerHTML = appShell(scene, content);
}

function renderComplete() {
  const scene = sceneMarkup({
    title: '彩虹桥建好啦！',
    subtitle: '工程车队一起亮灯庆祝',
    vehicleName: 'dump-truck',
    sceneClass: 'is-complete',
  });
  const content = `
    <div class="completion-layout">
      <div class="completion-copy"><p class="eyebrow">今日工程完成</p><h2>你点亮了三颗能力星</h2><p>认出了汉字，说出了英语，还用数学把桥搭好了。</p></div>
      <div class="skill-stars" aria-label="汉字、英语、数学三颗能力星">
        <span><b>★</b>汉字</span><span><b>★</b>英语</span><span><b>★</b>数学</span>
      </div>
    </div>
    <div class="intro-actions"><button id="replay-game" class="primary-button">再建一次</button><button id="back-home" class="secondary-button">回到工地</button></div>`;
  app.innerHTML = appShell(scene, content, 'complete');
}

function render() {
  if (stationCelebration) return renderStationComplete(stationCelebration);
  if (state.stage === 'complete') return renderComplete();
  if (state.stage === 'intro') return renderIntro();
  return renderQuestion();
}

function beginSession() {
  clearTimeout(continueTimer);
  clearTimeout(repeatTimer);
  state = createSession(Date.now(), progress);
  sessionFinalized = false;
  stationCelebration = null;
  readyToContinue = false;
  feedbackMessage = '';
  feedbackKind = '';
  actionClass = '';
  repeatState = 'idle';
  saveActiveStage(undefined, state);
  render();
  speak(currentQuestion(state).speech.text, currentQuestion(state).speech.lang);
}

function handleAnswer(choiceId) {
  if (state.locked || state.answered) return;
  const question = currentQuestion(state);
  const result = submitAnswer(state, choiceId);
  state = result.state;

  if (!result.correct) {
    const hint = getHintView(state, question);
    feedbackMessage = hint.message;
    feedbackKind = 'hint';
    render();
    speak(state.hintLevel >= 2 ? question.hint : question.speech.text, state.hintLevel >= 2 ? 'zh-CN' : question.speech.lang);
    return;
  }

  readyToContinue = false;
  feedbackMessage = question.success;
  feedbackKind = 'success';
  actionClass = getVehicleActionClass(state.stage);
  render();
  playSuccess();
  speak(question.success, question.stage === 'english' ? 'en-US' : 'zh-CN');

  continueTimer = setTimeout(() => {
    actionClass = '';
    readyToContinue = true;
    render();
  }, 850);
}

function continueGame() {
  const previousStage = state.stage;
  const wasLastQuestion = state.questionIndex === state.questions[state.stage].length - 1;
  state = advance(state);
  readyToContinue = false;
  feedbackMessage = '';
  feedbackKind = '';
  actionClass = '';
  repeatState = 'idle';

  if (state.completed) {
    if (!sessionFinalized) {
      progress = updateMastery(progress, state.sessionAnswers);
      saveLegacyProgress(undefined, progress);
      clearActiveStage();
      sessionFinalized = true;
    }
    render();
    return;
  }

  saveActiveStage(undefined, state);
  if (wasLastQuestion && state.stage !== previousStage) {
    stationCelebration = previousStage;
  }
  render();
  if (!stationCelebration) speak(currentQuestion(state).speech.text, currentQuestion(state).speech.lang);
}

function startRepeat() {
  if (repeatState === 'speaking') return;
  const question = currentQuestion(state);
  repeatState = 'speaking';
  feedbackMessage = '';
  render();
  speak(question.speech.text, question.speech.lang);
  repeatTimer = setTimeout(() => {
    repeatState = 'ready';
    render();
  }, 3000);
}

function openSettings() {
  const mastered = Object.values(progress.skills).filter((skill) => skill.masteredAtSession != null).length;
  learningSummary.innerHTML = `<strong>学习记录</strong><br>完成 ${progress.sessionsCompleted} 次工程 · 彩虹桥进度 ${progress.bridgeStage}/3 · 已掌握 ${mastered} 项`;
  soundToggle.checked = progress.soundEnabled;
  resetArmed = false;
  resetButton.textContent = '重置学习记录';
  settingsDialog.showModal();
}

app.addEventListener('click', (event) => {
  const answer = event.target.closest('[data-answer]');
  if (answer) return handleAnswer(answer.dataset.answer);
  if (event.target.closest('#start-game') || event.target.closest('#replay-game')) return beginSession();
  if (event.target.closest('#back-home')) {
    state = createInitialState();
    clearActiveStage();
    return render();
  }
  if (event.target.closest('#repeat-speech')) {
    const question = currentQuestion(state);
    return speak(question.speech.text, question.speech.lang);
  }
  if (event.target.closest('#repeat-after-me')) return startRepeat();
  if (event.target.closest('#continue-game')) return continueGame();
  if (event.target.closest('#next-station')) {
    stationCelebration = null;
    render();
    const question = currentQuestion(state);
    return speak(question.speech.text, question.speech.lang);
  }
  const settings = event.target.closest('[data-settings-trigger]');
  if (settings && event.detail === 0 && globalThis.confirm('这是家长设置，确认打开吗？')) openSettings();
});

app.addEventListener('keydown', (event) => {
  if (!event.target.closest('[data-settings-trigger]') || !isSettingsActivationKey(event.key)) return;
  event.preventDefault();
  if (globalThis.confirm('这是家长设置，确认打开吗？')) openSettings();
});

app.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('[data-settings-trigger]')) return;
  clearTimeout(settingsHoldTimer);
  settingsHoldTimer = setTimeout(openSettings, 2000);
});

for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  app.addEventListener(eventName, () => clearTimeout(settingsHoldTimer));
}

soundToggle.addEventListener('change', () => {
  progress = { ...progress, soundEnabled: soundToggle.checked };
  setSoundEnabled(progress.soundEnabled);
  saveLegacyProgress(undefined, progress);
});

resetButton.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetButton.textContent = '再点一次，确认重置';
    setTimeout(() => {
      resetArmed = false;
      resetButton.textContent = '重置学习记录';
    }, 4000);
    return;
  }
  resetProgress();
  clearActiveStage();
  progress = loadLegacyProgress();
  state = createInitialState();
  setSoundEnabled(true);
  settingsDialog.close();
  render();
});

render();
