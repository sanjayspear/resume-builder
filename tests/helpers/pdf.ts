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
import {
  imageCountIn,
  toUnicodeProblemsIn,
  multiLetterGlyphsIn,
  pdfStreams,
  readPdfText,
  type ExtractedPdf,
} from "@/lib/pdfText";

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

export type { ExtractedPdf, TextItem } from "@/lib/pdfText";
export { squash } from "@/lib/pdfText";

/** Text of a PDF, read in file order with pdf.js (same code as the in-app ATS check). */
export async function extractPdf(pdf: Buffer | Uint8Array): Promise<ExtractedPdf> {
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: false });
  try {
    return await readPdfText(await task.promise);
  } finally {
    await task.destroy();
  }
}

/** Ligature glyphs in the PDF's glyph-to-letter maps (see multiLetterGlyphsIn). */
export async function multiLetterGlyphs(pdf: Buffer | Uint8Array) {
  return multiLetterGlyphsIn(await pdfStreams(new Uint8Array(pdf)));
}

/** Number of embedded images (logos, photos) in the PDF. */
export function imageCount(pdf: Buffer | Uint8Array): number {
  return imageCountIn(new Uint8Array(pdf));
}

/** Everything the readability check needs from a PDF: the same reading the in-browser ATS check makes. */
export async function pdfReading(pdf: Buffer | Uint8Array) {
  const bytes = new Uint8Array(pdf);
  const streams = await pdfStreams(bytes);
  return {
    extracted: await extractPdf(bytes),
    mapProblems: toUnicodeProblemsIn(streams),
    ligatures: multiLetterGlyphsIn(streams).entries,
    images: imageCountIn(bytes),
  };
}
