# DECISIONS

One entry per judgment call that could reasonably have gone another way: what was decided,
what else was on the table, why this one, and what would be different if the other had been
chosen.

Entries are appended as work packages land, and a dated entry is left as it was written. Where
a later pass changed the thing an entry describes, the correction is a **new** entry or a
marked current-state note inside the old one — never a silent rewrite, because an entry that
quietly acquires today's numbers stops being a record of what was decided when.

The **risk rubric** itself lives in `RUBRIC.md`, and the **tier-to-assurance-activity mapping**
is its Part 5; both are the author's and both are written. Tier assignments that were not
obvious are D2.12. Still outstanding and still the author's: the **findings narrative** and
**which gap was remediated** (WP5), and the **framework mapping rationales** (WP6).

Checkpoint approval state is not here — it is `CHECKPOINTS.md`. This file records *reasoning*;
that file records *state*.

> **Current-state note, 2026-09-22.** The paragraph above names "which gap was remediated" as
> outstanding WP5 work. The author withdrew that on 2026-09-22, before WP3 was executed: Arc21
> is a read-only assessment target and no gap is remediated by Attest (D3.31). WP5's
> author-reserved artifact is still the findings narrative; what replaces the remediation is
> remediation *guidance* and verification procedures.
>
> **Current-state note, 2026-09-25.** Neither reservation is outstanding any more, and neither
> ended in the author's own composition. At CP4 the author adopted a findings narrative that is
> AI-assisted wording the author reviewed (`user_reviewed_ai_draft`, D3.59), and under Amendment
> A2 the framework-mapping rationales are AI-drafted and labelled so (D3.58, D3.60). The rubric
> remains the author's; the intents remain `user_reviewed_ai_draft` (D3.54).

---

## WP0 — Reproducible instance and control inventory

### D0.1 — Rebuild the existing local Supabase stack rather than standing up a second one

**Decided.** Attest points at the Arc21 local Supabase stack already running on this machine
and rebuilds it with `supabase db reset --local` on every run. A `pg_dump` of the prior
contents was taken first and is kept outside the repository, in `.local-backups/`.

**Alternatives.**

1. *Stand up a second, isolated Supabase instance on different ports.* The author's dev
   database would never be touched.
2. *Audit the instance as it was found, without rebuilding.* No data loss at all.

**Why this one.** Option 2 was disqualified by measurement, not by preference. The instance
as found had migration version `20260915120000` recorded as applied with no corresponding
file in the working tree and no record of it anywhere in the repository's git history, and it
was missing two of the three policies that
`20260831120000_realtime_channel_authorization.sql` creates on `realtime.messages`. Evidence
collected against it would have described a schema that exists in no version control
anywhere, and nobody — including the author — could reproduce it.

Option 1 is the better answer in principle and was rejected on host constraints: 8 GB of RAM
with twelve Supabase containers already running. Arc21's own `AGENTS.md` warns about this
machine being memory-constrained. A second stack would have consumed setup time that produces
no evidence, and risked making the machine unusable during runs.

The residual risk of the chosen option — destroying local development data — was removed by
taking a verified `pg_dump` first (1,492 archive entries, restorable) and by the fact that
`supabase db reset` is already Arc21's own documented workflow, present in its `package.json`
as `npm run db:reset`.

**What would change.** Under option 1, `src/config.ts` would point at a different port and
`bringup` would target a second project; nothing else in the harness would differ. Under
option 2 the harness would be measuring an unreproducible schema, and every number it
produced would be unciteable.

### D0.2 — The schema version is a content hash of the migration set, not a commit SHA

**Decided.** A run is identified by `sha256` over the ordered `sha256` of every file in
`supabase/migrations`. The git commit, branch and a dirty flag are recorded alongside it as
context.

**Alternative.** Use the commit SHA of the system under test, which is the conventional
answer and what most CI systems would do.

**Why this one.** The Arc21 working tree carries uncommitted changes, and one of them is a
migration file — `20260909120000_career_attempt_counts.sql` is untracked. A run labelled with
commit `58dcf39` would be claiming to describe a schema that commit does not produce. The
content hash is a fact about the files that actually built the database; the SHA is context.

**What would change.** With a SHA alone, two runs against materially different schemas could
carry the same label, and WP4's drift detection — which keys on schema version — would fail
to notice the difference. The cost of the chosen approach is that the identifier is opaque:
`5695a4c3df2d…` tells a reader nothing on its own, so the report prints the commit, the
branch, the dirty flag and the list of uncommitted migrations next to it.

### D0.3 — TypeScript on Node, with `node-postgres`

**Decided.** The harness is TypeScript run directly by Node 23.6+ (no build step — Node
strips types natively), with exactly one runtime dependency, `pg`.

**Alternatives.** Python with `psycopg`; shelling out to `psql` inside the database container.

**Why this one.** Three reasons, in order of weight.

1. *Evidence quality.* An evidence record must state the actual outcome, and the difference
   between "the query returned zero rows", SQLSTATE `42501 insufficient_privilege`, and "new
   row violates row-level security policy" is the entire signal a control test produces. A
   driver exposes SQLSTATE as a field. Shelling out to `psql` means recovering it by parsing
   stderr, which would make the most important column in the evidence store the least
   reliable one.
2. *One toolchain.* Arc21 is TypeScript. The author does not have to context-switch to read
   or defend the harness.
3. *Nothing to install.* Node 26 was already present; the machine had neither `psql` on the
   host nor any Python database driver.

**What would change.** Python is the more common language in security and GRC work, and a
reviewer from that world might find it more familiar. If the dashboard in WP7 turns out to
want a Python plotting stack, this decision is worth revisiting — it is not load-bearing for
anything but convenience.

### D0.4 — Two connection identities, and the harness refuses to test on the wrong one

**Decided.** `src/db.ts` exposes exactly two kinds of connection.

- `adminSession()` connects as `postgres` and is used for **catalog reads and seeding only**.
  Its identity record carries `bypassesRls: true`, so anything produced on it is
  self-labelling.
- `roleSession()` connects as `authenticator`, issues `SET ROLE`, then installs identity
  claims into `request.jwt.claims`. Every control test runs here.

`roleSession()` reads its own privilege level back out of the database after switching and
**throws** if the resulting role is a superuser or holds `BYPASSRLS`, unless the caller
explicitly asks for that (which only the WP1 over-privilege demonstration does).

**Alternative.** Connect as `postgres` throughout and use `SET LOCAL ROLE authenticated`,
which is what Arc21's own pgTAP suite does and is entirely normal.

**Why this one.** On this instance `postgres` is not a superuser but **does** hold
`BYPASSRLS`, and it owns all 38 application tables while not one of them has `FORCE ROW LEVEL
SECURITY` set. It is therefore exempt from row-level security three different ways. `SET
LOCAL ROLE` does produce a session where `current_user` is `authenticated` and policies do
apply — that part of the pgTAP approach is sound — but the connection can always
`RESET ROLE` back to a role that bypasses everything, so the isolation is a convention rather
than a boundary. `authenticator` is a `LOGIN`, `NOINHERIT` role that is not a superuser, does
not hold `BYPASSRLS`, and is not a member of `postgres`; it can reach `anon`, `authenticated`
and `service_role` and nothing else. That is a boundary.

**What would change.** Under the alternative, a bug in the harness that forgot to switch
roles, or a test that ran after a `RESET ROLE`, would pass every isolation check while
exercising no policy at all. That is the exact failure WP1 exists to rule out, so the check
is written as a thrown exception rather than a comment.

### D0.5 — "The application" is `public`, `private`, and `realtime.messages`

**Decided.** The one hand-written list in the inventory. Everything downstream of it is read
from the catalogs.

**Why.** `public` and `private` are created by Arc21's migrations. `realtime.messages` is
not — it is a platform table — but Arc21 authors three row policies on it, so the control is
the author's even though the table is not. Leaving it out would drop channel authorization
out of the inventory entirely.

**What would change.** A schema added to Arc21 later and not added to this list would be
invisible to the harness. That is a real weakness and the reason the list is in
`src/config.ts` with a comment pointing here, rather than buried in a query.

### D0.6 — Row-level security *enabled with no policy* is recorded as a control, not a gap

**Decided.** The gap taxonomy separates five states rather than asking "does it have a
policy".

| State | Classified as |
|---|---|
| RLS off, and a client-reachable role holds a privilege | uncontrolled |
| RLS off, no client-reachable privilege | controlled by the grant surface alone |
| RLS on, no policy, no client-reachable grant | **deny by default** — the most restrictive state there is |
| RLS on, no policy, but a grant exists | grant and policy set disagree; effectively denied |
| RLS on, policies present, not forced | owner bypass available |

**Alternative.** Flag every table with zero policies, which is what a straightforward linter
does.

**Why this one.** Five tables on this instance have row-level security enabled and no policy:
`private.career_drill_seeds`, `private.game_commands`, `private.game_state_private`,
`public.rate_limit_events`, `public.rate_limit_policies`. Enabled-with-no-policy denies
everything to every non-owner — it is stricter than any policy could be, and in each of these
five cases it is deliberate and documented in the table's own `COMMENT`. The naive rule would
have opened the findings list with five false positives, which is the fastest way to make a
security report unreadable.

**What would change.** The simpler rule is cheaper and would never miss a genuinely
policy-less table. The chosen rule depends on the grant sweep being correct — if the grant
probe under-reports, a table would be classified "deny by default" when a grant actually
reaches it. That is why the schema-`USAGE` check is applied before a grant counts as reach,
and why the harness crashes rather than returning an empty list when a privilege probe
returns something it cannot parse (see D0.9).

### D0.7 — Trigger-enforced write guards are inventoried as controls

**Decided.** The inventory captures a fourth control mechanism the brief does not name:
triggers that refuse writes. Fifty-two of them exist on in-scope tables —
`deny_client_write`, `guard_ledger_append_only`, `deny_truncate` and others.

**Why.** The brief lists row-level security, grants, `SECURITY DEFINER` functions and
realtime as the surface to enumerate. On this system that would have been an incomplete
answer in both directions. It would under-count the control surface, and — worse — it would
let the harness report "nothing prevents a client updating this row" on a table where a
trigger does exactly that. `TRUNCATE` is the sharpest case: row-level security does not apply
to `TRUNCATE` at all, so a table whose rows are protected by policies can still be emptied by
anyone holding the privilege, and a trigger is the only thing that can refuse it.

**What would change.** Nothing about the brief's requirements is dropped by adding this; the
cost is that WP3 now has a control family to test that was not in the original ten. This is
flagged at CP1 rather than absorbed silently.

### D0.8 — "What the anonymous role can reach" is swept instance-wide, with platform rows flagged

**Decided.** The anonymous-reach probe covers every schema on the instance, not only the
application's, and flags each row as application-owned or platform-owned.
`pg_catalog` and `information_schema` are excluded.

**Why.** WP0 asks what the anonymous role can reach. Scoped to `public` and `private`, the
answer would have been five read-only catalogue tables and looked clean. Instance-wide, `anon`
also holds full DML including `TRUNCATE` on `supabase_functions.hooks` and
`supabase_functions.migrations`, both with row-level security switched off. Those are Supabase
platform defaults on a local development stack, they are not the author's code, and brief §4
puts findings about a third party's system out of scope — so they are recorded as facts about
the instance and explicitly marked as not findings against Arc21. Reporting the narrow answer
would have been the more comfortable choice and the less true one.

The `pg_catalog` / `information_schema` exclusion is an editorial judgment: every PostgreSQL
installation grants PUBLIC read on the catalogs and EXECUTE on several hundred built-ins.
Including them added 300 rows that are true of every database in the world. The exclusion is
stated in the probe and in the report rather than applied silently, because "what anon can
reach" with an unstated filter on it is a different claim from the one the heading makes.

### D0.9 — A probe that returns something unparseable crashes the run

**Decided.** The array reader in `src/inventory.ts` throws when handed a value that is not an
array, instead of returning an empty one.

**Why.** This is a decision taken in response to a bug this harness genuinely shipped with
for one run. `array_agg(rolname)` produces `name[]`, not `text[]`; `node-postgres` has no
parser registered for `name[]` and returned the raw string `"{authenticated}"`. The helper
tested `Array.isArray`, found false, and quietly returned `[]`. The inventory then reported
that **no** function in the application schemas was callable by any client role. Sixty-one
were. Every count in that run's report was wrong and the report looked entirely normal.

The bug was caught by cross-checking the harness's output against the database by hand rather
than by anything in the harness. The fix is two-part: cast the aggregates to `text` in the
probe SQL, and make the same class of failure loud.

**What would change.** A harness that degrades gracefully keeps running when a probe
misbehaves. This one stops. For a tool whose entire output is evidence, a wrong number that
looks right is worse than no number, so it stops.

The runs produced before the fix were **deleted** rather than kept. They are real executions,
so keeping them would not have been dishonest, but they are the output of a tool that was
demonstrably miscounting, and leaving them in the evidence store would have given WP4's
run-over-run diff a first "control added: 61 function grants" that reflected a harness bug
rather than any change to Arc21.

### D0.10 — The inventory classifies structure and does not rate risk

**Decided.** `buildInventory` emits *observations* with mechanical kinds
(`anon_reachable`, `rls_enabled_not_forced`, …) and no severity, no ranking and no risk
language. The generated report says so in the section itself.

**Why.** Brief §1.1 reserves the risk rubric (WP2) and the findings narrative (WP5) for the
author. A gap list that arrived pre-ranked would be the harness quietly writing both, and the
ranking would then be the thing the author could not defend in a room.

### D0.11 — Attest judges the catalogs independently rather than re-running Arc21's own gate

**Decided.** The inventory reads `pg_policy`, `pg_class`, `pg_proc`, `pg_attribute` and the
ACL catalogs directly. It does not call
`public.assert_client_authorization_surface()`.

**Why.** Arc21 already contains that function — a deploy-time authorization gate the author
wrote, which twenty of the fifty-nine migrations invoke, backed by a thirty-assertion pgTAP
file that deliberately breaks the surface and checks the gate notices. Calling it from Attest
would produce a harness that passes whenever the author's own assumptions hold, which is the
one thing it must not do. The gate encodes what the author intended; the catalogs record what
is there.

This has a consequence worth stating before any results exist: Arc21's access control is
already hardened and already tested, so a first audit that finds little is a plausible
outcome here. Brief §5 says a clean first audit should be treated as suspicious before it is
treated as good news, and that instruction applies to this system more than most.

### D0.12 — The seed lives in Attest and runs through Arc21's own bootstrap

**Decided.** `seed/seed.sql` is owned by this repository and applied after the rebuild.
Running the harness writes nothing to the Arc21 tree. The seed creates accounts by inserting
into `auth.users` and lets Arc21's `on_auth_user_created` trigger produce the profile, wallet,
initial 25,000-chip ledger grant and stats row.

**Why.** Seeding through the application's own bootstrap means the seeded state is state the
application can actually produce, rather than a shape invented by the harness. Every
identifier is a literal so two runs start byte-identical, and a failing test can be re-run
against exactly the rows it failed against.

One shape choice is deliberate and worth naming: of the three ordinary accounts, **two are
seated at the one game session and the third is not.** A policy that admits "a participant" is
only shown to work if there is a non-participant present to be refused.

**What would change.** Seeding by direct insert into `public.profiles` and `public.wallets`
would be faster and would not depend on the trigger. It would also mean the harness could
create states the application cannot, and a test passing against an impossible row proves
nothing.

### D0.13 — "Reachable by anon" is split into granted-and-admitted versus granted-but-denied

**Decided.** The classifier distinguishes a resource where `anon` holds a grant **and** a
policy names `anon` or `PUBLIC` (genuinely reachable) from one where `anon` holds a grant but
no policy admits it (refused by row security, grant latent).

**Why.** The first version collapsed both into "reachable without an account" and was wrong
about `realtime.messages`: `anon` holds `INSERT`, `SELECT` and `UPDATE` on it — a Supabase
platform default — while all three of Arc21's policies on it are `to authenticated`. Row
security refuses `anon` every time. Reporting that as anonymous reach would have been a false
positive on the single most sensitive channel in the system, and WP3 family 4 would have been
written to test for an exposure that does not exist.

Recording it as nothing at all would have been the opposite error. The grant is real and it is
latent: it becomes live the moment a permissive policy naming `anon` or `PUBLIC` is added to
that table, or row security is switched off on it. That is a genuine standing condition, and
it is a different test from "can anon read this today".

**What would change.** Under the collapsed version the anon surface reads as five application
resources. Under this one it reads as four reachable plus one latent — and the four are all
read-only catalogue tables whose policies name `anon` on purpose.

### D0.14 — Triggers are inventoried in full, and "can refuse" is a labelled heuristic

**Decided.** All 52 triggers on in-scope relations are captured. A `can_refuse` flag marks
those whose function body contains a `RAISE` that aborts — 39 of the 52, on 32 tables. The
remaining 13 are housekeeping (`set_updated_at` accounts for 9 of them).

**Why.** The first version of this probe called the control kind `write_guard_trigger` and
counted all 52 as controls. That was wrong in a way worth recording: `set_updated_at`
maintains a column and refuses nothing, and reporting "52 write guards" would have inflated
the control surface by a quarter in a document whose whole purpose is to state the surface
accurately.

**The heuristic is known to be wrong in at least one direction, and the case is real.**
`guard_profile_display_name_rate` refuses a write by calling `enforce_rate_limit()`, which
raises one level down. The body-text test does not see it, so the inventory classifies a
genuine control as housekeeping. The pattern was deliberately **not** widened to catch it,
for two reasons: chasing raises through call graphs by text matching gets less reliable the
further it goes, and the honest fix is not a better regex. It is WP3, which settles whether a
trigger refuses anything by issuing the statement and recording what came back.

**What would change.** Dropping the flag entirely would mean the reader cannot tell a control
from a timestamp maintainer without reading 52 function bodies. Trusting the flag as truth
would mean the inventory asserts something it cannot know. Labelling it as a heuristic
everywhere it is reported is the only version of this that survives someone asking "how do
you know?".

---

## WP1 — Harness validation

### D1.1 — "Detected" means the recorded outcome changed, not that an assertion failed

**Decided.** A scenario counts as detected when the probe's recorded outcome against the
weakened control **differs** from its outcome against the intact one.

**Alternative.** Define detection as "the check that passed now fails", which is what a test
runner would naturally report.

**Why this one.** The two come apart, and where they come apart is exactly where a harness
fools itself. A probe can fail against both the intact and the broken control — for a reason
that has nothing to do with the control, such as a missing privilege stopping the statement
before any policy is consulted. Under the alternative that reads as "the test caught it".
Under this definition it reads as what it is: a probe that cannot see the control at all.

This is not hypothetical. S2's first draft failed identically in both states, and the
definition above is what surfaced it rather than hiding it behind a red check mark.

**What would change.** Nothing about the reported results; every scenario here satisfies both
definitions now. The difference is that this one is falsifiable and the other is not.

### D1.2 — The over-privileged demonstration is framed as discrimination, not as passing

**Decided.** The brief asks for a demonstration that an admin connection "does not catch the
violation". That is measured here by running the identical statement on the over-privileged
connection against both the intact and the broken control and comparing the two answers.

**Why.** "The test passes vacuously" is the usual phrasing and it is too loose to check. A
negative test run as an admin frequently *fails* — the admin performs the forbidden action, so
the assertion trips. Reporting that as "did not catch it" would be wrong.

The sharp and checkable version is: **the over-privileged connection returns the same answer
whether the control is intact or broken.** No assertion built on it can discriminate, whatever
the assertion says. That is true in all five scenarios for both over-privileged identities, and
it is measurable rather than rhetorical.

**An unexpected result worth keeping.** The two are blind for opposite reasons.
`admin(postgres)` succeeds in both states — it is exempt, so the control is never consulted.
`service_role` is *refused* in both states in four of five scenarios, because Arc21 grants it
no privilege on `wallets`, `push_tokens`, `profiles` or `private` at all. One connection is
over-privileged past the control; the other is under-privileged short of it. Neither is
standing where a client stands. The report says this rather than collapsing both into "blind".

### D1.3 — Five scenarios across five mechanisms, not five policies

**Decided.** S1 a SELECT policy's USING half; S2 an INSERT policy's WITH CHECK half; S3 a
column grant and a write-guard trigger together; S4 a Realtime channel policy; S5 the schema
grant surface and RLS deny-by-default.

**Why.** The brief asks for at least three control *families*. Breaking three SELECT policies
on three tables would satisfy the letter of that and demonstrate one thing three times. These
five exercise five structurally different refusal paths, and two of them refuse by returning
no rows while three refuse by raising — which is precisely the distinction the evidence model
has to get right.

Two scenarios are deliberately multi-stage, because a single-stage break cannot show
defence in depth:

- **S3** removes the column grant first. The write is *still* refused, by the trigger. Only
  when the trigger is also disabled does it succeed. Arc21's documentation calls the trigger
  "the second lock"; this is the claim executed.
- **S5** grants `USAGE` on `private` and `SELECT` on the table. The read *still* returns
  nothing, because row-level security is enabled with no policy. Only when a permissive policy
  is added does the state leak. This is the CP1 deny-by-default reasoning executed rather than
  argued — and it is the one that matters most, because five tables in the inventory rest on it.

