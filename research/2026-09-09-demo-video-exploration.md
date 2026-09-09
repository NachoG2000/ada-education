# Demo video exploration

Date: 2026-09-09. Status: proposed directions for discussion, not an approved
script or an implementation request. The user asked to consolidate the completed
work on main and jointly plan an engaging demonstration video.

## Integration baseline

The working checkout was already on main, aligned with origin/main at 4b3eb0f;
the accumulated implementation had not yet been committed. The integration
includes the interface, educational artifacts, primary Ada, Pi runtime, governed
memory, authored seed fixtures and corresponding documentation. `npm run check`
passed again on 2026-09-09; documentation checks passed after aligning the
quickstart with Pi/Luna. Local databases, memory contents and account credentials
remain ignored. PDF fixtures are marked binary to preserve their byte offsets.

## Context and evidence

- User request in the project conversation, 2026-09-09: integrate the work into
  main and plan the demos together. Primary user input.
- `research/2026-09-05-application-demo-priorities.md`, User context: the last
  documented audience is a Puentes project application. This is a working
  assumption for this discussion, not a newly verified program requirement.
- `docs/memory-exploration.md`, Available cases: two authored synthetic courses
  provide questions, progress evidence, alternative examples, teacher review,
  time-sensitive events and audience boundaries. Primary local implementation.
- `docs/course-memory.md`, Verified implementation: the live teacher-private
  Pi/Luna answer followed Alex's trajectory with working citations; source
  uploads and revisions exercised the actual compilation pipeline. Recorded
  verification from 2026-09-08, not a new model evaluation today.

## Three candidate stories

| Direction | Concrete moment | What it makes visible | Tradeoff |
| --- | --- | --- | --- |
| Learning over time | A teacher asks what changed for Alex; Ada connects an earlier doubt, later explanation, and a new open question | Continuity, evidence, and honest inference | Requires a short setup of the learner's earlier state |
| Teaching knowledge improves | A clearer explanation becomes another reusable example alongside the original | Composable knowledge and original-source provenance | Promotion must respect the source audience; private DMs do not automatically become course knowledge |
| Course information changes | A teacher corrects a schedule or revises material; the next answer follows current evidence | Authority, revisions, and operational freshness | Easy to understand, but less distinctive as the central story |

Recommendation for discussion: lead with learning over time in **Thinking in
Code**, then briefly show the learner's perspective. The course already has the
required trajectory. **Data for Decisions** offers a less code-heavy alternative
if recursion distracts from the product story.

## Suggested visual sequence, not a script

1. Establish Alex's earlier question and the later explanation as two short,
   dated messages. Make the change visible before explaining the architecture.
2. Ask Ada privately as the teacher what changed and what remains open. The
   answer should distinguish observed statements from its interpretation.
3. Open one citation. Show the evidence, the connection to the resolved question,
   and the still-separate new question. This is the main reveal.
4. Optionally switch to Alex's perspective: contextual Ask Ada, course examples,
   and Alex's own learning view. Keep the private boundary truthful: teachers
   can inspect student trajectories and DMs; other learners cannot.

A 60–90 second cut is a suggested starting length, not a requirement. Show three
or four meaningful actions, use close framing on the changed evidence, and cut
model waiting time honestly. Keep original takes and demonstrate real outputs.
Additional screens, generated visual artifacts, animations, proactive reports,
or a memory graph would be new work, not existing capabilities to imply.

## Choices still open

- Teacher-led with a short learner moment, teacher-only, or learner-only.
- Final audience and length, including whether the earlier Puentes context holds.
- Programming versus data-analysis course; spoken language and captions.
- Which single outcome viewers should remember after the video.

An optional question about the perspective was presented during integration.
Until answered, teacher-led with a learner moment remains a recommendation,
not a selected direction. No recording, seed reset, new UI, or final script is
authorized by this planning note.
