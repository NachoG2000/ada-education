import { useCallback, useState } from "react"
import { ArrowLeftIcon, BookOpenIcon, DownloadIcon, FileTextIcon, LockKeyholeIcon, PlusIcon, RefreshCwIcon } from "lucide-react"
import type { MemoryJob, MemoryRecord, MemoryRecordView, MemoryScope, MemorySource } from "@ada/protocol"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useCommunity } from "@/lib/community"
import { useAppNavigation, type AppRoute } from "@/lib/routes"
import type { MemorySection as Section } from "@/lib/memory-route"
import { useEducationData } from "@/lib/use-education-data"
import { useHostedWorkspace } from "./hosted-context"
import { PageHeader } from "./page-layout"
import { ArtifactMarkdown } from "./artifact-markdown"

const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
const stateLabel: Record<MemoryRecordView["state"], string> = { current: "Current", scheduled: "Upcoming", expired: "Past", resolved: "Resolved", superseded: "Replaced", corrected: "Corrected", needs_review: "Needs review", rejected: "Rejected" }

export function MemoryPage({ route }: { route: Extract<AppRoute, { kind: "memory" }> }) {
  const { memory } = useHostedWorkspace()
  const { community, me, member } = useCommunity()
  const teacher = me.kind === "person" && me.role === "teacher"
  const navigateTo = useAppNavigation(community.id)
  const load = useCallback(() => memory.snapshot(), [memory])
  const data = useEducationData(load)
  const loadJobs = useCallback(() => memory.jobs(), [memory])
  const jobs = useEducationData(loadJobs)
  const [query, setQuery] = useState("")
  const [learner, setLearner] = useState(teacher ? "all" : me.id)
  const [history, setHistory] = useState(false)
  const { sourceId, sourceVersion } = route
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const selected = data.data?.records.find((record) => record.id === route.recordId)
  const section: Section = route.section ?? (sourceId ? "sources" : selected?.scope.kind === "learner" ? "learners" : selected && ["event", "decision", "commitment"].includes(selected.kind) ? "operations" : "knowledge")
  const source = data.data?.sources.find((item) => item.id === sourceId)
  const detail = Boolean(route.recordId || sourceId || uploading)
  const students = community.members.filter((person) => person.kind === "person" && person.role === "student")
  const run = async (action: () => Promise<unknown>) => {
    setPending(true); setError(undefined)
    try { await action(); await Promise.all([data.refresh(), jobs.refresh()]) }
    catch (e) { setError(e instanceof Error ? e.message : "This change could not be saved. Try again.") }
    finally { setPending(false) }
  }
  const clearDetail = () => { setUploading(false); void navigateTo({ kind: "memory", section }) }
  const chooseSection = (next: Section) => { setQuery(""); setUploading(false); void navigateTo({ kind: "memory", section: next }) }
  const selectRecord = (record: MemoryRecordView) => { setUploading(false); void navigateTo({ kind: "memory", recordId: record.id, section }) }
  const selectSource = (id: string, version?: number) => { setUploading(false); void navigateTo({ kind: "memory", sourceId: id, sourceVersion: version, section: "sources" }) }
  const scopeName = (scope: MemoryScope) => scope.kind === "course" ? "Whole course" : scope.kind === "channel" ? `#${community.channels.find((channel) => channel.id === scope.channelId)?.name ?? "Channel"}` : `${member(scope.learnerId).name} and course teachers`
  const records = (data.data?.records ?? []).filter((record) => {
    if (section === "sources") return false
    if (section === "review") return record.state === "needs_review" || record.state === "rejected"
    if (section === "knowledge" && !["concept", "example"].includes(record.kind)) return false
    if (section === "operations" && !["event", "decision", "commitment"].includes(record.kind)) return false
    if (section === "learners" && (record.scope.kind !== "learner" || learner !== "all" && record.scope.learnerId !== learner)) return false
    return record.admission === "accepted" && (history || ["current", "scheduled"].includes(record.state))
  }).filter((record) => `${record.title} ${record.body} ${record.concept ?? ""} ${record.module ?? ""}`.toLowerCase().includes(query.toLowerCase()))
  const sources = (data.data?.sources ?? []).filter((item) => item.origin !== "message" && item.title.toLowerCase().includes(query.toLowerCase()))
  const reviews = data.data?.records.filter((record) => record.state === "needs_review").length ?? 0
  const sections: Array<{ id: Section; label: string }> = [{ id: "knowledge", label: "Knowledge" }, { id: "operations", label: "Course activity" }, { id: "learners", label: teacher ? "Learners" : "My learning" }, { id: "sources", label: "Sources" }, ...(teacher ? [{ id: "review" as const, label: `Review${reviews ? ` (${reviews})` : ""}` }] : [])]
  return <div className="flex size-full min-w-0 flex-col">
    <div className="shrink-0 border-b px-4 py-5 sm:px-6"><PageHeader title="Course memory" description="What the course knows, where it comes from, and how understanding evolves." action={teacher ? <Button onClick={() => { clearDetail(); setUploading(true) }}><PlusIcon />Add source</Button> : undefined} />
      <nav aria-label="Memory sections" className="mt-5 flex flex-wrap gap-1">{sections.map((item) => <Button key={item.id} size="sm" variant={section === item.id ? "secondary" : "ghost"} aria-pressed={section === item.id} onClick={() => chooseSection(item.id)}>{item.label}</Button>)}</nav>
    </div>
    {error || data.error ? <div role="alert" className="flex flex-wrap items-center gap-3 border-b px-5 py-3 text-sm text-destructive"><span>{error ?? data.error}</span><Button variant="outline" size="sm" onClick={() => void data.refresh()}>Retry</Button></div> : null}
    <div className="flex min-h-0 flex-1">
      <section aria-label="Memory list" className={`${detail ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-80 md:shrink-0 md:border-r`}>
        <div className="space-y-3 border-b p-4"><Input aria-label="Filter memory" placeholder={section === "sources" ? "Find a source…" : "Find a concept or question…"} value={query} onChange={(event) => setQuery(event.target.value)} />
          {section === "learners" && teacher ? <label className="block text-sm">Learner<select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={learner} onChange={(event) => setLearner(event.target.value)}><option value="all">All learners</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label> : null}
          {section !== "sources" && section !== "review" ? <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="accent-primary" checked={history} onChange={(event) => setHistory(event.target.checked)} />Include earlier history</label> : null}
          {section === "learners" ? <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" />{teacher ? "Private trajectories. Students see only their own." : "Visible to you and your course teachers."}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {data.loading ? <p role="status" className="p-4 text-sm text-muted-foreground">Loading memory…</p> : null}
          {section === "sources" ? sources.map((item) => <button key={item.id} className={`mb-1 flex w-full items-start gap-3 rounded-md p-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${sourceId === item.id ? "bg-muted" : ""}`} onClick={() => selectSource(item.id)}><FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block break-words text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">Version {item.version} · {date(item.createdAt)}</span></span></button>) : records.map((record) => <button key={record.id} onClick={() => selectRecord(record)} className={`mb-1 w-full rounded-md p-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${route.recordId === record.id ? "bg-muted" : ""}`}><span className="block break-words text-sm font-medium">{record.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{record.kind === "inference" ? "Ada inference" : record.kind.charAt(0).toUpperCase() + record.kind.slice(1)} · {stateLabel[record.state]}{record.module ? ` · ${record.module}` : ""}</span>{record.scope.kind === "learner" && teacher ? <span className="mt-1 block text-xs text-muted-foreground">{member(record.scope.learnerId).name}</span> : null}</button>)}
          {!data.loading && !(section === "sources" ? sources.length : records.length) ? <div className="px-4 py-8 text-sm"><h2 className="font-medium">{query ? "No matches" : section === "sources" ? "Start with the course material" : section === "review" ? "Nothing waiting for review" : "This part of memory is still empty"}</h2><p className="mt-2 leading-6 text-muted-foreground">{query ? "Try another concept, question or title." : section === "sources" ? "Add a PDF, Markdown or text file. Ada will retain the original and derive connected knowledge." : section === "learners" ? "Questions and evidence of progress will appear as learners participate. Earlier observations stay in the history." : "Ada builds this from course sources and conversations in its assigned channels."}</p></div> : null}
        </div>
      </section>
      <section aria-label="Memory detail" className={`${detail ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6`}>
        {detail ? <Button variant="ghost" size="sm" className="mb-4 self-start md:hidden" onClick={clearDetail}><ArrowLeftIcon />Back to memory</Button> : null}
        {uploading ? <SourceForm key={source?.id ?? "new"} source={source} pending={pending} onCancel={clearDetail} onSubmit={(file, title, scope, legacy) => void run(async () => { const added = await memory.upload(file, { title, scope, origin: legacy ? "legacy" : "material", ...(source ? { sourceId: source.id, expectedVersion: source.version } : {}) }); selectSource(added.source.id, added.source.version) })} />
          : source ? <SourceDetail key={`${source.id}:${sourceVersion ?? source.version}`} source={source} version={sourceVersion} teacher={teacher && (sourceVersion === undefined || sourceVersion === source.version)} scopeName={scopeName(source.scope)} pending={pending} jobs={jobs.data?.filter((job) => job.sourceId === source.id && job.sourceVersion === (sourceVersion ?? source.version)) ?? []} onVersion={(version) => selectSource(source.id, version)} onRetry={(id) => void run(() => memory.retry(id))} onRevision={() => setUploading(true)} onRevoke={() => void run(async () => { await memory.revoke(source.id, source.version); clearDetail() })} onDownload={() => void run(() => memory.downloadSource(source.id, source.filename, sourceVersion))} />
          : selected ? <RecordDetail key={`${selected.id}:${selected.revision}`} record={selected} teacher={teacher} pending={pending} scopeName={scopeName(selected.scope)} records={data.data?.records ?? []} onRelated={selectRecord} onSource={selectSource} onReview={(decision, note, body) => void run(() => memory.review(selected.id, selected.revision, decision, note, body))} onDownload={() => void run(() => memory.downloadRecord(selected.id))} />
          : (route.recordId || sourceId) && !data.loading ? <p className="text-sm text-muted-foreground">This item is unavailable or outside your access.</p>
          : <div className="m-auto max-w-sm text-center"><BookOpenIcon className="mx-auto mb-3 size-6 text-muted-foreground" /><h2 className="text-sm font-semibold">Knowledge with a history</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Select a record to follow its evidence, related ideas and changes over time.</p></div>}
        {section === "review" && teacher && jobs.data?.some((job) => job.status === "failed") ? <div className="mt-8 border-t pt-5"><h2 className="text-sm font-semibold">Processing needs attention</h2>{jobs.data.filter((job) => job.status === "failed").map((job) => <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" key={job.id}><p className="min-w-0 flex-1 text-muted-foreground">{job.error ?? "Ada could not process this source."}</p><Button size="sm" variant="outline" disabled={pending} onClick={() => void run(() => memory.retry(job.id))}><RefreshCwIcon />Retry</Button></div>)}</div> : null}
      </section>
    </div>
  </div>
}

function SourceForm({ source, pending, onCancel, onSubmit }: { source?: MemorySource; pending: boolean; onCancel: () => void; onSubmit: (file: File, title: string, scope: MemoryScope, legacy: boolean) => void }) {
  const { community } = useCommunity()
  const [file, setFile] = useState<File>()
  const [title, setTitle] = useState(source?.title ?? "")
  const [audience, setAudience] = useState("course")
  const [legacy, setLegacy] = useState(source?.origin === "legacy")
  return <form className="w-full max-w-xl space-y-5" onSubmit={(event) => { event.preventDefault(); if (file && title.trim()) onSubmit(file, title.trim(), source?.scope ?? (audience === "course" ? { kind: "course" } : { kind: "channel", channelId: audience }), legacy) }}><h2 className="text-page font-semibold">{source ? "Add a source revision" : "Add course material"}</h2><p className="text-sm leading-6 text-muted-foreground">Ada keeps the original file and derives connected concepts and examples. Updating a source preserves earlier versions and flags affected knowledge for review.</p><div className="space-y-2"><Label htmlFor="memory-file">Source file</Label><Input id="memory-file" type="file" accept=".pdf,.md,.markdown,.txt" required disabled={pending} onChange={(event) => { const next = event.target.files?.[0]; setFile(next); if (!title && next) setTitle(next.name.replace(/\.[^.]+$/, "")) }} /><p className="text-xs text-muted-foreground">PDF with selectable text, Markdown or UTF-8 text. Up to 10 MB.</p></div><div className="space-y-2"><Label htmlFor="memory-title">Title</Label><Input id="memory-title" value={title} maxLength={180} required disabled={pending} onChange={(event) => setTitle(event.target.value)} /></div>{!source ? <div className="space-y-2"><Label htmlFor="memory-audience">Who can use this source?</Label><select id="memory-audience" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={audience} disabled={pending} onChange={(event) => setAudience(event.target.value)}><option value="course">Everyone in this course</option>{community.channels.filter((channel) => channel.kind !== "dm").map((channel) => <option key={channel.id} value={channel.id}>Members of #{channel.name}</option>)}</select></div> : null}<label className="flex items-start gap-2 text-sm leading-5"><input type="checkbox" className="mt-1 accent-primary" checked={legacy} disabled={pending} onChange={(event) => setLegacy(event.target.checked)} />This is an existing agent wiki. Require review before using its knowledge.</label><div className="flex gap-2"><Button type="submit" disabled={pending || !file || !title.trim()}>{pending ? "Adding source…" : "Add source"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>Cancel</Button></div></form>
}

function SourceDetail({ source, version, teacher, scopeName, pending, jobs, onVersion, onRetry, onRevision, onRevoke, onDownload }: { source: MemorySource; version?: number; teacher: boolean; scopeName: string; pending: boolean; jobs: MemoryJob[]; onVersion: (version: number) => void; onRetry: (id: string) => void; onRevision: () => void; onRevoke: () => void; onDownload: () => void }) {
  const { memory } = useHostedWorkspace()
  const load = useCallback(() => memory.source(source.id, version ?? source.version), [memory, source.id, source.version, version])
  const data = useEducationData(load)
  const [confirm, setConfirm] = useState(false)
  return <article className="w-full max-w-3xl"><h2 className="break-words text-page font-semibold">{data.data?.source.title ?? source.title}</h2><p className="mt-2 text-sm text-muted-foreground">Version {version ?? source.version} · {date(data.data?.source.createdAt ?? source.createdAt)} · {scopeName}</p><div className="mt-4"><Label htmlFor="source-version">Source version</Label><select id="source-version" className="mt-1 block h-9 rounded-md border bg-background px-3 text-sm" value={version ?? source.version} onChange={(event) => onVersion(Number(event.target.value))}>{Array.from({ length: source.version }, (_, index) => source.version - index).map((number) => <option key={number} value={number}>Version {number}{number === source.version ? " · latest" : ""}</option>)}</select></div>{jobs.filter((job) => job.status !== "done").map((job) => <div key={job.id} role="status" className="mt-4 rounded-md border p-3 text-sm"><p>{job.status === "pending" ? "Waiting for Ada to process this source…" : job.status === "running" ? "Ada is deriving knowledge from this source…" : "Ada could not process this source."}</p>{job.status === "failed" && job.canRetry ? <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => onRetry(job.id)}><RefreshCwIcon />Retry processing</Button> : null}</div>)}<div className="my-5 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={onDownload}><DownloadIcon />Original file</Button>{teacher && source.origin !== "message" ? <><Button size="sm" variant="outline" disabled={pending} onClick={onRevision}>Add revision</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(true)}>Revoke source</Button></> : null}</div>{confirm ? <div className="mb-5 rounded-lg border border-destructive/40 p-4"><p className="text-sm leading-6">Revoke this source? Ada will stop using it and all dependent knowledge. Historical files stay preserved.</p><div className="mt-3 flex gap-2"><Button size="sm" variant="destructive" disabled={pending} onClick={onRevoke}>Revoke source</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Cancel</Button></div></div> : null}{data.loading ? <p role="status" className="text-sm">Loading source…</p> : data.error ? <p role="alert" className="text-sm text-destructive">{data.error}</p> : <div className="whitespace-pre-wrap break-words text-sm leading-7">{data.data?.text}</div>}</article>
}

function RecordDetail({ record, teacher, pending, scopeName, records, onRelated, onSource, onReview, onDownload }: { record: MemoryRecordView; teacher: boolean; pending: boolean; scopeName: string; records: MemoryRecordView[]; onRelated: (record: MemoryRecordView) => void; onSource: (id: string, version: number) => void; onReview: (decision: "accept" | "reject", note: string, body: string) => void; onDownload: () => void }) {
  const { memory } = useHostedWorkspace()
  const [note, setNote] = useState("")
  const [body, setBody] = useState(record.body)
  const [editing, setEditing] = useState(false)
  const [versions, setVersions] = useState<MemoryRecord[]>()
  const [versionError, setVersionError] = useState<string>()
  return <article className="w-full max-w-3xl"><h2 className="break-words text-page font-semibold">{record.title}</h2><p className="mt-2 text-sm text-muted-foreground">{stateLabel[record.state]} · {date(record.occurredAt ?? record.createdAt)}{record.module ? ` · ${record.module}` : ""}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{record.scope.kind === "learner" ? <LockKeyholeIcon className="size-3.5" /> : null}{scopeName}</p><div className="my-6"><ArtifactMarkdown body={record.body} /></div>
    <div className="space-y-2 border-y py-4 text-sm leading-6"><p className="font-medium">{record.kind === "inference" ? "Ada’s interpretation" : record.verified.length ? "Reviewed by a teacher" : record.generatedBy.startsWith("human:") ? "Human contribution" : "Derived by Ada"}</p><p className="text-muted-foreground">{record.admissionReason}</p>{record.reviewNote ? <p>Review note: {record.reviewNote}</p> : null}{record.staleAfter ? <p className="text-muted-foreground">Relevant until {new Date(record.staleAfter).toLocaleString()}</p> : null}</div>
    <section className="mt-6"><h3 className="text-sm font-semibold">Evidence</h3>{record.evidence.map((item, index) => <div key={`${item.sourceId}:${index}`} className="mt-3"><blockquote className="border-l pl-4 text-sm leading-6 text-muted-foreground">{item.quote}</blockquote><Button size="sm" variant="link" className="mt-1 px-0" onClick={() => onSource(item.sourceId, item.version)}>Open source · version {item.version}</Button></div>)}</section>
    {record.relations.length ? <section className="mt-6"><h3 className="text-sm font-semibold">Connected knowledge</h3>{record.relations.map((edge) => { const related = records.find((item) => item.id === edge.recordId); return related ? <Button key={`${edge.kind}:${edge.recordId}`} variant="link" className="h-auto max-w-full justify-start whitespace-normal px-0 text-left" onClick={() => onRelated(related)}>{edge.kind}: {related.title}</Button> : null })}</section> : null}
    <div className="mt-6 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={pending} onClick={onDownload}><DownloadIcon />Knowledge file</Button><Button size="sm" variant="ghost" onClick={() => { void memory.history(record.id).then((value) => setVersions(value.records)).catch((error: unknown) => setVersionError(error instanceof Error ? error.message : "Could not load history")) }}>Revision history ({record.revision})</Button>{teacher ? <Button size="sm" variant={record.state === "needs_review" ? "default" : "outline"} onClick={() => setEditing(!editing)}>Review interpretation</Button> : null}</div>
    {versionError ? <p role="alert" className="mt-3 text-sm text-destructive">{versionError}</p> : null}{versions ? <section className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">Revisions of this interpretation</h3>{versions.map((version) => <details key={version.revision} className="mt-3 text-sm"><summary className="cursor-pointer rounded py-2 focus-visible:outline-2">Version {version.revision} · {date(version.updatedAt)} · {version.admission}</summary><div className="py-3"><ArtifactMarkdown body={version.body} /></div></details>)}</section> : null}
    {editing ? <form className="mt-6 space-y-4 border-t pt-5" onSubmit={(event) => { event.preventDefault(); onReview("accept", note, body) }}><h3 className="text-sm font-semibold">Teacher review</h3><p className="text-sm leading-6 text-muted-foreground">Correct an interpretation here. New evidence of progress belongs in a new observation, so the learner’s earlier experience remains visible.</p><div className="space-y-2"><Label htmlFor="memory-review-body">Interpretation</Label><Textarea id="memory-review-body" rows={5} value={body} onChange={(event) => setBody(event.target.value)} disabled={pending} /></div><div className="space-y-2"><Label htmlFor="memory-review-note">Reason for this decision</Label><Textarea id="memory-review-note" required value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} /></div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending || !note.trim() || !record.evidenceValid}>{pending ? "Saving…" : "Confirm interpretation"}</Button><Button type="button" variant="outline" disabled={pending || !note.trim()} onClick={() => onReview("reject", note, body)}>Reject interpretation</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button></div>{!record.evidenceValid ? <p className="text-sm text-muted-foreground">The source changed. Ask Ada to derive a new proposal from the current version before confirming.</p> : null}</form> : null}
  </article>
}
