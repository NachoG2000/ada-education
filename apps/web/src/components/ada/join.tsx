/* The door of a gated course (DECISIONS.md §20). Two ways in, one screen:
   an invite link (#join?token=…) asks only for a name; without one, the
   deploy's owner token claims the teacher. Nothing of the course itself is
   shown here — before auth the server only reveals name and subtitle. */

import { useState, type FormEvent } from "react"

export function JoinCourse({
  courseName,
  subtitle,
  inviteToken,
  onClaim,
  onJoin,
}: {
  courseName: string
  subtitle: string
  inviteToken: string | null
  onClaim: (ownerToken: string) => Promise<void>
  onJoin: (name: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await (inviteToken ? onJoin(value.trim()) : onClaim(value.trim()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-ground p-6">
      <div className="w-full max-w-sm rounded-panel bg-panel px-7 py-7 shadow-pop">
        <p className="label text-ink-3">{inviteToken ? "You're invited to" : "Members only"}</p>
        <h1 className="mt-1 font-sans text-[19px] font-semibold tracking-[-0.012em] text-ink">{courseName}</h1>
        {subtitle ? <p className="mt-1 font-sans text-[13.5px] leading-[1.55] text-ink-2">{subtitle}</p> : null}
        <form onSubmit={submit} className="mt-5">
          <label className="label block text-ink-3" htmlFor="join-input">
            {inviteToken ? "Your name" : "Owner token"}
          </label>
          <input
            id="join-input"
            type={inviteToken ? "text" : "password"}
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "join-error" : undefined}
            placeholder={inviteToken ? "How the course will see you" : "From the deploy's environment"}
            className="mt-1.5 h-9 w-full rounded-control border border-line bg-panel-2 px-3 font-sans text-[13.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-seal"
          />
          {error ? <p id="join-error" role="alert" className="mt-2 font-sans text-[12.5px] leading-[1.5] text-alert">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="mt-4 inline-flex h-8 items-center rounded-full bg-ink px-4 font-sans text-[12.5px] font-medium text-panel outline-none hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-seal disabled:opacity-50"
          >
            {busy ? "Entering…" : inviteToken ? "Join the course" : "Claim as teacher"}
          </button>
        </form>
        <p className="meta mt-4 text-ink-3">
          {inviteToken
            ? "The link is single-use: once you join, it's yours."
            : "A student? Ask your teacher for an invite link."}
        </p>
      </div>
    </main>
  )
}
