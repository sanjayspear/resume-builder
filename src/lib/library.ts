import { bulletsToDoc, normalizeRichDoc } from "./richText";
import { emptyExperience, emptyResume, type Certification, type Experience, type Project, type ResumeData } from "./schema";
import { LANGUAGE_LEVEL_VALUES, type LanguageLevel } from "./languages";
import { normalizeStyle } from "./theme";

/*
 * The "library" of saved resumes, stored in the browser's localStorage.
 *
 * Every function that changes the library is "pure": it takes the old
 * library and returns a new one without touching storage or the screen.
 * Only loadLibrary/saveLibrary talk to localStorage (see libraryStore.ts
 * for how the screens read and write it).
 */

export type SavedResume = {
  id: string;
  /** Name typed by the user. Empty = use an automatic name from the data. */
  customName: string;
  createdAt: number; // milliseconds since 1970 (Date.now())
  updatedAt: number;
  data: ResumeData;
  /** ATS check inputs for this resume (kept with it, so backups include them). */
  ats: AtsState;
};

/**
 * What the ATS check remembers per resume: the job description and target
 * title you pasted, your keyword edits, and tips you dismissed. Stored only
 * in this browser (and in your backup file); never sent anywhere.
 */
export type AtsState = {
  jobDescription: string;
  targetTitle: string;
  /** Keyword keys you removed from the list. */
  removedKeywords: string[];
  /** Keywords you added yourself, as typed. */
  addedKeywords: string[];
  /** Content tips you dismissed (Phase 3). */
  dismissedTips: string[];
};

export const emptyAtsState = (): AtsState => ({
  jobDescription: "",
  targetTitle: "",
  removedKeywords: [],
  addedKeywords: [],
  dismissedTips: [],
});

/** Safe to load from any saved or imported value (older saves have none). */
export function normalizeAtsState(value: unknown): AtsState {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof AtsState, unknown>>;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []);
  return {
    jobDescription: str(v.jobDescription),
    targetTitle: str(v.targetTitle),
    removedKeywords: list(v.removedKeywords),
    addedKeywords: list(v.addedKeywords),
    dismissedTips: list(v.dismissedTips),
  };
}

export type Library = {
  version: 2;
  resumes: SavedResume[];
};

export const LIBRARY_KEY = "resume-builder:library:v2";
/** Key used by the first version of the app (single resume). Migrated once. */
export const LEGACY_KEY = "resume-builder:v1";

/* ---------- Helpers ---------- */

export function newId(): string {
  // crypto.randomUUID only exists on https/localhost; fall back elsewhere.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Name shown in the list: custom name, else "Full Name - Job Title". */
export function displayName(resume: Pick<SavedResume, "customName" | "data">): string {
  const custom = resume.customName.trim();
  if (custom) return custom;
  const name = resume.data.personal?.fullName?.trim() ?? "";
  const title = resume.data.personal?.jobTitle?.trim() ?? "";
  if (name && title) return `${name} - ${title}`;
  return name || title || "Untitled resume";
}

/**
 * Makes any stored/imported value safe to load into the form: missing
 * fields get blank defaults, wrong types are dropped. Never throws.
 */
export function normalizeResumeData(value: unknown): ResumeData {
  const base = emptyResume();
  if (!value || typeof value !== "object") return base;
  const saved = value as Partial<ResumeData>;
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const text = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  return {
    // Every personal field becomes a string ("" when missing, e.g. LinkedIn in older saves).
    personal: Object.fromEntries(
      Object.entries(base.personal).map(([key, fallback]) => [
        key,
        text((saved.personal as Record<string, unknown> | undefined)?.[key], fallback),
      ]),
    ) as ResumeData["personal"],
    // Older saves stored the summary as plain text; normalizeRichDoc converts it.
    summary: normalizeRichDoc(saved.summary),
    experienceOrder: saved.experienceOrder === "oldest" ? "oldest" : "newest",
    experience: list<Record<string, unknown>>(saved.experience).map(normalizeExperience),
    projects: list<Record<string, unknown>>(saved.projects).map(normalizeProject),
    education: list(saved.education),
    certifications: list<Record<string, unknown>>(saved.certifications).map(
      (c): Certification => ({ name: text(c?.name, ""), issuer: text(c?.issuer, ""), year: text(c?.year, "") }),
    ),
    skillGroups: list(saved.skillGroups),
    languages: list<Record<string, unknown>>(saved.languages).map((lang) => ({
      name: text(lang?.name, ""),
      level: LANGUAGE_LEVEL_VALUES.includes(lang?.level as LanguageLevel) ? (lang.level as LanguageLevel) : "professional",
    })),
    sidebarSummary: text(saved.sidebarSummary, base.sidebarSummary),
    style: normalizeStyle(saved.style),
  };
}

/**
 * Older saves had `bullets: [{ value }]` per job; they become a formatted
 * bullet-list `description`, keeping every bullet's text.
 */
function normalizeExperience(job: Record<string, unknown>): Experience {
  const base = emptyExperience();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const description =
    job.description !== undefined
      ? normalizeRichDoc(job.description)
      : Array.isArray(job.bullets)
        ? bulletsToDoc(job.bullets.map((b) => str((b as { value?: unknown })?.value)))
        : base.description;
  return {
    startDate: str(job.startDate),
    endDate: str(job.endDate),
    isCurrent: job.isCurrent === true,
    jobTitle: str(job.jobTitle),
    company: str(job.company),
    location: str(job.location),
    logo: typeof job.logo === "string" && job.logo.startsWith("data:image/") ? job.logo : "",
    description,
  };
}

function normalizeProject(project: Record<string, unknown>): Project {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { name: str(project?.name), link: str(project?.link), description: normalizeRichDoc(project?.description) };
}

function normalizeSavedResume(value: unknown): SavedResume | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SavedResume>;
  const now = Date.now();
  return {
    id: typeof v.id === "string" && v.id ? v.id : newId(),
    customName: typeof v.customName === "string" ? v.customName : "",
    createdAt: typeof v.createdAt === "number" ? v.createdAt : now,
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : now,
    data: normalizeResumeData(v.data),
    ats: normalizeAtsState(v.ats),
  };
}

