import { extname } from "node:path"
import { fileURLToPath } from "node:url"
import { WorkspaceError } from "./workspace-errors.js"

/** Extract text without executing document scripts; original bytes are stored separately. */
export async function extractMemoryText(filename: string, bytes: Uint8Array): Promise<{ text: string; mediaType: string }> {
  if (bytes.byteLength > 10 * 1024 * 1024) throw new WorkspaceError("invalid_input", "Sources must be 10 MB or smaller")
  const extension = extname(filename).toLowerCase()
  if ([".md", ".markdown", ".txt"].includes(extension)) {
    let text: string
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch { throw new WorkspaceError("invalid_input", "Text sources must use UTF-8") }
    if (text.includes("\0")) throw new WorkspaceError("invalid_input", "This file is not a text document")
    return { text, mediaType: extension === ".txt" ? "text/plain" : "text/markdown" }
  }
  if (extension !== ".pdf") throw new WorkspaceError("invalid_input", "Supported study sources: PDF, Markdown and UTF-8 text")
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const pdfAssets = new URL("./", import.meta.resolve("pdfjs-dist/package.json"))
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true,
    standardFontDataUrl: fileURLToPath(new URL("standard_fonts/", pdfAssets)),
    cMapUrl: fileURLToPath(new URL("cmaps/", pdfAssets)), cMapPacked: true,
  })
  try {
    const document = await loading.promise
    if (document.numPages > 100) throw new WorkspaceError("invalid_input", "Split PDFs longer than 100 pages into smaller study sources")
    let text = ""
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      text += `\n\nPage ${number}\n${content.items.map((item) => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("")}`
      page.cleanup()
      if (text.length > 120000) throw new WorkspaceError("invalid_input", "Split this PDF into sources with fewer than 120,000 extracted characters")
    }
    if (!text.replace(/Page \d+/g, "").trim()) throw new WorkspaceError("invalid_input", "This PDF has no extractable text. Upload a text version; OCR is not available.")
    return { text: text.trim(), mediaType: "application/pdf" }
  } catch (error) {
    if (error instanceof WorkspaceError) throw error
    throw new WorkspaceError("invalid_input", "The PDF could not be read. Use an unlocked PDF with selectable text.")
  } finally { await loading.destroy() }
}