### D1.4 — Controls are weakened in place, never dropped

**Decided.** A policy's `USING` or `WITH CHECK` expression is replaced with `true` via `ALTER
POLICY`, after the original expression is read out of the catalog. Triggers are disabled, not
dropped. Grants are added and revoked.

**Alternative.** `DROP POLICY`, then re-create it from a stored `CREATE POLICY` statement.

**Why this one.** Restoration has to be exact, and reconstructing a `CREATE POLICY` statement
means reassembling the command, the roles, the permissive flag and both expressions from
separate catalog columns and hoping the rendering round-trips. `ALTER POLICY ... USING
(<original>)` puts back the expression the catalog just handed over. The whole control
inventory is re-read at the end and compared to the one taken at the start to confirm it.

### D1.5 — `INSERT ... RETURNING` makes a probe test two controls, so the probes do not use it

**Decided.** No probe uses a `RETURNING` clause. Rows affected are read from the driver's
`rowCount` instead.

**Why.** This is the most useful thing WP1 found, and it is about test construction rather
than about Arc21. PostgreSQL applies `SELECT` policies as an additional `WITH CHECK` on the row
an `INSERT ... RETURNING` hands back. S2 was written the obvious way — insert a row attributed
to another user, `returning id` — and it therefore exercised `push_tokens_insert_own` **and**
`push_tokens_select_own` at once. Weakening only the first left the second refusing, the
outcome did not change, and the scenario reported that the harness could not detect a break it
had just made.

The failure mode this points at is the dangerous one. Had the scenario been written to weaken
both halves, it would have "passed" while being unable to distinguish which control was doing
the work. A probe named for one control has to exercise that control alone, or its result
means nothing.

**What would change.** Nothing about coverage; the same statements are issued. What changes is
that the result is attributable to the control the test is named after.

### D1.6 — Rows affected, not rows returned

**Decided.** `Outcome.rowCount` reads the driver's `rowCount`.

**Why.** Follows from D1.5. With `RETURNING` removed, a successful `INSERT` returns no rows,
and measuring `rows.length` would have scored it as `0 rows` — indistinguishable from a read
that was filtered to nothing. Two opposite outcomes collapsing to the same recorded value is
the same class of defect as D0.9.

### D1.7 — Every probe cleans up after itself, not at the end of the scenario

**Decided.** A scenario's cleanup statements run after **every** probe.

**Why.** Another self-inflicted false result. Cleanup originally ran once per scenario. In S2
the `admin(postgres)` probe inserted a row while the control was intact, and the same probe
against the broken control then failed on a duplicate key — so the scenario reported that the
admin connection *could* tell intact from broken. It could not. It was reading its own earlier
write. The reported conclusion was the opposite of the truth, and nothing about the output
looked wrong.

### D1.8 — The FORCE demonstration uses a scratch role and a scratch schema, and draws no conclusion

**Decided.** The effect of `FORCE ROW LEVEL SECURITY` is demonstrated on a table created for
the purpose, owned by a role holding no `BYPASSRLS`, in a schema created and dropped inside the
run. Nothing in Arc21 is altered.

**Why the scratch role.** `postgres` owns every Arc21 table *and* holds `BYPASSRLS`. Watching
it ignore a policy proves nothing about which of the two rules did it, and `FORCE` only
addresses one of them. A role with ownership and nothing else isolates the variable: two rows
in the table, a policy admitting one, owner sees two unforced and one forced. The same
sequence then shows `postgres` still seeing both **with FORCE on**, because `BYPASSRLS` is a
separate door that `FORCE` does not touch.

**Why the scratch schema.** Changing a table's owner requires the incoming owner to hold
`CREATE` on the containing schema. The first version granted `CREATE` on `public` to the demo
role for the length of the demonstration. That is a harness modifying the access control
surface of the system it is measuring, for its own convenience, and it is not acceptable even
briefly. The demo gets its own schema instead.

**Why it stops short of a verdict.** The section establishes the mechanism and answers the
reachability question by executing it — no client login can reach the table owner; a holder of
the `authenticator` credential *can* reach `service_role`, which bypasses row security. Whether
that is acceptable is a risk judgment. It belongs to the rubric in WP2 and it is the author's.

### D1.9 — The guard against testing on a bypassing role is code, and the report says so

**Decided.** `roleSession()` refuses to return a session holding `BYPASSRLS`, and the
validation report presents that refusal as a property of the harness rather than of the
database.

**Why.** The executed escalation probes show that `authenticator` — the login every control
test uses — **can** `SET ROLE service_role`, which holds `BYPASSRLS`. The database permits it.
What prevents a control test from silently running on a bypassing role is a thrown exception in
`src/db.ts` and nothing else.

Presenting that as "the harness cannot escalate" would be false. It is load-bearing precisely
because the database *would* allow the mistake, and the report is written that way.

### D1.10 — WP1's evidence records carry no intent statement

**Decided.** Every WP1 evidence record has `intent: null` and a mechanical `description`
instead.

**Why.** Brief §1.1 reserves "the intent statement for each negative test — one sentence naming
the attack it simulates" for the author, in WP3. WP1's probes exist to validate the harness
rather than to assess Arc21, so they describe what the statement does and leave the field
empty. The WP3 suite will not, and the field is already in the record shape so that it is
visibly missing rather than quietly absent.

### D1.11 — Every artefact carries a hash of the harness that produced it

**Decided.** `run.json` and the validation output record a content hash over the harness's own
sources (`src/**/*.ts`, `sql/**/*.sql`, `seed/seed.sql`) alongside the schema version.

**Why.** WP4 compares one run's output to another's, and a difference between two runs can come
from the schema changing or from the harness changing. Without this field the two are
indistinguishable, and a refactoring of the inventory would be reported as Arc21 gaining or
losing controls. That is not hypothetical here: D0.14 reclassified triggers, which changed the
shape of every inventory produced before it.

A content hash rather than a version number, because a version number is a thing somebody has
to remember to bump and this one cannot be forgotten.

**Consequence, applied now.** The evidence store was regenerated from scratch at the end of
WP1. The runs in it before that point were produced by a harness of a different shape, and a
store mixing versions would have handed WP4 a first diff full of differences that were not
about Arc21 at all.

### D1.12 — One command, one run id

**Decided.** `attest run` mints one run id and every artefact it produces lands in that
directory.

**Why.** The first version let the inventory step and the validation step each generate their
own from the clock. They ran a second apart, so a single command produced two run directories
holding half the evidence each — an inventory with no validation beside it, and a validation
with no inventory. Evidence that a control was tested is worth much less when the description
of the control it was tested against is filed somewhere else.

### D1.13 — A harness error is never a result, and the run stops when one happens

**Decided.** `Outcome` carries a `harnessError` flag. It is set when the thrown error has no
five-character SQLSTATE, which means it came from this process rather than from PostgreSQL. An
expectation never matches a harness error, and any run containing one exits non-zero.

**Why.** The fourth defect this harness has shipped, and the most dangerous of them.

The escalation probe issued `reset role; set role service_role` as one string. node-postgres
returns an **array** of results for a multi-statement query, so `res.rows` was `undefined`, and
reading `.slice()` off it threw a `TypeError`. `execute()` caught it the way it catches a SQL
error and recorded `raised: true` with `sqlstate: null`.

The consequence was not a crash. It was a confident, wrong answer. The report stated that the
client login **cannot** reach a role holding BYPASSRLS — in a table two paragraphs above prose
that said it can. The true answer, verified separately, is that it **can**: `authenticator` is
a member of `service_role`, and nothing in the database prevents the switch.

The general shape is what matters. A probe that expects a refusal is satisfied by *anything*
that fails. If the harness itself is what failed, the probe reports that the control held while
nothing whatsoever was measured. Every security check written as "this should be denied" has
this failure mode, and it is silent by construction.

Two fixes, because one would not have been enough:

1. Multi-statement results are unpacked correctly, and the probes that caused it now issue
   single statements — `SET ROLE` is authorised against the session user, so the `RESET ROLE`
   was never needed.
2. Errors without a SQLSTATE are classified as harness errors, never match an expectation, are
   rendered as `HARNESS ERROR` rather than as a refusal, and fail the run.

**What would change.** Without the second fix the first would have closed this instance of the
bug and left the class open. The class is the part worth having caught.

---

## WP2 — Risk rubric scaffold

The entries below cover the **scaffold only**. The rubric's dimensions, levels, weights,
aggregation rule, thresholds and every per-resource tier are the author's, and are recorded in
`RUBRIC.md` and in the WP2 entries the author adds here after authoring it.

### D2.1 — The scaffold supplies facts and refuses to supply judgments

**Decided.** `risk-inputs.md` contains no score, no tier, no severity and no ranking. It
contains, per resource, what the database says: every column and type, which column carries the
identity, what depends on it, what it depends on, which triggers can refuse a write, which
server functions name it, and how it is exposed.

**Why.** Brief §1.1 reserves the rubric for the author. The reservation is easy to honour in
name and hard to honour in fact, because a scaffold that pre-sorts resources, or names its
columns suggestively, or orders them by anything that looks like severity, has made most of the
decision already. The worksheet is therefore sorted by exposure class and dependant count —
stated in the document as a reading order rather than a ranking — and every judgment column
arrives holding `?`.

**The line that was drawn.** A classification the catalogs decide is a fact; what it is worth is
a judgment. `exposure` is the only dimension the scaffold classifies, because grants and
policies decide it outright. Nothing else is pre-filled.

### D2.2 — The identity column is computed transitively

**Decided.** "Which column says whose row this is" is resolved by walking foreign keys to a
fixed point: `auth.users`, plus any relation whose **primary key** is a foreign key to an
identity relation, and then any column pointing at one of those.

**Why.** The one-hop version reported that almost nothing in Arc21 has an owner, which is the
opposite of the truth. Only `public.profiles` references `auth.users` directly, via
`profiles.id` — which is also `profiles`' primary key, making `profiles` an identity relation —
and the thirty-odd tables carrying `user_id → profiles.id` are naming a person through it. The
naive result was 7 of 40 resources with an owner column; the correct one is 28.

That matters because blast radius is unscoreable without it. A rubric handed "this table has no
owner" for `public.wallets` would rate it as shared state.

**Alternative rejected.** Matching column names against a list like `user_id`, `owner_id`,
`sender_id`. It would have produced roughly the right answer here and it is a guess dressed as
a measurement; `blocks` carries `blocker_id` **and** `blocked_id`, and only the catalog says
both are people.

### D2.3 — Exposure has four classes where the brief names three, and the fourth is the author's call — **REVERSED, see D2.6**

**Decided.** The scaffold classifies exposure as `anonymous`, `anonymous_latent`,
`authenticated` or `server_only`, and explicitly asks the author to decide what to do with the
extra one rather than resolving it.

**Why.** The brief's three — anonymous, authenticated, server-side — do not describe
`realtime.messages`, which grants `anon` `INSERT`, `SELECT` and `UPDATE` while every policy on
it names `authenticated`. It is granted to anonymous callers and refused to them. Folding it
into `anonymous` overstates today's reachability; folding it into `authenticated` hides a live
grant that becomes real on one policy change. Either is defensible and the choice changes a
score, so it is a decision and not a definition.

### D2.4 — No scorer is written until the rubric exists

**Decided.** `attest rubric` reports what is still blank and computes nothing. The parser, the
tier computation and the sensitivity analysis are written after `RUBRIC.md` is authored, to fit
what it says.

**Why.** A parser written first would fix the rubric's shape before the author chose it — how
many levels a dimension may have, whether weights are numbers, what an aggregation rule is
allowed to be. The author would then write a rubric that satisfies the format. That is the
harness authoring the rubric through the back door, and it would be invisible in the finished
document.

**Cost, accepted.** The scoring tooling is written twice if the rubric's shape turns out to need
something the first pass did not anticipate. That is cheaper than a rubric shaped by a parser.

### D2.5 — Two cross-cutting facts are carried as evidence, not as dimensions

**Decided.** The absence of `FORCE ROW LEVEL SECURITY` and the `authenticator → service_role`
reachability are recorded in `RUBRIC.md` Part 4 as factual inputs with no severity, not as
rubric dimensions and not as findings.

**Why.** Both are properties of the role and table setup rather than of any single resource, so
scoring them per-resource would double-count them across 40 rows. Both also require information
the database does not hold — what deployment looks like, who holds which credential, what an
attacker could do with the transition — so a score derived from the catalogs alone would be
more confident than the evidence supports.

Part 4.2 therefore records the four questions the author specified as the things that must be
answered before the `service_role` reachability can be rated, and leaves them open. Attest can
answer none of them: two are about architecture, two about consequence.

### D2.6 — Reverses D2.3: exposure keeps the brief's three values, and the latent condition becomes two facts

**Decided.** `ExposureClass` is `anonymous | authenticated | server_only` — effective current
reachability, and nothing else. The granted-but-refused condition is recorded as two separate
booleans on every resource: `anonymousGrantExists` and `anonymousPolicyPermits`.

**Why D2.3 was wrong.** It invented a fourth class, `anonymous_latent`, and presented it as a
measurement. It was not one. Whether a grant that no policy admits deserves its own rung between
"anonymous" and "authenticated" is precisely a rubric judgment — it is the question of whether
you rate what is reachable today or what is one policy change away — and creating the rung
answered it before the author saw it.

The distinction is worth stating generally, because it is the trap this whole scaffold exists to
avoid: *a classification the catalogs decide is a fact; a classification that encodes how much
something matters is a score.* "anon holds INSERT and no policy names anon" is the first.
"…therefore it sits between anonymous and authenticated" is the second.

**What is preserved.** Everything. `realtime.messages` now reads: effective reachability
`authenticated`, anonymous grant exists `yes`, anonymous policy permits `no`. The rubric can
treat those three facts however it likes — including ignoring the last two — and the scaffold
has no opinion.

**What would change.** Under D2.3 the author inherits a four-level exposure scale and has to
argue their way out of it. Under this one they inherit three levels and two facts, and decide
what the facts are worth.

### D2.7 — Identity linkage is split into measured and inferred, with the path recorded

**Decided.** `directIdentityColumns` holds columns with a foreign key straight to `auth.users`
(7 resources). `inferredIdentityColumns` holds columns that reach it through an intermediate
relation (21 resources), each carrying the full path — e.g.
`public.wallets.user_id -> public.profiles -> auth.users`.

**Why.** D2.2 computed the transitive closure and reported one merged list, which quietly
asserted that a two-hop linkage and a direct foreign key are the same claim. They are not. The
inference — a relation whose primary key is a foreign key to an identity relation is itself an
identity relation — is sound and it is still an inference, and a rubric may reasonably weigh a
one-to-one identity table differently from a direct reference.

Printing the path matters more than the split does: it turns "trust this" into "check this".

**A schema observation that fell out of it, and is not a finding.** Arc21 is not consistent
about which it uses. Seven tables carry a foreign key straight to `auth.users`; twenty-one go
through `profiles`; twelve have no identity linkage. That is recorded in `RUBRIC.md` only so
that a rubric does not end up rating the inconsistency instead of the risk.

### D2.8 — The rubric architecture is not assumed to be numeric

**Decided.** `RUBRIC.md` Part 2 sets out three structures — ordinal with rule-based tier
assignment, numeric with weights and thresholds, and a hybrid with floors — with the
consequences and costs of each, and recommends none. The author chooses, and deletes the
specifications their choice does not use.

**Why the first draft was wrong.** It went straight to a weights table, an aggregation rule and
numeric thresholds. The brief requires five dimensions and three tiers; it does not require
numbers. Presenting a weights table as a form to fill in made a numeric model the default
through layout alone, and a default expressed as a form is the hardest kind to notice and argue
with.

The difference is not cosmetic. A numeric model asserts that the dimensions are commensurable
and that levels sit on an interval scale — that the gap between "one user" and "all users" is a
quantity that can be multiplied by a weight. A rule-based model asserts only that the levels
rank. Those are different claims about the world and the author should be the one making
whichever gets made.

**What would change.** Under the first draft the author would very likely have filled in the
weights table, because it was there. The cost of this version is that Part 2 is longer and asks
a question before it asks for input.

### D2.9 — Identity provenance is recorded, and is not a risk property

**Decided.** The direct/inferred split and the recorded path are **evidence provenance**: they
say how confidently the scaffold knows who owns a row. They are not a sixth dimension and carry
no implication that inferred ownership is riskier or safer than direct ownership.

**Why it needed saying.** D2.7 split the two for a good reason and then listed "do you weigh a
two-hop linkage the same as a direct FK?" among the rubric's open questions — which quietly
promoted a provenance note into a risk input. Those are different things. Whether a column
reaches `auth.users` in one hop or two is a fact about how the scaffold learned who the owner
is; it says nothing about what happens if the control over that row fails.

If provenance is to affect a score it has to be written into one of the five dimensions
explicitly. Otherwise it stays a note about how the fact was obtained.

### D2.10 — Evidence sufficiency is recorded per judgment, and its effect on risk is not decided

**Decided.** Every written assessment and every scored resource carries an evidence mark:
`E` established, `P` partially established, `U` unknown. The scaffold records the mark and takes
no position on what it should do to a tier.

**Why.** Several judgments in this rubric rest on evidence of visibly different strength. The
exposure classification is read from the catalogs. The reversibility of a wallet corruption
depends on backups and detection that Arc21 does not have and this repository cannot show. The
`service_role` reachability question is answered from source for the local case and is
**unknown** for the deployed one. A rubric that presents all three as equally grounded is
overstating two of them.

**Why it is not a sixth dimension.** Because "how well do I know this" is not a kind of risk, and
combining it with the five as though it were would mean a well-understood low-risk resource and a
poorly-understood one become arithmetically comparable. What an unknown *should* do — raise a
tier on precautionary grounds, lower stated confidence without moving the tier, trigger a note in
the findings, or nothing — is a methodology decision and belongs to the author.

**Cost.** One more column in the scoring table, 40 marks. Proportionate: the alternative of
marking evidence per dimension per resource would have been 200 more cells for a distinction that
rarely varies within a single resource.

### D2.11 — The sensitivity requirement is scoped to four items

**Decided.** `RUBRIC.md` Part 6 states the minimum sufficient form explicitly: one alternative
differing in **one identifiable way**, the table of resources that move, the test-count delta
computed from the Part 5 activity definitions, and a sentence of conclusion.

**Why.** The brief asks which resources would change tier under a reasonable alternative rubric
and what that costs in test count. Read expansively that becomes a second risk programme, which
is scope the brief did not ask for and which brief §8 warns against. Read too narrowly it becomes
a comparison against a strawman, which proves nothing.

The constraint that does the work is **one identifiable difference**: it makes any tier change
attributable to that difference rather than to a dozen at once. The scaffold also names the
cheapest honest source of an alternative — one of the ambiguous cases the author had to decide
anyway, or the architecture choice — because a disagreement the author genuinely had is a
disagreement a competent reader could also have.

**What is left to the author.** Which alternative. A sensitivity analysis is only meaningful
against a rubric somebody would actually defend, and the author is the one who knows which of
their own choices was closest to going the other way.

---

## WP2 — applying the author's rubric

The rubric itself — dimensions, levels, architecture, combination rules, the five pre-decided
cases, the assurance mapping and the sensitivity alternative — is the author's and is recorded in
`RUBRIC.md`. The entries below cover only its **application**: where the levels were not obvious
from the dossiers, and where the implementation had to choose something the rubric did not fix.

### D2.12 — Tier assignments that were not obvious

One line each, per the rubric's requirement. The five cases the author pre-decided are not
repeated here.

| Resource | Tier | Why it is not the obvious answer |
|---|---|---|
| `public.rate_limit_events` | High | A pruned, transient counter table reaches High because deleting rows resets a user's rate-limit window, which the rubric classes as corrupting a security control. |
| `public.rate_limit_policies` | High | Configuration rather than data, but it is *the* rate limit for every action in the product, so corruption weakens a security control globally. |
| `public.career_nodes` | High | Rated with `rulesets` rather than with `cosmetics` because it carries `reward_chips` and `starting_chips`: corrupting a node changes the economy, which the author's Part 4.4 distinction treats as High integrity. |
| `public.tournaments` | High | Same reasoning: `entry_fee_chips` and `prize_structure` are economy configuration. |
| `public.game_events` | High | Reached High through reversibility rather than through data or integrity — it is explicitly append-only and is the durable record a client falls back to, so nothing reconstructs it. |
| `public.hand_records` | High | Same route as `game_events`: an archive is its own history. |
| `public.blocks`, `friend_requests`, `friendships` | High | Social tables reach High because all three feed `viewer_is_blocked_by` / `viewer_is_friend_of` inside `profiles_select_visible` — changing them alters who may read a profile, which is an access-control decision. |
| `public.room_members` | High | Rated High on membership-as-authorization, with evidence `P`: this table carries no `COMMENT`, so its purpose is established from the helper function that reads it rather than from a declared intent. |
| `public.daily_challenges_public` | Medium | A view holds no state, so its integrity is Low; it reaches Medium purely on blast radius, being a global object every account reads. |
| `public.loadouts` | Medium | Data, blast and integrity are all Low. It is kept out of Low tier by reversibility alone — a user's chosen loadout is recorded nowhere else, so Low reversibility cannot be positively supported. |
| `public.career_progress`, `career_attempts` | Medium | Deliberately *not* High. Their reward markers could set up a repeat claim, but chips move only through the ledger, so the change does not itself overwrite economy truth — which is the line the rubric draws between Medium and High integrity. |

### D2.13 — Estimator constants the rubric did not fix

**Decided.** Test counts use four named constants: two cases per branch at High tier, three
boundary cases at High tier, two cases per command at Medium, two probes at Low.

**Why they are called out.** The rubric defines what each tier must *cover* and defines a policy
branch. It does not say how many statements that implies. Those four numbers are therefore the
implementation's, not the author's, and they are printed in the CP3 report beside the totals so a
reader can see which part of the figure is rule and which is estimate.

The three High-tier boundary cases are not arbitrary: they are the three the brief requires to
appear somewhere in WP3 — null or absent identity, an identity for a deleted user, and an expired
session.

### D2.14 — Effective read and write exposure are computed, not judged

**Decided.** `effectiveReadExposure` and `effectiveWriteExposure` are derived in the facts layer
from grants and policies together: a grant is only reach if a policy also admits that grantee for
a matching command, and RLS enabled with no policy yields server-only whatever the grants say.

**Why it matters more than expected.** 27 of 40 resources have *different* read and write
exposure — almost always authenticated-read and server-only-write. The author's rule about
scoring the exposure that matches the driving failure mode is therefore load-bearing on two thirds
of the inventory, not an edge case. Collapsing the two into one "exposure" value would have
mis-scored 27 resources.

**What is deliberately excluded.** A trigger that refuses writes is *not* folded into the computed
write exposure, even where one exists. Whether a trigger actually refuses is settled by executing
a statement, which is WP3's job; WP1 proved it for exactly one of them. Where a rating relies on a
trigger, it says so and carries the evidence mark.

### D2.15 — Evidence correction: `career_nodes` and `tournaments` integrity is Medium, not High

**Decided.** Both were rated High integrity by analogy to the author's `rulesets` decision, on the
grounds that they carry economy-looking columns. Tracing those columns through the repository
shows the analogy does not hold. **The rubric is unchanged; the evidence was wrong.**

**`public.career_nodes`.** The career reward is credited as `params.node.reward.chips` —
`supabase/functions/_shared/career-rewards.ts:57` — where `node` is a code-side `CareerNode`
constant from `_shared/career/index.ts`. `create-session/index.ts:1838` does select
`reward_chips` from the table, but the resulting `nodeRow` is thereafter used **only for its
`id`** (lines 1866, 1876, 1893, 1902, 1982) and the selected value is never referenced.
`starting_chips` for a drill attempt is inserted as a literal `0` (line 1902).

**`public.tournaments`.** The entry fee is debited as `-SPRINT.entryFee`
(`create-session/index.ts:1611`); prizes are credited as `placement.prizeChips`, derived from
`SPRINT.prizeChips` (`_shared/tournament-format.ts:44`, `:295`). The table's
`entry_fee_chips`, `starting_chips` and `prize_structure` are **written from those constants** at
tournament creation (`index.ts:1472–1480`) and a repository-wide search finds no read of them on
any money path.

**Independent validation found.** `public.sprint_format()`
(`20260817200000_daily_challenge_and_sprint.sql:377`) returns the figures as SQL literals, and its
own comment records that `supabase/tests/16_sprint_and_daily.test.sql` asserts it agrees field by
field with the TypeScript `SPRINT` constant. So the configuration a player is shown and the
configuration that moves chips are two independent definitions cross-checked by a test — and the
mutable `tournaments` row is neither of them.

**What corruption can still do**, and why Medium is the level the evidence supports: deactivate a
career node or break its `code` lookup; misrepresent a tournament's lifecycle fields. Users
observe incorrect behaviour and repair is needed, but no authoritative economy, authorization or
game truth is overwritten — which is the rubric's Medium integrity definition.

**Effect.** Both fall from High tier to Medium. Distribution 23/17/0 → **21/19/0**. Both also
carry anonymous grants, so both now *move* under the sensitivity alternative, taking it from two
resources to four.

### D2.16 — The three required boundary cases are not repeated per resource

**Decided.** Null-identity and deleted-user are counted for a High resource **only where the
catalogs make them applicable** — the first where a policy on that resource reads `auth.uid()`,
the second where the resource records an owner. Expired session is counted **once for the whole
plan**.

**Why.** The first estimator added a flat 3 to every High resource. That conflated two different
requirements. The brief says the three boundary conditions must appear *somewhere* in WP3;
`RUBRIC.md` Part 5 says a High resource gets its *applicable* boundary cases. Repeating all three
across 23 High resources counted 69 executions for what the brief asks to see once each.

Expired session is suite-level for a reason that is architectural rather than a convenience: at
the database layer an expired JWT never arrives, because PostgREST rejects it before Postgres sees
it. There is no per-resource control to exercise, so counting it per resource would be counting a
test that cannot be written.

**Effect.** High-tier boundary cases fall from 69 to 22, and the plan total from 239 to 185.

### D2.17 — The estimate is machine-checked and the run fails if it does not add up

**Decided.** Five invariants run on every scoring pass: per-tier tests equal per-resource tests
(primary and alternative), total equals the per-tier subtotal plus suite-level cases (primary and
alternative), and no tier subtotal exceeds the plan total. `attest score` exits non-zero if any
fails, or if any resource is unrated.

**Why.** The first CP3 presentation contained a per-tier table that was arithmetically impossible
— a High-tier figure larger than the whole plan. The generated report was correct; the table in
the covering message was hand-transcribed and wrong. The lesson is not "transcribe more
carefully": it is that a number a reader can check should be checked by the tool, so that the
failure is loud rather than embarrassing.

Verified by breaking it: with a deliberate `+7` injected into the total, the run printed
`ESTIMATOR INVARIANT FAILED — Primary: total equals per-tier subtotal plus suite-level cases:
184 + 1 = 192` and exited 1.

---

## WP3 — planning

### D3.1 — The matrix is generated from the frozen tiers, not hand-written

**Decided.** `src/wp3-plan.ts` derives every planned test from the WP0 inventory facts and the
frozen WP2 tiers. Applicability per (family, resource) is decided by rule; a family that does not
apply produces a row carrying the factual reason and no test.

**Why.** A hand-written matrix drifts from the inventory the moment either changes, and it invites
exactly the failure the CP3 transcription error demonstrated. Generating it means the matrix, the
tiers and the inventory cannot disagree, and the 147 not-applicable rows each carry a reason that
was computed rather than asserted.

> **Current state (noted 2026-09-22).** 147 was the count when this entry was written, against
> a 263-test matrix. The planner was corrected repeatedly afterwards (D3.6 through D3.20) and
> the approved matrix now has **345 tests and 137 not-applicable rows**, each still carrying a
> computed reason. The claim this entry makes is unchanged; only the number moved.

### D3.2 — Isolation is scoped by ownership OR by session participation

**Decided.** Read-isolation applicability tests for an owner column **or** a policy that scopes by
session participation (`is_session_participant`, `caller_is_room_member`, or a direct subquery on
`game_session_seats`).

**Why.** The first version required an owner column, and marked `public.hand_records`
not-applicable for read isolation — a High-tier resource whose `hand_records_select_participant`
policy is exactly a read-isolation control. Arc21 isolates some resources by "are you seated at
this game" rather than "is this your row", and a planner blind to that would have silently skipped
testing them. The negative subject differs accordingly: another account's row for ownership, and
the seeded non-participant (carol) for participation.

The same pass corrected a misleading not-applicable reason on `public.rulesets`, which read
"effective read exposure is anonymous" when the true reason is that a global catalogue has no
per-caller subset to isolate.

### D3.3 — The expired-session boundary is planned at the API boundary, not in PostgreSQL

**Decided.** Null-identity and deleted-user are planned as database tests on the High-tier
resources where each is applicable. Expired session is a single suite-level test issued over HTTP
against the local PostgREST endpoint, expecting 401.

**Why.** An expired JWT never reaches PostgreSQL — PostgREST verifies and rejects it first. A
per-resource database test for it would be asserting that PostgreSQL enforced something it never
saw. Planning it at the boundary where the rejection actually happens is the only version of this
test that means anything, and it is why the CP3 estimator counted it once for the suite.

### D3.4 — WP1 code is reused; WP1 evidence is not

**Decided.** Each row is marked `reuse WP1`, `extend WP1` or `new`. Reuse refers to the
**mechanism** — the role-scoped session, the expectation model, the evidence recorder. Every WP3
row produces a fresh WP3 evidence record, and no WP1 deliberate-break scenario counts as a
completed WP3 control test.

**Why.** WP1's scenarios exist to prove the harness can detect a broken control. That is a
different claim from "this control works in production configuration", and the two must not be
conflated in the evidence store. The five WP1 scenarios happen to overlap five WP3 rows; those
rows are still planned, still executed, and still recorded separately.

### D3.5 — The audit-trail family tests what exists and records what does not

**Decided.** Four High-tier resources carry a who-did-what-when record and get a positive
existence test plus a negative immutability test. The other seventeen get a single row whose
expected outcome is **the factual absence of a trail**, recorded as a finding candidate for WP5.

**Why.** The brief is explicit: *"if Arc21 has no audit trail, that is a finding and a good one.
Report it. Do not build one silently to make the test pass."* The inspection found zero history,
versioning or audit relations anywhere in `public` or `private`, and no soft-delete column or
delete trigger on `blocks`, `friendships` or `friend_requests` — so removing a block, which feeds
`profiles_select_visible` and therefore an authorization decision, leaves no trace at all.

Nothing was created to close that. It is planned as evidence of an absence.

### D3.6 — Seven semantic corrections to the WP3 matrix before it was handed over

The first generated matrix was structurally complete and semantically wrong in seven places. All
seven were corrected from catalog and repository evidence; none changed a WP2 tier or the rubric.

**1. The F3 command came from a template, not from the policy.** Five UPDATE policies —
`friend_requests_update_participants`, `loadouts_update_own`, `notifications_update_own`,
`profiles_update_self`, `push_tokens_update_own` — were being tested with INSERT because both
commands can carry a WITH CHECK. The command is now read from `pg_policy.polcmd`.

That correction produced a finding-shaped result. An UPDATE WITH CHECK is only independently
exercisable if the caller can change a column the expression reads, and in Arc21 it never can:
every UPDATE WITH CHECK compares the owner column, and **no owner column appears in any client
column-level UPDATE grant**. Three of the five are therefore recorded as *not independently
exercisable from a client session* — defence in depth behind the column grant, reachable only if
that grant is ever widened. A negative test that cannot be constructed is not planned as though
it could.

**2. Column privileges were collapsed across privilege types.** `public.daily_challenges` grants
column-level **SELECT** on 14 columns and excludes `seed_secret`; the facts layer's single
`clientWritable` field made that look like 14 writable columns, and the planner proposed UPDATEs
against a read boundary. `ColumnFact` now carries `clientSelect` and `clientUpdate` separately.
A SELECT grant is a confidentiality boundary tested by reading; an UPDATE grant is an integrity
boundary tested by writing.

**3. F5 was 37 copies of one template.** Replaced with `rubric/f5-escalation.ts`: 29
function-specific specifications plus 26 functions correctly classified as having no
user-controlled target. *(Current state, noted 2026-09-22: 32, not 29. The count was right when
written; D3.9 resolved `sprint_standings` into two cases and D3.14 split `player_public_profile`
and `leaderboard_weekly_xp` into two probes each. 32 + 5 + 21 = the 58 F5 rows in the approved
matrix.)* Five classes, derived from catalog signals and body reads. The safe
outcomes genuinely differ — `remove_room_member` returns `false`, `get_room_state` raises
**PT404** rather than 42501, `mark_notifications_read` returns a count of 0, the boolean helpers
return `false` — and `player_public_profile` and the four leaderboards are cross-user **by
design**, so expecting "no data" would have failed working controls.

**4. Execution and assurance verdict were the same field.** Every evidence record now carries
`observation` (as_predicted / not_as_predicted / harness_error) *and* `verdict` (effective /
deficient / characterized / gap / not_measured). The eight F7 owner-bypass probes record
**characterized** — they return every row exactly as predicted, because the policy was never
applied — and the nineteen F10 absence probes record **gap**. Neither can now read as a green
pass. Harness errors remain a third state (D1.13).

**5. F10 used an identity that cannot read the trail.** The existence checks for
`private.game_commands` and `public.rate_limit_events` were planned as `authenticated:alice`,
on resources F1 had already established have no client read path. Existence now runs
server-side where that is the only role that can inspect; the tamper attempt still runs as an
ordinary client, which is the half that needs a client.

**6. Two "audit trails" are only partial, and are recorded as such.** `public.game_events` has an
action and a time but **no actor** — `recipient_user_id` names who a seat-scoped event is *for*,
not who caused it. `public.rate_limit_events` records **allowed attempts only**, by explicit
design, and is pruned to one window, so it cannot answer "who was refused, when". Both keep
verdict `gap` rather than being relabelled complete. Only `wallet_ledger` and
`private.game_commands` carry all three of actor, action and time.

**7. Negative fixtures were derived from a generic owner column, not the actual predicate.** Two
were outright wrong: `blocks_insert_own` compares `blocker_id`, not `blocked_id`, and
`friend_requests_insert_as_sender` compares `sender_id` — setting `receiver_id` to another
account *satisfies* its `receiver_id <> uid` clause rather than violating anything. Policies now
carry `predicateColumns`, extracted from the USING and WITH CHECK expressions.

Two further consequences of reading the real predicates:

- **Multi-clause OR predicates.** `friend_requests_select_participants` is
  `sender_id = uid OR receiver_id = uid`. A row with `sender_id = bob` and `receiver_id = alice`
  is legitimately visible to alice, so the negative fixture must falsify **every** clause — a
  bob↔carol row. Same for `friendships_select_own`.
- **Permissive policies are OR-ed, and `public.profiles` has two SELECT policies.** All four
  seeded accounts have `privacy = 'public'` (the column default), so "alice selects bob's row,
  expect no data" would have failed a working control: `profiles_select_visible` admits bob's
  public profile and should. The subject that falsifies both policies is **dave**, whom the seed
  has alice blocking, because that policy requires `NOT viewer_has_blocked(id)`.

### D3.7 — F8 gains an end-to-end Realtime check alongside the SQL policy tests

**Decided.** The six SQL policy tests on `realtime.messages` are kept, and three integration cases
added that drive the actual local Supabase Realtime websocket: a seated participant subscribing,
a non-participant subscribing, and a non-participant publishing to a game topic.

**Why.** Realtime consults those policies **only when a channel is declared private**. A client
that subscribed non-privately would bypass them entirely while every SQL test still passed. The
SQL tests prove the policies behave; the integration cases prove the real client path reaches
them, which is the assumption the SQL tests rest on and cannot themselves check.

### D3.8 — F7 is split so the owner exemption is not confounded with BYPASSRLS

**Decided.** F7 has two layers and a third polarity.

- **21 per-resource characterization records.** One per High-tier resource, reading
  `relrowsecurity`, `relforcerowsecurity` and the owner from `pg_class`. No statement is issued
  against the table, no control is asserted, and they carry **no AUTHOR INTENT**.
- **3 suite-level mechanism rows** on a scratch table owned by a purpose-made role holding no
  `BYPASSRLS`, created and dropped inside the run: unforced → owner sees both rows; FORCE on →
  owner sees one; then `postgres` with FORCE still on → sees both, because `BYPASSRLS` is a
  separate exemption.

**Why.** The previous plan ran the Arc21 probes as `owner(postgres)` and claimed they
demonstrated the owner exemption. They cannot. WP1 established that `postgres` holds
`BYPASSRLS`, so it would return every row **even with FORCE enabled** — the probe cannot
distinguish "not forced" from "bypasses anyway". The observation was real and the attribution was
wrong, which is worse than a missing test because it reads as evidence.

This is a regression against WP1: §2 of the validation report made exactly this argument and
built the scratch-owner experiment for exactly this reason, and the WP3 planner did not carry it
forward. The mechanism rows re-execute that experiment to produce WP3 evidence rather than citing
WP1's.

**Arc21's ownership model is not mutated.** Transferring a real table to a scratch owner to
manufacture a per-resource test would change the access control surface of the system under
measurement, which D1.8 already ruled out.

**A third polarity.** `characterization` is not a flavour of negative. A row recording what the
catalog says simulates no attack, so requiring an AUTHOR INTENT for it would be asking the author
to describe an attack that does not exist. **F7 now requires zero AUTHOR INTENT statements.**

### D3.9 — `sprint_standings` resolved from the body; no unresolved F5 row remains

**Decided.** Two concrete cases, and the previous "to be confirmed against the body" wording is
gone.

**What the body establishes.** Access is **entrants only**. `sprint_standings` raises
`42501 'you are not in that tournament'` when `auth.uid()` has no `tournament_entries` row for
the id — it is neither public nor open to authenticated callers generally. Intentionally exposed
to a fellow entrant: `entry_id`, `display_name`, `chips`, `status`, `placement`,
`eliminated_after_hand`, `in_tie_break`, `prize_chips`, `prize_xp`, and an `is_you` flag.

**Case 1, negative.** As carol, who has not entered, call it for a tournament alice and bob have
entered. Expected: **error 42501**, that message. Not an empty result — the body raises.

**Case 2, characterization.** The body joins `public.profiles` with no block or privacy filter,
and because the function is `SECURITY DEFINER` the caller's `profiles_select_visible` never runs.
So with alice and dave in the same tournament and the seeded alice→dave block in place,
**dave's display_name is returned.** That is a definite prediction, not an open question. It is
recorded as a characterization for the WP5 narrative to weigh rather than as a control that
passed or failed, because co-entrants seeing each other's names in standings is plainly intended.

### D3.10 — The F3 applicability table replaces a prose reconciliation that was ambiguous

**Decided.** `wp3-matrix.md` carries one row per policy **considered** for WITH CHECK testing,
with its `polcmd`, the columns its new-row check reads, the client's INSERT and UPDATE column
grants, whether it is independently exercisable, the reason if not, and the planned test ids.

**Why, and what it corrected.** The prose said five UPDATE policies had their command corrected,
three were non-exercisable, and four negatives were planned. All three numbers were true of
different sets, which a sentence cannot hold apart. Evaluating every policy rather than only the
ones a tier rule had selected also changed one of them:

| | Count |
|---|---:|
| Policies carrying a WITH CHECK | 10 |
| Commands corrected INSERT → UPDATE | 5 |
| **Not independently exercisable** | **5** — not 3 |
| F3 negative tests planned | 4 |
| Exercisable, tested under F8 instead | 1 |

`loadouts_update_own` and `push_tokens_update_own` were previously invisible: the Medium-tier
representative rule selected each resource's INSERT policy and dropped the UPDATE one **before**
the exercisability check ran, so they appeared in neither the tests nor the not-applicable list.
All five UPDATE policies are now evaluated, and all five are non-exercisable for the same reason
— every UPDATE WITH CHECK in Arc21 reads the owner column, and no owner column appears in any
client column-level UPDATE grant.

The four F3 negatives are the four `public` INSERT policies. The tenth policy,
`arc21_only_presence_may_be_written_by_a_client`, is exercisable and is tested under F8 so the
three realtime policies stay documented together.

### D3.11 — F1 fixtures come from the policy's authorization drivers, not from the table's columns

**Decided.** `PolicyFact` carries `authDrivers` and `combinator`, classified from the complete
USING expression: ownership, session participation, room membership, tournament membership,
friendship, block, privacy flag, topic GUC, row flag — and whether they combine with AND or OR.
F1 builds its fixtures from those.

**What was wrong.** Fixtures were derived from "does this table have an owner column", which is a
fact about the table and not about the policy. Five session-participant policies were being
tested against `user_id`, `host_user_id` or `recipient_user_id` — columns that in several cases
the predicate never reads:

| Policy | Complete USING | Was tested via | Now |
|---|---|---|---|
| `game_sessions_select_participant` | `is_session_participant(id)` | `host_user_id` | alice seated / carol not |
| `game_session_seats_select_participant` | `is_session_participant(game_session_id)` | `user_id` | alice seated / carol not |
| `hand_records_select_participant` | `is_session_participant(game_session_id)` | participation *(already right)* | unchanged |
| `game_events_select_participant` | `is_session_participant(...) AND (visibility = 'public' OR recipient_user_id = uid)` | `recipient_user_id` | participation conjunct; positive uses a public-visibility row |
| `hand_players_select_participant` | `user_id = uid OR is_session_participant(...)` | `user_id` | carol, falsifying **both** disjuncts |
| `room_members_select_same_room` | `caller_is_room_member(room_id)` | `user_id` | alice a member / carol not |
| `rooms_select_member` | `caller_is_room_member(id)` | `host_user_id` | alice a member / carol not |
| `tournament_entries_select_visible` | `user_id = uid OR viewer_is_in_tournament(...)` | `user_id` | carol, falsifying **both** disjuncts |
| `tournament_matches_select_visible` | `viewer_is_in_tournament(tournament_id)` | *(was N/A — no identity column)* | alice entered / carol not |

Membership drivers take precedence over an ownership term in the same expression, because they
are what decides access when present. `hand_players` is the sharp case: alice is a participant in
bob's session, so "read bob's row" would have been admitted through the participation disjunct —
the negative has to be carol.

### D3.12 — F4 states the exact anon predicate and seeds a concrete falsifying row

**Decided.** Each anon-admitting policy's predicate is printed exactly, and the falsifying value
is derived from it mechanically.

| Policy | Exact USING | Falsifying row seeded |
|---|---|---|
| `career_nodes_select_active` | `is_active` | `is_active = false` |
| `cosmetics_select_active` | `is_active` | `is_active = false` |
| `rulesets_select_active` | `is_active` | `is_active = false` |
| `tournaments_select_all` | `status <> 'cancelled'` | `status = 'cancelled'` |

None is unconditional, so no invented negative had to be removed — but the planner now refuses to
emit one where a predicate carries no falsifiable term, and records that the anonymous read is
intentionally unconditional instead. The previous text, `where the policy predicate is false
(e.g. is_active = false / status = 'cancelled')`, was a hypothetical fixture that the keyword
scan passed.

### D3.13 — `no_target` does not mean caller-scoped

**Decided.** The 26 no-target functions are split: **5** with real shared or global behaviour get
individual invariants, and **21** genuinely caller-scoped ones share one stated invariant with an
executable probe each.

**Why.** The generic rule "bob's and carol's rows must never change" is false for several of these,
and would have flagged correct behaviour as escalation:

| Function | Legitimate shared effect | Real invariant |
|---|---|---|
| `ensure_todays_daily_challenge()` | **creates a global `daily_challenges` row** every account plays, and `reveal_closed_daily_seeds()` mutates rows owned by nobody | must not return `seed_secret`, and must not reveal the seed of a still-OPEN challenge |
| `latest_verifiable_daily_challenge()` | **does not read `auth.uid()` at all** — deliberately callable without an account, returns a row belonging to nobody | must never return a seed where `revealed_seed IS NULL` |
| `join_matchmaking(p_tier)` | `expire_stale_queue_entries()` removes **other accounts'** stale rows | must enqueue only the caller; bob's *fresh* entry untouched |
| `poll_matchmaking()` | same housekeeping; reads the waiting population | must return only the caller's own entry |
| `create_private_room(p_max_seats)` | `expire_stale_rooms()` closes **other accounts'** expired rooms | room hosted by the caller; the 2..5 seat bound enforced (`P0001` at 9) |

### D3.14 — One Test ID, one executable probe

**Decided.** Enforced across the matrix and checked by the validator. Rows split:

- `player_public_profile` → the blocked-user refusal and the non-friend projection are two probes.
- `leaderboard_weekly_xp` → the authenticated projection and the anon refusal are two probes.
- Every audit-immutability row → **UPDATE, DELETE and TRUNCATE are three probes**, three controls
  and three evidence records. TRUNCATE is not reachable through a row policy at all.

### D3.15 — F7's BYPASSRLS demonstration needs a third role, and `postgres` cannot be it

**Decided.** The mechanism layer uses two purpose-made roles, and records their measured
attributes as a characterization row of its own.

**Why `postgres` cannot serve.** Measured: `rolsuper = false`, `rolbypassrls = true`. Not being a
superuser was the easy half. The disqualifying fact is that `postgres` is granted the scratch
**owner** role with INHERIT so that it can build the fixture at all, and PostgreSQL's
`check_enable_rls` uses `has_privs_of_role`, which counts inherited membership — so `postgres`
would be treated as the table **owner** and the probe would confound ownership with BYPASSRLS all
over again, which is the exact error D3.8 corrected.

| Role | rolsuper | rolbypassrls | owner of the scratch table | member of owner role |
|---|---|---|---|---|
| scratch owner | false | **false** | **yes** | — |
| scratch bypass role | false | **true** | no | **no** |
| `postgres` | false | true | no, but inherits owner rights | yes |

Arc21's permanent roles are not changed; both scratch roles are created and dropped in-run.

### D3.16 — An audit gap is an assessment, not a simulated attack

**Decided.** The 17 F10 absence checks are `characterization` polarity with verdict `gap`, and
require **no AUTHOR INTENT**. The 12 immutability probes are `negative` and do.

**Why.** "Catalog inspection found no who/what/when trail" simulates nothing. Asking the author to
write the attack it represents would be asking them to invent one.

### D3.17 — The plan is validated semantically, and the run fails if it is not clean

**Decided.** `src/wp3-validate-plan.ts` checks meaning rather than keywords, and `attest plan-wp3`
exits non-zero on any issue.

**Why.** The keyword scan reported zero placeholders while the matrix still contained
`e.g. is_active = false` and rows bundling three statements. Checks: every Test ID unique and
single-probe; no vague or slash-alternative operations; AUTHOR INTENT blank only on negatives;
characterization rows never claim `effective`; a policy test's verb matches the policy's command;
a negative names the driver it falsifies; and where sibling permissive policies exist, the row
acknowledges effective authorization rather than attributing the outcome to one policy.

It found 12 real issues on its first run — 9 negatives that did not say what they falsified, and 3
rows that ignored a sibling permissive policy — all fixed. It now reports clean.

### D3.18 — Mechanical finalization: one statement, one identity, one exact value per Test ID

Four classes of defect survived two earlier passes because the validator checked for them loosely
or not at all. All four are fixed and all four are now provably caught.

**1. Slash-alternative operations in F2.** Eighteen rows read
`insert into / update <resource>` — one Test ID, two statements. The control claim on a no-write
resource is that `authenticated` holds no write privilege, and INSERT, UPDATE and DELETE are
three separate privilege bits, so the frozen High-tier rule ("every applicable branch") makes
them three probes. Each is now its own Test ID with its own statement and evidence record.

**2. Parameter and column placeholders.** `rubric/fixtures.ts` holds 32 deterministic
references, each mapping to exactly one value, of which **19 are seed extensions**.
Every `<value>`, `<a client-granted column>`, `<a room hosted by bob>` and
`<bob's notification id>` is replaced by a reference such as `fixtures.bobNotification.id`, and
`<value>` specifically by a literal derived from the column's own type via `literalFor()`. An
implementer can now build the exact SQL or RPC call without a fresh judgment.

