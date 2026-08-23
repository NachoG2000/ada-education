# Decisions: Teacher modules, student progress and agent reports

Record concise, externally reviewable evidence and choices here.

## D-001: Mock the agent as a runner runtime, not a UI mock

Status: Accepted

### Evidence

- The runner's only runtime-specific code is `runClaude(prompt)` in `packages/runner/src/cli.ts`; wiki diff → `card.publish`, `[[path]]` → cite, "from the file" and the per-run commit are runtime-agnostic.
- The server has no scripted or fake runner; a mention with no connected runner is dropped silently (`apps/server/src/ws.ts`).
- The user's brief: "simulate it works through an Enter … the agent really responds and doesn't feel so hardcoded".

### Options

1. Client-side scripted replies inside the SPA (fast, but nothing persists, the server is bypassed, and the UI would need a "demo" branch everywhere).
2. A server-side fake that answers mentions inline (persists, but duplicates the runner's card pipeline and can't be swapped for the real runtime).
3. A `scripted` runtime inside `ada-runner` that speaks the real `/ws/runner` protocol and fills templates with live state from `GET /api/community`.

### Chosen approach

Option 3. `ada-runner --runtime scripted`: same protocol, same presence, same wiki → card pipeline, templates filled with module titles, material headings, the student's feedback gaps and the difficulty level, with a 1.2–2.5 s thinking delay. `npm run dev` starts it by default; `ADA_RUNTIME=claude` restores the real runtime.

### Trade-offs and risks

- Answers are templated: a question outside the templates gets an honest "here's what I checked" answer rather than a fabricated one.
- Requires the runner process to be up for the demo; the Modules page shows Ada's presence so an operator sees when it isn't.

### Verification

- AC-5, AC-UI-2, AC-UI-4: runner log shows `runtime scripted`; cards are published through `card.publish`; the plan message persists after reload.

## D-002: Per-student report, transparent to the student

Status: Accepted

### Evidence

- `docs/usecases-api.html` UC8 and `PROBLEM.md` §7.5/§9 keep teacher-facing difficulty signals aggregate ("not surveillance").
- The user's brief asks explicitly that the teacher knows what the agent told the student and reconciles it into the subject.
- `DECISIONS.md` §6: "whoever creates the agent sees what the agent writes" — Martin created Ada.

### Options

1. Keep reports aggregate and anonymous (contradicts the brief: the teacher cannot reconcile a specific plan).
2. Send the teacher the private conversation transcript (surveillance; against `PROBLEM.md` §9).
3. Ada files a report with its own summary of what it advised and a recommendation for the module, and the student's plan message states that a summary was shared with the teacher.

### Chosen approach

Option 3. The report is Ada's writing (which the creator of the agent may see, §6), not the student's words; the student sees the sharing line on her own screen; the teacher's reconciliation lands as a `decision` card in the module channel, visible to everyone. Recorded as `DECISIONS.md` §18 with today's date.

### Trade-offs and risks

- A student may still feel watched; the mitigation is the visible sharing line and the absence of transcripts. Revisit if private channels get a "don't share" setting (out of scope).

### Verification

- AC-UI-4 (sharing line present), AC-UI-5 (report shows Ada's summary and recommendations, not Sofia's messages).

## D-003: Views live in the hash inside the existing shell

Status: Accepted

### Evidence

- `apps/web/src/App.tsx` routes by `location.hash` (`#figures` only); `screens/Channel.tsx` is the shell (sidebar + resizable channel/context panels); the context panel stack is reused for cards.
- `Person.role` exists in `packages/protocol/src/types.ts` and the seed; nothing gates on it yet.

### Options

1. New top-level screens with their own sidebar (duplicated shell, inconsistent).
2. Put the pages in the context panel (it is 416 px wide and capped at two panels: too small for a material page).
3. Add `#modules` / `#home` as views of the shell: the channel panel area renders the page, the context panel keeps opening cards.

### Chosen approach

Option 3. The sidebar gets a role-aware entry ("Modules" for the teacher, "My study" for the student) and "Switch person" in the footer; choosing a channel clears the hash. Role mismatches redirect.

### Trade-offs and risks

- The channel-resizable layout key stays; the pages share the channel panel's minimum width (420 px).

### Verification

- AC-6, AC-UI-1, AC-UI-3.
