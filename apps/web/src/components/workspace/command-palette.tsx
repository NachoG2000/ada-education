import type { LucideIcon } from "lucide-react"
import { BotIcon, HashIcon, MessageSquareIcon, SearchIcon, UserIcon } from "lucide-react"
import type { Channel, Member, Message } from "@ada/protocol"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export interface CommandPaletteAction {
  id: string
  label: string
  description?: string
  shortcut?: string
  keywords?: string[]
  icon?: LucideIcon
  onSelect: () => void
}

export interface CommandPaletteChannel {
  channel: Channel
  onSelect: () => void
}

export interface CommandPaletteMember {
  member: Member
  onSelect: () => void
}

export interface CommandPaletteMessage {
  message: Message
  channelLabel: string
  authorLabel: string
  onSelect: () => void
}

export interface WorkspaceCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channels?: CommandPaletteChannel[]
  members?: CommandPaletteMember[]
  messages?: CommandPaletteMessage[]
  actions?: CommandPaletteAction[]
  placeholder?: string
}

function messagePreview(message: Message): string {
  return message.paragraphs.flatMap((paragraph) => paragraph.map((block) => block.text)).join(" ").trim() || "Untitled message"
}

function closeAndRun(onOpenChange: (open: boolean) => void, onSelect: () => void): void {
  onOpenChange(false)
  onSelect()
}

export function WorkspaceCommandPalette({
  open,
  onOpenChange,
  channels = [],
  members = [],
  messages = [],
  actions = [],
  placeholder = "Search channels, direct messages, people, agents, or actions…",
}: WorkspaceCommandPaletteProps) {
  const courseChannels = channels.filter(({ channel }) => channel.kind !== "dm")
  const directMessages = channels.filter(({ channel }) => channel.kind === "dm")
  const people = members.filter(({ member }) => member.kind === "person")
  const agents = members.filter(({ member }) => member.kind === "agent")
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Ada" description="Find a channel, direct message, person, agent, or workspace action.">
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No matching workspace results.</CommandEmpty>

        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((action) => {
              const Icon = action.icon ?? SearchIcon
              return (
                <CommandItem key={action.id} value={`${action.label} ${action.description ?? ""} ${(action.keywords ?? []).join(" ")}`} onSelect={() => closeAndRun(onOpenChange, action.onSelect)}>
                  <Icon aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{action.label}{action.description && <span className="ml-2 text-xs text-muted-foreground">{action.description}</span>}</span>
                  {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {actions.length > 0 && (channels.length > 0 || members.length > 0 || messages.length > 0) && <CommandSeparator />}

        {courseChannels.length > 0 && (
          <CommandGroup heading="Channels">
            {courseChannels.map(({ channel, onSelect }) => (
              <CommandItem key={channel.id} value={`${channel.name} ${channel.description ?? ""} ${channel.group}`} onSelect={() => closeAndRun(onOpenChange, onSelect)}>
                <HashIcon aria-hidden />
                <span className="min-w-0 flex-1 truncate">{channel.name}<span className="ml-2 text-xs text-muted-foreground">{channel.group}</span></span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {directMessages.length > 0 && (
          <CommandGroup heading="Direct messages">
            {directMessages.map(({ channel, onSelect }) => <CommandItem key={channel.id} value={`${channel.name} direct message`} onSelect={() => closeAndRun(onOpenChange, onSelect)}><MessageSquareIcon /><span className="truncate">{channel.name}</span></CommandItem>)}
          </CommandGroup>
        )}

        {people.length > 0 && (
          <CommandGroup heading="People">
            {people.map(({ member, onSelect }) => {
              return (
                <CommandItem key={member.id} value={`${member.name} ${member.kind} ${member.kind === "agent" ? member.description ?? "" : ""}`} onSelect={() => closeAndRun(onOpenChange, onSelect)}>
                  <UserIcon aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{member.name}<span className="ml-2 text-xs text-muted-foreground">person</span></span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {agents.length > 0 && (
          <CommandGroup heading="Agents">
            {agents.map(({ member, onSelect }) => <CommandItem key={member.id} value={`${member.name} agent ${member.kind === "agent" ? member.description ?? "" : ""}`} onSelect={() => closeAndRun(onOpenChange, onSelect)}><BotIcon /><span className="min-w-0 flex-1 truncate">{member.name}<span className="ml-2 text-xs text-muted-foreground">agent</span></span></CommandItem>)}
          </CommandGroup>
        )}

        {messages.length > 0 && (
          <CommandGroup heading="Messages">
            {messages.map(({ message, channelLabel, authorLabel, onSelect }) => (
              <CommandItem key={message.id} value={`${messagePreview(message)} ${channelLabel} ${authorLabel}`} onSelect={() => closeAndRun(onOpenChange, onSelect)}>
                <MessageSquareIcon aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{messagePreview(message)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{authorLabel} in {channelLabel}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
