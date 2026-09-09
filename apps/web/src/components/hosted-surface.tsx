import { educationClient } from "@/lib/education-api"
import { memoryClient } from "@/lib/memory-api"
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActiveAgent,
  CommunityAgent,
  CommunitySummary,
  CommunityWorkspaceSnapshot,
  CreateCommunityInput,
  InviteRedeemResult,
  ScopedMessage,
  ScopedThread,
  User,
} from '@ada/protocol'
import type { Agent, AgentCreateResult, Channel, Community, Message, Person, Thread } from '@/lib/types'
import type { MessageInput } from '@/lib/api'
import { CommunityProvider, type WorkspaceActions } from '@/lib/community'
import {
  connectHostedEvents,
  createAgent,
  createChannel,
  createDm,
  createInvite,
  createMessage,
  createThread,
  deleteAgent,
  deleteMessage,
  editMessage,
  fetchSnapshot,
  joinChannel,
  leaveChannel,
  listInvites,
  removeMember,
  revokeInvite,
  rotateAgent,
  updateAgent,
  updateChannel,
  updateCommunity,
  updateMembershipRole,
  updateUser,
} from '@/lib/hosted-api'
import { useAppNavigation, useAppRoute } from '@/lib/routes'
import { WorkspaceShell } from '@/components/workspace/shell'
import { AddCommunityDialog, InviteDialog } from '@/components/workspace/community-dialogs'
import {
  HostedWorkspaceProvider,
  type HostedWorkspaceContextValue,
} from '@/components/workspace/hosted-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { StartupSurface } from '@/components/workspace/startup-surface'
import { toast } from '@/components/ui/toast'

interface HostedWorkspaceSurfaceProps {
  server: string
  token: string
  user: User
  communities: CommunitySummary[]
  active: CommunitySummary
  snapshot: CommunityWorkspaceSnapshot | null
  error?: string
  onRetry: () => void
  pendingCommunityAction?: 'invite' | 'leave'
  onPendingCommunityActionHandled: () => void
  onSwitch: (communityId: string, action?: 'invite' | 'leave') => void
  onCommunities: () => Promise<void>
  onSnapshot: (snapshot: CommunityWorkspaceSnapshot) => void
  onUser: (user: User) => void
  onCreateCommunity: (input: CreateCommunityInput) => Promise<CommunitySummary>
  onRedeemInvite: (code: string) => Promise<InviteRedeemResult>
  onLeaveCommunity: () => Promise<void>
  onSignOut: () => void
}

export function HostedWorkspaceSurface(props: HostedWorkspaceSurfaceProps) {
  if (props.error) {
    return (
      <StartupSurface title={`Couldn’t load ${props.active.name}`} detail={props.error} actionLabel="Retry" onAction={props.onRetry} />
    )
  }
  if (!props.snapshot) {
    return <StartupSurface title={`Loading ${props.active.name}…`} detail="Fetching only this community’s channels and conversation." />
  }
  return <ReadyHostedWorkspace {...props} snapshot={props.snapshot} />
}

