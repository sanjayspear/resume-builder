/*
 * Rich text = formatted text (bold, italic, underline, bullet lists, alignment).
 *
 * It's stored as a small tree of plain objects (the same JSON shape the Tiptap
 * editor uses), never as HTML. That makes it safe to save, easy to validate,
 * and straightforward to turn into PDF text.
 *
 *   doc
 *   ├─ paragraph  (textAlign)  ─ text runs (with bold/italic/underline marks)
 *   └─ bulletList ─ listItem ─ paragraph ─ text runs   (lists can nest)
 */

export type TextAlign = "left" | "center" | "right" | "justify";
export type MarkType = "bold" | "italic" | "underline";

export type RichText = { type: "text"; text: string; marks?: { type: MarkType }[] };
export type RichHardBreak = { type: "hardBreak" };
export type RichInline = RichText | RichHardBreak;

export type RichParagraph = {
  type: "paragraph";
  attrs?: { textAlign?: TextAlign | null };
  content?: RichInline[];
};
export type RichListItem = { type: "listItem"; content: (RichParagraph | RichBulletList)[] };
export type RichBulletList = { type: "bulletList"; content: RichListItem[] };
export type RichBlock = RichParagraph | RichBulletList;
export type RichDoc = { type: "doc"; content: RichBlock[] };

const MARKS = new Set<MarkType>(["bold", "italic", "underline"]);
const ALIGNS = new Set<TextAlign>(["left", "center", "right", "justify"]);

/* ---------- Building documents ---------- */

export const emptyDoc = (): RichDoc => ({ type: "doc", content: [{ type: "paragraph" }] });

const textRun = (text: string): RichText[] => (text ? [{ type: "text", text }] : []);

/** Plain text -> one paragraph per line. */
export function textToDoc(text: string): RichDoc {
  const lines = text.split(/\r?\n/);
  return { type: "doc", content: lines.map((line) => ({ type: "paragraph", content: textRun(line) })) };
}

/** ["a", "b"] -> a bullet list with one item per string. */
export function bulletsToDoc(items: string[]): RichDoc {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return emptyBulletDoc();
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: clean.map((text) => ({ type: "listItem", content: [{ type: "paragraph", content: textRun(text) }] })),
      },
    ],
  };
}

/** A bullet list with one empty bullet - the starting point for job descriptions. */
export const emptyBulletDoc = (): RichDoc => ({
  type: "doc",
  content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] }],
});

/* ---------- Reading documents ---------- */

/** All the words in a document, without formatting (used for "is it empty?" checks). */
export function richTextToPlain(doc: RichDoc | null | undefined): string {
  const lines: string[] = [];
  const walkInline = (inlines: RichInline[] | undefined) =>
    (inlines ?? []).map((i) => (i.type === "text" ? i.text : "\n")).join("");
  const walkBlocks = (blocks: RichBlock[] | undefined) => {
    for (const block of blocks ?? []) {
      if (block.type === "paragraph") lines.push(walkInline(block.content));
      else for (const item of block.content ?? []) walkBlocks(item.content);
    }
  };
  walkBlocks(doc?.content);
  return lines.join("\n");
}

export function isRichDoc(value: unknown): value is RichDoc {
  return !!value && typeof value === "object" && (value as RichDoc).type === "doc" && Array.isArray((value as RichDoc).content);
}

/* ---------- Cleaning (for saved data, imports and pasted content) ---------- */

function cleanInline(node: unknown): RichInline | null {
  if (!node || typeof node !== "object") return null;
  const n = node as { type?: string; text?: unknown; marks?: unknown };
  if (n.type === "hardBreak") return { type: "hardBreak" };
  if (n.type !== "text" || typeof n.text !== "string" || n.text === "") return null;
  const marks = Array.isArray(n.marks)
    ? n.marks
        .map((m) => (m && typeof m === "object" ? (m as { type?: string }).type : undefined))
        .filter((t): t is MarkType => MARKS.has(t as MarkType))
        .map((type) => ({ type }))
    : [];
  return marks.length ? { type: "text", text: n.text, marks } : { type: "text", text: n.text };
}

