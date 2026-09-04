const DAY = 86400000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

export function createSkillRecord() {
  return {
    exposures: 0,
    independentCorrect: 0,
    assistedCorrect: 0,
    independentLessonIds: [],
    successfulEventIds: [],
    successfulDueReviewEventIds: [],
    firstIndependentAt: null,
    firstIndependentLessonCount: null,
    lastSeenAt: null,
    lastSeenLessonCount: null,
    nextReviewAt: null,
    nextReviewLessonCount: null,
    status: 'unseen',
  };
}

function isIndependentCorrect(attempt) {
  return attempt.correct && attempt.assistance === 0;
}

function isMastered(record) {
  const timeSpaced = record.firstIndependentAt !== null
    && record.lastSeenAt !== null
    && record.lastSeenAt - record.firstIndependentAt >= DAY;
  const lessonSpaced = record.firstIndependentLessonCount !== null
    && record.lastSeenLessonCount !== null
    && record.lastSeenLessonCount > record.firstIndependentLessonCount;
  return (record.independentLessonIds?.length ?? 0) >= 3
    && (record.successfulDueReviewEventIds?.length ?? 0) > 0
    && (timeSpaced || lessonSpaced);
}

function isReviewDue(record, now, lessonCount) {
  const dateDue = record.nextReviewAt !== null && now >= record.nextReviewAt;
  const lessonDue = Number.isInteger(lessonCount)
    && record.nextReviewLessonCount !== null
    && lessonCount >= record.nextReviewLessonCount;
  return dateDue || lessonDue;
}

export function skillStatus(record, now, lessonCount = null) {
  if (record.exposures === 0) return 'unseen';
  if (isReviewDue(record, now, lessonCount)) return 'reviewDue';
  if (isMastered(record)) return 'mastered';
  return 'practicing';
}

export function recordSkillAttempt(record, attempt, now) {
  const lessonCount = Number.isInteger(attempt.lessonCount) ? attempt.lessonCount : null;
  const eventId = typeof attempt.eventId === 'string' && attempt.eventId.length > 0
    ? attempt.eventId
    : attempt.lessonId;
  const successfulEventIds = [...(record.successfulEventIds ?? [])];
  const successfulDueReviewEventIds = [...(record.successfulDueReviewEventIds ?? [])];
  const isNewSuccessfulEvent = !successfulEventIds.includes(eventId);
  const wasDue = isReviewDue(record, now, lessonCount);
  const next = {
    ...record,
    independentLessonIds: [...(record.independentLessonIds ?? [])],
    successfulEventIds,
    successfulDueReviewEventIds,
    firstIndependentLessonCount: record.firstIndependentLessonCount ?? null,
    lastSeenLessonCount: record.lastSeenLessonCount ?? null,
    nextReviewLessonCount: record.nextReviewLessonCount ?? null,
    exposures: record.exposures + 1,
  };

  if (isIndependentCorrect(attempt) && isNewSuccessfulEvent) {
    successfulEventIds.push(eventId);
    next.lastSeenAt = now;
    next.lastSeenLessonCount = lessonCount;
    next.independentCorrect += 1;
    if (!next.independentLessonIds.includes(attempt.lessonId)) {
      next.independentLessonIds.push(attempt.lessonId);
    }
    if (next.firstIndependentAt === null) next.firstIndependentAt = now;
    if (next.firstIndependentLessonCount === null) next.firstIndependentLessonCount = lessonCount;
    if (wasDue) successfulDueReviewEventIds.push(eventId);
    const reviewIndex = Math.min(successfulEventIds.length, REVIEW_DAYS.length) - 1;
    next.nextReviewAt = now + (REVIEW_DAYS[reviewIndex] * DAY);
    next.nextReviewLessonCount = lessonCount === null
      ? next.nextReviewLessonCount
      : lessonCount + REVIEW_DAYS[reviewIndex];
  } else if (attempt.correct && isNewSuccessfulEvent) {
    successfulEventIds.push(eventId);
    next.assistedCorrect += 1;
    next.lastSeenAt = now;
    next.lastSeenLessonCount = lessonCount;
    next.nextReviewAt = now + DAY;
    next.nextReviewLessonCount = lessonCount === null ? next.nextReviewLessonCount : lessonCount + 1;
  }

  next.status = skillStatus(next, now, lessonCount);
  return next;
}

function currentLessonSkillIds(lesson) {
  return new Set([
    ...(lesson?.newChineseIds ?? []),
    ...(lesson?.newEnglishWordIds ?? []),
    ...(lesson?.newEnglishPatternIds ?? []),
    lesson?.mathSkillId,
  ].filter(Boolean));
}

function priorityFor(record, now, lessonCount) {
  const status = skillStatus(record, now, lessonCount);
  if (status === 'reviewDue') return 0;
  if (record.assistedCorrect > 0) return 1;
  if (status === 'practicing') return 2;
  return 3;
}

function compareSkillIds(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function selectReviewSkills(progress, lesson, limit, now) {
  const excludedIds = currentLessonSkillIds(lesson);
  const lessonCount = Array.isArray(progress?.completionIds) ? progress.completionIds.length : null;
  return Object.entries(progress?.skills ?? {})
    .filter(([id]) => !excludedIds.has(id))
    .map(([id, record]) => ({ id, ...record, status: skillStatus(record, now, lessonCount) }))
    .sort((left, right) => (
      priorityFor(left, now, lessonCount) - priorityFor(right, now, lessonCount)
      || (left.nextReviewAt ?? Infinity) - (right.nextReviewAt ?? Infinity)
      || compareSkillIds(left.id, right.id)
    ))
    .slice(0, limit);
}
