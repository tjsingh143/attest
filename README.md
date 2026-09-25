# Attest — access control assurance harness

**Status: work in progress — stopped at checkpoint CP4, awaiting the author.** WP0–WP5 of eight are
done: the approved WP3 assessment (345 tests) was executed and independently validated on
2026-09-25 (`DECISIONS.md` D3.55); WP4 measured drift across Arc21's own earlier schemas (D3.56); WP5
ranked the findings with remediation guidance and verification procedures (`FINDINGS.md`, D3.57).
CP4 is presented in `CP4_PACKET.md` and is **not** approved: the findings narrative is the author's
and is still blank. CP1–CP3 and Gate A are approved (`CHECKPOINTS.md`). Numbers below are from real
runs and are reproducible; nothing here should be read as a completed audit.

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
functions and write-guard triggers. Attest rebuilds a disposable local copy of it from
migrations, reads every one of those controls out of the PostgreSQL system catalogs, and (in
later work packages) tests them under genuinely unprivileged role-scoped sessions, recording
timestamped pass/fail evidence bound to the schema version under test.

The inventory is read from the system, not from the migrations and not from documentation.
That distinction is the point of the exercise: migrations say what was intended, a catalog
says what is there. The first instance this harness was pointed at had a migration recorded as
applied that existed in no file, and was missing two of the three policies its own migrations
create.

## How to run it

Requires Docker, the Supabase CLI, and Node 23.6 or later.

```sh
npm install
npm run attest run
```

`run` rebuilds the database from Arc21's migrations, records the schema version, applies a
deterministic seed, and writes a control inventory to `evidence/runs/<run-id>/`.

| Command | Does |
|---|---|
| `npm run attest run` | everything below, in order |
| `npm run attest bringup` | rebuild from migrations, verify the version, seed |
| `npm run attest inventory` | read the control inventory from the catalogs |
| `npm run attest validate` | break five controls on purpose, confirm the harness notices, put them back |
| `npm run attest risk-inputs` | assemble the per-resource facts a risk rubric needs — no scores |
| `npm run attest rubric` | report what is still unauthored in `RUBRIC.md` |
| `npm run attest score` | apply the authored rubric, compute tiers, check the CP3 arithmetic |
| `npm run attest plan-wp3` | generate and validate the WP3 test matrix — plans, executes nothing |
| `npm run attest seed-extensions` | build the extra fixture state the WP3 matrix requires |
| `npm run attest preflight-wp3` | check everything that must hold before WP3 may execute (rebuilds the disposable database once) |
| `npm run attest prove-gates` | break every gate on purpose — deep copies, rolled-back transactions, genuine database errors, a throwaway git repo — and require each to fire |
| `npm run attest smoke-wp3 <Test ID>…` | plumbing smoke of named probes, at most 60; written under `.smoke/`, stamped NOT WP3 EVIDENCE |
| `npm run attest gate-a-package` | regenerate the Gate A review table (every intent draft beside the draft it replaced) and, if absent, the author's decision template — approves nothing |
| `npm run attest apply-gate-a` | apply the author's recorded Gate A decisions — refuses unless every frozen-field change is authorised and every approval matches the exact text the author read |
| `npm run attest validate-wp3 <run-id>` | independently re-derive every verdict and total of a WP3 results file from its raw records |
| `npm run attest execute-wp3 -- --confirm` | run the approved WP3 suite — **refused until `preflight-wp3 --for-execution` passes**, which requires all 240 intent sentences to be the author's |
| `npm run attest wp4 -- --wp3-run=<id> --plan-run=<id>` | WP4 drift: rebuild Arc21's earlier schema states from its git history (read-only, into `.wp4-states/`), inventory each, run the approved probes each can answer, and diff them |
| `npm run attest wp5 -- --wp3-run=<id> --plan-run=<id> --wp4-run=<id>` | WP5: the ranked findings, remediation guidance and CP4 packet, from validated evidence only — refuses if any non-effective record would go unreported |
| `npm run attest verify-finding <item> --official=<id> --candidate=<id>` | would a future run confirm a fix of one finding: its Test IDs at the stated verdict, the run validated, and no regression |

**This is destructive — to the disposable database, and only to it.** `bringup` drops and
rebuilds the database. The harness refuses to run against anything but a loopback address, and
deliberately attempts unauthorized reads and writes, so it may only ever be pointed at an
instance that can be thrown away. It never writes to the Arc21 checkout: every command exits 3
as a harness safety violation if the checkout differs afterwards in any way — tracked files,
the index, refs, untracked files or new ignored paths. The one tool that writes inside the Arc21
tree is the Supabase CLI, which `bringup` runs there and which maintains its own gitignored
`supabase/.temp/`.

## What it found

Against 59 migrations:

| | |
|---|---:|
| Resources in scope | 40 |
| (resource, control) pairs | 397 |
| Row-level security policies | 50 |
| `SECURITY DEFINER` functions | 88 (55 callable by a client role) |
| Triggers (39 of which can refuse a write) | 52 |
| Column-level grants | 28 |
| Tables with row-level security **enabled** | 39 of 39 |
| Tables with row-level security **forced** | **0 of 39** |

