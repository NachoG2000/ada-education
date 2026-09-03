import { useId, useState, type FormEvent } from "react"
import type {
  Channel,
  ChannelVisibility,
  CreateChannelInput,
  UpdateChannelInput,
  WorkStatus,
} from "@ada/protocol"
import { HashIcon, LockIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export interface ChannelDialogValue {
  name: string
  description: string
  group: Channel["group"]
  visibility: ChannelVisibility
  memberIds: string[]
  agentIds: string[]
  workStatus: WorkStatus
  workDue: string
}

export interface ChannelOption {
  id: string
  label: string
  description?: string
  kind?: "person" | "agent"
}

export interface ChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: ChannelDialogValue
  onValueChange: (value: ChannelDialogValue) => void
  onSubmit: (input: CreateChannelInput | UpdateChannelInput) => void | Promise<void>
  channel?: Pick<Channel, "id" | "name" | "status">
  memberOptions?: ChannelOption[]
  agentOptions?: ChannelOption[]
  allowedGroups?: Channel["group"][]
  pending?: boolean
  error?: string
  onArchiveToggle?: () => void | Promise<void>
  onDelete?: () => void
}

function channelInput(value: ChannelDialogValue, editing: boolean): CreateChannelInput | UpdateChannelInput {
  const work = value.group === "work"
    ? { status: value.workStatus, due: value.workDue.trim() || undefined }
    : editing ? null : undefined

  if (editing) {
    return {
      name: value.name.trim(),
      description: value.description.trim() || null,
      group: value.group,
      visibility: value.visibility,
      work,
    }
  }

  return {
    name: value.name.trim(),
    description: value.description.trim() || undefined,
    group: value.group,
    visibility: value.visibility,
    memberIds: value.memberIds,
    agentIds: value.agentIds,
    work: work ?? undefined,
  }
}

