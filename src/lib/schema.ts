import { z } from "zod";
import { emptyBulletDoc, emptyDoc, isRichDoc, richTextToPlain, type RichDoc } from "./richText";
import { ATS_HEADER_VALUES, defaultStyle, FONT_VALUES, HEX_COLOR } from "./theme";
import { EXPERIENCE_ORDERS } from "./experienceSort";
import { LANGUAGE_LEVEL_VALUES } from "./languages";
import { TEMPLATE_IDS } from "./templates";

/*
 * The single source of truth for the resume data.
 * - The Zod schema below holds every validation rule (like test assertions).
 * - `ResumeData` (the TypeScript type) is generated from the schema,
 *   so the form, the PDF and the sample data can never disagree on the shape.
 */

// Matches any 4-digit year from 1900-2099, e.g. "2023" or "January 2023".
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits, spaces and + ( ) . -; X stands for a hidden digit ("+91 98XXX XXXXX").
const PHONE_PATTERN = /^(?=.*\d)[+()\dXx\s.-]{7,20}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

/** Pulls the 4-digit year out of text like "January 2023" (or null). */
export function extractYear(text: string | undefined): number | null {
  const match = text?.match(YEAR_PATTERN);
  return match ? Number(match[0]) : null;
}

const required = (message: string) => z.string().trim().min(1, message);

/* ---------- Completely empty entries ---------- */

const blank = (value: unknown) => typeof value !== "string" || value.trim() === "";
const blankDoc = (value: unknown) => !isRichDoc(value) || richTextToPlain(value).trim() === "";
const field = (entry: unknown, key: string) =>
  entry && typeof entry === "object" ? (entry as Record<string, unknown>)[key] : undefined;

/*
 * An entry the user hasn't typed anything into (e.g. the empty job that
 * "Clear form" leaves ready to fill in). Such entries are skipped: no
 * validation messages and nothing in the PDF. Settings that have a default
 * (a skill rating, a language level, the "Present" tick box) don't count
 * as content. As soon as one text field is filled in, the entry is
 * validated normally.
 */
export const isBlankExperience = (job: unknown) =>
  ["startDate", "endDate", "jobTitle", "company", "location", "logo"].every((k) => blank(field(job, k))) &&
  blankDoc(field(job, "description"));
export const isBlankProject = (project: unknown) =>
  ["name", "link"].every((k) => blank(field(project, k))) && blankDoc(field(project, "description"));
export const isBlankEducation = (item: unknown) => ["year", "degree", "institution"].every((k) => blank(field(item, k)));
export const isBlankCertification = (item: unknown) => ["name", "issuer", "year"].every((k) => blank(field(item, k)));
export const isBlankSkillGroup = (group: unknown) => {
  const skills = field(group, "skills");
  return blank(field(group, "name")) && (!Array.isArray(skills) || skills.every((s) => blank(field(s, "value"))));
};
export const isBlankLanguage = (language: unknown) => blank(field(language, "name"));

/**
 * A list where completely empty entries are allowed (and skipped); every
 * other entry must pass `entry`. Error messages keep their position
 * (e.g. "projects.0.description"), so they show under the right field.
 */
function listSkippingBlank<T extends z.ZodType>(entry: T, isBlank: (value: unknown) => boolean) {
  return z.array(z.custom<z.output<T>>()).superRefine((list, ctx) => {
    list.forEach((item, index) => {
      if (isBlank(item)) return;
      const result = entry.safeParse(item);
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: [index, ...issue.path] });
      }
    });
  });
}

// Field arrays in React Hook Form need objects, so a "list of strings"
// is stored as a list of { value: "..." }.
const listItemSchema = z.object({
  value: required("This can't be empty - type something or remove it"),
});

/** Formatted text: required, and limited by the number of characters of actual text. */
const richTextField = (requiredMessage: string, maxChars: number, maxMessage: string) =>
  z
    .custom<RichDoc>(isRichDoc, { message: requiredMessage })
    .refine((doc) => richTextToPlain(doc).trim() !== "", { message: requiredMessage })
    .refine((doc) => richTextToPlain(doc).length <= maxChars, { message: maxMessage });

