# 《星球工程车队》长期课程扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前单条彩虹桥任务扩展为包含 90 个工程项目、270 节微课程、三阶段课程、动态工程世界、课程表和长期掌握记录的完整学习游戏。

**Architecture:** 保留无构建依赖的原生 Web 应用，把课程数据、出题模板、掌握度、存档和视图拆成独立 ES 模块。固定课程目录决定“学什么”，自适应调度器决定“本节复习什么”，纯状态机决定“下一步是什么”，浏览器层只负责呈现、动画和 Web API 降级。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES Modules、SVG 资产、Web Speech API、Web Audio API、Local Storage、Node.js `node:test`。

**Spec:** `docs/superpowers/specs/2026-09-03-space-construction-fleet-expansion-design.md`

## Global Constraints

- 目标用户为幼儿园大班儿童，课程可延续到小学一年级结束。
- 完整规模必须为 6 个区域、90 个工程项目、270 节微课程。
- 内容库必须包含正好 700 个去重汉字、300 个去重英语词汇和 100 个去重交流句型。
- 单节包含约 12 个互动，预计 8–12 分钟；只有在每科至少有 2 个符合条件的已见技能并另有 2 个热身技能时，新旧内容比例才保持约 1:2，历史不足时由当前同科内容补足。
- 大班基础、幼小衔接和一年级拓展分别占 90 节。
- 汉字只训练识读与理解，不进行书写评分；英语不录音、不上传、不进行发音评分。
- 答错不扣分、不显示失败画面；提示逐级增加并允许儿童最终完成。
- 全部代码和资源本地交付，不加载远程资源，不增加第三方运行依赖。
- 主要触控目标至少 56×56 CSS 像素，支持键盘和 `prefers-reduced-motion`。
- 版本 1 存档必须迁移到版本 2；存储不可用时当前课程仍可玩。
- 每个任务以测试驱动完成，并在测试通过后单独提交。

---

### Task 1: 课程数据模型与精确内容库存

**Files:**
- Create: `src/curriculum/schema.js`
- Create: `src/curriculum/chinese.js`
- Create: `src/curriculum/english.js`
- Create: `src/curriculum/math.js`
- Create: `src/curriculum/index.js`
- Create: `tests/curriculum-content.test.js`

**Interfaces:**
- Produces: `CHINESE_ITEMS`, `ENGLISH_WORDS`, `ENGLISH_PATTERNS`, `MATH_SKILLS`。
- Produces: `validateChineseItem(item)`, `validateEnglishWord(item)`, `validateEnglishPattern(item)`, `validateMathSkill(item)`，返回布尔值。
- Chinese item shape: `{ id, char, word, example, tier }`。
- English word shape: `{ id, word, meaning, category, tier }`。
- English pattern shape: `{ id, text, meaning, slots, tier }`。
- Math skill shape: `{ id, domain, tier, min, max, generator }`。

- [ ] **Step 1: 写内容数量与结构的失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHINESE_ITEMS,
  ENGLISH_WORDS,
  ENGLISH_PATTERNS,
  MATH_SKILLS,
} from '../src/curriculum/index.js';
import {
  validateChineseItem,
  validateEnglishWord,
  validateEnglishPattern,
  validateMathSkill,
} from '../src/curriculum/schema.js';

test('curriculum inventory has exact unique content counts', () => {
  assert.equal(CHINESE_ITEMS.length, 700);
  assert.equal(new Set(CHINESE_ITEMS.map((item) => item.char)).size, 700);
  assert.equal(ENGLISH_WORDS.length, 300);
  assert.equal(new Set(ENGLISH_WORDS.map((item) => item.word.toLowerCase())).size, 300);
  assert.equal(ENGLISH_PATTERNS.length, 100);
  assert.equal(new Set(ENGLISH_PATTERNS.map((item) => item.text)).size, 100);
});

test('every curriculum item satisfies its schema', () => {
  assert.equal(CHINESE_ITEMS.every(validateChineseItem), true);
  assert.equal(ENGLISH_WORDS.every(validateEnglishWord), true);
  assert.equal(ENGLISH_PATTERNS.every(validateEnglishPattern), true);
  assert.equal(MATH_SKILLS.every(validateMathSkill), true);
});
```

- [ ] **Step 2: 运行测试并确认因课程模块不存在而失败**

Run: `node --test tests/curriculum-content.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/curriculum/index.js`.

- [ ] **Step 3: 实现 schema 和课程内容文件**

`schema.js` 使用明确字段验证，不修正输入：

```js
const TIERS = new Set([1, 2, 3]);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateChineseItem(item) {
  return isText(item?.id) && /^.$/u.test(item.char) && isText(item.word)
    && item.word.includes(item.char) && isText(item.example) && TIERS.has(item.tier);
}

