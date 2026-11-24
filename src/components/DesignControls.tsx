"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { ResumeData } from "@/lib/schema";
import { TEMPLATES } from "@/lib/templates";
import {
  ACCENT_PRESETS,
  ATS_ACCENT_PRESETS,
  ATS_HEADER_STYLES,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  LOGO_SIZE_OPTIONS,
} from "@/lib/theme";
import type { AtsHeaderStyle } from "@/lib/theme";
import { ResumeThumbnail } from "./ResumeThumbnail";
import { ErrorText } from "./ui";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

/**
 * "Design" bar above the preview: the template, plus the options that
 * template uses. These are normal form fields (style.*), so they auto-save
 * with the resume and update the preview like any other change.
 * Switching template never touches the content, and each template keeps
 * its own accent colour, so switching back and forth loses nothing.
 */
export function DesignControls() {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const template = useWatch({ control, name: "style.template" });
  const accent = useWatch({ control, name: "style.accentColor" }) ?? "";
  const atsAccent = useWatch({ control, name: "style.atsAccentColor" }) ?? "";
  const atsHeader = useWatch({ control, name: "style.atsHeader" }) ?? "banner";
  const isAts = template === "modern-ats";

  const pickColor = (field: "style.accentColor" | "style.atsAccentColor", value: string) =>
    setValue(field, value.toUpperCase(), { shouldDirty: true, shouldValidate: true });

  return (
    <section aria-labelledby="design-title" className="glass mb-4 rounded-2xl p-4 sm:p-5">
      <h2 id="design-title" className="mb-3 text-sm font-bold text-slate-900">
        Design
      </h2>

      <fieldset>
        <legend className="mb-1.5 block text-xs font-semibold text-slate-700">Template</legend>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((t) => {
            const selected = template === t.id;
            return (
              <label
                key={t.id}
                data-testid={`template-option-${t.id}`}
                className={`flex cursor-pointer flex-col rounded-xl border-2 bg-white/70 p-2 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300 ${
                  selected ? "border-indigo-600" : "border-transparent ring-1 ring-slate-200 hover:ring-slate-300"
                }`}
              >
                {/* A real radio button (hidden visually): keyboard and screen readers work as usual. */}
                <input type="radio" value={t.id} className="sr-only" {...register("style.template")} />
                <span className="block h-20 overflow-hidden rounded-lg bg-gradient-to-b from-slate-100 to-slate-200/70 pt-2">
                  <ResumeThumbnail
                    name="Your Name"
                    title="Job title"
                    accent={t.id === "modern-ats" ? atsAccent : accent}
                    layout={t.layout}
                    atsHeader={atsHeader}
                    accentHeadings
                  />
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{t.name}</span>
                  {t.badge && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {t.badge}
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500">{t.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {isAts ? (
        <>
          <fieldset className="mt-4">
            <legend className="mb-1.5 block text-xs font-semibold text-slate-700">Header style</legend>
            <div className="grid grid-cols-3 gap-2">
              {ATS_HEADER_STYLES.map((h) => {
                const selected = atsHeader === h.value;
                return (
                  <label
                    key={h.value}
                    data-testid={`header-option-${h.value}`}
                    title={h.description}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 bg-white/70 p-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-300 ${
                      selected ? "border-indigo-600" : "border-transparent ring-1 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    <input type="radio" value={h.value} className="sr-only" {...register("style.atsHeader")} />
                    <HeaderSketch style={h.value} accent={atsAccent} />
                    <span className="text-xs font-semibold leading-tight text-slate-900">{h.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="mb-1 block text-xs font-semibold text-slate-700">Accent colour</legend>
            <div className="flex flex-wrap items-center gap-2">
              {ATS_ACCENT_PRESETS.map((p) => (
                <ColorSwatch
                  key={p.value}
                  label={p.label}
                  value={p.value}
                  selected={p.value.toLowerCase() === atsAccent.toLowerCase()}
                  onPick={() => pickColor("style.atsAccentColor", p.value)}
                />
              ))}
            </div>
          </fieldset>
          <AtsMoreOptions />
        </>
      ) : (
        <ClassicOptions
          accent={accent}
          onPickAccent={(value) => pickColor("style.accentColor", value)}
          accentError={errors.style?.accentColor?.message}
        />
      )}
    </section>
  );
}

function ColorSwatch({
  label,
  value,
  selected,
  onPick,
}: {
  label: string;
  value: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${label} accent colour`}
      aria-pressed={selected ? "true" : "false"}
      title={label}
      className={`h-7 w-7 rounded-full border-2 transition ${
        selected ? "scale-110 border-slate-900" : "border-white shadow ring-1 ring-slate-200 hover:scale-105"
      }`}
      style={{ backgroundColor: value }}
    />
  );
}

/**
 * Accent colour, then font, size, spacing and logo size behind "More options"
 * (closed by default, so the Design panel stays short and the preview's
 * header and first page are visible without scrolling, as with Modern ATS).
 */
function ClassicOptions({
  accent,
  onPickAccent,
  accentError,
}: {
  accent: string;
  onPickAccent: (value: string) => void;
  accentError?: string;
}) {
  const { register } = useFormContext<ResumeData>();
  const isPreset = ACCENT_PRESETS.some((p) => p.value.toLowerCase() === accent.toLowerCase());
  const [moreOpen, setMoreOpen] = useState(false);
  const accentPicker = (
    <fieldset className="mt-4">
      <legend className="mb-1 block text-xs font-semibold text-slate-700">Accent colour</legend>
      <div className="flex flex-wrap items-center gap-2">
        {ACCENT_PRESETS.map((p) => (
          <ColorSwatch
            key={p.value}
            label={p.label}
            value={p.value}
            selected={p.value.toLowerCase() === accent.toLowerCase()}
            onPick={() => onPickAccent(p.value)}
          />
        ))}
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
            onChange={(e) => onPickAccent(e.target.value)}
            className="h-4 w-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          Custom
        </label>
      </div>
      <ErrorText id="field-style-accentColor-error" message={accentError} />
    </fieldset>
  );
  return (
    <>
      {accentPicker}
      <button
        type="button"
        aria-expanded={moreOpen}
        aria-controls="classic-more-options"
        onClick={() => setMoreOpen((open) => !open)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
      >
        <span aria-hidden className={`inline-block transition ${moreOpen ? "rotate-90" : ""}`}>
          ▸
        </span>
        More options: font, text size, line spacing, logo size
      </button>
      {moreOpen && (
        <div id="classic-more-options">
          <div className="mt-3 grid grid-cols-2 gap-3">
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

          <p className="mt-2 text-xs text-slate-500">
            Georgia and Calibri are Microsoft fonts that can&apos;t be embedded in PDFs, so free look-alikes with the
            same letter widths are used.
          </p>
        </div>
      )}
    </>
  );
}

/** "More options" for Modern ATS: Bold numbers, plus what this template leaves out. Closed by default. */
function AtsMoreOptions() {
  const { register } = useFormContext<ResumeData>();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ats-more-options"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"
      >
        <span aria-hidden className={`inline-block transition ${open ? "rotate-90" : ""}`}>
          ▸
        </span>
        More options: bold numbers
      </button>
      {open && (
        <div id="ats-more-options">
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" {...register("style.atsBoldMetrics")} />
            Bold numbers
            <span className="text-xs text-slate-500">(40%, $140K, 6,500…)</span>
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Modern ATS uses fixed, scanner-friendly fonts (Montserrat headings, Inter 10 pt text) and one column. Skill
            ratings, logos, icons and the sidebar summary aren&apos;t shown; switch back to Classic Sidebar any time to
            see them again.
          </p>
        </div>
      )}
    </>
  );
}

/** A tiny drawing of each header style (just the header: no text, so it stays readable at this size). */
function HeaderSketch({ style, accent }: { style: AtsHeaderStyle; accent: string }) {
  const bar = (w: string, color: string, h = 2) => (
    <span className="block rounded-full" style={{ width: w, height: h, backgroundColor: color }} />
  );
  return (
    <span aria-hidden className="flex h-7 w-11 shrink-0 flex-col overflow-hidden rounded border border-slate-200 bg-white">
      {style === "banner" ? (
        <span className="flex h-[60%] flex-col items-center justify-center gap-[2px]" style={{ backgroundColor: accent }}>
          {bar("60%", "#FFFFFF", 3)}
          {bar("40%", "rgba(255,255,255,0.7)")}
        </span>
      ) : style === "accent" ? (
        <span className="flex gap-[3px] px-[4px] pt-[4px]">
          <span className="block w-[3px] self-stretch" style={{ backgroundColor: accent }} />
          <span className="flex flex-1 flex-col gap-[2px] py-[1px]">
            {bar("80%", accent, 3)}
            {bar("55%", "#CBD2DB")}
          </span>
        </span>
      ) : (
        <span className="flex flex-col gap-[2px] px-[4px] pt-[4px]">
          {bar("75%", accent, 3)}
          {bar("50%", "#CBD2DB")}
          <span className="mt-[1px] block h-[1px] w-full" style={{ backgroundColor: accent }} />
        </span>
      )}
      <span className="mt-auto flex flex-col gap-[2px] px-[4px] pb-[3px]">
        {bar("90%", "#E2E6EB", 1.5)}
      </span>
    </span>
  );
}
