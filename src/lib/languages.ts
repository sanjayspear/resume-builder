/* Spoken languages shown in the sidebar under Skills. */

export const LANGUAGE_LEVELS = [
  { value: "native", label: "Native / Bilingual", bar: 10 },
  { value: "professional", label: "Full Professional", bar: 8 },
  { value: "conversational", label: "Conversational", bar: 5 },
] as const;

export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]["value"];
export const LANGUAGE_LEVEL_VALUES = LANGUAGE_LEVELS.map((l) => l.value) as [LanguageLevel, ...LanguageLevel[]];

export function languageLevelInfo(level: string | undefined) {
  return LANGUAGE_LEVELS.find((l) => l.value === level) ?? LANGUAGE_LEVELS[2];
}