> **Two corrections to this paragraph, made 2026-09-22.** As written it said "47 deterministic
> references … of which 23 are seed extensions the plan now lists explicitly". Both halves were
> wrong, and unlike D3.1 neither was ever right: `rubric/fixtures.ts` has had exactly one
> commit — the one that introduced this entry — and held **32 references (13 standing + 19
> extension)** then and now. The counts above are corrected in place rather than annotated,
> because there is no earlier state they described.
>
> The second half was a claim about behaviour, not a count, and it was **false**: nothing
> listed the extensions. `SEED_EXTENSION_LIST` and the planner's `SEED_EXTENSIONS` accumulator
> were both written and never read, so the plan depended on 19 fixtures it never named as a
> requirement. A takeover review found it. D3.23 is the fix.

**3. Multi-identity rows.** Two F9 rows read `server-side and as alice (both must be refused)` —
two privilege levels, one Test ID. Both are necessary evidence and they make different claims:
the client probe shows an ordinary account is refused; the server-side probe shows the guard
applies to the privileged path too, which is what makes the ledger authoritative rather than
merely client-protected. So each became its own Test ID rather than being narrowed away.

**4. Copied F10 rationales.** All seventeen audit-absence rows carried the same
"removing a block" sentence, which is true of one of them. Each now carries one factual sentence
about what change on **that** resource would lack attribution — the drill seed's regeneration,
the engine state's mutation, the reveal of a daily challenge's seed, a rules-jsonb change
reaching every session that references it, a placement or prize altered after the fact, a
rate-limit configuration change affecting every account. Supported by the repository, and nothing
about application behaviour is invented.

