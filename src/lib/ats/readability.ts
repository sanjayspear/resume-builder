/*
 * Readability: is the generated PDF read correctly by text extractors (and
 * so by ATS)? Compares the resume content with the text read back from the
 * real PDF for the chosen template. Pure function: the PDF is generated and
 * read elsewhere (in the browser for the app, in Node for the tests).
 */
import { languageLevelInfo } from "../languages";
import { squash, type ExtractedPdf } from "../pdfText";
import { richTextToPlain } from "../richText";
import {
  isBlankCertification,
  isBlankEducation,
  isBlankExperience,
  isBlankLanguage,
  isBlankProject,
  isBlankSkillGroup,
  type ResumeData,
} from "../schema";
import { templateInfo } from "../templates";
import type { Check } from "./types";

/** What the PDF check measured (see runReadability for the browser, tests/helpers for Node). */
export type PdfReading = {
  extracted: ExtractedPdf;
  /** Problems in the glyph-to-letter maps; [] when valid. */
  mapProblems: string[];
  /** Glyphs that stand for several letters (ligatures); [] when none. */
  ligatures: string[];
  /** Embedded images (company logos). */
  images: number;
};

export const TWO_COLUMN_WARNING =
  "Two-column layouts can be read out of order by some ATS. Use Modern ATS when applying through job portals.";

