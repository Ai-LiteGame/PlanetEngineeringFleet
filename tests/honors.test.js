import test from 'node:test';
import assert from 'node:assert/strict';

import { LESSONS, PROJECTS, REGIONS } from '../src/curriculum/index.js';
import { advance, commitLessonCompletion, createLessonState, submitAnswer } from '../src/game-core.js';
import {
  STAGE_HONOR_MILESTONES,
  VEHICLE_UPGRADE_MILESTONES,
  awardLessonCompletion,
  regionMedal,
  vehicleUnlocks,
} from '../src/honors.js';
import { ACTIVE_KEY, STORAGE_KEY, createProgressV2, saveActiveLesson } from '../src/storage.js';
import { renderGarage } from '../src/views/garage-view.js';

const badgeIds = (count) => PROJECTS.slice(0, count).map((project) => `badge:${project.id}`);

function regionSkillIds(regionId) {
  const projectIds = new Set(
    PROJECTS.filter((project) => project.regionId === regionId).map((project) => project.id),
  );
  return [...new Set(LESSONS
    .filter((lesson) => projectIds.has(lesson.projectId))
    .flatMap((lesson) => [
      ...lesson.newChineseIds,
      ...lesson.newEnglishWordIds,
      ...lesson.newEnglishPatternIds,
      lesson.mathSkillId,
    ])
    .filter(Boolean))];
}

function masteredSkills(skillIds) {
  return Object.fromEntries(skillIds.map((id) => [id, { status: 'mastered' }]));
}

function completedLessonState(lessonId, progress) {
  let state = createLessonState(lessonId, progress, 17, 1000);
  while (!state.completed) {
    state = submitAnswer(state, state.interactions[state.interactionIndex].answerId).state;
    state = advance(state);
  }
  return state;
}

function trackedStorage() {
  const values = new Map();
  const events = [];
  return {
    events,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      values.set(key, String(value));
      events.push({ type: 'set', key, value: String(value) });
    },
    removeItem(key) {
      values.delete(key);
      events.push({ type: 'remove', key });
    },
  };
}

test('project badge is awarded once after its review lesson despite errors', () => {
  const progress = createProgressV2({
    lessons: {
      'lesson-003': {
        status: 'practiced', viewedAt: 1000, completedCount: 1, lastCompletedAt: 2000, hintCount: 12,
      },
    },
  });
  const reviewLesson = { id: 'lesson-003', projectId: 'project-001', phase: 'review' };

  const once = awardLessonCompletion(progress, reviewLesson, {});
  const twice = awardLessonCompletion(once, reviewLesson, {});

  assert.deepEqual(once.honors, ['badge:project-001']);
  assert.deepEqual(twice.honors, once.honors);
  assert.deepEqual(progress.honors, []);
});

test('non-review lessons do not award a project badge', () => {
  const progress = createProgressV2();
  const result = awardLessonCompletion(
    progress,
    { id: 'lesson-001', projectId: 'project-001', phase: 'learn' },
    {},
  );

  assert.equal(result, progress);
});

test('regional medals require all projects and use mastery evidence thresholds', () => {
  const regionId = 'sunny-town';
  const projects = PROJECTS.filter((project) => project.regionId === regionId);
  const skills = regionSkillIds(regionId);
  const completedHonors = projects.map((project) => `badge:${project.id}`);
  const sixtyPercent = Math.ceil(skills.length * 0.6);
  const overEightyFivePercent = Math.floor(skills.length * 0.85) + 1;

  assert.equal(regionMedal({ honors: completedHonors.slice(1), skills: masteredSkills(skills) }, regionId), null);
  assert.equal(regionMedal({ honors: completedHonors, skills: {} }, regionId), 'bronze');
  assert.equal(regionMedal({
    honors: completedHonors,
    skills: masteredSkills(skills.slice(0, sixtyPercent)),
  }, regionId), 'silver');
  assert.equal(regionMedal({
    honors: completedHonors,
    skills: masteredSkills(skills.slice(0, Math.floor(skills.length * 0.85))),
  }, regionId), 'silver');
  assert.equal(regionMedal({
    honors: completedHonors,
    skills: masteredSkills(skills.slice(0, overEightyFivePercent)),
  }, regionId), 'gold');
});