export function ChannelDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  onSubmit,
  channel,
  memberOptions = [],
  agentOptions = [],
  allowedGroups = ["course", "work", "private"],
  pending = false,
  error,
  onArchiveToggle,
  onDelete,
}: ChannelDialogProps) {
  const nameId = useId()
  const descriptionId = useId()
  const editing = Boolean(channel)
  const [submitted, setSubmitted] = useState(false)
  const [memberQuery, setMemberQuery] = useState("")
  const validationError = value.name.trim() ? undefined : "Give this channel a name."
  const describedBy = error || (submitted && validationError) ? `${nameId}-error` : undefined
  const normalizedQuery = memberQuery.trim().toLowerCase()
  const visibleMembers = memberOptions.filter((option) => !normalizedQuery || `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalizedQuery))
  const visibleAgents = agentOptions.filter((option) => !normalizedQuery || `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalizedQuery))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    if (validationError || pending) return
    void onSubmit(channelInput(value, editing))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) { setSubmitted(false); setMemberQuery("") } onOpenChange(nextOpen) }}>
      <DialogContent className="max-h-[min(680px,calc(100vh-2rem))] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit channel" : "Create a channel"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the conversation space and who can see it." : "Create a focused space for course conversation."}
          </DialogDescription>
        </DialogHeader>

        <form id={`${nameId}-form`} onSubmit={submit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input id={nameId} value={value.name} onChange={(event) => onValueChange({ ...value, name: event.target.value })} placeholder="e.g. questions" autoFocus aria-invalid={Boolean(submitted && validationError)} aria-describedby={describedBy} disabled={pending} />
              {((submitted && validationError) || error) && <FieldError id={describedBy}>{submitted && validationError ? validationError : error}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor={descriptionId}>Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <Textarea id={descriptionId} value={value.description} onChange={(event) => onValueChange({ ...value, description: event.target.value })} placeholder="What belongs here?" rows={2} disabled={pending} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Drawer</FieldLabel>
                <Select value={value.group} onValueChange={(group) => group && onValueChange({ ...value, group: group as Channel["group"], visibility: group === "private" ? "private" : value.visibility })} disabled={pending}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedGroups.includes("course") ? <SelectItem value="course">Course</SelectItem> : null}
                    {allowedGroups.includes("work") ? <SelectItem value="work">Work</SelectItem> : null}
                    {allowedGroups.includes("private") ? <SelectItem value="private">Private</SelectItem> : null}
                  </SelectContent>
                </Select>
                <FieldDescription>Where it appears in the workspace.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Visibility</FieldLabel>
                <Select value={value.visibility} onValueChange={(visibility) => visibility && onValueChange({ ...value, visibility: visibility as ChannelVisibility })} disabled={pending || value.group === "private"}>
                  <SelectTrigger className="w-full">{value.visibility === "private" ? <LockIcon aria-hidden /> : <HashIcon aria-hidden />}<SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open to course members</SelectItem>
                    <SelectItem value="private">Private members only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {value.group === "work" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={value.workStatus} onValueChange={(status) => status && onValueChange({ ...value, workStatus: status as WorkStatus })} disabled={pending}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${nameId}-due`}>Due date <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
                  <Input id={`${nameId}-due`} type="date" value={value.workDue} onChange={(event) => onValueChange({ ...value, workDue: event.target.value })} disabled={pending} />
                </Field>
              </div>
            )}
          </FieldGroup>

          {(memberOptions.length > 0 || agentOptions.length > 0) && (
            <FieldGroup className="gap-3">
              <div>
                <FieldTitle>Members</FieldTitle>
                <FieldDescription>Start with the people and agents who should see this conversation.</FieldDescription>
              </div>
              <Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search people and agents" aria-label="Search people and agents" disabled={pending} />
              {visibleMembers.map((option) => (
                <Field key={option.id} orientation="horizontal" className="items-center rounded-lg border border-border/70 px-2.5 py-2">
                  <Checkbox checked={value.memberIds.includes(option.id)} onCheckedChange={(checked) => onValueChange({ ...value, memberIds: checked ? [...value.memberIds, option.id] : value.memberIds.filter((id) => id !== option.id) })} disabled={pending} aria-label={`Add ${option.label}`} />
                  <FieldLabel className="min-w-0 flex-1">
                    <span className="truncate">{option.label}</span>
                    {option.description && <span className="truncate text-xs font-normal text-muted-foreground">{option.description}</span>}
                  </FieldLabel>
                </Field>
              ))}
              {visibleAgents.map((option) => (
                <Field key={option.id} orientation="horizontal" className="items-center rounded-lg border border-border/70 px-2.5 py-2">
                  <Checkbox checked={value.agentIds.includes(option.id)} onCheckedChange={(checked) => onValueChange({ ...value, agentIds: checked ? [...value.agentIds, option.id] : value.agentIds.filter((id) => id !== option.id) })} disabled={pending} aria-label={`Add agent ${option.label}`} />
                  <FieldLabel className="min-w-0 flex-1">
                    <span className="truncate">{option.label}</span>
                    {option.description && <span className="truncate text-xs font-normal text-muted-foreground">{option.description}</span>}
                  </FieldLabel>
                </Field>
              ))}
              {visibleMembers.length === 0 && visibleAgents.length === 0 ? <p className="px-1 text-xs text-muted-foreground">No matching members.</p> : null}
            </FieldGroup>
          )}
        </form>

        <DialogFooter>
          {editing && onDelete ? <Button type="button" variant="destructive" onClick={onDelete} disabled={pending} className="sm:mr-auto">Delete</Button> : null}
          {editing && onArchiveToggle ? <Button type="button" variant="outline" onClick={() => { void Promise.resolve(onArchiveToggle()).catch(() => undefined) }} disabled={pending}>{channel && "status" in channel && channel.status === "archived" ? "Unarchive" : "Archive"}</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="submit" form={`${nameId}-form`} disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create channel"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
