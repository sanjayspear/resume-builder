/*
 * Turns a PDF into one PNG image per page using Mozilla's pdf.js.
 * Used for the live preview because phone browsers can't reliably show
 * a PDF inside the page (Android Chrome shows nothing, iOS only page 1).
 */

import { publicUrl } from "./basePath";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;
// One background worker, reused for every preview. (Creating a new one per
// preview re-started the 1 MB pdf.js engine on every pause in typing.)
let sharedWorker: import("pdfjs-dist").PDFWorker | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    // The worker file is copied into /public by the "postinstall" npm script.
    pdfjs.GlobalWorkerOptions.workerSrc = publicUrl("/pdf.worker.min.mjs");
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Returns object URLs (call URL.revokeObjectURL on them when done). */
export async function pdfToImages(pdf: Blob, scale = 2): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  sharedWorker ??= new pdfjs.PDFWorker();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()), worker: sharedWorker });
  const doc = await loadingTask.promise;
  const urls: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not draw page"))), "image/png"),
      );
      urls.push(URL.createObjectURL(png));
      page.cleanup();
    }
    return urls;
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    // Frees this document only; the shared worker keeps running for the next preview.
    await loadingTask.destroy();
  }
}

/**
 * Opens a PDF with pdf.js (in the shared background worker) and runs `read`
 * on it, e.g. to read its text for the ATS check. Frees the document after.
 */
export async function withPdfDocument<T>(
  bytes: Uint8Array,
  read: (doc: import("pdfjs-dist").PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  const pdfjs = await loadPdfJs();
  sharedWorker ??= new pdfjs.PDFWorker();
  const loadingTask = pdfjs.getDocument({ data: bytes, worker: sharedWorker });
  try {
    return await read(await loadingTask.promise);
  } finally {
    await loadingTask.destroy();
  }
}
