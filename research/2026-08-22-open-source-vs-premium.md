# Broad open source vs. premium to top-tier schools — 2026-08-22

Research for the pitch positioning decision (`DECISIONS.md` §16). Verification: **✓ primary** · **~ snippet** · **≈ secondary**.

## Option A: sell expensive to elite private schools

- K-12 sales cycles in the US: 6–18 months, committees of 5-7 people, annual Jul–Jun budget ~ (data from public districts; **no specific data on elite private schools** — flag).
- Argentina: ~3M of 11M students in private education (INDEC 2021); elite schools (Lincoln ~US$33.4k/year, San Andrés, Northlands) exist as a market ~ (Bloomberg Línea).
- Alpha School / 2 Hour Learning: US$10k–75k/year ✓ — but it's a chain of its own schools, not a SaaS vendor: weak evidence for our path.
- **No evidence found** on whether a two-person team with no brand is credible in that channel; data-privacy requirements and institutional trust make it doubtful (inference, not data).

## Option B: broad open source, bottom-up, monetize hosting later

- **Moodle**: free since 2002; 500M+ registered users, 147k sites (2026); monetizes via MoodleCloud + a network of certified partners; on the 2026 GSV 150 (which requires tens of millions in revenue) ~. **The precedent with the exact sequence we're planning** (§4, open-core): free → hosting/partners → institutional revenue.
- **WordPress/Automattic**: GPL 2003 → WordPress.com 2005 → VIP enterprise 2012 → $7.5B valuation ≈. The clearest dev-tools analog of "open first, enterprise later."
- **GitLab**: $81M (FY20) → $955M (FY26), >$1B ARR ~. **Supabase**: $30M ARR (2024) → ~$170M (2026 est.) ≈ — with slow free-to-paid conversion: the massive free tier precedes the money by years. **Ghost**: nonprofit, ~$7.5M/year self-sustaining through hosting ~ — the "stay small and open" model also exists.
- Counterexamples that demand caution: **Sakai** (community with no commercial engine → decline) ~; **Cal.com shut down in May 2026** ~ (open-core is not a guaranteed end state); **Open edX**: flat adoption, struggles to convert universities ~.
- Bottom-up teacher adoption: **Kahoot** demonstrates the risk of the other extreme — massive free usage (9B+ quizzes) and "poisoned" monetization: teachers don't pay ~. The lesson: the payer isn't the teacher, it's the institution that wants hosting/support (the Moodle model), not the enamored user.

## Hackathon context

- Aleph (Crecimiento, BA, 08/20–23/2026): criteria listed on DoraHacks: **Technicality, Originality, UI/UX/DX** ~ (not verified against an official source). Nothing about business model.
- General hackathon research: winning awards doesn't predict survival to 5 months; team skill diversity and a named owner after the event do ≈.

## Reading

1. The evidence for B is abundant and positive; for A it's scarce and mostly against (long cycles, committees, credibility of a small team with no brand).
2. No open source LMS monetized by selling expensive, one by one, to elite schools; all of them did it through hosting + partners.
3. A and B aren't mutually exclusive but **sequential**, and the sequence has a name: Moodle (and WordPress). That's already what `DECISIONS.md` §4 says ("the hackathon demonstrates (a) local; the product sells (c) hosted").
4. For the Aleph jury, narrative B (open source, technical demo, originality of "agents as members + memory in files") points straight at the three listed criteria.
5. The elite school doesn't disappear: it's an **early customer of the future hosted tier** (paying for managed agents, backups, analytics), not today's pitch.
