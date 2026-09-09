import { ComposerAgentActivity } from "@/components/workspace/agent-activity"
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input"
import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import type { Member, MessageBlock } from "@ada/protocol"
import { ArrowUpIcon, AtSignIcon, CheckIcon, PlusIcon, SearchIcon, SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { ActionSection, NavigationItem, PageHeader } from "@/components/workspace/page-layout"
import { MentionEditor } from "@/components/workspace/mention-editor"
import { useThemePreferences } from "@/lib/preferences"

const examples: Array<Member & { joinsOnSend?: boolean }> = [
  { id: "example-tutor", name: "Course tutor", kind: "agent", scope: "community", createdBy: "example", instructions: "", provider: { mode: "subscription", model: "default" }, channelIds: [], presence: "online" },
  { id: "example-curator", name: "Knowledge curator", kind: "agent", scope: "community", createdBy: "example", instructions: "", provider: { mode: "subscription", model: "default" }, channelIds: [], presence: "online", joinsOnSend: true },
]

/** Developer reference using the same live primitives as product screens. */
export function DesignSystem() {
  const { theme, setTheme } = useThemePreferences()
  const editorRef = useRef<Editor | null>(null)
  const [draft, setDraft] = useState<MessageBlock[][]>([])
  const [messages, setMessages] = useState<MessageBlock[][][]>([])
  const [activity, setActivity] = useState("thinking")
  const activityAgents = examples.filter((agent) => agent.kind === "agent").slice(0, activity === "multiple" ? 2 : 1).map((agent) => ({ ...agent, presence: activity === "idle" ? "online" as const : activity === "publishing" ? "publishing" as const : "thinking" as const }))
  const send = () => {
    if (!draft.flat().some((block) => block.text.trim())) return
    setMessages((previous) => [...previous, draft]); editorRef.current?.commands.clearContent(); setDraft([])
  }
  return <main className="h-dvh overflow-y-auto bg-background text-foreground">
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-page font-semibold">Ada interface system</h1><p className="mt-2 max-w-prose text-sm text-muted-foreground">Working components for course conversations. This developer reference uses fictional content and never sends messages to a community.</p></div>
        <label className="flex items-center gap-2 text-sm">Appearance<select className="rounded-md border border-input bg-background p-2" value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      </header>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <div><h2 className="text-section font-semibold">Page composition</h2><p className="mt-2 text-sm text-muted-foreground">Settings and Agents share this header, navigation, and action layout.</p></div>
        <div className="min-w-0 space-y-4"><PageHeader title="Profile" description="The name people see across your communities." /><NavigationItem active icon={<SettingsIcon />} label="Selected navigation" onClick={() => {}} /><NavigationItem icon={<SettingsIcon />} label="Default navigation" onClick={() => {}} /><ActionSection title="Community invitations" description="Create an invitation for a new member." action={<Button size="sm" variant="outline">Invite</Button>} /><ActionSection destructive title="Leave community" description="You will need a new invitation to return." action={<Button size="sm" variant="destructive">Leave</Button>} /></div>
      </section>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <div><h2 className="text-section font-semibold">Type & rhythm</h2><p className="mt-2 text-sm text-muted-foreground">One operating face. A four-point spacing rhythm.</p></div>
        <div className="flex flex-col gap-4"><p className="text-page font-semibold">Page title · 20 / 28</p><p className="text-section font-semibold">Section heading · 16 / 24</p><p className="text-message max-w-[68ch]">Conversation · 15 / 24. Clear explanations need room to breathe, especially when a course question runs longer than a single line.</p><p className="text-ui">Controls and navigation · 14 / 20</p><p className="text-caption text-muted-foreground">Supporting information · 12 / 16</p></div>
      </section>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <div><h2 className="text-section font-semibold">Actions & icons</h2><p className="mt-2 text-sm text-muted-foreground">16px icons in ordinary actions; 14px in compact controls.</p></div>
        <div className="flex flex-col gap-4"><div className="flex flex-wrap items-center gap-2"><Button><PlusIcon data-icon="inline-start" />Create agent</Button><Button variant="outline">Edit rules</Button><Button variant="ghost">Cancel</Button><Button disabled>Saving…</Button></div><div className="flex flex-wrap items-center gap-2"><Button size="icon" variant="outline" aria-label="Search example"><SearchIcon /></Button><Button size="icon-sm" variant="ghost" aria-label="Settings example"><SettingsIcon /></Button><Button size="sm" variant="secondary"><CheckIcon data-icon="inline-start" />Saved</Button><Badge variant="secondary">Online</Badge><Badge variant="outline">Read-only</Badge></div></div>
      </section>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <div><h2 className="text-section font-semibold">Forms</h2><p className="mt-2 text-sm text-muted-foreground">Persistent labels, clear instructions, visible focus.</p></div>
        <FieldGroup><Field><FieldLabel htmlFor="example-agent-name">Agent name</FieldLabel><Input id="example-agent-name" placeholder="e.g. Course tutor" /><FieldDescription>Use a name students can recognize in a conversation.</FieldDescription></Field><Field data-invalid><FieldLabel htmlFor="example-required">Required field</FieldLabel><Input id="example-required" aria-invalid="true" aria-describedby="example-error" /><p id="example-error" className="text-sm text-destructive">Enter a name to continue.</p></Field></FieldGroup>
      </section>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <div><h2 className="text-section font-semibold">Mentions</h2><p className="mt-2 text-sm text-muted-foreground">Type @. Complete with Tab or Enter. Shift+Enter adds a line.</p></div>
        <div className="min-w-0"><div className="mb-4 flex flex-col gap-3 text-message"><p><span className="font-semibold">Student</span><br /><span className="mention-chip">@Course tutor</span> Could we work through an example?</p>{messages.map((paragraphs, index) => <div key={index}>{paragraphs.map((blocks, line) => <p key={line}>{blocks.map((block, position) => <span key={position} className={block.kind === "mention" ? "mention-chip" : undefined}>{block.text}</span>)}</p>)}</div>)}</div><div className="rounded-lg border border-input focus-within:border-ring"><MentionEditor initialValue={[]} editorRef={editorRef} candidates={examples} disabled={false} label="Try a mention" placeholder="Try @Course tutor" onChange={setDraft} onSubmit={send} /><div className="flex items-center justify-between px-2 pb-2"><Button size="icon-sm" variant="ghost" aria-label="Insert mention" onClick={() => editorRef.current?.chain().focus().insertContent("@").run()}><AtSignIcon /></Button><Button size="icon-sm" aria-label="Send example" disabled={!draft.flat().some((block) => block.text.trim())} onClick={send}><ArrowUpIcon /></Button></div></div></div>
      </section>
      <section className="grid gap-6 md:grid-cols-[12rem_1fr]"><div><h2 className="text-section font-semibold">Agent activity</h2><p className="mt-2 text-sm text-muted-foreground">The composer grows to include live work and knowledge publication.</p></div><div className="min-w-0 space-y-3">
        <label className="flex items-center gap-3 text-sm">Activity state<select className="rounded-md border bg-background px-2 py-1" value={activity} onChange={(event) => setActivity(event.target.value)}><option value="idle">Idle</option><option value="thinking">Thinking</option><option value="multiple">Multiple agents</option><option value="publishing">Saving knowledge</option></select></label>
        <PromptInput onSubmit={() => {}}><ComposerAgentActivity agents={activityAgents} /><PromptInputBody><PromptInputTextarea aria-label="Activity example message" placeholder="Message #course" /></PromptInputBody><PromptInputFooter><span className="text-xs text-muted-foreground">Preview only</span><PromptInputSubmit disabled /></PromptInputFooter></PromptInput>
      </div></section>
      <footer className="border-t pt-5 text-sm text-muted-foreground">Source of truth: DESIGN.md · Components: apps/web/src/components/ui · Tokens: apps/web/src/index.css</footer>
    </div>
  </main>
}