export function createResume(data: ResumeData = emptyResume(), customName = ""): SavedResume {
  const now = Date.now();
  return { id: newId(), customName, createdAt: now, updatedAt: now, data, ats: emptyAtsState() };
}

/** Changes this resume's ATS check inputs (job description, keyword edits…). */
export function updateAtsState(library: Library, id: string, patch: Partial<AtsState>): Library {
  const existing = findResume(library, id);
  if (!existing) return library;
  const ats = { ...existing.ats, ...patch };
  if (JSON.stringify(ats) === JSON.stringify(existing.ats)) return library;
  const updated: SavedResume = { ...existing, ats, updatedAt: Date.now() };
  return { ...library, resumes: library.resumes.map((r) => (r.id === id ? updated : r)) };
}

/** Newest first. */
export function sortedByUpdated(library: Library): SavedResume[] {
  return [...library.resumes].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function findResume(library: Library, id: string): SavedResume | undefined {
  return library.resumes.find((r) => r.id === id);
}

/* ---------- Pure operations (old library in, new library out) ---------- */

/**
 * Stores new form data for a resume. Returns the SAME library when nothing
 * changed (so "Last edited" doesn't move when you only open a resume) or
 * when the resume no longer exists (deleted - we never bring it back).
 */
export function updateResumeData(library: Library, id: string, data: ResumeData): Library {
  const existing = findResume(library, id);
  if (!existing || JSON.stringify(existing.data) === JSON.stringify(data)) return library;
  const updated: SavedResume = { ...existing, data, updatedAt: Date.now() };
  return { ...library, resumes: library.resumes.map((r) => (r.id === id ? updated : r)) };
}

export function addResume(library: Library, resume: SavedResume): Library {
  return { ...library, resumes: [...library.resumes, resume] };
}

export function renameResume(library: Library, id: string, customName: string): Library {
  return {
    ...library,
    resumes: library.resumes.map((r) =>
      r.id === id ? { ...r, customName: customName.trim(), updatedAt: Date.now() } : r,
    ),
  };
}

/** A new resume with the same content, named "Copy of ...". */
export function duplicateResume(library: Library, id: string): { library: Library; copy: SavedResume | null } {
  const source = findResume(library, id);
  if (!source) return { library, copy: null };
  const copy = { ...createResume(structuredClone(source.data), `Copy of ${displayName(source)}`), ats: structuredClone(source.ats) };
  return { library: addResume(library, copy), copy };
}

export function deleteResume(library: Library, id: string): Library {
  return { ...library, resumes: library.resumes.filter((r) => r.id !== id) };
}

/* ---------- Backup file (export / import) ---------- */

export type BackupFile = {
  app: "resume-builder";
  version: 2;
  exportedAt: string;
  resumes: SavedResume[];
};

export function toBackup(library: Library): BackupFile {
  return {
    app: "resume-builder",
    version: 2,
    exportedAt: new Date().toISOString(),
    resumes: sortedByUpdated(library),
  };
}

/**
 * Reads a backup file's text. Imported resumes are always ADDED with new
 * ids, so importing can never overwrite or delete anything you already have.
 * Throws an Error with a friendly message if the file isn't a valid backup.
 */
export function importBackup(library: Library, fileText: string): { library: Library; added: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("That file isn't a valid backup (it's not JSON).");
  }
  const list = (parsed as Partial<BackupFile>)?.resumes;
  if ((parsed as Partial<BackupFile>)?.app !== "resume-builder" || !Array.isArray(list)) {
    throw new Error("That file isn't a Resume Builder backup.");
  }
  const imported = list
    .map(normalizeSavedResume)
    .filter((r): r is SavedResume => r !== null)
    .map((r) => ({ ...r, id: newId() }));
  if (imported.length === 0) throw new Error("The backup file doesn't contain any resumes.");
  return { library: { ...library, resumes: [...library.resumes, ...imported] }, added: imported.length };
}

/* ---------- localStorage (the only impure part) ---------- */

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Loads the library from storage:
 * - saved library -> cleaned up and returned
 * - otherwise, a resume saved by the first app version -> migrated into the list
 * - otherwise -> an empty list
 */
export function loadLibrary(): Library {
  const stored = parseJson(readStorage(LIBRARY_KEY)) as Partial<Library> | null;
  if (Array.isArray(stored?.resumes)) {
    const resumes = stored.resumes.map(normalizeSavedResume).filter((r): r is SavedResume => r !== null);
    return { version: 2, resumes };
  }
  const legacy = parseJson(readStorage(LEGACY_KEY));
  return { version: 2, resumes: legacy ? [createResume(normalizeResumeData(legacy))] : [] };
}

/** Returns false if the browser refused (storage full or blocked). */
export function saveLibrary(library: Library): boolean {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    // The old single-resume key has been migrated into the library.
    window.localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}
