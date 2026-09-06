import { createContext, useContext, type ReactNode } from 'react'
import type {
  CommunitySummary,
  CreateCommunityInput,
  CreateInviteInput,
  InviteCreateResult,
  InviteMetadata,
  InviteRedeemResult,
  PublicDirectory,
  User,
} from '@ada/protocol'

export interface HostedWorkspaceContextValue {
  user: User
  communities: CommunitySummary[]
  activeCommunity: CommunitySummary
  directory: PublicDirectory
  switchCommunity: (communityId: string, action?: 'open' | 'settings' | 'invite' | 'leave') => void
  requestAddCommunity: () => void
  requestInvite: () => void
  requestLeaveCommunity: () => void
  canLeaveCommunity: boolean
  leaveCommunityBlockedReason?: string
  createCommunity: (input: CreateCommunityInput) => Promise<CommunitySummary>
  redeemInvite: (code: string) => Promise<InviteRedeemResult>
  leaveCommunity: () => Promise<void>
  requestSignOut: () => void
  updateProfile: (displayName: string) => Promise<void>
  updateCommunity: (input: { name?: string; term?: string }) => Promise<void>
  createInvite: (input: CreateInviteInput) => Promise<InviteCreateResult>
  listInvites: () => Promise<InviteMetadata[]>
  revokeInvite: (inviteId: string) => Promise<InviteMetadata>
  updateMemberRole: (userId: string, role: 'teacher' | 'student') => Promise<void>
  removeMember: (userId: string) => Promise<void>
  createAgentDm: (agentId: string) => Promise<string>
}

const HostedWorkspaceContext = createContext<HostedWorkspaceContextValue | null>(null)

export function HostedWorkspaceProvider({
  value,
  children,
}: {
  value: HostedWorkspaceContextValue
  children: ReactNode
}) {
  return <HostedWorkspaceContext.Provider value={value}>{children}</HostedWorkspaceContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- colocated with its provider like the existing community context.
export function useHostedWorkspace(): HostedWorkspaceContextValue {
  const value = useContext(HostedWorkspaceContext)
  if (!value) throw new Error('useHostedWorkspace outside HostedWorkspaceProvider')
  return value
}
