/*
DIRECTION · "The card file" (the student's side of the desk)
THESIS: feedback is not a notification. It's a page someone wrote about your work, and it stays a page —
  filed, dated, citing the cards you should reread. The chat next to it is where you answer back.
OWN-WORLD: one folder filling the panel, split in two: a white sheet you read (Literata, mono score,
  citation pills that open the card file) and a panel-2 column you operate (Inter, plain rows, a composer).
  The only yellow on the screen is the header strip of feedback that arrived today.
STORY: Sofia opens her study page, reads a 6/10 and where it slipped, presses "Learn it" on 03-backprop —
  the module's cards fan open and the first one lands in the context panel — then asks Ada how to get ahead.
FIRST VIEWPORT: the feedback sheet (score, summary, what went well, where it slipped, next steps) with the
  module list under it · to the right, the private conversation with Ada and her composer.
FORM: read on the left, operate on the right; below 760 px of panel the two stack, feedback first.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isAgent, useCommunity, isTeacher } from "@/lib/community"
import { Composer, Conversation } from "@/components/ada/channel"
import { Folder, FolderTab } from "@/components/ada/folder"
import { AgentFigure, agentInk, PresenceTag } from "@/components/ada/identity"
import { ErrorBoundary } from "@/components/ada/boundary"
import {
  ConversationHeader,
  EmptyNote,
  FeedbackTile,
  ModuleRow,
  StudyBroken,
  StudySection,
  ThinkingLine,
  type ModuleState,
} from "@/components/ada/study"
import { isFreshFeedback, useNarrowPanel } from "@/components/ada/study-helpers"
import { cn } from "@/lib/utils"
import type { Agent, Card } from "@/lib/types"

export function StudyScreen() {
  const { community, me, now, panels, openCard, moduleCards, myFeedback, presenceOf } = useCommunity()

  /* The course agent is the one the community owns (`scope: "community"`), not
     whoever happens to be called Ada; the id is only a fallback for a seed that
     predates the field. */
  const agent = useMemo(() => {
    const agents = community.members.filter(isAgent)
    return agents.find((a) => a.scope === "community") ?? agents.find((a) => a.id === "ada")
  }, [community.members])

  /* Presence lives outside the snapshot's member record (it arrives over the
     WS), so the figure and the tag read it through `presenceOf`. */
  const liveAgent = useMemo<Agent | undefined>(
    () => (agent ? { ...agent, presence: presenceOf(agent.id) } : undefined),
    [agent, presenceOf],
  )
  const agentName = agent?.name ?? "Ada"

  /* Guarded card lookup: `card(id)` throws on an id the snapshot can't resolve,
     and a dangling `cardId` inside a piece of feedback must cost the citation,
     not the page. */
  const cardsById = useMemo(() => new Map(community.cards.map((c) => [c.id, c])), [community.cards])
  const cardOf = useCallback((id: string | undefined): Card | undefined => (id ? cardsById.get(id) : undefined), [cardsById])
  const authorNameOf = useCallback(
    (id: string) => community.members.find((m) => m.id === id)?.name ?? "unknown",
    [community.members],
  )

  const feedback = useMemo(() => {
    const mine = [...myFeedback()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return mine[0]
  }, [myFeedback])
  const feedbackAgent = useMemo<Agent | undefined>(() => {
    if (!feedback) return undefined
    return community.members.find((m): m is Agent => isAgent(m) && m.id === feedback.agentId) ?? agent
  }, [feedback, community.members, agent])
  const assignment = feedback ? community.assignments.find((a) => a.id === feedback.assignmentId) : undefined
  const assignmentTitle = assignment?.title ?? "your last assignment"

  /* Modules, in course order, read against the latest feedback: the gaps name
     what slipped, everything before the first slip is behind you, everything
     after it is ahead. With nothing graded yet the page claims neither. */
  const modules = useMemo(() => [...community.modules].sort((a, b) => a.index - b.index), [community.modules])
  const slipped = useMemo(() => new Set(feedback?.gaps.map((g) => g.moduleId) ?? []), [feedback])
  const firstSlippedIndex = useMemo(() => {
    const indexes = modules.filter((m) => slipped.has(m.id)).map((m) => m.index)
    return indexes.length > 0 ? Math.min(...indexes) : Number.POSITIVE_INFINITY
  }, [modules, slipped])
  const moduleState = (index: number, id: string): ModuleState => {
    if (slipped.has(id)) return "slipped"
    if (!feedback) return "unknown"
    return index < firstSlippedIndex ? "done" : "ahead"
  }

  /* Which module is fanned open. Local: it's a reading position, not state the
     rest of the app or another tab has any business knowing. */
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const toggleModule = (moduleId: string) => {
    if (expandedModule === moduleId) {
      setExpandedModule(null)
      return
    }
    setExpandedModule(moduleId)
    // Opening the module already answers "where do I start?": the first card
    // lands in the context panel without a second click.
    const first = moduleCards(moduleId)[0]
    if (first) openCard(first.id)
  }
  const openCardIds = useMemo(() => new Set(panels.flatMap((p) => (p.kind === "card" ? [p.cardId] : []))), [panels])
  const isCardOpen = useCallback((id: string) => openCardIds.has(id), [openCardIds])

  /* The student's private channel with the course agent: the only place on this
     screen where a message can be written. */
  const privateChannel = useMemo(
    () =>
      agent
        ? community.channels.find((c) => c.group === "private" && c.memberIds.includes(me.id) && c.memberIds.includes(agent.id))
        : undefined,
    [community.channels, me.id, agent],
  )
  /* Reading the conversation here counts as reading the channel: the provider
     clears a channel's unread mark when it's the active one, and this page IS
     that channel's reader. It also means leaving for the channel view lands on
     the same conversation. */
  const { setActiveChannelId } = useCommunity()
  const privateChannelId = privateChannel?.id
  useEffect(() => {
    if (privateChannelId) setActiveChannelId(privateChannelId)
  }, [privateChannelId, setActiveChannelId, community.messages.length])

  /* Stable reference, for the same reason Channel.tsx keeps one: `panels`
     changes on every card you open, and a new array each time would throw
     Conversation's auto-scroll to the bottom mid-read. */
  const messages = useMemo(
    () => (privateChannel ? community.messages.filter((m) => m.channelId === privateChannel.id && new Date(m.at) <= now) : []),
    [community.messages, privateChannel, now],
  )

  /* Chips, not an autosend: they fill the field and the student presses Enter.
     What Ada is asked stays the student's sentence. */
  const suggestions = useMemo(() => {
    if (!feedback) return ["How should I prioritize this week?"]
    const gap = feedback.gaps[0]
    return [...(gap ? [`How do I get ahead in ${gap.moduleId}?`] : []), `What should I redo from ${assignmentTitle}?`]
  }, [feedback, assignmentTitle])

  const teacherName = community.members.find(isTeacher)?.name ?? "your teacher"
  const thinking = agent ? presenceOf(agent.id) === "thinking" : false

  const frame = useRef<HTMLDivElement>(null)
  const narrow = useNarrowPanel(frame)

  return (
    <Folder
      tabs={<FolderTab active>My study</FolderTab>}
      actions={
        liveAgent && (
          <span className="meta flex items-center gap-2 pr-1 text-ink-3">
            <AgentFigure agent={liveAgent} size={22} />
            <span className="font-medium" style={{ color: agentInk(liveAgent) }}>
              {liveAgent.name}
            </span>
            <PresenceTag member={liveAgent} />
          </span>
        )
      }
    >
      <div ref={frame} className={cn("flex min-h-0 min-w-0 flex-1", narrow ? "flex-col" : "flex-row")}>
        {/* ---- The study sheet: what is read ---- */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-7 py-6">
          <div className="w-full max-w-[680px]">
            <ErrorBoundary
              fallback={(error) => <StudyBroken title="Your feedback couldn't be drawn" detail={error.message} />}
            >
              {feedback ? (
                <FeedbackTile
                  feedback={feedback}
                  agent={feedbackAgent}
                  agentName={feedbackAgent?.name ?? agentName}
                  assignmentTitle={assignmentTitle}
                  now={now}
                  /* One Sun Rule: this strip is the screen's single yellow, and
                     only while the feedback is less than a day old. */
                  fresh={isFreshFeedback(feedback.at, now)}
                  cardOf={cardOf}
                  onOpenCard={openCard}
                />
              ) : (
                <EmptyNote>No feedback yet. When an assignment is graded, {agentName} writes you a note here.</EmptyNote>
              )}
            </ErrorBoundary>

            <StudySection title="Your modules" className="mt-8">
              {modules.length === 0 ? (
                <EmptyNote>The course doesn't have any modules yet.</EmptyNote>
              ) : (
                <ul className="-mx-3 flex flex-col">
                  {modules.map((module) => (
                    <ModuleRow
                      key={module.id}
                      module={module}
                      state={moduleState(module.index, module.id)}
                      expanded={expandedModule === module.id}
                      cards={expandedModule === module.id ? moduleCards(module.id) : []}
                      authorNameOf={authorNameOf}
                      isCardOpen={isCardOpen}
                      onToggle={() => toggleModule(module.id)}
                      onOpenCard={openCard}
                    />
                  ))}
                </ul>
              )}
            </StudySection>
          </div>
        </div>

        {/* ---- The conversation: what is operated ---- */}
        <aside
          aria-label={`Your conversation with ${agentName}`}
          className={cn(
            "flex min-h-0 flex-col bg-panel-2",
            narrow ? "h-[360px] w-full shrink-0 rounded-b-panel" : "w-[380px] min-w-[320px] shrink-0 rounded-r-panel",
          )}
        >
          <ErrorBoundary
            fallback={(error) => (
              <div className="p-[18px]">
                <StudyBroken title="The conversation couldn't be drawn" detail={error.message} />
              </div>
            )}
          >
            {liveAgent && privateChannel ? (
              <>
                <ConversationHeader agent={liveAgent} note={`your private channel · only you and ${liveAgent.name}`} />
                <Conversation channel={privateChannel} messages={messages} />
                {thinking && <ThinkingLine name={liveAgent.name} />}
                {/* Not `compact`: that flag makes the composer adopt the thread
                    on top of the panel stack, and on this screen the stack holds
                    whatever card the student just opened — a message meant for
                    Ada would land in someone else's thread. */}
                <Composer
                  channelId={privateChannel.id}
                  placeholder={`Ask ${liveAgent.name} how to get ahead…`}
                  suggestions={suggestions}
                />
                {/* The rule, where it applies, always: what leaves this channel
                    is the plan, never the conversation (DECISIONS.md §16). */}
                <p className="mx-4 -mt-2 mb-3 font-sans text-[11.5px] leading-[1.35] text-ink-3">
                  Plans {liveAgent.name} writes here are summarized for {teacherName} so the module can improve — never your
                  messages.
                </p>
              </>
            ) : (
              <div className="p-[18px]">
                <EmptyNote>You don't have a private channel with {agentName} yet.</EmptyNote>
              </div>
            )}
          </ErrorBoundary>
        </aside>
      </div>
    </Folder>
  )
}