### D3.19 — Each new validator invariant is proven by deliberate failure

**Decided.** The validator gained five checks, and each was verified by breaking the planner and
confirming a non-zero exit rather than by assuming the check works.

| Injected defect | Check that fired | Exit |
|---|---|---|
| `insert into / update <resource>` | one probe per row — slash-separated SQL commands | 1 |
| identity `ALICE + " and as server-side"` | one identity per row | 1 |
| `… where id = <value>` | no placeholders | 1 |
| `delete from X, then truncate it` | one probe per row — 2 distinct DML commands | 1 |
| gap rationale replaced by the block example | gap rationale is resource-specific | 1 |

**One check had to be tightened to pass its own proof.** The multi-command test originally
exempted any operation containing "then", intended for a `call f(), then inspect the result`
shape where only one statement mutates. That exemption let `delete from X, then truncate it`
through. Two or more DML or DDL commands is now always two probes, whatever connects them, and a
SELECT mixed with a mutation is only accepted in an explicit `call … then inspect` shape.

That is the second time a check passed while the thing it was meant to catch was present
(D3.17 was the first, on the keyword scan). The lesson applied here is that a new invariant is
not finished until it has been made to fail.

### D3.20 — Bookkeeping correction: 17 F2 rows, not 18

**Corrected.** The report for D3.18 said "eighteen rows read `insert into / update <resource>`" and
"51 total". Checked against the matrix: there are **17** such resources, each split into 3 probes,
giving **51**. The row count was wrong and the probe count was right.

**The matrix was not changed.** The prose was.

The `+36` growth from 309 to 345 Test IDs reconciles exactly:

| | |
|---|---:|
| F2: 17 bundled rows → 51 probes | **+34** |
| F9: 2 multi-identity rows → 4 probes | **+2** |
| **Total** | **+36** |

Same arithmetic for the negative count, 204 → 240, because every one of those 36 new probes is a
negative.

### D3.21 — The polarity totals are a machine-checked invariant

**Decided.** `positive + negative + characterization = total Test IDs` is now checked on every
planning run, and a mismatch fails the run.

Currently **63 + 240 + 42 = 345**, against 345 Test IDs.

**Why it earns a check.** Every count in the report is sliced by polarity, and a row whose
polarity fell outside the three known values would disappear from all of those summaries while
the total stayed right — the same shape of defect as the estimator arithmetic in D2.17, which is
where this habit came from.

Proven by deliberate failure: widening `Polarity` with a fourth value and assigning it to the F2
grant probes produced `polarity totals balance: 1` and exit 1.

### D3.22 — The AUTHOR INTENT worksheet is generated from the matrix, and cannot drift from it

**Decided.** `src/intent-worksheet.ts` builds the worksheet from the same in-memory plan the
matrix is rendered from, so the two cannot disagree. It emits exactly the rows where
`polarity === "negative"` and `authorIntent === null` — currently 240 — grouped F1 through F10 and
then boundary cases, with Test IDs verbatim.

**Six validations, all passing**, checked again independently by set comparison against the matrix:

| Check | Result |
|---|---|
| exactly 240 unique Test IDs | 240 rows, 240 unique, 240 required |
| every worksheet ID is a matrix negative requiring intent | all present and negative |
| every matrix negative requiring intent appears exactly once | none missing |
| no positive, characterization or gap-assessment row appears | none present |
| batches account for every row exactly once | 13 batches totalling 240 of 240 |
| no intent sentence was pre-filled | the generator has no path that writes one |

**The question is a prompt, not a hint.** Each row asks *"If this succeeded, what would they have
got away with? Name the attack or the mistake in one sentence."* It deliberately avoids
"confirm that …", which would invite agreement with the planner's own `Covers` rationale rather
than an independent sentence. The generator has no code path that writes an intent, and does not
read `Covers` when producing the question — brief §1.1 reserves the sentence for the author, and
a sentence derived from the rationale the planner already wrote would be the harness agreeing
with itself.

**Batching.** 240 rows is too many to review at once, so they are also written as 13 batch files
of roughly 25 under `batches/`, with the canonical complete worksheet kept whole. Batches respect
family boundaries: a family shorter than a batch is never split across two, so a review session
covers one kind of control rather than straddling several. The batch files are a convenience —
`author-intent-worksheet.md` is the document of record.

---

## WP3 — implementation preparation

### D3.23 — The seed-extension requirement set is derived from the plan, not declared beside it

**Decided.** `plan.seedExtensions` is computed inside `planWp3` and rendered in
`wp3-matrix.md` §5. `src/seed-extensions.ts` holds one implementation per key, and preflight
refuses to run unless the two key sets are equal and every requirement verifies live.

**Why.** `SEED_EXTENSION_LIST` and the planner's `SEED_EXTENSIONS` accumulator were both
written and never read, so the plan depended on 19 fixtures the standing seed does not create
and said so nowhere. D3.18 claimed "the plan now lists explicitly"; it did not.

**Two sources, because neither is complete on its own.** The `needSeed()` calls name the state a
row declares as its fixture. A reference scan catches the other half: several F5 rows name
`fixtures.roomBobHosts.id` in their *operation* while their *fixture* text says only "the
standing seed", so the requirement is invisible to the first source. The scan found 5 such
fixtures. The union is 22 requirements covering all 19 declared extensions.

**What the matrix rows did not change.** Adding the field left every one of the 345 planned
rows byte-identical — verified by regenerating and comparing `JSON.stringify(plan.tests)`
against the approved artefact.

**One fixture description is thinner than its own test.** `tournament_alice_bob` says "one
tournament with alice and bob holding tournament_entries rows", but
`F1.public_tournament_matches.212` is a positive expecting at least one row from
`tournament_matches`, which that state does not create. The seeder adds one pending match and
records the discrepancy in `FIXTURE_COMPLETENESS_NOTES` rather than absorbing it silently. No
test semantics change.

> **Current state (2026-09-22).** Resolved by D3.34: the match is now its own requirement,
> `tournament_alice_bob_match`, stated by the planner and verified by preflight, and
> `FIXTURE_COMPLETENESS_NOTES` is empty. The count here — 22 requirements — is now 23.

### D3.24 — AUTHOR INTENT gets a persistent store outside `evidence/`, with provenance

**Decided.** `rubric/author-intents.json`, keyed by frozen Test ID, each entry carrying
`intent`, `provenance` (`ai_draft` / `user_reviewed_ai_draft` / `user_authored`) and
`reviewStatus`. Regeneration never overwrites an entry whose provenance is not `ai_draft`.

**Why outside `evidence/`.** The worksheet under `evidence/runs/<run-id>/` is generated output
and is replaced on every run. A sentence written there would be destroyed by the next
`attest run`. The store is an *input*, beside `RUBRIC.md` and `rubric/ratings.ts`.

**Why provenance is a field and not a convention.** The whole point of brief §1.1 is that the
harness must not write these sentences. An evidence record whose "attack simulated" field was
written by the thing doing the simulating is not evidence, so the record carries the provenance
alongside the sentence and `isAdopted()` refuses `ai_draft` whatever `reviewStatus` says. An
`ai_draft` marked `approved` is an error, not a promotion.

### D3.25 — 240 AI drafts are generated, and they are drafts

**Decided.** `rubric/intent-drafts.ts` composes one sentence per negative from the row's own
facts plus a per-resource lexicon grounded in the author's `rubric/ratings.ts` characterizations.
All 240 are stored `ai_draft` / `unreviewed`. `attest execute-wp3` refuses while any remains.

**Why generate them at all.** Reviewing 240 concrete sentences is a different task from writing
240 from a blank page, and the author asked for the former. The reservation has not moved: the
harness cannot promote its own drafts, and only an edit to the store adopts one.

**Quality is checked against the row, not read.** `src/intent-quality.ts` validates each draft
against its matrix row — the actor matches the effective caller, a membership-gated read is not
called "another player's row", an escalation claim appears only on F5, F6 talks about a column
and not a row, an F4 predicate row is about withdrawn content rather than anonymous reading as
such, no two probes share a sentence.

**It found what reading found, and reading found what it missed.** The first generation pass
reported 4 issues, then 0 — and reading the output by eye then found five more: a stuttered
clause ("a player holding no seat reads … at a table where they hold no seat"), a doubled word
("gets someone in in that room"), a generic F5 phrase that said "naming a room, session,
tournament or account" where the argument was a cosmetic, a leaderboard phrase applied to
`search_players`, and a garbled tail on the boundary rows. Two new checks — a repeated-trigram
check and a doubled-word check — now catch that class, and the doubled-word check caught the
last one before it reached the store.

### D3.26 — CONTRADICTION C1: 17 F5 rows whose `identity` contradicts their own `operation`

**Surfaced, not fixed.** The planner sets `identity: ALICE` for every `F5_SPECS` row. The
`operation` and `expected` come from `rubric/f5-escalation.ts`, whose per-function `attempt`
names a different caller on 17 of them — "as carol" on 16, "as anon" on one.

**The approved expectation is only reachable as the caller the operation names.** Measured on
the instance:

| Probe | Expected | as alice | as the named caller |
|---|---|---|---|
| `caller_is_room_member(roomAliceBob)` | FALSE | **true** | carol: false |
| `viewer_has_blocked(dave)` | FALSE | **true** | carol: false |
| `is_session_participant(session)` | FALSE | **true** | carol: false |
| `leaderboard_weekly_xp(10,0)` | error 42501 | **0 rows, no error** | anon: 42501 |

Run as `authenticated:alice`, those four would record `not_as_predicted` and therefore verdict
`deficient` — **four findings against controls working exactly as designed**. That is worse than
a missing test, because it reads as evidence. Same class as the error D3.8 corrected.

**Why it is blocked rather than worked around.** The executor may not reinterpret an approved
row. `effectiveActor()` computes the caller the expectation requires, so drafting and quality
checking are correct, but `findContradictions()` reports all 17 and preflight refuses. The
resolution is the author's.

**Minimal proposed resolution.** In `src/wp3-plan.ts`, set the `F5_SPECS` row's identity from
the `as <who>` prefix of `spec.attempt`, falling back to alice where it names none, then
regenerate. That changes only the identity column. If alice is the intended caller instead, then
`spec.attempt` and `spec.expectedSafe` are what need editing.

> **Current state (2026-09-22).** Resolved as proposed, by the author's decision: D3.33.

### D3.27 — The executor derives from the approved row; it never re-decides

**Decided.** `src/wp3-exec.ts` derives one `ExecSpec` per Test ID by strict parsers over the
templates the planner emitted, then cross-checks each against the catalogs: the relation exists,
the function exists with that identity argument list, every fixture reference resolves, no
placeholder survives. A row that will not parse is a named hard failure, never a guess. All 345
derive.

**Why derivation rather than a second suite.** An executor written beside the matrix would be a
second description of the same 345 tests, free to drift, with the drift invisible because both
would look right alone.

**An unrecognised expectation fails.** Fifty-odd rows predict something a row count cannot
express. `src/wp3-assertions.ts` keys each on the plan's own `expected` text, and an expectation
it does not recognise is recorded as **unmet** — a custom expectation nobody implemented would
otherwise be a silent green.

### D3.28 — Four executor bugs found by running probes, not by reading code

Each was caught by the smoke set of 17 and each would have produced wrong evidence:

| Bug | What it would have produced |
|---|---|
| `ledger_reason` has no `'adjustment'` value | every F9 wallet probe a harness error |
| F9 committed the wallet lock winner only after awaiting *both* calls | a deadlock; the probe hung. Which connection wins is not ours to choose, so the winner is now whichever call returns first |
| F9's ledger probes forced the admin connection | the client and server Test IDs — split deliberately in D3.18 #3 — both recorded as the server probe |
| `DROP OWNED BY` without membership | "permission denied to drop objects" on a leftover scratch role, so the F7 mechanism could never re-run |

The concurrency probe now records its own interleaving: both transactions open, one call
returns, the winner commits, the blocked call proceeds. The overlap is evidenced rather than
asserted.

**A nuance for WP5, not a defect.** `F9.public_wallets.322` (server-side TRUNCATE) is refused
with `0A000` — a foreign-key constraint — before `wallet_ledger_deny_truncate` is reached. The
statement is refused, so the row's expectation ("error") is met, but the named trigger is not
the thing that refused it.

### D3.29 — Every gate is proven by breaking it

**Decided.** `attest prove-gates` injects 19 defects into isolated copies and requires each to
produce a failure. All 19 are caught and the real plan, store and instance are untouched.

**Why.** Twice in this project a validator passed while the defect it existed to catch was
present (D3.17's keyword scan, D3.18's "then" exemption). A green check is not evidence that
the check works. The injections cover a missing and a duplicate Test ID, an unsupported
polarity, a bundled multi-probe row, a surviving placeholder, an unresolvable fixture, an
identity/operation contradiction, an unimplemented seed extension, a missing / blank / extra /
still-draft / mislabelled intent, two draft-quality defects, an inverted F7 role property, an
unreachable Realtime service, and — the one that matters most — a harness exception presented as
a database refusal.

> **Current state (2026-09-22).** Three of these nineteen — the wrong fixture value, the inverted
> role property and the unreachable Realtime service — recorded `caught: true` without injecting
> anything. They are real injections now, and the set has grown to 37 plus 2 controls: D3.37.

### D3.30 — Three soundness holes the smoke set found, and one candidate finding it surfaced

