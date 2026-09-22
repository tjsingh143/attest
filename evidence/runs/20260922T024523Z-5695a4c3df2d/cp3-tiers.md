# CP3 — risk tiers and assurance allocation

Produced by applying `RUBRIC.md` — authored by the author — to the 40 resources in the
control inventory. The rules are the rubric's; this document is their output.

| | |
|---|---|
| Run | `20260922T024523Z-5695a4c3df2d` |
| Schema version | `5695a4c3df2d3f6c6311999ae268f776e96c3beb657e8a8a466be2ebb62aabec` |
| Harness version | `0.1.0` sources `c7ecbf3d9093` |
| Instance | 127.0.0.1:54322/postgres |

## 1. Tier distribution

| Tier | Resources | Share |
|---|---:|---:|
| **High** | 21 | 53% |
| **Medium** | 19 | 48% |
| **Low** | 0 | 0% |
| | **40** | |

## 2. Every High resource, and why

21 resources. The rule that fired is quoted from the rubric's Step 1; the deciding
dimension's own rationale follows it.

### `private.career_drill_seeds`

**Impact High** — Data criticality = High. Exposure scored as **server-only** (confidentiality drives).

> Holds `seed_secret`, the value a drill attempt's scenarios are derived from. Hidden game information whose disclosure enables answering a different question from the one asked.

Data High/E · Blast Low/E · Integrity Medium/P · Reversibility Medium/U · Exposure Low/E

### `private.game_commands`

**Impact High** — Data criticality = High. Exposure scored as **server-only** (integrity drives).

> The accepted-command idempotency ledger — replay-protection state. Arc21's invariant is that retries cannot debit or credit twice, and this table is what enforces it.

Data High/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Low/E

### `private.game_state_private`

**Impact High** — Data criticality = High. Exposure scored as **server-only** (both drives).

> Authoritative engine state including the future shoe order and the dealer hole card — hidden game information whose disclosure enables cheating.

Data High/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Low/E · pre-decided by RUBRIC.md Part 4.5

### `public.blocks`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (integrity drives).

> blocks is read by viewer_is_blocked_by inside profiles_select_visible. Removing someone's block makes their profile visible to an account they blocked — an access-control decision.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.daily_challenges`

**Impact High** — Data criticality = High. Exposure scored as **server-only** (confidentiality drives).

> Holds `seed_secret`, commented SERVER ONLY and never to be logged. Knowing it reveals the shoe for that day's challenge — hidden game information whose disclosure enables cheating.

Data High/E · Blast High/E · Integrity High/E · Reversibility Medium/U · Exposure Low/E

### `public.friend_requests`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (integrity drives).

> Accepting a request creates a friendship, and friendship is read by viewer_is_friend_of inside profiles_select_visible — so forcing a status change alters who may read a profile.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.friendships`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (integrity drives).

> Read by viewer_is_friend_of inside profiles_select_visible, so creating or removing an edge alters profile-visibility decisions.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.game_events`

**Impact High** — Reversibility = High and at least one of Data, Blast radius or Integrity is Medium or High. Exposure scored as **authenticated** (both drives).

> Commented append-only and described in the broadcast module as the durable, ordered record a client falls back to. It is the history; nothing reconstructs it.

Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility High/E · Exposure Medium/E

### `public.game_session_seats`

**Impact High** — Data criticality = High. Exposure scored as **authenticated** (both drives).

> Authorization state: session participation, read from this table, is what authorizes access to game_sessions, game_events, hand_players, hand_records and the Realtime game topic. It also carries stack and buy_in.

Data High/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E · pre-decided by RUBRIC.md Part 4.3 (blast radius)

### `public.game_sessions`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (both drives).

