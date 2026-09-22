# AUTHOR INTENT — batch 4 of 13

**F2 (26–50 of 58)** · 25 rows · run `20260922T071548Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F2.public_hand_records.105`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.hand_records set dealer_total = 1 |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F2.public_hand_records.106`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.hand_records |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F2.public_loadouts.113`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_update_own` |
| Runs as | authenticated:alice |
| Operation | update public.loadouts where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of loadouts_update_own (UPDATE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F2.public_notifications.125`

| | |
|---|---|
| Control | `public.notifications#policy:notifications_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.notifications where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of notifications_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 5. `F2.public_profiles.150`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_update_self` |
| Runs as | authenticated:alice |
| Operation | update public.profiles where id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of profiles_update_self (UPDATE) falsified. The predicate keys on id, and the fixture names bob there instead of alice |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 6. `F2.public_push_tokens.160`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.push_tokens where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of push_tokens_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 7. `F2.public_rate_limit_events.166`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_events (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 8. `F2.public_rate_limit_events.167`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_events set occurred_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 9. `F2.public_rate_limit_events.168`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_events |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 10. `F2.public_rate_limit_policies.175`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_policies (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 11. `F2.public_rate_limit_policies.176`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_policies set rationale = 'attest-probe-rationale' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 12. `F2.public_rate_limit_policies.177`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_policies |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 13. `F2.public_room_members.183`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.room_members (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 14. `F2.public_room_members.184`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.room_members set last_seen_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 15. `F2.public_room_members.185`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.room_members |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 16. `F2.public_rooms.191`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rooms (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 17. `F2.public_rooms.192`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rooms set ruleset_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 18. `F2.public_rooms.193`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rooms |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 19. `F2.public_rulesets.197`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rulesets (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 20. `F2.public_rulesets.198`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rulesets set description = 'attest-probe-description' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 21. `F2.public_rulesets.199`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rulesets |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 22. `F2.public_tournament_entries.206`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_entries (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 23. `F2.public_tournament_entries.207`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.tournament_entries set bracket_seed = 1 |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 24. `F2.public_tournament_entries.208`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.tournament_entries |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 25. `F2.public_tournament_matches.214`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_matches (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
