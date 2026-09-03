import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react"

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = Exclude<ThemePreference, "system">

export const PREFERENCES_VERSION = 1
export const PREFERENCE_KEYS = {
  theme: `ada:preferences:v${PREFERENCES_VERSION}:theme`,
  sidebarOpen: `ada:preferences:v${PREFERENCES_VERSION}:sidebar-open`,
  sidebarWidth: `ada:preferences:v${PREFERENCES_VERSION}:sidebar-width`,
  auxiliaryWidth: `ada:preferences:v${PREFERENCES_VERSION}:auxiliary-width`,
  comfortableSpacing: `ada:preferences:v${PREFERENCES_VERSION}:comfortable-spacing`,
} as const

export const SIDEBAR_WIDTH_MIN = 220
export const SIDEBAR_WIDTH_MAX = 420
export const SIDEBAR_WIDTH_DEFAULT = 300

export const AUXILIARY_WIDTH_MIN = 300
export const AUXILIARY_WIDTH_MAX = 720
export const AUXILIARY_WIDTH_DEFAULT = 380

export const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

type MatchMediaTarget = Pick<Window, "matchMedia">
type ThemeDocument = Pick<Document, "documentElement">

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function storageOrBrowser(storage?: StorageLike | null): StorageLike | null {
  return storage === undefined ? browserStorage() : storage
}

function readStorage(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage: StorageLike | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Storage can be unavailable or quota-limited; preferences remain usable in memory.
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

function readBoolean(storage: StorageLike | null, key: string, fallback: boolean): boolean {
  const value = readStorage(storage, key)
  return value === "true" ? true : value === "false" ? false : fallback
}

function readNumber(storage: StorageLike | null, key: string, fallback: number): number {
  const value = readStorage(storage, key)
  if (!value?.trim()) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readThemeValue(storage: StorageLike | null): ThemePreference {
  const value = readStorage(storage, PREFERENCE_KEYS.theme)
  return isThemePreference(value) ? value : "system"
}

export function readTheme(storage?: StorageLike | null): ThemePreference {
  return readThemeValue(storageOrBrowser(storage))
}

export function writeTheme(theme: ThemePreference, storage?: StorageLike | null): ThemePreference {
  const value = isThemePreference(theme) ? theme : "system"
  writeStorage(storageOrBrowser(storage), PREFERENCE_KEYS.theme, serializeTheme(value))
  return value
}

export function readSidebarOpen(storage?: StorageLike | null): boolean {
  return readBoolean(storageOrBrowser(storage), PREFERENCE_KEYS.sidebarOpen, true)
}

export function writeSidebarOpen(open: boolean, storage?: StorageLike | null): boolean {
  writeStorage(storageOrBrowser(storage), PREFERENCE_KEYS.sidebarOpen, serializeBoolean(open))
  return open
}

export function readSidebarWidth(storage?: StorageLike | null): number {
  return clampSidebarWidth(readNumber(storageOrBrowser(storage), PREFERENCE_KEYS.sidebarWidth, SIDEBAR_WIDTH_DEFAULT))
}

export function writeSidebarWidth(width: number, storage?: StorageLike | null): number {
  const value = clampSidebarWidth(width)
  writeStorage(storageOrBrowser(storage), PREFERENCE_KEYS.sidebarWidth, serializeNumber(value))
  return value
}

export function readAuxiliaryWidth(storage?: StorageLike | null): number {
  return clampAuxiliaryWidth(readNumber(storageOrBrowser(storage), PREFERENCE_KEYS.auxiliaryWidth, AUXILIARY_WIDTH_DEFAULT))
}

export function writeAuxiliaryWidth(width: number, storage?: StorageLike | null): number {
  const value = clampAuxiliaryWidth(width)
  writeStorage(storageOrBrowser(storage), PREFERENCE_KEYS.auxiliaryWidth, serializeNumber(value))
  return value
}

export function readComfortableSpacing(storage?: StorageLike | null): boolean {
  return readBoolean(storageOrBrowser(storage), PREFERENCE_KEYS.comfortableSpacing, true)
}

export function writeComfortableSpacing(comfortable: boolean, storage?: StorageLike | null): boolean {
  writeStorage(storageOrBrowser(storage), PREFERENCE_KEYS.comfortableSpacing, serializeBoolean(comfortable))
  return comfortable
}

function serializeBoolean(value: boolean): string {
  return String(value)
}

function serializeNumber(value: number): string {
  return String(value)
}

function serializeTheme(value: ThemePreference): string {
  return value
}

function getMatchMedia(target?: MatchMediaTarget): MediaQueryList | null {
  try {
    const matchMedia = target?.matchMedia ?? (typeof window === "undefined" ? null : window.matchMedia.bind(window))
    return matchMedia ? matchMedia(COLOR_SCHEME_QUERY) : null
  } catch {
    return null
  }
}

/** Resolve a preference without touching the DOM when used during SSR/tests. */
export function resolveTheme(theme: ThemePreference, target?: MatchMediaTarget): ResolvedTheme {
  if (theme !== "system") return theme
  return getMatchMedia(target)?.matches ? "dark" : "light"
}

function subscribeToQuery(
  query: string,
  onChange: () => void,
  target?: MatchMediaTarget,
): () => void {
  let media: MediaQueryList | null = null

  try {
    const matchMedia = target?.matchMedia ?? (typeof window === "undefined" ? null : window.matchMedia.bind(window))
    media = matchMedia ? matchMedia(query) : null
  } catch {
    return () => undefined
  }

  if (!media) return () => undefined

  const listener = () => onChange()
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener)
    return () => media?.removeEventListener("change", listener)
  }

  media.addListener(listener)
  return () => media?.removeListener(listener)
}

