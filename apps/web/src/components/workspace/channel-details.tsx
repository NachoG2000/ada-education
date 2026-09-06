import { useMemo, useState } from "react"
import type { Agent, Channel, Person } from "@ada/protocol"
import { ArchiveIcon, CheckIcon, SearchIcon, UserMinusIcon, XIcon } from "lucide-react"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DestructiveConfirmation } from "./destructive-confirmation"
import { MemberProfilePopover } from "./member-profile-popover"
import { useAppNavigation } from "@/lib/routes"
import { useCommunity } from "@/lib/community"
import { toast } from "@/components/ui/toast"
import { useHostedWorkspace } from "./hosted-context"

export type ChannelAuxiliaryKind = "members" | "settings"

export function ChannelDetailsPanel({
  channel,
  initialView,
  onClose,
}: {
  channel: Channel
  initialView: ChannelAuxiliaryKind
  onClose: () => void
}) {
  const { community, me, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const canManage = me.kind === "person" && me.role === "teacher"
  const [view, setView] = useState<ChannelAuxiliaryKind>(initialView)
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description ?? "")
  const [visibility, setVisibility] = useState<"open" | "private">(channel.visibility ?? "open")
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState(() => new Set(channel.memberIds))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const people = community.members.filter((member): member is Person => member.kind === "person")
  const agents = community.members.filter((member): member is Agent => member.kind === "agent" && member.status !== "inactive")
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...people, ...agents].filter((member) => selectedIds.has(member.id) && (!needle || member.name.toLowerCase().includes(needle)))
  }, [agents, people, query, selectedIds])

  const saveMetadata = async () => {
    setPending(true); setError(undefined)
    try {
      await workspace.updateChannel(channel.id, { name: name.trim(), description: description.trim(), visibility })
      toast.add({ title: "Channel updated" })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The channel could not be updated.")
    } finally { setPending(false) }
  }

  const saveMembers = async () => {
    setPending(true); setError(undefined)
    try {
      await workspace.replaceChannelMembers(channel.id, {
        memberIds: people.filter((member) => selectedIds.has(member.id)).map((member) => member.id),
        agentIds: agents.filter((member) => selectedIds.has(member.id)).map((member) => member.id),
      })
      toast.add({ title: "Channel members updated" })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Channel access could not be updated.")
    } finally { setPending(false) }
  }

  const toggle = (id: string, checked: boolean) => setSelectedIds((current) => {
    const next = new Set(current)
    if (checked) next.add(id); else next.delete(id)
    return next
  })

  return (
    <aside className="flex size-full min-w-0 flex-col bg-background" aria-label="Channel details">
      <header className="flex min-h-14 items-center gap-2 border-b px-4">
        <div className="min-w-0 flex-1"><h2 className="font-semibold">#{channel.name}</h2><p className="text-xs text-muted-foreground">Channel details</p></div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close channel details"><XIcon /></Button>
      </header>
      <div className="flex h-10 shrink-0 items-end gap-4 border-b px-4" role="tablist" aria-label="Channel detail sections">
        <button type="button" role="tab" aria-selected={view === "members"} onClick={() => setView("members")} className="h-10 border-b-2 border-transparent px-1 text-sm aria-selected:border-foreground aria-selected:font-medium">Members</button>
        {canManage ? <button type="button" role="tab" aria-selected={view === "settings"} onClick={() => setView("settings")} className="h-10 border-b-2 border-transparent px-1 text-sm aria-selected:border-foreground aria-selected:font-medium">Settings</button> : null}
      </div>
      {error ? <p className="mx-4 mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {view === "members" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative p-4 pb-2"><SearchIcon className="pointer-events-none absolute left-6 top-6 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" placeholder="Search members" aria-label="Search channel members" /></div>
          <ScrollArea className="min-h-0 flex-1 px-2">
            {shown.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                <MemberProfilePopover member={member} className="flex min-w-0 flex-1 items-center gap-3 p-1" onMessage={member.kind === "agent" && member.status !== "inactive" ? () => { void hosted.createAgentDm(member.id).then((channelId) => navigateTo({ kind: "channel", channelId })) } : undefined} onManage={canManage && member.kind === "agent" ? () => navigateTo({ kind: "agents", agentId: member.id }) : undefined}>
                  <MemberAvatar member={member} size={32} presence /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{member.name}</span><span className="block truncate text-xs text-muted-foreground">{member.kind === "agent" ? "Agent" : member.role}</span></span>
                </MemberProfilePopover>
                {canManage && member.id !== me.id ? <Button type="button" variant="ghost" size="icon-xs" onClick={() => toggle(member.id, false)} aria-label={`Remove ${member.name} from channel`}><UserMinusIcon /></Button> : null}
              </div>
            ))}
            {!shown.length ? <p className="px-3 py-10 text-center text-sm text-muted-foreground">No matching channel members.</p> : null}
          </ScrollArea>
          {canManage ? (
            <div className="border-t p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Channel access</p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {[...people, ...agents].map((member) => <label key={member.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selectedIds.has(member.id)} disabled={member.id === me.id || pending} onCheckedChange={(checked) => toggle(member.id, checked === true)} /><span className="min-w-0 flex-1 truncate">{member.name}</span><span className="text-xs text-muted-foreground">{member.kind === "agent" ? "agent" : member.role}</span></label>)}
              </div>
              <Button type="button" size="sm" className="mt-3 w-full" onClick={() => void saveMembers()} disabled={pending}>{pending ? "Saving…" : "Save access"}</Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="channel-detail-name">Name</label><Input id="channel-detail-name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></div>
            <div className="space-y-2"><label className="text-sm font-medium" htmlFor="channel-detail-description">Description</label><Textarea id="channel-detail-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} disabled={pending} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Visibility</label><Select value={visibility} onValueChange={(value) => value && setVisibility(value as "open" | "private")} disabled={pending}><SelectTrigger className="w-full"><CheckIcon /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Public</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">{visibility === "open" ? "Community members can find and join this channel." : "Only assigned people and agents can open it."}</p></div>
            <Button type="button" className="w-full" onClick={() => void saveMetadata()} disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save channel"}</Button>
            <Separator />
            <div><h3 className="text-sm font-semibold">Channel lifecycle</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Archive preserves readable history and prevents new messages.</p><Button type="button" variant="destructive" className="mt-3 w-full" onClick={() => setArchiveOpen(true)} disabled={pending || channel.status === "archived"}><ArchiveIcon />Archive channel</Button></div>
          </div>
        </ScrollArea>
      )}
      <DestructiveConfirmation open={archiveOpen} onOpenChange={setArchiveOpen} title={`Archive #${channel.name}?`} description="History will stay readable, but nobody can send new messages." confirmLabel="Archive channel" pending={pending} onConfirm={async () => { setPending(true); try { await workspace.updateChannel(channel.id, { status: "archived" }); onClose(); void navigateTo({ kind: "inbox" }) } finally { setPending(false) } }} />
    </aside>
  )
}
