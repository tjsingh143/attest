# Gate A — the author's decisions before WP3 may run

**Status, 2026-09-24.** Everything Attest can do before the WP3 assessment is done. Planning
preflight passes on a freshly rebuilt baseline, `prove-gates` catches 66 of 66 injected defects
with 3 of 3 controls held, and Arc21 is unchanged (fingerprint `13569cf0e2dd36c1…` before and
after every command). **The assessment has not been run.** It is refused for one reason: the 240
AUTHOR INTENT sentences are AI drafts, and brief §1.1 makes them yours.

This file collects **every** decision reserved to you before execution, so they can be answered
once. The one-page form is `WP3_AUTHOR_DECISIONS_COMPACT.md`; the machine-readable template is
`rubric/wp3-gate-a-decisions.json`. Reasoning is in `DECISIONS.md` D3.50–D3.53.

**Nothing here has been decided for you.** No draft is approved, no approved row has been
changed, and every "recommendation for consideration" below is a reading of the evidence, not a
default that applies if you say nothing. Anything left undecided keeps running exactly as
approved and records `not_measured`.

| # | Decision | Rows | Blocks execution? |
|---|---|---:|---|
| 1 | The 240 AUTHOR INTENT sentences — approve, or replace | 240 | **yes** (preflight refuses while any is `ai_draft`) |
| 2 | Ten registered contradictions — correct the approved row, or leave it `not_measured` | 57 | no |
| 3 | The reading of `F5.delete_own_account.283` | 1 | no |
| 4 | *(optional)* The approved `covers` wording of `F5.register_push_token.269` | 1 | no |

How to answer: see §7. After you answer, Attest records exactly what you decided (provenance
`user_reviewed_ai_draft` for a draft you accept, `user_authored` for a sentence you write), applies
only the corrections you authorise, re-runs the gates, and executes WP3.

---

## 1. The 240 intent sentences

### What changed since the previous hand-off

The drafts were independently audited against the final executor — row by row: the identity, the
statement the executor actually binds, the expected result, its claims and state guards, the
fixture and setup, and any registered contradiction. **76 drafts were objectively wrong or
materially vaguer than the probe, and were rewritten; 164 are unchanged.** They are still AI drafts
(`ai_draft` / `unreviewed`). The rewrite was made in the draft generator
(`rubric/intent-drafts.ts`), not only in the store, because regeneration refreshes every AI draft
from the generator and would otherwise have quietly put the old wording back.

What was wrong, by class (every row is in the review table, old and new side by side):

| Class | Rows | Example |
|---|---:|---|
| **Block direction reversed** | 2 | `F1.public_profiles.148` said alice reads "the profile of someone who has blocked them". In the probe alice *placed* the block (alice → dave), and the policy term it falsifies is `NOT viewer_has_blocked(id)`. `F5.send_friend_request.259` said the same thing the other way round. |
| **Deleted-user target** | 14 | Every draft said a stale token reached "another player's" data. Every probe filters on the *deleted* account's own owner column (`… where user_id = dave`). |
| **Dangling reference** | 13 | "A player holding no seat at *that table* reads … at *that table*" — "that table" before any table exists, said twice. |
| **Anonymous "own"** | 2 | An anonymous caller described as having "their own" daily attempt, or as one of "who else" is queued. |
| **Shared effect that does not exist** | 2 | `ensure_todays_daily_challenge()` and `latest_verifiable_daily_challenge()` described as having "housekeeping [that] legitimately touches other accounts' rows". The first mints a global row owned by no one; the second only reads. |
| **Broader than the probe** | ~20 | F5 drafts that appended the planner's whole `escalationWouldBe`, naming two attacks where the probe exercises one (`.271` also claimed `.272`'s anonymous-caller attack; `.279`–`.281` claimed seating, room assignment and rate-limit bypasses that no guard of theirs checks). |
| **Consequence reversed** | 1 | `F5.register_push_token.269` said a takeover "would redirect their notifications to the caller's device". The function reassigns the *token row*; the token still addresses the victim's device, so the victim stops receiving their own notifications and their device starts receiving the caller's. (The same error is in the approved `covers` text — §4.) |
| **Operation not performed** | 1 | `F2.public_friend_requests.056` described forcing a request to `accepted`; the probe cancels it (the executor binds `status = 'cancelled'`, D3.39). |
| **Ownership where the row is shared** | 1 | `F6.public_friend_requests.062` called a request addressed to the caller "a row they do own". |
| **A universal refusal attributed to the seat** | 2 | `F8.312`, `F8i.315`: "a player holding no seat" writes to a game topic. No client, seated or not, is admitted to write a game topic. |
| **Expiry is not sign-out** | 1 | The expired-session draft: "signed out for hours". The fixture's token expired one hour earlier, and expiry is not sign-out. |
| **Vague or self-contradicting** | several | e.g. the anon draft for `daily_challenges_public` called it "the public projection" while the row asserts anon must read nothing from it (it is granted to `authenticated` only). |

