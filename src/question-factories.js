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
const ENGLISH_PICTOGRAMS = Object.freeze({
  truck: '🚚',
  mother: '👩',
  father: '👨',
  sister: '👧',
  brother: '👦',
  teacher: '🧑‍🏫',
  student: '🧑‍🎓',
  baby: '👶',
  boy: '🧒',
  girl: '👱‍♀️',
  home: '🏠',
  school: '🏫',
  room: '🛏️',
  door: '🚪',
  window: '🪟',
  book: '📖',
  pen: '🖊️',
  pencil: '✏️',
  paper: '📄',
  bag: '🎒',
  chair: '🪑',
  ball: '⚽',
  toy: '🧸',
  cat: '🐈',
  dog: '🐕',
  bird: '🐦',
  fish: '🐟',
  tree: '🌳',
  flower: '🌷',
  sun: '☀️',
  moon: '🌙',
  star: '⭐',
  rain: '🌧️',
  water: '💧',
  milk: '🥛',
  rice: '🍚',
  bread: '🍞',
  apple: '🍎',
  banana: '🍌',
  cake: '🍰',
  red: '🟥',
  blue: '🟦',
  yellow: '🟨',
  green: '🟩',
  black: '⬛',
  white: '⬜',
  one: '1️⃣',
  two: '2️⃣',
  three: '3️⃣',
  four: '4️⃣',
  five: '5️⃣',
  happy: '😀',
  sad: '😢',
  hot: '🔥',
  cold: '🧊',
  run: '🏃',
  walk: '🚶',
  jump: '🤸',
  sit: '🧎',
  stand: '🧍',
  look: '👀',
  eat: '🍽️',
  drink: '🧃',
  sleep: '😴',
  play: '🛝',
  help: '🤝',
  six: '6️⃣',
  seven: '7️⃣',
  eight: '8️⃣',
  nine: '9️⃣',
  ten: '🔟',
  eleven: '⑪',
  twelve: '⑫',
  morning: '🌅',
  afternoon: '🌞',
  evening: '🌆',
  spring: '🌱',
  summer: '🏖️',
  autumn: '🍂',
  winter: '⛄',
  cloud: '☁️',
  wind: '🌬️',
  snow: '❄️',
  sky: '🌌',
  river: '🏞️',
  lake: '🌊',
  mountain: '⛰️',
  grass: '🌿',
  leaf: '🍃',
  seed: '🌰',
  garden: '🏡',
  rabbit: '🐇',
  panda: '🐼',
  tiger: '🐅',
  elephant: '🐘',
  monkey: '🐒',
  duck: '🦆',
  chicken: '🐓',
  horse: '🐎',
  bus: '🚌',
  car: '🚗',
  train: '🚆',
  bike: '🚲',
  boat: '⛵',
  plane: '✈️',
  road: '🛣️',
  bridge: '🌉',
  station: '🚉',
  ticket: '🎫',
  build: '🏗️',
  draw: '🎨',
  read: '📚',
  write: '📝',
  count: '🔢',
  carry: '📦',
  wash: '🧼',
  careful: '⚠️',
  safe: '🦺',
  fast: '💨',
  slow: '🐌',
  round: '⚪',
  square: '◻️',
  triangle: '🔺',
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  orange: '🍊',
  grape: '🍇',
  noodle: '🍜',
  soup: '🥣',
  egg: '🥚',
  cheese: '🧀',
  spoon: '🥄',
  cup: '☕',
  plate: '🍽️',
  thirteen: '⑬',
  fourteen: '⑭',
  fifteen: '⑮',
  twenty: '⑳',
  hundred: '100',
  minute: '⏱️',
  hour: '🕐',
  week: '🗓️',
  month: '📅',
  rainbow: '🌈',
  storm: '⛈️',
  forest: '🌲',
  ocean: '🌊',
  island: '🏝️',
  rock: '🪨',
  soil: '🟫',
  plant: '🪴',
  bamboo: '🎋',
  butterfly: '🦋',
  bee: '🐝',
  frog: '🐸',
  turtle: '🐢',
  dolphin: '🐬',
  penguin: '🐧',
  whale: '🐋',
  squirrel: '🐿️',
  zebra: '🦓',
  giraffe: '🦒',
  ambulance: '🚑',
  'fire engine': '🚒',
  subway: '🚇',
  taxi: '🚕',
  helmet: '⛑️',
  engine: '⚙️',
  wheel: '🛞',
  ladder: '🪜',
  hammer: '🔨',
  rope: '🪢',
  brick: '🧱',
  tower: '🗼',
  robot: '🤖',
  rocket: '🚀',
  satellite: '🛰️',
  planet: '🪐',
  space: '🌠',
  map: '🗺️',
  crossing: '🚸',
  'traffic light': '🚦',
  repair: '🛠️',
  measure: '📏',
  compare: '⚖️',
  sort: '🗂️',
  choose: '☑️',
  check: '✅',
  experiment: '🧪',
  observe: '🔍',
  collect: '🧺',
  recycle: '♻️',
  protect: '🛡️',
  electricity: '🔌',
  battery: '🔋',
  screen: '🖥️',
  keyboard: '⌨️',
  camera: '📷',
  picture: '🖼️',
  music: '🎵',
  song: '🎤',
  dance: '💃',
  paint: '🖌️',
});

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

