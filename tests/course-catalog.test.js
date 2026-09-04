import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHINESE_ITEMS,
  ENGLISH_PATTERNS,
  ENGLISH_WORDS,
  LESSONS,
  PROJECTS,
  REGIONS,
  getLesson,
  getLessonsForProject,
  getProject,
  getStageForLesson,
} from '../src/curriculum/index.js';

test('catalog contains six regions, ninety projects and 270 lessons', () => {
  assert.equal(REGIONS.length, 6);
  assert.equal(PROJECTS.length, 90);
  assert.equal(LESSONS.length, 270);
  assert.equal(new Set(LESSONS.map((lesson) => lesson.id)).size, 270);
});

test('regions supply fifteen visual projects and their usable vehicles', () => {
  assert.deepEqual(REGIONS.map((region) => region.id), [
    'sunny-town',
    'forest-valley',
    'harbor-island',
    'undersea-city',
    'snow-airport',
    'future-shanghai',
  ]);
  for (const region of REGIONS) {
    assert.equal(region.projectTitles.length, 15);
    assert.equal(new Set(region.projectTitles).size, 15);
    assert.equal(region.vehicles.length > 0, true);
    assert.equal(typeof region.theme, 'string');
  }
});

test('projects assign global ordinals, tier boundaries, and regional vehicles', () => {
  for (const project of PROJECTS) {
    const region = REGIONS.find((item) => item.id === project.regionId);
    const expectedTier = project.ordinal <= 30 ? 1 : project.ordinal <= 60 ? 2 : 3;
    assert.equal(project.tier, expectedTier);
    assert.equal(region.vehicles.includes(project.vehicle), true);
    assert.equal(typeof project.outcome, 'string');
  }
  assert.deepEqual(PROJECTS.map((project) => project.ordinal), Array.from({ length: 90 }, (_, index) => index + 1));
});

test('every project has learn, build and review lessons', () => {
  for (const project of PROJECTS) {
    assert.deepEqual(
      getLessonsForProject(project.id).map((lesson) => lesson.phase),
      ['learn', 'build', 'review'],
    );
  }
});

test('lesson content stays within its tier', () => {
  const fiveCharacterLessonsByTier = new Map([[2, 0], [3, 0]]);
  for (const lesson of LESSONS) {
    if (lesson.phase === 'review') {
      assert.equal(lesson.newChineseIds.length, 0);
      assert.equal(lesson.newEnglishWordIds.length, 0);
      assert.equal(lesson.newEnglishPatternIds.length, 0);
    } else {
      const maximumChineseCount = lesson.tier === 1 ? 4 : 5;
      assert.equal(lesson.newChineseIds.length >= 3 && lesson.newChineseIds.length <= maximumChineseCount, true);
      assert.equal(lesson.newEnglishWordIds.length >= 1 && lesson.newEnglishWordIds.length <= 2, true);
      if (lesson.newChineseIds.length === 5) {
        fiveCharacterLessonsByTier.set(lesson.tier, fiveCharacterLessonsByTier.get(lesson.tier) + 1);
      }
    }
    assert.equal([1, 2, 3].includes(lesson.tier), true);
  }
  assert.deepEqual(Object.fromEntries(fiveCharacterLessonsByTier), { 2: 10, 3: 10 });
});

test('new inventory content is introduced once and only in its own tier', () => {
  const inventoryById = new Map([
    ...CHINESE_ITEMS,
    ...ENGLISH_WORDS,
    ...ENGLISH_PATTERNS,
  ].map((item) => [item.id, item]));
  const introducedIds = LESSONS.flatMap((lesson) => [
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
  ]);

  assert.equal(introducedIds.length, 1100);
  assert.equal(new Set(introducedIds).size, 1100);
  assert.deepEqual(new Set(introducedIds), new Set(inventoryById.keys()));
  for (const lesson of LESSONS) {
    for (const id of [
      ...lesson.newChineseIds,
      ...lesson.newEnglishWordIds,
      ...lesson.newEnglishPatternIds,
    ]) {
      assert.equal(inventoryById.get(id).tier, lesson.tier);
    }
  }
});

test('catalog lookup helpers return matching records and tier stages', () => {
  const project = PROJECTS[30];
  const lesson = LESSONS[90];
  assert.equal(getProject(project.id), project);
  assert.equal(getProject('project-999'), null);
  assert.equal(getLesson(lesson.id), lesson);
  assert.equal(getLesson('lesson-999'), null);
  assert.equal(getStageForLesson(lesson.id), lesson.tier);
  assert.equal(getStageForLesson('lesson-999'), null);
});
