# Harness validation (WP1) — Arc21

Every line below is the recorded outcome of a statement that was executed. The controls
were deliberately broken in a disposable instance and put back.

| | |
|---|---|
| Run | `20260922T004014Z-5695a4c3df2d` |
| Started | 2026-09-22T00:40:51.861Z |
| Instance | 127.0.0.1:54322/postgres |
| Schema version | `5695a4c3df2d3f6c6311999ae268f776e96c3beb657e8a8a466be2ebb62aabec` |
| Harness version | `0.1.0` sources `3262b86aa67a` |
| Evidence records | 37 |

| Claim | Result |
|---|---|
| No probe ended in a harness error | **yes** |
| Every weakened control was detected | **yes** |
| Every weakening was reverted | **yes** |
| Control inventory identical before and after | **yes** |

## 1. Who the tests run as

Read back out of the database after the role switch, not asserted by the harness.

| Identity | current_user | session_user | Superuser | **Bypasses RLS** | Owns an application table | auth.uid() |
|---|---|---|---|---|---|---|
| `authenticated:alice` | `authenticated` | `authenticator` | no | **no** | no | `00000000-0000-4000-8000-00000000000a` |
| `anon` | `anon` | `authenticator` | no | **no** | no | — |
| `service_role` | `service_role` | `authenticator` | no | **yes** | no | — |
| `admin(postgres)` | `postgres` | `postgres` | no | **yes** | yes | — |

The control tests use `authenticated:*`. It is not a superuser, does not bypass row-level
security, owns nothing, and carries a specific user's identity — so a policy that reads
`auth.uid()` has something real to read.

### Can the testing login escalate out of that?

Executed on the same login every control test uses.

| Statement | Permitted | Outcome |
|---|---|---|
| `set role postgres` | **no** | error 42501: permission denied to set role "postgres" |
| `set role service_role` | **yes** | succeeded |

- `set role postgres` — postgres owns every application table and holds BYPASSRLS. If this were permitted, the login used for control testing could exempt itself from every policy.
- `set role service_role` — service_role holds BYPASSRLS. This IS permitted: the same login the control tests use can switch into a role exempt from row-level security.

The second result is the honest one and it is not comfortable: the login the control tests
use **can** switch into `service_role`, which holds BYPASSRLS. Nothing in the database
prevents it. What prevents it here is the harness itself:

> `roleSession({ role: "service_role" }) without allowRlsBypass`
> → refused: **yes**
> `refusing to test as service_role: it holds BYPASSRLS. Row-level security would not be applied and every test would pass vacuously. Pass allowRlsBypass only for a deliberate over-privilege demonstration.`

That is a guard in code, not a property of the database, and it should be read that way.
It is load-bearing precisely because the database would allow the mistake.

## 2. What "enabled but not forced" actually does

Across the application schemas (`public` and `private`) Arc21 has row-level security enabled
on 38 tables and forced on 0. (The inventory counts 39 tables because it also
includes `realtime.messages`, which Arc21 writes policies on but does not own.) That is a fact. Whether it is a problem is a different question, and
this section separates the two by demonstrating the mechanism before drawing any conclusion.

On this instance `postgres` both owns the tables **and** holds BYPASSRLS, so
watching it ignore a policy would not show which rule did it. The demonstration below uses a
scratch table owned by a purpose-made role holding **no** BYPASSRLS, so ownership is the only
exemption in play. The table and the role are created and dropped inside the run; nothing in
Arc21 is touched.

The table holds 2 rows. The policy admits 1 of them.

| Run as | Table state | Rows returned | What it means |
|---|---|---|---|
| attest_force_demo_owner (owns the table, no BYPASSRLS, not a superuser) | RLS enabled, NOT forced | **2 row(s)** | Both rows. The policy admits one of the two, and the owner is not subject to it. This is what 'enabled but not forced' means in practice. |
| attest_force_demo_owner (same role, same statement) | RLS enabled AND forced | **1 row(s)** | One row. FORCE removes the owner's exemption, and the owner is now filtered by the same policy as anyone else. |
| postgres (holds BYPASSRLS, is not the owner of this table) | RLS enabled AND forced | **2 row(s)** | Both rows, with FORCE on. FORCE closes the OWNER exemption and does nothing about the BYPASSRLS one. They are two separate doors and Arc21's tables have both open. |

### So does it matter for Arc21?

The setting is only worth something if somebody who benefits from its absence can be reached.
That is a reachability question and it has an executed answer:

| Question | Answer |
|---|---|
| Does the table owner (`postgres`) bypass RLS anyway? | **yes** |
| Can the client login reach the table owner? | **no** |
| Can the client login reach a role that bypasses RLS? | **yes** |

Read together: turning FORCE on would close the owner door, and would **not** close the other
one, because the owner holds BYPASSRLS as well. No client can reach the owner. A holder of the
`authenticator` credential can reach `service_role`, which bypasses row security — so on this
instance the exposure this creates is a function of credential handling, not of the FORCE
setting.

