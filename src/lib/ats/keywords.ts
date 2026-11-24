/*
 * Job match: which important keywords from a job description your resume
 * already contains, and where. Everything here runs on the device.
 *
 * Keywords come from two places:
 *  1. a dictionary of skills, tools and certifications for many professions
 *     (src/data/ats/skills.json), and
 *  2. phrases (1-3 words) the job description repeats, minus filler words
 *     (src/data/ats/filler.json).
 * Matching ignores case and simple word forms (test/tests/testing,
 * manage/managed/management) and treats synonyms and acronyms as equal in
 * both directions (src/data/ats/synonyms.json: CI/CD = continuous integration).
 */
import fillerData from "@/data/ats/filler.json";
import skillsData from "@/data/ats/skills.json";
import synonymData from "@/data/ats/synonyms.json";
import { richTextToPlain } from "../richText";
import { isBlankExperience, isBlankProject, type ResumeData } from "../schema";
import type { Check } from "./types";

/* ---------- Words ---------- */

/** Words of a text, lower-case. Keeps tech names whole: "ci/cd", "c#", "c++", "node.js", ".net", "e-learning". */
export function tokenize(text: string): string[] {
  const normalised = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  return normalised.match(/\.?[\p{L}\p{N}](?:[\p{L}\p{N}+#&]|[./'-](?=[\p{L}\p{N}]))*[+#]*/gu) ?? [];
}

/**
 * A light "word stem" so simple forms match: tests/testing -> test,
 * managed/management/managing -> manag, processes -> process.
 * Short words, acronyms with symbols and numbers are left alone.
 */
export function stem(word: string): string {
  if (word.length <= 3 || /[^a-z]/.test(word)) return word;
  let w = word;
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("ments")) w = w.slice(0, -5);
  else if (w.endsWith("ment")) w = w.slice(0, -4);
  else if (w.endsWith("ing") && w.length > 5) w = undouble(w.slice(0, -3));
  else if (w.endsWith("ed") && w.length > 4) w = undouble(w.slice(0, -2));
  else if (w.endsWith("es") && /(ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** planning -> plann -> plan, shipped -> shipp -> ship (but billing -> bill stays). */
function undouble(w: string): string {
  return /([bdfgmnprt])\1$/.test(w) ? w.slice(0, -1) : w;
}

const stemmedKey = (phrase: string) => tokenize(phrase).map(stem).join(" ");

/** The key a keyword is matched and remembered by: "REST APIs" -> "rest api". */
export const keywordKey = stemmedKey;

/* ---------- Data files ---------- */

// Filler words in both forms, because phrases are compared as stems ("experience" -> "experienc").
const FILLER = new Set(fillerData.words.flatMap((w) => [w.toLowerCase(), stem(w.toLowerCase())]));

/** Dictionary terms: stemmed key -> display name. */
const DICTIONARY = new Map<string, string>();
for (const [category, terms] of Object.entries(skillsData)) {
  if (category.startsWith("_") || !Array.isArray(terms)) continue;
  for (const term of terms) if (!DICTIONARY.has(stemmedKey(term))) DICTIONARY.set(stemmedKey(term), term);
}

/** Synonym groups: stemmed key -> every stemmed variant in its group (including itself). */
const SYNONYMS = new Map<string, string[]>();
const DISPLAY = new Map<string, string>(); // stemmed variant -> the group's display name
for (const group of synonymData.groups) {
  const keys = group.map(stemmedKey);
  keys.forEach((key) => {
    SYNONYMS.set(key, [...new Set([...(SYNONYMS.get(key) ?? []), ...keys])]);
    if (!DISPLAY.has(key)) DISPLAY.set(key, group[0]);
  });
}

/** Every stemmed form that counts as this keyword. */
export const variantsOf = (key: string) => SYNONYMS.get(key) ?? [key];

/* ---------- Extracting keywords from a job description ---------- */

export type Keyword = {
  /** Stemmed form used for matching and for remembering removals, e.g. "rest api". */
  key: string;
  /** How it's shown, e.g. "REST API". */
  label: string;
  /** Times it appears in the job description (synonyms included). */
  count: number;
  /** Where it came from: the skills dictionary, a repeated phrase, or the user. */
  source: "dictionary" | "phrase" | "added";
};

const MAX_KEYWORDS = 25;

/**
 * Counts how often a stemmed phrase (or any of its variants) appears in a list
 * of stemmed words. Each place counts once, using the longest variant there,
 * so "Selenium WebDriver" is one mention, not three (selenium, webdriver…).
 */
function countIn(words: string[], key: string): number {
  const variants = variantsOf(key)
    .map((v) => v.split(" "))
    .sort((a, b) => b.length - a.length);
  let total = 0;
  for (let i = 0; i < words.length; ) {
    const hit = variants.find((parts) => i + parts.length <= words.length && parts.every((p, j) => words[i + j] === p));
    if (hit) {
      total++;
      i += hit.length;
    } else i++;
  }
  return total;
}

const isFiller = (word: string) => FILLER.has(word) || /^\d+$/.test(word) || word.length < 2;

/**
 * The important keywords of a job description: dictionary skills found in
 * it first, then phrases it repeats. Filler words are never keywords.
 * `removed` (keys) are left out; `added` (labels typed by the user) are included.
 */
export function extractKeywords(jobDescription: string, { removed = [], added = [] }: { removed?: string[]; added?: string[] } = {}): Keyword[] {
  const sentences = jobDescription.split(/[\n.;:!?•·]+|\s[-–—]\s/).map((s) => tokenize(s).map(stem));
  const words = sentences.flat();
  const found = new Map<string, Keyword>();
  const covered = new Set<string>(); // keys already represented (synonyms included)
  const add = (key: string, label: string, count: number, source: Keyword["source"]) => {
    if (found.has(key) || variantsOf(key).some((v) => covered.has(v))) return;
    found.set(key, { key, label, count, source });
    variantsOf(key).forEach((v) => covered.add(v));
  };

  // 1. Dictionary skills, most mentioned first; longer names win over parts of them.
  const hits = [...DICTIONARY.entries()]
    .map(([key, label]) => ({ key, label: DISPLAY.get(key) ?? label, count: countIn(words, key) }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count || b.key.split(" ").length - a.key.split(" ").length);
  for (const h of hits) {
    // Skip "rest" when "rest api" is already in, etc.
    if ([...found.keys()].some((k) => k.includes(h.key) && k !== h.key)) continue;
    add(h.key, h.label, h.count, "dictionary");
  }

  // 2. Repeated phrases (1-3 words, not starting or ending with filler).
  const phrases = new Map<string, { count: number; n: number }>();
  for (const sentence of sentences) {
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i + n <= sentence.length; i++) {
        const gram = sentence.slice(i, i + n);
        if (isFiller(gram[0]) || isFiller(gram[gram.length - 1]) || gram.every(isFiller)) continue;
        const key = gram.join(" ");
        const entry = phrases.get(key) ?? { count: 0, n };
        entry.count++;
        phrases.set(key, entry);
      }
    }
  }
  const labelFor = labelFinder(jobDescription);
  // The job title is checked on its own, so phrases made only of title words are skipped.
  const titleWords = new Set(tokenize(guessJobTitle(jobDescription)).map(stem));
  [...phrases.entries()]
    .filter(([, p]) => p.count >= (p.n === 1 ? 3 : 2))
    .sort(([, a], [, b]) => b.count * b.n - a.count * a.n)
    .forEach(([key, p]) => {
      // A phrase inside a longer one that's just as frequent adds nothing.
      if ([...phrases.entries()].some(([k, q]) => k !== key && q.n > p.n && q.count >= p.count && q.count >= 2 && ` ${k} `.includes(` ${key} `))) return;
      if ([...found.keys()].some((k) => ` ${k} `.includes(` ${key} `))) return;
      if (key.split(" ").every((w) => titleWords.has(w))) return;
      add(key, labelFor(key), p.count, "phrase");
    });

  const removedSet = new Set(removed);
  const list = [...found.values()].filter((k) => !removedSet.has(k.key)).slice(0, MAX_KEYWORDS);
  for (const label of added) {
    const key = stemmedKey(label);
    if (!key || removedSet.has(key) || list.some((k) => k.key === key || variantsOf(k.key).includes(key))) continue;
    list.push({ key, label: label.trim(), count: countIn(words, key), source: "added" });
  }
  return list;
}

/** Shows a phrase the way the job description wrote it (first occurrence). */
function labelFinder(text: string) {
  const original = text.match(/\.?[\p{L}\p{N}](?:[\p{L}\p{N}+#&]|[./'-](?=[\p{L}\p{N}]))*[+#]*/gu) ?? [];
  const stems = original.map((w) => stem(w.toLowerCase()));
  return (key: string) => {
    const parts = key.split(" ");
    for (let i = 0; i + parts.length <= stems.length; i++) {
      if (parts.every((p, j) => stems[i + j] === p)) return original.slice(i, i + parts.length).join(" ");
    }
    return key;
  };
}

/* ---------- Matching against the resume ---------- */

export type Place = "Headline" | "Summary" | "Skills" | "Experience" | "Projects" | "Education" | "Certifications";

type Source = { place: Place; field: string; words: string[] };

/** The resume as searchable pieces, each with the form field it comes from. */
function resumeSources(data: ResumeData): Source[] {
  const src = (place: Place, field: string, text: string): Source => ({ place, field, words: tokenize(text).map(stem) });
  const out: Source[] = [src("Headline", "personal.jobTitle", data.personal.jobTitle), src("Summary", "summary", richTextToPlain(data.summary))];
  data.skillGroups.forEach((g, i) => out.push(src("Skills", `skillGroups.${i}.name`, [g.name, ...g.skills.map((s) => s.value)].join(" , "))));
  data.experience.forEach((job, i) => {
    if (isBlankExperience(job)) return;
    out.push(src("Experience", `experience.${i}.jobTitle`, job.jobTitle));
    out.push(src("Experience", `experience.${i}.description`, richTextToPlain(job.description)));
  });
  data.projects.forEach((p, i) => {
    if (!isBlankProject(p)) out.push(src("Projects", `projects.${i}.description`, `${p.name} ${richTextToPlain(p.description)}`));
  });
  data.education.forEach((e, i) => out.push(src("Education", `education.${i}.degree`, `${e.degree} ${e.institution}`)));
  data.certifications.forEach((c, i) => out.push(src("Certifications", `certifications.${i}.name`, `${c.name} ${c.issuer}`)));
  return out;
}

export type KeywordResult = Keyword & {
  matched: boolean;
  /** Sections where it was found, in resume order. */
  places: Place[];
  /** Times it appears in the resume, not counting job titles (for the over-use warning). */
  occurrences: number;
  /** First field where it appears (for "Go to field"). */
  field?: string;
};

export function matchKeywords(data: ResumeData, keywords: Keyword[]): KeywordResult[] {
  const sources = resumeSources(data);
  return keywords.map((k) => {
    const hits = sources.map((s) => ({ s, n: countIn(s.words, k.key) })).filter((h) => h.n > 0);
    // Job titles naturally repeat ("Operations Manager" in every job), so they don't count as over-use.
    const isTitle = (s: Source) => s.place === "Headline" || s.field.endsWith(".jobTitle");
    return {
      ...k,
      matched: hits.length > 0,
      places: [...new Set(hits.map((h) => h.s.place))],
      occurrences: hits.filter((h) => !isTitle(h.s)).reduce((sum, h) => sum + h.n, 0),
      field: hits[0]?.s.field,
    };
  });
}

/* ---------- Job title ---------- */

/** A job title guessed from the job description: "Job title: X", or a short first line. */
export function guessJobTitle(jobDescription: string): string {
  const labelled = jobDescription.match(/(?:job\s*title|position|role)\s*[:–-]\s*([^\n]{3,80})/i);
  if (labelled) return labelled[1].trim().replace(/[.,;]+$/, "");
  const first = jobDescription.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const words = first.split(/\s+/);
  return words.length >= 1 && words.length <= 8 && !/[.:!?]$/.test(first) ? first : "";
}

/* ---------- The checks ---------- */

/** "Job match: 18 of 24 keywords" (or why there's nothing to show yet). */
export function jobMatchSummary(results: KeywordResult[], jobDescription: string): string {
  if (!jobDescription.trim()) return "Job match: no job description yet";
  if (results.length === 0) return "Job match: no keywords found";
  return `Job match: ${results.filter((r) => r.matched).length} of ${results.length} keywords`;
}

/** Overused keywords (more than 5 times) and the job title, as checks. */
export function jobMatchChecks(data: ResumeData, results: KeywordResult[], jobDescription: string, targetTitle: string): Check[] {
  const checks: Check[] = [];
  const title = targetTitle.trim() || guessJobTitle(jobDescription);
  const why = "ATS and recruiters often search for the exact job title.";
  if (!title) {
    checks.push({ id: "job-title", status: "info", title: "Job title", message: "Add a target job title to check whether your resume uses it.", why });
  } else {
    const key = stemmedKey(title);
    const where = resumeSources(data).filter((s) => s.place === "Headline" || (s.place === "Experience" && s.field.endsWith(".jobTitle")));
    const hit = where.find((s) => countIn(s.words, key) > 0);
    checks.push(
      hit
        ? { id: "job-title", status: "pass", title: "Job title", message: `“${title}” appears in your ${hit.place === "Headline" ? "headline" : "experience"}.`, why }
        : {
            id: "job-title",
            status: "warn",
            title: "Job title",
            reason: "job title not in resume",
            field: "personal.jobTitle",
            message: `“${title}” isn't in your headline or job titles. If it fits your experience, use it in your headline.`,
            why,
          },
    );
  }
  for (const r of results.filter((x) => x.occurrences > 5)) {
    checks.push({
      id: `overused-${r.key}`,
      status: "warn",
      title: "Keyword repeated a lot",
      reason: `“${r.label}” repeated`,
      field: r.field,
      message: `“${r.label}” appears ${r.occurrences} times. More than about 5 reads as keyword stuffing to recruiters.`,
      why: "Recruiters read the resume after the ATS; repetition looks like gaming the system.",
    });
  }
  return checks;
}
