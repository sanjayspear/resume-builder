/*
 * Structure checklist: things ATS and recruiters expect in every resume,
 * worked out from the form data alone (fast, no PDF needed). Only the page
 * count comes from the generated PDF, when it's available.
 */
import { pdfFileName } from "../pdf";
import { richTextToPlain } from "../richText";
import { isBlankExperience, type ResumeData } from "../schema";
import type { Check } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/[^\s/?#]+\/?$/i;

const text = (value: string | undefined) => (value ?? "").trim();

/* ---------- Dates ---------- */

const FULL_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SHORT_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * The style a date is written in:
 * "short" (Oct 2022), "full" (October 2022), "both" (May 2022: the same
 * either way), "sept" (non-standard short form), "year" (2022),
 * "numeric" (10/2022, 2022-10) or "other".
 */
export type DateStyle = "short" | "full" | "both" | "sept" | "year" | "numeric" | "other";

export function dateStyle(value: string): DateStyle {
  const v = value.trim();
  if (/^\d{4}$/.test(v)) return "year";
  if (/^\d{1,2}[/.-]\d{4}$/.test(v) || /^\d{4}[/.-]\d{1,2}$/.test(v)) return "numeric";
  const m = v.match(/^([A-Za-z]+)\.?,?\s+\d{4}$/);
  if (!m) return "other";
  const month = m[1].toLowerCase();
  if (month === "may") return "both";
  if (month === "sept") return "sept";
  if (FULL_MONTHS.includes(month)) return "full";
  if (SHORT_MONTHS.includes(month)) return "short";
  return "other";
}

const STYLE_NAMES: Record<DateStyle, string> = {
  short: "short month",
  full: "full month",
  both: "month",
  sept: "non-standard short form; use “Sep”",
  year: "year only",
  numeric: "numbers",
  other: "unrecognised",
};

function dateStyleCheck(data: ResumeData): Check {
  const why = "ATS work out your years of experience from these dates, and one consistent style also looks careful to recruiters.";
  const dates: { value: string; field: string; style: DateStyle }[] = [];
  data.experience.forEach((job, i) => {
    if (isBlankExperience(job)) return;
    for (const key of ["startDate", "endDate"] as const) {
      if (key === "endDate" && job.isCurrent) continue;
      const value = text(job[key]);
      if (value) dates.push({ value, field: `experience.${i}.${key}`, style: dateStyle(value) });
    }
  });
  const base = { id: "date-style", title: "Date style", why };
  if (dates.length === 0) return { ...base, status: "info", message: "No job dates yet." };

  const styles = new Set(dates.map((d) => d.style).filter((s) => s !== "both"));
  const odd = dates.filter((d) => d.style === "sept" || d.style === "other");
  const mixed = styles.has("sept") || styles.has("other") || styles.size > 1;
  if (!mixed && styles.has("year")) {
    return { ...base, status: "warn", reason: "dates without months", field: dates[0].field, message: "Dates are years only. Write month and year, e.g. “May 2025”." };
  }
  if (!mixed) return { ...base, status: "pass", message: `All ${dates.length} dates use the same style.` };

  // Show one example of each style found, the odd ones first.
  const examples = new Map<DateStyle, (typeof dates)[number]>();
  for (const d of [...odd, ...dates]) if (!examples.has(d.style) && d.style !== "both") examples.set(d.style, d);
  const list = [...examples.values()].map((d) => `“${d.value}” (${STYLE_NAMES[d.style]})`).join(", ");
  return {
    ...base,
    status: "warn",
    reason: "mixed date styles",
    field: (odd[0] ?? [...examples.values()][1] ?? dates[0]).field,
    message: `Dates are written in different styles: ${list}. Pick one, e.g. “Oct 2022 – Apr 2025”.`,
  };
}

/* ---------- The checklist ---------- */

export function structureChecks(data: ResumeData, { pageCount }: { pageCount?: number } = {}): Check[] {
  const p = data.personal;
  const checks: Check[] = [];

  // Contact details
  const name = text(p.fullName);
  checks.push(
    name
      ? { id: "name", status: "pass", title: "Name", message: name, why: "Your name identifies the application." }
      : { id: "name", status: "fail", title: "Name", reason: "no name", field: "personal.fullName", message: "No name yet.", why: "Without a name the ATS can't file your application under you." },
  );
  const email = text(p.email);
  checks.push(
    !email
      ? { id: "email", status: "fail", title: "Email", reason: "no email", field: "personal.email", message: "No email address yet.", why: "Recruiters and the ATS contact you by email first." }
      : !EMAIL.test(email)
        ? { id: "email", status: "fail", title: "Email", reason: "invalid email", field: "personal.email", message: `“${email}” doesn't look like an email address.`, why: "A mistyped email means recruiters can't reach you." }
        : { id: "email", status: "pass", title: "Email", message: email, why: "Recruiters and the ATS contact you by email first." },
  );
  checks.push(
    text(p.phone)
      ? { id: "phone", status: "pass", title: "Phone", message: text(p.phone), why: "Many recruiters call shortlisted candidates." }
      : { id: "phone", status: "fail", title: "Phone", reason: "no phone", field: "personal.phone", message: "No phone number yet.", why: "Many recruiters call shortlisted candidates, and some ATS require a phone number." },
  );
  checks.push(
    text(p.location)
      ? { id: "city", status: "pass", title: "City", message: text(p.location), why: "ATS filter candidates by location." }
      : { id: "city", status: "warn", title: "City", reason: "no city", field: "personal.location", message: "No city or location yet.", why: "Many ATS filter candidates by location, and a missing one can drop you from searches." },
  );
  const linkedin = text(p.linkedin);
  checks.push(
    !linkedin
      ? { id: "linkedin", status: "warn", title: "LinkedIn profile", reason: "no LinkedIn", field: "personal.linkedin", message: "No LinkedIn link yet.", why: "Recruiters often check LinkedIn to confirm your experience." }
      : !LINKEDIN.test(linkedin)
        ? { id: "linkedin", status: "warn", title: "LinkedIn profile", reason: "LinkedIn link looks wrong", field: "personal.linkedin", message: `“${linkedin}” doesn't look like a LinkedIn profile link (linkedin.com/in/your-name).`, why: "A broken profile link looks careless and leads nowhere." }
        : { id: "linkedin", status: "pass", title: "LinkedIn profile", message: linkedin, why: "Recruiters often check LinkedIn to confirm your experience." },
  );

  // Jobs
  const jobs = data.experience.map((job, i) => ({ job, i })).filter(({ job }) => !isBlankExperience(job));
  const incomplete = jobs.flatMap(({ job, i }) => {
    const missing: { label: string; key: string }[] = [];
    if (!text(job.jobTitle)) missing.push({ label: "job title", key: "jobTitle" });
    if (!text(job.company)) missing.push({ label: "company", key: "company" });
    if (!text(job.startDate)) missing.push({ label: "start date", key: "startDate" });
    if (!job.isCurrent && !text(job.endDate)) missing.push({ label: "end date", key: "endDate" });
    if (missing.length === 0) return [];
    const label = text(job.jobTitle) || text(job.company) || `Job ${i + 1}`;
    return [{ text: `${label}: no ${missing.map((m) => m.label).join(", ")}`, field: `experience.${i}.${missing[0].key}` }];
  });
  const jobsWhy = "ATS read each job as title + company + dates; a missing part can make the job count for nothing.";
  checks.push(
    jobs.length === 0
      ? { id: "jobs", status: "warn", title: "Work experience", reason: "no jobs", message: "No jobs yet.", why: "Most ATS rank candidates mainly on work experience." }
      : incomplete.length > 0
        ? { id: "jobs", status: "fail", title: "Work experience", reason: "incomplete job", field: incomplete[0].field, message: incomplete.map((x) => x.text).join("; ") + ".", why: jobsWhy }
        : { id: "jobs", status: "pass", title: "Work experience", message: `${jobs.length} job${jobs.length === 1 ? "" : "s"}, each with a title, company and dates.`, why: jobsWhy },
  );
  checks.push(dateStyleCheck(data));
  checks.push(
    data.experienceOrder === "oldest"
      ? { id: "order", status: "warn", title: "Job order", reason: "oldest job first", field: "experienceOrder", message: "Jobs are listed oldest first.", why: "Recruiters and ATS expect your most recent job first (reverse chronological order)." }
      : { id: "order", status: "pass", title: "Job order", message: "Most recent job first.", why: "Recruiters and ATS expect your most recent job first." },
  );

  // Length
  const lengthWhy = "Recruiters skim; one or two pages is the norm for most roles.";
  checks.push(
    pageCount === undefined
      ? { id: "length", status: "info", title: "Length", message: "Counted when the PDF check finishes.", why: lengthWhy }
      : pageCount >= 3
        ? { id: "length", status: "warn", title: "Length", reason: `${pageCount} pages`, message: `${pageCount} pages. Aim for 1–2: keep the most recent and relevant work.`, why: lengthWhy }
        : { id: "length", status: "pass", title: "Length", message: `${pageCount} page${pageCount === 1 ? "" : "s"}.`, why: lengthWhy },
  );

  // Summary
  const words = richTextToPlain(data.summary).split(/\s+/).filter(Boolean).length;
  const summaryWhy = "The summary is often the first thing a recruiter reads after your name.";
  checks.push(
    words === 0
      ? { id: "summary", status: "fail", title: "Summary", reason: "no summary", field: "summary", message: "No summary yet.", why: summaryWhy }
      : words < 40
        ? { id: "summary", status: "warn", title: "Summary", reason: "summary too short", field: "summary", message: `${words} words. Aim for 40–120: your strongest skills and one or two results.`, why: summaryWhy }
        : words > 120
          ? { id: "summary", status: "warn", title: "Summary", reason: "summary too long", field: "summary", message: `${words} words. Aim for 40–120; move details into your jobs.`, why: summaryWhy }
          : { id: "summary", status: "pass", title: "Summary", message: `${words} words.`, why: summaryWhy },
  );

  checks.push({
    id: "file-name",
    status: "info",
    title: "File name",
    message: `Download saves it as “${pdfFileName(p.fullName)}”.`,
    why: "A file named after you is easy for recruiters to find again.",
  });
  return checks;
}
