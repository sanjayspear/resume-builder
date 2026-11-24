# Contributing

Thanks for your interest in improving Resume Builder!

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

## Ground rules

- Resume data must stay on the user's device. Don't add tracking, analytics or uploads. This includes the ATS check: job descriptions, keyword matching and spell checking all run in the browser, and assets (fonts, dictionaries) are served by the app itself.
- Keep the PDF text-based (no images of text), so job portals can read it.
- New fonts must allow embedding (for example the SIL Open Font License).
- To tune the ATS check (skills, synonyms, filler words, extra spelling words), edit the JSON files in `src/data/ats/` and add a test.
- By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
