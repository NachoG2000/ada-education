import { settingsSections } from './settings-navigation'
import { useEffect, useState } from 'react'
import type { InviteMetadata, Person } from '@ada/protocol'
import {
  EllipsisIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
  UserPlusIcon,
} from 'lucide-react'
import { WorkspaceAvatar as MemberAvatar } from './workspace-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCommunity } from '@/lib/community'
import { type SettingsSection } from '@/lib/routes'
import { ActionSection, PageHeader, PageScroller } from './page-layout'
import { DestructiveConfirmation } from './destructive-confirmation'
import { useHostedWorkspace } from './hosted-context'

export function HostedSettingsPage({ section }: { section?: SettingsSection }) {
  const { me } = useCommunity()
  const settings = settingsSections(me.kind === 'person' && me.role === 'teacher')
  const active = settings.some((item) => item.section === section) ? section ?? 'profile' : 'profile'
  return <PageScroller><SettingsPanel key={active} section={active} /></PageScroller>
}

function SettingsPanel({ section }: { section: SettingsSection }) {
  if (section === 'community') return <CommunitySettings />
  if (section === 'members') return <MemberSettings />
  if (section === 'invites') return <InviteSettings />
  if (section === 'shortcuts') return <ShortcutSettings />
  if (section === 'account') return <AccountSettings />
  return <ProfileSettings />
}

