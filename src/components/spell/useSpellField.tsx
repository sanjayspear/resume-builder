"use client";

import { useState, type UIEvent } from "react";
import { useFormContext, useWatch, type FieldPath } from "react-hook-form";
import type { ResumeData } from "@/lib/schema";
import { wordsToCheck } from "@/lib/spell/targets";
import { useSpellcheck } from "./SpellcheckProvider";
import { SpellHint } from "./SpellSuggestions";

/**
 * Spelling underlines for a plain input or textarea, plus a "did you mean"
 * line under it. A form field can't style parts of its own text, so a
 * see-through copy of the text is laid exactly over it with the misspelled
 * words underlined (the copy ignores the mouse, so typing works as usual).
 *
 *   const spell = useSpellField("personal.jobTitle");
 *   <TextField {...register("personal.jobTitle")} {...spell} />
 */
export function useSpellField(name: FieldPath<ResumeData>, { multiline = false } = {}) {
  const spell = useSpellcheck();
  const { control, setValue } = useFormContext<ResumeData>();
  const value = useWatch({ control, name });
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const onScroll = (e: UIEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop });

  const text = typeof value === "string" ? value : "";
  const wrong = spell ? wordsToCheck(text, spell.known).filter((w) => spell.isMisspelled(w.word)) : [];
  if (!spell || wrong.length === 0) return { onScroll };

  // The text split into plain parts and underlined words.
  const parts: { text: string; wrong: boolean }[] = [];
  let at = 0;
  for (const w of wrong) {
    parts.push({ text: text.slice(at, w.start), wrong: false }, { text: text.slice(w.start, w.end), wrong: true });
    at = w.end;
  }
  parts.push({ text: text.slice(at), wrong: false });

  const replace = (word: string, suggestion: string) => {
    const hit = wrong.find((w) => w.word === word);
    if (!hit) return;
    setValue(name, `${text.slice(0, hit.start)}${suggestion}${text.slice(hit.end)}`, { shouldDirty: true, shouldValidate: true });
  };

  const decoration = (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-3 py-2 text-sm text-transparent ${
        multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"
      }`}
    >
      <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
        {parts.map((p, i) => (p.wrong ? <span key={i} className="spell-error">{p.text}</span> : p.text))}
      </div>
    </div>
  );
  const unique = [...new Map(wrong.map((w) => [w.word.toLowerCase(), w.word])).values()].slice(0, 3);
  const footer = (
    <SpellHint
      words={unique.map((word) => ({ word, suggestions: spell.suggestions(word) }))}
      onPick={replace}
      onIgnore={spell.ignore}
    />
  );
  return { onScroll, decoration, footer };
}
