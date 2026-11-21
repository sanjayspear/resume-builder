/*
 * Orders work experience by date.
 *
 * "newest" (default) = reverse-chronological: current jobs first, then by end
 *                       date, newest first.
 * "oldest"           = chronological: by start date, oldest first.
 */

export type ExperienceOrder = "newest" | "oldest";
export const EXPERIENCE_ORDERS: [ExperienceOrder, ...ExperienceOrder[]] = ["newest", "oldest"];
export const EXPERIENCE_ORDER_LABELS: Record<ExperienceOrder, string> = {
  newest: "Latest to oldest",
  oldest: "Oldest to latest",
};

type DatedJob = { startDate?: string; endDate?: string; isCurrent?: boolean };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Turns date text into a number of months (year * 12 + month) so dates can be
 * compared. Understands "January 2023", "Jan 2023", "2023", "03/2023",
 * "2023-03". Returns null when there's no 4-digit year.
 */
export function dateValue(text: string | undefined): number | null {
  const value = (text ?? "").trim().toLowerCase();
  const yearMatch = value.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);

  let month = 0;
  const named = MONTHS.findIndex((m) => new RegExp(`\\b${m}`).test(value));
  if (named >= 0) {
    month = named;
  } else {
    // "03/2023" or "2023-03"
    const numeric = value.match(/\b(0?[1-9]|1[0-2])\s*[/.-]\s*(19|20)\d{2}\b/) ?? value.match(/\b(19|20)\d{2}\s*[/.-]\s*(0?[1-9]|1[0-2])\b/);
    if (numeric) {
      const parts = numeric[0].split(/[/.-]/).map((p) => p.trim());
      const monthPart = parts[0].length === 4 ? parts[1] : parts[0];
      month = Number(monthPart) - 1;
    }
  }
  return year * 12 + month;
}

/** End = "how recent". Present jobs and jobs with no dates yet count as newest. */
function endKey(job: DatedJob): number {
  if (job.isCurrent) return Number.POSITIVE_INFINITY;
  return dateValue(job.endDate) ?? dateValue(job.startDate) ?? Number.POSITIVE_INFINITY;
}

function startKey(job: DatedJob): number {
  return dateValue(job.startDate) ?? endKey(job);
}

/**
 * Returns the positions of `jobs` in sorted order, e.g. [2, 0, 1] means
 * "job 2 first, then job 0, then job 1". Equal dates keep their current order.
 */
export function sortedIndexes(jobs: readonly DatedJob[], order: ExperienceOrder): number[] {
  const compare = (a: number, b: number) => {
    const ja = jobs[a];
    const jb = jobs[b];
    if (order === "newest") {
      return endKey(jb) - endKey(ja) || startKey(jb) - startKey(ja);
    }
    return startKey(ja) - startKey(jb) || endKey(ja) - endKey(jb);
  };
  // (Infinity - Infinity is NaN; treat that as "equal".)
  return jobs.map((_, i) => i).sort((a, b) => compare(a, b) || 0);
}

export function sortExperience<T extends DatedJob>(jobs: readonly T[], order: ExperienceOrder): T[] {
  return sortedIndexes(jobs, order).map((i) => jobs[i]);
}

/** True when a job's end date is before its start date (a mistake to fix first). */
export function hasDateConflict(job: DatedJob): boolean {
  if (job.isCurrent) return false;
  const start = dateValue(job.startDate);
  const end = dateValue(job.endDate);
  return start !== null && end !== null && Math.floor(end / 12) < Math.floor(start / 12);
}
