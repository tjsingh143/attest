# Project completion — durable progress log

**This is an engineering work log, not evidence.** Nothing in it is a WP3 result, a finding or an
approval. It exists so that the project-completion mission (WP3 execution through WP7) can be
resumed from the repository after a context boundary rather than from a conversation. If this
file and the repository disagree, the repository wins — re-derive, then correct this file.

No credential, JWT or secret is ever written here.

Predecessor log (implementation-preparation pass, complete): `WP3_IMPLEMENTATION_PROGRESS.md`.

## Governing documents

- `PROJECT_BRIEF.md` — gitignored, local only; the governing spec. **Amendment A1 (2026-09-22)
  governs where it conflicts with the original text: Arc21 is a read-only assessment target; WP5
  is Findings, Risk Prioritization and Remediation Guidance; nothing is remediated; no closure is
  claimed.**
- Brief §1.1 reserves four artifacts to the author: the risk rubric (WP2, done), the intent
  sentence for each negative test (WP3), the findings narrative (WP5), the framework-mapping
  rationales (WP6). The harness may draft, structure and challenge; it may not author or approve.
- Brief §9: CP4 after WP5, CP5 after WP6, each a real stop for explicit author approval.
- Brief §10: definition of done (as amended by A1).
- **Amendment A2 (2026-09-25, recorded with the CP4 reply; D3.58):** prospective only. Remaining
  narrative (the CP4 narrative, WP6 rationales, report prose) may be AI-drafted and is labelled so —
  never as independently human-authored; CP5's separate interaction is waived by the author and
  recorded as superseded, not approved; no further routine stops after CP4. Stops remain only for:
  modifying Arc21, destroying unrecoverable user data, exposing a secret, misstating evidence or
  provenance, an irreducible contradiction.

## Starting point (verified from disk 2026-09-24, before any edit in this mission)

| | |
|---|---|
| Attest branch / HEAD | `main` @ `a8d8cfc` ("WP3: harden executor and reach author-review gate"), up to date with `origin/main` (`github.com/tjsingh143/attest`) |
| Attest working tree | clean except the untracked personal `Attest RESUME_HANDOFF.md` (kept out of Git by convention) |
| Arc21 checkout | `arc21 copy/`, branch `phase14-s2-security` @ `58dcf39fc66a…`, 36 tracked files differing from HEAD, 23 untracked, 13 ignored entries — the author's pre-existing work, not cleaned |
| Arc21 fingerprint (pre-mission) | `13569cf0e2dd36c10365c333820093de5013dad09e0fddb65bb041e16533eaf1` — identical to the value recorded on 2026-09-23 |
| Local stack | Supabase containers for `arc21` up (db, rest, realtime, auth, storage, kong, inbucket, edge runtime) |
| Toolchain | Node v26.7.0, Supabase CLI 2.115.0 |
| Schema under test | `5695a4c3df2d…` (59 migrations, one uncommitted in Arc21) |
| Intent store | 240 entries, 240 `ai_draft` / `unreviewed`, 0 adopted |
| Registered contradictions | 10 registrations, 57 distinct Test IDs (F2.094 carries two) |

## Work packages and gates

