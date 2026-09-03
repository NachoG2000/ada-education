# How Buzz solves identity and agent execution (for Ada's Railway template)

Date: 2026-08-23. Context: designing Ada's Railway one-click template
(`research/2026-08-23-railway-deploy-template.md`), Ignacio asked how Buzz
handles the two open questions — person identity on a public relay, and where
agents run. Verified against github.com/block/buzz raw sources (README,
ARCHITECTURE.md, `crates/buzz-relay/src/config.rs`, `buzz-admin`,
`buzz-acp/README.md`, `.env.example` files) and the live template page
`railway.com/deploy/buzz--buzz-1`; claims below are read-in-original unless
marked snippet.

## Identity: client-held keys + a relay-side membership table

- Every participant, human or agent, **is a Nostr keypair** (secp256k1). No
  server-side accounts. Auth is NIP-42: sign a challenge with your key.
- The Railway template prompts **exactly one variable**:
  `RELAY_OWNER_PUBKEY` (64-char hex). On first startup that pubkey is
  auto-bootstrapped into a `relay_members` Postgres table with role `owner`
  (roles: Owner/Admin/Member/Guest/Bot). The owner can't be removed by
  command — only by changing the env var and restarting.
- **Private mode is opt-in and off by default**: the Railway template ships
  `BUZZ_REQUIRE_RELAY_MEMBERSHIP=false`, so any valid keypair can join a
  freshly deployed relay. Closing it means flipping that flag and adding each
  member via `buzz-admin add-member --pubkey <hex>`. There is no invite-link
  flow; the production compose example turns membership + auth tokens on.
- Agents authenticate exactly like people, with **their own keypair**, and get
  their own memberships and audit trail. `BUZZ_ALLOW_NIP_OA_AUTH` lets an
  agent in by proving its *owner* is a member (owner attestation).

## Agents: always client-side; the relay never runs models

- `buzz-acp` is a harness the operator runs **on their own machine/container**:
  it WebSockets into the relay with the agent's key, spawns the runtime
  (Goose, `claude-agent-acp`, `codex-acp`, or any ACP-speaking tool) as a
  subprocess over stdio, and relays @mentions. The AI provider credential
  (`ANTHROPIC_API_KEY` etc.) lives as an env var on that machine — the relay
  never sees it. No hosted-agent option exists in the OSS project (only
  Block's internal build is "pre-wired" to an internal provider; undocumented).
- The Railway template deploys **relay only** + infra (Postgres for events,
  membership and full-text search; Redis for pub/sub, presence, typing; MinIO
  for media via Blossom and NIP-34 git storage). No agent service included.

## First-run friction (Buzz's, for comparison)

Generate a Nostr keypair *before* deploying (nostrtool.com or
`buzz-admin generate-key`) → deploy pasting the hex pubkey → install Buzz
Desktop → point it at `wss://<app>.up.railway.app` → sign in with the keypair
→ for an agent: mint a second keypair, add it as member (if membership is on),
run `buzz-acp` locally with the agent's key + relay URL + provider key.

## What Ada should copy, and what it can beat

- **Copy the pattern, not the crypto**: client-held credential + relay-side
  membership table + owner bootstrapped from a deploy-time variable +
  membership-gating as an explicit flag. Ada's equivalent with plain tokens
  (owner token, invite links minted by the teacher, per-agent runner token —
  the invite-onboarding screen already exists in `PRODUCT.md`) fits course
  reality better: bootcamp students won't manage an `nsec`, and losing a
  Nostr key means losing the identity.
- **Copy the agent default** (`DECISIONS.md` §14 already says it): runner
  outside the deploy, credentials with the teacher; `packages/runner` already
  maps `https://` → `wss://` (`src/cli.ts:318`).
- **Beat Buzz on plug-and-play**, where its flow has friction Ada doesn't
  need: (1) no pre-deploy key generation — Railway's `secret()` can mint every
  Ada token at deploy time, zero prompted variables; (2) no desktop install —
  Ada's client is the SPA served by the same service; (3) optional runner
  service in the template where the org pastes its own `ANTHROPIC_API_KEY`
  (credential stays in *their* Railway project, satisfying the legal rule in
  `research/2026-08-22-subscriptions-runners-buzz-pi.md`) — a hosted-agent
  option Buzz simply doesn't offer.
