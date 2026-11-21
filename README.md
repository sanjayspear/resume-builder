# Resume Builder

Build a clean, professional resume in your browser and download it as a **text-based PDF** that people and job portals (ATS) can read. No account, no server: your resumes stay on your device.

**Live app:** https://sanjayspear.github.io/resume-builder/

![My resumes page](docs/screenshots/home.png)

![Editor with live PDF preview](docs/screenshots/editor.png)

## Features

- **Live preview**: every page of the PDF updates as you type.
- **4 templates**: Coral sidebar, Slate, Ocean (two columns) and Minimal (one column, ATS-first).
- **Rich text** in the Summary and job descriptions: bold, italic, underline, bullet lists, alignment.
- **Design controls**: font (Source Sans 3, Inter, Roboto, Gelasio, Carlito), text size, line spacing, logo size and accent colour.
- **Work experience** sorted latest-first or oldest-first, with optional **company logos** (PNG/JPG/SVG or image URL).
- **Skill groups** with 1-10 rating bars, and **languages** with proficiency levels.
- **Many resumes**: search, sort, copy, rename, delete; everything auto-saves.
- **Backup file**: export all resumes to one file and import it on any browser or computer.
- Clear validation messages, keyboard-friendly menus and dialogs, and a built-in **user guide** (`/guide`).

## Privacy

Resumes are stored in the browser's `localStorage` and PDFs are created on your device; resume content is never uploaded. The only network request to another site happens when you paste a logo *URL*, to fetch that image. Clearing browsing data deletes your resumes, so use **Export backup** to keep a copy.

## Run it locally

Requires [Node.js](https://nodejs.org/) 20.9 or newer.

```bash
git clone https://github.com/sanjayspear/resume-builder.git
cd resume-builder
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (also copies the pdf.js worker into `public/`) |
| `npm run dev` | Development server at http://localhost:3000, reloads on save |
| `npm run build` | Production build (also type-checks the project) |
| `npm run build:pages` | Static build for GitHub Pages into `out/` (served from `/resume-builder/`) |
| `npm run lint` | Check the code with ESLint |
| `npm run pdf:sample -- out.pdf [long\|styled\|features\|minimal]` | Render the sample resume straight to a PDF file, no browser needed |

## Deployment

Every push to `main` builds a static version of the app and publishes it to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). One-time setup in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The static build (`STATIC_EXPORT=1`) works because everything happens in the browser. Files in `public/` (fonts, the pdf.js worker) are referenced through `publicUrl()` in `src/lib/basePath.ts` so they also work under the `/resume-builder/` sub-path.

## Project structure

```
src/
  app/                    Pages: / (my resumes), /edit?id=…, /guide, /about
  components/
    home/                 My resumes page: cards, ⋯ menu, rename window
    editor/               Editor page: toolbar, auto-save, download
    form/                 Form sections, rich-text editor, logo upload
    LivePanel.tsx         Design panel + live PDF preview
    AppHeader.tsx         Top bar shared by all pages
  lib/
    schema.ts             Data shape + all validation rules (Zod)
    library.ts            Saved resumes: create, rename, copy, delete, backup, upgrades of old data
    libraryStore.ts       Shared, always-current view of saved resumes
    richText.ts           Formatted-text format + cleaning of pasted content
    experienceSort.ts     Date parsing and job ordering
    theme.ts, templates.ts  Design options and templates
  pdf/
    ResumeDocument.tsx    The PDF layouts (two-column and Minimal)
public/fonts/             Fonts embedded in the PDF (SIL Open Font License 1.1)
scripts/render-sample.mts Render the sample resume to a PDF from the command line
```

## Built with

[Next.js](https://nextjs.org/), [React](https://react.dev/), [@react-pdf/renderer](https://react-pdf.org/), [pdf.js](https://mozilla.github.io/pdf.js/), [Tiptap](https://tiptap.dev/), [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/) and [Tailwind CSS](https://tailwindcss.com/).

Fonts: Source Sans 3, Inter, Roboto, Gelasio and Carlito, all under the SIL Open Font License 1.1. Gelasio and Carlito are metric-compatible alternatives to Georgia and Calibri, which can't be embedded.

## Troubleshooting

- **A CSS change (e.g. in `src/app/globals.css`) doesn't show up while `npm run dev` is running:** stop the dev server (`Ctrl + C`) and start it again. With this project's Tailwind setup the dev server sometimes keeps serving the old stylesheet; production builds are not affected.
- **Some characters are missing in the PDF:** the bundled fonts cover Latin-alphabet languages only.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Sanjay Y M
