import { useEffect, useMemo, useRef, useState } from "react"
import type { ChatStatus } from "ai"
import {
  ArrowDownIcon,
  AtSignIcon,
  BoldIcon,
  Code2Icon,
  FileTextIcon,
  ItalicIcon,
  LinkIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
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
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble"
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
import { Inline } from "@/components/ada/message"
import { MemberAvatar } from "@/components/ada/identity"
import { cn } from "@/lib/utils"
import { dayLabel, formatTime, useCommunity } from "@/lib/community"
import { useAuxiliaryPreferences, useConversationSpacingPreferences } from "@/lib/preferences"
import type { Attachment as MessageAttachment, Channel, Message, MessageBlock } from "@/lib/types"

interface ChannelWorkspaceProps {
  onManageChannel: () => void
  onSearchChannel: () => void
}

export function ChannelWorkspace({ onManageChannel, onSearchChannel }: ChannelWorkspaceProps) {
  const community = useCommunity()
  const channel = community.community.channels.find((item) => item.id === community.activeChannelId)
  const threadPanel = community.panels[0]?.kind === "thread" ? community.panels[0] : undefined
  const narrowThread = useNarrowThread()
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
      <section className="flex size-full min-w-0 flex-1 flex-col" aria-label={`${channel.name} channel`}>
        <ChannelHeader channel={channel} onManageChannel={onManageChannel} onSearchChannel={onSearchChannel} />
        <ChannelTimeline key={channel.id} channel={channel} comfortable={comfortable} />
        <ChannelComposer key={`channel:${channel.id}`} channel={channel} />
      </section>
  )

  if (threadPanel && !narrowThread) {
    return (
      <ResizablePanelGroup orientation="horizontal" className="size-full min-h-0">
        <ResizablePanel id="channel-conversation" minSize={500} className="min-w-0">{conversation}</ResizablePanel>
        <ResizableHandle />
          <ResizablePanel id="channel-thread" defaultSize={auxiliary.width} minSize={300} maxSize={720} groupResizeBehavior="preserve-pixel-size" onResize={(size) => { if (size.inPixels >= 300) auxiliary.setWidth(size.inPixels) }} className="min-w-0">
          <ThreadPanel threadId={threadPanel.threadId} embedded />
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }

  return <div className="relative flex size-full min-h-0">{conversation}{threadPanel ? <ThreadPanel threadId={threadPanel.threadId} /> : null}</div>
}

function useNarrowThread(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 599px)").matches)
  useEffect(() => {
    const media = window.matchMedia("(max-width: 599px)")
    const update = () => setNarrow(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return narrow
}

function ChannelHeader({
  channel,
  onManageChannel,
  onSearchChannel,
}: {
  channel: Channel
  onManageChannel: () => void
  onSearchChannel: () => void
}) {
  const { member, me, workspace } = useCommunity()
  const visibleMembers = channel.memberIds.slice(0, 4)
  const joined = channel.memberIds.includes(me.id)
  const canManage = me.kind === "person" && (me.role === "teacher" || (channel.group === "private" && channel.createdBy === me.id))
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

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

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.012em]"># {channel.name}</h1>
          {channel.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
          {channel.visibility === "private" || channel.group === "private" ? <Badge variant="outline">Private</Badge> : null}
        </div>
        {channel.description ? <p className="truncate text-xs text-muted-foreground">{channel.description}</p> : null}
      </div>
      <div
        className={cn("hidden items-center -space-x-1.5 rounded-md px-1 py-1 sm:flex", canManage && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        onClick={canManage ? onManageChannel : undefined}
        onKeyDown={canManage ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onManageChannel() } } : undefined}
        role={canManage ? "button" : "group"}
        tabIndex={canManage ? 0 : undefined}
        aria-label={`${channel.memberIds.length} channel members${canManage ? ", open channel details" : ""}`}
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
        onClick={canManage ? onManageChannel : undefined}
        disabled={!canManage}
        aria-label={`${channel.memberIds.length} channel members${canManage ? ", open channel details" : ""}`}
      >
        {channel.memberIds.length} {channel.memberIds.length === 1 ? "member" : "members"}
      </button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onSearchChannel} aria-label="Find in channel">
        <SearchIcon />
      </Button>
      {!joined && channel.visibility === "open" && channel.status !== "archived" ? <Button type="button" variant="outline" size="sm" disabled={joining} onClick={() => void join()} aria-describedby={joinError ? `join-error-${channel.id}` : undefined}>{joining ? "Joining…" : "Join"}</Button> : null}
      {canManage ? <Button type="button" variant="ghost" size="icon-sm" onClick={onManageChannel} aria-label="Channel details"><PanelRightIcon /></Button> : null}
      {joinError ? <p id={`join-error-${channel.id}`} className="max-w-48 text-xs text-destructive" role="alert">{joinError}</p> : null}
    </header>
  )
}

function ChannelTimeline({ channel, comfortable }: { channel: Channel; comfortable: boolean }) {
  const { community, now } = useCommunity()
  const [visibleCount, setVisibleCount] = useState(80)
  const [hadUnreadOnOpen] = useState(() => Boolean(channel.unread))
  const messages = useMemo(
    () => community.messages.filter((message) => message.channelId === channel.id && !message.threadId),
    [channel.id, community.messages],
  )
  const visibleMessages = messages.slice(-visibleCount)

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <MessageSquareTextIcon aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Start #{channel.name}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Ask a course question, share an example, or mention an agent to bring the right knowledge into the conversation.
          </p>
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
        #
      </span>
      <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">Welcome to #{channel.name}</h2>
      <p className="mt-1 max-w-[68ch] text-sm leading-5 text-muted-foreground">
        {channel.description || "This is the beginning of this course conversation."}
      </p>
    </div>
  )
}

