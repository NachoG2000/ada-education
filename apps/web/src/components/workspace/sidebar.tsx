import { useState } from "react"
import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  HashIcon,
  LockIcon,
  MoreHorizontalIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
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
  onOpenSearch: () => void
  onOpenChannelAuxiliary: (channelId: string, kind: ChannelAuxiliaryKind) => void
  onNavigate?: () => void
}

export function WorkspaceSidebar({
  route,
  compact = false,
  onBrowseChannels,
  onCreateChannel,
  onOpenSearch,
  onOpenChannelAuxiliary,
  onNavigate,
}: WorkspaceSidebarProps) {
  const { community, me, setActiveChannelId, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const courseChannels = community.channels.filter((channel) => channel.kind !== "dm" && channel.status !== "archived")
  const directMessages = community.channels.filter((channel) => channel.kind === "dm" && channel.ownerId === me.id)
  const studentConversations = me.kind === "person" && me.role === "teacher"
    ? community.channels.filter((channel) => channel.kind === "dm" && channel.ownerId !== me.id)
    : []
  const [confirmation, setConfirmation] = useState<{ channel: Channel; action: "leave" | "archive" } | null>(null)
  const [mutationPending, setMutationPending] = useState(false)

  const selectRoute = (next: AppRoute) => {
    if (next.kind === "channel") setActiveChannelId(next.channelId)
    void navigateTo(next)
    onNavigate?.()
  }

  if (compact) {
    return (
      <aside className="flex h-full w-12 flex-col items-center py-2" aria-label="Collapsed course sidebar">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground" aria-label={community.name}>
          {community.initial || community.name.slice(0, 1).toUpperCase()}
        </div>
        <Separator className="my-2 w-7" />
        <CompactNavButton label="Search" onClick={onOpenSearch}><SearchIcon /></CompactNavButton>
        <CompactNavButton label="Agents" active={route.kind === "agents"} onClick={() => selectRoute({ kind: "agents" })}>
          <BotIcon />
        </CompactNavButton>
        <div className="mt-auto flex flex-col items-center gap-1">
          <CompactNavButton label="Settings" active={route.kind === "settings"} onClick={() => selectRoute({ kind: "settings" })}>
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
      <div className="px-3 pb-2 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" className="w-full justify-start px-2 text-left" aria-label="Course menu" />
            }
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {community.initial || community.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{community.name}</span><span className="block truncate text-[10px] font-normal text-sidebar-foreground/55">{hosted.activeCommunity.term}</span></span>
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

      <nav className="px-2" aria-label="Primary">
        <SidebarNavButton active={route.kind === "agents"} onClick={() => selectRoute({ kind: "agents" })} icon={<BotIcon />} label="Agents" />
      </nav>

      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-full items-center gap-2 rounded-md bg-background/35 px-2.5 text-left text-xs text-sidebar-foreground/65 outline-none hover:bg-background/55 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <SearchIcon aria-hidden className="size-3.5" />
          <span className="flex-1">Search</span>
          <kbd className="font-sans text-[10px]">⌘K</kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        <ChannelGroup label="Channels" channels={courseChannels} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => onCreateChannel("course")} canCreate={me.kind === "person" && me.role === "teacher"} teacher={me.kind === "person" && me.role === "teacher"} onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} />
        <ChannelGroup label="Direct messages" channels={directMessages} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => selectRoute({ kind: "new-message" })} canCreate teacher={false} onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} />
        {studentConversations.length ? <ChannelGroup label="Student conversations" channels={studentConversations} activeId={route.kind === "channel" ? route.channelId : undefined} onSelect={(channelId) => selectRoute({ kind: "channel", channelId })} onCreate={() => undefined} canCreate={false} defaultOpen={false} teacher onDetails={onOpenChannelAuxiliary} onConfirm={setConfirmation} /> : null}
        <div className="mt-2 px-1">
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onBrowseChannels}>
            <PlusIcon data-icon="inline-start" />Browse channels
          </Button>
        </div>
      </div>

      <div className="shrink-0 px-2 pb-2">
        <Separator className="mb-2 opacity-50" />
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent">
          <button type="button" onClick={() => selectRoute({ kind: "settings", section: "profile" })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open profile settings">
            <MemberAvatar member={me} size={30} presence />
          </button>
          <button type="button" onClick={() => selectRoute({ kind: "settings", section: "profile" })} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
            <span className="block truncate text-sm font-medium">{me.name}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/60">{me.kind === "person" ? me.role ?? "member" : "agent"}</span>
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
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <div className="group/section flex h-7 items-center gap-1 px-1">
        <CollapsibleTrigger
          render={<button type="button" className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 text-left text-[11px] font-medium text-sidebar-foreground/55 outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" />}
        >
          <ChevronDownIcon className={cn("size-3 transition-transform", !open && "-rotate-90")} />
          <span className="truncate">{label}</span>
        </CollapsibleTrigger>
        {canCreate ? (
          <Button type="button" variant="ghost" size="icon-xs" className="opacity-70 sm:opacity-0 sm:group-hover/section:opacity-100 focus-visible:opacity-100" onClick={onCreate} aria-label={label === "Direct messages" ? "New message" : "Create channel"}>
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
              aria-current={channel.id === activeId ? "page" : undefined}
              className={cn(
                "group/channel flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                channel.id === activeId && "bg-background/80 font-medium text-sidebar-accent-foreground",
                channel.status === "archived" && "text-sidebar-foreground/50",
              )}
            />}>
              {channel.visibility === "private" || channel.group === "private" ? <LockIcon className="size-3.5 shrink-0 opacity-60" /> : <HashIcon className="size-3.5 shrink-0 opacity-60" />}
              <span className="min-w-0 flex-1 truncate">{channel.name}</span>
              {channel.status === "archived" ? <Badge variant="secondary" className="px-1 py-0 text-[9px] leading-4">Archived</Badge> : null}
              {channel.unread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => onSelect(channel.id)}><HashIcon />Open</ContextMenuItem>
                <ContextMenuItem onClick={() => { void navigator.clipboard.writeText(`#${channel.name}`); toast.add({ title: "Channel name copied" }) }}><CheckIcon />Copy name</ContextMenuItem>
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

function SidebarNavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "bg-background/80 font-medium",
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
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