function cleanParagraph(node: { attrs?: unknown; content?: unknown }): RichParagraph {
  const align = (node.attrs as { textAlign?: unknown } | undefined)?.textAlign;
  const content = Array.isArray(node.content)
    ? node.content.map(cleanInline).filter((i): i is RichInline => i !== null)
    : [];
  const paragraph: RichParagraph = { type: "paragraph" };
  if (ALIGNS.has(align as TextAlign) && align !== "left") paragraph.attrs = { textAlign: align as TextAlign };
  if (content.length) paragraph.content = content;
  return paragraph;
}

/** Anything unknown (headings, quotes, tables pasted from Word...) becomes a plain paragraph. */
function cleanBlock(node: unknown): RichBlock[] {
  if (!node || typeof node !== "object") return [];
  const n = node as { type?: string; content?: unknown; attrs?: unknown; text?: unknown };
  if (n.type === "bulletList" || n.type === "orderedList") {
    const items = (Array.isArray(n.content) ? n.content : [])
      .map((item): RichListItem | null => {
        const blocks = Array.isArray((item as { content?: unknown })?.content)
          ? ((item as { content: unknown[] }).content.flatMap(cleanBlock) as RichBlock[])
          : [];
        return blocks.length ? { type: "listItem", content: blocks } : null;
      })
      .filter((i): i is RichListItem => i !== null);
    return items.length ? [{ type: "bulletList", content: items }] : [];
  }
  if (n.type === "paragraph") return [cleanParagraph(n)];
  if (n.type === "text") return [cleanParagraph({ content: [n] })];
  // Unknown block with children: keep its text, flattened into paragraphs.
  return Array.isArray(n.content) ? n.content.flatMap(cleanBlock) : [];
}

/**
 * Turns any stored value into a valid, safe document:
 * - a RichDoc -> cleaned (only supported formatting kept)
 * - a plain string (older saves) -> paragraphs
 * - anything else -> an empty document
 */
export function normalizeRichDoc(value: unknown): RichDoc {
  if (typeof value === "string") return textToDoc(value);
  if (!isRichDoc(value)) return emptyDoc();
  const content = value.content.flatMap(cleanBlock);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/* ---------- Flattening (for the PDF) ---------- */

/**
 * One printable line-group of a document: a paragraph, or one bullet.
 * The PDF renders each unit separately so a bullet is never split across pages.
 */
export type RichUnit =
  | { kind: "paragraph"; align: TextAlign; inlines: RichInline[] }
  | { kind: "bullet"; depth: number; align: TextAlign; inlines: RichInline[] };

export function flattenDoc(doc: RichDoc | null | undefined): RichUnit[] {
  const units: RichUnit[] = [];
  const alignOf = (p: RichParagraph): TextAlign => p.attrs?.textAlign ?? "left";

  const walkList = (list: RichBulletList, depth: number) => {
    for (const item of list.content ?? []) {
      let first = true;
      for (const block of item.content ?? []) {
        if (block.type === "bulletList") walkList(block, depth + 1);
        else if (first) {
          units.push({ kind: "bullet", depth, align: alignOf(block), inlines: block.content ?? [] });
          first = false;
        } else {
          // Extra paragraph inside the same bullet: indented, no new dot.
          units.push({ kind: "paragraph", align: alignOf(block), inlines: block.content ?? [] });
        }
      }
    }
  };

  for (const block of doc?.content ?? []) {
    if (block.type === "bulletList") walkList(block, 0);
    else units.push({ kind: "paragraph", align: alignOf(block), inlines: block.content ?? [] });
  }

  // Drop empty bullets, and empty paragraphs at the start/end.
  const hasText = (u: RichUnit) => u.inlines.some((i) => i.type === "text" && i.text.trim() !== "");
  const kept = units.filter((u) => u.kind === "paragraph" || hasText(u));
  while (kept.length && !hasText(kept[0])) kept.shift();
  while (kept.length && !hasText(kept[kept.length - 1])) kept.pop();
  return kept;
}
