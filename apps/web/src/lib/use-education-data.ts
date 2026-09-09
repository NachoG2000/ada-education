import { useCallback, useEffect, useRef, useState } from "react"

/** Authorized REST data with stale-response protection and focus/periodic refresh. */
export function useEducationData<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<{ source: typeof load; data: T }>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    try { const value = await load(); if (current === generation.current) { setResult({ source: load, data: value }); setError(undefined) } }
    catch (e) { if (current === generation.current) { setResult(undefined); setError(e instanceof Error ? e.message : "Could not load this content") } }
    finally { if (current === generation.current) setLoading(false) }
  }, [load])
  useEffect(() => {
    void Promise.resolve().then(refresh)
    const focus = () => { void refresh() }
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh() }, 15_000)
    window.addEventListener("focus", focus)
    // Invalidate in-flight responses; this ref is a request counter, not a DOM node.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; clearInterval(timer); window.removeEventListener("focus", focus) }
  }, [refresh])
  return { data: result?.source === load ? result.data : undefined, error, loading: loading || !result && !error, refresh }
}
