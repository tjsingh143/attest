# Attest — access control assurance harness

**Status: work in progress. WP0 and WP1 of eight are complete.** Numbers below are from a real run and
are reproducible; the project is not finished and nothing here should be read as a completed
audit.

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

**This is destructive.** `bringup` drops and rebuilds the database. The harness refuses to
run against anything but a loopback address, and deliberately attempts unauthorized reads and
writes, so it may only ever be pointed at an instance that can be thrown away.

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
table is owned by `postgres`, which also holds `BYPASSRLS`. Whether that matters is a question
for the risk rubric, which is not written yet.

Full inventory: `evidence/runs/<run-id>/inventory.md`, with the machine-readable form beside
it in `inventory.json`.

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

## Layout

| Path | Contents |
|---|---|
| `sql/inventory/` | The catalog probes, as plain SQL. Readable and runnable on their own. |
| `src/` | The harness. `db.ts` holds the connection identity model. |
| `seed/seed.sql` | Deterministic synthetic test data. |
| `evidence/runs/` | One directory per run. Never hand-edited. |
| `DECISIONS.md` | Every judgment call, with its alternatives and its reasoning. |

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
- **The harness has produced wrong output more than once, and it is written up rather than
  quietly fixed.** Three times in WP0 (`DECISIONS.md` D0.9, D0.13, D0.14) and three times in
  WP1 (D1.5, D1.6, D1.7). Two of the WP1 cases were the harness misreading its own earlier
  writes and reporting a conclusion that was the opposite of the truth, with nothing about the
  output looking wrong. That bears directly on how much weight any single run deserves.
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

WP2 risk rubric, WP3 control testing, WP4 drift detection, WP5 remediation cycle, WP6 framework
mapping, WP7 reporting.
