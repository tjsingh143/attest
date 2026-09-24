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
| **Gate A — author decisions before WP3 execution** | **BLOCKED — AUTHOR DECISION** (package complete 2026-09-24) | `WP3_AUTHOR_DECISIONS_REQUIRED.md`, `WP3_AUTHOR_DECISIONS_COMPACT.md`, `rubric/wp3-gate-a-decisions.json`, `evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.md` |
| WP3 final preflight | NOT STARTED | |
| WP3 execution | NOT STARTED | |
| WP3 result validation | NOT STARTED | |
| WP4 drift | NOT STARTED | |
| WP5 findings / guidance (A1) | NOT STARTED | |
| **CP4** | NOT REACHED | |
| WP6 framework mapping | NOT STARTED | |
| **CP5** | NOT REACHED | |
| WP7 reporting / dashboard | NOT STARTED | |
| Reproducibility audit | NOT STARTED | |
| Adversarial review | NOT STARTED | |
| Final docs / push / resume handoff | NOT STARTED | |

## Current phase

Phase 1 — Gate A preparation: independent audit of the 240 intent drafts against the final
hardened implementation; complexity classification; contradiction analysis; deleted-user
analysis; `.283`; smoke candidates.

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

## Evidence generated in this mission

- `evidence/runs/20260924T174635Z-5695a4c3df2d/` — regenerated AUTHOR INTENT worksheet (drafts only)
- `evidence/runs/20260924T175203Z-5695a4c3df2d/` — Gate A review table (generated; drafts only)

## Checkpoint commits in this mission

(none yet)

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

**STOPPED at Gate A (2026-09-24), waiting for the author.** When the author answers:

1. Record the answer in `rubric/wp3-gate-a-decisions.json` with `recordedFrom` (never a decision
   the author did not make).
2. Apply intent decisions to `rubric/author-intents.json`: accepted drafts → `user_reviewed_ai_draft`
   / `approved`; the author's own sentences → `user_authored` / `approved`; undecided stay `ai_draft`.
3. For each authorised contradiction correction: change the planner's emitted field, widen
   `ApprovedCorrection.field` to the frozen field changed, list the correction in
   `rubric/wp3-approved-matrix.json` with from/to/reason/decision, retire the registration in
   `src/wp3-contradictions.ts`, adjust bindings/claims if the expected text changed, regenerate
   C-category drafts if C4/C5/D-283 changed their probe, and write a DECISIONS entry.
4. `.283` per the author's reading.
5. typecheck → `preflight-wp3` → `prove-gates` → `preflight-wp3 --for-execution` (must pass) →
   `execute-wp3 -- --confirm` (≈ 40–50 min) → Phase 4 validation.
