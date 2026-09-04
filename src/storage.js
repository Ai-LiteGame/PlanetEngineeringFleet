export const STORAGE_KEY = 'space-construction-fleet.progress.v1';
export const ACTIVE_KEY = 'space-construction-fleet.active.v1';
const ACTIVE_STAGES = new Set(['chinese', 'english', 'math', 'mixed']);

export const DEFAULT_PROGRESS = Object.freeze({
  version: 1,
  sessionsCompleted: 0,
  bridgeStage: 0,
  soundEnabled: true,
  skills: {},
});

function freshProgress() {
  return {
    ...DEFAULT_PROGRESS,
    skills: {},
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSkillRecord(value) {
  return isPlainObject(value)
    && Number.isInteger(value.independentStreak)
    && value.independentStreak >= 0
    && Number.isInteger(value.helpStreak)
    && value.helpStreak >= 0
    && (value.masteredAtSession === null
      || (Number.isInteger(value.masteredAtSession) && value.masteredAtSession >= 0));
}

export function serializeProgress(progress) {
  return JSON.stringify(progress);
}

export function parseProgress(raw) {
  try {
    if (typeof raw !== 'string' || raw.length === 0) return freshProgress();
    const value = JSON.parse(raw);
    if (!isPlainObject(value)
      || value.version !== 1
      || !Number.isInteger(value.sessionsCompleted)
      || value.sessionsCompleted < 0
      || !Number.isInteger(value.bridgeStage)
      || value.bridgeStage < 0
      || value.bridgeStage > 3
      || !isPlainObject(value.skills)
      || Object.values(value.skills).some((skill) => !isSkillRecord(skill))) {
      return freshProgress();
    }

    return {
      version: 1,
      sessionsCompleted: value.sessionsCompleted,
      bridgeStage: value.bridgeStage,
      soundEnabled: value.soundEnabled !== false,
      skills: value.skills,
    };
  } catch {
    return freshProgress();
  }
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    return parseProgress(storage?.getItem(STORAGE_KEY));
  } catch {
    return freshProgress();
  }
}

export function saveProgress(storage = globalThis.localStorage, progress) {
  try {
    storage?.setItem(STORAGE_KEY, serializeProgress(progress));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function resetProgress(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function saveActiveStage(storage = globalThis.localStorage, state) {
  try {
    if (!Number.isFinite(state?.seed) || !ACTIVE_STAGES.has(state?.stage)) return false;
    storage?.setItem(ACTIVE_KEY, JSON.stringify({
      version: 1,
      seed: state.seed,
      stage: state.stage,
    }));
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function loadActiveStage(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isFinite(value.seed) || !ACTIVE_STAGES.has(value.stage)) {
      return null;
    }
    return { seed: value.seed, stage: value.stage };
  } catch {
    return null;
  }
}

export function clearActiveStage(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
}
