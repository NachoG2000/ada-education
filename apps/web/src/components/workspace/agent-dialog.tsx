import { useId, useState, type FormEvent } from "react"
import type {
  Agent,
  AgentRuntime,
  CreateAgentInput,
  FigureColorName,
  UpdateAgentInput,
} from "@ada/protocol"
import { agentTemplates } from "@ada/protocol"
import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

export interface AgentDialogValue {
  name: string
  avatarUrl: string
  instructions: string
  scope: Agent["scope"]
  runtime: AgentRuntime
  model: string
  figureSeed: string
  figureColor?: FigureColorName
  channelIds: string[]
}

export interface AgentChannelOption {
  id: string
  label: string
  description?: string
}

export interface AgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: AgentDialogValue
  onValueChange: (value: AgentDialogValue) => void
  onSubmit: (input: CreateAgentInput | UpdateAgentInput) => void | Promise<void>
  agent?: Pick<Agent, "id" | "name" | "status" | "systemRole">
  channelOptions?: AgentChannelOption[]
  pending?: boolean
  error?: string
}

function agentInput(value: AgentDialogValue, editing: boolean): CreateAgentInput | UpdateAgentInput {
  const shared = {
    name: value.name.trim(),
    avatarUrl: value.avatarUrl.trim() || undefined,
    instructions: value.instructions.trim(),
    scope: value.scope,
    figureSeed: value.figureSeed.trim() || undefined,
    figureColor: value.figureColor,
    channelIds: value.channelIds,
  }
  return editing ? shared : { ...shared, scope: value.scope }
}

export function AgentDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  onSubmit,
  agent,
  channelOptions = [],
  pending = false,
  error,
}: AgentDialogProps) {
  const nameId = useId()
  const templateId = useId()
  const [template, setTemplate] = useState("custom")
  const instructionsId = useId()
  const editing = Boolean(agent)
  const [submitted, setSubmitted] = useState(false)
  const validationError = !value.name.trim() ? "Give this agent a name." : !value.instructions.trim() ? "Add instructions so the agent knows how to help." : undefined

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    if (validationError || pending) return
    void onSubmit(agentInput(value, editing))
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) { setSubmitted(false); setTemplate("custom") }; onOpenChange(nextOpen) }}>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[38rem]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit agent" : "Create an agent"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the rules and channels for this agent." : "Give your agent a name and rules. Ada handles the connection."}
          </DialogDescription>
        </DialogHeader>

        <form id={`${nameId}-form`} onSubmit={submit} className="grid gap-5">
          <FieldGroup>
            {!editing ? <Field>
              <FieldLabel htmlFor={templateId}>Start with</FieldLabel>
              <Select value={template} items={[{ value: "custom", label: "From scratch" }, ...agentTemplates.map((item) => ({ value: item.id, label: item.name }))]} disabled={pending} onValueChange={(id) => {
                if (!id) return
                setTemplate(id)
                const selected = agentTemplates.find((item) => item.id === id)
                onValueChange({ ...value, name: selected?.name ?? "", instructions: selected?.instructions ?? "" })
              }}>
                <SelectTrigger id={templateId} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="custom">From scratch</SelectItem>{agentTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
              <FieldDescription>{agentTemplates.find((item) => item.id === template)?.description ?? "Write your own rules, or choose an editable starting point."}</FieldDescription>
            </Field> : null}
            <Field>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input id={nameId} value={value.name} onChange={(event) => onValueChange({ ...value, name: event.target.value })} placeholder="e.g. Practice coach" autoFocus disabled={pending || agent?.systemRole === "ada"} />
            </Field>
            <Field>
              <FieldLabel htmlFor={instructionsId}>Rules</FieldLabel>
              <Textarea id={instructionsId} value={value.instructions} onChange={(event) => onValueChange({ ...value, instructions: event.target.value })} placeholder="Describe the agent's role, boundaries, and response style." rows={5} disabled={pending} aria-invalid={Boolean(validationError && value.name.trim())} />
              <FieldDescription>Describe how the agent should help, what it should avoid, and when to ask questions.</FieldDescription>
            </Field>
            {submitted && validationError && <FieldError>{validationError}</FieldError>}
            {error && <FieldError>{error}</FieldError>}

            {channelOptions.length > 0 && (
              <FieldGroup className="gap-3">
                <div>
                  <FieldTitle>Assigned channels</FieldTitle>
                  <FieldDescription>Choose where this agent can participate.</FieldDescription>
                </div>
                {channelOptions.map((option) => (
                  <Field key={option.id} orientation="horizontal" className="items-center rounded-lg border border-border/70 px-2.5 py-2">
                    <Checkbox checked={value.channelIds.includes(option.id)} onCheckedChange={(checked) => onValueChange({ ...value, channelIds: checked ? [...value.channelIds, option.id] : value.channelIds.filter((id) => id !== option.id) })} disabled={pending} aria-label={`Assign ${option.label}`} />
                    <FieldLabel className="min-w-0 flex-1"><span className="truncate">{option.label}</span>{option.description && <span className="truncate text-xs font-normal text-muted-foreground">{option.description}</span>}</FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="submit" form={`${nameId}-form`} disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create agent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