**This section deliberately stops here.** Whether that is acceptable is a risk judgment, it
belongs to the rubric in WP2, and it is the author's to make.

## 3. Deliberate-break scenarios

5 scenarios across 5 control families. For each: probe the intact
control, weaken it, probe again with the identical statement, restore, probe again.

| # | Control family | Detected the break | Restored cleanly |
|---|---|---|---|
| S1 | read isolation | **yes** | yes |
| S2 | WITH CHECK enforcement | **yes** | yes |
| S3 | column grant + write-guard trigger | **yes** | yes |
| S4 | realtime channel authorization | **yes** | yes |
| S5 | server-only schema isolation | **yes** | yes |

### S1 — read isolation

**The control.** wallets_select_own restricts SELECT on public.wallets to rows whose user_id equals auth.uid().

**Control identifier.** `public.wallets#policy:wallets_select_own`

**The probe.** Run as `authenticated:alice`:

```sql
select balance from public.wallets where user_id = $1
```

| Point in the run | Expected | Actual | As expected |
|---|---|---|---|
| control intact | no data (error or 0 rows) | **0 row(s)** | yes |
| after weakening 1: alter policy wallets_select_own on public.wallets — replace its USING expression with true | 1 row(s) | **1 row(s)** | yes |
| control restored | no data (error or 0 rows) | **0 row(s)** | yes |

Detected the break: **yes** — the recorded outcome changed when the control was weakened.

**The same statement, on an over-privileged connection:**

| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |
|---|---|---|---|---|---|
| `service_role` | yes | error 42501 | error 42501 | **no** | permission denied for table wallets |
| `admin(postgres)` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |

Neither over-privileged connection could tell the two states apart — each returned the
**same answer** whether the control was intact or broken. No assertion built on either could
have detected this break.

They are blind for **opposite reasons**, which is worth separating.
`admin(postgres)` succeeded in both states: it is exempt
from the policy, so the control was never consulted. `service_role`
was refused in both states for a different reason — it holds no privilege on this object at
all, so it never reached the policy either. One is over-privileged past the control; the
other is under-privileged short of it. Neither is standing where a client stands, which is
the only place the control can be observed.

### S2 — WITH CHECK enforcement

**The control.** push_tokens_insert_own carries a WITH CHECK requiring an inserted row's user_id to equal auth.uid(). This is the half of a policy that governs what may be WRITTEN, and it is separate from the SELECT policy.

**Control identifier.** `public.push_tokens#policy:push_tokens_insert_own`

**The probe.** Run as `authenticated:alice`:

```sql
insert into public.push_tokens (user_id, token, platform) values ($1, $2, 'ios')
```

| Point in the run | Expected | Actual | As expected |
|---|---|---|---|
| control intact | error 42501 | **error 42501** | yes |
| after weakening 1: alter policy push_tokens_insert_own on public.push_tokens — replace its WITH CHECK expression with true | 1 row(s) | **1 row(s)** | yes |
| control restored | error 42501 | **error 42501** | yes |

Detected the break: **yes** — the recorded outcome changed when the control was weakened.

**The same statement, on an over-privileged connection:**

| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |
|---|---|---|---|---|---|
| `service_role` | yes | error 42501 | error 42501 | **no** | permission denied for table push_tokens |
| `admin(postgres)` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |

Neither over-privileged connection could tell the two states apart — each returned the
**same answer** whether the control was intact or broken. No assertion built on either could
have detected this break.

They are blind for **opposite reasons**, which is worth separating.
`admin(postgres)` succeeded in both states: it is exempt
from the policy, so the control was never consulted. `service_role`
was refused in both states for a different reason — it holds no privilege on this object at
all, so it never reached the policy either. One is over-privileged past the control; the
other is under-privileged short of it. Neither is standing where a client stands, which is
the only place the control can be observed.

### S3 — column grant + write-guard trigger

**The control.** profiles.level is server-owned. Two separate controls refuse a client write to it: `authenticated` holds no column-level UPDATE privilege on it, and profiles_guard_server_columns raises 42501 if a client role changes it. Arc21's own documentation calls the trigger the second lock; this scenario tests whether there really are two.

**Control identifier.** `public.profiles#trigger:profiles_guard_server_columns`

**The probe.** Run as `authenticated:alice`:

```sql
update public.profiles set level = 99 where id = $1
```

| Point in the run | Expected | Actual | As expected |
|---|---|---|---|
| control intact | error 42501 | **error 42501** | yes |
| after weakening 1: grant update (level) on public.profiles to authenticated — removes the first lock | error 42501 | **error 42501** | yes |
| after weakening 2: alter table public.profiles disable trigger profiles_guard_server_columns | 1 row(s) | **1 row(s)** | yes |
| control restored | error 42501 | **error 42501** | yes |

Detected the break: **yes** — the recorded outcome changed when the control was weakened.

