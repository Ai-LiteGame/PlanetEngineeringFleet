import {
  CHINESE_ITEMS,
  ENGLISH_PATTERNS,
  ENGLISH_WORDS,
  LESSONS as CURRICULUM_LESSONS,
  MATH_SKILLS,
  REGIONS,
  getProject,
} from './curriculum/index.js';
import { skillStatus } from './mastery.js';

const LESSON_STATUSES = ['notStarted', 'viewed', 'practiced', 'reviewDue', 'mastered'];
const SUBJECTS = ['chinese', 'english', 'math'];
const ESTIMATED_MINUTES = '8–12';

const chineseById = new Map(CHINESE_ITEMS.map((item) => [item.id, item]));
const englishWordById = new Map(ENGLISH_WORDS.map((item) => [item.id, item]));
const englishPatternById = new Map(ENGLISH_PATTERNS.map((item) => [item.id, item]));
const mathById = new Map(MATH_SKILLS.map((item) => [item.id, item]));
const regionById = new Map(REGIONS.map((region) => [region.id, region]));

const MATH_DOMAIN_LABELS = Object.freeze({
  'number-sense': '数感',
  addition: '加法',
  subtraction: '减法',
  comparison: '数量比较',
  pattern: '规律',
  classification: '分类',
  space: '空间与形状',
  measurement: '测量',
  clock: '时间',
  money: '货币',
  'word-problem': '应用题',
});

function unique(values) {
  return [...new Set(values)];
}

function contentIds(lesson) {
  return {
    chineseIds: [...(lesson.newChineseIds ?? [])],
    englishWordIds: [...(lesson.newEnglishWordIds ?? [])],
    englishPatternIds: [...(lesson.newEnglishPatternIds ?? [])],
  };
}

function projectContent(lessons) {
  const byProject = new Map();
  for (const lesson of lessons) {
    const content = byProject.get(lesson.projectId) ?? {
      chineseIds: [], englishWordIds: [], englishPatternIds: [],
    };
    content.chineseIds.push(...(lesson.newChineseIds ?? []));
    content.englishWordIds.push(...(lesson.newEnglishWordIds ?? []));
    content.englishPatternIds.push(...(lesson.newEnglishPatternIds ?? []));
    byProject.set(lesson.projectId, content);
  }
  for (const content of byProject.values()) {
    content.chineseIds = unique(content.chineseIds);
    content.englishWordIds = unique(content.englishWordIds);
    content.englishPatternIds = unique(content.englishPatternIds);
  }
  return byProject;
}

function rowContent(lesson, byProject) {
  const direct = contentIds(lesson);
  if (direct.chineseIds.length > 0
    || direct.englishWordIds.length > 0
    || direct.englishPatternIds.length > 0) {
    return direct;
  }
  return byProject.get(lesson.projectId) ?? direct;
}

function effectiveLessonStatus(record, skillIds, skills, now) {
  const completed = Number.isInteger(record.completedCount) && record.completedCount > 0;
  const viewed = Number.isInteger(record.viewedAt);
  if (!completed && !viewed) return 'notStarted';

  const statuses = skillIds.map((id) => (
    skills?.[id] ? skillStatus(skills[id], now) : null
  ));
  if (statuses.includes('reviewDue')) return 'reviewDue';
  if (statuses.length > 0 && statuses.every((status) => status === 'mastered')) return 'mastered';
  if (completed) return 'practiced';
  return 'viewed';
}

function mathTarget(skill) {
  if (!skill) return '';
  const domain = MATH_DOMAIN_LABELS[skill.domain] ?? skill.domain;
  return `${domain} ${skill.min}–${skill.max}`;
}

export function buildCourseRows(lessons, progress = {}, now = Date.now()) {
  if (!Array.isArray(lessons)) return [];
  const byProject = projectContent(CURRICULUM_LESSONS);

  return lessons.map((lesson) => {
    const project = getProject(lesson.projectId);
    const region = regionById.get(project?.regionId);
    const content = rowContent(lesson, byProject);
    const mathSkill = mathById.get(lesson.mathSkillId);
    const record = progress?.lessons?.[lesson.id] ?? {};
    const subjects = [];
    if (content.chineseIds.length > 0) subjects.push('chinese');
    if (content.englishWordIds.length > 0 || content.englishPatternIds.length > 0) subjects.push('english');
    if (mathSkill) subjects.push('math');
    const skillIds = unique([
      ...content.chineseIds,
      ...content.englishWordIds,
      ...content.englishPatternIds,
      lesson.mathSkillId,
    ].filter(Boolean));
    const status = effectiveLessonStatus(record, skillIds, progress?.skills, now);

    return {
      id: lesson.id,
      ordinal: lesson.ordinal,
      title: lesson.title,
      phase: lesson.phase,
      tier: lesson.tier,
      projectId: lesson.projectId,
      projectTitle: project?.title ?? '',
      regionId: project?.regionId ?? '',
      regionTitle: region?.title ?? '',
      chineseIds: content.chineseIds,
      chinese: content.chineseIds.map((id) => chineseById.get(id))
        .filter(Boolean)
        .map((item) => `${item.char}·${item.word}`),
      englishWordIds: content.englishWordIds,
      englishWords: content.englishWordIds.map((id) => englishWordById.get(id))
        .filter(Boolean)
        .map((item) => `${item.word}·${item.meaning}`),
      englishPatternIds: content.englishPatternIds,
      englishPatterns: content.englishPatternIds.map((id) => englishPatternById.get(id))
        .filter(Boolean)
        .map((item) => `${item.text}·${item.meaning}`),
      mathSkillId: mathSkill?.id ?? null,
      mathTarget: mathTarget(mathSkill),
      estimatedMinutes: ESTIMATED_MINUTES,
      viewedAt: Number.isInteger(record.viewedAt) ? record.viewedAt : null,
      completedCount: Number.isInteger(record.completedCount) ? record.completedCount : 0,
      lastCompletedAt: Number.isInteger(record.lastCompletedAt) ? record.lastCompletedAt : null,
      hintCount: Number.isInteger(record.hintCount) ? record.hintCount : 0,
      status,
      subjects,
    };
  }).sort((left, right) => left.ordinal - right.ordinal);
}

export function filterCourseRows(rows, filters = {}) {
  const tier = filters.tier === 'all' || filters.tier === undefined
    ? 'all'
    : Number(filters.tier);
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    (tier === 'all' || row.tier === tier)
    && (filters.regionId === 'all' || filters.regionId === undefined || row.regionId === filters.regionId)
    && (filters.status === 'all' || filters.status === undefined || row.status === filters.status)
  ));
}

export function focusCourseRows(rows, subject = 'all') {
  if (subject === 'all' || !SUBJECTS.includes(subject)) return [...(rows ?? [])];
  return (rows ?? []).filter((row) => row.subjects?.includes(subject));
}

export function courseSummary(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const statuses = Object.fromEntries(LESSON_STATUSES.map((status) => [status, 0]));
  const chinese = new Set();
  const english = new Set();
  const math = new Set();

  for (const row of source) {
    if (Object.hasOwn(statuses, row.status)) statuses[row.status] += 1;
    for (const id of row.chineseIds ?? []) chinese.add(id);
    for (const id of row.englishWordIds ?? []) english.add(id);
    for (const id of row.englishPatternIds ?? []) english.add(id);
    if (row.mathSkillId) math.add(row.mathSkillId);
  }

  return {
    total: source.length,
    statuses,
    subjects: { chinese: chinese.size, english: english.size, math: math.size },
  };
}
