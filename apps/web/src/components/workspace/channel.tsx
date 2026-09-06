import { useEffect, useMemo, useRef, useState } from "react"
import type { ChatStatus } from "ai"
import {
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
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
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
import type { Channel, Member, Message, MessageBlock } from "@/lib/types"
import { ChannelDetailsPanel, type ChannelAuxiliaryKind } from "./channel-details"
import { MemberProfilePopover } from "./member-profile-popover"
import { useHostedWorkspace } from "./hosted-context"
import { useAppNavigation } from "@/lib/routes"
import { toast } from "@/components/ui/toast"

interface ChannelWorkspaceProps {
  auxiliary?: ChannelAuxiliaryKind | null
  onAuxiliaryChange: (value: ChannelAuxiliaryKind | null) => void
  onSearchChannel: () => void
}

export function ChannelWorkspace({ auxiliary: channelAuxiliary, onAuxiliaryChange, onSearchChannel }: ChannelWorkspaceProps) {
  const community = useCommunity()
  const channel = community.community.channels.find((item) => item.id === community.activeChannelId)
  const threadPanel = community.panels[0]?.kind === "thread" ? community.panels[0] : undefined
  const narrowAuxiliary = useNarrowAuxiliary()
  const auxiliary = useAuxiliaryPreferences()
  const { comfortable } = useConversationSpacingPreferences()

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

  const conversation = (
      <section className="flex size-full min-w-0 flex-1 flex-col" aria-label={channel.kind === "dm" ? `${channel.name} conversation` : `${channel.name} channel`}>
        <ChannelHeader channel={channel} onOpenMembers={() => onAuxiliaryChange("members")} onOpenSettings={() => onAuxiliaryChange("settings")} onSearchChannel={onSearchChannel} />
        <ChannelTimeline key={channel.id} channel={channel} comfortable={comfortable} />
        <ConversationFooter channel={channel} />
      </section>
  )

  const contextual = threadPanel
    ? <ThreadPanel threadId={threadPanel.threadId} embedded />
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

function useNarrowAuxiliary(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1023px)").matches)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const update = () => setNarrow(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return narrow
}

function ChannelHeader({
  channel,
  onOpenMembers,
  onOpenSettings,
  onSearchChannel,
}: {
  channel: Channel
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

  const dmPrivacy = channel.kind === "dm"
    ? channel.ownerId === me.id
      ? "Teachers can read this conversation"
      : me.kind === "person" && me.role === "teacher"
        ? "Viewing a student's private conversation · read-only"
        : undefined
    : undefined

  return (
    <>
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.012em]">{channel.kind === "dm" ? channel.name : `# ${channel.name}`}</h1>
          {channel.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
          {channel.visibility === "private" || channel.group === "private" ? <Badge variant="outline">Private</Badge> : null}
        </div>
        {dmPrivacy ? <p className="truncate text-xs font-medium text-muted-foreground">{dmPrivacy}</p> : channel.description ? <p className="truncate text-xs text-muted-foreground">{channel.description}</p> : null}
      </div>
      <div
        className="hidden cursor-pointer items-center -space-x-1.5 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        onClick={onOpenMembers}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenMembers() } }}
        role="button"
        tabIndex={0}
        aria-label={`${channel.memberIds.length} channel members, open member list`}
      >
        {visibleMembers.map((id) => (
          <MemberAvatar key={id} member={member(id)} size={24} className="ring-2 ring-background" />
        ))}
        {channel.memberIds.length > visibleMembers.length ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
            +{channel.memberIds.length - visibleMembers.length}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        onClick={onOpenMembers}
        aria-label={`${channel.memberIds.length} channel members, open member list`}
      >
        {channel.memberIds.length} {channel.memberIds.length === 1 ? "member" : "members"}
      </button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onSearchChannel} aria-label="Find in channel">
        <SearchIcon />
      </Button>
      {!joined && channel.visibility === "open" && channel.status !== "archived" ? <Button type="button" variant="outline" size="sm" disabled={joining} onClick={() => void join()} aria-describedby={joinError ? `join-error-${channel.id}` : undefined}>{joining ? "Joining…" : "Join"}</Button> : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Channel actions" />}><MoreHorizontalIcon /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onOpenMembers}><PanelRightIcon />View members</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(`#${channel.name}`); toast.add({ title: "Channel name copied" }) }}><CopyIcon />Copy name</DropdownMenuItem>
            {canManage && channel.kind !== "dm" ? <DropdownMenuItem onClick={onOpenSettings}><PencilIcon />Channel settings</DropdownMenuItem> : null}
            {canManage && channel.kind !== "dm" && channel.status !== "archived" ? <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}><ArchiveIcon />Archive channel</DropdownMenuItem> : null}
            {joined && channel.kind !== "dm" && !canManage ? <DropdownMenuItem variant="destructive" onClick={() => setLeaveOpen(true)}><XIcon />Leave channel</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {joinError ? <p id={`join-error-${channel.id}`} className="max-w-48 text-xs text-destructive" role="alert">{joinError}</p> : null}
    </header>
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
    const assignedAgent = channel.memberIds.map((id) => community.members.find((member) => member.id === id)).find((member) => member?.kind === "agent")
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <MessageSquareTextIcon aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold">{channel.kind === "dm" ? `Start a conversation with ${channel.name}` : `Start #${channel.name}`}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{channel.kind === "dm" ? "Send a message to begin this private conversation." : assignedAgent && me.kind === "person" && me.role === "teacher" ? `Mention @${assignedAgent.name} to ask it to work in this channel.` : "Ask a course question or share an example to begin the conversation."}</p>
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
        {channel.description || (channel.kind === "dm" ? "This is the beginning of this private conversation." : "This is the beginning of this course conversation.")}
      </p>
    </div>
  )
}

function WorkspaceMessage({ message, compact = false }: { message: Message; compact?: boolean }) {
  const { community, member, me, openThread, replyInThread, retryMessage, thread, workspace } = useCommunity()
  const hosted = useHostedWorkspace()
  const navigateTo = useAppNavigation(community.id)
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
    await mutate(() => workspace.editMessage(message.id, { paragraphs: textToParagraphs(editText.trim()) }))
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
          <MessageActions onReply={openReply} onCopyText={() => { void navigator.clipboard.writeText(plainText); toast.add({ title: "Message copied" }) }} onCopyLink={() => void copyLink()} onEdit={canEdit && !message.deletedAt ? () => setEditing(true) : undefined} onDelete={canDelete && !message.deletedAt ? () => setDeleteOpen(true) : undefined} disabled={mutationPending} />
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
            ) : (
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

function MessageActions({ onReply, onCopyText, onCopyLink, onEdit, onDelete, disabled }: { onReply: () => void; onCopyText: () => void; onCopyLink: () => void; onEdit?: () => void; onDelete?: () => void; disabled?: boolean }) {
  return (
    <div className="ml-auto flex opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
      <Button type="button" variant="ghost" size="icon-xs" onClick={onReply} aria-label="Reply in thread" disabled={disabled}>
        <MessageSquareTextIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Message actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
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
  return <div className={cn(spaced && "mt-2")}>{blocks.map((block, index) => block.kind === "code" ? <pre key={index} className="my-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"><code>{block.text}</code></pre> : <span key={index}>{block.kind === "cite" ? block.text || block.cite.section || block.cite.cardId : block.text}</span>)}</div>
}

function ChannelComposer({ channel, threadId }: { channel: Channel; threadId?: string }) {
  const { connected, mode, sendMessage, workspace, typingMemberIds, member, me } = useCommunity()
  const draftKey = `ada:draft:v1:${channel.id}:${threadId ?? "channel"}`
  const [text, setText] = useState(() => readDraft(draftKey))
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<string | null>(null)
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const joined = channel.memberIds.includes(me.id)
  const readOnly = mode === "demo" || channel.status === "archived" || !joined
  const dmAgent = channel.kind === "dm" && channel.agentId ? member(channel.agentId) : undefined
  const agentUnavailable = mode === "connected" && dmAgent?.kind === "agent" && dmAgent.presence === "away"
  const typing = typingMemberIds(channel.id).filter((id) => id !== me.id).map((id) => member(id).name)
  const mentionable = channel.memberIds.filter((id) => id !== me.id).map(member)

  useEffect(() => {
    writeDraft(draftKey, text)
  }, [draftKey, text])

  useEffect(() => {
    if (readOnly || !text.trim()) {
      workspace.setTyping(channel.id, false)
      return
    }
    workspace.setTyping(channel.id, true)
    const timer = setTimeout(() => workspace.setTyping(channel.id, false), 1_200)
    return () => clearTimeout(timer)
  }, [channel.id, readOnly, text, workspace])

  const submit = async (input: PromptInputMessage) => {
    const value = input.text.trim()
    if (!value || readOnly || agentUnavailable) return
    setStatus("submitted")
    setError(null)
    try {
      await sendMessage({
        channelId: channel.id,
        threadId,
        paragraphs: textToParagraphs(value),
        clientId: crypto.randomUUID(),
      })
      workspace.setTyping(channel.id, false)
      setText("")
      writeDraft(draftKey, "")
      setStatus("ready")
    } catch (cause) {
      setStatus("error")
      setError(cause instanceof Error ? cause.message : "The message could not be sent.")
      toast.add({ title: "Message not sent", description: cause instanceof Error ? cause.message : "Try again." })
    }
  }

  const wrapSelection = (left: string, right = left) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${text.slice(0, start)}${left}${text.slice(start, end)}${right}${text.slice(end)}`
    setText(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + left.length, end + left.length)
    })
  }

  const insertText = (value: string) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? text.length
    const end = textarea?.selectionEnd ?? start
    const next = `${text.slice(0, start)}${value}${text.slice(end)}`
    setText(next)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + value.length, start + value.length)
    })
  }

  const insertMention = (candidate: Member) => {
    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const match = before.match(/@[^\s@]*$/)
    const start = match ? cursor - match[0].length : cursor
    const value = `@${candidate.name} `
    const next = `${text.slice(0, start)}${value}${text.slice(cursor)}`
    setText(next)
    setMentionsOpen(false)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + value.length, start + value.length)
    })
  }

  return (
    <div className="shrink-0 px-3 pb-3 pt-1 sm:px-5 sm:pb-4">
      {agentUnavailable ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">Waiting for the agent to connect. Your draft is saved; sending will be available when it is online.</p> : null}
      {threadId ? <p className="mx-auto mb-1.5 max-w-4xl text-xs font-medium text-muted-foreground">Replying in thread</p> : null}
      {error ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-destructive" role="alert">{error} Try again when the connection is ready.</p> : null}
      {typing.length ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">{typing.length === 1 ? `${typing[0]} is typing…` : `${typing.slice(0, 2).join(" and ")} are typing…`}</p> : null}
      {!connected && mode === "connected" ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">Reconnecting… messages will send when the course is back online.</p> : null}
      <div className="relative mx-auto max-w-4xl">
        {mentionsOpen ? (
          <div className="absolute bottom-[calc(100%+0.4rem)] left-2 z-20 w-64 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md" role="listbox" aria-label="Mention a course member">
            {mentionable.length ? mentionable.map((candidate, index) => (
              <button key={candidate.id} type="button" role="option" aria-selected={index === mentionIndex} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent aria-selected:bg-accent focus-visible:bg-accent" onMouseEnter={() => setMentionIndex(index)} onClick={() => insertMention(candidate)}>
                <MemberAvatar member={candidate} size={24} /><span className="min-w-0 flex-1 truncate">{candidate.name}</span><span className="text-xs text-muted-foreground">{candidate.kind}</span>
              </button>
            )) : <p className="px-2 py-2 text-xs text-muted-foreground">No other members in this channel.</p>}
          </div>
        ) : null}
        <PromptInput
          onSubmit={submit}
          onError={(issue) => setError(issue.message)}
          className="rounded-md bg-background shadow-none"
        >
          <PromptInputBody>
          <PromptInputTextarea
            ref={textareaRef}
            value={text}
            onChange={(event) => {
              const value = event.currentTarget.value
              setText(value)
              const before = value.slice(0, event.currentTarget.selectionStart)
              const shouldOpen = /@[^\s@]*$/.test(before)
              setMentionsOpen(shouldOpen)
              if (shouldOpen) setMentionIndex(0)
            }}
            placeholder={readOnly ? (channel.status === "archived" ? "This channel is archived" : !joined ? "Join this channel to send messages" : "Demo mode is read-only") : threadId ? "Reply in thread" : `Message ${channel.kind === "dm" ? channel.name : `#${channel.name}`}`}
            disabled={readOnly || status === "submitted"}
            aria-label={threadId ? "Reply in thread" : `Message ${channel.name}`}
            className="min-h-14 max-h-48"
            onKeyDown={(event) => {
              if (mentionsOpen && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
                event.preventDefault()
                if (event.key === "Escape") setMentionsOpen(false)
                else if (event.key === "ArrowDown") setMentionIndex((index) => (index + 1) % Math.max(mentionable.length, 1))
                else if (event.key === "ArrowUp") setMentionIndex((index) => (index - 1 + Math.max(mentionable.length, 1)) % Math.max(mentionable.length, 1))
                else if (mentionable[mentionIndex]) insertMention(mentionable[mentionIndex])
                return
              }
              if (!(event.metaKey || event.ctrlKey)) return
              const key = event.key.toLowerCase()
              if (key === "b") { event.preventDefault(); wrapSelection("**") }
              else if (key === "i") { event.preventDefault(); wrapSelection("*") }
              else if (key === "k") { event.preventDefault(); wrapSelection("[", "](url)") }
            }}
          />
          </PromptInputBody>
          <PromptInputFooter>
          <PromptInputTools>
            <PromptInputButton tooltip="Mention a person or agent" onClick={() => setMentionsOpen((open) => !open)} disabled={readOnly || status === "submitted"} aria-expanded={mentionsOpen}>
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
          <PromptInputSubmit status={status} disabled={readOnly || agentUnavailable || !text.trim() || status === "submitted"} />
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

function textToParagraphs(text: string): MessageBlock[][] {
  return text.split(/\n\s*\n/).map((paragraph) => [{ kind: "text", text: paragraph.trim() }])
}

const channelDrafts = new Map<string, string>()

function readDraft(key: string): string {
  return channelDrafts.get(key) ?? ""
}

function writeDraft(key: string, value: string): void {
  if (value) channelDrafts.set(key, value)
  else channelDrafts.delete(key)
}
