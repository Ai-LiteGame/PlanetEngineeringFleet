import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHINESE_ITEMS,
  ENGLISH_PATTERNS,
  ENGLISH_WORDS,
  LESSONS,
  MATH_SKILLS,
} from '../src/curriculum/index.js';
import { buildLessonInteractions } from '../src/question-factories.js';
import { createSkillRecord } from '../src/mastery.js';
import { createProgressV2 } from '../src/storage.js';

const languageTierById = new Map([
  ...CHINESE_ITEMS,
  ...ENGLISH_WORDS,
  ...ENGLISH_PATTERNS,
].map((item) => [item.id, item.tier]));

const chineseById = new Map(CHINESE_ITEMS.map((item) => [item.id, item]));
const englishWordById = new Map(ENGLISH_WORDS.map((item) => [item.id, item]));
const englishPatternById = new Map(ENGLISH_PATTERNS.map((item) => [item.id, item]));

function learnerText(interaction) {
  return [
    interaction.prompt,
    interaction.speech?.text,
    interaction.success,
    interaction.hint,
    ...interaction.choices.flatMap((item) => [item.label, item.visual]),
  ].filter(Boolean).join(' ');
}

function expectedSkillTokens(skillId) {
  const chinese = chineseById.get(skillId);
  if (chinese) return [chinese.char, chinese.word];
  const word = englishWordById.get(skillId);
  if (word) return [word.word, word.meaning];
  const pattern = englishPatternById.get(skillId);
  if (pattern) {
    return pattern.text
      .replace(/\{[^}]+\}/g, '')
      .split(/[^A-Za-z]+/)
      .filter((token) => token.length >= 2);
  }
  return [];
}

function progressWithBalancedHistory(lesson) {
  const earlierIds = LESSONS
    .filter((item) => item.ordinal < lesson.ordinal)
    .flatMap((item) => [
      ...item.newChineseIds,
      ...item.newEnglishWordIds,
      ...item.newEnglishPatternIds,
      item.mathSkillId,
    ]);
  const idsBySubject = [
    earlierIds.filter((id) => chineseById.has(id)).slice(-3),
    earlierIds.filter((id) => englishWordById.has(id) || englishPatternById.has(id)).slice(-3),
    earlierIds.filter((id) => MATH_SKILLS.some((skill) => skill.id === id)).slice(-3),
  ];
  if (idsBySubject.some((ids) => ids.length < 2)) return null;
  return createProgressV2({
    skills: Object.fromEntries(idsBySubject.flat().map((id) => [id, {
      ...createSkillRecord(),
      exposures: 1,
      status: 'practicing',
    }])),
  });
}

test('a lesson builds twelve serializable interactions with a mixed final task', () => {
  const interactions = buildLessonInteractions(LESSONS[0], createProgressV2(), 9, 1000);

  assert.equal(interactions.length, 12);
  assert.equal(interactions.at(-1).subject, 'mixed');
  assert.equal(interactions.every((item) => item.choices.some((choice) => choice.id === item.answerId)), true);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(interactions)));
});

test('every assigned language skill appears in playable lesson semantics with the exact block structure', () => {
  const coveredChinese = new Set();
  const coveredWords = new Set();
  const coveredPatterns = new Set();

  for (const lesson of LESSONS) {
    for (const progress of [createProgressV2(), progressWithBalancedHistory(lesson)].filter(Boolean)) {
      const interactions = buildLessonInteractions(lesson, progress, 19, 1000);
      assert.deepEqual(
        interactions.map((item) => item.segment),
        ['warmup', 'warmup', 'chinese', 'chinese', 'chinese', 'english', 'english', 'english', 'math', 'math', 'math', 'mixed'],
        lesson.id,
      );

      const assignedIds = [
        ...lesson.newChineseIds,
        ...lesson.newEnglishWordIds,
        ...lesson.newEnglishPatternIds,
      ];
      for (const skillId of assignedIds) {
        const matches = interactions.filter((item) => item.skillIds.includes(skillId));
        assert.equal(matches.length > 0, true, `${lesson.id} does not play ${skillId}`);
        assert.equal(
          matches.some((item) => expectedSkillTokens(skillId).every((token) => learnerText(item).includes(token))),
          true,
          `${lesson.id} credits ${skillId} without showing and speaking its meaning`,
        );
        if (chineseById.has(skillId)) coveredChinese.add(skillId);
        if (englishWordById.has(skillId)) coveredWords.add(skillId);
        if (englishPatternById.has(skillId)) coveredPatterns.add(skillId);
      }

      for (const item of interactions.filter((interaction) => interaction.skillIds.length > 1)) {
        const correctChoice = item.choices.find((choice) => choice.id === item.answerId);
        assert.deepEqual(
          new Set(correctChoice.skillIds),
          new Set(item.skillIds),
          `${item.id} must make every credited skill part of the correct child action`,
        );
      }
    }
  }

  assert.equal(coveredChinese.size, CHINESE_ITEMS.length);
  assert.equal(coveredWords.size, ENGLISH_WORDS.length);
  assert.equal(coveredPatterns.size, ENGLISH_PATTERNS.length);
});

