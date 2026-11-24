"use client";

import { addResume, createResume, type SavedResume } from "./library";
import { commitLibrary } from "./libraryStore";
import { newResumeData } from "./sampleMode";
import { DEFAULT_TEMPLATE, type TemplateId } from "./templates";

/**
 * Saves a brand-new resume that uses `template`. It starts with the sample
 * content so the preview shows the template properly; the editor offers
 * "Clear sample data". Returns its id, and whether the browser stored it.
 */
export function createResumeFromTemplate(template: TemplateId = DEFAULT_TEMPLATE): { id: string; saved: boolean } {
  return saveNewResume(createResume(newResumeData(template)));
}

/** Saves an already-built resume (blank, sample, ...) and returns its id. */
export function saveNewResume(resume: SavedResume): { id: string; saved: boolean } {
  const { saved } = commitLibrary((lib) => addResume(lib, resume));
  return { id: resume.id, saved };
}

export const editorUrl = (id: string) => `/edit?id=${encodeURIComponent(id)}`;
