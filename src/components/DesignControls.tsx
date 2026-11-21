"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { ResumeData } from "@/lib/schema";
import { templateInfo, TEMPLATES } from "@/lib/templates";
import { ACCENT_PRESETS, FONT_OPTIONS, FONT_SIZE_OPTIONS, LINE_HEIGHT_OPTIONS, LOGO_SIZE_OPTIONS } from "@/lib/theme";
import { ErrorText } from "./ui";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

/**
 * "Design" bar above the preview: font, base size, line spacing and accent
 * colour. These are normal form fields (style.*), so they auto-save with the
 * resume and update the preview like any other change.
 */
export function DesignControls() {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const accent = useWatch({ control, name: "style.accentColor" }) ?? "";
  const isPreset = ACCENT_PRESETS.some((p) => p.value.toLowerCase() === accent.toLowerCase());

  const pickColor = (value: string) =>
    setValue("style.accentColor", value.toUpperCase(), { shouldDirty: true, shouldValidate: true });

  return (
    <section aria-labelledby="design-title" className="glass mb-4 rounded-2xl p-4 sm:p-5">
      <h2 id="design-title" className="mb-3 text-sm font-bold text-slate-900">
        Design
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="field-style-template" className="mb-1 block text-xs font-semibold text-slate-700">
            Template
          </label>
          <select
            id="field-style-template"
            className={selectClass}
            {...register("style.template", {
              // A template comes with its own colour; you can still change it below.
              onChange: (e) => pickColor(templateInfo(e.target.value).accent),
            })}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} - {t.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="field-style-fontFamily" className="mb-1 block text-xs font-semibold text-slate-700">
            Font
          </label>
          <select id="field-style-fontFamily" className={selectClass} {...register("style.fontFamily")}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="field-style-fontSize" className="mb-1 block text-xs font-semibold text-slate-700">
            Text size
          </label>
          <select id="field-style-fontSize" className={selectClass} {...register("style.fontSize", { valueAsNumber: true })}>
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} pt{size === 8.8 ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="field-style-lineHeight" className="mb-1 block text-xs font-semibold text-slate-700">
            Line spacing
          </label>
          <select
            id="field-style-lineHeight"
            className={selectClass}
            {...register("style.lineHeight", { valueAsNumber: true })}
          >
            {LINE_HEIGHT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="field-style-logoSize" className="mb-1 block text-xs font-semibold text-slate-700">
            Logo size
          </label>
          <select id="field-style-logoSize" className={selectClass} {...register("style.logoSize", { valueAsNumber: true })}>
            {LOGO_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 block text-xs font-semibold text-slate-700">Accent colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((p) => {
            const selected = p.value.toLowerCase() === accent.toLowerCase();
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => pickColor(p.value)}
                aria-label={`${p.label} accent colour`}
                aria-pressed={selected ? "true" : "false"}
                title={p.label}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  selected ? "scale-110 border-slate-900" : "border-white shadow ring-1 ring-slate-200 hover:scale-105"
                }`}
                style={{ backgroundColor: p.value }}
              />
            );
          })}
          <label
            className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs font-medium ${
              isPreset ? "border-slate-300 text-slate-600" : "border-slate-900 text-slate-900"
            }`}
            title="Choose any colour"
          >
            <input
              type="color"
              aria-label="Custom accent colour"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent.toLowerCase() : "#e8726e"}
              onChange={(e) => pickColor(e.target.value)}
              className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            Custom
          </label>
        </div>
        <ErrorText id="field-style-accentColor-error" message={errors.style?.accentColor?.message} />
      </fieldset>
      <p className="mt-2 text-xs text-slate-500">
        Georgia and Calibri are Microsoft fonts that can&apos;t be embedded in PDFs, so free look-alikes with the
        same letter widths are used.
      </p>
    </section>
  );
}