> Carries status, version and escrow_chips. Changing them alters authoritative shared session state and the chips held in escrow.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.hand_records`

**Impact High** — Reversibility = High and at least one of Data, Blast radius or Integrity is Medium or High. Exposure scored as **authenticated** (both drives).

> Commented an archive — it is the history of completed hands and no reconstruction path is established. Marked P because some economic consequences remain recoverable from wallet_ledger.

Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility High/P · Exposure Medium/E

### `public.profiles`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (both drives).

> The `privacy` column is read by profiles_select_visible, so an unauthorized change to it alters who may read that profile — an access-control decision.

Data Medium/E · Blast Low/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E · pre-decided by RUBRIC.md Part 4.2 (blast radius)

### `public.rate_limit_events`

**Impact High** — Integrity impact = High. Exposure scored as **server-only** (integrity drives).

> Deleting rows resets a user's rate-limit window. That corrupts a security control.

Data Medium/E · Blast Low/E · Integrity High/E · Reversibility Medium/P · Exposure Low/E

### `public.rate_limit_policies`

**Impact High** — Integrity impact = High. Exposure scored as **server-only** (integrity drives).

> Altering window_length or max_events disables or weakens rate limiting globally — corruption of a security control.

Data Medium/E · Blast High/E · Integrity High/E · Reversibility Low/E · Exposure Low/E

### `public.room_members`

**Impact High** — Data criticality = High. Exposure scored as **authenticated** (both drives).

> Room membership is read by caller_is_room_member, making it authorization state. Marked P: this table carries no COMMENT, so its purpose is established from the helper function that reads it rather than from a declared intent.

Data High/P · Blast Medium/E · Integrity High/P · Reversibility Medium/U · Exposure Medium/E

### `public.rooms`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (both drives).

> visibility and code govern who may join a private table, so an unauthorized change alters an access decision. Marked P: the authorization chain through caller_is_room_member is established, the precise effect of altering visibility is inferred from the column's role.

Data Medium/E · Blast Medium/E · Integrity High/P · Reversibility Medium/U · Exposure Medium/E

### `public.rulesets`

**Impact High** — Integrity impact = High. Exposure scored as **server-only** (integrity drives).

> Corrupted rules alter blackjack behaviour and the rules used by sessions and tournaments and recorded against hands.

Data Low/E · Blast High/E · Integrity High/E · Reversibility Low/E · Exposure Low/E · pre-decided by RUBRIC.md Part 4.4

### `public.tournament_entries`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (both drives).

> placement and prize_chips are the authoritative outcome of a shared competition, and changing them changes who won and what is paid.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.tournament_matches`

**Impact High** — Integrity impact = High. Exposure scored as **authenticated** (both drives).

> The winner field is the authoritative outcome of a shared match and determines progression and prizes.

Data Medium/E · Blast Medium/E · Integrity High/E · Reversibility Medium/U · Exposure Medium/E

### `public.wallet_ledger`

**Impact High** — Data criticality = High. Exposure scored as **authenticated** (both drives).

> The append-only chip ledger — authoritative economy history.

Data High/E · Blast Low/E · Integrity High/E · Reversibility High/E · Exposure Medium/E

### `public.wallets`

**Impact High** — Data criticality = High. Exposure scored as **authenticated** (both drives).

> Authoritative virtual-chip balance — the economy state the whole product turns on.

Data High/E · Blast Low/E · Integrity High/E · Reversibility Low/E · Exposure Medium/E

## 3. Non-obvious Medium and Low decisions

Resources that a reasonable reader might have expected to land elsewhere.

