# Security policy

## Supported versions

Only the latest version on `main`, which is what the live app at
https://sanjayspear.github.io/resume-builder/ runs, receives fixes.

## How the app protects your data

Resume Builder has no server and no accounts. Resumes, job descriptions and
ATS-check settings are stored in your browser (`localStorage`), and PDFs, the
ATS check and the spell check all run on your device. The only request to
another site is fetching a company logo from a URL you paste.

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Use GitHub's private vulnerability reporting: go to the repository's
**Security** tab and choose **Report a vulnerability**. If that option isn't
available, contact the maintainer using the details on the
[@sanjayspear](https://github.com/sanjayspear) GitHub profile.

Please include what you found, how to reproduce it, and what an attacker
could do with it. You'll get a reply as soon as possible, and credit in the
fix if you'd like it.