Twenty-three probes were run to prove the executor's plumbing — one per executor kind, not the
suite. They found three ways a probe could have passed without testing anything:

**1. A syntax error satisfied an expected refusal.** The realtime SQL probes were built as
`select set_config('realtime.topic', $1, false); select * from realtime.messages where topic = $1`
— a multi-statement query carrying a bind parameter, which PostgreSQL rejects with **42601**. The
row's expectation is `no data`, and `no_data` is satisfied by *any* raise, so a malformed probe
scored as a working control. The set-up statement is now issued separately, and
`MALFORMED_PROBE` treats 42601, 42703, 42P01, 42883 and friends as harness defects rather than
refusals. **42501 is deliberately not in that set** — insufficient_privilege is a real refusal
and is the expected outcome of most of this suite.

**2. Twelve expectations are two claims, and only the first was checked.**
"returns 0 **and** bob's notification `read_at` stays null" is a return value *and* a state
assertion. `STATE_GUARDS` adds a post-probe check for each of the twelve, run as admin and ANDed
with the probe's own assertion, so a probe that returns the right thing while changing state it
should not have touched is not recorded as effective.

**3. An unimplemented custom assertion could have been a silent green.**
`src/wp3-assertions.ts` returns **unsatisfied** for an expectation it does not recognise, rather
than defaulting to pass.

**And one candidate finding, which is the author's to judge.**
`F5.register_push_token.269` failed its state guard. The approved row predicts "refusal, or a
row attributed to alice that does **not** displace bob's. Bob's row must still exist with
`user_id = bob`." Measured: after alice called
`register_push_token('ExponentPushToken[attest-bob]', …)`, the row carrying bob's token string
had `user_id = alice`. The mechanism is visible in the function body — it is `SECURITY DEFINER`
and its upsert reads `on conflict (token) do update set user_id = v_me` — so the caller's
policies never apply and the conflicting row is reassigned to the caller. That is precisely the
escalation the row's `covers` names: "registering a token string already belonging to another
account".

**This is not a WP3 result and must not be reported as one.** It is one probe from a 23-probe
plumbing smoke set, run before the suite is authorised and before its intent sentence is the
author's. It is recorded here as a candidate for the WP5 findings narrative — which the author
writes — and it needs confirming in the real run. The instance's state was restored afterwards.

The observation does say something about the harness, though, and that part is not tentative:
the state guard is what caught it. The return value alone was "1 row", which the row's own
expectation permits.

> **Current state (2026-09-22), after the scope change (D3.31).** The observation stands exactly
> as recorded above and remains a **pre-assessment candidate**, not a WP3 result and not a
> verdict. `register_push_token` and the migration that defines it are not modified — Arc21 is a
> read-only assessment target. The authorised WP3 run must reproduce or disprove it through the
> normal evidence path; if it is reproduced, it becomes a finding candidate for WP5's reporting and
> remediation *guidance*, with the author's narrative, a recommendation, and a verification
> procedure naming `F5.register_push_token.269` as the Test ID to rerun after any future fix.
> Attest will not implement that fix.

---

## Scope change — Arc21 is a read-only assessment target

### D3.31 — The author changed the remediation boundary: Attest never modifies Arc21

**Decided by the author on 2026-09-22, before WP3 was executed.** Recorded prospectively. The
brief as originally written (§4, §5 WP5, §6, §8, §9 CP4, §10) required one gap to be remediated in
Arc21 and its closure verified. That requirement is withdrawn. Nothing earlier in this file is
rewritten to look as though this had always been the rule; the entries above were written under
the original brief and are left that way.

**The rule.** Arc21 is the system under assessment, not a codebase Attest is authorized to
change. Attest never modifies Arc21's application code, migrations, RLS policies, PostgreSQL
functions, triggers, grants or permanent role configuration, tests, seed files, configuration,
package or dependency files, or git history, and makes no commits in the Arc21 repository. A
weakness is preserved as evidence, not patched.

**What Attest still does.** Reads and analyses Arc21's source; rebuilds a disposable local
database from Arc21's existing migrations; creates Attest-owned fixture data in that database
(D0.12's rule that the seed lives in Attest, extended to every WP3 fixture); creates temporary
Attest-owned scratch roles and objects where a mechanism must be isolated (D3.8, D3.15); mutates
disposable test data where a probe inherently requires it and restores it; collects evidence;
ranks and explains findings; recommends remediation; and writes the exact procedure — by Test ID
where possible — that would verify a future fix.

**What changes downstream.**

- **WP5** becomes *Findings, Risk Prioritization, and Remediation Guidance*. It consolidates WP3's
  findings, ranks them against the frozen WP2 risk context and the observed evidence, documents
  the highest-priority ones in depth, recommends remediation with its tradeoffs, gives the
  post-remediation verification procedure using existing Test IDs, and says plainly that no
  remediation was implemented or independently verified. The findings narrative is still the
  author's (brief §1.1).
- **A finding's status** is *open*, *informational / characterization*, or *accepted /
  design-intent* where the evidence supports that. Never *remediated by Attest*, never *fixed*,
  and no closure claim — so WP4's drift view will show no closure transition caused by Attest.
- **CP4** presents ranked findings, remediation guidance and verification procedures.
- **The candidate finding from the smoke set (D3.30, `register_push_token`) stays unrepaired.**
  Its function and migration are not touched; it is reproduced or disproved only by the
  authorised WP3 run, and if reproduced it becomes a finding candidate for reporting and
  remediation *guidance*.

**Alternatives.** (1) Keep the original single-remediation cycle. (2) Remediate in a fork or a
patched copy of the migrations, leaving the author's tree alone.

**Why this one.** It is the author's decision about the system they own. It also removes a
standing risk from the assessment itself: a harness that is permitted to edit the system it
measures can make a failing control pass by changing the control, and the evidence would not
show it. Option (2) would reintroduce that risk one step removed, because the assessed schema
would no longer be the author's.

**What would change.** The brief's "detection → remediation → verified closure" arc is not
demonstrated end to end. What is demonstrated instead is detection → risk ranking → remediation
guidance → a verification procedure someone else can execute. The resume and README must not
claim closure.

### D3.32 — The read-only boundary is enforced by fingerprinting Arc21 around every command

**Decided.** `src/arc21-guard.ts` fingerprints the Arc21 checkout, and `src/cli.ts` brackets
every `attest` command with it: a fingerprint before the command, another after, and any
difference is reported as a **harness safety violation** with exit code 3. Nothing is reverted
automatically, because reverting could destroy the author's own uncommitted work.

**The checkout is allowed to be dirty.** At the time of this entry it is on
`phase14-s2-security` at `58dcf39`, with 36 tracked files differing from HEAD and 23 untracked
files — one of them the uncommitted migration D0.2 describes. The guard does not ask whether
Arc21 is clean; it asks whether it is exactly as it was before Attest ran.

**What the fingerprint covers:** branch, HEAD, every ref (so a commit, branch, tag or stash
would show), the index (`ls-files -s`), the unstaged and staged diffs, `git status`, every
untracked file with a hash of its content (so the uncommitted migration cannot change unseen),
and the names of ignored entries (so a stray credential or token file written into the tree
would appear).

**What it does not cover, stated rather than implied.** The contents of already-ignored
directories are not hashed (`node_modules/` alone would make that slow). The one known writer
of that kind is the Supabase CLI: `bringup` runs `supabase db reset --local` with Arc21 as its
working directory, and the CLI maintains `supabase/.temp/` there. That is gitignored tool
metadata, not Arc21 source, and it is the only process that writes inside the Arc21 tree. No
Attest code writes there: every file Attest writes goes to `evidence/runs/` or
`rubric/author-intents.json`, the JWTs for the Realtime and expired-session probes are signed in
memory and never persisted, and every database object Attest creates lives in the disposable
instance.

**Reading without writing.** `git status` refreshes the index stat cache and writes it back when
it can. That changes no content, but it is still a write into Arc21's `.git`, so every git
command Attest points at Arc21 — here and in `schema-version.ts`, which previously did not —
runs with `GIT_OPTIONAL_LOCKS=0`.

**Alternatives.** (1) Require a clean Arc21 checkout. (2) Trust the code: Attest has no path
that writes to `SUT_REPO`. (3) Snapshot and restore the checkout around each run.

**Why this one.** (1) would force someone to clean the author's work in progress, which is
exactly what the rule forbids. (2) was true before this entry and would remain true — but it is
an argument from reading code, and this project has twice found a check that passed while its
defect was present (D3.17, D3.19); a boundary this important should be measured. (3) would mean
Attest writing to Arc21 in order to undo writes to Arc21.

**Proven by breaking it.** `attest prove-gates` builds a throwaway git repository, fingerprints
it, changes a tracked file, and requires the comparison to fail — and repeats that for a new
untracked file, an edited untracked file, a staged change, a commit, and a new ignored file.
The injections never touch Arc21 itself: deliberately modifying the system under assessment to
prove the guard works would be the violation the guard exists to catch.

---

## WP3 — structural corrections before execution (after the scope change)

### D3.33 — C1 resolved: an F5 row's identity is the caller its own attempt names

**Decided by the author on 2026-09-22** (the resolution D3.26 proposed), and applied at the
test-specification layer only. `src/wp3-plan.ts` now sets each F5 row's `identity` from the "as
<who>" its `rubric/f5-escalation.ts` attempt names (`callerNamedBy`), the same record its
operation and expectation come from. Seventeen identities change — sixteen from
`authenticated:alice` to `authenticated:carol`, one (`F5.leaderboard_weekly_xp.272`) to `anon` —
and nothing else in any row does: Test ID, family, tier, polarity, operation, expected and covers
are byte-identical to the approved run, and no non-F5 row changed as a consequence. F5 now runs
as 40 alice, 16 carol, 2 anon.

**Each of the seventeen reconciles**: the caller the operation names, the caller the expected
result is stated for, and the corrected identity are the same, and the fixture relationship
that makes that caller the refused one is checked live (`src/wp3-readiness.ts`, premises):

| Test ID | Operation names | Expected result holds for | Fixture relationship (checked live) |
|---|---|---|---|
| `F5.get_room_state.246` | carol | a non-member ("you are not at that table", PT404) | carol not in `roomAliceBob` |
| `F5.set_room_ready.247` | carol | carol ("carol's absence from room_members") | carol not in `roomAliceBob` |
| `F5.invite_friend_to_room.248` | carol | a caller not at the table | carol not in `roomAliceBob` |
| `F5.leave_room.249` | carol | a non-member — as alice, leaving is a legitimate effect the guard would count | carol not in `roomAliceBob` |
| `F5.caller_is_room_member.252` | carol | a non-member (FALSE; measured alice → true) | carol not in `roomAliceBob` |
| `F5.is_session_participant.253` | carol | a non-participant (FALSE; measured alice → true) | carol holds no seat |
| `F5.sprint_standings.254` | carol | a non-entrant (42501 "you are not in that tournament") | carol has no entry |
| `F5.viewer_is_in_tournament.256` | carol | a non-entrant (FALSE) | carol has no entry |
| `F5.accept_friend_request.257` | carol | carol ("no friendships row … between alice and carol") | no alice→carol request or friendship |
| `F5.decline_friend_request.258` | carol | a caller who is not the request's receiver | **premise not satisfied** — see D3.36 |
| `F5.unblock_player.261` | carol | a caller other than alice — as alice, unblocking is legitimate | the alice→dave block exists; carol blocks nobody |
| `F5.remove_friend.262` | carol | a caller outside the friendship — as alice, removal is legitimate | **premise contradicted by a shared fixture** — D3.36 |
| `F5.viewer_is_friend_of.265` | carol | a caller who is not bob's friend (FALSE; alice → true) | **premise contradicted by a shared fixture** — D3.36 |
| `F5.viewer_has_blocked.266` | carol | carol ("carol has blocked nobody"; measured alice → true) | carol blocks nobody |
| `F5.viewer_is_blocked_by.267` | carol | a caller alice has not blocked (FALSE) | alice blocks only dave |
| `F5.join_private_room.270` | carol | any caller — the code exists nowhere | no room carries `ZZZZZZ` |
| `F5.leaderboard_weekly_xp.272` | anon | anon ("must not be reachable by anon"; measured alice → 0 rows) | — (no identity) |

The identity correction is right for all seventeen. For three of them it is not sufficient: their
premises fail for fixture reasons, not identity reasons (D3.36), and those rows stay blocked.

**The executor no longer re-decides who a probe runs as.** `callerFor` read `effectiveActor`,
which substitutes the caller an operation names when it disagrees with the identity. Preflight
blocked every contradicted row, so the substitution never reached a real run, but it meant the
executor *could* run a row as someone its structured identity did not say. It now runs the
structured identity and nothing else; a disagreement is a contradiction for preflight to refuse.

**Proven, not asserted.** `checkIdentityConsistency` checks every one of the 345 rows: one
identity, the operation's callers equal it, any caller the expected result names in an actor
position equals it, and the executor derives exactly it. `prove-gates` reverts `.246` to alice,
runs `.272` as alice, and injects an executor derivation that ignores the identity; all three are
caught. The contradiction detector also now reads every "as <who>" in an operation rather than
only a leading one.

**The intent drafts did not change.** They were composed against `effectiveActor`, the caller the
expectation requires, so regenerating all seventeen produces the same sentences; the store was
not rewritten, and all 240 entries remain `ai_draft` / `unreviewed`.

**Smoke, not evidence.** Six probes were run to validate the corrected plumbing — `.252`, `.253`,
`.266` as carol, `.272` as anon, and the two tournament-match reads (D3.34). The carol session read
back `current_user = authenticated`, `session_user = authenticator`, `auth.uid()` = carol's id,
`bypassrls = false`; the anon session `current_user = anon` with a NULL `auth.uid()`. Each
returned what its row predicts (FALSE, FALSE, FALSE, 42501, one row, no rows), no application
table's contents changed, and Arc21's fingerprint was identical before and after. **These are
not WP3 results**: the suite is not authorised, and no intent sentence is the author's yet.

### D3.34 — The tournament match is a fixture of its own

**Decided.** `F1.public_tournament_matches.212` (alice, "at least 1 row") and `.213` (carol, "no
data") read **match** rows for `fixtures.tournamentAliceBob.id`. The approved fixture for both
was "one tournament with alice and bob holding tournament_entries rows, and carol holding none",
which creates no match: the positive could not have succeeded, and the negative's refusal would
have been true because the set was empty. D3.23 found this and the seeder quietly added a match
under the tournament's key; that absorbed the gap instead of stating it.

The match is now its own requirement, with the planner stating it and the seeder and preflight
checking it:

| | |
|---|---|
| Stable key | `tournament_alice_bob_match`, built on `tournament_alice_bob` |
| Fixture reference | `fixtures.tournamentAliceBobMatch.id` = `bbbb0000-0000-4000-8000-000000000001` (the id the row already had) |
| Tournament | `fixtures.tournamentAliceBob.id` = `22220000-0000-4000-8000-000000000001`, not cancelled |
| Participants | slot A = alice's entry, slot B = bob's entry, both in that tournament; carol in no slot of that tournament's bracket |
| State | `pending`, round 1, slot 0, no winner (the policy under test reads only `viewer_is_in_tournament`, so any status would serve; the default is the deterministic choice) |
| Setup | `src/seed-extensions.ts`, as admin, in the disposable database; `on conflict (id)` restores a drifted row, and a different row in the same slot is refused rather than adopted |
| Consumers | `F1.public_tournament_matches.212`, `F1.public_tournament_matches.213` |

The two rows' `fixture` text now names the match, which is the only change to them; it is listed
as a correction in the approved manifest (D3.35). **Seed extensions: 22 → 23**, the difference
being exactly this key. Required keys equal implemented keys, and all 23 verify live. `prove-gates`
deletes the match, moves it to the wrong tournament, empties bob's slot, and completes it with a
winner — each inside a rolled-back transaction — and preflight's fixture check fails for every
one.

**A consumer-list correction alongside it.** `requiredBy` for a declared fixture used to count
only rows that stated it as their fixture; rows that *reference* it in their operation were
skipped whenever the fixture was already claimed. So `tournament_alice_bob` did not list
`F5.sprint_standings.254` or `F5.viewer_is_in_tournament.256`, and `room_alice_bob` did not list
the five F5 room rows. Both lists are now complete; no key changed.

### D3.35 — The approved matrix is frozen in a manifest, with every correction listed

**Decided.** `rubric/wp3-approved-matrix.json` holds the approved matrix: every Test ID in order,
a hash of the twelve fields that define the question each row asks, its identity and a hash of
its fixture. It was built from the approved planning run `20260922T071548Z-5695a4c3df2d`
(sha256 `13810305762c…`) with nineteen corrections applied — the seventeen C1 identities and the
two tournament-match fixtures — and each correction is listed inside the file with its approved
value, its corrected value, why the approved value contradicted its own row, and its decision.

Preflight compares the plan about to run against it: the same Test IDs in the same order, no
frozen field changed, identities and fixtures equal to the manifest, and the manifest itself
reproducible from the approved run plus its listed corrections.

**Why.** "345 Test IDs" is a count, and a count cannot distinguish the approved 345 from 344 of
them plus a substitute — `prove-gates` now demonstrates exactly that case. It also cannot see an
approved operation or expectation drift when the planner is edited, and this pass edited the
planner. With the manifest, the claim "no unaffected row changed" is checked on every run rather
than asserted once.

### D3.36 — What else stands between the plan and a run that means anything

**Found while resolving C1, and not resolved here.** The previous record said the executor,
fixtures and preflight were built and that the author's intent sentences were the only remaining
gate apart from C1. Reconstructing the state from disk showed that a full run today would record
dozens of verdicts that do not mean what they say — findings against working controls, and
"effective" refusals of rows that do not exist. None of it came from Arc21. `src/wp3-readiness.ts`
now computes each class and preflight fails on it, so the gate reflects the harness as it is:

| Check | Rows | What is wrong |
|---|---:|---|
| column / compile | 3 | Three derived statements do not compile: the executor names `actor_user_id` (twice) and `command_id` on `private.game_commands`, which has `user_id` and no `command_id`. Preflight's catalog check was named "…relation, column and function…" and checked no column; it now compiles every SQL and RPC probe with `PREPARE`, which resolves every name without executing anything |
| R1 | 4 | `F5.277`–`.280` have custom expectations no assertion recognises, so each would be recorded `deficient` whatever the control did |
| R2 | 40 | The probe's subject set is empty. Twelve application tables hold no rows at all, so nine F1 positives cannot succeed and their negatives' refusals are vacuous; alice has sent and received no friend request and holds no queue entry; bob and dave hold none of several rows their negatives refuse; and **the F8 topic parser keeps a trailing comma** (`"game:…001,"`, `"presence:players,"`), so `F8.307`–`.310` query a topic that does not exist and `.311` would publish to one |
| R3 | 4 | The F3 INSERT positives insert only the predicate column: `blocks.blocked_id`, `friend_requests.receiver_id`, and `push_tokens.token`/`platform` are NOT NULL, and alice already has the one loadout `loadouts_user_id_key` allows |
| R4 | 8 | "Refusal or no effect" is judged as "raised or 0 rows", but `select * from f()` returns one row whenever a non-set-returning function does not raise — so `decline_friend_request`'s `'none'`, `retire_push_token`'s void and `join_private_room`'s by-design NULL all read as effects |
| R5 | 18 | A row's stated premise does not hold. `F5.262` and `.265` need carol to have no tie to bob, but F1's approved negatives need "the bob↔carol row", which the shared fixture therefore contains; `F5.258` names "a request alice sent to bob" that exists nowhere; `F5.264` calls bob "a non-friend" while the standing seed makes alice and bob friends; and **the 14 deleted-user boundary rows run with dave's account live** — nothing in the executor deletes him |
| R6 | 12 | An expectation claims something about state ("still attributed to alice afterwards", "no bob or carol row … changes") that no state guard checks — D3.30 #2's class, on rows it did not reach; the six caller-scoped functions that are VOLATILE among them |
| R7 | 48 | Every probe runs in autocommit on one shared instance with nothing restored between probes, and 48 commit changes when their control *holds*. `F2.public_blocks.024` deletes the seeded alice→dave block before `F1.public_profiles.146`/`.148`, `F5.259`, `.261`, `.263` and `.276`, which all depend on it; `F2.public_friendships.067` deletes the alice↔bob friendship before `F5.262`'s guard checks it survives; `F5.260` blocks bob before `.264` expects bob's profile |

One more is known from reading a function body rather than from a check:
`delete_own_account()` refuses alice with P0001 because she holds an active seat, and the
caller-scoped assertion requires the call not to raise, so `F5.283` would be recorded `deficient`
for a precondition refusal that says nothing about escalation. Whether such a refusal satisfies
the caller-scoped invariant is a question about the approved expectation, and so the author's.

**Why detect rather than fix.** Each class needs an implementation choice this pass was not asked
to make and should not make silently. The largest is R7: the obvious isolation — one transaction
per probe, rolled back — cannot evaluate a state guard, because the guard needs a privileged view
of uncommitted state and Arc21 grants `service_role` no table privilege at all; granting one
would change Arc21's grants, which D3.31 forbids. The remaining options (commit, check, then
restore by rebuild or by verified compensation; or run probes under `SET LOCAL ROLE` from the
admin connection, which reverses D0.4) are each a decision with a cost. Everything in the table
is fixable on the Attest side and nothing requires touching Arc21; the premises of `.258`, `.262`,
`.264`, `.265` and the deleted-user rows need probe-scoped fixture state, and `.283` needs the
author's reading of its expectation.

**Why it matters that the gate says so.** Without these checks preflight would have passed every
structural check once the intents were adopted, and `execute-wp3 --confirm` would have written
those verdicts into the evidence store as results. That is the failure this project exists to
prevent, one level up.

### D3.37 — Three gate proofs were assertions; all of them are injections now

**Correction to D3.29.** "All 19 are caught" was true only because three of the nineteen recorded
`caught: true` as a literal with nothing injected: a fixture carrying the wrong value, an
inverted role property, and an unreachable Realtime service. Each is now a real injection — the
falsifying cosmetic made active inside a rolled-back transaction, each role property inverted
through the same pure function preflight uses, and the health check pointed at a closed port. The
"Realtime reachable" check itself was also weaker than its name: it accepted any HTTP answer,
including the 403 the health route returns to a request with no key, so it now requires HTTP 200
and `healthy: true` with an anon key signed in memory.

`prove-gates` now runs 37 injections and 2 controls, all caught or held, with real state intact:
the nineteen, plus the C1 identity and executor-wiring cases, the four tournament-match defects,
a substituted and an edited approved row, R1, R2 and R5 shown to fail and then clear when the
defect is removed in a rolled-back transaction, the harness-exception case extended to the
structured assertion path and to a malformed probe's 42601, and six Arc21 source-state changes
made in a throwaway git repository.

## WP3 — executor hardening (this pass)

Everything below was decided while turning D3.36's list into a harness whose every verdict means
what it says. None of it changes an approved row's frozen field; none of it touches Arc21.

### D3.38 — Fixtures have a scope, and every one is a stated requirement

A fixture is one of three things, and the plan says which (`SeedExtension.scope`):

| Scope | Applied | Examples |
|---|---|---|
| `baseline` (33) | at every rebuild, verified before any probe | the tournament match, erin, the owned-row pairs, the realtime rows, the stale queue population |
| `probe` (14) | as admin after the verified baseline, before exactly one probe, which is then followed by a rebuild | `probe:alice_seat_left` (.283), `probe:carol_no_tie_to_bob` (.262), `probe:dave_deleted` (the deleted-user boundary) |
| `runtime` (4) | in memory, never in the database | the F7 scratch roles, signed JWTs, the expired JWT, a room code that does not exist |

A premise that conflicts with the shared baseline — `.262` needs carol to have no tie to bob while
F1's negatives need the bob↔carol rows — is a probe-scoped setup, never a baseline edit that would
break another row. Every setup is a plan-stated requirement (`needSeed`), so a row whose approved
fixture text was "the standing seed" but whose probe needs more carries a **listed fixture
correction** in `rubric/wp3-approved-matrix.json`: 97 fixture corrections (and the 17 identity
corrections of D3.33), each with its reason, produced by `freeze-fixture-corrections`, which
refuses any frozen-field or unattributable change. Structural fixtures are matched on family,
resource, control, polarity and function — never on Test ID numbers. A fifth synthetic account,
**erin** (privacy `private`, display name "Erin"), exists so that the leaderboards' "no
private-privacy identity" claim has a subject that could leak.

### D3.39 — The executed statement is the approved one, bound to real values

Found by reconstructing, fixed in `wp3-exec.ts`: `enforce_rate_limit` bound its signature text
(`'p_action text'`) as the argument; `register_push_token.269` bound the approved text's elision
(`"..."`) as `p_device_id`; "the seeded challenge date" was dropped; the F8 topic parser kept the
trailing comma. Now the elision means "the function's own defaults apply", the date binds to
today's UTC date, the topic parser takes exactly the fixture reference, and preflight fails if any
executed statement or parameter still carries a fixture reference, an elision or signature text.
The F2 grant-surface statements are the approved text verbatim; F3 INSERT positives are completed
with the NOT NULL columns their table requires (so they reach WITH CHECK, R3); F10 trail UPDATE and
DELETE name exactly one seeded row.

### D3.40 — Every approved expectation is partitioned into claims, and every claim is judged

`wp3-claims.ts` splits each approved `expected` text, character for character, into spans with 72
templates. Each span is an outcome, mechanism, state, premise, catalog, reference or runner claim
naming an evaluator — or a rationale that says why it is not asserted, or a connective drawn from a
closed vocabulary. Preflight fails if any text is not wholly consumed, any span names an evaluator
that is not implemented, or any rationale lacks its reason (R1). Compound expectations ("1 row
affected, and the row is still attributed to alice afterwards") are therefore judged claim by
claim: one met claim cannot outvote an unmet one, and prove-gates drops the second claim three
ways (deleted, relabelled a connective, relabelled a reasonless rationale) and requires R1 to fire.
Where the approved text compares two responses ("indistinguishable from a nonexistent id"), the
reference is a second call on the same fresh identity: `player_public_profile` against an id no
profile has, `join_private_room` against a code no room has.

### D3.41 — A business prerequisite is not the security property

`delete_own_account()` refuses a caller holding a live seat ("leave your table before deleting your
account", P0001). That refusal is a business rule, not the caller-scoped invariant `.283` examines
("only alice's own rows are returned or altered"). So `.283` gets a probe-scoped setup that stands
alice up (`probe:alice_seat_left`), its reachability check requires her account to be gone
afterwards, and a refusal by the active-seat rule — or any other prerequisite — is
`control_not_reached` → `not_measured`, never effective and never deficient. Arc21's rule is not
weakened; the fixture meets it. The same rule covers every F5 refusal: only the raise site(s) read
from the function body as THE refusal the row examines can meet a "refusal" claim; any other raise
is a prerequisite. `register_push_token` has no ownership refusal at all (its only raises are "no
session" and "not a push token"), so its "refusal, or a row … that does NOT displace bob's" can be
met only by the state guards, and the displacement it performs is preserved as a candidate finding
— not fixed (D3.31).

### D3.42 — Observation and verdict: which layer answered, and whether it was the one named

`wp3-outcome.ts` classifies every outcome from PostgreSQL's own error fields (SQLSTATE, message,
PL/pgSQL `where` stack, constraint) into a mechanism: none, harness, malformed, client_guard,
privilege, rls_with_check, trigger_raise, function_raise, constraint, fk_truncate, other. A claim is
**unmet** only when the control it names was exercised and the observation contradicts it. A
refusal by a different layer is `not_reached`; a harness throw or a malformed probe is `harness`; a
failed premise is `precondition`. Combined with precedence harness > registered contradiction >
precondition > not_reached > unmet > met into one observation (as_predicted, not_as_predicted,
harness_error, precondition_failed, control_not_reached, blocked_contradiction), which maps to the
verdict separately (effective, deficient, characterized, gap, not_measured). 42501 satisfies an
expectation only when it came from the mechanism the expectation names. "No effect" is judged only
from a before/after state guard, never from a returned NULL or void (R4).

**Added after prove-gates failed it:** whatever a row's claims are, the probe must have executed and
been answered by the database. Six F5 rows have an approved expectation that is a pure state claim
("no effect on the alice→bob request"); with a harness exception and satisfied guards they were
judged **effective**. The judge now adds an "executed" premise to every probe, so a probe that never
ran cannot pass.

### D3.43 — Evidence schema `wp3-evidence/2`

One record per Test ID: the approved row's frozen fields as planned; what was executed (statement,
parameters, pre-statements, binding notes, runner notes); the session identity read back; the
claims used; the probe-scoped setup and whether it verified; every premise, catalog fact and guard
(before/after) with its detail; the reference call; the raw outcome and its classified mechanism;
each claim's status and class; observation, verdict and the reason; the registered contradiction,
if any; the isolation record (baseline epoch, rebuilt before, setup applied, relations changed, why
a rebuild follows, fresh session); the system under test (schema hash, Arc21 commit, branch,
dirty, uncommitted migrations, Arc21 fingerprint before); the harness version. `validateRecord`
refuses a record missing a field, a non-`not_measured` verdict on any unmeasurable observation, and
an "effective" with an unmet claim.

### D3.44 — A socket's silence counts only inside a window an observer proved live

Every F8 socket join declares `private: true` (D3.7). The negatives use alice, who holds a seat, as
an authorised observer, and the positive uses a `service_role` subscriber that no row policy
restricts; the server broadcasts onto the topic with `realtime.send`, and only when the observer
receives it is carol's silence (or alice's receipt) counted. **Found while building it:** Realtime
starts its broadcast pipeline lazily, so the first `realtime.send` after a join can be lost — an
observer that joined and waited 8 s received nothing, the same observer 2 s later received
everything. So each run first sends warm-up broadcasts until the observer receives one, and a window
that never goes live makes every socket claim `precondition` → `not_measured`, never "refused" and
never "did not receive". The expired-JWT boundary is judged the same way: its 401 is attributed to
expiry only when the same request with a fresh token returns 200.

### D3.45 — Isolation by rebuild (R7)

The author's decision, literally: state-changing probe → commit → privileged state guard → rebuild
the disposable database from Arc21's migrations (`supabase db reset --local`, the path `bringup`
takes) → apply and verify the canonical baseline → next probe. A probe is dirty if it is statically
classified as writing when its control holds, applied a probe-scoped setup, moved the post-probe
whole-database digest (every table's content and every sequence), or ended in a harness error.
Verified means: planned schema hash; every baseline fixture's own verification; per-table row counts
equal to this run's first rebuild; the control-surface digest (policies and their expressions, ACLs,
RLS flags, function ACLs and bodies, triggers, roles, memberships, schema ACLs) equal to the first
rebuild's; Realtime healthy and PostgREST answering; and Arc21's fingerprint unchanged — checked
after every rebuild, because the reset runs inside Arc21's tree. Every probe opens a fresh
connection, so no session setting survives into another probe. Hand-written undo steps are not
used, and no probe runs on the admin connection. A rebuild that fails, a baseline that does not
verify, or Arc21 changing stops the run before the next probe: nothing executes on an unverified
state, the records already made are kept and written with an ABORTED marker naming the reason, and
the command exits 1 (3 if Arc21 changed). Proven by a smoke given a deliberately wrong expected
schema: it stopped before its first probe, executed nothing, and said why.

