/*
 * Content tips: suggestions that make a resume stronger for recruiters
 * (after it has passed the ATS). Pure function over the form data.
 *
 * Every tip has a stable id made from where it is and what the text says,
 * so a dismissed tip stays dismissed, and comes back only if that text
 * changes.
 */
import { flattenDoc, type RichDoc } from "../richText";
import { isBlankExperience, isBlankProject, type ResumeData } from "../schema";

export type TipCategory = "weak-start" | "numbers" | "long" | "bullet-count" | "repeated-verb" | "cliche" | "personal";

export type Tip = {
  id: string;
  category: TipCategory;
  title: string;
  message: string;
  /** Why it matters, one plain sentence. */
  why: string;
  /** Form field to jump to ("Go to field"). */
  field: string;
};

export const TIP_CATEGORIES: { id: TipCategory; label: string }[] = [
  { id: "personal", label: "Personal details to remove" },
  { id: "weak-start", label: "Weak openings" },
  { id: "numbers", label: "Add numbers" },
  { id: "long", label: "Long bullets" },
  { id: "bullet-count", label: "Number of bullets" },
  { id: "repeated-verb", label: "Repeated openings" },
  { id: "cliche", label: "Clichés" },
];

/* ---------- Helpers ---------- */

/** Short, stable fingerprint of a text (FNV-1a), for tip ids. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const clip = (text: string, n = 8) => {
  const w = words(text);
  return w.length > n ? `${w.slice(0, n).join(" ")}…` : text;
};

type Line = { text: string; field: string; job: string };

/** Every line of text in the job (and project) descriptions, with where it lives. */
function descriptionLines(data: ResumeData): Line[] {
  const lines: Line[] = [];
  const add = (doc: RichDoc, field: string, job: string) => {
    for (const unit of flattenDoc(doc)) {
      const text = unit.inlines.map((i) => (i.type === "text" ? i.text : " ")).join("").replace(/\s+/g, " ").trim();
      if (text) lines.push({ text, field, job });
    }
  };
  data.experience.forEach((job, i) => {
    if (!isBlankExperience(job)) add(job.description, `experience.${i}.description`, job.jobTitle.trim() || job.company.trim() || `Job ${i + 1}`);
  });
  data.projects.forEach((p, i) => {
    if (!isBlankProject(p)) add(p.description, `projects.${i}.description`, p.name.trim() || `Project ${i + 1}`);
  });
  return lines;
}

/* ---------- Rules ---------- */

/** Weak openings and stronger verbs to use instead. */
const WEAK_STARTS: { pattern: RegExp; phrase: string; verbs: string[] }[] = [
  { pattern: /^responsible for\b/i, phrase: "Responsible for", verbs: ["Led", "Managed", "Owned", "Oversaw"] },
  { pattern: /^(worked|working) on\b/i, phrase: "Worked on", verbs: ["Built", "Developed", "Delivered", "Implemented"] },
  { pattern: /^helped( with| to)?\b/i, phrase: "Helped with", verbs: ["Supported", "Enabled", "Improved", "Contributed to"] },
  { pattern: /^duties included\b/i, phrase: "Duties included", verbs: ["Managed", "Handled", "Ran", "Performed"] },
  { pattern: /^assisted (with|in)\b/i, phrase: "Assisted with", verbs: ["Supported", "Coordinated", "Delivered"] },
  { pattern: /^(was )?involved in\b/i, phrase: "Involved in", verbs: ["Led", "Delivered", "Contributed to"] },
  { pattern: /^tasked with\b/i, phrase: "Tasked with", verbs: ["Led", "Delivered", "Owned"] },
];

/** A number, %, money, time or scale word counts as a measurable result. */
const MEASURABLE = /\d|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundreds?|thousands?|millions?|billions?|dozens?|double[ds]?|halved|tripled|twice)\b/i;

const CLICHES = [
  "hardworking", "hard-working", "hard working", "team player", "go-getter", "go getter", "results-driven", "results driven",
  "results-oriented", "self-starter", "self starter", "detail-oriented", "detail oriented", "goal-oriented", "think outside the box",
  "synergy", "dynamic individual", "highly motivated", "passionate about", "proven track record", "excellent communication skills",
];

