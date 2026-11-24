/*
 * Serves the GitHub Pages build (./out, from `npm run build:pages`) the way
 * GitHub Pages does, under the /resume-builder/ base path, so the live site
 * can be tested locally:
 *   npm run build:pages && npm run preview:pages
 *   -> http://localhost:4173/resume-builder/
 * Like GitHub Pages: "/edit" redirects to "/edit/", folders serve their
 * index.html, and unknown paths get the site's 404.html (status 404).
 * Options: --port 4173 (or PORT), PAGES_BASE_PATH=/resume-builder.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const portArg = process.argv.indexOf("--port");
const port = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT ?? 4173);
const base = (process.env.PAGES_BASE_PATH ?? "/resume-builder").replace(/\/$/, "");
const root = path.resolve("out");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json",
};

if (!existsSync(root)) {
  console.error("No ./out folder. Run `npm run build:pages` first.");
  process.exit(1);
}

function send(res, file, status = 200) {
  res.writeHead(status, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/" || url.pathname === base) {
    res.writeHead(301, { location: `${base}/${url.search}` });
    return res.end();
  }
  if (!url.pathname.startsWith(`${base}/`)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end(`Not found. The site is at ${base}/`);
  }
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const file = path.join(root, relative);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(301, { location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    const index = path.join(file, "index.html");
    if (existsSync(index)) return send(res, index);
  } else if (existsSync(file)) {
    return send(res, file);
  }
  const notFound = path.join(root, "404.html");
  if (existsSync(notFound)) return send(res, notFound, 404);
  res.writeHead(404);
  res.end();
}).listen(port, () => console.log(`GitHub Pages build: http://localhost:${port}${base}/`));