const text = (value: string | undefined) => (value ?? "").trim();
const withoutProtocol = (url: string) => url.replace(/^https?:\/\//i, "");
const displayUrl = (url: string) => withoutProtocol(url).replace(/^www\./i, "").replace(/\/$/, "");

/** Every piece of content the chosen template prints, as plain strings. */
function printedContent(data: ResumeData, isAts: boolean): string[] {
  const p = data.personal;
  const out = [p.fullName, p.jobTitle, p.location, p.phone, p.email, richTextToPlain(data.summary)];
  // Classic shows the website without "https://"; Modern ATS also drops "www." (see the PDF layouts).
  if (text(p.website)) out.push(isAts ? displayUrl(p.website) : withoutProtocol(p.website));
  if (text(p.linkedin)) out.push(displayUrl(p.linkedin));
  for (const job of data.experience.filter((j) => !isBlankExperience(j))) {
    out.push(job.jobTitle, job.company, job.location, job.startDate, job.isCurrent ? "Present" : job.endDate, richTextToPlain(job.description));
  }
  for (const project of data.projects.filter((x) => !isBlankProject(x))) {
    out.push(project.name, text(project.link) ? displayUrl(project.link) : "", richTextToPlain(project.description));
  }
  for (const item of data.education.filter((x) => !isBlankEducation(x))) out.push(item.degree, item.institution, item.year);
  for (const item of data.certifications.filter((x) => !isBlankCertification(x))) out.push(item.name, item.issuer, item.year);
  for (const group of data.skillGroups.filter((x) => !isBlankSkillGroup(x))) out.push(group.name, ...group.skills.map((s) => s.value));
  for (const lang of data.languages.filter((x) => !isBlankLanguage(x))) out.push(lang.name, languageLevelInfo(lang.level).label);
  if (!isAts) out.push(data.sidebarSummary); // Modern ATS leaves it out on purpose
  return out.map(text).filter(Boolean);
}

/** The PDF text, normalised for comparing words (line breaks after a hyphen re-joined). */
function comparableText(extracted: ExtractedPdf): string {
  return squash(extracted.streamText).replace(/(\p{L})-\s+(?=\p{L})/gu, "$1-");
}

export function readabilityChecks(data: ResumeData, reading: PdfReading): Check[] {
  const isAts = templateInfo(data.style?.template).layout === "ats";
  const pdfText = comparableText(reading.extracted);
  const checks: Check[] = [];

  // 1. Every word of the content comes out of the PDF correctly.
  const words = [...new Set(printedContent(data, isAts).flatMap((s) => s.split(/\s+/)).filter(Boolean))];
  const missing = words.filter((word) => !pdfText.includes(word));
  const wordsWhy = "An ATS can only match what it can read; a garbled word is a missed keyword.";
  checks.push(
    missing.length === 0
      ? { id: "words", status: "pass", title: "Every word readable", message: `All ${words.length} words of your resume come out of the PDF exactly as typed.`, why: wordsWhy }
      : {
          id: "words",
          status: "fail",
          title: "Every word readable",
          reason: "words not readable",
          message: `${missing.length} word${missing.length === 1 ? "" : "s"} didn't come out of the PDF as typed: ${missing.slice(0, 8).map((w) => `“${w}”`).join(", ")}${missing.length > 8 ? "…" : ""}.`,
          why: wordsWhy,
        },
  );

  // 2. The glyph-to-letter maps are valid (what other extractors rely on).
  const mapOk = reading.mapProblems.length === 0 && reading.ligatures.length === 0;
  checks.push({
    id: "characters",
    status: mapOk ? "pass" : "fail",
    title: "Characters",
    reason: mapOk ? undefined : "broken characters",
    message: mapOk
      ? "Every character maps to the right letter, so other ATS read it correctly too."
      : `The PDF's letter map has problems (${[...reading.mapProblems, ...reading.ligatures.map((l) => `combined letters “${l}”`)].slice(0, 3).join("; ")}). Some ATS would read wrong letters.`,
    why: "Some ATS read letters from this map directly; a broken entry turns words like “REST” into “&EST”.",
  });

  // 3. Reading order.
  const steps: { label: string; needle: string }[] = [
    { label: "name", needle: text(data.personal.fullName) },
    { label: "contact", needle: text(data.personal.email) || text(data.personal.phone) },
    { label: "summary", needle: "SUMMARY" },
    { label: "skills", needle: data.skillGroups.some((g) => !isBlankSkillGroup(g)) ? "SKILLS" : "" },
    { label: "experience", needle: data.experience.some((j) => !isBlankExperience(j)) ? "WORK EXPERIENCE" : "" },
    { label: "education", needle: data.education.some((e) => !isBlankEducation(e)) ? "EDUCATION" : "" },
  ].filter((s) => s.needle);
  let from = 0;
  let outOfOrder: string | null = null;
  for (const step of steps) {
    const at = reading.extracted.streamText.indexOf(step.needle, from);
    if (at < 0) {
      outOfOrder = step.label;
      break;
    }
    from = at + step.needle.length;
  }
  const orderText = steps.map((s) => s.label).join(" → ");
  if (!isAts) {
    checks.push({
      id: "reading-order",
      status: "warn",
      title: "Reading order",
      reason: "two-column layout",
      message: TWO_COLUMN_WARNING,
      why: "If an ATS reads the sidebar after your experience, contact details and skills can end up in the wrong fields.",
      action: "switch-to-modern-ats",
    });
  } else {
    checks.push(
      outOfOrder
        ? { id: "reading-order", status: "fail", title: "Reading order", reason: "reading order", message: `The text isn't in the expected order (${orderText}); “${outOfOrder}” came too early or is missing.`, why: "ATS fill in your profile from the text in the order it's read." }
        : { id: "reading-order", status: "pass", title: "Reading order", message: `Read in the right order: ${orderText}.`, why: "ATS fill in your profile from the text in the order it's read." },
    );
  }

  // 4. Standard section headings.
  const pieces = new Set(reading.extracted.items.map((i) => i.str.trim().toUpperCase()));
  const expected = [
    "SUMMARY",
    ...(data.experience.some((j) => !isBlankExperience(j)) ? ["WORK EXPERIENCE"] : []),
    ...(data.education.some((e) => !isBlankEducation(e)) ? ["EDUCATION"] : []),
    ...(data.skillGroups.some((g) => !isBlankSkillGroup(g)) ? ["SKILLS"] : []),
    ...(data.projects.some((x) => !isBlankProject(x)) ? ["PROJECTS"] : []),
    ...(data.certifications.some((x) => !isBlankCertification(x)) ? ["CERTIFICATIONS"] : []),
    ...(data.languages.some((x) => !isBlankLanguage(x)) ? ["LANGUAGES"] : []),
  ];
  const absent = expected.filter((h) => !pieces.has(h));
  checks.push(
    absent.length === 0
      ? { id: "headings", status: "pass", title: "Section headings", message: `Standard headings found: ${expected.map((h) => h[0] + h.slice(1).toLowerCase()).join(", ")}.`, why: "ATS use standard headings to sort your resume into sections." }
      : { id: "headings", status: "fail", title: "Section headings", reason: "missing headings", message: `Not found as text: ${absent.join(", ")}.`, why: "ATS use standard headings to sort your resume into sections." },
  );

  // 5. Nothing only in images.
  const imagesWhy = "ATS can't read text inside pictures.";
  // Count logos from the resume (the PDF stores identical logos only once).
  const logos = isAts ? 0 : data.experience.filter((j) => !isBlankExperience(j) && text(j.logo)).length;
  const imageLabel =
    logos > 0 ? `${logos} company logo${logos === 1 ? " is an image" : "s are images"}` : `${reading.images} image${reading.images === 1 ? "" : "s"}`;
  checks.push(
    reading.images === 0
      ? { id: "images", status: "pass", title: "No text in images", message: "The PDF has no images: everything is real text.", why: imagesWhy }
      : missing.length === 0
        ? { id: "images", status: "pass", title: "No text in images", message: `${imageLabel}; the company names are also real text, so nothing is lost.`, why: imagesWhy }
        : { id: "images", status: "warn", title: "No text in images", reason: "text may be in images", message: `${imageLabel} and some words aren't readable as text.`, why: imagesWhy },
  );
  return checks;
}
