/*
 * Modern ATS design: header styles, accent colours (contrast), and bold
 * metrics. The design must never change the text or its order.
 * Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeResumeData } from "@/lib/library";
import { splitMetrics } from "@/lib/metrics";
import { bulletsToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import { newResumeData } from "@/lib/sampleMode";
import type { ResumeData } from "@/lib/schema";
import { ATS_ACCENT_PRESETS, ATS_HEADER_VALUES, contrastRatio, type AtsHeaderStyle } from "@/lib/theme";
import { extractPdf, renderPdf } from "./helpers/pdf";

const ats = (header: AtsHeaderStyle, extra: Partial<ResumeData["style"]> = {}, data: ResumeData = sampleResume): ResumeData => ({
  ...data,
  style: { ...data.style, template: "modern-ats", atsHeader: header, ...extra },
});

describe("accent colours", () => {
  for (const preset of ATS_ACCENT_PRESETS) {
    test(`${preset.label} (${preset.value}) has at least 4.5:1 contrast with white (banner text and coloured text)`, () => {
      const ratio = contrastRatio(preset.value, "#FFFFFF");
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    });
  }

  test("the contrast formula matches known values", () => {
    assert.equal(contrastRatio("#000000", "#FFFFFF").toFixed(0), "21");
    assert.equal(contrastRatio("#FFFFFF", "#FFFFFF"), 1);
    assert.ok(contrastRatio("#F59E0B", "#FFFFFF") < 4.5, "bright amber fails, which is why the preset is the deep shade");
  });
});

describe("header style defaults", () => {
  test("new resumes get the Banner header and bold numbers", () => {
    const style = newResumeData("modern-ats").style;
    assert.equal(style.atsHeader, "banner");
    assert.equal(style.atsBoldMetrics, true);
  });

  test("resumes saved before header styles existed keep their look (Minimal)", () => {
    const old = normalizeResumeData({ ...sampleResume, style: { template: "modern-ats", atsAccentColor: "#0F5E63" } });
    assert.equal(old.style.atsHeader, "minimal");
    assert.equal(old.style.atsBoldMetrics, true);
    assert.equal(old.style.atsAccentColor, "#0F5E63");
  });
});

for (const header of ATS_HEADER_VALUES) {
  describe(`${header} header: same text, same order`, () => {
    const rendered = renderPdf(ats(header)).then(async (pdf) => extractPdf(pdf));

    test("name, job title and contact line come first", async () => {
      const { pages } = await rendered;
      const { fullName, jobTitle, location, phone, email, linkedin } = sampleResume.personal;
      assert.deepEqual(pages[0].slice(0, 3), [fullName, jobTitle, [location, phone, email, linkedin].join(" | ")]);
    });

    test("reading order: name → contact → summary → skills → experience → projects → education → certifications → languages", async () => {
      const { streamText } = await rendered;
      const steps = [sampleResume.personal.fullName, sampleResume.personal.email, "SUMMARY", "SKILLS", "WORK EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "LANGUAGES"];
      let from = 0;
      for (const step of steps) {
        const at = streamText.indexOf(step, from);
        assert.ok(at >= 0, `"${step}" not found after the previous step`);
        from = at + step.length;
      }
    });

    test("job lines and date ranges are intact, each on one line", async () => {
      const lines = (await rendered).pages.flat();
      for (const job of sampleResume.experience) {
        const dates = `${job.startDate} – ${job.isCurrent ? "Present" : job.endDate}`;
        assert.ok(lines.includes(`${job.jobTitle} | ${job.company}, ${job.location} ${dates}`), job.jobTitle);
      }
    });

    test("metrics extract as plain text, exactly as typed", async () => {
      const lines = (await rendered).pages.flat().join(" ");
      for (const phrase of ["by 40%.", "budget of $4.2M and", "saving $140K a year", "handling 6,500 orders", "moving 3,000+ SKUs", "from 97.1% to 99.4% within", "with 6+ years"]) {
        assert.ok(lines.includes(phrase), `"${phrase}" not found`);
      }
    });

    test("the sample fits on at most 2 pages", async () => {
      assert.ok((await rendered).pageCount <= 2);
    });
  });
}

describe("bold metrics", () => {
  test("detects real metrics", () => {
    const metrics = (text: string) => splitMetrics(text).filter((p) => p.metric).map((p) => p.text);
    assert.deepEqual(metrics("Cut costs by 40% and raised accuracy to 99.4%."), ["40%", "99.4%"]);
    assert.deepEqual(metrics("Saved $140K on a $4.2M budget; $500 a week; $1M+ pipeline"), ["$140K", "$4.2M", "$500", "$1M+"]);
    assert.deepEqual(metrics("6,500 orders, 3,000+ SKUs, 1,200.5 hours"), ["6,500", "3,000+", "1,200.5"]);
    assert.deepEqual(metrics("9+ years, 10K users, 2B rows, 100+ tests"), ["9+", "10K", "2B", "100+"]);
  });

  test("leaves plain numbers, years and numbers inside words alone", () => {
    for (const text of [
      "Project 1",
      "a 30-day onboarding plan",
      "since 2017",
      "January 2023 – January 2024",
      "a team of 25 across 3 shifts",
      "Web3, S3, v2.0, ISO 27001, 24/7, COVID-19, 1.5x faster",
      "Senior Software Engineer using Playwright",
    ]) {
      assert.deepEqual(splitMetrics(text).filter((p) => p.metric), [], text);
    }
  });

  test("splitting never changes the text", () => {
    for (const text of ["by 40%.", "$4.2M, 6,500 and 3,000+; Project 1 (2017)", "", "no numbers here"]) {
      assert.equal(splitMetrics(text).map((p) => p.text).join(""), text);
    }
  });

  const BULLET = "Project 1 ran a 30-day pilot in 2017 for a team of 25, saving $140K and 40% time on 6,500 orders.";
  const withBullet = (bold: boolean) =>
    ats("banner", { atsBoldMetrics: bold }, {
      ...sampleResume,
      experience: [{ ...sampleResume.experience[0], description: bulletsToDoc([BULLET]) }],
    });

  /** The font of each text piece, to compare with a known bold (a skill label) and regular (bullet) text. */
  async function fonts(data: ResumeData) {
    const { items } = await extractPdf(await renderPdf(data));
    const fontOf = (pred: (s: string) => boolean) => items.find((i) => pred(i.str))?.font;
    return {
      items,
      bold: fontOf((s) => s === `${sampleResume.skillGroups[0].name}:`), // skill labels are Inter Bold
      regular: fontOf((s) => s.includes("ran a")),
    };
  }

  test("switch on: metrics are bold; plain numbers and years stay regular; the text is unchanged", async () => {
    const { items, bold, regular } = await fonts(withBullet(true));
    assert.ok(bold && regular && bold !== regular, "need distinct bold and regular fonts to compare");
    for (const metric of ["$140K", "40%", "6,500"]) {
      const item = items.find((i) => i.str === metric);
      assert.ok(item, `"${metric}" is not its own piece`);
      assert.equal(item.font, bold, `"${metric}" is not bold`);
    }
    for (const plain of ["Project 1", "30-day", "2017", "team of 25"]) {
      const item = items.find((i) => i.str.includes(plain));
      assert.ok(item, `"${plain}" not found`);
      assert.equal(item.font, regular, `"${plain}" should not be bold`);
    }
    const lines = (await extractPdf(await renderPdf(withBullet(true)))).pages.flat().join(" ");
    assert.ok(lines.includes(BULLET), "the bullet text changed");
  });

  test("switch off: nothing extra is bold", async () => {
    const { items, regular } = await fonts(withBullet(false));
    assert.equal(items.find((i) => i.str === "$140K"), undefined, "metrics should stay inside the regular text");
    assert.equal(items.find((i) => i.str.includes("saving $140K"))?.font, regular);
  });
});
