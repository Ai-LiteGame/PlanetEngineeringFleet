import { createSkillRecord } from './mastery.js';

export const STORAGE_KEY = 'space-construction-fleet.progress.v2';
export const ACTIVE_KEY = 'space-construction-fleet.active.v2';
export const LEGACY_STORAGE_KEY = 'space-construction-fleet.progress.v1';
export const LEGACY_ACTIVE_KEY = 'space-construction-fleet.active.v1';

const LESSON_STATUSES = new Set(['notStarted', 'viewed', 'practiced', 'reviewDue', 'mastered']);
const SKILL_STATUSES = new Set(['unseen', 'practicing', 'reviewDue', 'mastered']);
const LEGACY_STAGES = new Set(['chinese', 'english', 'math', 'mixed']);

// Only IDs shipped by the version-one game are migrated into current curriculum skills.
export const LEGACY_SKILL_MAP = Object.freeze({
  'zh:桥': 'zh-197',
  'zh:车': 'zh-042',
  'zh:上': 'zh-070',
  'zh:山': 'zh-020',
  'zh:水': 'zh-021',
  'zh:木': 'zh-024',
  'en:three': 'en-word-067',
  'en:blue': 'en-word-060',
  'en:stop': 'en-word-139',
  'en:go': 'en-word-077',
  'en:big': 'en-word-070',
  'en:yellow': 'en-word-061',
  'math:count': 'math-number-sense-1',
  'math:pattern': 'math-pattern-1',
  'math:compare': 'math-comparison-1',
  'math:space': 'math-space-1',
  'math:add': 'math-addition-1',
  'mixed:delivery': 'math-number-sense-1',
  'mixed:direction': 'math-comparison-1',
  'mixed:pattern': 'math-pattern-1',
});

let lastMigrationBackup = null;

