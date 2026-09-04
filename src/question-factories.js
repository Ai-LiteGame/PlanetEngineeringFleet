import {
  CHINESE_ITEMS,
  ENGLISH_PATTERNS,
  ENGLISH_WORDS,
  getProject,
  LESSONS,
  MATH_SKILLS,
} from './curriculum/index.js';
import { selectReviewSkills } from './mastery.js';

const chineseById = new Map(CHINESE_ITEMS.map((item) => [item.id, item]));
const englishWordById = new Map(ENGLISH_WORDS.map((item) => [item.id, item]));
const englishPatternById = new Map(ENGLISH_PATTERNS.map((item) => [item.id, item]));
const mathById = new Map(MATH_SKILLS.map((item) => [item.id, item]));
const actionByVehicle = Object.freeze({
  excavator: 'dig',
  bulldozer: 'push',
  crane: 'lift',
  mixer: 'mix',
  'dump-truck': 'dump',
  roller: 'roll',
  forklift: 'load',
  'fire-truck': 'spray',
  snowplow: 'plow',
  'tunnel-drill': 'drill',
});
const SHAPES = Object.freeze([
  { id: 'shape-circle', label: '圆形', visual: '○' },
  { id: 'shape-square', label: '正方形', visual: '□' },
  { id: 'shape-triangle', label: '三角形', visual: '△' },
]);

