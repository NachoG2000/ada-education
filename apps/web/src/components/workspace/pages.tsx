import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CommandIcon,
  ExternalLinkIcon,
  LaptopIcon,
  MoonIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"
import { PresenceTag } from "@/components/ada/identity"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { isTeacher, useCommunity } from "@/lib/community"
import { useAppNavigation, type SettingsSection } from "@/lib/routes"
import { useConversationSpacingPreferences, useThemePreferences, type ThemePreference } from "@/lib/preferences"
import { cn } from "@/lib/utils"
import { useHostedWorkspace } from "./hosted-context"
import type { Agent } from "@/lib/types"
import { PageHeader, PageScroller } from "./page-layout"
import { useClock } from "./use-clock"

export function NewMessagePage() {
  const { community } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const [query, setQuery] = useState("")
  const [pendingId, setPendingId] = useState<string>()
  const [error, setError] = useState<string>()
  const agents = community.members
    .filter((member): member is Agent => member.kind === "agent" && member.status !== "inactive")
    .filter((agent) => agent.name.toLowerCase().includes(query.trim().toLowerCase()))

  const select = async (agentId: string) => {
    setPendingId(agentId)
    setError(undefined)
    try {
      const channelId = await hosted.createAgentDm(agentId)
      await navigateTo({ kind: "channel", channelId })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The conversation could not be opened.")
    } finally {
      setPendingId(undefined)
    }
  }

  return (
    <PageScroller>
      <PageHeader title="New message" description="Start a private conversation with an agent in this community." />
      <Field className="mt-7" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="message-recipient">To</FieldLabel>
        <Input id="message-recipient" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an agent" aria-invalid={Boolean(error)} />
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : <FieldDescription>Teachers can read student-agent conversations.</FieldDescription>}
      </Field>
      <div className="mt-5 overflow-hidden rounded-xl border">
        {agents.map((agent, index) => (
          <div key={agent.id}>
            {index ? <Separator /> : null}
            <button type="button" disabled={Boolean(pendingId)} onClick={() => void select(agent.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60">
              <MemberAvatar member={agent} size={36} presence />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{agent.name}</span><span className="block truncate text-xs text-muted-foreground">Classroom agent</span></span>
              <span className="text-xs text-muted-foreground">{pendingId === agent.id ? "Opening…" : "Message"}</span>
            </button>
          </div>
        ))}
        {agents.length === 0 ? <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><MessageSquareIcon className="text-muted-foreground" /><p className="text-sm font-medium">No matching agents</p><p className="text-xs text-muted-foreground">Try another name or ask a teacher to create an agent.</p></div> : null}
      </div>
    </PageScroller>
  )
}

export function AgentsPage({ onCreateAgent, onSelectAgent }: { onCreateAgent: () => void; onSelectAgent: (agentId: string) => void }) {
  const { community, me } = useCommunity()
  const now = useClock()
  const agents = community.members.filter((member) => member.kind === "agent")
  const teacher = isTeacher(me)
  return (
    <PageScroller wide>
      <PageHeader
        title="Agents"
        description="Set up and manage the agents that support this course."
        action={teacher ? <Button type="button" size="sm" onClick={onCreateAgent}><PlusIcon data-icon="inline-start" />Create agent</Button> : undefined}
      />
      {agents.length ? (
        <section className="mt-8" aria-labelledby="course-agents">
          <div className="flex items-center justify-between gap-3">
            <h2 id="course-agents" className="text-sm font-semibold">Course agents</h2>
            <span className="text-xs text-muted-foreground">{agents.length} configured</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border">
            {agents.map((agent, index) => (
              <div key={agent.id}>
                {index ? <Separator /> : null}
                <button
                  type="button"
                  onClick={() => onSelectAgent(agent.id)}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <MemberAvatar member={agent} size={36} presence />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{agent.name}</span>
                      <Badge variant="outline">{agentStatusLabel(agent, now)}</Badge>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{agent.description || agent.instructions || "No description yet."}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{agent.channelIds.length} channels</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-60" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BotIcon /></EmptyMedia>
            <EmptyTitle>No agents yet</EmptyTitle>
            <EmptyDescription>Create an agent, give it course instructions, and choose the channels where it can help.</EmptyDescription>
          </EmptyHeader>
          {teacher ? <EmptyContent><Button type="button" onClick={onCreateAgent}><PlusIcon data-icon="inline-start" />Create agent</Button></EmptyContent> : null}
        </Empty>
      )}
    </PageScroller>
  )
}

function agentStatusLabel(agent: Agent, now: number): string {
  if (agent.status === "inactive") return "Deleted"
  if (agent.presence !== "away") return agent.presence[0].toUpperCase() + agent.presence.slice(1)
  if (agent.createdAt && now - new Date(agent.createdAt).getTime() < 15_000) return "Starting…"
  return "Offline"
}

const SETTINGS: Array<{ section: SettingsSection; label: string; icon: LucideIcon }> = [
  { section: "profile", label: "Profile", icon: UsersIcon },
  { section: "community", label: "Community", icon: UsersIcon },
  { section: "members", label: "Members", icon: UsersIcon },
  { section: "invites", label: "Invites", icon: ExternalLinkIcon },
  { section: "shortcuts", label: "Shortcuts", icon: CommandIcon },
  { section: "account", label: "Account", icon: BotIcon },
]

export function SettingsPage({
  section = "profile",
  onCreateInvite,
  onRotateAgent,
  onBack,
}: {
  section?: SettingsSection
  onCreateInvite?: () => Promise<{ joinHash: string }>
  onRotateAgent?: (agentId: string) => Promise<void>
  onBack: () => void
}) {
  const { community } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const select = (next: SettingsSection) => void navigateTo({ kind: "settings", section: next }, { replace: true })
  return (
    <div className="flex size-full min-h-0">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar/45 sm:flex" aria-label="Settings sections">
        <div className="flex min-h-14 items-center px-4">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeftIcon data-icon="inline-start" />Back to Ada</Button>
        </div>
        <nav className="flex flex-col gap-1 px-2 py-2">
          {SETTINGS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.section}
                type="button"
                onClick={() => select(item.section)}
                aria-current={section === item.section ? "page" : undefined}
                className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring", section === item.section && "bg-background/80 font-medium")}
              >
                <Icon aria-hidden className="size-4 opacity-70" />{item.label}
              </button>
            )
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-center gap-2 sm:hidden">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to Ada"><ArrowLeftIcon /></Button>
            <select className="h-8 flex-1 rounded-md border bg-background px-2 text-sm" value={section} onChange={(event) => select(event.target.value as SettingsSection)}>
              {SETTINGS.map((item) => <option key={item.section} value={item.section}>{item.label}</option>)}
            </select>
          </div>
          <SettingsPanel section={section} onCreateInvite={onCreateInvite} onRotateAgent={onRotateAgent} />
        </div>
      </main>
    </div>
  )
}

function SettingsPanel({ section, onCreateInvite, onRotateAgent }: { section: SettingsSection; onCreateInvite?: () => Promise<{ joinHash: string }>; onRotateAgent?: (agentId: string) => Promise<void> }) {
  if (section === "invites") return <InviteSettings onCreateInvite={onCreateInvite} />
  if (section === "shortcuts") return <ShortcutSettings />
  if (section === "account") return <RunnerSettings onRotateAgent={onRotateAgent} />
  if (section === "members") return <AppearanceSettings />
  return <CourseSettings />
}

function CourseSettings() {
  const { community, me, workspace } = useCommunity()
  const [courseName, setCourseName] = useState(community.name)
  const [displayName, setDisplayName] = useState(me.name)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const save = async () => {
    setPending(true)
    setMessage(null)
    try {
      if (isTeacher(me) && courseName.trim() !== community.name) await workspace.updateCommunity({ name: courseName.trim() })
      if (displayName.trim() !== me.name) await workspace.updateProfile({ name: displayName.trim() })
      setMessage("Changes saved.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The changes could not be saved.")
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <PageHeader title="Course & profile" description="The name people see in this course workspace." />
      <FieldGroup className="mt-8">
        <Field>
          <FieldLabel htmlFor="course-name">Course name</FieldLabel>
          <Input id="course-name" value={courseName} onChange={(event) => setCourseName(event.target.value)} disabled={!isTeacher(me) || pending} />
          <FieldDescription>Teachers can update the shared course name.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="display-name">Your display name</FieldLabel>
          <div className="flex items-center gap-3"><MemberAvatar member={me} size={38} presence /><Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={pending} /></div>
        </Field>
        <div className="flex items-center gap-3"><Button type="button" size="sm" onClick={() => void save()} disabled={pending || !displayName.trim() || (isTeacher(me) && !courseName.trim())}>{pending ? "Saving…" : "Save changes"}</Button>{message ? <span className="text-xs text-muted-foreground" role="status">{message}</span> : null}</div>
      </FieldGroup>
    </>
  )
}

function AppearanceSettings() {
  const { theme, setTheme } = useThemePreferences()
  const { comfortable, setComfortable } = useConversationSpacingPreferences()
  return (
    <>
      <PageHeader title="Appearance" description="Choose how Ada looks on this device." />
      <FieldGroup className="mt-8">
        <Field orientation="horizontal">
          <div className="min-w-0 flex-1"><FieldTitle id="theme-label">Theme</FieldTitle><FieldDescription>Follow your device or pick a fixed appearance.</FieldDescription></div>
          <ToggleGroup value={[theme]} onValueChange={(value) => value[0] && setTheme(value[0] as ThemePreference)} aria-labelledby="theme-label">
            <ToggleGroupItem value="light" aria-label="Light"><SunIcon /></ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label="Dark"><MoonIcon /></ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label="System"><LaptopIcon /></ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Separator />
        <Field orientation="horizontal">
          <div className="min-w-0 flex-1"><FieldTitle>Comfortable conversation spacing</FieldTitle><FieldDescription>Keep messages easy to scan during class.</FieldDescription></div>
          <Switch checked={comfortable} onCheckedChange={setComfortable} aria-label="Comfortable conversation spacing" />
        </Field>
      </FieldGroup>
    </>
  )
}

function RunnerSettings({ onRotateAgent }: { onRotateAgent?: (agentId: string) => Promise<void> }) {
  const { community, me } = useCommunity()
  const agents = community.members.filter((member) => member.kind === "agent")
  const [error, setError] = useState<string | null>(null)
  const rotate = async (agentId: string) => {
    if (!onRotateAgent) return
    setError(null)
    try {
      await onRotateAgent(agentId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The runner token could not be rotated.")
    }
  }
  return (
    <>
      <PageHeader title="Agent runner" description="Ada stores no provider credentials. Runners connect from the machine where the model is already available." />
      <div className="mt-8 overflow-hidden rounded-xl border">
        {agents.map((agent, index) => (
          <div key={agent.id}>
            {index ? <Separator /> : null}
            <div className="flex items-center gap-3 px-4 py-3">
              <MemberAvatar member={agent} size={34} presence />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{agent.name}</p><PresenceTag member={agent} className="text-xs text-muted-foreground" /></div>
              {(isTeacher(me) || (agent.scope === "personal" && agent.createdBy === me.id)) ? <Button type="button" variant="outline" size="sm" onClick={() => void rotate(agent.id)} disabled={!onRotateAgent || agent.status === "inactive"}><RefreshCwIcon data-icon="inline-start" />Rotate token</Button> : null}
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Rotating a token disconnects the current runner. The new setup command is shown once.</p>
    </>
  )
}

function InviteSettings({ onCreateInvite }: { onCreateInvite?: () => Promise<{ joinHash: string }> }) {
  const { me } = useCommunity()
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    if (!onCreateInvite) return
    setError(null)
    try {
      const invite = await onCreateInvite()
      const value = new URL(invite.joinHash, location.href).toString()
      setLink(value)
      await navigator.clipboard.writeText(value)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invite could not be created.")
    }
  }
  return (
    <>
      <PageHeader title="Invites" description="Invite students with a single-use link." />
      <div className="mt-8 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Student invite</h2>
        <p className="mt-1 text-sm text-muted-foreground">The link can be claimed once. Create another link for each student.</p>
        <Button type="button" className="mt-4" size="sm" onClick={create} disabled={!onCreateInvite || !isTeacher(me)}><ExternalLinkIcon data-icon="inline-start" />Create and copy link</Button>
        {!isTeacher(me) ? <p className="mt-3 text-xs text-muted-foreground">Only course teachers can create invitation links.</p> : null}
        {link ? <p className="mt-3 break-all rounded-md bg-muted p-2 font-mono text-xs"><CheckIcon className="mr-1 inline size-3" aria-hidden />{link}</p> : null}
        {error ? <p className="mt-2 text-xs text-destructive" role="alert">{error}</p> : null}
      </div>
    </>
  )
}

const SHORTCUTS = [
  ["Quick search", "⌘ K"], ["New channel", "⇧ ⌘ N"], ["Settings", "⌘ ,"],
  ["Toggle sidebar", "⌘ S"], ["Back / forward", "⌘ [ / ⌘ ]"], ["Find in channel", "⌘ F"],
  ["Send message", "Enter"], ["New line", "⇧ Enter"],
]

function ShortcutSettings() {
  return (
    <>
      <PageHeader title="Keyboard shortcuts" description="Move through the course without leaving the keyboard." />
      <div className="mt-8 overflow-hidden rounded-xl border">
        {SHORTCUTS.map(([label, keys], index) => (
          <div key={label}>
            {index ? <Separator /> : null}
            <div className="flex items-center gap-4 px-4 py-3"><span className="flex-1 text-sm">{label}</span><kbd className="rounded-md bg-muted px-2 py-1 font-sans text-xs text-muted-foreground">{keys}</kbd></div>
          </div>
        ))}
      </div>
    </>
  )
}
