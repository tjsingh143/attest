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
| 2 | Arc21 read-only decision durable | COMPLETE (verify) | D3.31, PROJECT_BRIEF A1, CHECKPOINTS scope-change section, memory note — all present |
| 3 | Arc21 guard load-bearing | IN PROGRESS | guard exists (D3.32); must also bracket the rebuild loop inside execution |
| 4 | WIP checkpoint commit | NOT STARTED | |
| 5 | C1 verify | NOT STARTED | preflight already proves identity = operation = expected = executor for 345 rows |
| 6 | Tournament-match fixture verify | NOT STARTED | |
| 7 | R7 isolation (rebuild after state change) | NOT STARTED | |
| 8 | R1 real assertions | NOT STARTED | |
| 9 | R2 vacuous targets + F8 topic | NOT STARTED | |
| 10 | R3 positives reach WITH CHECK | NOT STARTED | |
| 11 | R4 no-effect from state | NOT STARTED | |
| 12 | R5 premises | NOT STARTED | |
| 13 | Deleted-user boundary made real | NOT STARTED | |
| 14 | R6 state guards | NOT STARTED | |
| 15 | F5.delete_own_account.283 | NOT STARTED | |
| 16 | Error / outcome classification | NOT STARTED | |
| 17 | Compound expectation coverage | NOT STARTED | |
| 18 | F1–F10 structural audit | NOT STARTED | |
| 19 | register_push_token preserved, unfixed | NOT STARTED | |
| 20 | Intent store honest | NOT STARTED | |
| 21 | Intent reconciliation (240) | NOT STARTED | |
| 22 | Human intent-review package | NOT STARTED | |
| 23 | Preflight as a true execution gate | NOT STARTED | |
| 24 | prove-gates expanded adversarially | NOT STARTED | |
| 25 | Targeted smoke (non-evidence) | NOT STARTED | |
| 26 | Evidence schema audit | NOT STARTED | |
| 27 | One-command execution design (not run) | NOT STARTED | |
| 28 | Target preflight state | NOT STARTED | |
| 29 | Final Attest checkpoint commit | NOT STARTED | |
| 30 | Final review package / report | NOT STARTED | |

## Decisions taken in this pass

(Each substantive one also gets a `DECISIONS.md` entry.)

## Contradictions discovered

(Approved-row contradictions that need the author; each with evidence and a minimal proposed
resolution. None of these is resolved by editing a frozen field.)

## Validation log

| When (UTC) | Command | Result |
|---|---|---|
| 2026-09-23 05:55 | `node src/cli.ts preflight-wp3` | FAILED as expected: R1 4, R2 40, R3 4, R4 8, R5 18, R6 12, R7 48, compile 3, fixtures 2; Arc21 unchanged |

## Checkpoint commits

| Commit | What |
|---|---|

## Exact next action

Phase 4: create the WIP checkpoint commit of the previous session's coherent uncommitted work.