The enabled-versus-forced split is the one to read twice. Row-level security that is enabled
but not forced does not apply to the table's owner — and on this instance every application
table is owned by `postgres`, which also holds `BYPASSRLS`. The risk rubric answers whether
that matters: `RUBRIC.md` §4.6 treats it as a cross-cutting privileged-role fact rather than a
per-resource risk dimension, and WP3's F7 family demonstrates the mechanism on purpose-made
scratch roles rather than asserting it against Arc21's own tables.

Full inventory: `evidence/runs/<run-id>/inventory.md`, with the machine-readable form beside
it in `inventory.json`.

**WP3, the assessment** — 345 tests across the ten control families and the boundary cases, each
run under a role-scoped session and recorded with its statement, identity, expectation, outcome,
timestamp and schema version (run `20260925T014011Z-5695a4c3df2d`, validated):

| Verdict | Tests | Meaning |
|---|---:|---|
| effective | 283 | the control held exactly as the approved row predicted |
| gap | 19 | a control the plan asked about does not exist — 17 High-tier resources with no audit trail, 2 partial trails |
| characterized | 25 | a recorded fact rather than a pass or fail — chiefly row-level security not forced (21 tables) and its mechanism |
| deficient | 5 | the control was exercised and did not hold — four leaderboard functions return a private-profile player's name; `register_push_token` reassigns another account's device registration |
| not measured | 13 | approved rows the schema makes unmeasurable, kept that way by the author's decision at Gate A |

What these mean, how they rank, and what would fix them is WP5's (`FINDINGS.md`): four findings —
leaderboards naming private-profile players, no audit trail on 17 High-tier resources, two partial
trails, and push-token reassignment — four informational items and two limitations, each with its
evidence, remediation options and tradeoffs, and the exact Test IDs that would verify a future fix.
Nothing was fixed: Arc21 is a read-only target.

**WP4, drift** (run `20260925T042837Z-wp4`): the same approved questions asked of Arc21 as it was on
2026-08-30 and 2026-09-02. None went from pass to fail; six went from fail to pass, including the
author's own 2026-09-04 hardening closing tournament rows to non-participants. A table added with no
row-level security in an Attest-only scratch copy was reported on the run that added it — and as
unreachable by client roles today, because Arc21 no longer grants new tables to them by default.

## How you know the tests are real

Before any result is worth reading, the harness has to show it can tell a working control from
a broken one. `attest validate` weakens five controls in the disposable instance — one at a
time, across five different refusal mechanisms — reruns the identical statement, and confirms
the recorded outcome **changes**. Then it puts each control back and confirms the whole control
inventory is identical to the one read beforehand.

It also runs each of those statements on two over-privileged connections. In all five
scenarios, both returned the **same answer** whether the control was intact or broken — so no
assertion built on either could have detected the break. That is the sense in which connecting
as an unprivileged, role-scoped session is load-bearing rather than decorative.

The run exits non-zero if any control is broken without being noticed.

Full transcript: `evidence/runs/<run-id>/wp1-validation.md`.

The WP3 executor is held to the same standard, one level up (`DECISIONS.md` D3.38–D3.48):

- **Every claim is judged.** Each approved expectation is partitioned into claims, and each claim
  has an evaluator. A refusal counts only when it came from the layer the expectation names —
  classified from PostgreSQL's own error fields — and a refusal by any other layer (an earlier
  privilege check, a business rule inside a function, the client connection's pg_safeupdate guard)
  is recorded as *not reached*, never as effective and never as deficient.
- **Nothing passes on nothing.** Every probe that acts on rows first shows its subject is
  non-empty; "no effect" is read from a before/after state guard, never from a returned NULL; a
  socket's silence counts only inside a window an authorised observer proved live; and a probe that
  never executed cannot meet any claim.
- **Probes cannot contaminate each other.** After any probe that changed state, the disposable
  database is rebuilt from Arc21's migrations and the baseline re-verified — fixtures, row counts,
  control surface, services, and Arc21's own fingerprint — before the next probe runs.
- **Approved rows the system makes unmeasurable are registered, not worked around**, each with a
  live check, and recorded `not_measured` until the author decides.
- **Every gate is proven by breaking it** (`attest prove-gates`: 74 injected defects and 5 controls,
  including the independent results validator broken ten ways, the WP4 detector, the WP5 grouping
  and fix-verification checks, and the state-digest comparison).
- **The results are validated by code that does not trust the executor.** `attest validate-wp3`
  re-derives every observation, verdict and total from the raw records with its own
  re-implementation of the mapping; it refused the first official run for three records that
  lacked a read-back identity (D3.55).
- **Nothing is planned from a database that is not a build of the migration files.** The local
  Supabase stack is shared with the author's own Arc21 checkout; the planner reads the applied
  migrations first and refuses a mismatch (D3.50).

## Layout

