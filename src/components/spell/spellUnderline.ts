/*
 * Red wavy underlines for misspelled words inside the rich-text editor
 * (summary, job descriptions). A ProseMirror "decoration": it only changes
 * how the text looks on screen, never the text itself.
 */
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { wordsToCheck } from "@/lib/spell/targets";
import type { Spellcheck } from "./SpellcheckProvider";

type UnderlineState = { spell: Spellcheck | null; decorations: DecorationSet };

export const spellUnderlineKey = new PluginKey<UnderlineState>("spellUnderline");

/** Sends the latest spell check to an editor (it redraws the underlines). */
export const spellUpdate = (spell: Spellcheck | null) => ({ spell });

function underlines(doc: ProseMirrorNode, spell: Spellcheck | null): DecorationSet {
  if (!spell) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // The block's text, with one character per non-text item (e.g. a line
    // break), so a position in the string is a position in the document.
    let text = "";
    node.forEach((child) => {
      text += child.isText ? child.text : "\n".repeat(child.nodeSize);
    });
    for (const w of wordsToCheck(text, spell.known)) {
      if (!spell.isMisspelled(w.word)) continue;
      decorations.push(
        Decoration.inline(pos + 1 + w.start, pos + 1 + w.end, { class: "spell-error", "data-spell-word": w.word }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * The editor extension. The component sends the current spell check with
 * `editor.view.dispatch(tr.setMeta(spellUnderlineKey, spellUpdate(spell)))`
 * whenever results change; typing redraws with the last one it got.
 */
export const SpellUnderline = Extension.create({
  name: "spellUnderline",
  addProseMirrorPlugins() {
    return [
      new Plugin<UnderlineState>({
        key: spellUnderlineKey,
        state: {
          init: () => ({ spell: null, decorations: DecorationSet.empty }),
          apply: (tr, old, _oldState, newState) => {
            const update = tr.getMeta(spellUnderlineKey) as { spell: Spellcheck | null } | undefined;
            if (update) return { spell: update.spell, decorations: underlines(newState.doc, update.spell) };
            return tr.docChanged ? { spell: old.spell, decorations: underlines(newState.doc, old.spell) } : old;
          },
        },
        props: {
          decorations: (state) => spellUnderlineKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
