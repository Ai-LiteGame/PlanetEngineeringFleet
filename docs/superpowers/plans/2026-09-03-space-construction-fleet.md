# 《星球工程车队》实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开发一款可在平板和电脑浏览器运行、可完整玩通并融合识汉字、英语跟说和数学思维的《星球工程车队》小游戏。

**Architecture:** 使用无构建依赖的静态 Web 应用。纯数据和状态转换集中在 ES 模块中，由 Node 内置测试运行器验证；浏览器入口仅负责渲染、事件、动画和 Web API 适配。题目进度和长期掌握度分别保存，页面刷新只恢复到当前学科首题，避免恢复到动画中间态。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES modules、Web Speech API、Web Audio API、Local Storage、Node.js `node:test`。

**Spec:** `docs/superpowers/specs/2026-09-03-space-construction-fleet-design.md`

## Global Constraints

- 目标儿童年龄为 5–6 岁；单局固定十二题，预计 6–8 分钟。
- 学科顺序固定为 `intro → chinese → english → math → mixed → complete`。
- 游戏必须离线可玩，不加载远程媒体，不依赖第三方运行库。
- 英语跟读不录音、不上传、不依赖语音识别判分。
- 答错不扣分、不显示失败画面；第一次给动作线索，第二次明确高亮。
- 主要触控目标至少为 56 × 56 CSS 像素。
- 支持 320px 宽屏幕，重点验证 1280 × 800、1024 × 768、390 × 844。
- 动画必须尊重 `prefers-reduced-motion`。
- 当前目录不是 Git 仓库；每项任务用测试和文件检查作为验收检查点，不执行提交命令。

---

### Task 1: 题库与游戏状态机

**Files:**
- Create: `package.json`
- Create: `src/content.js`
- Create: `src/game-core.js`
- Create: `tests/game-core.test.js`

**Interfaces:**
- Produces: `STAGES`, `QUESTION_BANKS`, `createInitialState()`, `createSession(seed, progress)`, `submitAnswer(state, answerId)`, `advance(state)`。
- `GameState` shape: `{ stage, stageIndex, questionIndex, questions, attempts, hintLevel, stars, completed, locked, sessionAnswers }`。
- `submitAnswer` returns `{ state, correct, hintLevel, completedQuestion }` without mutating input。

- [ ] **Step 1: Add the Node test command and write failing state-machine tests**

Create `package.json` with `"type": "module"` and `"test": "node --test"`. In `tests/game-core.test.js`, assert:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  createSession,
  submitAnswer,
  advance,
} from '../src/game-core.js';

test('a session contains 3 questions for each learning stage', () => {
  const state = createSession(7, {});
  assert.deepEqual(Object.keys(state.questions), ['chinese', 'english', 'math', 'mixed']);
  assert.equal(Object.values(state.questions).every((items) => items.length === 3), true);
});

test('wrong answers increase hints but never stars', () => {
  const state = createSession(7, {});
  const result = submitAnswer(state, 'not-the-answer');
  assert.equal(result.correct, false);
  assert.equal(result.state.hintLevel, 1);
  assert.deepEqual(result.state.stars, []);
});

test('three correct answers advance to the next station and award one star', () => {
  let state = createSession(7, {});
  for (let index = 0; index < 3; index += 1) {
    const question = state.questions.chinese[index];
    state = submitAnswer(state, question.answerId).state;
    state = advance(state);
  }
  assert.equal(state.stage, 'english');
  assert.deepEqual(state.stars, ['chinese']);
});

