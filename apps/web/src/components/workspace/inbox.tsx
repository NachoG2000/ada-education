import { useCallback, useState } from "react"
import { ArrowLeftIcon, InboxIcon } from "lucide-react"
import { inboxActivity } from "@/lib/inbox-activity"
import { Button } from "@/components/ui/button"
import { useCommunity } from "@/lib/community"
import { useAppNavigation } from "@/lib/routes"
import { useEducationData } from "@/lib/use-education-data"
import { useHostedWorkspace } from "./hosted-context"
import { PageHeader } from "./page-layout"

export function InboxPage() {
  const { community, me, member } = useCommunity()
  const { education } = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const load = useCallback(() => education.reads(), [education])
  const reads = useEducationData(load)
  const [filter, setFilter] = useState<"unread" | "all">("unread")
  const [selected, setSelected] = useState<string>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const read = new Set(reads.data)
  const items = inboxActivity(community, me.id)
  const visible = items.filter((m) => filter === "all" || !read.has(m.id))
  const current = items.find((m) => m.id === selected)
  const setRead = async (id: string, value: boolean) => { setPending(true); setError(undefined); try { await education.setRead(id, value); await reads.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Could not update the inbox") } finally { setPending(false) } }
  return <div className="flex size-full min-w-0 flex-col"><div className="shrink-0 border-b px-5 py-5"><PageHeader title="Inbox" description="Your mentions, thread replies, and direct messages." /></div><div className="flex min-h-0 flex-1">
    <section aria-label="Inbox activity" className={`${current ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:max-w-sm md:border-r`}><div className="flex gap-2 border-b p-3">{(["unread", "all"] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : `Unread (${items.filter((m) => !read.has(m.id)).length})`}</Button>)}</div><div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">{reads.loading ? <p className="p-3 text-sm" role="status">Loading inbox…</p> : visible.map((m) => { const channel = community.channels.find((c) => c.id === m.channelId)!; return <button key={m.id} onClick={() => { setSelected(m.id); void setRead(m.id, true) }} className={`w-full rounded-md p-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring ${selected === m.id ? "bg-muted" : ""}`}><span className="flex items-center gap-2 text-sm font-semibold">{!read.has(m.id) ? <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" /> : null}{member(m.authorId).name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{channel.kind === "dm" ? "Direct message" : `#${channel.name}`} · {new Date(m.at).toLocaleDateString()}</span><span className="mt-2 line-clamp-2 block break-words text-sm">{m.paragraphs.flat().map((b) => b.text).join(" ")}</span></button> })}{!reads.loading && !visible.length ? <div className="px-5 py-12 text-center"><InboxIcon className="mx-auto mb-3 size-6 text-muted-foreground" /><h2 className="text-sm font-semibold">Your inbox is clear</h2><p className="mt-2 text-sm text-muted-foreground">{filter === "unread" ? "You’re up to date. Use All to revisit earlier activity." : "Mentions, replies to your threads, and incoming DMs will appear here."}</p></div> : null}</div></section>
    <section aria-label="Activity detail" className={`${current ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-y-auto p-5`}>{current ? <><div className="mb-4 flex flex-wrap gap-2"><Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelected(undefined)}><ArrowLeftIcon />Inbox</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => void setRead(current.id, !read.has(current.id))}>{read.has(current.id) ? "Mark unread" : "Mark read"}</Button><Button size="sm" onClick={() => void navigateTo({ kind: "channel", channelId: current.channelId, threadId: current.threadId }, { hash: `msg-${current.id}` })}>Open conversation</Button></div><h2 className="text-sm font-semibold">{member(current.authorId).name}</h2><time className="mt-1 text-xs text-muted-foreground">{new Date(current.at).toLocaleString()}</time><div className="mt-5 space-y-3 text-[15px] leading-6">{current.paragraphs.map((p, i) => <p key={i} className="whitespace-pre-wrap break-words">{p.map((b) => b.text).join("")}</p>)}</div></> : <p className="m-auto text-sm text-muted-foreground">Select an update to see its context.</p>}</section>
    </div>{error || reads.error ? <p role="alert" className="border-t p-3 text-sm text-destructive">{error ?? reads.error}</p> : null}</div>
}
