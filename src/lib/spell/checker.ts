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
      // Best first: ordinary words before proper names ("Senior" before "Renoir"),
      // then the closest (a swapped pair of letters counts as one small slip).
      const isOrdinary = (w: string) => spellers.some((s) => s.correct(w.toLowerCase()));
      // nspell can miss swapped letters in short words ("teh" -> "the"), so try those too.
      const swaps = [...word.slice(0, -1)].map((_, i) => word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)).filter(correct);
      const suggestions = [...new Set([...swaps, ...spellers.flatMap((s) => s.suggest(word))])]
        .map((w, i) => ({ w, i, rank: (isOrdinary(w) ? 0 : 10) + distance(word.toLowerCase(), w.toLowerCase()) }))
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .slice(0, 3)
        .map((x) => x.w);
      return { correct: false, suggestions };
    },
  };
}

export type Checker = ReturnType<typeof createChecker>;

/** Edit distance where swapping two neighbouring letters counts as 1 ("Senoir" -> "Senior"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