export function validateEnglishWord(item) {
  return isText(item?.id) && /^[a-z][a-z -]*$/i.test(item.word)
    && isText(item.meaning) && isText(item.category) && TIERS.has(item.tier);
}

export function validateEnglishPattern(item) {
  return isText(item?.id) && isText(item.text) && isText(item.meaning)
    && Array.isArray(item.slots) && TIERS.has(item.tier);
}

export function validateMathSkill(item) {
  return isText(item?.id) && isText(item.domain) && TIERS.has(item.tier)
    && Number.isInteger(item.min) && Number.isInteger(item.max)
    && item.min <= item.max && isText(item.generator);
}
```

课程文件使用冻结数组。汉字按 200/250/250 分配到三个阶段，英语词汇按 90/100/110 分配，句型按 30/35/35 分配。每个词条必须是儿童可理解的生活、校园、自然、交通或工程语境；不得用生僻字、成人商务词和抽象语法术语凑数。

```js
export const CHINESE_ITEMS = Object.freeze([
  { id: 'zh-001', char: '人', word: '大人', example: '大人在修路。', tier: 1 },
  { id: 'zh-002', char: '口', word: '路口', example: '车停在路口。', tier: 1 },
]);

export const ENGLISH_WORDS = Object.freeze([
  { id: 'en-word-001', word: 'hello', meaning: '你好', category: 'greeting', tier: 1 },
  { id: 'en-word-002', word: 'truck', meaning: '卡车', category: 'vehicle', tier: 1 },
]);