Five new quality checks now catch the classes above (D3.51). Against the pre-audit store they
fire 33 times, exactly on these rows; against the current drafts, zero; and `prove-gates`
re-injects one pre-audit sentence per class and requires its own check to fire.

### Review effort: A / B / C

This is review assistance only. **Being in category A approves nothing.**

| Category | Rows | Meaning |
|---|---:|---|
| **A** — plain boundary | 117 | The draft states the attack on a simple ownership, grant, column or anonymous-reach boundary (F1 ownership reads, F2 grant surface, F3/F4/F6 plain rows) |
| **B** — subtle | 107 | Technically sound, but the row turns on shared membership, a SECURITY DEFINER function, Realtime, the ledger, audit semantics, an identity boundary, or the social tables that feed profile visibility. Read slowly. |
| **C** — depends on §2 or §3 | 16 | The 14 deleted-user rows (C5), `F5.278` (C4: the actor changes if the row runs as a signed-in caller), `F5.283` (§3) |

53 of the 240 also carry a registered contradiction (the previous hand-off said 54; it is 53 — the
57 contradicted Test IDs include four positives).

### Where to read them

| File | Use |
|---|---|
| `evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.md` | **all 240**, grouped C → B → A: category, why, contradiction, current draft, the pre-audit draft it replaced, and which quality check the old one failed |
| `…/gate-a-intent-review.tsv` | the same, for a spreadsheet pass |
| `evidence/runs/20260924T174635Z-5695a4c3df2d/author-intent-worksheet.md` and `batches/` | each draft beside its full probe (operation, expected, covers), in 13 sittings |
| `rubric/author-intents.json` | the canonical store — the only file whose contents count |

### What you decide

For each category: **approve as written** (every draft in it becomes `user_reviewed_ai_draft` /
`approved`), or **review individually**. Individual decisions always override the category. Any
sentence you write yourself is stored as `user_authored`. If §2 changes a C row's probe (C4, C5)
or §3 changes `.283`'s reading, Attest regenerates that row's draft to match and it comes back to
you — a C row is not approved by a category decision made before its contradiction is settled
unless you say so.

---

## 2. Ten registered contradictions (57 Test IDs)

Each is an approved row whose expectation the system makes unmeasurable **as written**: another
mechanism answers first. Until you decide, the probe runs exactly as approved and records
`blocked_contradiction` → **`not_measured`** — never effective, never deficient. Each has a live
check; a registration that stops holding fails preflight.

**How the alternatives were checked.** Every alternative below was run on the disposable
database as the probe's own identity, inside a transaction that was rolled back, on 2026-09-24.
These are mechanism checks to inform this decision, **not WP3 evidence**, and nothing they did
persisted. Arc21 was not touched.

**Frozen-manifest impact.** Every correction changes a frozen field (`operation`, `expected` or
`identity`) of an approved row, so each would be listed in `rubric/wp3-approved-matrix.json` with
its old value, new value, reason and this decision's id — the same way the nineteen earlier
corrections were (D3.35). That is why even the purely mechanical ones are yours.

### C2-client-guard-before-grant — 34 F2 rows · *purely mechanical*