| Resource | Tier | Why not higher | Dimensions |
|---|---|---|---|
| `public.career_attempts` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.career_nodes` | Medium | Not High; at least one consequence dimension is Medium or High (Blast=High, Integrity=Medium) | Data Low/E · Blast High/E · Integrity Medium/E · Reversibility Low/E · Exposure Low/E |
| `public.career_progress` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.cosmetics` | Medium | Not High; at least one consequence dimension is Medium or High (Blast=High, Integrity=Medium) | Data Low/E · Blast High/E · Integrity Medium/E · Reversibility Low/E · Exposure Low/E |
| `public.daily_challenges_public` | Medium | Not High; at least one consequence dimension is Medium or High (Blast=High) | Data Low/E · Blast High/E · Integrity Low/E · Reversibility Low/E · Exposure Medium/E |
| `public.daily_entries` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Blast=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.hand_players` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Blast=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.loadouts` | Medium | Not High; at least one consequence dimension is Medium or High (Reversibility=Medium) | Data Low/E · Blast Low/E · Integrity Low/E · Reversibility Medium/U · Exposure Medium/E |
| `public.matchmaking_queue` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Blast=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.notifications` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.player_actions` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.player_daily_xp` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.player_decision_periods` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.player_mode_stats` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.player_stats` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.push_tokens` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `public.tournaments` | Medium | Not High; at least one consequence dimension is Medium or High (Blast=High, Integrity=Medium, Reversibility=Medium) | Data Low/E · Blast High/E · Integrity Medium/E · Reversibility Medium/U · Exposure Low/E |
| `public.user_cosmetics` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Integrity=Medium, Reversibility=Medium) | Data Medium/E · Blast Low/E · Integrity Medium/E · Reversibility Medium/U · Exposure Medium/E |
| `realtime.messages` | Medium | Not High; at least one consequence dimension is Medium or High (Data=Medium, Blast=Medium, Integrity=Medium) | Data Medium/E · Blast Medium/E · Integrity Medium/E · Reversibility Low/E · Exposure Medium/E |

**No resource reached Low tier.** That is a structural consequence of the rubric rather than
a judgment about any one resource — see §6.

## 4. Evidence marks that materially affected a tier

A mark is *material* when the dimension carrying it is the one that decided the impact level.
Evidence sufficiency never changes a tier arithmetically; it says how well the deciding
judgment is supported.

| Resource | Tier | Deciding dimension | Mark | What is not established |
|---|---|---|---|---|
| `public.hand_records` | High | Reversibility | `P` | Commented an archive — it is the history of completed hands and no reconstruction path is established. Marked P because some economic consequences remain recoverable from wallet_ledger. |
| `public.room_members` | High | Data criticality | `P` | Room membership is read by caller_is_room_member, making it authorization state. Marked P: this table carries no COMMENT, so its purpose is established from the helper function that reads it rather than from a declared intent. |
| `public.rooms` | High | Integrity impact | `P` | visibility and code govern who may join a private table, so an unauthorized change alters an access decision. Marked P: the authorization chain through caller_is_room_member is established, the precise effect of altering visibility is inferred from the column's role. |

Across all dimensions, 31 of 40 resources carry at least one non-`E` mark:

- `private.career_drill_seeds` — Integrity:P, Reversibility:U
- `private.game_commands` — Reversibility:U
- `private.game_state_private` — Reversibility:U
- `public.blocks` — Reversibility:U
- `public.daily_challenges` — Reversibility:U
- `public.friend_requests` — Reversibility:U
- `public.friendships` — Reversibility:U
- `public.game_session_seats` — Reversibility:U
- `public.game_sessions` — Reversibility:U
- `public.hand_records` — Reversibility:P
- `public.profiles` — Reversibility:U
- `public.rate_limit_events` — Reversibility:P
- `public.room_members` — Data:P, Integrity:P, Reversibility:U
- `public.rooms` — Integrity:P, Reversibility:U
- `public.tournament_entries` — Reversibility:U
- `public.tournament_matches` — Reversibility:U
- `public.career_attempts` — Reversibility:U
- `public.career_progress` — Reversibility:U
- `public.daily_entries` — Reversibility:U
- `public.hand_players` — Reversibility:U
- `public.loadouts` — Reversibility:U
- `public.matchmaking_queue` — Reversibility:U
- `public.notifications` — Reversibility:U
- `public.player_actions` — Reversibility:U
- `public.player_daily_xp` — Reversibility:U
- `public.player_decision_periods` — Reversibility:U
- `public.player_mode_stats` — Reversibility:U
- `public.player_stats` — Reversibility:U
- `public.push_tokens` — Reversibility:U
- `public.tournaments` — Reversibility:U
- `public.user_cosmetics` — Reversibility:U

## 5. Sensitivity — the single alternative exposure interpretation

**Alternative:** treat a resource as **anonymous** exposure whenever the anonymous role already
holds the underlying grant, even where a current policy prevents anonymous access. Applied to
every resource with that condition. Everything else in the rubric is unchanged.

5 resources carry an anonymous grant and are therefore affected by the
re-interpretation: `public.rulesets`, `public.cosmetics`, `public.career_nodes`, `public.tournaments`, `realtime.messages`.

| Resource | Primary tier | Alternative tier | Primary tests | Alternative tests | Δ |
|---|---|---|---:|---:|---:|
| `public.cosmetics` | Medium | **High** | 2 | 6 | +4 |
| `public.career_nodes` | Medium | **High** | 2 | 6 | +4 |
| `public.tournaments` | Medium | **High** | 2 | 6 | +4 |
| `realtime.messages` | Medium | **High** | 4 | 9 | +5 |

**4 resource(s) change tier.** This exposure assumption is therefore a material
driver of the assurance plan.

| | Estimated tests |
|---|---:|
| Primary rubric | 185 |
| Alternative | 202 |
| **Delta** | **+17** |

## 6. Assurance allocation and test-count estimate

Per `RUBRIC.md` Part 5. A **policy branch** is a materially distinct authorization condition
that can independently change an allow/deny outcome.

**Estimator constants.** The rubric defines what each tier must cover; it does not fix these
numbers, so they are named here rather than buried:

**One estimated test = one statement executed under one identity, producing one evidence record.** It is a unit of execution, not a scenario
or a test file.

| Constant | Value | Meaning |
|---|---:|---|
| `highCasesPerBranch` | 2 | one positive and one negative per policy branch |
| `boundaryNullIdentity` | 1 | counted for a High resource **only where a policy on it reads `auth.uid()`** |
| `boundaryDeletedUser` | 1 | counted for a High resource **only where it records an owner** |
| `suiteLevelCases` | 1 | expired session — counted **once for the whole plan**, not per resource |
| `mediumCasesPerCommand` | 2 | a representative positive and negative per important path |
| `lowProbes` | 2 | recorded exploratory probing: one read, one write |

**On the three brief-required boundary cases.** The brief requires null/absent identity, a
deleted user and an expired session to appear *somewhere* in WP3. It does not require all
three against every High resource. Null-identity and deleted-user are counted per resource
where the catalogs make them applicable; expired session is counted once for the suite,
because at the database layer an expired JWT never arrives — PostgREST rejects it before
Postgres sees it — so there is no per-resource control to exercise.

| Tier | Resources | Branches | Boundary cases | Formula | Estimated tests |
|---|---:|---:|---:|---|---:|
| High | 21 | 54 | 22 | (branches x 2) + applicable boundary cases = (54 x 2) + 22 | 130 |
| Medium | 19 | 51 | 0 | important paths x 2 | 54 |
| Low | 0 | 0 | 0 | *(unused — no resource reached this tier)* | 0 |
| **Per-tier subtotal** | **40** | **105** | **22** | | **184** |
| Suite-level | — | — | 1 | expired session, counted once | 1 |
| **Total planned** | | | | | **185** |

### Estimator consistency invariant

| Check | Result |
|---|---|
| Primary: sum of per-tier tests equals sum of per-resource tests | **pass** — per-tier 184 vs per-resource 184 |
| Primary: total equals per-tier subtotal plus suite-level cases | **pass** — 184 + 1 = 185 |
| Alternative: sum of per-tier tests equals sum of per-resource tests | **pass** — per-tier 201 vs per-resource 201 |
| Alternative: total equals per-tier subtotal plus suite-level cases | **pass** — 201 + 1 = 202 |
| No tier subtotal exceeds the plan total | **pass** — High 130, Medium 54, Low 0, total 185 |

Per resource:

| Resource | Tier | Branches | How the branches were counted | Boundary | Formula | Tests |
|---|---|---:|---|---:|---|---:|
| `private.career_drill_seeds` | High | 1 | 1 for deny-by-default (RLS on, no policy) | 0 | 1 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 2 |
| `private.game_commands` | High | 1 | 1 for deny-by-default (RLS on, no policy) | 1 | 1 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 3 |
| `private.game_state_private` | High | 1 | 1 for deny-by-default (RLS on, no policy) | 0 | 1 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 2 |
| `public.blocks` | High | 3 | 3 from 3 policy USING/WITH CHECK condition(s) | 2 | 3 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 8 |
| `public.daily_challenges` | High | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 2 refusing trigger(s) | 0 | 3 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 6 |
| `public.friend_requests` | High | 5 | 4 from 3 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 2 | 5 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 12 |
| `public.friendships` | High | 2 | 2 from 2 policy USING/WITH CHECK condition(s) | 2 | 2 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 6 |
| `public.game_events` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 2 | 2 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 6 |
| `public.game_session_seats` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 1 | 2 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 5 |
| `public.game_sessions` | High | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 2 refusing trigger(s) | 1 | 3 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 7 |
| `public.hand_records` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 2 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 4 |
| `public.profiles` | High | 7 | 4 from 3 policy USING/WITH CHECK condition(s); 3 refusing trigger(s) | 2 | 7 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 16 |
| `public.rate_limit_events` | High | 2 | 1 for deny-by-default (RLS on, no policy); 1 refusing trigger(s) | 1 | 2 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 5 |
| `public.rate_limit_policies` | High | 2 | 1 for deny-by-default (RLS on, no policy); 1 refusing trigger(s) | 0 | 2 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 4 |
| `public.room_members` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 1 | 2 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 5 |
| `public.rooms` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 1 | 2 branches x 2 (positive + negative) + 1 applicable boundary case(s) | 5 |
| `public.rulesets` | High | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s); 1 for anonymous vs authenticated | 0 | 3 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 6 |
| `public.tournament_entries` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 2 | 2 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 6 |
| `public.tournament_matches` | High | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 2 branches x 2 (positive + negative) + 0 applicable boundary case(s) | 4 |
| `public.wallet_ledger` | High | 4 | 1 from 1 policy USING/WITH CHECK condition(s); 3 refusing trigger(s) | 2 | 4 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 10 |
| `public.wallets` | High | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 2 refusing trigger(s) | 2 | 3 branches x 2 (positive + negative) + 2 applicable boundary case(s) | 8 |
| `public.career_attempts` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.career_nodes` | Medium | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s); 1 for anonymous vs authenticated | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.career_progress` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.cosmetics` | Medium | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s); 1 for anonymous vs authenticated | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.daily_challenges_public` | Medium | 1 | 1 minimum | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.daily_entries` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.hand_players` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.loadouts` | Medium | 5 | 4 from 3 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 3 important path(s) x 2 (representative positive + negative) | 6 |
| `public.matchmaking_queue` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.notifications` | Medium | 5 | 4 from 3 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 3 important path(s) x 2 (representative positive + negative) | 6 |
| `public.player_actions` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.player_daily_xp` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.player_decision_periods` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.player_mode_stats` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.player_stats` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.push_tokens` | Medium | 5 | 5 from 4 policy USING/WITH CHECK condition(s) | 0 | 4 important path(s) x 2 (representative positive + negative) | 8 |
| `public.tournaments` | Medium | 3 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s); 1 for anonymous vs authenticated | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `public.user_cosmetics` | Medium | 2 | 1 from 1 policy USING/WITH CHECK condition(s); 1 refusing trigger(s) | 0 | 1 important path(s) x 2 (representative positive + negative) | 2 |
| `realtime.messages` | Medium | 4 | 3 from 3 policy USING/WITH CHECK condition(s); 1 for anonymous vs authenticated | 0 | 2 important path(s) x 2 (representative positive + negative) | 4 |