export const ENGLISH_PATTERNS = Object.freeze([
  { id: 'en-pattern-001', text: 'Hello!', meaning: '你好！', slots: [], tier: 1 },
  { id: 'en-pattern-002', text: 'I need {item}.', meaning: '我需要……', slots: ['item'], tier: 1 },
]);
```

`math.js` 至少覆盖 `number-sense`、`addition`、`subtraction`、`comparison`、`pattern`、`classification`、`space`、`measurement`、`clock`、`money` 和 `word-problem` 域。阶段 1 的运算最大值为 10，阶段 2 为 20，阶段 3 的数概念最大值为 100。

- [ ] **Step 4: 创建课程聚合入口并运行内容测试**

Create `src/curriculum/index.js`:

```js
export { CHINESE_ITEMS } from './chinese.js';
export { ENGLISH_WORDS, ENGLISH_PATTERNS } from './english.js';
export { MATH_SKILLS } from './math.js';
```

Run: `node --test tests/curriculum-content.test.js`

Expected: PASS with exact inventory counts and zero invalid records.

- [ ] **Step 5: 提交课程库存**

```bash
git add src/curriculum tests/curriculum-content.test.js
git commit -m "feat: add long-form curriculum inventory"
```

### Task 2: 六区域、90 项目与 270 节课程目录

**Files:**
- Create: `src/curriculum/regions.js`
- Create: `src/curriculum/projects.js`
- Create: `src/curriculum/lessons.js`
- Modify: `src/curriculum/index.js`
- Create: `tests/course-catalog.test.js`

**Interfaces:**
- Produces: `REGIONS`, `PROJECTS`, `LESSONS`。
- Produces: `getProject(projectId)`, `getLesson(lessonId)`, `getLessonsForProject(projectId)`, `getStageForLesson(lessonId)`。
- Lesson shape: `{ id, ordinal, projectId, phase, tier, title, newChineseIds, newEnglishWordIds, newEnglishPatternIds, mathSkillId }`。

- [ ] **Step 1: 写目录规模、唯一性和阶段边界的失败测试**

```js
test('catalog contains six regions, ninety projects and 270 lessons', () => {
  assert.equal(REGIONS.length, 6);
  assert.equal(PROJECTS.length, 90);
  assert.equal(LESSONS.length, 270);
  assert.equal(new Set(LESSONS.map((lesson) => lesson.id)).size, 270);
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
  for (const lesson of LESSONS) {
    if (lesson.phase === 'review') {
      assert.equal(lesson.newChineseIds.length, 0);
      assert.equal(lesson.newEnglishWordIds.length, 0);
      assert.equal(lesson.newEnglishPatternIds.length, 0);
    } else {
      const allowedChineseCount = lesson.tier === 1
        ? lesson.newChineseIds.length >= 3 && lesson.newChineseIds.length <= 4
        : lesson.newChineseIds.length >= 3 && lesson.newChineseIds.length <= 5;
      assert.equal(allowedChineseCount, true);
      assert.equal(lesson.newEnglishWordIds.length >= 1 && lesson.newEnglishWordIds.length <= 2, true);
    }
    assert.equal([1, 2, 3].includes(lesson.tier), true);
  }
});
```

- [ ] **Step 2: 运行目录测试并确认失败**

Run: `node --test tests/course-catalog.test.js`

Expected: FAIL because `regions.js`, `projects.js`, and `lessons.js` do not exist.

- [ ] **Step 3: 定义区域与项目数据**

`REGIONS` 固定为 `sunny-town`、`forest-valley`、`harbor-island`、`undersea-city`、`snow-airport`、`future-shanghai`。每个区域提供名称、15 个项目标题、场景主题和可用车辆。`PROJECTS` 由区域数据确定性展开，每个项目具有全局序号、阶段、车辆和工程成果。

```js
export const REGIONS = Object.freeze([
  {
    id: 'sunny-town',
    title: '阳光工程镇',
    theme: 'meadow',
    vehicles: ['excavator', 'bulldozer', 'mixer', 'roller'],
    projectTitles: ['清理工地', '铺第一条路', '搭安全围栏', '修公交站', '安装路灯', '建积木房', '挖雨水沟', '修小石桥', '铺彩色步道', '建工具屋', '种工程树林', '修社区门', '搭运动场', '建消防站', '点亮工程镇'],
  },
]);
```

其余五区各写满 15 个不重复、可视化的建设目标。项目序号 1–30 为阶段 1，31–60 为阶段 2，61–90 为阶段 3。

- [ ] **Step 4: 生成课程并验证所有内容仅分配一次作为新知识**

`LESSONS` 按项目展开三阶段课程。内容切片使用累计配额，所有 700/300/100 项只在 `learn` 或 `build` 课程中标记一次为 `new`，后续由调度器复习。阶段 2、3 各有且仅有 10 节引入 5 个新汉字，其余引入课为 3–4 个；这是每阶段准确容纳 250 字且保持 `review` 只复习的配额。`review` 课程的三个新内容数组均为空；句型并非每节都有，无新句型时 `newEnglishPatternIds` 为空数组。

Run: `node --test tests/course-catalog.test.js tests/curriculum-content.test.js`

Expected: PASS; exactly 270 lessons exist and every inventory item appears once as new content.

- [ ] **Step 5: 提交课程目录**

```bash
git add src/curriculum tests/course-catalog.test.js
git commit -m "feat: add 270-lesson engineering course catalog"
```

### Task 3: 版本 2 掌握度与间隔复习调度器

**Files:**
- Create: `src/mastery.js`
- Create: `tests/mastery.test.js`

**Interfaces:**
- Produces: `createSkillRecord()`, `recordSkillAttempt(record, attempt, now)`, `skillStatus(record, now)`, `selectReviewSkills(progress, lesson, limit, now)`。
- Attempt shape: `{ correct, assistance, lessonId }`。
- Skill record shape: `{ exposures, independentCorrect, assistedCorrect, independentLessonIds, firstIndependentAt, lastSeenAt, nextReviewAt, status }`。

- [ ] **Step 1: 写掌握、待复习与优先级的失败测试**

```js
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
```

- [ ] **Step 2: 运行掌握度测试并确认失败**

Run: `node --test tests/mastery.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/mastery.js`.

- [ ] **Step 3: 实现不可变的掌握度更新**

复习间隔按成功次数使用 `[1, 3, 7, 14, 30]` 天。提示后答对只增加 `assistedCorrect`，并把下一次复习设为 1 天后。独立正确来自至少三节不同课程，且第一次与最后一次相隔至少 24 小时，才能进入 `mastered`。

```js
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
```

- [ ] **Step 4: 实现确定性复习选择并运行测试**

选择器不得使用全局随机数。按 `reviewDue → assisted → practicing → mastered` 排序，同级使用 `nextReviewAt` 和技能 ID 稳定排序。排除当前课程尚未讲授的新技能。

Run: `node --test tests/mastery.test.js`

Expected: PASS for mastery timing, assisted fallback, ordering and input immutability.

- [ ] **Step 5: 提交掌握度引擎**

```bash
git add src/mastery.js tests/mastery.test.js
git commit -m "feat: add spaced mastery scheduler"
```

### Task 4: 版本 2 存档、旧数据迁移、活动快照与导出

**Files:**
- Modify: `src/storage.js`
- Modify: `tests/storage.test.js`

**Interfaces:**
- Produces: `createProgressV2()`, `migrateProgress(raw)`, `parseProgress(raw)`, `recordLessonViewed(progress, lessonId, now)`, `saveProgress(storage, progress)`, `loadProgress(storage)`, `saveActiveLesson(storage, snapshot)`, `loadActiveLesson(storage)`, `exportProgress(progress)`, `getMigrationBackup()`。
- Progress v2 shape matches the design spec and includes `lessons`, `skills`, `honors`, `vehicleUpgrades`, `settings`, and `storageAvailable`。

- [ ] **Step 1: 写版本迁移和五级课程状态的失败测试**

```js
test('version one progress migrates without losing sound and mastered skills', () => {
  const old = JSON.stringify({
    version: 1,
    sessionsCompleted: 4,
    bridgeStage: 3,
    soundEnabled: false,
    skills: { 'zh:桥': { independentStreak: 3, helpStreak: 0, masteredAtSession: 3 } },
  });
  const progress = parseProgress(old);
  assert.equal(progress.version, 2);
  assert.equal(progress.settings.soundEnabled, false);
  assert.equal(progress.skills['zh:桥'].status, 'mastered');
});

