import { sortExperience } from "./experienceSort";
import { richTextToPlain, type RichDoc } from "./richText";
import { sampleResume } from "./sampleData";
import {
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyLanguage,
  emptyProject,
  emptyResume,
  emptySkillGroup,
  isBlankCertification,
  isBlankEducation,
  isBlankExperience,
  isBlankLanguage,
  isBlankProject,
  isBlankSkillGroup,
  type ResumeData,
} from "./schema";
import type { TemplateId } from "./templates";

/*
 * "Sample mode": new resumes start filled with the sample resume, so the
 * preview shows what the template really looks like. This file holds the
 * rules (all pure functions, so they're easy to test):
 * - newResumeData:     what a brand-new resume contains
 * - isUntouchedSample: is this still exactly the sample? (banner + badge)
 * - sampleLeftovers:   which distinctive sample details are still there? (download warning)
 * - clearedContent:    what "Clear form" leaves behind
 * Nothing is stored to mark a resume as "sample": it's worked out from the
 * content, so it's always right, including after a page refresh.
 */

/** A brand-new resume: the sample content in the chosen template (default design otherwise). */
export function newResumeData(template: TemplateId): ResumeData {
  const data = structuredClone(sampleResume);
  return { ...data, style: { ...emptyResume().style, template } };
}

/* ---------- Comparing content ---------- */

const plain = (doc: RichDoc | undefined) => (doc ? richTextToPlain(doc) : "").replace(/\s+/g, " ").trim();
const text = (value: string | undefined) => (value ?? "").trim();

/**
 * The resume's content as a comparable string. Design settings and the job
 * order setting are left out (they aren't content), formatted text is
 * compared as plain text (the editor may store the same text slightly
 * differently), jobs are compared in date order, and completely empty
 * entries are ignored.
 */
export function contentSignature(data: ResumeData): string {
  const p = data.personal;
  return JSON.stringify({
    personal: [p.fullName, p.jobTitle, p.location, p.phone, p.email, p.website, p.linkedin].map(text),
    summary: plain(data.summary),
    sidebarSummary: text(data.sidebarSummary),
    experience: sortExperience(data.experience.filter((j) => !isBlankExperience(j)), "newest").map((j) => [
      text(j.startDate),
      text(j.endDate),
      j.isCurrent,
      text(j.jobTitle),
      text(j.company),
      text(j.location),
      j.logo,
      plain(j.description),
    ]),
    projects: data.projects.filter((x) => !isBlankProject(x)).map((x) => [text(x.name), text(x.link), plain(x.description)]),
    education: data.education.filter((x) => !isBlankEducation(x)).map((x) => [text(x.year), text(x.degree), text(x.institution)]),
    certifications: data.certifications
      .filter((x) => !isBlankCertification(x))
      .map((x) => [text(x.name), text(x.issuer), text(x.year)]),
    skillGroups: data.skillGroups
      .filter((x) => !isBlankSkillGroup(x))
      .map((x) => [text(x.name), x.rating, x.skills.map((s) => text(s.value))]),
    languages: data.languages.filter((x) => !isBlankLanguage(x)).map((x) => [text(x.name), x.level]),
  });
}

const SAMPLE_SIGNATURE = contentSignature(sampleResume);
const EMPTY_SIGNATURE = contentSignature(emptyResume());

/** True while the content is exactly the sample resume (whatever the design). */
export function isUntouchedSample(data: ResumeData): boolean {
  return contentSignature(data) === SAMPLE_SIGNATURE;
}

/* ---------- The previous sample ---------- */

/**
 * Until November 2026 the sample had a full phone number, a LinkedIn path
 * someone could register and a company name real businesses use. Resumes
 * saved back then still contain them.
 */
export const OLD_SAMPLE_VALUES = {
  phone: "512-555-0147",
  linkedin: "linkedin.com/in/maya-fernandes-sample",
  company: "Brightline Logistics",
} as const;

/** The sample exactly as it was before November 2026 (only these three details differed). */
export function previousSample(): ResumeData {
  const data = structuredClone(sampleResume);
  data.personal.phone = OLD_SAMPLE_VALUES.phone;
  data.personal.linkedin = OLD_SAMPLE_VALUES.linkedin;
  for (const job of data.experience) job.company = OLD_SAMPLE_VALUES.company;
  return data;
}
const PREVIOUS_SAMPLE_SIGNATURE = contentSignature(previousSample());

