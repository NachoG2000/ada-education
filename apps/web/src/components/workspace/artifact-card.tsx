import type { CourseArtifact } from "@ada/protocol"
import { BookOpenIcon } from "lucide-react"
const labels = { guide: "Module guide", explanation: "Explanation", practice: "Practice", assignment: "Assignment" }

export function ArtifactCard({ artifact, onOpen }: { artifact: CourseArtifact; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 rounded-lg border bg-background p-4 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><BookOpenIcon className="mt-0.5 size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="text-xs text-muted-foreground">{labels[artifact.content.kind]} · v{artifact.version}</span><span className="block text-sm font-semibold">{artifact.content.title}</span>{artifact.content.summary ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{artifact.content.summary}</span> : null}</span></button>
}