test('lesson snapshot round trips only stable state', () => {
  const answers = [{
    interactionId: 'lesson-014:chinese:1', subject: 'chinese', skillIds: ['zh-001'],
    correct: true, assistance: 0, attempts: 0,
  }];
  saveActiveLesson(storage, { lessonId: 'lesson-014', interactionIndex: 4, seed: 17, answers });
  assert.deepEqual(loadActiveLesson(storage), {
    lessonId: 'lesson-014', interactionIndex: 4, seed: 17, answers,
  });
});

test('export produces parseable version two JSON', () => {
  const value = JSON.parse(exportProgress(createProgressV2()));
  assert.equal(value.version, 2);
  assert.deepEqual(value.recordings, undefined);
});

test('watching a briefing records viewed without recording practice', () => {
  const progress = recordLessonViewed(createProgressV2(), 'lesson-001', 2000);
  assert.equal(progress.lessons['lesson-001'].status, 'viewed');
  assert.equal(progress.lessons['lesson-001'].viewedAt, 2000);
  assert.equal(progress.lessons['lesson-001'].completedCount, 0);
});
```

- [ ] **Step 2: 运行存档测试并确认新增测试失败**

Run: `node --test tests/storage.test.js`

Expected: FAIL because version 2 APIs are absent and current parser rejects version 1 migration.

- [ ] **Step 3: 实现严格解析与迁移**

使用新键 `space-construction-fleet.progress.v2` 和 `space-construction-fleet.active.v2`。加载时先读 v2；不存在时读 v1 并迁移。课程状态只允许 `notStarted`、`viewed`、`practiced`、`reviewDue`、`mastered`。迁移通过 `LEGACY_SKILL_MAP` 把首版 `zh:*`、`en:*`、`math:*` 和 `mixed:*` ID 映射到新版课程 ID 或数学域，不保留无法调度的孤儿技能。解析或迁移失败时把原始字符串保存在模块内的 `lastMigrationBackup`，由 `getMigrationBackup()` 返回，再使用全新 v2 进度；任何存储异常将 `storageAvailable` 设为 `false`。

- [ ] **Step 4: 实现快照、幂等奖励字段和 JSON 导出并运行测试**

活动快照保存 `lessonId`、`interactionIndex`、经过字段白名单清理的 `answers` 和 `seed`；`seed` 同时是不可变的课程生成时间戳，恢复时用于稳定出题及到期内容选择。荣誉 ID 使用集合语义去重。导出使用两个空格缩进并写入 `exportedAt`，不包含活动快照、音频或浏览器信息。

Run: `node --test tests/storage.test.js`

Expected: PASS for v1 migration, v2 round trip, corruption fallback, storage failure, stable snapshot and export.

- [ ] **Step 5: 提交版本 2 存档**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: migrate learning progress to version two"
```

### Task 5: 题目工厂与 12 互动课程状态机

**Files:**
- Create: `src/question-factories.js`
- Modify: `src/game-core.js`
- Modify: `tests/game-core.test.js`
- Create: `tests/question-factories.test.js`

**Interfaces:**
- Produces: `buildLessonInteractions(lesson, progress, seed, now)`，返回 12 个可序列化互动。
- Produces: `createLessonState(lessonId, progress, seed, now)`, `submitAnswer(state, answerId)`, `advance(state)`, `completeLesson(state, progress, now)`。
- Interaction shape: `{ id, kind, subject, skillIds, prompt, speech, choices, answerId, success, hint, action }`。

