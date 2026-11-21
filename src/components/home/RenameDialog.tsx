"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

/** Small "Rename resume" window (native <dialog>: Esc closes, focus stays inside). */
export function RenameDialog({
  currentName,
  open,
  onClose,
  onSave,
}: {
  currentName: string;
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(name);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-labelledby="rename-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      {open && (
        <form onSubmit={submit} className="p-5">
          <h2 id="rename-title" className="text-lg font-bold">
            Rename resume
          </h2>
          <label htmlFor="rename-input" className="mb-1 mt-4 block text-xs font-semibold text-slate-700">
            Name
          </label>
          <input
            id="rename-input"
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mt-1 text-xs text-slate-500">Leave empty to use the name and job title from the resume.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-light rounded-lg px-3.5 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button type="submit" className="btn-dark rounded-lg px-3.5 py-2 text-sm font-semibold">
              Save
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
