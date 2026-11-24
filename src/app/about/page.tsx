import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import pkg from "../../../package.json";

export const metadata: Metadata = {
  title: "About · Resume Builder",
  description: "What the Resume Builder does, how your data is handled, and the open-source software it uses.",
};

// Licences checked against each package's published metadata.
const LIBRARIES = [
  { name: "Next.js", use: "App framework", licence: "MIT" },
  { name: "React", use: "User interface", licence: "MIT" },
  { name: "@react-pdf/renderer", use: "Creates the PDF in your browser", licence: "MIT" },
  { name: "pdf.js (pdfjs-dist)", use: "Draws the live preview", licence: "Apache-2.0" },
  { name: "Tiptap", use: "Formatted-text editor", licence: "MIT" },
  { name: "React Hook Form", use: "Form handling", licence: "MIT" },
  { name: "Zod", use: "Validation rules", licence: "MIT" },
  { name: "Tailwind CSS", use: "Styling", licence: "MIT" },
];

const FONTS = ["Source Sans 3", "Inter", "Roboto", "Gelasio", "Carlito", "Montserrat (Modern ATS headings)"];

function Card({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-title`} className="glass scroll-mt-6 rounded-2xl p-5 sm:p-7">
      <h2 id={`${id ?? title}-title`} className="text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="app-bg min-h-screen text-slate-900">
      <AppHeader active="about" />

      <main className="mx-auto max-w-[57rem] space-y-6 px-4 pb-12 pt-10 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-indigo-700">About</p>
          <h1 className="text-gradient text-3xl font-bold tracking-tight">Resume Builder</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Build a clean, professional resume in your browser and download it as a PDF that people and job portals can read.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/" className="btn-primary inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold">
              Go to my resumes
            </Link>
            <Link href="/guide" className="btn-light inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold">
              Read the user guide
            </Link>
          </div>
        </div>

        <Card title="What it does">
          <ul className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">
            <li>Fill in a guided form and watch the PDF update live.</li>
            <li>Choose from four templates and fine-tune font, size, spacing and colour.</li>
            <li>Format text, add company logos, skills with ratings and spoken languages.</li>
            <li>Keep several versions of your resume and download any of them in one click.</li>
          </ul>
          <p>
            New here? The <Link href="/guide" className="font-semibold text-indigo-700 hover:underline">user guide</Link> walks through
            every step and lists all templates and features.
          </p>
        </Card>

        <Card title="Your privacy" id="privacy">
          <ul className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">
            <li><strong>No account and no server.</strong> Your resumes are saved only in this browser&apos;s local storage.</li>
            <li><strong>PDFs are created on your device.</strong> Your resume text is never uploaded anywhere.</li>
            <li>
              <strong>One exception:</strong> if you paste a logo&apos;s web address, the app downloads that image from the website you
              entered. Uploading a logo file doesn&apos;t contact any website.
            </li>
            <li>
              Because everything stays in this browser, clearing browsing data deletes your resumes. Use{" "}
              <Link href="/#backup" className="font-semibold text-indigo-700 hover:underline">Export backup</Link> to keep a copy.
            </li>
          </ul>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Version">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-slate-500">App version</dt>
              <dd className="font-medium text-slate-900" data-testid="app-version">{pkg.version}</dd>
              <dt className="text-slate-500">PDF page size</dt>
              <dd className="font-medium text-slate-900">A4</dd>
              <dt className="text-slate-500">Templates</dt>
              <dd className="font-medium text-slate-900">Classic Sidebar, Modern ATS</dd>
              <dt className="text-slate-500">Licence</dt>
              <dd className="font-medium text-slate-900">
                Free for individuals and small businesses (
                <a
                  href="https://github.com/sanjayspear/resume-builder/blob/main/LICENSE"
                  className="text-indigo-700 underline-offset-2 hover:underline"
                >
                  PolyForm Small Business
                </a>
                ). Larger companies need a commercial licence. For questions or commercial licensing,{" "}
                <a
                  href="https://github.com/sanjayspear/resume-builder/issues"
                  className="text-indigo-700 underline-offset-2 hover:underline"
                >
                  open an issue on GitHub
                </a>{" "}
                or contact me via{" "}
                <a href="https://github.com/sanjayspear" className="text-indigo-700 underline-offset-2 hover:underline">
                  github.com/sanjayspear
                </a>
                .
              </dd>
            </dl>
          </Card>

          <Card title="Fonts">
            <p className="text-sm">
              {FONTS.join(", ")}. All are free fonts under the SIL Open Font License 1.1 and are embedded in your PDF. Gelasio and Carlito
              are look-alikes for Georgia and Calibri, which can&apos;t be embedded.
            </p>
          </Card>
        </div>

        <Card title="Built with open-source software">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Library</th>
                  <th className="py-2 pr-4 font-semibold">Used for</th>
                  <th className="py-2 font-semibold">Licence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {LIBRARIES.map((lib) => (
                  <tr key={lib.name}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{lib.name}</td>
                    <td className="py-2 pr-4">{lib.use}</td>
                    <td className="py-2">{lib.licence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
