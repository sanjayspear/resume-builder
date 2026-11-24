"use client";

import { get, useFieldArray, useFormContext, useWatch, type FieldError } from "react-hook-form";
import {
  EXPERIENCE_ORDER_LABELS,
  EXPERIENCE_ORDERS,
  hasDateConflict,
  sortedIndexes,
  type ExperienceOrder,
} from "@/lib/experienceSort";
import { LANGUAGE_LEVELS } from "@/lib/languages";
import {
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyLanguage,
  emptyProject,
  emptySkillGroup,
  type ResumeData,
} from "@/lib/schema";
import { useSpellField } from "../spell/useSpellField";
import { AddButton, EntryCard, ErrorText, Section, TextAreaField, TextField, toId } from "../ui";
import { LogoField } from "./LogoField";
import { RichTextField } from "./RichTextField";
import { StringListField } from "./StringListField";

/* ---------- 1. Personal ---------- */

export function PersonalSection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const e = errors.personal;
  const jobTitleSpell = useSpellField("personal.jobTitle");
  return (
    <Section title="Personal details">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name *" error={e?.fullName} autoComplete="name" {...register("personal.fullName")} />
        <TextField label="Job title *" error={e?.jobTitle} autoComplete="organization-title" {...register("personal.jobTitle")} {...jobTitleSpell} />
        <TextField label="Location" error={e?.location} placeholder="City, State" {...register("personal.location")} />
        <TextField label="Phone" error={e?.phone} type="tel" autoComplete="tel" {...register("personal.phone")} />
        <TextField label="Email *" error={e?.email} type="email" autoComplete="email" {...register("personal.email")} />
        <TextField label="Website / portfolio" error={e?.website} placeholder="example.com" autoComplete="url" {...register("personal.website")} />
        <TextField label="LinkedIn" error={e?.linkedin} placeholder="linkedin.com/in/your-name" {...register("personal.linkedin")} />
      </div>
    </Section>
  );
}

/* ---------- 2. Summary ---------- */

export function SummarySection() {
  return (
    <Section title="Summary" description="A short paragraph at the top of your resume.">
      <RichTextField name="summary" label="Summary *" hint="Select text to make it bold, italic or underlined." />
    </Section>
  );
}

/* ---------- 3. Work experience ---------- */

