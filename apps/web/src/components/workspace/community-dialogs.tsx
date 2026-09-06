import { useState } from 'react'
import type { CommunitySummary, CreateInviteInput, InviteCreateResult, InviteRedeemResult } from '@ada/protocol'
import { ArrowLeftIcon, CheckIcon, CopyIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'

type AddMode = 'choose' | 'create' | 'join'

export function AddCommunityDialog({
  initialCode,
  onOpenChange,
  createCommunity,
  redeemInvite,
  onCompleted,
}: {
  initialCode?: string
  onOpenChange: (open: boolean) => void
  createCommunity: (input: { name: string; term: string }) => Promise<CommunitySummary>
  redeemInvite: (code: string) => Promise<InviteRedeemResult>
  onCompleted: (communityId: string) => void
}) {
  const [mode, setMode] = useState<AddMode>(initialCode ? 'join' : 'choose')
  const [name, setName] = useState('')
  const [term, setTerm] = useState('')
  const [code, setCode] = useState(initialCode ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  const submit = async () => {
    setError(undefined)
    if (mode === 'create' && (!name.trim() || !term.trim())) {
      setError('Enter a community name and term.')
      return
    }
    if (mode === 'join' && code.trim().length < 20) {
      setError('Paste the complete invite code.')
      return
    }
    setPending(true)
    try {
      if (mode === 'create') {
        const community = await createCommunity({ name: name.trim(), term: term.trim() })
        onCompleted(community.id)
      } else if (mode === 'join') {
        const result = await redeemInvite(code.trim())
        if (!result.consumed) toast.add({ title: 'You are already a member', description: `Switched to ${result.community.name}.` })
        onCompleted(result.community.id)
      }
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The community could not be added.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'choose' ? 'Add a community' : mode === 'create' ? 'Create a community' : 'Join a community'}</DialogTitle>
          <DialogDescription>
            {mode === 'choose' ? 'Start a new course community or use an invite from a teacher.' : mode === 'create' ? 'Name the course space and the term this cohort belongs to.' : 'Paste the invite code shared by a teacher.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'choose' ? (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="h-auto justify-start py-3" onClick={() => setMode('create')}>
              <PlusIcon data-icon="inline-start" />Create a community
            </Button>
            <Button variant="outline" className="h-auto justify-start py-3" onClick={() => setMode('join')}>
              <CheckIcon data-icon="inline-start" />Join with an invite code
            </Button>
          </div>
        ) : (
          <FieldGroup>
            {mode === 'create' ? (
              <>
                <Field data-invalid={Boolean(error && !name.trim())}>
                  <FieldLabel htmlFor="new-community-name">Community name</FieldLabel>
                  <Input id="new-community-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} disabled={pending} aria-invalid={Boolean(error && !name.trim())} />
                </Field>
                <Field data-invalid={Boolean(error && !term.trim())}>
                  <FieldLabel htmlFor="new-community-term">Term</FieldLabel>
                  <Input id="new-community-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Fall 2026" disabled={pending} aria-invalid={Boolean(error && !term.trim())} />
                  <FieldDescription>The cohort label shown in the community switcher.</FieldDescription>
                </Field>
              </>
            ) : (
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="community-invite-code">Invite code</FieldLabel>
                <Input id="community-invite-code" autoFocus value={code} onChange={(event) => setCode(event.target.value)} disabled={pending} aria-invalid={Boolean(error)} />
              </Field>
            )}
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </FieldGroup>
        )}

        <DialogFooter>
          {mode !== 'choose' ? <Button variant="ghost" onClick={() => { setMode('choose'); setError(undefined) }} disabled={pending}><ArrowLeftIcon data-icon="inline-start" />Back</Button> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          {mode !== 'choose' ? <Button onClick={() => void submit()} disabled={pending}>{pending ? mode === 'create' ? 'Creating…' : 'Joining…' : mode === 'create' ? 'Create community' : 'Join community'}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const expiryOptions = [1, 3, 7, 30] as const
const useOptions = [1, 3, 5, 10, 25, 'unlimited'] as const

export function InviteDialog({
  onOpenChange,
  createInvite,
}: {
  onOpenChange: (open: boolean) => void
  createInvite: (input: CreateInviteInput) => Promise<InviteCreateResult>
}) {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [expiresDays, setExpiresDays] = useState(3)
  const [uses, setUses] = useState<number | 'unlimited'>(1)
  const [result, setResult] = useState<InviteCreateResult>()
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  const create = async () => {
    setPending(true)
    setError(undefined)
    try {
      const input: CreateInviteInput = {
        role,
        mode: uses === 1 ? 'single-use' : 'reusable',
        expiresAt: new Date(Date.now() + expiresDays * 86_400_000).toISOString(),
        ...(uses === 'unlimited' ? {} : { maxUses: uses }),
      }
      setResult(await createInvite(input))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The invite could not be created.')
    } finally {
      setPending(false)
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2_000)
    toast.add({ title: 'Invite code copied' })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? 'Invite created' : 'Invite to community'}</DialogTitle>
          <DialogDescription>{result ? 'This code is shown once. Send it through a trusted channel.' : 'Choose who can use the code and how long it should remain active.'}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <code className="max-h-32 overflow-auto break-all rounded-lg bg-muted p-3 text-xs leading-5">{result.code}</code>
            <Button variant="outline" onClick={() => void copy()}><CopyIcon data-icon="inline-start" />{copied ? 'Copied' : 'Copy code'}</Button>
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select items={[{ value: 'student', label: 'Student' }, { value: 'teacher', label: 'Teacher' }]} value={role} onValueChange={(value) => setRole(value as 'student' | 'teacher')}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="student">Student</SelectItem><SelectItem value="teacher">Teacher</SelectItem></SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-expiry">Expires after</FieldLabel>
              <Select items={expiryOptions.map((days) => ({ value: String(days), label: `${days} ${days === 1 ? 'day' : 'days'}` }))} value={String(expiresDays)} onValueChange={(value) => setExpiresDays(Number(value))}>
                <SelectTrigger id="invite-expiry"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{expiryOptions.map((days) => <SelectItem key={days} value={String(days)}>{days} {days === 1 ? 'day' : 'days'}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-uses">Uses</FieldLabel>
              <Select items={useOptions.map((count) => ({ value: String(count), label: count === 'unlimited' ? 'No limit' : String(count) }))} value={String(uses)} onValueChange={(value) => setUses(value === 'unlimited' ? 'unlimited' : Number(value))}>
                <SelectTrigger id="invite-uses"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{useOptions.map((count) => <SelectItem key={count} value={String(count)}>{count === 'unlimited' ? 'No limit' : count}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
              <FieldDescription>One use is the safest default for student invites.</FieldDescription>
            </Field>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </FieldGroup>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {result ? <Button onClick={() => { setResult(undefined); setCopied(false) }}>Create another</Button> : <Button onClick={() => void create()} disabled={pending}>{pending ? 'Creating…' : 'Create invite'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
