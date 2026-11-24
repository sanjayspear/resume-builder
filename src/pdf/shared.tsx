import { Text } from "@react-pdf/renderer";
import type { RichInline } from "@/lib/richText";
import type { ResumeData } from "@/lib/schema";

/* Helpers shared by both PDF templates (ClassicSidebar in ResumeDocument.tsx, ModernAtsDocument.tsx). */

/**
 * Turns off ligatures. Most of our fonts draw "ft", "ff", "ffi" and "ffl" as
 * one combined glyph, and the PDF maps that glyph back to several letters.
 * Many resume scanners (ATS) and text extractors only read the first letter,
 * so "Software" came out as "Sofware". One glyph per letter keeps the text
 * layer exact. Set on each template's <Page>; every Text inherits it.
 */
export const NO_LIGATURES = { liga: false, clig: false };

export const clean = (value: string | undefined | null) => (value ?? "").trim();

export const nonEmpty = (list: { value?: string }[] | undefined) =>
  (list ?? []).map((item) => clean(item?.value)).filter(Boolean);

/** "example.com" -> "https://example.com" (links need the https:// part). */
export const webHref = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** "https://www.linkedin.com/in/x/" -> "linkedin.com/in/x": shorter, still readable. */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

/** PDF file properties (shown by PDF viewers and read by some ATS). */
export function documentInfo(personal: ResumeData["personal"] | undefined) {
  const fullName = clean(personal?.fullName);
  return {
    title: fullName ? `${fullName} - Resume` : "Resume",
    author: fullName || undefined,
    subject: clean(personal?.jobTitle) || undefined,
    creator: "Resume Builder",
    producer: "Resume Builder",
  };
}

/** Text runs with their bold/italic/underline marks, as nested <Text>. */
export function Inlines({ inlines }: { inlines: RichInline[] }) {
  return (
    <>
      {inlines.map((node, i) => {
        if (node.type === "hardBreak") return "\n";
        const marks = new Set((node.marks ?? []).map((m) => m.type));
        const style: { fontWeight?: number; fontStyle?: "italic"; textDecoration?: "underline" } = {};
        if (marks.has("bold")) style.fontWeight = 700;
        if (marks.has("italic")) style.fontStyle = "italic";
        if (marks.has("underline")) style.textDecoration = "underline";
        return (
          <Text key={i} style={style}>
            {node.text}
          </Text>
        );
      })}
    </>
  );
}