### D3.46 — Approved rows the system makes unmeasurable are registered, not worked around

Ten registrations in `src/wp3-contradictions.ts`, 57 distinct Test IDs, each with a live catalog
check (a stale registration fails preflight), the premises it may excuse (only C5 excuses one:
the empty subject — never "dave is deleted"), the SQLSTATEs it predicts, and the smallest change the
author could make. The executor still runs each probe exactly as approved and records
`blocked_contradiction` → `not_measured`. They are pending author decisions:

| Id | Test IDs | In one line |
|---|---|---|
| C2-grant-before-trigger | F9.319, .321 | alice holds no UPDATE/TRUNCATE on wallet_ledger; the privilege check refuses before the named trigger |
| C2-fk-before-truncate-trigger | F9.322 | TRUNCATE of a referenced table is refused by the FK check (0A000) before BEFORE TRUNCATE triggers |
| C2-definer-bypasses-named-policy | F5.259 | send_friend_request is SECURITY DEFINER; the named policy is never consulted |
| C2-client-guard-before-grant | 34 F2 rows | UPDATE/DELETE with no WHERE: pg_safeupdate (preloaded for `authenticator`) refuses at parse analysis (21000) before the grant (D3.47) |
| C3-sender-cannot-accept | F3.059 | only the receiver may accept (trigger, 42501) |
| C3-username-literal-invalid | F3.151, F6.153 | 'attest-probe-username' violates profiles_username_check |
| C3-cosmetic-literal-invalid | F6.117 | the cosmetic id exists nowhere (slot guard, 23503) |
| C3-tier-literal-invalid | F2.094 | 'attest-probe-tier' is not a table_tier label (22P02) |
| C4-anon-has-no-execute | F5.278 | EXECUTE is granted to authenticated only |
| C5-deleted-user-subject-empty | 14 B rows | every owner FK is CASCADE or SET NULL: after a genuine deletion nothing names dave |

### D3.47 — The client connection has a guard of its own, and it answers first

**Found by running preflight's rebuilt baseline, not by reading.** Every client request — and every
Attest role session — arrives through the `authenticator` login, and the local stack sets
`session_preload_libraries = 'supautils, safeupdate'` for it. pg_safeupdate refuses an UPDATE or
DELETE with no WHERE clause at parse analysis (21000 "UPDATE requires a WHERE clause"), which is
before the executor checks a single privilege: as alice, `update public.game_sessions set tier =
tier` returns 21000, not 42501. Thirty-four approved F2 grant-surface rows are exactly such
statements. The previous evaluator read 21000 as "refused by a later layer, so the privilege check
itself passed" — a **false deficiency on 34 rows** of a control that holds. The classifier now has a
`client_guard` mechanism that every outcome evaluator treats as not reached; the rows are registered
(C2-client-guard-before-grant) with a live check that `authenticator` still preloads safeupdate;
preflight fails on any client UPDATE/DELETE without WHERE that is not registered; and prove-gates
judges a genuine 21000 against every grant-surface negative. The platform guard is not Arc21's
control and is not credited to it.

### D3.48 — prove-gates, expanded: every gate broken through the function it uses

`src/wp3-fault-injection.ts` no longer re-implements any gate. Plan defects run through
`planChecks` — the static half of preflight — on a deep copy, and report the exit status preflight
would give; world defects are staged inside a rolled-back transaction and run through the live check
itself (`checkPremisesLive`, `checkInsertPositives`, `verifyOne`, `verifyBaselineState`, with a
`stage` hook applied after the probe's own setup); judgement defects hand the judge a genuine outcome
— a real 42601, a real 23505, a real 21000, the real active-seat refusal — with every other input
satisfied, so only the evaluator can stop a false verdict. The first run caught 58 of 63 and the
five misses were real: an R2 rule narrower than the binding's own, an injection that targeted the
wrong row, the six state-only rows of D3.42, and a missing article check that let "naming a other
party" through four drafts. All are fixed; see CHECKPOINTS for the final table.

### D3.49 — What the targeted smoke showed: two harness defects, three candidates, one reading for the author

**NOT WP3 evidence.** 42 representative Test IDs across every family, every runner and every
special setup, then 5 re-run after fixes, through exactly the path the assessment takes; records
under `.smoke/` (gitignored), each stamped `NOT_WP3_EVIDENCE`. Arc21 unchanged throughout.

**Measured.** 17 rebuilds in 572 s (33.6 s each, schema + fixtures + counts + control surface +
services + Arc21 fingerprint verified every time) for 42 probes; the probes themselves took 19 s.
The full suite has 59 statically dirty probes (38 that write when their control holds, 27 with a
probe-scoped setup, overlapping), so it needs at least 60 rebuilds: about 34–40 minutes of
rebuilding plus a few minutes of probing, more if probes write unexpectedly (each such write is
caught by the digest and costs one more rebuild). That is the price of R7 as decided, and it is
paid once per assessment.

**Harness defects the smoke found, fixed:**

1. *Socket identity.* The three socket probes ran correctly — carol's private join was refused
   ("Unauthorized: You do not have permissions to read from this Channel topic"), the authorised
   observer received the server's broadcast, alice received it on the positive — but every one was
   recorded `precondition_failed`, because the identity premise demanded a SQL session identity
   and a websocket has none. The socket runner now authenticates the probed client as the row's own
   structured subject and supplies the identity premise from the token it actually presented
   (`role`, `sub`); re-run, all three are `as_predicted`. prove-gates now injects a socket token for
   the wrong subject.
2. *Guard evidence that says which rows.* The caller-scoped guards compared hashes, so `.283`'s
   record said only that "a row naming bob or carol changed". The snapshot now keeps the rows
   (auth.users represented by id and md5 only — its text carries password hashes) and the record
   quotes every row gone and every row new.

**Registered contradictions, confirmed live:** F2.239 → 21000 (client guard), F3.059 → 42501 (the
transition trigger), F5.259 → PT404 (the definer body), F9.319 → 42501 (the grant), B.325 → the
empty subject: each `blocked_contradiction` → `not_measured`, as registered.

**Candidates — recorded, not fixed (D3.31), not findings until the authorised run:**

| Test ID | Observed (smoke) | Mechanism |
|---|---|---|
| F5.register_push_token.269 | after alice registers bob's token string, no row for that token is owned by bob; one is attributed to alice | `on conflict (token) do update set user_id = v_me` inside a SECURITY DEFINER function (as D3.30 first saw) |
| F5.leaderboard_weekly_xp.271 | the weekly XP board returns "Erin", an account whose privacy is `private`, among 3 rows | the leaderboard projection does not consult `profiles.privacy` |
| F5.delete_own_account.283 | alice stood up (probe setup), deleted her account; the ONLY row naming another account that changed is `public.rooms` ATSTAB, whose `host_user_id` is now bob; no bob/carol row was altered otherwise; every other claim met | the documented host migration: `delete_own_account` calls `leave_room`, which hands a lobby to its longest-joined remaining member |

**`.283` needs the author's reading, not a registration.** The property was exercised — the
active-seat rule was satisfied by the fixture, not weakened, and the deletion ran — and the
literal approved claim "no bob or carol row … changes" is false, by Arc21's documented design. It
is not a contradiction in D3.46's sense (the claim is measurable, and was measured), and it is not
a harness artefact (the record quotes the single changed row). Registering it would turn a
measured result into `not_measured`; leaving it is a `deficient` verdict for designed behaviour.
Which it is — an over-strict expectation to restate ("…other than the documented handover of a
lobby the caller hosted") or a behaviour to weigh in WP5 — is the author's decision, and until it
is made the executor records the literal result.

---

## Project completion — Gate A preparation (2026-09-24)

Entries below were written in the project-completion pass that began on 2026-09-24 from `a8d8cfc`.
The durable log for that pass is `PROJECT_COMPLETION_PROGRESS.md`.

### D3.50 — The shared local stack had drifted to the author's own development state; the planner now refuses an instance that is not a build of the migration files

**Found, not assumed.** The first in-process plan of this pass had **343** rows, not 345. The
disposable database was no longer an Attest build: `supabase_migrations.schema_migrations` held
60 versions, one of them `20260915120000_pseudonymous_players` — a migration that exists in the
author's main Arc21 checkout (`~/arc21`) and not in `arc21 copy/`. Both checkouts declare Supabase
project id `arc21`, so they drive **one** local database. After Attest's last rebuild on
2026-09-23 the author's own work had applied that migration (47 policies instead of 50;
`friend_requests_insert_as_sender` gone) and added two development accounts. It is the same
condition D0.1 found on the first day, reached the same way.

**What preflight did with it.** It built the plan from the live catalogs *before* its own
rebuild, so the plan described the drifted schema; it failed (345 expected, 343 found, then a
cascade of renumbered Test IDs) and then rebuilt the database correctly. No wrong result was
possible — the frozen manifest refuses a changed plan — but only because this particular drift
happened to remove a policy a planned row reads. A drift that changed nothing the plan reads
would have passed planning and been harmless only because execution rebuilds again; the gate
should not depend on which drift occurs.

**Decided.**

1. *Back up before rebuilding, as D0.1 did.* The drifted state was dumped
   (`.local-backups/arc21-shared-stack-before-wp3-20260924-172900.dump`, `pg_dump -Fc`, 1,499
   archive entries, verified with `pg_restore --list`) before anything rebuilt it. It is the
   author's data, not Attest's, and the rebuild would otherwise have destroyed it without a copy.
2. *The planner refuses an unbuilt instance.* `buildPlanInProcess` and `runWp3Planner` now call
   `unbuiltInstanceReason(readAppliedState(…))` (`src/schema-version.ts`) and throw — "Run
   `npm run attest bringup` first" — when a migration is applied with no file or a file is not
   applied. Every WP3 command plans first, so none can plan from a schema stored nowhere.
   `inventory` already refused this; the WP3 commands did not.
3. *Proven by breaking it.* `prove-gates` stages both mismatches inside rolled-back transactions
   — the exact migration found today, and a file not applied — and requires the refusal; the live
   instance must be accepted.

**What it does not cover.** A drift that does not touch `schema_migrations` (a policy altered by
hand) still reaches the plan. The frozen manifest refuses any such drift that changes a planned
row, and the execution-time baseline verification (D3.45) compares every rebuild's control
surface with the run's first rebuild, so nothing executes against it; but the diagnosis would be
the manifest failure, not this message.

**Operational consequence, for the author.** While `execute-wp3` runs (≈ 40–50 minutes, about 60
rebuilds) the author's own use of the local stack would be destroyed at every rebuild, and any
write the author makes mid-run is caught by the baseline verification and aborts the run. The
stack should not be used for development during the run.

### D3.51 — Independent audit of the 240 intent drafts: 76 corrected in the generator, five new checks proven on the drafts they would have caught

**Done against the final hardened implementation**, row by row: identity, operation, the
statement the executor actually binds, the expected text, the claims and guards, the fixture and
setup, and the registered contradiction if any. Every correction stays `ai_draft` /
`unreviewed`; nothing was approved and nothing is presented as the author's.

**Where the corrections live, and why there.** In `rubric/intent-drafts.ts`, not in
`rubric/author-intents.json`. `mergeDrafts` refreshes every `ai_draft` entry from the generator
on the next `draft-intents` or `run` (D3.24), so an edit to the store alone would have been
silently reverted by the next regeneration. The store was then regenerated through the project's
own command (`draft-intents`, worksheet run `20260924T174635Z-5695a4c3df2d`): 240 drafted, 76
changed, 164 unchanged, draft quality clean.

**What was objectively wrong** (the full old/new list is generated in the Gate A package):

| Class | Rows | What was wrong |
|---|---:|---|
| Block direction reversed | 2 | `F1.public_profiles.148` said the viewer reads "someone who has blocked them"; the probe's viewer *placed* the block and the policy term it falsifies is `NOT viewer_has_blocked(id)`. `F5.send_friend_request.259` copied "sending to an account that has blocked the caller"; the probe sends to an account the caller blocked. |
| Deleted-user target | 14 | Every draft said the stale token reached "another player's" data; every probe filters on the deleted account's *own* owner column. |
| Dangling reference | 13 | "…holding no seat at that table reads … at that table": "that table" before any table was introduced, and said twice. |
| Anonymous "own" | 2 | An anonymous caller described as having "their own" daily attempt, and as one of "who else" is queued. |
| Shared effect that does not exist | 2 | `ensure_todays_daily_challenge()` and `latest_verifiable_daily_challenge()` described as having "housekeeping [that] legitimately touches other accounts' rows"; the first mints a global row owned by no one, the second only reads. |
| Claim broader than the probe | ~20 | F5 drafts that appended the planner's full `escalationWouldBe`, which often names two attacks where the probe exercises one (`.271` also claimed the anon-reachability of `.272`; `.279`–`.281` named seating, room assignment and rate-limit bypasses no guard checks). |
| Consequence reversed | 1 | `F5.register_push_token.269` copied the approved `covers` wording that taking over another account's token "would redirect their notifications to the caller's device". The function body reassigns the *token row*: the device keeps the token, so the victim's device stops receiving the victim's notifications and starts receiving the caller's. |
| Operation not performed | 1 | `F2.public_friend_requests.056` described forcing a request to `accepted`; the executor binds `status = 'cancelled'` (D3.39) and the probe cancels. |
| Ownership where it is shared | 1 | `F6.public_friend_requests.062` called a request addressed to the caller "a row they do own". |
| Seat attributed where the refusal is universal | 2 | `F8.312`/`.315` said a player "holding no seat" writes to a game topic; the policy admits no client to write any game topic, seated or not. |
| Expiry is not sign-out | 1 | The expired-session draft said the account "has been signed out for hours"; the fixture's token expired one hour earlier, and expiry is not sign-out. |
| Vague or self-contradicting objects | several | e.g. `daily_challenges_public` called "the public projection" while the row asserts anon must not read it (it is granted to `authenticated` only). |

**Five checks added to `src/intent-quality.ts`**, one per class that a regex can see: the
deleted-user target is the deleted account's own rows (stated as a requirement — the negative form
caught six of the fourteen, which is D3.19's lesson a third time); no dangling "that
table/room/tournament"; a block's direction matches the probe; an anonymous actor has no account
of its own; no housekeeping claim for a function whose approved row records none (first written
too narrowly — it flagged `poll_matchmaking`, whose row says "expire_stale_queue_entries() again"
— and corrected). Run against the pre-audit store they fire 33 times, on exactly the rows above;
against the regenerated drafts, 0. `prove-gates` re-injects one pre-audit sentence per class on
its own row and requires its own check to fire.

**What was not changed.** No approved row, no expectation, no claim template, no guard. Drafts
whose wording was merely plain were left as they were: the reservation in brief §1.1 is the
author's, and a draft rewritten for style is a draft the author now has to re-read for nothing.

### D3.52 — The registered contradictions, re-derived: every proposed alternative checked against the live mechanism, one registration corrected, two planning misreadings found

Each registration was re-derived from the frozen row, the function or catalog, and a mechanism
check run as the probe's own identity inside a transaction that was rolled back (NOT WP3
evidence; recorded in the Gate A package). Findings:

