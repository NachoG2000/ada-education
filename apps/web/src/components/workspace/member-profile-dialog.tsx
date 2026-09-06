import type { Member } from "@ada/protocol"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function MemberProfileDialog({ member, onOpenChange }: { member: Member; onOpenChange: (open: boolean) => void }) {
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Profile</DialogTitle><DialogDescription>Community identity and current presence.</DialogDescription></DialogHeader><div className="flex items-center gap-4 rounded-md border p-4"><MemberAvatar member={member} size={48} presence /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{member.name}</p><p className="truncate text-sm text-muted-foreground">{member.kind === "person" ? member.role : `${member.runtime} · ${member.model ?? member.provider.model}`}</p></div><Badge variant="outline">{member.presence === "away" ? "Offline" : member.presence}</Badge></div></DialogContent></Dialog>
}