test('completing mixed marks the session complete', () => {
  let state = createSession(7, {});
  for (const stage of ['chinese', 'english', 'math', 'mixed']) {
    for (let index = 0; index < 3; index += 1) {
      const question = state.questions[stage][index];
      state = submitAnswer(state, question.answerId).state;
      state = advance(state);
    }
  }
  assert.equal(state.stage, 'complete');
  assert.equal(state.completed, true);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test`

Expected: FAIL because `src/game-core.js` does not exist.

- [ ] **Step 3: Create the content model and minimal immutable state transitions**

Define each question as:

```js
{
  id: 'zh-bridge',
  stage: 'chinese',
  skillId: 'zh:桥',
  prompt: '请挖出写着“桥”的石头',
  speech: { text: '请挖出写着桥的石头', lang: 'zh-CN' },
  choices: [
    { id: 'road', label: '路', visual: '路' },
    { id: 'bridge', label: '桥', visual: '桥' },
    { id: 'river', label: '河', visual: '河' },
  ],
  answerId: 'bridge',
  success: '桥，彩虹桥',
}
```

Provide at least six questions per learning stage so three can be selected without repetition. Use a deterministic seeded shuffle in `createSession` so tests remain stable. `advance` moves only after a correct answer; after the third question it awards the station star and advances.

- [ ] **Step 4: Run core tests**

Run: `npm test`

Expected: all four tests PASS.

### Task 2: 提示、自适应学习与本地存储

**Files:**
- Modify: `src/game-core.js`
- Create: `src/storage.js`
- Modify: `tests/game-core.test.js`
- Create: `tests/storage.test.js`

**Interfaces:**
- Produces: `updateMastery(progress, sessionAnswers)`, `questionWeight(question, progress, sessionNumber)`, `serializeProgress(progress)`, `parseProgress(raw)`, `loadProgress(storage)`, `saveProgress(storage, progress)`。
- `Progress` shape: `{ version: 1, sessionsCompleted, bridgeStage, skills }` where a skill value is `{ independentStreak, helpStreak, masteredAtSession }`。

- [ ] **Step 1: Write failing tests for hint escalation and mastery**

Add tests that verify:

```js
test('hints stop at level two and a later correct answer remains valid', () => {
  let state = createSession(9, {});
  state = submitAnswer(state, 'wrong').state;
  state = submitAnswer(state, 'wrong-again').state;
  state = submitAnswer(state, 'still-wrong').state;
  assert.equal(state.hintLevel, 2);
  const result = submitAnswer(state, state.questions.chinese[0].answerId);
  assert.equal(result.correct, true);
  assert.equal(result.state.sessionAnswers[0].assistance, 2);
});

test('three independent answers mark a skill as mastered', () => {
  const progress = updateMastery(
    { version: 1, sessionsCompleted: 2, bridgeStage: 2, skills: {} },
    [0, 1, 2].map(() => ({ skillId: 'zh:桥', correct: true, assistance: 0 })),
  );
  assert.equal(progress.skills['zh:桥'].independentStreak, 3);
  assert.equal(progress.skills['zh:桥'].masteredAtSession, 3);
});
```

In `tests/storage.test.js`, verify valid round trips, malformed JSON fallback, wrong version fallback, and storage exceptions.

- [ ] **Step 2: Run targeted tests and verify failure**

Run: `node --test tests/game-core.test.js tests/storage.test.js`

Expected: FAIL because mastery and storage functions are missing.

- [ ] **Step 3: Implement two-level hints, weighted review, and defensive storage**

Clamp hints with `Math.min(2, hintLevel + 1)`. Record assistance when the correct answer is submitted. Give unmastered skills weight 4, mastered review skills weight 2 on session offsets 2, 4 and 7, and other mastered skills weight 1. Parse only version 1 objects with numeric session and bridge fields; catch all storage reads and writes.

- [ ] **Step 4: Run all logic tests**

Run: `npm test`

Expected: all tests PASS.

### Task 3: 应用外壳与工程车视觉场景

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `assets/construction-fleet.svg`
- Create: `src/app.js`

**Interfaces:**
- Consumes: `createSession`, `loadProgress`。
- Produces DOM regions: `#app`, `#scene`, `#mission`, `#answers`, `#feedback`, `#progress`, `#settings-dialog`。
- Asset symbols: `#excavator`, `#mixer`, `#crane`, `#dump-truck` in the SVG file.

- [ ] **Step 1: Create semantic HTML and a visible intro state**

The entry document contains a single `<main id="app">`, a live feedback region, a native `<dialog>` for adult settings, and module script `src/app.js`. `src/app.js` loads progress, creates but does not start a session, and renders the intro with a single “开始施工” primary button.

- [ ] **Step 2: Build the visual asset sheet and responsive scene**

Draw four distinct side-view construction vehicles as SVG symbols with simple wheels, cabin, and recognizable working parts. Render them using `<svg><use href="assets/construction-fleet.svg#excavator"></use></svg>`. Build a full-width alien worksite with sky, terrain, road, bridge progress and vehicle lane; do not frame the primary scene in a decorative card.

Use these layout invariants:

```css
.app-shell { min-height: 100svh; display: grid; grid-template-rows: auto minmax(260px, 42vh) 1fr; }
.answer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.answer-button { min-height: 88px; min-width: 56px; }
@media (max-width: 560px) {
  .app-shell { grid-template-rows: auto minmax(220px, 34vh) 1fr; }
  .answer-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: Check the static page without JavaScript errors**

Run: `python3 -m http.server 4173`

Open: `http://localhost:4173`

Expected: intro screen is visible, all four vehicles render, no external network request is required, and the page has no horizontal scroll at 390px width.

### Task 4: 四站游戏交互与动画反馈

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `src/content.js`

**Interfaces:**
- Consumes: complete `GameState` and `submitAnswer`/`advance` transitions.
- Produces: `render(state)`, `renderQuestion(question, state)`, `handleAnswer(choiceId)`, `finishSession()`。

- [ ] **Step 1: Render stage-specific instructions and answers from data**

Chinese uses large character signs, English uses visual quantity/color choices plus a “我说完了” rhythm action, math uses material groups and patterns, and mixed uses compound delivery cards. Preserve native `<button>` semantics and disable all answers while feedback is active.

- [ ] **Step 2: Connect feedback to actual engineering actions**

On a correct answer, apply one transient scene class according to stage:

```js
const ACTION_CLASS = {
  chinese: 'is-digging',
  english: 'is-mixing',
  math: 'is-lifting',
  mixed: 'is-delivering',
};
```

Animate the excavator arm, mixer drum, crane hook or dump-truck travel for 700ms, then expose a “继续施工” button. Wrong answers keep the same question, update hints, and never display a red cross.

- [ ] **Step 3: Implement station and completion screens**

After three questions, show the earned skill star and next vehicle for one explicit continue action. On completion, update mastery, increment `sessionsCompleted`, set `bridgeStage` to `Math.min(3, bridgeStage + 1)`, save progress, and render the completed bridge plus three skill stars and a “再建一次” button.

- [ ] **Step 4: Manually play all answer branches**

Verify one wrong answer, two wrong answers, correct answer, station advance, mixed task, completion, and replay. Confirm rapid double-clicks cannot add duplicate records or skip questions.

### Task 5: 语音、音效、成人设置与可访问性

**Files:**
- Create: `src/audio.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Produces: `speak(text, lang)`, `playSuccess()`, `setSoundEnabled(value)`, `isSpeechAvailable()`。
- Adult settings open only after a 2000ms pointer hold on `[data-settings-trigger]` or by keyboard activation followed by confirmation.

- [ ] **Step 1: Implement speech and sound with browser-safe fallbacks**

Use `speechSynthesis.cancel()` before each utterance and set `utterance.lang` from question data. Create the audio context only inside a user event. `playSuccess` uses two short oscillator notes and returns silently when audio is disabled or unavailable.

- [ ] **Step 2: Add repeat speech and English follow-along rhythm**

Every question displays a speaker icon button with `aria-label="再听一遍"`. English questions require the child to click “按住话筒跟我说” or keyboard-activate it; show a three-second visual pulse and then reveal image choices. Do not call `getUserMedia` or any recording API.

- [ ] **Step 3: Implement adult settings and persistence controls**

Settings contain one sound checkbox, progress summary text, close button, and “重置学习记录” button that requires a second confirmation. Reset removes only the game storage key and returns the app to intro.

- [ ] **Step 4: Verify keyboard and reduced-motion behavior**

Tab order follows repeat speech, primary interaction, answer choices, and continue. Focus rings remain visible. With `prefers-reduced-motion: reduce`, vehicle transforms and pulsing stop while state text and button transitions remain functional.

### Task 6: 自动验证、视觉检查与交付说明

**Files:**
- Create: `README.md`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: tests only when a verification gap identifies missing behavior

**Interfaces:**
- Verification only; no new runtime interface.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: zero failures and no skipped tests.

- [ ] **Step 2: Start the local server and exercise the full game**

Run: `python3 -m http.server 4173`

At `http://localhost:4173`, complete all twelve questions, including at least one two-level hint path. Refresh once during a station and confirm it restarts at that station's first question. Finish and refresh; confirm bridge progress persists.

- [ ] **Step 3: Capture and inspect required viewports**

Inspect screenshots at 1280 × 800, 1024 × 768 and 390 × 844. Confirm the primary scene is nonblank, all referenced SVG symbols render, text never overlaps controls, answer buttons remain fully visible, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 4: Check offline and speech-degraded operation**

Disable network access and set `window.speechSynthesis` unavailable in the browser context. Play through one question in every station and confirm visible prompts and controls are sufficient to progress.

- [ ] **Step 5: Document use and verification**

`README.md` states the audience, learning model, how to run `python3 -m http.server 4173`, how to run `npm test`, browser requirements, privacy behavior, and the exact first-release scope.

