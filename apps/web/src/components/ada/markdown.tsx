/* Minimal markdown renderer for card bodies: ## headings, paragraphs, numbered lists, **bold**, *italic*, `code`. */

import { Fragment, type ReactNode } from "react"

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith("`"))
      out.push(
        <code key={k++} className="rounded-control bg-panel-3 px-1 py-px font-mono text-[13px] break-words text-ink-2">
          {tok.slice(1, -1)}
        </code>,
      )
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>)
  return out
}

type Block = { kind: "h2"; text: string } | { kind: "ol"; items: string[] } | { kind: "p"; text: string }

function parse(source: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") })
    if (list.length) blocks.push({ kind: "ol", items: list })
    para = []
    list = []
  }
  for (const raw of source.split("\n")) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (line.startsWith("## ")) {
      flush()
      blocks.push({ kind: "h2", text: line.slice(3) })
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      if (para.length) flush()
      list.push(line.replace(/^\d+\.\s/, ""))
      continue
    }
    if (list.length) flush()
    para.push(line)
  }
  flush()
  return blocks
}

/** `headingLevel` is where the body's `##` lands in the page outline: a card
    opened in the panel already has its title as the heading above, so the body
    starts one level below it instead of repeating that level. */
export function Markdown({ source, headingLevel = 2 }: { source: string; headingLevel?: 2 | 3 | 4 }) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4"
  return (
    <div className="font-serif text-[15.5px] leading-[1.6] break-words text-ink [&_strong]:font-semibold">
      {parse(source).map((b, i) => {
        if (b.kind === "h2")
          return (
            <Heading key={i} className="mt-5 mb-1.5 font-serif text-[17px] leading-tight font-semibold first:mt-0">
              {b.text}
            </Heading>
          )
        if (b.kind === "ol")
          return (
            <ol key={i} className="mb-2.5 list-decimal pl-6 marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={j} className="mb-1 pl-1">
                  {inline(it)}
                </li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="mb-2.5">
            {inline(b.text)}
          </p>
        )
      })}
    </div>
  )
}
