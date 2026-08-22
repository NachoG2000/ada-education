/* Sidebar de Ada sobre las primitivas de shadcn (variante inset). Cajones: Curso · Trabajo · Privados · Miembros. */

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
  activo: { dot: "bg-estado-activo", label: "activo" },
  entregado: { dot: "bg-estado-entregado", label: "entregado" },
  archivado: { dot: "bg-estado-archivado", label: "archivado" },
}

function ChannelItem({ channel }: { channel: Channel }) {
  const { activeChannelId, setActiveChannelId, community, member } = useCommunity()
  const active = channel.id === activeChannelId
  const pagesCount = community.pages.filter((p) => p.channelId === channel.id).length
  const dm = channel.group === "privados" ? member(channel.memberIds.find((id) => id !== community.meId) ?? channel.memberIds[0]) : null

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => setActiveChannelId(channel.id)}
        className={cn(channel.unread && !active && "font-semibold", channel.work?.status === "archivado" && !active && "text-ink-3")}
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
        {active && pagesCount > 0 && <span className="meta shrink-0 text-ink-3">{pagesCount} fichas</span>}
        {channel.work && !active && (
          <span className="meta shrink-0 text-ink-4">
            {channel.work.status === "activo" && channel.work.due ? `activo · ${channel.work.due}` : STATUS[channel.work.status].label}
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
        <SidebarGroupAction title={`Nuevo en ${label}`}>
          <PlusIcon />
          <span className="sr-only">Nuevo en {label}</span>
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
  const presenceOrder = { publicando: 0, pensando: 1, "en-linea": 2, ausente: 3 } as const
  const members = [...community.members].sort((a, b) => presenceOrder[a.presence] - presenceOrder[b.presence])

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" aria-label="Cambiar de comunidad">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sol font-serif text-[15px] font-semibold text-sol-ink">
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
        <Drawer label="Curso" action>
          {groups("curso").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Trabajo" action>
          {groups("trabajo").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Privados" action>
          {groups("privados").map((c) => (
            <ChannelItem key={c.id} channel={c} />
          ))}
        </Drawer>
        <Drawer label="Miembros" count={31}>
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
                    ? "vos"
                    : m.role === "profesor"
                      ? "profesor"
                      : ""
                  : m.presence === "publicando" || m.presence === "pensando"
                    ? PRESENCE_LABEL[m.presence]
                    : m.scope === "personal"
                      ? "tu agente"
                      : `de ${member(m.createdBy).name}`}
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
                <span className="meta truncate text-ink-3">clave local</span>
              </div>
              <kbd className="ml-auto rounded-md bg-panel-3 px-1.5 py-0.5 font-sans text-[10.5px] font-medium text-ink-3">⌘K</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
