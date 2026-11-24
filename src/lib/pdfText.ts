/*
 * Reads a PDF back the way a resume scanner (ATS) does: as text, in the order
 * it is stored in the file, plus byte-level checks of the text layer.
 *
 * Used by the in-browser "ATS check" AND by the automated tests, so the
 * check users see is exactly the code the tests prove. Works in browsers and
 * in Node 18+ (DecompressionStream exists in both). Nothing leaves the device.
 */

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

/** The small part of pdf.js's document object we need (browser and Node builds both match). */
type PdfDocumentLike = {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{
      items: Array<{ str?: string; transform?: number[]; width?: number; fontName?: string } | object>;
    }>;
  }>;
};

export async function readPdfText(doc: PdfDocumentLike): Promise<ExtractedPdf> {
  const items: TextItem[] = [];
  const pages: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const pageItems: TextItem[] = [];
    for (const raw of content.items) {
      const item = raw as { str?: string; transform?: number[]; width?: number; fontName?: string };
      if (typeof item.str !== "string" || item.str.trim() === "" || !item.transform) continue;
      const entry = {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width ?? 0,
        page: p,
        font: item.fontName ?? "",
      };
      pageItems.push(entry);
      items.push(entry);
    }
    pages.push(toLines(pageItems));
  }
  return {
    pageCount: doc.numPages,
    items,
    streamText: joinInFileOrder(items),
    pageStreams: pages.map((_, i) => joinInFileOrder(items.filter((item) => item.page === i + 1))),
    pages,
  };
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
    const touching =
      prev && prev.page === item.page && Math.abs(prev.y - item.y) < 2 && Math.abs(item.x - (prev.x + prev.width)) <= 1;
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

/* ---------- Byte-level checks ---------- */

const latin1 = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null; // not a compressed stream (e.g. raw image data)
  }
}

/** Every compressed stream in the PDF, decompressed (page drawings, fonts, glyph-to-letter maps…). */
export async function pdfStreams(pdf: Uint8Array): Promise<string[]> {
  const raw = latin1(pdf);
  const out: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    let end = raw.indexOf("endstream", start);
    while (end > start && (raw[end - 1] === "\n" || raw[end - 1] === "\r")) end--; // line break before "endstream"
    const body = await inflate(pdf.subarray(start, end));
    if (body) out.push(latin1(body));
  }
  return out;
}

/**
 * Strict check of every ToUnicode map (glyph -> letters): each entry must be
 * one or more complete 4-digit hex codes. An empty entry "<>" or a broken one
 * makes many extractors (and ATS) read every later glyph as the wrong
 * letter, even when pdf.js copes. Returns the problems found.
 */
export function toUnicodeProblemsIn(streams: string[]): string[] {
  const problems: string[] = [];
  let maps = 0;
  for (const body of streams) {
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

/**
 * Glyphs that stand for several letters (ligatures like "ft"). pdf.js copes,
 * but many ATS parsers keep only the first letter ("Software" -> "Sofware").
 */
export function multiLetterGlyphsIn(streams: string[]): { cmaps: number; entries: string[] } {
  const entries = new Set<string>();
  let cmaps = 0;
  for (const body of streams) {
    if (!body.includes("begincmap")) continue;
    cmaps++;
    const mappings = body.slice(body.indexOf("endcodespacerange"));
    for (const [, hex] of mappings.matchAll(/<([0-9a-fA-F\s]+)>/g)) {
      const units = hex.replace(/\s+/g, "").match(/.{4}/g) ?? [];
      if (units.length > 1) entries.add(String.fromCharCode(...units.map((u) => parseInt(u, 16))));
    }
  }
  return { cmaps, entries: [...entries] };
}

/** Number of embedded images (logos, photos) in the PDF. */
export function imageCountIn(pdf: Uint8Array): number {
  return (latin1(pdf).match(/\/Subtype\s*\/Image/g) ?? []).length;
}
