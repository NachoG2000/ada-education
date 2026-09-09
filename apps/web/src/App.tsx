import { lazy, Suspense, useSyncExternalStore } from "react";
import { readHash, subscribeToHash } from "@/lib/hash";
import { configuredServer } from "@/lib/api";
import { ErrorBoundary } from "@/components/ada/boundary";
import { HostedApp } from "@/components/hosted";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { FigureSheet } from "@/screens/FigureSheet";

/* The hosted shell uses the configured API or the page's same-origin server. */
const SERVER = configuredServer();
const DesignSystem = lazy(() => import("@/screens/DesignSystem").then((module) => ({ default: module.DesignSystem })));

/* The hash is the whole router (lib/hash.ts holds the one subscription; the
   community provider derives the in-shell view from the same source). Read
   live, not once: pointing an open tab at #figures switches the screen without
   a reload, and coming back lands on the course again. The boundary is keyed
   by it so a screen that broke doesn't survive the navigation away from it. */

export default function App() {
  const hash = useSyncExternalStore(subscribeToHash, readHash);
  const boundaryKey = hash === "#figures" ? "figures" : "workspace";

  /* Last resort: whatever breaks, the person gets a screen that says so and a
     way to try again — never a blank page. The boundaries further in
     (message rows, contextual panel) catch what they can before this. */
  return (
    <TooltipProvider>
      <ErrorBoundary
        key={boundaryKey}
        fallback={(error) => <AppBroken detail={error.message} />}
      >
        {screen(hash)}
      </ErrorBoundary>
      <Toaster />
    </TooltipProvider>
  );
}

function screen(hash: string) {
  if (hash === "#design-system") return <Suspense fallback={<div className="p-6 text-sm">Loading interface reference…</div>}><DesignSystem /></Suspense>;
  if (hash === "#figures") return <FigureSheet />;
  return <HostedApp server={SERVER ?? location.origin} />;
}

function AppBroken({ detail }: { detail: string }) {
  return (
    <GroundScreen>
      <h1 className="text-lg font-semibold">The workspace couldn't be drawn</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Something in what the server sent doesn't fit together. Reloading
        usually brings the course back; if it doesn't, the console has the
        detail.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      <button
        type="button"
        onClick={() => location.reload()}
        className="mt-5 inline-flex h-8 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Reload
      </button>
    </GroundScreen>
  );
}

/** Ground + small centered panel: the shell for the startup states. */
function GroundScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card px-7 py-7 shadow-sm">
        {children}
      </div>
    </main>
  );
}
