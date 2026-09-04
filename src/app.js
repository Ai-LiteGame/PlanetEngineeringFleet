import { LESSONS, PROJECTS, REGIONS, getLesson, getLessonsForProject, getProject } from './curriculum/index.js';
import {
  advance,
  commitLessonCompletion,
  createLessonState,
  currentQuestion,
  restoreLessonState,
  submitAnswer,
} from './game-core.js';
import { getSceneState } from './scene-model.js';
import {
  clearActiveLesson,
  loadActiveLesson,
  loadProgress,
  saveActiveLesson,
  saveProgress,
} from './storage.js';
import {
  buildCourseRows,
  courseSummary,
  filterCourseRows,
  focusCourseRows,
} from './course-table.js';
import {
  downloadProgressJson,
  nextParentTab,
  nextResetConfirmation,
  resetGameStorage,
} from './parent-actions.js';
import { isSettingsActivationKey } from './view-model.js';
import { createSpeechCountdown, playSuccess, setSoundEnabled, speak } from './audio.js';
import { renderCompletion } from './views/completion-view.js';
import { renderCourseTable } from './views/course-table-view.js';
import { renderLesson } from './views/lesson-view.js';
import { renderMap } from './views/map-view.js';

const app = document.querySelector('#app');
const settingsDialog = document.querySelector('#settings-dialog');
const soundToggle = document.querySelector('#sound-toggle');
const resetButton = document.querySelector('#reset-progress');
const courseTablePanel = document.querySelector('#course-table-panel');
const parentSettingsPanel = document.querySelector('#parent-settings-panel');
const parentTabButtons = settingsDialog.querySelectorAll('[data-parent-tab]');

let progress = loadProgress();
let screen = 'map';
let lessonState = null;
let repeatState = 'ready';
let readyToContinue = false;
let feedbackMessage = '';
let feedbackKind = '';
let actionActive = false;
let mapErrorMessage = '';
let assetsAvailable = true;
let continueTimer = null;
let settingsHoldTimer = null;
let resetTimer = null;
let resetArmed = false;
let parentTab = 'course';
let courseFilters = { tier: 'all', subject: 'all', regionId: 'all', status: 'all' };

const englishRepeatCountdown = createSpeechCountdown({
  onCountdownStart() {
    if (screen !== 'lesson' || lessonState?.screen !== 'playing' || lessonState.answered) return;
    repeatState = 'countdown';
    render();
  },
  onComplete() {
    if (screen !== 'lesson' || lessonState?.screen !== 'playing' || lessonState.answered) return;
    repeatState = 'ready';
    render();
  },
});

function clearInteractionTimers() {
  clearTimeout(continueTimer);
  englishRepeatCountdown.cancel();
  continueTimer = null;
}

function currentLessonId() {
  if (getLesson(progress.currentLessonId)) return progress.currentLessonId;
  const firstIncomplete = LESSONS.find((lesson) => (
    (progress.lessons?.[lesson.id]?.completedCount ?? 0) === 0
  ));
  return (firstIncomplete ?? LESSONS.at(-1)).id;
}

function completedProjectIds() {
  return PROJECTS.filter((project) => (
    getLessonsForProject(project.id).every((lesson) => (
      (progress.lessons?.[lesson.id]?.completedCount ?? 0) > 0
    ))
  )).map((project) => project.id);
}

function coursePosition() {
  const lesson = getLesson(currentLessonId());
  const project = getProject(lesson?.projectId);
  const region = REGIONS.find((item) => item.id === project?.regionId);
  if (!lesson || !project || !region) throw new Error('课程位置无效');
  return { lesson, project, region };
}

function sceneFor(state, completedIds = completedProjectIds()) {
  const project = getProject(state.lesson.projectId);
  const interaction = currentQuestion(state) ?? {};
  return getSceneState(project.regionId, project.ordinal, interaction, completedIds);
}