function ExperienceEntry({ index, onRemove }: { index: number; onRemove: () => void }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const e = errors.experience?.[index];
  const path = `experience.${index}` as const;
  const isCurrent = useWatch({ control, name: `${path}.isCurrent` });
  const jobTitle = useWatch({ control, name: `${path}.jobTitle` });
  const checkboxId = toId(`${path}.isCurrent`);
  const titleSpell = useSpellField(`${path}.jobTitle`);

  return (
    <EntryCard
      title={jobTitle?.trim() || `Job ${index + 1}`}
      onRemove={onRemove}
      removeLabel={`Remove job ${index + 1}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Start year *"
          error={e?.startDate}
          placeholder="2023 or January 2023"
          {...register(`${path}.startDate`, { deps: [`${path}.endDate`] })}
        />
        <div>
          {isCurrent ? (
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-700">End year</span>
              <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Present
              </p>
            </div>
          ) : (
            <TextField
              label="End year *"
              error={e?.endDate}
              placeholder="2024 or January 2024"
              {...register(`${path}.endDate`)}
            />
          )}
          <label htmlFor={checkboxId} className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              id={checkboxId}
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              {...register(`${path}.isCurrent`, { deps: [`${path}.endDate`] })}
            />
            I currently work here (Present)
          </label>
        </div>
        <TextField label="Job title *" error={e?.jobTitle} {...register(`${path}.jobTitle`)} {...titleSpell} />
        <TextField label="Company *" error={e?.company} {...register(`${path}.company`)} />
        <TextField label="City" error={e?.location} placeholder="e.g. Austin, TX" {...register(`${path}.location`)} />
      </div>
      <LogoField index={index} />
      <RichTextField
        name={`${path}.description`}
        label="Description *"
        hint="One bullet per achievement. Press Enter twice to leave the list."
      />
    </EntryCard>
  );
}

export function ExperienceSection() {
  const { control, register, getValues } = useFormContext<ResumeData>();
  const { fields, append, prepend, remove, move } = useFieldArray({ control, name: "experience" });
  const order = useWatch({ control, name: "experienceOrder" });

  /**
   * Puts the job cards in date order. Uses `move` (not replace) so each card
   * keeps its editor; only cards that are out of place are moved.
   */
  const applySort = (sortOrder: ExperienceOrder) => {
    const jobs = getValues("experience");
    const target = sortedIndexes(jobs, sortOrder);
    if (target.every((original, i) => original === i)) return;
    const focused = document.activeElement as HTMLElement | null;
    const current = jobs.map((_, i) => i);
    target.forEach((original, i) => {
      const from = current.indexOf(original);
      if (from !== i) {
        move(from, i);
        current.splice(i, 0, current.splice(from, 1)[0]);
      }
    });
    // Moving cards can drop keyboard focus; put it back where it was.
    requestAnimationFrame(() => {
      if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    });
  };

  const addJob = () => {
    // A new (undated) job belongs at the top for "latest first", at the bottom otherwise.
    if (order === "oldest") append(emptyExperience(), { focusName: `experience.${fields.length}.startDate` });
    else prepend(emptyExperience(), { focusName: "experience.0.startDate" });
  };

  return (
    <Section title="Work experience" description="Sorted by date. Jobs you currently have count as the most recent.">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="field-experienceOrder" className="text-xs font-semibold text-slate-700">
          Order
        </label>
        <select
          id="field-experienceOrder"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          {...register("experienceOrder", { onChange: (e) => applySort(e.target.value as ExperienceOrder) })}
        >
          {EXPERIENCE_ORDERS.map((o) => (
            <option key={o} value={o}>
              {EXPERIENCE_ORDER_LABELS[o]}
              {o === "newest" ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>
      {fields.map((field, index) => (
        <div
          key={field.id}
          data-testid="experience-card"
          // When you finish with a job (focus leaves its card), re-sort so a
          // changed date moves it to the right place. Not while typing in it.
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            // Don't move cards while a date is wrong (end before start): the
            // card would jump away along with its error message.
            if (getValues("experience").some(hasDateConflict)) return;
            applySort(getValues("experienceOrder"));
          }}
        >
          <ExperienceEntry index={index} onRemove={() => remove(index)} />
        </div>
      ))}
      <AddButton onClick={addJob}>Add work experience</AddButton>
    </Section>
  );
}

/* ---------- 3b. Projects (optional) ---------- */

export function ProjectsSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name: "projects" });
  return (
    <Section title="Projects" description="Optional. Shown after Work experience; leave empty to hide the section.">
      {fields.map((field, index) => {
        const e = errors.projects?.[index];
        const path = `projects.${index}` as const;
        return (
          <EntryCard
            key={field.id}
            title={`Project ${index + 1}`}
            onRemove={() => remove(index)}
            removeLabel={`Remove project ${index + 1}`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Project name *" error={e?.name} {...register(`${path}.name`)} />
              <TextField label="Link" error={e?.link} placeholder="github.com/you/project" {...register(`${path}.link`)} />
            </div>
            <RichTextField name={`${path}.description`} label="Description *" hint="What you built and the result." />
          </EntryCard>
        );
      })}
      <AddButton onClick={() => append(emptyProject(), { focusName: `projects.${fields.length}.name` })}>
        Add project
      </AddButton>
    </Section>
  );
}

/* ---------- 4. Education ---------- */

export function EducationSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name: "education" });
  return (
    <Section title="Education">
      {fields.map((field, index) => {
        const e = errors.education?.[index];
        const path = `education.${index}` as const;
        return (
          <EntryCard
            key={field.id}
            title={`Education ${index + 1}`}
            onRemove={() => remove(index)}
            removeLabel={`Remove education ${index + 1}`}
          >
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <TextField label="Year *" error={e?.year} placeholder="2020" {...register(`${path}.year`)} />
              <TextField label="Degree *" error={e?.degree} {...register(`${path}.degree`)} />
            </div>
            <TextField label="Institution *" error={e?.institution} {...register(`${path}.institution`)} />
          </EntryCard>
        );
      })}
      <AddButton onClick={() => append(emptyEducation(), { focusName: `education.${fields.length}.year` })}>
        Add education
      </AddButton>
    </Section>
  );
}

/* ---------- 4b. Certifications (optional) ---------- */

export function CertificationsSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name: "certifications" });
  return (
    <Section title="Certifications" description="Optional. Shown after Education; leave empty to hide the section.">
      {fields.map((field, index) => {
        const e = errors.certifications?.[index];
        const path = `certifications.${index}` as const;
        return (
          <EntryCard
            key={field.id}
            title={`Certification ${index + 1}`}
            onRemove={() => remove(index)}
            removeLabel={`Remove certification ${index + 1}`}
          >
            <TextField label="Certification *" error={e?.name} {...register(`${path}.name`)} />
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <TextField label="Issued by" error={e?.issuer} {...register(`${path}.issuer`)} />
              <TextField label="Year" error={e?.year} placeholder="2024" {...register(`${path}.year`)} />
            </div>
          </EntryCard>
        );
      })}
      <AddButton onClick={() => append(emptyCertification(), { focusName: `certifications.${fields.length}.name` })}>
        Add certification
      </AddButton>
    </Section>
  );
}

/* ---------- 5. Skill groups ---------- */

function SkillGroupEntry({ index, onRemove }: { index: number; onRemove: () => void }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const path = `skillGroups.${index}` as const;
  const e = errors.skillGroups?.[index];
  const rating = useWatch({ control, name: `${path}.rating` });
  const name = useWatch({ control, name: `${path}.name` });
  const ratingId = toId(`${path}.rating`);
  const ratingError = (get(errors, `${path}.rating`) as FieldError | undefined)?.message;

  return (
    <EntryCard
      title={name?.trim() || `Skill group ${index + 1}`}
      onRemove={onRemove}
      removeLabel={`Remove skill group ${index + 1}`}
    >
      <TextField
        label="Group name *"
        error={e?.name}
        placeholder="e.g. Communication/Protocols"
        {...register(`${path}.name`)}
      />
      <div>
        <label htmlFor={ratingId} className="mb-1 block text-xs font-semibold text-slate-700">
          Rating: <span className="text-indigo-700">{Number.isFinite(rating) ? rating : "-"}</span> / 10
        </label>
        <input
          id={ratingId}
          type="range"
          min={1}
          max={10}
          step={1}
          aria-invalid={ratingError ? true : undefined}
          className="w-full accent-indigo-600"
          {...register(`${path}.rating`, { valueAsNumber: true })}
        />
        <ErrorText id={`${ratingId}-error`} message={ratingError} />
      </div>
      <StringListField name={`${path}.skills`} label="Skills *" itemLabel="Skill" addLabel="Add skill" />
    </EntryCard>
  );
}

export function SkillsSection() {
  const { control } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name: "skillGroups" });
  return (
    <Section
      title="Skill groups"
      description="Classic Sidebar shows each group with a 1-10 rating bar; Modern ATS lists the skills as text."
    >
      {fields.map((field, index) => (
        <SkillGroupEntry key={field.id} index={index} onRemove={() => remove(index)} />
      ))}
      <AddButton onClick={() => append(emptySkillGroup(), { focusName: `skillGroups.${fields.length}.name` })}>
        Add skill group
      </AddButton>
    </Section>
  );
}

/* ---------- 5b. Languages ---------- */

export function LanguagesSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name: "languages" });
  return (
    <Section title="Languages" description="Shown under Skills (Classic Sidebar) or at the end (Modern ATS).">
      {fields.length > 0 && (
        <ul className="space-y-3" aria-label="Languages">
          {fields.map((field, index) => {
            const e = errors.languages?.[index];
            const path = `languages.${index}` as const;
            return (
              <li key={field.id} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <TextField
                  label={`Language ${index + 1} *`}
                  error={e?.name}
                  placeholder="e.g. English, Kannada, Hindi"
                  className="min-w-0 flex-1 basis-40"
                  {...register(`${path}.name`)}
                />
                <div className="min-w-0 flex-1 basis-40">
                  <label htmlFor={toId(`${path}.level`)} className="mb-1 block text-xs font-semibold text-slate-700">
                    Level
                  </label>
                  <select
                    id={toId(`${path}.level`)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    {...register(`${path}.level`)}
                  >
                    {LANGUAGE_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove language ${index + 1}`}
                  title="Remove"
                  className="mt-6 shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AddButton onClick={() => append(emptyLanguage(), { focusName: `languages.${fields.length}.name` })}>
        Add language
      </AddButton>
    </Section>
  );
}

/* ---------- 6. Sidebar summary ---------- */

export function SidebarSummarySection() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const spell = useSpellField("sidebarSummary", { multiline: true });
  return (
    <Section
      title="Sidebar summary"
      description="Classic Sidebar only: a short highlight at the bottom of the sidebar. Modern ATS leaves it out so your summary isn't repeated."
    >
      <TextAreaField
        label="Highlight"
        error={errors.sidebarSummary}
        rows={3}
        hint="Optional, up to 400 characters."
        {...register("sidebarSummary")}
        {...spell}
      />
    </Section>
  );
}
