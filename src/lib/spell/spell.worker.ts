/*
 * Background worker: loads the dictionaries (from this site) once, then
 * checks batches of words, so typing in the form never waits for it.
 */
import { createChecker, type Checker } from "./checker";

type Request = { id: number; dictionaryUrls: { aff: string; dic: string }[]; words: string[] };

let checker: Promise<Checker> | null = null;

async function load(urls: Request["dictionaryUrls"]): Promise<Checker> {
  const fetchText = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}`);
    return response.text();
  };
  const dictionaries = await Promise.all(urls.map(async (u) => ({ aff: await fetchText(u.aff), dic: await fetchText(u.dic) })));
  return createChecker(dictionaries);
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, dictionaryUrls, words } = event.data;
  try {
    checker ??= load(dictionaryUrls);
    const c = await checker;
    postMessage({ id, results: words.map((w) => [w, c.check(w)]) });
  } catch (error) {
    checker = null; // try again next time
    postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
