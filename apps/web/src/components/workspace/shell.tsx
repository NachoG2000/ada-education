import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type {
  Agent,
  AgentEnrollment,
  Channel,
  CreateAgentRequest,
  CreateChannelInput,
  Member,
  UpdateAgentRequest,
  UpdateChannelInput,
} from "@ada/protocol"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  CommandIcon,
  HashIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ChannelWorkspace } from "./channel"
import { WorkspaceSidebar } from "./sidebar"
import { AgentsPage, InboxPage, SettingsPage } from "./pages"
import {
  AgentDialog,
  ChannelDialog,
  DeleteAgentConfirmation,
  DeleteChannelConfirmation,
  WorkspaceCommandPalette,
  type AgentDialogValue,
  type ChannelDialogValue,
} from "./index"
import { readHash, subscribeToHash } from "@/lib/hash"
import { navigateTo, parseHash, replaceWith, serializeRoute, type AppRoute } from "@/lib/routes"
import { useCommunity } from "@/lib/community"
import { useSidebarPreferences, useThemePreferences } from "@/lib/preferences"

const emptyChannelValue = (memberId: string, group: CreateChannelInput["group"] = "course"): ChannelDialogValue => ({
  name: "",
  description: "",
  group,
  visibility: group === "private" ? "private" : "open",
  memberIds: [memberId],
  agentIds: [],
  workStatus: "active",
  workDue: "",
})

const emptyAgentValue = (scope: Agent["scope"]): AgentDialogValue => ({
  name: "",
  description: "",
  instructions: "",
  scope,
  runtime: "scripted",
  model: "",
  figureSeed: crypto.randomUUID(),
  channelIds: [],
})

function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}

function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const update = () => setMobile(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return mobile
}

