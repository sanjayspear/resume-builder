"use client";

import type { ComponentProps, ReactNode } from "react";
import type { FieldError } from "react-hook-form";

/* Small reusable building blocks for the form. */

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition " +
  "placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100";
const inputOk = "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200";
const inputBad = "border-red-500 focus:border-red-500 focus:ring-red-200";

/** Turns a field path like "experience.0.jobTitle" into a valid HTML id. */
export const toId = (name: string) => `field-${name.replace(/\./g, "-")}`;

export function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

type FieldProps = {
  label: string;
  error?: FieldError;
  hint?: string;
  className?: string;
};

export function TextField({
  label,
  error,
  hint,
  className,
  ...inputProps
}: FieldProps & ComponentProps<"input">) {
  const name = inputProps.name ?? label;
  const id = toId(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} ${error ? inputBad : inputOk}`}
        {...inputProps}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <ErrorText id={`${id}-error`} message={error?.message} />
    </div>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  ...areaProps
}: FieldProps & ComponentProps<"textarea">) {
  const name = areaProps.name ?? label;
  const id = toId(name);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputBase} min-h-24 resize-y ${error ? inputBad : inputOk}`}
        {...areaProps}
      />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <ErrorText id={`${id}-error`} message={error?.message} />
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** A bordered box for one repeatable entry (one job, one degree...). */
export function EntryCard({
  title,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/80 bg-gradient-to-b from-slate-50/90 to-indigo-50/40 p-4 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(15_23_42/0.05)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <RemoveButton onClick={onRemove} label={removeLabel}>
          Remove
        </RemoveButton>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:border-indigo-500 hover:bg-indigo-50"
    >
      <span aria-hidden>+</span> {children}
    </button>
  );
}

export function RemoveButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
    >
      {children}
    </button>
  );
}
