import { useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeftIcon,
  AtSignIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  CommandIcon,
  ExternalLinkIcon,
  HashIcon,
  InboxIcon,
  LaptopIcon,
  MoonIcon,
  MessageSquareTextIcon,
  PaletteIcon,
  PlusIcon,
  RefreshCwIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"
import { MemberAvatar, PresenceTag } from "@/components/ada/identity"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { isTeacher, useCommunity } from "@/lib/community"
import type { SettingsSection } from "@/lib/routes"
import { navigateTo } from "@/lib/routes"
import { useConversationSpacingPreferences, useThemePreferences, type ThemePreference } from "@/lib/preferences"
import { cn } from "@/lib/utils"

export function InboxPage() {
  const { community, member, me, openThread } = useCommunity()
  const activity = [...community.messages]
    .filter((message) => !message.threadId && !message.deletedAt)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)
  const unread = community.channels.filter((channel) => channel.unread && channel.status !== "archived")
  const directed = [...community.messages]
    .filter((message) => !message.deletedAt && message.authorId !== me.id)
    .filter((message) => {
      const text = message.paragraphs.flat().map((block) => block.text).join(" ").toLowerCase()
      const mention = text.includes(`@${me.id.toLowerCase()}`) || text.includes(`@${me.name.toLowerCase()}`)
      const reply = Boolean(message.threadId)
      return mention || reply
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)

  const openActivity = (message: typeof community.messages[number]) => {
    navigateTo({ kind: "channel", channelId: message.channelId })
    if (message.threadId) openThread(message.threadId)
  }

  return (
    <PageScroller>
      <PageHeader title="Inbox" description="Course activity that needs your attention." />
      {unread.length ? (
        <section aria-labelledby="inbox-unread" className="mt-7">
          <h2 id="inbox-unread" className="text-sm font-semibold">Unread channels</h2>
          <div className="mt-2 flex flex-col gap-1">
            {unread.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => navigateTo({ kind: "channel", channelId: channel.id })}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted"><HashIcon aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{channel.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{channel.description || "Unread course conversation"}</span>
                </span>
                <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {directed.length ? (
        <section aria-labelledby="inbox-directed" className="mt-8">
          <h2 id="inbox-directed" className="text-sm font-semibold">Mentions & replies</h2>
          <div className="mt-2 flex flex-col">
            {directed.map((message, index) => {
              const author = member(message.authorId)
              const channel = community.channels.find((item) => item.id === message.channelId)
              if (!channel) return null
              return <div key={`directed-${message.id}`}>{index ? <Separator /> : null}<button type="button" onClick={() => openActivity(message)} className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">{message.threadId ? <MessageSquareTextIcon aria-hidden /> : <AtSignIcon aria-hidden />}</span><span className="min-w-0 flex-1"><span className="flex items-baseline gap-2"><span className="truncate text-sm font-medium">{author.name}</span><span className="truncate text-xs text-muted-foreground">#{channel.name}</span></span><span className="mt-0.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{messageText(message)}</span></span><ChevronRightIcon className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden /></button></div>
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="inbox-recent" className="mt-8">
        <h2 id="inbox-recent" className="text-sm font-semibold">Recent activity</h2>
        {activity.length ? (
          <div className="mt-2 flex flex-col">
            {activity.map((message, index) => {
              const author = member(message.authorId)
              const channel = community.channels.find((item) => item.id === message.channelId)
              const preview = message.paragraphs.flat().map((block) => block.text).join(" ")
              if (!channel) return null
              return (
                <div key={message.id}>
                  {index ? <Separator /> : null}
                  <button
                    type="button"
                    onClick={() => openActivity(message)}
                    className="group flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MemberAvatar member={author} size={34} presence />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium">{author.name}</span>
                        <span className="truncate text-xs text-muted-foreground">#{channel.name}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{message.deletedAt ? "Message deleted" : preview}</span>
                    </span>
                    <ChevronRightIcon className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty className="mt-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>Your inbox is clear</EmptyTitle>
              <EmptyDescription>New replies and course activity will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </PageScroller>
  )
}

function messageText(message: { paragraphs: Array<Array<{ text: string }>> }): string {
  return message.paragraphs.flat().map((block) => block.text).join(" ")
}

export function AgentsPage({ onCreateAgent, onEditAgent }: { onCreateAgent: () => void; onEditAgent: (agentId: string) => void }) {
  const { community, me } = useCommunity()
  const agents = community.members.filter((member) => member.kind === "agent")
  return (
    <PageScroller wide>
      <PageHeader
        title="Agents"
        description="Set up and manage the agents that support this course."
        action={<Button type="button" size="sm" onClick={onCreateAgent}><PlusIcon data-icon="inline-start" />New agent</Button>}
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
                  onClick={() => onEditAgent(agent.id)}
                  disabled={!isTeacher(me) && !(agent.scope === "personal" && agent.createdBy === me.id)}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none enabled:hover:bg-muted enabled:focus-visible:ring-2 enabled:focus-visible:ring-inset enabled:focus-visible:ring-ring"
                >
                  <MemberAvatar member={agent} size={42} presence />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{agent.name}</span>
                      <Badge variant={agent.status === "inactive" ? "secondary" : "outline"}>{agent.status === "inactive" ? "Inactive" : agent.scope === "personal" ? "Personal" : "Course"}</Badge>
                    </span>
                    <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">{agent.description || agent.instructions || "No description yet."}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{agent.channelIds.length} channels · {agent.runtime ?? "scripted"}{agent.model ? ` · ${agent.model}` : ""}</span>
                  </span>
                  {isTeacher(me) || (agent.scope === "personal" && agent.createdBy === me.id) ? <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-60" aria-hidden /> : null}
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
          <EmptyContent><Button type="button" onClick={onCreateAgent}><PlusIcon data-icon="inline-start" />Create agent</Button></EmptyContent>
        </Empty>
      )}
    </PageScroller>
  )
}

const SETTINGS: Array<{ section: SettingsSection; label: string; icon: LucideIcon }> = [
  { section: "course", label: "Course & profile", icon: UsersIcon },
  { section: "appearance", label: "Appearance", icon: PaletteIcon },
  { section: "runner", label: "Agent runner", icon: BotIcon },
  { section: "invites", label: "Invites", icon: ExternalLinkIcon },
  { section: "shortcuts", label: "Shortcuts", icon: CommandIcon },
]

export function SettingsPage({
  section = "course",
  onCreateInvite,
  onRotateAgent,
  onBack,
}: {
  section?: SettingsSection
  onCreateInvite?: () => Promise<{ joinHash: string }>
  onRotateAgent?: (agentId: string) => Promise<void>
  onBack: () => void
}) {
  const select = (next: SettingsSection) => navigateTo({ kind: "settings", section: next })
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
  if (section === "appearance") return <AppearanceSettings />
  if (section === "runner") return <RunnerSettings onRotateAgent={onRotateAgent} />
  if (section === "invites") return <InviteSettings onCreateInvite={onCreateInvite} />
  if (section === "shortcuts") return <ShortcutSettings />
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

function PageScroller({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className="size-full overflow-y-auto px-4 py-7 sm:px-6 sm:py-8"><div className={cn("mx-auto w-full", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</div></main>
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h1><p className="mt-1 max-w-[68ch] text-sm leading-5 text-muted-foreground">{description}</p></div>
      {action}
    </header>
  )
}
