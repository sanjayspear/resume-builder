"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createResume,
  deleteResume,
  displayName,
  duplicateResume,
  findResume,
  importBackup,
  renameResume,
  sortedByUpdated,
  toBackup,
  type SavedResume,
} from "@/lib/library";
import { createResumeFromTemplate, editorUrl, saveNewResume } from "@/lib/createResume";
import { commitLibrary, useLibrary } from "@/lib/libraryStore";
import { pdfFileName, renderResumePdf, saveBlob } from "@/lib/pdf";
import { sampleResume } from "@/lib/sampleData";
import { resumeSchema } from "@/lib/schema";
import { templateInfo, TEMPLATES, type TemplateId } from "@/lib/templates";
import { normalizeStyle } from "@/lib/theme";
import { AppFooter } from "../AppFooter";
import { AppHeader } from "../AppHeader";
import { ResumeThumbnail } from "../ResumeThumbnail";
import { CardMenu } from "./CardMenu";
import { describeEdited } from "./formatEdited";
import { RenameDialog } from "./RenameDialog";

type Message = { kind: "success" | "error"; text: string };
type SortKey = "edited" | "name" | "created";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "edited", label: "Last edited" },
  { value: "name", label: "Name (A-Z)" },
  { value: "created", label: "Date created" },
];

const STORAGE_ERROR = "Couldn't save: your browser's storage is full or blocked. Use Export backup to keep a copy.";

const outlineButton =
  "btn-light inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-semibold";
const darkButton =
  "btn-dark inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-semibold disabled:opacity-50";

