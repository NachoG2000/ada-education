import { CommunityProvider, useConnectedCommunity } from "@/lib/community"
import { configuredServer } from "@/lib/api"
import { demo } from "@/lib/demo"
import { WhoAreYou } from "@/components/ada/who-are-you"
import { ChannelScreen } from "@/screens/Channel"
import { FigureSheet } from "@/screens/FigureSheet"

/* The demo's "now": pins the day labels and filters future messages. */
const NOW = new Date("2026-08-22T12:00:00-03:00")

/* With VITE_ADA_SERVER set the app runs connected; without it, the usual demo. */
const SERVER = configuredServer()

export default function App() {
  if (location.hash === "#figures") return <FigureSheet />
  if (SERVER) return <ConnectedApp server={SERVER} />
  return (
    <CommunityProvider community={demo} initialChannelId="questions" initialPanels={[{ kind: "thread", threadId: "t-explodes" }]} now={NOW}>
      <ChannelScreen />
    </CommunityProvider>
  )
}

/* ---- Connected mode: bootstrap, identity and screen ---------------------- */

function ConnectedApp({ server }: { server: string }) {
  const con = useConnectedCommunity(server)

  if (con.phase === "loading") {
    return (
      <GroundScreen>
        <p className="font-sans text-[14.5px] text-ink-2" role="status">
          Connecting to the course…
        </p>
        <p className="meta mt-1.5 text-ink-4">{server}</p>
      </GroundScreen>
    )
  }

  if (con.phase === "error") {
    return (
      <GroundScreen>
        <h1 className="font-sans text-[19px] font-semibold tracking-[-0.012em] text-ink">Couldn't connect to the course</h1>
        <p className="mt-2 font-sans text-[13.5px] leading-[1.55] text-ink-2">{con.detail}</p>
        <button
          type="button"
          onClick={con.retry}
          className="mt-5 inline-flex h-8 items-center rounded-full bg-ink px-4 font-sans text-[12.5px] font-medium text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal"
        >
          Retry
        </button>
      </GroundScreen>
    )
  }

  if (con.phase === "choosing-person") {
    return <WhoAreYou course={con.courseName} people={con.people} onChoose={con.choose} />
  }

  return (
    <CommunityProvider
      community={con.community}
      initialChannelId={con.initialChannelId}
      now={con.now}
      mode="connected"
      connected={con.connected}
      sendMessage={con.sendMessage}
      runnerInfo={con.runnerInfo}
    >
      <ChannelScreen />
    </CommunityProvider>
  )
}

/** Ground + small centered panel: the shell for the startup states. */
function GroundScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ground p-6">
      <div className="w-full max-w-sm rounded-panel bg-panel px-7 py-7 shadow-pop">{children}</div>
    </main>
  )
}
