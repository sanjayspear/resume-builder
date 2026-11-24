/*
 * Sample data safety: the repository is public, so sample and test data
 * must never belong to a real person or company. Run with: npm test
 *
 * - Everywhere in the repo (tracked files and new, non-ignored ones):
 *   no personal email address (gmail.com, outlook.com, yahoo.com, hotmail.com).
 * - Sample data, tests, e2e tests and the README:
 *   - phones only in the 555-0100 to 555-0199 range reserved for fiction,
 *     or masked with X ("+91 98XXX XXXXX");
 *   - emails only at example.com / example.org / example.net;
 *   - LinkedIn only as an obvious placeholder (linkedin.com/in/your-profile).
 * - Sample data and test fixtures: no street address (city and region only).
 *
 * A test input that is deliberately one of these (e.g. an address for the
 * "Full home address" tip) carries the comment `privacy-scan: allow` on its
 * line. The personal-email rule has no such exception.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { contentTips } from "@/lib/ats/tips";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import { qaResume } from "./fixtures/qaResume";

/* ---------- The rules (pure functions, tested below) ---------- */

// Written without "@" so this file never matches its own rule.
const PERSONAL_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com"];
const EXAMPLE_EMAIL_DOMAINS = ["example.com", "example.org", "example.net"];
const PLACEHOLDER_LINKEDIN_PATHS = ["your-profile", "your-name"];
const ALLOW_MARKER = "privacy-scan: allow";

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
/** Phone-shaped: optional +country code, then 2-5, 3-5 and 4-5 digits (X = hidden digit). */
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{2,5}\)?[\s.-]?[\dX]{3,5}[\s.-]?[\dX]{4,5}\b/g;
const LINKEDIN = /linkedin\.com\/in\/([^\s"'`)\]/]+)/gi;
/** A house number followed by a street name: "12 Example Road", "221B Example Street". */
const STREET =
  /\b\d+[A-Za-z]?,?\s+(?:[A-Z][\w.'-]*\s+){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Dr|Way|Court|Ct|Place|Pl|Terrace|Close|Cross|Main|Nagar|Layout)\b\.?/g;

/** True for a phone number that's safe in public sample data. */
function isSafePhone(phone: string): boolean {
  if ((phone.match(/X/gi) ?? []).length >= 4) return true; // masked ("+91 98XXX XXXXX")
  if (/X/i.test(phone)) return isSafePhone(phone.replace(/X/gi, "0")); // partly masked: still in 555-01XX ("512-555-01XX")
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  // US numbers: 555-0100 to 555-0199, with or without an area code.
  return (national.length === 7 || national.length === 10) && /55501\d\d$/.test(national);
}

type Finding = { line: number; rule: string; text: string };

/** Personal email addresses (gmail.com etc.) in a file's text. No exceptions. */
function personalEmails(source: string): Finding[] {
  return source.split("\n").flatMap((lineText, i) =>
    [...lineText.matchAll(EMAIL)]
      .filter((m) => PERSONAL_EMAIL_DOMAINS.includes(m[1].toLowerCase()))
      .map((m) => ({ line: i + 1, rule: "personal email", text: m[0] })),
  );
}

/** Phones, emails and LinkedIn links that could belong to a real person. */
function unsafeContacts(source: string): Finding[] {
  return source.split("\n").flatMap((lineText, i) => {
    if (lineText.includes(ALLOW_MARKER)) return [];
    const line = i + 1;
    return [
      ...[...lineText.matchAll(PHONE)]
        .filter((m) => !isSafePhone(m[0]))
        .map((m) => ({ line, rule: "phone outside 555-01XX (and not masked with X)", text: m[0] })),
      ...[...lineText.matchAll(EMAIL)]
        .filter((m) => !EXAMPLE_EMAIL_DOMAINS.includes(m[1].toLowerCase()))
        .map((m) => ({ line, rule: "email not at example.com/org/net", text: m[0] })),
      ...[...lineText.matchAll(LINKEDIN)]
        .filter((m) => !PLACEHOLDER_LINKEDIN_PATHS.includes(m[1].toLowerCase()))
        .map((m) => ({ line, rule: "LinkedIn link that isn't a placeholder", text: m[0] })),
    ];
  });
}

/** Street addresses (a house number and street name). */
function streetAddresses(source: string): Finding[] {
  return source.split("\n").flatMap((lineText, i) =>
    lineText.includes(ALLOW_MARKER)
      ? []
      : [...lineText.matchAll(STREET)].map((m) => ({ line: i + 1, rule: "street address", text: m[0] })),
  );
}

/* ---------- The files ---------- */

const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|zip|gz)$/i;
const SELF = "tests/sample-data-safety.test.ts";

/** Every file in the repo or about to be added (tracked, plus new files that aren't ignored). */
const repoFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !BINARY.test(f));
const read = (file: string) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return ""; // deleted but not yet staged
  }
};

