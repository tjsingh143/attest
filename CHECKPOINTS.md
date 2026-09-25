# CHECKPOINTS

The brief (§9) puts five checkpoints in the way of the work and says to stop at each,
present, and wait for explicit approval. §10 makes "all five checkpoints were reached,
presented, and approved" a condition of done.

Those approvals happened in conversation. **They were never written down.** A takeover review
on 2026-09-22 reconstructed project state from the repository alone and found that nothing on
disk recorded them — the only evidence that CP1, CP2 and CP3 had been cleared was that work
had visibly proceeded past them, which is an inference, not a record.

This file is that record. It exists so the next reader does not have to make the same
inference.

## What is being claimed, and what is not

**These approvals are reaffirmed by the author on 2026-09-22, in the continuation session that
followed the takeover review.** They are not transcriptions of contemporaneous notes, because
no contemporaneous notes exist.

**Original approval timestamps are not reconstructed and must not be inferred from this file.**
Each checkpoint was approved at some point before the work that followed it; when, exactly, is
not recorded anywhere and is not recoverable. The commit dates of the work that followed a
checkpoint are an upper bound on when that checkpoint was cleared, and nothing in this
repository establishes a lower bound.

Dating a reaffirmation honestly is worth more than a plausible-looking timestamp. An evidence
harness that fabricated its own approval dates would be making exactly the error it exists to
detect.

## State

| Checkpoint | Gate | State | Recorded |
|---|---|---|---|
| **CP1** | after WP0 — control inventory and uncontrolled resources | **approved** | reaffirmed 2026-09-22 |
| **CP2** | after WP1 — deliberate-break validation | **approved** | reaffirmed 2026-09-22 |
| **CP3** | after WP2 — rubric and tier assignments | **approved** | reaffirmed 2026-09-22 |
| — | WP3 **planning**: the 345-row test matrix | **approved** | reaffirmed 2026-09-22 |
| — | **Gate A** — every author decision before WP3 execution | **answered by the author 2026-09-24 (~20:00 UTC) and applied** (D3.54; `rubric/wp3-gate-a-decisions.json`) | 2026-09-24 |
| — | WP3 **execution**: running the 345 tests | **executed** — run `20260925T014011Z-5695a4c3df2d` is the result; two earlier runs kept as superseded / aborted records (D3.55) | 2026-09-25 |
| **CP4** | after WP5 — ranked findings, remediation guidance and verification procedures *(gate description amended 2026-09-22 by the scope change below; originally "ranked findings and remediation")* | **reached — presented in `CP4_PACKET.md`, awaiting the author's reply; not approved** | 2026-09-25 |
| **CP5** | after WP6 — framework mapping and limitations | not reached | — |

WP3 planning is not one of the brief's five checkpoints. It is recorded here because the
matrix is frozen in the same sense the tiers are: the executor implements it rather than
re-deciding it, so what was approved needs to be written down somewhere the executor's
reviewer can find.

## Scope change — 2026-09-22: Arc21 is a read-only assessment target

**The author changed the remediation boundary on 2026-09-22, before WP3 was executed.** Attest
never modifies Arc21 — no source, migration, policy, function, trigger, grant, role, test, seed,
configuration, dependency or git history — and makes no commits there. Findings remain open
recommendations; WP5 is now *Findings, Risk Prioritization, and Remediation Guidance*, and ends
with remediation guidance and verification procedures, never a fix. Every fixture Attest needs
lives in Attest. The brief's amendment is A1 (`PROJECT_BRIEF.md`, which is not version-controlled);
the reasoning is `DECISIONS.md` D3.31.

**Enforced, not promised.** Every `attest` command fingerprints the Arc21 checkout before and after
it runs and exits 3 — a harness safety violation — if anything differs (D3.32). The checkout is
dirty with the author's own work and is allowed to be: what is checked is that Attest changed
nothing. Recorded at the time of this entry: branch `phase14-s2-security`, HEAD `58dcf39`, 36
tracked files differing from HEAD, 23 untracked files.

