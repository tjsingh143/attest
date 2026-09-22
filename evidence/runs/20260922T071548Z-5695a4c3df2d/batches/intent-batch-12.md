# AUTHOR INTENT — batch 12 of 13

**F6 + F8 + F9 + F10** · 29 rows · run `20260922T071548Z-5695a4c3df2d`

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

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F6.public_friend_requests.062`

| | |
|---|---|
| Control | `public.friend_requests#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.friend_requests set id = '00000000-0000-4000-8000-0000000000ff' where receiver_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, sender_id, receiver_id, created_at, …) |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F6.public_loadouts.118`

| | |
|---|---|
| Control | `public.loadouts#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.loadouts set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, created_at, updated_at) |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F6.public_notifications.129`

| | |
|---|---|
| Control | `public.notifications#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.notifications set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, kind, title, …) |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 5. `F6.public_profiles.154`

| | |
|---|---|
| Control | `public.profiles#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.profiles set id = '00000000-0000-4000-8000-0000000000ff' where id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, level, xp, username_changed_at, …) |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 6. `F6.public_push_tokens.165`

| | |
|---|---|
| Control | `public.push_tokens#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.push_tokens set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, token, platform, …) |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 7. `F8.realtime_messages.308`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_game_topic_is_for_its_seated_players` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to fixtures.session.topic, then select from realtime.messages |
| Expected safe result | no data — carol holds no seat at that game |
| Covers | the EXISTS branch unsatisfied: the seeded non-participant. This is why the seed seats two of three accounts. Both drivers are falsified — the seat subquery finds no row for carol, and the sibling permissive policy arc21_presence_roster_needs_an_account is falsified too because realtime.topic() is the game topic and not 'presence:players', so the refusal reflects effective authorization across both policies |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 8. `F8.realtime_messages.310`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_presence_roster_needs_an_account` |
| Runs as | anon |
| Operation | set realtime.topic to fixtures.presenceTopic, then select from realtime.messages |
| Expected safe result | no data — no policy on realtime.messages names anon |
| Covers | the presence read branch for a signed-out socket, exercising the latent anon grant. realtime.topic() matches this policy's predicate exactly, so the refusal is not the predicate failing — it is that neither this policy nor the sibling arc21_game_topic_is_for_its_seated_players names anon, which is effective authorization across both permissive policies |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 9. `F8.realtime_messages.312`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to the game topic, then insert into realtime.messages |
| Expected safe result | error 42501 — no insert policy admits a game topic |
| Covers | the WITH CHECK branch unsatisfied: the fabricated-state injection Arc21 measured against a running stack before these policies existed |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 10. `F8i.realtime_messages.314`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | subscribe to that same private channel fixtures.session.topic using fixtures.carolJwt, who holds no seat |
| Expected safe result | the subscription is refused, or is accepted and delivers nothing; carol's client must receive no game payload |
| Covers | the brief's family 8 question in its literal form — can a client subscribe to another user's channel — exercised through the socket rather than through SQL |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 11. `F8i.realtime_messages.315`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | publish a `state` broadcast to fixtures.session.topic over the websocket as carol |
| Expected safe result | refused; no other subscriber receives a carol-originated state message |
| Covers | the fabricated-state injection Arc21 measured against a running stack before these policies existed, retested at the layer where it actually happened |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 12. `F9.public_wallets.317`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta, same key twice) |
| Operation | call apply_wallet_delta twice with the SAME idempotency key |
| Expected safe result | exactly one ledger row and one balance movement — the second call is a no-op, not a second credit |
| Covers | the retry path: Arc21's invariant is that retries cannot debit or credit twice. This is the control private.game_commands and the ledger's unique idempotency key exist to provide |

> If the server itself could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 13. `F9.public_wallets.318`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta over-debit) |
| Operation | call apply_wallet_delta with a debit larger than the balance |
| Expected safe result | refusal — balances stay non-negative (a CHECK constraint violation, SQLSTATE 23514) |
| Covers | the non-negative-balance invariant, which is enforced as a database constraint rather than in application code |

> If the server itself could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 14. `F9.public_wallets.319`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — UPDATE is rejected by wallet_ledger_append_only |
| Covers | append-only enforcement on the economy history, exercised as an ordinary client. The ledger is the authoritative source wallets.balance is recomputed from, which is why WP2 rated its reversibility High |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 15. `F9.public_wallets.320`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — the trigger raises for every role, not only client roles |
| Covers | the same statement from the SERVER side. A separate Test ID because it is a separate identity and a materially different claim: the guard is not merely a client-role check but applies to the privileged path too, which is what makes the ledger authoritative |

> If the server itself could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 16. `F9.public_wallets.321`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | truncate public.wallet_ledger |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | TRUNCATE is not reachable through a row policy at all, so a trigger is the only thing that can refuse it. Exercised as an ordinary client |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 17. `F9.public_wallets.322`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | truncate public.wallet_ledger |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | the same TRUNCATE from the SERVER side, as its own Test ID for the same reason as the UPDATE pair above |

> If the server itself could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 18. `F10.private_game_commands.013`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 19. `F10.private_game_commands.014`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 20. `F10.private_game_commands.015`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 21. `F10.public_game_events.080`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 22. `F10.public_game_events.081`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 23. `F10.public_game_events.082`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 24. `F10.public_rate_limit_events.172`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 25. `F10.public_rate_limit_events.173`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 26. `F10.public_rate_limit_events.174`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 27. `F10.public_wallet_ledger.233`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 28. `F10.public_wallet_ledger.234`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 29. `F10.public_wallet_ledger.235`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
