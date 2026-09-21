# RUBRIC — risk rating and test-depth allocation

> **This document is written by the author, not by the harness.**
>
> Brief §1.1 reserves the risk rubric as one of four artifacts the author must write himself.
> Attest supplied the facts — they are in `evidence/runs/<run-id>/risk-inputs.md`, one dossier
> per resource, read out of the database. It did not supply a single score, weight, threshold
> or tier, and it will not.
>
> The reason is not ceremony. A tier that came out of a tool is a tier nobody can defend when
> somebody disagrees with it, and the whole value of this exercise is being able to say *why*
> the wallet is tested harder than the cosmetic preferences table.
>
> Everything marked `?` or `_____` is yours to fill in.

**Status: NOT YET AUTHORED.** `npm run attest rubric` will refuse to compute tiers until the
tables below are complete, and will name exactly what is missing.

---

## How to read this

The rubric has three moving parts and they are separable:

1. **Dimensions** — the questions you ask about each resource. The brief fixes which five you
   must ask. You decide what the possible answers are and what each one is worth.
2. **Combination** — how five answers become one tier. You decide the weights, the arithmetic,
   and where the boundaries between High, Medium and Low fall.
3. **Allocation** — what testing each tier earns. The brief supplies the shape of this from
   FDA's Computer Software Assurance model; you decide whether it is right for this system and
   write down why.

Do all three before scoring anything. Scoring first and then setting thresholds to produce a
tier distribution you like is the failure mode the brief names explicitly, and if you catch
yourself doing it, it goes in `DECISIONS.md` as exactly that.

---

# Part 1 — The five dimensions

The brief requires the rubric to score **at least** these five. You may add more; nothing here
proposes any, because choosing dimensions is part of what you are defending.

For each one: what it asks, what facts Attest measured, and what is left for you.

---

## Dimension 1 — What the data is

**The question.** If this resource leaked or was corrupted, what kind of thing would have
leaked or been corrupted?

This is the dimension that stops the rubric from being purely structural. Two tables can have
identical policies, identical grants and identical foreign keys and still not be the same
proposition — a table of equipped cosmetics and a table of chip balances differ in what they
*are*, not in how they are wired.

**What Attest measured.** For every resource: every column with its type, whether the column is
server-generated, Arc21's own `COMMENT` on the table and on each column, and which client roles
hold a privilege on each individual column.

**What you decide.** The categories, and what each is worth. Some questions worth having an
answer to before you write them down:

- Is a category for "identifies a real person" distinct from "is about a person"? A push token
  and a display name are both personal and are not the same exposure.
- Where does server-authoritative game state sit — is `private.game_state_private` sensitive
  because it is secret, or because knowing it lets you cheat? Those are different reasons and
  might deserve different weights.
- Is a public catalogue (`cosmetics`, `rulesets`) genuinely the lowest category, or does
  *integrity* of a catalogue matter more than its confidentiality?

| Level | What qualifies | Score |
|---|---|---|
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |

**Why this dimension is in the rubric** *(your words — you will be asked to restate this)*:

_____

---

## Dimension 2 — Blast radius if the control fails

**The question.** If this control fails, how far does the damage reach: one user, all users, or
shared state?

Those three are the brief's own words, so the levels are given. What is not given is what they
are worth relative to each other, or which resource belongs in which.

**What Attest measured.**

- **Which column says whose row this is.** Computed from foreign keys, transitively: almost
  nothing in Arc21 points at `auth.users` directly, but `public.profiles.id` is a foreign key
  to `auth.users` *and* is `profiles`' own primary key, so `profiles` is an identity relation
  and the thirty-odd tables carrying `user_id → profiles.id` are naming a person too. 28 of 40
  resources have an owner column; 12 do not.
- **How many relations depend on this one.** `public.profiles` is depended on by 24. Most
  resources are depended on by none.
- **Which SECURITY DEFINER functions name it** — the server-side paths that reach a resource
  regardless of the caller's policies.

**What you decide.** Which resource is which, and what each level scores. The hard cases are
the ones where the structure does not settle it:

- A table with an owner column is *usually* one-user blast radius. `public.game_session_seats`
  has one, and a seat is part of a shared table other players are sitting at. Which is it?
- `public.profiles` is depended on by 24 relations and is also per-user. Is it "one user"
  because each row is one person's, or "shared state" because everything joins to it?
- `public.rulesets` has no owner and 6 dependants, and is a read-only catalogue. Is a
  catalogue "all users" or is it its own thing?

| Level *(from the brief)* | What qualifies | Score |
|---|---|---|
| one user | _____ | `_` |
| all users | _____ | `_` |
| shared state | _____ | `_` |

**Why this dimension is in the rubric** *(your words)*:

_____

---

## Dimension 3 — Integrity impact

**The question.** Does a failure here corrupt state that others depend on?