function choice(id, label, visual = label, details = {}) {
  return { id, label, visual, a11yLabel: label, ...details };
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
  const value = {
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
  if (fields.problem) value.problem = structuredClone(fields.problem);
  if (fields.visualPrompt) value.visualPrompt = fields.visualPrompt;
  return value;
}

function semanticChoice(item, skillIds = [item.id]) {
  return choice(item.id, item.label, item.visual, { skillIds: [...skillIds] });
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
  const unambiguousPool = CHINESE_ITEMS.filter((entry) => (
    entry.id === item.id || !entry.word.includes(item.char)
  ));
  return interaction({
    kind: 'chinese-word-match',
    subject: 'chinese',
    skillIds: [item.id],
    prompt: `“${item.char}”可以组成哪个词语？`,
    speech: { text: `${item.char}可以组成哪个词语`, lang: 'zh-CN' },
    choices: languageChoices(item, unambiguousPool, (entry) => entry.word, (entry) => entry.word, random),
    answerId: item.id,
    success: `${item.char}可以组成“${item.word}”。`,
    hint: item.example,
    action: 'dig',
  });
}

function chineseGroupMatch(items, random) {
  const targetChars = items.map((item) => item.char);
  const excludedChars = new Set(targetChars);
  const distractorPool = shuffled(CHINESE_ITEMS.filter((candidate) => (
    candidate.tier === items[0].tier
      && !items.some((item) => item.id === candidate.id)
      && [...excludedChars].every((char) => !candidate.word.includes(char))
  )), random);
  const alternatives = [items];
  let cursor = 0;
  while (alternatives.length < 3 && cursor + items.length <= distractorPool.length) {
    alternatives.push(distractorPool.slice(cursor, cursor + items.length));
    cursor += items.length;
  }
  const choices = alternatives.map((group) => semanticChoice({
    id: group[0].id,
    label: group.map((item) => item.word).join('、'),
    visual: group.map((item) => `${item.char}：${item.word}`).join('\n'),
  }, group.map((item) => item.id)));
  return interaction({
    kind: 'chinese-group-match',
    subject: 'chinese',
    skillIds: items.map((item) => item.id),
    prompt: `找到分别含有“${targetChars.join('、')}”的词语组。`,
    speech: { text: `找到分别含有${targetChars.join('、')}的词语组`, lang: 'zh-CN' },
    choices: shuffled(choices, random),
    answerId: items[0].id,
    success: `${targetChars.join('、')}分别组成${items.map((item) => item.word).join('、')}。`,
    hint: items.map((item) => item.example).join(' '),
    action: 'dig',
  });
}

function englishContextChoice(item, random) {
  return interaction({
    kind: 'english-context-choice',
    subject: 'english',
    skillIds: [item.id],
    prompt: '听一听，选择这个词在工程对话中的意思。',
    speech: { text: item.word, lang: 'en-US' },
    choices: languageChoices(item, ENGLISH_WORDS, (entry) => entry.meaning, (entry) => entry.meaning, random),
    answerId: item.id,
    success: `${item.word}，${item.meaning}。`,
    hint: `“${item.word}”的意思是“${item.meaning}”。`,
    action: 'signal',
  });
}

function englishImageChoices(answer, random) {
  const answerVisual = ENGLISH_PICTOGRAMS[answer.word];
  if (!answerVisual) return null;

  const labels = new Set([answer.meaning]);
  const visuals = new Set([answerVisual]);
  const distractors = [];
  for (const item of shuffled(ENGLISH_WORDS, random)) {
    const visual = ENGLISH_PICTOGRAMS[item.word];
    if (item.tier !== answer.tier
      || item.id === answer.id
      || !visual
      || labels.has(item.meaning)
      || visuals.has(visual)) continue;
    labels.add(item.meaning);
    visuals.add(visual);
    distractors.push(item);
    if (distractors.length === 2) break;
  }
  if (distractors.length < 2) return null;
  return shuffled([answer, ...distractors], random).map((item) => (
    choice(item.id, item.meaning, ENGLISH_PICTOGRAMS[item.word])
  ));
}

function englishListen(item, random) {
  const choices = englishImageChoices(item, random);
  if (!choices) return englishContextChoice(item, random);
  return interaction({
    kind: 'english-listen-image',
    subject: 'english',
    skillIds: [item.id],
    prompt: '听一听，选择对应的图。',
    speech: { text: item.word, lang: 'en-US' },
    choices,
    answerId: item.id,
    success: `${item.word}，${item.meaning}。`,
    hint: `听到“${item.word}”时，选择“${item.meaning}”。`,
    action: 'load',
  });
}

const SLOT_CATEGORIES = Object.freeze({
  item: ['home', 'school', 'play', 'engineering', 'nature'],
  thing: ['home', 'school', 'play', 'engineering', 'nature'],
  things: ['home', 'school', 'play', 'engineering', 'nature'],
  family: ['family'],
  color: ['color'],
  animal: ['animal'],
  food: ['food'],
  action: ['action'],
  place: ['place', 'transport'],
  number: ['number'],
  vehicle: ['vehicle'],
  clothing: ['clothing', 'safety'],
  tool: ['tool', 'engineering'],
  month: ['time', 'season'],
  season: ['season'],
});

const NAME_SLOT_VALUES = Object.freeze([
  { id: 'slot-name-ming', word: 'Ming', meaning: '小明', tier: 1 },
  { id: 'slot-name-lily', word: 'Lily', meaning: '莉莉', tier: 1 },
  { id: 'slot-name-leo', word: 'Leo', meaning: '利奥', tier: 1 },
]);

const ACTION_SLOT_PHRASES = Object.freeze({
  look: ['look around', '看看四周'],
  see: ['see the sign', '看见标志'],
  eat: ['eat lunch', '吃午饭'],
  drink: ['drink water', '喝水'],
  help: ['help the team', '帮助工程队'],
  open: ['open the gate', '打开大门'],
  close: ['close the gate', '关上大门'],
  make: ['make a sign', '制作标志'],
  draw: ['draw a line', '画一条线'],
  find: ['find the tools', '找到工具'],
  carry: ['carry the cones', '搬运路锥'],
  wash: ['wash the truck', '清洗卡车'],
  choose: ['choose a tool', '选择工具'],
  check: ['check the plan', '检查计划'],
  follow: ['follow the map', '按照地图走'],
  ready: ['get ready', '准备好'],
  can: ['start the job', '开始任务'],
  want: ['keep going', '继续前进'],
  need: ['ask for help', '请求帮助'],
});

function slotVocabulary(slot, tier) {
  if (slot === 'name') return NAME_SLOT_VALUES;
  const categories = SLOT_CATEGORIES[slot] ?? [];
  const exactTier = ENGLISH_WORDS.filter((word) => (
    word.tier === tier && categories.includes(word.category)
  ));
  const tierFallback = ENGLISH_WORDS.filter((word) => word.tier === tier);
  return exactTier.length > 0 ? exactTier : tierFallback;
}

function instantiatePattern(item, random) {
  const slotValues = item.slots.map((slot) => {
    const candidates = slotVocabulary(slot, item.tier);
    const word = candidates[randomInteger(random, 0, candidates.length - 1)];
    const phrase = slot === 'action' ? ACTION_SLOT_PHRASES[word.word] : null;
    return {
      slot,
      wordId: word.id,
      word: phrase?.[0] ?? word.word,
      meaning: phrase?.[1] ?? word.meaning,
      tier: word.tier,
    };
  });
  let text = item.text;
  let meaning = item.meaning;
  for (const value of slotValues) {
    text = text.replace(`{${value.slot}}`, value.word);
    meaning = meaning.replace('……', value.meaning);
  }
  return { ...item, text, meaning, slotValues };
}

function englishPatternContext(item, random) {
  const completed = instantiatePattern(item, random);
  const alternatives = shuffled(
    ENGLISH_PATTERNS.filter((candidate) => candidate.tier === item.tier && candidate.id !== item.id),
    random,
  ).slice(0, 2).map((candidate) => instantiatePattern(candidate, random));
  const choices = shuffled([completed, ...alternatives], random).map((candidate) => (
    choice(candidate.id, candidate.meaning, candidate.meaning, {
      skillIds: [candidate.id],
      patternText: candidate.text,
      slotValues: candidate.slotValues,
    })
  ));
  return interaction({
    kind: 'english-pattern-context',
    subject: 'english',
    skillIds: [item.id],
    prompt: '听工程队长和小司机对话，选择这句话的意思。',
    speech: { text: completed.text, lang: 'en-US' },
    choices,
    answerId: item.id,
    success: `${completed.text} ${completed.meaning}`,
    hint: `工程队长正在表达：${completed.meaning}`,
    action: 'signal',
  });
}

function englishGroupContext(items, random) {
  const resolvedItems = items.map((item) => (
    englishPatternById.has(item.id) ? instantiatePattern(item, random) : item
  ));
  const usedIds = new Set(items.map((item) => item.id));
  const takeAlternative = (item) => {
    const source = englishPatternById.has(item.id) ? ENGLISH_PATTERNS : ENGLISH_WORDS;
    const candidate = shuffled(source.filter((entry) => (
      entry.tier === item.tier && !usedIds.has(entry.id)
    )), random)[0];
    if (!candidate) throw new TypeError('English group needs unique same-tier alternatives');
    usedIds.add(candidate.id);
    return englishPatternById.has(candidate.id) ? instantiatePattern(candidate, random) : candidate;
  };
  const alternatives = Array.from({ length: 2 }, () => items.map(takeAlternative));
  const groups = [resolvedItems, ...alternatives];
  const groupId = (group) => `english-group:${group.map((item) => item.id).join('+')}`;
  const choices = shuffled(groups.map((group) => semanticChoice({
    id: groupId(group),
    label: group.map((item) => item.meaning).join('；'),
    visual: group.map((item) => item.meaning).join('\n'),
  }, group.map((item) => item.id))), random);
  return interaction({
    kind: 'english-group-context',
    subject: 'english',
    skillIds: items.map((item) => item.id),
    prompt: '听完整的工程对话，选择每一句对应的意思。',
    speech: { text: resolvedItems.map((item) => item.word ?? item.text).join('. '), lang: 'en-US' },
    choices,
    answerId: groupId(resolvedItems),
    success: resolvedItems.map((item) => `${item.word ?? item.text}，${item.meaning}`).join(' '),
    hint: resolvedItems.map((item) => item.meaning).join('；'),
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

function quantityGroups(quantity) {
  return { tens: Math.floor(quantity / 10), ones: quantity % 10 };
}

function quantityVisual(quantity, unitGlyph = '●') {
  const groups = quantityGroups(quantity);
  const tens = groups.tens > 0 ? `${'▦'.repeat(groups.tens)} 十格` : '';
  const ones = groups.ones > 0 ? `${unitGlyph.repeat(groups.ones)} 个` : '';
  return [tens, ones].filter(Boolean).join('\n') || '空车';
}

function countQuestion(skill, random) {
  const answer = randomInteger(random, skill.min, skill.max);
  const unitGlyph = '●';
  const values = numericChoices(answer, skill, random).map((item) => Number(item.id.replace('number-', '')));
  const choices = values.map((value, index) => choice(
    `number-${value}`,
    `${String.fromCharCode(65 + index)}号车`,
    quantityVisual(value, unitGlyph),
    { quantity: value, groups: quantityGroups(value) },
  ));
  return interaction({
    kind: 'math-count',
    subject: 'math',
    skillIds: [skill.id],
    prompt: '看订单卡上的材料图，找出装着相同数量的车。',
    speech: { text: '数一数订单卡，再找数量相同的车', lang: 'zh-CN' },
    visualPrompt: quantityVisual(answer, unitGlyph),
    problem: { type: 'quantity-match', targetQuantity: answer, unitGlyph, representation: 'ten-frames' },
    choices,
    answerId: `number-${answer}`,
    success: `两边都是 ${answer} 块材料。`,
    hint: '一格代表十个圆点，再数旁边的小圆点。',
    action: 'lift',
  });
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
  if (skill.tier === 1) {
    const answer = SHAPES[randomInteger(random, 0, SHAPES.length - 1)];
    return interaction({
      kind: 'math-space',
      subject: 'math',
      skillIds: [skill.id],
      prompt: '看施工缺口的轮廓，哪块形状能正好补上？',
      speech: { text: '看缺口轮廓，找到能补上的形状', lang: 'zh-CN' },
      visualPrompt: `缺口 ${answer.visual}`,
      problem: { tier: 1, rule: 'match-outline', targetShape: answer.id },
      choices: shuffled(SHAPES, random).map((item) => choice(
        item.id,
        item.label,
        item.visual,
        { semantic: { shape: item.id } },
      )),
      answerId: answer.id,
      success: `${answer.label}正好匹配缺口。`,
      hint: '沿着缺口的边看一圈，再比较形状。',
      action: 'place',
    });
  }
  if (skill.tier === 2) {
    const relations = [
      { id: 'space-left', label: '在左边', visual: '🚧  🌉', relation: 'left' },
      { id: 'space-right', label: '在右边', visual: '🌉  🚧', relation: 'right' },
      { id: 'space-above', label: '在上面', visual: '  🚧\n  🌉', relation: 'above' },
    ];
    const answer = relations[randomInteger(random, 0, relations.length - 1)];
    return interaction({
      kind: 'math-space',
      subject: 'math',
      skillIds: [skill.id],
      prompt: '路障和小桥的位置与任务图相同的是哪一幅？',
      speech: { text: '比较路障和小桥的位置', lang: 'zh-CN' },
      visualPrompt: answer.visual,
      problem: { tier: 2, rule: 'relative-position', targetRelation: answer.relation },
      choices: shuffled(relations, random).map((item) => choice(
        item.id,
        item.label,
        item.visual,
        { semantic: { relation: item.relation } },
      )),
      answerId: answer.id,
      success: '路障和小桥的相对位置完全相同。',
      hint: '先固定小桥，再看路障在它的哪一边。',
      action: 'place',
    });
  }
  const rotations = [
    { id: 'space-up', label: '向上', visual: '⬆', rotation: 0 },
    { id: 'space-right', label: '向右', visual: '➡', rotation: 90 },
    { id: 'space-down', label: '向下', visual: '⬇', rotation: 180 },
  ];
  const answer = rotations[randomInteger(random, 0, rotations.length - 1)];
  return interaction({
    kind: 'math-space',
    subject: 'math',
    skillIds: [skill.id],
    prompt: '箭头转动后与任务图方向相同的是哪一个？',
    speech: { text: '想一想箭头转动后的方向', lang: 'zh-CN' },
    visualPrompt: `起点 ⬆  转动 ${answer.rotation} 度`,
    problem: { tier: 3, rule: 'mental-rotation', rotation: answer.rotation },
    choices: shuffled(rotations, random).map((item) => choice(
      item.id,
      item.label,
      item.visual,
      { semantic: { rotation: item.rotation } },
    )),
    answerId: answer.id,
    success: `转动后箭头${answer.label}。`,
    hint: '用手指沿着转动方向慢慢比一遍。',
    action: 'place',
  });
}

function classificationQuestion(skill, random) {
  const configurations = {
    1: {
      rule: 'shape-odd-one-out',
      prompt: '按形状分类，哪一块和另外两块不同？',
      hint: '只看外轮廓，两个是圆形，一个是三角形。',
      choices: [
        choice('classify-red-circle', '红色圆形', '红 ○', { semantic: { shape: 'circle', color: 'red' } }),
        choice('classify-blue-circle', '蓝色圆形', '蓝 ○', { semantic: { shape: 'circle', color: 'blue' } }),
        choice('classify-triangle', '黄色三角形', '黄 △', { semantic: { shape: 'triangle', color: 'yellow' } }),
      ],
      answerId: 'classify-triangle',
      success: '三角形和两个圆形不是同一类。',
    },
    2: {
      rule: 'color-odd-one-out',
      prompt: '按颜色分类，哪一块应该放到另一组？',
      hint: '忽略形状，只比较三块材料的颜色。',
      choices: [
        choice('classify-red-circle', '红色圆形', '红 ○', { semantic: { shape: 'circle', color: 'red' } }),
        choice('classify-red-square', '红色正方形', '红 □', { semantic: { shape: 'square', color: 'red' } }),
        choice('classify-blue-circle', '蓝色圆形', '蓝 ○', { semantic: { shape: 'circle', color: 'blue' } }),
      ],
      answerId: 'classify-blue-circle',
      success: '蓝色材料和两块红色材料不是同一组。',
    },
    3: {
      rule: 'two-attribute-membership',
      prompt: '目标组要同时满足黄色和有角，哪块材料能加入？',
      hint: '先找黄色，再确认形状有角。',
      choices: [
        choice('classify-yellow-circle', '黄色圆形', '黄 ○', { semantic: { shape: 'circle', color: 'yellow', hasCorners: false } }),
        choice('classify-blue-square', '蓝色正方形', '蓝 □', { semantic: { shape: 'square', color: 'blue', hasCorners: true } }),
        choice('classify-yellow-triangle', '黄色三角形', '黄 △', { semantic: { shape: 'triangle', color: 'yellow', hasCorners: true } }),
      ],
      answerId: 'classify-yellow-triangle',
      success: '黄色三角形同时满足两个分类条件。',
    },
  };
  const config = configurations[skill.tier];
  return interaction({
    kind: 'math-classification',
    subject: 'math',
    skillIds: [skill.id],
    prompt: config.prompt,
    speech: { text: config.prompt, lang: 'zh-CN' },
    problem: { tier: skill.tier, rule: config.rule },
    choices: shuffled(config.choices, random),
    answerId: config.answerId,
    success: config.success,
    hint: config.hint,
    action: 'sort',
  });
}

function measurementQuestion(skill, random) {
  const available = [];
  while (available.length < 3) {
    const value = randomInteger(random, skill.min, skill.max);
    if (!available.includes(value)) available.push(value);
  }
  const ask = random() < 0.5 ? 'longest' : 'shortest';
  const answer = ask === 'longest' ? Math.max(...available) : Math.min(...available);
  const sorted = [...available].sort((left, right) => left - right);
  const scaleFor = (value) => 4 + sorted.indexOf(value) * 3;
  return interaction({
    kind: 'math-measurement',
    subject: 'math',
    skillIds: [skill.id],
    prompt: `把材料左端对齐，找出${ask === 'longest' ? '最长' : '最短'}的一根。`,
    speech: { text: `比较三根材料，找出${ask === 'longest' ? '最长' : '最短'}的一根`, lang: 'zh-CN' },
    problem: { type: 'compare-length', ask, unit: '格' },
    choices: shuffled(available.map((value, index) => choice(
      `length-${value}`,
      `${String.fromCharCode(65 + index)}号材料`,
      `0├${'━'.repeat(scaleFor(value))}┤`,
      { length: value },
    )), random),
    answerId: `length-${answer}`,
    success: `这根材料量得${ask === 'longest' ? '最长' : '最短'}。`,
    hint: '先把左端对齐，再比较右端到达的位置。',
    action: 'lift',
  });
}

function clockQuestion(skill, random) {
  const directionAt = (position) => ['↑', '↗', '↗', '→', '↘', '↘', '↓', '↙', '↙', '←', '↖', '↖'][position % 12];
  const timeFromTotal = (totalMinutes) => ({
    hour: Math.floor(totalMinutes / 60) % 12 || 12,
    minute: totalMinutes % 60,
    totalMinutes,
  });
  const clockVisual = (time) => {
    const minuteHand = directionAt(Math.round(time.minute / 5));
    const hourHand = directionAt(Math.round(((time.hour % 12) + (time.minute / 60))));
    return `钟面\n    12\n9  ${hourHand}●${minuteHand}  3\n     6`;
  };

  if (skill.tier > 1) {
    const durations = skill.tier === 2 ? [10, 20, 30] : [15, 30, 60];
    const elapsedMinutes = durations[randomInteger(random, 0, durations.length - 1)];
    const startHour = randomInteger(random, 7, 10);
    const startMinuteOptions = skill.tier === 2 ? [0, 30] : [0, 15, 30, 45];
    const startMinute = startMinuteOptions[randomInteger(random, 0, startMinuteOptions.length - 1)];
    const start = timeFromTotal((startHour * 60) + startMinute);
    const end = timeFromTotal(start.totalMinutes + elapsedMinutes);
    const choices = shuffled(durations.map((duration) => choice(
      `elapsed-${duration}`,
      `${duration} 分钟`,
      `${'▰'.repeat(Math.ceil(duration / 15))} ${duration}分钟`,
      { elapsedMinutes: duration },
    )), random);
    return interaction({
      kind: 'math-clock',
      subject: 'math',
      skillIds: [skill.id],
      prompt: '看开始和结束的两个钟面，工程一共进行了多少分钟？',
      speech: { text: '比较开始和结束的钟面，算一算经过了多少分钟', lang: 'zh-CN' },
      visualPrompt: `开始\n${clockVisual(start)}\n结束\n${clockVisual(end)}`,
      problem: { type: 'elapsed-time', start, end, elapsedMinutes },
      choices,
      answerId: `elapsed-${elapsedMinutes}`,
      success: `从开始到结束经过了 ${elapsedMinutes} 分钟。`,
      hint: '先看长针走了多少格，再看短针有没有经过下一个整点。',
      action: 'signal',
    });
  }

  const hour = randomInteger(random, skill.min, skill.max);
  const minute = 0;
  const candidates = [{ hour, minute }];
  for (const offset of [60, -60, 120, -120]) {
    const total = ((hour % 12) * 60) + minute + offset;
    const normalized = (total + 720) % 720;
    const candidate = { hour: Math.floor(normalized / 60) || 12, minute: normalized % 60 };
    if (!candidates.some((item) => item.hour === candidate.hour && item.minute === candidate.minute)) candidates.push(candidate);
    if (candidates.length === 3) break;
  }
  const timeId = (time) => `time-${time.hour}-${time.minute}`;
  return interaction({
    kind: 'math-clock',
    subject: 'math',
    skillIds: [skill.id],
    prompt: `任务安排在 ${hour} 点${minute === 0 ? '整' : `${minute} 分`}，选择对应的钟面。`,
    speech: { text: `任务安排在${hour}点${minute === 0 ? '整' : `${minute}分`}，选择对应的钟面`, lang: 'zh-CN' },
    problem: { type: 'read-clock', time: { hour, minute }, minuteStep: 60 },
    choices: shuffled(candidates.map((time, index) => choice(
      timeId(time),
      `${String.fromCharCode(65 + index)}号钟`,
      clockVisual(time),
      { time },
    )), random),
    answerId: timeId({ hour, minute }),
    success: `钟面表示 ${hour} 点${minute === 0 ? '整' : `${minute} 分`}。`,
    hint: '先看长针确定分钟，再看短针确定小时。',
    action: 'signal',
  });
}

function moneyQuestion(skill, random) {
  const price = randomInteger(random, skill.min, skill.max);
  const totals = numericChoices(price, skill, random).map((item) => Number(item.id.replace('number-', '')));
  const denominations = skill.tier === 1 ? [5, 1] : skill.tier === 2 ? [10, 5, 1] : [50, 20, 10, 5, 1];
  const coinsFor = (total) => {
    const coins = [];
    let remaining = total;
    for (const denomination of denominations) {
      while (remaining >= denomination) {
        coins.push(denomination);
        remaining -= denomination;
      }
    }
    return coins;
  };
  return interaction({
    kind: 'math-money',
    subject: 'math',
    skillIds: [skill.id],
    prompt: `材料价格是 ${price} 元，哪组钱合起来刚好够？`,
    speech: { text: `材料价格是${price}元，哪组钱合起来刚好够`, lang: 'zh-CN' },
    visualPrompt: `价签 ${price}元`,
    problem: { type: 'compose-money', price, currency: 'CNY' },
    choices: shuffled(totals.map((total, index) => {
      const coins = coinsFor(total);
      return choice(
        `money-${total}`,
        `${String.fromCharCode(65 + index)}组钱币`,
        coins.map((coin) => `${coin}元`).join(' + '),
        { coins },
      );
    }), random),
    answerId: `money-${price}`,
    success: `这些钱合起来正好是 ${price} 元。`,
    hint: '从最大的面额开始，把每一枚钱币合起来。',
    action: 'load',
  });
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

function isKnownSkillId(skillId) {
  return chineseById.has(skillId)
    || englishWordById.has(skillId)
    || englishPatternById.has(skillId)
    || mathById.has(skillId);
}

function reviewInteractions(skillIds, count, random) {
  return Array.from({ length: count }, (_, index) => {
    const skillId = skillIds[index % skillIds.length];
    if (chineseById.has(skillId) && index % 2 === 1) {
      return chineseWordMatch(chineseById.get(skillId), random);
    }
    return interactionForSkill(skillId, random);
  });
}

function mixedDelivery(chineseItem, englishItem, mathSkill, random) {
  const amount = randomInteger(random, Math.max(1, mathSkill.min), Math.max(1, mathSkill.max));
  const wrongAmount = amount < mathSkill.max ? amount + 1 : amount - 1;
  const resolvedEnglish = englishPatternById.has(englishItem.id)
    ? instantiatePattern(englishItem, random)
    : englishItem;
  const englishLabel = resolvedEnglish.word ?? resolvedEnglish.text;
  const englishMeaning = resolvedEnglish.meaning;
  return interaction({
    kind: 'mixed-delivery',
    subject: 'mixed',
    skillIds: unique([chineseItem.id, englishItem.id, mathSkill.id]),
    prompt: `把 ${amount} 块写着“${chineseItem.char}”的材料送到 ${englishLabel} 工位。`,
    speech: { text: `把${amount}块写着${chineseItem.char}的材料送到${englishLabel}工位`, lang: 'zh-CN' },
    choices: shuffled([
      choice('delivery-correct', `${chineseItem.char} · ${amount} · ${englishMeaning}`, undefined, {
        skillIds: unique([chineseItem.id, englishItem.id, mathSkill.id]),
      }),
      choice('delivery-count', `${chineseItem.char} · ${wrongAmount} · ${englishMeaning}`, undefined, {
        skillIds: unique([chineseItem.id, englishItem.id]),
      }),
      choice('delivery-language', `${chineseItem.char} · ${amount} · 其他工位`, undefined, {
        skillIds: unique([chineseItem.id, mathSkill.id]),
      }),
    ], random),
    answerId: 'delivery-correct',
    success: '材料全部送到正确工位。',
    hint: `先找“${chineseItem.char}”，再数 ${amount} 块，最后听 ${englishLabel}。`,
    action: 'deliver',
  });
}

function blockInteractions(primaryIds, fallbackIds, count, itemForId, singleFactory, groupFactory, random) {
  const primary = shuffled(unique(primaryIds), random);
  const fallback = shuffled(unique([...fallbackIds, ...primary]), random);
  const groups = Array.from({ length: count }, () => []);
  primary.forEach((id, index) => groups[index % count].push(id));
  groups.forEach((group, index) => {
    if (group.length === 0 && fallback.length > 0) group.push(fallback[index % fallback.length]);
  });
  return groups.map((ids) => {
    const items = ids.map(itemForId).filter(Boolean);
    if (items.length === 0) throw new TypeError('A subject block needs playable curriculum content');
    return items.length === 1 ? singleFactory(items[0], random) : groupFactory(items, random);
  });
}

function segmentForIndex(index) {
  if (index < 2) return 'warmup';
  if (index < 5) return 'chinese';
  if (index < 8) return 'english';
  if (index < 11) return 'math';
  return 'mixed';
}

function finalizeLessonInteractions(lesson, result) {
  const projectAction = actionByVehicle[getProject(lesson.projectId)?.vehicle] ?? 'dig';
  return result.map((item, index) => ({
    ...item,
    id: `${lesson.id}-interaction-${String(index + 1).padStart(2, '0')}`,
    segment: segmentForIndex(index),
    action: projectAction,
  }));
}

export function buildLessonInteractions(lesson, progress = {}, seed = 0, now = Date.now()) {
  if (!lesson || typeof lesson.id !== 'string' || !mathById.has(lesson.mathSkillId)) {
    throw new TypeError('A valid curriculum lesson is required');
  }

  const random = seededRandom(seed, lesson.id);
  const reviewRecordLimit = Math.max(16, Object.keys(progress?.skills ?? {}).length);
  const reviewRecords = selectReviewSkills(progress, lesson, reviewRecordLimit, now);
  const dueIds = reviewRecords.slice(0, 16).map((record) => record.id);
  const eligibleReviewIds = reviewRecords
    .filter((record) => record.exposures > 0 && isKnownSkillId(record.id))
    .map((record) => record.id);
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
  const reviewChineseIds = eligibleReviewIds.filter((id) => chineseById.has(id));
  const reviewEnglishIds = eligibleReviewIds.filter((id) => (
    englishWordById.has(id) || englishPatternById.has(id)
  ));
  const reviewMathIds = eligibleReviewIds.filter((id) => mathById.has(id));
  const hasBalancedReviewHistory = eligibleReviewIds.length >= 8
    && reviewChineseIds.length >= 2
    && reviewEnglishIds.length >= 2
    && reviewMathIds.length >= 2;

  if (lesson.phase !== 'review' && hasBalancedReviewHistory) {
    const currentChineseItems = shuffled(lesson.newChineseIds, random).map((id) => chineseById.get(id));
    const currentEnglishItems = shuffled([
      ...lesson.newEnglishWordIds,
      ...lesson.newEnglishPatternIds,
    ], random).map((id) => englishWordById.get(id) ?? englishPatternById.get(id));
    const currentChinese = currentChineseItems.length === 1
      ? chineseRecognition(currentChineseItems[0], random)
      : chineseGroupMatch(currentChineseItems, random);
    const currentEnglish = currentEnglishItems.length === 1
      ? interactionForSkill(currentEnglishItems[0].id, random)
      : englishGroupContext(currentEnglishItems, random);
    const result = [
      ...reviewInteractions(eligibleReviewIds.slice(0, 2), 2, random),
      currentChinese,
      ...reviewInteractions(reviewChineseIds, 2, random),
      currentEnglish,
      ...reviewInteractions(reviewEnglishIds, 2, random),
      mathInteraction(mathById.get(lesson.mathSkillId), random),
      ...reviewInteractions(reviewMathIds, 2, random),
      mixedDelivery(
        currentChineseItems[0],
        currentEnglishItems[0],
        mathById.get(lesson.mathSkillId),
        random,
      ),
    ];
    return finalizeLessonInteractions(lesson, result);
  }

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
    lesson.newChineseIds.length === 0 ? tierChineseIds : [],
  ], Math.max(3, lesson.newChineseIds.length), random);
  const chinese = blockInteractions(
    lesson.newChineseIds.length > 0 ? lesson.newChineseIds : chineseIds,
    chineseIds,
    3,
    (id) => chineseById.get(id),
    chineseRecognition,
    chineseGroupMatch,
    random,
  );

  const wordIds = takePrioritized([
    lesson.newEnglishWordIds,
    dueIds.filter((id) => englishWordById.has(id)),
    previousIds.filter((id) => englishWordById.has(id)),
    lesson.newEnglishWordIds.length === 0 ? tierWordIds : [],
  ], 3, random);
  const patternIds = takePrioritized([
    lesson.newEnglishPatternIds,
    dueIds.filter((id) => englishPatternById.has(id)),
    previousIds.filter((id) => englishPatternById.has(id)),
    lesson.newEnglishPatternIds.length === 0 ? tierPatternIds : [],
  ], 3, random);
  const assignedEnglishIds = [
    ...lesson.newEnglishWordIds,
    ...lesson.newEnglishPatternIds,
  ];
  const englishFallbackIds = unique([...wordIds, ...patternIds]);
  const english = blockInteractions(
    assignedEnglishIds.length > 0 ? assignedEnglishIds : englishFallbackIds,
    englishFallbackIds,
    3,
    (id) => englishWordById.get(id) ?? englishPatternById.get(id),
    (item, rng) => (englishWordById.has(item.id) ? englishListen(item, rng) : englishPatternContext(item, rng)),
    englishGroupContext,
    random,
  );

  const mathSkill = mathById.get(lesson.mathSkillId);
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

  return finalizeLessonInteractions(lesson, result);
}
