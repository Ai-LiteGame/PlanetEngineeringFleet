import test from 'node:test';
import assert from 'node:assert/strict';

import { LESSONS } from '../src/curriculum/index.js';
import {
  buildCourseRows,
  courseSummary,
  filterCourseRows,
  focusCourseRows,
} from '../src/course-table.js';
import { createSkillRecord, recordSkillAttempt } from '../src/mastery.js';
import { renderCourseTable } from '../src/views/course-table-view.js';

const DAY = 86400000;

const lessonRecord = (status, overrides = {}) => ({
  status,
  viewedAt: null,
  completedCount: 0,
  lastCompletedAt: null,
  hintCount: 0,
  ...overrides,
});

function masteredSkillRecord() {
  return [
    ['lesson-001', 0],
    ['lesson-002', DAY],
    ['lesson-003', DAY * 2],
  ].reduce((record, [lessonId, now]) => recordSkillAttempt(record, {
    correct: true,
    assistance: 0,
    lessonId,
  }, now), createSkillRecord());
}

test('course rows expose viewed and not-started states in stable lesson order', () => {
  const lessons = [LESSONS[1], LESSONS[0]];
  const progress = {
    lessons: {
      [LESSONS[0].id]: lessonRecord('viewed', { viewedAt: 1000 }),
    },
    skills: {},
  };

  const rows = buildCourseRows(lessons, progress);

  assert.deepEqual(rows.map((row) => row.id), ['lesson-001', 'lesson-002']);
  assert.equal(rows[0].status, 'viewed');
  assert.equal(rows[1].status, 'notStarted');
  assert.equal(rows[0].regionId, 'sunny-town');
  assert.equal(rows[0].regionTitle, '阳光工程镇');
  assert.equal(rows[0].estimatedMinutes, '8–12');
});

test('course rows derive mastered and review-due states from current skill evidence', () => {
  const lesson = LESSONS[0];
  const skillIds = [
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
    lesson.mathSkillId,
  ];
  const skills = Object.fromEntries(skillIds.map((id) => [id, masteredSkillRecord()]));
  const dueAt = skills[skillIds[0]].nextReviewAt;
  const progress = {
    lessons: {
      [lesson.id]: lessonRecord('practiced', {
        viewedAt: 1000,
        completedCount: 1,
        lastCompletedAt: 5000,
      }),
    },
    skills,
  };

  assert.equal(buildCourseRows([lesson], progress, dueAt - 1)[0].status, 'mastered');
  assert.equal(buildCourseRows([lesson], progress, dueAt)[0].status, 'reviewDue');
});

test('recent repeated hints make a completed lesson review due at exact boundaries', () => {
  const lesson = LESSONS[0];
  const now = DAY * 20;
  const rowStatus = (recentHintTimestamps, hintCount = recentHintTimestamps.length) => (
    buildCourseRows([lesson], {
      lessons: {
        [lesson.id]: lessonRecord('practiced', {
          viewedAt: 1000,
          completedCount: 1,
          lastCompletedAt: now,
          hintCount,
          recentHintTimestamps,
        }),
      },
      skills: {},
    }, now)[0].status
  );

  assert.equal(rowStatus([now - (7 * DAY), now - (7 * DAY)]), 'reviewDue');
  assert.equal(rowStatus([now - (7 * DAY)]), 'practiced');
  assert.equal(rowStatus([now - (7 * DAY) - 1, now - (7 * DAY) - 1]), 'practiced');
  assert.equal(rowStatus([], 99), 'practiced', 'lifetime hints alone are not recent evidence');
});

test('stored mastery labels cannot bypass current lesson and skill evidence', () => {
  const lesson = LESSONS[0];
  const completed = {
    lessons: {
      [lesson.id]: lessonRecord('mastered', {
        viewedAt: 1000,
        completedCount: 1,
        lastCompletedAt: 2000,
      }),
    },
    skills: {},
  };
  const viewed = {
    lessons: {
      [lesson.id]: lessonRecord('reviewDue', { viewedAt: 1000 }),
    },
    skills: {},
  };

  assert.equal(buildCourseRows([lesson], completed, 3000)[0].status, 'practiced');
  assert.equal(buildCourseRows([lesson], viewed, 3000)[0].status, 'viewed');
});

