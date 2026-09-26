# Attest — access control assurance harness

<!-- attest:generated:status:start — rewritten by `npm run attest reports` from the evidence; do not edit by hand -->

**Status: complete.** Every work package is done, and every output is regenerated from the evidence and checked by code that did not write it. Nothing in Arc21 was changed or remediated.

| Work package | State | Evidence |
|---|---|---|
| WP0 control inventory | complete | 40 resources, 397 (resource, control) pairs read from the live catalogs; frozen at CP1 (run `20260922T234324Z-5695a4c3df2d`) |
| WP1 harness validation | complete | 5 of 5 deliberately broken controls detected by the role-scoped probe and restored; the same statements on over-privileged connections told intact from broken in 0 of 10 checks — the role scoping is what detects |
| WP2 risk rubric and tiers | complete | the author's rubric; 21 High, 19 Medium; frozen at CP3 |
| WP3 control testing | complete | official run `20260925T014011Z-5695a4c3df2d`: 345 Test IDs — 283 effective, 19 gap, 25 characterized, 5 deficient, 13 not measured; `validate-wp3` 19 of 19 |
| WP4 drift detection | complete | run `20260925T042837Z-wp4`: 4 schema states, every state exit 0 |
| WP5 findings and remediation guidance | complete | 4 findings, 4 informational items, 2 limitations; CP4 approved by the author 2026-09-25; nothing remediated |
| WP6 framework mapping (a study exercise) | complete | 16 entries; `validate-wp6` 9 of 9; CP5 superseded by Amendment A2 — not approved |
| WP7 reporting | complete | assurance report, dashboard and plain-language summary, regenerated from the evidence and re-derived by `validate-reports`; `prove-gates`: 116 of 116 injected defects caught and 9 of 9 controls held, real state restored (harness `b0a87299d68a`) |

Checkpoints: CP1, CP2 and CP3 approved (reaffirmed by the author 2026-09-22); Gate A answered by the author 2026-09-24; CP4 approved by the author 2026-09-25; CP5 **superseded by Amendment A2** — its separate interaction was waived prospectively by the author, so it is recorded as superseded, never as approved (`CHECKPOINTS.md`).

<!-- attest:generated:status:end -->

**Arc21 is a read-only assessment target.** Attest reads it and rebuilds a disposable database
from its migrations; it never modifies Arc21's code, migrations, policies, grants, tests, seed,
configuration or history, and findings end as remediation *guidance*, never as fixes. This was a
scope change by the author on 2026-09-22, before WP3 ran (`DECISIONS.md` D3.31), and every
`attest` command enforces it by fingerprinting the Arc21 checkout before and after (D3.32).

---

## The question

> For a multi-user application whose access control is enforced by database row-level
> security, can you generate auditable evidence that those controls actually work,
> automatically, on every run, without trusting the developer's memory of what he wrote?

## What this is

Arc21 is a multiplayer application — TypeScript, React Native, Supabase, PostgreSQL — whose
access control is enforced by row-level security policies, role grants, `SECURITY DEFINER`
functions and write-guard triggers. Attest rebuilds a disposable local copy of it from its
migrations, reads every one of those controls out of the PostgreSQL system catalogs, rates each
resource against a risk rubric the author wrote, tests the controls under genuinely unprivileged
role-scoped sessions, and records timestamped evidence — the statement, the identity, the
expectation, the outcome and the schema version — for every test. It then compares Arc21's
earlier schemas with today's, ranks what it found, maps the evidence to NIST SP 800-53 and
21 CFR Part 11 identifiers as a study exercise, and turns all of it into a report, a dashboard
and a one-page summary.

The inventory is read from the system, not from the migrations and not from documentation. That
distinction is the point of the exercise: migrations say what was intended, a catalog says what is
there. The first instance this harness was pointed at had a migration recorded as applied that
existed in no file, and was missing policies its own migrations create.

## What it found

<!-- attest:generated:results:start — rewritten by `npm run attest reports` from the evidence; do not edit by hand -->

**Evidence:** WP3 run `20260925T014011Z-5695a4c3df2d` (validated 19/19) · WP4 run `20260925T042837Z-wp4` · frozen CP1/CP3 run `20260922T234324Z-5695a4c3df2d` · schema `5695a4c3df2d` (59 migrations) · the author's selection of these runs: `rubric/official-runs.json`.