**The same statement, on an over-privileged connection:**

| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |
|---|---|---|---|---|---|
| `service_role` | yes | error 42501 | error 42501 | **no** | permission denied for table profiles |
| `admin(postgres)` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |

Neither over-privileged connection could tell the two states apart — each returned the
**same answer** whether the control was intact or broken. No assertion built on either could
have detected this break.

They are blind for **opposite reasons**, which is worth separating.
`admin(postgres)` succeeded in both states: it is exempt
from the policy, so the control was never consulted. `service_role`
was refused in both states for a different reason — it holds no privilege on this object at
all, so it never reached the policy either. One is over-privileged past the control; the
other is under-privileged short of it. Neither is standing where a client stands, which is
the only place the control can be observed.

### S4 — realtime channel authorization

**The control.** Arc21 broadcasts game state over Realtime private channels. A client may publish to the shared presence topic and to nothing else; the server publishes game state as service_role. The control is a WITH CHECK on realtime.messages comparing realtime.topic() to 'presence:players'. `authenticated` holds INSERT on the table, so the policy is the only thing deciding.

**Control identifier.** `realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client`

**The probe.** Run as `authenticated:carol`:

```sql
insert into realtime.messages (topic, extension, event, private, payload) values ($1, 'broadcast', 'state', true, '{"attest_wp1":true}'::jsonb)
```

| Point in the run | Expected | Actual | As expected |
|---|---|---|---|
| control intact | error 42501 | **error 42501** | yes |
| after weakening 1: alter policy arc21_only_presence_may_be_written_by_a_client on realtime.messages — replace its WITH CHECK expression with true | 1 row(s) | **1 row(s)** | yes |
| control restored | error 42501 | **error 42501** | yes |

Detected the break: **yes** — the recorded outcome changed when the control was weakened.

**The same statement, on an over-privileged connection:**

| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |
|---|---|---|---|---|---|
| `service_role` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |
| `admin(postgres)` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |

Neither over-privileged connection could tell the two states apart — each returned the
**same answer** whether the control was intact or broken. No assertion built on either could
have detected this break.

### S5 — server-only schema isolation

**The control.** private.game_state_private holds authoritative engine state including the undealt shoe and the dealer's hole card. Two controls keep a client out: no client role holds USAGE on the `private` schema or any privilege on the table, and row-level security is enabled with zero policies, which denies every non-owner by default. This scenario tests that second claim empirically rather than taking it on trust.

**Control identifier.** `private.game_state_private#rls_enabled`

**The probe.** Run as `authenticated:alice`:

```sql
select engine_state from private.game_state_private where game_session_id = $1
```

| Point in the run | Expected | Actual | As expected |
|---|---|---|---|
| control intact | no data (error or 0 rows) | **error 42501** | yes |
| after weakening 1: grant USAGE on schema private and SELECT on the table to authenticated — removes the grant lock entirely | 0 row(s) | **0 row(s)** | yes |
| after weakening 2: create policy attest_wp1_break_leak on private.game_state_private for select to authenticated using (true) | 1 row(s) | **1 row(s)** | yes |
| control restored | no data (error or 0 rows) | **error 42501** | yes |

Detected the break: **yes** — the recorded outcome changed when the control was weakened.

**The same statement, on an over-privileged connection:**

| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |
|---|---|---|---|---|---|
| `service_role` | yes | error 42501 | error 42501 | **no** | permission denied for schema private |
| `admin(postgres)` | yes | 1 row(s) | 1 row(s) | **no** | succeeded in both states |

Neither over-privileged connection could tell the two states apart — each returned the
**same answer** whether the control was intact or broken. No assertion built on either could
have detected this break.

They are blind for **opposite reasons**, which is worth separating.
`admin(postgres)` succeeded in both states: it is exempt
from the policy, so the control was never consulted. `service_role`
was refused in both states for a different reason — it holds no privilege on this object at
all, so it never reached the policy either. One is over-privileged past the control; the
other is under-privileged short of it. Neither is standing where a client stands, which is
the only place the control can be observed.

## 4. The instance was left as found

The full control inventory was read before the first weakening and again after the last
restoration, and compared in its entirety rather than only across the controls that were
touched — so a restore that put something back in a subtly different shape would show up.

Identical: **yes**


## 5. What this does not establish

- It shows the probes detect **these** breaks. It does not show they would detect every
  possible weakening of the same control, and it says nothing about controls no scenario
  touches.
- Each scenario weakens a control to a deliberately obvious degree — an expression replaced
  by `true`, a trigger disabled. A subtler regression, such as a policy that is wrong only
  for a particular row shape, is a harder thing to catch and is not tested here.
- The evidence records carry no `intent` statement. Naming the attack each negative test
  simulates is reserved for the author in WP3; WP1's probes exist to validate the harness,
  not to assess Arc21, and they carry a mechanical description instead.
- Nothing here rates risk. No finding, tier or severity is assigned or implied.