function ProfileSettings() {
  const hosted = useHostedWorkspace()
  const { me } = useCommunity()
  const [name, setName] = useState(hosted.user.displayName)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const save = async () => {
    if (!name.trim()) return setError('Enter a display name.')
    setPending(true)
    setError(undefined)
    try {
      await hosted.updateProfile(name.trim())
      toast.add({ title: 'Profile updated' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The profile could not be updated.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <PageHeader title="Profile" description="The name people see across every Ada community you join." />
      <FieldGroup className="mt-8">
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="profile-display-name">Display name</FieldLabel>
          <div className="flex items-center gap-3"><MemberAvatar member={me} size={40} presence /><Input id="profile-display-name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} aria-invalid={Boolean(error)} /></div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : <FieldDescription>This updates your global Ada identity.</FieldDescription>}
        </Field>
        <div><Button size="sm" onClick={() => void save()} disabled={pending || !name.trim()}>{pending ? 'Saving…' : 'Save profile'}</Button></div>
      </FieldGroup>
    </>
  )
}

function CommunitySettings() {
  const hosted = useHostedWorkspace()
  const [name, setName] = useState(hosted.activeCommunity.name)
  const [term, setTerm] = useState(hosted.activeCommunity.term)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const save = async () => {
    if (!name.trim() || !term.trim()) return setError('Enter a community name and term.')
    setPending(true)
    setError(undefined)
    try {
      await hosted.updateCommunity({ name: name.trim(), term: term.trim() })
      toast.add({ title: 'Community updated' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The community could not be updated.')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <PageHeader title="Community" description="Manage the shared name and cohort label for this course community." />
      <FieldGroup className="mt-8">
        <Field data-invalid={Boolean(error && !name.trim())}><FieldLabel htmlFor="community-name">Community name</FieldLabel><Input id="community-name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} aria-invalid={Boolean(error && !name.trim())} /></Field>
        <Field data-invalid={Boolean(error && !term.trim())}><FieldLabel htmlFor="community-term">Term</FieldLabel><Input id="community-term" value={term} onChange={(event) => setTerm(event.target.value)} disabled={pending} aria-invalid={Boolean(error && !term.trim())} /><FieldDescription>Shown beside the community name in the switcher.</FieldDescription></Field>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <div><Button size="sm" onClick={() => void save()} disabled={pending || !name.trim() || !term.trim()}>{pending ? 'Saving…' : 'Save community'}</Button></div>
      </FieldGroup>
      <Separator className="my-8" />
      <ActionSection title="Invites" description="Create an invitation for a new member." action={<Button variant="outline" size="sm" onClick={hosted.requestInvite}><UserPlusIcon data-icon="inline-start" />Invite</Button>} />
      <Separator className="my-8" />
      <ActionSection destructive title="Leave community" description={hosted.leaveCommunityBlockedReason ?? 'You will need a new invite to return.'} action={<Button variant="destructive" size="sm" disabled={!hosted.canLeaveCommunity} title={hosted.leaveCommunityBlockedReason} onClick={hosted.requestLeaveCommunity}>Leave community</Button>} />
    </>
  )
}

function MemberSettings() {
  const hosted = useHostedWorkspace()
  const { community, me } = useCommunity()
  const [roleOverrides, setRoleOverrides] = useState<Record<string, 'teacher' | 'student'>>({})
  const people = community.members.filter((member): member is Person => member.kind === 'person').map((member) => roleOverrides[member.id] ? { ...member, role: roleOverrides[member.id] } : member)
  const teacherCount = people.filter((member) => member.role === 'teacher').length
  const [removeTarget, setRemoveTarget] = useState<Person>()
  const [pendingId, setPendingId] = useState<string>()

  const changeRole = async (member: Person, role: 'teacher' | 'student') => {
    setPendingId(member.id)
    setRoleOverrides((current) => ({ ...current, [member.id]: role }))
    try {
      await hosted.updateMemberRole(member.id, role)
      setRoleOverrides((current) => {
        const next = { ...current }
        delete next[member.id]
        return next
      })
      toast.add({ title: `${member.name} is now a ${role}` })
    } catch (cause) {
      setRoleOverrides((current) => {
        const next = { ...current }
        delete next[member.id]
        return next
      })
      toast.add({ title: 'Role could not be changed', description: cause instanceof Error ? cause.message : undefined })
    } finally {
      setPendingId(undefined)
    }
  }

  return (
    <>
      <PageHeader title="Members" description="Manage the people and roles in this community." action={<Button size="sm" onClick={hosted.requestInvite}><UserPlusIcon data-icon="inline-start" />Invite</Button>} />
      <div className="mt-8 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {people.map((member) => {
              const lastTeacher = member.role === 'teacher' && teacherCount === 1
              return (
                <TableRow key={member.id}>
                  <TableCell><div className="flex items-center gap-3"><MemberAvatar member={member} size={32} presence /><div><p className="font-medium">{member.name}{member.id === me.id ? ' (you)' : ''}</p><p className="text-xs text-muted-foreground">{member.presence === 'away' ? 'offline' : member.presence}</p></div></div></TableCell>
                  <TableCell><Badge variant="outline"><ShieldIcon data-icon="inline-start" />{member.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(member.joinedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<TooltipTrigger render={<Button variant="ghost" size="icon-sm" disabled={pendingId === member.id} aria-label={`Manage ${member.name}`} />} />}><EllipsisIcon /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            {member.role === 'student' ? <DropdownMenuItem onClick={() => void changeRole(member, 'teacher')}><ShieldIcon />Make teacher</DropdownMenuItem> : <DropdownMenuItem disabled={lastTeacher} onClick={() => void changeRole(member, 'student')}><UserIcon />Make student</DropdownMenuItem>}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={lastTeacher} onClick={() => setRemoveTarget(member)}><LogOutIcon />Remove from community</DropdownMenuItem></DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {lastTeacher ? <TooltipContent>A community needs at least one teacher</TooltipContent> : null}
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {removeTarget ? <DestructiveConfirmation open onOpenChange={(open) => { if (!open) setRemoveTarget(undefined) }} title={`Remove ${removeTarget.name}?`} description="They will need a new invite to return to this community." confirmLabel="Remove member" pending={pendingId === removeTarget.id} onConfirm={async () => { setPendingId(removeTarget.id); try { await hosted.removeMember(removeTarget.id); toast.add({ title: `${removeTarget.name} removed` }); setRemoveTarget(undefined) } catch (cause) { toast.add({ title: 'Member could not be removed', description: cause instanceof Error ? cause.message : undefined }) } finally { setPendingId(undefined) } }} /> : null}
    </>
  )
}

function InviteSettings() {
  const hosted = useHostedWorkspace()
  const [invites, setInvites] = useState<InviteMetadata[]>()
  const [error, setError] = useState<string>()
  const [pendingId, setPendingId] = useState<string>()
  useEffect(() => {
    let active = true
    hosted.listInvites().then((items) => { if (active) setInvites(items) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Invites could not be loaded.') })
    return () => { active = false }
  }, [hosted])
  const revoke = async (inviteId: string) => {
    setPendingId(inviteId)
    try {
      await hosted.revokeInvite(inviteId)
      setInvites((items) => items?.filter((invite) => invite.id !== inviteId))
      toast.add({ title: 'Invite revoked' })
    } catch (cause) {
      toast.add({ title: 'Invite could not be revoked', description: cause instanceof Error ? cause.message : undefined })
    } finally {
      setPendingId(undefined)
    }
  }
  return (
    <>
      <PageHeader title="Invites" description="Invite people to this community and manage active invitations." action={<Button size="sm" onClick={hosted.requestInvite}><UserPlusIcon data-icon="inline-start" />Create invite</Button>} />
      {error ? <p className="mt-6 text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="mt-8 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Uses</TableHead><TableHead>Expires</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {invites?.map((invite) => <TableRow key={invite.id}><TableCell><Badge variant="outline">{invite.role}</Badge></TableCell><TableCell>{invite.uses}{invite.maxUses ? ` / ${invite.maxUses}` : ' / unlimited'}</TableCell><TableCell className="text-muted-foreground">{formatDate(invite.expiresAt)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" disabled={pendingId === invite.id} onClick={() => void revoke(invite.id)}>{pendingId === invite.id ? 'Revoking…' : 'Revoke'}</Button></TableCell></TableRow>)}
            {invites && invites.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No active invites.</TableCell></TableRow> : null}
            {!invites && !error ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Loading invites…</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

const SHORTCUTS = [
  ['Search Ada', '⌘ K'], ['Browse channels', '⇧ ⌘ O'], ['Create channel', '⇧ ⌘ N'], ['New message', '⇧ ⌘ K'], ['Settings', '⌘ ,'], ['Back / forward', '⌘ [ / ⌘ ]'], ['Close panel or dialog', 'Esc'], ['Complete mention', 'Tab / Enter'], ['Send message', 'Enter'], ['New line', '⇧ Enter'],
]

function ShortcutSettings() {
  return <><PageHeader title="Keyboard shortcuts" description="Move through the community without leaving the keyboard." /><div className="mt-8 overflow-hidden rounded-xl border">{SHORTCUTS.map(([label, keys], index) => <div key={label}>{index ? <Separator /> : null}<div className="flex items-center gap-4 px-4 py-3"><span className="flex-1 text-sm">{label}</span><kbd className="rounded-md bg-muted px-2 py-1 font-sans text-xs text-muted-foreground">{keys}</kbd></div></div>)}</div></>
}

function AccountSettings() {
  const hosted = useHostedWorkspace()
  return (
    <>
      <PageHeader title="Account" description="This global identity can belong to multiple Ada communities." />
      <FieldGroup className="mt-8">
        <Field><FieldTitle>User ID</FieldTitle><code className="break-all rounded-md bg-muted p-3 text-xs">{hosted.user.id}</code></Field>
        <Field><FieldTitle>User token</FieldTitle><FieldDescription>Your token was shown once when you created the account. If you lose it, create a new account.</FieldDescription></Field>
      </FieldGroup>
      <Separator className="my-8" />
      <ActionSection destructive title="Sign out on this device" description="You will need your user token to sign back in." action={<Button variant="destructive" size="sm" onClick={hosted.requestSignOut}>Sign out</Button>} />
    </>
  )
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
