import { readAdaContext, saveAdaContext } from "@/lib/ada-message-context"
import { AdaMark, AdaWelcome } from "./ada-identity"
import { createContext, useContext } from "react"
import { ArtifactCard } from "./artifact-card"
import { ArtifactMarkdown } from "./artifact-markdown"
import { useEducationData } from "@/lib/use-education-data"
import { readConsultation, clearConsultation, stageConsultation } from "@/lib/private-consultation"
import { ComposerAgentActivity } from "./agent-activity"
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { resolveTextMentions } from "@ada/protocol"
import type { Editor } from "@tiptap/react"
import { MentionEditor } from "./mention-editor"
import type { ChatStatus } from "ai"
import {
  FilesIcon,
  LockIcon,
  ExpandIcon,
  ArrowDownIcon,
  ArchiveIcon,
  AtSignIcon,
  BoldIcon,
  ClipboardCopyIcon,
  CopyIcon,
  Code2Icon,
  ItalicIcon,
  LinkIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SmilePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Marker, MarkerContent } from "@/components/ui/marker"
import {
  Message as MessagePrimitive,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Separator } from "@/components/ui/separator"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Textarea } from "@/components/ui/textarea"
import { DestructiveConfirmation } from "./destructive-confirmation"
import { WorkspaceAvatar as MemberAvatar } from "./workspace-avatar"
import { cn } from "@/lib/utils"
import { dayLabel, formatTime, useCommunity } from "@/lib/community"
import { useAuxiliaryPreferences, useConversationSpacingPreferences } from "@/lib/preferences"
import type { Channel, Message, MessageBlock } from "@/lib/types"
import { ChannelDetailsPanel, type ChannelAuxiliaryKind } from "./channel-details"
import { MemberProfilePopover } from "./member-profile-popover"
import { useHostedWorkspace } from "./hosted-context"
import { useAppNavigation, useAppRoute } from "@/lib/routes"
import { toast } from "@/components/ui/toast"

const ArtifactsPanel = lazy(() => import("./artifacts").then((module) => ({ default: module.ArtifactsPanel })))

const AskAdaContext = createContext<((message: Message) => void) | undefined>(undefined)

interface ChannelWorkspaceProps {
  auxiliary?: ChannelAuxiliaryKind | null
  onAuxiliaryChange: (value: ChannelAuxiliaryKind | null) => void
  onSearchChannel: () => void
}

export function ChannelWorkspace(props: ChannelWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(true)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 840))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  return <div ref={containerRef} className="size-full min-w-0"><ChannelWorkspaceContent {...props} narrowAuxiliary={narrow} /></div>
}

