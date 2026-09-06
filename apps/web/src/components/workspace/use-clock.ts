import { useSyncExternalStore } from "react"

let currentTime = Date.now()
let timer: number | undefined
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    timer = window.setInterval(() => {
      currentTime = Date.now()
      for (const notify of listeners) notify()
    }, 1_000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}

function snapshot() { return currentTime }

export function useClock(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
