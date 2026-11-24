"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Small menu that opens when you click an underlined word in the rich-text
 * editor: replace it with a suggestion, or ignore it. Esc or clicking
 * elsewhere closes it.
 */
export function SpellSuggestions({
  word,
  suggestions,
  onPick,
  onIgnore,
  onClose,
  style,
}: {
  word: string;
  suggestions: string[];
  onPick: (suggestion: string) => void;
  onIgnore: () => void;
  onClose: () => void;
  style: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Spelling suggestions for ${word}`}
      data-testid="spell-menu"
      style={style}
      className="absolute z-30 min-w-40 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl"
    >
      {suggestions.length > 0 ? (
        suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="block w-full rounded px-2.5 py-1.5 text-left font-semibold text-slate-900 hover:bg-indigo-50"
          >
            {s}
          </button>
        ))
      ) : (
        <p className="px-2.5 py-1.5 text-xs text-slate-500">No suggestions</p>
      )}
      <hr className="my-1 border-slate-100" />
      <button
        type="button"
        onClick={onIgnore}
        className="block w-full rounded px-2.5 py-1.5 text-left text-slate-600 hover:bg-slate-100"
      >
        Ignore “{word}”
      </button>
    </div>
  );
}

/**
 * For single-line fields (which can't show a menu on a word): a short line
 * under the field, e.g.  Spelling: “Senoir” → Senior · Ignore
 */
export function SpellHint({
  words,
  onPick,
  onIgnore,
}: {
  words: { word: string; suggestions: string[] }[];
  onPick: (word: string, suggestion: string) => void;
  onIgnore: (word: string) => void;
}) {
  return (
    <div data-testid="spell-hint" className="mt-1 space-y-0.5 text-xs text-slate-600">
      {words.map(({ word, suggestions }) => (
        <p key={word} className="flex flex-wrap items-center gap-1">
          <span>
            Spelling: <span className="spell-error">{word}</span>
          </span>
          {suggestions.length > 0 && <span aria-hidden>→</span>}
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(word, s)}
              aria-label={`Replace ${word} with ${s}`}
              className="rounded bg-indigo-50 px-1.5 py-px font-semibold text-indigo-800 hover:bg-indigo-100"
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onIgnore(word)}
            aria-label={`Ignore word ${word}`}
            className="rounded px-1.5 py-px text-slate-500 hover:bg-slate-100"
          >
            Ignore
          </button>
        </p>
      ))}
    </div>
  );
}