function ChannelWorkspaceContent({ auxiliary: channelAuxiliary, onAuxiliaryChange, onSearchChannel, narrowAuxiliary }: ChannelWorkspaceProps & { narrowAuxiliary: boolean }) {
  const community = useCommunity()
  const channel = community.community.channels.find((item) => item.id === community.activeChannelId)
  const threadPanel = community.panels[0]?.kind === "thread" ? community.panels[0] : undefined
  const auxiliary = useAuxiliaryPreferences()
  const { comfortable } = useConversationSpacingPreferences()
  const hosted = useHostedWorkspace()
  const route = useAppRoute()
  const navigateTo = useAppNavigation(community.community.id)
  const canReadArtifacts = Boolean(channel?.memberIds.includes(community.me.id) || channel?.kind === "dm")
  const artifactChannelId = channel?.id
  const loadArtifacts = useCallback(() => canReadArtifacts && artifactChannelId ? hosted.education.list(artifactChannelId) : Promise.resolve([]), [hosted.education, artifactChannelId, canReadArtifacts])
  const artifacts = useEducationData(loadArtifacts)
  const selectedArtifact = route.kind === "channel" ? route.artifactId : undefined
  const selectArtifact = (id?: string) => { onAuxiliaryChange(null); void navigateTo({ kind: "channel", channelId: channel!.id, artifactId: id }) }
  const [adaPanel, setAdaPanel] = useState<{ channelId: string; source: Message } | null>(null)
  const [adaOpening, setAdaOpening] = useState(false)
  const primaryAda = community.community.members.find((item) => item.kind === "agent" && item.systemRole === "ada")
  const isAda = channel?.kind === "dm" && channel.agentId === primaryAda?.id
  const askAda = async (source: Message) => {
    if (!primaryAda || adaOpening) return
    setAdaOpening(true)
    try {
      const channelId = await hosted.createAgentDm(primaryAda.id)
      onAuxiliaryChange(null)
      if (route.kind === "channel" && (route.threadId || route.artifactId)) await navigateTo({ kind: "channel", channelId: route.channelId })
      community.closePanel()
      saveAdaContext(community.me.id, community.community.id, channelId, source)
      setAdaPanel({ channelId, source })
    } catch (error) { toast.add({ title: "Could not open Ada", description: error instanceof Error ? error.message : "Try again." }) }
    finally { setAdaOpening(false) }
  }
  const adaChannel = community.community.channels.find((item) => item.id === adaPanel?.channelId)
  const guide = artifacts.data?.find((a) => a.content.kind === "guide")

  if (!channel) {
    return (
      <div className="flex size-full items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">This channel is unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been archived, deleted, or removed from your course membership.
          </p>
        </div>
      </div>
    )
  }

  if (adaPanel && adaChannel?.id === channel.id) return <AdaConversationPanel key={adaChannel.id} channel={adaChannel} source={adaPanel.source} onClose={() => setAdaPanel(null)} />

  const conversation = (
      <section className={cn("flex size-full min-w-0 flex-1 flex-col", isAda && "ada-conversation")} inert={narrowAuxiliary && Boolean(adaPanel || selectedArtifact || threadPanel || channelAuxiliary)} aria-label={channel.kind === "dm" ? `${channel.name} conversation` : `${channel.name} channel`}>
        <ChannelHeader artifactCount={artifacts.data?.length ?? 0} onOpenArtifacts={() => { setAdaPanel(null); selectArtifact("list") }} channel={channel} onOpenMembers={() => { setAdaPanel(null); if (selectedArtifact) selectArtifact(); onAuxiliaryChange("members") }} onOpenSettings={() => { setAdaPanel(null); if (selectedArtifact) selectArtifact(); onAuxiliaryChange("settings") }} onSearchChannel={onSearchChannel} />
        {guide ? <div className="shrink-0 border-b px-3 py-2 sm:px-5"><ArtifactCard artifact={guide} onOpen={() => selectArtifact(guide.id)} /></div> : null}
        <AskAdaContext.Provider value={primaryAda ? (message) => { void askAda(message) } : undefined}><ChannelTimeline key={channel.id} channel={channel} comfortable={comfortable} /></AskAdaContext.Provider>
        {adaOpening ? <p role="status" className="px-5 py-1 text-xs text-muted-foreground">Opening Ada…</p> : null}
        <ConversationFooter channel={channel} />
      </section>
  )

  const contextual = adaPanel
    ? adaChannel ? <AdaConversationPanel key={adaChannel.id} channel={adaChannel} source={adaPanel.source} onClose={() => setAdaPanel(null)} /> : <div role="status" className="p-4">Opening Ada…</div>
    : selectedArtifact
    ? <Suspense fallback={<div className="p-4 text-sm" role="status">Loading artifacts…</div>}><ArtifactsPanel key={channel.id} channel={channel} selection={selectedArtifact} onSelect={selectArtifact} onClose={() => selectArtifact()} onChanged={() => { void artifacts.refresh() }} /></Suspense>
    : threadPanel
    ? <AskAdaContext.Provider value={primaryAda ? (message) => { void askAda(message) } : undefined}><ThreadPanel threadId={threadPanel.threadId} embedded /></AskAdaContext.Provider>
    : channelAuxiliary
      ? <ChannelDetailsPanel key={`${channel.id}:${channelAuxiliary}`} channel={channel} initialView={channelAuxiliary} onClose={() => onAuxiliaryChange(null)} />
      : null

  if (contextual && !narrowAuxiliary) {
    return (
      <ResizablePanelGroup orientation="horizontal" className="size-full min-h-0">
        <ResizablePanel id="channel-conversation" minSize={500} className="min-w-0">{conversation}</ResizablePanel>
        <ResizableHandle />
          <ResizablePanel id="channel-auxiliary" defaultSize={auxiliary.width} minSize={320} maxSize={720} groupResizeBehavior="preserve-pixel-size" onResize={(size) => { if (size.inPixels >= 320) auxiliary.setWidth(size.inPixels) }} className="min-w-0">
          {contextual}
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }

  return <div className="relative flex size-full min-h-0">{conversation}{contextual ? <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md border-l bg-background">{contextual}</div> : null}</div>
}

function ChannelHeader({
  artifactCount, onOpenArtifacts,
  channel,
  onOpenMembers,
  onOpenSettings,
  onSearchChannel,
}: {
  channel: Channel
  artifactCount: number
  onOpenArtifacts: () => void
  onOpenMembers: () => void
  onOpenSettings: () => void
  onSearchChannel: () => void
}) {
  const { community, member, me, workspace } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const visibleMembers = channel.memberIds.slice(0, 4)
  const joined = channel.memberIds.includes(me.id)
  const canManage = me.kind === "person" && me.role === "teacher"
  const [joining, setJoining] = useState(false)
  const [archivePending, setArchivePending] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const join = async () => {
    setJoining(true)
    setJoinError(null)
    try {
      await workspace.joinChannel(channel.id)
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "The channel could not be joined.")
    } finally {
      setJoining(false)
    }
  }

  const leave = async () => {
    try {
      await workspace.leaveChannel(channel.id)
      toast.add({ title: `Left #${channel.name}` })
      await navigateTo({ kind: "inbox" })
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "The channel could not be left.")
    }
  }

  const isAda = channel.kind === "dm" && channel.agentId && community.members.some((item) => item.id === channel.agentId && item.kind === "agent" && item.systemRole === "ada")
  const dmPrivacy = channel.kind === "dm"
    ? channel.ownerId === me.id
      ? "Teachers can read this conversation"
      : me.kind === "person" && me.role === "teacher"
        ? "Viewing a student's direct message · read-only"
        : undefined
    : undefined

  return (
    <>
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
      {isAda ? <AdaMark /> : channel.kind === "dm" && channel.agentId ? <MemberAvatar member={member(channel.agentId)} size={32} presence /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.012em]">{isAda ? "Ada" : channel.kind === "dm" ? channel.name : `# ${channel.name}`}</h1>
          {channel.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
          {channel.kind !== "dm" && (channel.visibility === "private" || channel.group === "private") ? <Badge variant="outline">Private</Badge> : null}
        </div>
        {isAda ? <p className="truncate text-xs text-muted-foreground">Your course assistant</p> : dmPrivacy ? <p className="truncate text-xs font-medium text-muted-foreground">{dmPrivacy}</p> : channel.description ? <p className="truncate text-xs text-muted-foreground">{channel.description}</p> : null}
      </div>
      {artifactCount > 0 ? <Button variant="ghost" size="sm" className="shrink-0" onClick={onOpenArtifacts} aria-label={`Artifacts, ${artifactCount}`} title="View artifacts"><FilesIcon /><span className="text-xs tabular-nums text-muted-foreground">{artifactCount}</span></Button> : null}
      <div
        className="hidden cursor-pointer items-center -space-x-1.5 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        onClick={onOpenMembers}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenMembers() } }}
        role="button"
        tabIndex={0}
        aria-label={`${channel.memberIds.length} ${channel.kind === "dm" ? "participants" : "channel members"}, open member list`}
      >
        {visibleMembers.map((id) => (
          <MemberAvatar key={id} member={member(id)} size={24} className="ring-2 ring-background" />
        ))}
        {channel.memberIds.length > visibleMembers.length ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
            +{channel.memberIds.length - visibleMembers.length}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        onClick={onOpenMembers}
        aria-label={`${channel.memberIds.length} ${channel.kind === "dm" ? "participants" : "channel members"}, open member list`}
      >
        {channel.memberIds.length} {channel.memberIds.length === 1 ? "member" : "members"}
      </button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onSearchChannel} aria-label={channel.kind === "dm" ? "Find in conversation" : "Find in channel"}>
        <SearchIcon />
      </Button>
      {!joined && channel.visibility === "open" && channel.status !== "archived" ? <Button type="button" variant="outline" size="sm" disabled={joining} onClick={() => void join()} aria-describedby={joinError ? `join-error-${channel.id}` : undefined}>{joining ? "Joining…" : "Join"}</Button> : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={channel.kind === "dm" ? "Conversation actions" : "Channel actions"} />}><MoreHorizontalIcon /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onOpenMembers}><PanelRightIcon />{channel.kind === "dm" ? "View participants" : "View members"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(channel.kind === "dm" ? channel.name : `#${channel.name}`); toast.add({ title: channel.kind === "dm" ? "Name copied" : "Channel name copied" }) }}><CopyIcon />Copy name</DropdownMenuItem>
            {canManage && channel.kind !== "dm" ? <DropdownMenuItem onClick={onOpenSettings}><PencilIcon />Channel settings</DropdownMenuItem> : null}
            {canManage && channel.kind !== "dm" && channel.status !== "archived" ? <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}><ArchiveIcon />Archive channel</DropdownMenuItem> : null}
            {joined && channel.kind !== "dm" && !canManage ? <DropdownMenuItem variant="destructive" onClick={() => setLeaveOpen(true)}><XIcon />Leave channel</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {joinError ? <p id={`join-error-${channel.id}`} className="max-w-48 text-xs text-destructive" role="alert">{joinError}</p> : null}
    </header>
    {isAda && dmPrivacy ? <p className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground"><LockIcon className="size-3 shrink-0" />{dmPrivacy}</p> : null}
    <DestructiveConfirmation open={leaveOpen} onOpenChange={setLeaveOpen} title={`Leave #${channel.name}?`} description="You can rejoin later if this channel remains public." confirmLabel="Leave channel" pending={joining} onConfirm={leave} />
    <DestructiveConfirmation open={archiveOpen} onOpenChange={setArchiveOpen} title={`Archive #${channel.name}?`} description="History will stay readable, but nobody can send new messages." confirmLabel="Archive channel" pending={archivePending} onConfirm={async () => {
      setArchivePending(true)
      try {
        await workspace.updateChannel(channel.id, { status: "archived" })
        toast.add({ title: `Archived #${channel.name}` })
        await navigateTo({ kind: "inbox" })
      } catch (cause) {
        setJoinError(cause instanceof Error ? cause.message : "The channel could not be archived.")
      } finally {
        setArchivePending(false)
      }
    }} />
    </>
  )
}

