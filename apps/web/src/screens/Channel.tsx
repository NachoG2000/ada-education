/*
DIRECCIÓN · «El fichero» (seed ada01 · candidata 4/7 · gesto propio: rayos X de fuentes)
THESIS: el chat existe para producir fichas. Refusa el three-column Slack con burbujas, chips y badge BOT.
OWN-WORLD: suelo neutro con sidebar inset (shadcn), dos paneles blancos redimensionables (canal · contexto),
  pestañas plegadas de color = tipo de ficha, amarillo pleno para lo nuevo, pills pastel de estado,
  agentes como siluetas planas de color con dos ojos (Ada, la agente del curso, es azul). Inter / Literata / Geist Mono.
STORY: Sofía pregunta; Ada responde citando fichas; la respuesta se archiva y entra a la fila.
  Dos días después, otra alumna pregunta y la respuesta llega marcada «ya en el fichero».
FIRST VIEWPORT: sidebar inset · canal con fila de fichas arriba (la nueva en amarillo), conversación, composer ·
  panel contextual con el thread y la ficha ARCHIVADA al cierre. Los dos paneles se redimensionan con un handle.
FORM: app operativa real (shadcn sidebar-08 + resizable); el color vive en pestañas, pills, el amarillo y los personajes.
*/

import { useMemo } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useCommunity } from "@/lib/community"
import { ChannelActions, ChannelHeader, Composer, Conversation, FichaRow } from "@/components/ada/channel"
import { Folder, FolderTab } from "@/components/ada/folder"
import { PanelStack } from "@/components/ada/panel"

const LAYOUT_KEY = "ada:layout:channel"

function readLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : undefined
  } catch {
    return undefined
  }
}

export function ChannelScreen() {
  const { community, activeChannelId, now, panels } = useCommunity()
  const defaultLayout = useMemo(readLayout, [])
  const hasContext = panels.length > 0
  const channel = community.channels.find((c) => c.id === activeChannelId) ?? community.channels[0]
  const messages = community.messages.filter((m) => m.channelId === channel.id && new Date(m.at) <= now)

  return (
    <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <AppSidebar />
      {/* Misma posición que SidebarInset: margen 8, sin margen izquierdo; adentro, dos paneles inset redimensionables. */}
      <div className="relative flex h-svh min-w-0 flex-1 flex-col p-2 md:pl-0">
        <ResizablePanelGroup
          orientation="horizontal"
          id="ada-channel"
          defaultLayout={defaultLayout}
          onLayoutChanged={(layout) => {
            if (!("contexto" in layout)) return // con el panel cerrado no hay nada que recordar
            try {
              localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
            } catch {
              /* sin storage: el layout no persiste */
            }
          }}
          className="h-full min-h-0"
        >
          <ResizablePanel id="canal" defaultSize="62" minSize={520} className="min-w-0">
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
              <FichaRow channel={channel} />
              <Conversation channel={channel} messages={messages} />
              <Composer placeholder={`Escribí en #${channel.name}… @Ada para pedirle algo directo`} />
            </Folder>
          </ResizablePanel>
          {/* Sin thread ni ficha abiertos, el canal ocupa todo el ancho. */}
          {hasContext && (
            <>
              <ResizableHandle className="group/handle w-2 bg-transparent after:w-2 after:rounded-full after:transition-colors hover:after:bg-line-strong data-[resize-handle-active]:after:bg-ink-4" />
              <ResizablePanel id="contexto" defaultSize="38" minSize={340} className="min-w-0">
                <PanelStack />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </SidebarProvider>
  )
}