| Path | Contents |
|---|---|
| `sql/inventory/` | The catalog probes, as plain SQL. Readable and runnable on their own. |
| `src/` | The harness. `db.ts` holds the connection identity model. |
| `seed/seed.sql` | Deterministic synthetic test data. |
| `evidence/runs/` | One directory per run. Never hand-edited. |
| `DECISIONS.md` | Every judgment call, with its alternatives and its reasoning. |
| `RUBRIC.md` | The risk rubric. Written by hand; the harness supplies facts, not scores. |
| `CHECKPOINTS.md` | Which checkpoints are approved, and what WP3 execution is still gated on. |
| `rubric/` | The author's inputs the harness reads: ratings, F5 invariants, fixtures, intents, the frozen approved WP3 matrix, the Gate A decisions, and the WP5 narratives (the author's words only). |
| `FINDINGS.md` | WP5: the ranked findings, remediation guidance and verification procedures — generated from the evidence; the narrative under each finding is the author's. |
| `CP4_PACKET.md` | The CP4 checkpoint packet: what WP3 found, what WP4 saw change, the ranked list, and every decision only the author can make. |
| `.wp4-states/` | Scratch (gitignored): Arc21's earlier schema states, written with `git archive`, which WP4 rebuilds from. Never Arc21 itself. |

## Limitations

These are not caveats added at the end. They bound what the output means.

- **The audit is not independent.** The author wrote Arc21 and wrote this harness. Nothing
  here is a third-party assessment, and an auditor would not accept it as one. The one
  mitigating fact, which is true: the inventory is read from the system catalogs rather than
  from the author's memory or documentation, so it would produce the same inventory for
  someone who had never seen the application.
- **Arc21 is not a regulated system.** It is a personal project used here as a test subject.
  It is not a GxP system, not a Part 11 system, and not compliant with anything.
- **This harness is not a product.** It is one person's tool for one system. It has not been
  validated, is not used by anyone, and has not been qualified as a testing tool.
- **The harness has produced wrong output ten times, and each is written up rather than
  quietly fixed** (`DECISIONS.md` D0.9, D0.13, D0.14, D1.5, D1.6, D1.7, D1.13; two in the first
  official WP3 run, D3.55 — an audit-trail heuristic that mis-judged eleven verdicts, and three
  records missing their read-back identity; and one in WP4, D3.56 — a state guard that compared
  digests as strings and read a reordering as a change). The last three were caught by the
  harness's own validation or by reading its output, and every run they affected is kept as it
  was written. Several
  produced confident, plausible, wrong answers with nothing about the output looking amiss —
  including one that made the validation report contradict itself two paragraphs apart. That
  bears directly on how much weight any single run deserves, and it is the reason a run now
  fails rather than degrades when the harness itself throws.
- **The validation shows the probes detect *those* breaks.** It does not show they would catch
  every possible weakening of the same control, and it says nothing about controls no scenario
  touches. Each break is deliberately obvious — an expression replaced with `true`, a trigger
  disabled. A subtler regression is a harder thing to catch and is not tested.
- **The harness's refusal to test on a role that bypasses row security is code, not a property
  of the database.** The login the control tests use *can* switch into `service_role`, which
  holds `BYPASSRLS`; the database permits it and a thrown exception in `src/db.ts` is what
  stops it.
- **`realtime.messages` partitions are created by the Realtime service at runtime**, so
  immediately after a rebuild the realtime publication is empty. Broadcast authorization is
  enforced by row policies on `realtime.messages`, which are present and inventoried; the
  publication being empty is a timing artefact of the rebuild, not an absence of control.
- **Scope is the application and data layer only.** No network, host, container or
  infrastructure security. Authentication itself is assumed to work; what is tested is what
  happens *given* an identity.
- **Nothing found will be fixed here.** Arc21 is a read-only assessment target. A finding is
  reported with its evidence, a recommended remediation and the exact Test IDs that would verify
  a future fix; it is never remediated or re-verified by Attest, and no closure is claimed.
- **The read-only guard sees git-visible state.** It fingerprints tracked files, the index, refs,
  untracked files (with their contents) and the names of ignored paths. It does not hash the
  contents of already-ignored directories such as `node_modules/` or the Supabase CLI's
  `supabase/.temp/`.
- **Platform-owned surface is reported but not assessed.** The anonymous-reach probe covers
  the whole instance, so Supabase's own defaults appear in the output. They are flagged as
  platform-owned and no finding is raised against them — they are not the author's code.

## Prior art

The idea of continuously monitoring controls and emitting evidence is not new, and this is
not an attempt to beat the tools that do it. Vanta and Drata do continuous control monitoring
commercially; Prowler does posture assessment for cloud accounts; several PostgreSQL linters
check row-level security configuration. This is a first-principles build of the same idea
against a system the author knows completely, so that every layer can be explained. Anything
borrowed from those tools is cited where it is used.

## Not yet done

**CP4** — the author's findings narrative, status decisions and approval (`CP4_PACKET.md`). Then WP6
framework mapping (a study exercise, not compliance), CP5, WP7 reporting (assurance report,
dashboard, plain-language summary), and the final reproducibility audit.