test('every learner-facing sentence pattern is deterministically instantiated without slot markers', () => {
  for (const lesson of LESSONS.filter((item) => item.newEnglishPatternIds.length > 0)) {
    const first = buildLessonInteractions(lesson, createProgressV2(), 31, 1000);
    const second = buildLessonInteractions(lesson, createProgressV2(), 31, 1000);
    assert.deepEqual(first, second, lesson.id);

    for (const patternId of lesson.newEnglishPatternIds) {
      const item = first.find((interaction) => interaction.skillIds.includes(patternId));
      assert.ok(item, `${lesson.id} must include ${patternId}`);
      assert.equal(item.kind, 'english-pattern-context');
      assert.equal(/\{[^}]+\}/.test(learnerText(item)), false, item.id);
      assert.equal(item.speech.text.includes('{'), false, item.id);
      assert.equal(item.choices.some((choice) => choice.id === item.answerId), true, item.id);
    }
  }
});

test('visual math questions encode quantities and values children must interpret', () => {
  const requiredDomains = ['number-sense', 'measurement', 'clock', 'money'];
  for (const domain of requiredDomains) {
    for (const tier of [1, 2, 3]) {
      const lesson = LESSONS.find((item) => {
        const skill = MATH_SKILLS.find((candidate) => candidate.id === item.mathSkillId);
        return skill?.domain === domain && item.tier === tier;
      });
      const items = buildLessonInteractions(lesson, createProgressV2(), 23, 1000)
        .filter((item) => item.subject === 'math');

      for (const item of items) {
        assert.equal(typeof item.problem, 'object', item.id);
        const correct = item.choices.find((choice) => choice.id === item.answerId);
        assert.ok(correct, item.id);
        assert.notEqual(correct.visual, correct.label, item.id);
        if (domain === 'number-sense') {
          assert.equal(correct.quantity, item.problem.targetQuantity, item.id);
          assert.equal((correct.groups.tens * 10) + correct.groups.ones, correct.quantity, item.id);
          assert.equal(correct.visual.includes('▦'), correct.groups.tens > 0, item.id);
          assert.equal(correct.visual.includes(item.problem.unitGlyph), correct.groups.ones > 0, item.id);
          assert.equal(item.prompt.includes(String(item.problem.targetQuantity)), false, item.id);
        } else if (domain === 'measurement') {
          const lengths = item.choices.map((choice) => choice.length);
          assert.equal(correct.length, item.problem.ask === 'longest' ? Math.max(...lengths) : Math.min(...lengths), item.id);
          assert.equal(item.choices.every((choice) => choice.visual.length > 0), true, item.id);
        } else if (domain === 'clock') {
          assert.deepEqual(correct.time, item.problem.time, item.id);
          assert.equal(item.problem.time.minute % (tier === 1 ? 60 : tier === 2 ? 30 : 15), 0, item.id);
          assert.equal(item.choices.every((choice) => /钟面/.test(choice.visual)), true, item.id);
        } else {
          assert.equal(correct.coins.reduce((sum, coin) => sum + coin, 0), item.problem.price, item.id);
          assert.equal(item.choices.every((choice) => choice.visual.includes('元')), true, item.id);
        }
      }
    }
  }
});

test('classification and space questions become more relational across tiers', () => {
  for (const domain of ['classification', 'space']) {
    const semantics = [];
    for (const tier of [1, 2, 3]) {
      const lesson = LESSONS.find((item) => {
        const skill = MATH_SKILLS.find((candidate) => candidate.id === item.mathSkillId);
        return skill?.domain === domain && item.tier === tier;
      });
      const item = buildLessonInteractions(lesson, createProgressV2(), 17, 1000)
        .find((interaction) => interaction.subject === 'math');
      assert.equal(item.problem.tier, tier, item.id);
      assert.equal(typeof item.problem.rule, 'string', item.id);
      assert.equal(item.choices.every((choice) => typeof choice.semantic === 'object'), true, item.id);
      semantics.push(item.problem.rule);
    }
    assert.equal(new Set(semantics).size, 3, `${domain} must use a distinct semantic rule at each tier`);
  }
});

