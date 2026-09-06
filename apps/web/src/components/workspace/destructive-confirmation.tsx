import type { ReactNode } from "react"
import type { Agent, Channel } from "@ada/protocol"
import { AlertTriangleIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface DestructiveConfirmationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  pending?: boolean
  error?: string
  onConfirm: () => void | Promise<void>
}

export function DestructiveConfirmation({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Continue",
  pending = false,
  error,
  onConfirm,
}: DestructiveConfirmationProps) {
  const confirm = async () => {
    if (pending) return
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // The owning surface keeps the dialog open and renders the operation error.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-alert-soft text-alert-ink"><AlertTriangleIcon aria-hidden /></AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void confirm()} disabled={pending}>{pending ? "Working…" : confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function DeleteChannelConfirmation({
  channel,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  channel: Pick<Channel, "name">
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  pending?: boolean
  error?: string
}) {
  return (
    <DestructiveConfirmation
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${channel.name}?`}
      description="This permanently removes the channel only when it has no history. If it contains messages or learning artifacts, archive it instead."
      confirmLabel="Delete channel"
      onConfirm={onConfirm}
      pending={pending}
      error={error}
    />
  )
}

export function DeleteAgentConfirmation({
  agent,
  open,
  onOpenChange,
  onConfirm,
  pending,
  error,
}: {
  agent: Pick<Agent, "name">
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  pending?: boolean
  error?: string
}) {
  return (
    <DestructiveConfirmation
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${agent.name}?`}
      description="The runner will stop working. Existing messages and direct-message history remain available as read-only history."
      confirmLabel="Delete agent"
      onConfirm={onConfirm}
      pending={pending}
      error={error}
    />
  )
}