function mapModel() {
  const { lesson, project, region } = coursePosition();
  return {
    regions: REGIONS,
    currentRegionId: region.id,
    currentProjectId: project.id,
    currentLessonId: lesson.id,
    completedProjectIds: completedProjectIds(),
    soundEnabled: progress.settings.soundEnabled,
    storageAvailable: progress.storageAvailable,
    errorMessage: mapErrorMessage,
    assetsAvailable,
  };
}

function lessonModel() {
  const interaction = currentQuestion(lessonState);
  return {
    screen: lessonState.screen,
    lesson: lessonState.lesson,
    interaction,
    interactionIndex: lessonState.interactionIndex,
    interactionTotal: lessonState.interactions.length,
    scene: sceneFor(lessonState),
    hintLevel: lessonState.hintLevel,
    answered: lessonState.answered,
    repeatState,
    readyToContinue,
    feedbackMessage,
    feedbackKind,
    actionActive,
    soundEnabled: progress.settings.soundEnabled,
  };
}

function completionModel() {
  const lesson = lessonState.lesson;
  const project = getProject(lesson.projectId);
  return {
    lesson,
    project,
    scene: sceneFor(lessonState),
    nextLessonId: progress.currentLessonId,
    isProjectComplete: lesson.phase === 'review',
    soundEnabled: progress.settings.soundEnabled,
  };
}

function renderEmergency(error) {
  console.error(error);
  app.innerHTML = `
    <div class="emergency-view" role="alert">
      <strong>工程资料暂时没有装好</strong>
      <p>请刷新页面再试一次。</p>
      <button class="primary-button" type="button" data-action="recover-map">返回地图</button>
    </div>`;
}

function recoverToMap(message = '工程资料暂时未加载，请重试。') {
  clearInteractionTimers();
  clearActiveLesson();
  lessonState = null;
  screen = 'map';
  actionActive = false;
  readyToContinue = false;
  repeatState = 'ready';
  mapErrorMessage = message;
}

function render() {
  try {
    if (screen === 'lesson') app.innerHTML = renderLesson(lessonModel());
    else if (screen === 'completion') app.innerHTML = renderCompletion(completionModel());
    else app.innerHTML = renderMap(mapModel());
  } catch (error) {
    recoverToMap();
    try {
      app.innerHTML = renderMap(mapModel());
    } catch (mapError) {
      renderEmergency(mapError ?? error);
    }
  }
}

function saveLessonSnapshot() {
  saveActiveLesson(undefined, {
    lessonId: lessonState.lessonId,
    interactionIndex: lessonState.interactionIndex,
    seed: lessonState.seed,
    answers: lessonState.answers,
  });
}

function beginEnglishRepeat(interaction) {
  repeatState = 'demonstrating';
  render();
  englishRepeatCountdown.start(interaction.speech.text, interaction.speech.lang);
}

function presentInteraction() {
  const interaction = currentQuestion(lessonState);
  if (!interaction) throw new Error('课程互动不存在');
  feedbackMessage = '';
  feedbackKind = '';
  readyToContinue = false;
  actionActive = false;
  if (interaction.subject === 'english') {
    beginEnglishRepeat(interaction);
  } else {
    repeatState = 'ready';
    render();
    speak(interaction.speech.text, interaction.speech.lang);
  }
}

function beginLesson(lessonId) {
  clearInteractionTimers();
  const lesson = getLesson(lessonId);
  if (!lesson) throw new RangeError(`Unknown lesson: ${lessonId}`);
  const seed = Date.now();
  lessonState = createLessonState(lesson.id, progress, seed, seed);
  screen = 'lesson';
  assetsAvailable = true;
  mapErrorMessage = '';
  repeatState = 'ready';
  readyToContinue = false;
  feedbackMessage = '';
  feedbackKind = '';
  actionActive = false;
  render();
  speak(`${lesson.title}，准备开始。`, 'zh-CN');
}

