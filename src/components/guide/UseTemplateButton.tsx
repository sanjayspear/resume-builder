"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createResumeFromTemplate, editorUrl } from "@/lib/createResume";
import type { TemplateId } from "@/lib/templates";

/** "Use this template": creates a blank resume with the template and opens it. */
export function UseTemplateButton({ template, name }: { template: TemplateId; name: string }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const { id, saved } = createResumeFromTemplate(template);
          if (!saved) setError(true);
          router.push(editorUrl(id));
        }}
        aria-label={`Use ${name} template`}
        className="btn-light inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold"
      >
        Use this template
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          Your browser&apos;s storage is full or blocked, so this resume may not be saved.
        </p>
      )}
    </>
  );
}
