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
   must ask. You decide what the possible answers are and how they rank.
2. **Architecture** — how five answers become one tier. The brief requires three tiers and does
   **not** require numbers; Part 2 sets out the structures available without choosing one.
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

| Level | What qualifies | Rating |
|---|---|---|
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |

**Why this dimension is in the rubric** *(your words — you will be asked to restate this)*:

_____

---

## Dimension 2 — Blast radius if the control fails

**The question.** If this control fails, how far does the damage reach: one user, all users, or
shared state?

Those three are the brief's own words, so the levels are given. What is not given is what they
are worth relative to each other, or which resource belongs in which.

**What Attest measured.**

- **Which column says whose row this is** — and whether that is a measurement or an inference,
  kept apart:
  - **Direct** (7 resources): a foreign key straight to `auth.users`. Measured.
  - **Inferred** (21 resources): the column reaches `auth.users` through an intermediate
    relation, and the full path is recorded — e.g.
    `public.wallets.user_id -> public.profiles -> auth.users`. The inference is that a relation
    whose *primary key* is a foreign key to an identity relation is itself an identity relation.
    **This split is evidence provenance, not a risk property.** It records how confidently the
    scaffold knows who owns a row — measured, or derived through one hop — so that a claim can
    be checked rather than trusted. It is *not* a sixth dimension and carries no implication
    that inferred ownership is riskier or safer than direct ownership. If you want provenance to
    affect a score, you have to say so explicitly inside one of the five dimensions; otherwise
    it stays what it is, which is a note about how the fact was obtained.
  - **Neither** (12 resources): no identity linkage at all — catalogues, `realtime.messages`,
    `tournament_matches`, the `private` engine-state tables.
- **How many relations depend on this one.** `public.profiles` is depended on by 24. Most
  resources are depended on by none.
- **Which SECURITY DEFINER functions name it** — the server-side paths that reach a resource
  regardless of the caller's policies.

Worth knowing while you score: Arc21 is **not consistent** about which it uses. Seven tables
carry a foreign key straight to `auth.users`; twenty-one go through `profiles`. That is an
observation about the schema, not a finding, and it is stated here only because a rubric that
treated the two differently would be rating an inconsistency rather than a risk.

**What you decide.** Which resource is which, and what each level scores. The hard cases are
the ones where the structure does not settle it:

- A table with an owner column is *usually* one-user blast radius. `public.game_session_seats`
  has one, and a seat is part of a shared table other players are sitting at. Which is it?
- `public.profiles` is depended on by 24 relations and is also per-user. Is it "one user"
  because each row is one person's, or "shared state" because everything joins to it?
- `public.rulesets` has no owner and 6 dependants, and is a read-only catalogue. Is a
  catalogue "all users" or is it its own thing?

| Level *(from the brief)* | What qualifies | Rating |
|---|---|---|
| one user | _____ | `_____` |
| all users | _____ | `_____` |
| shared state | _____ | `_____` |

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

| Level | What qualifies | Rating |
|---|---|---|
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |

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

| Level | What qualifies | Rating |
|---|---|---|
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |
| `_____` | _____ | `_____` |

**Why this dimension is in the rubric** *(your words)*:

_____

---

## Dimension 5 — Exposure

**The question, in the brief's own terms.** Is this resource **effectively reachable** by
anonymous users, by any authenticated user, or only server-side?

**This is the one dimension where Attest has already done the classification**, because
effective reachability is decided by the catalogs rather than by opinion. It uses the grant
surface and the policy set together, because either alone gives the wrong answer: a grant with
no policy admitting it is not reach.

Measured, across all 40 resources:

| Effective reachability | Count |
|---|---:|
| anonymous | 4 |
| authenticated | 30 |
| server-only | 6 |

### The latent condition, kept as facts rather than as a level

An earlier draft invented a fourth level, "anonymous (latent)", for the one resource that
carries an anonymous grant no policy admits. That was a scoring decision dressed as a
measurement, and it has been removed. The underlying condition is not lost — it is recorded as
two separate booleans on every resource:

| Fact | Count |
|---|---:|
| Resources where an anonymous grant exists | 5 |
| …of those, where no policy currently permits anonymous access | **1** |

The one is `realtime.messages`, which reads:

- effective current reachability: **authenticated**
- anonymous grant exists: **yes** (`anon` holds `INSERT`, `SELECT`, `UPDATE`)
- anonymous policy currently permits access: **no** (all three policies name `authenticated`)

