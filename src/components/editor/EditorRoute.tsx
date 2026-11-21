"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

/*
 * Loads the editor in the browser only (ssr: false): it relies on
 * browser-only features - localStorage, canvas, PDF generation.
 */
const ResumeEditor = dynamic(() => import("./ResumeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
      Loading resume…
    </div>
  ),
});

/** Reads ?id=... from the address bar and opens that resume. */
export default function EditorRoute() {
  const id = useSearchParams().get("id");
  // key={id}: opening a different resume starts a fresh editor, even though
  // Next.js keeps the previous editor page alive in the background.
  return <ResumeEditor key={id ?? "none"} id={id} />;
}