Distinct from blast radius, and the difference is worth being precise about. Blast radius asks
*how many people* are affected. Integrity asks whether the damage is **confined to the row that
was written**. A leak of someone's push token is a confidentiality failure with no integrity
consequence at all. A bad write to `wallet_ledger` is the reverse: nobody else's data was read,
and the balance no longer reconciles.

**What Attest measured.**

- Inbound foreign keys and, specifically, which of them are `ON DELETE CASCADE` — where one
  removed row silently removes rows elsewhere.
- Which triggers on the resource can refuse a write (39 across 32 tables), and which look like
  append-only or truncate guards.
- Which server functions write it.

**What you decide.** The levels and the scores. Worth deciding deliberately:

- Does "corrupts state others depend on" mean *other tables*, or *other users*? `player_stats`
  is depended on by nothing and is still the input to a leaderboard.
- Arc21's invariant is that balance and ledger must reconcile. Does a resource participating in
  that invariant get its own level?

| Level | What qualifies | Score |
|---|---|---|
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |

**Why this dimension is in the rubric** *(your words)*:

_____

---

## Dimension 4 — Reversibility

**The question.** If this went wrong, could it be put back?

The dimension most often skipped, and the one that separates "bad" from "unrecoverable". A
leaked secret cannot be un-leaked. A corrupted balance can be recomputed **if** an append-only
ledger survived the corruption — which is exactly why Arc21 has one.

**What Attest measured.** Which triggers enforce append-only behaviour, which refuse
`TRUNCATE` (row-level security does not apply to `TRUNCATE` at all, so a trigger is the only
thing that can refuse it), and which server functions write each resource.

**What Attest cannot measure, and you should not let it pretend to.** Whether a backup exists,
whether anyone would notice, how long detection would take, and whether the recomputation is
actually possible in practice. Those are properties of an operating environment Arc21 does not
have. If you score this dimension partly on facts that are not in the database, say so here, or
the score will look more evidenced than it is.

| Level | What qualifies | Score |
|---|---|---|
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |
| `_____` | _____ | `_` |

**Why this dimension is in the rubric** *(your words)*:

_____

---

## Dimension 5 — Exposure

**The question.** Who can reach this at all: anonymous callers, any signed-in account, or only
the server?

**This is the one dimension where Attest has already done the classification**, because it is
decided by the catalogs rather than by opinion. The classification uses the grant surface and
the policy set **together**, because either one alone gives the wrong answer.

Measured, across all 40 resources:

| Class | Count | Meaning |
|---|---:|---|
| anonymous | 4 | a signed-out caller holds a grant **and** a policy names `anon` or `PUBLIC` |
| anonymous (latent) | 1 | a signed-out caller holds a grant, and **no** policy admits them |
| authenticated | 29 | reachable by any signed-in account |
| server-only | 6 | no client-presentable role reaches it at all |

**A decision you have to make, and it is not cosmetic.** The brief names three levels:
anonymous, authenticated, server-side. Attest found **four** classes, because
`realtime.messages` does not fit any of the three: `anon` holds `INSERT`, `SELECT` and `UPDATE`
on it, and all three of Arc21's policies on it name `authenticated`. So it is granted to
anonymous callers and refused to them. It is denied today, by row-level security alone, and the
grant becomes live the moment a permissive policy naming `anon` is added or RLS is switched off
on that table.

You must decide whether that is:

- its own level, scoring between anonymous and authenticated; or
- folded into `anonymous` — treating a latent grant as exposure, on the grounds that only one
  policy change stands between it and reality; or
- folded into `authenticated` — treating today's effective reachability as the thing that
  matters.

Whichever you choose, it goes in `DECISIONS.md`, because it is exactly the kind of call
somebody will want to argue with.

| Level | What qualifies | Score |
|---|---|---|
| anonymous | _____ | `_` |
| anonymous (latent) | _____ | `_` |
| authenticated | _____ | `_` |
| server-only | _____ | `_` |

**Why this dimension is in the rubric** *(your words)*:

_____

---

# Part 2 — How five answers become one tier

## 2.1 Weights

Do the dimensions count equally? If not, which dominates, and why?

The question that decides this: **when two dimensions disagree, which one wins?** A resource
that is server-only but holds state whose corruption would be unrecoverable — is that High or
Low? Your weights are the answer to that, whether or not you write them down deliberately.

| Dimension | Weight |
|---|---:|
| What the data is | `_` |
| Blast radius | `_` |
| Integrity impact | `_` |
| Reversibility | `_` |
| Exposure | `_` |

## 2.2 Aggregation

How do weighted scores combine into one number?

- `weighted_sum` — every dimension contributes; a low score anywhere pulls the total down.
- `max` — the worst dimension decides; a resource is as risky as its worst property.
- `weighted_sum_with_floor` — weighted sum, but any resource scoring the top level on a named
  dimension is floored at a given tier regardless of its total.

