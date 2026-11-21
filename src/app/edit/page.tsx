import type { Metadata } from "next";
import { Suspense } from "react";
import EditorRoute from "@/components/editor/EditorRoute";

export const metadata: Metadata = {
  title: "Edit resume · Resume Builder",
};

export default function EditPage() {
  // The editor reads ?id= from the URL, so it must sit inside <Suspense>.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
          Loading resume…
        </div>
      }
    >
      <EditorRoute />
    </Suspense>
  );
}