test('same lesson seed and progress produce the same interaction order', () => {
  const progress = createProgressV2();
  const first = buildLessonInteractions(LESSONS[0], progress, 42, 1000);
  const second = buildLessonInteractions(LESSONS[0], progress, 42, 1000);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, buildLessonInteractions(LESSONS[0], progress, 43, 1000));
});

test('lessons allocate about one current interaction for every two review interactions', () => {
  const lesson = LESSONS.find((item) => item.id === 'lesson-008');
  const eligibleIds = [...new Set(LESSONS.slice(0, 7).flatMap((item) => [
    ...item.newChineseIds,
    ...item.newEnglishWordIds,
    ...item.newEnglishPatternIds,
    item.mathSkillId,
  ]))];
  const progress = createProgressV2({
    skills: Object.fromEntries(eligibleIds.map((id) => [id, {
      ...createSkillRecord(), exposures: 1, status: 'practicing',
    }])),
  });
  const currentIds = new Set([
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
    lesson.mathSkillId,
  ]);

  const interactions = buildLessonInteractions(lesson, progress, 5, 1000);
  const currentCount = interactions.filter((item) => item.skillIds.some((id) => currentIds.has(id))).length;
  const reviewCount = interactions.filter((item) => item.skillIds.every((id) => !currentIds.has(id))).length;

  assert.deepEqual({ currentCount, reviewCount }, { currentCount: 4, reviewCount: 8 });
});

test('unbalanced review history preserves the subject-specific interaction blocks', () => {
  const lesson = LESSONS.find((item) => item.id === 'lesson-004');
  const chineseHistoryIds = LESSONS.slice(0, 2).flatMap((item) => item.newChineseIds);
  const progress = createProgressV2({
    skills: Object.fromEntries(chineseHistoryIds.map((id) => [id, {
      ...createSkillRecord(), exposures: 1, status: 'practicing',
    }])),
  });

  const interactions = buildLessonInteractions(lesson, progress, 5, 1000);
  const currentIdsBySubject = {
    chinese: new Set(lesson.newChineseIds),
    english: new Set([...lesson.newEnglishWordIds, ...lesson.newEnglishPatternIds]),
    math: new Set([lesson.mathSkillId]),
  };

  assert.deepEqual(interactions.slice(2, 5).map((item) => item.subject), Array(3).fill('chinese'));
  assert.deepEqual(interactions.slice(5, 8).map((item) => item.subject), Array(3).fill('english'));
  assert.deepEqual(interactions.slice(8, 11).map((item) => item.subject), Array(3).fill('math'));
  for (const interaction of interactions.slice(2, 11)) {
    assert.equal(interaction.skillIds.every((id) => currentIdsBySubject[interaction.subject].has(id)), true);
  }
  assert.equal(interactions.at(-1).subject, 'mixed');
});

test('language distractors are distinct from the answer and stay in the lesson tier', () => {
  const lesson = LESSONS.find((item) => item.tier === 2 && item.phase === 'learn');
  const interactions = buildLessonInteractions(lesson, createProgressV2(), 7, 1000);

  for (const interaction of interactions.filter((item) => item.subject === 'chinese' || item.subject === 'english')) {
    const choiceIds = interaction.choices.map((choice) => choice.id);
    assert.equal(new Set(choiceIds).size, choiceIds.length);
    assert.equal(choiceIds.filter((id) => id === interaction.answerId).length, 1);
    for (const id of choiceIds) assert.equal(languageTierById.get(id), lesson.tier);
  }
});

test('English image choices use unique pictograms rather than duplicated translations', () => {
  let imageInteractionCount = 0;
  for (const lesson of LESSONS) {
    const interactions = buildLessonInteractions(lesson, createProgressV2(), 7, 1000);
    for (const interaction of interactions.filter((item) => item.kind === 'english-listen-image')) {
      imageInteractionCount += 1;
      const visuals = interaction.choices.map((item) => item.visual);
      assert.equal(interaction.choices.every((item) => item.visual !== item.label), true, interaction.id);
      assert.equal(new Set(visuals).size, visuals.length, interaction.id);
    }
  }
  assert.equal(imageInteractionCount > 0, true);
});