| Inventory (WP0), read from the live catalogs | |
|---|---:|
| Resources in scope | 40 |
| (resource, control) pairs | 397 |
| Row-level security policies | 50 |
| `SECURITY DEFINER` functions | 88 (55 callable by a client role) |
| Triggers (39 of which can refuse a write) | 52 |
| Column-level grants | 28 |
| Tables with row-level security **enabled** | 39 of 39 |
| Tables with row-level security **forced** | **0 of 39** |
| Resources with a row-level control (WP4's definition) | 40 of 40 |

The brief's "no control" patterns, as the frozen inventory classified them: row-level security off — 0; on with no policy, so every client is denied — 5; readable without an account — 4 (catalogue tables, accepted as design intent); granted to the anonymous role with no policy admitting it — 1 (informational). The enabled-versus-forced split is the one to read twice: row-level security that is enabled but not forced does not apply to a table's owner, and all 38 of Arc21's own tables are owned by `postgres`, which also holds `BYPASSRLS` (`realtime.messages` is owned by `supabase_realtime_admin`, which does not hold it) — item B1, informational by the author's decision.

**WP3, the assessment** — 345 Test IDs (63 positive, 240 negative, 42 characterization), each run under a role-scoped session and recorded with its statement, identity, expectation, outcome, timestamp and schema version:

| Verdict | Tests | Meaning |
|---|---:|---|
| effective | 283 | the control held exactly as the approved row predicted |
| gap | 19 | a control the plan asked about does not exist — the audit-trail family |
| characterized | 25 | a recorded fact rather than a pass or fail — chiefly row-level security not forced, and its mechanism |
| deficient | 5 | the control was exercised and did not hold |
| not measured | 13 | approved rows the schema makes unmeasurable, kept that way by the author at Gate A — never counted as effective |

| Family | Tests | effective | not effective |
|---|---:|---:|---|
| F1 Read isolation | 58 | 58 | — |
| F2 Write isolation | 65 | 65 | — |
| F3 WITH CHECK enforcement | 11 | 11 | — |
| F4 Anonymous exposure | 44 | 44 | — |
| F5 Privilege escalation through SECURITY DEFINER functions | 58 | 52 | 5 deficient, 1 characterized |
| F6 Column-level leakage | 12 | 12 | — |
| F7 Forced RLS / owner and BYPASSRLS exemption | 25 | 1 | 24 characterized |
| F8 Realtime channel authorization | 9 | 9 | — |
| F9 Integrity under concurrency (wallet) | 7 | 5 | 2 not measured |
| F10 Audit trail | 33 | 14 | 19 gap |
| B Boundary cases: absent identity, deleted account, expired session | 23 | 12 | 11 not measured |

**WP5, the findings** — CP4 approved by the author 2026-09-25. Every status is the author's decision; nothing was remediated, fixed or closed. Each finding carries remediation options with their tradeoffs and a verification procedure by Test ID — or says plainly where the frozen tests could not confirm a fix (`FINDINGS.md`).

| # | Item | Tier | Evidence | The author's status |
|---|---|---|---|---|
| A1 | Four leaderboard functions return a private-profile player's display name to other signed-in players | High | 4 deficient | accepted design intent |
| A2 | No who-did-what-when record exists for 17 High-tier resources | High | 17 gap | open |
| A3 | Two partial trails: game events carry no actor, and rate-limit events record only allowed attempts | High | 2 gap | accepted design intent |
| A4 | register_push_token lets a signed-in player take over another account's device registration | Medium | 1 deficient | open |
| B1 | Row-level security is enabled but not forced on every Arc21 table: the owner and BYPASSRLS roles are not subject to policies | High | 24 characterized | informational |
| B2 | sprint_standings shows every co-entrant's display name, with no block or privacy check | High | 1 characterized | accepted design intent |
| B3 | Four catalogue tables are readable without an account | High | WP0 observation | accepted design intent |
| B4 | realtime.messages grants INSERT, SELECT and UPDATE to anon; no policy admits anon today | Medium | WP0 observation | informational |
| C1 | Eleven deleted-account attempts have nothing left to target | High | 11 not measured | not measured |
| C2 | Two client attempts on the wallet ledger are refused by the grant before its append-only trigger can be reached | High | 2 not measured | not measured |

A2's scope under the author's J3/J4 rule: 13 of 17 resources require a trail and have none (open); 3 excluded as transient live state; 1 conditional on the wallet ledger (not established).

**WP4, drift** — the same approved questions asked of Arc21 as it was in 2 earlier states rebuilt from its own git history (`.wp4-states/`, never the checkout), and of an Attest-only scratch copy with one unprotected table added: 0 went from pass to fail; 6 went from fail to pass between the oldest state and today; the unprotected table (`public.attest_wp4_unprotected_notes`) was reported on the run that added it, and as unreachable by any client role today — one grant from exposed. Today's inventory re-read by WP4 differs from the frozen one in 0 places.

**WP6, framework mapping — a study exercise, not compliance, validation or audit.** 16 entries against NIST SP 800-53 Rev. 5 and 21 CFR Part 11 (13 from the brief's list, 3 added where the evidence bears directly): 1 evidenced on tested paths only, 14 partial, 1 not mapped. Every rationale is AI-drafted and labelled so; every quoted text is verbatim from the primary source; `validate-wp6` re-derived every citation (9 of 9 checks). Arc21 is not a regulated system (`FRAMEWORK_MAPPING.md`, `CSA_NOTE.md`).

**The harness, checked:** WP1 detected 5 of 5 deliberately broken controls; `validate-wp3` passed 19 of 19; `validate-wp6` 9 of 9; `prove-gates`: 116 of 116 injected defects caught and 9 of 9 controls held, real state restored (harness `b0a87299d68a`).

<!-- attest:generated:results:end -->

The full picture is in three generated outputs, one per audience:

- **`ASSURANCE_REPORT.md`** — the control assurance report: one section per risk tier, every
  control with its rating, the assurance activity applied, the tests that name it and their
  outcomes, then the ranked findings, drift, the framework study and the limitations.
- **`dashboard/index.html`** — the posture at a glance, effectiveness by family and tier, coverage,
  findings, drift, and an evidence drill-down: select a control and see every test that names it,
  with the statement issued, the identity it ran as, what was expected, what happened and when.
  One self-contained file: open it from disk; it needs no server and makes no network request.
- **`SUMMARY.md`** — one page for a reader with no technical background.

## How you know the tests are real

Before any result is worth reading, the harness has to show it can tell a working control from a
broken one. `attest validate` weakens controls in the disposable instance on purpose — one at a
time, across different refusal mechanisms — reruns the identical statement, and requires the
recorded outcome to **change**; then it puts each control back and requires the whole control
inventory to be identical to the one read beforehand. It also runs each statement on
over-privileged connections, which give the same answer whether the control is intact or broken —
so no assertion built on them could detect the break. That is the sense in which connecting as an
unprivileged, role-scoped session is load-bearing rather than decorative.

The WP3 executor is held to the same standard, one level up (`DECISIONS.md` D3.38–D3.48):

- **Every claim is judged.** Each approved expectation is partitioned into claims, and each claim
  has an evaluator. A refusal counts only when it came from the layer the expectation names —
  classified from PostgreSQL's own error fields — and a refusal by any other layer is recorded as
  *not reached*, never as effective and never as deficient.
- **Nothing passes on nothing.** Every probe that acts on rows first shows its subject is
  non-empty; "no effect" is read from a before/after state guard, never from a returned NULL; a
  socket's silence counts only inside a window an authorised observer proved live; and a probe that
  never executed cannot meet any claim.
- **Probes cannot contaminate each other.** After any probe that changed state, the disposable
  database is rebuilt from Arc21's migrations and the baseline re-verified — fixtures, row counts,
  control surface, services, and Arc21's own fingerprint — before the next probe runs.
- **Approved rows the system makes unmeasurable are registered, not worked around**, each with a
  live check, and recorded `not_measured` — never counted as effective.
- **The results are validated by code that does not trust the executor.** `attest validate-wp3`
  re-derives every observation, verdict and total from the raw records with its own
  re-implementation of the mapping. It refused the first official run, for records that lacked a
  read-back identity (D3.55); that run is kept, as written, as superseded.
- **Every gate is proven by breaking it.** `attest prove-gates` injects defects through the very
  functions each gate uses — broken plans, staged database states rolled back afterwards, bad
  outcomes handed to the evaluator with every other input satisfied, tampered evidence, tampered
  report copies, a throwaway git repository for the read-only guard — and requires every one to be
  refused, while controls prove the gates do not fire on the real input. Its latest result is
  recorded in `evidence/prove-gates/` and cited above from that record.
- **The reports are checked by code that did not write them.** `attest validate-reports`
  re-derives every headline number from the raw evidence with its own counting, parses what the
  report, the summary, the dashboard and this README say, requires them all to agree, lints every
  generated document for overclaiming and stale state, and requires each file to be byte-identical
  to what the evidence regenerates.
- **Nothing is planned from a database that is not a build of the migration files.** The local
  Supabase stack is shared with the author's own Arc21 checkout; the planner reads the applied
  migrations first and refuses a mismatch (D3.50).

The harness has refused false confidence in its own runs, and those runs are kept rather than
tidied away: a first official WP3 run superseded because its own validation failed and a heuristic
mis-judged audit-trail absences, a second aborted when a rebuild failed on an overloaded host, and
two WP4 runs stopped by hand — one on the same overload, one because a state guard compared
digests as strings and read a reordering as a change. Each defect is fixed, proven by an injection,
and written up (`DECISIONS.md` D3.55, D3.56).

## How to run it

Requires Docker, the Supabase CLI, Node 23.6 or later, and a local copy of the Arc21 repository —
by default at `arc21 copy/` beside this repository; set `ATTEST_ARC21_CHECKOUT` to point anywhere
else. The disposable database is the Supabase CLI's local stack for that checkout, reached on
loopback only.

```sh
npm ci
npm run attest reports            # regenerate every report from the committed evidence — no database
npm run attest validate-reports   # check every report with code that did not write it
npm run attest run                # rebuild the database and reproduce everything short of re-running the probes
```

**What each level of reproduction re-derives.**

- `reports` and `validate-reports` need only this repository: every number in every output is
  recomputed from the persisted evidence, and a fresh clone regenerates every file byte for byte.
- `run` rebuilds the disposable database from Arc21's migrations and re-derives, from the live
  system, the control inventory, the harness validation, the risk inputs, the tiers, the fixtures
  and the WP3 plan, and requires each to equal the frozen evidence the reports are built from
  (`evidence/runs/<run>/reproduction.md`); then it re-proves every gate on the fresh baseline and
  regenerates and validates every report.
- `run -- --confirm` also re-executes the whole assessment — the longest step, because the database
  is rebuilt after every probe that changes state — records it as a *reproduction*, never a new
  result, validates it independently and compares it with the official run Test ID by Test ID
  (`compare-wp3`). `--with-wp4` repeats the drift analysis against it as well.

The final reproducibility audit (2026-09-26, `DECISIONS.md` D3.62) did exactly this from a fresh
clone of the repository: every report regenerated byte for byte, and `run` found every piece it
re-derives identical to the frozen evidence.

The official results are the runs the author selected at CP4 (`rubric/official-runs.json`); no
command replaces them. The two complete executions of the assessment that exist — the superseded
first run and the official run, on different days and from separately rebuilt databases — recorded
the same outcome for every probe. `compare-wp3` finds them different only where the harness defects
fixed in between had mis-judged a verdict or left an identity unrecorded (D3.55).

**This is destructive — to the disposable database, and only to it.** `bringup` drops and rebuilds
the database. The harness refuses to run against anything but a loopback address, and deliberately
attempts unauthorized reads and writes, so it may only ever be pointed at an instance that can be
thrown away. It never writes to the Arc21 checkout: every command exits 3 as a harness safety
violation if the checkout differs afterwards in any way — tracked files, the index, refs, untracked
files or new ignored paths. The one tool that writes inside the Arc21 tree is the Supabase CLI,
which `bringup` runs there and which maintains its own gitignored `supabase/.temp/`. Some fixtures
are bound to the current UTC date, so `seed-extensions` (and `prove-gates`, which needs a verified
baseline) must be re-run after midnight UTC; `prove-gates` refuses, naming the stale fixture, rather
than report a gate as broken.

<!-- attest:generated:commands:start — rewritten by `npm run attest reports` from the evidence; do not edit by hand -->

**Reproduce**

| Command | Does | Database |
|---|---|---|
| `npm run attest run` | the one command: rebuild the disposable database from Arc21's migrations, re-read the inventory, re-run the harness validation (WP1), re-score (WP2), rebuild the fixtures, re-plan WP3, compare every one of those with the frozen evidence, re-prove every gate, then regenerate and validate every report | rebuilds |
| `npm run attest run -- --confirm [--with-wp4]` | all of `run`, then execute the full WP3 assessment again (a reproduction, never a new result), validate it independently and compare every Test ID with the official run; `--with-wp4` also repeats WP4 against it | rebuilds |

**Reports and findings (no database)**

| Command | Does | Database |
|---|---|---|
| `npm run attest reports` | regenerate FINDINGS.md, the CP4 and CP5 records, the framework mapping and CSA note, the assurance report, the dashboard, the plain-language summary and the README's generated sections from the persisted evidence, then run validate-reports | not used |
| `npm run attest validate-reports` | re-derive every headline number from the raw evidence with its own code, check every report agrees with it and with each other, lint every generated document for overclaiming and stale wording, and require each file to be byte-identical to what the evidence regenerates | not used |
| `npm run attest wp5 -- [--wp3-run=<id> --plan-run=<id> --wp4-run=<id>]` | WP5 alone: the ranked findings, remediation guidance and CP4 record, from validated evidence only (defaults to the official runs) | not used |
| `npm run attest wp6` | WP6 alone: the framework mapping (a study exercise), the CSA note and the CP5 record, independently validated | not used |
| `npm run attest validate-wp6` | re-derive every citation and count in the framework mapping from the raw records | not used |
| `npm run attest framework-sources` | re-fetch the framework texts WP6 quotes (NIST OSCAL catalog, eCFR) into rubric/framework-sources.json — the only command that uses the network | not used; network |
| `npm run attest verify-finding -- <item> --official=<id> --candidate=<id>` | would a future run confirm a fix of one finding: its Test IDs at the stated verdict, the run validated, and no regression | not used |
| `npm run attest compare-wp3 -- <candidate id> [--official=<id>]` | compare two WP3 runs Test ID by Test ID — verdict, observation, recorded outcome, identity | not used |

**The assessment, step by step**

| Command | Does | Database |
|---|---|---|
| `npm run attest bringup` | rebuild the disposable database from Arc21's migrations, verify the schema version, apply the deterministic seed | rebuilds |
| `npm run attest inventory` | read the control inventory from the live catalogs (WP0) | reads |
| `npm run attest validate` | WP1: break controls on purpose in the disposable database, confirm the role-scoped probe notices and over-privileged connections do not, put them back | writes |
| `npm run attest risk-inputs` | assemble the per-resource facts the risk rubric needs — no scores (WP2) | reads |
| `npm run attest rubric` | report what is unauthored in RUBRIC.md | not used |
| `npm run attest score` | apply the author's rubric, compute the tiers, check the CP3 arithmetic (WP2) | reads |
| `npm run attest seed-extensions` | build and verify the fixture state the WP3 matrix requires (some fixtures are date-bound: re-run after a UTC date change) | writes |
| `npm run attest plan-wp3` | generate and validate the WP3 test matrix; executes nothing | reads |
| `npm run attest preflight-wp3 -- [--for-execution]` | check everything that must hold before WP3 may execute (rebuilds the disposable database once) | rebuilds |
| `npm run attest prove-gates` | break every gate on purpose — deep copies, rolled-back transactions, a throwaway git repo, tampered report copies — require each to fire, and record the result in evidence/prove-gates/ | reads |
| `npm run attest execute-wp3 -- --confirm` | run the approved WP3 suite (refused unless preflight passes for execution) | rebuilds |
| `npm run attest validate-wp3 -- <run id> [--plan-run=<id>]` | independently re-derive every verdict and total of a WP3 results file from its raw records | not used |
| `npm run attest wp4 -- --wp3-run=<id> --plan-run=<id>` | WP4 drift: rebuild Arc21's earlier schema states from its git history (read-only, into .wp4-states/), inventory each, run the approved probes each can answer, and diff them | rebuilds |
| `npm run attest wp4-state -- <run id> <state> --plan-run=<id>` | one WP4 schema state, run in its own process by `wp4` | rebuilds |
| `npm run attest wp4-report -- <wp4 run id> --wp3-run=<id> --plan-run=<id>` | regenerate a WP4 run's drift report from what its states persisted | not used |

**Gate history (kept for the record; nothing pending)**

| Command | Does | Database |
|---|---|---|
| `npm run attest smoke-wp3 <Test ID>…` | plumbing smoke of a few named probes (the code caps the number), written under .smoke/ and stamped NOT WP3 EVIDENCE | rebuilds |
| `npm run attest draft-intents` | Gate A history: draft the attack sentences for the author to review (every one was adopted at Gate A; a draft never replaces an adopted sentence) | reads |
| `npm run attest gate-a-package` | Gate A history: regenerate the intent review table and the decision template — approves nothing | reads |
| `npm run attest apply-gate-a` | Gate A history: apply the author's recorded Gate A decisions — refuses unless every change is authorised | reads |
| `npm run attest freeze-fixture-corrections` | list fixture-metadata corrections in the frozen manifest (D3.38) — refuses any other difference | reads |

<!-- attest:generated:commands:end -->

## The local database and its backups

The Supabase stack Attest rebuilds is the same local stack the author's own Arc21 checkout uses.
It currently holds Attest's own baseline build — the migrations and the synthetic accounts, nothing
of the author's development work. The author's earlier local development state is preserved in
`.local-backups/` (gitignored, never committed), and restoring it over the shared database is left
to the author: Attest does not overwrite a database it cannot prove it can restore. What each
backup is, and a restore procedure verified against a scratch container, are in
`LOCAL_DATABASE.md`.

## Layout

<!-- attest:generated:layout:start — rewritten by `npm run attest reports` from the evidence; do not edit by hand -->

| Path | Contents |
|---|---|
| `src/` | The harness: TypeScript run directly by Node (no build step). `db.ts` holds the connection identity model; `cli.ts` dispatches every command in `commands.ts`. |
| `sql/inventory/` | The catalog probes WP0 runs, as plain SQL — readable and runnable on their own. |
| `seed/seed.sql` | Deterministic synthetic test accounts and data, owned by Attest (never Arc21's seed). |
| `rubric/` | The author's inputs and the frozen records the harness reads: the ratings behind RUBRIC.md, the frozen approved WP3 matrix, the intent store, the Gate A decisions, the CP4 reply (verbatim), the audit-trail scope, the official-run selection and the pinned framework texts. |
| `evidence/runs/` | One directory per run: inventory, validation, tiers, the WP3 results and their independent validation, WP4 drift, WP5 and WP6 copies. Never hand-edited; superseded, aborted and stopped runs are kept as they were written. |
| `evidence/prove-gates/` | The latest `prove-gates` result, which the reports cite. |
| `RUBRIC.md` | The risk rubric, written by the author and frozen at CP3. |
| `DECISIONS.md` | Every judgment call, with its alternatives and what would change. |
| `CHECKPOINTS.md` | What each checkpoint's state is and how it was reached. |
| `ASSURANCE_REPORT.md` | *Generated by `reports`; never hand-edited.* WP7 (a): the control assurance report — one section per risk tier, every control, its tests and outcomes, the ranked findings. |
| `dashboard/index.html` | *Generated by `reports`; never hand-edited.* WP7 (b): the dashboard — one self-contained file; open it from disk, no server and no network. |
| `SUMMARY.md` | *Generated by `reports`; never hand-edited.* WP7 (c): the one-page plain-language summary. |
| `FINDINGS.md` | *Generated by `reports`; never hand-edited.* WP5: the ranked findings, remediation guidance and verification procedures. |
| `CP4_PACKET.md` | *Generated by `reports`; never hand-edited.* The CP4 record: what the author was shown, and the author's reply. |
| `framework-mapping.json` | *Generated by `reports`; never hand-edited.* WP6: the machine-readable framework mapping (a study exercise). |
| `FRAMEWORK_MAPPING.md` | *Generated by `reports`; never hand-edited.* WP6: the same mapping, for reading. |
| `CSA_NOTE.md` | *Generated by `reports`; never hand-edited.* WP6: the one-page note on what this output could and could not serve as under FDA's CSA guidance. |
| `CP5_RECORD.md` | *Generated by `reports`; never hand-edited.* CP5, recorded as superseded by Amendment A2 — not approved. |
| `LOCAL_DATABASE.md` | What the shared local database holds, what each backup in `.local-backups/` is, how they were verified, and how to restore one. |
| `PROJECT_COMPLETION_PROGRESS.md` | The engineering work log of the completion pass (not evidence). |
| `.wp4-states/` | Scratch (gitignored): Arc21's earlier schema states, written with `git archive` — never Arc21 itself. |
| `.smoke/` | Scratch (gitignored): plumbing smoke runs, stamped NOT WP3 EVIDENCE. |

<!-- attest:generated:layout:end -->

## Limitations

These are not caveats added at the end. They bound what the output means.

<!-- attest:generated:limitations:start — rewritten by `npm run attest reports` from the evidence; do not edit by hand -->

- **Not independent.** The author wrote Arc21, the harness, the rubric and the expectations, and approved the findings. Nothing here is a third-party assessment. The one mitigating fact: the inventory is read from the system catalogs rather than from anyone's memory, so it would read the same for someone who never saw the code.
- **Not a regulated system, and no compliance claim.** Arc21 is a personal application used as a test subject — not a GxP or Part 11 system, and not compliant with anything. The framework mapping is a study exercise; nothing here is compliance, validation, certification or audit, and nothing implies the author has experience of any of those.
- **Not a product.** The harness is one person's tool for one system: it has not been validated or qualified as a testing tool, and nobody else uses it.
- **Nothing was remediated (Amendment A1).** Arc21 is a read-only assessment target. Findings end as recommendations with verification procedures; none is fixed, closed or independently verified.
- **Not measured is not a pass.** 13 tests could not measure their property on this schema and are reported as such; they are never counted as effective.
- **Data layer only.** No network, host, container, infrastructure, HTTP-layer or user-interface testing, and no password or authentication testing: the identity provider is assumed to work, and what is tested is what happens given an identity. Nothing here claims every attack surface was tested.
- **One point in time, one instance.** One schema version (59 migrations), a disposable local database, synthetic accounts. Historical states are today's questions asked of yesterday's schema.
- **The tests detect the breaks they were written for.** Each negative test simulates the attack its approved row names. WP1 shows the harness notices deliberately obvious breaks — an expression replaced with true, a trigger disabled — not every possible weakening, and says nothing about a control no test touches. A control counted as named by a test is exercised on that test's path, not proven in every respect.
- **The refusal to test as a role that bypasses row-level security is code, not a database property.** The testing login can switch into service_role, which holds BYPASSRLS; the harness refuses to.
- **Platform-owned surface is reported, not assessed.** Supabase's own schemas and defaults appear in the inventory and are flagged as platform-owned, with no finding raised against them.
- **The read-only guard sees git-visible state.** It fingerprints Arc21's tracked files, index, refs, untracked files (with their contents) and the names of ignored paths; it does not hash the contents of already-ignored directories such as node_modules/ or the Supabase CLI's supabase/.temp/.
- **Realtime's message partitions are created by the service at runtime,** so immediately after a rebuild the realtime publication is empty; broadcast authorization is enforced by the row policies on realtime.messages, which are inventoried and tested.
- **The harness has been wrong before.** Each defect is written up in DECISIONS.md, and every run a defect affected is kept as it was written — the superseded and aborted WP3 runs and the two stopped WP4 runs among them. That bears on how much weight any single run deserves.
- **Provenance.** Titles, explanations, remediation options, the framework rationale and every report's connecting prose are AI-drafted; the findings narratives are AI-assisted wording the author reviewed and adopted at CP4 (Amendment A2).

**Provenance (Amendment A2, 2026-09-25).** The risk rubric is the author's own writing. The 240 attack-intent sentences were AI-drafted and adopted by the author at Gate A (240 user_reviewed_ai_draft). The findings narratives are AI-assisted wording the author reviewed and adopted at CP4 (8 user_reviewed_ai_draft); every status and judgment is the author's decision. The framework-mapping rationale, the CSA note, the remediation options and every report's connecting prose are AI-drafted and labelled so. No AI-worded text is presented as the author's independent composition.

<!-- attest:generated:limitations:end -->

## Prior art

The idea of continuously monitoring controls and emitting evidence is not new, and this is not an
attempt to beat the tools that do it. Vanta and Drata do continuous control monitoring
commercially; Prowler does posture assessment for cloud accounts; several PostgreSQL linters check
row-level security configuration. This is a first-principles build of the same idea against a
system the author knows completely, so that every layer can be explained. Anything borrowed from
those tools is cited where it is used.
