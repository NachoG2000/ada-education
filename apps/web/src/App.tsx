import { useSyncExternalStore } from "react"
import { CommunityProvider, useConnectedCommunity } from "@/lib/community"
import { readHash, subscribeToHash } from "@/lib/hash"
import { configuredServer } from "@/lib/api"
import { demo } from "@/lib/demo"
import { ErrorBoundary } from "@/components/ada/boundary"
import { WhoAreYou } from "@/components/ada/who-are-you"
import { JoinCourse } from "@/components/ada/join"
import { WorkspaceShell } from "@/components/workspace/shell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { FigureSheet } from "@/screens/FigureSheet"
import { parseHash } from "@/lib/routes"

/* The demo's "now": pins the day labels and filters future messages. */
const NOW = new Date("2026-08-22T12:00:00-03:00")

/* With VITE_ADA_SERVER set the app runs connected; without it, the usual demo. */
const SERVER = configuredServer()

/* The hash is the whole router (lib/hash.ts holds the one subscription; the
   community provider derives the in-shell view from the same source). Read
   live, not once: pointing an open tab at #figures switches the screen without
   a reload, and coming back lands on the course again. The boundary is keyed
   by it so a screen that broke doesn't survive the navigation away from it. */

export default function App() {
  const hash = useSyncExternalStore(subscribeToHash, readHash)
  const boundaryKey = parseHash(hash).kind === "figures" ? "figures" : "workspace"

  /* Last resort: whatever breaks, the person gets a screen that says so and a
     way to try again — never a blank page. The boundaries further in
     (message rows, contextual panel) catch what they can before this. */
  return (
    <TooltipProvider>
      <ErrorBoundary key={boundaryKey} fallback={(error) => <AppBroken detail={error.message} />}>{screen(hash)}</ErrorBoundary>
      <Toaster />
    </TooltipProvider>
  )
}

function screen(hash: string) {
  if (parseHash(hash).kind === "figures") return <FigureSheet />
  if (SERVER) return <ConnectedApp server={SERVER} />
  return (
    <CommunityProvider community={demo} initialChannelId="questions" now={NOW}>
      <WorkspaceShell />
    </CommunityProvider>
  )
}

function AppBroken({ detail }: { detail: string }) {
  return (
    <GroundScreen>
      <h1 className="font-sans text-[19px] font-semibold tracking-[-0.012em] text-ink">The course couldn't be drawn</h1>
      <p className="mt-2 font-sans text-[13.5px] leading-[1.55] text-ink-2">
        Something in what the server sent doesn't fit together. Reloading usually brings the course back; if it doesn't, the console has the detail.
      </p>
      <p className="meta mt-3 text-ink-3">{detail}</p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-5 inline-flex h-8 items-center rounded-full bg-ink px-4 font-sans text-[12.5px] font-medium text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal"
      >
        Reload
      </button>
    </GroundScreen>
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
        <p className="meta mt-1.5 text-ink-3">{server}</p>
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

  if (con.phase === "join") {
    return (
      <JoinCourse
        courseName={con.courseName}
        subtitle={con.subtitle}
        inviteToken={con.inviteToken}
        onClaim={con.claim}
        onJoin={con.join}
      />
    )
  }

  return (
    <CommunityProvider
      community={con.community}
      initialChannelId={con.initialChannelId}
      now={con.now}
      mode="connected"
      connected={con.connected}
      sendMessage={con.sendMessage}
      startThread={con.startThread}
      runnerInfo={con.runnerInfo}
      uploadMaterial={con.uploadMaterial}
      patchModule={con.patchModule}
      reconcileReport={con.reconcileReport}
      createInvite={con.createInvite}
      workspace={con.workspace}
      typing={con.typing}
    >
      <WorkspaceShell />
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
