# AUTHOR INTENT — batch 12 of 13

**F6 + F8 + F9 + F10** · 29 rows · run `20260926T202017Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 29 proposed sentences in this file were written by the
> harness, not by the author, and 29 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F6.public_daily_challenges.046`

| | |
|---|---|
| Control | `public.daily_challenges#colgrant:SELECT` |
| Runs as | authenticated:alice |
| Operation | SELECT seed_secret from public.daily_challenges |
| Expected safe result | error 42501 — no column-level SELECT privilege on that column |
| Covers | the confidentiality boundary INSIDE a readable row: seed_secret is excluded from every client SELECT grant. A row-level check cannot see this, and a table-level one cannot either |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player reads seed_secret out of a public.daily_challenges row they are otherwise entitled to see, taking a column that is withheld from every client grant even where the row itself is permitted.

**AUTHOR INTENT:** A signed-in player reads seed_secret out of a public.daily_challenges row they are otherwise entitled to see, taking a column that is withheld from every client grant even where the row itself is permitted.

#### 2. `F6.public_friend_requests.062`

| | |
|---|---|
| Control | `public.friend_requests#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.friend_requests set id = '00000000-0000-4000-8000-0000000000ff' where receiver_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, sender_id, receiver_id, created_at, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes id on a friend request addressed to them, reaching a column the client update grant deliberately excludes — they may answer the request, not rewrite it.

**AUTHOR INTENT:** A signed-in player writes id on a friend request addressed to them, reaching a column the client update grant deliberately excludes — they may answer the request, not rewrite it.

#### 3. `F6.public_loadouts.118`

| | |
|---|---|
| Control | `public.loadouts#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.loadouts set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, created_at, updated_at) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes id on a public.loadouts row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** A signed-in player writes id on a public.loadouts row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

#### 4. `F6.public_notifications.129`

| | |
|---|---|
| Control | `public.notifications#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.notifications set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, kind, title, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes id on a public.notifications row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** A signed-in player writes id on a public.notifications row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

#### 5. `F6.public_profiles.154`

| | |
|---|---|
| Control | `public.profiles#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.profiles set id = '00000000-0000-4000-8000-0000000000ff' where id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, level, xp, username_changed_at, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes id on a public.profiles row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** A signed-in player writes id on a public.profiles row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

#### 6. `F6.public_push_tokens.165`

| | |
|---|---|
| Control | `public.push_tokens#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.push_tokens set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, token, platform, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes id on a public.push_tokens row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** A signed-in player writes id on a public.push_tokens row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

#### 7. `F8.realtime_messages.308`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_game_topic_is_for_its_seated_players` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to fixtures.session.topic, then select from realtime.messages |
| Expected safe result | no data — carol holds no seat at that game |
| Covers | the EXISTS branch unsatisfied: the seeded non-participant. This is why the seed seats two of three accounts. Both drivers are falsified — the seat subquery finds no row for carol, and the sibling permissive policy arc21_presence_roster_needs_an_account is falsified too because realtime.topic() is the game topic and not 'presence:players', so the refusal reflects effective authorization across both policies |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player who holds no seat at a table reads that table's Realtime game topic directly at the SQL layer, obtaining broadcasts meant only for its seated players.

**AUTHOR INTENT:** A signed-in player who holds no seat at a table reads that table's Realtime game topic directly at the SQL layer, obtaining broadcasts meant only for its seated players.

#### 8. `F8.realtime_messages.310`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_presence_roster_needs_an_account` |
| Runs as | anon |
| Operation | set realtime.topic to fixtures.presenceTopic, then select from realtime.messages |
| Expected safe result | no data — no policy on realtime.messages names anon |
| Covers | the presence read branch for a signed-out socket, exercising the latent anon grant. realtime.topic() matches this policy's predicate exactly, so the refusal is not the predicate failing — it is that neither this policy nor the sibling arc21_game_topic_is_for_its_seated_players names anon, which is effective authorization across both permissive policies |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Someone with no account reads the presence roster straight from realtime.messages at the SQL layer, relying on the anonymous grant that reaches the table although no policy names anon.

