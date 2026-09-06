import { useState } from 'react'
import type { ChannelVisibility } from '@ada/protocol'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'

export function ChannelCreateDialog({
  initialName = '',
  onOpenChange,
  onCreate,
}: {
  initialName?: string
  onOpenChange: (open: boolean) => void
  onCreate: (input: { name: string; description?: string; visibility: ChannelVisibility }) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ChannelVisibility>('open')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async () => {
    if (!name.trim()) return setError('Enter a channel name.')
    setPending(true)
    setError(undefined)
    try {
      await onCreate({ name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), visibility })
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The channel could not be created.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader><DialogTitle>Create a channel</DialogTitle><DialogDescription>Give this course conversation a clear, findable home.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field data-invalid={Boolean(error && !name.trim())}>
            <FieldLabel htmlFor="channel-name">Name</FieldLabel>
            <Input id="channel-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="course-questions" disabled={pending} aria-invalid={Boolean(error && !name.trim())} />
            <FieldDescription>Short lowercase words joined with hyphens work best.</FieldDescription>
          </Field>
          <Field><FieldLabel htmlFor="channel-description">Description <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Textarea id="channel-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={pending} /></Field>
          <FieldSet><FieldLegend>Visibility</FieldLegend><RadioGroup value={visibility} onValueChange={(value) => setVisibility(value as ChannelVisibility)}>
            <Field orientation="horizontal"><RadioGroupItem id="channel-public" value="open" /><FieldLabel htmlFor="channel-public" className="font-normal">Public <span className="block text-xs text-muted-foreground">Anyone in the community can find and join it.</span></FieldLabel></Field>
            <Field orientation="horizontal"><RadioGroupItem id="channel-private" value="private" /><FieldLabel htmlFor="channel-private" className="font-normal">Private <span className="block text-xs text-muted-foreground">Only people and agents you add can see it.</span></FieldLabel></Field>
          </RadioGroup></FieldSet>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        </FieldGroup>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button onClick={() => void submit()} disabled={pending}>{pending ? 'Creating…' : 'Create channel'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
