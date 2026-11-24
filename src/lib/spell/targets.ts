/*
 * Which words of a resume to spell-check, and where they are. Only prose is
 * checked (summary, headline, job titles, bullets); names and tools are not:
 * skills, companies, schools, certifications, acronyms (QA, SQL), product
 * names with inner capitals (TypeScript), anything with digits or symbols,
 * and capitalised words in the middle of a sentence (names like Quillmere).
 */
import extraWords from "@/data/ats/extra-words.json";
import skillsData from "@/data/ats/skills.json";
import synonymData from "@/data/ats/synonyms.json";
import { flattenDoc, type RichDoc } from "../richText";
import { isBlankExperience, isBlankProject, type ResumeData } from "../schema";

export type SpellTarget = {
  /** The word as written, e.g. "Recieved" (possessive 's removed). */
  word: string;
  field: string;
  /** Where it is, for the message: "Summary", "Senior Operations Manager"… */
  where: string;
};

const lettersOf = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];

/** Lower-case words that count as correct for this resume: tools, skills, names, companies… */
export function knownTerms(data: ResumeData): Set<string> {
  const known = new Set<string>();
  const add = (text: string | undefined) => lettersOf(text ?? "").forEach((w) => known.add(w));
  for (const [key, terms] of Object.entries(skillsData)) if (!key.startsWith("_") && Array.isArray(terms)) terms.forEach(add);
  synonymData.groups.flat().forEach(add);
  extraWords.words.forEach(add); // workplace words the dictionaries lack (workstream, onboarding…)
  const p = data.personal;
  [p.fullName, p.location, p.email, p.website, p.linkedin].forEach(add);
  data.skillGroups.forEach((g) => [g.name, ...g.skills.map((s) => s.value)].forEach(add));
  data.experience.forEach((j) => [j.company, j.location].forEach(add));
  data.education.forEach((e) => [e.institution, e.degree].forEach(add));
  data.certifications.forEach((c) => [c.name, c.issuer].forEach(add));
  data.projects.forEach((x) => add(x.name));
  data.languages.forEach((l) => add(l.name));
  return known;
}

const docText = (doc: RichDoc) =>
  flattenDoc(doc).map((u) => u.inlines.map((i) => (i.type === "text" ? i.text : " ")).join(""));

export type FoundWord = { word: string; start: number; end: number };

/**
 * Words in a text worth spell-checking, with their positions (for drawing
 * underlines). Skips names and tools (see the top of this file).
 */
export function wordsToCheck(text: string, known: Set<string>): FoundWord[] {
  const out: FoundWord[] = [];
  for (const match of text.matchAll(/\p{L}[\p{L}'’-]*/gu)) {
    const before = text.slice(0, match.index).trimEnd();
    const sentenceStart = before === "" || /[.!?:;•(–—-]$/.test(before);
    const whole = match[0].replace(/['’]s$/i, "").replace(/['’-]+$/, "");
    let offset = match.index;
    for (const word of whole.split("-")) {
      const start = offset;
      offset += word.length + 1; // the next part starts after the hyphen
      if (word.length < 2) continue;
      if (/['’]/.test(word)) continue; // contractions like "don't"
      if (word === word.toUpperCase()) continue; // acronyms: QA, SQL
      if (/\p{Ll}\p{Lu}/u.test(word)) continue; // TypeScript, iOS, KPIs
      if (/^\p{Lu}/u.test(word) && !sentenceStart) continue; // a name in mid-sentence
      if (known.has(word.toLowerCase())) continue;
      out.push({ word, start, end: start + word.length });
    }
  }
  return out;
}

/** Every word worth checking, with where it is. */
export function spellTargets(data: ResumeData): SpellTarget[] {
  const known = knownTerms(data);
  const out: SpellTarget[] = [];
  const scan = (texts: string[], field: string, where: string) => {
    for (const text of texts) for (const { word } of wordsToCheck(text, known)) out.push({ word, field, where });
  };
  scan([data.personal.jobTitle], "personal.jobTitle", "Headline");
  scan(docText(data.summary), "summary", "Summary");
  scan([data.sidebarSummary], "sidebarSummary", "Sidebar summary");
  data.experience.forEach((job, i) => {
    if (isBlankExperience(job)) return;
    const name = job.jobTitle.trim() || job.company.trim() || `Job ${i + 1}`;
    scan([job.jobTitle], `experience.${i}.jobTitle`, name);
    scan(docText(job.description), `experience.${i}.description`, name);
  });
  data.projects.forEach((p, i) => {
    if (!isBlankProject(p)) scan(docText(p.description), `projects.${i}.description`, p.name.trim() || `Project ${i + 1}`);
  });
  return out;
}
