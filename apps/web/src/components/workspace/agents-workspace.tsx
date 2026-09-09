import { useEffect, useRef, useState } from "react"
import type { Agent } from "@ada/protocol"
import { MessageSquareIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { useAppNavigation, type AppRoute } from "@/lib/routes"
import { useAuxiliaryPreferences } from "@/lib/preferences"
import { useCommunity } from "@/lib/community"
import { toast } from "@/components/ui/toast"
import { useHostedWorkspace } from "./hosted-context"
import { AgentsPage } from "./pages"
import { ActionSection } from "./page-layout"
import { useClock } from "./use-clock"

export function AgentsWorkspace({
  route,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
}: {
  route: Extract<AppRoute, { kind: "agents" }>
  onCreateAgent: () => void
  onEditAgent: (agentId: string) => void
  onDeleteAgent: (agentId: string) => void
}) {
  const { community } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const auxiliary = useAuxiliaryPreferences()
  const container = useRef<HTMLDivElement>(null)
  const narrow = useNarrowAuxiliary(container)
  const selected = route.agentId ? community.members.find((member): member is Agent => member.kind === "agent" && member.id === route.agentId) : undefined
  useEffect(() => {
    if (route.agentId && !selected) void navigateTo({ kind: "agents" }, { replace: true })
  }, [navigateTo, route.agentId, selected])
  const list = <AgentsPage onCreateAgent={onCreateAgent} onSelectAgent={(agentId) => void navigateTo({ kind: "agents", agentId })} />
  const panel = selected ? <AgentDetailsPanel agent={selected} onClose={() => void navigateTo({ kind: "agents" })} onEdit={() => onEditAgent(selected.id)} onDelete={() => onDeleteAgent(selected.id)} /> : null

  if (!panel) return <div ref={container} className="size-full min-w-0">{list}</div>
  if (narrow) return <div ref={container} className="relative size-full">{list}<div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l bg-background">{panel}</div></div>
  return (
    <div ref={container} className="size-full min-w-0"><ResizablePanelGroup orientation="horizontal" className="size-full min-h-0">
      <ResizablePanel id="agents-list" minSize={480}>{list}</ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="agent-detail" defaultSize={auxiliary.width} minSize={320} maxSize={720} groupResizeBehavior="preserve-pixel-size" onResize={(size) => { if (size.inPixels >= 320) auxiliary.setWidth(size.inPixels) }}>{panel}</ResizablePanel>
    </ResizablePanelGroup></div>
  )
}

function AgentDetailsPanel({ agent, onClose, onEdit, onDelete }: { agent: Agent; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const { community, me, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const teacher = me.kind === "person" && me.role === "teacher"
  const [tab, setTab] = useState<"about" | "danger">("about")
  const [addOpen, setAddOpen] = useState(false)
  const now = useClock()
  const channels = community.channels.filter((channel) => channel.kind !== "dm" && channel.status === "active")
  const status = agent.status === "inactive" ? "Deleted" : agent.presence !== "away" ? agent.presence[0].toUpperCase() + agent.presence.slice(1) : agent.createdAt && now - new Date(agent.createdAt).getTime() < 15_000 ? "Starting…" : "Offline"

  const message = async () => {
    const channelId = await hosted.createAgentDm(agent.id)
    await navigateTo({ kind: "channel", channelId })
  }

  return (
    <aside className="flex size-full flex-col bg-background" aria-label={`${agent.name} details`}>
      <header className="flex min-h-14 items-center gap-3 border-b px-4"><MemberAvatar member={agent} size={36} presence /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{agent.name}</h2><p className="truncate text-xs text-muted-foreground">{agent.systemRole === "ada" ? "Primary course agent" : "Classroom agent"}</p></div><Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close agent details"><XIcon /></Button></header>
      <div className="flex h-10 items-end gap-4 border-b px-4" role="tablist" aria-label="Agent sections">
        <PanelTab active={tab === "about"} onClick={() => setTab("about")}>About</PanelTab>
        {teacher && agent.systemRole !== "ada" ? <PanelTab active={tab === "danger"} onClick={() => setTab("danger")}>Danger</PanelTab> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "about" ? <div className="space-y-5"><div className="flex items-center justify-between"><span className="text-sm font-medium">Status</span><Badge variant="outline">{status}</Badge></div>{status === "Offline" ? <p className="text-sm text-muted-foreground">Temporarily disconnected. Your administrator can check the shared agent connection.</p> : null}<div><h3 className="text-sm font-medium">Rules</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{agent.instructions || "No instructions."}</p></div><div><h3 className="text-sm font-medium">Channels</h3><div className="mt-2 flex flex-wrap gap-2">{channels.filter((channel) => agent.channelIds.includes(channel.id)).map((channel) => <Badge key={channel.id} variant="secondary">#{channel.name}</Badge>)}{!agent.channelIds.length ? <span className="text-sm text-muted-foreground">No assigned channels.</span> : null}</div></div><Separator /><div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void message()} disabled={agent.status === "inactive"}><MessageSquareIcon />Message</Button>{teacher ? <><Button type="button" size="sm" variant="outline" onClick={onEdit}><PencilIcon />Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}><PlusIcon />Add to channel</Button></> : null}</div></div> : null}
        {tab === "danger" ? <ActionSection destructive title="Delete agent" description="The agent stops working. Existing direct-message history remains available as read-only." action={<Button type="button" size="sm" variant="destructive" onClick={onDelete} disabled={agent.status === "inactive"}><Trash2Icon />Delete agent</Button>} /> : null}
      </div>
      <AddAgentToChannelDialog open={addOpen} onOpenChange={setAddOpen} agent={agent} channels={channels} onAdd={async (channelId) => { await workspace.updateAgent(agent.id, { channelIds: [...agent.channelIds, channelId] }); toast.add({ title: `Added ${agent.name} to channel` }) }} />
    </aside>
  )
}

function AddAgentToChannelDialog({ open, onOpenChange, agent, channels, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; agent: Agent; channels: ReturnType<typeof useCommunity>["community"]["channels"]; onAdd: (channelId: string) => Promise<void> }) {
  const eligible = channels.filter((channel) => !agent.channelIds.includes(channel.id))
  const [channelId, setChannelId] = useState(() => eligible[0]?.id ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add {agent.name} to a channel</DialogTitle><DialogDescription>Choose an active course channel. Existing assignments are disabled.</DialogDescription></DialogHeader><div className="space-y-1">{channels.map((channel) => { const assigned = agent.channelIds.includes(channel.id); return <label key={channel.id} className="flex items-center gap-3 rounded-md border p-3 text-sm"><Checkbox checked={channelId === channel.id || assigned} disabled={assigned || pending} onCheckedChange={(checked) => { if (checked) setChannelId(channel.id) }} /><span className="min-w-0 flex-1 truncate">#{channel.name}</span>{assigned ? <span className="text-xs text-muted-foreground">Already in channel</span> : null}</label> })}{!channels.length ? <p className="text-sm text-muted-foreground">There are no active channels.</p> : null}</div>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="button" disabled={!channelId || pending || !eligible.length} onClick={() => { setPending(true); setError(undefined); void onAdd(channelId).then(() => onOpenChange(false)).catch((cause) => setError(cause instanceof Error ? cause.message : "The agent could not be added.")).finally(() => setPending(false)) }}>{pending ? "Adding…" : "Add to channel"}</Button></DialogFooter></DialogContent></Dialog>
}

function PanelTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className="h-10 border-b-2 border-transparent px-1 text-sm aria-selected:border-foreground aria-selected:font-medium">{children}</button> }

function useNarrowAuxiliary(container: React.RefObject<HTMLDivElement | null>): boolean {
  const [narrow, setNarrow] = useState(true)
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 840))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [container])
  return narrow
}