function ConversationFooter({ channel }: { channel: Channel }) {
  const { me } = useCommunity()
  if (channel.status === "archived") return <ReadOnlyNotice title="This channel is archived" detail="Its history remains available, but new messages are disabled." />
  if (channel.kind === "dm" && channel.ownerId !== me.id && me.kind === "person" && me.role === "teacher") return <ReadOnlyNotice title="Student conversation" detail="Teachers can review this conversation but cannot participate." />
  if (!channel.memberIds.includes(me.id)) return <ReadOnlyNotice title="Join to participate" detail="Join this public channel before sending a message." />
  return <ChannelComposer key={`channel:${channel.id}`} channel={channel} />
}

function ReadOnlyNotice({ title, detail }: { title: string; detail: string }) {
  return <div className="shrink-0 border-t bg-muted/35 px-4 py-3 text-center"><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
}

function ChannelTimeline({ channel, comfortable }: { channel: Channel; comfortable: boolean }) {
  const { community, me, now } = useCommunity()
  const [visibleCount, setVisibleCount] = useState(80)
  const [hadUnreadOnOpen] = useState(() => Boolean(channel.unread))
  const messages = useMemo(
    () => community.messages.filter((message) => message.channelId === channel.id && !message.threadId),
    [channel.id, community.messages],
  )
  const visibleMessages = messages.slice(-visibleCount)

  if (messages.length === 0) {
    if (channel.kind === "dm" && community.members.some((item) => item.id === channel.agentId && item.kind === "agent" && item.systemRole === "ada")) return <AdaWelcome />
    const assignedAgent = channel.memberIds.map((id) => community.members.find((member) => member.id === id)).find((member) => member?.kind === "agent")
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <MessageSquareTextIcon aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold">{channel.kind === "dm" ? `Start a conversation with ${channel.name}` : `Start #${channel.name}`}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{channel.kind === "dm" ? "Send a direct message to begin. You do not need to mention the agent." : assignedAgent && me.kind === "person" && me.role === "teacher" ? `Mention @${assignedAgent.name} to ask it to work in this channel.` : "Ask a course question or share an example to begin the conversation."}</p>
        </div>
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-0 px-3 py-4 sm:px-5">
            <ChannelIntro channel={channel} />
            {hadUnreadOnOpen ? <Marker variant="separator" className="mb-3"><MarkerContent>New messages</MarkerContent></Marker> : null}
            {visibleMessages.length < messages.length ? (
              <div className="flex justify-center pb-3"><Button type="button" variant="ghost" size="sm" onClick={() => setVisibleCount((count) => count + 80)}>Load earlier messages</Button></div>
            ) : null}
            {visibleMessages.map((message, index) => {
              const day = dayLabel(message.at, now)
              const previous = visibleMessages[index - 1]
              const marker = !previous || day !== dayLabel(previous.at, now)
              return (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  {marker ? (
                    <Marker variant="separator" className="my-4">
                      <MarkerContent>{day}</MarkerContent>
                    </Marker>
                  ) : null}
                  <WorkspaceMessage message={message} compact={!comfortable} />
                </MessageScrollerItem>
              )
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function ChannelIntro({ channel }: { channel: Channel }) {
  return (
    <div className="mx-auto mb-3 w-full max-w-4xl px-2 pb-4 pt-7">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-xl font-semibold text-muted-foreground">
        {channel.kind === "dm" ? <MessageSquareTextIcon /> : "#"}
      </span>
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">{channel.kind === "dm" ? `Conversation with ${channel.name}` : `Welcome to #${channel.name}`}</h2>
      <p className="mt-1 max-w-[68ch] text-sm leading-5 text-muted-foreground">
        {channel.description || (channel.kind === "dm" ? "This is the beginning of your direct messages." : "This is the beginning of this course conversation.")}
      </p>
    </div>
  )
}

function WorkspaceMessage({ message, compact = false }: { message: Message; compact?: boolean }) {
  const { community, member, me, openThread, replyInThread, retryMessage, thread, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
  const askAda = useContext(AskAdaContext)
  const author = member(message.authorId)
  const linkedThread = message.threadId ? thread(message.threadId) : undefined
  const isRoot = linkedThread?.rootMessageId === message.id
  const [threadPending, setThreadPending] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(() => message.paragraphs.map((paragraph) => paragraph.map((block) => block.text).join("")).join("\n\n"))
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const canEdit = author.id === me.id
  const canDelete = canEdit || (me.kind === "person" && me.role === "teacher")
  const pendingState = "pendingState" in message && (message as Message & { pendingState?: "sending" | "failed" }).pendingState
  const clientId = message.clientId

  const mutate = async (action: () => Promise<unknown>) => {
    setMutationPending(true)
    setMutationError(null)
    try {
      await action()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "The message could not be changed.")
      throw error
    } finally {
      setMutationPending(false)
    }
  }

  const saveEdit = async () => {
    if (!editText.trim()) return
    await mutate(() => workspace.editMessage(message.id, { paragraphs: textToParagraphs(editText.trim(), [...message.paragraphs.flat().filter((block) => block.kind === "mention").map((block) => ({ id: block.memberId, name: block.text.replace(/^@/, "") }))]) }))
    setEditing(false)
  }

  const openReply = async () => {
    if (linkedThread) {
      openThread(linkedThread.id)
      return
    }
    setThreadPending(true)
    setThreadError(null)
    try {
      await replyInThread(message.id)
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "The thread could not be opened.")
    } finally {
      setThreadPending(false)
    }
  }

  const retry = async () => {
    if (!clientId || retrying) return
    setRetrying(true)
    try {
      await retryMessage(clientId)
    } catch {
      // The provider keeps the row failed and retryable; the visible state is enough feedback.
    } finally {
      setRetrying(false)
    }
  }

  const plainText = message.paragraphs.map((paragraph) => paragraph.map((block) => block.text).join("")).join("\n\n")
  const copyLink = async () => {
    const url = new URL(location.href)
    url.hash = `msg-${message.id}`
    await navigator.clipboard.writeText(url.toString())
    toast.add({ title: "Message link copied" })
  }

  return (
    <MessagePrimitive
      align="start"
      className={cn(
        "group/row mx-auto max-w-4xl rounded-lg px-2 py-1.5 hover:bg-muted/60",
        compact && "px-1.5 py-1",
      )}
      id={`msg-${message.id}`}
    >
      <MessageAvatar className="mt-0.5 self-start overflow-visible bg-transparent">
        <MemberProfilePopover
          member={author}
          className="rounded-full"
          onMessage={author.kind === "agent" && author.status !== "inactive" ? () => { void hosted.createAgentDm(author.id).then((channelId) => navigateTo({ kind: "channel", channelId })) } : undefined}
          onManage={author.kind === "agent" && me.kind === "person" && me.role === "teacher" ? () => navigateTo({ kind: "agents", agentId: author.id }) : undefined}
        >
          <MemberAvatar member={author} size={compact ? 28 : 34} presence />
        </MemberProfilePopover>
      </MessageAvatar>
      <MessageContent className="gap-0.5">
        <MessageHeader className="gap-2 px-0 text-foreground">
          <MemberProfilePopover
            member={author}
            className="truncate font-semibold hover:underline"
            onMessage={author.kind === "agent" && author.status !== "inactive" ? () => { void hosted.createAgentDm(author.id).then((channelId) => navigateTo({ kind: "channel", channelId })) } : undefined}
            onManage={author.kind === "agent" && me.kind === "person" && me.role === "teacher" ? () => navigateTo({ kind: "agents", agentId: author.id }) : undefined}
          >{author.name}</MemberProfilePopover>
          {author.kind === "agent" ? <span className="font-normal text-muted-foreground">agent</span> : null}
          {author.id === me.id ? <span className="font-normal text-muted-foreground">you</span> : null}
          <time className="font-normal tabular-nums text-muted-foreground">{formatTime(message.at)}</time>
          {message.editedAt ? <span className="font-normal text-muted-foreground">edited</span> : null}
          {pendingState === "sending" ? <span className="font-normal text-muted-foreground" role="status">sending…</span> : null}
          {pendingState === "failed" ? <span className="font-normal text-destructive" role="alert">not sent</span> : null}
          <MessageActions onAskAda={!message.deletedAt && !pendingState && askAda ? () => askAda(message) : undefined} onReply={openReply} onCopyText={() => { void navigator.clipboard.writeText(plainText); toast.add({ title: "Message copied" }) }} onCopyLink={() => void copyLink()} onEdit={canEdit && !message.deletedAt ? () => setEditing(true) : undefined} onDelete={canDelete && !message.deletedAt ? () => setDeleteOpen(true) : undefined} disabled={mutationPending} />
        </MessageHeader>
        <Bubble variant="ghost" align="start" className="overflow-visible">
          <BubbleContent className="conversation-copy max-w-[72ch] text-foreground">
            {message.deletedAt ? (
              <p className="italic text-muted-foreground">Message deleted</p>
            ) : editing ? (
              <div className="space-y-2">
                <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} autoFocus disabled={mutationPending} aria-label="Edit message" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditing(false) } else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveEdit() } }} />
                <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void saveEdit()} disabled={mutationPending || !editText.trim()}>Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={mutationPending}>Cancel</Button></div>
              </div>
            ) : author.kind === "agent" ? <ArtifactMarkdown body={plainText} /> : (
              <>
                {message.paragraphs.map((paragraph, index) => <MessageParagraph key={index} blocks={paragraph} spaced={index > 0} />)}
              </>
            )}
          </BubbleContent>
        </Bubble>
        {isRoot && linkedThread ? (
          <MessageFooter className="gap-2 px-0">
            <Button type="button" variant="ghost" size="xs" onClick={() => openThread(linkedThread.id)}>
              <MessageSquareTextIcon data-icon="inline-start" />
              {linkedThread.replyIds.length} {linkedThread.replyIds.length === 1 ? "reply" : "replies"}
            </Button>
          </MessageFooter>
        ) : null}
        {threadPending ? <p className="text-xs text-muted-foreground" role="status">Opening thread…</p> : null}
        {threadError ? <p className="text-xs text-destructive" role="alert">{threadError}</p> : null}
        {mutationError ? <p className="text-xs text-destructive" role="alert">{mutationError}</p> : null}
        {pendingState === "failed" && clientId ? <Button type="button" variant="outline" size="xs" onClick={() => void retry()} disabled={retrying}><RefreshCwIcon data-icon="inline-start" />{retrying ? "Retrying…" : "Retry"}</Button> : null}
      </MessageContent>
      <DestructiveConfirmation open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this message?" description="The message stays in the course history as a tombstone, but its text is removed." confirmLabel="Delete message" pending={mutationPending} onConfirm={() => mutate(() => workspace.deleteMessage(message.id))} />
    </MessagePrimitive>
  )
}

