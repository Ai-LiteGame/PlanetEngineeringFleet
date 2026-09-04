import { QUESTION_BANKS } from './content.js';

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
  return state.questions[state.stage]?.[state.questionIndex] || null;
}

export function submitAnswer(state, answerId) {
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

export function advance(state) {
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