| | |
|---|---|
| Rows | `F2.*.002, .003, .008, .009, .017, .018, .042, .043, .075, .076, .086, .087, .094, .095, .105, .106, .167, .168, .176, .177, .184, .185, .192, .193, .198, .199, .207, .208, .215, .216, .228, .229, .239, .240` — every client UPDATE/DELETE on a server-written table |
| Intended property | `authenticated` holds no UPDATE or DELETE privilege on these tables, so a client cannot write them directly |
| Approved probe | `update <table> set <col> = <literal>` / `delete from <table>`, **no WHERE**, as alice → "error 42501 — refused before any policy is consulted" |
| What answers first | pg_safeupdate. Every client connection is the `authenticator` login, which preloads it (`session_preload_libraries = 'supautils, safeupdate'`); it refuses a WHERE-less UPDATE/DELETE at parse analysis (21000) before any privilege is checked. A platform guard, not Arc21's grant |
| What a naive harness reports | "error" → **effective**, crediting the grant for the platform's refusal; or, as the previous evaluator did, "21000 means the privilege check passed" → **34 false deficiencies** against a control that holds (D3.47) |
| Now | `not_measured` × 34 |
| Smallest alternative | append **`where true`** to each operation. pg_safeupdate only requires that a WHERE exist; `true` reads no column, so it pulls in no SELECT privilege check |
| Same property? | **Yes** — the same privilege bit is checked; only the statement shape changes, to get past a guard that is not Arc21's |
| Checked | as alice: `update public.game_sessions set tier = tier where true` → 42501 *permission denied for table game_sessions*; `delete from public.wallets where true` → 42501; `update private.game_commands … where true` → 42501 *permission denied for schema private*. Without the WHERE → 21000 |
| Manifest | 34 `operation` corrections; `expected` unchanged |
| For your consideration | Mechanical; no security judgement involved. Alternative (not recommended): restate the expectation as the pg_safeupdate refusal, which is a claim about the platform, not about Arc21 |

### C3-tier-literal-invalid — `F2.public_game_sessions.094` · *purely mechanical*

| | |
|---|---|
| Intended property | no client UPDATE privilege on `game_sessions` |
| Approved probe | `update public.game_sessions set tier = 'attest-probe-tier'` |
| What answers first | the enum parser: `'attest-probe-tier'` is not a `table_tier` label (22P02) — before safeupdate, before any privilege. The literal came from Attest's `literalFor()`, which does not read enum labels |
| Naive harness | "error" → **effective** |
| Now | `not_measured` (it also carries C2-client-guard) |
| Smallest alternative | `set tier = 'casual' where true` |
| Same property? | **Yes** |
| Checked | as alice → 42501 *permission denied for table game_sessions* |
| Manifest | 1 `operation` correction (with the WHERE above) |

### C2-grant-before-trigger — `F9.public_wallets.319` (UPDATE), `.321` (TRUNCATE), as alice

