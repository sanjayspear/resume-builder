"use client";

import { publicUrl } from "../basePath";
import type { SpellResult } from "./checker";

/*
 * Talks to the spell-check worker. Results are remembered per word, so
 * after the first check only new words are sent to the worker.
 */

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: [string, SpellResult][]) => void; reject: (e: Error) => void }>();
const cache = new Map<string, SpellResult>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./spell.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<{ id: number; results?: [string, SpellResult][]; error?: string }>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.error) request.reject(new Error(event.data.error));
    else request.resolve(event.data.results ?? []);
  };
  return worker;
}

/** The dictionaries, served by this site (copied into /public by "postinstall"). */
const dictionaryUrls = () =>
  ["en-US", "en-GB"].map((name) => ({
    aff: new URL(publicUrl(`/dictionaries/${name}.aff`), location.href).href,
    dic: new URL(publicUrl(`/dictionaries/${name}.dic`), location.href).href,
  }));

/** Checks words (on this device); returns a result for each. */
export async function checkSpelling(words: string[]): Promise<Map<string, SpellResult>> {
  const todo = [...new Set(words)].filter((w) => !cache.has(w));
  if (todo.length > 0) {
    const id = nextId++;
    const results = await new Promise<[string, SpellResult][]>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, dictionaryUrls: dictionaryUrls(), words: todo });
    });
    results.forEach(([word, result]) => cache.set(word, result));
  }
  return new Map(words.map((w) => [w, cache.get(w) ?? { correct: true, suggestions: [] }]));
}