const personalSchema = z.object({
  fullName: required("Full name is required").max(60, "Keep the name under 60 characters"),
  jobTitle: required("Job title is required").max(80, "Keep the job title under 80 characters"),
  location: z.string().trim().max(60, "Keep the location under 60 characters"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_PATTERN.test(v), {
      message: "Enter a valid phone number (digits, spaces and + - ( ) . only; X for a hidden digit)",
    }),
  email: required("Email is required").refine((v) => v === "" || EMAIL_PATTERN.test(v), {
    message: "Enter a valid email address, e.g. name@example.com",
  }),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || WEBSITE_PATTERN.test(v), {
      message: "Enter a valid website, e.g. example.com or https://example.com",
    }),
  linkedin: z
    .string()
    .trim()
    .refine((v) => v === "" || WEBSITE_PATTERN.test(v), {
      message: "Enter a valid LinkedIn address, e.g. linkedin.com/in/your-name",
    }),
});

const experienceSchema = z
  .object({
    startDate: required("Start year is required").regex(YEAR_PATTERN, {
      message: "Include a 4-digit year, e.g. 2023 or January 2023",
    }),
    endDate: z.string().trim(),
    isCurrent: z.boolean(),
    jobTitle: required("Job title is required"),
    company: required("Company is required"),
    location: z.string().trim().max(60, "Keep the location under 60 characters"),
    // Optional company logo: a small base64 PNG/JPG made by the app (lib/logo.ts).
    logo: z
      .string()
      .refine((v) => v === "" || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v), {
        message: "The logo isn't a valid image. Remove it and upload it again.",
      })
      .refine((v) => v.length <= 400_000, { message: "The logo is too large. Please upload a smaller image." }),
    description: richTextField(
      "Add a description of what you did in this job",
      4000,
      "Keep the description under 4000 characters",
    ),
  })
  // Cross-field rules. `when: () => true` makes them run even while other
  // fields in this entry are still invalid, so all errors show at once.
  .refine((v) => v.isCurrent || (v.endDate ?? "").trim() !== "", {
    message: 'End year is required (or tick "Present")',
    path: ["endDate"],
    when: () => true,
  })
  .refine((v) => v.isCurrent || !v.endDate?.trim() || YEAR_PATTERN.test(v.endDate), {
    message: "Include a 4-digit year, e.g. 2024 or January 2024",
    path: ["endDate"],
    when: () => true,
  })
  .refine(
    (v) => {
      if (v.isCurrent) return true;
      const start = extractYear(v.startDate);
      const end = extractYear(v.endDate);
      return start === null || end === null || end >= start;
    },
    { message: "End year can't be before the start year", path: ["endDate"], when: () => true },
  );

const educationSchema = z.object({
  year: required("Year is required").regex(YEAR_PATTERN, {
    message: "Include a 4-digit year, e.g. 2020",
  }),
  degree: required("Degree is required"),
  institution: required("Institution is required"),
});

const projectSchema = z.object({
  name: required("Project name is required").max(80, "Keep the project name under 80 characters"),
  link: z
    .string()
    .trim()
    .refine((v) => v === "" || WEBSITE_PATTERN.test(v), {
      message: "Enter a valid web address, e.g. github.com/you/project",
    }),
  description: richTextField(
    "Add a short description of the project",
    2000,
    "Keep the description under 2000 characters",
  ),
});

const certificationSchema = z.object({
  name: required("Certification name is required").max(100, "Keep the name under 100 characters"),
  issuer: z.string().trim().max(80, "Keep the issuer under 80 characters"),
  year: z
    .string()
    .trim()
    .refine((v) => v === "" || YEAR_PATTERN.test(v), { message: "Include a 4-digit year, e.g. 2024" }),
});

const skillGroupSchema = z.object({
  name: required("Group name is required").max(60, "Keep the group name under 60 characters"),
  rating: z
    .number({ error: "Rating must be a number from 1 to 10" })
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(10, "Rating can't be more than 10"),
  skills: z.array(listItemSchema).min(1, "Add at least one skill"),
});

