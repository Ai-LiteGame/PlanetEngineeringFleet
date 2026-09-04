const DAY = 86400000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

export function createSkillRecord() {
  return {
    exposures: 0,
    independentCorrect: 0,
    assistedCorrect: 0,
    independentLessonIds: [],
    firstIndependentAt: null,
    lastSeenAt: null,
    nextReviewAt: null,
    status: 'unseen',
  };
}

function isIndependentCorrect(attempt) {
  return attempt.correct && attempt.assistance === 0;
}

function isMastered(record) {
  return record.independentLessonIds.length >= 3
    && record.firstIndependentAt !== null
    && record.lastSeenAt - record.firstIndependentAt >= DAY;
}

export function skillStatus(record, now) {
  if (record.exposures === 0) return 'unseen';
  if (record.nextReviewAt !== null && now >= record.nextReviewAt) return 'reviewDue';
  if (isMastered(record)) return 'mastered';
  return 'practicing';
}

export function recordSkillAttempt(record, attempt, now) {
  const next = {
    ...record,
    independentLessonIds: [...record.independentLessonIds],
    exposures: record.exposures + 1,
  };

  if (isIndependentCorrect(attempt)) {
    next.lastSeenAt = now;
    next.independentCorrect += 1;
    if (!next.independentLessonIds.includes(attempt.lessonId)) {
      next.independentLessonIds.push(attempt.lessonId);
    }
    if (next.firstIndependentAt === null) next.firstIndependentAt = now;
    const reviewIndex = Math.min(next.independentCorrect, REVIEW_DAYS.length) - 1;
    next.nextReviewAt = now + (REVIEW_DAYS[reviewIndex] * DAY);
  } else if (attempt.correct) {
    next.assistedCorrect += 1;
    next.nextReviewAt = now + DAY;
  }

  next.status = skillStatus(next, now);
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

function priorityFor(record, now) {
  const status = skillStatus(record, now);
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
  return Object.entries(progress?.skills ?? {})
    .filter(([id]) => !excludedIds.has(id))
    .map(([id, record]) => ({ id, ...record, status: skillStatus(record, now) }))
    .sort((left, right) => (
      priorityFor(left, now) - priorityFor(right, now)
      || (left.nextReviewAt ?? Infinity) - (right.nextReviewAt ?? Infinity)
      || compareSkillIds(left.id, right.id)
    ))
    .slice(0, limit);
}
