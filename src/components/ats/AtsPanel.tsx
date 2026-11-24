"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { goToField } from "@/lib/ats/goToField";
import { extractKeywords, jobMatchChecks, jobMatchSummary, matchKeywords } from "@/lib/ats/keywords";
import { readabilityChecks, type PdfReading } from "@/lib/ats/readability";
import { readPdfForAts } from "@/lib/ats/readPdfForAts";
import { structureChecks } from "@/lib/ats/structure";
import { summaryLine } from "@/lib/ats/summary";
import type { Check, CheckStatus } from "@/lib/ats/types";
import { emptyAtsState, findResume, updateAtsState, type AtsState } from "@/lib/library";
import { commitLibrary, useLibrary } from "@/lib/libraryStore";
import type { ResumeData } from "@/lib/schema";
import { JobMatch } from "./JobMatch";

/** Text-only checks re-run this long after typing pauses. */
const TEXT_DELAY_MS = 500;
/** The PDF check (build + read the real PDF) waits longer, so typing never lags. */
const PDF_DELAY_MS = 1500;

const TABS = [
  { id: "readability", label: "Readability" },
  { id: "job-match", label: "Job match" },
  { id: "tips", label: "Content tips" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS: Record<CheckStatus, { label: string; className: string; icon: string }> = {
  pass: { label: "Passed", className: "bg-emerald-100 text-emerald-800", icon: "✓" },
  warn: { label: "Warning", className: "bg-amber-100 text-amber-900", icon: "!" },
  fail: { label: "Problem", className: "bg-red-100 text-red-800", icon: "✕" },
  info: { label: "Info", className: "bg-slate-100 text-slate-700", icon: "i" },
};

/**
 * Where the editor toolbar ends (px from the top of the window). The panel
 * starts there on desktop, so Download PDF and the other toolbar buttons
 * stay visible. The toolbar is sticky: it moves up as the page scrolls.
 */
function useToolbarBottom(): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const toolbar = document.getElementById("editor-toolbar");
        setBottom(toolbar ? Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom)) : 0);
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);
  return bottom;
}

/** Waits until `value` has stopped changing for `ms`, then returns it. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * "ATS check" side panel: checks the resume the way an ATS reads it. Runs
 * entirely in the browser; nothing about the resume is sent anywhere.
 * Only mounted while open, so it costs nothing while closed.
 */