/** Places where personal text can appear, for the personal-details tips. */
function personalTexts(data: ResumeData): { text: string; field: string }[] {
  const p = data.personal;
  const out = [
    { text: p.fullName, field: "personal.fullName" },
    { text: p.jobTitle, field: "personal.jobTitle" },
    { text: p.location, field: "personal.location" },
    { text: flattenDoc(data.summary).map((u) => u.inlines.map((i) => (i.type === "text" ? i.text : " ")).join("")).join(" "), field: "summary" },
    { text: data.sidebarSummary, field: "sidebarSummary" },
  ];
  return out.filter((x) => x.text.trim());
}

const PERSONAL: { pattern: RegExp; label: string; advice: string }[] = [
  { pattern: /\b(date of birth|birth ?date|d\.o\.b\.?|dob|born on)\b|\bage\s*[:-]\s*\d{2}\b/i, label: "Date of birth or age", advice: "Leave out your date of birth and age." },
  { pattern: /\b(marital status|married|unmarried|divorced|widowed)\b/i, label: "Marital status", advice: "Leave out your marital status." },
  { pattern: /\b(nationality|religion|gender)\s*[:-]/i, label: "Nationality, religion or gender", advice: "Leave out nationality, religion and gender unless the job requires it." },
];

/** A street address or postcode, not just a city. */
const FULL_ADDRESS = /\d+[\s,/-]*\w*\s+(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|boulevard|blvd|drive|dr\.?|cross|main|nagar|layout|block|sector)\b|\b(apt|apartment|flat|house no\.?|suite)\b|\b\d{5}(-\d{4})?\b|\b\d{3}\s?\d{3}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;

/* ---------- The tips ---------- */

