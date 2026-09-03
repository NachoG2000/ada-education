import { useId, useState, type FormEvent } from "react"
import type {
  Agent,
  AgentRuntime,
  CreateAgentInput,
  FigureColorName,
  UpdateAgentInput,
} from "@ada/protocol"
import { BotIcon, DicesIcon, LockKeyholeIcon, UsersIcon } from "lucide-react"
import { AgentFigure } from "@/components/ada/identity"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FIGURE_COLORS } from "@/lib/figure"

export interface AgentDialogValue {
  name: string
  description: string
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
  agent?: Pick<Agent, "id" | "name" | "status">
  channelOptions?: AgentChannelOption[]
  canUseCommunityScope?: boolean
  onRerollFigure?: (currentSeed: string) => string
  pending?: boolean
  error?: string
  onStatusToggle?: () => void | Promise<void>
  onDelete?: () => void
}

function agentInput(value: AgentDialogValue, editing: boolean): CreateAgentInput | UpdateAgentInput {
  const shared = {
    name: value.name.trim(),
    description: value.description.trim() || undefined,
    instructions: value.instructions.trim(),
    scope: value.scope,
    runtime: value.runtime,
    model: value.model.trim() || undefined,
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
  canUseCommunityScope = false,
  onRerollFigure,
  pending = false,
  error,
  onStatusToggle,
  onDelete,
}: AgentDialogProps) {
  const nameId = useId()
  const descriptionId = useId()
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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setSubmitted(false); onOpenChange(nextOpen) }}>
      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[38rem]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit agent" : "Create an agent"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update instructions, runner setup, and channel access." : "Give an education agent a clear role in the course workspace."}
          </DialogDescription>
        </DialogHeader>

        <form id={`${nameId}-form`} onSubmit={submit} className="grid gap-5 lg:grid-cols-[7rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/50 px-3 py-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-background ring-1 ring-border/70">
              <AgentFigure agent={{ kind: "agent", id: agent?.id ?? "new-agent", name: value.name || "New agent", scope: value.scope, createdBy: "", instructions: value.instructions, provider: { mode: "subscription", model: value.model }, channelIds: value.channelIds, presence: "away", figureSeed: value.figureSeed, figureColor: value.figureColor, runtime: value.runtime, model: value.model }} size={56} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onRerollFigure && onValueChange({ ...value, figureSeed: onRerollFigure(value.figureSeed || value.name || "new-agent") })} disabled={pending || !onRerollFigure}>
              <DicesIcon /> Roll another
            </Button>
            <span className="text-center text-[11px] leading-snug text-muted-foreground">A deterministic figure identifies this agent.</span>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input id={nameId} value={value.name} onChange={(event) => onValueChange({ ...value, name: event.target.value })} placeholder="e.g. Ada" autoFocus disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={descriptionId}>Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <Input id={descriptionId} value={value.description} onChange={(event) => onValueChange({ ...value, description: event.target.value })} placeholder="What this agent helps with" disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={instructionsId}>Instructions</FieldLabel>
              <Textarea id={instructionsId} value={value.instructions} onChange={(event) => onValueChange({ ...value, instructions: event.target.value })} placeholder="Describe the agent's role, boundaries, and response style." rows={5} disabled={pending} aria-invalid={Boolean(validationError && value.name.trim())} />
              <FieldDescription>Provider credentials stay in the external runner, never in Ada.</FieldDescription>
            </Field>
            {submitted && validationError && <FieldError>{validationError}</FieldError>}
            {error && <FieldError>{error}</FieldError>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Scope</FieldLabel>
                <Select value={value.scope} onValueChange={(scope) => scope && onValueChange({ ...value, scope: scope as Agent["scope"] })} disabled={pending}>
                  <SelectTrigger className="w-full">{value.scope === "personal" ? <LockKeyholeIcon aria-hidden /> : <UsersIcon aria-hidden />}<SelectValue /></SelectTrigger>
                  <SelectContent>
                    {canUseCommunityScope ? <SelectItem value="community">Community agent</SelectItem> : null}
                    <SelectItem value="personal">Personal agent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Runtime</FieldLabel>
                <Select value={value.runtime} onValueChange={(runtime) => runtime && onValueChange({ ...value, runtime: runtime as AgentRuntime })} disabled={pending}>
                  <SelectTrigger className="w-full"><BotIcon aria-hidden /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scripted">Scripted</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${nameId}-model`}>Model label <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
                <Input id={`${nameId}-model`} value={value.model} onChange={(event) => onValueChange({ ...value, model: event.target.value })} placeholder="e.g. claude-sonnet" disabled={pending} />
              </Field>
              <Field>
                <FieldLabel>Figure color</FieldLabel>
                <Select value={value.figureColor ?? "auto"} onValueChange={(color) => onValueChange({ ...value, figureColor: color === "auto" ? undefined : color as FigureColorName })} disabled={pending}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Seed decides</SelectItem>
                    {FIGURE_COLORS.map((color) => <SelectItem key={color.name} value={color.name}>{color.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

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
          {editing && onDelete ? <Button type="button" variant="destructive" onClick={onDelete} disabled={pending} className="sm:mr-auto">Remove</Button> : null}
          {editing && onStatusToggle ? <Button type="button" variant="outline" onClick={() => { void Promise.resolve(onStatusToggle()).catch(() => undefined) }} disabled={pending}>{agent && "status" in agent && agent.status === "inactive" ? "Reactivate" : "Deactivate"}</Button> : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button type="submit" form={`${nameId}-form`} disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create agent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
