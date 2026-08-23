# Project Overview

Maintained from repository evidence. Source of truth for rules: `AGENTS.md` (imported by `CLAUDE.md`).

## Purpose

- **Ada** is a course community where humans and AI agents share channels and course knowledge compiles itself into **cards** (markdown documents with a type, a version, sources and "replaces"). See `AGENTS.md` "What this repo is" and `PRODUCT.md` "Product Purpose".
- Users: a **teacher** (seed: Martin) who creates channels/agents and publishes material, and **students** (seed: Sofia, Ignacio) who ask, open threads and submit. Secondary audience: hackathon judges watching a guided demo (`PRODUCT.md` "Users").
- Aleph Hackathon 2026, General Track. Code cutoff: Sunday 2026-08-23 04:00 (`AGENTS.md`).

## Boundaries

- Current scope (`DECISIONS.md` §15): a custom deployment for **one teacher, fully local** on their machine. Remote runners, hosting, tiers and multi-course are future direction, not code.
- Explicitly out of scope this weekend (`AGENTS.md` "Decisions and open questions"): permissions, submission grading, collaborative editing, vector/global search, multi-course, mobile, notifications, work channels beyond the design, gamification, per-student algorithmic personalization (`PROBLEM.md` §9).
- Open questions not to be resolved unilaterally: the "already on file" seal semantics, the plural `fromFile` API, the example agent's name ("Ada" vs the product name).
- Language: everything (UI, content, comments, docs, names) in **English**.

## Evidence

- Manifests: `package.json` (npm workspaces `apps/*`, `packages/*`), `apps/web/package.json`, `apps/server/package.json`, `packages/protocol/package.json`, `packages/runner/package.json`.
- Documents of truth, in order: `PROBLEM.md` → `DECISIONS.md` → `PRODUCT.md` → `DESIGN.md` → `research/` → `openspec/` (active change `openspec/changes/demo-local-backend/`) → `docs/*.html` (future inspiration) → `design/` (history).
- Entry points: `apps/web/src/App.tsx` (SPA), `apps/server/src/index.ts` (local API + WS), `packages/runner/src/cli.ts` (agent runner), `data/neural-networks-2026/community.json` (seed).
- Per-area rules: every area has its own `AGENTS.md` (`apps/web/`, `apps/server/`, `packages/runner/`, `data/`, `docs/`).
