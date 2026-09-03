/* Serves the built SPA (apps/web/dist) from the same origin as the API, so a
   deploy is one public service and `VITE_ADA_SERVER=/` keeps holding (design
   §static). Hash routing means the only fallback needed is index.html; /api
   and the WS paths are matched before this ever runs. */

import { existsSync, readFileSync, statSync } from "node:fs"
import { extname, join, resolve, sep } from "node:path"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
}

export function hasWebDist(distDir: string): boolean {
  return existsSync(join(distDir, "index.html"))
}

export function serveWebFile(distDir: string, pathname: string): Response {
  let relative: string
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, "")
  } catch {
    relative = ""
  }
  const root = resolve(distDir)
  let file = relative ? resolve(root, relative) : join(root, "index.html")
  // Anything that escapes dist, doesn't exist, or is a directory gets the app
  // shell: the SPA routes on location.hash, so index.html is always right.
  if (!file.startsWith(root + sep) && file !== root) file = join(root, "index.html")
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html")
  const body = readFileSync(file)
  const type = MIME[extname(file)] ?? "application/octet-stream"
  // Vite fingerprints everything under /assets; index.html must revalidate.
  const cache = file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache"
  return new Response(new Uint8Array(body), { headers: { "content-type": type, "cache-control": cache } })
}
