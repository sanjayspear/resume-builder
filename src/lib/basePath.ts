/**
 * The folder the site is served from: "" locally, "/resume-builder" on
 * GitHub Pages. <Link> and router.push add it automatically; plain URLs to
 * files in /public (fonts, the pdf.js worker) must use publicUrl().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** publicUrl("/fonts/x.woff") -> "/resume-builder/fonts/x.woff" on GitHub Pages. */
export const publicUrl = (path: string) => `${BASE_PATH}${path}`;
