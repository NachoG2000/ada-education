import { CommunityProvider } from "@/lib/community"
import { demo } from "@/lib/demo"
import { ChannelScreen } from "@/screens/Channel"
import { FigureSheet } from "@/screens/FigureSheet"

/* "Ahora" de la demo: fija las etiquetas de día y filtra mensajes futuros. */
const NOW = new Date("2026-08-22T12:00:00-03:00")

export default function App() {
  if (location.hash === "#figuras") return <FigureSheet />
  return (
    <CommunityProvider community={demo} initialChannelId="dudas" initialPanels={[{ kind: "thread", threadId: "t-explota" }]} now={NOW}>
      <ChannelScreen />
    </CommunityProvider>
  )
}
