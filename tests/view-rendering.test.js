import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { LESSONS, PROJECTS, REGIONS } from '../src/curriculum/index.js';
import { createLessonState } from '../src/game-core.js';
import { downloadProgressJson } from '../src/parent-actions.js';
import { createPlacementState } from '../src/progression.js';
import { getSceneState } from '../src/scene-model.js';
import { createProgressV2 } from '../src/storage.js';
import { renderCompletion } from '../src/views/completion-view.js';
import { renderLesson } from '../src/views/lesson-view.js';
import { renderMap } from '../src/views/map-view.js';
import { renderPlacement } from '../src/views/placement-view.js';

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
  assert.equal((html.match(/data-action="open-garage"/g) ?? []).length, 1);
  assert.match(html, /data-action="open-lesson"[^>]*data-lesson="lesson-001"/);
  assert.doesNotMatch(html, /data-lesson="lesson-002"|data-lesson="lesson-003"/, 'future phases must not bypass progression');
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

test('map renders all progression states and exact phase replay controls', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-004',
    currentLessonId: 'lesson-010',
    completedProjectIds: ['project-001'],
    selectedProjectId: 'project-001',
    placementAvailable: true,
    projectStates: [
      { projectId: 'project-001', state: 'completed' },
      { projectId: 'project-002', state: 'reviewDue' },
      { projectId: 'project-003', state: 'inProgress' },
      { projectId: 'project-004', state: 'learnable' },
      { projectId: 'project-005', state: 'locked' },
    ],
  });

  for (const state of ['completed', 'reviewDue', 'inProgress', 'learnable', 'locked']) {
    assert.match(html, new RegExp(`data-state="${state}"`));
  }
  for (const lessonId of ['lesson-001', 'lesson-002', 'lesson-003']) {
    assert.match(html, new RegExp(`data-action="open-lesson"[^>]*data-lesson="${lessonId}"`));
  }
  assert.match(html, /data-action="start-placement"/);
});

test('map renders only the selected reached project phases that are available', () => {
  const base = {
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-004',
    currentLessonId: 'lesson-010',
    completedProjectIds: [],
  };
  const projectStates = [
    { projectId: 'project-001', state: 'learnable', availableLessonIds: ['lesson-001'] },
    { projectId: 'project-002', state: 'reviewDue', availableLessonIds: ['lesson-004', 'lesson-005', 'lesson-006'] },
    { projectId: 'project-003', state: 'inProgress', availableLessonIds: ['lesson-007', 'lesson-008'] },
    { projectId: 'project-004', state: 'learnable', availableLessonIds: ['lesson-010'] },
  ];

  const learnableHtml = renderMap({ ...base, projectStates, selectedProjectId: 'project-001' });
  assert.match(learnableHtml, /data-lesson="lesson-001"/);
  assert.doesNotMatch(learnableHtml, /data-lesson="lesson-002"|data-lesson="lesson-003"/);

  const reviewDueHtml = renderMap({ ...base, projectStates, selectedProjectId: 'project-002' });
  for (const lessonId of ['lesson-004', 'lesson-005', 'lesson-006']) {
    assert.match(reviewDueHtml, new RegExp(`data-lesson="${lessonId}"`));
  }

  const inProgressHtml = renderMap({ ...base, projectStates, selectedProjectId: 'project-003' });
  assert.match(inProgressHtml, /data-lesson="lesson-007"/);
  assert.match(inProgressHtml, /data-lesson="lesson-008"/);
  assert.doesNotMatch(inProgressHtml, /data-lesson="lesson-009"/);
});

test('placement view is encouraging, answerable and explicit that it does not record', () => {
  const state = createPlacementState(createProgressV2(), 17, 1000);
  const html = renderPlacement({ state, interaction: state.interactions[0] });

  assert.match(html, /找到适合你的施工起点/);
  assert.match(html, /不会录音/);
  assert.match(html, /data-action="placement-answer"/);
  assert.doesNotMatch(html, /失败|错误|扣分/);
});