/** Home page: saved resumes, templates and backup. */
export default function ResumeHome() {
  const router = useRouter();
  const library = useLibrary();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("edited");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Next.js keeps this page alive (hidden) while you're in the editor.
  // Reset transient things when it's hidden, so coming back is clean.
  useLayoutEffect(() => {
    return () => {
      setRenamingId(null);
      setMessage(null);
    };
  }, []);

  const goToEditor = (id: string) => router.push(editorUrl(id));

  /* ---------- Actions ---------- */

  const openNew = ({ id, saved }: { id: string; saved: boolean }) => {
    if (!saved) setMessage({ kind: "error", text: STORAGE_ERROR });
    goToEditor(id);
  };
  const createBlank = (template: TemplateId = "coral") => openNew(createResumeFromTemplate(template));

  const handleCopy = (id: string) => {
    let copyId = "";
    const { saved } = commitLibrary((lib) => {
      const result = duplicateResume(lib, id);
      copyId = result.copy?.id ?? "";
      return result.library;
    });
    if (!saved) setMessage({ kind: "error", text: STORAGE_ERROR });
    if (copyId) goToEditor(copyId);
  };

  const handleDelete = (resume: SavedResume) => {
    if (!window.confirm(`Delete "${displayName(resume)}"? This can't be undone.`)) return;
    commitLibrary((lib) => deleteResume(lib, resume.id));
    setMessage({ kind: "success", text: `Deleted "${displayName(resume)}".` });
  };

  const handleDownload = async (resume: SavedResume) => {
    // Same rules as the editor's Download button.
    const check = resumeSchema.safeParse(resume.data);
    if (!check.success) {
      const count = check.error.issues.length;
      setMessage({
        kind: "error",
        text: `"${displayName(resume)}" has ${count} missing or invalid field${count === 1 ? "" : "s"}. Open it with Edit to fix ${count === 1 ? "it" : "them"}, then download.`,
      });
      return;
    }
    setDownloadingId(resume.id);
    try {
      const blob = await renderResumePdf(check.data);
      const fileName = pdfFileName(check.data.personal.fullName);
      saveBlob(blob, fileName);
      setMessage({ kind: "success", text: `Downloaded ${fileName}` });
    } catch (error) {
      console.error("Download failed", error);
      setMessage({ kind: "error", text: "Sorry, the PDF couldn't be created. Please try again." });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExport = () => {
    if (!library) return;
    const backup = toBackup(library);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    saveBlob(blob, `resume-backup-${new Date().toISOString().slice(0, 10)}.json`);
    const count = backup.resumes.length;
    setMessage({ kind: "success", text: `Exported ${count} resume${count === 1 ? "" : "s"} to a backup file.` });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow importing the same file again
    if (!file) return;
    try {
      const text = await file.text();
      let added = 0;
      commitLibrary((lib) => {
        const result = importBackup(lib, text);
        added = result.added;
        return result.library;
      });
      setMessage({ kind: "success", text: `Imported ${added} resume${added === 1 ? "" : "s"} from ${file.name}.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Couldn't import that file." });
    }
  };

  /* ---------- Derived data ---------- */

  const allResumes = useMemo(() => (library ? sortedByUpdated(library) : []), [library]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = allResumes.filter((r) => {
      if (!q) return true;
      const p = r.data.personal;
      return [displayName(r), p?.fullName, p?.jobTitle].some((v) => v?.toLowerCase().includes(q));
    });
    if (sort === "name") return [...matches].sort((a, b) => displayName(a).localeCompare(displayName(b)));
    if (sort === "created") return [...matches].sort((a, b) => b.createdAt - a.createdAt);
    return matches; // already newest-edited first
  }, [allResumes, query, sort]);

  const latest = allResumes[0];
  const renaming = library && renamingId ? findResume(library, renamingId) : undefined;

  return (
    <div className="app-bg min-h-screen text-slate-900">
      <AppHeader active="resumes" />

      <main className="mx-auto max-w-[57rem] px-4 pb-16 pt-10 sm:px-6">
        {/* ---------- Title row ---------- */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="mr-auto">
            <h1 className="text-gradient text-3xl font-bold tracking-tight">My resumes</h1>
            <p className="mt-1 text-sm text-slate-500" data-testid="resume-count">
              {library === null
                ? "Loading…"
                : allResumes.length === 0
                  ? "No resumes yet"
                  : `${allResumes.length} resume${allResumes.length === 1 ? "" : "s"}, last edited ${describeEdited(latest.updatedAt, " at ")}`}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative w-full sm:w-52">
              <span className="sr-only">Search resumes</span>
              <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search resumes"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white/90 pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="flex flex-1 items-center gap-2 text-xs text-slate-500 sm:flex-none">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:flex-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => createBlank()}
              className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
            >
              <span aria-hidden className="text-base leading-none">+</span> Create resume
            </button>
          </div>
        </div>

        {message && (
          <div
            role={message.kind === "error" ? "alert" : "status"}
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              message.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ---------- Resume cards ---------- */}
        <ul aria-label="Saved resumes" className="mt-7 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <li>
            <button
              type="button"
              onClick={() => createBlank()}
              className="group flex h-full min-h-[340px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white/40 p-6 text-center backdrop-blur-sm transition hover:border-indigo-400 hover:bg-white/80"
            >
              <span className="gloss-tile flex h-11 w-11 items-center justify-center rounded-full text-2xl transition group-hover:scale-105">
                +
              </span>
              <span className="mt-4 text-base font-bold">New blank resume</span>
              <span className="mt-2 text-sm text-slate-500">Fill in your details and download a PDF in minutes</span>
            </button>
          </li>

          {visible.map((resume) => (
            <li key={resume.id}>
              <ResumeCard
                resume={resume}
                downloading={downloadingId === resume.id}
                onEdit={() => goToEditor(resume.id)}
                onDownload={() => void handleDownload(resume)}
                onRename={() => setRenamingId(resume.id)}
                onCopy={() => handleCopy(resume.id)}
                onDelete={() => handleDelete(resume)}
              />
            </li>
          ))}
        </ul>

        {library !== null && allResumes.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            New here?{" "}
            <button
              type="button"
              onClick={() => openNew(saveNewResume(createResume(structuredClone(sampleResume))))}
              className="font-semibold text-indigo-700 underline-offset-2 hover:underline"
            >
              Start from the sample resume
            </button>{" "}
            to see how it works.
          </p>
        )}
        {allResumes.length > 0 && visible.length === 0 && (
          <p className="mt-4 text-sm text-slate-500" role="status">
            No resumes match “{query.trim()}”.
          </p>
        )}

        {/* ---------- Templates ---------- */}
        <section id="templates" aria-labelledby="templates-title" className="mt-14 scroll-mt-6">
          <h2 id="templates-title" className="text-2xl font-bold tracking-tight">
            Start from a template
          </h2>
          <p className="mt-1 text-sm text-slate-500">Every template produces a text-based PDF that job portals can read.</p>
          <ul className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => createBlank(t.id)}
                  aria-label={`Preview of ${t.name}: use this template`}
                  className="glass glass-hover block aspect-[162/178] w-full overflow-hidden rounded-2xl pt-4"
                >
                  <ResumeThumbnail name="Your Name" title="Job title" accent={t.accent} layout={t.layout} accentHeadings />
                </button>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.description}</p>
                  </div>
                  <button type="button" onClick={() => createBlank(t.id)} aria-label={`Use ${t.name} template`} className={outlineButton}>
                    Use
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Backup ---------- */}
        <section
          id="backup"
          aria-labelledby="backup-title"
          className="glass mt-14 flex scroll-mt-6 flex-wrap items-center gap-4 rounded-2xl p-4 sm:p-5"
        >
          <span className="gloss-tile gloss-tile-warm flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </span>
          <div className="mr-auto min-w-0 flex-1 basis-64">
            <h2 id="backup-title" className="text-sm font-bold">
              Your resumes are saved in this browser only
            </h2>
            <p className="text-sm text-slate-500">
              Clearing browsing data deletes them. Export a backup file to keep a copy or move to another computer.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className={outlineButton}>
              Import backup
            </button>
            <button type="button" onClick={handleExport} disabled={library !== null && allResumes.length === 0} className={darkButton}>
              Export backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
              aria-label="Choose a backup file to import"
              data-testid="import-input"
            />
          </div>
        </section>
      </main>

      <AppFooter />

      <RenameDialog
        key={renamingId ?? "closed"}
        open={!!renaming}
        currentName={renaming ? displayName(renaming) : ""}
        onClose={() => setRenamingId(null)}
        onSave={(name) => {
          if (renamingId) commitLibrary((lib) => renameResume(lib, renamingId, name));
          setRenamingId(null);
        }}
      />
    </div>
  );
}

/** One saved resume: preview, name, template + edit time, Edit / Download / ⋯. */
function ResumeCard({
  resume,
  downloading,
  onEdit,
  onDownload,
  onRename,
  onCopy,
  onDelete,
}: {
  resume: SavedResume;
  downloading: boolean;
  onEdit: () => void;
  onDownload: () => void;
  onRename: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const name = displayName(resume);
  const style = normalizeStyle(resume.data.style);
  const template = templateInfo(style.template);
  const personal = resume.data.personal;
  return (
    <article
      data-testid="resume-card"
      aria-label={name}
      className="glass glass-hover relative z-0 flex h-full flex-col rounded-2xl has-[[role=menu]]:z-20"
    >
      <button
        type="button"
        onClick={onEdit}
        tabIndex={-1}
        aria-hidden
        className="block h-[225px] overflow-hidden rounded-t-2xl bg-gradient-to-b from-indigo-50 via-slate-100 to-violet-50 pt-5"
      >
        <ResumeThumbnail
          name={personal?.fullName?.trim() || "Your Name"}
          title={personal?.jobTitle?.trim() || "Job title"}
          accent={style.accentColor}
          layout={template.layout}
        />
      </button>
      {/* Delete: a separate button on top of the preview (buttons can't be nested). */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        title="Delete resume"
        className="btn-light absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-500"
      >
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
      </button>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-bold leading-snug">{name}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {template.name} template, edited {describeEdited(resume.updatedAt, ", ")}
        </p>
        <div className="mt-auto flex gap-2 pt-4">
          <button type="button" onClick={onEdit} aria-label={`Edit ${name}`} className={`${darkButton} flex-1`}>
            Edit
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            aria-label={`Download ${name} as PDF`}
            title="Download PDF"
            className="btn-light flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 disabled:opacity-50"
          >
            {downloading ? (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            ) : (
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
              </svg>
            )}
          </button>
          <CardMenu
            label={`More actions for ${name}`}
            items={[
              { label: "Rename", onSelect: onRename },
              { label: "Create a copy", onSelect: onCopy },
              { label: "Delete", onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      </div>
    </article>
  );
}