function MessageActions({ onAskAda, onReply, onCopyText, onCopyLink, onEdit, onDelete, disabled }: { onAskAda?: () => void; onReply: () => void; onCopyText: () => void; onCopyLink: () => void; onEdit?: () => void; onDelete?: () => void; disabled?: boolean }) {
  return (
    <div className="message-actions ml-auto flex opacity-100 sm:opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
      {onAskAda ? <Button type="button" variant="ghost" size="icon-xs" onClick={onAskAda} disabled={disabled} aria-label="Ask Ada" title="Ask Ada"><AdaMark className="size-5 rounded-md" /></Button> : null}
      <Button type="button" variant="ghost" size="icon-xs" onClick={onReply} aria-label="Reply in thread" disabled={disabled}>
        <MessageSquareTextIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Message actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {onAskAda ? <DropdownMenuItem onClick={onAskAda}><AdaMark className="size-5 rounded-md" />Ask Ada</DropdownMenuItem> : null}
            <DropdownMenuItem onClick={onReply}><MessageSquareTextIcon />Reply in thread</DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyText}><ClipboardCopyIcon />Copy text</DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyLink}><CopyIcon />Copy link</DropdownMenuItem>
            {onEdit ? <DropdownMenuItem onClick={onEdit}><PencilIcon />Edit message</DropdownMenuItem> : null}
            {onDelete ? <DropdownMenuItem onClick={onDelete} variant="destructive"><Trash2Icon />Delete message</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function MessageParagraph({ blocks, spaced }: { blocks: MessageBlock[]; spaced: boolean }) {
  const { community } = useCommunity()
  const resolved = blocks.flatMap((block) => block.kind === "text" ? resolveTextMentions(block.text, community.members) : [block])
  return <div className={cn("break-words", spaced && "mt-2")}>{resolved.map((block, index) => {
    if (block.kind === "code") return <pre key={index} className="my-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"><code>{block.text}</code></pre>
    if (block.kind === "mention") {
      const target = community.members.find((item) => item.id === block.memberId)
      return target ? <MemberProfilePopover key={index} member={target} className="mention-chip rounded-sm">{block.text}</MemberProfilePopover> : <span key={index} className="mention-chip rounded-sm">{block.text}</span>
    }
    return <span key={index}>{block.kind === "cite" ? block.text || block.cite.section || block.cite.cardId : block.text}</span>
  })}</div>
}

function ChannelComposer({ channel, threadId, source: suppliedSource, onClearSource }: { channel: Channel; threadId?: string; source?: Message; onClearSource?: () => void }) {
  const { connected, mode, sendMessage, workspace, typingMemberIds, member, me, community } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const [savedSource, setSavedSource] = useState(() => channel.kind === "dm" && !threadId ? readAdaContext(me.id, community.id, channel.id) : undefined)
  const source = suppliedSource ?? savedSource
  const clearSource = () => { saveAdaContext(me.id, community.id, channel.id); setSavedSource(undefined); onClearSource?.() }
  const [consultation, setConsultation] = useState(() => !threadId ? readConsultation(me.id, community.id, channel.id) : undefined)
  const draftKey = `ada:draft:v2:${me.id}:${community.id}:${channel.id}:${threadId ?? "channel"}`
  const [text, setText] = useState(() => readDraft(draftKey) || consultation?.text || "")
  useEffect(() => {
    const read = () => setConsultation(!threadId ? readConsultation(me.id, community.id, channel.id) : undefined)
    window.addEventListener("ada:consultation", read)
    return () => window.removeEventListener("ada:consultation", read)
  }, [me.id, community.id, channel.id, threadId])
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const [paragraphs, setParagraphs] = useState<MessageBlock[][]>(() => draftBlocks.get(draftKey) ?? textToParagraphs(text, community.members))
  const joined = channel.memberIds.includes(me.id)
  const readOnly = mode === "demo" || channel.status === "archived" || !joined
  const dmAgent = channel.kind === "dm" && channel.agentId ? member(channel.agentId) : undefined
  const agentUnavailable = mode === "connected" && dmAgent?.kind === "agent" && dmAgent.presence === "away"
  const conversationAgents = community.members.filter((item): item is import("@ada/protocol").Agent => item.kind === "agent" && item.status !== "inactive" && channel.memberIds.includes(item.id))
  const typing = typingMemberIds(channel.id).filter((id) => id !== me.id).map((id) => member(id).name)
  const mentionable = community.members.filter((item) => item.id !== me.id && (channel.memberIds.includes(item.id) || channel.kind !== "dm" && me.kind === "person" && me.role === "teacher" && item.kind === "agent"))
    .map((item) => ({ ...item, joinsOnSend: !channel.memberIds.includes(item.id) }))
  const addedAgents = mentionable.filter((item) => item.joinsOnSend && paragraphs.flat().flatMap((block) => block.kind === "text" ? resolveTextMentions(block.text, mentionable) : [block]).some((block) => block.kind === "mention" && block.memberId === item.id))

  useEffect(() => {
    writeDraft(draftKey, text)
    draftBlocks.set(draftKey, paragraphs)
  }, [draftKey, text, paragraphs])

  useEffect(() => {
    if (readOnly || !text.trim()) {
      workspace.setTyping(channel.id, false)
      return
    }
    workspace.setTyping(channel.id, true)
    const timer = setTimeout(() => workspace.setTyping(channel.id, false), 1_200)
    return () => clearTimeout(timer)
  }, [channel.id, readOnly, text, workspace])

  const submit = async () => {
    if (!text.trim() || readOnly || agentUnavailable || status === "submitted" || !connected) return
    setStatus("submitted")
    setError(null)
    try {
      await sendMessage({
        channelId: channel.id,
        threadId,
        paragraphs: [...(source ? [[{ kind: "text" as const, text: `About a message from ${member(source.authorId).name}:\n${source.paragraphs.map((p) => p.map((b) => b.text).join("")).join("\n\n").slice(0, 12000)}\n\nMy question:` }]] : []), ...paragraphs.filter((blocks) => blocks.length)],
        clientId: crypto.randomUUID(),
      })
      workspace.setTyping(channel.id, false)
      clearSource()
      setText("")
      setParagraphs([])
      editorRef.current?.commands.clearContent()
      draftBlocks.delete(draftKey)
      writeDraft(draftKey, "")
      if (consultation) stageConsultation(me.id, community.id, channel.id, { ...consultation, text: "" })
      setStatus("ready")
    } catch (cause) {
      setStatus("error")
      setError(cause instanceof Error ? cause.message : "The message could not be sent.")
      toast.add({ title: "Message not sent", description: cause instanceof Error ? cause.message : "Try again." })
    }
  }

  const wrapSelection = (left: string, right = left) => {
    const editor = editorRef.current
    if (!editor) return
    const { from, to } = editor.state.selection
    editor.chain().focus().insertContentAt(to, right).insertContentAt(from, left)
      .setTextSelection({ from: from + left.length, to: to + left.length }).run()
  }
  const insertText = (value: string) => editorRef.current?.chain().focus().insertContent({ type: "text", text: value }).run()

  return (
    <div className="shrink-0 px-3 pb-3 pt-1 sm:px-5 sm:pb-4">
      <AgentResponseFailures channelId={channel.id} threadId={threadId} />
      {source ? <div className="mx-auto mb-2 flex max-w-4xl items-start gap-2 rounded-lg border bg-background/80 px-3 py-2"><div className="min-w-0 flex-1 text-xs"><p className="font-medium">About {member(source.authorId).name}’s message</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground">{source.paragraphs.map((p) => p.map((b) => b.text).join("")).join("\n\n")}</p><p className="mt-1 text-muted-foreground">Included when you send your question{source.paragraphs.flat().reduce((length, block) => length + block.text.length, 0) > 12000 ? " (first 12,000 characters)" : ""}.</p></div><Button size="icon-xs" variant="ghost" aria-label="Remove message context" onClick={clearSource}><XIcon /></Button></div> : null}
      {consultation ? <div className="mx-auto mb-2 flex max-w-4xl flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate">About {consultation.title}</span>{!text.includes(consultation.text) ? <Button size="xs" variant="ghost" onClick={() => insertText(`\n\n${consultation.text}`)}>Insert context</Button> : null}<Button size="xs" variant="ghost" onClick={() => void navigateTo({ kind: "channel", channelId: channel.id, artifactId: consultation.artifactId })}>Open material</Button><Button size="xs" variant="ghost" onClick={() => void navigateTo({ kind: "channel", channelId: consultation.channelId, artifactId: consultation.artifactId })}>Return to module</Button><Button size="icon-xs" variant="ghost" aria-label="Dismiss material context" onClick={() => { clearConsultation(me.id, community.id, channel.id); setConsultation(undefined) }}><XIcon /></Button></div> : null}
      {agentUnavailable ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">Waiting for the agent to connect. Your draft is saved; sending will be available when it is online.</p> : null}
      {threadId ? <p className="mx-auto mb-1.5 max-w-4xl text-xs font-medium text-muted-foreground">Replying in thread</p> : null}
      {error ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-destructive" role="alert">{error} Try again when the connection is ready.</p> : null}
      {typing.length ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">{typing.length === 1 ? `${typing[0]} is typing…` : `${typing.slice(0, 2).join(" and ")} are typing…`}</p> : null}
      {!connected && mode === "connected" ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">Reconnecting… messages will send when the course is back online.</p> : null}
      {addedAgents.length ? <p className="mx-auto mb-2 max-w-4xl text-xs text-muted-foreground" role="status">{addedAgents.map((agent) => agent.name).join(", ")} will join this channel when you send. They can read its conversation history.</p> : null}
      <div className="relative mx-auto max-w-4xl">
        <PromptInput
          onSubmit={submit}
          onError={(issue) => setError(issue.message)}
          className="rounded-md bg-background shadow-none"
        >
          <ComposerAgentActivity agents={connected ? conversationAgents : []} />
          <PromptInputBody>
          <MentionEditor
            initialValue={paragraphs}
            candidates={mentionable}
            editorRef={editorRef}
            onChange={(value) => { setParagraphs(value); setText(value.map((blocks) => blocks.map((block) => block.text).join("")).join("\n\n")) }}
            onSubmit={() => { void submit() }}
            placeholder={readOnly ? (channel.status === "archived" ? "This channel is archived" : !joined ? "Join this channel to send messages" : "Demo mode is read-only") : threadId ? "Reply in thread" : `Message ${channel.kind === "dm" ? channel.name : `#${channel.name}`}`}
            disabled={readOnly || status === "submitted"}
            label={threadId ? "Reply in thread" : `Message ${channel.name}`}
          />
          </PromptInputBody>
          <PromptInputFooter className="composer-footer">
          <PromptInputTools className="min-w-0 flex-wrap">
            <PromptInputButton tooltip="Mention a person or agent" onClick={() => insertText("@")} disabled={readOnly || status === "submitted"}>
              <AtSignIcon />
            </PromptInputButton>
            <PromptInputButton tooltip={{ content: "Bold", shortcut: "⌘B" }} onClick={() => wrapSelection("**")} disabled={readOnly || status === "submitted"}>
              <BoldIcon />
            </PromptInputButton>
            <PromptInputButton tooltip={{ content: "Italic", shortcut: "⌘I" }} onClick={() => wrapSelection("*")} disabled={readOnly || status === "submitted"}>
              <ItalicIcon />
            </PromptInputButton>
            <PromptInputButton tooltip={{ content: "Add link", shortcut: "⌘K" }} onClick={() => wrapSelection("[", "](url)")} disabled={readOnly || status === "submitted"}>
              <LinkIcon />
            </PromptInputButton>
            <PromptInputButton tooltip="Inline code" onClick={() => wrapSelection("`")} disabled={readOnly || status === "submitted"}>
              <Code2Icon />
            </PromptInputButton>
            <PromptInputButton tooltip="Insert emoji" onClick={() => insertText("🙂")} disabled={readOnly || status === "submitted"}>
              <SmilePlusIcon />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit status={status} disabled={readOnly || !connected || agentUnavailable || !text.trim() || status === "submitted"} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function ThreadPanel({ threadId, embedded = false }: { threadId: string; embedded?: boolean }) {
  const { closePanel, community, me, message, thread } = useCommunity()
  const currentThread = thread(threadId)
  const root = message(currentThread.rootMessageId)
  const replyIds = new Set(currentThread.replyIds)
  const replies = [
    ...currentThread.replyIds.map(message),
    ...community.messages.filter((item) => item.threadId === threadId && !replyIds.has(item.id)),
  ]
  const currentChannel = community.channels.find((item) => item.id === root.channelId)
  const latestRef = useRef<HTMLDivElement>(null)
  if (!currentChannel) return null

  return (
    <aside className={cn("flex min-w-0 flex-col bg-background", embedded ? "size-full border-l" : "absolute inset-y-0 right-0 z-20 w-full shadow-pop")} aria-label="Thread">
      <header className="flex min-h-14 items-center gap-2 border-b px-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Thread</h2>
          <p className="truncate text-xs text-muted-foreground">#{currentChannel.name}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={closePanel} aria-label="Close thread">
          <XIcon />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <WorkspaceMessage message={root} compact />
        <Separator className="my-3" />
        {replies.length ? (
          <>
            <Marker variant="separator" className="mb-2"><MarkerContent>{currentChannel.unread ? "Unread replies" : "Replies"}</MarkerContent></Marker>
            <div className="flex flex-col gap-1">
            {replies.map((reply) => <WorkspaceMessage key={reply.id} message={reply} compact />)}
            </div>
            <div ref={latestRef} />
          </>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No replies yet. Continue the conversation below.</div>
        )}
        {replies.length ? <Button type="button" variant="secondary" size="sm" className="sticky bottom-2 left-1/2 mt-3 -translate-x-1/2 shadow-sm" onClick={() => latestRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}><ArrowDownIcon data-icon="inline-start" />Jump to latest</Button> : null}
      </div>
      {currentChannel.status === "archived" ? <ReadOnlyNotice title="This channel is archived" detail="Thread history remains readable, but new replies are disabled." /> : currentChannel.kind === "dm" && currentChannel.ownerId !== me.id && me.kind === "person" && me.role === "teacher" ? <ReadOnlyNotice title="Student conversation" detail="Teachers can review this thread but cannot reply." /> : <ChannelComposer key={`thread:${currentThread.id}`} channel={currentChannel} threadId={currentThread.id} />}
    </aside>
  )
}

function AgentResponseFailures({ channelId, threadId }: { channelId: string; threadId?: string }) {
  const { memory } = useHostedWorkspace()
  const load = useCallback(() => memory.jobs(), [memory])
  const jobs = useEducationData(load)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const failed = jobs.data?.filter((job) => job.purpose === "respond" && job.status === "failed" && job.channelId === channelId && job.threadId === (threadId ?? null) && job.canRetry) ?? []
  if (!failed.length) return null
  return <div className="mx-auto mb-2 max-w-4xl space-y-2">{failed.map((job) => <div key={job.id} role="status" className="flex flex-wrap items-center gap-3 rounded-md border bg-background px-3 py-2 text-xs"><p className="min-w-0 flex-1">Ada could not finish a response. Your message is saved.</p><Button size="xs" variant="outline" disabled={Boolean(pending)} onClick={() => { setPending(job.id); setError(undefined); void memory.retry(job.id).then(() => jobs.refresh()).catch(() => setError("Could not retry. Please try again.")).finally(() => setPending(undefined)) }}><RefreshCwIcon />{pending === job.id ? "Retrying…" : "Retry response"}</Button></div>)}{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}</div>
}

function textToParagraphs(text: string, members: readonly { id: string; name: string }[] = []): MessageBlock[][] {
  return text.split(/\n\s*\n/).map((paragraph) => resolveTextMentions(paragraph.trim(), members))
}

const channelDrafts = new Map<string, string>()
const draftBlocks = new Map<string, MessageBlock[][]>()

function readDraft(key: string): string {
  return channelDrafts.get(key) ?? ""
}

function writeDraft(key: string, value: string): void {
  if (value) channelDrafts.set(key, value)
  else channelDrafts.delete(key)
}

function AdaConversationPanel({ channel, source, onClose }: { channel: Channel; source: Message; onClose: () => void }) {
  const { community } = useCommunity()
  const navigateTo = useAppNavigation(community.id)
  const [dismissedSource, setDismissedSource] = useState<string | null>(null)
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose() } }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [onClose])
  return <section className="ada-conversation flex size-full min-h-0 flex-col" aria-label="Ask Ada">
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b px-4"><AdaMark /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Ada</h2><p className="flex items-center gap-1 text-xs text-muted-foreground"><LockIcon className="size-3" />Outside the channel</p></div><Button variant="ghost" size="icon-sm" aria-label="Open Ada conversation" onClick={() => void navigateTo({ kind: "channel", channelId: channel.id })}><ExpandIcon /></Button><Button variant="ghost" size="icon-sm" aria-label="Close Ada" autoFocus onClick={onClose}><XIcon /></Button></header>
    <p className="border-b px-4 py-2 text-xs text-muted-foreground">Only you and Ada participate. Teachers can read this conversation.</p>
    <ChannelTimeline channel={channel} comfortable />
    <ChannelComposer channel={channel} source={dismissedSource === source.id ? undefined : source} onClearSource={() => setDismissedSource(source.id)} />
  </section>
}
