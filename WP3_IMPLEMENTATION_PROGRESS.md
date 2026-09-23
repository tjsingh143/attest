# WP3 implementation preparation — durable progress log

**This is an engineering work log, not evidence.** Nothing in it is a WP3 result, a finding or an
approval. It exists so that a long pass that crosses context boundaries can be resumed from the
repository rather than from a conversation. If this file and the repository disagree, the
repository wins — re-derive, then correct this file.

No credential, JWT or secret is ever written here.

## Mission (verbatim intent, condensed)

Carry Attest from its current state through the complete WP3 implementation-preparation /
structural-hardening phase, and stop at the human AUTHOR INTENT review gate:

- WP0–WP2 complete, WP2 frozen, CP1–CP3 recorded, WP3 planning approved (already true on disk).
- The approved 345-row matrix stays internally sound; every approved Test ID gets a valid
  implementation path; every expectation is actually asserted; every state claim has a guard;
  no vacuous test; no prerequisite failure or harness error can read as a security result.
- All deterministic fixtures live Attest-side; probe isolation is sound (rebuild-based, see R7).
- Arc21 source unchanged throughout (fingerprint pre == post on every command).
- 240 AI-draft AUTHOR INTENT sentences exist, validated, **0 human-approved**.
- Normal execution refused **only** because the AUTHOR INTENT gate is closed.
- The full 345-probe WP3 assessment is **not** run; no final WP3 counts; WP4 not begun; no
  remediation (WP5 is findings + guidance only).

## Starting point (recorded 2026-09-23, before any edit in this pass)

