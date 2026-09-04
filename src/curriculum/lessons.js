import { CHINESE_ITEMS } from './chinese.js';
import { ENGLISH_PATTERNS, ENGLISH_WORDS } from './english.js';
import { MATH_SKILLS } from './math.js';
import { PROJECTS } from './projects.js';

const PHASES = Object.freeze([
  ['learn', '勘察与学习'],
  ['build', '施工与应用'],
  ['review', '验收与间隔复习'],
]);

const lessonId = (ordinal) => `lesson-${String(ordinal).padStart(3, '0')}`;

const idsForTier = (items, tier) => items.filter((item) => item.tier === tier).map((item) => item.id);

const introduceInTier = (ids, tier, counts) => {
  let cursor = 0;
  return Object.freeze(counts.map((count) => Object.freeze(ids.slice(cursor, cursor += count))));
};

const allocateCounts = (total, lessonCount) => {
  const base = Math.floor(total / lessonCount);
  const remainder = total % lessonCount;
  return Array.from({ length: lessonCount }, (_, index) => base + (index < remainder ? 1 : 0));
};

const allocationsByTier = (items) => new Map([1, 2, 3].map((tier) => [
  tier,
  introduceInTier(idsForTier(items, tier), tier, allocateCounts(idsForTier(items, tier).length, 60)),
]));

const chineseAllocations = allocationsByTier(CHINESE_ITEMS);
const wordAllocations = allocationsByTier(ENGLISH_WORDS);
const patternAllocations = allocationsByTier(ENGLISH_PATTERNS);

const mathSkillsByTier = new Map([1, 2, 3].map((tier) => [
  tier,
  MATH_SKILLS.filter((skill) => skill.tier === tier),
]));

const lessonFor = (project, phase, phaseTitle, phaseIndex) => {
  const ordinal = ((project.ordinal - 1) * PHASES.length) + phaseIndex + 1;
  const introductionIndex = ((project.ordinal - 1) % 30) * 2 + phaseIndex;
  const introducesContent = phase !== 'review';
  const mathSkills = mathSkillsByTier.get(project.tier);

  return Object.freeze({
    id: lessonId(ordinal),
    ordinal,
    projectId: project.id,
    phase,
    tier: project.tier,
    title: `${phaseTitle}：${project.title}`,
    newChineseIds: introducesContent ? chineseAllocations.get(project.tier)[introductionIndex] : Object.freeze([]),
    newEnglishWordIds: introducesContent ? wordAllocations.get(project.tier)[introductionIndex] : Object.freeze([]),
    newEnglishPatternIds: introducesContent ? patternAllocations.get(project.tier)[introductionIndex] : Object.freeze([]),
    mathSkillId: mathSkills[(project.ordinal - 1) % mathSkills.length].id,
  });
};

export const LESSONS = Object.freeze(PROJECTS.flatMap((project) => (
  PHASES.map(([phase, phaseTitle], phaseIndex) => lessonFor(project, phase, phaseTitle, phaseIndex))
)));

export function getLesson(lessonIdValue) {
  return LESSONS.find((lesson) => lesson.id === lessonIdValue) ?? null;
}

export function getLessonsForProject(projectId) {
  return LESSONS.filter((lesson) => lesson.projectId === projectId);
}

export function getStageForLesson(lessonIdValue) {
  return getLesson(lessonIdValue)?.tier ?? null;
}
