// Docs check (AC-8): the documentation that must land with the feature exists
// and says what the spec requires. Pure reads; exits 1 listing what's missing.
import { readFileSync } from "node:fs"

const checks = [
  ["DECISIONS.md", [/## 18\. Modules, study material, feedback and agent reports .*08\/23/, /scripted/, /transparent to the student/i, /intro · core · advanced/]],
  ["PRODUCT.md", [/Modules and the two role views/, /Report rule/, /reconcile/, /"My study" \(student view\)/]],
  ["AGENTS.md", [/scripted runtime by default/, /npm run smoke/, /#modules/]],
  ["apps/web/AGENTS.md", [/#modules/, /#home/]],
  ["apps/server/AGENTS.md", [/modules/, /reports/]],
  ["packages/runner/AGENTS.md", [/scripted/, /report\.create/]],
  ["data/AGENTS.md", [/modules/, /feedback/]],
]
const missing = []
for (const [file, patterns] of checks) {
  let body = ""
  try { body = readFileSync(file, "utf8") } catch { missing.push(`${file}: missing`); continue }
  for (const p of patterns) if (!p.test(body)) missing.push(`${file}: no match for ${p}`)
}
if (missing.length) { console.error(missing.join("\n")); process.exit(1) }
console.log(`Docs OK (${checks.length} files)`)
