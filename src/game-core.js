import { QUESTION_BANKS } from './content.js';
import { getLesson, LESSONS } from './curriculum/index.js';
import { buildLessonInteractions } from './question-factories.js';
import { createSkillRecord, recordSkillAttempt } from './mastery.js';
import { recordLessonViewed } from './storage.js';

export const STAGES = ['chinese', 'english', 'math', 'mixed'];

export function createInitialState() {
  return {
    stage: 'intro',
    stageIndex: -1,
    questionIndex: 0,
    questions: {},
    attempts: 0,
    hintLevel: 0,
    stars: [],
    completed: false,
    locked: false,
    answered: false,
    sessionAnswers: [],
    seed: 0,
  };
}

function seededRandom(seed) {
  let value = Math.abs(Number(seed) || 1) % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function questionWeight(question, progress = {}, sessionNumber = 0) {
  const skill = progress.skills?.[question.skillId];
  if (!skill || skill.masteredAtSession == null) return 4;
  const offset = sessionNumber - skill.masteredAtSession;
  return [2, 4, 7].includes(offset) ? 2 : 1;
}

function weightedShuffle(items, random, progress, sessionNumber) {
  return items
    .map((item) => ({
      item,
      score: random() ** (1 / questionWeight(item, progress, sessionNumber)),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

export function createSession(seed = Date.now(), progress = {}) {
  const random = seededRandom(seed + (progress.sessionsCompleted || 0));
  const questions = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      weightedShuffle(
        shuffled(QUESTION_BANKS[stage], random),
        random,
        progress,
        (progress.sessionsCompleted || 0) + 1,
      ).slice(0, 3),
    ]),
  );

  return {
    ...createInitialState(),
    stage: STAGES[0],
    stageIndex: 0,
    questions,
    seed,
  };
}

export function updateMastery(progress, sessionAnswers) {
  const nextSession = (progress.sessionsCompleted || 0) + 1;
  const skills = { ...(progress.skills || {}) };

  for (const answer of sessionAnswers) {
    if (!answer.correct || !answer.skillId) continue;
    const previous = skills[answer.skillId] || {
      independentStreak: 0,
      helpStreak: 0,
      masteredAtSession: null,
    };

    if (answer.assistance === 0) {
      const independentStreak = previous.independentStreak + 1;
      skills[answer.skillId] = {
        independentStreak,
        helpStreak: 0,
        masteredAtSession: independentStreak >= 3
          ? (previous.masteredAtSession ?? nextSession)
          : previous.masteredAtSession,
      };
    } else {
      skills[answer.skillId] = {
        independentStreak: 0,
        helpStreak: previous.helpStreak + 1,
        masteredAtSession: null,
      };
    }
  }

  return {
    ...progress,
    version: 1,
    sessionsCompleted: nextSession,
    bridgeStage: Math.min(3, (progress.bridgeStage || 0) + 1),
    skills,
  };
}

export function currentQuestion(state) {
  if (Array.isArray(state?.interactions)) {
    return state.interactions[state.interactionIndex] || null;
  }
  return state.questions[state.stage]?.[state.questionIndex] || null;
}

function submitLegacyAnswer(state, answerId) {
  const question = currentQuestion(state);
  if (!question || state.locked || state.answered) {
    return {
      state,
      correct: Boolean(state.answered),
      hintLevel: state.hintLevel,
      completedQuestion: Boolean(state.answered),
    };
  }

  const correct = answerId === question.answerId;
  if (!correct) {
    const hintLevel = Math.min(2, state.hintLevel + 1);
    return {
      state: {
        ...state,
        attempts: state.attempts + 1,
        hintLevel,
      },
      correct: false,
      hintLevel,
      completedQuestion: false,
    };
  }

  const answerRecord = {
    questionId: question.id,
    skillId: question.skillId,
    stage: state.stage,
    correct: true,
    assistance: state.hintLevel,
    attempts: state.attempts,
  };
  const nextState = {
    ...state,
    locked: true,
    answered: true,
    sessionAnswers: [...state.sessionAnswers, answerRecord],
  };

  return {
    state: nextState,
    correct: true,
    hintLevel: state.hintLevel,
    completedQuestion: true,
  };
}

function advanceLegacy(state) {
  if (!state.answered) return state;

  const stageQuestions = state.questions[state.stage] || [];
  if (state.questionIndex + 1 < stageQuestions.length) {
    return {
      ...state,
      questionIndex: state.questionIndex + 1,
      attempts: 0,
      hintLevel: 0,
      locked: false,
      answered: false,
    };
  }

  const nextIndex = state.stageIndex + 1;
  if (nextIndex >= STAGES.length) {
    return {
      ...state,
      stage: 'complete',
      stageIndex: STAGES.length,
      questionIndex: 0,
      attempts: 0,
      hintLevel: 0,
      locked: false,
      answered: false,
      completed: true,
    };
  }

  const stars = state.stage === 'mixed' || state.stars.includes(state.stage)
    ? state.stars
    : [...state.stars, state.stage];

  return {
    ...state,
    stage: STAGES[nextIndex],
    stageIndex: nextIndex,
    questionIndex: 0,
    attempts: 0,
    hintLevel: 0,
    stars,
    locked: false,
    answered: false,
  };
}

function isLessonState(state) {
  return Boolean(state)
    && typeof state.lessonId === 'string'
    && Array.isArray(state.interactions);
}

function enterPlaying(state) {
  if (state.screen !== 'briefing') return state;
  return {
    ...state,
    screen: 'playing',
    progress: recordLessonViewed(state.progress, state.lessonId, state.startedAt),
  };
}

export function createLessonState(lessonId, progress, seed = Date.now(), now = Date.now()) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new RangeError(`Unknown lesson: ${lessonId}`);
  const completedCount = progress?.lessons?.[lessonId]?.completedCount ?? 0;
  return {
    screen: 'briefing',
    lessonId,
    lesson,
    interactions: buildLessonInteractions(lesson, progress, seed, now),
    interactionIndex: 0,
    attempts: 0,
    hintLevel: 0,
    demonstratedAnswerId: null,
    answered: false,
    locked: false,
    completed: false,
    answers: [],
    progress,
    seed,
    startedAt: now,
    completionId: `${lessonId}:${completedCount + 1}`,
    completionCount: completedCount + 1,
  };
}

function submitLessonAnswer(state, answerId) {
  const activeState = enterPlaying(state);
  const current = currentQuestion(activeState);
  if (activeState.screen !== 'playing' || !current || activeState.locked || activeState.answered) {
    return {
      state: activeState,
      correct: Boolean(activeState.answered),
      hintLevel: activeState.hintLevel,
      completedQuestion: Boolean(activeState.answered),
    };
  }

  const correct = answerId === current.answerId;
  if (!correct) {
    const hintLevel = Math.min(3, activeState.hintLevel + 1);
    const nextState = {
      ...activeState,
      attempts: activeState.attempts + 1,
      hintLevel,
      demonstratedAnswerId: hintLevel === 3 ? current.answerId : null,
    };
    return {
      state: nextState,
      correct: false,
      hintLevel,
      completedQuestion: false,
      demonstratedAnswerId: nextState.demonstratedAnswerId,
    };
  }

  const answer = {
    interactionId: current.id,
    subject: current.subject,
    skillIds: [...current.skillIds],
    correct: true,
    assistance: activeState.hintLevel,
    attempts: activeState.attempts,
  };
  const nextState = {
    ...activeState,
    answered: true,
    locked: true,
    answers: [...activeState.answers, answer],
  };
  return {
    state: nextState,
    correct: true,
    hintLevel: activeState.hintLevel,
    completedQuestion: true,
  };
}

function advanceLesson(state) {
  if (state.screen === 'briefing') return enterPlaying(state);
  if (state.screen === 'projectComplete') return { ...state, screen: 'map' };
  if (state.screen !== 'playing' || !state.answered) return state;

  if (state.interactionIndex + 1 >= state.interactions.length) {
    return {
      ...state,
      screen: 'projectComplete',
      completed: true,
    };
  }

  return {
    ...state,
    interactionIndex: state.interactionIndex + 1,
    attempts: 0,
    hintLevel: 0,
    demonstratedAnswerId: null,
    answered: false,
    locked: false,
  };
}

export function submitAnswer(state, answerId) {
  return isLessonState(state)
    ? submitLessonAnswer(state, answerId)
    : submitLegacyAnswer(state, answerId);
}

export function advance(state) {
  return isLessonState(state) ? advanceLesson(state) : advanceLegacy(state);
}

function nextLessonId(progress, completedLessonIndex) {
  const currentIndex = LESSONS.findIndex((lesson) => lesson.id === progress?.currentLessonId);
  if (currentIndex > completedLessonIndex) return progress.currentLessonId;

  const furthestCompletedIndex = LESSONS.reduce((furthest, lesson, index) => (
    (progress?.lessons?.[lesson.id]?.completedCount ?? 0) > 0 ? index : furthest
  ), -1);
  if (furthestCompletedIndex > completedLessonIndex) {
    return LESSONS[furthestCompletedIndex + 1]?.id ?? null;
  }
  return LESSONS[completedLessonIndex + 1]?.id ?? null;
}

export function completeLesson(state, progress, now = Date.now()) {
  if (!isLessonState(state) || !state.completed || !Number.isInteger(now) || now < 0) return progress;
  if (state.completionId !== `${state.lessonId}:${state.completionCount}`) return progress;
  const currentRecord = progress?.lessons?.[state.lessonId];
  if ((currentRecord?.completedCount ?? 0) >= state.completionCount) return progress;

  const viewedProgress = recordLessonViewed(progress, state.lessonId, state.startedAt);
  const previous = viewedProgress.lessons[state.lessonId];
  const skills = { ...viewedProgress.skills };
  for (const answer of state.answers) {
    for (const skillId of answer.skillIds) {
      skills[skillId] = recordSkillAttempt(
        skills[skillId] ?? createSkillRecord(),
        {
          correct: answer.correct,
          assistance: answer.assistance,
          lessonId: state.lessonId,
        },
        now,
      );
    }
  }

  const lessonIndex = LESSONS.findIndex((lesson) => lesson.id === state.lessonId);
  return {
    ...viewedProgress,
    currentLessonId: nextLessonId(viewedProgress, lessonIndex),
    lessons: {
      ...viewedProgress.lessons,
      [state.lessonId]: {
        ...previous,
        status: previous.status === 'mastered' ? 'mastered' : 'practiced',
        completedCount: state.completionCount,
        lastCompletedAt: now,
      },
    },
    skills,
  };
}