function continueFromBriefing() {
  lessonState = advance(lessonState);
  progress = lessonState.progress;
  saveProgress(undefined, progress);
  saveLessonSnapshot();
  presentInteraction();
}

function handleAnswer(answerId) {
  if (screen !== 'lesson' || lessonState.screen !== 'playing') return;
  const interaction = currentQuestion(lessonState);
  if (!interaction || lessonState.locked || lessonState.answered) return;
  if (interaction.subject === 'english' && repeatState !== 'ready') return;

  const result = submitAnswer(lessonState, answerId);
  lessonState = result.state;
  if (!result.correct) {
    feedbackKind = 'is-hint';
    feedbackMessage = '';
    render();
    if (lessonState.hintLevel === 1) {
      speak(interaction.speech.text, interaction.speech.lang);
    } else {
      speak(interaction.hint, 'zh-CN');
    }
    return;
  }

  englishRepeatCountdown.cancel();
  repeatState = 'ready';
  readyToContinue = false;
  feedbackMessage = interaction.success;
  feedbackKind = 'is-success';
  actionActive = true;
  render();
  playSuccess();
  speak(interaction.success, 'zh-CN');
  continueTimer = setTimeout(() => {
    actionActive = false;
    readyToContinue = true;
    continueTimer = null;
    render();
  }, 850);
}

function continueInteraction() {
  if (!lessonState) return;
  if (lessonState.screen === 'briefing') {
    continueFromBriefing();
    return;
  }
  if (screen === 'completion' || lessonState.screen === 'projectComplete') {
    lessonState = advance(lessonState);
    lessonState = null;
    screen = 'map';
    render();
    return;
  }
  if (!lessonState.answered || !readyToContinue) return;

  clearTimeout(continueTimer);
  continueTimer = null;
  lessonState = advance(lessonState);
  if (lessonState.completed) {
    progress = commitLessonCompletion(lessonState, progress, undefined, Date.now());
    screen = 'completion';
    readyToContinue = false;
    feedbackMessage = '';
    feedbackKind = '';
    actionActive = true;
    render();
    return;
  }

  saveLessonSnapshot();
  presentInteraction();
}

function repeatSpeech() {
  if (!lessonState || lessonState.screen !== 'playing') return;
  const interaction = currentQuestion(lessonState);
  if (!interaction) return;
  if (interaction.subject === 'english' && !lessonState.answered) {
    beginEnglishRepeat(interaction);
    return;
  }
  speak(interaction.speech.text, interaction.speech.lang);
}

function toggleSound() {
  progress = {
    ...progress,
    settings: { ...progress.settings, soundEnabled: !progress.settings.soundEnabled },
  };
  setSoundEnabled(progress.settings.soundEnabled);
  soundToggle.checked = progress.settings.soundEnabled;
  saveProgress(undefined, progress);
  render();
}

function renderCoursePanel() {
  const allRows = buildCourseRows(LESSONS, progress);
  const filteredRows = filterCourseRows(allRows, courseFilters);
  const focusedRows = focusCourseRows(filteredRows, courseFilters.subject);
  courseTablePanel.innerHTML = renderCourseTable({
    rows: focusedRows,
    summary: courseSummary(allRows),
    filters: courseFilters,
    regions: REGIONS,
    storageAvailable: progress.storageAvailable,
  });
}

