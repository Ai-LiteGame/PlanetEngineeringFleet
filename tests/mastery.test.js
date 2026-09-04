import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSkillRecord,
  recordSkillAttempt,
  selectReviewSkills,
  skillStatus,
} from '../src/mastery.js';

const DAY = 86400000;

test('viewing content does not create mastery', () => {
  const record = createSkillRecord();
  assert.equal(skillStatus(record, 1000), 'unseen');
});

test('mastery needs three independent lessons and a successful due review', () => {
  let record = createSkillRecord();
  record = recordSkillAttempt(record, {
    correct: true, assistance: 0, lessonId: 'lesson-001', eventId: 'lesson-001:1', lessonCount: 1,
  }, 1000);
  record = recordSkillAttempt(record, {
    correct: true, assistance: 0, lessonId: 'lesson-004', eventId: 'lesson-004:1', lessonCount: 2,
  }, 1000 + DAY);
  record = recordSkillAttempt(record, {
    correct: true, assistance: 0, lessonId: 'lesson-010', eventId: 'lesson-010:1', lessonCount: 3,
  }, 1000 + (2 * DAY));
  assert.deepEqual(record.successfulDueReviewEventIds, ['lesson-004:1']);
  assert.equal(skillStatus(record, 1000 + (2 * DAY), 3), 'mastered');
});

test('three cross-lesson successes without a due review remain in progress', () => {
  let record = createSkillRecord();
  for (const [index, lessonId] of ['lesson-001', 'lesson-002', 'lesson-003'].entries()) {
    record = recordSkillAttempt(record, {
      correct: true,
      assistance: 0,
      lessonId,
      eventId: `${lessonId}:1`,
    }, 1000);
  }

  assert.deepEqual(record.successfulDueReviewEventIds, []);
  assert.equal(skillStatus(record, 1000, 3), 'practicing');
});

test('multiple correct interactions in one completion advance review only once', () => {
  const base = createSkillRecord();
  const first = recordSkillAttempt(base, {
    correct: true, assistance: 0, lessonId: 'lesson-001', eventId: 'lesson-001:1', lessonCount: 1,
  }, 1000);
  const duplicate = recordSkillAttempt(first, {
    correct: true, assistance: 0, lessonId: 'lesson-001', eventId: 'lesson-001:1', lessonCount: 1,
  }, 2000);

  assert.equal(duplicate.exposures, 2);
  assert.equal(duplicate.independentCorrect, 1);
  assert.deepEqual(duplicate.successfulEventIds, ['lesson-001:1']);
  assert.equal(duplicate.nextReviewAt, first.nextReviewAt);
  assert.equal(duplicate.nextReviewLessonCount, first.nextReviewLessonCount);
});

test('replaying one lesson cannot advance spaced review scheduling', () => {
  let record = createSkillRecord();
  for (let replay = 1; replay <= 5; replay += 1) {
    record = recordSkillAttempt(record, {
      correct: true,
      assistance: 0,
      lessonId: 'lesson-001',
      eventId: `lesson-001:${replay}`,
      lessonCount: replay,
    }, 1000 + replay);
  }

  assert.equal(record.independentCorrect, 1);
  assert.deepEqual(record.independentLessonIds, ['lesson-001']);
  assert.equal(record.successfulEventIds.length, 1);
  assert.deepEqual(record.successfulDueReviewEventIds, []);
  assert.equal(record.nextReviewAt, 1001 + DAY);
  assert.equal(record.nextReviewLessonCount, 2);
});

test('lesson-count fallback makes a review due and records its successful evidence', () => {
  let record = recordSkillAttempt(createSkillRecord(), {
    correct: true, assistance: 0, lessonId: 'lesson-001', eventId: 'lesson-001:1', lessonCount: 4,
  }, 1000);
  assert.equal(record.nextReviewLessonCount, 5);
  assert.equal(skillStatus(record, 2000, 4), 'practicing');
  assert.equal(skillStatus(record, 2000, 5), 'reviewDue');

  record = recordSkillAttempt(record, {
    correct: true, assistance: 0, lessonId: 'lesson-005', eventId: 'lesson-005:1', lessonCount: 5,
  }, 2000);
  assert.deepEqual(record.successfulDueReviewEventIds, ['lesson-005:1']);
  assert.equal(record.nextReviewLessonCount, 8);
  assert.equal(record.nextReviewAt, 2000 + (3 * DAY));
});

test('a later incorrect attempt cannot create the required independent spacing', () => {
  let record = createSkillRecord();
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-001' }, 1000);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-002' }, 1000 + 3600000);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-003' }, 1000 + (2 * 3600000));
  record = recordSkillAttempt(record, { correct: false, assistance: 0, lessonId: 'lesson-004' }, 1000 + DAY);

  assert.equal(skillStatus(record, 1000 + DAY), 'practicing');
});