function ReadyHostedWorkspace({
  server,
  token,
  user,
  communities,
  active,
  snapshot,
  pendingCommunityAction,
  onPendingCommunityActionHandled,
  onSwitch,
  onCommunities,
  onSnapshot,
  onUser,
  onCreateCommunity,
  onRedeemInvite,
  onLeaveCommunity,
  onSignOut,
}: HostedWorkspaceSurfaceProps & { snapshot: CommunityWorkspaceSnapshot }) {
  const route = useAppRoute()
  const navigateTo = useAppNavigation(active.id)
  const [connected, setConnected] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [addCommunityOpen, setAddCommunityOpen] = useState(route.kind === 'join')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [leaveError, setLeaveError] = useState<string>()

  const requestLeaveCommunity = useCallback(() => {
    const teachers = snapshot.members.filter((member) => member.role === 'teacher')
    if (snapshot.membership.role === 'teacher' && teachers.length === 1) {
      toast.add({ title: 'Invite another teacher first', description: 'A community needs at least one teacher.' })
      return
    }
    setLeaveError(undefined)
    setLeaveOpen(true)
  }, [snapshot.members, snapshot.membership.role])

  useEffect(() => {
    if (!pendingCommunityAction) return
    // This intent crosses the async community hydration boundary, so it must
    // open only after the target community and its permissions are loaded.
    // oxlint-disable-next-line react/set-state-in-effect
    if (pendingCommunityAction === 'invite') setInviteOpen(true)
    else requestLeaveCommunity()
    onPendingCommunityActionHandled()
  }, [onPendingCommunityActionHandled, pendingCommunityAction, requestLeaveCommunity])

  const refresh = useCallback(async () => {
    onSnapshot(await fetchSnapshot(server, token, active.id))
  }, [active.id, onSnapshot, server, token])

  useEffect(() => {
    const connection = connectHostedEvents(
      server,
      token,
      active.id,
      (event) => {
        if (event.type === 'card.published') return
        if (event.type === 'community.updated' || event.type.startsWith('membership.')) {
          void onCommunities().catch(() => undefined)
          return
        }
        void refresh().catch(() => undefined)
      },
      (ready) => {
        setConnected(ready)
        if (ready) void refresh().catch(() => undefined)
      },
    )
    return connection.close
  }, [active.id, onCommunities, refresh, server, token])

  useEffect(() => {
    if ('communityId' in route && route.communityId && route.communityId !== active.id) {
      const target = communities.find((community) => community.id === route.communityId)
      if (target) onSwitch(target.id)
      else void navigateTo({ kind: 'inbox' }, { replace: true })
      return
    }
    if (route.kind === 'join') {
      // oxlint-disable-next-line react/set-state-in-effect -- route state opens the join dialog.
      setAddCommunityOpen(true)
      return
    }
    if (route.kind === 'root' || route.kind === 'inbox' && route.restoreChannel && route.communityId === active.id) {
      const remembered = readLastChannel(active.id)
      const target = snapshot.channels.find((channel) => channel.id === remembered && channel.status === 'active') ?? firstChannel(snapshot)
      if (target) void navigateTo({ kind: 'channel', channelId: target.id }, { replace: true })
    }
  }, [active.id, communities, navigateTo, onSwitch, route, snapshot])

  const mapped = useMemo(() => mapHostedCommunity(snapshot, user.id), [snapshot, user.id])
  const workspace = useMemo<WorkspaceActions>(() => ({
    available: true,
    updateCommunity: async (input) => {
      await updateCommunity(server, token, active.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.term !== undefined || input.subtitle !== undefined ? { term: input.term ?? input.subtitle } : {}),
      })
      await onCommunities()
    },
    updateProfile: async (input) => {
      if (!input.name) return
      onUser(await updateUser(server, token, { displayName: input.name }))
      await refresh()
    },
    createChannel: async (input) => {
      const result = await createChannel(server, token, active.id, {
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        kind: 'channel',
        visibility: input.visibility === 'open' ? 'public' : 'private',
        memberIds: input.memberIds,
        agentIds: input.agentIds,
      })
      await refresh()
      return mapChannel(result)
    },
    updateChannel: async (channelId, input) => {
      const result = await updateChannel(server, token, active.id, channelId, {
        name: input.name,
        description: input.description,
        visibility: input.visibility === undefined ? undefined : input.visibility === 'open' ? 'public' : 'private',
        status: input.status,
      })
      await refresh()
      return mapChannel(result)
    },
    replaceChannelMembers: async (channelId, input) => {
      const result = await updateChannel(server, token, active.id, channelId, input)
      await refresh()
      return mapChannel(result)
    },
    joinChannel: async (channelId) => {
      const result = await joinChannel(server, token, active.id, channelId)
      await refresh()
      return mapChannel(result)
    },
    leaveChannel: async (channelId) => {
      const result = await leaveChannel(server, token, active.id, channelId)
      await refresh()
      return mapChannel(result)
    },
    deleteChannel: async () => { throw new Error('Channels are archived instead of deleted.') },
    createAgent: async (input) => {
      const result = await createAgent(server, token, active.id, {
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        instructions: input.instructions,
        channelIds: input.channelIds,
      })
      await refresh()
      return { agent: mapAgent(result.agent), enrollment: result.enrollment } satisfies AgentCreateResult
    },
    updateAgent: async (agentId, input) => {
      if (input.status !== undefined) throw new Error('Agent lifecycle is managed by setup and deletion.')
      const result = await updateAgent(server, token, active.id, agentId, {
        name: input.name,
        avatarUrl: input.avatarUrl,
        instructions: input.instructions,
        runtime: input.runtime === undefined ? undefined : input.runtime === 'codex' ? 'codex' : 'claude',
        model: input.model,
        channelIds: input.channelIds,
      })
      await refresh()
      return mapAgent(result)
    },
    rotateAgentToken: async (agentId) => {
      const result = await rotateAgent(server, token, active.id, agentId)
      return { agent: mapAgent(result.agent), enrollment: result.enrollment }
    },
    deleteAgent: async (agentId) => {
      await deleteAgent(server, token, active.id, agentId)
      await refresh()
    },
    editMessage: async (messageId, input) => {
      const result = await editMessage(server, token, active.id, messageId, input)
      await refresh()
      return mapMessage(result)
    },
    deleteMessage: async (messageId) => {
      const original = mapped.messages.find((message) => message.id === messageId)
      const tombstone = await deleteMessage(server, token, active.id, messageId)
      await refresh()
      return { ...(original ?? { id: tombstone.id, channelId: tombstone.channelId, authorId: tombstone.authorId, at: tombstone.deletedAt, paragraphs: [] }), deletedAt: tombstone.deletedAt }
    },
    addReaction: async () => { throw new Error('Message reactions are not available in this phase.') },
    removeReaction: async () => { throw new Error('Message reactions are not available in this phase.') },
    markChannelRead: async () => undefined,
    uploadAttachment: async () => { throw new Error('Attachments are not available in this phase.') },
    deleteAttachment: async () => { throw new Error('Attachments are not available in this phase.') },
    downloadAttachment: async () => { throw new Error('Attachments are not available in this phase.') },
    setTyping: () => undefined,
  }), [active.id, mapped.messages, onCommunities, onUser, refresh, server, token])

  const education = useMemo(() => educationClient(server, token, active.id), [server, token, active.id])
  const memory = useMemo(() => memoryClient(server, token, active.id), [server, token, active.id])
  const hostedValue = useMemo<HostedWorkspaceContextValue>(() => ({
    education,
    memory,
    user,
    communities,
    activeCommunity: active,
    directory: snapshot.directory,
    switchCommunity: (communityId, action = 'open') => {
      if (communityId === active.id) {
        if (action === 'settings') void navigateTo({ kind: 'settings', section: 'community' })
        else if (action === 'invite') setInviteOpen(true)
        else if (action === 'leave') requestLeaveCommunity()
        else void navigateTo({ kind: 'inbox', communityId })
        return
      }
      onSwitch(communityId, action === 'invite' || action === 'leave' ? action : undefined)
      if (action === 'settings') void navigateTo({ kind: 'settings', section: 'community' })
      else void navigateTo({ kind: 'inbox', communityId })
    },
    requestAddCommunity: () => setAddCommunityOpen(true),
    requestInvite: () => setInviteOpen(true),
    requestLeaveCommunity,
    canLeaveCommunity: !(snapshot.membership.role === 'teacher' && snapshot.members.filter((member) => member.role === 'teacher').length === 1),
    leaveCommunityBlockedReason: snapshot.membership.role === 'teacher' && snapshot.members.filter((member) => member.role === 'teacher').length === 1 ? 'A community needs at least one teacher.' : undefined,
    createCommunity: onCreateCommunity,
    redeemInvite: onRedeemInvite,
    leaveCommunity: onLeaveCommunity,
    requestSignOut: () => setSignOutOpen(true),
    updateProfile: async (displayName) => {
      onUser(await updateUser(server, token, { displayName }))
      await refresh()
    },
    updateCommunity: async (input) => {
      await updateCommunity(server, token, active.id, input)
      await onCommunities()
    },
    createInvite: (input) => createInvite(server, token, active.id, input),
    listInvites: () => listInvites(server, token, active.id),
    revokeInvite: (inviteId) => revokeInvite(server, token, active.id, inviteId),
    updateMemberRole: async (userId, role) => {
      await updateMembershipRole(server, token, active.id, userId, { role })
      await refresh()
    },
    removeMember: async (userId) => {
      await removeMember(server, token, active.id, userId)
      await refresh()
    },
    createAgentDm: async (agentId) => {
      const channel = await createDm(server, token, active.id, agentId)
      await refresh()
      return channel.id
    },
  }), [education, memory, active, communities, navigateTo, onCommunities, onCreateCommunity, onLeaveCommunity, onRedeemInvite, onSwitch, onUser, refresh, requestLeaveCommunity, server, snapshot, token, user])

  const sendMessage = useCallback(async (input: MessageInput) => {
    await createMessage(server, token, active.id, input)
  }, [active.id, server, token])
  const startThread = useCallback(async (messageId: string): Promise<Thread> => {
    const root = mapped.messages.find((message) => message.id === messageId)
    if (!root) throw new Error('The root message is no longer available.')
    const result = await createThread(server, token, active.id, { channelId: root.channelId, rootMessageId: messageId })
    await refresh()
    return mapThread(result)
  }, [active.id, mapped.messages, refresh, server, token])

  const initialChannel = route.kind === 'channel' && mapped.channels.some((channel) => channel.id === route.channelId)
    ? route.channelId
    : firstChannel(snapshot)?.id ?? mapped.channels[0]?.id ?? ''
  const initialPanels = route.kind === 'channel' && route.threadId ? [{ kind: 'thread' as const, threadId: route.threadId }] : []

  return (
    <HostedWorkspaceProvider value={hostedValue}>
      <CommunityProvider
        community={mapped}
        initialChannelId={initialChannel}
        initialPanels={initialPanels}
        controlledPanels={initialPanels}
        onOpenThread={(threadId) => {
          const channelId = mapped.threads.find((thread) => thread.id === threadId)
            ? mapped.messages.find((message) => message.id === mapped.threads.find((thread) => thread.id === threadId)?.rootMessageId)?.channelId
            : mapped.messages.find((message) => message.threadId === threadId)?.channelId
          const targetChannelId = channelId ?? (route.kind === 'channel' ? route.channelId : undefined)
          if (targetChannelId) void navigateTo({ kind: 'channel', channelId: targetChannelId, threadId })
        }}
        onClosePanel={() => {
          if (route.kind === 'channel' && route.threadId) void navigateTo({ kind: 'channel', channelId: route.channelId })
        }}
        now={new Date()}
        mode="connected"
        connected={connected}
        workspace={workspace}
        sendMessage={sendMessage}
        startThread={startThread}
        runnerInfo={(memberId) => {
          const agent = snapshot.agents.find((candidate) => candidate.id === memberId)
          return agent ? { runtime: agent.runtime, model: agent.model } : undefined
        }}
        createInvite={async () => {
          const result = await createInvite(server, token, active.id, { role: 'student', mode: 'single-use', maxUses: 1 })
          return { token: result.code, joinHash: `/join?code=${encodeURIComponent(result.code)}` }
        }}
      >
        <WorkspaceShell />
      </CommunityProvider>

      {addCommunityOpen ? (
        <AddCommunityDialog
          initialCode={route.kind === 'join' ? route.code : undefined}
          onOpenChange={(open) => {
            setAddCommunityOpen(open)
            if (!open && route.kind === 'join') void navigateTo({ kind: 'inbox' }, { replace: true })
          }}
          createCommunity={onCreateCommunity}
          redeemInvite={onRedeemInvite}
          onCompleted={(communityId) => void navigateTo({ kind: 'inbox', communityId }, { replace: true })}
        />
      ) : null}

      {inviteOpen ? <InviteDialog onOpenChange={setInviteOpen} createInvite={(input) => createInvite(server, token, active.id, input)} /> : null}

      <AlertDialog open={leaveOpen} onOpenChange={(open) => { setLeaveOpen(open); if (!open) setLeaveError(undefined) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {active.name}?</AlertDialogTitle>
            <AlertDialogDescription>You will need a new invite to return.</AlertDialogDescription>
          </AlertDialogHeader>
          {leaveError ? <p className="text-sm text-destructive" role="alert">{leaveError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leavePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={leavePending}
              onClick={(event) => {
                event.preventDefault()
                setLeavePending(true)
                setLeaveError(undefined)
                void onLeaveCommunity()
                  .then(() => setLeaveOpen(false))
                  .catch((cause) => setLeaveError(cause instanceof Error ? cause.message : 'The community could not be left.'))
                  .finally(() => setLeavePending(false))
              }}
            >
              {leavePending ? 'Leaving…' : 'Leave community'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={signOutOpen} onOpenChange={(open) => { setSignOutOpen(open); if (!open) setHasToken(false) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Ada on this device?</AlertDialogTitle>
            <AlertDialogDescription>You will need your user token to sign back in.</AlertDialogDescription>
          </AlertDialogHeader>
          <Field orientation="horizontal">
            <Checkbox id="sign-out-token" checked={hasToken} onCheckedChange={(checked) => setHasToken(checked === true)} />
            <FieldContent>
              <FieldLabel htmlFor="sign-out-token">I have my token</FieldLabel>
              <FieldDescription>Ada cannot recover a lost user token.</FieldDescription>
            </FieldContent>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={!hasToken} onClick={onSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HostedWorkspaceProvider>
  )
}

function firstChannel(snapshot: CommunityWorkspaceSnapshot) {
  return snapshot.channels.find((channel) => channel.kind === 'channel' && channel.status === 'active')
    ?? snapshot.channels.find((channel) => channel.status === 'active')
    ?? snapshot.channels[0]
}

function readLastChannel(communityId: string): string | null {
  try { return localStorage.getItem(`ada:last-channel:${communityId}`) } catch { return null }
}

function mapHostedCommunity(snapshot: CommunityWorkspaceSnapshot, userId: string): Community {
  const people: Person[] = snapshot.members.map((member) => ({
    kind: 'person',
    id: member.id,
    name: member.displayName,
    initials: member.initials,
    tone: 'card',
    role: member.role,
    presence: member.presence === 'offline' ? 'away' : member.presence,
    joinedAt: member.joinedAt,
  }))
  const agents: Agent[] = snapshot.agents.map(mapAgent)
  const known = new Set([...people.map((member) => member.id), ...agents.map((member) => member.id)])
  const archivedAgents = snapshot.channels.flatMap((channel): Agent[] => {
    if (channel.kind !== 'dm' || !channel.agentId || known.has(channel.agentId)) return []
    known.add(channel.agentId)
    return [{
      kind: 'agent',
      id: channel.agentId,
      name: channel.name.replace(/^DM\s*·\s*/i, '') || 'Deleted agent',
      scope: 'community',
      createdBy: channel.ownerId ?? userId,
      instructions: '',
      provider: { mode: 'subscription', model: 'unavailable' },
      channelIds: [channel.id],
      presence: 'away',
      status: 'inactive',
    }]
  })
  const messages = snapshot.messages.map(mapMessage)
  const authorPlaceholders = messages.flatMap((message): Person[] => {
    if (known.has(message.authorId)) return []
    known.add(message.authorId)
    return [{ kind: 'person', id: message.authorId, name: 'Former member', initials: 'FM', tone: 'cardstock', presence: 'away' }]
  })

  return {
    id: snapshot.community.id,
    name: snapshot.community.name,
    subtitle: snapshot.community.term,
    term: snapshot.community.term,
    initial: snapshot.community.name.slice(0, 2).toUpperCase(),
    members: [...people, ...agents, ...archivedAgents, ...authorPlaceholders],
    channels: snapshot.channels.map(mapChannel),
    cards: [],
    messages,
    threads: snapshot.threads.map(mapThread),
    modules: [],
    assignments: [],
    feedback: [],
    reports: [],
    meId: userId,
    updatedAt: snapshot.community.updatedAt,
  }
}

function mapAgent(agent: ActiveAgent | CommunityAgent): Agent {
  return {
    kind: 'agent',
    id: agent.id,
    name: agent.name,
    systemRole: agent.systemRole,
    scope: 'community',
    createdBy: agent.createdBy,
    avatarUrl: agent.avatarUrl,
    instructions: agent.instructions,
    provider: { mode: 'subscription', model: agent.model },
    channelIds: agent.channelIds,
    presence: 'presence' in agent ? agent.presence === 'offline' ? 'away' : agent.presence : 'away',
    runtime: agent.runtime,
    model: agent.model,
    status: 'active',
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }
}

function mapChannel(channel: CommunityWorkspaceSnapshot['channels'][number]): Channel {
  return {
    id: channel.id,
    name: channel.kind === 'dm' ? channel.name.replace(/^DM\s*·\s*/i, '') : channel.name,
    description: channel.description,
    group: channel.kind === 'dm' ? 'private' : 'course',
    visibility: channel.visibility === 'public' ? 'open' : 'private',
    status: channel.status,
    createdBy: channel.createdBy,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    archivedAt: channel.archivedAt,
    memberIds: [...channel.memberIds, ...channel.agentIds],
    memberCount: channel.memberIds.length + channel.agentIds.length,
    kind: channel.kind,
    agentId: channel.agentId,
    ownerId: channel.ownerId,
  }
}

function mapMessage(message: ScopedMessage): Message {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    at: message.at,
    paragraphs: message.paragraphs,
    threadId: message.threadId,
    clientId: message.clientId,
    editedAt: message.editedAt,
    deletedAt: message.deletedAt,
  }
}

function mapThread(thread: ScopedThread): Thread {
  return { id: thread.id, rootMessageId: thread.rootMessageId, replyIds: thread.replyIds }
}
