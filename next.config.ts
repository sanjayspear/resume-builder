import type { NextConfig } from "next";

/*
 * Normal `npm run dev` / `npm run build`: a regular Next.js app at "/".
 *
 * `npm run build:pages` (and the GitHub Actions workflow) sets:
 *   STATIC_EXPORT=1          -> plain HTML/CSS/JS files in ./out (GitHub Pages can't run a server)
 *   PAGES_BASE_PATH=/<repo>  -> the site lives at https://<user>.github.io/<repo>/
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = isStaticExport ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  // These enable server-side features (partial prerendering) that a static
  // export can't use, so they're only on for the normal server build.
  cacheComponents: !isStaticExport,
  partialPrefetching: !isStaticExport,
  ...(isStaticExport
    ? {
        output: "export",
        // /guide -> guide/index.html, which every static host serves correctly.
        trailingSlash: true,
        basePath,
      }
    : {}),
  // Lets browser code build URLs for files in /public (fonts, pdf.js worker).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
