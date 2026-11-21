import { Font } from "@react-pdf/renderer";
import { FONT_VALUES, FONTS_WITHOUT_SEMIBOLD } from "@/lib/theme";

let registered = false;

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

  // By default react-pdf splits long words with hyphens ("manage-ment").
  // Returning the whole word turns that off, so lines break between words.
  Font.registerHyphenationCallback((word) => [word]);
}
