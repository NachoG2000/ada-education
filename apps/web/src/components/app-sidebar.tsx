/* Ada's sidebar over the shadcn primitives (inset variant). Drawers: Course · Work · Private · Members. */

import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { isAgent, useCommunity } from "@/lib/community"
import type { Channel, WorkStatus } from "@/lib/types"
import { MemberAvatar, PRESENCE_LABEL, agentInk } from "@/components/ada/identity"

const STATUS: Record<WorkStatus, { dot: string; label: string }> = {
  active: { dot: "bg-status-active", label: "active" },
  submitted: { dot: "bg-status-submitted", label: "submitted" },
  archived: { dot: "bg-status-archived", label: "archived" },
}

function ChannelItem({ channel }: { channel: Channel }) {
  const { activeChannelId, setActiveChannelId, community, member } = useCommunity()
  const active = channel.id === activeChannelId
  const cardsCount = community.cards.filter((c) => c.channelId === channel.id).length
  const dm = channel.group === "private" ? member(channel.memberIds.find((id) => id !== community.meId) ?? channel.memberIds[0]) : null

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        aria-current={active ? "page" : undefined}
        onClick={() => setActiveChannelId(channel.id)}
        className={cn(channel.unread && !active && "font-semibold", channel.work?.status === "archived" && !active && "text-ink-3")}
      >
        {channel.work ? (
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS[channel.work.status].dot)} />
        ) : dm ? (
          <MemberAvatar member={dm} size={18} />
        ) : (
          <span aria-hidden className="w-3 text-center text-[13px] text-ink-4">
            #
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
        {channel.unread && !active && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ink" />}
        {active && cardsCount > 0 && <span className="meta shrink-0 text-ink-3">{cardsCount} cards</span>}
        {channel.work && !active && (
          <span className="meta shrink-0 text-ink-4">
            {channel.work.status === "active" && channel.work.due ? `active · ${channel.work.due}` : STATUS[channel.work.status].label}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function Drawer({ label, count, action, children }: { label: string; count?: number; action?: boolean; children: React.ReactNode }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="label text-ink-3">
        {label}
        {typeof count === "number" && <span className="ml-1.5 font-normal">· {count}</span>}
      </SidebarGroupLabel>
      {action && (
        <SidebarGroupAction title={`New in ${label}`}>
          <PlusIcon />
          <span className="sr-only">New in {label}</span>
        </SidebarGroupAction>
      )}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { community, me, member } = useCommunity()
  const groups = (g: Channel["group"]) => community.channels.filter((c) => c.group === g)
  const presenceOrder = { publishing: 0, thinking: 1, online: 2, away: 3 } as const
  const members = [...community.members].sort((a, b) => presenceOrder[a.presence] - presenceOrder[b.presence])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" aria-label={`${community.name}, switch community`}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sun font-sans text-[15px] font-semibold text-sun-ink">
                {community.initial}
              </span>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13.5px] font-semibold">{community.name}</span>
                <span className="meta truncate text-ink-3">{community.subtitle}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 text-ink-3" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <Drawer label="Course" action>
          {groups("course").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Work" action>
          {groups("work").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Private" action>
          {groups("private").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Members" count={31}>
          {members.map((m) => (
            <SidebarMenuItem key={m.id}>
              <SidebarMenuButton className="text-ink-2">
                <MemberAvatar member={m} size={isAgent(m) ? 22 : 18} presence />
                <span className={cn("min-w-0 flex-1 truncate", isAgent(m) && "font-medium")} style={isAgent(m) ? { color: agentInk(m) } : undefined}>
                  {m.name}
                </span>
                <span className="meta shrink-0 truncate text-ink-4">
                  {m.kind === "person"
                  ? m.id === me.id
                    ? "you"
                    : m.role === "teacher"
                      ? "teacher"
                      : ""
                  : m.presence === "publishing" || m.presence === "thinking"
                    ? PRESENCE_LABEL[m.presence]
                    : m.scope === "personal"
                      ? "your agent"
                      : `${member(m.createdBy).name}'s`}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </Drawer>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <MemberAvatar member={me} size={28} presence />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13.5px] font-semibold">{me.name}</span>
                <span className="meta truncate text-ink-3">local key</span>
              </div>
              <kbd className="ml-auto rounded-md bg-panel-3 px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-ink-3">⌘K</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
