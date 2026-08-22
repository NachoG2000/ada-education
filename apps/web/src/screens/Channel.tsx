/*
DIRECTION · "The card file" (seed ada01 · candidate 4/7 · signature gesture: source x-rays)
THESIS: the chat exists to produce cards. It refuses the three-column Slack with bubbles, chips and a BOT badge.
OWN-WORLD: neutral ground with an inset sidebar (shadcn), two resizable white panels (channel · context),
  folded color tabs = card type, full yellow for what's new, pastel status pills,
  agents as flat color silhouettes with two eyes (Ada, the course agent, is blue). Inter / Literata / Geist Mono.
STORY: Sofia asks; Ada answers citing cards; the answer gets filed and joins the row.
  Two days later, another student asks and the answer arrives marked "already on file".
FIRST VIEWPORT: inset sidebar · channel with the card row on top (the new one in yellow), conversation, composer ·
  contextual panel with the thread and the ARCHIVED card at its close. Both panels resize with a handle.
FORM: a real working app (shadcn sidebar-08 + resizable); color lives in tabs, pills, the yellow and the figures.
*/

import { useMemo } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useCommunity } from "@/lib/community"
import { CardRow, ChannelActions, ChannelHeader, Composer, Conversation } from "@/components/ada/channel"
import { Folder, FolderTab } from "@/components/ada/folder"
import { PanelStack } from "@/components/ada/panel"

const LAYOUT_KEY = "ada:layout:channel"
const PANEL_IDS = ["channel", "context"]

/* What's stored is a react-resizable-panels `Layout`: one flex-grow per panel
   (not pixels or percentages), so it stays valid at any window width — each
   panel's px minimums are enforced by the library. The only thing to defend is
   the shape: corrupt JSON or another version's gets discarded. */
function readLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return discardLayout()
    const entries = Object.entries(parsed as Record<string, unknown>)
    const valid =
      entries.length > 0 &&
      entries.every(([id, v]) => PANEL_IDS.includes(id) && typeof v === "number" && Number.isFinite(v) && v > 0)
    return valid ? (parsed as Record<string, number>) : discardLayout()
  } catch {
    return undefined
  }
}

function discardLayout() {
  try {
    localStorage.removeItem(LAYOUT_KEY)
  } catch {
    /* no storage: nothing to discard */
  }
  return undefined
}

export function ChannelScreen() {
  const { community, activeChannelId, now, panels } = useCommunity()
  const defaultLayout = useMemo(() => readLayout(), [])
  const hasContext = panels.length > 0
  const channel = community.channels.find((c) => c.id === activeChannelId) ?? community.channels[0]
  /* Stable reference: without this, opening a card or a thread (which only
     changes `panels`) returned a new array and Conversation's auto-scroll threw
     the conversation to the bottom even while the user was reading further up. */
  const messages = useMemo(
    () => community.messages.filter((m) => m.channelId === channel.id && new Date(m.at) <= now),
    [community.messages, channel.id, now],
  )

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <AppSidebar />
      {/* Same position as SidebarInset: margin 8, no left margin; inside, two resizable inset panels. */}
      <div className="relative flex h-svh min-w-0 flex-1 flex-col p-2 md:pl-0">
        <h1 className="sr-only">
          {community.name} · channel #{channel.name}
        </h1>
        <ResizablePanelGroup
          orientation="horizontal"
          id="ada-channel"
          defaultLayout={defaultLayout}
          onLayoutChanged={(layout) => {
            if (!("context" in layout)) return // with the panel closed there's nothing to remember
            try {
              localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
            } catch {
              /* no storage: the layout doesn't persist */
            }
          }}
          className="h-full min-h-0"
        >
          <ResizablePanel id="channel" defaultSize="62" minSize={520} className="min-w-0">
            <Folder
              tabs={
                <FolderTab active>
                  <span className="mr-0.5 font-normal text-ink-4">#</span>
                  {channel.name}
                </FolderTab>
              }
              actions={<ChannelActions channel={channel} />}
            >
              <ChannelHeader channel={channel} />
              <CardRow channel={channel} />
              <Conversation channel={channel} messages={messages} />
              <Composer placeholder={`Write in #${channel.name}… @Ada to ask her something directly`} />
            </Folder>
          </ResizablePanel>
          {/* With no thread or card open, the channel takes the full width. */}
          {hasContext && (
            <>
              <ResizableHandle className="group/handle w-2 bg-transparent after:w-2 after:rounded-full after:transition-colors hover:after:bg-line-strong data-[resize-handle-active]:after:bg-ink-4" />
              <ResizablePanel id="context" defaultSize="38" minSize={340} className="min-w-0">
                <PanelStack />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </SidebarProvider>
  )
}
