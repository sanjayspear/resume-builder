import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party pdf.js worker, copied in by "postinstall" (minified, not our code).
    "public/pdf.worker.min.mjs",
    // Local npm cache folder (see .npmrc); never part of the project.
    ".npm-cache/**",
  ]),
]);

export default eslintConfig;