const languageSchema = z.object({
  name: required("Language is required").max(40, "Keep the language name under 40 characters"),
  level: z.enum(LANGUAGE_LEVEL_VALUES, { error: "Choose a level" }),
});

export const resumeSchema = z.object({
  personal: personalSchema,
  summary: richTextField("Summary is required", 1200, "Keep the summary under 1200 characters"),
  experienceOrder: z.enum(EXPERIENCE_ORDERS),
  experience: listSkippingBlank(experienceSchema, isBlankExperience),
  projects: listSkippingBlank(projectSchema, isBlankProject),
  education: listSkippingBlank(educationSchema, isBlankEducation),
  certifications: listSkippingBlank(certificationSchema, isBlankCertification),
  skillGroups: listSkippingBlank(skillGroupSchema, isBlankSkillGroup),
  languages: listSkippingBlank(languageSchema, isBlankLanguage).superRefine((list, ctx) => {
    // The same language twice is almost certainly a mistake.
    const seen = new Set<string>();
    list.forEach((lang, i) => {
      const key = lang.name.trim().toLowerCase();
      if (key && seen.has(key)) {
        ctx.addIssue({ code: "custom", path: [i, "name"], message: `${lang.name.trim()} is already in the list` });
      }
      seen.add(key);
    });
  }),
  sidebarSummary: z.string().trim().max(400, "Keep the sidebar summary under 400 characters"),
  style: z.object({
    template: z.enum(TEMPLATE_IDS, { error: "Choose a template from the list" }),
    fontFamily: z.enum(FONT_VALUES, { error: "Choose a font from the list" }),
    fontSize: z.number().min(7, "Font size must be at least 7 pt").max(14, "Font size can't be more than 14 pt"),
    lineHeight: z.number().min(1, "Line spacing must be at least 1.0").max(2.5, "Line spacing can't be more than 2.5"),
    logoSize: z.number().min(12, "Logo size must be at least 12 pt").max(48, "Logo size can't be more than 48 pt"),
    accentColor: z.string().regex(HEX_COLOR, { message: "Pick a valid colour, e.g. #E8726E" }),
    atsAccentColor: z.string().regex(HEX_COLOR, { message: "Pick one of the colours" }),
    atsHeader: z.enum(ATS_HEADER_VALUES, { error: "Choose a header style" }),
    atsBoldMetrics: z.boolean(),
  }),
});

export type ResumeData = z.infer<typeof resumeSchema>;
export type Experience = ResumeData["experience"][number];
export type Education = ResumeData["education"][number];
export type Project = ResumeData["projects"][number];
export type Certification = ResumeData["certifications"][number];
export type SkillGroup = ResumeData["skillGroups"][number];
export type ResumeStyle = ResumeData["style"];
export type Language = ResumeData["languages"][number];

// Blank values used for a fresh form and for each new "Add" click.
export const emptyExperience = (): Experience => ({
  startDate: "",
  endDate: "",
  isCurrent: false,
  jobTitle: "",
  company: "",
  location: "",
  logo: "",
  description: emptyBulletDoc(),
});

export const emptyLanguage = (): Language => ({ name: "", level: "professional" });

export const emptyProject = (): Project => ({ name: "", link: "", description: emptyBulletDoc() });

export const emptyCertification = (): Certification => ({ name: "", issuer: "", year: "" });

export const emptyEducation = (): Education => ({ year: "", degree: "", institution: "" });

export const emptySkillGroup = (): SkillGroup => ({
  name: "",
  rating: 5,
  skills: [{ value: "" }],
});

export const emptyResume = (): ResumeData => ({
  personal: { fullName: "", jobTitle: "", location: "", phone: "", email: "", website: "", linkedin: "" },
  summary: emptyDoc(),
  experienceOrder: "newest",
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  skillGroups: [],
  languages: [],
  sidebarSummary: "",
  style: defaultStyle(),
});
