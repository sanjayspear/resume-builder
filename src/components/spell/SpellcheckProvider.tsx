"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { findResume, updateAtsState } from "@/lib/library";
import { commitLibrary, useLibrary } from "@/lib/libraryStore";
import type { ResumeData } from "@/lib/schema";
import type { SpellResult } from "@/lib/spell/checker";
import { checkSpelling } from "@/lib/spell/client";
import { knownTerms, spellTargets } from "@/lib/spell/targets";

/** Checks run this long after typing stops (half-typed words aren't underlined). */
const CHECK_DELAY_MS = 400;

export type Spellcheck = {
  /** Words that count as correct for this resume (skills, companies, names…). */
  known: Set<string>;
  /** True when the word has been checked, is wrong, and isn't ignored. */
  isMisspelled: (word: string) => boolean;
  suggestions: (word: string) => string[];
  /** "Ignore word": stop flagging it in this resume (shared with the ATS check). */
  ignore: (word: string) => void;
};

const SpellcheckContext = createContext<Spellcheck | null>(null);

/** The editor's spell check, or null outside the editor. Changes identity when results change. */
export const useSpellcheck = () => useContext(SpellcheckContext);

/**
 * One spell check for the whole editor, so the red underlines in the form
 * and the ATS check's Spelling tips always agree. Words are checked on this
 * device, in a background worker, against US and UK dictionaries.
 */
export function SpellcheckProvider({ resumeId, children }: { resumeId: string; children: ReactNode }) {
  const { control } = useFormContext<ResumeData>();
  const json = JSON.stringify(useWatch({ control }));
  const [settled, setSettled] = useState(json);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(json), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [json]);

  const data = useMemo(() => JSON.parse(settled) as ResumeData, [settled]);
  const known = useMemo(() => knownTerms(data), [data]);
  const words = useMemo(() => [...new Set(spellTargets(data).map((t) => t.word))], [data]);

  const [results, setResults] = useState<Map<string, SpellResult>>(new Map());
  useEffect(() => {
    let cancelled = false;
    checkSpelling(words)
      .then((checked) => {
        if (!cancelled) setResults((prev) => new Map([...prev, ...checked]));
      })
      .catch((e) => console.error("Spell check failed", e)); // the form still works without it
    return () => {
      cancelled = true;
    };
  }, [words]);

  const library = useLibrary();
  const dismissed = (library && findResume(library, resumeId)?.ats.dismissedTips) || [];
  const ignoredKey = dismissed.filter((id) => id.startsWith("spell:")).join("|");
  const ignored = useMemo(() => new Set(ignoredKey ? ignoredKey.split("|").map((id) => id.slice("spell:".length)) : []), [ignoredKey]);

  const ignore = useCallback(
    (word: string) =>
      commitLibrary((lib) => {
        const current = findResume(lib, resumeId)?.ats.dismissedTips ?? [];
        return updateAtsState(lib, resumeId, { dismissedTips: [...new Set([...current, `spell:${word.toLowerCase()}`])] });
      }),
    [resumeId],
  );

  const value = useMemo<Spellcheck>(
    () => ({
      known,
      isMisspelled: (word) => !ignored.has(word.toLowerCase()) && results.get(word)?.correct === false,
      suggestions: (word) => results.get(word)?.suggestions ?? [],
      ignore,
    }),
    [known, ignored, results, ignore],
  );
  return <SpellcheckContext.Provider value={value}>{children}</SpellcheckContext.Provider>;
}
