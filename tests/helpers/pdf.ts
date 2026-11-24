/*
 * Test helpers: render a resume to a PDF and read it back the way a resume
 * scanner (ATS) would: as text, in the order it is stored in the file.
 */
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import type { ResumeData } from "@/lib/schema";
import { registerFonts, repairGlyphCache } from "@/pdf/fonts";
import { ResumeDocument } from "@/pdf/ResumeDocument";
import { streams } from "./pdfBytes";

export { toUnicodeProblems } from "./pdfBytes";

registerFonts(path.resolve(process.cwd(), "public"));

/** `placeholders: true` renders like the on-screen preview (grey hints for empty fields). */
export async function renderPdf(data: ResumeData, { placeholders = false } = {}): Promise<Buffer> {
  repairGlyphCache(); // exactly like the app does before every render
  // Leave the option out unless asked for, exactly like a download does, so
  // the tests also check that the default is "no placeholders".
  const props = placeholders ? { data, placeholders: true } : { data };
  const doc = createElement(ResumeDocument, props) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(doc);
}

/** One piece of text as pdf.js reports it, with its position (PDF points, y grows upwards). */
/** `font`: pdf.js's id for the font used (same id = same font, e.g. Inter Bold). */
export type TextItem = { str: string; x: number; y: number; width: number; page: number; font: string };

export type ExtractedPdf = {
  pageCount: number;
  /** Every text piece in file order: the order an ATS reads them. */
  items: TextItem[];
  /** All text in file order, joined like real extractors do (for "comes before" checks). */
  streamText: string;
  /** streamText, one string per page. */
  pageStreams: string[];
  /** Visual lines per page: pieces on the same baseline, left to right. */
  pages: string[][];
};

export async function extractPdf(pdf: Buffer): Promise<ExtractedPdf> {
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: false });
  try {
    const doc = await task.promise;
    const items: TextItem[] = [];
    const pages: string[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      const pageItems: TextItem[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const entry = { str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, page: p, font: item.fontName };
        pageItems.push(entry);
        items.push(entry);
      }
      pages.push(toLines(pageItems));
    }
    const join = joinInFileOrder;
    return {
      pageCount: doc.numPages,
      items,
      streamText: join(items),
      pageStreams: pages.map((_, i) => join(items.filter((item) => item.page === i + 1))),
      pages,
    };
  } finally {
    await task.destroy();
  }
}

/**
 * Joins pieces in file order like real text extractors (pdfminer, pypdf) do:
 * no space between pieces that touch on the same line (e.g. a bold "22%"
 * followed by "."), a space at a visible gap or a new line.
 */
function joinInFileOrder(items: TextItem[]): string {
  let text = "";
  items.forEach((item, i) => {
    const prev = items[i - 1];
    const touching = prev && prev.page === item.page && Math.abs(prev.y - item.y) < 2 && Math.abs(item.x - (prev.x + prev.width)) <= 1;
    text += (prev && !touching ? " " : "") + item.str;
  });
  return text;
}

/**
 * Groups pieces whose baselines are within 2 pt into one line, top to bottom.
 * Like real text extractors, a visible gap between two pieces becomes a space
 * (spaces at the edge of a text run are drawn as a gap, not as a character).
 */
function toLines(items: TextItem[]): string[] {
  const rows: { y: number; parts: TextItem[] }[] = [];
  for (const item of items) {
    const row = rows.find((r) => Math.abs(r.y - item.y) < 2);
    if (row) row.parts.push(item);
    else rows.push({ y: item.y, parts: [item] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      const parts = r.parts.sort((a, b) => a.x - b.x);
      let line = "";
      parts.forEach((part, i) => {
        const prev = parts[i - 1];
        if (prev && part.x - (prev.x + prev.width) > 1) line += " ";
        line += part.str;
      });
      return line.replace(/\s+/g, " ").trim();
    });
}

/** Collapses runs of spaces/newlines so text can be compared regardless of line breaks. */
export const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Reads every ToUnicode map in the PDF (glyph -> the letters it stands for)
 * and returns the entries where one glyph stands for several letters
 * (ligatures). pdf.js copes with those, but many ATS parsers keep only the
 * first letter ("Software" -> "Sofware"), so they must not exist at all.
 */
export function multiLetterGlyphs(pdf: Buffer): { cmaps: number; entries: string[] } {
  const entries = new Set<string>();
  let cmaps = 0;
  for (const body of streams(pdf)) {
    if (!body.includes("begincmap")) continue;
    cmaps++;
    // Destination strings look like <0066> or, for several letters, <0066 0074>.
    const mappings = body.slice(body.indexOf("endcodespacerange"));
    for (const [, hex] of mappings.matchAll(/<([0-9a-fA-F\s]+)>/g)) {
      const units = hex.replace(/\s+/g, "").match(/.{4}/g) ?? [];
      if (units.length > 1) entries.add(String.fromCharCode(...units.map((u) => parseInt(u, 16))));
    }
  }
  return { cmaps, entries: [...entries] };
}

/** Number of embedded images (logos, photos) in the PDF. */
export function imageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
}