The third exists because of a real case: a purely additive rubric will rate a server-only
resource low no matter how catastrophic its corruption would be, simply because one dimension
scores nothing. If you think that is wrong, a floor is how you say so.

**Chosen rule:** `_____`

**Why:** _____

## 2.3 Tier thresholds

| Tier | Condition |
|---|---|
| High | `_____` |
| Medium | `_____` |
| Low | `_____` |

**Set these before you score anything.** Setting them afterwards, once you can see which
resources land where, is rubric-tuning, and the brief calls it out by name: *"Do not tune the
rubric after seeing results. If you find yourself adjusting a tier because it makes the
findings look better or the work smaller, stop and log it in `DECISIONS.md` as exactly that."*

---

# Part 3 — Scoring every resource

One row per resource in the control inventory. The four `*(fact)*` columns are filled in from
the catalogs and are not yours to change; the five on the right are.

Write the **level label** you defined in Part 1 into each cell, replacing `?`.

Full dossiers — every column, every dependency, every guard, every server function that touches
each resource — are in `evidence/runs/<run-id>/risk-inputs.md`. Score from those, not from this
summary; the summary exists to keep the table readable, not to be sufficient.

| Resource | *(fact)* Exposure | *(fact)* Owner col | *(fact)* Dep by | *(fact)* Guards | Data | Blast | Integrity | Revers | Exposure |
|---|---|---|---:|---:|:---:|:---:|:---:|:---:|:---:|
| `public.rulesets` | anonymous | — | 6 | 1 | ? | ? | ? | ? | ? |
| `public.cosmetics` | anonymous | — | 5 | 1 | ? | ? | ? | ? | ? |
| `public.career_nodes` | anonymous | — | 3 | 1 | ? | ? | ? | ? | ? |
| `public.tournaments` | anonymous | — | 3 | 1 | ? | ? | ? | ? | ? |
| `realtime.messages` | anon-latent | — | 0 | 0 | ? | ? | ? | ? | ? |
| `public.profiles` | authenticated | `id` | 24 | 3 | ? | ? | ? | ? | ? |
| `public.game_sessions` | authenticated | `host_user_id` | 11 | 2 | ? | ? | ? | ? | ? |
| `public.wallet_ledger` | authenticated | `user_id` | 4 | 3 | ? | ? | ? | ? | ? |
| `public.tournament_entries` | authenticated | `user_id` | 3 | 1 | ? | ? | ? | ? | ? |
| `public.hand_records` | authenticated | — | 2 | 1 | ? | ? | ? | ? | ? |
| `public.rooms` | authenticated | `host_user_id` | 2 | 1 | ? | ? | ? | ? | ? |
| `public.career_attempts` | authenticated | `user_id` | 1 | 1 | ? | ? | ? | ? | ? |
| `public.game_session_seats` | authenticated | `user_id` | 1 | 1 | ? | ? | ? | ? | ? |
| `public.hand_players` | authenticated | `user_id` | 1 | 1 | ? | ? | ? | ? | ? |
| `public.wallets` | authenticated | `user_id` | 1 | 2 | ? | ? | ? | ? | ? |
| `public.blocks` | authenticated | `blocked_id`, `blocker_id` | 0 | 0 | ? | ? | ? | ? | ? |
| `public.career_progress` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.daily_challenges_public` | authenticated | — | 0 | 0 | ? | ? | ? | ? | ? |
| `public.daily_entries` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.friend_requests` | authenticated | `receiver_id`, `sender_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.friendships` | authenticated | `user_id_a`, `user_id_b` | 0 | 0 | ? | ? | ? | ? | ? |
| `public.game_events` | authenticated | `recipient_user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.loadouts` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.matchmaking_queue` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.notifications` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.player_actions` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.player_daily_xp` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.player_decision_periods` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.player_mode_stats` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.player_stats` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.push_tokens` | authenticated | `user_id` | 0 | 0 | ? | ? | ? | ? | ? |
| `public.room_members` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.tournament_matches` | authenticated | — | 0 | 1 | ? | ? | ? | ? | ? |
| `public.user_cosmetics` | authenticated | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.daily_challenges` | server-only | — | 2 | 2 | ? | ? | ? | ? | ? |
| `private.career_drill_seeds` | server-only | — | 0 | 0 | ? | ? | ? | ? | ? |
| `private.game_commands` | server-only | `user_id` | 0 | 0 | ? | ? | ? | ? | ? |
| `private.game_state_private` | server-only | — | 0 | 0 | ? | ? | ? | ? | ? |
| `public.rate_limit_events` | server-only | `user_id` | 0 | 1 | ? | ? | ? | ? | ? |
| `public.rate_limit_policies` | server-only | — | 0 | 1 | ? | ? | ? | ? | ? |

### Tier assignments that were not obvious

