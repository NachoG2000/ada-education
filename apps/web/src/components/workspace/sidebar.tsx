import { AdaMark } from "./ada-identity"
import { settingsSections } from "./settings-navigation"
import { NavigationItem as SidebarNavButton } from "./page-layout"
import { useState } from "react"
import {
  InboxIcon,
  BookOpenIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  HashIcon,
  LockIcon,
  MoreHorizontalIcon,
  MessageSquareIcon,
  LogOutIcon,
  PlusIcon,
  ArrowLeftIcon,
  SettingsIcon,
  SquarePenIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import type { AppRoute } from "@/lib/routes"
import { useAppNavigation } from "@/lib/routes"
import { useCommunity } from "@/lib/community"
import { cn } from "@/lib/utils"
import type { Channel } from "@/lib/types"
import { useHostedWorkspace } from "./hosted-context"
import type { ChannelAuxiliaryKind } from "./channel-details"
import { DestructiveConfirmation } from "./destructive-confirmation"
import { toast } from "@/components/ui/toast"

interface WorkspaceSidebarProps {
  route: AppRoute
  compact?: boolean
  onBrowseChannels: () => void
  onCreateChannel: (group: Channel["group"]) => void
  onCloseSettings: () => void
  onOpenChannelAuxiliary: (channelId: string, kind: ChannelAuxiliaryKind) => void
  onNavigate?: () => void
}

export function WorkspaceSidebar({
  route,
  compact = false,
  onBrowseChannels,
  onCreateChannel,
  onCloseSettings,
  onOpenChannelAuxiliary,
  onNavigate,
}: WorkspaceSidebarProps) {
  const { community, me, setActiveChannelId, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const courseChannels = community.channels.filter((channel) => channel.kind !== "dm" && channel.status !== "archived")
  const ada = community.members.find((member) => member.kind === "agent" && member.systemRole === "ada")
  const adaDm = community.channels.find((channel) => channel.kind === "dm" && channel.ownerId === me.id && channel.agentId === ada?.id)
  const [adaPending, setAdaPending] = useState(false)
  const openAda = async () => {
    if (!ada || adaPending) return
    setAdaPending(true)
    try { const channelId = adaDm?.id ?? await hosted.createAgentDm(ada.id); selectRoute({ kind: "channel", channelId }) }
    catch (error) { toast.add({ title: "Could not open Ada", description: error instanceof Error ? error.message : "Try again." }) }
    finally { setAdaPending(false) }
  }
  const directMessages = community.channels.filter((channel) => channel.kind === "dm" && channel.ownerId === me.id && channel.agentId !== ada?.id)
  const studentConversations = me.kind === "person" && me.role === "teacher"
    ? community.channels.filter((channel) => channel.kind === "dm" && channel.ownerId !== me.id)
    : []
  const [confirmation, setConfirmation] = useState<{ channel: Channel; action: "leave" | "archive" } | null>(null)
  const [mutationPending, setMutationPending] = useState(false)

  const selectRoute = (next: AppRoute) => {
    if (next.kind === "channel") setActiveChannelId(next.channelId)
    void navigateTo(next, { replace: route.kind === "settings" && next.kind === "settings" })
    onNavigate?.()
  }

  if (route.kind === "settings") {
    const sections = settingsSections(me.kind === "person" && me.role === "teacher")
    const active = sections.some((item) => item.section === route.section) ? route.section : "profile"
    const back = () => { onCloseSettings(); onNavigate?.() }
    return <aside className="flex h-full min-h-0 w-full flex-col text-sidebar-foreground" aria-label="Settings sidebar">
      <div className={cn("shrink-0 p-2", compact && "flex justify-center")}>
        {compact ? <CompactNavButton label="Back to workspace" onClick={back}><ArrowLeftIcon /></CompactNavButton> : <>
          <SidebarNavButton label="Back to workspace" icon={<ArrowLeftIcon />} onClick={back} />
          <h2 className="px-2 pb-2 pt-4 text-section font-semibold">Settings</h2>
        </>}
      </div>
      <nav aria-label="Settings sections" className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3", compact && "flex flex-col items-center")}>
        {sections.map((item) => compact
          ? <CompactNavButton key={item.section} label={item.label} active={active === item.section} onClick={() => selectRoute({ kind: "settings", section: item.section })}><item.icon /></CompactNavButton>
          : <SidebarNavButton key={item.section} label={item.label} icon={<item.icon />} active={active === item.section} onClick={() => selectRoute({ kind: "settings", section: item.section })} />)}
      </nav>
    </aside>
  }

  if (compact) {
    return (
      <aside className="flex h-full w-12 flex-col items-center py-2" aria-label="Collapsed course sidebar">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground" aria-label={community.name}>
          {community.initial || community.name.slice(0, 1).toUpperCase()}
        </div>
        <Separator className="my-2 w-7" />
        {ada ? <CompactNavButton label={adaPending ? "Opening Ada…" : "Ada"} active={route.kind === "channel" && route.channelId === adaDm?.id} onClick={() => void openAda()}><AdaMark className="size-6 rounded-md" /></CompactNavButton> : null}
        <CompactNavButton label="Inbox" active={route.kind === "inbox"} onClick={() => selectRoute({ kind: "inbox" })}><InboxIcon /></CompactNavButton>
        <CompactNavButton label="Course memory" active={route.kind === "memory"} onClick={() => selectRoute({ kind: "memory" })}><BookOpenIcon /></CompactNavButton>
        <CompactNavButton label="Agents" active={route.kind === "agents"} onClick={() => selectRoute({ kind: "agents" })}>
          <BotIcon />
        </CompactNavButton>
        <div className="mt-auto flex flex-col items-center gap-1">
          <CompactNavButton label="Settings" onClick={() => selectRoute({ kind: "settings" })}>
            <SettingsIcon />
          </CompactNavButton>
          <button type="button" onClick={hosted.requestSignOut} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Signed in as ${me.name}. Sign out.`}>
            <MemberAvatar member={me} size={28} presence />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col text-sidebar-foreground" aria-label="Course sidebar">
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" className="h-auto min-h-14 w-full justify-start gap-2 px-2 py-2 text-left" aria-label="Course menu" />
            }
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {community.initial || community.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{community.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{hosted.activeCommunity.term}</span></span>
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuGroup>
              {hosted.communities.map((item) => <DropdownMenuItem key={item.id} onClick={() => hosted.switchCommunity(item.id)}>{item.id === hosted.activeCommunity.id ? <CheckIcon /> : <span className="size-4" />}<span className="min-w-0 flex-1"><span className="block truncate">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.term}</span></span></DropdownMenuItem>)}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => selectRoute({ kind: "settings", section: "community" })}><SettingsIcon />Community settings</DropdownMenuItem>
              {me.kind === "person" && me.role === "teacher" ? <DropdownMenuItem onClick={hosted.requestInvite}><UserPlusIcon />Invite people</DropdownMenuItem> : null}
              <DropdownMenuItem onClick={onBrowseChannels}><HashIcon />Browse channels</DropdownMenuItem>
              <DropdownMenuItem onClick={hosted.requestAddCommunity}><PlusIcon />Add a community</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={!hosted.canLeaveCommunity} title={hosted.leaveCommunityBlockedReason} onClick={hosted.requestLeaveCommunity}><LogOutIcon />Leave community{hosted.leaveCommunityBlockedReason ? <span className="ml-auto text-xs">Another teacher required</span> : null}</DropdownMenuItem></DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="space-y-1 px-2 pb-2" aria-label="Primary">
        {ada ? <SidebarNavButton active={route.kind === "channel" && route.channelId === adaDm?.id} onClick={() => void openAda()} icon={<AdaMark className="size-5 rounded-md" />} label={adaPending ? "Opening Ada…" : "Ada"} /> : null}
        <SidebarNavButton active={route.kind === "inbox"} onClick={() => selectRoute({ kind: "inbox" })} icon={<InboxIcon />} label="Inbox" />
        <SidebarNavButton active={route.kind === "memory"} onClick={() => selectRoute({ kind: "memory" })} icon={<BookOpenIcon />} label="Course memory" />
        <SidebarNavButton active={route.kind === "agents"} onClick={() => selectRoute({ kind: "agents" })} icon={<BotIcon />} label="Agents" />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <ChannelGroup label="Channels" channels={courseChannels} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => onCreateChannel("course")} canCreate={me.kind === "person" && me.role === "teacher"} teacher={me.kind === "person" && me.role === "teacher"} onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} />
        <ChannelGroup label="Direct messages" channels={directMessages} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => selectRoute({ kind: "new-message" })} canCreate teacher={false} onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} />
        {studentConversations.length ? <ChannelGroup label="Student conversations" channels={studentConversations} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => undefined} canCreate={false} defaultOpen={false} teacher onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} /> : null}
        <div className="mt-2">
          <SidebarNavButton label="Browse channels" icon={<PlusIcon />} onClick={onBrowseChannels} />
        </div>
      </div>

      <div className="shrink-0 px-2 pb-2">
        <Separator className="mb-2 opacity-50" />
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50">
          <button type="button" onClick={() => selectRoute({ kind: "settings", section: "profile" })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open profile settings">
            <MemberAvatar member={me} size={30} presence />
          </button>
          <button type="button" onClick={() => selectRoute({ kind: "settings", section: "profile" })} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{me.kind === "person" ? me.role ?? "member" : "agent"}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Profile actions" />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => selectRoute({ kind: "settings" })}><SettingsIcon />Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={hosted.requestSignOut}><LogOutIcon />Sign out</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DestructiveConfirmation
        open={Boolean(confirmation)}
        onOpenChange={(open) => { if (!open) setConfirmation(null) }}
        title={confirmation?.action === "archive" ? `Archive #${confirmation.channel.name}?` : `Leave #${confirmation?.channel.name}?`}
        description={confirmation?.action === "archive" ? "History stays readable, but new messages are disabled." : "You can rejoin later if the channel remains public."}
        confirmLabel={confirmation?.action === "archive" ? "Archive channel" : "Leave channel"}
        pending={mutationPending}
        onConfirm={async () => {
          if (!confirmation) return
          setMutationPending(true)
          try {
            if (confirmation.action === "archive") await workspace.updateChannel(confirmation.channel.id, { status: "archived" })
            else await workspace.leaveChannel(confirmation.channel.id)
            setConfirmation(null)
            toast.add({ title: confirmation.action === "archive" ? "Channel archived" : "Channel left" })
            if (route.kind === "channel" && route.channelId === confirmation.channel.id) void navigateTo({ kind: "inbox" })
          } finally { setMutationPending(false) }
        }}
      />
    </aside>
  )
}

function ChannelGroup({
  label,
  channels,
  activeId,
  onSelect,
  onCreate,
  canCreate,
  defaultOpen = true,
  teacher,
  onDetails,
  onConfirm,
}: {
  label: string
  channels: Channel[]
  activeId?: string
  onSelect: (channelId: string) => void
  onCreate: () => void
  canCreate: boolean
  defaultOpen?: boolean
  teacher: boolean
  onDetails: (channelId: string, kind: ChannelAuxiliaryKind) => void
  onConfirm: (value: { channel: Channel; action: "leave" | "archive" }) => void
}) {
  const { member } = useCommunity()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <div className="group/section flex min-h-9 items-center gap-1">
        <CollapsibleTrigger
          render={<button type="button" className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" />}
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          <span className="truncate">{label}</span>
        </CollapsibleTrigger>
        {canCreate ? (
          <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={onCreate} aria-label={label === "Direct messages" ? "New message" : "Create channel"}>
            {label === "Direct messages" ? <SquarePenIcon /> : <PlusIcon />}
          </Button>
        ) : null}
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-px">
          {channels.map((channel) => (
            <ContextMenu key={channel.id}>
            <ContextMenuTrigger render={<button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel.id)}
              aria-label={channel.name}
              data-slot="navigation-item"
              aria-current={channel.id === activeId ? "page" : undefined}
              className={cn(
                "group/channel transition-colors aria-[current=page]:hover:bg-sidebar-accent dark:aria-[current=page]:hover:bg-sidebar-accent flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
                channel.id === activeId && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                channel.status === "archived" && "text-sidebar-foreground/50",
              )}
            />}>
              {channel.kind === "dm" ? (channel.agentId ? <MemberAvatar member={member(channel.agentId)} size={20} /> : <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />) : channel.visibility === "private" || channel.group === "private" ? <LockIcon className="size-4 shrink-0 text-muted-foreground" /> : <HashIcon className="size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{channel.name}</span>
              {channel.status === "archived" ? <Badge variant="secondary" className="px-1 py-0 text-xs leading-4">Archived</Badge> : null}
              {channel.unread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => onSelect(channel.id)}>{channel.kind === "dm" ? <MessageSquareIcon /> : <HashIcon />}Open</ContextMenuItem>
                <ContextMenuItem onClick={() => { void navigator.clipboard.writeText(channel.kind === "dm" ? channel.name : `#${channel.name}`); toast.add({ title: channel.kind === "dm" ? "Name copied" : "Channel name copied" }) }}><CheckIcon />Copy name</ContextMenuItem>
                <ContextMenuItem onClick={() => onDetails(channel.id, "members")}><UsersIcon />View members</ContextMenuItem>
                {teacher && channel.kind !== "dm" ? <ContextMenuItem onClick={() => onDetails(channel.id, "settings")}><SettingsIcon />Channel settings</ContextMenuItem> : null}
              </ContextMenuGroup>
              {channel.kind !== "dm" ? <><ContextMenuSeparator /><ContextMenuGroup>{teacher ? <ContextMenuItem variant="destructive" onClick={() => onConfirm({ channel, action: "archive" })}>Archive channel</ContextMenuItem> : <ContextMenuItem variant="destructive" onClick={() => onConfirm({ channel, action: "leave" })}>Leave channel</ContextMenuItem>}</ContextMenuGroup></> : null}
            </ContextMenuContent>
            </ContextMenu>
          ))}
          {channels.length === 0 ? <p className="px-2 py-1 text-xs text-sidebar-foreground/50">{label === "Channels" ? "No channels yet" : `No ${label.toLowerCase()} yet`}</p> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CompactNavButton({ label, active, children, onClick }: { label: string; active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button type="button" variant={active ? "secondary" : "ghost"} size="icon-sm" onClick={onClick} aria-label={label} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
