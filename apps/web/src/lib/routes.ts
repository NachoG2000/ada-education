/**
 * The typed, hash-only route model for the Buzz-parity workspace.
 *
 * Parsing and serialization are pure. The navigation helpers below deliberately
 * use the native Location API: assigning `location.hash` creates a history entry
 * and `location.replace` retires a hash without adding one. No router or data
 * loading belongs in this module.
 */

export const SETTINGS_SECTIONS = [
  "course",
  "appearance",
  "runner",
  "invites",
  "shortcuts",
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export type AppRoute =
  | { kind: "inbox" }
  | { kind: "channel"; channelId: string }
  | { kind: "agents" }
  | { kind: "settings"; section?: SettingsSection }
  | { kind: "join"; token?: string }
  | { kind: "figures" }

export type HashLocation = Pick<Location, "hash" | "replace">

const INBOX_ROUTE: AppRoute = { kind: "inbox" }

function inbox(): AppRoute {
  return { ...INBOX_ROUTE }
}

function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

/** Decode one route segment without allowing malformed URI data to escape. */
function decodeSegment(value: string): string | null {
  if (!value) return null

  try {
    const decoded = decodeURIComponent(value)
    return decoded ? decoded : null
  } catch {
    return null
  }
}

/** Encode one route segment so IDs cannot become additional hash segments. */
function encodeSegment(value: string): string | null {
  if (!value) return null
  return encodeURIComponent(value)
}

/**
 * Parse a browser hash into the canonical route model.
 *
 * Invalid, retired, empty, and unknown top-level hashes resolve to Inbox. A
 * malformed channel segment is treated the same way; authorization and
 * existence checks remain the provider/server's responsibility.
 */
export function parseHash(hash: string): AppRoute {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  if (!raw) return inbox()

  const [path, query = ""] = raw.split("?", 2)

  if (path === "inbox") return inbox()
  if (path === "agents") return { kind: "agents" }
  if (path === "figures") return { kind: "figures" }
  if (path === "home" || path === "modules") return inbox()

  if (path === "join") {
    const token = new URLSearchParams(query).get("token")
    return token ? { kind: "join", token } : { kind: "join" }
  }

  if (path === "settings") return parseSettingsRoute()

  if (path.startsWith("settings/")) {
    const section = decodeSegment(path.slice("settings/".length))
    return section && isSettingsSection(section)
      ? { kind: "settings", section }
      : parseSettingsRoute()
  }

  if (path.startsWith("channel/") && !path.slice("channel/".length).includes("/")) {
    const channelId = decodeSegment(path.slice("channel/".length))
    return channelId ? { kind: "channel", channelId } : inbox()
  }

  return inbox()
}

function parseSettingsRoute(): AppRoute {
  return { kind: "settings" }
}

/** Serialize a typed route to its canonical hash. */
export function serializeRoute(route: AppRoute): string {
  switch (route.kind) {
    case "inbox":
      return "#inbox"
    case "agents":
      return "#agents"
    case "figures":
      return "#figures"
    case "channel": {
      const channelId = encodeSegment(route.channelId)
      return channelId ? `#channel/${channelId}` : "#inbox"
    }
    case "settings":
      return route.section && isSettingsSection(route.section)
        ? `#settings/${encodeURIComponent(route.section)}`
        : "#settings"
    case "join":
      return route.token
        ? `#join?${new URLSearchParams({ token: route.token }).toString()}`
        : "#join"
  }
}

/** Normalize any hash into a safe, canonical destination. */
export function canonicalizeHash(hash: string): string {
  return serializeRoute(parseHash(hash))
}

/**
 * Return the route to restore when Settings is closed.
 *
 * Settings cannot become its own return target. The optional fallback keeps
 * this helper deterministic for a direct `#settings` deep link.
 */
export function priorRouteForSettings(
  route: AppRoute | null | undefined,
  fallback: AppRoute = INBOX_ROUTE,
): AppRoute {
  return route && route.kind !== "settings" ? route : fallback.kind === "settings" ? inbox() : fallback
}

/** Native push navigation: assigning the hash preserves browser history. */
export function navigateTo(route: AppRoute, target?: HashLocation): string {
  const hash = serializeRoute(route)
  const locationTarget = target ?? (typeof window === "undefined" ? undefined : window.location)
  if (locationTarget && locationTarget.hash !== hash) locationTarget.hash = hash
  return hash
}

/** Native replacement navigation for retiring/normalizing an old hash. */
export function replaceWith(route: AppRoute, target?: HashLocation): string {
  const hash = serializeRoute(route)
  const locationTarget = target ?? (typeof window === "undefined" ? undefined : window.location)
  if (locationTarget && locationTarget.hash !== hash) locationTarget.replace(hash)
  return hash
}

