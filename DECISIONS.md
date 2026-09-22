# DECISIONS

One entry per judgment call that could reasonably have gone another way: what was decided,
what else was on the table, why this one, and what would be different if the other had been
chosen.

Entries are appended as work packages land. Entries about the **risk rubric**, **tier
assignments**, the **tier-to-assurance-activity mapping**, **which gap was remediated**, and
**arguable framework mappings** are the author's to write and are not present yet — they
belong to WP2, WP5 and WP6.

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