## The WP3 execution gate

*As recorded before 2026-09-22's structural pass. Since 2026-09-23 it is, again, the only gate:
every structural check passes (see "2026-09-23 — the executor is hardened" below).*

WP3 execution is blocked on one thing, and it is not an engineering task.

Brief §1.1 reserves the intent statement for each negative test to the author. The matrix has
**240 negative tests**, and each needs one sentence naming the attack it simulates. Until those
sentences are the author's, executing the suite would produce 240 evidence records whose
"what attack does this simulate" field was written by the harness — the harness agreeing with
itself, which is the failure the reservation exists to prevent.

As of this record, all 240 carry **AI-generated drafts marked `ai_draft` / `unreviewed`** in
`rubric/author-intents.json`. They are there to be reviewed, corrected or replaced, not to be
adopted by default. `attest preflight-wp3 --for-execution` refuses to pass while any of them is
still unreviewed, and `attest execute-wp3` refuses to start on that refusal.

Nothing about that gate is advisory. It is a non-zero exit.

## One thing besides the intents is blocking

> **Resolved 2026-09-22 (D3.33).** Each F5 row's identity is now read from the caller its own
> attempt names: sixteen rows run as carol and one as anon, and nothing else in any row changed.
> Preflight proves, for all 345 rows, that the operation's caller, the expected result's caller,
> the structured identity and the executor's caller are the same. No intent draft changed. The
> text below is the record of the contradiction as it stood.

**Contradiction C1 — 17 F5 rows whose `identity` contradicts their own `operation`.**

The planner hard-codes `identity: authenticated:alice` on every `F5_SPECS` row, while the
`operation` and `expected` text — which came from `rubric/f5-escalation.ts` — name a different
caller on 17 of them. The approved expectation is only reachable as the caller the operation
names. Measured: run as alice, four of those probes would record a **deficient** verdict against
controls that are working correctly.

It is left blocked rather than worked around, because the executor may not reinterpret an
approved row. `DECISIONS.md` D3.26 has the evidence and the minimal proposed resolution; the
decision is the author's. `attest preflight-wp3 --for-execution` names all 17 and refuses.

## What else is blocking — structural, found 2026-09-22

> **Resolved 2026-09-23 (D3.38–D3.48).** Every class below is closed on the Attest side, nothing
> in Arc21 was touched, and `attest preflight-wp3` passes every structural gate on a freshly
> rebuilt baseline. See "2026-09-23 — the executor is hardened" below. The table is the record of
> what stood.

Resolving C1 meant reconstructing the executor's state from disk, and that showed it is not ready
to produce verdicts that mean what they say, for reasons that have nothing to do with Arc21 or with
the intents. `attest preflight-wp3` now computes each class and refuses on it (`DECISIONS.md`
D3.36, `src/wp3-readiness.ts`):

| | Rows | In one line |
|---|---:|---|
| column / compile | 3 | three `private.game_commands` probes name columns that do not exist |
| R1 | 4 | custom expectations with no implemented assertion |
| R2 | 40 | empty subject sets — twelve empty tables, missing friend-request and queue rows, and an F8 topic parser that keeps a trailing comma |
| R3 | 4 | F3 INSERT positives that omit NOT NULL columns or hit a unique key |
| R4 | 8 | "refusal or no effect" judged by a row count that a single-row function can never satisfy |
| R5 | 18 | premises that do not hold: two contradicted by the shared bob↔carol fixture, one request and one non-friendship that do not exist, and 14 deleted-user rows run with dave's account live |
| R6 | 12 | state claims in an expectation that no state guard checks |
| R7 | 48 | no isolation between probes: 48 commit changes when their control holds, and later probes depend on the state they change |

**All of it is Attest-side.** None of it requires changing Arc21, and none of it was fixed in the
2026-09-22 pass: the largest class, R7, needs an isolation design, and Arc21 grants `service_role`
no table privileges, so the obvious rollback-per-probe design cannot evaluate a state guard without
changing Arc21's grants, which the scope change forbids. Choosing among the remaining designs is a
decision, not a correction. D3.36 lays out the options.