**What you do with that is a rubric decision and it is yours.** You might score exposure purely
on effective reachability and ignore the booleans; you might use the latent condition as a
modifier or a floor; you might treat it as something the findings narrative mentions and the
score does not. All three are defensible. Whichever you choose goes in `DECISIONS.md`, because
somebody will ask.

| Level *(from the brief)* | What qualifies | Rating |
|---|---|---|
| anonymous | _____ | `_____` |
| authenticated | _____ | `_____` |
| server-only | _____ | `_____` |

**Does the latent-grant condition affect the exposure rating?** If so, how — and if not, say so
explicitly, because silence reads as an oversight:

_____

**Why this dimension is in the rubric** *(your words)*:

_____

---

# Part 2 — Rubric architecture

**The brief requires five dimensions and three tiers. It does not require numbers.**

An earlier draft of this scaffold went straight to weights, a weighted sum and numeric
thresholds. That was an architectural assumption presented as a form to fill in, and it would
have shaped the rubric before you chose its shape. It has been removed.

Below are the structures available, what each commits you to, and what each costs. **No
recommendation is made and no default is set.** Choose, then write down why.

---

## Option A — Ordinal ratings with rule-based tier assignment

Each dimension gets an ordinal level (`low` / `medium` / `high`, or named levels of your own).
Tiers come from explicit written rules over combinations:

> *High if exposure is anonymous and integrity impact is high; or if reversibility is
> "irreversible" regardless of anything else. Medium if …*

**What it commits you to.** That the levels are *ranks*, not quantities — and nothing more.
You never have to claim that "shared state" is three times worse than "one user".

**What you get.** Every tier traces to a named rule. "Why is this High?" has a one-line answer
that somebody can disagree with specifically. There is no arithmetic to hide a judgment inside.

**What it costs.** Rules have to cover the space without gaps or contradictions. Five
dimensions at three levels is 243 combinations; you will not write 243 rules, you will write an
ordered list of clauses with a fallthrough, and you will need to check that the ordering does
what you think. Sensitivity analysis is coarser — "what if exposure mattered slightly less" has
no natural expression when nothing is numeric, so you perturb rules rather than dials.

**A common variant:** *lexicographic* — consult the dimensions in a fixed priority order and
let the first one that discriminates decide. Simpler to state, and it means the lower-priority
dimensions frequently do no work at all.

---

## Option B — Numeric scores with weights and thresholds

Levels map to numbers, dimensions carry weights, the weighted sum is compared against
thresholds.

**What it commits you to.** That the dimensions are commensurable and that the levels sit on an
interval scale. Scoring "shared state = 3" and "one user = 1" asserts that the gap between them
is twice the gap between 1 and 2. You may not believe that, and the model will not tell you.

**What you get.** Compactness — five weights and two thresholds fully specify it. Sensitivity
analysis is natural and cheap: move a weight, see what moves. Adding a resource requires no new
rules.

**What it costs.** *Compensation.* A high score on one dimension is cancelled by low scores
elsewhere. A server-only resource whose corruption would be unrecoverable averages out to Low,
because exposure contributes nothing. That is the known failure of additive models and it is a
live case here: `private.game_state_private` scores nothing on exposure by construction.

Threshold placement also does a great deal of silent work — small moves reshuffle the
distribution — and "why is exposure weighted 3 rather than 2" is a question that needs an answer
you can actually give.

---

## Option C — Hybrid: a base model plus floors

Either of the above, plus named conditions that impose a **minimum tier** regardless of what
the base model produces:

> *Any resource whose corruption is irreversible is at least Medium, whatever else it scores.*

**What it commits you to.** Two mechanisms, both of which a reader has to check.

**What you get.** It fixes compensation directly, and it lets you keep a simple base model while
handling the exceptions explicitly — instead of distorting weights until the model happens to
produce the answer you already knew was right. Distorting weights to reach a predetermined
answer is the thing that makes a rubric unfalsifiable; a floor is the honest version of the same
intervention, because it is visible.

**What it costs.** Floors can become a dumping ground. If most resources end up floored, the
base model is not doing the work and the dimensions or their weights were wrong. A reasonable
self-check: if more than a handful of resources are decided by a floor, revisit the base.

---

## 2.1 The architecture I have chosen

**Chosen:** `_____`

**Why, and what I am accepting by choosing it:**

_____

## 2.2 The specification

