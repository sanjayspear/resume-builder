import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { UseTemplateButton } from "@/components/guide/UseTemplateButton";
import { ResumeThumbnail } from "@/components/ResumeThumbnail";
import { publicUrl } from "@/lib/basePath";
import { LANGUAGE_LEVELS } from "@/lib/languages";
import { TEMPLATES } from "@/lib/templates";
import { ACCENT_PRESETS, FONT_OPTIONS, FONT_SIZE_OPTIONS, LINE_HEIGHT_OPTIONS, LOGO_SIZE_OPTIONS } from "@/lib/theme";

export const metadata: Metadata = {
  title: "User guide · Resume Builder",
  description: "How to create, format, design and download your resume, plus a catalog of templates and features.",
};

const TOC = [
  { id: "catalog", label: "Catalog" },
  { id: "getting-started", label: "Getting started" },
  { id: "filling-in", label: "Filling in your resume" },
  { id: "formatting", label: "Formatting text" },
  { id: "work-experience", label: "Work experience" },
  { id: "design", label: "Design" },
  { id: "preview-download", label: "Preview & download" },
  { id: "managing", label: "Managing resumes" },
  { id: "backup", label: "Backup & moving computers" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "faq", label: "Troubleshooting & FAQ" },
];

const FEATURES = [
  { title: "Live preview", text: "See the real PDF update as you type." },
  { title: "Text-based PDF", text: "Selectable text that job portals (ATS) can read." },
  { title: "4 templates", text: "Coral sidebar, Slate, Ocean and the one-column Minimal." },
  { title: "Rich text", text: "Bold, italic, underline, bullet lists and alignment." },
  { title: "Design controls", text: "Font, text size, line spacing, logo size and colour." },
  { title: "Date order", text: "Jobs sorted latest-first or oldest-first automatically." },
  { title: "Company logos", text: "Upload PNG, JPG or SVG, or paste an image URL." },
  { title: "Skills & languages", text: "Skill groups with 1-10 ratings and language levels." },
  { title: "Many resumes", text: "Keep a version per job; copy, rename, delete." },
  { title: "Auto-save", text: "Every change is saved in this browser as you type." },
  { title: "Backup file", text: "Export and import all resumes as one file." },
  { title: "Validation", text: "Clear messages under any field that needs fixing." },
];

/* ---------- Small building blocks ---------- */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="glass scroll-mt-6 rounded-2xl p-5 sm:p-7">
      <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-indigo-600">{children}</ol>;
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">{children}</ul>;
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">
      <strong className="font-semibold">Tip: </strong>
      {children}
    </p>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-800 shadow-[0_1px_0_#cbd5e1]">
    {children}
  </kbd>
);

/** Shows how a button looks, in the text. */
const Ui = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-slate-900">{children}</strong>;

/* ---------- Page ---------- */

