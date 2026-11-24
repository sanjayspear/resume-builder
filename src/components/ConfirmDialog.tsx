"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  /** Red confirm button, for actions that delete something. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * A yes/no question in a small window, with our own button labels (the
 * browser's built-in confirm() only offers OK/Cancel).
 *
 *   const [confirmDialog, confirm] = useConfirm();
 *   if (await confirm({ title: "...", cancelLabel: "Cancel", confirmLabel: "Clear" })) { ... }
 *   return <>{confirmDialog} ...</>;
 *
 * Esc, clicking outside, or Cancel answers "no". Focus starts on Cancel, so
 * pressing Enter by accident never does the risky thing.
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const element = pending ? <ConfirmDialog key={pending.title} options={pending} onAnswer={answer} /> : null;
  return [element, confirm];
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (ok: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const answeredRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
  }, []);

  const answer = (ok: boolean) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    dialogRef.current?.close();
    onAnswer(ok);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => answer(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) answer(false);
      }}
      aria-labelledby="confirm-title"
      aria-describedby={options.message ? "confirm-message" : undefined}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-base font-bold">
          {options.title}
        </h2>
        {options.message && (
          <div id="confirm-message" className="mt-2 text-sm text-slate-600">
            {options.message}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => answer(false)}
            className="btn-light h-9 rounded-lg px-3.5 text-sm font-semibold"
          >
            {options.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className={`h-9 rounded-lg px-3.5 text-sm font-semibold text-white ${
              options.danger ? "bg-red-600 hover:bg-red-700" : "btn-primary"
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
