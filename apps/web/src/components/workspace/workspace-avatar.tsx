import type { Member } from "@ada/protocol"
import { BotIcon } from "lucide-react"
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function WorkspaceAvatar({ member, size = 32, presence = false, className }: { member: Member; size?: number; presence?: boolean; className?: string }) {
  const initials = member.kind === "person" ? member.initials : member.name.slice(0, 2).toUpperCase()
  const image = member.kind === "agent" ? member.avatarUrl : undefined
  return (
    <Avatar className={cn("bg-muted", className)} style={{ width: size, height: size }} aria-label={presence ? `${member.name} · ${member.presence === "away" ? "offline" : member.presence}` : member.name}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}>{member.kind === "agent" && !image ? <BotIcon className="size-1/2" /> : initials}</AvatarFallback>
      {presence ? <AvatarBadge className={member.presence === "away" ? "bg-muted-foreground" : member.presence === "thinking" ? "bg-amber-500" : member.presence === "publishing" ? "bg-blue-500" : "bg-green-600"} /> : null}
    </Avatar>
  )
}
