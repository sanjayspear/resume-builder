"use client";

import { imageCountIn, multiLetterGlyphsIn, pdfStreams, readPdfText, toUnicodeProblemsIn } from "../pdfText";
import type { ResumeData } from "../schema";
import type { PdfReading } from "./readability";

/**
 * Builds the real PDF (exactly what Download saves: no preview hints) and
 * reads it back in the browser. Nothing is uploaded: the PDF is made and
 * read on this device; pdf.js reads it in a background worker.
 */
export async function readPdfForAts(data: ResumeData): Promise<PdfReading> {
  const [{ renderResumePdf }, { withPdfDocument }] = await Promise.all([import("../pdf"), import("../pdfToImages")]);
  const bytes = new Uint8Array(await (await renderResumePdf(data)).arrayBuffer());
  // pdf.js takes ownership of the bytes it's given, so it gets a copy.
  const [extracted, streams] = await Promise.all([withPdfDocument(bytes.slice(), readPdfText), pdfStreams(bytes)]);
  return {
    extracted,
    mapProblems: toUnicodeProblemsIn(streams),
    ligatures: multiLetterGlyphsIn(streams).entries,
    images: imageCountIn(bytes),
  };
}