- **Every smallest-change proposal reaches the control it claims.** `where true` turns every
  client-guard row into a 42501 privilege refusal (public and `private` tables); `'casual'` plus
  `where true` does the same for `F2.094`; `truncate public.wallet_ledger cascade` is refused by the
  ledger's own `deny_truncate()` with the ledger intact; `'cancelled'`, `'attest_probe_user'`, an
  owned cosmetic and NULL each affect exactly one row; `latest_verifiable_daily_challenge()` as an
  authenticated caller returns the revealed challenge and not the open one.
- **`C3-username-literal-invalid` named the wrong first mechanism.** The literal is refused by
  the BEFORE UPDATE trigger `guard_profile_username` (23514 "reserved or not permitted", via the
  pure `username_is_permitted()`), which runs before `profiles_username_check`. The registration's
  text and live check now say so; the conclusion (the positive cannot show admission) is unchanged.
  The proposed literal also spends alice's single `profile_username_change` rate-limit event per 30
  days; each positive runs on its own rebuilt baseline, so the two positives do not share it.
- **C4 is an Attest planning misreading, not an Arc21 inconsistency.** The F5 specification
  called `latest_verifiable_daily_challenge()` "deliberately callable without an account" because
  its body does not read `auth.uid()`. Arc21's migration `20260903130000_daily_seed_reveal.sql`
  explicitly revokes EXECUTE from `public, anon` and grants it to `authenticated`. The approved
  row's identity is what is wrong; the property the row names (only a revealed seed is ever
  returned) is identity-independent and measurable as any signed-in caller.
- **C5 has a same-property alternative for three of its fourteen rows, and none for the rest.**
  Every owner column the fourteen probes filter on is `ON DELETE CASCADE` except
  `game_session_seats.user_id`, `game_sessions.host_user_id` (and `hand_players.user_id`,
  `player_actions.user_id`), which are `SET NULL`. `is_session_participant` checks only
  `seat.user_id = auth.uid()`, whatever the seat's status. Seating dave with status `left` (which
  `delete_own_account()` permits), deleting him through Arc21's own function, and then reading the
  session with his stale token measures exactly the approved rationale — "a token outliving its
  account must not become a key to whatever the cascade left behind": verified, live dave reads 3
  seats and the session; the stale token reads 0; his seat survives with `user_id` NULL and the
  name "Deleted player". For the CASCADE rows nothing is left behind by design ("Everything
  personal cascades from here", Arc21's own comment), so no honest same-property probe exists.
- **`delete_own_account()` was misclassified as caller-scoped.** Its approved `covers` says it
  "has no shared or global effect … Verified against its body". The body documents four
  cross-account effects: it stands the caller up from every lobby through `leave_room`, which
  hands a hosted lobby to its longest-joined remaining member; it cancels other players' queue
  entries that point at a room it hosts; it deletes other players' notifications about the
  account; and it anonymises shared seat names. The literal expectation of `.283` therefore
  prohibits documented behaviour (D3.49's reading).
- **A bookkeeping correction.** `WP3_AUTHOR_REVIEW.md` said 54 of the 240 negatives carry a
  pending contradiction. It is 53: 57 contradicted Test IDs, four of them positives (`F3.059`,
  `F3.151`, `F6.153`, `F6.117`).

None of these changes an approved row. Every change that would is listed for the author in D3.53.

### D3.53 — Gate A: one consolidated request, and what it deliberately does not decide

The mission's Gate A collects every decision reserved to the author before WP3 may run:
`WP3_AUTHOR_DECISIONS_REQUIRED.md` (the full packet), `WP3_AUTHOR_DECISIONS_COMPACT.md` (the
one-page form), and `rubric/wp3-gate-a-decisions.json` (the machine-readable template the author
fills in; `pending` everywhere, never pre-filled).

**Intents** are grouped A/B/C for review effort only: A — the draft directly states the probe's
attack on a simple ownership or grant boundary; B — technically sound but turning on membership,
a privileged function, Realtime, concurrency, audit semantics, an identity boundary or
interacting policies; C — the wording depends on a contradiction or reading still open (the
fourteen deleted-user rows, `F5.278`, `F5.283`). Category A is not approval; nothing is approved
by being in it.

**Contradictions** are presented with the alternative that measures the same property, the
mechanism check that shows it does, and the frozen field it would change. Several are purely
mechanical — a WHERE clause, a literal the column accepts — and require no security judgement;
they are still the author's, because each changes a frozen `operation` or `expected` and the
approval model (D3.35) lists every such change with its decision. No correction is applied before
the author says so. A row left undecided keeps running as approved and records `not_measured`.

**Not decided here, deliberately.** Whether `.283`'s observed handover is a finding (WP5, the
author's narrative); the severity of any smoke candidate (none has one); and anything about
fixing Arc21 (never, A1).

### D3.54 — Gate A applied: the author's decisions, exactly as given

**Source.** The author's Gate A reply in the project-completion session on 2026-09-24 (about
20:00 UTC), answering the packet committed as `50e983b`. It is recorded verbatim in substance in
`rubric/wp3-gate-a-decisions.json` (`recordedFrom` names it; `applied` records what was done). No
decision below was made by Attest.

**Intents — 240 of 240 approved, 0 `user_authored`.**

| | Rows | Recorded as |
|---|---:|---|
| Category A, approved as written | 117 | `user_reviewed_ai_draft` / `approved` |
| Category B, approved as written | 107 | `user_reviewed_ai_draft` / `approved` |
| Category C, eleven deleted-user rows kept `not_measured`, approved as written | 11 | `user_reviewed_ai_draft` / `approved` |
| Category C, five rows whose probe changed, with wording the author supplied | 5 | `user_reviewed_ai_draft` / `approved` — the author's instruction: AI-assisted wording they reviewed and adopted, not their own authorship |

"As written" was enforced, not assumed: `apply-gate-a` approves an entry only if its text is
byte-identical to the Gate A review table the author read
(`evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.json`), and refuses the whole
application otherwise. Each entry carries a `note` saying which decision adopted it. The five
supplied sentences were checked against the final semantics before being recorded (each describes
exactly what its corrected probe does), so none was left unapproved. The draft generator now emits
the same five sentences, so a regenerated worksheet cannot diverge from the store.

**Frozen-manifest corrections — 51, each tied to one decision.** `src/gate-a-apply.ts` compares the
plan with the approved matrix (the approved run plus every correction already listed) field by
field, and lists a correction only where a Gate A decision authorises that exact Test ID and field;
an unauthorised difference, or an authorised change the plan does not make, refuses the whole
application. The manifest now lists 165 corrections (100 fixture, 18 identity, 43 operation,
2 expected, 2 covers); the counts are unchanged at 345 = 63 / 240 / 42.

| Decision | Rows | Field(s) | Change |
|---|---:|---|---|
| C2-client-guard-before-grant | 34 | operation | `… where true` on every grant-surface UPDATE/DELETE |
| C3-tier-literal-invalid | 1 (F2.094) | operation | `tier = 'casual' where true` |
| C2-fk-before-truncate-trigger | 1 (F9.322) | operation | `truncate public.wallet_ledger cascade` |
| C2-definer-bypasses-named-policy | 1 (F5.259) | expected | the body's PT404 `'no such player'` on `is_blocked_between`, not the bypassed policy |
| C3-sender-cannot-accept | 1 (F3.059) | operation | `status = 'cancelled'` |
| C3-username-literal-invalid | 2 (F3.151, F6.153) | operation | `'attest_probe_user'` |
| C3-cosmetic-literal-invalid | 1 (F6.117) | operation | `avatar_cosmetic_id = NULL` |
| C4-anon-has-no-execute | 1 (F5.278) | identity, operation | runs as alice |
| C5 (three rows) | 3 (B.331–.333) | operation, fixture | read the surviving session state after a genuine deletion |
| D-283 | 1 (F5.283) | expected, covers | the function-specific invariant |
| O-269 | 1 (F5.269) | covers | the takeover's consequence stated the right way round |

**Kept `not_measured`, still registered: 13 Test IDs.** `C2-grant-before-trigger` (F9.319, .321:
the client can never reach the ledger's triggers; the privilege refusal is not evidence they fired;
F9.320 and, now, F9.322 carry the trigger evidence) and `C5-deleted-user-subject-empty` narrowed to
its eleven CASCADE rows (Arc21's deletion model removes the subject — an honest limit on what a
stale-identity probe can measure). The eight resolved registrations are kept as
`RESOLVED_CONTRADICTIONS`, the record of what stood and what was decided; no gate reads them.

**How the three new mechanisms work.**

- *The retargeted deleted-user rows (C5).* A new probe-scoped fixture,
  `probe:dave_left_seat_then_deleted`, seats dave at the session with status `left` (which
  `delete_own_account()` permits), then — **as dave, while his account is live** — reads the
  session's seats and requires at least one, then calls Arc21's own `delete_own_account()`. Its
  verification requires dave's `auth.users` and profile rows gone and his seat surviving with
  `user_id` NULL and the name "Deleted player". The probes then read that session's seats, row and
  event stream with his still-valid claims. Referential integrity is untouched, nothing is
  orphaned, and the target is non-empty and provably was readable by the live account. Setups may
  now combine admin statements with a client step (both paths: the executor's real client session,
  and preflight's in-transaction emulation, which switches to `authenticated` for the pre-read).
- *The function-specific invariant (D-283).* Three claims replace the caller-scoped pair: the call
  completes (a business-prerequisite refusal is `not_reached`, never a verdict — new evaluator
  `completes`); alice's account is gone; and a classified diff (`classifyAccountDeletion`) over every
  row naming alice, bob, carol, dave or erin, taken before and after as JSON. Category A (a row
  naming only the caller) may change freely. Category B permits exactly: a row involving the caller
  removed (the schema's cascades, the function's deletion of notifications about the caller); the
  caller's id cleared by a foreign key's SET NULL, the row otherwise unchanged (a seat may also
  become "Deleted player"); a lobby the caller hosted handed to the joined member with the earliest
  `joined_at` (`release_room_seat`'s own rule), nothing else changed; another player's queue entry
  pointing at a room the caller still hosts after the handovers, cancelled with room and match
  cleared. Anything else on a row naming another account — including any new row — is category C
  and fails the guard. A third guard digests every table the foreign-key graph does not connect to
  `auth.users` (rulesets, career nodes, tournaments, daily challenges, cosmetics, rate-limit
  policies, and `realtime.messages`), which must not change at all. `prove-gates` hands the
  classifier the documented handover (must pass) and five forbidden changes (each must fail), and
  stages a change to a global table the digest must see.
  *Limitation, stated:* a row that reaches another account only through another table's id (a
  tournament match naming entry ids, not user ids) is outside the row classifier; its table is
  FK-connected, so the unrelated-tables digest does not cover it either.
- *The ledger TRUNCATE.* The F9 runner used to hard-code `truncate public.wallet_ledger` whatever
  the approved statement said; it now issues the approved statement verbatim, accepting only
  `truncate public.wallet_ledger` or `… cascade`.

**Not changed, though it could have been.** `F5.278`'s approved `covers` still says the function is
"deliberately callable without an account", which D3.52 showed is an Attest planning misreading
(Arc21 revokes EXECUTE from anon on purpose). The author's C4 decision changed the identity and
operation only, so the covers text stays as approved; the evidence record carries it, and this
entry is where its inaccuracy is recorded.

**Output wording corrected in passing.** `plan-wp3` said "240 negative tests awaiting AUTHOR
INTENT" (it was counting rows that require one) and `draft-intents` called reviewed AI drafts
"author-written"; both now say what they count. Two planning run directories generated minutes
earlier with the stale wording were deleted and regenerated; they were superseded output, not
evidence of anything.

---

## WP3 execution

### D3.55 — The official WP3 runs: three Attest-side defects found by the evidence, fixed, proven, and the assessment re-run

**What happened.** The author's Gate A reply authorised execution once every gate passed. Three
official runs followed, all from a clean committed tree, all against schema `5695a4c3df2d` and the
same frozen matrix, and all leaving Arc21's fingerprint unchanged. All three are kept, unedited, in
`evidence/runs/`.

| Run | Harness | Records | Outcome |
|---|---|---:|---|
| `20260924T203033Z` | `1eda5eef` (= tree of `5163a03`) | 345 | complete; **superseded** — its own validation fails one check, and eleven verdicts came from a defective heuristic |
| `20260925T010904Z` | tree of `e28c0c6` | 55 | **aborted** before the 56th Test ID by an infrastructure failure |
| `20260925T014011Z` | tree of `f8cc830` | 345 | **the WP3 result**; independent validation **passes all 19 checks** |

**Defect 1 — evidence completeness (found by `validate-wp3`).** The three server-side wallet
integrity probes (`F9.316`, `.317`, `.318`) recorded no read-back session identity: their runner
opened its own connections and never asked them who they were. The brief requires every record to
carry the identity it ran as, and the independent validator refused the run for it. Fix: every F9
connection reads back its identity the way every other probe's does; the concurrency probe records
both of its connections in the notes and connection A's identity on the record.

**Defect 2 — an evaluation heuristic (found by reading the eleven anomalies).** The audit-absence
probe counted any trigger that fires on DELETE as a possible trail. Every DELETE trigger in Arc21's
application schemas is a guard that *refuses* a delete (`*_deny_client_write`,
`game_sessions_guard_escrow`) — verified by a catalog read on 2026-09-25: 30 such triggers, none of
whose functions writes a record — so eleven of the seventeen absence rows came back "not as
predicted" and were characterized instead of reported as the audit gaps they are. Fix: a DELETE
trigger counts only if its function writes a record (`INSERT INTO`); guards are counted and reported
separately. *Alternatives rejected:* naming the guard functions (brittle: the next guard would be
missed) and re-planning the F10 rows (the approved prediction was right; the evaluation was wrong,
and a planning change needs the author). *Limitation, stated:* a trigger that records by another
route — calling a function that writes, or NOTIFY to a listener — would still be missed.

**Defect 3 — infrastructure resilience (run 2).** On a host under heavy load (load average ~20;
rebuilds took ~138 s instead of ~32 s), `supabase db reset` applied all 59 migrations and then
failed while the CLI health-checked the restarted storage container, although the container came up
seconds later. A read-only check found the stack intact: 59 migrations applied, no other client, the
author's other checkout untouched. Fix: a reset that fails *after every migration applied* is
retried at most twice, logged, and recorded in the run's `meta.resetRetries`; a failure while
applying migrations is never retried. A retry cannot hide a bad state: every rebuild is then checked
against the migration files, the fixtures and the canonical digests before a probe runs. *Rejected:*
raising the CLI's health-check timeout (it lives in Arc21's `config.toml`, which Attest may not
change) and simply re-running (the harness would stay one slow container away from losing a run).

**Also changed.** The harness hash now covers `rubric/*.ts`, which the planner and executor import
(fixture ids, F5 specifications, intent drafts, frozen ratings); runs before 2026-09-25 were hashed
over `src/`, `sql/` and the seed only — for run 1 the rubric files were those committed at
`5163a03`, because its tree was clean. `validate-wp3` was split into a loader and a pure check so
`prove-gates` can break it: ten tamperings of a real results file, each refused by the check that
owns it and naming the record. prove-gates also gained the F10 guard-versus-archive case, the WP4
detector cases and the reset-retry classification: **73 of 73 injected defects caught, 5 of 5 controls held, real state restored**.

**What did not change.** No approved row, expectation, identity, fixture or intent changed. Nothing
was re-judged: run 1's records and validation stay exactly as written, including its failing check.

**Run 1 against the result.** Per Test ID, run 3 differs from run 1 in exactly the eleven F10 rows the heuristic had mis-judged (`not_as_predicted` / `characterized` → `as_predicted` / `gap`). The recorded actual outcome of every one of the 345 probes is identical in the two runs, and F9.316–.318 now carry their read-back identities. The fixes changed how evidence is judged and recorded, not what Arc21 did. The WP3 result, by verdict: **283 effective, 19 gap, 25 characterized, 5 deficient, 13 not measured** (run `20260925T014011Z-5695a4c3df2d`, harness `e1164c7d` = the tree of `f8cc830`, 72 files).

---

## WP4 — drift detection

### D3.56 — WP4: real schema states from Arc21's own history, rebuilt without touching Arc21

**The states.** The brief asks for at least three runs "across deliberately different schema
states, so the diff has something real to show". The honest source of different states is Arc21's
own history: every commit that changed `supabase/migrations` is a schema the author actually had.
WP4 uses four:

| State | Source | Migrations | Why |
|---|---|---:|---|
| `H1-009464c` | commit `009464c`, 2026-08-30 | 45 | the last state before `20260831120000_realtime_channel_authorization` added Arc21's policies on `realtime.messages` |
| `H2-4f9f7a6` | commit `4f9f7a6`, 2026-09-02 | 53 | the last state before `20260904120000_least_privilege_and_entry_visibility`, Arc21's own hardening |
| `C-current` | the working tree | 59 | the state WP3 assessed (one migration is uncommitted) |
| `T-controlled` | `C-current` + one Attest-only migration | 60 | a table added with no row-level security and no policy — the mistake the brief says drift detection must catch |

*Alternatives.* Synthetic mutations of today's schema (a dropped policy here, a widened grant
there) would show the detector working but not how Arc21 actually changed; the controlled state
does that job once, openly labelled, and the rest is history. More historical states would add
rebuild time without adding a new kind of change.