function WorkspaceMessage({ message, compact = false }: { message: Message; compact?: boolean }) {
  const { card, member, me, openCard, openThread, replyInThread, retryMessage, thread, workspace } = useCommunity()
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
  const canManage = author.id === me.id || (me.kind === "person" && me.role === "teacher")
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

  const toggleReaction = async (emoji: string) => {
    const mine = message.reactions?.find((reaction) => reaction.emoji === emoji)?.memberIds.includes(me.id)
    await mutate(() => mine ? workspace.removeReaction(message.id, emoji) : workspace.addReaction(message.id, emoji))
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
        <MemberAvatar member={author} size={compact ? 28 : 34} presence />
      </MessageAvatar>
      <MessageContent className="gap-0.5">
        <MessageHeader className="gap-2 px-0 text-foreground">
          <button type="button" className="truncate font-semibold hover:underline">{author.name}</button>
          {author.kind === "agent" ? <span className="font-normal text-muted-foreground">agent</span> : null}
          {author.id === me.id ? <span className="font-normal text-muted-foreground">you</span> : null}
          <time className="font-normal tabular-nums text-muted-foreground">{formatTime(message.at)}</time>
          {message.editedAt ? <span className="font-normal text-muted-foreground">edited</span> : null}
          {pendingState === "sending" ? <span className="font-normal text-muted-foreground" role="status">sending…</span> : null}
          {pendingState === "failed" ? <span className="font-normal text-destructive" role="alert">not sent</span> : null}
          <MessageActions onReply={openReply} onReact={() => void toggleReaction("👍")} onEdit={canManage && !message.deletedAt ? () => setEditing(true) : undefined} onDelete={canManage && !message.deletedAt ? () => setDeleteOpen(true) : undefined} disabled={mutationPending} />
        </MessageHeader>
        <Bubble variant="ghost" align="start" className="overflow-visible">
          <BubbleContent className="conversation-copy max-w-[72ch] text-foreground">
            {message.deletedAt ? (
              <p className="italic text-muted-foreground">Message deleted</p>
            ) : editing ? (
              <div className="space-y-2">
                <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} rows={3} autoFocus disabled={mutationPending} aria-label="Edit message" />
                <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void saveEdit()} disabled={mutationPending || !editText.trim()}>Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={mutationPending}>Cancel</Button></div>
              </div>
            ) : (
              <>
                {message.fromCard ? <FromCourseFile cardId={message.fromCard.cardId} ago={message.fromCard.ago} /> : null}
                {message.paragraphs.map((paragraph, index) => (
                  <p key={index} className={cn(index > 0 && "mt-2")}>
                    <Inline blocks={paragraph} onOpenCard={openCard} />
                  </p>
                ))}
                {message.publishes ? (
                  <button
                    type="button"
                    className="mt-2 flex max-w-lg items-center gap-2 rounded-lg bg-muted px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openCard(message.publishes as string)}
                  >
                    <FileTextIcon aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{card(message.publishes).title}</span>
                      <span className="block text-xs text-muted-foreground">Filed in the course knowledge base</span>
                    </span>
                  </button>
                ) : null}
                {message.attachments?.length ? <MessageAttachments message={message} /> : null}
              </>
            )}
          </BubbleContent>
          {message.reactions?.length ? (
            <BubbleReactions side="bottom" align="start" className="relative bottom-auto left-auto mt-1 translate-y-0 bg-transparent px-0 ring-0">
              {message.reactions.map((reaction) => (
                <Button key={reaction.emoji} type="button" variant={reaction.memberIds.includes(me.id) ? "secondary" : "outline"} size="xs" onClick={() => void toggleReaction(reaction.emoji)} disabled={mutationPending} aria-pressed={reaction.memberIds.includes(me.id)} aria-label={`${reaction.emoji}, ${reaction.count} reactions`}>
                  {reaction.emoji} <span className="tabular-nums">{reaction.count}</span>
                </Button>
              ))}
            </BubbleReactions>
          ) : null}
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

