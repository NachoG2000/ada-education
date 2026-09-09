import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function ArtifactMarkdown({ body }: { body: string }) {
  return <div className="artifact-prose"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ children, href }) => <a href={href} target={href?.startsWith("/") && !href.startsWith("//") ? undefined : "_blank"} rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span className="text-muted-foreground">{alt ? `[Image: ${alt}]` : "[Image]"}</span>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
  }}>{body}</Markdown></div>
}
