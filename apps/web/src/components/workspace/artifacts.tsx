import { ArtifactCard } from "./artifact-card"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ArtifactContent, ArtifactWork, CourseArtifact } from "@ada/protocol"
import { ArrowLeftIcon, BookOpenIcon, FileTextIcon, PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useCommunity } from "@/lib/community"
import { useAppNavigation } from "@/lib/routes"
import { useEducationData } from "@/lib/use-education-data"
import { stageConsultation } from "@/lib/private-consultation"
import type { Channel } from "@/lib/types"
import { useHostedWorkspace } from "./hosted-context"
import { ArtifactMarkdown } from "./artifact-markdown"
import { DestructiveConfirmation } from "./destructive-confirmation"

const kinds = ["guide", "explanation", "practice", "assignment"] as const
const labels = { guide: "Module guide", explanation: "Explanation", practice: "Practice", assignment: "Assignment" }
const blank: ArtifactContent = { title: "", kind: "guide", summary: "", body: "", objectives: [], prompts: [], dueAt: null }
const errorText = (e: unknown) => e instanceof Error ? e.message : "Please try again."

export function ArtifactsPanel({ channel, selection, onSelect, onClose, onChanged }: { channel: Channel; selection: string; onSelect: (id: string) => void; onClose: () => void; onChanged: () => void }) {
  const { education } = useHostedWorkspace()
  const { me } = useCommunity()
  const load = useCallback(() => education.list(channel.id), [education, channel.id])
  const list = useEducationData(load)
  const [creating, setCreating] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [selection])
  const canManage = channel.status !== "archived" && (channel.kind === "dm" ? channel.ownerId === me.id : me.kind === "person" && me.role === "teacher")
  const changed = () => { void list.refresh(); onChanged() }
  return <aside className="flex size-full min-w-0 flex-col bg-background" aria-label="Artifacts" onKeyDown={(e) => { if (e.currentTarget.contains(e.target as Node) && e.key === "Escape" && !creating) { e.stopPropagation(); onClose() } }}>
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4">
      {selection !== "list" ? <Button variant="ghost" size="icon-sm" aria-label="Back to artifacts" onClick={() => onSelect("list")}><ArrowLeftIcon /></Button> : <FileTextIcon className="size-4" />}
      <h2 ref={heading} tabIndex={-1} className="min-w-0 flex-1 truncate text-sm font-semibold outline-none">Artifacts</h2>
      {selection === "list" && canManage ? <Button variant="ghost" size="sm" onClick={() => setCreating(true)}><PlusIcon />Create</Button> : null}
      <Button variant="ghost" size="icon-sm" aria-label="Close artifacts" onClick={onClose}><XIcon /></Button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {selection === "list" ? <div className="space-y-3"><p className="text-sm text-muted-foreground">{channel.kind === "dm" ? "Materials for this conversation. Teachers can read them." : "The shared materials and activities for this channel."}</p>{list.loading ? <p role="status">Loading artifacts…</p> : null}{list.error ? <p role="alert" className="text-sm text-destructive">{list.error}</p> : null}{list.data?.map((a) => <ArtifactCard key={a.id} artifact={a} onOpen={() => onSelect(a.id)} />)}{list.data?.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center"><BookOpenIcon className="mx-auto mb-3 size-6 text-muted-foreground" /><h3 className="text-sm font-semibold">A place for this module</h3><p className="mt-2 text-sm text-muted-foreground">{canManage ? "Start with a guide, then add explanations, practice, or an assignment." : "Your teacher can add materials and activities here."}</p>{canManage ? <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>Create first artifact</Button> : null}</div> : null}</div> : <ArtifactDetail key={selection} id={selection} currentChannel={channel} onDeleted={() => { changed(); onSelect("list") }} onChanged={changed} />}
    </div>
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Create artifact</DialogTitle><DialogDescription>Choose a template and add the content your students need.</DialogDescription></DialogHeader>{creating ? <ArtifactEditor channelId={channel.id} onSaved={(a) => { setCreating(false); changed(); onSelect(a.id) }} /> : null}</DialogContent></Dialog>
  </aside>
}

function ArtifactEditor({ channelId, artifact, onSaved }: { channelId: string; artifact?: CourseArtifact; onSaved: (a: CourseArtifact) => void }) {
  const { education } = useHostedWorkspace()
  const { me, community } = useCommunity()
  const cacheKey = `ada:artifact-draft:${me.id}:${community.id}:${artifact?.id ?? channelId}`
  const [content, setContent] = useState<ArtifactContent>(() => { try { const cached = sessionStorage.getItem(cacheKey); return cached ? (JSON.parse(cached).content ?? JSON.parse(cached)) : artifact?.content ?? blank } catch { return artifact?.content ?? blank } })
  const [baseVersion, setBaseVersion] = useState<number | undefined>(() => { try { const cached = sessionStorage.getItem(cacheKey); return cached ? JSON.parse(cached).baseVersion ?? artifact?.version : artifact?.version } catch { return artifact?.version } })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const change = (patch: Partial<ArtifactContent>) => { const next = { ...content, ...patch }; setContent(next); sessionStorage.setItem(cacheKey, JSON.stringify({ content: next, baseVersion })) }
  const save = async () => {
    setPending(true); setError(undefined)
    try { const a = artifact ? await education.update(artifact.id, { version: baseVersion, content: { ...content, objectives: content.objectives.filter((o) => o.trim()) } }) : await education.create(channelId, { content: { ...content, objectives: content.objectives.filter((o) => o.trim()) } }); sessionStorage.removeItem(cacheKey); onSaved(a) } catch (e) { setError(errorText(e)) } finally { setPending(false) }
  }
  return <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
    <label className="block space-y-1 text-sm font-medium">Template<select className="h-9 w-full rounded-md border bg-background px-3" value={content.kind} onChange={(e) => change({ kind: e.target.value as ArtifactContent["kind"], prompts: (e.target.value === "practice" || e.target.value === "assignment") && !content.prompts.length ? [{ id: crypto.randomUUID(), text: "", hint: "" }] : content.prompts })}>{kinds.map((k) => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
    <label className="block space-y-1 text-sm font-medium">Title<Input required maxLength={160} value={content.title} onChange={(e) => change({ title: e.target.value })} /></label>
    <label className="block space-y-1 text-sm font-medium">Summary<Input maxLength={500} value={content.summary} onChange={(e) => change({ summary: e.target.value })} /></label>
    <label className="block space-y-1 text-sm font-medium">Content <span className="font-normal text-muted-foreground">· Markdown</span><Textarea rows={8} maxLength={80000} value={content.body} onChange={(e) => change({ body: e.target.value })} /></label>
    <label className="block space-y-1 text-sm font-medium">Learning objectives <span className="font-normal text-muted-foreground">· One per line</span><Textarea value={content.objectives.join("\n")} onChange={(e) => change({ objectives: e.target.value.split("\n") })} /></label>
    {content.kind === "practice" || content.kind === "assignment" ? <div className="space-y-3"><h3 className="text-sm font-semibold">Questions</h3>{content.prompts.map((p, i) => <fieldset key={p.id} className="space-y-2 rounded-md border p-3"><legend className="px-1 text-xs">Question {i + 1}</legend><Textarea aria-label={`Question ${i + 1}`} required value={p.text} onChange={(e) => change({ prompts: content.prompts.map((q) => q.id === p.id ? { ...q, text: e.target.value } : q) })} /><Input aria-label={`Hint for question ${i + 1}`} placeholder="Optional hint" value={p.hint} onChange={(e) => change({ prompts: content.prompts.map((q) => q.id === p.id ? { ...q, hint: e.target.value } : q) })} /><Button type="button" variant="ghost" size="sm" onClick={() => change({ prompts: content.prompts.filter((q) => q.id !== p.id) })}>Remove question</Button></fieldset>)}<Button type="button" variant="outline" size="sm" disabled={content.prompts.length >= 30} onClick={() => change({ prompts: [...content.prompts, { id: crypto.randomUUID(), text: "", hint: "" }] })}><PlusIcon />Add question</Button></div> : null}
    {content.kind === "assignment" ? <label className="block space-y-1 text-sm font-medium">Due date<Input type="datetime-local" value={content.dueAt ? new Date(new Date(content.dueAt).getTime() - new Date(content.dueAt).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ""} onChange={(e) => change({ dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label> : null}
    {artifact && artifact.version !== baseVersion ? <div className="space-y-2 rounded-md border p-3"><p className="text-sm">A newer version was published. Review it before saving your draft.</p><details><summary className="cursor-pointer text-sm">Latest published content (v{artifact.version})</summary><ArtifactMarkdown body={artifact.content.body} /><p className="text-sm">{artifact.content.prompts.map((p) => p.text).join(" · ")}</p></details><Button type="button" variant="outline" size="sm" onClick={() => { setBaseVersion(artifact.version); sessionStorage.setItem(cacheKey, JSON.stringify({ content, baseVersion: artifact.version })) }}>I’ve reviewed the update</Button></div> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<p className="text-xs text-muted-foreground">Unpublished edits stay in this tab until you save.</p><Button type="submit" disabled={pending || !content.title.trim() || Boolean(artifact && artifact.version !== baseVersion)}>{pending ? "Saving…" : artifact ? "Save new version" : "Create artifact"}</Button>
  </form>
}

function ArtifactDetail({ id, currentChannel, onDeleted, onChanged }: { id: string; currentChannel: Channel; onDeleted: () => void; onChanged: () => void }) {
  const { education } = useHostedWorkspace()
  const { me, community } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const load = useCallback(() => education.get(id), [education, id])
  const result = useEducationData(load)
  const versionsLoad = useCallback(() => education.versions(id), [education, id])
  const versions = useEducationData(versionsLoad)
  const [workRevision, setWorkRevision] = useState(0)
  const [historical, setHistorical] = useState<number>()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const a = result.data
  if (!a) return <p role={result.error ? "alert" : "status"} className="text-sm">{result.error ?? "Loading artifact…"}</p>
  const source = community.channels.find((c) => c.id === a.channelId)
  const canManage = source?.status !== "archived" && (source?.kind === "dm" ? source.ownerId === me.id : me.kind === "person" && me.role === "teacher")
  const displayed = historical ? versions.data?.find((v) => v.version === historical) ?? a : a
  const content = displayed.content
  return <div className="space-y-5">
    {currentChannel.id !== a.channelId ? <div className="rounded-md border p-3 text-sm"><p>From {source?.name ?? "the course channel"}</p><Button variant="link" className="h-auto px-0" onClick={() => void navigateTo({ kind: "channel", channelId: a.channelId, artifactId: a.id })}>Return to module</Button></div> : null}
    <div><p className="text-xs text-muted-foreground">{labels[content.kind]} · v{displayed.version}</p><h3 className="mt-1 text-xl font-semibold tracking-tight">{content.title}</h3>{content.summary ? <p className="mt-2 text-sm text-muted-foreground">{content.summary}</p> : null}</div>
    <div className="flex flex-wrap gap-2">{canManage ? <><Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>Delete</Button></> : null}{source?.kind !== "dm" ? <AskPrivately artifact={displayed} /> : null}</div>
    {(versions.data?.length ?? 0) > 1 ? <label className="flex items-center gap-2 text-xs text-muted-foreground">Version<select className="rounded border bg-background p-1" value={historical ?? "latest"} onChange={(e) => setHistorical(e.target.value === "latest" ? undefined : Number(e.target.value))}><option value="latest">Latest (v{a.version})</option>{versions.data?.filter((v) => v.version !== a.version).map((v) => <option key={v.version} value={v.version}>v{v.version} · {new Date(v.updatedAt).toLocaleDateString()}</option>)}</select></label> : null}
    {historical ? <p className="rounded-md bg-muted p-3 text-sm">Viewing an earlier version. Switch to Latest to work on this activity.</p> : null}
    {content.objectives.length ? <section className="rounded-lg border p-4"><h4 className="text-sm font-semibold">What you’ll learn</h4><ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{content.objectives.filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul></section> : null}
    {content.dueAt ? <p className="text-sm font-medium">Due {new Date(content.dueAt).toLocaleString()}</p> : null}
    <ArtifactMarkdown body={content.body} />
    {historical ? content.prompts.map((p) => <ArtifactMarkdown key={p.id} body={p.text} />) : content.prompts.length ? <PersonalWork key={`${a.id}:${a.version}`} artifact={a} onSubmitted={() => setWorkRevision((v) => v + 1)} readOnly={source?.status === "archived" || source?.kind === "dm" && source.ownerId !== me.id} /> : null}
    {content.kind === "assignment" && !historical ? <Submissions key={workRevision} artifact={a} readOnly={source?.status === "archived" || source?.kind === "dm" && source.ownerId !== me.id} /> : null}
    {error || result.error ? <p role="alert" className="text-sm text-destructive">{error ?? result.error}</p> : null}
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Edit artifact</DialogTitle><DialogDescription>Saving creates a new version. Earlier versions remain readable.</DialogDescription></DialogHeader>{editing ? <ArtifactEditor artifact={a} channelId={a.channelId} onSaved={() => { setEditing(false); void result.refresh(); void versions.refresh(); onChanged() }} /> : null}</DialogContent></Dialog>
    <DestructiveConfirmation open={deleting} onOpenChange={setDeleting} title="Delete this artifact?" description="It will no longer be available from this channel. Its stored history is retained." confirmLabel="Delete artifact" pending={pending} onConfirm={async () => { setPending(true); try { await education.remove(id); onDeleted() } catch (e) { setError(errorText(e)); setDeleting(false) } finally { setPending(false) } }} />
  </div>
}

function PersonalWork({ artifact, readOnly, onSubmitted }: { artifact: CourseArtifact; readOnly: boolean; onSubmitted: () => void }) {
  const { education } = useHostedWorkspace()
  const load = useCallback(() => education.work(artifact.id), [education, artifact.id])
  const result = useEducationData(load)
  return result.data ? <WorkForm artifact={artifact} initial={result.data} readOnly={readOnly} onSubmitted={onSubmitted} /> : <p role={result.error ? "alert" : "status"} className="text-sm">{result.error ?? "Loading your work…"}</p>
}
function WorkForm({ artifact, initial, readOnly, onSubmitted }: { artifact: CourseArtifact; initial: ArtifactWork; readOnly: boolean; onSubmitted: () => void }) {
  const { education } = useHostedWorkspace()
  const { me, community } = useCommunity()
  const key = `ada:work:${community.id}:${me.id}:${artifact.id}`
  const [saved, setSaved] = useState(initial)
  const [answers, setAnswers] = useState<Record<string,string>>(() => { try { return JSON.parse(sessionStorage.getItem(key) ?? "null") ?? initial.answers } catch { return initial.answers } })
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const dirty = JSON.stringify(answers) !== JSON.stringify(saved.answers)
  const run = async (submit: boolean) => { setPending(true); setError(undefined); try {
    const valid = Object.fromEntries(artifact.content.prompts.map((p) => [p.id, answers[p.id] ?? ""]))
    const next = await education.saveWork(artifact.id, { answers: valid, version: saved.version, artifactVersion: artifact.version }); setSaved(next); setAnswers(next.answers); sessionStorage.removeItem(key)
    if (submit) { await education.submit(artifact.id, next.version); onSubmitted() }
    setNotice(submit ? "Submitted to your teacher. Later edits stay private until you submit again." : "Saved privately."); setConfirm(false)
  } catch (e) { setError(errorText(e)) } finally { setPending(false) } }
  return <section className="space-y-4 border-t pt-5"><h4 className="text-sm font-semibold">Your work</h4><p className="text-xs text-muted-foreground">Answers are personal. Only an explicit submission shares a copy with teachers.</p>{saved.artifactVersion !== artifact.version ? <p className="text-sm text-muted-foreground">The activity has changed since your last save. Review the questions before saving again.</p> : null}{artifact.content.prompts.map((p, i) => <div key={p.id} className="space-y-2"><label htmlFor={`answer-${p.id}`} className="block text-sm font-medium">{i + 1}. {p.text}</label>{p.hint ? <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Show hint</summary><p className="mt-2">{p.hint}</p></details> : null}<Textarea id={`answer-${p.id}`} rows={4} maxLength={20000} disabled={readOnly || pending} value={answers[p.id] ?? ""} onChange={(e) => { const next = { ...answers, [p.id]: e.target.value }; setAnswers(next); sessionStorage.setItem(key, JSON.stringify(next)); setNotice(undefined) }} /><AskPrivately artifact={artifact} question={p.text} /></div>)}{!readOnly ? <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={pending} onClick={() => void run(false)}>{pending ? "Saving…" : "Save privately"}</Button>{artifact.content.kind === "assignment" ? <Button size="sm" disabled={pending || !Object.values(answers).some((v) => v.trim())} onClick={() => setConfirm(true)}>Submit to teacher</Button> : null}<span className="self-center text-xs text-muted-foreground">{dirty ? "Unsaved · kept in this tab" : saved.updatedAt ? "Saved" : "Not started"}</span></div> : null}{notice ? <p role="status" className="text-sm text-primary">{notice}</p> : null}{error ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" disabled={pending} onClick={async () => { setPending(true); try { setSaved(await education.work(artifact.id)); setNotice("Latest saved answers loaded below. Your unsaved answers are still in the fields above."); setError(undefined) } catch (e) { setError(errorText(e)) } finally { setPending(false) } }}>Reload saved work</Button></div> : null}{notice && dirty ? <details className="text-sm"><summary className="cursor-pointer">Compare with saved answers</summary>{Object.values(saved.answers).map((answer, i) => <p key={i} className="mt-2 whitespace-pre-wrap">{answer}</p>)}</details> : null}<Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Submit your work?</DialogTitle><DialogDescription>Your teacher will receive a copy of these answers. Subsequent draft changes stay private until you submit again.</DialogDescription></DialogHeader><Button disabled={pending} onClick={() => void run(true)}>{pending ? "Submitting…" : "Confirm submission"}</Button>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</DialogContent></Dialog></section>
}

function Submissions({ artifact, readOnly }: { artifact: CourseArtifact; readOnly: boolean }) {
  const { education } = useHostedWorkspace()
  const { me } = useCommunity()
  const load = useCallback(async () => { const [submissions, versions] = await Promise.all([education.submissions(artifact.id), education.versions(artifact.id)]); return { submissions, versions } }, [education, artifact.id])
  const result = useEducationData(load)
  const teacher = me.kind === "person" && me.role === "teacher"
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState<string>()
  return <section className="space-y-3 border-t pt-5"><h4 className="text-sm font-semibold">{teacher ? "Submitted work" : "Your submissions & feedback"}</h4>{!result.data?.submissions.length ? <p className="text-sm text-muted-foreground">{result.loading ? "Loading submissions…" : "No submissions yet."}</p> : null}{result.data?.submissions.map((s) => <details key={s.id} className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">{teacher ? `${s.displayName} · ` : ""}{new Date(s.createdAt).toLocaleString()} · v{s.artifactVersion}{s.reviewedAt ? " · Reviewed" : " · Awaiting feedback"}</summary><div className="mt-3 space-y-3">{Object.entries(s.answers).map(([id, answer], i) => <div key={id}><p className="text-xs text-muted-foreground">{result.data?.versions.find((v) => v.version === s.artifactVersion)?.content.prompts.find((p) => p.id === id)?.text ?? `Answer ${i + 1}`}</p><p className="whitespace-pre-wrap break-words text-sm">{answer}</p></div>)}{teacher && !readOnly ? <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); const feedback = String(new FormData(e.currentTarget).get("feedback")); setPending(s.id); try { await education.review(artifact.id, s.id, feedback); await result.refresh() } catch (e) { setError(errorText(e)) } finally { setPending(undefined) } }}><Textarea aria-label={`Feedback for ${s.displayName}`} name="feedback" required maxLength={20000} defaultValue={s.feedback} /><Button type="submit" size="sm" disabled={pending === s.id}>{pending === s.id ? "Saving…" : "Save feedback"}</Button></form> : s.feedback ? <div className="rounded-md bg-muted p-3"><h5 className="text-xs font-semibold">Teacher feedback</h5><p className="mt-1 whitespace-pre-wrap text-sm">{s.feedback}</p></div> : null}</div></details>)}{error || result.error ? <p role="alert" className="text-sm text-destructive">{error ?? result.error}</p> : null}</section>
}

function AskPrivately({ artifact, question }: { artifact: CourseArtifact; question?: string }) {
  const hosted = useHostedWorkspace()
  const { community, me } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const agents = community.members.filter((m) => m.kind === "agent" && m.status !== "inactive")
  const [open, setOpen] = useState(false)
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "")
  const [text, setText] = useState(question ? `Can you help me understand this question?\n\n${question}` : "Can you help me understand this material?")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  if (community.channels.find((c) => c.id === artifact.channelId)?.kind === "dm") return null
  return <><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Ask privately</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Ask privately</DialogTitle><DialogDescription>Bring this material to a direct message. You can edit the draft before sending. Teachers can read tutor conversations.</DialogDescription></DialogHeader><label className="space-y-1 text-sm">Tutor<select className="h-9 w-full rounded-md border bg-background px-3" value={agentId} onChange={(e) => setAgentId(e.target.value)}>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{!agents.length ? <p className="text-sm text-muted-foreground">A teacher needs to create an agent first.</p> : null}<label className="space-y-1 text-sm">Your question<Textarea value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} /></label><p className="text-xs text-muted-foreground">Included: {artifact.content.title}, v{artifact.version}{question ? ", and this question" : artifact.content.body.length > 12000 ? ", and the first 12,000 characters of the material" : ", and the material text"}.</p>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button disabled={pending || !agentId || !text.trim()} onClick={async () => { setPending(true); try { const dmId = await hosted.createAgentDm(agentId); stageConsultation(me.id, community.id, dmId, { artifactId: artifact.id, channelId: artifact.channelId, title: artifact.content.title, text: `About “${artifact.content.title}” (v${artifact.version})\n\n${question ?? artifact.content.body.slice(0, 12000)}\n\n${text}` }); setOpen(false); await navigateTo({ kind: "channel", channelId: dmId, artifactId: window.matchMedia("(min-width: 1140px)").matches ? artifact.id : undefined }) } catch (e) { setError(errorText(e)) } finally { setPending(false) } }}>{pending ? "Opening…" : "Continue in private"}</Button></DialogContent></Dialog></>
}
