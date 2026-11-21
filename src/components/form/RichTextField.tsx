"use client";

import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { normalizeRichDoc, type RichDoc, type TextAlign as Align } from "@/lib/richText";
import type { ResumeData } from "@/lib/schema";
import { ErrorText, toId } from "../ui";

type RichName = "summary" | `experience.${number}.description`;

/**
 * A formatted-text field (bold, italic, underline, bullet lists, alignment)
 * connected to React Hook Form, so validation, auto-save and the live
 * preview work exactly like the plain inputs.
 */
export function RichTextField({ name, label, hint }: { name: RichName; label: string; hint?: string }) {
  const { control } = useFormContext<ResumeData>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <RichTextEditor
          id={toId(name)}
          label={label}
          hint={hint}
          value={field.value as RichDoc}
          onChange={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

function RichTextEditor({
  id,
  label,
  hint,
  value,
  onChange,
  onBlur,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  onBlur: () => void;
  error?: string;
}) {
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  // The last document this editor sent to the form (as JSON text). Used to
  // tell "the user typed" apart from "the form was reset from outside".
  const lastSent = useRef(JSON.stringify(normalizeRichDoc(value)));

  const editor = useEditor({
    extensions: [
      // Only the formatting the PDF supports; everything else is switched off
      // so pasted content can't bring in headings, links, code, etc.
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        orderedList: false,
        dropcursor: false,
        trailingNode: false,
      }),
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        class: "rich-editor min-h-24 px-3 py-2 text-sm text-slate-900 outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const doc = normalizeRichDoc(editor.getJSON());
      lastSent.current = JSON.stringify(doc);
      onChange(doc);
    },
    onBlur: () => onBlur(),
  });

  // "Load sample data" / "Clear form" change the value from outside: show it.
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeRichDoc(value);
    const json = JSON.stringify(incoming);
    if (json === lastSent.current) return;
    lastSent.current = json;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  // Keep accessibility attributes in sync with the error state.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    if (error) {
      dom.setAttribute("aria-invalid", "true");
      dom.setAttribute("aria-describedby", errorId);
    } else {
      dom.removeAttribute("aria-invalid");
      dom.removeAttribute("aria-describedby");
    }
  }, [editor, error, errorId]);

  return (
    <div>
      <span id={labelId} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      <div
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition focus-within:ring-2 ${
          error
            ? "border-red-500 focus-within:ring-red-200"
            : "border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-200"
        }`}
      >
        <Toolbar editor={editor} label={label} />
        <EditorContent editor={editor} />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <ErrorText id={errorId} message={error} />
    </div>
  );
}

/* ---------- Toolbar ---------- */

const ALIGN_BUTTONS: { value: Align; label: string; icon: ReactNode }[] = [
  { value: "left", label: "Align left", icon: <AlignIcon lines={[16, 10, 16, 10]} align="left" /> },
  { value: "center", label: "Align center", icon: <AlignIcon lines={[16, 10, 16, 10]} align="center" /> },
  { value: "right", label: "Align right", icon: <AlignIcon lines={[16, 10, 16, 10]} align="right" /> },
  { value: "justify", label: "Justify", icon: <AlignIcon lines={[16, 16, 16, 16]} align="left" /> },
];

function Toolbar({ editor, label }: { editor: Editor | null; label: string }) {
  // Re-render the buttons only when the formatting at the cursor changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            bulletList: e.isActive("bulletList"),
            align: (["center", "right", "justify"] as Align[]).find((a) => e.isActive({ textAlign: a })) ?? "left",
          }
        : null,
  });

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (editor) command(editor.chain().focus()).run();
  };

  return (
    <div
      role="toolbar"
      aria-label={`${label} formatting`}
      className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1"
    >
      <ToolButton label="Bold" shortcut="Ctrl+B" active={state?.bold} onClick={() => run((c) => c.toggleBold())}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Italic" shortcut="Ctrl+I" active={state?.italic} onClick={() => run((c) => c.toggleItalic())}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label="Underline" shortcut="Ctrl+U" active={state?.underline} onClick={() => run((c) => c.toggleUnderline())}>
        <span className="underline">U</span>
      </ToolButton>
      <Divider />
      <ToolButton label="Bullet list" active={state?.bulletList} onClick={() => run((c) => c.toggleBulletList())}>
        <ListIcon />
      </ToolButton>
      <Divider />
      {ALIGN_BUTTONS.map((b) => (
        <ToolButton
          key={b.value}
          label={b.label}
          active={state?.align === b.value}
          onClick={() => run((c) => c.setTextAlign(b.value))}
        >
          {b.icon}
        </ToolButton>
      ))}
    </div>
  );
}

function ToolButton({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ? "true" : "false"}
      title={shortcut ? `${label} (${shortcut})` : label}
      // Keep the text selection while clicking a toolbar button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition ${
        active ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-4 w-px bg-slate-300" />;

function ListIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="2.5" cy="4" r="1.3" />
      <circle cx="2.5" cy="8" r="1.3" />
      <circle cx="2.5" cy="12" r="1.3" />
      <rect x="5.5" y="3.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx=".75" />
      <rect x="5.5" y="11.25" width="9" height="1.5" rx=".75" />
    </svg>
  );
}

function AlignIcon({ lines, align }: { lines: number[]; align: "left" | "center" | "right" }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      {lines.map((w, i) => {
        const width = (w / 16) * 14;
        const x = align === "left" ? 1 : align === "right" ? 15 - width : (16 - width) / 2;
        return <rect key={i} x={x} y={2.25 + i * 3.5} width={width} height="1.5" rx=".75" />;
      })}
    </svg>
  );
}
