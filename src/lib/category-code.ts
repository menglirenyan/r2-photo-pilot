import { pinyin } from "pinyin-pro";

const MAX_CATEGORY_CODE_LENGTH = 12;

export function createCategoryCode(name: string, usedCodes: Set<string>) {
  const fullPinyin = pinyin(name, { toneType: "none", type: "array" })
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_CATEGORY_CODE_LENGTH);
  const baseCode = fullPinyin || "CAT";

  if (!usedCodes.has(baseCode)) return baseCode;

  for (let index = 2; index <= 9999; index += 1) {
    const suffix = String(index);
    const candidate = `${baseCode.slice(0, MAX_CATEGORY_CODE_LENGTH - suffix.length)}${suffix}`;
    if (!usedCodes.has(candidate)) return candidate;
  }

  return "";
}
