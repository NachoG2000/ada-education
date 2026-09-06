import { useState } from "react"
import type { Agent, AgentEnrollment } from "@ada/protocol"
import { CheckIcon, ClipboardIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useClock } from "./use-clock"

export function AgentEnrollmentDialog({ enrollment, agent, onDone }: { enrollment: AgentEnrollment | null; agent?: Agent; onDone: () => void }) {
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState<"command" | "token" | null>(null)
  const now = useClock()

  if (!enrollment) return null
  const online = agent?.presence && agent.presence !== "away"
  const issuedAt = new Date(enrollment.issuedAt ?? agent?.createdAt ?? 0).getTime()
  const status = online ? "Runner online" : issuedAt && now - issuedAt < 15_000 ? "Starting…" : "Waiting for runner"
  const copy = async (kind: "command" | "token", value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => current === kind ? null : current), 2_000)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDone() }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-xl">
        <DialogHeader><DialogTitle>Connect a runner</DialogTitle><DialogDescription>The setup command and enrollment token are shown only in this step. Provider credentials stay on the runner machine.</DialogDescription></DialogHeader>
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Connection status</span><span className="flex items-center gap-2 font-medium"><span className={`size-2 rounded-full ${online ? "bg-green-600" : "bg-muted-foreground/40"}`} />{status}</span></div>
        <div className="space-y-2"><p className="text-sm font-medium">Setup command</p><pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-5"><code>{enrollment.setupCommand}</code></pre><Button type="button" variant="outline" className="w-full" onClick={() => void copy("command", enrollment.setupCommand)}>{copied === "command" ? <CheckIcon /> : <ClipboardIcon />}{copied === "command" ? "Copied" : "Copy setup command"}</Button></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium">Raw enrollment token</p><Button type="button" variant="ghost" size="sm" onClick={() => setShowToken((shown) => !shown)}>{showToken ? <EyeOffIcon /> : <EyeIcon />}{showToken ? "Hide" : "Reveal"}</Button></div>{showToken ? <><code className="block break-all rounded-md border bg-muted/40 p-3 text-xs">{enrollment.runnerToken}</code><Button type="button" variant="outline" className="w-full" onClick={() => void copy("token", enrollment.runnerToken)}>{copied === "token" ? <CheckIcon /> : <ClipboardIcon />}{copied === "token" ? "Copied" : "Copy token"}</Button></> : <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">Hidden by default. The setup command already includes it.</p>}</div>
        <DialogFooter><Button type="button" onClick={onDone}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
