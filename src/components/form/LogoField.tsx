"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { LOGO_ACCEPT, LOGO_MAX_PX, LogoError, logoFromFile, logoFromUrl } from "@/lib/logo";
import type { ResumeData } from "@/lib/schema";
import { ErrorText, toId } from "../ui";

/**
 * Optional company logo: upload a PNG/JPG/SVG or paste an image URL.
 * The image is shrunk to fit 100 x 100 px and stored as base64 PNG.
 */
export function LogoField({ index }: { index: number }) {
  const { control } = useFormContext<ResumeData>();
  const name = `experience.${index}.logo` as const;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <LogoInput
          id={toId(name)}
          value={field.value ?? ""}
          onChange={(v) => {
            field.onChange(v);
            field.onBlur(); // validate straight away
          }}
          formError={fieldState.error?.message}
        />
      )}
    />
  );
}

function LogoInput({
  id,
  value,
  onChange,
  formError,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  formError?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = async (make: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await make());
      setUrl("");
    } catch (e) {
      setError(e instanceof LogoError ? e.message : "Something went wrong reading that image. Please try another one.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (file) void process(() => logoFromFile(file));
  };

  const handleUrl = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      setError("Paste the image address first.");
      return;
    }
    void process(() => logoFromUrl(url));
  };

  const message = error ?? formError;

  return (
    <div>
      <span id={`${id}-label`} className="mb-1 block text-xs font-semibold text-slate-700">
        Company logo <span className="font-normal text-slate-500">(optional)</span>
      </span>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white"
          aria-live="polite"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- local base64 image
            <img src={value} alt="Company logo preview" className="max-h-12 max-w-12 object-contain" data-testid="logo-preview" />
          ) : (
            <span className="text-center text-[10px] leading-tight text-slate-400">No logo</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? "Processing…" : value ? "Replace image" : "Upload image"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChange("");
                }}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Remove logo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_ACCEPT}
              onChange={handleFile}
              className="hidden"
              aria-label="Upload company logo"
              data-testid={`${id}-file`}
            />
          </div>
          {/* A group, not a <form>: pressing Enter here must not submit anything else. */}
          <div role="group" aria-label="Logo from web address" className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrl(e);
              }}
              placeholder="or paste an image URL"
              aria-label="Logo image URL"
              className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              onClick={handleUrl}
              disabled={busy}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Use URL
            </button>
          </div>
          {!message && (
            <p className="text-xs text-slate-500">
              PNG, JPG or SVG. Resized to fit {LOGO_MAX_PX}×{LOGO_MAX_PX} px. Shown in Classic Sidebar only (Design → Logo size).
            </p>
          )}
          <ErrorText id={`${id}-error`} message={message} />
        </div>
      </div>
    </div>
  );
}
