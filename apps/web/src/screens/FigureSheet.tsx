/* Variation sheet for the figure generator (dev): #figures */

import { useState } from "react"
import { figureParams } from "@/lib/figure"
import { Figure } from "@/components/ada/identity"

export function FigureSheet() {
  const [salt, setSalt] = useState(0)
  const seeds = Array.from({ length: 30 }, (_, i) => `agent-${salt}-${i}`)
  return (
    <div className="min-h-dvh p-8">
      <div className="panel mx-auto max-w-[1100px] p-8">
        <div className="mb-6 flex items-center gap-4">
          <h1 className="shrink-0 font-sans text-[19px] font-semibold text-ink">Procedural figures</h1>
          <p className="meta text-ink-3">Flat silhouettes of the same size, solid color, two eyes. Every agent is born with a unique variation (seed); changing the seed = "rolling another".</p>
          <button type="button" onClick={() => setSalt((s) => s + 1)} className="ml-auto h-8 shrink-0 whitespace-nowrap rounded-full bg-ink px-4 text-[12.5px] font-medium text-panel">
            Roll another batch
          </button>
        </div>
        <div className="grid grid-cols-6 gap-6">
          {seeds.map((seed) => {
            const p = figureParams(seed)
            return (
              <div key={seed} className="flex flex-col items-center gap-2 rounded-card bg-panel-2 p-4">
                <Figure params={p} size={96} />
                <div className="flex items-center gap-2">
                  <Figure params={p} size={36} />
                  <Figure params={p} size={24} />
                </div>
                <span className="meta text-ink-3">{p.crown} · {p.feet}</span>
                <code className="font-mono text-[10px] text-ink-3">{seed}</code>
              </div>
            )
          })}
        </div>
        <div className="mt-8 flex items-center gap-6 rounded-card bg-panel-2 p-4">
          <span className="meta text-ink-3">Demo seeds:</span>
          <span className="flex items-center gap-2"><Figure params={figureParams("ada-01", "blue")} size={64} /> <span className="text-[13px]">Ada · ada-01</span></span>
          <span className="flex items-center gap-2"><Figure params={figureParams("tutor-sofia-02")} size={64} /> <span className="text-[13px]">Sofia's tutor · tutor-sofia-02</span></span>
        </div>
      </div>
    </div>
  )
}