export function AtsPanel({ resumeId, onClose }: { resumeId: string; onClose: () => void }) {
  const { control, setValue } = useFormContext<ResumeData>();
  const values = useWatch({ control }) as ResumeData;
  const json = JSON.stringify(values);
  const textJson = useSettled(json, TEXT_DELAY_MS);
  const pdfJson = useSettled(json, PDF_DELAY_MS);
  const [tab, setTab] = useState<TabId>("readability");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const toolbarBottom = useToolbarBottom();

  // The PDF check: one run at a time; an older, slower run is ignored.
  const [reading, setReading] = useState<{ json: string; result: PdfReading } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    readPdfForAts(JSON.parse(pdfJson) as ResumeData)
      .then((result) => {
        if (cancelled) return;
        setReading({ json: pdfJson, result });
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("ATS check failed", e);
        setError("The PDF couldn't be checked. Check the form for unusual characters and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [pdfJson]);

  const readability = useMemo(
    () => (reading ? readabilityChecks(JSON.parse(reading.json) as ResumeData, reading.result) : []),
    [reading],
  );
  const structure = useMemo(
    () => structureChecks(JSON.parse(textJson) as ResumeData, { pageCount: reading?.result.extracted.pageCount }),
    [textJson, reading],
  );
  // Job match: inputs saved with this resume (job description, keyword edits).
  const library = useLibrary();
  const ats = (library && findResume(library, resumeId)?.ats) || emptyAtsState();
  const saveAts = useCallback(
    (patch: Partial<AtsState>) => commitLibrary((lib) => updateAtsState(lib, resumeId, patch)),
    [resumeId],
  );
  const keywordResults = useMemo(() => {
    const keywords = extractKeywords(ats.jobDescription, { removed: ats.removedKeywords, added: ats.addedKeywords });
    return matchKeywords(JSON.parse(textJson) as ResumeData, keywords);
  }, [ats.jobDescription, ats.removedKeywords, ats.addedKeywords, textJson]);
  const jobChecks = useMemo(
    () =>
      ats.jobDescription.trim() || ats.targetTitle.trim()
        ? jobMatchChecks(JSON.parse(textJson) as ResumeData, keywordResults, ats.jobDescription, ats.targetTitle)
        : [],
    [textJson, keywordResults, ats.jobDescription, ats.targetTitle],
  );

  const checking = !reading || reading.json !== json;
  // "Readability: Passed · Structure: 1 warning - no LinkedIn"
  const line = [
    summaryLine("Readability", readability, { pending: !reading }),
    summaryLine("Structure", structure),
    jobMatchSummary(keywordResults, ats.jobDescription),
  ].join(" · ");

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const jump = (field: string) => {
    // On phones the panel covers the whole screen: close it first.
    if (window.matchMedia("(max-width: 639px)").matches) {
      onClose();
      window.setTimeout(() => goToField(field), 50);
    } else {
      goToField(field);
    }
  };
  const switchToModernAts = () => setValue("style.template", "modern-ats", { shouldDirty: true });

  return (
    <aside
      aria-labelledby="ats-title"
      data-testid="ats-panel"
      // Phone: the whole screen. Desktop: a column on the right, below the toolbar.
      style={{ "--ats-top": `${toolbarBottom}px` } as React.CSSProperties}
      className="fixed inset-0 z-40 flex flex-col bg-white text-slate-900 shadow-2xl sm:bottom-0 sm:left-auto sm:right-0 sm:top-[var(--ats-top)] sm:w-[460px] sm:border-l sm:border-t sm:border-slate-200"
    >
      <div className="flex items-start gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0 flex-1">
          <h2 id="ats-title" ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
            ATS check
          </h2>
          <p data-testid="ats-summary" className="mt-1 text-sm font-semibold text-slate-800" aria-live="polite">
            {line}
          </p>
          <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
            {error ?? (checking ? "Updating…" : "Up to date")} · Checked on this device; nothing is uploaded.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ATS check"
          className="btn-light flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600"
        >
          ✕
        </button>
      </div>

      <p className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        No tool can predict every company&apos;s ATS. These checks cover the most common reasons resumes get filtered
        out.
      </p>

      <div role="tablist" aria-label="ATS check sections" className="flex gap-1 border-b border-slate-200 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`ats-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ats-tabpanel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
              tab === t.id ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`ats-tabpanel-${tab}`}
        aria-labelledby={`ats-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {tab === "readability" ? (
          <>
            <CheckGroup
              title="Readability"
              note="From the real PDF, read back the way an ATS reads it."
              checks={readability}
              placeholder={error ?? "Building and reading your PDF…"}
              onJump={jump}
              onSwitch={switchToModernAts}
            />
            <CheckGroup title="Structure" checks={structure} onJump={jump} onSwitch={switchToModernAts} />
          </>
        ) : tab === "job-match" ? (
          <JobMatch
            key={resumeId}
            ats={ats}
            onChange={saveAts}
            results={keywordResults}
            checks={jobChecks}
            renderCheck={(c) => <CheckItem key={c.id} check={c} onJump={jump} onSwitch={switchToModernAts} />}
            onJump={jump}
          />
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Coming in the next step: tips to strengthen your bullets and wording.
          </p>
        )}
      </div>
    </aside>
  );
}

function CheckGroup({
  title,
  note,
  checks,
  placeholder,
  onJump,
  onSwitch,
}: {
  title: string;
  note?: string;
  checks: Check[];
  placeholder?: string;
  onJump: (field: string) => void;
  onSwitch: () => void;
}) {
  return (
    <section aria-label={title} className="mb-5">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {note && <p className="text-xs text-slate-500">{note}</p>}
      {checks.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{placeholder}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {checks.map((c) => (
            <CheckItem key={c.id} check={c} onJump={onJump} onSwitch={onSwitch} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CheckItem({ check, onJump, onSwitch }: { check: Check; onJump: (field: string) => void; onSwitch: () => void }) {
  const status = STATUS[check.status];
  const needsAttention = check.status === "fail" || check.status === "warn";
  return (
    <li data-testid={`ats-check-${check.id}`} data-status={check.status} className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}
        >
          <span aria-hidden>{status.icon}</span>
          {status.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{check.title}</p>
          <p className="break-words text-sm text-slate-700">{check.message}</p>
          {needsAttention && <p className="mt-1 text-xs text-slate-500">Why it matters: {check.why}</p>}
          {needsAttention && (check.field || check.action) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {check.field && (
                <button
                  type="button"
                  onClick={() => onJump(check.field!)}
                  className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Go to field
                </button>
              )}
              {check.action === "switch-to-modern-ats" && (
                <button type="button" onClick={onSwitch} className="btn-primary rounded-lg px-2.5 py-1 text-xs font-semibold">
                  Switch to Modern ATS
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
