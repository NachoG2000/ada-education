/*
DIRECTION · "The card file" in Operate mode: the teacher's desk, not a dashboard.
THESIS: a module is a folder in the file. Material goes in, cards come out, and the agent
  files what it saw. Every decision the teacher makes here sits next to the evidence for it.
FIRST VIEWPORT: one folder tab ("Modules"), the agent's presence in the strip, the module list
  on panel-2 at the left (mono index · Literata title · status · cards · level), and the open
  module's sheet at the right: difficulty, material, cards, reports.
FORM: a list and a sheet — no modals, no icon-and-heading grid. Status is told with pills, type
  with the folded tab, and the only full yellow on the screen is the newest card (One Sun Rule).
*/

import { useEffect, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"
import { useCommunity } from "@/lib/community"
import { ErrorBoundary } from "@/components/ada/boundary"
import { Folder, FolderTab, FloatingButton } from "@/components/ada/folder"
import { AgentPresence, ModuleList, ModuleSheet } from "@/components/ada/modules"

/** The course agent: the one whose runner compiles this file. */
const AGENT_ID = "ada"

const SELECTED_KEY = "ada:modules:selected"

/** The desk reopens on the module you were last working in. */
function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null // no storage: we open on the first module
  }
}

function storeSelected(id: string) {
  try {
    localStorage.setItem(SELECTED_KEY, id)
  } catch {
    // no storage: the choice only holds for this session
  }
}

export function ModulesScreen() {
  const { community } = useCommunity()
  const modules = useMemo(() => [...community.modules].sort((a, b) => a.index - b.index), [community.modules])

  const [wanted, setWanted] = useState<string | null>(readSelected)
  // A stored id that no longer exists (re-seeded course) falls back to the first.
  const selected = modules.find((m) => m.id === wanted) ?? modules[0] ?? null

  const select = (id: string) => {
    setWanted(id)
    storeSelected(id)
  }

  /* "New module" doesn't exist yet, and a button that opens an empty modal
     lies. It says when it will exist, and the note goes away on its own. */
  const [note, setNote] = useState(false)
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(false), 2000)
    return () => clearTimeout(t)
  }, [note])

  return (
    <Folder
      tabs={<FolderTab active>Modules</FolderTab>}
      actions={
        <>
          <AgentPresence agentId={AGENT_ID} />
          {note && (
            <span role="status" className="meta whitespace-nowrap text-ink-3">
              Coming after the demo
            </span>
          )}
          <FloatingButton label="New module" onClick={() => setNote(true)}>
            <PlusIcon aria-hidden className="size-3.5" strokeWidth={1.8} />
            <span className="font-sans text-[12.5px] font-medium">New module</span>
          </FloatingButton>
        </>
      }
    >
      {selected ? (
        <div className="flex min-h-0 min-w-0 flex-1">
          <ModuleList modules={modules} selectedId={selected.id} onSelect={select} />
          {/* Keyed by module: switching modules starts a fresh sheet (scroll at
              the top, no half-written note carried over) and gives the boundary
              below a clean slate. */}
          <div key={selected.id} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <ErrorBoundary fallback={(error) => <SheetBroken detail={error.message} />}>
              <ModuleSheet module={selected} />
            </ErrorBoundary>
          </div>
        </div>
      ) : (
        <Empty />
      )}
    </Folder>
  )
}

/** The module is there but something it points at isn't: the list stays usable
    and only the sheet says what broke. */
function SheetBroken({ detail }: { detail: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-7 py-8">
      <h2 className="font-sans text-[15px] font-semibold text-ink">This module can't be shown</h2>
      <p className="mt-2 max-w-[52ch] font-sans text-[13.5px] leading-[1.5] text-ink-2">
        It points at someone or something that isn't in the course file. Nothing was lost: pick another module on the left.
      </p>
      <p className="meta mt-2 max-w-[52ch] text-ink-3">{detail}</p>
    </div>
  )
}

function Empty() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-2 px-7">
      <h2 className="font-sans text-[15px] font-semibold text-ink">No modules yet</h2>
      <p className="max-w-[52ch] font-sans text-[13.5px] leading-[1.5] text-ink-2">
        The course file is empty. Seed the course and the modules show up here with their material, their cards and the agent's
        reports.
      </p>
    </div>
  )
}