**Also resolved on 2026-09-22.** The tournament-match fixture discrepancy D3.23 recorded: the
match is its own requirement, `tournament_alice_bob_match`, and seed extensions went from 22 to 23
(D3.34). The approved matrix is now frozen in `rubric/wp3-approved-matrix.json`, with the nineteen
corrections to it listed (D3.35).

## 2026-09-23 — the executor is hardened; only the author gate remains

**State recorded 2026-09-23, from runs made that day, not inferred.** Every structural blocker of
2026-09-22 is closed on the Attest side (`DECISIONS.md` D3.38–D3.49); Arc21 was not modified
(fingerprint `13569cf0e2dd36c1…` before and after every command).

| Gate | Result |
|---|---|
| `attest preflight-wp3` (planning) | **passes** — every plan, world and author check, on a freshly rebuilt and verified baseline |
| `attest preflight-wp3 --for-execution` | **fails on exactly two checks, both the AUTHOR INTENT gate**: 240 of 240 sentences are still `ai_draft` / `unreviewed`; every structural gate passes |
| `attest execute-wp3` | **refused** (exit 1) for that reason alone; nothing executed, no evidence written |
| `attest prove-gates` | 64 of 64 injected defects caught, 3 of 3 controls held, real state restored |
| targeted smoke (42 + 5 probes, NOT evidence) | every family, runner and setup exercised; two harness defects found and fixed; three candidates recorded (below) |

**The full 345-probe assessment has not been run**, and no WP3 counts exist. WP4 has not begun.

**Pending the author, before execution:**

1. **240 AUTHOR INTENT sentences** — review, correct or replace each AI draft. Package:
   `evidence/runs/20260923T094706Z-5695a4c3df2d/` (`author-intent-worksheet.md`, 13 files under
   `batches/`, `author-intent-review.tsv`, `author-intent-worksheet.json`), every proposal labelled
   *AI DRAFT — NOT YET ADOPTED BY AUTHOR*; adopt in `rubric/author-intents.json`.
2. **Ten registered approved-row contradictions (57 Test IDs)** — each with evidence and a minimal
   proposed resolution (`DECISIONS.md` D3.46, D3.47; `src/wp3-contradictions.ts`). They do not block
   execution: until decided, those probes run as approved and record `not_measured`.
3. **The reading of `F5.delete_own_account.283`** — its literal expectation is false by Arc21's
   documented host migration (D3.49); restate it, or keep it and weigh it in WP5.

## 2026-09-24 — Gate A: every author decision before WP3, asked once

**State recorded 2026-09-24, from runs made that day.** A project-completion pass began from
`a8d8cfc` (`PROJECT_COMPLETION_PROGRESS.md`). Arc21's fingerprint was `13569cf0e2dd36c1…` before it
and after every command in it.

| | |
|---|---|
| Shared local database | had drifted to the author's own development state (a migration from `~/arc21`, same Supabase project); backed up to `.local-backups/` before Attest rebuilt it; the planner now refuses an instance that is not a build of the migration files (D3.50) |
| `attest preflight-wp3` (planning) | **passes** on a freshly rebuilt baseline: 345 = 63/240/42, 51 fixtures (33 baseline / 14 probe / 4 runtime), 238 premises, 10 contradictions (57 Test IDs) holding live |
| `attest prove-gates` | **66 of 66** injected defects caught, 3 of 3 controls held, real state restored (two injections added: the unbuilt-instance refusal, and the five new draft-quality checks) |
| Intent drafts | independently audited against the final executor: **76 rewritten, 164 unchanged**, all 240 still `ai_draft` / `unreviewed`, 0 adopted (D3.51) |
| Contradictions | re-derived; every proposed alternative checked against the live mechanism in a rolled-back transaction; one registration's text corrected; two planning misreadings found (C4, and `delete_own_account` wrongly classed caller-scoped) (D3.52) |
| WP3 execution | **not run**; refused only by the intent gate |