## 7. Rule outcomes worth a second look

Reported, not adjusted. Each of these follows from the rubric as written.

### The exposure dimension did not change a single tier

21 of 40 resources have High impact, and the rubric's floor fixes those at High
whatever their exposure. The remaining 19 have Medium impact, where exposure *could* have
lifted a resource to High — but only anonymous exposure does that, and none of them is
anonymous. **Every tier in this run was decided by impact alone.**

That is not a defect. It is what the floor is for, and it is precisely why the sensitivity
analysis is informative: re-interpreting exposure is the only thing that makes the dimension
do any work at all, and it moves 4 resources when it does.

### No resource reached Low tier

Low impact requires **all four** consequence dimensions to be Low. Combined with the rubric's
uncertainty rule — Low reversibility must be positively supported, otherwise Medium/`U` — a
resource can only reach Low tier if it is unimportant, isolated, harmless to corrupt **and**
has a demonstrated restore path. Only a handful of resources here have the last of those, and
each of them scores Medium or High somewhere else.

The practical consequence is that the Low assurance activity is currently unused, and every
resource earns at least limited scripted testing.

### The nearest thing to a Low-tier resource

- `public.loadouts` — Data, Blast and Integrity all Low; only Reversibility
  Medium/`U` keeps it out of Low tier.
  > A user's chosen loadout is recorded nowhere else, so a corrupted row cannot be restored to what it was — only re-chosen. Per the rubric's uncertainty rule, Low reversibility must be positively supported and is not.
