import type { Member } from "@ada/protocol"
import { BotIcon, MessageSquareIcon, SettingsIcon } from "lucide-react"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function MemberProfilePopover({
  member,
  children,
  onMessage,
  onManage,
  className,
}: {
  member: Member
  children: React.ReactNode
  onMessage?: () => void
  onManage?: () => void
  className?: string
}) {
  const presence = member.presence === "away" ? "Offline" : member.presence[0].toUpperCase() + member.presence.slice(1)
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" className={cn("rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} />}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-4 p-4">
        <div className="flex items-start gap-3">
          <MemberAvatar member={member} size={48} presence />
          <PopoverHeader className="min-w-0 flex-1 pt-0.5">
            <PopoverTitle className="truncate text-base">{member.name}</PopoverTitle>
            <PopoverDescription className="flex flex-wrap items-center gap-1.5">
              {member.kind === "person" ? member.role ?? "member" : `${member.runtime ?? "runner"} · ${member.model ?? member.provider.model}`}
            </PopoverDescription>
          </PopoverHeader>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge variant="outline"><span className={cn("size-1.5 rounded-full", member.presence === "away" ? "bg-muted-foreground/50" : "bg-ok")} />{presence}</Badge>
        </div>
        {member.kind === "agent" ? (
          <div className="flex gap-2">
            {onMessage ? <Button type="button" size="sm" className="flex-1" onClick={onMessage}><MessageSquareIcon />Message</Button> : null}
            {onManage ? <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onManage}><SettingsIcon />Manage</Button> : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><BotIcon className="size-3.5" />Community member</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