/** Subscribe to OS light/dark changes for a `system` preference. */
export function subscribeToSystemTheme(onChange: () => void, target?: MatchMediaTarget): () => void {
  return subscribeToQuery(COLOR_SCHEME_QUERY, onChange, target)
}

/** Apply both the semantic root attribute and the class used by Ada's CSS variant. */
export function applyTheme(theme: ThemePreference, target?: ThemeDocument): ResolvedTheme {
  const resolved = resolveTheme(theme)
  const documentTarget = target ?? (typeof document === "undefined" ? undefined : document)

  if (documentTarget) {
    const root = documentTarget.documentElement
    root.dataset.theme = resolved
    root.classList.toggle("dark", resolved === "dark")
    root.style.colorScheme = resolved
  }

  return resolved
}

/** React hook that follows the OS when the preference is `system`. */
export function useResolvedTheme(theme: ThemePreference): ResolvedTheme {
  const subscribe = useCallback(
    (onChange: () => void) => (theme === "system" ? subscribeToSystemTheme(onChange) : () => undefined),
    [theme],
  )
  const getSnapshot = useCallback(() => resolveTheme(theme), [theme])
  const getServerSnapshot = useCallback((): ResolvedTheme => (theme === "dark" ? "dark" : "light"), [theme])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** React hook for the reduced-motion media query, including OS changes. */
export function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => subscribeToQuery(REDUCED_MOTION_QUERY, onChange), [])
  const getSnapshot = useCallback(() => {
    try {
      return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION_QUERY).matches
    } catch {
      return false
    }
  }, [])
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function prefersReducedMotion(target?: MatchMediaTarget): boolean {
  try {
    const matchMedia = target?.matchMedia ?? (typeof window === "undefined" ? null : window.matchMedia.bind(window))
    return Boolean(matchMedia?.(REDUCED_MOTION_QUERY).matches)
  } catch {
    return false
  }
}

export function clampSidebarWidth(value: number): number {
  return clampWidth(value, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT)
}

export function clampAuxiliaryWidth(value: number): number {
  return clampWidth(value, AUXILIARY_WIDTH_MIN, AUXILIARY_WIDTH_MAX, AUXILIARY_WIDTH_DEFAULT)
}

function clampWidth(value: number, minimum: number, maximum: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(Math.min(maximum, Math.max(minimum, value)))
}

