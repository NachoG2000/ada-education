import { useCallback, useEffect, useState } from "react"
import type {
  Agent,
  CreateAgentRequest,
  CreateChannelInput,
  Member,
  UpdateAgentRequest,
} from "@ada/protocol"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ChannelWorkspace } from "./channel"
import { WorkspaceSidebar } from "./sidebar"
import { InboxPage, NewMessagePage } from "./pages"
import { HostedSettingsPage } from "./settings-page"
import {
  AgentDialog,
  DeleteAgentConfirmation,
  WorkspaceCommandPalette,
  type AgentDialogValue,
} from "./index"
import { useAppNavigation, useAppRoute, type AppRoute } from "@/lib/routes"
import { useCommunity } from "@/lib/community"
import { useSidebarPreferences, useThemePreferences } from "@/lib/preferences"
import { CommunityRail } from "./community-rail"
import { ChannelBrowser } from "./channel-browser"
import { ChannelCreateDialog } from "./channel-create-dialog"
import type { ChannelAuxiliaryKind } from "./channel-details"
import { AgentsWorkspace } from "./agents-workspace"
import { toast } from "@/components/ui/toast"
import { useHostedWorkspace } from "./hosted-context"
import { MemberProfileDialog } from "./member-profile-dialog"

const emptyAgentValue = (scope: Agent["scope"]): AgentDialogValue => ({
  name: "",
  avatarUrl: "",
  instructions: "",
  scope,
  runtime: "claude",
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
  const { community, me, setActiveChannelId, connected, mode, workspace, closePanel } = useCommunity()
  const route = useAppRoute()
  const navigateTo = useAppNavigation(community.id)
  const hosted = useHostedWorkspace()
  const sidebar = useSidebarPreferences()
  const mobile = useMobile()
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [palette, setPalette] = useState(false)
  const [paletteScope, setPaletteScope] = useState<"global" | "channel">("global")
  const [browse, setBrowse] = useState(false)
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [createChannelName, setCreateChannelName] = useState("")
  const [channelAuxiliary, setChannelAuxiliary] = useState<ChannelAuxiliaryKind | null>(null)
  const [agentDialog, setAgentDialog] = useState<"create" | string | null>(null)
  const [agentValue, setAgentValue] = useState(() => emptyAgentValue(me.kind === "person" && me.role === "teacher" ? "community" : "personal"))
  const [pending, setPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | undefined>()
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null)
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null)
  const [previousWorkspaceRoute, setPreviousWorkspaceRoute] = useState<AppRoute>({ kind: "inbox" })

  useEffect(() => {
    if (route.kind !== "settings" && route.kind !== "join" && route.kind !== "root") {
      // Keep the last real page so Settings has a deterministic Back action.
      // oxlint-disable-next-line react/set-state-in-effect
      setPreviousWorkspaceRoute(route)
    }
  }, [route])

  useEffect(() => {
    if (route.kind === "join" || route.kind === "root") void navigateTo({ kind: "inbox" }, { replace: true })
  }, [navigateTo, route.kind])

  const closeSettings = useCallback(() => {
    void navigateTo(previousWorkspaceRoute.kind === "settings" ? { kind: "inbox" } : previousWorkspaceRoute)
  }, [navigateTo, previousWorkspaceRoute])

  useEffect(() => {
    if (route.kind !== "channel") return
    const target = community.channels.find((channel) => channel.id === route.channelId)
    if (!target) {
      void navigateTo({ kind: "inbox" }, { replace: true })
      return
    }
    setActiveChannelId(route.channelId)
    try { localStorage.setItem(`ada:last-channel:${community.id}`, route.channelId) } catch { /* Navigation still works without storage. */ }
    if (target.unread && target.memberIds.includes(me.id) && target.status !== "archived" && workspace.available) {
      void workspace.markChannelRead(target.id).catch(() => undefined)
    }
  }, [community.channels, community.id, me.id, navigateTo, route, setActiveChannelId, workspace])

  const openCreateChannel = useCallback((name = "") => {
    if (me.kind !== "person" || me.role !== "teacher") return
    setDialogError(undefined)
    setCreateChannelName(name)
    setCreateChannelOpen(true)
  }, [me])
  const openChannelAuxiliary = (kind: ChannelAuxiliaryKind) => {
    closePanel()
    setChannelAuxiliary(kind)
  }
  const openCreateAgent = () => {
    if (me.kind !== "person" || me.role !== "teacher") return
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
      avatarUrl: agent.avatarUrl ?? "",
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
      void navigateTo({ kind: "agents", agentId: member.id })
      return
    }

    setProfileMemberId(member.id)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey
      if (event.key === "Escape") {
        if (event.defaultPrevented) return
        const hasOverlay = palette || browse || mobileSidebar || channelAuxiliary !== null || agentDialog !== null || Boolean(deleteAgentId)
        setPalette(false)
        setBrowse(false)
        setMobileSidebar(false)
        if (channelAuxiliary) setChannelAuxiliary(null)
        else if (!hasOverlay && route.kind === "channel" && route.threadId) closePanel()
        else if (!hasOverlay && route.kind === "settings") closeSettings()
        return
      }
      if (!command || editableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === "k" && event.shiftKey) { event.preventDefault(); void navigateTo({ kind: "new-message" }) }
      else if (key === "o" && event.shiftKey) { event.preventDefault(); setBrowse(true) }
      else if (key === "k") { event.preventDefault(); setPaletteScope("global"); setPalette(true) }
      else if (key === "n" && event.shiftKey) { event.preventDefault(); openCreateChannel() }
      else if (event.key === ",") { event.preventDefault(); navigateTo({ kind: "settings" }) }
      else if (key === "s") { event.preventDefault(); sidebar.setOpen((open) => !open) }
      else if (event.key === "[") { event.preventDefault(); history.back() }
      else if (event.key === "]") { event.preventDefault(); history.forward() }
      else if (key === "f" && route.kind === "channel") { event.preventDefault(); setPaletteScope("channel"); setPalette(true) }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [agentDialog, browse, channelAuxiliary, closePanel, closeSettings, deleteAgentId, mobileSidebar, navigateTo, openCreateChannel, palette, route, sidebar])

  const agent = agentDialog && agentDialog !== "create"
    ? community.members.find((member): member is Agent => member.kind === "agent" && member.id === agentDialog)
    : undefined
  const deletingAgent = community.members.find((member): member is Agent => member.kind === "agent" && member.id === deleteAgentId)
  const profileMember = community.members.find((member) => member.id === profileMemberId)

  const submitNewChannel = async (input: { name: string; description?: string; visibility: "open" | "private" }) => {
    const created = await workspace.createChannel({ ...input, group: "course", memberIds: [me.id], agentIds: [] } satisfies CreateChannelInput)
    setActiveChannelId(created.id)
    await navigateTo({ kind: "channel", channelId: created.id })
  }

  const submitAgent = async (input: CreateAgentRequest | UpdateAgentRequest) => {
    setPending(true)
    setDialogError(undefined)
    try {
      if (agentDialog === "create") {
        const created = await workspace.createAgent(input as CreateAgentRequest)
        toast.add({ title: "Agent created" })
        await navigateTo({ kind: "agents", agentId: created.agent.id })
      } else if (agentDialog) {
        await workspace.updateAgent(agentDialog, input as UpdateAgentRequest)
        toast.add({ title: "Agent updated" })
      }
      setAgentDialog(null)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "The agent could not be saved.")
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
      await navigateTo({ kind: "agents" })
      toast.add({ title: "Agent deleted", description: "Its conversation history remains read-only." })
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
      onCreateChannel={() => openCreateChannel()}
      onOpenSearch={() => { setPaletteScope("global"); setPalette(true) }}
      onOpenChannelAuxiliary={(channelId, kind) => {
        if (route.kind !== "channel" || route.channelId !== channelId) void navigateTo({ kind: "channel", channelId })
        openChannelAuxiliary(kind)
      }}
      onNavigate={() => { setMobileSidebar(false); setChannelAuxiliary(null) }}
    />
  )

  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-background text-foreground">
      {route.kind === "settings" ? null : <CommunityRail />}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {route.kind === "settings" ? null : <header className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2 text-foreground" aria-label="Workspace controls">
        <Button type="button" variant="ghost" size="icon-xs" className="md:hidden" onClick={() => setMobileSidebar(true)} aria-label="Open sidebar"><MenuIcon /></Button>
        <Button type="button" variant="ghost" size="icon-xs" className="hidden md:inline-flex" onClick={() => sidebar.setOpen((open) => !open)} aria-label={sidebar.open ? "Collapse sidebar" : "Expand sidebar"}>{sidebar.open ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}</Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => history.back()} aria-label="Back"><ArrowLeftIcon /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => history.forward()} aria-label="Forward"><ArrowRightIcon /></Button>
        <button type="button" onClick={() => { setPaletteScope("global"); setPalette(true) }} className="mx-auto flex h-8 min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <SearchIcon className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 flex-1 truncate text-left">Search {community.name}</span><kbd className="hidden shrink-0 font-sans text-[10px] sm:inline">⌘K</kbd>
        </button>
        <span className="flex items-center gap-1.5 px-2 text-[11px]" role="status"><span className={`size-1.5 rounded-full ${connected ? "bg-green-600" : "bg-muted-foreground/50"}`} />{mode === "demo" ? "Demo" : connected ? "Live" : "Reconnecting"}</span>
      </header>}

      <div className="min-h-0 flex-1">
        {mobile || route.kind === "settings" ? (
          <main className="size-full min-h-0 overflow-hidden">{pageForRoute(route, channelAuxiliary, (value) => value ? openChannelAuxiliary(value) : setChannelAuxiliary(null), () => { setPaletteScope("channel"); setPalette(true) }, openCreateAgent, openEditAgent, (agentId) => setDeleteAgentId(agentId), closeSettings)}</main>
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
              className="min-w-0 border-r bg-muted/20"
            >
              {sidebarNode}
            </ResizablePanel>
            {sidebar.open ? <ResizableHandle className="bg-transparent after:w-2" /> : null}
            <ResizablePanel id="workspace-content" minSize={420} className="min-w-0">
              <main className="size-full min-h-0 overflow-hidden bg-background">{pageForRoute(route, channelAuxiliary, (value) => value ? openChannelAuxiliary(value) : setChannelAuxiliary(null), () => { setPaletteScope("channel"); setPalette(true) }, openCreateAgent, openEditAgent, (agentId) => setDeleteAgentId(agentId), closeSettings)}</main>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <Sheet open={mobileSidebar} onOpenChange={setMobileSidebar}>
        <SheetContent side="left" className="w-72 gap-0 bg-background p-0" showCloseButton={false}>
          <SheetHeader className="sr-only"><SheetTitle>Course navigation</SheetTitle><SheetDescription>Channels and workspace pages</SheetDescription></SheetHeader>
          {sidebarNode}
        </SheetContent>
      </Sheet>

      <WorkspaceCommandPalette
        open={palette}
        onOpenChange={(open) => { setPalette(open); if (!open) setPaletteScope("global") }}
        channels={paletteScope === "global" ? community.channels.map((item) => ({ channel: item, onSelect: () => { setChannelAuxiliary(null); void navigateTo({ kind: "channel", channelId: item.id }) } })) : []}
        members={paletteScope === "global" ? community.members.map((member) => ({ member, onSelect: () => selectMemberFromPalette(member) })) : []}
        messages={paletteScope === "channel" ? community.messages.filter((message) => !message.deletedAt && route.kind === "channel" && message.channelId === route.channelId).slice(-80).map((message) => ({ message, channelLabel: community.channels.find((item) => item.id === message.channelId)?.name ?? "channel", authorLabel: community.members.find((member) => member.id === message.authorId)?.name ?? "member", onSelect: () => { navigateTo({ kind: "channel", channelId: message.channelId }); requestAnimationFrame(() => document.getElementById(`msg-${message.id}`)?.scrollIntoView({ block: "center" })) } })) : []}
        actions={paletteScope === "global" ? [
          ...(me.kind === "person" && me.role === "teacher" ? [
            { id: "new-channel", label: "Create channel", shortcut: "⇧⌘N", icon: PlusIcon, onSelect: () => openCreateChannel() },
            { id: "new-agent", label: "Create agent", icon: BotIcon, onSelect: openCreateAgent },
            { id: "invite", label: "Invite to community", icon: UserPlusIcon, onSelect: hosted.requestInvite },
          ] : []),
          { id: "browse", label: "Browse channels", shortcut: "⇧⌘O", icon: SearchIcon, onSelect: () => setBrowse(true) },
          { id: "new-message", label: "New message", shortcut: "⇧⌘K", icon: BotIcon, onSelect: () => { setChannelAuxiliary(null); void navigateTo({ kind: "new-message" }) } },
          { id: "settings", label: "Open settings", shortcut: "⌘,", icon: SettingsIcon, onSelect: () => { setChannelAuxiliary(null); void navigateTo({ kind: "settings" }) } },
        ] : []}
        placeholder={paletteScope === "channel" ? `Find in #${route.kind === "channel" ? community.channels.find((item) => item.id === route.channelId)?.name ?? "channel" : "channel"}…` : undefined}
      />

      {browse ? <ChannelBrowser onOpenChange={setBrowse} onCreate={openCreateChannel} /> : null}
      {createChannelOpen ? <ChannelCreateDialog initialName={createChannelName} onOpenChange={setCreateChannelOpen} onCreate={submitNewChannel} /> : null}

      <AgentDialog
        key={agentDialog ?? "closed"}
        open={agentDialog !== null}
        onOpenChange={(open) => { if (!open) setAgentDialog(null) }}
        value={agentValue}
        onValueChange={setAgentValue}
        onSubmit={(input) => submitAgent(input as CreateAgentRequest | UpdateAgentRequest)}
        agent={agent}
        channelOptions={community.channels.filter((item) => item.status !== "archived" && item.kind !== "dm").map((item) => ({ id: item.id, label: item.name, description: item.group }))}
        pending={pending}
        error={dialogError}
      />

      {deletingAgent ? <DeleteAgentConfirmation agent={deletingAgent} open onOpenChange={(open) => { if (!open) { setDeleteAgentId(null); setDialogError(undefined) } }} pending={pending} error={dialogError} onConfirm={() => deleteAgent(deletingAgent.id)} /> : null}

      {profileMember ? <MemberProfileDialog member={profileMember} onOpenChange={(open) => { if (!open) setProfileMemberId(null) }} /> : null}
      </div>
    </div>
  )
}

function pageForRoute(
  route: AppRoute,
  channelAuxiliary: ChannelAuxiliaryKind | null,
  setChannelAuxiliary: (value: ChannelAuxiliaryKind | null) => void,
  openSearch: () => void,
  openCreateAgent: () => void,
  openEditAgent: (agentId: string) => void,
  deleteAgent: (agentId: string) => void,
  closeSettings: () => void,
) {
  if (route.kind === "channel") return <ChannelWorkspace auxiliary={channelAuxiliary} onAuxiliaryChange={setChannelAuxiliary} onSearchChannel={openSearch} />
  if (route.kind === "new-message") return <NewMessagePage />
  if (route.kind === "agents") return <AgentsWorkspace route={route} onCreateAgent={openCreateAgent} onEditAgent={openEditAgent} onDeleteAgent={deleteAgent} />
  if (route.kind === "settings") return <HostedSettingsPage section={route.section} onBack={closeSettings} />
  return <InboxPage />
}
