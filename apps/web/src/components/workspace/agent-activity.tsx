import type { Agent } from "@ada/protocol"
import { LoaderCircleIcon } from "lucide-react"
import { WorkspaceAvatar } from "./workspace-avatar"
import { PromptInputHeader } from "@/components/ai-elements/prompt-input"

/** In normal flow inside PromptInput, so activity expands the composer card. */
export function ComposerAgentActivity({ agents }: { agents: Agent[] }) {
  if (!agents.some((agent) => agent.presence === "thinking" || agent.presence === "publishing")) return null
  return <PromptInputHeader className="border-b px-3 py-2"><AgentActivity agents={agents} /></PromptInputHeader>
}

/** Presence is agent-wide: this is live availability, not a per-message progress meter. */
export function AgentActivity({ agents }: { agents: Agent[] }) {
  const working = agents.filter((agent) => agent.presence === "thinking" || agent.presence === "publishing")
  return <div role="status" aria-live="polite" aria-atomic="true" className="w-full min-w-0">
    {working.length ? <div className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground" title="Live status of agents in this conversation. Agents may also be working in other conversations.">
      <span className="flex shrink-0 -space-x-1" aria-hidden="true">{working.slice(0, 3).map((agent) => <WorkspaceAvatar key={agent.id} member={agent} size={20} className="ring-2 ring-background" />)}</span>
      <LoaderCircleIcon aria-hidden="true" className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
      <span className="min-w-0 break-words whitespace-normal">{working.length === 1 ? `${working[0].name} is ${working[0].presence === "publishing" ? "saving knowledge" : "working"}…` : `${working.length} agents working…`}</span>
    </div> : null}
  </div>
}
