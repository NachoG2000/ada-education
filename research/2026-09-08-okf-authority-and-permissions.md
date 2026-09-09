# OKF, contributor authority and memory permissions

Date: 2026-09-08. Research and proposals; no implementation changes.
Confirmed user framing is captured separately in `DECISIONS.md` §31.

## Sources read

### User-pasted essay: Where Does the Permission Live?

Original file:
`/Users/ignaciogarcia/.codex/attachments/878d9f93-b855-4132-87ab-1c32d01b3c7a/pasted-text.txt`.
Read in full. The author identifies as Sentra's CEO; identity and public
publication date were not independently verified. The text is a vendor account,
not independent evidence of Sentra/Engram performance or security guarantees.
No benchmark figures were adopted as verified findings.

The proposed architecture retains addressable facts with evidence, effective
time and access rules outside model weights. It authorizes before retrieval,
then constructs a temporary question-specific view. Derived facts require access
to all supporting sources, with additional policy constraints. Permission
uncertainty excludes data. Corrections supersede earlier records; historical
views are distinct from current state. The author distinguishes resolvable
citations from demonstrated evidential support and proposes a changing-corpus
benchmark covering permissions, corrections, deletion and model replacement.

Relevant cautions for Ada: an append-only correction is not deletion; destroying
a key cannot establish removal of plaintext copies or other derivatives by
itself. Provenance locates evidence but does not guarantee correct interpretation.
An extracted fact's local validity does not eliminate dependencies among composed
explanations. We should not infer that an external memory store automatically
prevents every leak or that skills learned from private examples are always safe.

### Google Cloud OKF announcement and canonical specification

Verified directly in original web sources on 2026-09-08:

- https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing
  Published June 12, 2026; introduces v0.1 as portable Markdown/YAML knowledge
  bundles, with concepts and links rather than a required service/runtime.
- https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf
  The old repository explicitly redirects users to the canonical repository and
  labels its own copy a frozen snapshot.
- https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
  Current inspected specification identifies itself as v0.2. It represents
  concepts as Markdown documents with YAML frontmatter and ordinary links;
  concept IDs are relative paths without `.md`. It includes provenance, trust,
  lifecycle and attestation families. `type` is the only always-required field.
  Storage and serving infrastructure are non-goals. Ada-specific authorization
  cannot be inferred from mere format conformance.

## Proposed synthesis for Ada

Use the existing server to own authorization, current roles, provenance and
operational transitions. Consider OKF as the portable knowledge representation
or a generated view; do not create two independently writable canonical stores.
The runtime receives only the authorized subset needed for its task, including
filtered indices, links and source labels. A complete protected corpus in one
agent workspace plus a prompt saying not to disclose it is inadequate.
This is a future change from the current per-agent workspace, not a guarantee
of today's implementation. Existing teacher-readable DMs remain unchanged.

Distinguish three independent questions:
- Authority: who is qualified/authorized to establish this particular claim?
- Audience: who may read the source and resulting knowledge?
- Mutation/action rights: who may confirm, revise, publish or act on it?

Teacher role should carry greater course authority without becoming a universal
truth score. An authorized teacher can change an assignment deadline; a student's
report of their own confusion is first-person evidence; a technical explanation
still requires support even when teacher-authored. Student-provided examples can
be correct and useful before formal review. Agent-generated statements are not
human confirmation. Record authenticated contributor ID and role at the event,
separately from current authorization at query time. Text claiming a teacher
said something does not inherit that teacher's role.

Suggested ingestion order: authenticate actor and course role; preserve source
reference; split coherent claims/examples/events; attach subject, audience and
validity; compare against existing state; propose/update/ignore; validate under
a type-specific authority rule; publish within the authorized audience.

## Composable example

Keep raw recursion notes versioned. Link a recursion concept to base case,
termination and multiple examples. A step-by-step variant that emphasizes why
factorial(0) returns 1 can supplement an existing example without replacing it.
A corrected erroneous example supersedes its old version. A report that students
struggled can motivate a proposal, but does not establish that the new version
is effective or justify storing a permanent student diagnosis.

Each independently permissioned unit should have a uniform audience. Public
concepts must not embed private learner observations, their identifying sources,
or private navigation labels. A claim dependent on both a public source and a
restricted source defaults to their audience intersection, constrained by current
policy. Publication to a wider audience requires an explicit reviewed derivative
with an appropriate disclosure policy or independent shareable evidence; removing
names is not sufficient. If a public fact has independent public support, model
that support explicitly rather than unnecessarily binding it to private evidence.

No notification/proactive-action authorization follows from storing a commitment.
No retention/erasure policy or full ACL matrix was selected in this exploration.

## Next design artifact suggested

A small matrix for concept, example, course decision, event, open question and
personal observation: who can propose, who can confirm, who can see it, how it
expires/corrects, and what its minimum evidence is. Validate on the recursion
example and one deadline change before selecting implementation details.
