"use client";

import { addResume, createResume, type SavedResume } from "./library";
import { commitLibrary } from "./libraryStore";
import { emptyResume } from "./schema";
import { templateInfo, type TemplateId } from "./templates";

/**
 * Saves a brand-new blank resume that uses `template` (layout + colour).
 * Returns its id, and whether the browser actually stored it.
 */
export function createResumeFromTemplate(template: TemplateId = "coral"): { id: string; saved: boolean } {
  const data = emptyResume();
  data.style = { ...data.style, template, accentColor: templateInfo(template).accent };
  return saveNewResume(createResume(data));
}

/** Saves an already-built resume (blank, sample, ...) and returns its id. */
export function saveNewResume(resume: SavedResume): { id: string; saved: boolean } {
  const { saved } = commitLibrary((lib) => addResume(lib, resume));
  return { id: resume.id, saved };
}

export const editorUrl = (id: string) => `/edit?id=${encodeURIComponent(id)}`;