Brief §6.1 requires every non-obvious tier assignment to be recorded with its reasoning. Not
every row needs an entry — only the ones where you had to think, or where a reasonable person
would put it somewhere else.

| Resource | Tier | Why it is not the obvious answer |
|---|---|---|
| `_____` | `_` | _____ |

---

# Part 4 — Factual inputs that are not dimensions

Two facts from WP0 and WP1 bear on risk without being properties of any single resource. They
are recorded here as **evidence to weigh**, not as dimensions, not as findings, and with no
severity attached.

## 4.1 No table has FORCE ROW LEVEL SECURITY

**The fact.** Row-level security is enabled on 38 tables in the application schemas and forced
on none. All 38 are owned by `postgres`, which also holds `BYPASSRLS`.

**What WP1 demonstrated, by execution rather than assertion** (`wp1-validation.md` §2): on a
scratch table owned by a role holding no `BYPASSRLS`, the owner saw 2 of 2 rows with RLS
enabled-but-not-forced and 1 of 2 with FORCE on — so FORCE does remove the owner's exemption.
The same sequence then showed `postgres` still seeing both rows **with FORCE on**, because
`BYPASSRLS` is a separate door that FORCE does not touch.

**The reachability answers, also executed:** no client login can reach the table owner
(`set role postgres` → `42501`). A holder of the `authenticator` credential **can** reach
`service_role`, which bypasses row security.

**What this means for the rubric.** Turning FORCE on across Arc21 would close a door no client
can reach, and would not close the one that is reachable. Whether that changes any tier is
yours to decide.

**Your assessment:** _____

## 4.2 The control-test login can assume `service_role`

**The fact.** `authenticator` — the PostgreSQL login every control test uses, and the login
PostgREST uses in production — is a member of `service_role`. `set role service_role` from that
login succeeds. `service_role` holds `BYPASSRLS`. Both halves were executed in WP1, not
inferred.

This is a property of the role setup, not an artifact of the harness. What stops a control test
from silently running on a bypassing role is a thrown exception in `src/db.ts`, and nothing in
the database.

**Four questions you said this has to answer before it can be rated.** They are the right
questions and Attest cannot answer any of them from the catalogs — the first two are about
architecture and deployment, the last two about consequence and credential handling.

1. **What real application path, if any, could obtain that login or its credentials?**

   _____

2. **Does this exist only in the local/test setup, or also in the deployed architecture?**

   _____

3. **What damage would be possible if that transition were reachable?**

   _____

4. **Do existing credential boundaries make the path practically unreachable?**

   _____

**Your assessment:** _____

---

# Part 5 — Tier to assurance activity

The brief structures this after FDA's final Computer Software Assurance guidance (September
2025, current version February 2026): **determine intended use → determine whether the process
risk is high → apply proportionate activity.** The point of the model is that effort follows
risk instead of being spread evenly, and that the justification is written down.

The three activity levels below are the brief's own words. Confirm, change, or sharpen them —
and write the basis, because "the brief said so" is not a basis you can defend.

| Tier | Assurance activity *(from the brief)* | Your definition |
|---|---|---|
| High | scripted testing with every policy branch covered positive and negative | _____ |
| Medium | limited scripted testing of critical paths only | _____ |
| Low | unscripted or exploratory probing, recorded but not exhaustive | _____ |

**What counts as a "policy branch"**, for costing purposes: _____

**The basis for this mapping** *(your words — why proportionate assurance rather than testing
everything equally, and why these three levels)*:

_____

> **A warning the brief makes explicitly, repeated here because it is the easiest rule to break
> without noticing:** *"Do not let tier assignment drift toward 'whatever is easy to test.' If a
> high-tier resource is hard to test, that is a finding, not a reason to downgrade it."*

---

# Part 6 — Sensitivity

Written after scoring, not before. The mechanical half is computed by
`npm run attest rubric` once Parts 1–3 are complete: it re-runs your scores under alternative
weightings and reports which resources change tier and what that does to the test count.

The half that is yours: **which alternative rubric is the reasonable one to compare against?**
A sensitivity analysis against a strawman proves nothing. The useful comparison is against the
rubric a competent person who disagreed with you would have written.

**The alternative rubric I am testing against, and why it is a fair one:**

_____

**Resources that change tier under it:** *(computed)*

**What that costs in test count:** *(computed)*

**What I conclude from that:** _____

---

# Part 7 — What this rubric is not

Worth writing down now, before any of it is quoted back at you.

- It rates **technical controls on one personal application**. It is not a risk assessment of
  an organisation, a system, or a process.
- It is not a validated or recognised methodology. The dimensions come from the brief; the
  scoring is one person's judgment.
- The author wrote both the application and the rubric. That is not an independent assessment
  and an auditor would not accept it as one.
- Nothing here is a compliance artifact.

_____