**Nothing is checked out in Arc21.** A historical state is written with `git archive <commit>
supabase` into `.wp4-states/` (gitignored, Attest-owned): read-only, no checkout, no worktree, no
ref, no index refresh (`GIT_OPTIONAL_LOCKS=0`). A run points `ATTEST_SUT_REPO` at that directory;
the read-only guard still fingerprints the protected checkout (`ARC21_CHECKOUT`, separated in
`5163a03`) before and after every state, in a child process per state. The controlled migration
exists only in the scratch copy.

**What counts as a control definition change** (brief §6.1). A policy whose `USING` or
`WITH CHECK` expression differs, as PostgreSQL itself prints it (`pg_get_expr`), is a *definition*
change. Anything else about the same control — a policy's command, roles or permissiveness; a
grant's privileges; RLS enabled or forced; a trigger's events; a function's grantees or definer
flag — is an *attributes* change. A control id present on one side only is *added* or *removed*.
A resource present only in the later state is *new*, and *new with no control* when it has no
row-level control: a table with row-level security off, or a view that does not run as its
invoker. Whether a client role can reach it now is reported beside that, never instead of it. The
distinction is not academic here: since `20260904120000_least_privilege_and_entry_visibility`,
Arc21's default privileges no longer grant a new `postgres`-owned table to `anon` or
`authenticated`, so a table a developer forgets to protect is unreachable today and one `GRANT`
from exposed. The first version of the detector counted only *reachable* unprotected tables and
would have called that table controlled; it was corrected before WP4 ran, and `prove-gates` now
adds a table with no row-level security and no grant and requires it to be reported. An existing
resource that loses its row-level control, or gains an unprotected observation (reachable with
row-level security off, anonymous reach), is *newly exposed*.

**Results across states are today's questions asked of yesterday's schema.** The historical
states run the APPROVED WP3 probes from the current planning run — a historical plan would be a
different set of questions. A probe runs in a state only if that state can answer it as approved:
its baseline fixtures apply and verify, its statement and every admin read compile (`PREPARE`), its
probe-scoped setup applies and every premise holds, all inside a transaction that is always rolled
back. Anything else is recorded as *incompatible* with the reason and is never a pass or a failure.
The current state's results are the official WP3 run's, linked by run id, not re-executed; the
controlled state is inventoried only.

**Harness versus schema.** All four inventories in one WP4 run come from the same harness, so an
inventory difference is a schema difference. Historical results come from the WP4 run's harness
(the tree of `48084e3`); the current state's from the official WP3 run's (`f8cc830`). Besides the
WP4 and WP5 modules, the two differ in three executor changes made after the WP3 run: the reset
retry rule, the fixed key order of state digests, and the content comparison of digest guards
(below). None can change a WP3 verdict: the retry only decides whether a failed rebuild is tried
again, and the digest changes only stop identical states reading as different — no digest guard
failed in the WP3 run. Both hashes are recorded.

**The first WP4 run was stopped, and kept.** Run `20260925T021927Z-wp4` lost its first state at
310 of 326 records to three failed resets, and the second state's reset then hung for thirty
minutes: the host — 8 GB of RAM with 14 GB of swap in use while other applications were active —
had reached a load average of ~128. It was stopped by hand, Arc21's fingerprint was verified
unchanged, and its partial evidence is committed as written. It exposed three Attest defects, fixed
before the second run: the reset retry refused to retry a failure during schema initialisation
(now only a migration's SQL error is final; three retries at 30, 60 and 120 s); `TRUNCATE` cannot be
`PREPARE`d, so four answerable F10 probes had been marked incompatible (a `TRUNCATE` is now checked by
its relation's existence); and the eleven registered-contradiction rows had been dropped for failing
the very premise that is their contradiction (they now run and record `not_measured`, as in WP3).

**The second WP4 run was stopped too, and kept.** Run `20260925T035025Z-wp4` completed its first
state cleanly and was stopped during its second, because that state's evidence showed a harness
defect: `F5.remove_friend.262` and `F5.retire_push_token.268` came back `deficient` with a "no
effect" guard reporting "changed:" and naming nothing, while the executor's own post-probe
comparison found no relation changed. A database or table-set digest was serialized in the row
order of a `UNION ALL` — which PostgreSQL does not guarantee — and the guard compared the
serialized strings, so identical content written in another order read as a change. The defect
can only make identical states look different, never the reverse: it cannot produce a false
`effective`, and in the official WP3 run no digest guard failed at all (the only failing guard is
`F5.269`'s row-level check), so no WP3 verdict is affected. Fixed in `48084e3`: `stateDigest`
returns its keys in a fixed order and digest snapshots are compared by content; `prove-gates` now
requires the same digest written in reverse order to compare equal and one changed value not to.

**Results.** Run `20260925T042837Z-wp4` (harness: the tree of `48084e3`); all four states and the final
restore exited 0.

| Compared | added | removed | definition changed | attributes changed | new, no row-level control | pass → fail | fail → pass |
|---|---:|---:|---:|---:|---:|---:|---:|
| H1 → H2 | 23 | 8 | 0 | 0 | 0 | 0 | 4 |
| H2 → C | 0 | 1 | 4 | 4 | 0 | 0 | 2 |
| C → T | 2 | 0 | 0 | 0 | **1** | — | — |
| H1 → C | 23 | 9 | 4 | 4 | 0 | 0 | 6 |

- **The brief's test passes.** The Attest-only table was reported on the run that added it, as a new
  resource with no control — and, correctly, as not reachable by any client role today, one `GRANT`
  from exposed.
- **Not one of today's 345 approved questions went from pass to fail across Arc21's history.** Six
  went from fail to pass: Arc21's 2026-09-04 hardening stopped non-participants reading tournament
  entries and matches (`F1.205`, `F1.213`); private Realtime channels, which before 2026-08-31
  refused everyone including the channel's own members, now admit them (`F8.307`, `F8i.313`); and
  two refusals are now raised where the approved rows expect them, `PT404` rather than `P0002`
  (`F5.246`, `F5.259`) — refused in both states, so no access decision changed there.
- **All four current findings were already present in both historical states** (WP5 shows each
  item's history).
- **The current state's inventory is identical to the frozen CP1/CP3 inventory** in every drift
  class — the same schema read three days apart by two harness versions.
- H1 could not be asked 4 of the 345 questions (the functions did not exist yet); H2 all 345.

---

## WP5 — findings, risk prioritisation and remediation guidance

### D3.57 — How WP5 consolidates, ranks and hands the findings to the author

**Decided.** `npm run attest wp5` builds the WP5 package from persisted evidence only — the
official WP3 run (which must have passed `validate-wp3`), the frozen CP3 tiers and WP0 inventory
(run `20260922T234324Z`), the planning run, and the WP4 drift run — and writes `FINDINGS.md`,
`CP4_PACKET.md` and a copy under `evidence/runs/<wp3 run>/wp5/`. It is regenerated, never edited.

**Grouping is drafted; it is checked against the evidence.** Which records form one finding is a
presentation choice, so it is written down (`src/wp5-guidance.ts`) rather than inferred. The
command refuses to write anything unless every record that is not `effective` belongs to exactly
one item, each item selects exactly the number of records it was written for, each carries the
verdict its prose assumes, and every record an item calls "holding" is `effective`. Prose that
outlived its evidence would be a fabricated finding; this makes that impossible to do silently.
The dry run against run 1 showed it working — it refused, naming the eleven F10 rows the heuristic
defect had mis-judged — and it caught two mistakes in the drafted selectors on the way (`"F10…"`
matching a prefix meant for F1, and an Attest scratch-table row given a resource tier). Against the
result it reports nothing: all 62 non-effective records belong to exactly one item.

**The ranking rule** (the brief: "ordered by the WP2 risk tier"; Amendment A1: "using the frozen WP2
risk context and the observed evidence"):

1. *Part:* findings (a WP3 failure or gap) before informational items (characterizations and WP0
   structural observations) before limitations.
2. *Frozen WP2 tier of the resource at risk* — the table whose data or integrity the observed
   behaviour affects. For a `SECURITY DEFINER` function that is the table it exposes or changes.
   Every F5 test row is "High" by a planning rule about test depth; that is not a risk rating, and
   using it would have ranked a Medium-tier table's problem as High.
3. *Evidence class:* `deficient` before `gap` before `characterized`.
4. *Most exposed path* in the frozen rating: anonymous, authenticated, server-only.
5. More Test IDs, then the item's name.

*Alternatives.* Ranking by the test row's tier (every F5 finding High), or by a severity invented
at WP5 (the brief forbids tuning risk after seeing results, §7). *What would change:* under the
test-row rule the push-token finding would outrank the audit-trail gaps. The author may state a
different rule at CP4 (J-question in the packet); it would be recorded as the author's decision
and would never alter a frozen tier.

**Provenance is on the page.** Titles, "what happened", "why it matters", limitations, remediation
options and tradeoffs are AI-drafted and labelled so. Evidence bullets are generated from the
records. "Why it matters" quotes the approved matrix's own "Escalation would be" text and the
frozen ratings where they exist. Where the evidence points both ways the item says so: the
leaderboard finding carries Arc21's own test file stating that a private profile deliberately stays
on leaderboards, beside the approved WP3 expectation that it should not.

**History is shown, not judged.** When a WP4 run is given, each item traces its own Test IDs
through every historical state — how many were deficient, effective, or could not be asked of that
schema — beside today's result. It says how long a condition has existed; it does not change a
rank.

**The narrative is the author's.** Every item except the limitations carries
`AUTHOR NARRATIVE: ______`. `rubric/wp5-author-narratives.json` is created blank and is never
overwritten by the tool; each entry records the author's words verbatim, the author's status
decision (open / accepted-design-intent / informational) and the dated reply it came from.

**Verification is a command.** `npm run attest verify-finding <item> --official=<run>
--candidate=<run>` confirms a future fix only if the candidate run passed validation, each of the
item's Test IDs reached the stated verdict, and no Test ID that was `effective` in the official run
is anything else. It refuses items whose frozen rows cannot confirm a fix — the partial audit
trails, whose approved expectations would still read `gap` after one — and says so in the item
itself. `prove-gates` proves it on the official run: unchanged → not confirmed; the leaderboard
rows flipped → confirmed; the same with one regression → refused; unvalidated → refused.

**Stated plainly, as A1 requires:** no remediation was implemented and none was independently
verified, because Arc21 is a read-only target. Every "fix" in WP5 is a recommendation.

---

## Scope change — Amendment A2 (2026-09-25): completion without further routine gates

### D3.58 — The author amended the authorship and checkpoint requirements for the unfinished work

**What changed, and when.** In the same reply that answered CP4 (2026-09-25, about 17:30 UTC), the
author recorded Amendment A2 to the brief. `PROJECT_BRIEF.md` is not version-controlled, so this
entry is the version-controlled record of it; the brief carries the full text and a *superseded by
A2* marker on each passage it affects.

**It is prospective.** A2 applies only to work unfinished at CP4 — the findings narrative adopted at
CP4, WP6, CP5 and WP7. It rewrites no history and changes no WP0–WP5 evidence or decision: the
rubric (WP2) was written by the author before A2; the 240 intents (WP3) were adopted at Gate A as
`user_reviewed_ai_draft` with **0** `user_authored`, exactly as recorded in D3.54; every run,
verdict and frozen tier stands. It does not touch Arc21: Amendment A1 still governs.

| Before A2 | After A2 |
|---|---|
| The findings narrative and the framework-mapping rationales are the author's to write (brief §1.1) | Either may be drafted by AI. It is labelled *AI-drafted*, *AI-assisted* or *user-reviewed AI draft* and is never presented as independently human-authored; a structured provenance field records it (`user_reviewed_ai_draft`, never `user_authored`) |
| CP5 is a stop for the author's separate approval after WP6 | Waived prospectively by the author. The CP5 package is still generated and validated; CP5 is recorded as **superseded by Amendment A2**, not as approved |
| Every checkpoint is a stop | After CP4 nothing routine stops the work — continuing, WP6, WP7, validation, regeneration, commits and pushes are authorised once their prerequisites hold |
| — | Work still stops before completion if it would require modifying Arc21, destroying unrecoverable user data, exposing a real secret, misstating evidence or provenance, or resolving an irreducible contradiction with no conservative truthful disposition. An ordinary ambiguity is resolved conservatively and its limitation written down |

**Why it is recorded this carefully.** The brief's interview-risk paragraph says the project's
credibility depends on four artifacts being the author's own. A2 relaxes that for two of them, and
the honest consequence is a provenance label, not a quieter claim: the resume-facing record must not
say the author wrote the findings narrative or the framework-mapping rationales.

**Alternatives.** (1) Keep the reservations and wait for the author at CP5 — the author declined
this. (2) Treat the CP4 reply's wording as `user_authored` because the author sent it — rejected: the
reply itself says the wording is AI-assisted text the author reviewed and adopted, and A2 forbids
the stronger label. **What would change:** under (1) WP6's rationales would stay blank until the
author wrote them; under (2) FINDINGS.md would overstate the author's authorship.

## CP4 — the author's reply, applied

### D3.59 — CP4 answered and approved: the reply recorded verbatim, the J3 rule applied resource by resource

**Source.** The author's CP4 reply of 2026-09-25, answering `CP4_PACKET.md` as committed in
`e6d5c4a`. It is recorded verbatim in `rubric/cp4-author-response.json` (statuses, narratives,
J1–J14, the approval and what it does not mean), and the eight narratives and statuses are copied —
programmatically, not retyped — into `rubric/wp5-author-narratives.json` as
`user_reviewed_ai_draft`. No decision below was made by Attest.

**Enforced, not asserted.** `attest wp5` refuses to write FINDINGS.md unless (`checkCp4Record`): every
narrative in the store is the reply's text byte for byte; every status is the reply's; no entry is
labelled `user_authored` while the reply records AI-assisted wording; each answered item still has
the rank (A1…B4) it had when the author answered it; each J number attaches to the question the
packet gave it (recomputed from the ranking, not trusted from the file); and the approval reads
"approved". `prove-gates` breaks each of those on a copy and requires the refusal.

**The decisions.**

| Item | The author's status | The author's judgments |
|---|---|---|
| A1 leaderboards return a private-profile name | accepted / design intent | J1: the four WP3 records stay `deficient` against their frozen expectations; the WP5 status is accepted design intent. J2: one item, one root cause across four functions |
| A2 no trail for 17 High-tier resources | open | J3: a trail is required for durable security-sensitive, authorization/privacy, configuration, economic or authoritative competitive state; transient live room/session state may be excluded; each exclusion recorded here. J4: wallet_ledger suffices for public.wallets *provided* it remains append-only, is complete for every balance-changing operation, and reconciliation proves the balance derivable; no duplicate wallet trail |
| A3 partial trails | accepted / design intent | J5: the join to private.game_commands is an adequate actor trail *if* deterministic and retained; state that the join was not tested. J6: refused rate-limit attempts need not be stored in the application database |
| A4 push-token reassignment | open | J7: a token moves between accounts only with explicit re-registration plus proof of possession or control, or another appropriately authenticated handover. J8: the frozen Medium tier stands |
| B1 FORCE RLS not set | informational | J9: platform design, not an open finding by itself; FORCE is not required on every table without a concrete need |
| B2 sprint standings names | accepted / design intent | J10: consistent with the leaderboard decision; the characterization stays |
| B3 anonymous catalogue reads | accepted / design intent | J11: consistent with RUBRIC Part 4.4 |
| B4 latent anon grants on realtime.messages | informational | J12: no demonstrated anonymous access; revoking the unused grants where the platform permits is preferable defence in depth |
| — | — | J13: the D3.57 ranking rule accepted as written; frozen tiers unchanged. J14: `20260925T014011Z-5695a4c3df2d` is the WP3 result and `20260925T042837Z-wp4` the WP4 result; earlier runs stay as engineering history |

**J3 applied to each resource.** The rule is the author's; applying it resource by resource is
Attest's (AI-drafted under A2), conservative where a resource could be read either way, and checked
against the evidence: `rubric/wp5-audit-scope.json` must name exactly the seventeen resources whose
F10 absence record is a `gap`, with the same Test IDs (`checkAuditScope`). **Thirteen require a trail
and have none** — the finding stays open for them: `private.career_drill_seeds`, `public.blocks`,
`public.daily_challenges`, `public.friend_requests`, `public.friendships`,
`public.game_session_seats`, `public.game_sessions`, `public.hand_records`, `public.profiles`,
`public.rate_limit_policies`, `public.rulesets`, `public.tournament_entries` and
`public.tournament_matches`. **Three are excluded**, each for this reason:

| Excluded | Reason (J3: transient live room/session state with no durable audit requirement) | Residual risk, stated |
|---|---|---|
| `private.game_state_private` | the live engine state of one active session (shoe order, hole card), overwritten by every accepted command; every accepted command that changes it is recorded with its actor in `private.game_commands` — the complete trail WP3 found (F10.012–.015) — and completed hands are archived in `public.hand_records`, which stays in scope | a privileged write that bypasses command processing leaves no record of who made it |
| `public.rooms` | lobby metadata whose access effect (who may join) lasts only while the room is live — `expires_at` is fixed at thirty minutes after creation and never extended; the room row holds no chips (Arc21's comment: no wallet movement from a private table; a wallet-backed public table's escrow is in `game_sessions`, in scope) | an unauthorized change to a live room's visibility or code is not attributable afterwards |
| `public.room_members` | lobby membership, meaningful only while the room is live; stacks and escrow live in `game_session_seats` and `game_sessions` (in scope) and every chip movement in `wallet_ledger` | an unauthorized membership during a live room is not attributable afterwards |

*Kept in scope although arguable:* `private.career_drill_seeds` (attempt-scoped, but security-sensitive
and reward-bearing — the conservative reading); `public.game_session_seats` (session-scoped, but its
rows outlive the session, authorize reading archived hands, and carry stack and buy-in).

**J4 applied to `public.wallets`: conditional, and not established.** The author's acceptance
depends on three conditions, and the evidence establishes them only in part, so the wallets row is
reported as *conditionally covered — unverified*, not as satisfied:

- *Append-only* — partly. Tested: UPDATE refused on the privileged path (F9.320), TRUNCATE refused
  (F9.322), client UPDATE, DELETE and TRUNCATE refused (F10.233–.235). Read from the catalog on
  2026-09-25, not tested: `guard_ledger_append_only` refuses DELETE only for client roles, so a
  server-role DELETE is permitted — the design that lets an account deletion cascade to its ledger
  rows (`wallet_ledger.user_id` and `wallet_id` are `ON DELETE CASCADE`).
- *Complete for every balance-changing operation* — source reading only: every statement in the 59
  migrations that writes `public.wallets` is paired with a `wallet_ledger` insert in the same function
  (`apply_wallet_delta`; the signup handler's initial grant). Nothing in the database enforces the
  pairing for a privileged writer.
- *Reconciliation* — observed once: F9.316, alice's balance 25625 equals her ledger sum 25625. No
  standing reconciliation check exists or was assessed.

**J5's condition, read from the catalog (not tested).** No constraint links a game event to the
command that caused it; the columns a join could use — `game_events (game_session_id,
state_version)` and `private.game_commands (game_session_id, applied_version)` — are not declared
one-to-one. And `private.game_commands.user_id` is `ON DELETE CASCADE` from `public.profiles`, so an
account's deletion removes its commands, and with them the actor of its events. The acceptance
stands as the author's decision; the "deterministic" condition is unverified and the "retained"
condition does not hold after the actor's account is deleted. FINDINGS.md A3 says so.

**J8, recorded as asked.** The frozen Medium tier of `public.push_tokens` stands for this assessment.
No disagreement with it was raised; any later one is recorded prospectively, and WP2 is not changed.

**J14, made durable.** `rubric/official-runs.json` records the official runs and why every other run
is not a result; `attest wp5` (and every generator after it) reads the run ids from there instead of
from hard-coded strings or command-line memory.

**What the CP4 packet became.** Once the reply is recorded, `attest wp5` renders `CP4_PACKET.md` as
the CP4 *record* — the same evidence sections, the author's status beside each item, the narratives
and answers verbatim with their provenance, and the approval with what it does not mean — with no
wall-clock timestamp, so an unchanged regeneration is byte-identical. The packet as the author read
it is `git show e6d5c4a:CP4_PACKET.md`.

**What did not change.** No WP3 verdict, no frozen tier, no ranking (the regenerated list assigns the
same ids A1–C2 to the same items, which the check requires). One piece of AI-drafted WP5 prose was
corrected while applying J4: the A2 item had called `wallet_ledger` "append-only with a truncate
guard", and now says what the catalog shows — UPDATE refused for every role, client writes refused,
a truncate guard, and server-role DELETE permitted by design.

**Stated plainly, as A1 requires:** CP4's approval does not mean Arc21 was remediated, a finding was
fixed or closed, or any remediation was independently verified. None was.
