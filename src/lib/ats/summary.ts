import type { Check } from "./types";

/**
 * The summary line for a group of checks, e.g.
 *   "Readability: Passed"
 *   "Readability: 1 warning - two-column layout"
 *   "Readability: 1 problem, 2 warnings - no phone, two-column layout, no LinkedIn"
 * Problems come first; at most three reasons are listed.
 */
export function summaryLine(label: string, checks: Check[], { pending = false } = {}): string {
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  if (fails.length === 0 && warns.length === 0) return `${label}: ${pending ? "Checking…" : "Passed"}`;
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const counts = [fails.length ? count(fails.length, "problem") : "", warns.length ? count(warns.length, "warning") : ""]
    .filter(Boolean)
    .join(", ");
  const reasons = [...new Set([...fails, ...warns].map((c) => c.reason ?? c.title))];
  const shown = reasons.slice(0, 3).join(", ") + (reasons.length > 3 ? ", …" : "");
  return `${label}: ${counts} - ${shown}`;
}