const SAMPLE_FILES = ["src/lib/sampleData.ts", ...repoFiles.filter((f) => f.startsWith("tests/fixtures/"))];
const TEST_AND_DOC_FILES = [
  ...SAMPLE_FILES,
  ...repoFiles.filter((f) => /^(tests|e2e)\//.test(f) && !f.startsWith("tests/fixtures/") && f !== SELF),
  "README.md",
];

const report = (file: string, findings: Finding[]) =>
  findings.map((f) => `${file}:${f.line} ${f.rule}: ${f.text}`).join("\n");

/* ---------- Tests ---------- */

describe("the rules catch what they should", () => {
  test("phones: 555-0100 to 555-0199 and masked numbers are safe; anything else isn't", () => {
    for (const ok of ["512-555-0147", "512-555-01XX", "(512) 555 0147", "555-0100", "+1 512 555 0199", "+91 98XXX XXXXX", "+44 7700 XXXXXX"]) {
      assert.ok(isSafePhone(ok), ok);
    }
    for (const bad of ["+91 01234 56789", "012-867-53XX", "512-555-0200", "012-555-1234", "(012) 345 6789", "0123456789"]) {
      assert.ok(!isSafePhone(bad), bad);
    }
  });

  test("contacts: real-looking phones, emails and LinkedIn links are reported", () => {
    const at = "@";
    const source = [
      `phone: "+91 01234 56789",`,
      `email: "jane${at}mail.test",`,
      `linkedin: "linkedin.com/in/real_person.example",`,
      `ok: "512-555-0147 maya${at}example.com linkedin.com/in/your-profile +91 98XXX XXXXX",`,
      `allowed: "0123456789", // ${ALLOW_MARKER}: a line of digits, not a phone`,
    ].join("\n");
    assert.deepEqual(
      unsafeContacts(source).map((f) => [f.line, f.text]),
      [
        [1, "+91 01234 56789"],
        [2, `jane${at}mail.test`],
        [3, "linkedin.com/in/real_person.example"],
      ],
    );
  });

  test("personal email domains are reported, even with the allow marker", () => {
    const address = (domain: string) => `someone${"@"}${domain}`;
    for (const domain of PERSONAL_EMAIL_DOMAINS) {
      assert.equal(personalEmails(`Contact: ${address(domain.toUpperCase())} // ${ALLOW_MARKER}`).length, 1, domain);
    }
    assert.deepEqual(personalEmails(`Contact: ${address("example.com")}`), []);
  });

  test("street addresses are reported; cities and job text aren't", () => {
    assert.equal(streetAddresses(`location: "12 Example Road, Exampleton"`).length, 1);
    assert.equal(streetAddresses(`location: "221B Example Street, Exampleton"`).length, 1);
    assert.deepEqual(streetAddresses(`location: "Austin, TX" "Pune, India" "a 40,000 sq ft warehouse" "3 Main shifts"`), []);
  });
});

describe("the repository is safe", () => {
  test("no personal email address (gmail.com, outlook.com, yahoo.com, hotmail.com) anywhere", () => {
    const problems = repoFiles.map((file) => report(file, personalEmails(read(file)))).filter(Boolean);
    assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
  });

  test("sample data, tests and README: only fictional phones, example emails and placeholder LinkedIn links", () => {
    assert.ok(SAMPLE_FILES.length >= 2, "the sample data and fixtures were found");
    const problems = TEST_AND_DOC_FILES.map((file) => report(file, unsafeContacts(read(file)))).filter(Boolean);
    assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
  });

  test("sample data and fixtures: no street addresses", () => {
    const problems = SAMPLE_FILES.map((file) => report(file, streetAddresses(read(file)))).filter(Boolean);
    assert.deepEqual(problems, [], `\n${problems.join("\n")}`);
  });

  for (const [name, data] of [
    ["sample resume", sampleResume],
    ["QA fixture", qaResume()],
  ] as [string, ResumeData][]) {
    test(`${name}: contact details are fictional and no location is a full address`, () => {
      const p = data.personal;
      assert.ok(p.phone === "" || isSafePhone(p.phone), p.phone);
      assert.ok(EXAMPLE_EMAIL_DOMAINS.includes(p.email.split("@")[1] ?? ""), p.email);
      const slug = p.linkedin.match(/linkedin\.com\/in\/([^/\s]+)/i)?.[1];
      assert.ok(p.linkedin === "" || PLACEHOLDER_LINKEDIN_PATHS.includes(slug ?? ""), p.linkedin);
      // The app's own "Full home address" tip agrees: city and region only.
      assert.ok(!contentTips(data).some((t) => t.title === "Full home address"), "no full home address");
    });
  }
});