Fill in whichever of these your architecture actually needs. **Delete the ones it does not.**
A rubric carrying an unused weights table invites the reader to assume the weights mattered.

**If rule-based (A):** the ordered rules that assign a tier.

| # | Rule | Tier |
|---|---|---|
| 1 | `_____` | `_____` |
| 2 | `_____` | `_____` |
| 3 | `_____` | `_____` |
| … | `_____` | `_____` |
| fallthrough | everything not matched above | `_____` |

**If numeric (B):** the weights, the aggregation and the thresholds.

| Dimension | Weight |
|---|---:|
| What the data is | `_____` |
| Blast radius | `_____` |
| Integrity impact | `_____` |
| Reversibility | `_____` |
| Exposure | `_____` |

Aggregation: `_____`

| Tier | Condition |
|---|---|
| High | `_____` |
| Medium | `_____` |
| Low | `_____` |

**If hybrid (C):** the base model above, plus the floors.

| Condition | Minimum tier | Why this cannot be left to the base model |
|---|---|---|
| `_____` | `_____` | `_____` |

---

## 2.3 Before you score anything

Whatever the architecture, fix it **before** assigning levels to resources. Setting rules or
thresholds afterwards, once you can see where things land, is rubric-tuning, and the brief names
it:

> *"Do not tune the rubric after seeing results. If you find yourself adjusting a tier because
> it makes the findings look better or the work smaller, stop and log it in `DECISIONS.md` as
> exactly that."*


---

# Part 3 — Scoring every resource

One row per resource in the control inventory. The four `*(fact)*` columns are filled in from
the catalogs and are not yours to change; the five on the right are.

Write the **level label** you defined in Part 1 into each cell, replacing `?`. `*` on an owner
column marks an **inferred** identity linkage rather than a direct foreign key to `auth.users` —
that is provenance, recorded so the claim can be checked, and it carries no risk implication of
its own.

Full dossiers — every column, every dependency, every guard, every server function that touches
each resource — are in `evidence/runs/<run-id>/risk-inputs.md`. Score from those, not from this
summary; the summary exists to keep the table readable, not to be sufficient.

**The `Evid` column** records how well the facts supported *your* rating of that resource:

| Mark | Meaning |
|---|---|
| `E` | **Established** — the repository or database evidence settles what I needed to know. |
| `P` | **Partially established** — evidence covers some of it; I filled a gap with an assumption, stated in the notes below. |
| `U` | **Unknown / not established** — I rated this on something the evidence does not show. |

This is a property of the *evidence*, not of the resource, and it is deliberately **not** a sixth
dimension. **How an `Evid` mark of `P` or `U` should affect a tier is a methodology decision and
it is yours** — it might raise a tier on precautionary grounds, lower confidence without moving
the tier, trigger a note in the findings, or do nothing at all. The scaffold records the mark and
takes no position.

