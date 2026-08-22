/* "Who are you?" — connected mode's local identity (web-client spec → Local identity).
   A floating panel over the ground, before the layout: you pick your person in
   the course and it's stored in localStorage["ada:me"]. No sign-up, no password:
   it's a local machine. People only; agents don't write from this client. */

import type { Person } from "@/lib/types"
import { PersonAvatar } from "./identity"

export function WhoAreYou({
  course,
  people,
  onChoose,
}: {
  course: string
  people: Person[]
  onChoose: (p: Person) => void
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ground p-6">
      <section aria-labelledby="who-are-you-title" className="w-full max-w-sm rounded-panel bg-panel px-7 pt-7 pb-5 shadow-pop">
        <p className="label text-ink-3">{course}</p>
        <h1 id="who-are-you-title" className="mt-2 font-sans text-[19px] font-semibold tracking-[-0.012em] text-ink">
          Who are you?
        </h1>
        <p className="mt-1.5 font-sans text-[13px] leading-[1.5] text-ink-2">
          Pick your name to enter the course. It's stored on this machine, no password.
        </p>

        {people.length === 0 ? (
          <p className="mt-6 mb-3 font-serif text-[14px] text-ink-3 italic">
            The course doesn't have any people yet. Run <code className="font-mono not-italic">npm run seed</code> in the server.
          </p>
        ) : (
          <ul className="mt-5 mb-1 flex flex-col gap-1">
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChoose(p)}
                  className="flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left outline-none transition-colors hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-seal"
                >
                  <PersonAvatar person={p} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[14.5px] font-semibold text-ink">{p.name}</span>
                    {p.role && <span className="meta block text-ink-3">{p.role === "teacher" ? "teacher" : "student"}</span>}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-ink-4"
                    aria-hidden
                  >
                    <path d="M6 3.5L10.5 8L6 12.5" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
