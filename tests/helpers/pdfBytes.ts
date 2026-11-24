/*
 * Byte-level PDF checks with no rendering code, so the browser tests (e2e/)
 * can use them on downloaded files too. The checks themselves live in
 * src/lib/pdfText.ts (shared with the in-app ATS check).
 */
import { pdfStreams, toUnicodeProblemsIn } from "@/lib/pdfText";

/** Problems in the PDF's glyph-to-letter maps; [] means every entry is valid. */
export async function toUnicodeProblems(pdf: Buffer | Uint8Array): Promise<string[]> {
  return toUnicodeProblemsIn(await pdfStreams(new Uint8Array(pdf)));
}