| Resource | *(fact)* Reachable by | *(fact)* Anon grant | *(fact)* Owner col | *(fact)* Dep by | Data | Blast | Integrity | Revers | Exposure | Evid |
|---|---|:---:|---|---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `public.rulesets` | anonymous | yes | — | 6 | ? | ? | ? | ? | ? | ? |
| `public.cosmetics` | anonymous | yes | — | 5 | ? | ? | ? | ? | ? | ? |
| `public.career_nodes` | anonymous | yes | — | 3 | ? | ? | ? | ? | ? | ? |
| `public.tournaments` | anonymous | yes | — | 3 | ? | ? | ? | ? | ? | ? |
| `public.profiles` | authenticated | no | `id` | 24 | ? | ? | ? | ? | ? | ? |
| `public.game_sessions` | authenticated | no | `host_user_id`* | 11 | ? | ? | ? | ? | ? | ? |
| `public.wallet_ledger` | authenticated | no | `user_id`* | 4 | ? | ? | ? | ? | ? | ? |
| `public.tournament_entries` | authenticated | no | `user_id`* | 3 | ? | ? | ? | ? | ? | ? |
| `public.hand_records` | authenticated | no | — | 2 | ? | ? | ? | ? | ? | ? |
| `public.rooms` | authenticated | no | `host_user_id` | 2 | ? | ? | ? | ? | ? | ? |
| `public.career_attempts` | authenticated | no | `user_id`* | 1 | ? | ? | ? | ? | ? | ? |
| `public.game_session_seats` | authenticated | no | `user_id`* | 1 | ? | ? | ? | ? | ? | ? |
| `public.hand_players` | authenticated | no | `user_id`* | 1 | ? | ? | ? | ? | ? | ? |
| `public.wallets` | authenticated | no | `user_id`* | 1 | ? | ? | ? | ? | ? | ? |
| `public.blocks` | authenticated | no | `blocked_id`*, `blocker_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.career_progress` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.daily_challenges_public` | authenticated | no | — | 0 | ? | ? | ? | ? | ? | ? |
| `public.daily_entries` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.friend_requests` | authenticated | no | `receiver_id`*, `sender_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.friendships` | authenticated | no | `user_id_a`*, `user_id_b`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.game_events` | authenticated | no | `recipient_user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.loadouts` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.matchmaking_queue` | authenticated | no | `user_id` | 0 | ? | ? | ? | ? | ? | ? |
| `public.notifications` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.player_actions` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.player_daily_xp` | authenticated | no | `user_id` | 0 | ? | ? | ? | ? | ? | ? |
| `public.player_decision_periods` | authenticated | no | `user_id` | 0 | ? | ? | ? | ? | ? | ? |
| `public.player_mode_stats` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.player_stats` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.push_tokens` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `public.room_members` | authenticated | no | `user_id` | 0 | ? | ? | ? | ? | ? | ? |
| `public.tournament_matches` | authenticated | no | — | 0 | ? | ? | ? | ? | ? | ? |
| `public.user_cosmetics` | authenticated | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `realtime.messages` | authenticated | yes, **no policy** | — | 0 | ? | ? | ? | ? | ? | ? |
| `public.daily_challenges` | server-only | no | — | 2 | ? | ? | ? | ? | ? | ? |
| `private.career_drill_seeds` | server-only | no | — | 0 | ? | ? | ? | ? | ? | ? |
| `private.game_commands` | server-only | no | `user_id`* | 0 | ? | ? | ? | ? | ? | ? |
| `private.game_state_private` | server-only | no | — | 0 | ? | ? | ? | ? | ? | ? |
| `public.rate_limit_events` | server-only | no | `user_id` | 0 | ? | ? | ? | ? | ? | ? |
| `public.rate_limit_policies` | server-only | no | — | 0 | ? | ? | ? | ? | ? | ? |

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

**Evidence sufficiency for that assessment** (`E` established / `P` partial / `U` unknown), and
what is missing if not `E`: _____

## 4.2 The control-test login can assume `service_role`

**The database fact, executed in WP1.** `authenticator` — the PostgreSQL login every control
test uses, and the login PostgREST uses — is a member of `service_role`. `set role service_role`
from that login succeeds. `service_role` holds `BYPASSRLS`.

**What the Arc21 repository establishes about whether that is reachable.** Investigated before
asking you to rate it, so the rating is made against evidence rather than imagination. No secret
value was read or printed; only names, file locations and code shapes.

| Question | What the repository establishes |
|---|---|
| What login path does the app use? | **Two, and they are separate.** The client (`src/lib/supabase/client.ts`) constructs a Supabase client from a URL and a *publishable* key only, and talks HTTPS to PostgREST/GoTrue/Realtime. Edge Functions (Deno, server-side) additionally hold a direct Postgres connection via `SUPABASE_DB_URL` — documented in `_shared/env.ts` as necessary because `SELECT … FOR UPDATE` across statements does not survive PostgREST's connection model, and no API role, `service_role` included, holds `USAGE` on `private`. |
| Does ordinary client code ever hold direct database credentials? | **No, in this repository.** The only variables reaching the client bundle are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Stronger: `src/lib/supabase/config.ts` *refuses to configure the client* if the publishable key looks like a server secret — it rejects the prefixes `sb_secret_`, `sbp_`, `postgres://` and `postgresql://` with a `SERVER_SECRET_IN_CLIENT_BUNDLE` problem, and `tests/auth/supabase-config.test.ts` covers it. |
| Can client-controlled code issue arbitrary SQL or `SET ROLE`? | **No path found.** Zero functions in `public` or `private` that are callable by `anon`, `authenticated` or `PUBLIC` contain dynamic `EXECUTE`. Zero functions anywhere in those schemas contain `SET ROLE`. Client RPC calls name functions as literals. PostgREST derives the role from the signed JWT's `role` claim, so claiming `service_role` requires the signing key, which is not a client-visible variable. |
| Where is the service-role credential referenced? | **One code file.** `supabase/functions/_shared/env.ts` (`serviceRoleKey()` → `SUPABASE_SERVICE_ROLE_KEY`), consumed by exactly two Edge Functions: `_shared/realtime-broadcast.ts` and `send-notifications/index.ts`. Elsewhere it appears only in `.env.example` (empty placeholder) and three documentation files. |
| Is it confined to server-side code? | **Yes, within this repository.** Every reference is under `supabase/functions/`, which runs in the server-side Deno runtime. |
| Is `authenticator → service_role` Arc21's doing or platform infrastructure? | **Platform.** No Arc21 migration creates a role, grants a role, or mentions `authenticator` at all — the role graph comes from the Supabase bootstrap and is present on any Supabase instance. The transition also requires a **direct PostgreSQL connection authenticated as `authenticator`**, which no Arc21 client code opens. |