| Item | Status | Notes |
|---|---|---|
| WP0 inventory | COMPLETE | CP1 approved (reaffirmed 2026-09-22) |
| WP1 harness validation | COMPLETE | CP2 approved (reaffirmed 2026-09-22) |
| WP2 rubric and tiers | COMPLETE, frozen | CP3 approved (reaffirmed 2026-09-22) |
| WP3 planning | COMPLETE, approved, frozen (345 = 63/240/42) | |
| WP3 implementation / hardening | COMPLETE | prove-gates 64/64 at a8d8cfc |
| **Gate A — author decisions before WP3 execution** | **COMPLETE** — answered by the author 2026-09-24 ~20:00 UTC; applied (D3.54) | 240/240 intents `user_reviewed_ai_draft`/approved; 51 frozen corrections; 13 Test IDs kept `not_measured` (C2-grant-before-trigger ×2, C5 ×11) |
| WP3 final preflight | COMPLETE | preflight + prove-gates passed before run 1 |
| WP3 execution | **COMPLETE** — run 3 `20260925T014011Z-5695a4c3df2d` is the result | run 1 superseded (3 harness defects), run 2 aborted (reset under host load); all kept (D3.55) |
| WP3 result validation | **PASSED 19/19** (run 3); vs run 1: only the 11 F10 rows differ, all 345 actual outcomes identical | harness `e1164c7d` = tree of `f8cc830` |
| WP4 drift | **COMPLETE** — run `20260925T042837Z-wp4` (all 4 states exit 0) | 2 earlier WP4 runs stopped and kept (host overload; digest-order defect) — D3.56 |
| WP5 findings / guidance (A1) | **COMPLETE (generated)** — FINDINGS.md, CP4_PACKET.md, evidence/runs/20260925T014011Z-5695a4c3df2d/wp5/ | 4 findings, 4 informational, 2 limitations — D3.57 |
| **CP4** | **APPROVED by the author 2026-09-25** (reply recorded verbatim, `rubric/cp4-author-response.json`; D3.59) | narratives `user_reviewed_ai_draft` (A2); J3 applied: 13 in scope / 3 excluded / wallets conditional |
| Amendment A2 | **RECORDED** (brief, D3.58, CHECKPOINTS) | prospective; CP5 separate interaction waived |
| WP6 framework mapping | **COMPLETE** — study exercise; 16 entries (1 evidenced, 14 partial, 1 not mapped); `validate-wp6` 9/9 | D3.60; sources pinned in `rubric/framework-sources.json` |
| **CP5** | **SUPERSEDED by Amendment A2** (not approved; `CP5_RECORD.md`) | separate author interaction waived prospectively |
| WP7 reporting / dashboard | **COMPLETE** (2026-09-26) — `reports` + independent `validate-reports` 22/22 | D3.61; prove-gates 116/116, 9/9 controls |
| Reproducibility audit | IN PROGRESS — scratch-copy `run` REPRODUCED 6/6; fresh-clone audit after this commit | D3.61, D3.62 |
| Adversarial review | IN PROGRESS — secrets/history clean; stale-state sweep done | D3.62 |
| Final docs / push / resume handoff | IN PROGRESS | |

## Current phase

**WP7 complete (2026-09-26); fresh-clone reproducibility audit, final docs, push and the résumé handoff
follow.** No further routine stops (A2). *(History: WP7 had stopped at a usage limit on 2026-09-25 and
resumed from this file on 2026-09-26 at `75257c0`.)*

## Commands and results

