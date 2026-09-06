import { useCallback, useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'

export const SETTINGS_SECTIONS = [
  'profile',
  'community',
  'members',
  'invites',
  'shortcuts',
  'account',
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

type CommunityRoute = { communityId?: string }

export type AppRoute =
  | { kind: 'root' }
  | { kind: 'join'; code?: string }
  | ({ kind: 'inbox' } & CommunityRoute)
  | ({ kind: 'channel'; channelId: string; threadId?: string } & CommunityRoute)
  | ({ kind: 'new-message' } & CommunityRoute)
  | ({ kind: 'agents'; agentId?: string } & CommunityRoute)
  | ({ kind: 'settings'; section?: SettingsSection } & CommunityRoute)

export interface RouteNavigationOptions {
  replace?: boolean
  hash?: string
}

function decodeSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    return decoded || null
  } catch {
    return null
  }
}

function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

/** Convert TanStack Router's current location into the small view model used by the workspace. */
export function parseAppLocation(pathname: string, search: Record<string, unknown> = {}): AppRoute {
  if (pathname === '/') return { kind: 'root' }
  if (pathname === '/settings') {
    return {
      kind: 'settings',
      ...(isSettingsSection(search.section) ? { section: search.section } : {}),
    }
  }
  if (pathname === '/join') {
    return typeof search.code === 'string' ? { kind: 'join', code: search.code } : { kind: 'join' }
  }

  const segments = pathname.split('/').filter(Boolean).map(decodeSegment)
  if (segments.some((segment) => segment === null) || segments[0] !== 'c' || !segments[1]) {
    return { kind: 'root' }
  }

  const communityId = segments[1]
  if (segments.length === 2) return { kind: 'inbox', communityId }
  if (segments[2] === 'messages' && segments[3] === 'new' && segments.length === 4) {
    return { kind: 'new-message', communityId }
  }
  if (segments[2] === 'agents') {
    return segments[3]
      ? { kind: 'agents', communityId, agentId: segments[3] }
      : { kind: 'agents', communityId }
  }
  if (segments[2] === 'settings' && segments.length === 3) {
    return {
      kind: 'settings',
      communityId,
      ...(isSettingsSection(search.section) ? { section: search.section } : {}),
    }
  }
  if (segments[2] === 'channels' && segments[3]) {
    if (segments[4] === 'threads' && segments[5]) {
      return { kind: 'channel', communityId, channelId: segments[3], threadId: segments[5] }
    }
    if (segments.length === 4) return { kind: 'channel', communityId, channelId: segments[3] }
  }
  return { kind: 'inbox', communityId }
}

export function useAppRoute(): AppRoute {
  const location = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.search }),
  })
  return useMemo(
    () => parseAppLocation(location.pathname, location.search as Record<string, unknown>),
    [location.pathname, location.search],
  )
}

/** Dialog and shortcut mutations navigate through the registered TanStack router. */
export function useAppNavigation(activeCommunityId?: string) {
  const navigate = useNavigate()

  return useCallback((route: AppRoute, options: RouteNavigationOptions = {}) => {
    const communityId = 'communityId' in route ? route.communityId ?? activeCommunityId : activeCommunityId
    const shared = { replace: options.replace, hash: options.hash }

    switch (route.kind) {
      case 'root':
        return navigate({ to: '/', ...shared })
      case 'join':
        return navigate({ to: '/join', search: { code: route.code }, ...shared })
      case 'inbox':
        return communityId
          ? navigate({ to: '/c/$communityId', params: { communityId }, ...shared })
          : navigate({ to: '/', ...shared })
      case 'channel':
        if (!communityId) return navigate({ to: '/', ...shared })
        return route.threadId
          ? navigate({
              to: '/c/$communityId/channels/$channelId/threads/$threadId',
              params: { communityId, channelId: route.channelId, threadId: route.threadId },
              ...shared,
            })
          : navigate({
              to: '/c/$communityId/channels/$channelId',
              params: { communityId, channelId: route.channelId },
              ...shared,
            })
      case 'new-message':
        return communityId
          ? navigate({ to: '/c/$communityId/messages/new', params: { communityId }, ...shared })
          : navigate({ to: '/', ...shared })
      case 'agents':
        if (!communityId) return navigate({ to: '/', ...shared })
        return route.agentId
          ? navigate({ to: '/c/$communityId/agents/$agentId', params: { communityId, agentId: route.agentId }, ...shared })
          : navigate({ to: '/c/$communityId/agents', params: { communityId }, ...shared })
      case 'settings':
        return navigate({
          to: '/settings',
          search: { section: route.section },
          ...shared,
        })
    }
  }, [activeCommunityId, navigate])
}