function useStoredValue<T>(
  key: string,
  fallback: T,
  read: (storage: StorageLike | null, key: string, fallback: T) => T,
  serialize: (value: T) => string,
  storage?: StorageLike | null,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const storageTarget = useMemo(() => storageOrBrowser(storage), [storage])
  const [value, setValue] = useState(() => read(storageTarget, key, fallback))
  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next
        writeStorage(storageTarget, key, serialize(resolved))
        return resolved
      })
    },
    [key, serialize, storageTarget],
  )

  return [value, setStoredValue]
}

export interface ThemePreferences {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: Dispatch<SetStateAction<ThemePreference>>
}

/** Persist the selected theme and apply its resolved root state. */
export function useThemePreferences(storage?: StorageLike | null): ThemePreferences {
  const [theme, setStoredTheme] = useStoredValue<ThemePreference>(
    PREFERENCE_KEYS.theme,
    "system" as ThemePreference,
    (source, _key, fallback) => readThemeValue(source) || fallback,
    serializeTheme,
    storage,
  )
  const setTheme = useCallback<Dispatch<SetStateAction<ThemePreference>>>(
    (next) => {
      setStoredTheme((current) => {
        const value = typeof next === "function" ? (next as (current: ThemePreference) => ThemePreference)(current) : next
        return isThemePreference(value) ? value : "system"
      })
    },
    [setStoredTheme],
  )
  const resolvedTheme = useResolvedTheme(theme)

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  return { theme, resolvedTheme, setTheme }
}

export interface SidebarPreferences {
  open: boolean
  width: number
  setOpen: Dispatch<SetStateAction<boolean>>
  setWidth: Dispatch<SetStateAction<number>>
}

export function useSidebarPreferences(storage?: StorageLike | null): SidebarPreferences {
  const [open, setOpen] = useStoredValue<boolean>(
    PREFERENCE_KEYS.sidebarOpen,
    true,
    (source, key, fallback) => readBoolean(source, key, fallback),
    serializeBoolean,
    storage,
  )
  const [width, setStoredWidth] = useStoredValue<number>(
    PREFERENCE_KEYS.sidebarWidth,
    SIDEBAR_WIDTH_DEFAULT,
    (source, key, fallback) => clampSidebarWidth(readNumber(source, key, fallback)),
    serializeNumber,
    storage,
  )
  const setWidth = useCallback<Dispatch<SetStateAction<number>>>(
    (next) => {
      setStoredWidth((current) => clampSidebarWidth(typeof next === "function" ? (next as (current: number) => number)(current) : next))
    },
    [setStoredWidth],
  )

  return { open, width, setOpen, setWidth }
}

export interface AuxiliaryPreferences {
  width: number
  setWidth: Dispatch<SetStateAction<number>>
}

export interface ConversationSpacingPreferences {
  comfortable: boolean
  setComfortable: Dispatch<SetStateAction<boolean>>
}

export function useConversationSpacingPreferences(storage?: StorageLike | null): ConversationSpacingPreferences {
  const [comfortable, setComfortable] = useStoredValue<boolean>(
    PREFERENCE_KEYS.comfortableSpacing,
    true,
    (source, key, fallback) => readBoolean(source, key, fallback),
    serializeBoolean,
    storage,
  )
  return { comfortable, setComfortable }
}

export function useAuxiliaryPreferences(storage?: StorageLike | null): AuxiliaryPreferences {
  const [width, setStoredWidth] = useStoredValue<number>(
    PREFERENCE_KEYS.auxiliaryWidth,
    AUXILIARY_WIDTH_DEFAULT,
    (source, key, fallback) => clampAuxiliaryWidth(readNumber(source, key, fallback)),
    serializeNumber,
    storage,
  )
  const setWidth = useCallback<Dispatch<SetStateAction<number>>>(
    (next) => {
      setStoredWidth((current) => clampAuxiliaryWidth(typeof next === "function" ? (next as (current: number) => number)(current) : next))
    },
    [setStoredWidth],
  )

  return { width, setWidth }
}