export const DEFAULT_PROGRESS = Object.freeze({
  version: 2,
  currentLessonId: null,
  lessons: Object.freeze({}),
  skills: Object.freeze({}),
  honors: Object.freeze([]),
  vehicleUpgrades: Object.freeze([]),
  settings: Object.freeze({ soundEnabled: true }),
  storageAvailable: true,
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNullableTimestamp(value) {
  return value === null || isNonNegativeInteger(value);
}

function isLessonId(value) {
  return typeof value === 'string' && /^lesson-\d{3}$/.test(value);
}

function isLessonRecord(value) {
  return isPlainObject(value)
    && LESSON_STATUSES.has(value.status)
    && isNullableTimestamp(value.viewedAt)
    && isNonNegativeInteger(value.completedCount)
    && isNullableTimestamp(value.lastCompletedAt);
}

function isSkillRecord(value) {
  return isPlainObject(value)
    && isNonNegativeInteger(value.exposures)
    && isNonNegativeInteger(value.independentCorrect)
    && isNonNegativeInteger(value.assistedCorrect)
    && Array.isArray(value.independentLessonIds)
    && value.independentLessonIds.every(isLessonId)
    && isNullableTimestamp(value.firstIndependentAt)
    && isNullableTimestamp(value.lastSeenAt)
    && isNullableTimestamp(value.nextReviewAt)
    && SKILL_STATUSES.has(value.status);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function unique(values) {
  return [...new Set(values)];
}

function cloneLessonRecord(record) {
  return {
    status: record.status,
    viewedAt: record.viewedAt,
    completedCount: record.completedCount,
    lastCompletedAt: record.lastCompletedAt,
  };
}

function cloneSkillRecord(record) {
  return {
    exposures: record.exposures,
    independentCorrect: record.independentCorrect,
    assistedCorrect: record.assistedCorrect,
    independentLessonIds: [...record.independentLessonIds],
    firstIndependentAt: record.firstIndependentAt,
    lastSeenAt: record.lastSeenAt,
    nextReviewAt: record.nextReviewAt,
    status: record.status,
  };
}

export function createProgressV2(overrides = {}) {
  return {
    version: 2,
    currentLessonId: null,
    lessons: {},
    skills: {},
    honors: [],
    vehicleUpgrades: [],
    settings: { soundEnabled: true },
    storageAvailable: true,
    ...overrides,
  };
}

function normalizeV2(value) {
  if (!isPlainObject(value)
    || value.version !== 2
    || !(value.currentLessonId === null || isLessonId(value.currentLessonId))
    || !isPlainObject(value.lessons)
    || !isPlainObject(value.skills)
    || !isStringArray(value.honors)
    || !isStringArray(value.vehicleUpgrades)
    || !isPlainObject(value.settings)
    || typeof value.settings.soundEnabled !== 'boolean'
    || typeof value.storageAvailable !== 'boolean'
    || Object.entries(value.lessons).some(([id, record]) => !isLessonId(id) || !isLessonRecord(record))
    || Object.values(value.skills).some((record) => !isSkillRecord(record))) {
    return null;
  }

  return {
    version: 2,
    currentLessonId: value.currentLessonId,
    lessons: Object.fromEntries(Object.entries(value.lessons).map(([id, record]) => [id, cloneLessonRecord(record)])),
    skills: Object.fromEntries(Object.entries(value.skills).map(([id, record]) => [id, cloneSkillRecord(record)])),
    honors: unique(value.honors),
    vehicleUpgrades: [...value.vehicleUpgrades],
    settings: { soundEnabled: value.settings.soundEnabled },
    storageAvailable: value.storageAvailable,
  };
}

function isLegacySkillRecord(value) {
  return isPlainObject(value)
    && isNonNegativeInteger(value.independentStreak)
    && isNonNegativeInteger(value.helpStreak)
    && (value.masteredAtSession === null || isNonNegativeInteger(value.masteredAtSession));
}

function isLegacyProgress(value) {
  return isPlainObject(value)
    && value.version === 1
    && isNonNegativeInteger(value.sessionsCompleted)
    && isNonNegativeInteger(value.bridgeStage)
    && value.bridgeStage <= 3
    && isPlainObject(value.skills)
    && Object.values(value.skills).every(isLegacySkillRecord);
}

function legacySkillToV2(record) {
  const independentCount = record.independentStreak;
  const completed = record.masteredAtSession !== null;
  const independentLessonIds = completed
    ? ['lesson-001', 'lesson-002', 'lesson-003']
    : Array.from({ length: Math.min(independentCount, 3) }, (_, index) => `lesson-${String(index + 1).padStart(3, '0')}`);
  const migrated = createSkillRecord();
  migrated.exposures = independentCount + record.helpStreak;
  migrated.independentCorrect = independentCount;
  migrated.assistedCorrect = record.helpStreak;
  migrated.independentLessonIds = independentLessonIds;
  migrated.firstIndependentAt = independentLessonIds.length > 0 ? 0 : null;
  migrated.lastSeenAt = completed ? 86400000 : (independentLessonIds.length > 0 ? 0 : null);
  migrated.status = completed ? 'mastered' : (migrated.exposures > 0 ? 'practicing' : 'unseen');
  return migrated;
}

function mergeSkillRecords(left, right) {
  const mastered = left.status === 'mastered' || right.status === 'mastered';
  const firstIndependentAt = [left.firstIndependentAt, right.firstIndependentAt]
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const lastSeenAt = [left.lastSeenAt, right.lastSeenAt]
    .filter((value) => value !== null)
    .sort((a, b) => b - a)[0] ?? null;
  return {
    ...createSkillRecord(),
    exposures: left.exposures + right.exposures,
    independentCorrect: left.independentCorrect + right.independentCorrect,
    assistedCorrect: left.assistedCorrect + right.assistedCorrect,
    independentLessonIds: unique([...left.independentLessonIds, ...right.independentLessonIds]),
    firstIndependentAt,
    lastSeenAt,
    status: mastered ? 'mastered' : 'practicing',
  };
}

export function migrateProgress(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isLegacyProgress(value)) throw new Error('invalid version one progress');

    const progress = createProgressV2({
      currentLessonId: value.sessionsCompleted >= 270
        ? null
        : `lesson-${String(value.sessionsCompleted + 1).padStart(3, '0')}`,
      settings: { soundEnabled: value.soundEnabled !== false },
    });

    for (let index = 1; index <= Math.min(value.sessionsCompleted, 270); index += 1) {
      const id = `lesson-${String(index).padStart(3, '0')}`;
      progress.lessons[id] = {
        status: 'practiced', viewedAt: null, completedCount: 1, lastCompletedAt: null,
      };
    }

    for (const [legacyId, legacyRecord] of Object.entries(value.skills)) {
      const skillId = LEGACY_SKILL_MAP[legacyId];
      if (!skillId) continue;
      const migrated = legacySkillToV2(legacyRecord);
      progress.skills[skillId] = progress.skills[skillId]
        ? mergeSkillRecords(progress.skills[skillId], migrated)
        : migrated;
    }
    return progress;
  } catch {
    if (typeof raw === 'string') lastMigrationBackup = raw;
    return createProgressV2();
  }
}

export function parseProgress(raw) {
  try {
    if (typeof raw !== 'string' || raw.length === 0) return createProgressV2();
    const value = JSON.parse(raw);
    if (value?.version === 1) return migrateProgress(raw);
    const progress = normalizeV2(value);
    if (progress) return progress;
  } catch {
    // Retain the original raw value below so it can be exported by a recovery UI.
  }
  if (typeof raw === 'string') lastMigrationBackup = raw;
  return createProgressV2();
}

export function getMigrationBackup() {
  return lastMigrationBackup;
}

export function serializeProgress(progress) {
  return JSON.stringify(normalizeV2(progress) ?? createProgressV2());
}

function markStorageUnavailable(progress) {
  if (isPlainObject(progress)) progress.storageAvailable = false;
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const v2 = storage?.getItem(STORAGE_KEY);
    if (v2 !== null && v2 !== undefined) return parseProgress(v2);
    return migrateProgress(storage?.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return createProgressV2({ storageAvailable: false });
  }
}

export function saveProgress(storage = globalThis.localStorage, progress) {
  try {
    if (!storage) throw new Error('storage unavailable');
    const value = normalizeV2(progress) ?? createProgressV2();
    value.storageAvailable = true;
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
    if (isPlainObject(progress)) progress.storageAvailable = true;
    return true;
  } catch {
    markStorageUnavailable(progress);
    return false;
  }
}

export function resetProgress(storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function recordLessonViewed(progress, lessonId, now) {
  if (!isLessonId(lessonId) || !isNonNegativeInteger(now)) return progress;
  const base = normalizeV2(progress) ?? createProgressV2();
  const previous = base.lessons[lessonId] ?? {
    status: 'notStarted', viewedAt: null, completedCount: 0, lastCompletedAt: null,
  };
  const status = previous.status === 'notStarted' ? 'viewed' : previous.status;
  return {
    ...base,
    lessons: {
      ...base.lessons,
      [lessonId]: {
        ...previous,
        status,
        viewedAt: previous.viewedAt ?? now,
      },
    },
  };
}

function isActiveLessonSnapshot(value) {
  return isPlainObject(value)
    && isLessonId(value.lessonId)
    && isNonNegativeInteger(value.interactionIndex)
    && Number.isFinite(value.seed);
}

export function saveActiveLesson(storage = globalThis.localStorage, snapshot) {
  try {
    if (!storage || !isActiveLessonSnapshot(snapshot)) return false;
    storage.setItem(ACTIVE_KEY, JSON.stringify({
      lessonId: snapshot.lessonId,
      interactionIndex: snapshot.interactionIndex,
      seed: snapshot.seed,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveLesson(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return isActiveLessonSnapshot(value)
      ? { lessonId: value.lessonId, interactionIndex: value.interactionIndex, seed: value.seed }
      : null;
  } catch {
    return null;
  }
}

export function exportProgress(progress) {
  const value = normalizeV2(progress) ?? createProgressV2();
  return JSON.stringify({ ...value, exportedAt: Date.now() }, null, 2);
}

// Deprecated wrappers keep the shipped v1 UI operable until its callers move to lesson snapshots.
export function saveActiveStage(storage = globalThis.localStorage, state) {
  try {
    if (!storage || !Number.isFinite(state?.seed) || !LEGACY_STAGES.has(state?.stage)) return false;
    storage.setItem(LEGACY_ACTIVE_KEY, JSON.stringify({ version: 1, seed: state.seed, stage: state.stage }));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveStage(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(LEGACY_ACTIVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.version === 1 && Number.isFinite(value.seed) && LEGACY_STAGES.has(value.stage)
      ? { seed: value.seed, stage: value.stage }
      : null;
  } catch {
    return null;
  }
}

export function clearActiveStage(storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.removeItem(LEGACY_ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
}
