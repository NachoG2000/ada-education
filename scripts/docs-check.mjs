// Docs check: documentation that must land with features exists and says what
// the specs require. Entries are [file, patterns]; a pattern is a RegExp that
// must match, or {not: RegExp} that must not. Pure reads; exits 1 listing misses.
import { readFileSync, existsSync } from "node:fs"

const checks = [
  ["DECISIONS.md", [/## 18\. Modules, study material, feedback and agent reports .*08\/23/, /scripted/, /transparent to the student/i, /intro · core · advanced/]],
  ["PRODUCT.md", [/Modules and the two role views/, /Report rule/, /reconcile/, /"My study" \(student view\)/]],
  ["AGENTS.md", [/scripted runtime by default/, /npm run smoke/, /#modules/]],
  ["apps/web/AGENTS.md", [/#modules/, /#home/]],
  ["apps/server/AGENTS.md", [/modules/, /reports/]],
  ["packages/runner/AGENTS.md", [/scripted/, /report\.create/]],
  ["data/AGENTS.md", [/modules/, /feedback/]],
  // Positioning (refocus-open-source-product): open-source product for
  // course-running organizations; the hackathon is history.
  ["DECISIONS.md", [/## 19\. Product focus: open source for course-running organizations \(08\/23\)/, /Apache-2.0/, /superseded by §19/]],
  ["README.md", [/Apache-2.0/, /cohort-based/, { not: /hackathon|aleph|weekend/i }]],
  ["AGENTS.md", [/DECISIONS\.md.*§19/, /Out of scope for now/]],
  ["PRODUCT.md", [/cohort-based/]],
  ["pitch/AGENTS.md", [/kept as history/, /§19/]],
  ["PROBLEM.md", [/What the 08\/23 demo proved/]],
]
// The hackathon cover slide lives with the pitch history, not at the root.
const mustExist = ["pitch/slide1.png"]
const mustNotExist = ["slide1.png"]
const missing = []
for (const f of mustExist) if (!existsSync(f)) missing.push(`${f}: missing`)
for (const f of mustNotExist) if (existsSync(f)) missing.push(`${f}: must not exist`)
for (const [file, patterns] of checks) {
  let body = ""
  try { body = readFileSync(file, "utf8") } catch { missing.push(`${file}: missing`); continue }
  for (const p of patterns) {
    if (p instanceof RegExp) { if (!p.test(body)) missing.push(`${file}: no match for ${p}`) }
    else if (p.not.test(body)) missing.push(`${file}: must not match ${p.not}`)
  }
}
if (missing.length) { console.error(missing.join("\n")); process.exit(1) }
console.log(`Docs OK (${checks.length} files)`)