export function WorkspaceShell() {
  useThemePreferences()
  const hash = useSyncExternalStore(subscribeToHash, readHash)
  const route = useMemo(() => parseHash(hash), [hash])
  const { community, me, activeChannelId, setActiveChannelId, connected, mode, createInvite, workspace } = useCommunity()
  const sidebar = useSidebarPreferences()
  const mobile = useMobile()
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [palette, setPalette] = useState(false)
  const [paletteScope, setPaletteScope] = useState<"global" | "channel">("global")
  const [browse, setBrowse] = useState(false)
  const [channelDialog, setChannelDialog] = useState<"create" | string | null>(null)
  const [channelValue, setChannelValue] = useState(() => emptyChannelValue(me.id, me.kind === "person" && me.role === "teacher" ? "course" : "private"))
  const [agentDialog, setAgentDialog] = useState<"create" | string | null>(null)
  const [agentValue, setAgentValue] = useState(() => emptyAgentValue(me.kind === "person" && me.role === "teacher" ? "community" : "personal"))
  const [pending, setPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | undefined>()
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null)
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<AgentEnrollment | null>(null)
  const [previousWorkspaceRoute, setPreviousWorkspaceRoute] = useState<AppRoute>({ kind: "inbox" })

  useEffect(() => {
    const canonical = serializeRoute(route)
    if (hash !== canonical) replaceWith(route)
  }, [hash, route])

  useEffect(() => {
    if (route.kind !== "settings" && route.kind !== "join") {
      // Route changes are an external hash subscription; keep the last real page for Settings Back.
      // oxlint-disable-next-line react/set-state-in-effect
      setPreviousWorkspaceRoute(route)
    }
  }, [route])

  useEffect(() => {
    // Join links are consumed by ConnectedApp before the workspace mounts. If
    // an already-authenticated member opens one (or demo mode receives one),
    // retire it instead of leaving the shell on a route with no page of its own.
    if (route.kind === "join") replaceWith({ kind: "inbox" })
  }, [route])

  const closeSettings = useCallback(() => {
    navigateTo(previousWorkspaceRoute.kind === "settings" ? { kind: "inbox" } : previousWorkspaceRoute)
  }, [previousWorkspaceRoute])

  useEffect(() => {
    if (route.kind !== "channel") return
    const target = community.channels.find((channel) => channel.id === route.channelId)
    if (!target) {
      replaceWith({ kind: "inbox" })
      return
    }
    setActiveChannelId(route.channelId)
    if (target.unread && target.memberIds.includes(me.id) && target.status !== "archived" && workspace.available) {
      void workspace.markChannelRead(target.id).catch(() => undefined)
    }
  }, [community.channels, me.id, route, setActiveChannelId, workspace])

  const openCreateChannel = useCallback((group?: CreateChannelInput["group"]) => {
    setDialogError(undefined)
    setChannelValue(emptyChannelValue(me.id, group ?? (me.kind === "person" && me.role === "teacher" ? "course" : "private")))
    setChannelDialog("create")
  }, [me])
  const openEditChannel = (channelId = activeChannelId) => {
    const channel = community.channels.find((item) => item.id === channelId)
    if (!channel) return
    setDialogError(undefined)
    setChannelValue({
      name: channel.name,
      description: channel.description ?? "",
      group: channel.group,
      visibility: channel.visibility ?? (channel.group === "private" ? "private" : "open"),
      memberIds: channel.memberIds.filter((id) => community.members.find((member) => member.id === id)?.kind === "person"),
      agentIds: channel.memberIds.filter((id) => community.members.find((member) => member.id === id)?.kind === "agent"),
      workStatus: channel.work?.status ?? "active",
      workDue: channel.work?.due ?? "",
    })
    setChannelDialog(channelId)
  }
  const openCreateAgent = () => {
    setDialogError(undefined)
    setAgentValue(emptyAgentValue(me.kind === "person" && me.role === "teacher" ? "community" : "personal"))
    setAgentDialog("create")
  }
  const openEditAgent = (agentId: string) => {
    const agent = community.members.find((member): member is Agent => member.kind === "agent" && member.id === agentId)
    if (!agent) return
    setDialogError(undefined)
    setAgentValue({
      name: agent.name,
      description: agent.description ?? "",
      instructions: agent.instructions,
      scope: agent.scope,
      runtime: agent.runtime ?? "scripted",
      model: agent.model ?? agent.provider.model,
      figureSeed: agent.figureSeed ?? agent.id,
      figureColor: agent.figureColor,
      channelIds: agent.channelIds,
    })
    setAgentDialog(agentId)
  }
  const selectMemberFromPalette = (member: Member) => {
    if (member.kind === "agent") {
      const canManage = me.kind === "person" && (me.role === "teacher" || member.scope === "personal" && member.createdBy === me.id)
      if (canManage) {
        openEditAgent(member.id)
        return
      }
      const sharedChannel = community.channels.find((channel) => member.channelIds.includes(channel.id) && channel.memberIds.includes(me.id))
      if (sharedChannel) navigateTo({ kind: "channel", channelId: sharedChannel.id })
      return
    }

    const sharedPrivateChannel = community.channels.find((channel) => channel.group === "private" && channel.memberIds.includes(me.id) && channel.memberIds.includes(member.id))
    if (sharedPrivateChannel) navigateTo({ kind: "channel", channelId: sharedPrivateChannel.id })
    else navigateTo({ kind: "settings", section: "course" })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey
      if (event.key === "Escape") {
        if (event.defaultPrevented) return
        const hasOverlay = palette || browse || mobileSidebar || channelDialog !== null || agentDialog !== null || Boolean(enrollment) || Boolean(deleteChannelId) || Boolean(deleteAgentId)
        setPalette(false)
        setBrowse(false)
        setMobileSidebar(false)
        if (!hasOverlay && route.kind === "settings") closeSettings()
        return
      }
      if (!command || editableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === "k") { event.preventDefault(); setPaletteScope("global"); setPalette(true) }
      else if (key === "n" && event.shiftKey) { event.preventDefault(); openCreateChannel() }
      else if (event.key === ",") { event.preventDefault(); navigateTo({ kind: "settings" }) }
      else if (key === "s") { event.preventDefault(); sidebar.setOpen((open) => !open) }
      else if (event.key === "[") { event.preventDefault(); history.back() }
      else if (event.key === "]") { event.preventDefault(); history.forward() }
      else if (key === "f" && route.kind === "channel") { event.preventDefault(); setPaletteScope("channel"); setPalette(true) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [agentDialog, browse, channelDialog, closeSettings, deleteAgentId, deleteChannelId, enrollment, mobileSidebar, openCreateChannel, palette, route.kind, sidebar])

  const channel = channelDialog && channelDialog !== "create" ? community.channels.find((item) => item.id === channelDialog) : undefined
  const agent = agentDialog && agentDialog !== "create"
    ? community.members.find((member): member is Agent => member.kind === "agent" && member.id === agentDialog)
    : undefined
  const deletingChannel = community.channels.find((item) => item.id === deleteChannelId)
  const deletingAgent = community.members.find((member): member is Agent => member.kind === "agent" && member.id === deleteAgentId)

  const submitChannel = async (input: CreateChannelInput | UpdateChannelInput) => {
    setPending(true)
    setDialogError(undefined)
    try {
      if (channelDialog === "create") {
        const created = await workspace.createChannel(input as CreateChannelInput)
        setChannelDialog(null)
        setActiveChannelId(created.id)
        navigateTo({ kind: "channel", channelId: created.id })
      } else if (channelDialog) {
        const updated = await workspace.updateChannel(channelDialog, input as UpdateChannelInput)
        await workspace.replaceChannelMembers(channelDialog, { memberIds: channelValue.memberIds, agentIds: channelValue.agentIds })
        setChannelDialog(null)
        if (updated.status === "archived" && route.kind === "channel" && route.channelId === channelDialog) navigateTo({ kind: "inbox" })
      }
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The channel could not be saved.")
    } finally {
      setPending(false)
    }
  }

  const submitAgent = async (input: CreateAgentRequest | UpdateAgentRequest) => {
    setPending(true)
    setDialogError(undefined)
    try {
      if (agentDialog === "create") {
        const created = await workspace.createAgent(input as CreateAgentRequest)
        setEnrollment(created.enrollment)
      } else if (agentDialog) {
        await workspace.updateAgent(agentDialog, input as UpdateAgentRequest)
      }
      setAgentDialog(null)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The agent could not be saved.")
    } finally {
      setPending(false)
    }
  }

  const showEnrollment = async (agentId: string) => {
    setPending(true)
    try {
      setEnrollment((await workspace.rotateAgentToken(agentId)).enrollment)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The token could not be rotated.")
      throw error
    } finally {
      setPending(false)
    }
  }

  const toggleChannelArchive = async (channelId: string, archived: boolean) => {
    setPending(true)
    setDialogError(undefined)
    try {
      await workspace.updateChannel(channelId, { status: archived ? "active" : "archived" })
      setChannelDialog(null)
      if (!archived && route.kind === "channel" && route.channelId === channelId) navigateTo({ kind: "inbox" })
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The channel status could not be changed.")
      throw error
    } finally {
      setPending(false)
    }
  }

  const toggleAgentStatus = async (agentId: string, inactive: boolean) => {
    setPending(true)
    setDialogError(undefined)
    try {
      await workspace.updateAgent(agentId, { status: inactive ? "active" : "inactive" })
      setAgentDialog(null)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The agent status could not be changed.")
      throw error
    } finally {
      setPending(false)
    }
  }

  const deleteChannel = async (channelId: string) => {
    setPending(true)
    setDialogError(undefined)
    try {
      await workspace.deleteChannel(channelId)
      setDeleteChannelId(null)
      navigateTo({ kind: "inbox" })
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The channel could not be deleted.")
      throw error
    } finally {
      setPending(false)
    }
  }

  const deleteAgent = async (agentId: string) => {
    setPending(true)
    setDialogError(undefined)
    try {
      await workspace.deleteAgent(agentId)
      setDeleteAgentId(null)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The agent could not be removed.")
      throw error
    } finally {
      setPending(false)
    }
  }

  const sidebarNode = (
    <WorkspaceSidebar
      route={route}
      compact={!sidebar.open && !mobile}
      onBrowseChannels={() => setBrowse(true)}
      onCreateChannel={(group) => openCreateChannel(group)}
      onOpenSearch={() => { setPaletteScope("global"); setPalette(true) }}
      onNavigate={() => setMobileSidebar(false)}
    />
  )

  return (
    <div className="workspace-gradient flex h-svh min-h-0 flex-col overflow-hidden text-foreground">
      <header className="flex h-9 shrink-0 items-center gap-1 px-2 text-sidebar-foreground" aria-label="Workspace controls">
        <Button type="button" variant="ghost" size="icon-xs" className="md:hidden" onClick={() => setMobileSidebar(true)} aria-label="Open sidebar"><MenuIcon /></Button>
        <Button type="button" variant="ghost" size="icon-xs" className="hidden md:inline-flex" onClick={() => sidebar.setOpen((open) => !open)} aria-label={sidebar.open ? "Collapse sidebar" : "Expand sidebar"}>{sidebar.open ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}</Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => history.back()} aria-label="Back"><ArrowLeftIcon /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => history.forward()} aria-label="Forward"><ArrowRightIcon /></Button>
        <button type="button" onClick={() => { setPaletteScope("global"); setPalette(true) }} className="mx-auto flex h-7 min-w-0 max-w-md flex-1 items-center gap-2 rounded-md bg-background/35 px-3 text-xs text-sidebar-foreground/70 outline-none hover:bg-background/55 focus-visible:ring-2 focus-visible:ring-ring">
          <SearchIcon className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 flex-1 truncate text-left">Search {community.name}</span><kbd className="hidden shrink-0 font-sans text-[10px] sm:inline">⌘K</kbd>
        </button>
        <span className="flex items-center gap-1.5 px-2 text-[11px]" role="status"><span className={`size-1.5 rounded-full ${connected ? "bg-ok" : "bg-alert"}`} />{mode === "demo" ? "Demo" : connected ? "Live" : "Offline"}</span>
      </header>

      <div className="min-h-0 flex-1 px-2 pb-2">
        {mobile ? (
          <main className="workspace-content-surface size-full min-h-0 overflow-hidden">{pageForRoute(route, openEditChannel, () => { setPaletteScope("channel"); setPalette(true) }, openCreateAgent, openEditAgent, createInvite, showEnrollment, closeSettings)}</main>
        ) : (
          <ResizablePanelGroup key={sidebar.open ? "open" : "compact"} orientation="horizontal" className="h-full min-h-0">
            <ResizablePanel
              id="workspace-sidebar"
              defaultSize={sidebar.open ? sidebar.width : 52}
              minSize={sidebar.open ? 220 : 52}
              maxSize={sidebar.open ? 420 : 52}
              disabled={!sidebar.open}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(size) => { if (sidebar.open && size.inPixels >= 220) sidebar.setWidth(size.inPixels) }}
              className="min-w-0"
            >
              {sidebarNode}
            </ResizablePanel>
            {sidebar.open ? <ResizableHandle className="bg-transparent after:w-2" /> : null}
            <ResizablePanel id="workspace-content" minSize={420} className="min-w-0">
              <main className="workspace-content-surface size-full min-h-0 overflow-hidden">{pageForRoute(route, openEditChannel, () => { setPaletteScope("channel"); setPalette(true) }, openCreateAgent, openEditAgent, createInvite, showEnrollment, closeSettings)}</main>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <Sheet open={mobileSidebar} onOpenChange={setMobileSidebar}>
        <SheetContent side="left" className="w-72 gap-0 border-0 bg-sidebar p-0" showCloseButton={false}>
          <SheetHeader className="sr-only"><SheetTitle>Course navigation</SheetTitle><SheetDescription>Channels and workspace pages</SheetDescription></SheetHeader>
          {sidebarNode}
        </SheetContent>
      </Sheet>

      <WorkspaceCommandPalette
        open={palette}
        onOpenChange={(open) => { setPalette(open); if (!open) setPaletteScope("global") }}
        channels={paletteScope === "global" ? community.channels.map((item) => ({ channel: item, onSelect: () => navigateTo({ kind: "channel", channelId: item.id }) })) : []}
        members={paletteScope === "global" ? community.members.map((member) => ({ member, onSelect: () => selectMemberFromPalette(member) })) : []}
        messages={community.messages.filter((message) => !message.deletedAt && (paletteScope === "global" || route.kind === "channel" && message.channelId === route.channelId)).slice(-80).map((message) => ({ message, channelLabel: community.channels.find((item) => item.id === message.channelId)?.name ?? "channel", authorLabel: community.members.find((member) => member.id === message.authorId)?.name ?? "member", onSelect: () => { navigateTo({ kind: "channel", channelId: message.channelId }); requestAnimationFrame(() => document.getElementById(`msg-${message.id}`)?.scrollIntoView({ block: "center" })) } }))}
        actions={paletteScope === "global" ? [
          { id: "new-channel", label: "Create channel", shortcut: "⇧⌘N", icon: PlusIcon, onSelect: () => openCreateChannel() },
          { id: "new-agent", label: "Create agent", icon: BotIcon, onSelect: openCreateAgent },
          { id: "settings", label: "Open settings", shortcut: "⌘,", icon: SettingsIcon, onSelect: () => navigateTo({ kind: "settings" }) },
        ] : []}
        placeholder={paletteScope === "channel" ? `Find in #${route.kind === "channel" ? community.channels.find((item) => item.id === route.channelId)?.name ?? "channel" : "channel"}…` : undefined}
      />

      <Dialog open={browse} onOpenChange={setBrowse}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl">
          <DialogHeader><DialogTitle>Browse channels</DialogTitle><DialogDescription>Open or join a conversation visible to you.</DialogDescription></DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto">
            {community.channels.map((item, index) => <BrowseChannelRow key={item.id} channel={item} separated={index > 0} onClose={() => setBrowse(false)} />)}
          </div>
        </DialogContent>
      </Dialog>

      <ChannelDialog
        open={channelDialog !== null}
        onOpenChange={(open) => { if (!open) setChannelDialog(null) }}
        value={channelValue}
        onValueChange={setChannelValue}
        onSubmit={submitChannel}
        channel={channel}
        memberOptions={community.members.filter((member) => member.kind === "person").map((member) => ({ id: member.id, label: member.name, description: member.role }))}
        agentOptions={community.members.filter((member) => member.kind === "agent").map((member) => ({ id: member.id, label: member.name, description: member.description }))}
        allowedGroups={me.kind === "person" && me.role === "teacher" ? ["course", "work", "private"] : ["private"]}
        pending={pending}
        error={dialogError}
        onArchiveToggle={channel ? () => toggleChannelArchive(channel.id, channel.status === "archived") : undefined}
        onDelete={channel ? () => { setDialogError(undefined); setDeleteChannelId(channel.id) } : undefined}
      />

      <AgentDialog
        open={agentDialog !== null}
        onOpenChange={(open) => { if (!open) setAgentDialog(null) }}
        value={agentValue}
        onValueChange={setAgentValue}
        onSubmit={(input) => submitAgent(input as CreateAgentRequest | UpdateAgentRequest)}
        agent={agent}
        channelOptions={community.channels.filter((item) => item.status !== "archived").map((item) => ({ id: item.id, label: item.name, description: item.group }))}
        canUseCommunityScope={me.kind === "person" && me.role === "teacher"}
        onRerollFigure={() => crypto.randomUUID()}
        pending={pending}
        error={dialogError}
        onStatusToggle={agent ? () => toggleAgentStatus(agent.id, agent.status === "inactive") : undefined}
        onDelete={agent ? () => { setDialogError(undefined); setDeleteAgentId(agent.id) } : undefined}
      />

      {deletingChannel ? <DeleteChannelConfirmation channel={deletingChannel} open onOpenChange={(open) => { if (!open) { setDeleteChannelId(null); setDialogError(undefined) } }} pending={pending} error={dialogError} onConfirm={() => deleteChannel(deletingChannel.id)} /> : null}
      {deletingAgent ? <DeleteAgentConfirmation agent={deletingAgent} open onOpenChange={(open) => { if (!open) { setDeleteAgentId(null); setDialogError(undefined) } }} pending={pending} error={dialogError} onConfirm={() => deleteAgent(deletingAgent.id)} /> : null}

      <Dialog open={Boolean(enrollment)} onOpenChange={(open) => { if (!open) setEnrollment(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl">
          <DialogHeader><DialogTitle>Connect the runner</DialogTitle><DialogDescription>This token is shown once. Run the command on the machine where the agent runtime is available.</DialogDescription></DialogHeader>
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5"><code>{enrollment?.setupCommand}</code></pre>
          <Button type="button" onClick={() => enrollment && void navigator.clipboard.writeText(enrollment.setupCommand)}><CommandIcon data-icon="inline-start" />Copy setup command</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BrowseChannelRow({ channel, separated, onClose }: { channel: Channel; separated: boolean; onClose: () => void }) {
  const { me, workspace } = useCommunity()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const joined = channel.memberIds.includes(me.id)
  const open = () => { onClose(); navigateTo({ kind: "channel", channelId: channel.id }) }
  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      await workspace.joinChannel(channel.id)
      open()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The channel could not be joined.")
    } finally {
      setJoining(false)
    }
  }
  return (
    <div>
      {separated ? <Separator /> : null}
      <div className="flex items-center gap-3 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-muted"><HashIcon /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{channel.name}</p>{channel.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}</div><p className="truncate text-xs text-muted-foreground">{error ?? channel.description ?? `${channel.group} channel`}</p></div>
        {joined ? <Button size="sm" variant="ghost" onClick={open}>Open</Button> : channel.status === "archived" ? <span className="text-xs text-muted-foreground">Read-only</span> : <Button size="sm" variant="outline" disabled={joining} onClick={() => void join()}>{joining ? "Joining…" : "Join"}</Button>}
      </div>
    </div>
  )
}

function pageForRoute(
  route: AppRoute,
  openEditChannel: () => void,
  openSearch: () => void,
  openCreateAgent: () => void,
  openEditAgent: (agentId: string) => void,
  createInvite: (() => Promise<{ token: string; joinHash: string }>) | undefined,
  rotateAgent: (agentId: string) => Promise<void>,
  closeSettings: () => void,
) {
  if (route.kind === "channel") return <ChannelWorkspace onManageChannel={openEditChannel} onSearchChannel={openSearch} />
  if (route.kind === "agents") return <AgentsPage onCreateAgent={openCreateAgent} onEditAgent={openEditAgent} />
  if (route.kind === "settings") return <SettingsPage section={route.section} onCreateInvite={createInvite} onRotateAgent={rotateAgent} onBack={closeSettings} />
  return <InboxPage />
}
