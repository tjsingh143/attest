# WP3 — the author-review gate

**Status, 2026-09-23.** Attest's WP3 executor is structurally complete and every structural gate
passes. **The WP3 assessment has NOT been run**; there are no WP3 counts, verdicts or findings. It is
refused for exactly one reason: the 240 AUTHOR INTENT sentences are AI drafts, and brief §1.1 makes
them the author's. Nothing here has been approved on the author's behalf, and no AI wording is
labelled as the author's.

This file is the hand-off. The reasoning is in `DECISIONS.md` (D3.38–D3.49), the state in
`CHECKPOINTS.md`, the engineering log in `WP3_IMPLEMENTATION_PROGRESS.md`.

## What stands, measured today

| | |
|---|---|
| Approved matrix | 345 Test IDs (63 positive / 240 negative / 42 characterization), frozen in `rubric/wp3-approved-matrix.json`; 114 listed corrections (17 identity, 97 fixture), no frozen field changed |
| Executor | every row derives one probe, is bound (premises, guards, catalog facts, references, result checks) and is judged claim by claim; 72 claim templates cover all 345 expectations |
| Isolation | rebuild from Arc21's migrations after any state change, baseline re-verified each time (33.6 s per rebuild, measured) |
| Fixtures | 51 plan-stated requirements, 51 Attest-side implementations (33 baseline, 14 probe-scoped, 4 runtime), all verified live |
| `preflight-wp3 --for-execution` | fails ONLY on "every required intent is authored or reviewed by the author" and "no AI draft is permitted in a real run" |
| `execute-wp3` | refused, exit 1, nothing executed |
| `prove-gates` | 64/64 injected defects caught, 3/3 controls held, real state restored |
| Arc21 | fingerprint `13569cf0e2dd36c10365c333820093de5013dad09e0fddb65bb041e16533eaf1` before this pass and after it; never modified, cleaned, reset or committed |

## What the author decides

### 1. The 240 intent sentences (required before execution)

Every proposal is labelled **AI DRAFT — NOT YET ADOPTED BY AUTHOR**.

| File | Use |
|---|---|
| `evidence/runs/20260923T094706Z-5695a4c3df2d/author-intent-worksheet.md` | all 240, grouped by family, each beside its probe |
| `evidence/runs/20260923T094706Z-5695a4c3df2d/batches/intent-batch-01.md` … `-13.md` | the same, in 13 sittings of ~25 |
| `evidence/runs/20260923T094706Z-5695a4c3df2d/author-intent-review.tsv` | Test ID, label, provenance, status, sentence — a fast pass in a spreadsheet |
| `evidence/runs/20260923T094706Z-5695a4c3df2d/author-intent-worksheet.json` | machine-readable, per-row label |
| **`rubric/author-intents.json`** | **the canonical store — the only file to edit** |

For each entry: if the draft says what you would have said, set
`"provenance": "user_reviewed_ai_draft", "reviewStatus": "approved"`; otherwise replace `intent`
with your own sentence and set `"provenance": "user_authored", "reviewStatus": "approved"`.
54 of the 240 rows also carry a pending contradiction (below); the worksheet says so beside them.

### 2. Ten approved-row contradictions (57 Test IDs) — do not block execution

Each is an approved row whose expectation the system makes unmeasurable. Until decided, the
executor runs the probe exactly as approved and records `blocked_contradiction` → `not_measured`;
each has a live check, so a registration that stops holding fails preflight.

| Id | Test IDs | Smallest change proposed |
|---|---|---|
| C2-client-guard-before-grant | 34 F2 UPDATE/DELETE rows | add a WHERE clause (`where true` suffices): pg_safeupdate, preloaded for `authenticator`, refuses these at parse analysis before the grant |
| C3-tier-literal-invalid | F2.094 | use a real `table_tier` label (e.g. `'casual'`), and add the WHERE clause |
| C2-grant-before-trigger | F9.319, .321 | restate as the 42501 privilege refusal, or keep the server-side rows as the trigger's evidence |
| C2-fk-before-truncate-trigger | F9.322 | restate as the 0A000 FK refusal, or `truncate … cascade` so the trigger answers |
| C2-definer-bypasses-named-policy | F5.259 | name the body's `is_blocked_between` refusal (PT404), not the RLS policy |
| C3-sender-cannot-accept | F3.059 | use the sender's transition (`'cancelled'`), or have the receiver accept |
| C3-username-literal-invalid | F3.151, F6.153 | a valid username literal, e.g. `'attest_probe_user'` |
| C3-cosmetic-literal-invalid | F6.117 | a cosmetic alice owns, or NULL |
| C4-anon-has-no-execute | F5.278 | run as authenticated, or restate as the 42501 refusal |
| C5-deleted-user-subject-empty | 14 B rows | target what the cascade leaves behind, or accept as characterization |

