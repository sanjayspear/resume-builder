"use client";

import { useEffect, useMemo, useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { renderResumePdf } from "@/lib/pdf";
import { pdfToImages } from "@/lib/pdfToImages";
import type { ResumeData } from "@/lib/schema";
import { DesignControls } from "./DesignControls";

type Rendered = {
  json: string; // which form snapshot these pages were made from
  pages: string[]; // object URLs of page images
  pdfUrl: string | null;
  error: string | null;
};

/** How long to wait after the last keystroke before re-drawing the preview. */
const TYPING_DELAY_MS = 600;

/**
 * Watches the whole form and re-draws the PDF preview: right away for Design
 * changes (one click = one change), or once typing pauses for everything else.
 * (Saving is handled by the editor, see editor/ResumeEditor.tsx.)
 */
export function LivePanel({ control }: { control: Control<ResumeData> }) {
  const values = useWatch({ control });
  // A JSON string is an easy way to detect "something changed" and to take a
  // snapshot that later edits can't modify.
  const json = JSON.stringify(values);

  const [previewJson, setPreviewJson] = useState(json);
  const styleJson = JSON.stringify(values.style ?? null);
  const previewStyleJson = useMemo(
    () => JSON.stringify((JSON.parse(previewJson) as Partial<ResumeData>).style ?? null),
    [previewJson],
  );
  const delay = styleJson !== previewStyleJson ? 0 : TYPING_DELAY_MS;
  useEffect(() => {
    const timer = setTimeout(() => setPreviewJson(json), delay);
    return () => clearTimeout(timer);
  }, [json, delay]);
  const [rendered, setRendered] = useState<Rendered>({ json: "", pages: [], pdfUrl: null, error: null });

  useEffect(() => {
    let cancelled = false; // ignore results from an older, slower render
    (async () => {
      try {
        const blob = await renderResumePdf(JSON.parse(previewJson) as ResumeData);
        const pages = await pdfToImages(blob);
        if (cancelled) {
          pages.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        setRendered({ json: previewJson, pages, pdfUrl: URL.createObjectURL(blob), error: null });
      } catch (error) {
        if (cancelled) return;
        console.error("Preview failed", error);
        setRendered((prev) => ({
          ...prev,
          json: previewJson,
          error: "The preview couldn't be generated. Check the form for unusual characters and try again.",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewJson]);

  // Free the previous images' memory once new ones are on screen.
  useEffect(() => {
    return () => {
      rendered.pages.forEach((url) => URL.revokeObjectURL(url));
      if (rendered.pdfUrl) URL.revokeObjectURL(rendered.pdfUrl);
    };
  }, [rendered.pages, rendered.pdfUrl]);

  const updating = rendered.json !== json;
  const pageCount = rendered.pages.length;

  return (
    <aside
      aria-label="Design and PDF preview"
      className="min-w-0 lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.5rem)] lg:overflow-y-auto"
    >
      <DesignControls />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-slate-900">Live preview</h2>
        <span
          data-testid="preview-status"
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            updating ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {updating ? "Updating…" : `Up to date · ${pageCount} page${pageCount === 1 ? "" : "s"}`}
        </span>
        {rendered.pdfUrl && (
          <a
            href={rendered.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-sm font-medium text-indigo-700 hover:underline"
          >
            Open full size ↗
          </a>
        )}
      </div>

      {rendered.error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {rendered.error}
        </p>
      )}

      {pageCount === 0 && !rendered.error ? (
        <div className="flex aspect-[210/297] items-center justify-center rounded-lg bg-white text-sm text-slate-400 shadow">
          Generating preview…
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${updating ? "opacity-70" : ""}`}>
          {rendered.pages.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URLs, not optimisable
            <img
              key={src}
              src={src}
              alt={`Resume preview, page ${index + 1} of ${pageCount}`}
              className="w-full rounded-sm bg-white shadow-md ring-1 ring-slate-200"
            />
          ))}
        </div>
      )}
    </aside>
  );
}
