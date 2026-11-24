import { Font } from "@react-pdf/renderer";
import { FONT_VALUES, FONTS_WITHOUT_SEMIBOLD } from "@/lib/theme";

let registered = false;

/** Montserrat (SemiBold, Bold): names and headings in Modern ATS. SIL Open Font License 1.1. */
export const DISPLAY_FONT = "Montserrat";

/**
 * Registers every selectable font with the PDF generator. Files live in
 * /public/fonts as <Family>-<weight>-<style>.woff. react-pdf only downloads
 * a font when a document actually uses it.
 */
export function registerFonts(baseUrl: string) {
  if (registered) return;
  registered = true;

  for (const family of FONT_VALUES) {
    const fonts = [];
    for (const fontWeight of [400, 600, 700] as const) {
      // Fonts without a semibold file use their bold file for 600.
      const fileWeight = fontWeight === 600 && FONTS_WITHOUT_SEMIBOLD.has(family) ? 700 : fontWeight;
      for (const fontStyle of ["normal", "italic"] as const) {
        fonts.push({ src: `${baseUrl}/fonts/${family}-${fileWeight}-${fontStyle}.woff`, fontWeight, fontStyle });
      }
    }
    Font.register({ family, fonts });
  }

  // Display font for Modern ATS names and section headings (not in the Font menu).
  Font.register({
    family: DISPLAY_FONT,
    fonts: [600, 700].map((fontWeight) => ({ src: `${baseUrl}/fonts/${DISPLAY_FONT}-${fontWeight}-normal.woff`, fontWeight })),
  });

  // By default react-pdf splits long words with hyphens ("manage-ment").
  // Returning the whole word turns that off, so lines break between words.
  Font.registerHyphenationCallback((word) => [word]);
}

/* ---------- Glyph cache repair (react-pdf / fontkit bug) ---------- */

type CachedGlyph = { codePoints: number[] };
type GlyphCachingFont = {
  _glyphs?: Record<string, CachedGlyph | undefined>;
  getGlyph: (id: number, characters?: number[]) => CachedGlyph | null;
  __glyphCacheGuard?: true;
};

/**
 * Call before every PDF render. Works around a bug in the font library
 * (fontkit, used by react-pdf) that scrambled the text layer:
 *
 * - fontkit caches each glyph (letter shape) the first time it's asked for,
 *   together with the characters it stands for, and never updates that.
 * - When a PDF is finished, the font subsetter also pulls in "component"
 *   glyphs that other glyphs are built from (in Inter, the straight
 *   apostrophe ' is drawn using the curly ’ glyph). It asks for them
 *   WITHOUT characters, so they're cached as standing for nothing.
 * - react-pdf reuses the same font objects for every PDF in the session
 *   (the live preview renders many). The next PDF that really uses ’ gets
 *   the cached glyph with no characters, and the PDF's glyph-to-letter map
 *   gets an empty entry. Many text extractors (and ATS) then read every
 *   later glyph as its neighbour ("REST" -> "&EST"), and line breaking
 *   goes one letter off ("c" / "ross-browser").
 *
 * Fix: drop glyphs cached without characters, and from then on let the
 * first caller that does know the characters (the text layout) fill them in.
 */
export function repairGlyphCache() {
  for (const family of Object.values(Font.getRegisteredFonts())) {
    for (const source of family.sources) {
      const font = source.data as unknown as GlyphCachingFont | null;
      if (!font || typeof font.getGlyph !== "function" || !font._glyphs) continue; // not loaded yet, or a built-in font
      for (const [id, glyph] of Object.entries(font._glyphs)) {
        if (glyph && glyph.codePoints.length === 0) delete font._glyphs[id];
      }
      if (!font.__glyphCacheGuard) {
        const original = font.getGlyph.bind(font);
        font.getGlyph = (id, characters = []) => {
          const glyph = original(id, characters);
          if (glyph && glyph.codePoints.length === 0 && characters.length > 0) glyph.codePoints = characters;
          return glyph;
        };
        font.__glyphCacheGuard = true;
      }
    }
  }
}
