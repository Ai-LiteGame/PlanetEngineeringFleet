import {
  LESSONS,
  PROJECTS,
  getLesson,
  getLessonsForProject,
  getProject,
} from './curriculum/index.js';
import { skillStatus } from './mastery.js';
import { buildLessonInteractions } from './question-factories.js';
import { RECENT_HINT_WINDOW_MS } from './storage.js';

const PLACEMENT_REVIEW_LESSON_ID = 'lesson-030';
const PLACEMENT_TARGET_LESSON_ID = 'lesson-031';
const PLACEMENT_PASS_COUNT = 5;
const PHASES = new Set(['learn', 'build', 'review']);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function projectSkillIds(projectId) {
  return unique(getLessonsForProject(projectId).flatMap((lesson) => [
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
    lesson.mathSkillId,
  ]));
}

export function lessonForProjectPhase(projectId, phase) {
  if (!getProject(projectId) || !PHASES.has(phase)) return null;
  return getLessonsForProject(projectId).find((lesson) => lesson.phase === phase) ?? null;
}

export function buildProjectMapStates(progress = {}, currentLessonId = null, now = Date.now()) {
  const currentLesson = getLesson(currentLessonId);
  const currentProject = getProject(currentLesson?.projectId);
  const lessonCount = Array.isArray(progress.completionIds) ? progress.completionIds.length : null;

  return PROJECTS.map((project) => {
    const lessons = getLessonsForProject(project.id);
    const records = lessons.map((lesson) => progress.lessons?.[lesson.id] ?? {});
    const reached = project.ordinal <= (currentProject?.ordinal ?? 1);
    if (!reached) return { projectId: project.id, state: 'locked', availableLessonIds: [] };

    const allComplete = records.every((record) => (record.completedCount ?? 0) > 0);
    const anyStarted = records.some((record) => (
      Number.isInteger(record.viewedAt) || (record.completedCount ?? 0) > 0
    ));
    const reviewDue = records.some((record) => (
      (record.completedCount ?? 0) > 0
      && (record.recentHintTimestamps ?? []).filter((timestamp) => (
        timestamp <= now && timestamp >= now - RECENT_HINT_WINDOW_MS
      )).length >= 2
    ))
      || projectSkillIds(project.id).some((id) => (
        progress.skills?.[id] && skillStatus(progress.skills[id], now, lessonCount) === 'reviewDue'
      ));
    let state = 'learnable';
    if (reviewDue) state = 'reviewDue';
    else if (allComplete) state = 'completed';
    else if (anyStarted) state = 'inProgress';

    const firstIncompleteIndex = records.findIndex((record) => (record.completedCount ?? 0) === 0);
    const currentPhaseIndex = project.id === currentProject?.id
      ? lessons.findIndex((lesson) => lesson.id === currentLesson?.id)
      : -1;
    const availableThrough = allComplete
      ? lessons.length - 1
      : Math.max(firstIncompleteIndex, currentPhaseIndex, 0);
    return {
      projectId: project.id,
      state,
      availableLessonIds: lessons.slice(0, availableThrough + 1).map((lesson) => lesson.id),
    };
  });
}

export function createPlacementState(progress = {}, seed = Date.now(), now = Date.now()) {
  const reviewLesson = getLesson(PLACEMENT_REVIEW_LESSON_ID);
  const generated = buildLessonInteractions(reviewLesson, progress, seed, now);
  const interactions = ['chinese', 'english', 'math'].flatMap((subject) => (
    generated.filter((item) => item.subject === subject).slice(0, 2)
  )).map((item, index) => ({
    ...item,
    id: `placement-interaction-${index + 1}`,
    segment: 'placement',
  }));
  return {
    checkpointId: 'tier-1-foundation',
    interactions,
    interactionIndex: 0,
    correctCount: 0,
    answered: false,
    completed: false,
    seed,
  };
}

export function submitPlacementAnswer(state, answerId) {
  if (!state || state.completed || state.answered) return state;
  const interaction = state.interactions[state.interactionIndex];
  if (!interaction) return state;
  return {
    ...state,
    answered: true,
    correctCount: state.correctCount + (answerId === interaction.answerId ? 1 : 0),
  };
}

export function advancePlacement(state) {
  if (!state?.answered || state.completed) return state;
  if (state.interactionIndex + 1 >= state.interactions.length) {
    return { ...state, completed: true };
  }
  return {
    ...state,
    interactionIndex: state.interactionIndex + 1,
    answered: false,
  };
}

export function applyPlacementResult(progress, state, now = Date.now()) {
  if (!state?.completed || !Number.isInteger(now) || now < 0) {
    return { progress, advanced: false };
  }
  const passed = state.correctCount >= PLACEMENT_PASS_COUNT;
  const currentIndex = LESSONS.findIndex((lesson) => lesson.id === progress.currentLessonId);
  const targetIndex = LESSONS.findIndex((lesson) => lesson.id === PLACEMENT_TARGET_LESSON_ID);
  const advanced = passed && (currentIndex < 0 || currentIndex < targetIndex);
  return {
    advanced,
    progress: {
      ...progress,
      currentLessonId: advanced ? PLACEMENT_TARGET_LESSON_ID : progress.currentLessonId,
      placement: {
        checkpointId: state.checkpointId,
        status: advanced ? 'advanced' : 'foundationRoute',
        completedAt: now,
      },
    },
  };
}