/**
 * A saved resume that is still exactly the previous sample becomes the
 * current sample (same design), so it keeps its "Sample" badge and banner.
 * Anything else, including a partly edited old sample, is returned as is:
 * the download warning still flags the old details (sampleLeftovers).
 */
export function upgradePreviousSample(data: ResumeData): ResumeData {
  if (contentSignature(data) !== PREVIOUS_SAMPLE_SIGNATURE) return data;
  const sp = sampleResume.personal;
  const company = sampleResume.experience[0].company;
  return {
    ...data,
    personal: { ...data.personal, phone: sp.phone, linkedin: sp.linkedin },
    experience: data.experience.map((job) =>
      job.company.trim() === OLD_SAMPLE_VALUES.company ? { ...job, company } : job,
    ),
  };
}

/** True when there's no content at all (empty entries don't count). */
export function hasNoContent(data: ResumeData): boolean {
  return contentSignature(data) === EMPTY_SIGNATURE;
}

/* ---------- Sample details left behind ---------- */

/** Sentences of at least 25 characters: long enough that only the sample would contain them. */
const sentencesOf = (value: string) =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);

const SAMPLE_SENTENCES = [
  ...sentencesOf(plain(sampleResume.summary)),
  ...sentencesOf(sampleResume.sidebarSummary),
  ...sampleResume.experience.flatMap((job) => sentencesOf(plain(job.description))),
  ...sampleResume.projects.flatMap((project) => sentencesOf(plain(project.description))),
];
const same = (a: string, b: string) => a !== "" && a.trim().toLowerCase() === b.trim().toLowerCase();
/** A phone number as digits and hidden-digit X's only, so "(512) 555 01xx" = "512-555-01XX" and "+91 98XXX XXXXX" keeps its mask. */
const phoneKey = (value: string) => value.toUpperCase().replace(/[^\dX]/g, "");

/**
 * Distinctive sample details still in the resume, as short labels for the
 * download warning ("name", "email"...). Only things no real person would
 * share with the sample are checked: the sample's name, email, phone,
 * LinkedIn, company and full sentences. Common things that real resumes
 * also contain (job titles, skills, cities, schools, certifications) are
 * never flagged.
 */
export function sampleLeftovers(data: ResumeData): string[] {
  const found: string[] = [];
  const p = data.personal;
  const sp = sampleResume.personal;
  if (same(p.fullName, sp.fullName)) found.push("name");
  if (same(p.email, sp.email)) found.push("email");
  // The phone, LinkedIn and company of the previous sample count too (resumes saved before November 2026).
  const old = OLD_SAMPLE_VALUES;
  if (phoneKey(p.phone) !== "" && [sp.phone, old.phone].some((phone) => phoneKey(p.phone) === phoneKey(phone))) found.push("phone");
  if (same(p.linkedin, sp.linkedin) || same(p.linkedin, old.linkedin)) found.push("LinkedIn");

  const sampleCompanies = new Set([...sampleResume.experience.map((job) => job.company), old.company].map((c) => c.trim().toLowerCase()));
  if (data.experience.some((job) => sampleCompanies.has(job.company.trim().toLowerCase()))) found.push("company");

  const allText = [
    plain(data.summary),
    data.sidebarSummary,
    ...data.experience.map((job) => plain(job.description)),
    ...data.projects.map((project) => plain(project.description)),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (SAMPLE_SENTENCES.some((sentence) => allText.includes(sentence.toLowerCase()))) found.push("example sentences");
  return found;
}

/* ---------- Clear form ---------- */

/**
 * What "Clear form" leaves: no content, one empty entry in every list (so
 * you can start typing straight away), and the same design and job order.
 */
export function clearedContent(current: ResumeData): ResumeData {
  return {
    ...emptyResume(),
    style: structuredClone(current.style),
    experienceOrder: current.experienceOrder,
    experience: [emptyExperience()],
    projects: [emptyProject()],
    education: [emptyEducation()],
    certifications: [emptyCertification()],
    skillGroups: [emptySkillGroup()],
    languages: [emptyLanguage()],
  };
}
