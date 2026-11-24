"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { keywordKey, type KeywordResult } from "@/lib/ats/keywords";
import type { Check } from "@/lib/ats/types";
import type { AtsState } from "@/lib/library";

/** How long after typing stops the job description is saved. */
const SAVE_DELAY_MS = 400;

/**
 * The "Job match" tab: paste a job description, see which of its important
 * keywords your resume already has. The text stays on this device.
 */
export function JobMatch({
  ats,
  onChange,
  results,
  checks,
  renderCheck,
  onJump,
}: {
  ats: AtsState;
  onChange: (patch: Partial<AtsState>) => void;
  results: KeywordResult[];
  checks: Check[];
  renderCheck: (check: Check) => ReactNode;
  onJump: (field: string) => void;
}) {
  // Typed text is saved shortly after typing stops (not on every keystroke).
  const [description, setDescription] = useState(ats.jobDescription);
  const [title, setTitle] = useState(ats.targetTitle);
  useEffect(() => {
    if (description === ats.jobDescription && title === ats.targetTitle) return;
    const timer = setTimeout(() => onChange({ jobDescription: description, targetTitle: title }), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [description, title, ats.jobDescription, ats.targetTitle, onChange]);

  const [newKeyword, setNewKeyword] = useState("");
  const addKeyword = (event: FormEvent) => {
    event.preventDefault();
    const value = newKeyword.trim();
    if (!value) return;
    onChange({
      addedKeywords: [...ats.addedKeywords.filter((k) => k.toLowerCase() !== value.toLowerCase()), value],
      removedKeywords: ats.removedKeywords.filter((k) => k !== keywordKey(value)),
    });
    setNewKeyword("");
  };
  const removeKeyword = (k: KeywordResult) =>
    onChange({
      removedKeywords: [...new Set([...ats.removedKeywords, k.key])],
      addedKeywords: ats.addedKeywords.filter((a) => a !== k.label),
    });

  const matched = results.filter((r) => r.matched);
  const onlyInSkills = matched.filter(isOnlyInSkills).length;
  const missing = results.filter((r) => !r.matched);
  const hasDescription = ats.jobDescription.trim() !== "";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <label htmlFor="ats-target-title" className="mb-1 block text-xs font-semibold text-slate-700">
            Target job title <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="ats-target-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior QA Engineer"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="ats-job-description" className="text-xs font-semibold text-slate-700">
              Paste job description
            </label>
            <button
              type="button"
              onClick={() => {
                setDescription("");
                onChange({ jobDescription: "" });
              }}
              disabled={description === ""}
              className="rounded px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <textarea
            id="ats-job-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            placeholder="Paste the full job ad here…"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-1 text-xs text-slate-500">Saved with this resume, on this device only. It&apos;s never uploaded.</p>
        </div>
      </div>

      {!hasDescription ? (
        <p data-testid="job-match-empty" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Paste a job description to see which important keywords your resume already includes. Keywords come from the
          skills and phrases the ad mentions most; you can remove ones that don&apos;t matter and add your own.
        </p>
      ) : (
        <>
          <div>
            <p data-testid="keyword-score" className="text-sm font-bold">
              Keyword match: {matched.length} of {results.length}
            </p>
            <div
              role="progressbar"
              aria-label="Keyword match"
              aria-valuemin={0}
              aria-valuemax={results.length}
              aria-valuenow={matched.length}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${results.length ? (100 * matched.length) / results.length : 0}%` }}
              />
            </div>
          </div>

          {checks.length > 0 && <ul className="space-y-2">{checks.map(renderCheck)}</ul>}

          <KeywordList
            title={`In your resume (${matched.length})`}
            testId="matched-keywords"
            note={
              onlyInSkills > 0 ? (
                <span className="text-amber-800">
                  {onlyInSkills} {onlyInSkills === 1 ? "keyword is" : "keywords are"} only in Skills. Recruiters trust skills
                  more when they also appear in your experience.{" "}
                  <button type="button" onClick={() => onJump("experience.0.description")} className="font-semibold underline">
                    Go to field
                  </button>
                </span>
              ) : undefined
            }
          >
            {matched.map((k) => (
              <KeywordRow key={k.key} keyword={k} onRemove={() => removeKeyword(k)}>
                <span className="text-xs text-slate-500">Found in: {k.places.join(", ")}</span>
                {isOnlyInSkills(k) && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-900">
                    Only in Skills
                  </span>
                )}
              </KeywordRow>
            ))}
          </KeywordList>

          <KeywordList
            title={`Missing (${missing.length})`}
            testId="missing-keywords"
            note="Only add skills you really have."
          >
            {missing.map((k) => (
              <KeywordRow key={k.key} keyword={k} onRemove={() => removeKeyword(k)}>
                <span className="text-xs text-slate-500">
                  Not found{k.source === "added" ? " (added by you)" : k.count > 1 ? ` · mentioned ${k.count}× in the ad` : ""}
                </span>
              </KeywordRow>
            ))}
          </KeywordList>

          <form onSubmit={addKeyword} className="flex gap-2">
            <label htmlFor="ats-add-keyword" className="sr-only">
              Add a keyword
            </label>
            <input
              id="ats-add-keyword"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add a keyword, e.g. Kubernetes"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button type="submit" className="btn-light rounded-lg px-3 text-sm font-semibold">
              Add
            </button>
          </form>
          {ats.removedKeywords.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ removedKeywords: [] })}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              Restore {ats.removedKeywords.length} removed keyword{ats.removedKeywords.length === 1 ? "" : "s"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const isOnlyInSkills = (k: KeywordResult) => k.places.length === 1 && k.places[0] === "Skills";

function KeywordList({ title, note, testId, children }: { title: string; note?: ReactNode; testId: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="text-sm font-bold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <ul data-testid={testId} className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {children}
      </ul>
    </section>
  );
}

function KeywordRow({ keyword, onRemove, children }: { keyword: KeywordResult; onRemove: () => void; children: ReactNode }) {
  return (
    <li data-testid="keyword" data-keyword={keyword.label} className="flex items-start gap-2 px-3 py-2">
      <span aria-hidden className={`mt-0.5 text-sm font-bold ${keyword.matched ? "text-emerald-600" : "text-slate-400"}`}>
        {keyword.matched ? "✓" : "○"}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold">{keyword.label}</span>
        <span className="block">{children}</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove keyword ${keyword.label}`}
        title="Not relevant: remove from the list"
        className="rounded px-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>
    </li>
  );
}
