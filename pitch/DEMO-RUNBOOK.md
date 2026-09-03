# Demo runbook — screen recording (fills 1:28–2:50 of SCRIPT.md)

One uncut screen recording of the real app with the scripted runtime; the edit trims dead air. Rehearse once end-to-end before recording: the whole flow takes ~2 minutes live and cuts to ~80 s.

## 0. Reset (run before every take)

```bash
pkill -f "tsx.*apps/server/src/index.ts"; pkill -f "runner/src/cli.ts"; pkill -f vite
git -C data/neural-networks-2026/agents/ada status >/dev/null 2>&1 || true
rm -rf apps/server/data/ada.db data/neural-networks-2026/agents/ada/.ada
git checkout -- data/ 2>/dev/null; git clean -fd data/neural-networks-2026/agents/ada/wiki data/neural-networks-2026/raw 2>/dev/null
npm run seed && npm run dev        # scripted runtime by default
```

Then in the browser: `http://localhost:5173`, open DevTools console once to check it's silent, close DevTools, and clear the identity if needed (`localStorage.removeItem("ada:me")` or use "Switch person").

Keep a material file ready on the Desktop: `attention.md` with three `##` sections (any markdown with headings works; the runner writes one card per heading).

## 1. Recording setup

- 1920×1080 display (or a 16:9 window), 100% browser zoom, bookmarks bar hidden, notifications off (macOS Focus).
- QuickTime (File → New Screen Recording) or OBS at 30 fps; record the full screen, crop in the edit.
- Mouse slow and deliberate; pause 1 s after every state change so the edit can breathe.

## 2. Shot list (what to do, what the viewer must see)

| # | ~s | Do | Must be visible |
|---|---|---|---|
| 1 | 8 | Picker → **Martin** → sidebar **Modules** → select **04 · Attention** (empty) | "no material yet", Ada online in the corner |
| 2 | 12 | Drag `attention.md` onto the drop zone | material listed at once → "Ada is compiling cards…" pill → **3 cards appear, newest in yellow** → status ready + "Ada suggests Core —" with the rationale and cohort evidence |
| 3 | 8 | Click `#04-attention` in the header | the channel shows the published cards and Ada's answer citing them |
| 4 | 8 | Footer → **Switch person** → **Sofia** | lands on **My study**: feedback 6/10, strengths, "Where it slipped · 03-backprop", next steps with citation pills |
| 5 | 14 | Click the chip **"How do I get ahead in 03-backprop?"** → **Enter** | her message → "Ada is thinking…" → the plan: gap named, numbered steps, ≥2 citation pills, closing line "I shared a summary of this plan with Martin" |
| 6 | 6 | Click one citation pill | the card opens in the context panel (Literata document) |
| 7 | 14 | Switch person → **Martin** → Modules → **03 · Backpropagation** → Reports | "Ada · about Sofia · New": what I told Sofia + 3 recommendations. Check 2, type the note "Scalar example first; name σ′(z) on the card." → **Apply to module** | pill flips to **Reconciled**; the yellow **decision card** appears in the module's Cards row |
| 8 | 6 | Click `#teachers` in the sidebar | Ada's note to Martin citing the plan card |
| 9 | 8 | Terminal (big font): `ls data/neural-networks-2026/agents/ada/wiki/modules/04-attention/` then `head -12 data/neural-networks-2026/agents/ada/wiki/questions/plan-sofia-03-backprop.md` | the demo's thesis: it's all markdown files the group owns |

Call-outs for the edit (SCRIPT.md): the citations, the sharing line, the decision card, the files.

## 3. If something goes sideways

- Ada shows **away** on the Modules page → the runner isn't connected; check the `runner` pane of `npm run dev`.
- A mention got no answer → mentions are dropped when the runner is down; re-send after the runner reconnects.
- Wrong state mid-take → stop, run §0 again (a fresh seed takes ~5 s), retake.

## 4. Finishing checklist (after the take)

1. `git add -A && git commit` the feature (one commit; the working tree holds the whole teacher/student flow).
2. Export the deck: open `pitch/index.html` → `Cmd+P` → PDF.
3. Edit to 82 s, drop into the video per SCRIPT.md's table, record the S1–S7 narration, submit per `research/2026-08-22-aleph-submission-and-pitch.md`.