test('vehicle upgrades unlock cumulatively at the exact project milestones', () => {
  assert.deepEqual(
    VEHICLE_UPGRADE_MILESTONES.map(({ threshold, label }) => [threshold, label]),
    [
      [3, '工作灯'],
      [9, '车身贴纸'],
      [18, '安全旗'],
      [30, '强化轮胎'],
      [45, '新涂装'],
      [60, '工具箱'],
      [75, '区域纪念章'],
      [90, '总工程师冠灯'],
    ],
  );
  assert.deepEqual(vehicleUnlocks({ honors: badgeIds(2) }), []);
  assert.deepEqual(
    vehicleUnlocks({ honors: badgeIds(30) }),
    VEHICLE_UPGRADE_MILESTONES.slice(0, 4).map(({ id }) => id),
  );
  assert.deepEqual(
    vehicleUnlocks({ honors: [...badgeIds(90), 'badge:project-090'] }),
    VEHICLE_UPGRADE_MILESTONES.map(({ id }) => id),
  );
});

test('stage honors unlock once at projects 30, 60 and 90', () => {
  assert.deepEqual(
    STAGE_HONOR_MILESTONES.map(({ threshold, label }) => [threshold, label]),
    [
      [30, '大班小工程师'],
      [60, '幼小衔接工程师'],
      [90, '星球总工程师'],
    ],
  );
  const reviewLesson = { id: 'lesson-090', projectId: 'project-030', phase: 'review' };
  const before = createProgressV2({ honors: badgeIds(29) });
  const once = awardLessonCompletion(before, reviewLesson, {});
  const twice = awardLessonCompletion(once, reviewLesson, {});

  assert.deepEqual(
    once.honors,
    [...badgeIds(29), 'badge:project-030', STAGE_HONOR_MILESTONES[0].id],
  );
  assert.deepEqual(once.vehicleUpgrades, VEHICLE_UPGRADE_MILESTONES.slice(0, 4).map(({ id }) => id));
  assert.deepEqual(twice, once);
});

test('award normalization removes duplicate honor and upgrade IDs', () => {
  const stageHonorId = STAGE_HONOR_MILESTONES[0].id;
  const upgradeId = VEHICLE_UPGRADE_MILESTONES[0].id;
  const unlockedUpgradeIds = VEHICLE_UPGRADE_MILESTONES.slice(0, 4).map(({ id }) => id);
  const progress = createProgressV2({
    honors: [...badgeIds(30), stageHonorId, stageHonorId],
    vehicleUpgrades: [...unlockedUpgradeIds, upgradeId],
  });

  const result = awardLessonCompletion(
    progress,
    { id: 'lesson-090', projectId: 'project-030', phase: 'review' },
    {},
  );

  assert.equal(result.honors.filter((id) => id === stageHonorId).length, 1);
  assert.equal(result.vehicleUpgrades.filter((id) => id === upgradeId).length, 1);
});

test('completion commit persists awards before clearing the active lesson snapshot', () => {
  const storage = trackedStorage();
  const startingProgress = createProgressV2();
  const state = completedLessonState('lesson-003', startingProgress);
  saveActiveLesson(storage, { lessonId: state.lessonId, interactionIndex: 0, seed: state.seed });
  storage.events.length = 0;

  const progress = commitLessonCompletion(state, startingProgress, storage, 5000);

  assert.deepEqual(progress.honors, ['badge:project-001']);
  assert.equal(storage.events[0].type, 'set');
  assert.equal(storage.events[0].key, STORAGE_KEY);
  assert.match(storage.events[0].value, /badge:project-001/);
  assert.deepEqual(storage.events[1], { type: 'remove', key: ACTIVE_KEY });
});

test('garage renders fleet SVGs, earned honors and color swatches without commerce', () => {
  const html = renderGarage({
    vehicleIds: ['excavator', 'fire-truck'],
    completedProjectCount: 30,
    vehicleUpgrades: VEHICLE_UPGRADE_MILESTONES.slice(0, 4).map(({ id }) => id),
    stageHonorIds: [STAGE_HONOR_MILESTONES[0].id],
    regionMedals: REGIONS.map((region, index) => ({
      regionId: region.id,
      title: region.title,
      medal: index === 0 ? 'silver' : null,
    })),
    soundEnabled: true,
  });

  assert.match(html, /data-view="garage"/);
  assert.match(html, /data-action="close-garage"/);
  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /<section class="garage-main"[^>]*aria-labelledby="garage-title"/);
  assert.match(html, /assets\/construction-fleet\.svg#excavator/);
  assert.match(html, /assets\/construction-fleet\.svg#fire-engine/);
  assert.match(html, /大班小工程师/);
  assert.match(html, /工作灯/);
  assert.match(html, /车身贴纸/);
  assert.match(html, /class="garage-swatch/);
  assert.doesNotMatch(html, /金币|货币|价格|购买|商店|排行榜/);
});