Full evidence: `DECISIONS.md` D3.46–D3.47; `src/wp3-contradictions.ts`.

### 3. The reading of `F5.delete_own_account.283`

Exercised properly (alice stood up by a probe setup, Arc21's active-seat rule untouched, the
deletion ran): the one row naming another account that changed is the lobby alice hosted, now
hosted by bob — Arc21's documented handover. The approved text says "no bob or carol row …
changes". Restate the expectation, or keep it and weigh the behaviour in WP5 (D3.49).

## Candidates the smoke surfaced (NOT WP3 results; nothing fixed)

| Test ID | Observed |
|---|---|
| F5.register_push_token.269 | alice registering bob's token string reassigns it to alice (`on conflict (token) do update set user_id = v_me`, SECURITY DEFINER) |
| F5.leaderboard_weekly_xp.271 | a `private`-privacy account ("Erin") appears on the weekly XP board |
| F5.delete_own_account.283 | as above |

## The command, after the author has adopted all 240

```sh
npm run attest preflight-wp3 -- --for-execution   # must pass: every gate, including the author's
npm run attest execute-wp3 -- --confirm           # the WP3 assessment, one command
```

`execute-wp3 --confirm` re-runs preflight, rebuilds the disposable database, runs all 345 approved
probes with rebuild isolation (at least 60 rebuilds — about 40–50 minutes), writes one evidence
record per Test ID to `evidence/runs/<run-id>/wp3-results.json`, re-fingerprints Arc21, and exits
1 on any harness error or aborted run (a rebuild or baseline that does not verify stops it, keeping
the records made so far, marked ABORTED), 3 on any change to Arc21. Without `--confirm` it stops
after preflight.

## prove-gates — every gate broken on purpose (final run, 2026-09-23)

Plan defects run through `planChecks` (the static half of preflight) on a deep copy; world defects
are staged in rolled-back transactions and run through the live check itself; judgement defects hand
the judge a genuine database outcome with every other input satisfied; the Arc21 guard is proven on
a throwaway git repository. Consequence = the exit status preflight or the run would give, or the
observation → verdict the record would carry.

