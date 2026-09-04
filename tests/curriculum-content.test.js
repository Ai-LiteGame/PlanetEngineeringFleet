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

test('curriculum tier distributions match the long-form progression', () => {
  assert.deepEqual(
    [1, 2, 3].map((tier) => CHINESE_ITEMS.filter((item) => item.tier === tier).length),
    [200, 250, 250],
  );
  assert.deepEqual(
    [1, 2, 3].map((tier) => ENGLISH_WORDS.filter((item) => item.tier === tier).length),
    [90, 100, 110],
  );
  assert.deepEqual(
    [1, 2, 3].map((tier) => ENGLISH_PATTERNS.filter((item) => item.tier === tier).length),
    [30, 35, 35],
  );
});

test('every curriculum item satisfies its schema', () => {
  assert.equal(CHINESE_ITEMS.every(validateChineseItem), true);
  assert.equal(ENGLISH_WORDS.every(validateEnglishWord), true);
  assert.equal(ENGLISH_PATTERNS.every(validateEnglishPattern), true);
  assert.equal(MATH_SKILLS.every(validateMathSkill), true);
});

test('Chinese items use specific word associations and varied matching contexts', () => {
  const naturalCharacterCompounds = new Set(['文字', '写字', '名字', '数字']);
  assert.equal(
    CHINESE_ITEMS
      .filter(({ char, word }) => word === `${char}字`)
      .every(({ word }) => naturalCharacterCompounds.has(word)),
    true,
  );
  assert.equal(CHINESE_ITEMS.every(({ word }) => Array.from(word).length >= 2), true);
  assert.equal(CHINESE_ITEMS.every(({ word, example }) => example.includes(word)), true);
  assert.equal(
    CHINESE_ITEMS.some(({ char, example }) => example === `我在课本里认识${char}字。`),
    false,
  );
  assert.equal(new Set(CHINESE_ITEMS.map(({ example }) => example)).size, 700);
  assert.deepEqual(CHINESE_ITEMS[418], {
    id: 'zh-419', char: '银', word: '金银', example: '老师用金银讲解不同的金属。', tier: 2,
  });
});

test('math inventory covers every required learning domain', () => {
  const domains = new Set(MATH_SKILLS.map((item) => item.domain));
  for (const domain of [
    'number-sense', 'addition', 'subtraction', 'comparison', 'pattern',
    'classification', 'space', 'measurement', 'clock', 'money', 'word-problem',
  ]) {
    assert.equal(domains.has(domain), true, `missing ${domain}`);
  }
});