- [ ] **Step 1: 写题目工厂结构和课程状态转换的失败测试**

```js
test('a lesson builds twelve interactions with a mixed final task', () => {
  const interactions = buildLessonInteractions(LESSONS[0], createProgressV2(), 9, 1000);
  assert.equal(interactions.length, 12);
  assert.equal(interactions.at(-1).subject, 'mixed');
  assert.equal(interactions.every((item) => item.choices.some((choice) => choice.id === item.answerId)), true);
});

test('wrong answers reveal three help levels without completing the interaction', () => {
  let state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  state = submitAnswer(state, 'wrong').state;
  state = submitAnswer(state, 'wrong-again').state;
  state = submitAnswer(state, 'wrong-third').state;
  assert.equal(state.hintLevel, 3);
  assert.equal(state.answered, false);
});

test('completing a lesson marks viewed and practiced separately', () => {
  let state = createLessonState('lesson-001', createProgressV2(), 3, 1000);
  while (!state.completed) {
    const interaction = state.interactions[state.interactionIndex];
    state = submitAnswer(state, interaction.answerId).state;
    state = advance(state);
  }
  const result = completeLesson(state, createProgressV2(), 5000);
  assert.equal(result.lessons['lesson-001'].completedCount, 1);
  assert.equal(result.lessons['lesson-001'].status, 'practiced');
});
```

- [ ] **Step 2: 运行状态机测试并确认失败**

Run: `node --test tests/question-factories.test.js tests/game-core.test.js`

Expected: FAIL because lesson APIs and factories are absent.

- [ ] **Step 3: 实现确定性题目工厂**

实现汉字听音辨认、词语配对、英语听音选图、句型情境、计数、加减、比较、规律、空间和综合配送工厂。干扰项必须来自同阶段且不能等于答案。相同 `lesson + seed + progress` 必须生成相同互动顺序。约 1:2 的新旧比例只在每科至少有 2 个符合条件的已见技能并另有 2 个热身技能时适用；否则以当前同科内容补足固定的学科结构。

- [ ] **Step 4: 替换旧单局状态机并保持提交保护**

状态从 `map → briefing → playing → projectComplete → map` 转换。离开 `briefing` 时调用 `recordLessonViewed`，但不增加完成次数。第一次和第二次错误显示线索，第三次演示正确选项；只有儿童再次点中正确选项才完成。`completeLesson` 更新课程状态、技能证据和活动快照，使用 `completionId = lessonId + ':' + completedCount` 防止重复发奖。

Run: `node --test tests/question-factories.test.js tests/game-core.test.js tests/mastery.test.js tests/storage.test.js`

Expected: PASS with exactly 12 interactions, deterministic content, immutable transitions and idempotent completion.

- [ ] **Step 5: 提交课程引擎**

```bash
git add src/question-factories.js src/game-core.js tests/question-factories.test.js tests/game-core.test.js
git commit -m "feat: add adaptive lesson game engine"
```

### Task 6: 工程车辆与六区域分层视觉资产

**Files:**
- Modify: `assets/construction-fleet.svg`
- Create: `assets/region-scenes.svg`
- Create: `src/scene-model.js`
- Create: `tests/scene-model.test.js`

**Interfaces:**
- Vehicle symbols: `excavator`, `bulldozer`, `crane`, `mixer`, `dump-truck`, `roller`, `forklift`, `fire-engine`, `snowplow`, `tunnel-borer`。
- Region symbols: `sunny-town`, `forest-valley`, `harbor-island`, `undersea-city`, `snow-airport`, `future-shanghai`。
- Produces: `getSceneState(regionId, projectOrdinal, interaction, completedProjectIds)`。

- [ ] **Step 1: 写场景选择、车辆动作和永久工程成果的失败测试**

```js
test('scene model maps every region and action to a renderable symbol', () => {
  for (const region of REGIONS) {
    const scene = getSceneState(region.id, 1, { action: 'dig' }, []);
    assert.equal(scene.regionSymbolId, region.id);
    assert.equal(typeof scene.vehicleSymbolId, 'string');
    assert.equal(typeof scene.actionClass, 'string');
  }
});

test('completed projects become visible scene upgrades', () => {
  const scene = getSceneState('sunny-town', 3, { action: 'roll' }, ['project-001', 'project-002']);
  assert.deepEqual(scene.completedProjectIds, ['project-001', 'project-002']);
});
```

- [ ] **Step 2: 运行场景模型测试并确认失败**