| # | Injected defect | Gate | Caught | Consequence | What fired |
|---:|---|---|:---:|---|---|
| 1 | (control) the real, unbroken plan | planChecks — the static half of preflight | **yes** | no static check fails (exit 0 as far as the plan is concerned) | all 21 static checks pass |
| 2 | a Test ID is missing from the plan | preflight: 345 Test IDs; the plan is the approved matrix | **yes** | preflight FAILS → exit 1; nothing executes | the plan carries 345 Test IDs: 344 \| polarity accounting reconciles: every Test ID is exactly one of the three supported polarities: 63 positive + 240 negative + 41 characterization = 344 of 344 — DIFFERS from the frozen 63/240/42 \| the plan is the approved  |
| 3 | an extra Test ID appears (a probe with no approved row) | preflight: the plan is the approved matrix; no implementation without a planned row | **yes** | preflight FAILS → exit 1; nothing executes | the plan carries 345 Test IDs: 346 \| polarity accounting reconciles: every Test ID is exactly one of the three supported polarities: 63 positive + 241 negative + 42 characterization = 346 of 346 — DIFFERS from the frozen 63/240/42 \| the plan is the approved  |
| 4 | an approved Test ID is substituted, leaving the count at 345 | preflight: the plan is the approved matrix | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 approved Test ID(s) missing: F10.private_game_state_private.021; 1 Test ID(s) not in the approved matrix: F1.substituted.998 |
| 5 | a duplicate Test ID (two rows, one ID) | preflight: every Test ID is unique; semantic: one Test ID = one probe | **yes** | preflight FAILS → exit 1; nothing executes | every Test ID is unique: 344 unique of 345 \| the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 approved Test ID(s) missing: F10.private_career_drill_seeds.006; 1 duplicated; 1 row(s) whose operation, expected, covers or ot |
| 6 | a row carries a fourth, unsupported polarity | preflight: polarity accounting reconciles | **yes** | preflight FAILS → exit 1; nothing executes | polarity accounting reconciles: every Test ID is exactly one of the three supported polarities: 63 positive + 239 negative + 42 characterization = 344 of 345 — DIFFERS from the frozen 63/240/42; 1 row(s) carry an unsupported polarity \| the plan is the approve |
| 7 | an approved row's expected result is edited | preflight: no frozen field changed | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 row(s) whose operation, expected, covers or other frozen field changed: F5.caller_is_room_member.252 \| every row binds: claims, premises, guards, references: F5.caller_is_r |
| 8 | an unresolved placeholder survives into an operation | semantic validator: no placeholders | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 row(s) whose operation, expected, covers or other frozen field changed: F2.private_career_drill_seeds.001 \| no placeholder, multi-probe or multi-identity row (semantic vali |
| 9 | one Test ID bundles two probes (delete, then truncate) | semantic validator: one probe per row | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 row(s) whose operation, expected, covers or other frozen field changed: F2.private_career_drill_seeds.001 \| no placeholder, multi-probe or multi-identity row (semantic vali |
| 10 | one Test ID names two execution identities | semantic validator: one identity per row; identity consistency | **yes** | preflight FAILS → exit 1; nothing executes | identities and fixtures differ from the approved run only by the listed corrections: 1 unlisted identity change(s), 0 unlisted fixture change(s): F1.public_game_events.073: "authenticated:carol" -> "authenticated:carol and as authenticated:bob" \| no placehold |
| 11 | an F5 row's caller metadata reverts to alice while its operation names carol (the C1 defect) | preflight: identity agrees with operation / expected / executor (C1); identities match the manifest | **yes** | preflight FAILS → exit 1; nothing executes | identities and fixtures differ from the approved run only by the listed corrections: 1 unlisted identity change(s), 0 unlisted fixture change(s): F5.get_room_state.246: "authenticated:carol" -> "authenticated:alice" \| no Test ID carries an unresolved plan con |
| 12 | a row names a fixture that does not exist | preflight: implemented Test IDs equal planned Test IDs (derivation) | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 row(s) whose operation, expected, covers or other frozen field changed: F1.public_blocks.023 \| implemented Test IDs equal planned Test IDs: 1 row(s) have no executable deri |
| 13 | an approved expectation no claim template covers (an unknown custom expectation) | preflight: [R1] every claim has an evaluator; every row binds | **yes** | preflight FAILS → exit 1; nothing executes | the plan is the approved matrix: same Test IDs, same order, no frozen field changed: 1 row(s) whose operation, expected, covers or other frozen field changed: F10.private_game_commands.013 \| every row binds: claims, premises, guards, references: F10.private_g |
| 14 | a required fixture has no implementation (tournament_alice_bob_match removed) | preflight: every required seed extension has an implementation | **yes** | preflight FAILS → exit 1; nothing executes | every required seed extension has an Attest-side implementation of the same scope, and nothing else is implemented: 1 unimplemented (tournament_alice_bob_match), 0 implemented but not required (none), scope mismatch: none |
| 15 | a required fixture is implemented with the wrong scope (a probe-scoped setup made baseline) | preflight: every required seed extension has an implementation of the same scope | **yes** | preflight FAILS → exit 1; nothing executes | every required seed extension has an Attest-side implementation of the same scope, and nothing else is implemented: 0 unimplemented (none), 0 implemented but not required (none), scope mismatch: probe:dave_deleted |
| 16 | the executor derives a caller other than the row's structured identity | preflight: identity agrees with the executor's caller | **yes** | preflight FAILS → exit 1; nothing executes | 76 row(s) flagged, e.g. F4.private_career_drill_seeds.004: identity is anon but the executor derives authenticated:alice; F4.private_game_commands.010: identity is anon but the executor derives authenticated:alice |
| 17 | a derived probe binds signature text, an elision or an unresolved fixture reference as its argument | preflight: no unresolved placeholder, elision or signature text reaches an executed statement or parameter | **yes** | preflight FAILS → exit 1; nothing executes | real specs: 0 flagged; with 'p_action text': F5.remove_room_member.245; with '...': F5.remove_room_member.245; with 'fixtures.bob.id': F5.remove_room_member.245 |
| 18 | a derived probe issues two mutating commands (one Test ID, two probes) | preflight: one derived probe issues one mutating command | **yes** | preflight FAILS → exit 1; nothing executes | real specs: 0 bundled; injected: F2.private_career_drill_seeds.003 |
| 19 | F10.private_game_commands.013: a client UPDATE loses its WHERE clause — pg_safeupdate would refuse it before the policy under test | preflight: no client probe is refused by the connection's own guard before its control, unless registered | **yes** | preflight FAILS → exit 1; nothing executes | unregistered hazards: F10.private_game_commands.013; the real plan's 34 hazards are all registered |
| 20 | the second assertion of a compound expectation is dropped ("1 row affected, and the row is still attributed to alice afterwards", 3 rows) | preflight: [R1] every claim of every approved expectation has an evaluator (compound coverage) | **yes** | preflight FAILS → exit 1; nothing executes | the second span deleted: 3 issue(s) — no template consumes the whole text: "1 row affected, and the row is still attributed to alice afterwards" \| the second span relabelled a connective: 3 issue(s) — connective span "the row is still attributed to alice afte |
| 21 | F3.public_friend_requests.059: the write succeeds (1 row) but the row is re-attributed — only the SECOND claim fails | judge: every claim is judged; one unmet claim cannot be outvoted by a met one | **yes** | record: not_as_predicted → deficient | rows_affected=1=met, state:still_attributed=unmet |
| 22 | F3.public_friend_requests.059: a state claim with its guard removed | preflight: [R6] every state claim has a guard | **yes** | preflight FAILS → exit 1; nothing executes; even unguarded at run time the claim is record: harness_error → not_measured; execute-wp3 exits 1 (a harness error is never a result) | real bindings: clear; broken: "the row is still attributed to alice afterwards" (state:still_attributed): no state guard 'still_attributed' is bound — the state claim would go unchecked; and if it ran anyway: harness_error |
| 23 | F5.set_room_ready.247: the call returns NULL (void) — "no effect" inferred from the return value | preflight: [R4] no-effect is judged from a state guard; judge: a return value is never 'no effect' | **yes** | preflight FAILS → exit 1; nothing executes; at run time a NULL return with changed state is deficient, and with no guard is not_measured | guard removed → R4 clear, R6 FAILS; NULL return + state changed → not_as_predicted/deficient; NULL return + no guard → harness_error/not_measured |
| 24 | F10.private_game_commands.013: a negative whose verdict depends on rows loses the premise that its subject is non-empty | preflight: [R2] no probe can pass on an absent target | **yes** | preflight FAILS → exit 1; nothing executes | the probe acts on rows, and no premise makes its subject non-empty |
| 25 | F1.public_career_attempts.032: the rows the negative probes are absent (a vacuous "no data") | preflight: [R5/R2 live] every subject premise holds | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: holds; staged: F1.public_career_attempts.032 — rows the probe's own WHERE selects (at least one, so the result is not vacuous): rows the probe's own WHERE selects (at least one, so the result is not vacuous): 0 (need >= 1) |
| 26 | F1.public_game_events.072: a positive's prerequisite is invalid (alice's seat has been left) | preflight: [R5] every positive's premise holds | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: holds; staged: F1.public_game_events.072 — alice's live seat at the session: alice's live seat at the session: 0 (need 1) |
| 27 | F3.public_blocks.026: a row with the positive's unique key already exists (a duplicate key would refuse before WITH CHECK) | preflight: [R3] every positive reaches its control | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: holds; staged: F3.public_blocks.026 — a row with (blocker_id, blocked_id) = (00000000-0000-4000-8000-00000000000a, 00000000-0000-4000-8000-00000000000c) already exists; the positive would hit a unique key, not WITH CHECK |
| 28 | F3.public_blocks.026: the positive INSERT hits a genuine unique violation (23505) | judge: a constraint that fires is not the policy under test | **yes** | record: precondition_failed → not_measured | 23505 duplicate key value violates unique constraint "blocks_unique_pair"; claims: rows_affected=1=unmeasurable/precondition |
| 29 | B.private_game_commands.323: the deleted-user probe runs with dave's account still live (the setup that deletes it skipped) | preflight: [R5] the deleted-user premise holds (C5 excuses only the empty subject, never 'dave is deleted') | **yes** | preflight FAILS → exit 1; nothing executes | with the deletion: holds; without: probe-scoped fixture probe:dave_deleted holds: auth.users rows for dave: 1 (need 0), profiles rows for dave: 1 (need 0) |
| 30 | F8.realtime_messages.308: the probe reads topic "game:e0000000-0000-4000-8000-000000000001," (the old parser kept the comma) | preflight: [R5/R2 live] the topic's subject rows exist; derivation: the topic is exactly the fixture's | **yes** | preflight FAILS → exit 1; nothing executes | exact topic: subject holds; with the comma: rows the probe's own WHERE selects (at least one, so the result is not vacuous): rows the probe's own WHERE selects (at least one, so the result is not vacuous): 0 (need >= 1); the current parser yields "game:e000000 |
| 31 | the tournament-match fixture is absent | preflight: every baseline and runtime fixture holds live (tournament_alice_bob_match) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: match bbbb0000-0000-4000-8000-000000000001 present; in fixtures.tournamentAliceBob: true; slot A is alice's entry in it: true; slot B is bob's entry in it: true; pending, round 1, slot 0, no winner: true; carol in that tournament's bracket: 0 (need 0 |
| 32 | the tournament match sits in the wrong tournament | preflight: every baseline and runtime fixture holds live (tournament_alice_bob_match) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: match bbbb0000-0000-4000-8000-000000000001 present; in fixtures.tournamentAliceBob: true; slot A is alice's entry in it: true; slot B is bob's entry in it: true; pending, round 1, slot 0, no winner: true; carol in that tournament's bracket: 0 (need 0 |
| 33 | the tournament match has the wrong participants (bob's slot emptied) | preflight: every baseline and runtime fixture holds live (tournament_alice_bob_match) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: match bbbb0000-0000-4000-8000-000000000001 present; in fixtures.tournamentAliceBob: true; slot A is alice's entry in it: true; slot B is bob's entry in it: true; pending, round 1, slot 0, no winner: true; carol in that tournament's bracket: 0 (need 0 |
| 34 | the tournament match is in the wrong state (completed, with a winner) | preflight: every baseline and runtime fixture holds live (tournament_alice_bob_match) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: match bbbb0000-0000-4000-8000-000000000001 present; in fixtures.tournamentAliceBob: true; slot A is alice's entry in it: true; slot B is bob's entry in it: true; pending, round 1, slot 0, no winner: true; carol in that tournament's bracket: 0 (need 0 |
| 35 | a fixture exists with the wrong value (the falsifying inactive cosmetic made active) | preflight: every baseline and runtime fixture holds live (anon_falsifying_row:public.cosmetics) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: cosmetics row with is_active = false: 1; staged: cosmetics row with is_active = false: 0 |
| 36 | erin, the private-privacy subject of the leaderboard claims, is made public | preflight: every baseline and runtime fixture holds live (account:erin) | **yes** | preflight FAILS → exit 1; nothing executes | unbroken: erin profile with privacy private and display name Erin: 1 (need 1), erin wallet: 1 (need 1); staged: erin profile with privacy private and display name Erin: 0 (need 1), erin wallet: 1 (need 1) |
| 37 | a probe classified as read-only leaves a row behind (carol→erin block) — the next probe would inherit it | isolation: the post-probe digest forces a rebuild; baseline verification refuses contaminated state | **yes** | the next probe runs on a rebuilt, re-verified baseline; a baseline that does not verify stops the run (exit 1) | digest moved: public.blocks; dirtyReason → the probe changed public.blocks; baseline verification refused: the baseline's row counts differ from this run's canonical baseline: public.blocks 2 -> 3; unchanged state → no rebuild; after rollback the baseline veri |
| 38 | a harness exception is presented as the database's answer (all 345 rows, every other input satisfied) | judge: a harness error is never a refusal, never a pass | **yes** | record: harness_error → not_measured; execute-wp3 exits 1 | all 345 rows → harness_error / not_measured |
| 39 | a malformed probe's genuine 42601 ("syntax error at or near "selec"") meets every refusal expectation | judge: a malformed statement is the harness's fault, not a refusal | **yes** | record: harness_error → not_measured; execute-wp3 exits 1 | all 240 negatives → harness_error / not_measured (mechanism 'malformed') |
| 40 | F5.delete_own_account.283 on the baseline, where alice holds a live seat: the call is refused by the active-seat rule (P0001 'leave your table before deleting your account') | judge: a business prerequisite is not the security property (D3.41); .283's own setup stands alice up first | **yes** | record: control_not_reached → not_measured | result:only_own=unmeasurable/not_reached, state:only_own_altered=met, result:excludes_bob_carol=unmeasurable/not_reached, state:no_bob_carol_change=met, reachability=met |
| 41 | a client guard's genuine 21000 ('UPDATE requires a WHERE clause') is read as the grant surface's answer | judge: pg_safeupdate refuses BEFORE the privilege check, so the privilege claim was not reached (never 'passed', never 'deficient') | **yes** | record: control_not_reached → not_measured (unregistered) / blocked_contradiction → not_measured (registered) | all 51 grant-surface negatives → control_not_reached / not_measured when unregistered; F2.public_game_sessions.095 as registered → blocked_contradiction |
| 42 | F2.private_career_drill_seeds.001: a claim names an evaluator nobody implements ("custom:attacker_discouraged") | preflight: [R1] every evaluator is implemented; judge: an unknown expectation is a harness error, never met | **yes** | record: harness_error → not_measured; execute-wp3 exits 1 (a harness error is never a result) | custom:attacker_discouraged=unmeasurable/harness: no evaluator for custom:attacker_discouraged |
| 43 | F5.leaderboard_weekly_xp.271: the leaderboard returns no rows, so "no private-privacy identity appears" would be true of nothing | judge: an empty result cannot satisfy a claim about what the result contains (R2) | **yes** | record: precondition_failed → not_measured | result:no_private_identity=unmeasurable/precondition, result:leaderboard_columns_only=met |
| 44 | a role property the control tests rest on is inverted (postgres, authenticator) | preflight: role properties match what the plan assumes | **yes** | preflight FAILS → exit 1; nothing executes | live: hold; each of three inverted: refused, refused, refused |
| 45 | the F7 scratch roles are built with the wrong properties | preflight: [F7] the scratch roles carry exactly the properties the mechanism rests on | **yes** | preflight FAILS → exit 1; nothing executes | correct properties: accepted; the bypass role lacks BYPASSRLS: refused; the owner role holds BYPASSRLS: refused; the bypass role owns the table: refused; the bypass role is a member of the owner role: refused; a scratch role is a superuser: refused |
| 46 | the Realtime service is unreachable while F8 socket probes are planned | preflight: [F8] the local Realtime service is healthy | **yes** | preflight FAILS → exit 1; nothing executes | pointed at a closed port: http://127.0.0.1:9/realtime/v1/api/tenants/realtime-dev/health unreachable: fetch failed; the live service: http://127.0.0.1:54321/realtime/v1/api/tenants/realtime-dev/health -> HTTP 200, healthy: true |
| 47 | Realtime stops delivering mid-run: no subscriber — authorised or not — receives anything (silence everywhere) | socket runner: silence counts only inside a window an observer proved live | **yes** | record: precondition_failed → not_measured | every socket row → precondition_failed / not_measured (neither 'refused' nor 'did not receive') |
| 48 | a socket probe presents a token for a different subject than the row's identity | socket runner: the identity premise is read back from the token presented | **yes** | record: precondition_failed → not_measured | every socket row → precondition_failed / not_measured |
| 49 | an evidence record missing required fields, a harness error carrying a verdict, an 'effective' with an unmet claim | evidence schema: validateRecord | **yes** | preflight FAILS → exit 1; nothing executes | missing: 36 problem(s) (missing field recordId; missing field runId); harness+effective: observation harness_error must carry verdict not_measured, not effective; an effective verdict requires observation as_predicted; unmet+effective: missing field claims; an |
| 50 | an intent entry is missing for a required Test ID | intent validation: every matrix negative has a canonical entry | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | every matrix negative has a canonical entry: 1 missing: B.private_game_commands.323 |
| 51 | the store carries an entry the matrix does not require | intent validation: no entry that the matrix does not require | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | no entry that the matrix does not require: 1 extra: F1.not.a.real.test |
| 52 | an intent is blank | intent validation: no entry carries a blank sentence | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | no entry carries a blank sentence: 1 blank: B.private_game_commands.323 |
| 53 | a Test ID appears twice in the store | intent validation: no duplicate Test ID | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | no duplicate Test ID in the store: 1 duplicated: B.private_game_commands.323 |
| 54 | every required intent is still an unreviewed AI draft, and a real run is requested | intent validation: every required intent is authored or reviewed by the author | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | every required intent is authored or reviewed by the author: 240 of 240 still awaiting the author (240 ai_draft, 0 unreviewed) |
| 55 | an ai_draft is marked approved without changing its provenance | intent validation: no ai_draft is marked approved | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | no ai_draft is marked approved: 1 marked approved while still ai_draft — set provenance to user_reviewed_ai_draft or user_authored: B.private_game_commands.323 |
| 56 | a draft relabelled user_reviewed_ai_draft but left unreviewed | intent validation: every required intent is authored or reviewed by the author | **yes** | preflight --for-execution FAILS → execute-wp3 exits 1; nothing executes | every required intent is authored or reviewed by the author: 1 of 240 still awaiting the author (0 ai_draft, 1 unreviewed) |
| 57 | a draft describes the test rather than the attack | draft quality: names the attack, not the test | **yes** | draft-intents refuses the package (exit 1) | names the attack, not the test; describes the objective, not the expected error |
| 58 | a draft carries a grammatical defect ('a other party') | draft quality: article agreement | **yes** | draft-intents refuses the package (exit 1) | article agreement: "a other" — the noun takes "an" (or "another"); function-specific, not generic: does not name accept_friend_request(), so it could be about any SECURITY DEFINER function |
| 59 | two probes are given the same sentence | draft quality: no two probes share a sentence | **yes** | draft-intents refuses the package (exit 1) | 2 probes carry identical wording: F1.public_blocks.023, F2.private_career_drill_seeds.001 |
| 60 | (control) a dirty checkout, unchanged between two fingerprints | arc21 guard: pre == post | **yes** | exit unaffected | identical, although the checkout is dirty — pre-existing changes are accepted, not reverted |
| 61 | Arc21 source mutation: a tracked source file's content changes (e.g. a migration or RLS policy edited) | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | a tracked file's content changed in the working tree |
| 62 | Arc21 source mutation: a new untracked file appears | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | git status reports a different set of changes; untracked file appeared: stray.sql |
| 63 | Arc21 source mutation: an existing untracked file (like the uncommitted migration) is edited | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | untracked file's content changed: untracked.sql |
| 64 | Arc21 source mutation: a change is staged | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | the index changed: something was staged or unstaged; the staged diff against HEAD changed; a tracked file's content changed in the working tree; git status reports a different set of changes |
| 65 | Arc21 source mutation: a credential file is written into an ignored path | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | ignored path appeared: jwt.secret — check it is not a credential or artefact written by the harness |
| 66 | Arc21 source mutation: a commit is made | arc21 guard: pre == post | **yes** | HARNESS SAFETY VIOLATION → exit 3 (nothing is reverted automatically) | HEAD moved: d4072590a533 -> f69361f63546 (a commit, checkout or reset happened); a ref changed: a branch, tag or stash was created, moved or deleted |
| 67 | (control) the real plan, intent store and database after every injection | prove-gates restores everything it breaks | **yes** | nothing real was changed | plan and store byte-identical; every table and sequence digests as before |
