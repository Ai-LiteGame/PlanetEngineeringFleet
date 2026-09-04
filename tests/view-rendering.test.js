import test from 'node:test';
import assert from 'node:assert/strict';

import { LESSONS, PROJECTS, REGIONS } from '../src/curriculum/index.js';
import { createLessonState } from '../src/game-core.js';
import { getSceneState } from '../src/scene-model.js';
import { createProgressV2 } from '../src/storage.js';
import { renderCompletion } from '../src/views/completion-view.js';
import { renderLesson } from '../src/views/lesson-view.js';
import { renderMap } from '../src/views/map-view.js';

const firstLessonState = (seed = 2) => createLessonState(
  'lesson-001',
  createProgressV2(),
  seed,
  1000,
);

test('map exposes one primary continue action and all region landmarks', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-001',
    currentLessonId: 'lesson-001',
    completedProjectIds: [],
  });

  assert.equal((html.match(/data-action="continue-course"/g) ?? []).length, 1);
  assert.match(html, /data-current-lesson="lesson-001"/);
  assert.match(html, /assets\/construction-fleet\.svg#excavator/);
  for (const region of REGIONS) {
    assert.match(html, new RegExp(`data-region="${region.id}"`));
    assert.match(html, new RegExp(`assets/region-scenes\\.svg#${region.id}`));
  }
});

test('map makes completed projects replayable and leaves future projects locked', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-003',
    currentLessonId: 'lesson-007',
    completedProjectIds: ['project-001', 'project-002'],
  });

  assert.match(html, /data-action="open-project" data-project="project-001"/);
  assert.match(html, /data-project="project-002"/);
  assert.match(html, /data-project="project-003"[^>]*aria-current="step"/);
  assert.match(html, /data-project="project-004"[^>]*aria-disabled="true"/);
});

test('map has an asset-free recovery state with a retry action', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-001',
    currentLessonId: 'lesson-001',
    completedProjectIds: [],
    assetsAvailable: false,
    errorMessage: '工程场景暂时未加载',
  });

  assert.match(html, /data-action="retry-assets"/);
  assert.doesNotMatch(html, /<use[^>]+href="assets\//);
  for (const region of REGIONS) assert.match(html, new RegExp(`data-region="${region.id}"`));
});

test('lesson view renders speech, answers and a stable layered scene', () => {
  const state = firstLessonState();
  const interaction = state.interactions[0];
  const html = renderLesson({
    lesson: LESSONS[0],
    interaction,
    interactionIndex: 0,
    interactionTotal: 12,
    scene: getSceneState('sunny-town', 1, interaction, ['project-001', 'project-002']),
    hintLevel: 0,
    answered: false,
    repeatState: 'ready',
  });

  assert.match(html, /data-action="repeat-speech"/);
  assert.match(html, /data-answer=/);
  assert.match(html, /class="world-scene/);
  assert.match(html, /viewBox="0 0 320 180"/);
  assert.match(html, /assets\/region-scenes\.svg#sunny-town/);
  assert.match(html, /assets\/region-scenes\.svg#sunny-town-upgrade-1/);
  assert.match(html, /assets\/construction-fleet\.svg#excavator/);
});

test('English interaction uses a three-second no-recording gate before choices', () => {
  const state = firstLessonState();
  const interaction = state.interactions.find((item) => item.subject === 'english');
  const model = {
    lesson: LESSONS[0],
    interaction,
    interactionIndex: state.interactions.indexOf(interaction),
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, interaction, []),
    hintLevel: 0,
    answered: false,
  };

  const speaking = renderLesson({ ...model, repeatState: 'speaking' });
  assert.match(speaking, /3 秒/);
  assert.match(speaking, /不会录音/);
  assert.doesNotMatch(speaking, /data-answer=/);

  const ready = renderLesson({ ...model, repeatState: 'ready' });
  assert.match(ready, /data-answer=/);
});

test('third hint demonstrates without auto-submitting and answered view locks choices', () => {
  const state = firstLessonState();
  const interaction = state.interactions[0];
  const base = {
    lesson: LESSONS[0],
    interaction,
    interactionIndex: 0,
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, interaction, []),
    repeatState: 'ready',
  };
  const demonstrated = renderLesson({ ...base, hintLevel: 3, answered: false });
  assert.match(demonstrated, new RegExp(`data-answer="${interaction.answerId}"[^>]*is-demonstrated`));
  assert.doesNotMatch(demonstrated, /data-action="continue-interaction"/);

  const answered = renderLesson({
    ...base,
    hintLevel: 1,
    answered: true,
    readyToContinue: true,
    feedbackMessage: interaction.success,
  });
  assert.match(answered, /data-action="continue-interaction"/);
  assert.equal((answered.match(/ disabled/g) ?? []).length, interaction.choices.length);
});

test('completion view returns to the map and escapes curriculum copy', () => {
  const lesson = { ...LESSONS[0], title: '<img src=x onerror=alert(1)>' };
  const project = PROJECTS[0];
  const html = renderCompletion({
    lesson,
    project,
    scene: getSceneState(project.regionId, project.ordinal, { action: 'dig' }, []),
    nextLessonId: 'lesson-002',
    isProjectComplete: false,
  });

  assert.match(html, /data-action="continue-interaction"/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
});
