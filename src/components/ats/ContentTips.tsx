"use client";

import { TIP_CATEGORIES, type Tip } from "@/lib/ats/tips";

/**
 * The "Content tips" tab: suggestions to make the resume stronger for
 * recruiters, grouped by kind. Each tip can be dismissed; dismissed tips are
 * remembered with the resume.
 */
export function ContentTips({
  tips,
  spellingStatus,
  dismissed,
  onDismiss,
  onRestore,
  onJump,
}: {
  tips: Tip[];
  /** "loading" while the dictionary loads, "ready", or an error message. */
  spellingStatus: string;
  /** Ids of dismissed tips. */
  dismissed: string[];
  onDismiss: (id: string) => void;
  onRestore: () => void;
  onJump: (field: string) => void;
}) {
  const hidden = new Set(dismissed);
  const visible = tips.filter((t) => !hidden.has(t.id));
  const dismissedHere = tips.length - visible.length;

  return (
    <div className="space-y-5">
      {visible.length === 0 ? (
        <p data-testid="tips-empty" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          No tips right now: your bullets have numbers, strong openings and a good length.
        </p>
      ) : (
        TIP_CATEGORIES.map((category) => {
          const inCategory = visible.filter((t) => t.category === category.id);
          if (inCategory.length === 0) return null;
          return (
            <section key={category.id} aria-label={category.label}>
              <h3 className="text-sm font-bold">
                {category.label} <span className="font-normal text-slate-500">({inCategory.length})</span>
              </h3>
              <ul className="mt-1.5 space-y-2">
                {inCategory.map((tip) => (
                  <li key={tip.id} data-testid="tip" data-category={tip.category} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-semibold">{tip.title}</p>
                    <p className="break-words text-sm text-slate-700">{tip.message}</p>
                    <p className="mt-1 text-xs text-slate-500">Why it matters: {tip.why}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onJump(tip.field)}
                        className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Go to field
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismiss(tip.id)}
                        aria-label={tip.category === "spelling" ? `Ignore word ${tip.title}` : `Dismiss tip: ${tip.title}`}
                        title={tip.category === "spelling" ? "It's spelled right (a name or a term): don't flag it in this resume" : undefined}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      >
                        {tip.category === "spelling" ? "Ignore word" : "Dismiss"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      {dismissedHere > 0 && (
        <button type="button" onClick={onRestore} className="text-xs font-semibold text-indigo-700 hover:underline">
          Show {dismissedHere} dismissed tip{dismissedHere === 1 ? "" : "s"} again
        </button>
      )}
      <p data-testid="spelling-status" className="text-xs text-slate-500">
        {spellingStatus === "loading"
          ? "Checking spelling…"
          : spellingStatus === "ready"
            ? "Spelling is checked on this device with English dictionaries (US and UK spellings both count). Names, tools and skills aren't checked."
            : `${spellingStatus} Your browser still underlines misspelled words in the form fields.`}
      </p>
    </div>
  );
}
