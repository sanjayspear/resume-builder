/*
 * Byte-level PDF checks with no rendering code, so the browser tests (e2e/)
 * can use them on downloaded files too.
 */
import { inflateSync } from "node:zlib";

/** Every compressed stream in the PDF, decompressed (page drawings, fonts, maps...). */
export function streams(pdf: Buffer): string[] {
  const raw = pdf.toString("latin1");
  const out: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    try {
      out.push(inflateSync(pdf.subarray(start, end)).toString("latin1"));
    } catch {
      // not a compressed stream (e.g. raw image data)
    }
  }
  return out;
}

/**
 * Strict check of every ToUnicode map (glyph -> letters) in the PDF: each
 * entry must be one or more complete 4-digit hex codes. An empty entry "<>"
 * or a broken one makes many extractors (and ATS) read every later glyph
 * as the wrong letter, even when pdf.js copes. Returns the problems found.
 */
export function toUnicodeProblems(pdf: Buffer): string[] {
  const problems: string[] = [];
  let maps = 0;
  for (const body of streams(pdf)) {
    if (!body.includes("beginbfrange") && !body.includes("beginbfchar")) continue;
    maps++;
    const mappings = body.slice(body.indexOf("endcodespacerange") + "endcodespacerange".length);
    for (const [, hex] of mappings.matchAll(/<([^>]*)>/g)) {
      const digits = hex.replace(/\s+/g, "");
      if (digits === "" || !/^([0-9a-fA-F]{4})+$/.test(digits)) problems.push(`map ${maps}: bad entry <${hex}>`);
    }
  }
  if (maps === 0) problems.push("no ToUnicode maps found");
  return problems;
}