| When (UTC) | Command | Result |
|---|---|---|
| 2026-09-24 ~17:05 | Arc21 fingerprint via `captureArc21State()` | `13569cf0…eaf1` — unchanged since 2026-09-23 |
| 2026-09-24 ~17:10 | in-process plan build (scratch) | **343 rows, not 345** — the shared local DB had drifted: 60 migrations applied incl. `20260915120000_pseudonymous_players` (from the author's main checkout `~/arc21`, same Supabase project id `arc21`), 47 policies not 50, two dev accounts added. Not an Attest build. |
| 2026-09-24 ~17:29 | `pg_dump -Fc` of the shared stack | `.local-backups/arc21-shared-stack-before-wp3-20260924-172900.dump` (1,499 entries, restorable) — the author's dev state, taken before any rebuild |
| 2026-09-24 ~17:30 | `preflight-wp3` (1) | FAILED correctly: plan built from the drifted DB before its rebuild (343 ≠ 345, cascading renumbering); then rebuilt and verified the baseline in 59.0 s; Arc21 unchanged |
| 2026-09-24 ~17:36 | `preflight-wp3` (2) | **PASSED** (planning): 345 = 63/240/42; 51 fixtures (33/14/4); 238 premises; 10 contradictions / 57 Test IDs hold; rebuild 36.8 s; Arc21 unchanged |
| 2026-09-24 | fix: planner refuses an instance that is not a build of the migration files (`unbuiltInstanceReason`, D3.50) + prove-gates injection | typecheck clean |
| 2026-09-24 | intent audit (240 rows) + 5 new draft-quality checks | new checks fire on 33 old drafts; regenerated drafts: 0 issues |
| 2026-09-24 ~17:46 | `draft-intents` | 240 drafted, quality clean, **76 changed / 164 unchanged**, 240 `ai_draft`/`unreviewed`; worksheet run `20260924T174635Z-5695a4c3df2d` |
| 2026-09-24 | mechanism checks for every proposed alternative (rolled back, NOT evidence) | all alternatives reach the control they claim; see `WP3_AUTHOR_DECISIONS_REQUIRED.md` |
| 2026-09-24 | `C3-username-literal-invalid` registration text/live check corrected (first mechanism is the `guard_profile_username` trigger) | all 10 registrations hold live |
| 2026-09-24 ~17:48 | `prove-gates` | **66/66** injected defects caught (2 new), 3/3 controls held, real state restored, Arc21 unchanged |
| 2026-09-24 ~17:52 | `gate-a-package` (new command) | review table `evidence/runs/20260924T175203Z-5695a4c3df2d/`; A 117 / B 107 / C 16; 76 changed since a8d8cfc; template `rubric/wp3-gate-a-decisions.json` (all pending) |
| 2026-09-24 ~18:00 | `execute-wp3` (no `--confirm`) | **REFUSED, exit 1**: fails ONLY on "every required intent is authored or reviewed by the author" and "no AI draft is permitted in a real run"; every structural gate passes; nothing executed; Arc21 unchanged |
| 2026-09-24 ~18:05 | commit `50e983b`, pushed | Gate A packet; STOP A |
| 2026-09-24 ~20:00 | **author's Gate A reply received** | recorded in `rubric/wp3-gate-a-decisions.json` (`recordedFrom`) |
| 2026-09-24 ~20:17 | `apply-gate-a` (new command) | 51 corrections listed (operation 43, expected 2, covers 2, identity 1, fixture 3; manifest 165 total); intents 235 approved as written + 5 adopted wording = 240/240 `user_reviewed_ai_draft`, 0 `user_authored`; 8 registrations retired (history kept), C5 narrowed to 11 |
| 2026-09-24 ~20:19 | `plan-wp3`, `draft-intents` | semantic validation clean; draft quality clean; 240 adopted sentences preserved; plan run `20260924T201920Z-5695a4c3df2d`; 52 fixtures (new: `probe:dave_left_seat_then_deleted`) |
| 2026-09-24 ~20:21 | `preflight-wp3` (planning) | PASSED: 241 premises; 2 registrations / 13 Test IDs holding |
| 2026-09-24 ~20:30 | `prove-gates` | first 64/66 — two injections relied on the store BEING all AI drafts (D3.37 class); fixed to inject; then **67/67** caught, 3/3 controls, state restored |
| 2026-09-24 ~20:23–20:29 | `smoke-wp3` × 17 changed rows (NOT evidence, `.smoke/`) | 14 as_predicted, 2 blocked_contradiction (F9.321, B.344 — kept), 1 not_as_predicted (F5.269 — the candidate reproduces); `.283` classifier: 1 documented reassignment (ATSTAB → bob), 3 rows involving alice removed, 25 caller-owned rows; `.331` pre-check: live dave read 3 seats, stale token 0 |
| 2026-09-24 20:30–21:04 | `execute-wp3 -- --confirm` (**official run 1**) | `20260924T203033Z-5695a4c3df2d`: 345 records, harness `1eda5eef` (= tree of 5163a03, 64 files), Arc21 unchanged. effective 283 / characterized 36 / gap 8 / deficient 5 / not_measured 13. Deficient: F5.269 (push token), F5.271/.273/.274/.275 (leaderboards return private account erin). 11 F10 absence rows `not_as_predicted` — Attest heuristic defect |
| 2026-09-25 ~01:00 | `validate-wp3` run 1 | **FAILED 1 check**: F9.316/.317/.318 carry no read-back identity (executor defect). All other 18 checks pass |
| 2026-09-25 | catalog read (read-only) | every DELETE trigger in public/private is a refusing guard (none writes a record); exactly the 11 affected resources carry one |
| 2026-09-25 ~01:06 | `bringup`, `seed-extensions` | fresh baseline (the first prove-gates attempt failed one injection only because the DB was in post-run state after the UTC date rolled over) |
| 2026-09-25 ~01:10 | `prove-gates` | **70/70** caught, 5/5 controls, state restored (new: F10 guard-vs-archive; WP4 detector; validator broken 10 ways) |
| 2026-09-25 ~01:11 | commit `e28c0c6`, pushed | F9 identity fix, F10 heuristic fix, harness hash covers rubric/*.ts, validator split + injections, WP4 code, run 1 kept |
| 2026-09-25 01:09–01:31 | `execute-wp3 -- --confirm` (official run 2) | **ABORTED** after 55 records: `supabase db reset` failed while restarting containers (host load ~20); stack intact; kept; fix = bounded retry (`f8cc830`), prove-gates 71/71 |
| 2026-09-25 01:40–02:16 | `execute-wp3 -- --confirm` (**official run 3, the result**) | `20260925T014011Z-5695a4c3df2d`: 345 records; effective 283 / gap 19 / characterized 25 / deficient 5 / not_measured 13; harness `e1164c7d` = tree of `f8cc830`; Arc21 unchanged |
| 2026-09-25 ~02:17 | `validate-wp3` run 3 | **PASSED 19/19**; vs run 1: exactly the 11 F10 rows differ; all 345 actualSummary identical; F9.316–.318 identities present |
| 2026-09-25 ~02:25 | `bringup`, `seed-extensions`, `prove-gates` | **73/73** caught, 5/5 controls, restored (new: WP5 grouping ×3, verify-finding ×5, WP4 unreachable-unprotected + RLS-off cases) |
| 2026-09-25 02:19–03:46 | `wp4` (run 1, `20260925T021927Z-wp4`) | **stopped by hand**: H1 aborted at 310/326 (3 failed resets), H2 reset hung — host load ~128, 8 GB RAM / 14 GB swap; Arc21 verified unchanged; kept; exposed 3 defects (retry rule, TRUNCATE compat, contradiction rows) → fixed `3878095`, prove-gates 73/73 |
| 2026-09-25 03:50–04:26 | `wp4` (run 2, `20260925T035025Z-wp4`) | **stopped by hand** after H1: 2 false deficients (.262/.268) from digest guards compared as strings (UNION ALL order) → fixed `48084e3` (sorted digests + content comparison), prove-gates 74/74; run 3 WP3 unaffected (only failing guard is .269's row check) |
| 2026-09-25 04:28–05:40 | `wp4` (run 3, `20260925T042837Z-wp4`) | **COMPLETE**, all exits 0: H1 341/345 answerable, H2 345/345; no pass→fail; 6 fail→pass; T-controlled table caught (no row-level control, not client-reachable); C-current inventory identical to frozen CP3 inventory |
| 2026-09-25 ~05:41 | `wp5` | 10 items: A1 leaderboards (High, deficient ×4), A2 no audit trail ×17 (High, gap), A3 partial trails ×2 (High, gap), A4 push token (Medium, deficient); B1–B4 informational; C1–C2 limitations; 0 problems; narratives store created blank |
| 2026-09-25 ~17:30 | **the author's CP4 reply + Amendment A2 received** (new context resumed at `e6d5c4a`) | verified from disk first: HEAD = origin/main = `e6d5c4a`; WP3 345 = 283/19/25/5/13 recomputed from raw records; validation 19/19; WP4 all exits 0; Arc21 fingerprint `13569cf0…eaf1` unchanged; local DB = Attest build (59 migrations, 5 Attest accounts) |
| 2026-09-25 | A2 recorded (brief + D3.58); reply recorded verbatim (`rubric/cp4-author-response.json`); narratives copied programmatically (`user_reviewed_ai_draft`); J14 → `rubric/official-runs.json`; J3/J4 applied per resource → `rubric/wp5-audit-scope.json` (catalog reads: ledger DELETE allowed for server roles; commands cascade on account deletion) | D3.59 |
| 2026-09-25 | `wp5` (new checks `checkCp4Record`, `checkAuditScope`) | written, 0 problems; same ranking A1–C2; FINDINGS.md + CP4 record byte-identical across two regenerations |
| 2026-09-25 ~22:03 UTC | DB re-checked (unchanged, no foreign sessions) → `bringup` (47.6 s), `seed-extensions` (37/37), `prove-gates` | **76/76** caught, **6/6** controls, restored (new: CP4 record ×6, audit scope ×4, control: real store) |
| 2026-09-25 | commit `7da6262` pushed (CP4 applied, A2 recorded) | HEAD = origin/main |
| 2026-09-25 | `framework-sources` (network: NIST OSCAL 5.2.0, eCFR as of 2026-09-22, FDA CSA PDF) | verbatim texts + sha256 in `rubric/framework-sources.json` |
| 2026-09-25 | `wp6` | 16 entries written; independent `validate-wp6` **9/9**; CSA note 520 words (claims 137 < limitations 275); `CP5_RECORD.md` = superseded |
| 2026-09-25 | `prove-gates` | **80/80** caught, **7/7** controls, restored (new: WP6 mapping ×8, CSA note, validate-wp6 ×6, claims lint ×10) |
| 2026-09-26 ~19:26 UTC | resumed from disk at `75257c0` (new context) | verified first: HEAD = origin/main; WP3 345 = 283/19/25/5/13 recomputed from the raw records; validate-wp3 19/19; WP4 all exits 0; Arc21 fingerprint `13569cf0…eaf1` unchanged; DB = Attest baseline (59 migrations, 5 Attest accounts, only platform sessions) |
| 2026-09-26 | `wp5`, `wp6` (unchanged code) | both regenerate byte-identically |
| 2026-09-26 ~19:35 | `prove-gates` (unchanged code) | **79/80** — one injection's precondition failed, not its gate: two date-bound fixtures stale after the UTC date change. Fixed: prove-gates refuses a stale baseline and names the cause (D3.61) |
| 2026-09-26 ~19:40 | `bringup` (55 s with seeding), `seed-extensions`, `prove-gates` | **80/80**, 7/7 |
| 2026-09-26 ~19:58–20:05 | `prove-gates` with the WP7 injections | 114/116 (two gaps in the validator) → fixed → 114/116, 8/9 (baseline was the stale disk) → fixed → **116/116, 9/9** (D3.61) |
| 2026-09-26 | `reports` | `validate-reports` **22/22** |
| 2026-09-26 | dashboard reviewed in Chrome (served on 127.0.0.1) and in headless Chrome from `file://` | fixed: Part 11 titles cut at a comma, intent provenance unlabelled, WP0 rows with a dead button, drift transitions shown as summaries, repeated labels, card layout; no page error; no horizontal scroll at 390 px; opens from disk |
| 2026-09-26 | `.local-backups/` dumps restored into a scratch container of the same image (`attest-restore-check`, no host port) | both: exit 0, 0 errors once the two platform roles exist; container removed; shared DB untouched — `LOCAL_DATABASE.md` |
| 2026-09-26 | secret and history scan | nothing sensitive tracked or ever added; no JWT-shaped string in history; largest blobs are evidence (≤ 1.9 MB) |
| 2026-09-26 20:12 | `run` from a scratch copy of the working tree | **REPRODUCED** 6/6 comparisons; prove-gates 116/116; validate-reports 22/22; 53 s end to end |
| 2026-09-26 | `validate-wp3` of the official run (scratch copy) | the committed `wp3-validation.{json,md}` reproduced byte for byte |
| 2026-09-26 20:18 | final `prove-gates` + `reports` on the code committed next | **116/116, 9/9**; validate-reports **22/22** |

## Evidence generated in this mission

- `evidence/runs/20260924T174635Z-5695a4c3df2d/` — regenerated AUTHOR INTENT worksheet (drafts only)
- `evidence/runs/20260924T175203Z-5695a4c3df2d/` — Gate A review table (generated; drafts only)
- `evidence/runs/20260924T201920Z-5695a4c3df2d/` — the planning run the official runs execute
- `evidence/runs/20260924T203033Z-5695a4c3df2d/` — official WP3 run 1 (SUPERSEDED; validation FAILED 1 check; kept unedited)
- `evidence/runs/20260925T010904Z-5695a4c3df2d/` — official WP3 run 2 (ABORTED at 55; kept unedited)
- `evidence/runs/20260925T014011Z-5695a4c3df2d/` — **official WP3 run 3 — THE WP3 RESULT** (validation PASSED)

## Checkpoint commits in this mission

- `50e983b` Gate A packet · `238abd6` Gate A applied · `5163a03` protected checkout vs migration source
- `e28c0c6` harness fixes from official run 1; WP4 code; run 1 kept as superseded record
- `f8cc830` reset retry; run 2 (aborted) kept
- `fbc2318` WP3: execute final access-control assessment (run 3 = the result)
- `3878095` WP4 run 1 stopped/kept; retry + compatibility fixes
- `48084e3` digest guards by content; WP4 run 2 stopped/kept

## Unresolved contradictions / open author decisions

(see Gate A package once written)

## Phase 1 findings (for the Gate A package)

- 76 drafts corrected in the generator (`rubric/intent-drafts.ts`), not the store (the merge
  refreshes every `ai_draft` from the generator, so a store edit would be silently reverted).
- Objectively wrong classes: reversed block direction (`F1.148`, `F5.259`); deleted-user rows said
  "another player's" (14); dangling "that table/room/tournament" (13); anon "their own" (2);
  "housekeeping over other accounts' rows" where none exists (`F5.277`, `.278`); F5 escalation text
  broader than the probe or wrong (`.245–.281` many); `F5.269` consequence direction wrong (copied
  from the frozen `covers`); `F2.056` names an operation the probe does not perform; `F6.062`
  ownership where it is a shared request; `F8.312/.315` attribute to the seat a refusal that applies
  to every client; expired-session "signed out for hours".
- `delete_own_account` is misclassified as caller-scoped: its body documents four cross-account
  effects. `.283`'s literal claim prohibits the documented host handover.
- C4: Arc21 explicitly revokes EXECUTE from anon on `latest_verifiable_daily_challenge()`; the
  approved row's "deliberately callable without an account" is an Attest planning misreading.
- C5: a same-property alternative exists only for the session-scoped rows (`.331–.333`): seat dave
  (`left`), delete him through Arc21's own path, read the surviving SET NULL rows with the stale
  token (verified: live dave reads 3 seats, stale token 0; seat survives anonymised). The 11 CASCADE
  rows have nothing left behind by design.
- `WP3_AUTHOR_REVIEW.md` said 54 negatives carry a contradiction; the number is 53 (57 − 4 positives).

## Exact next action

*(History: WP7 generators were written on 2026-09-25 and left unvalidated at a usage limit; finished
2026-09-26.)*

1. Commit the WP7 work (code, generated outputs, the prove-gates record, D3.61) and push.
2. Fresh clone of origin/main into the scratchpad: `npm ci`, typecheck, `reports` (must leave the
   clone unchanged), `validate-reports`, then `run` with `ATTEST_ARC21_CHECKOUT` at the protected
   checkout; copy the clone's run directory into `evidence/runs/` as the audit record.
3. D3.62 (audit + adversarial review results), CHECKPOINTS final section, this file final; final
   `prove-gates` / `reports` if any code changed; commit, push, HEAD == origin/main.
4. Rewrite the untracked `Attest RESUME_HANDOFF.md` from final truth.
