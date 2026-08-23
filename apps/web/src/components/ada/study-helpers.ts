/* Hooks and pure helpers for the student's study page. Kept apart from
   study.tsx so that file only exports components (fast refresh). */

import { useEffect, useState, type RefObject } from "react"

/** True while the observed element is narrower than `max`.

    The page lives inside a panel the user can drag, so the breakpoint is the
    panel's width, not the window's: below 760 px the two columns stack. A
    ResizeObserver rather than a container query because the stacked branch also
    changes the conversation's height, and one source of truth for both beats a
    class list that has to agree with a hook. */
export function useNarrowPanel(ref: RefObject<HTMLElement | null>, max = 760) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (typeof width === "number") setNarrow(width < max)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, max])
  return narrow
}

const FRESH_MS = 24 * 3600 * 1000

export function isFreshFeedback(at: string, now: Date) {
  const t = new Date(at).getTime()
  return Number.isFinite(t) && now.getTime() - t < FRESH_MS
}