| | |
|---|---|
| Attest branch / HEAD | `main` @ `495677b648cbbc2c7b6dab6b6af2e5533f9e4233` ("WP3: author-intent worksheet, and a bookkeeping correction") |
| Attest working tree | 10 modified tracked files, 24 untracked paths (the previous session's uncommitted implementation-prep: executor, preflight, readiness, fault injection, guard, intents, two evidence runs). Scanned: no JWT, no credential-like string. |
| Arc21 checkout | `phase14-s2-security` @ `58dcf39fc66a…`, 36 tracked files differing from HEAD, 23 untracked, 13 ignored entries |
| Arc21 fingerprint (pre) | `13569cf0e2dd36c10365c333820093de5013dad09e0fddb65bb041e16533eaf1` |
| Local stack | 12 Supabase containers up; Realtime healthy; PostgREST 200 |
| Schema under test | `5695a4c3df2d…` (59 migrations, one uncommitted: `20260909120000_career_attempt_counts.sql`) |

Starting preflight (planning mode), recomputed — it matched the previous pass's report exactly:

| Check | Rows |
|---|---:|
| plan: 345 IDs, 63/240/42, approved-manifest equality, identity consistency (C1) | pass |
| compile (derived statement names a missing column) | 3 |
| fixtures not satisfied (time-expired matchmaking rows) | 2 |
| R1 assertionless | 4 |
| R2 empty subject / F8 topic comma | 40 |
| R3 INSERT positives that cannot succeed | 4 |
| R4 no-effect judged by row count | 8 |
| R5 premises not satisfied (incl. 14 deleted-user rows with dave live) | 18 |
| R6 unguarded state claims | 12 |
| R7 probes committing changes, no isolation | 48 |
| intents: 240 required, 240 present, 240 `ai_draft`, 0 adopted | — |

Additional defects found during reconstruction, not in the R-list (to be fixed in this pass):

- `F5.enforce_rate_limit.300`, `.301`, `.302` bind the **signature text** as the argument
  (`"p_action text"`, `"p_category text"`, `"p_limit integer"`).
- `F5.register_push_token.269` binds the literal `"..."` (an elision in the approved text) as
  `p_device_id`.
- `F5.leaderboard_*` probes run against empty source tables: "public-safe projection" passes on
  zero rows (vacuous); `leaderboard_daily_challenge` is called with no date although the row
  says "for the seeded challenge date".
- `no_data` is satisfied by **any** raise; `refusal` by any raise or zero rows; mechanism
  clauses ("refused by the grant", "new row violates row-level security", "rejected by
  wallet_ledger_append_only") are not asserted at all.
- `CallerPool` reuses one session per caller across probes, so session GUCs
  (`realtime.topic`) leak between probes.

## Phases

Status: NOT STARTED / IN PROGRESS / COMPLETE / BLOCKED.

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Reconstruct state from disk | COMPLETE | numbers above recomputed, not trusted |
| 1 | This progress file | COMPLETE | |
| 2 | Arc21 read-only decision durable | COMPLETE | D3.31, PROJECT_BRIEF A1, CHECKPOINTS scope-change section, memory note |
| 3 | Arc21 guard load-bearing | COMPLETE | every CLI command bracketed (exit 3); re-checked after every rebuild; proven on a throwaway repo only |
| 4 | WIP checkpoint commit | COMPLETE | f151daa |
| 5 | C1 verify | COMPLETE | identity = operation = expected = executor for all 345 rows (F5: 40 alice, 16 carol, 2 anon) |
| 6 | Tournament-match fixture verify | COMPLETE | baseline fixture; four wrong-state injections caught |
| 7 | R7 isolation (rebuild after state change) | COMPLETE | measured 33.6 s/rebuild; abort path proven |
| 8 | R1 real assertions | COMPLETE | 72 templates, 345/345 covered |
| 9 | R2 vacuous targets + F8 topic | COMPLETE | subject premises (binding's own exemptions); exact-topic parser |
| 10 | R3 positives reach WITH CHECK | COMPLETE | live R3 check |
| 11 | R4 no-effect from state | COMPLETE | |
| 12 | R5 premises | COMPLETE | 238 premises hold live |
| 13 | Deleted-user boundary made real | COMPLETE | C5 registered; excuses only the empty subject |
| 14 | R6 state guards | COMPLETE | |
| 15 | F5.delete_own_account.283 | COMPLETE | exercised via probe:alice_seat_left; literal expectation false by documented host migration — author's reading (D3.49) |
| 16 | Error / outcome classification | COMPLETE | + client_guard (pg_safeupdate, D3.47); + "executed" premise (D3.42) |
| 17 | Compound expectation coverage | COMPLETE | |
| 18 | F1–F10 structural audit | COMPLETE | preflight passes; smoke across every family |
| 19 | register_push_token preserved, unfixed | COMPLETE | reproduced in smoke; candidate only |
| 20 | Intent store honest | COMPLETE | 240 required = 240 present = 240 ai_draft/unreviewed, 0 approved |
| 21 | Intent reconciliation (240) | COMPLETE | 5 drafts corrected (article, number); article + number checks added |
| 22 | Human intent-review package | COMPLETE | evidence/runs/20260923T094706Z-5695a4c3df2d/ |
| 23 | Preflight as a true execution gate | COMPLETE | |
| 24 | prove-gates expanded adversarially | COMPLETE | 64/64 caught, 3/3 controls |
| 25 | Targeted smoke (non-evidence) | COMPLETE | 42 + 5 + 2 probes; candidates .269, .271, .283 |
| 26 | Evidence schema audit | COMPLETE | wp3-evidence/2 |
| 27 | One-command execution design (not run) | COMPLETE | execute-wp3 --confirm; exit 1 harness error/abort, 3 Arc21 |
| 28 | Target preflight state | COMPLETE | --for-execution fails ONLY on the two author gates |
| 29 | Final Attest checkpoint commit | COMPLETE | "WP3: harden executor and reach author-review gate" — the commit carrying this line |
| 30 | Final review package / report | COMPLETE | WP3_AUTHOR_REVIEW.md |

## Design for this pass (decided before coding; each gets a DECISIONS entry)

**Isolation (R7).** Author decision, implemented literally: a state-changing probe commits, its
privileged guards run, then the disposable database is **rebuilt** (`supabase db reset --local`
+ Attest seed + baseline seed extensions) and the baseline **verified** (schema version, every
baseline fixture's verify SQL, per-table row counts equal to the canonical counts, catalog/control
surface digest equal to the canonical one, Realtime and PostgREST ready) before the next probe.
Measured: one rebuild ≈ 40 s (reset 36.5 s + seed ~3 s). A probe is state-changing if it is
statically classified so (mutating DML, VOLATILE function, probe-scoped setup, runner that
writes) **or** if a whole-database content digest taken after it differs from the one taken
after the last rebuild (so an unexpected write — e.g. a failed control — can never leak into
the next probe). Every probe gets a **fresh** role session (no pooling: session GUCs such as
`realtime.topic` cannot leak). The Arc21 fingerprint is re-checked after every rebuild.

**Fixtures.** Baseline fixtures (applied at every rebuild) are additive rows no probe's premise
conflicts with. Premises that conflict with the baseline (e.g. `.262` needs carol to have no tie
to bob while F1 negatives need the bob↔carol rows) are **probe-scoped setups**: applied as admin
after the verified baseline, before that one probe, and followed by a rebuild. Every fixture is a
plan-stated requirement (`needSeed`), so rows whose stated fixture was "the standing seed" but
whose probe needs more get a listed **fixture correction** in the approved manifest (metadata
only — no frozen field changes). A fifth synthetic account, erin (privacy `private`), is added
so leaderboard "no private-privacy identity" claims have a subject.

**Claims.** Each of the 79 distinct approved `expected` texts is partitioned, character for
character, into spans, each span one of: OUTCOME, MECHANISM, STATE, PREMISE/CATALOG,
REFERENCE, RATIONALE (the last explicitly listed as non-assertable, with why). Every non-
rationale span maps to a registered evaluator; a text with an unregistered or uncovered span
fails preflight. Refusals are attributed from the PostgreSQL error fields (code, message,
`where`, routine, constraint), so `no data` can no longer mean "any error", and a refusal by a
different layer than the one named is `control_not_reached` → `not_measured`, never effective.

**Outcomes.** observation ∈ {as_predicted, not_as_predicted, harness_error,
precondition_failed, control_not_reached, blocked_contradiction}; verdict stays separate
(effective / deficient / characterized / gap / not_measured).

**Approved-row contradictions** are registered with a *live* check proving each still holds;
their Test IDs execute honestly and record `not_measured` (blocked) with the reason; they are
listed for the author. They do not fabricate a verdict and are not silently reinterpreted.

## Decisions taken in this pass

D3.38 fixtures/scopes/corrections · D3.39 statement bindings · D3.40 claims and references ·
D3.41 business prerequisites and .283 · D3.42 evaluator principle (+ "executed" premise) ·
D3.43 evidence schema · D3.44 socket observer and liveness · D3.45 isolation by rebuild ·
D3.46 registered contradictions · D3.47 pg_safeupdate client guard · D3.48 prove-gates ·
D3.49 smoke results and candidates.

## Contradictions discovered

(Approved-row contradictions that need the author; each with evidence and a minimal proposed
resolution. None of these is resolved by editing a frozen field.)

Found during reconstruction (to be registered with live checks):

| Id | Test IDs | Approved text says | The system says |
|---|---|---|---|
| C2 mechanism unreachable | F9.public_wallets.319, .321 | alice's UPDATE / TRUNCATE is refused by `wallet_ledger_append_only` / `wallet_ledger_deny_truncate` | `authenticated` holds only SELECT on `wallet_ledger`: the privilege check refuses first; the trigger is never reached |
| C2 | F9.public_wallets.322 | server TRUNCATE refused by `wallet_ledger_deny_truncate` | `tournament_entries` / `career_progress` / `daily_entries` FKs reference `wallet_ledger`; TRUNCATE's FK check (0A000) runs before BEFORE TRUNCATE triggers |
| C2 | F5.send_friend_request.259 | refusal attributed to `friend_requests_insert_as_sender` | inside the SECURITY DEFINER function that policy is never consulted; the body refuses `no such player` via `is_blocked_between` |
| C3 literal invalid | F3.public_friend_requests.059 | sender sets `status = 'accepted'` | `guard_friend_request_transition` lets only the receiver accept (42501) before WITH CHECK |
| C3 | F3.public_profiles.151, F6.public_profiles.153 | `username = 'attest-probe-username'` | violates `profiles_username_check` `^[a-z0-9_]{3,20}$` (23514) |
| C3 | F6.public_loadouts.117 | `avatar_cosmetic_id = '…0000ff'` | no such cosmetic: `guard_loadout_slots` raises 23503 |
| C4 privilege | F5.latest_verifiable_daily_challenge.278 | anon receives the revealed challenge | EXECUTE is granted to `authenticated` only; anon gets 42501 |
| C5 empty by construction | the 14 `#boundary:deleted-user` rows | "select … where the owner column names dave" after deletion | every such column is `ON DELETE CASCADE` or `SET NULL`; after a genuine deletion no row can name dave, so "no data" is produced by referential actions, not by any control; `B.323`/`.336` additionally have no client grant, contradicting "and no error" |
| C2 client guard (found in this pass) | 34 F2 UPDATE/DELETE rows | `error 42501 — refused before any policy is consulted` for a WHERE-less UPDATE/DELETE | `authenticator` preloads pg_safeupdate, which refuses at parse analysis (21000) before any privilege check (D3.47) |
| C3 literal invalid (found in this pass) | F2.public_game_sessions.094 | `set tier = 'attest-probe-tier'` | not a `table_tier` label: 22P02 at parse analysis |

## Validation log

| When (UTC) | Command | Result |
|---|---|---|
| 2026-09-23 05:55 | `node src/cli.ts preflight-wp3` | FAILED as expected: R1 4, R2 40, R3 4, R4 8, R5 18, R6 12, R7 48, compile 3, fixtures 2; Arc21 unchanged |
| 2026-09-23 ~16:20 | `preflight-wp3` (first run of the rewritten gate) | FAILED honestly: R6 3 (F8 policy-name regex without digits; refusal-site rule too strict for either/or claims), rebuild catalog digest `text \|\| "char"`, F2.094 does not compile (22P02 enum literal), F4 catalog SQL typing (4). Discovered pg_safeupdate (client guard) refusing 34 F2 rows before the grant (D3.47) |
| 2026-09-23 ~16:35 | `preflight-wp3` | PASSED (planning mode): every structural gate; 238 premises live; 10 contradictions registered and holding; rebuild 34.1 s; Arc21 unchanged |
| 2026-09-23 ~16:40 | `prove-gates` | 58/63 caught — five real misses (R2 rule narrower than the binding's; wrong target row; SIX state-only F5 rows judged effective on a harness exception; missing article check). All fixed |
| 2026-09-23 ~16:50 | `prove-gates` | 63/63 caught, 3/3 controls held, state restored, Arc21 unchanged |
| 2026-09-23 ~17:00 | `smoke-wp3` (42 IDs, NOT evidence) | 31 as_predicted, 5 blocked_contradiction, 3 not_as_predicted (.283, .269, .271), 3 precondition_failed (sockets: MY identity-premise defect); 17 rebuilds / 572 s |
| 2026-09-23 ~17:15 | `smoke-wp3` (5 IDs, after fixes) | sockets 313–315 as_predicted; .282 as_predicted; .283 not_as_predicted — the only changed row naming another account is the rooms row now hosted by bob (documented host migration) |
| 2026-09-23 ~17:20 | `draft-intents` | 240 drafted, quality clean, 13 batches; 5 sentences changed; 240 ai_draft, 0 adopted |
| 2026-09-23 ~17:25 | `preflight-wp3 --for-execution` | FAILS only on the two author gates (exit 1) |
| 2026-09-23 ~17:30 | `execute-wp3` (no --confirm) | REFUSED (exit 1): the AUTHOR INTENT gate is closed; nothing executed; no evidence directory created |
| 2026-09-23 ~17:35 | abort-path proof (smoke with a wrong expected schema) | aborted before the first probe, nothing executed, reason recorded, Arc21 unchanged |
| 2026-09-23 ~17:40 | `preflight-wp3 --for-execution`, `prove-gates` (final, on the committed code) | only the two author gates fail; 64/64 caught, 3/3 controls held |

## Checkpoint commits

| Commit | What |
|---|---|
| f151daa | WP3: checkpoint implementation prep before executor hardening (phase 4) |
| (this commit) | WP3: harden executor and reach author-review gate (phase 29) — Attest only; WP3 not executed |

## Exact next action

STOP. The pass is complete up to the human AUTHOR INTENT review gate. Do NOT run
`execute-wp3 --confirm`, do not approve intents, do not modify Arc21, do not begin WP4 or WP5.
The author's next steps are in `WP3_AUTHOR_REVIEW.md`.
