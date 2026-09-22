# AUTHOR INTENT — batch 8 of 13

**F4 (26–40 of 40)** · 15 rows · run `20260922T071548Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F4.public_player_stats.144`

| | |
|---|---|
| Control | `public.player_stats#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_stats |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F4.public_profiles.152`

| | |
|---|---|
| Control | `public.profiles#anon-reach` |
| Runs as | anon |
| Operation | select from public.profiles |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F4.public_push_tokens.163`

| | |
|---|---|
| Control | `public.push_tokens#anon-reach` |
| Runs as | anon |
| Operation | select from public.push_tokens |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F4.public_rate_limit_events.169`

| | |
|---|---|
| Control | `public.rate_limit_events#anon-reach` |
| Runs as | anon |
| Operation | select from public.rate_limit_events |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 5. `F4.public_rate_limit_policies.178`

| | |
|---|---|
| Control | `public.rate_limit_policies#anon-reach` |
| Runs as | anon |
| Operation | select from public.rate_limit_policies |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 6. `F4.public_room_members.186`

| | |
|---|---|
| Control | `public.room_members#anon-reach` |
| Runs as | anon |
| Operation | select from public.room_members |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 7. `F4.public_rooms.194`

| | |
|---|---|
| Control | `public.rooms#anon-reach` |
| Runs as | anon |
| Operation | select from public.rooms |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 8. `F4.public_rulesets.201`

| | |
|---|---|
| Control | `public.rulesets#policy:rulesets_select_active` |
| Runs as | anon |
| Operation | select from public.rulesets for the seeded row where is_active = false |
| Expected safe result | no data — rulesets_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of rulesets_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 9. `F4.public_tournament_entries.209`

| | |
|---|---|
| Control | `public.tournament_entries#anon-reach` |
| Runs as | anon |
| Operation | select from public.tournament_entries |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 10. `F4.public_tournament_matches.217`

| | |
|---|---|
| Control | `public.tournament_matches#anon-reach` |
| Runs as | anon |
| Operation | select from public.tournament_matches |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 11. `F4.public_tournaments.221`

| | |
|---|---|
| Control | `public.tournaments#policy:tournaments_select_all` |
| Runs as | anon |
| Operation | select from public.tournaments for the seeded row where status = 'cancelled' |
| Expected safe result | no data — tournaments_select_all USING is `status <> 'cancelled'`, which that row does not satisfy |
| Covers | the unsatisfied branch of tournaments_select_all. The predicate is exactly `status <> 'cancelled'` and the fixture sets status = 'cancelled' |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 12. `F4.public_user_cosmetics.224`

| | |
|---|---|
| Control | `public.user_cosmetics#anon-reach` |
| Runs as | anon |
| Operation | select from public.user_cosmetics |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 13. `F4.public_wallet_ledger.230`

| | |
|---|---|
| Control | `public.wallet_ledger#anon-reach` |
| Runs as | anon |
| Operation | select from public.wallet_ledger |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 14. `F4.public_wallets.241`

| | |
|---|---|
| Control | `public.wallets#anon-reach` |
| Runs as | anon |
| Operation | select from public.wallets |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 15. `F4.realtime_messages.244`

| | |
|---|---|
| Control | `realtime.messages#anon-reach` |
| Runs as | anon |
| Operation | select from realtime.messages |
| Expected safe result | no data — a grant exists but no policy names anon, so row security refuses every row |
| Covers | the latent anonymous grant recorded in WP2: this probe is what shows the policy set is the only thing denying it |

> If a signed-out caller could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
