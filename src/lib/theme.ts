import { DEFAULT_TEMPLATE, resolveTemplateId, type TemplateId } from "./templates";

/*
 * Document design options: font, base size, line spacing, accent colour.
 * Font, size and spacing apply to Classic Sidebar; Modern ATS uses fixed,
 * scanner-friendly typography and only its own accent colour.
 * The defaults reproduce the app's original Classic Sidebar design.
 */

export const FONT_OPTIONS = [
  { value: "SourceSans3", label: "Source Sans 3 (default)" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  // Georgia and Calibri are Microsoft fonts whose licences don't allow
  // embedding them in PDFs from a web app. These free fonts have the same
  // letter widths, so text takes up exactly the same space.
  { value: "Gelasio", label: "Georgia (Gelasio)" },
  { value: "Carlito", label: "Calibri (Carlito)" },
] as const;

export type FontFamily = (typeof FONT_OPTIONS)[number]["value"];
export const FONT_VALUES = FONT_OPTIONS.map((f) => f.value) as [FontFamily, ...FontFamily[]];

/** Fonts that don't ship a semibold (600) file; 600 uses their bold file. */
export const FONTS_WITHOUT_SEMIBOLD: ReadonlySet<FontFamily> = new Set<FontFamily>(["Carlito"]);

export const FONT_SIZE_OPTIONS = [8, 8.5, 8.8, 9.5, 10, 10.5, 11, 12] as const;
/** Company logo size in the PDF, in points at the default text size (scales with Text size). */
export const LOGO_SIZE_OPTIONS = [
  { value: 16, label: "Extra small" },
  { value: 20, label: "Small" },
  { value: 24, label: "Medium (default)" },
  { value: 32, label: "Large" },
  { value: 40, label: "Extra large" },
] as const;

export const LINE_HEIGHT_OPTIONS = [
  { value: 1, label: "Single (1.0)" },
  { value: 1.15, label: "1.15" },
  { value: 1.32, label: "Default (1.3)" },
  { value: 1.5, label: "1.5" },
  { value: 1.75, label: "1.75" },
  { value: 2, label: "Double (2.0)" },
] as const;

export const ACCENT_PRESETS = [
  { value: "#E8726E", label: "Coral" },
  { value: "#2F6FB0", label: "Ocean" },
  { value: "#1F8A8A", label: "Teal" },
  { value: "#3C7A4A", label: "Forest" },
  { value: "#7A4E9C", label: "Plum" },
  { value: "#3D4552", label: "Charcoal" },
  { value: "#B8862B", label: "Gold" },
] as const;

/**
 * Accent colours for Modern ATS. Each one has at least 4.5:1 contrast with
 * white (WCAG AA for normal text), which covers both uses: coloured text on
 * white paper (headings, company names) and white text on the coloured
 * Banner header. That's why amber and emerald are deep shades (the bright
 * versions only reach about 2.2:1 and 2.5:1). The tests check every preset.
 * Colour is decoration only: headings are also bold and uppercase.
 */
export const ATS_ACCENT_PRESETS = [
  { value: "#1E3A5F", label: "Navy" },
  { value: "#1D4ED8", label: "Royal blue" },
  { value: "#0F5E63", label: "Teal" },
  { value: "#047857", label: "Emerald" },
  { value: "#2E5E3A", label: "Forest green" },
  { value: "#B45309", label: "Amber" },
  { value: "#7A2E3B", label: "Burgundy" },
  { value: "#6B2D6B", label: "Plum" },
  { value: "#334155", label: "Slate" },
] as const;

/** Modern ATS header designs. All three contain the same text in the same order. */
export const ATS_HEADER_STYLES = [
  { value: "banner", label: "Banner", description: "Colour band, white text" },
  { value: "accent", label: "Left accent", description: "Accent bar beside the name" },
  { value: "minimal", label: "Minimal", description: "Plain, with a thin rule" },
] as const;
export type AtsHeaderStyle = (typeof ATS_HEADER_STYLES)[number]["value"];
export const ATS_HEADER_VALUES = ATS_HEADER_STYLES.map((h) => h.value) as [AtsHeaderStyle, ...AtsHeaderStyle[]];

/** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type DocumentStyle = {
  template: TemplateId; // PDF design (lib/templates.ts)
  fontFamily: FontFamily;
  fontSize: number; // base body text size, in points
  lineHeight: number; // multiple of the font size
  accentColor: string; // #RRGGBB, Classic Sidebar
  atsAccentColor: string; // #RRGGBB, Modern ATS (one of ATS_ACCENT_PRESETS)
  atsHeader: AtsHeaderStyle; // Modern ATS header design
  atsBoldMetrics: boolean; // Modern ATS: draw metrics like 40% or $140K in bold
  logoSize: number; // company logo width/height, in points
};

export const DEFAULT_FONT_SIZE = 8.8;

export const defaultStyle = (): DocumentStyle => ({
  template: DEFAULT_TEMPLATE,
  fontFamily: "SourceSans3",
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: 1.32,
  accentColor: "#E8726E",
  atsAccentColor: ATS_ACCENT_PRESETS[0].value,
  atsHeader: "banner", // new resumes; see normalizeStyle for older saves
  atsBoldMetrics: true,
  logoSize: 24,
});

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Mixes a #RRGGBB colour with white. amount 0 = colour, 1 = white. */
export function tint(hex: string, amount: number): string {
  if (!HEX_COLOR.test(hex)) return "#F6DCDB";
  const channel = (i: number) => {
    const value = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase();
}

/** Fills in missing/invalid style values (older saves, imports). */
export function normalizeStyle(value: unknown): DocumentStyle {
  const base = defaultStyle();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<DocumentStyle>;
  // Snap numbers to the closest menu option, so the dropdowns can show them.
  const nearest = (n: unknown, options: readonly number[], fallback: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? options.reduce((best, o) => (Math.abs(o - n) < Math.abs(best - n) ? o : best), options[0])
      : fallback;
  return {
    // Older saves used "coral", "slate", "ocean" or "minimal"; see templates.ts.
    template: resolveTemplateId(v.template),
    fontFamily: FONT_VALUES.includes(v.fontFamily as FontFamily) ? (v.fontFamily as FontFamily) : base.fontFamily,
    fontSize: nearest(v.fontSize, FONT_SIZE_OPTIONS, base.fontSize),
    lineHeight: nearest(v.lineHeight, LINE_HEIGHT_OPTIONS.map((o) => o.value), base.lineHeight),
    logoSize: nearest(v.logoSize, LOGO_SIZE_OPTIONS.map((o) => o.value), base.logoSize),
    accentColor: typeof v.accentColor === "string" && HEX_COLOR.test(v.accentColor) ? v.accentColor : base.accentColor,
    atsAccentColor:
      ATS_ACCENT_PRESETS.find((p) => p.value.toLowerCase() === String(v.atsAccentColor).toLowerCase())?.value ??
      base.atsAccentColor,
    // Saved before header styles existed: keep the look they had (Minimal).
    atsHeader: ATS_HEADER_VALUES.includes(v.atsHeader as AtsHeaderStyle) ? (v.atsHeader as AtsHeaderStyle) : "minimal",
    atsBoldMetrics: typeof v.atsBoldMetrics === "boolean" ? v.atsBoldMetrics : true,
  };
}