function seededRandom(seed, lessonId) {
  let value = 2166136261;
  const source = `${lessonId}:${Number(seed) || 0}`;
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  value >>>= 0;
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function randomInteger(random, min, max) {
  return min + Math.floor(random() * ((max - min) + 1));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function takePrioritized(groups, count, random) {
  const selected = [];
  for (const group of groups) {
    for (const id of shuffled(unique(group), random)) {
      if (!selected.includes(id)) selected.push(id);
      if (selected.length === count) return selected;
    }
  }
  return selected;
}

function choice(id, label, visual = label) {
  return { id, label, visual, a11yLabel: label };
}

function languageChoices(answer, pool, labelFor, visualFor, random) {
  const labels = new Set([labelFor(answer)]);
  const distractors = [];
  for (const item of shuffled(pool, random)) {
    const label = labelFor(item);
    if (item.tier !== answer.tier || item.id === answer.id || labels.has(label)) continue;
    labels.add(label);
    distractors.push(item);
    if (distractors.length === 2) break;
  }
  return shuffled([answer, ...distractors], random).map((item) => (
    choice(item.id, labelFor(item), visualFor(item))
  ));
}

function interaction(fields) {
  return {
    id: '',
    kind: fields.kind,
    subject: fields.subject,
    skillIds: [...fields.skillIds],
    prompt: fields.prompt,
    speech: { text: fields.speech.text, lang: fields.speech.lang },
    choices: fields.choices.map((item) => ({ ...item })),
    answerId: fields.answerId,
    success: fields.success,
    hint: fields.hint,
    action: fields.action,
  };
}

function chineseRecognition(item, random) {
  return interaction({
    kind: 'chinese-listen',
    subject: 'chinese',
    skillIds: [item.id],
    prompt: `听一听，找到“${item.char}”字。`,
    speech: { text: `请找到${item.char}字`, lang: 'zh-CN' },
    choices: languageChoices(item, CHINESE_ITEMS, (entry) => entry.char, (entry) => entry.char, random),
    answerId: item.id,
    success: `找到了“${item.char}”，${item.word}。`,
    hint: `答案是“${item.char}”，它出现在“${item.word}”里。`,
    action: 'dig',
  });
}

function chineseWordMatch(item, random) {
  return interaction({
    kind: 'chinese-word-match',
    subject: 'chinese',
    skillIds: [item.id],
    prompt: `“${item.char}”可以组成哪个词语？`,
    speech: { text: `${item.char}可以组成哪个词语`, lang: 'zh-CN' },
    choices: languageChoices(item, CHINESE_ITEMS, (entry) => entry.word, (entry) => entry.word, random),
    answerId: item.id,
    success: `${item.char}可以组成“${item.word}”。`,
    hint: item.example,
    action: 'dig',
  });
}

function englishListen(item, random) {
  return interaction({
    kind: 'english-listen-image',
    subject: 'english',
    skillIds: [item.id],
    prompt: '听一听，选择对应的图。',
    speech: { text: item.word, lang: 'en-US' },
    choices: languageChoices(item, ENGLISH_WORDS, (entry) => entry.meaning, (entry) => entry.meaning, random),
    answerId: item.id,
    success: `${item.word}，${item.meaning}。`,
    hint: `听到“${item.word}”时，选择“${item.meaning}”。`,
    action: 'load',
  });
}

function englishPatternContext(item, random) {
  return interaction({
    kind: 'english-pattern-context',
    subject: 'english',
    skillIds: [item.id],
    prompt: '工程队长说了什么？',
    speech: { text: item.text, lang: 'en-US' },
    choices: languageChoices(item, ENGLISH_PATTERNS, (entry) => entry.meaning, (entry) => entry.meaning, random),
    answerId: item.id,
    success: `${item.text} ${item.meaning}`,
    hint: `这句话的意思是“${item.meaning}”。`,
    action: 'signal',
  });
}

function numericChoices(answer, skill, random) {
  const values = [answer];
  const offsets = shuffled([-2, -1, 1, 2, -3, 3], random);
  for (const offset of offsets) {
    const candidate = answer + offset;
    if (candidate >= skill.min && candidate <= skill.max && !values.includes(candidate)) values.push(candidate);
    if (values.length === 3) break;
  }
  for (let candidate = skill.min; values.length < 3 && candidate <= skill.max; candidate += 1) {
    if (!values.includes(candidate)) values.push(candidate);
  }
  return shuffled(values, random).map((value) => choice(`number-${value}`, String(value)));
}

function numericInteraction(skill, kind, prompt, speech, answer, success, hint, random, action = 'lift') {
  return interaction({
    kind,
    subject: 'math',
    skillIds: [skill.id],
    prompt,
    speech: { text: speech, lang: 'zh-CN' },
    choices: numericChoices(answer, skill, random),
    answerId: `number-${answer}`,
    success,
    hint,
    action,
  });
}

function countQuestion(skill, random) {
  const answer = randomInteger(random, skill.min, skill.max);
  return numericInteraction(
    skill,
    'math-count',
    `哪辆车装了 ${answer} 块材料？`,
    `哪辆车装了${answer}块材料`,
    answer,
    `正好是 ${answer} 块。`,
    `一边点，一边数到 ${answer}。`,
    random,
  );
}

function additionQuestion(skill, random) {
  const left = randomInteger(random, 0, Math.max(1, skill.max - 1));
  const right = randomInteger(random, 0, skill.max - left);
  const answer = left + right;
  return numericInteraction(
    skill,
    'math-addition',
    `车上有 ${left} 块，再装 ${right} 块，一共有几块？`,
    `车上有${left}块，再装${right}块，一共有几块`,
    answer,
    `${left} 加 ${right} 等于 ${answer}。`,
    `从 ${left} 接着数 ${right} 个。`,
    random,
    'load',
  );
}

function subtractionQuestion(skill, random) {
  const left = randomInteger(random, Math.max(1, skill.min), skill.max);
  const right = randomInteger(random, 0, left);
  const answer = left - right;
  return numericInteraction(
    skill,
    'math-subtraction',
    `${left} 块材料运走 ${right} 块，还剩几块？`,
    `${left}块材料运走${right}块，还剩几块`,
    answer,
    `${left} 减 ${right} 等于 ${answer}。`,
    `从 ${left} 去掉 ${right} 个。`,
    random,
    'deliver',
  );
}

function comparisonQuestion(skill, random) {
  const left = randomInteger(random, skill.min, skill.max - 1);
  const right = randomInteger(random, left + 1, skill.max);
  const reversed = random() < 0.5;
  const values = reversed ? [right, left] : [left, right];
  const answerId = reversed ? 'compare-left' : 'compare-right';
  return interaction({
    kind: 'math-comparison',
    subject: 'math',
    skillIds: [skill.id],
    prompt: `${values[0]} 和 ${values[1]}，哪边更多？`,
    speech: { text: `${values[0]}和${values[1]}，哪边更多`, lang: 'zh-CN' },
    choices: [choice('compare-left', `左边 ${values[0]}`), choice('compare-right', `右边 ${values[1]}`), choice('compare-same', '一样多')],
    answerId,
    success: `${right} 比 ${left} 多。`,
    hint: '分别数一数，再找较大的数。',
    action: 'lift',
  });
}

function patternQuestion(skill, random) {
  const first = randomInteger(random, skill.min, Math.max(skill.min, skill.max - 1));
  const second = Math.min(skill.max, first + 1);
  return numericInteraction(
    skill,
    'math-pattern',
    `${first}、${second}、${first}、${second}，下一个是什么？`,
    `${first}，${second}，${first}，${second}，下一个是什么`,
    first,
    `按规律，下一个是 ${first}。`,
    `这两个数轮流出现：${first}、${second}。`,
    random,
    'signal',
  );
}

function spaceQuestion(skill, random) {
  const answer = SHAPES[randomInteger(random, 0, SHAPES.length - 1)];
  return interaction({
    kind: 'math-space',
    subject: 'math',
    skillIds: [skill.id],
    prompt: `哪块${answer.label}能补好施工面？`,
    speech: { text: `找到${answer.label}`, lang: 'zh-CN' },
    choices: shuffled(SHAPES, random).map((item) => choice(item.id, item.label, item.visual)),
    answerId: answer.id,
    success: `${answer.label}正好匹配。`,
    hint: `答案是${answer.label}。`,
    action: 'place',
  });
}

function classificationQuestion(skill, random) {
  const answerId = 'classify-triangle';
  return interaction({
    kind: 'math-classification',
    subject: 'math',
    skillIds: [skill.id],
    prompt: '哪一块和另外两块不是同一类？',
    speech: { text: '哪一块和另外两块不是同一类', lang: 'zh-CN' },
    choices: shuffled([
      choice('classify-red-circle', '红色圆形', '红 ○'),
      choice('classify-blue-circle', '蓝色圆形', '蓝 ○'),
      choice(answerId, '黄色三角形', '黄 △'),
    ], random),
    answerId,
    success: '三角形和两个圆形不是同一类。',
    hint: '先比较每一块的形状。',
    action: 'sort',
  });
}

function measurementQuestion(skill, random) {
  const answer = randomInteger(random, Math.max(skill.min, 2), skill.max);
  return numericInteraction(
    skill,
    'math-measurement',
    `哪根材料长 ${answer} 格？`,
    `哪根材料长${answer}格`,
    answer,
    `这根材料长 ${answer} 格。`,
    '从起点开始，一格一格量。',
    random,
  );
}

function clockQuestion(skill, random) {
  const answer = randomInteger(random, skill.min, Math.min(skill.max, 12));
  return numericInteraction(
    skill,
    'math-clock',
    `时针指向 ${answer}，现在是几点？`,
    `时针指向${answer}，现在是几点`,
    answer,
    `现在是 ${answer} 点。`,
    '短针指向的数字表示几点。',
    random,
    'signal',
  );
}

function moneyQuestion(skill, random) {
  const answer = randomInteger(random, skill.min, skill.max);
  return numericInteraction(
    skill,
    'math-money',
    `购买材料需要 ${answer} 元，应选择多少钱？`,
    `购买材料需要${answer}元，应选择多少钱`,
    answer,
    `正好是 ${answer} 元。`,
    '把钱上的数字和价格对一对。',
    random,
    'load',
  );
}

function wordProblemQuestion(skill, random) {
  const left = randomInteger(random, 0, Math.max(1, skill.max - 1));
  const right = randomInteger(random, 0, skill.max - left);
  const answer = left + right;
  return numericInteraction(
    skill,
    'math-word-problem',
    `第一辆车送来 ${left} 块，第二辆送来 ${right} 块，一共有几块？`,
    `第一辆车送来${left}块，第二辆送来${right}块，一共有几块`,
    answer,
    `一共有 ${answer} 块。`,
    '把两辆车送来的数量合起来。',
    random,
    'deliver',
  );
}

const mathFactories = {
  'number-sense': countQuestion,
  addition: additionQuestion,
  subtraction: subtractionQuestion,
  comparison: comparisonQuestion,
  pattern: patternQuestion,
  classification: classificationQuestion,
  space: spaceQuestion,
  measurement: measurementQuestion,
  clock: clockQuestion,
  money: moneyQuestion,
  'word-problem': wordProblemQuestion,
};

function mathInteraction(skill, random) {
  return (mathFactories[skill.domain] ?? countQuestion)(skill, random);
}

function priorProjectSkillIds(lesson) {
  return LESSONS
    .filter((candidate) => candidate.projectId === lesson.projectId && candidate.ordinal < lesson.ordinal)
    .flatMap((candidate) => [
      ...candidate.newChineseIds,
      ...candidate.newEnglishWordIds,
      ...candidate.newEnglishPatternIds,
      candidate.mathSkillId,
    ]);
}

function interactionForSkill(skillId, random) {
  if (chineseById.has(skillId)) return chineseRecognition(chineseById.get(skillId), random);
  if (englishWordById.has(skillId)) return englishListen(englishWordById.get(skillId), random);
  if (englishPatternById.has(skillId)) return englishPatternContext(englishPatternById.get(skillId), random);
  if (mathById.has(skillId)) return mathInteraction(mathById.get(skillId), random);
  return null;
}

function mixedDelivery(chineseItem, englishItem, mathSkill, random) {
  const amount = randomInteger(random, Math.max(1, mathSkill.min), Math.max(1, mathSkill.max));
  const wrongAmount = amount < mathSkill.max ? amount + 1 : amount - 1;
  const englishLabel = englishItem.word ?? englishItem.text;
  const englishMeaning = englishItem.meaning;
  return interaction({
    kind: 'mixed-delivery',
    subject: 'mixed',
    skillIds: unique([chineseItem.id, englishItem.id, mathSkill.id]),
    prompt: `把 ${amount} 块写着“${chineseItem.char}”的材料送到 ${englishLabel} 工位。`,
    speech: { text: `把${amount}块写着${chineseItem.char}的材料送到${englishLabel}工位`, lang: 'zh-CN' },
    choices: shuffled([
      choice('delivery-correct', `${chineseItem.char} · ${amount} · ${englishMeaning}`),
      choice('delivery-count', `${chineseItem.char} · ${wrongAmount} · ${englishMeaning}`),
      choice('delivery-language', `${chineseItem.char} · ${amount} · 其他工位`),
    ], random),
    answerId: 'delivery-correct',
    success: '材料全部送到正确工位。',
    hint: `先找“${chineseItem.char}”，再数 ${amount} 块，最后听 ${englishLabel}。`,
    action: 'deliver',
  });
}

export function buildLessonInteractions(lesson, progress = {}, seed = 0, now = Date.now()) {
  if (!lesson || typeof lesson.id !== 'string' || !mathById.has(lesson.mathSkillId)) {
    throw new TypeError('A valid curriculum lesson is required');
  }

  const random = seededRandom(seed, lesson.id);
  const dueIds = selectReviewSkills(progress, lesson, 16, now).map((record) => record.id);
  const previousIds = priorProjectSkillIds(lesson);
  const introducedIds = [
    ...lesson.newChineseIds,
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
    lesson.mathSkillId,
  ];
  const tierChineseIds = CHINESE_ITEMS.filter((item) => item.tier === lesson.tier).map((item) => item.id);
  const tierWordIds = ENGLISH_WORDS.filter((item) => item.tier === lesson.tier).map((item) => item.id);
  const tierPatternIds = ENGLISH_PATTERNS.filter((item) => item.tier === lesson.tier).map((item) => item.id);

  const warmupIds = takePrioritized(
    [dueIds, previousIds, introducedIds],
    2,
    random,
  );
  const warmups = warmupIds.map((id) => interactionForSkill(id, random)).filter(Boolean);
  while (warmups.length < 2) warmups.push(mathInteraction(mathById.get(lesson.mathSkillId), random));

  const chineseIds = takePrioritized([
    lesson.newChineseIds,
    dueIds.filter((id) => chineseById.has(id)),
    previousIds.filter((id) => chineseById.has(id)),
    tierChineseIds,
  ], 3, random);
  const chinese = chineseIds.map((id, index) => (
    index % 2 === 0
      ? chineseRecognition(chineseById.get(id), random)
      : chineseWordMatch(chineseById.get(id), random)
  ));

  const wordIds = takePrioritized([
    lesson.newEnglishWordIds,
    dueIds.filter((id) => englishWordById.has(id)),
    previousIds.filter((id) => englishWordById.has(id)),
    tierWordIds,
  ], 2, random);
  const patternIds = takePrioritized([
    lesson.newEnglishPatternIds,
    dueIds.filter((id) => englishPatternById.has(id)),
    previousIds.filter((id) => englishPatternById.has(id)),
    tierPatternIds,
  ], 1, random);
  const english = shuffled([
    ...wordIds.map((id) => englishListen(englishWordById.get(id), random)),
    ...patternIds.map((id) => englishPatternContext(englishPatternById.get(id), random)),
  ], random);

  const mathSkill = mathById.get(lesson.mathSkillId);
  const projectAction = actionByVehicle[getProject(lesson.projectId)?.vehicle] ?? 'dig';
  const math = Array.from({ length: 3 }, () => mathInteraction(mathSkill, random));
  const mixedChinese = chineseById.get(chineseIds[0]);
  const mixedEnglish = englishWordById.get(wordIds[0]) ?? englishPatternById.get(patternIds[0]);
  const result = [
    ...warmups,
    ...chinese,
    ...english,
    ...math,
    mixedDelivery(mixedChinese, mixedEnglish, mathSkill, random),
  ];

  return result.map((item, index) => ({
    ...item,
    id: `${lesson.id}-interaction-${String(index + 1).padStart(2, '0')}`,
    action: projectAction,
  }));
}