export function contentTips(data: ResumeData): Tip[] {
  const tips: Tip[] = [];
  const lines = descriptionLines(data);

  // Personal details recruiters don't need.
  for (const { text, field } of personalTexts(data)) {
    for (const rule of PERSONAL) {
      if (rule.pattern.test(text)) {
        tips.push({
          id: `personal:${field}:${rule.label}`,
          category: "personal",
          title: rule.label,
          field,
          message: `${rule.advice} (found in ${field === "summary" ? "your summary" : field === "sidebarSummary" ? "your sidebar summary" : "your personal details"})`,
          why: "Recruiters don't need it, and in many countries it can lead to unconscious bias.",
        });
      }
    }
  }
  if (FULL_ADDRESS.test(data.personal.location)) {
    tips.push({
      id: `personal:address:${fingerprint(data.personal.location)}`,
      category: "personal",
      title: "Full home address",
      field: "personal.location",
      message: `“${data.personal.location.trim()}” looks like a full address. City and region are enough, e.g. “Austin, TX”.`,
      why: "ATS only need your city for location searches; a full address is private information.",
    });
  }

  // Weak openings, and long bullets.
  for (const line of lines) {
    const weak = WEAK_STARTS.find((w) => w.pattern.test(line.text.replace(/^[^\p{L}]+/u, "")));
    if (weak) {
      tips.push({
        id: `weak:${line.field}:${fingerprint(line.text)}`,
        category: "weak-start",
        title: `Starts with “${weak.phrase}”`,
        field: line.field,
        message: `“${clip(line.text)}” (${line.job}). Start with what you did: ${weak.verbs.map((v) => `“${v}”`).join(", ")}.`,
        why: "Recruiters skim the first words of each bullet; an action verb shows what you achieved.",
      });
    }
    const count = words(line.text).length;
    if (count > 35) {
      tips.push({
        id: `long:${line.field}:${fingerprint(line.text)}`,
        category: "long",
        title: "Long bullet",
        field: line.field,
        message: `${count} words: “${clip(line.text)}” (${line.job}). Aim for one or two lines (under about 35 words), or split it.`,
        why: "Long bullets get skimmed past; short ones with a result get read.",
      });
    }
  }

  // Jobs: bullets without numbers, and too few or too many bullets.
  data.experience.forEach((job, i) => {
    if (isBlankExperience(job)) return;
    const field = `experience.${i}.description`;
    const jobLines = lines.filter((l) => l.field === field);
    const name = job.jobTitle.trim() || job.company.trim() || `Job ${i + 1}`;
    const noNumbers = jobLines.filter((l) => !MEASURABLE.test(l.text));
    if (noNumbers.length > 0) {
      tips.push({
        id: `numbers:${field}:${fingerprint(noNumbers.map((l) => l.text).join("|"))}`,
        category: "numbers",
        title: `${name}: ${noNumbers.length} of ${jobLines.length} bullet${jobLines.length === 1 ? "" : "s"} without a number`,
        field,
        message: `${noNumbers.slice(0, 3).map((l) => `“${clip(l.text, 6)}”`).join(", ")}${noNumbers.length > 3 ? "…" : ""}. Add a number, %, time saved or scale if you can.`,
        why: "Numbers make results believable and quick to scan.",
      });
    }
    if (jobLines.length < 2 || jobLines.length > 8) {
      tips.push({
        id: `count:${field}:${jobLines.length < 2 ? "few" : "many"}`,
        category: "bullet-count",
        title: `${name}: ${jobLines.length} bullet${jobLines.length === 1 ? "" : "s"}`,
        field,
        message:
          jobLines.length < 2
            ? "Add a few more bullets: 3–6 with results is typical for a recent job."
            : "That's a lot. Keep the strongest 6–8, most impressive first.",
        why: jobLines.length < 2 ? "A job with one line looks unimportant to recruiters." : "Recruiters skim; the best results get lost in a long list.",
      });
    }
  });

  // The same opening verb used again and again.
  const firstWords = new Map<string, Line[]>();
  for (const line of lines) {
    const first = line.text.replace(/^[^\p{L}]+/u, "").split(/\s+/)[0]?.replace(/[^\p{L}-]/gu, "");
    if (!first || first.length < 3) continue;
    const key = first.toLowerCase();
    firstWords.set(key, [...(firstWords.get(key) ?? []), line]);
  }
  for (const [verb, uses] of firstWords) {
    if (uses.length < 3) continue;
    const shown = verb[0].toUpperCase() + verb.slice(1);
    tips.push({
      id: `verb:${verb}`,
      category: "repeated-verb",
      title: `“${shown}” starts ${uses.length} bullets`,
      field: uses[1].field,
      message: `Vary your openings so each bullet stands out, e.g. ${(VERB_ALTERNATIVES[verb] ?? ["Delivered", "Improved", "Launched"]).map((v) => `“${v}”`).join(", ")}.`,
      why: "Repeated openings make different achievements look the same.",
    });
  }

  // Clichés, unless the same sentence backs them up with a number.
  const sources = [
    ...personalTexts(data).filter((x) => x.field === "summary" || x.field === "sidebarSummary" || x.field === "personal.jobTitle"),
    ...lines.map((l) => ({ text: l.text, field: l.field })),
  ];
  for (const { text, field } of sources) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (MEASURABLE.test(sentence)) continue; // backed up with a number: fine
      const found = CLICHES.filter((c) => sentence.toLowerCase().includes(c));
      // "hard-working" and "hard working" are one cliché: keep the longest match per spot.
      for (const cliche of found.filter((c) => !found.some((o) => o !== c && o.includes(c)))) {
        tips.push({
          id: `cliche:${field}:${cliche}`,
          category: "cliche",
          title: `“${cliche}”`,
          field,
          message: `Says little on its own. Show it with a result instead, e.g. “cut costs by 18%”, or remove it.`,
          why: "Recruiters see these words in almost every resume and skip them.",
        });
      }
    }
  }

  // One tip per id (the same cliché twice in one field, etc.).
  return [...new Map(tips.map((t) => [t.id, t])).values()];
}

const VERB_ALTERNATIVES: Record<string, string[]> = {
  led: ["Directed", "Headed", "Guided"],
  managed: ["Oversaw", "Ran", "Coordinated"],
  developed: ["Built", "Created", "Designed"],
  built: ["Developed", "Created", "Engineered"],
  created: ["Designed", "Launched", "Built"],
  improved: ["Increased", "Strengthened", "Raised"],
  worked: ["Delivered", "Built", "Partnered"],
  implemented: ["Rolled out", "Introduced", "Launched"],
  introduced: ["Launched", "Rolled out", "Set up"],
  designed: ["Architected", "Planned", "Created"],
  automated: ["Scripted", "Streamlined", "Built"],
  executed: ["Ran", "Carried out", "Delivered"],
  responsible: ["Led", "Owned", "Managed"],
};

/** "Content tips: 4 tips" (dismissed tips don't count). */
export function tipsSummary(visible: number): string {
  return `Content tips: ${visible === 0 ? "none" : `${visible} tip${visible === 1 ? "" : "s"}`}`;
}