function showParentTab(tab) {
  parentTab = tab === 'settings' ? 'settings' : 'course';
  courseTablePanel.hidden = parentTab !== 'course';
  parentSettingsPanel.hidden = parentTab !== 'settings';
  for (const button of parentTabButtons) {
    const selected = button.dataset.parentTab === parentTab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
}

function openSettings() {
  renderCoursePanel();
  soundToggle.checked = progress.settings.soundEnabled;
  resetArmed = false;
  resetButton.textContent = '重置学习记录';
  showParentTab('course');
  settingsDialog.showModal();
}

function restoreActiveLesson() {
  const snapshot = loadActiveLesson();
  if (!snapshot) return;
  try {
    lessonState = restoreLessonState(snapshot, progress);
    progress = lessonState.progress;
    saveProgress(undefined, progress);
    screen = 'lesson';
    presentInteraction();
  } catch (error) {
    console.error(error);
    recoverToMap('上次课程无法恢复，已回到工程地图。');
  }
}

app.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) {
    const settingsTarget = event.target.closest('[data-settings-trigger]');
    if (settingsTarget && event.detail === 0 && globalThis.confirm('这是家长设置，确认打开吗？')) openSettings();
    return;
  }

  try {
    const { action } = actionTarget.dataset;
    if (action === 'continue-course') beginLesson(currentLessonId());
    else if (action === 'open-project') beginLesson(getLessonsForProject(actionTarget.dataset.project)[0]?.id);
    else if (action === 'answer') handleAnswer(actionTarget.dataset.answer);
    else if (action === 'repeat-speech') repeatSpeech();
    else if (action === 'continue-interaction') continueInteraction();
    else if (action === 'toggle-sound') toggleSound();
    else if (action === 'retry-assets') {
      assetsAvailable = true;
      mapErrorMessage = '';
      render();
    } else if (action === 'recover-map') {
      recoverToMap('');
      render();
    }
  } catch (error) {
    console.error(error);
    recoverToMap();
    render();
  }
});

app.addEventListener('error', (event) => {
  const source = event.target?.getAttribute?.('href') ?? event.target?.getAttribute?.('src') ?? '';
  if (!source.startsWith('assets/')) return;
  assetsAvailable = false;
  recoverToMap('工程场景暂时未加载，请重试。');
  render();
}, true);

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

settingsDialog.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-parent-tab]')?.dataset.parentTab;
  if (tab) {
    showParentTab(tab);
    return;
  }
  if (event.target.closest('[data-action="export-progress"]')) downloadProgressJson(progress);
});

settingsDialog.addEventListener('keydown', (event) => {
  const tabButton = event.target.closest('[data-parent-tab]');
  if (!tabButton || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tab = nextParentTab(tabButton.dataset.parentTab, event.key);
  showParentTab(tab);
  settingsDialog.querySelector(`[data-parent-tab="${tab}"]`)?.focus();
});

settingsDialog.addEventListener('change', (event) => {
  const filter = event.target.dataset.courseFilter;
  if (!filter) return;
  courseFilters = {
    ...courseFilters,
    [filter]: filter === 'tier' && event.target.value !== 'all'
      ? Number(event.target.value)
      : event.target.value,
  };
  renderCoursePanel();
  courseTablePanel.querySelector(`[data-course-filter="${filter}"]`)?.focus();
});

soundToggle.addEventListener('change', () => {
  progress = {
    ...progress,
    settings: { ...progress.settings, soundEnabled: soundToggle.checked },
  };
  setSoundEnabled(progress.settings.soundEnabled);
  saveProgress(undefined, progress);
  renderCoursePanel();
  render();
});

resetButton.addEventListener('click', () => {
  const decision = nextResetConfirmation(resetArmed);
  resetArmed = decision.armed;
  if (!decision.confirmed) {
    resetButton.textContent = '再点一次，确认重置';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetArmed = false;
      resetButton.textContent = '重置学习记录';
    }, 4000);
    return;
  }

  clearTimeout(resetTimer);
  resetGameStorage();
  clearInteractionTimers();
  progress = loadProgress();
  lessonState = null;
  screen = 'map';
  mapErrorMessage = '';
  assetsAvailable = true;
  setSoundEnabled(progress.settings.soundEnabled);
  settingsDialog.close();
  render();
});

setSoundEnabled(progress.settings.soundEnabled);
soundToggle.checked = progress.settings.soundEnabled;
renderCoursePanel();
showParentTab(parentTab);
render();
restoreActiveLesson();