test('map region scenes render every visible upgrade returned by scene state', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-004',
    currentLessonId: 'lesson-010',
    completedProjectIds: ['project-001', 'project-002', 'project-003'],
  });

  assert.match(html, /assets\/region-scenes\.svg#sunny-town-upgrade-1/);
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

test('lesson view renders and escapes generated visual math stimuli', () => {
  const state = firstLessonState(11);
  const generated = state.interactions.find((interaction) => interaction.visualPrompt);
  assert.ok(generated, 'lesson generation must provide a visual stimulus');
  const interaction = { ...generated, visualPrompt: `${generated.visualPrompt} <img src=x>` };
  const html = renderLesson({
    lesson: LESSONS[0],
    interaction,
    interactionIndex: state.interactions.indexOf(generated),
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, interaction, []),
    hintLevel: 0,
    answered: false,
    repeatState: 'ready',
  });

  assert.match(html, /class="problem-visual"[^>]*aria-label="任务图"/);
  assert.match(html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
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

test('lesson feedback renders a non-blocking batch effect with combo status', () => {
  const state = firstLessonState();
  const interaction = state.interactions[0];
  const html = renderLesson({
    lesson: LESSONS[0],
    interaction,
    interactionIndex: 2,
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, interaction, []),
    hintLevel: 0,
    answered: true,
    repeatState: 'ready',
    answerEffect: {
      kind: 'success',
      tier: 'combo',
      variant: 'gear-burst',
      message: '连续答对 3 次',
      particles: Array.from({ length: 18 }, (_, index) => ({
        glyph: index % 2 === 0 ? 'star' : 'gear',
        lane: index,
      })),
    },
  });

  assert.match(html, /class="answer-effect-layer is-success is-combo"/);
  assert.match(html, /连续答对 3 次/);
  assert.equal((html.match(/class="answer-effect-particle/g) ?? []).length, 18);
  assert.match(html, /aria-hidden="true"/);
});

test('clock lessons expose a responsive layout hook for their tall visual prompt', () => {
  const state = firstLessonState();
  const interaction = {
    ...state.interactions[0],
    kind: 'math-clock',
    subject: 'math',
    visualPrompt: '开始\n钟面\n12\n9 ● 3\n6\n结束\n钟面\n12\n9 ● 3\n6',
  };
  const html = renderLesson({
    lesson: LESSONS[0],
    interaction,
    interactionIndex: 8,
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, interaction, []),
    hintLevel: 0,
    answered: true,
    readyToContinue: true,
    repeatState: 'ready',
  });

  assert.match(html, /data-interaction-kind="math-clock"/);
  assert.match(html, />继续施工</);
});

test('completion view returns to the map and escapes curriculum copy', () => {
  const lesson = {
    ...LESSONS[0],
    title: '<img src=x onerror=alert(1)>',
    ordinal: '<img src=x onerror=alert(2)>',
  };
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
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
});

test('lesson briefing escapes lesson ordinals', () => {
  const state = firstLessonState();
  const lesson = { ...LESSONS[0], ordinal: '<svg onload=alert(1)>' };
  const html = renderLesson({
    screen: 'briefing',
    lesson,
    interaction: state.interactions[0],
    interactionIndex: 0,
    interactionTotal: state.interactions.length,
    scene: getSceneState('sunny-town', 1, state.interactions[0], []),
  });

  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<svg onload=/);
});

test('map content uses a non-main landmark inside the application main', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-001',
    currentLessonId: 'lesson-001',
    completedProjectIds: [],
  });

  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /<section class="world-map"[^>]*aria-labelledby="map-title"/);
});

test('mobile CSS keeps lesson progress visible and reset control touch-sized', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)'));

  assert.doesNotMatch(mobile, /\.world-topbar\s*>\s*:nth-child\(2\)\s*{[^}]*display:\s*none/);
  assert.doesNotMatch(mobile, /\.lesson-progress\s*{[^}]*display:\s*none/);
  assert.match(mobile, /\.lesson-topbar \.brand-lockup\s*{[^}]*display:\s*none/);
  assert.match(css, /#reset-progress\s*{[^}]*min-height:\s*56px/);
  assert.match(mobile, /\.lesson-shell\s*{[^}]*minmax\(170px,\s*24svh\)/);
  assert.match(mobile, /\.answer-button\s*{[^}]*min-height:\s*68px/);
  assert.match(mobile, /\.continue-row\s*{[^}]*margin-top:\s*10px/);
  assert.match(mobile, /\.lesson-controls\s*{[^}]*overflow-y:\s*auto/);
  assert.match(mobile, /data-interaction-kind="math-clock"[^}]*\.answer-grid\s*{[^}]*grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.answer-effect-layer\s*{[^}]*display:\s*none/);
});

test('adult course controls meet the minimum touch target height', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.parent-tabs button\s*{[^}]*min-height:\s*56px/);
  assert.match(css, /\.course-filters select\s*{[^}]*min-height:\s*56px/);
  assert.match(css, /\.export-progress\s*{[^}]*min-height:\s*56px/);
});

test('adult area exposes course and settings tabs plus JSON export controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /role="tablist"/);
  assert.match(html, /data-parent-tab="course"/);
  assert.match(html, /data-parent-tab="settings"/);
  assert.match(html, /data-action="export-progress"/);
  assert.equal((html.match(/name="speech-rate"/g) ?? []).length, 3);
  for (const value of ['slow', 'normal', 'fast']) {
    assert.match(html, new RegExp(`name="speech-rate"[^>]*value="${value}"`));
  }
});

test('progress export creates, clicks, removes, and revokes one JSON download', () => {
  const calls = [];
  const anchor = {
    href: '',
    download: '',
    click() { calls.push('click'); },
    remove() { calls.push('remove'); },
  };
  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
      calls.push('blob');
    }
  }
  const environment = {
    Blob: FakeBlob,
    URL: {
      createObjectURL(blob) {
        calls.push(['createObjectURL', blob]);
        return 'blob:test-progress';
      },
      revokeObjectURL(url) { calls.push(['revokeObjectURL', url]); },
    },
    document: {
      createElement(tagName) {
        calls.push(['createElement', tagName]);
        return anchor;
      },
      body: {
        append(node) { calls.push(['append', node]); },
      },
    },
  };

  downloadProgressJson(createProgressV2(), environment);

  assert.equal(anchor.href, 'blob:test-progress');
  assert.equal(anchor.download, 'planet-engineering-progress.json');
  assert.equal(calls[0], 'blob');
  assert.equal(calls[1][0], 'createObjectURL');
  assert.deepEqual(calls.slice(2).map((call) => Array.isArray(call) ? call[0] : call), [
    'createElement', 'append', 'click', 'remove', 'revokeObjectURL',
  ]);
  assert.equal(calls[1][1].options.type, 'application/json');
  assert.equal(JSON.parse(calls[1][1].parts[0]).version, 2);
});
