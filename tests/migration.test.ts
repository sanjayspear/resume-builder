/*
 * Saved resumes from earlier versions of the app must keep loading:
 * old template ids map to the new templates, new fields get empty values,
 * and the result passes the form's validation. Run with: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeResumeData } from "@/lib/library";
import { sampleResume } from "@/lib/sampleData";
import { resumeSchema } from "@/lib/schema";
import { resolveTemplateId } from "@/lib/templates";
import { normalizeStyle } from "@/lib/theme";

test("old template ids map to the two current templates", () => {
  assert.equal(resolveTemplateId("coral"), "classic");
  assert.equal(resolveTemplateId("slate"), "classic");
  assert.equal(resolveTemplateId("ocean"), "classic");
  assert.equal(resolveTemplateId("minimal"), "modern-ats");
  assert.equal(resolveTemplateId("classic"), "classic");
  assert.equal(resolveTemplateId("modern-ats"), "modern-ats");
});

test("a missing or unknown template falls back to Classic Sidebar", () => {
  assert.equal(normalizeStyle(undefined).template, "classic");
  assert.equal(normalizeStyle({}).template, "classic");
  assert.equal(normalizeStyle({ template: "does-not-exist" }).template, "classic");
  assert.equal(normalizeStyle({ template: 42 }).template, "classic");
});

test("switching templates keeps each template's colour; bad ATS colours fall back to navy", () => {
  const style = normalizeStyle({ template: "slate", accentColor: "#3D4552" });
  assert.equal(style.accentColor, "#3D4552", "Classic colour from the old Slate template is kept");
  assert.equal(style.atsAccentColor, "#1E3A5F");
  assert.equal(normalizeStyle({ atsAccentColor: "#0f5e63" }).atsAccentColor, "#0F5E63");
  assert.equal(normalizeStyle({ atsAccentColor: "#FF00FF" }).atsAccentColor, "#1E3A5F");
});

test("a resume saved by the previous version loads with all new fields and is valid", () => {
  // Shape of a save from before this change: no LinkedIn, city, projects,
  // certifications or ATS colour, and an old template id.
  const old: Record<string, unknown> = JSON.parse(JSON.stringify(sampleResume));
  delete old.projects;
  delete old.certifications;
  delete (old.personal as Record<string, unknown>).linkedin;
  for (const job of old.experience as Record<string, unknown>[]) delete job.location;
  old.style = { template: "ocean", fontFamily: "Roboto", fontSize: 9.5, lineHeight: 1.5, accentColor: "#0F766E", logoSize: 24 };

  const loaded = normalizeResumeData(old);

  assert.equal(loaded.style.template, "classic");
  assert.equal(loaded.style.accentColor, "#0F766E");
  assert.equal(loaded.style.fontFamily, "Roboto");
  assert.equal(loaded.personal.linkedin, "");
  assert.deepEqual(loaded.projects, []);
  assert.deepEqual(loaded.certifications, []);
  assert.ok(loaded.experience.every((job) => job.location === ""));
  assert.equal(loaded.experience.length, sampleResume.experience.length, "no jobs lost");

  const result = resumeSchema.safeParse(loaded);
  assert.ok(result.success, `loaded resume should be valid: ${JSON.stringify(result.error?.issues)}`);
});

test("the sample resume passes the form's validation", () => {
  const result = resumeSchema.safeParse(sampleResume);
  assert.ok(result.success, JSON.stringify(result.error?.issues));
});
