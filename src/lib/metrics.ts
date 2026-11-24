/*
 * Finds metrics in text, so Modern ATS can draw them in bold
 * ("cut costs by **18%**"). Only the font weight changes: the text itself is
 * untouched, so what an ATS reads is exactly what you typed.
 *
 * A metric is a number with a %, a $ in front, a + after, a K/M/B
 * multiplier, or thousands separators:
 *   40%  99.4%  $140K  $4.2M  $500  6,500  3,000+  9+  10K  2B
 * Not metrics (left as they are): plain numbers ("Project 1", "team of 25"),
 * numbers joined to words ("30-day", "Web3", "S3"), and years ("2017").
 */

const METRIC = new RegExp(
  [
    String.raw`\$\d[\d,]*(?:\.\d+)?(?:[KMB]\b)?\+?`, // $140K, $4.2M, $500, $1M+
    String.raw`\d[\d,]*(?:\.\d+)?%`, // 40%, 99.4%
    String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:[KMB]\b)?\+?`, // 6,500  3,000+  1,200.5
    String.raw`\d+(?:\.\d+)?[KMB]\b\+?`, // 10K, 2.5M, 2B+
    String.raw`\d+(?:\.\d+)?\+`, // 9+, 100+
  ].join("|"),
  "g",
);

/** Characters that mean the number is part of a bigger word or code ("Web3", "v2.0", "30-day"). */
const JOINED_BEFORE = /[\p{L}\p{N}_.\-/]$/u;
const JOINED_AFTER = /^[\p{L}\p{N}_\-/]/u;

export type TextPart = { text: string; metric: boolean };

/** Splits text into parts; the metric parts are the ones to draw in bold. Joining all parts gives back the input. */
export function splitMetrics(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(METRIC)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    // A trailing "." or "," is punctuation, not part of the number ("by 40%." / "6,500, and").
    if (JOINED_BEFORE.test(before) || JOINED_AFTER.test(after)) continue;
    if (start > last) parts.push({ text: text.slice(last, start), metric: false });
    parts.push({ text: match[0], metric: true });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last), metric: false });
  return parts;
}
