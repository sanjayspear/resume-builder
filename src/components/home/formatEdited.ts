const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dayYearFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * "today", "yesterday", "Nov 19" or "Nov 19, 2025" plus the time, e.g.
 * describeEdited(t, " at ") -> "today at 3:47 PM"
 * describeEdited(t, ", ")   -> "today, 3:47 PM"
 */
export function describeEdited(timestamp: number, separator: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const day =
    days === 0
      ? "today"
      : days === 1
        ? "yesterday"
        : date.getFullYear() === now.getFullYear()
          ? dayFormat.format(date)
          : dayYearFormat.format(date);
  return `${day}${separator}${timeFormat.format(date)}`;
}
