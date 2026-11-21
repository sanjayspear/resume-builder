"use client";

import { get, useFieldArray, useFormContext, type FieldError } from "react-hook-form";
import type { ResumeData } from "@/lib/schema";
import { AddButton, ErrorText, RemoveButton, toId } from "../ui";

type ListName = `skillGroups.${number}.skills`;

/**
 * An editable list of single-line text items with Add/Remove buttons.
 * Used for the skills inside a skill group.
 */
export function StringListField({
  name,
  label,
  itemLabel,
  addLabel,
  multiline = false,
}: {
  name: ListName;
  label: string;
  itemLabel: string;
  addLabel: string;
  multiline?: boolean;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ResumeData>();
  const { fields, append, remove } = useFieldArray({ control, name });

  // Error for the list as a whole, e.g. "Add at least one bullet point".
  const listError = get(errors, name) as (FieldError & { root?: FieldError }) | undefined;
  const listMessage: string | undefined = listError?.root?.message ?? listError?.message;
  const listId = toId(name);

  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-semibold text-slate-700">{label}</legend>
      <ul className="space-y-2">
        {fields.map((field, index) => {
          const itemName = `${name}.${index}.value` as const;
          const id = toId(itemName);
          const message = (get(errors, itemName) as FieldError | undefined)?.message;
          const common = {
            id,
            "aria-label": `${itemLabel} ${index + 1}`,
            "aria-invalid": message ? true : undefined,
            "aria-describedby": message ? `${id}-error` : undefined,
            className:
              "w-full rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 " +
              (message
                ? "border-red-500 focus:ring-red-200"
                : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"),
            ...register(itemName),
          };
          return (
            <li key={field.id}>
              <div className="flex items-start gap-2">
                <span aria-hidden className="mt-2 text-slate-400">
                  •
                </span>
                {multiline ? <textarea rows={2} {...common} /> : <input type="text" {...common} />}
                <RemoveButton
                  onClick={() => remove(index)}
                  label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                >
                  ✕
                </RemoveButton>
              </div>
              <div className="pl-4">
                <ErrorText id={`${id}-error`} message={message} />
              </div>
            </li>
          );
        })}
      </ul>
      {fields.length === 0 && <p className="text-xs text-slate-500">Nothing added yet.</p>}
      <ErrorText id={`${listId}-error`} message={listMessage} />
      <div className="mt-2">
        <AddButton onClick={() => append({ value: "" }, { shouldFocus: true })}>{addLabel}</AddButton>
      </div>
    </fieldset>
  );
}
