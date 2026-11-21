"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { sortExperience } from "@/lib/experienceSort";
import { templateInfo } from "@/lib/templates";
import { displayName, findResume, updateResumeData, type SavedResume } from "@/lib/library";
import { commitLibrary, useLibrary } from "@/lib/libraryStore";
import { pdfFileName, renderResumePdf, saveBlob } from "@/lib/pdf";
import { sampleResume } from "@/lib/sampleData";
import { emptyResume, resumeSchema, type ResumeData } from "@/lib/schema";
import {
  EducationSection,
  ExperienceSection,
  LanguagesSection,
  PersonalSection,
  SidebarSummarySection,
  SkillsSection,
  SummarySection,
} from "../form/FormSections";
import { AppHeader } from "../AppHeader";
import { LivePanel } from "../LivePanel";

/** Counts the individual error messages in React Hook Form's error tree. */
function countErrors(node: unknown): number {
  if (!node || typeof node !== "object") return 0;
  const record = node as Record<string, unknown>;
  if (typeof record.message === "string" && "type" in record) return 1;
  return Object.entries(record).reduce(
    (sum, [key, value]) => (key === "ref" ? sum : sum + countErrors(value)),
    0,
  );
}

const AUTOSAVE_DELAY_MS = 400;

const buttonBase =
  "inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

type Message = { kind: "success" | "error" | "info"; text: string };

/** Editor page: finds the resume from the URL (?id=...) and shows the form. */
export default function ResumeEditor({ id }: { id: string | null }) {
  const library = useLibrary();
  const resume = library && id ? findResume(library, id) : undefined;

  if (!library) {
    return <p className="p-10 text-center text-sm text-slate-500">Loading resume…</p>;
  }
  if (!resume) {
    return (
      <div className="app-bg min-h-screen">
        <AppHeader />
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Resume not found</h1>
          <p className="max-w-sm text-sm text-slate-600">
            It may have been deleted, or it was saved in a different browser.
          </p>
          <Link href="/" className="btn-dark mt-2 rounded-lg px-4 py-2 text-sm font-semibold">
            ← Back to my resumes
          </Link>
        </div>
      </div>
    );
  }
  return <EditorForm resume={resume} />;
}

function EditorForm({ resume }: { resume: SavedResume }) {
  const resumeId = resume.id;
  // Only the starting values come from storage; after that the form owns the data.
  // Jobs are shown in date order from the start (Work experience "Order").
  const [initialValues] = useState(() => {
    const data = structuredClone(resume.data);
    return { ...data, experience: sortExperience(data.experience, data.experienceOrder) };
  });

  const methods = useForm<ResumeData>({
    resolver: zodResolver(resumeSchema),
    defaultValues: initialValues,
    mode: "onTouched", // show an error once you leave a field...
    reValidateMode: "onChange", // ...then update it as you type
  });
  const { control, reset, getValues, handleSubmit, formState, subscribe } = methods;

  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef(false);

  /** Saves the form right now (skipping the auto-save delay). */
  const flushSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    pendingRef.current = false;
    // structuredClone: getValues() returns the form's LIVE object; storing it
    // directly would make later edits look "unchanged" and skip saving.
    const values = structuredClone(getValues());
    const { saved } = commitLibrary((lib) => updateResumeData(lib, resumeId, values));
    if (!saved) {
      setMessage({
        kind: "error",
        text: "Couldn't save: your browser's storage is full or blocked. Download the PDF or export a backup.",
      });
    }
  }, [resumeId, getValues]);

  // Auto-save: every change restarts a short timer; when typing pauses, save.
  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: () => {
        pendingRef.current = true;
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
      },
    });
    // Closing/reloading the tab: save immediately.
    window.addEventListener("pagehide", flushSave);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flushSave);
      // Leaving the editor (Back button, "My resumes", browser back): save
      // anything still waiting instead of throwing it away.
      if (pendingRef.current) flushSave();
    };
  }, [subscribe, flushSave]);

  const templateName = templateInfo(useWatch({ control, name: "style.template" })).name;

  const errorCount = countErrors(formState.errors);
  const showErrorSummary = formState.submitCount > 0 && errorCount > 0;

  // "Empty" means no content; the Design settings don't count.
  const contentOnly = (data: ResumeData) => JSON.stringify({ ...data, style: null });
  const isFormEmpty = () => contentOnly(getValues()) === contentOnly(emptyResume());

  const handleLoadSample = () => {
    if (!isFormEmpty() && !window.confirm("Replace the content of this resume with the sample resume?")) return;
    // Replace the content but keep this resume's Design choices.
    // Keep this resume's Design and date order; show the jobs sorted.
    const { style, experienceOrder } = getValues();
    const sample = structuredClone(sampleResume);
    reset({ ...sample, style, experienceOrder, experience: sortExperience(sample.experience, experienceOrder) });
    setMessage({ kind: "info", text: "Sample data loaded." });
  };

  const handleClear = () => {
    if (!window.confirm("Clear everything in this resume? This can't be undone.")) return;
    reset({ ...emptyResume(), style: getValues().style }); // keep the Design choices
    setMessage(null);
  };

  // handleSubmit runs validation first; the download only happens if it passes.
  const handleDownload = handleSubmit(
    async (data) => {
      setDownloading(true);
      setMessage(null);
      try {
        const blob = await renderResumePdf(data);
        const fileName = pdfFileName(data.personal.fullName);
        saveBlob(blob, fileName);
        setMessage({ kind: "success", text: `Downloaded ${fileName}` });
      } catch (error) {
        console.error("Download failed", error);
        setMessage({ kind: "error", text: "Sorry, the PDF couldn't be created. Please try again." });
      } finally {
        setDownloading(false);
      }
    },
    () => setMessage(null), // invalid: the error summary + field messages explain why
  );

  return (
    <FormProvider {...methods}>
      <div className="app-bg min-h-screen text-slate-900">
        <AppHeader wide />
        {/* Action bar: stays at the top while you scroll the form. */}
        <div className="glass-bar sticky top-0 z-20">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
            <Link
              href="/"
              onClick={flushSave}
              aria-label="Back to My resumes"
              title="Back to My resumes"
              className="btn-light flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-700"
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="mr-auto min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight" data-testid="current-resume">
                {displayName(resume)}
              </h1>
              <p className="truncate text-xs text-slate-500" data-testid="current-template">
                {templateName} template<span className="hidden sm:inline"> · changes save automatically</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/guide"
                onClick={flushSave}
                aria-label="Help: open the user guide"
                title="User guide"
                className={`${buttonBase} btn-light w-9 px-0 text-slate-700`}
              >
                ?
              </Link>
              <button
                type="button"
                onClick={handleClear}
                className={`${buttonBase} text-slate-600 hover:bg-slate-100`}
              >
                Clear form
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className={`${buttonBase} btn-light`}
              >
                Load sample data
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className={`${buttonBase} btn-primary gap-1.5`}
              >
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
                </svg>
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            {showErrorSummary && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Please fix the {errorCount} highlighted field{errorCount === 1 ? "" : "s"} before downloading.
              </div>
            )}
            {message && (
              <div
                role="status"
                className={`rounded-lg border p-3 text-sm ${
                  message.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : message.kind === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                }`}
              >
                {message.text}
              </div>
            )}

            <PersonalSection />
            <SummarySection />
            <ExperienceSection />
            <EducationSection />
            <SkillsSection />
            <LanguagesSection />
            <SidebarSummarySection />
          </div>

          <LivePanel control={control} />
        </main>
      </div>
    </FormProvider>
  );
}