**AUTHOR INTENT:** Someone with no account reads the presence roster straight from realtime.messages at the SQL layer, relying on the anonymous grant that reaches the table although no policy names anon.

#### 9. `F8.realtime_messages.312`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to the game topic, then insert into realtime.messages |
| Expected safe result | error 42501 — no insert policy admits a game topic |
| Covers | the WITH CHECK branch unsatisfied: the fabricated-state injection Arc21 measured against a running stack before these policies existed |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes a message onto a game topic at the SQL layer, injecting fabricated state into a channel that no client, seated or not, is admitted to write.

**AUTHOR INTENT:** A signed-in player writes a message onto a game topic at the SQL layer, injecting fabricated state into a channel that no client, seated or not, is admitted to write.

#### 10. `F8i.realtime_messages.314`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | subscribe to that same private channel fixtures.session.topic using fixtures.carolJwt, who holds no seat |
| Expected safe result | the subscription is refused, or is accepted and delivers nothing; carol's client must receive no game payload |
| Covers | the brief's family 8 question in its literal form — can a client subscribe to another user's channel — exercised through the socket rather than through SQL |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player who holds no seat at a table subscribes to that table's private Realtime channel through a real websocket client and receives the game's live payloads.

**AUTHOR INTENT:** A signed-in player who holds no seat at a table subscribes to that table's private Realtime channel through a real websocket client and receives the game's live payloads.

#### 11. `F8i.realtime_messages.315`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | publish a `state` broadcast to fixtures.session.topic over the websocket as carol |
| Expected safe result | refused; no other subscriber receives a carol-originated state message |
| Covers | the fabricated-state injection Arc21 measured against a running stack before these policies existed, retested at the layer where it actually happened |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player publishes a fabricated game-state broadcast onto a table's private Realtime channel through a real websocket client — a channel only the server may broadcast on — so the players there act on a message the server never sent.

**AUTHOR INTENT:** A signed-in player publishes a fabricated game-state broadcast onto a table's private Realtime channel through a real websocket client — a channel only the server may broadcast on — so the players there act on a message the server never sent.

#### 12. `F9.public_wallets.317`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta, same key twice) |
| Operation | call apply_wallet_delta twice with the SAME idempotency key |
| Expected safe result | exactly one ledger row and one balance movement — the second call is a no-op, not a second credit |
| Covers | the retry path: Arc21's invariant is that retries cannot debit or credit twice. This is the control private.game_commands and the ledger's unique idempotency key exist to provide |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A retry on the server's own chip-movement path is applied twice under one idempotency key, so a single credit or debit lands on the balance two times.

**AUTHOR INTENT:** A retry on the server's own chip-movement path is applied twice under one idempotency key, so a single credit or debit lands on the balance two times.

#### 13. `F9.public_wallets.318`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta over-debit) |
| Operation | call apply_wallet_delta with a debit larger than the balance |
| Expected safe result | refusal — balances stay non-negative (a CHECK constraint violation, SQLSTATE 23514) |
| Covers | the non-negative-balance invariant, which is enforced as a database constraint rather than in application code |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A debit larger than the balance is pushed through the server's chip-movement path and drives an account negative, manufacturing value the economy never issued.

**AUTHOR INTENT:** A debit larger than the balance is pushed through the server's chip-movement path and drives an account negative, manufacturing value the economy never issued.

#### 14. `F9.public_wallets.319`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — UPDATE is rejected by wallet_ledger_append_only |
| Covers | append-only enforcement on the economy history, exercised as an ordinary client. The ledger is the authoritative source wallets.balance is recomputed from, which is why WP2 rated its reversibility High |
| Pending author decision | registered contradiction `C2-grant-before-trigger`: the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player rewrites a settled entry in their own chip ledger, altering the authoritative history their balance is derived from.

**AUTHOR INTENT:** A signed-in player rewrites a settled entry in their own chip ledger, altering the authoritative history their balance is derived from.