test('abstract English words use context choices instead of image choices', () => {
  const interactions = buildLessonInteractions(LESSONS[0], createProgressV2(), 7, 1000);
  const helloInteractions = interactions.filter((item) => (
    item.subject === 'english' && item.skillIds.includes('en-word-001')
  ));

  assert.equal(helloInteractions.length > 0, true);
  assert.equal(helloInteractions.every((item) => item.kind === 'english-context-choice'), true);
});

test('word-match distractors never duplicate the displayed answer label', () => {
  const lesson = LESSONS.find((item) => item.id === 'lesson-047');
  const interactions = buildLessonInteractions(lesson, createProgressV2(), 5, 1000);

  for (const interaction of interactions.filter((item) => item.kind === 'chinese-word-match')) {
    const labels = interaction.choices.map((choice) => choice.label);
    assert.equal(new Set(labels).size, labels.length);
  }
});

test('word-match questions have only one choice containing the prompted character', () => {
  for (const lesson of LESSONS) {
    for (const seed of [2, 9, 22]) {
      const interactions = buildLessonInteractions(lesson, createProgressV2(), seed, 1000);
      for (const interaction of interactions.filter((item) => item.kind === 'chinese-word-match')) {
        const character = interaction.prompt.match(/“(.)”/)[1];
        const semanticAnswers = interaction.choices.filter((item) => item.label.includes(character));
        assert.deepEqual(semanticAnswers.map((item) => item.id), [interaction.answerId], interaction.id);
      }
    }
  }
});

test('mixed delivery count distractors stay inside the lesson math range', () => {
  const interactions = buildLessonInteractions(LESSONS[0], createProgressV2(), 49, 1000);
  const countDistractor = interactions.at(-1).choices.find((item) => item.id === 'delivery-count');
  const displayedCount = Number(countDistractor.label.match(/ · (\d+) · /)[1]);

  assert.equal(displayedCount <= 10, true);
});

test('clock choices stay on the twelve-hour dial', () => {
  let clockInteractionCount = 0;
  for (const lesson of LESSONS) {
    for (const seed of [4, 11, 29]) {
      const interactions = buildLessonInteractions(lesson, createProgressV2(), seed, 1000);
      for (const interaction of interactions.filter((item) => item.kind === 'math-clock')) {
        clockInteractionCount += 1;
        const values = interaction.choices.map((item) => item.time.hour);
        assert.equal(values.every((value) => value >= 1 && value <= 12), true, interaction.id);
      }
    }
  }
  assert.equal(clockInteractionCount > 0, true);
});

test('a review lesson with empty new arrays uses prior project content', () => {
  const reviewLesson = LESSONS.find((lesson) => lesson.id === 'lesson-003');
  const priorSkillIds = new Set(LESSONS.slice(0, 2).flatMap((lesson) => [
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
    lesson.mathSkillId,
  ]));
  const interactions = buildLessonInteractions(reviewLesson, createProgressV2(), 11, 1000);

  assert.equal(interactions.length, 12);
  assert.equal(interactions.some((item) => item.skillIds.some((id) => priorSkillIds.has(id))), true);
  assert.equal(interactions.every((item) => item.skillIds.length > 0), true);
});

test('curriculum math domains route to their matching question factories', () => {
  const expectedKinds = new Map([
    ['math-number-sense-1', 'math-count'],
    ['math-addition-1', 'math-addition'],
    ['math-subtraction-1', 'math-subtraction'],
    ['math-comparison-1', 'math-comparison'],
    ['math-pattern-1', 'math-pattern'],
    ['math-space-1', 'math-space'],
  ]);

  for (const [skillId, kind] of expectedKinds) {
    const lesson = LESSONS.find((item) => item.mathSkillId === skillId);
    const interactions = buildLessonInteractions(lesson, createProgressV2(), 5, 1000);
    assert.equal(interactions.filter((item) => item.subject === 'math').every((item) => item.kind === kind), true);
  }
});

test('interaction actions stay inside the construction fleet vocabulary', () => {
  const supportedActions = new Set([
    'dig', 'push', 'lift', 'mix', 'dump', 'roll', 'load', 'spray', 'plow', 'drill',
  ]);

  for (const lesson of LESSONS) {
    const interactions = buildLessonInteractions(lesson, createProgressV2(), 5, 1000);
    assert.equal(interactions.every((item) => supportedActions.has(item.action)), true, lesson.id);
  }
});
