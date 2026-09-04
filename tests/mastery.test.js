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

test('mastery needs three independent lessons and a spaced review', () => {
  let record = createSkillRecord();
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-001' }, 1000);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-004' }, 400000000);
  record = recordSkillAttempt(record, { correct: true, assistance: 0, lessonId: 'lesson-010' }, 1000000000);
  assert.equal(skillStatus(record, 1000000000), 'mastered');
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
  const first = recordSkillAttempt(base, { correct: true, assistance: 0, lessonId: 'lesson-001' }, 1000);
  const second = recordSkillAttempt(first, { correct: true, assistance: 0, lessonId: 'lesson-002' }, 2000);

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
