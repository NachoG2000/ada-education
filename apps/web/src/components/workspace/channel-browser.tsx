import { useMemo, useState } from 'react'
import { HashIcon, PlusIcon, SearchIcon } from 'lucide-react'
import type { Channel } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCommunity } from '@/lib/community'
import { useAppNavigation } from '@/lib/routes'
import { useHostedWorkspace } from './hosted-context'

type BrowserTab = 'all' | 'joined' | 'archived'

export function ChannelBrowser({
  onOpenChange,
  onCreate,
}: {
  onOpenChange: (open: boolean) => void
  onCreate: (name?: string) => void
}) {
  const { community, me, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const [tab, setTab] = useState<BrowserTab>('all')
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState<string>()
  const [error, setError] = useState<string>()
  const teacher = me.kind === 'person' && me.role === 'teacher'

  const channels = useMemo(() => {
    const byId = new Map<string, Channel>()
    for (const channel of community.channels) {
      if (channel.kind !== 'dm') byId.set(channel.id, channel)
    }
    for (const entry of hosted.directory.channels) {
      if (!byId.has(entry.id)) byId.set(entry.id, {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        group: 'course',
        visibility: entry.visibility === 'public' ? 'open' : 'private',
        status: entry.status,
        memberIds: [],
        memberCount: entry.memberCount,
        kind: 'channel',
      })
    }
    const all = [...byId.values()]
    const selected = tab === 'archived'
      ? all.filter((channel) => channel.status === 'archived')
      : tab === 'joined'
        ? all.filter((channel) => channel.status !== 'archived' && channel.memberIds.includes(me.id))
        : all.filter((channel) => channel.status !== 'archived')
    const needle = query.trim().toLowerCase()
    return needle ? selected.filter((channel) => `${channel.name} ${channel.description ?? ''}`.toLowerCase().includes(needle)) : selected
  }, [community.channels, hosted.directory.channels, me.id, query, tab])

  const open = async (channel: Channel) => {
    setPendingId(channel.id)
    setError(undefined)
    try {
      if (!channel.memberIds.includes(me.id) && channel.status !== 'archived') await workspace.joinChannel(channel.id)
      onOpenChange(false)
      await navigateTo({ kind: 'channel', channelId: channel.id })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The channel could not be opened.')
    } finally {
      setPendingId(undefined)
    }
  }

  const exact = channels.some((channel) => channel.name.toLowerCase() === query.trim().toLowerCase())
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-3"><DialogTitle>Browse channels</DialogTitle><DialogDescription>Find public conversations, the channels you joined, or archived history.</DialogDescription></DialogHeader>
        <div className="px-4"><div className="relative"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" className="pl-8" /></div>
          <Tabs value={tab} onValueChange={(value) => setTab(value as BrowserTab)} className="mt-3"><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="joined">Joined</TabsTrigger><TabsTrigger value="archived">Archived</TabsTrigger></TabsList></Tabs>
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="mt-3 max-h-[55vh] overflow-y-auto border-t px-4 py-2">
          {channels.map((channel, index) => <div key={channel.id}>{index ? <Separator /> : null}<button type="button" disabled={Boolean(pendingId)} onClick={() => void open(channel)} className="flex w-full items-center gap-3 rounded-md py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"><span className="ml-2 flex size-8 items-center justify-center rounded-lg bg-muted"><HashIcon /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{channel.name}</span>{channel.memberIds.includes(me.id) ? <Badge variant="secondary">Joined</Badge> : null}{channel.status === 'archived' ? <Badge variant="outline">Archived</Badge> : null}</span><span className="block truncate text-xs text-muted-foreground">{channel.description || `${channel.memberCount ?? channel.memberIds.length} members`}</span></span><span className="mr-2 text-xs text-muted-foreground">{pendingId === channel.id ? 'Opening…' : channel.memberIds.includes(me.id) || channel.status === 'archived' ? 'Open' : 'Join'}</span></button></div>)}
          {channels.length === 0 ? <p className="px-2 py-10 text-center text-sm text-muted-foreground">No channels match this view.</p> : null}
          {teacher && query.trim() && !exact && tab !== 'archived' ? <><Separator /><Button variant="ghost" className="my-2 w-full justify-start" onClick={() => { onOpenChange(false); onCreate(query.trim()) }}><PlusIcon data-icon="inline-start" />Create #{query.trim()}</Button></> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
