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