| | |
|---|---|
| Intended property (as approved) | the ledger's append-only triggers (`wallet_ledger_append_only`, `wallet_ledger_deny_truncate`) refuse a client's attempt to rewrite or empty it |
| What answers first | the table privilege: alice holds only SELECT on `wallet_ledger`, and PostgreSQL checks privileges before any trigger fires |
| Naive harness | "error" → **effective**, crediting the trigger for the grant's refusal |
| Now | `not_measured` × 2 |
| Is there a same-property client probe? | **No.** A client never holds the privilege, so a client can never reach the trigger: from a client session, the trigger is defence in depth behind the grant. The trigger itself is measured from the server side by `F9.320` (UPDATE — runs as approved) and `F9.322` (TRUNCATE — see next) |
| Alternative A | restate each expectation as the refusal that actually happens: "error 42501 — refused before any trigger is consulted: `authenticated` holds no UPDATE/TRUNCATE on `wallet_ledger`". **A different property** (the grant layer), true and measurable. `.321` would then be the suite's only client TRUNCATE-privilege probe on the ledger |
| Alternative B | leave both `not_measured`, and let `.320`/`.322` carry the trigger's evidence |
| Checked | as alice: UPDATE → 42501 *permission denied for table wallet_ledger*; TRUNCATE → the same. As the server (`.320`'s path): UPDATE → 42501 *wallet_ledger is append-only; record a correcting entry instead*, raised in `guard_ledger_append_only()` |
| Manifest | A: 2 `expected` corrections. B: none |

### C2-fk-before-truncate-trigger — `F9.public_wallets.322` (server-side TRUNCATE)

| | |
|---|---|
| Intended property | the ledger cannot be emptied even from the server side: `wallet_ledger_deny_truncate` refuses every role |
| What answers first | the foreign-key check. Four keys reference `wallet_ledger` (`career_progress.reward_ledger_id`, `daily_entries.reward_ledger_id`, `tournament_entries.entry_ledger_id` and `.prize_ledger_id`); TRUNCATE of a referenced table fails with 0A000 before BEFORE TRUNCATE triggers fire |
| Naive harness | "error" → **effective**, crediting the trigger for the foreign key's refusal |
| Now | `not_measured` |
| Alternative A | `truncate public.wallet_ledger cascade`. With CASCADE the foreign keys no longer refuse, and the named table's own BEFORE TRUNCATE trigger fires first. **Same property.** If the trigger were ever absent, the statement would empty the ledger and its referencing tables in the disposable database; rebuild isolation restores them and the record would correctly say *deficient* |
| Alternative B | restate as the 0A000 refusal — a different and incidental property (the referencing keys), not a control anyone designed for this |
| Alternative C | leave `not_measured` |
| Checked | as the server: approved form → 0A000 *cannot truncate a table referenced in a foreign key constraint*; with CASCADE → 42501 *table public.wallet_ledger may not be truncated; its history is append-only*, raised in `deny_truncate()`; the ledger still held its 5 rows |
| Manifest | A: 1 `operation` correction |

### C2-definer-bypasses-named-policy — `F5.send_friend_request.259`

| | |
|---|---|
| Intended property | a friend request cannot be sent across a block |
| Approved expectation | "refusal — `friend_requests_insert_as_sender` requires NOT viewer_has_blocked(receiver_id)" — names an RLS policy |
| What answers first | the function body. `send_friend_request` is SECURITY DEFINER, so the caller's policies never apply to its insert; before inserting, it raises PT404 *no such player* when `is_blocked_between(caller, receiver)` |
| Naive harness | "refusal" → **effective, attributed to the wrong control** (the policy was never consulted) |
| Now | `not_measured` |
| Smallest alternative | restate the mechanism: "refusal — the function body refuses with PT404 'no such player' because `is_blocked_between(caller, receiver)`". The refusal the property needs is unchanged; only the control named changes |
| Same property? | **Yes** (a request across a block is refused) — mechanism attribution corrected |
| Checked | the targeted smoke of 2026-09-23 observed PT404 from the body (D3.49) |
| Manifest | 1 `expected` correction (and its claim template) |
| Note | the policy is still exercised directly by `F3.058` (a client INSERT naming another sender). Whether its block term (`NOT viewer_has_blocked`) is ever reached from a client is not in the matrix |

### C3-sender-cannot-accept — `F3.public_friend_requests.059` (positive) · *purely mechanical*

| | |
|---|---|
| Intended property | the WITH CHECK of `friend_requests_update_participants` admits a participant's legitimate update, and the row stays attributed to them |
| Approved probe | alice, the **sender**, sets `status = 'accepted'` |
| What answers first | `guard_friend_request_transition`: only the receiver may accept (42501), a BEFORE trigger that runs before WITH CHECK |
| Naive harness | a positive expecting "1 row affected" → **deficient**, a false finding against a trigger working as designed |
| Now | `not_measured` |
| Smallest alternative | `'cancelled'` — the one transition a sender may make |
| Same property? | **Yes** |
| Checked | as alice → 1 row affected; the row is still hers (sender alice, receiver erin), status `cancelled` |
| Manifest | 1 `operation` correction |

### C3-username-literal-invalid — `F3.public_profiles.151`, `F6.public_profiles.153` (positives) · *purely mechanical*

| | |
|---|---|
| Intended property | the caller may update a granted column of their own profile |
| Approved probe | `set username = 'attest-probe-username'` |
| What answers first | the BEFORE UPDATE trigger `guard_profile_username` (23514 *reserved or not permitted*, via `username_is_permitted()`); `profiles_username_check` would refuse it independently. *(The registration first named only the CHECK constraint; corrected 2026-09-24, D3.52)* |
| Naive harness | **deficient** — a false finding |
| Now | `not_measured` × 2 |
| Smallest alternative | `'attest_probe_user'` |
| Same property? | **Yes** |
| Checked | as alice → 1 row affected. The trigger also spends alice's one `profile_username_change` rate-limit event per 30 days; each positive runs on its own rebuilt baseline, so the two do not share it |
| Manifest | 2 `operation` corrections |

### C3-cosmetic-literal-invalid — `F6.public_loadouts.117` (positive) · *purely mechanical*

| | |
|---|---|
| Intended property | a granted column (`avatar_cosmetic_id`) on the caller's own loadout is updatable |
| Approved literal | a uuid that is no cosmetic → `guard_loadout_slots` raises 23503 first |
| Naive harness | **deficient** — a false finding |
| Smallest alternative | **NULL** (unequip), or a cosmetic alice owns (`avatar-house-dealer`) |
| Same property? | **Yes** |
| Checked | as alice: NULL → 1 row; the owned cosmetic → 1 row |
| Manifest | 1 `operation` correction |

### C4-anon-has-no-execute — `F5.latest_verifiable_daily_challenge.278`

| | |
|---|---|
| Intended property | the function never returns a seed for a challenge that has not been revealed (its `where revealed_seed is not null` is the whole control) |
| Approved probe | as **anon** → "exactly the revealed challenge is returned …" |
| What answers first | the EXECUTE privilege. Arc21's migration `20260903130000_daily_seed_reveal.sql` explicitly `revoke execute … from public, anon` and grants it to `authenticated`. The approved row's premise — "deliberately callable without an account" — was **Attest's planning misreading** of "does not read `auth.uid()`" (D3.52), not an Arc21 inconsistency |
| Naive harness | an error where rows were expected → **deficient**, although the control of interest never ran |
| Now | `not_measured` |
| Alternative A | run as a signed-in caller (alice). **Same property** — the body does not read `auth.uid()`, so the filter is identity-independent. Changes `identity` and `operation`; the intent draft's actor changes to "a signed-in player" and comes back to you |
| Alternative B | keep anon and restate as "error 42501". **A different property** (who may call), and it is Arc21's explicit design — but then the revealed-only filter goes unmeasured |
| Checked | as anon → 42501 *permission denied for function*; as alice → one row, the revealed challenge of 2026-09-23, and not today's open one |
| Manifest | A: `identity` + `operation`. B: `expected` |

### C5-deleted-user-subject-empty — 14 deleted-user boundary rows

See §5 for the row-by-row analysis.

| | |
|---|---|
| Intended property | the approved rationale: *"A token outliving its account must not become a key to whatever the cascade left behind"* |
| Approved probe | dave is deleted through Arc21's own `delete_own_account()` (as dave), then his still-valid token selects `where <owner column> = dave` |
| Why unmeasurable | every one of the 14 filter columns is `ON DELETE CASCADE` or `SET NULL`: after a genuine deletion **no row can name dave**, so "no data" is produced by referential actions, never by a control evaluating the stale identity. `.323` and `.336` also contradict "and no error": `authenticated` holds no privilege on `private.game_commands` or `rate_limit_events` |
| Naive harness | 14 × **effective** "no data" — assurance manufactured by the empty set |
| Now | `not_measured` × 14 |
| Alternative A | **retarget the three session-scoped rows** (`.331` events, `.332` seats, `.333` sessions) at what the deletion actually leaves behind. A new probe-scoped fixture seats dave with status `left` at `fixtures.session` (which `delete_own_account()` permits), Arc21 deletes him, and his stale token then reads that session's rows. **Same property.** The other 11 stay `not_measured`: for CASCADE tables nothing is left behind, by Arc21's design ("Everything personal cascades from here") |
| Alternative B | keep all 14 `not_measured` |
| Alternative C | re-describe the CASCADE rows as characterization ("nothing remains keyed to the account") — changes polarity and so the frozen 63/240/42 counts. Not recommended without a strong reason |
| Checked (A) | before deletion, live dave read 3 seats, the session row and 1 public event of that session; after `delete_own_account()`, his stale token read 0 of each; his seat survived with `user_id` NULL and the name "Deleted player" |
| Manifest | A: `operation` + `fixture` of 3 rows, plus a new probe-scoped requirement |

---

## 3. `F5.delete_own_account.283` — what its expectation means

**The question the row asks.** `delete_own_account()` is in the planner's caller-scoped group, whose
approved expectation is *"only alice's own rows are returned or altered; no bob or carol row
appears in the result or changes"*. Its approved `covers` says the function "has no shared or
global effect … Verified against its body".

**What the body says.** It has four documented cross-account effects, each commented in Arc21's
own migration:

1. it stands the caller up from every lobby **through `leave_room`**, which *"migrates the host to
   the longest-joined remaining member and closes the room only when nobody is left, which is
   exactly what should happen when a host deletes their account"*;
2. it cancels **other players'** queue entries that point at a room it hosts;
3. it deletes **other players'** notifications about the account (a name left behind, a dead link);
4. it anonymises the caller's seats in shared game history ("Deleted player").

So the `covers` claim is false for this function, and the literal expectation prohibits documented
behaviour.

**What was observed** (smoke, NOT evidence, D3.49). With alice stood up by the probe's own setup —
Arc21's active-seat rule satisfied, not weakened — the deletion ran; every claim was met except the
guard, and the **only** row naming bob or carol that changed was `public.rooms` ATSTAB, the lobby
alice hosted, whose `host_user_id` became bob.

**Is the handover an unauthorized cross-user mutation?** The evidence supports all of these
readings, which is why it is yours:

- *intended cleanup* — documented, deliberate, and the alternative (the lobby deleted under the
  players still in it) was a bug Arc21 fixed;
- *legitimate but security-relevant* — it confers host powers (removing members, closing the room)
  on another account, without that account's action, as a side effect of the caller's;
- *what the literal claim forbids* — "no bob or carol row … changes".

**Options** (none chosen):

| | Change | Consequence |
|---|---|---|
| **(a)** Restate with a carve-out | *"… no bob or carol row … changes, other than the documented handover of a lobby alice hosted to its longest-joined remaining member"* | The guard permits exactly that one transition and still fails on any other cross-account change. `expected` changes, with its claim template |
| **(b)** Keep the literal expectation | none | The run records `deficient` for `.283` against designed behaviour; WP5 weighs it (a finding may be *accepted / design-intent*) |
| **(c)** Reclassify the function | move it out of the caller-scoped group with its own invariant permitting all four documented effects | The most accurate; changes `covers` and `expected`, and the guard |
| (d) Register as a contradiction | — | **Not recommended**: the claim is measurable and was measured; `not_measured` would hide a real observation |

The intent draft for `.283` is category C: it states the literal claim, and will be regenerated to
match what you choose.

---

## 4. *(optional)* `F5.register_push_token.269` — the approved `covers` wording

The approved `covers` says taking over another account's token string "would redirect their
notifications to the caller's device". The body (`on conflict (token) do update set user_id = v_me`)
reassigns the row; the token still addresses the victim's device. The consequence is the reverse:
the victim's device stops receiving the victim's notifications and starts receiving the caller's.
`covers` feeds no evaluator, so execution is unaffected either way. **Correct the wording** (one
frozen `covers` field), or **leave it** and let WP5 note the discrepancy.

---

## 5. The deleted-user boundary, row by row (§2 C5)

`probe:dave_deleted` deletes dave through Arc21's own `delete_own_account()`, called as dave, then
each probe runs with dave's still-valid claims. In the baseline dave holds no seat and hosts
nothing.

| Test ID | Reads | Filter column → on delete | After deletion | A real target survives? | Same-property alternative |
|---|---|---|---|---|---|
| `B.private_game_commands.323` | `private.game_commands` | `user_id` → CASCADE | gone; and no client privilege on `private` | no | none (and "no error" is false by privilege) |
| `B.public_blocks.325` | `blocks` | `blocker_id` → CASCADE (`blocked_id` too) | gone | no | none |
| `B.public_friend_requests.327` | `friend_requests` | `sender_id` → CASCADE (`receiver_id` too) | gone | no | none |
| `B.public_friendships.329` | `friendships` | `user_id_a` → CASCADE (`user_id_b` too) | gone | no | none |
| `B.public_game_events.331` | `game_events` | `recipient_user_id` → CASCADE | events *addressed to* dave gone; the session's public events survive | **yes**, if dave sat at the session | **A**: read the session's events with the stale token (checked: 1 → 0) |
| `B.public_game_session_seats.332` | `game_session_seats` | `user_id` → **SET NULL** | dave's seat survives, `user_id` NULL, name "Deleted player" | **yes**, if dave sat at the session | **A**: read the session's seats (checked: 3 → 0) |
| `B.public_game_sessions.333` | `game_sessions` | `host_user_id` → **SET NULL** | a session dave hosted survives, host NULL; a session he sat at survives unchanged | **yes** | **A**: read the session he sat at (checked: 1 → 0) |
| `B.public_profiles.335` | `profiles` | `id` → CASCADE (from `auth.users`) | gone | no | none |
| `B.public_rate_limit_events.336` | `rate_limit_events` | `user_id` → CASCADE | gone; and no client privilege | no | none (and "no error" is false by privilege) |
| `B.public_room_members.337` | `room_members` | `user_id` → CASCADE | gone | no | none |
| `B.public_rooms.338` | `rooms` | `host_user_id` → CASCADE, after `leave_room` hands the lobby on | gone or handed over | no | none |
| `B.public_tournament_entries.340` | `tournament_entries` | `user_id` → CASCADE | gone | no | none |
| `B.public_wallet_ledger.342` | `wallet_ledger` | `user_id` → CASCADE | gone | no | none |
| `B.public_wallets.344` | `wallets` | `user_id` → CASCADE | gone | no | none |

Why the alternative is honest and not manufactured: the premise is shown first (the *live* account
could read those rows), the deletion is Arc21's own, referential integrity is untouched, and what
refuses the stale token is the participation policy evaluating the stale identity
(`is_session_participant` checks `seat.user_id = auth.uid()`, and the seat no longer names him).
Empty-by-construction results are never counted as evidence of authorization.

---

## 6. The three smoke candidates (NOT WP3 results)

Observed in the targeted smoke of 2026-09-23 (`.smoke/`, every record stamped `NOT_WP3_EVIDENCE`).
No severity, no vulnerability label, no remediation, no verdict. Each becomes reportable only if
the official run supports it.

| Test ID | Smoke observation | Mechanism in the source | Property the row protects | Plausible design explanation | What the real run must show |
|---|---|---|---|---|---|
| `F5.register_push_token.269` | after alice called `register_push_token('ExponentPushToken[attest-bob]', 'ios')`, no row for that token belonged to bob; one belonged to alice | SECURITY DEFINER; `on conflict (token) do update set user_id = v_me` — the caller's policies never apply | a caller cannot take over a device registration that belongs to another account | a push token identifies a *device*; when a different account signs in on the same device, the registration should follow the signed-in account (last writer wins). The exposure exists only for a caller who already knows another device's token string, which RLS keeps from clients | the state guards on the official run: does bob's row still exist with `user_id = bob` afterwards? |
| `F5.leaderboard_weekly_xp.271` | the board returned "Erin", an account whose privacy is `private`, among 3 rows | the leaderboard's projection does not consult `profiles.privacy` | a private-privacy account's identity does not appear on a cross-account board | Arc21 may regard leaderboard appearance as separate from profile privacy (opting out of profile visibility, not of rankings). Nothing in the repository says which | whether the official run's result contains the private account's identity |
| `F5.delete_own_account.283` | the lobby alice hosted was handed to bob; nothing else naming bob or carol changed | `delete_own_account` → `leave_room` host migration | the caller's deletion does not delete or alter other accounts' data | documented cleanup (§3) | the guard on the official run; its meaning depends on §3 |

---

## 7. How to answer

Either reply in conversation — for example:

```
Intents: A approve as written; B approve as written; C decide after the contradictions.
Replace F1.public_wallets.237 with: "…".
C2-client-guard: where true. C3-tier: casual. C2-grant-before-trigger: A. C2-fk-truncate: A.
C2-definer: restate. C3-sender: cancelled. C3-username: attest_probe_user. C3-cosmetic: NULL.
C4: A. C5: A. D-283: (a). O-269: correct.
```

— or fill in `rubric/wp3-gate-a-decisions.json` (every value is `pending`). Attest records a
conversational answer in that file with `recordedFrom` naming the reply, and records nothing you
did not decide.

## 8. Operational note — the shared local database

Attest and your main Arc21 checkout (`~/arc21`) share one local Supabase project (`arc21`). On
2026-09-24 the database held your development state — the `20260915120000_pseudonymous_players`
migration and two development accounts. **It was backed up before Attest rebuilt it**:
`.local-backups/arc21-shared-stack-before-wp3-20260924-172900.dump` (`pg_dump -Fc`, gitignored,
verified restorable). The WP3 run rebuilds that database about 60 times over roughly 40–50
minutes; please do not use the local stack for development while it runs — a write made mid-run
is caught by the baseline verification and aborts the run (D3.50).
