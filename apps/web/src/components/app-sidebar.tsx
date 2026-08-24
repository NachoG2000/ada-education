/* Ada's sidebar over the shadcn primitives (inset variant). Drawers: Course · Work · Private · Members. */

import { ChevronsUpDownIcon, GraduationCapIcon, LayersIcon, LinkIcon, PlusIcon } from "lucide-react"
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
import { useState } from "react"
import { isAgent, isTeacher, useCommunity } from "@/lib/community"
import type { Channel, Member, WorkStatus } from "@/lib/types"
import { MemberAvatar, PRESENCE_LABEL, agentInk } from "@/components/ada/identity"

const STATUS: Record<WorkStatus, { dot: string; label: string }> = {
  active: { dot: "bg-status-active", label: "active" },
  submitted: { dot: "bg-status-submitted", label: "submitted" },
  archived: { dot: "bg-status-archived", label: "archived" },
}

function ChannelItem({ channel }: { channel: Channel }) {
  const { activeChannelId, showChannel, community, member, view } = useCommunity()
  const active = view === "channel" && channel.id === activeChannelId
  const cardsCount = community.cards.filter((c) => c.channelId === channel.id).length
  const dm = channel.group === "private" ? member(channel.memberIds.find((id) => id !== community.meId) ?? channel.memberIds[0]) : null

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        aria-current={active ? "page" : undefined}
        onClick={() => showChannel(channel.id)}
        className={cn(channel.unread && !active && "font-semibold", channel.work?.status === "archived" && !active && "text-ink-3")}
      >
        {channel.work ? (
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS[channel.work.status].dot)} />
        ) : dm ? (
          <MemberAvatar member={dm} size={18} />
        ) : (
          <span aria-hidden className="w-3 text-center text-[13px] text-ink-3">
            #
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{channel.name}</span>
        {channel.unread && !active && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ink" />}
        {active && cardsCount > 0 && (
          <span className="meta shrink-0 text-ink-3">
            {cardsCount} {cardsCount === 1 ? "card" : "cards"}
          </span>
        )}
        {channel.work && !active && (
          <span className="meta shrink-0 text-ink-3">
            {channel.work.status === "active" && channel.work.due ? `active · ${channel.work.due}` : STATUS[channel.work.status].label}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** The role landing page, above every drawer: "Modules" for the teacher,
    "My study" for a student. Agents don't get one — there's no client for
    them to click it from. */
function RoleEntry() {
  const { me, view, goTo } = useCommunity()
  if (me.kind !== "person") return null
  const teacher = isTeacher(me)
  const target = teacher ? "modules" : "home"
  const active = view === target
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={active} aria-current={active ? "page" : undefined} onClick={() => goTo(target)}>
              {teacher ? <LayersIcon /> : <GraduationCapIcon />}
              <span className="min-w-0 flex-1 truncate">{teacher ? "Modules" : "My study"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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

/** A member in the drawer. An agent's row opens its sheet in the contextual
    panel — the only place the sheet can be reached from a channel with no cards
    and no threads. A person has no sheet yet, so their row informs and doesn't
    pretend to be a button. */
function MemberItem({ member: m }: { member: Member }) {
  const { me, member, panels, openAgent } = useCommunity()
  const open = panels.some((p) => p.kind === "agent" && p.agentId === m.id)
  const note =
    m.kind === "person"
      ? m.id === me.id
        ? "you"
        : isTeacher(m)
          ? "teacher"
          : ""
      : m.presence === "publishing" || m.presence === "thinking"
        ? PRESENCE_LABEL[m.presence]
        : m.scope === "personal"
          ? "your agent"
          : `${member(m.createdBy).name}'s`
  const content = (
    <>
      <MemberAvatar member={m} size={isAgent(m) ? 22 : 18} presence />
      <span className={cn("min-w-0 flex-1 truncate", isAgent(m) && "font-medium")} style={isAgent(m) ? { color: agentInk(m) } : undefined}>
        {m.name}
      </span>
      <span className="meta shrink-0 truncate text-ink-3">{note}</span>
    </>
  )

  return (
    <SidebarMenuItem>
      {isAgent(m) ? (
        <SidebarMenuButton
          className="text-ink-2"
          isActive={open}
          aria-current={open ? "page" : undefined}
          title={`Open ${m.name}'s sheet`}
          onClick={() => openAgent(m.id)}
        >
          {content}
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          render={<div />}
          className="cursor-default text-ink-2 hover:bg-transparent hover:text-ink-2 active:bg-transparent active:text-ink-2"
        >
          {content}
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  )
}

/** Teacher-only: mints a single-use invite and puts the full link on the
    clipboard (DECISIONS.md §20). Connected mode only — demo has no server. */
function InviteButton() {
  const { createInvite } = useCommunity()
  const [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle")
  const [link, setLink] = useState<string | null>(null)
  if (!createInvite) return null
  const mint = async () => {
    if (state === "busy") return
    setState("busy")
    setLink(null)
    try {
      const { joinHash } = await createInvite()
      const minted = `${location.origin}${location.pathname}${joinHash}`
      try {
        await navigator.clipboard.writeText(minted)
        setState("copied")
      } catch {
        // No clipboard (permissions, plain http): show the link right here
        // instead. Never a blocking dialog.
        setLink(minted)
        setState("idle")
        return
      }
      setTimeout(() => setState("idle"), 2500)
    } catch {
      setState("failed")
      setTimeout(() => setState("idle"), 2500)
    }
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton title="Invite a student (single-use link)" onClick={() => void mint()}>
        <LinkIcon className="size-4" />
        <span className="text-[13px]">
          {state === "copied" ? "Invite link copied" : state === "failed" ? "Couldn't mint the invite" : state === "busy" ? "Minting link…" : "Invite a student"}
        </span>
      </SidebarMenuButton>
      {link ? (
        <input
          readOnly
          aria-label="Invite link"
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-1 h-7 w-full rounded-control border border-line bg-panel-2 px-2 font-mono text-[11px] text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-seal"
        />
      ) : null}
    </SidebarMenuItem>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { community, me, switchPerson } = useCommunity()
  // A channel that names its members is listed only for them (a student's DM
  // with their agent, #teachers); one with no member list (the demo's) is open
  // to everyone. Not mutated on the community, just left off the list.
  const groups = (g: Channel["group"]) =>
    community.channels.filter((c) => c.group === g && (c.memberIds.length === 0 || c.memberIds.includes(me.id)))
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
        <RoleEntry />
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
        <Drawer label="Members" count={members.length}>
          {members.map((m) => (
            <MemberItem key={m.id} member={m} />
          ))}
        </Drawer>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isTeacher(me) ? <InviteButton /> : null}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" title="Switch person" onClick={switchPerson}>
              <MemberAvatar member={me} size={28} presence />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13.5px] font-semibold">{me.name}</span>
                <span className="meta truncate text-ink-3">switch person</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