function MessageActions({ onReply, onReact, onEdit, onDelete, disabled }: { onReply: () => void; onReact: () => void; onEdit?: () => void; onDelete?: () => void; disabled?: boolean }) {
  return (
    <div className="ml-auto flex opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
      <Button type="button" variant="ghost" size="icon-xs" onClick={onReply} aria-label="Reply in thread" disabled={disabled}>
        <MessageSquareTextIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onReact} aria-label="Add thumbs up reaction" disabled={disabled}>
        <SmilePlusIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label="Message actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onReply}><MessageSquareTextIcon />Reply in thread</DropdownMenuItem>
            <DropdownMenuItem onClick={onReact}><SmilePlusIcon />Add reaction</DropdownMenuItem>
            {onEdit ? <DropdownMenuItem onClick={onEdit}><PencilIcon />Edit message</DropdownMenuItem> : null}
            {onDelete ? <DropdownMenuItem onClick={onDelete} variant="destructive"><Trash2Icon />Delete message</DropdownMenuItem> : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function FromCourseFile({ cardId, ago }: { cardId: string; ago: string }) {
  const { card, openCard } = useCommunity()
  const source = card(cardId)
  return (
    <button
      type="button"
      onClick={() => openCard(cardId)}
      className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileTextIcon aria-hidden />
      Composed from {source.title} · {ago}
    </button>
  )
}

function MessageAttachments({ message }: { message: Message }) {
  const { workspace } = useCommunity()
  return (
    <AttachmentGroup className="mt-2">
      {message.attachments?.map((attachment) => (
        <Attachment key={attachment.id} size="sm" state="done" className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring" role="button" tabIndex={0} onClick={() => void workspace.downloadAttachment(attachment.id, attachment.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void workspace.downloadAttachment(attachment.id, attachment.name) } }}>
          <AttachmentMedia><FileTextIcon /></AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{attachment.name}</AttachmentTitle>
            <AttachmentDescription>{formatBytes(attachment.size)}</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

function ChannelComposer({ channel, threadId }: { channel: Channel; threadId?: string }) {
  const { connected, mode, sendMessage, workspace, typingMemberIds, member, me } = useCommunity()
  const draftKey = `ada:draft:v1:${channel.id}:${threadId ?? "channel"}`
  const [text, setText] = useState(() => readDraft(draftKey))
  const [status, setStatus] = useState<ChatStatus>("ready")
  const [error, setError] = useState<string | null>(null)
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const joined = channel.memberIds.includes(me.id)
  const readOnly = mode === "demo" || channel.status === "archived" || !joined
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
    if ((!value && input.files.length === 0) || readOnly) return
    setStatus("submitted")
    setError(null)
    const uploaded: MessageAttachment[] = []
    try {
      for (const item of input.files) {
        if (!item.url) continue
        const blob = await fetch(item.url).then((response) => response.blob())
        const file = new File([blob], item.filename ?? "attachment", { type: item.mediaType ?? blob.type })
        uploaded.push(await workspace.uploadAttachment(channel.id, file))
      }
      await sendMessage({
        channelId: channel.id,
        threadId,
        paragraphs: value ? textToParagraphs(value) : [],
        clientId: crypto.randomUUID(),
        attachmentIds: uploaded.map((attachment) => attachment.id),
      })
      workspace.setTyping(channel.id, false)
      setText("")
      writeDraft(draftKey, "")
      setStatus("ready")
    } catch (cause) {
      await Promise.allSettled(uploaded.map((attachment) => workspace.deleteAttachment(attachment.id)))
      setStatus("error")
      setError(cause instanceof Error ? cause.message : "The message could not be sent.")
      throw cause
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

  return (
    <div className="shrink-0 px-3 pb-3 pt-1 sm:px-5 sm:pb-4">
      {threadId ? <p className="mx-auto mb-1.5 max-w-4xl text-xs font-medium text-muted-foreground">Replying in thread</p> : null}
      {error ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-destructive" role="alert">{error} Try again when the connection is ready.</p> : null}
      {typing.length ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">{typing.length === 1 ? `${typing[0]} is typing…` : `${typing.slice(0, 2).join(" and ")} are typing…`}</p> : null}
      {!connected && mode === "connected" ? <p className="mx-auto mb-1.5 max-w-4xl text-xs text-muted-foreground" role="status">Reconnecting… messages will send when the course is back online.</p> : null}
      <div className="relative mx-auto max-w-4xl">
        {mentionsOpen ? (
          <div className="absolute bottom-[calc(100%+0.4rem)] left-2 z-20 w-64 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-pop ring-1 ring-border" role="listbox" aria-label="Mention a course member">
            {mentionable.length ? mentionable.map((candidate) => (
              <button key={candidate.id} type="button" role="option" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent" onClick={() => { insertText(`@${candidate.id} `); setMentionsOpen(false) }}>
                <MemberAvatar member={candidate} size={24} /><span className="min-w-0 flex-1 truncate">{candidate.name}</span><span className="text-xs text-muted-foreground">{candidate.kind}</span>
              </button>
            )) : <p className="px-2 py-2 text-xs text-muted-foreground">No other members in this channel.</p>}
          </div>
        ) : null}
        <PromptInput
          onSubmit={submit}
          multiple
          maxFiles={20}
          maxFileSize={10 * 1024 * 1024}
          onError={(issue) => setError(issue.message)}
          className="rounded-xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_22px_-16px_rgb(0_0_0/0.45)]"
        >
          <PromptInputBody>
          <ComposerAttachmentTray />
          <PromptInputTextarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder={readOnly ? (channel.status === "archived" ? "This channel is archived" : !joined ? "Join this channel to send messages" : "Demo mode is read-only") : threadId ? "Reply in thread" : `Message #${channel.name}`}
            disabled={readOnly || status === "submitted"}
            aria-label={threadId ? "Reply in thread" : `Message ${channel.name}`}
            className="min-h-14 max-h-48"
            onKeyDown={(event) => {
              if (event.key === "Escape" && mentionsOpen) { event.preventDefault(); setMentionsOpen(false); return }
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
            <ComposerAttachmentButton disabled={readOnly || status === "submitted"} />
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
          <ComposerSubmit status={status} readOnly={readOnly} hasText={Boolean(text.trim())} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function ComposerAttachmentButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments()
  return <PromptInputButton tooltip="Attach files" onClick={() => attachments.openFileDialog()} disabled={disabled}><PaperclipIcon /></PromptInputButton>
}

function ComposerAttachmentTray() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pt-3">
      {attachments.files.map((file) => (
        <span key={file.id} className="inline-flex max-w-56 shrink-0 items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
          <FileTextIcon className="size-3.5 shrink-0" /><span className="truncate">{file.filename ?? "attachment"}</span>
          <button type="button" onClick={() => attachments.remove(file.id)} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${file.filename ?? "attachment"}`}><XIcon className="size-3" /></button>
        </span>
      ))}
    </div>
  )
}

function ComposerSubmit({ status, readOnly, hasText }: { status: ChatStatus; readOnly: boolean; hasText: boolean }) {
  const attachments = usePromptInputAttachments()
  return <PromptInputSubmit status={status} disabled={readOnly || (!hasText && attachments.files.length === 0) || status === "submitted"} />
}

function ThreadPanel({ threadId, embedded = false }: { threadId: string; embedded?: boolean }) {
  const { closePanel, community, message, thread } = useCommunity()
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
      <ChannelComposer key={`thread:${currentThread.id}`} channel={currentChannel} threadId={currentThread.id} />
    </aside>
  )
}

function textToParagraphs(text: string): MessageBlock[][] {
  return text.split(/\n\s*\n/).map((paragraph) => [{ kind: "text", text: paragraph.trim() }])
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function writeDraft(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // A blocked/full storage area should never make the composer unusable.
  }
}