Run: `node --test tests/scene-model.test.js`

Expected: FAIL because `src/scene-model.js` does not exist.

- [ ] **Step 3: 扩展车辆 SVG 与区域场景 SVG**

每辆车使用独立的轮组、车身和工作部件分组，工作部件带稳定类名：`.wheels`、`.cab`、`.tool`、`.lights`。六个区域分别包含地面、远景、道路和至少三个可逐步显示的工程成果。所有 symbol 使用 `viewBox="0 0 320 180"`，不得引用远程图片、字体或滤镜资源。

- [ ] **Step 4: 实现场景模型并验证 SVG 引用存在**

测试读取两个 SVG 文件，收集所有 symbol ID，并断言 `scene-model` 返回的每个 ID 都存在。动作映射至少覆盖 `dig`、`push`、`lift`、`mix`、`dump`、`roll`、`load`、`spray`、`plow` 和 `drill`。

Run: `node --test tests/scene-model.test.js`

Expected: PASS for six regions, ten vehicles, ten actions and completed-project layers.

- [ ] **Step 5: 提交视觉资产**

```bash
git add assets src/scene-model.js tests/scene-model.test.js
git commit -m "feat: add animated fleet and regional scenes"
```

### Task 7: 世界地图、课程界面与工程动画

**Files:**
- Create: `src/views/icons.js`
- Create: `src/views/map-view.js`
- Create: `src/views/lesson-view.js`
- Create: `src/views/completion-view.js`
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `index.html`
- Create: `tests/view-rendering.test.js`

**Interfaces:**
- Produces: `renderMap(model)`, `renderLesson(model)`, `renderCompletion(model)`，均返回转义后的 HTML 字符串。
- `app.js` consumes view HTML and binds actions through `data-action` attributes.
- Map model shape: `{ regions, currentRegionId, currentProjectId, currentLessonId, completedProjectIds }`。
- Lesson model shape: `{ lesson, interaction, interactionIndex, interactionTotal, scene, hintLevel, answered, repeatState }`。

- [ ] **Step 1: 写地图和课程 HTML 契约的失败测试**

```js
test('map exposes continue action and all region landmarks', () => {
  const html = renderMap({
    regions: REGIONS,
    currentRegionId: 'sunny-town',
    currentProjectId: 'project-001',
    currentLessonId: 'lesson-001',
    completedProjectIds: [],
  });
  assert.match(html, /data-action="continue-course"/);
  for (const region of REGIONS) assert.match(html, new RegExp(`data-region="${region.id}"`));
});

test('lesson view renders speech, answers and stable scene dimensions', () => {
  const html = renderLesson({
    lesson: LESSONS[0],
    interaction: buildLessonInteractions(LESSONS[0], createProgressV2(), 2, 1000)[0],
    interactionIndex: 0,
    interactionTotal: 12,
    scene: getSceneState('sunny-town', 1, { action: 'dig' }, []),
    hintLevel: 0,
    answered: false,
    repeatState: 'idle',
  });
  assert.match(html, /data-action="repeat-speech"/);
  assert.match(html, /data-answer=/);
  assert.match(html, /class="world-scene/);
});
```

- [ ] **Step 2: 运行视图测试并确认失败**

Run: `node --test tests/view-rendering.test.js`

Expected: FAIL because `src/views/map-view.js` and lesson views do not exist.

- [ ] **Step 3: 实现儿童世界地图和课程视图**

地图首屏显示当前区域、可见路线、当前车辆和“继续施工”。区域地标用 SVG symbol，项目节点用图标状态，不用长文字卡片。课程页面固定为顶部简短进度、全宽场景和底部操作带；答案按钮最小 88px 高，手机纵向改为单列。

- [ ] **Step 4: 接入状态机、语音和动作反馈**

`app.js` 使用单一事件代理处理 `continue-course`、`open-project`、`answer`、`repeat-speech` 和 `continue-interaction`。正确答案锁定提交、触发场景动作 700–1000ms，然后显示继续按钮。英语互动先播放示范并显示三秒跟说节奏，再开放情境选择。课程配置或本地 SVG 引用异常时捕获错误、清除活动快照并回到地图，避免空白页。

Run: `npm test`

Expected: all unit tests PASS; old single-session rendering tests are replaced by map and lesson contracts.

- [ ] **Step 5: 提交地图与课程界面**

```bash
git add index.html styles.css src/app.js src/views tests/view-rendering.test.js
git commit -m "feat: build engineering world and lesson experience"
```

### Task 8: 成人课程表、筛选、学习详情与导出