**The decision packet:** `WP3_AUTHOR_DECISIONS_REQUIRED.md` (full), `WP3_AUTHOR_DECISIONS_COMPACT.md`
(one page), `rubric/wp3-gate-a-decisions.json` (template, every decision `pending`), and the
generated review table `evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.md`.

**A correction to the 2026-09-23 record.** "54 of the 240 rows also carry a pending contradiction"
(`WP3_AUTHOR_REVIEW.md`) should read **53**: 57 contradicted Test IDs, four of them positives.

## 2026-09-24 — Gate A answered and applied

The author answered Gate A in the project-completion session on 2026-09-24 and authorised WP3
execution once every gate passes; the next human stop is CP4, after WP5. Applied exactly
(`DECISIONS.md` D3.54, `npm run attest apply-gate-a`):

| | |
|---|---|
| AUTHOR INTENT | **240 of 240 adopted**: 117 (A) + 107 (B) + 11 (C) approved as written, 5 (C) with wording the author supplied — all recorded `user_reviewed_ai_draft` / `approved`; **0 `user_authored`** (the author's instruction) |
| Contradictions corrected | 8 registrations resolved, 51 frozen-field corrections listed in the manifest (43 operation, 2 expected, 2 covers, 1 identity, 3 fixture) — 345 = 63/240/42 unchanged |
| Kept `not_measured` | 13 Test IDs: `C2-grant-before-trigger` (F9.319, .321) and `C5-deleted-user-subject-empty` (11 CASCADE rows) |
| `F5.delete_own_account.283` | a function-specific invariant: caller-owned effects, only the documented cleanup/reassignment, anything else forbidden |
| `F5.register_push_token.269` | `covers` corrected to the direction the function body establishes; verdict not prejudged |
| Gates after applying | semantic validation clean; draft quality clean; planning preflight passes (241 premises); `prove-gates` 67/67 caught, 3/3 controls held |

## 2026-09-25 — WP3 executed

The authorised assessment ran three times from clean committed trees; all three runs are kept,
unedited, and only the third is the result (`DECISIONS.md` D3.55).

| Run | Records | Validation | Disposition |
|---|---:|---|---|
| `20260924T203033Z-5695a4c3df2d` | 345 | fails 1 of 19 checks | **superseded**: three F9 records carried no read-back identity, and a heuristic defect mis-judged eleven F10 audit absences |
| `20260925T010904Z-5695a4c3df2d` | 55 | fails (aborted) | **aborted**: a `supabase db reset` failed while the CLI restarted containers on an overloaded host |
| `20260925T014011Z-5695a4c3df2d` | 345 | **passes all 19 checks** | **the WP3 result** |

The result, by verdict: **283 effective, 19 gap, 25 characterized, 5 deficient, 13 not measured**. Arc21's fingerprint `13569cf0e2dd36c1…` was identical before
and after every run. The findings, ranking and remediation guidance are WP5's (`FINDINGS.md`).

## 2026-09-25 — CP4 reached: presented, awaiting the author

WP4 ran Arc21's own earlier schemas against today's approved questions (run `20260925T042837Z-wp4`, D3.56), and
WP5 turned the validated WP3 result into ranked findings with remediation guidance and verification
procedures (`FINDINGS.md`, D3.57). **The CP4 packet is `CP4_PACKET.md`.**

| | |
|---|---|
| WP3 result | run `20260925T014011Z-5695a4c3df2d`, validation passes 19/19 — 283 effective, 19 gap, 25 characterized, 5 deficient, 13 not measured |
| WP4 | run `20260925T042837Z-wp4`: four states (Arc21 at 2026-08-30 and 2026-09-02, today, and today plus one Attest-only table); no pass → fail anywhere in Arc21's history, six fail → pass; the unprotected test table caught on the run that added it; two earlier WP4 runs stopped and kept (D3.56) |
| WP5 | 4 findings (A1–A4), 4 informational items (B1–B4), 2 limitations (C1–C2); every one of the 62 non-effective records belongs to exactly one |
| Awaiting the author | 8 status decisions, 8 narratives, 14 judgments, and the CP4 approval itself |

**Nothing is approved on the author's behalf.** Every status, every narrative and the approval are
blank until the author answers in the format of `CP4_PACKET.md` §7; the narrative store
(`rubric/wp5-author-narratives.json`) is created with every entry `awaiting_author`. No finding was
remediated and none is closed: Arc21 is a read-only target.

## Candidate findings on the table (smoke, not WP3 results) — superseded by the WP3 result

> **2026-09-25.** The official run settles what the smoke could only suggest: `F5.register_push_token.269`
> and `F5.leaderboard_weekly_xp.271` are `deficient`, as are three more leaderboard functions
> (`.273`, `.274`, `.275`); `F5.delete_own_account.283` is `effective` under the invariant the author
> defined at Gate A. What they mean, their rank and the remediation guidance are WP5's (`FINDINGS.md`).
> The text below is kept as it was written.

> **Updated 2026-09-23.** The hardened executor's smoke reproduced the candidate below and
> surfaced two more; D3.49 has the records. `F5.leaderboard_weekly_xp.271`: the weekly XP board
> shows "Erin", an account whose privacy is `private`. `F5.delete_own_account.283`: deleting alice's
> account hands the lobby she hosted to bob — Arc21's documented design, and the one row naming
> another account that changed — which falsifies the approved expectation's literal "no bob or
> carol row … changes"; that reading is the author's. None is a WP3 result; none is fixed.

Proving the executor's plumbing on 23 probes surfaced a result the author should see before the
real run: `F5.register_push_token.269` failed its post-probe state guard. Alice calling
`register_push_token` with bob's token string left that row attributed to alice. The mechanism is
`on conflict (token) do update set user_id = v_me` inside a `SECURITY DEFINER` function.

**It is not a WP3 result.** It is one probe from a plumbing smoke set, run before the suite is
authorised. `DECISIONS.md` D3.30 records it as a candidate for WP5's findings narrative, which is
the author's to write, and it needs confirming in the real run.

**After the scope change it stays exactly that.** `register_push_token` and its migration are not
touched. If the authorised run reproduces the behaviour, it becomes a finding candidate for WP5's
reporting and remediation *guidance* — never a fix made by Attest.

## What the frozen WP3 plan is

Preserved so that a later regeneration can be checked against it rather than trusted:

| | |
|---|---:|
| Unique Test IDs | **345** |
| Positive | 63 |
| Negative (each requiring one AUTHOR INTENT sentence) | **240** |
| Characterization (requiring none) | 42 |
| **63 + 240 + 42** | **345** |

Schema version under test: `5695a4c3df2d3f6c6311999ae268f776e96c3beb657e8a8a466be2ebb62aabec`
(59 migrations). The planning run that produced the approved matrix is
`20260922T071548Z-5695a4c3df2d`.

Since 2026-09-22 the approved matrix is also frozen as `rubric/wp3-approved-matrix.json`: the same
345 Test IDs in order, with the nineteen corrections made to it — seventeen C1 identities and two
tournament-match fixtures — listed inside the file, each with its reason. Preflight refuses a plan
that differs from it in any other way. The first planning run under the corrected planner is
`20260923T042007Z-5695a4c3df2d`; the counts above are unchanged.

These counts are a machine-checked invariant (D3.21) and are re-verified by preflight on every
run. If a regeneration changes them, that is a contradiction to surface, not a number to
update quietly.

## Related

- `DECISIONS.md` — the judgment calls behind each work package. This file records *state*;
  that file records *reasoning*.
- `RUBRIC.md` — the risk rubric, authored by the author, frozen at CP3.
- `rubric/author-intents.json` — the canonical intent store and the review state of each of
  the 240 sentences.
