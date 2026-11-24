/*
 * Renders the sample resume straight to a PDF file, without the browser.
 * Handy for checking the PDF layout:
 *   npm run pdf:sample -- out.pdf           the sample resume
 *   npm run pdf:sample -- out.pdf long      doubled content (tests page breaks)
 *   npm run pdf:sample -- out.pdf styled    formatting + a different font/size/colour
 *   npm run pdf:sample -- out.pdf features [logoSize]  logos, languages, oldest-to-latest order
 *   npm run pdf:sample -- out.pdf ats       the one-column "Modern ATS" template (logos in the data are ignored)
 *   npm run pdf:sample -- out.pdf ats-long  Modern ATS with doubled content (tests page breaks)
 */
import { renderToFile, type DocumentProps } from "@react-pdf/renderer";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { deflateSync } from "node:zlib";
import { ResumeDocument } from "../src/pdf/ResumeDocument";
import { registerFonts, repairGlyphCache } from "../src/pdf/fonts";
import type { RichDoc } from "../src/lib/richText";
import { sampleResume } from "../src/lib/sampleData";
import type { ResumeData } from "../src/lib/schema";

registerFonts(path.resolve(process.cwd(), "public"));
const out = process.argv[2] ?? "sample-resume.pdf";
const variant = process.argv[3];

const t = (text: string, ...marks: ("bold" | "italic" | "underline")[]) =>
  marks.length ? { type: "text" as const, text, marks: marks.map((type) => ({ type })) } : { type: "text" as const, text };

const formattedSummary: RichDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [t("Operations Manager with "), t("8+ years", "bold"), t(" of "), t("inventory and logistics", "italic"), t(" experience. "), t("Underlined phrase", "underline"), t(" and "), t("all three", "bold", "italic", "underline"), t(".")] },
    { type: "paragraph", attrs: { textAlign: "center" }, content: [t("Centered line")] },
    { type: "paragraph", attrs: { textAlign: "right" }, content: [t("Right-aligned line")] },
    { type: "paragraph", attrs: { textAlign: "justify" }, content: [t("Justified paragraph: expert at inventory control, supplier negotiation, team leadership and safety compliance across multi-store operations with measurable cost savings every single quarter.")] },
  ],
};

const formattedJob: RichDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [t("Led parts operations for a ", ), t("12-person", "bold"), t(" team.")] },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [t("Cut obsolete stock by "), t("35%", "bold"), t(" in one year.")] }] },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [t("Launched "), t("new SOPs", "italic"), t(":")] },
            { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("Nested bullet one")] }] }, { type: "listItem", content: [{ type: "paragraph", content: [t("Nested bullet two", "underline")] }] }] },
          ],
        },
      ],
    },
  ],
};

/** A tiny PNG (coloured circle on transparent background) as a base64 data URL. */
function circleLogo(w: number, h: number, [r, g, b]: [number, number, number]): string {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    for (let x = 0; x < w; x++) {
      const inside = (x - w / 2) ** 2 / (w / 2) ** 2 + (y - h / 2) ** 2 / (h / 2) ** 2 <= 1;
      row.set([r, g, b, inside ? 255 : 0], 1 + x * 4);
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, body: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type), body]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb)); return Buffer.concat([len, tb, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

let data: ResumeData = sampleResume;
if (variant === "long" || variant === "ats-long") {
  data = { ...sampleResume, experience: [...sampleResume.experience, ...sampleResume.experience], skillGroups: [...sampleResume.skillGroups, ...sampleResume.skillGroups] };
} else if (variant === "styled") {
  data = {
    ...sampleResume,
    summary: formattedSummary,
    experience: [{ ...sampleResume.experience[0], description: formattedJob }, ...sampleResume.experience.slice(1)],
    style: { ...sampleResume.style, template: "classic", fontFamily: "Gelasio", fontSize: 9.5, lineHeight: 1.5, accentColor: "#1F8A8A" },
  };
}

if (variant === "ats-long") data = { ...data, style: { ...data.style, template: "modern-ats" } };

if (variant === "features" || variant === "ats") {
  data = {
    ...sampleResume,
    style: {
      ...sampleResume.style,
      logoSize: Number(process.argv[4] ?? 24),
      ...(variant === "ats" ? { template: "modern-ats" as const } : {}),
    },
    experienceOrder: variant === "ats" ? "newest" : "oldest",
    experience: sampleResume.experience.map((job, i) => ({
      ...job,
      logo: i === 0 ? circleLogo(100, 60, [232, 114, 110]) : i === 2 ? circleLogo(80, 80, [47, 111, 176]) : "",
    })),
    languages: [
      { name: "English", level: "native" },
      { name: "Kannada", level: "professional" },
      { name: "Hindi", level: "conversational" },
    ],
  };
}

repairGlyphCache();
const doc = createElement(ResumeDocument, { data }) as unknown as ReactElement<DocumentProps>;
await renderToFile(doc, out);
console.log("Wrote", out);