**Files:**
- Create: `src/course-table.js`
- Create: `src/views/course-table-view.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Create: `tests/course-table.test.js`

**Interfaces:**
- Produces: `buildCourseRows(lessons, progress)`, `filterCourseRows(rows, filters)`, `focusCourseRows(rows, subject)`, `courseSummary(rows)`。
- Filters shape: `{ tier: 'all' | 1 | 2 | 3, subject: 'all' | 'chinese' | 'english' | 'math', regionId: 'all' | string, status: 'all' | LessonStatus }`。
- Produces: `renderCourseTable(model)`。

- [ ] **Step 1: 写五级状态、筛选和摘要的失败测试**

```js
test('course rows expose viewed and mastered as different states', () => {
  const lessons = LESSONS.slice(0, 2);
  const progress = {
    lessons: {
      [lessons[0].id]: { status: 'viewed', viewedAt: 1000, completedCount: 0, lastCompletedAt: null },
      [lessons[1].id]: { status: 'mastered', viewedAt: 1000, completedCount: 3, lastCompletedAt: 5000 },
    },
    skills: {},
  };
  const rows = buildCourseRows(lessons, progress);
  assert.equal(rows[0].status, 'viewed');
  assert.equal(rows[1].status, 'mastered');
});

test('filters combine tier, subject, region and status', () => {
  const rows = [
    { id: 'lesson-100', tier: 2, subjects: ['english'], regionId: 'harbor-island', status: 'reviewDue' },
    { id: 'lesson-101', tier: 2, subjects: ['math'], regionId: 'harbor-island', status: 'reviewDue' },
    { id: 'lesson-200', tier: 3, subjects: ['english'], regionId: 'future-shanghai', status: 'mastered' },
  ];
  const result = filterCourseRows(rows, {
    tier: 2,
    subject: 'all',
    regionId: 'harbor-island',
    status: 'reviewDue',
  });
  assert.deepEqual(result.map((row) => row.id), ['lesson-100', 'lesson-101']);
  assert.deepEqual(focusCourseRows(result, 'english').map((row) => row.id), ['lesson-100']);
});
```

- [ ] **Step 2: 运行课程表测试并确认失败**

Run: `node --test tests/course-table.test.js`

Expected: FAIL because course table modules do not exist.

- [ ] **Step 3: 实现课程行模型、组合筛选和摘要**

每行包括课程编号、标题、阶段、区域、汉字、英语词汇、句型、数学目标、预计时长、查看时间、完成次数、最近学习、提示次数和状态。排序按课程序号稳定排列。阶段、区域和状态筛选课程行；科目选择通过 `focusCourseRows` 仅展示含该科内容的行并聚焦对应内容列，使混合课程中的科目筛选仍有意义。摘要分别统计五种状态和三科覆盖量。

- [ ] **Step 4: 实现成人视图和 JSON 下载**

成人视图使用标签页切换“课程表”和“设置”。筛选使用原生 `<select>`，状态使用带文字和颜色标识的图例。导出按钮通过 `Blob` 和临时对象 URL 下载 `planet-engineering-progress.json`，随后调用 `URL.revokeObjectURL`。设置页保留声音开关，并提供需要连续两次明确点击的“重置学习记录”；重置只删除本游戏的 v1/v2 进度和活动快照键。存储不可用时在摘要上方显示明确提示。

Run: `node --test tests/course-table.test.js tests/view-rendering.test.js`

Expected: PASS for row mapping, combined filters, status labels, summary and HTML escaping.

- [ ] **Step 5: 提交课程表**

```bash
git add index.html styles.css src/app.js src/course-table.js src/views/course-table-view.js tests/course-table.test.js
git commit -m "feat: add parent course catalog and progress export"
```

### Task 9: 项目徽章、区域奖章与车辆车库

**Files:**
- Create: `src/honors.js`
- Create: `src/views/garage-view.js`
- Modify: `src/app.js`
- Modify: `styles.css`
- Create: `tests/honors.test.js`

**Interfaces:**
- Produces: `awardLessonCompletion(progress, lesson, mastery)`, `regionMedal(progress, regionId)`, `vehicleUnlocks(progress)`。
- Produces: `renderGarage(model)`。

- [ ] **Step 1: 写徽章幂等、奖章条件和车辆升级测试**

```js
test('project badge is awarded once after its review lesson', () => {
  const progress = { honors: [], vehicleUpgrades: [], lessons: {}, skills: {} };
  const reviewLesson = { id: 'lesson-003', projectId: 'project-001', phase: 'review' };
  const once = awardLessonCompletion(progress, reviewLesson, {});
  const twice = awardLessonCompletion(once, reviewLesson, {});
  assert.equal(once.honors.length, twice.honors.length);
});

