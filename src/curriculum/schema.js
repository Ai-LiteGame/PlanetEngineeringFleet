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