test('persisted mastered status cannot bypass independent mastery evidence', () => {
  const record = {
    ...createSkillRecord(),
    exposures: 3,
    independentCorrect: 3,
    independentLessonIds: ['lesson-001', 'lesson-002'],
    firstIndependentAt: 1000,
    lastSeenAt: 1000 + DAY,
    status: 'mastered',
  };

  assert.equal(skillStatus(record, 1000 + DAY), 'practicing');
});

test('due and assisted skills sort ahead of mastered maintenance', () => {
  const base = createSkillRecord();
  const progress = {
    skills: {
      'zh:due': { ...base, exposures: 2, status: 'reviewDue', nextReviewAt: 1000 },
      'en:assisted': { ...base, exposures: 2, assistedCorrect: 2, status: 'practicing', nextReviewAt: 3000000000 },
      'math:active': { ...base, exposures: 1, status: 'practicing', nextReviewAt: 3000000000 },
      'zh:known': { ...base, exposures: 5, independentCorrect: 4, status: 'mastered', nextReviewAt: 3000000000 },
    },
  };
  const lesson = { newChineseIds: [], newEnglishWordIds: [], newEnglishPatternIds: [], mathSkillId: null };
  const selected = selectReviewSkills(progress, lesson, 4, 2000000000);
  assert.deepEqual(selected.slice(0, 2).map((item) => item.id), ['zh:due', 'en:assisted']);
});

test('independent successes use increasing review intervals without mutating the source record', () => {
  const base = createSkillRecord();
  const first = recordSkillAttempt(base, {
    correct: true, assistance: 0, lessonId: 'lesson-001', eventId: 'lesson-001:1', lessonCount: 1,
  }, 1000);
  const second = recordSkillAttempt(first, {
    correct: true, assistance: 0, lessonId: 'lesson-002', eventId: 'lesson-002:1', lessonCount: 2,
  }, 2000);

  assert.equal(first.nextReviewAt, 1000 + DAY);
  assert.equal(second.nextReviewAt, 2000 + (3 * DAY));
  assert.deepEqual(base, createSkillRecord());
  assert.notEqual(first, base);
  assert.notEqual(second, first);
});

test('assisted correctness schedules a one-day retry without independent credit', () => {
  const record = recordSkillAttempt(
    createSkillRecord(),
    { correct: true, assistance: 1, lessonId: 'lesson-001' },
    1000,
  );

  assert.deepEqual(record.independentLessonIds, []);
  assert.equal(record.independentCorrect, 0);
  assert.equal(record.assistedCorrect, 1);
  assert.equal(record.nextReviewAt, 1000 + DAY);
  assert.equal(skillStatus(record, 1000), 'practicing');
});

test('a review becomes due at its scheduled time', () => {
  const record = recordSkillAttempt(
    createSkillRecord(),
    { correct: true, assistance: 0, lessonId: 'lesson-001' },
    1000,
  );

  assert.equal(skillStatus(record, 1000 + DAY - 1), 'practicing');
  assert.equal(skillStatus(record, 1000 + DAY), 'reviewDue');
});

test('mastered skills become due for their scheduled maintenance review', () => {
  let record = createSkillRecord();
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-001' }, 1000);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-002' }, 1000 + DAY);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-003' }, 1000 + (2 * DAY));

  assert.equal(skillStatus(record, record.nextReviewAt), 'reviewDue');
});

test('review selection excludes skills introduced by the current lesson and is stable', () => {
  const base = createSkillRecord();
  const progress = {
    skills: {
      'zh:zebra': { ...base, exposures: 1, nextReviewAt: 1000 },
      'zh:apple': { ...base, exposures: 1, nextReviewAt: 1000 },
      'en:new-word': { ...base, exposures: 2, nextReviewAt: 1000 },
      'en:new-pattern': { ...base, exposures: 2, nextReviewAt: 1000 },
      'math:new': { ...base, exposures: 2, nextReviewAt: 1000 },
    },
  };
  const lesson = {
    newChineseIds: [],
    newEnglishWordIds: ['en:new-word'],
    newEnglishPatternIds: ['en:new-pattern'],
    mathSkillId: 'math:new',
  };
  const originalSkills = structuredClone(progress.skills);

  const selected = selectReviewSkills(progress, lesson, 4, 2000);

  assert.deepEqual(selected.map((item) => item.id), ['zh:apple', 'zh:zebra']);
  assert.deepEqual(progress.skills, originalSkills);
});