#### 15. `F9.public_wallets.320`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — the trigger raises for every role, not only client roles |
| Covers | the same statement from the SERVER side. A separate Test ID because it is a separate identity and a materially different claim: the guard is not merely a client-role check but applies to the privileged path too, which is what makes the ledger authoritative |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> The server's own privileged connection rewrites a settled ledger entry, treating the append-only economy history as editable from the trusted side.

**AUTHOR INTENT:** The server's own privileged connection rewrites a settled ledger entry, treating the append-only economy history as editable from the trusted side.

#### 16. `F9.public_wallets.321`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | truncate public.wallet_ledger |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | TRUNCATE is not reachable through a row policy at all, so a trigger is the only thing that can refuse it. Exercised as an ordinary client |
| Pending author decision | registered contradiction `C2-grant-before-trigger`: the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player empties the chip ledger with a TRUNCATE, which no row policy can refuse, destroying the economy's authoritative history.

**AUTHOR INTENT:** A signed-in player empties the chip ledger with a TRUNCATE, which no row policy can refuse, destroying the economy's authoritative history.

#### 17. `F9.public_wallets.322`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | truncate public.wallet_ledger cascade |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | the same TRUNCATE from the SERVER side, as its own Test ID for the same reason as the UPDATE pair above |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> The server's own privileged connection empties the chip ledger, destroying the authoritative history every balance is recomputed from.

**AUTHOR INTENT:** The server's own privileged connection empties the chip ledger, destroying the authoritative history every balance is recomputed from.

#### 18. `F10.private_game_commands.013`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player edits the accepted-command trail so it reports something other than what actually happened.

**AUTHOR INTENT:** A signed-in player edits the accepted-command trail so it reports something other than what actually happened.

#### 19. `F10.private_game_commands.014`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player deletes entries from the accepted-command trail to remove the trace of something they did.

**AUTHOR INTENT:** A signed-in player deletes entries from the accepted-command trail to remove the trace of something they did.

#### 20. `F10.private_game_commands.015`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player wipes out the accepted-command trail, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** A signed-in player wipes out the accepted-command trail, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

#### 21. `F10.public_game_events.080`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player edits the delivered event stream so it reports something other than what actually happened.

**AUTHOR INTENT:** A signed-in player edits the delivered event stream so it reports something other than what actually happened.

#### 22. `F10.public_game_events.081`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player deletes entries from the delivered event stream to remove the trace of something they did.

**AUTHOR INTENT:** A signed-in player deletes entries from the delivered event stream to remove the trace of something they did.

#### 23. `F10.public_game_events.082`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player wipes out the delivered event stream, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** A signed-in player wipes out the delivered event stream, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

#### 24. `F10.public_rate_limit_events.172`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player edits the trail of attempts an account has already made so it reports something other than what actually happened.

**AUTHOR INTENT:** A signed-in player edits the trail of attempts an account has already made so it reports something other than what actually happened.

#### 25. `F10.public_rate_limit_events.173`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player deletes entries from the trail of attempts an account has already made to remove the trace of something they did.

**AUTHOR INTENT:** A signed-in player deletes entries from the trail of attempts an account has already made to remove the trace of something they did.

#### 26. `F10.public_rate_limit_events.174`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player wipes out the trail of attempts an account has already made, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** A signed-in player wipes out the trail of attempts an account has already made, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

#### 27. `F10.public_wallet_ledger.233`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player edits the chip ledger so it reports something other than what actually happened.

**AUTHOR INTENT:** A signed-in player edits the chip ledger so it reports something other than what actually happened.

#### 28. `F10.public_wallet_ledger.234`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player deletes entries from the chip ledger to remove the trace of something they did.

**AUTHOR INTENT:** A signed-in player deletes entries from the chip ledger to remove the trace of something they did.

#### 29. `F10.public_wallet_ledger.235`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player wipes out the chip ledger, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** A signed-in player wipes out the chip ledger, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.