test('gold medal requires completion and demonstrated mastery', () => {
  const projectIds = PROJECTS.filter((item) => item.regionId === 'sunny-town').map((item) => item.id);
  const regionLessons = LESSONS.filter((item) => projectIds.includes(item.projectId));
  const skillIds = [...new Set(regionLessons.flatMap((item) => [
    ...item.newChineseIds,
    ...item.newEnglishWordIds,
    ...item.newEnglishPatternIds,
    item.mathSkillId,
  ]).filter(Boolean))];
  const honors = projectIds.map((id) => `badge:${id}`);
  const goldSkills = Object.fromEntries(skillIds.map((id) => [id, { status: 'mastered' }]));
  assert.equal(regionMedal({ honors, skills: goldSkills }, 'sunny-town'), 'gold');
  assert.equal(regionMedal({ honors, skills: {} }, 'sunny-town'), 'bronze');
});
```

- [ ] **Step 2: 运行荣誉测试并确认失败**

Run: `node --test tests/honors.test.js`

Expected: FAIL because `src/honors.js` does not exist.

- [ ] **Step 3: 实现不与正确率绑定的项目徽章和有证据的区域奖章**

完成项目第三节获得项目徽章。铜章要求完成该区 15 个项目，银章要求该区至少 60% 技能达到掌握，金章要求至少 85%。答错次数不影响项目徽章。

- [ ] **Step 4: 实现车辆升级与车库展示**

升级在累计完成 3、9、18、30、45、60、75、90 个项目时解锁，内容依次为工作灯、车身贴纸、安全旗、强化轮胎、新涂装、工具箱、区域纪念章和总工程师冠灯。车库使用车辆图标和色块展示，不创建货币、价格或购买按钮。

完成第 30、60、90 个项目时分别解锁“大班小工程师”“幼小衔接工程师”“星球总工程师”阶段荣誉；同一荣誉 ID 只能写入一次。

Run: `node --test tests/honors.test.js`

Expected: PASS for idempotency, medal thresholds, milestone unlocks and no penalty from errors.

- [ ] **Step 5: 提交荣誉与车库**

```bash
git add src/honors.js src/views/garage-view.js src/app.js styles.css tests/honors.test.js
git commit -m "feat: add project honors and vehicle garage"
```

### Task 10: 浏览器降级、可访问性与端到端验收

**Files:**
- Modify: `src/audio.js`
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `README.md`
- Modify: tests only when an uncovered regression needs a focused assertion

**Interfaces:**
- Verification and browser integration only; no new public domain interface.

- [ ] **Step 1: 运行全部自动测试并修复回归**

Run: `npm test`

Expected: zero failures, zero skipped tests, and all curriculum/content integrity checks PASS.

- [ ] **Step 2: 启动本地服务器并跑通关键路径**

Run: `npm start`

Open: `http://localhost:4173`

Exercise: 新用户地图 → 第 1 节 → 一次三级提示 → 完成课程 → 课程表显示“已练习” → 刷新恢复 → 重玩不重复发奖 → 导出 JSON。

Expected: no console errors, no failed local resource requests, and progress survives refresh.

- [ ] **Step 3: 检查三种视口和全部主页面**

Capture and inspect map, lesson, completion, course table and garage at 1280×800, 1024×768 and 390×844. Assert in each viewport:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

Expected: scenes are nonblank; vehicles are fully visible; text does not overlap controls; the longest course title wraps inside its row; no touch target is smaller than 56×56.

- [ ] **Step 4: 验证语音、存储、动画和网络降级**

Run the first lesson with speech synthesis unavailable, Local Storage throwing on access, reduced motion enabled and network disabled after initial load. Confirm visible prompts permit completion, the storage warning appears, movement stops without hiding state changes, and all assets remain local.

- [ ] **Step 5: 更新说明并提交验收结果**

`README.md` must document the 270-lesson structure, three stages, exact content counts, local storage behavior, progress export, start/test commands, privacy boundaries and supported browsers.

```bash
git add README.md src/audio.js src/app.js styles.css tests
git commit -m "docs: verify and document expanded learning game"
```

- [ ] **Step 6: 最终验证并推送**

Run: `npm test`

Run: `git status --short`

Expected: all tests PASS and working tree is clean.

Run: `git push -u origin main`

Expected: the complete history is available at `git@github.com:Ai-LiteGame/PlanetEngineeringFleet.git`.
