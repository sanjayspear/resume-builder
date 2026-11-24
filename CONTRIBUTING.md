# Contributing

Thanks for your interest in improving Resume Builder!

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, please follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Reporting a bug or suggesting a feature

Open an issue and include:

- what you did, what you expected, and what happened instead;
- your browser and operating system;
- a backup file (**Export backup**) or a screenshot if it helps, with any personal details removed.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Install and run the app:
   ```bash
   npm install
   npm run dev
   ```
3. Make your change. Keep the existing style: small components, comments that explain *why*, and validation rules in `src/lib/schema.ts`.
4. Before opening a pull request, make sure these pass:
   ```bash
   npm run lint
   npm test              # renders PDFs and checks their extracted text
   npm run test:e2e      # browser tests (first time: npx playwright install chromium)
   npm run build
   npm run build:pages   # the static version published to GitHub Pages
   npm run test:e2e:pages   # browser tests against that static version
   ```
5. If you changed the PDF layout, render a sample and look at it:
   ```bash
   npm run pdf:sample -- sample.pdf long   # also try: styled, features, ats, ats-long
   ```
6. Open a pull request describing what changed and why. Screenshots help for UI changes.

## Sample and test data

The repository is public, so example details must never belong to a real person or company. This applies to the sample resume, test fixtures, tests and docs:

- **Phones:** US numbers only in the range reserved for fiction, 555-0100 to 555-0199 (e.g. `512-555-0147`). Mask any other number with X (e.g. `+91 98XXX XXXXX`).
- **Emails:** only `example.com`, `example.org` or `example.net`. Never a personal address (gmail.com, outlook.com and so on).
- **LinkedIn:** only obvious placeholders, `linkedin.com/in/your-profile` or `linkedin.com/in/your-name`.
- **Companies:** clearly fictional names (e.g. Quillmere Logistics, or well-known fictional ones like Contoso). Search the name first to make sure no real business uses it.
- **Addresses:** city and region only, never a street, house number or postcode.

`tests/sample-data-safety.test.ts` (part of `npm test`) enforces these rules. It checks phones, emails and LinkedIn links in the sample resume, all tests and the README, and street addresses in the sample resume and `tests/fixtures/`. If a line needs a value that breaks a rule on purpose, add the comment `privacy-scan: allow` on that line with a short reason. For example, `"0123456789"` in a font test looks like a phone number. The ban on personal email addresses applies to every file in the repository and has no exception.

## Ground rules

- Resume data must stay on the user's device. Don't add tracking, analytics or uploads. This includes the ATS check: job descriptions, keyword matching and spell checking all run in the browser, and assets (fonts, dictionaries) are served by the app itself.
- Keep the PDF text-based (no images of text), so job portals can read it.
- New fonts must allow embedding (for example the SIL Open Font License).
- To tune the ATS check (skills, synonyms, filler words, extra spelling words), edit the JSON files in `src/data/ats/` and add a test.
- By contributing, you agree that your contribution is licensed under this project's licence (the [PolyForm Small Business License 1.0.0](LICENSE)), and that Sanjay Y M may also license it to others under commercial licence terms. This lets larger companies get a commercial licence for the whole app.
