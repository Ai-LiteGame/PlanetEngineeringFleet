const createSkill = (id, domain, tier, min, max, generator) => Object.freeze({
  id, domain, tier, min, max, generator,
});

const domainProgressions = [
  ['number-sense', [[0, 10], [0, 20], [0, 100]]],
  ['addition', [[0, 10], [0, 20], [0, 100]]],
  ['subtraction', [[0, 10], [0, 20], [0, 100]]],
  ['comparison', [[0, 10], [0, 20], [0, 100]]],
  ['pattern', [[1, 5], [1, 10], [1, 20]]],
  ['classification', [[1, 4], [1, 6], [1, 8]]],
  ['space', [[1, 4], [1, 6], [1, 8]]],
  ['measurement', [[1, 10], [1, 20], [1, 100]]],
  ['clock', [[1, 12], [1, 30], [1, 60]]],
  ['money', [[1, 10], [1, 20], [1, 100]]],
  ['word-problem', [[0, 10], [0, 20], [0, 100]]],
];

export const MATH_SKILLS = Object.freeze(domainProgressions.flatMap(([domain, ranges]) => (
  ranges.map(([min, max], index) => createSkill(
    `math-${domain}-${index + 1}`,
    domain,
    index + 1,
    min,
    max,
    `${domain}-tier-${index + 1}`,
  ))
)));