export default function GuidePage() {
  return (
    <div className="app-bg min-h-screen text-slate-900">
      {/* Load the PDF fonts so the catalog can show each one for real. */}
      <style>{FONT_OPTIONS.map((f) => `@font-face{font-family:"guide-${f.value}";src:url("${publicUrl(`/fonts/${f.value}-400-normal.woff`)}") format("woff");font-display:swap}`).join("")}</style>
      <AppHeader active="guide" />

      <div className="mx-auto max-w-[57rem] px-4 pb-12 pt-10 sm:px-6">
        <p className="text-sm font-semibold text-indigo-700">Help</p>
        <h1 className="text-gradient text-3xl font-bold tracking-tight">User guide & catalog</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Everything the Resume Builder can do, and how to go from a blank page to a finished PDF.
        </p>

        <div className="mt-8 gap-8 lg:grid lg:grid-cols-[13rem_1fr]">
          {/* Table of contents: a list on phones, a sticky sidebar on large screens. */}
          <nav aria-label="On this page" className="mb-8 lg:mb-0">
            <div className="glass rounded-2xl p-4 lg:sticky lg:top-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">On this page</p>
              <ol className="space-y-0.5 text-sm">
                {TOC.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="block rounded-lg px-2 py-1 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <main className="min-w-0 space-y-6">
            {/* ---------- Catalog ---------- */}
            <Section id="catalog" title="Catalog">
              <h3 className="pt-1 text-base font-semibold text-slate-900">Templates</h3>
              <p>A template sets the layout and the starting colour. You can switch templates at any time in the editor&apos;s Design panel without losing anything you typed.</p>
              <ul className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-4" aria-label="Templates">
                {TEMPLATES.map((t) => (
                  <li key={t.id} className="flex flex-col">
                    <div className="aspect-[162/178] overflow-hidden rounded-xl bg-gradient-to-b from-indigo-50 via-slate-100 to-violet-50 pt-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
                      <ResumeThumbnail name="Your Name" title="Job title" accent={t.accent} layout={t.layout} accentHeadings />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="mb-2 text-xs text-slate-500">{t.description}</p>
                    <div className="mt-auto">
                      <UseTemplateButton template={t.id} name={t.name} />
                    </div>
                  </li>
                ))}
              </ul>

              <h3 className="pt-3 text-base font-semibold text-slate-900">Fonts</h3>
              <ul className="grid gap-2 sm:grid-cols-2" aria-label="Fonts">
                {FONT_OPTIONS.map((f) => (
                  <li key={f.value} className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3">
                    <span className="block text-xs text-slate-500">{f.label}</span>
                    <span className="block text-lg text-slate-900" style={{ fontFamily: `"guide-${f.value}", serif` }}>
                      The quick brown fox jumps over the lazy dog
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500">
                Georgia and Calibri are Microsoft fonts that can&apos;t be embedded in PDFs made by a web app, so free look-alikes with the same
                letter widths are used (Gelasio and Carlito).
              </p>

              <h3 className="pt-3 text-base font-semibold text-slate-900">Accent colours</h3>
              <ul className="flex flex-wrap gap-3" aria-label="Accent colours">
                {ACCENT_PRESETS.map((c) => (
                  <li key={c.value} className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 py-1 pl-1 pr-3 text-sm">
                    <span aria-hidden className="h-6 w-6 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" style={{ backgroundColor: c.value }} />
                    {c.label}
                  </li>
                ))}
                <li className="flex items-center rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-600">+ any custom colour</li>
              </ul>

              <h3 className="pt-3 text-base font-semibold text-slate-900">Features</h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
                {FEATURES.map((f) => (
                  <li key={f.title} className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3">
                    <span className="block text-sm font-semibold text-slate-900">{f.title}</span>
                    <span className="block text-sm text-slate-600">{f.text}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* ---------- Getting started ---------- */}
            <Section id="getting-started" title="Getting started">
              <p>There are three ways to start, all on the <Link href="/" className="font-semibold text-indigo-700 hover:underline">My resumes</Link> page:</p>
              <Bullets>
                <li><Ui>Create resume</Ui> or the <Ui>New blank resume</Ui> card: an empty resume with the Coral sidebar template.</li>
                <li><Ui>Use</Ui> under a template in <Ui>Start from a template</Ui>: an empty resume with that template.</li>
                <li><Ui>Start from the sample resume</Ui> (shown when you have no resumes yet): a filled-in example to explore.</li>
              </Bullets>
              <p>Each option opens the editor. Fill in the form on the left; the preview on the right updates as you type.</p>
              <Tip>Already have a resume open? <Ui>Load sample data</Ui> in the editor fills it with the example content (your design settings are kept).</Tip>
            </Section>

            {/* ---------- Filling in ---------- */}
            <Section id="filling-in" title="Filling in your resume">
              <p>Fields marked <Ui>*</Ui> are required. If something is missing or invalid, a red message appears under that field once you leave it.</p>
              <Bullets>
                <li><Ui>Personal details</Ui>: full name, job title, location, phone, email and website. Email and website must look like real addresses.</li>
                <li><Ui>Summary</Ui>: a short paragraph at the top of your resume. It supports formatting (see below).</li>
                <li><Ui>Work experience</Ui>: add as many jobs as you like with <Ui>Add work experience</Ui>; each has dates, title, company, an optional logo and a description.</li>
                <li><Ui>Education</Ui>: year, degree and institution.</li>
                <li><Ui>Skill groups</Ui>: a group name (e.g. &quot;Communication/Protocols&quot;), a rating from 1 to 10 shown as a bar, and a list of skills.</li>
                <li>
                  <Ui>Languages</Ui>: each language with a level:{" "}
                  {LANGUAGE_LEVELS.map((l, i) => (
                    <span key={l.value}>
                      {i > 0 ? ", " : ""}
                      {l.label} ({l.bar}/10)
                    </span>
                  ))}
                  . Adding the same language twice shows a warning.
                </li>
                <li><Ui>Sidebar summary</Ui>: an optional short highlight shown at the bottom of the sidebar (or under &quot;Highlights&quot; in the Minimal template).</li>
              </Bullets>
              <p>Every list has <Ui>Add</Ui> and <Ui>Remove</Ui> buttons. <Ui>Clear form</Ui> empties the current resume (after asking you).</p>
            </Section>

            {/* ---------- Formatting ---------- */}
            <Section id="formatting" title="Formatting text">
              <p>The Summary and each job&apos;s Description have a small toolbar:</p>
              <Bullets>
                <li><Ui>B</Ui> bold, <Ui>I</Ui> italic, <Ui>U</Ui> underline: select some text, then click (or use the shortcuts below).</li>
                <li><Ui>Bullet list</Ui>: turns lines into bullets. Press <Kbd>Enter</Kbd> for a new bullet, <Kbd>Enter</Kbd> twice to leave the list, <Kbd>Tab</Kbd> to nest a bullet.</li>
                <li><Ui>Alignment</Ui>: left, centre, right or justified.</li>
              </Bullets>
              <p>Text pasted from Word or a website keeps bold, italic, underline and lists; headings, links and other styling are removed so your PDF stays clean.</p>
            </Section>

            {/* ---------- Work experience ---------- */}
            <Section id="work-experience" title="Work experience: order and logos">
              <h3 className="text-base font-semibold text-slate-900">Order</h3>
              <p>Use <Ui>Order</Ui> at the top of the section: <Ui>Latest to oldest</Ui> (the default) or <Ui>Oldest to latest</Ui>. Jobs marked <Ui>I currently work here</Ui> count as the most recent.</p>
              <Bullets>
                <li>Dates can be written like <em>2023</em>, <em>January 2023</em>, <em>Jan 2023</em>, <em>03/2023</em> or <em>2023-03</em>.</li>
                <li>The preview and PDF are always in order. The cards in the form re-sort when you change the order, open a resume, or finish editing a job and click elsewhere, never while you&apos;re typing in it.</li>
                <li>If an end date is before the start date, the card stays where it is until you fix it.</li>
              </Bullets>
              <h3 className="pt-2 text-base font-semibold text-slate-900">Company logos</h3>
              <Steps>
                <li>In a job, click <Ui>Upload image</Ui> and choose a PNG, JPG or SVG (up to 5&nbsp;MB), or paste an image address and click <Ui>Use URL</Ui>.</li>
                <li>The logo is shrunk to fit 100×100 pixels and saved with the resume.</li>
                <li>Change how big logos appear in <Ui>Design → Logo size</Ui>; <Ui>Remove logo</Ui> takes it off.</li>
              </Steps>
              <Tip>Some websites don&apos;t allow other apps to use their images. If a URL doesn&apos;t work, save the logo to your computer and upload the file instead.</Tip>
            </Section>

            {/* ---------- Design ---------- */}
            <Section id="design" title="Design">
              <p>The <Ui>Design</Ui> panel above the preview changes how the whole PDF looks. Each resume keeps its own design.</p>
              <Bullets>
                <li><Ui>Template</Ui>: the layout. Switching also applies that template&apos;s colour.</li>
                <li><Ui>Font</Ui>: {FONT_OPTIONS.map((f) => f.label.replace(" (default)", "")).join(", ")}.</li>
                <li><Ui>Text size</Ui>: {FONT_SIZE_OPTIONS[0]} to {FONT_SIZE_OPTIONS[FONT_SIZE_OPTIONS.length - 1]} pt. Headings and the name grow with it.</li>
                <li><Ui>Line spacing</Ui>: {LINE_HEIGHT_OPTIONS.map((o) => o.label).join(", ")}.</li>
                <li><Ui>Logo size</Ui>: {LOGO_SIZE_OPTIONS.map((o) => o.label.replace(" (default)", "")).join(", ")}.</li>
                <li><Ui>Accent colour</Ui>: one of the presets or <Ui>Custom</Ui> for any colour. It colours the name, header block and rating bars.</li>
              </Bullets>
            </Section>

            {/* ---------- Preview & download ---------- */}
            <Section id="preview-download" title="Preview & download">
              <Bullets>
                <li>The <Ui>Live preview</Ui> shows every page of the PDF. <Ui>Open full size</Ui> opens it in a new tab.</li>
                <li><Ui>Download PDF</Ui> checks the form first. If anything needs fixing you&apos;ll see how many fields, and each one is highlighted.</li>
                <li>The file is named after you, e.g. <em>Maya-Fernandes-Resume.pdf</em>.</li>
                <li>You can also download straight from a card on <Ui>My resumes</Ui> with the download button.</li>
              </Bullets>
              <p>Long resumes flow onto extra pages automatically. A bullet point is never split across two pages, and a job title always stays with its first line.</p>
            </Section>

            {/* ---------- Managing ---------- */}
            <Section id="managing" title="Managing resumes">
              <p>Everything is saved automatically, so there is no Save button. On <Ui>My resumes</Ui>:</p>
              <Bullets>
                <li><Ui>Search resumes</Ui> by name or job title, and <Ui>Sort</Ui> by last edited, name or date created.</li>
                <li><Ui>Edit</Ui> opens a resume; the download button saves its PDF.</li>
                <li>The <Ui>⋯</Ui> menu: <Ui>Rename</Ui>, <Ui>Create a copy</Ui> (great for tailoring a resume to one job) and <Ui>Delete</Ui>.</li>
                <li>The trash button on a card also deletes it. Deleting always asks first and can&apos;t be undone.</li>
              </Bullets>
            </Section>

            {/* ---------- Backup ---------- */}
            <Section id="backup" title="Backup & moving computers">
              <p>Your resumes are stored <strong>in this browser only</strong>. Clearing your browsing data deletes them, and they don&apos;t appear in other browsers or on other computers.</p>
              <Steps>
                <li>On <Ui>My resumes</Ui>, click <Ui>Export backup</Ui>. A file like <em>resume-backup-2026-11-21.json</em> downloads with all your resumes (including logos and designs).</li>
                <li>Keep that file somewhere safe, such as cloud storage or email.</li>
                <li>On any browser or computer, click <Ui>Import backup</Ui> and choose the file. Imported resumes are <em>added</em>; nothing you already have is replaced.</li>
              </Steps>
            </Section>

            {/* ---------- Shortcuts ---------- */}
            <Section id="shortcuts" title="Keyboard shortcuts">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Keys</th>
                      <th className="py-2 font-semibold">What it does</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    <tr><td className="py-2 pr-4"><Kbd>Ctrl/⌘</Kbd> + <Kbd>B</Kbd> / <Kbd>I</Kbd> / <Kbd>U</Kbd></td><td className="py-2">Bold / italic / underline (in Summary and Description)</td></tr>
                    <tr><td className="py-2 pr-4"><Kbd>Enter</Kbd> twice</td><td className="py-2">Leave a bullet list</td></tr>
                    <tr><td className="py-2 pr-4"><Kbd>Tab</Kbd> / <Kbd>Shift</Kbd> + <Kbd>Tab</Kbd></td><td className="py-2">Nest / un-nest a bullet</td></tr>
                    <tr><td className="py-2 pr-4"><Kbd>Ctrl/⌘</Kbd> + <Kbd>Z</Kbd></td><td className="py-2">Undo typing in a formatted field</td></tr>
                    <tr><td className="py-2 pr-4"><Kbd>Esc</Kbd></td><td className="py-2">Close a menu or window</td></tr>
                    <tr><td className="py-2 pr-4"><Kbd>↑</Kbd> <Kbd>↓</Kbd></td><td className="py-2">Move between items in the ⋯ menu</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ---------- FAQ ---------- */}
            <Section id="faq" title="Troubleshooting & FAQ">
              <dl className="space-y-4">
                <div>
                  <dt className="font-semibold text-slate-900">Download PDF doesn&apos;t download a file.</dt>
                  <dd>Some fields need fixing. Read the red message at the top of the form (&quot;Please fix the … highlighted fields&quot;) and correct each highlighted field.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">My resumes disappeared.</dt>
                  <dd>They are kept in this browser only. If browsing data was cleared, import your latest backup file. A different browser or computer won&apos;t have them unless you import a backup there.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Will job portals be able to read my PDF?</dt>
                  <dd>Yes. All templates produce real text, not images. For the most scanner-friendly result, use the Minimal template.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Some characters are missing in the PDF.</dt>
                  <dd>The bundled fonts cover Latin-alphabet languages. Other alphabets (for example Kannada or Hindi script) aren&apos;t supported in the PDF yet; you can still write language <em>names</em> in English.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">A logo from a web address won&apos;t load.</dt>
                  <dd>That website blocks other apps from using its images. Download the logo and upload the file instead.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Is my data sent anywhere?</dt>
                  <dd>No. Resumes are stored and PDFs are created inside your browser. The only time the app contacts another website is when you paste a logo URL, to fetch that image. See <Link href="/about" className="font-semibold text-indigo-700 hover:underline">About</Link>.</dd>
                </div>
              </dl>
            </Section>
          </main>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
