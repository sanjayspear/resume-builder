import { BASE_PATH } from "./basePath";
import type { ResumeData } from "./schema";

/**
 * "Maya Fernandes" -> "Maya-Fernandes-Resume.pdf".
 * Anything that isn't a letter or digit becomes a single dash, so the name
 * is always a safe file name. Falls back to "Resume.pdf" when empty.
 */
export function pdfFileName(fullName: string | undefined): string {
  const safe = (fullName ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return safe ? `${safe}-Resume.pdf` : "Resume.pdf";
}

/**
 * Builds the resume PDF in the browser and returns it as a Blob (file in memory).
 * The PDF library is loaded on demand so the page itself loads quickly.
 * `placeholders` (grey hints for empty fields) is for the on-screen preview
 * only; downloads leave it off, so hint text never ends up in a real PDF.
 */
export async function renderResumePdf(data: ResumeData, { placeholders = false } = {}): Promise<Blob> {
  const [{ pdf }, { ResumeDocument }, { registerFonts, repairGlyphCache }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/pdf/ResumeDocument"),
    import("@/pdf/fonts"),
  ]);
  registerFonts(window.location.origin + BASE_PATH);
  repairGlyphCache(); // before EVERY render: see fonts.ts (keeps the text layer correct)
  return pdf(<ResumeDocument data={data} placeholders={placeholders} />).toBlob();
}

/** Asks the browser to save a Blob as a file. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