### What the repository does NOT establish — marked unknown rather than inferred

- **Which role `SUPABASE_DB_URL` names.** `.env.example` carries an empty placeholder;
  `.env.local` is gitignored and untracked, and was not read. **Unknown.**
- **Whether the deployed project exposes a PostgreSQL port publicly**, and to what.
  Deployment configuration is not in this repository. **Unknown.**
- **How the `authenticator` credential is handled in the hosted environment**, who holds it, and
  whether it is rotated. **Unknown.**
- **Whether the hosted JWT signing key is confined** as the local one appears to be. **Unknown.**

### Your assessment

The four questions, now answerable against the evidence above for the first two and still
requiring your judgment for the last two.

1. **What real application path, if any, could obtain that login or its credentials?**

   _____

2. **Does this exist only in the local/test setup, or also in the deployed architecture?**

   _____

3. **What damage would be possible if that transition were reachable?**

   _____

4. **Do existing credential boundaries make the path practically unreachable?**

   _____

**How this affects the rubric, if at all** *(it is a property of the role graph rather than of
any one resource, so scoring it per-resource would count it forty times — but it may reasonably
inform a floor, a tier, or nothing):*

_____

**Evidence sufficiency for that assessment** (`E` / `P` / `U`). Note that questions 1 and 2 are
answered from the repository for the *local* case and marked **unknown** for the deployed one,
so an honest mark here is very likely `P`: _____

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

**Evidence sufficiency for this mapping** (`E` / `P` / `U`): _____

> **A warning the brief makes explicitly, repeated here because it is the easiest rule to break
> without noticing:** *"Do not let tier assignment drift toward 'whatever is easy to test.' If a
> high-tier resource is hard to test, that is a finding, not a reason to downgrade it."*

---

# Part 6 — Sensitivity

The brief asks for one thing here: **which resources would change tier under a reasonable
alternative rubric, and what that would cost in test count.** That is the whole requirement.

## What the minimum sufficient form is

It is a *comparison*, not a second risk programme. Sufficient means:

1. **One alternative**, stated in a few lines — not a second full rubric document. It must differ
   from yours in **one identifiable way**, so that any tier change is attributable to that
   difference rather than to a dozen at once.
2. **A table of the resources that move**, with the tier under each rubric. If none move, that is
   a result and it is worth reporting, because it means the tiering is insensitive to the thing
   you varied.
3. **The test-count delta**, computed from your Part 5 activity definitions: how many more or
   fewer tests the alternative implies.
4. **A sentence on what you conclude.** Typically one of: the tiering is robust to this
   disagreement; or it hinges on one choice, which is therefore the thing to defend.

That is four short items. Anything beyond it is scope the brief did not ask for.

## What makes an alternative "reasonable"

A sensitivity analysis against a strawman proves nothing. The useful comparison is the rubric a
competent person who disagreed with you would actually have written. Concretely, the alternative
has to be one you could argue *for* if you had to.

The cheapest honest source of one is a decision you already had to make and could have made
differently — the ambiguous cases in Part 1 and the architecture choice in Part 2 are exactly
these. Varying one of those is a real disagreement; inventing a rubric nobody would defend is
not.

## 6.1 The alternative I am testing against

**What it changes, in one or two lines:** _____

**Why a competent person could hold this view:** _____

**Evidence sufficiency for the comparison** (`E` / `P` / `U`): _____

## 6.2 Results

**Resources that change tier:** *(computed once Parts 1–3 are complete)*

**Test-count delta:** *(computed)*

**What I conclude:** _____

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
