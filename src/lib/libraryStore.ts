"use client";

import { useEffect, useSyncExternalStore } from "react";
import { LEGACY_KEY, LIBRARY_KEY, loadLibrary, readStorage, saveLibrary, type Library } from "./library";

/*
 * One shared, always-up-to-date view of the saved resumes for every screen.
 *
 * Screens call useLibrary() to read and commitLibrary() to change it.
 * React's useSyncExternalStore re-reads storage whenever a screen becomes
 * visible again, and when another browser tab saves (the "storage" event),
 * so the home page list is never stale.
 */

const listeners = new Set<() => void>();
let cachedKey: string | null = null;
let cached: Library | null = null;

/** What's in storage right now, as one string (cheap change detection). */
function storageKey(): string {
  return `${readStorage(LIBRARY_KEY) ?? ""}\u0000${readStorage(LEGACY_KEY) ?? ""}`;
}

function getSnapshot(): Library {
  const key = storageKey();
  if (cached && key === cachedKey) return cached; // unchanged: same object
  cached = loadLibrary();
  cachedKey = key;
  return cached;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === LIBRARY_KEY || event.key === LEGACY_KEY) notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * Applies a change to the latest saved library and stores it.
 * `saved` is false if the browser refused to store it (full/blocked);
 * the change is still kept in memory for this tab.
 */
export function commitLibrary(change: (library: Library) => Library): { library: Library; saved: boolean } {
  const latest = getSnapshot();
  const next = change(latest);
  if (next === latest) return { library: latest, saved: true };
  const saved = saveLibrary(next);
  // Saved: forget our copy so the next read parses fresh objects from storage
  // (never shares objects with the caller). Not saved: keep it in memory.
  cached = saved ? null : next;
  cachedKey = saved ? null : storageKey();
  notify();
  return { library: next, saved };
}

/**
 * The saved resumes, or null while the page is first being prepared on the
 * server (where there is no localStorage).
 */
export function useLibrary(): Library | null {
  const library = useSyncExternalStore(subscribe, getSnapshot, () => null);

  // First visit after the old single-resume version: store the migrated
  // list now, so the migrated resume keeps the same id from here on.
  useEffect(() => {
    if (readStorage(LIBRARY_KEY) === null && readStorage(LEGACY_KEY) !== null) {
      commitLibrary((lib) => ({ ...lib }));
    }
  }, []);

  return library;
}
