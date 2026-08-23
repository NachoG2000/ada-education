## Purpose

The repository's documents of truth position Ada as an open-source
course-community product for organizations that run cohort-based courses. The
hackathon era is preserved as history, never presented as the current goal,
and no specific target organization is named anywhere.

## ADDED Requirements

### Requirement: The documents of truth state the open-source product direction

`DECISIONS.md` carries a dated decision (§19, 08/23) closing the Aleph 2026
hackathon phase and setting the direction: an open-source product (Apache-2.0,
reaffirming §4) for organizations that run cohort-based courses. It supersedes
§15 as current scope and extends §16 from pitch positioning to product
direction. `README.md` leads with the product, the audience, the license and
how to run it; `AGENTS.md` points agents at §19 as the current scope;
`PRODUCT.md` names the same audience.

#### Scenario: An agent reads the current scope

- GIVEN a fresh agent session that reads `AGENTS.md` and `DECISIONS.md`
- WHEN it looks for the current scope before touching architecture
- THEN it finds §19 (open-source product for course-running organizations) as current, sees §15 annotated as superseded, and does not treat the hackathon demo as the goal.

#### Scenario: A newcomer opens the README

- GIVEN someone landing on the repository for the first time
- WHEN they read `README.md`
- THEN they learn what Ada is, that it is open source under Apache-2.0, who it is for, and how to run it locally — with no hackathon framing anywhere in the file.

### Requirement: Target organizations are described only generically

The audience is described in generic terms — organizations that run
cohort-based courses: bootcamps, academies, corporate training programs,
universities. No document, spec, or code in the repository names a specific
target organization.

#### Scenario: Searching for a named target

- GIVEN the full repository
- WHEN searching for the name of any specific organization discussed as a potential target
- THEN there are no matches; only the generic audience terms appear in `README.md`, `PRODUCT.md`, and `DECISIONS.md` §19.

### Requirement: Hackathon material is history, not direction

`pitch/` states it is the Aleph 2026 pitch kept as history; `slide1.png` lives
under `pitch/`, not at the repository root; superseded DECISIONS sections and
the demo evidence remain in the repository, marked as history.

#### Scenario: Judging what the pitch folder means

- GIVEN a contributor browsing `pitch/`
- WHEN they read `pitch/AGENTS.md`
- THEN it says the material is the Aleph 2026 hackathon pitch preserved as history and that the current direction lives in `DECISIONS.md` §19.
