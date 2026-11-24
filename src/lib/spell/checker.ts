/*
 * The spell checker itself: Hunspell English dictionaries (US and UK) read by
 * nspell. A word is correct if EITHER dictionary knows it, so British and
 * American spellings are both fine. Used in a background worker in the
 * browser, and directly by the tests.
 */
import nspell from "nspell";

export type Dictionary = { aff: string | Uint8Array; dic: string | Uint8Array };
export type SpellResult = { correct: boolean; suggestions: string[] };

export function createChecker(dictionaries: Dictionary[]) {
  const spellers = dictionaries.map((d) => nspell(d as Parameters<typeof nspell>[0]));
  const correct = (word: string) => spellers.some((s) => s.correct(word) || s.correct(word.toLowerCase()));
  return {
    check(word: string): SpellResult {
      if (correct(word)) return { correct: true, suggestions: [] };
      const suggestions = [...new Set(spellers.flatMap((s) => s.suggest(word)))].slice(0, 3);
      return { correct: false, suggestions };
    },
  };
}

export type Checker = ReturnType<typeof createChecker>;