test('course rows resolve mixed targets and keep hint totals scoped to each lesson', () => {
  const [earlierLesson, laterLesson] = LESSONS;
  const assistedSkillId = earlierLesson.newChineseIds[0];
  const assistedSkill = recordSkillAttempt(createSkillRecord(), {
    correct: true,
    assistance: 1,
    lessonId: laterLesson.id,
  }, 4000);
  const progress = {
    lessons: {
      [earlierLesson.id]: lessonRecord('practiced', {
        viewedAt: 1000,
        completedCount: 2,
        lastCompletedAt: 5000,
        hintCount: 3,
      }),
      [laterLesson.id]: lessonRecord('practiced', {
        viewedAt: 2000,
        completedCount: 1,
        lastCompletedAt: 6000,
        hintCount: 7,
      }),
    },
    skills: { [assistedSkillId]: assistedSkill },
  };

  const [earlierRow, laterRow] = buildCourseRows(
    [earlierLesson, laterLesson],
    progress,
    5000,
  );

  assert.equal(earlierRow.chinese.length > 0, true);
  assert.equal(earlierRow.englishWords.length > 0, true);
  assert.equal(earlierRow.englishPatterns.length > 0, true);
  assert.match(earlierRow.mathTarget, /0–10/);
  assert.deepEqual(earlierRow.subjects, ['chinese', 'english', 'math']);
  assert.equal(earlierRow.hintCount, 3);
  assert.equal(earlierRow.completedCount, 2);
  assert.equal(laterRow.hintCount, 7);
});

test('isolated review rows still expose their mixed project content', () => {
  const [row] = buildCourseRows([LESSONS[2]], { lessons: {}, skills: {} });

  assert.deepEqual(row.subjects, ['chinese', 'english', 'math']);
  assert.equal(row.chinese.length > 0, true);
  assert.equal(row.englishWords.length > 0, true);
  assert.equal(row.englishPatterns.length > 0, true);
});

test('filters combine tier, region and status while subject focus filters mixed rows', () => {
  const rows = [
    { id: 'lesson-100', tier: 2, subjects: ['english'], regionId: 'harbor-island', status: 'reviewDue' },
    { id: 'lesson-101', tier: 2, subjects: ['math'], regionId: 'harbor-island', status: 'reviewDue' },
    { id: 'lesson-200', tier: 3, subjects: ['english'], regionId: 'future-shanghai', status: 'mastered' },
  ];
  const result = filterCourseRows(rows, {
    tier: 2,
    subject: 'english',
    regionId: 'harbor-island',
    status: 'reviewDue',
  });

  assert.deepEqual(result.map((row) => row.id), ['lesson-100', 'lesson-101']);
  assert.deepEqual(focusCourseRows(result, 'english').map((row) => row.id), ['lesson-100']);
  assert.deepEqual(focusCourseRows(result, 'math').map((row) => row.id), ['lesson-101']);
  assert.deepEqual(focusCourseRows(result, 'all'), result);
});

test('course summary counts five statuses and unique subject coverage', () => {
  const rows = [
    {
      status: 'notStarted', chineseIds: ['zh-001'], englishWordIds: ['en-word-001'],
      englishPatternIds: [], mathSkillId: 'math-a',
    },
    {
      status: 'viewed', chineseIds: ['zh-001', 'zh-002'], englishWordIds: [],
      englishPatternIds: ['en-pattern-001'], mathSkillId: 'math-b',
    },
    {
      status: 'practiced', chineseIds: [], englishWordIds: ['en-word-001'],
      englishPatternIds: [], mathSkillId: 'math-a',
    },
    { status: 'reviewDue', chineseIds: [], englishWordIds: [], englishPatternIds: [], mathSkillId: null },
    { status: 'mastered', chineseIds: [], englishWordIds: [], englishPatternIds: [], mathSkillId: null },
  ];

  assert.deepEqual(courseSummary(rows), {
    total: 5,
    statuses: { notStarted: 1, viewed: 1, practiced: 1, reviewDue: 1, mastered: 1 },
    subjects: { chinese: 2, english: 2, math: 2 },
  });
});

test('course table renders filters, status labels, focused subject column and escaped values', () => {
  const row = {
    id: 'lesson-001', ordinal: 1, title: '<img src=x onerror=alert(1)>', tier: 1,
    regionId: 'sunny-town', regionTitle: '阳光工程镇', phase: 'learn',
    chineseIds: ['zh-001'], chinese: ['人·大人'], englishWordIds: ['en-word-001'],
    englishWords: ['hello·你好'], englishPatternIds: ['en-pattern-001'],
    englishPatterns: ['<b>Hello!</b>'], mathSkillId: 'math-number-sense-1',
    mathTarget: '数感 0–10', estimatedMinutes: '8–12', viewedAt: 1000,
    completedCount: 1, lastCompletedAt: 5000, hintCount: 2,
    status: 'reviewDue', subjects: ['chinese', 'english', 'math'],
  };
  const html = renderCourseTable({
    rows: [row],
    summary: courseSummary([row]),
    filters: { tier: 1, subject: 'english', regionId: 'sunny-town', status: 'reviewDue' },
    regions: [{ id: 'sunny-town', title: '阳光工程镇' }],
    storageAvailable: false,
  });

  for (const label of ['未开始', '已看过', '已练习', '待复习', '已掌握']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /data-course-filter="subject"/);
  assert.match(html, /data-course-subject="english"[^>]*is-focused|is-focused[^>]*data-course-subject="english"/);
  assert.match(html, /本次记录不会保存/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;Hello!&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<b>Hello!<\/b>/);
});
