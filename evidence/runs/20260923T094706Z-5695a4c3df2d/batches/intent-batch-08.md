# AUTHOR INTENT — batch 8 of 13

**F4 (26–40 of 40)** · 15 rows · run `20260923T094706Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 15 of the 15 proposed sentences in this file were written by the
> harness, not by the author, and 0 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

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

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's lifetime statistics, which Arc21 keeps private to their owner.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 2. `F4.public_profiles.152`

| | |
|---|---|
| Control | `public.profiles#anon-reach` |
| Runs as | anon |
| Operation | select from public.profiles |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a profile the viewer is not entitled to see.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `F4.public_push_tokens.163`

| | |
|---|---|
| Control | `public.push_tokens#anon-reach` |
| Runs as | anon |
| Operation | select from public.push_tokens |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another account's device push token, which is the address their phone notifications are delivered to.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 4. `F4.public_rate_limit_events.169`

| | |
|---|---|
| Control | `public.rate_limit_events#anon-reach` |
| Runs as | anon |
| Operation | select from public.rate_limit_events |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another account's rate-limit history, learning what they have been doing and how often.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 5. `F4.public_rate_limit_policies.178`

| | |
|---|---|
| Control | `public.rate_limit_policies#anon-reach` |
| Runs as | anon |
| Operation | select from public.rate_limit_policies |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the rate-limit configuration, learning exactly how many attempts are permitted before the limiter refuses.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 6. `F4.public_room_members.186`

| | |
|---|---|
| Control | `public.room_members#anon-reach` |
| Runs as | anon |
| Operation | select from public.room_members |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the membership of a private room.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 7. `F4.public_rooms.194`

| | |
|---|---|
| Control | `public.rooms#anon-reach` |
| Runs as | anon |
| Operation | select from public.rooms |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a private room's metadata, including the join code that gets someone in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 8. `F4.public_rulesets.201`

| | |
|---|---|
| Control | `public.rulesets#policy:rulesets_select_active` |
| Runs as | anon |
| Operation | select from public.rulesets for the seeded row where is_active = false |
| Expected safe result | no data — rulesets_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of rulesets_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor reads a public.rulesets row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 9. `F4.public_tournament_entries.209`

| | |
|---|---|
| Control | `public.tournament_entries#anon-reach` |
| Runs as | anon |
| Operation | select from public.tournament_entries |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the entries and standings of a tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 10. `F4.public_tournament_matches.217`

| | |
|---|---|
| Control | `public.tournament_matches#anon-reach` |
| Runs as | anon |
| Operation | select from public.tournament_matches |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a tournament bracket.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 11. `F4.public_tournaments.221`

| | |
|---|---|
| Control | `public.tournaments#policy:tournaments_select_all` |
| Runs as | anon |
| Operation | select from public.tournaments for the seeded row where status = 'cancelled' |
| Expected safe result | no data — tournaments_select_all USING is `status <> 'cancelled'`, which that row does not satisfy |
| Covers | the unsatisfied branch of tournaments_select_all. The predicate is exactly `status <> 'cancelled'` and the fixture sets status = 'cancelled' |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor reads a public.tournaments row that has been withdrawn from publication, reaching content the `status <> 'cancelled'` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 12. `F4.public_user_cosmetics.224`

| | |
|---|---|
| Control | `public.user_cosmetics#anon-reach` |
| Runs as | anon |
| Operation | select from public.user_cosmetics |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads which cosmetics another account owns.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 13. `F4.public_wallet_ledger.230`

| | |
|---|---|
| Control | `public.wallet_ledger#anon-reach` |
| Runs as | anon |
| Operation | select from public.wallet_ledger |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 14. `F4.public_wallets.241`

| | |
|---|---|
| Control | `public.wallets#anon-reach` |
| Runs as | anon |
| Operation | select from public.wallets |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's chip balance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 15. `F4.realtime_messages.244`

| | |
|---|---|
| Control | `realtime.messages#anon-reach` |
| Runs as | anon |
| Operation | select from realtime.messages |
| Expected safe result | no data — a grant exists but no policy names anon, so row security refuses every row |
| Covers | the latent anonymous grant recorded in WP2: this probe is what shows the policy set is the only thing denying it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads traffic on a Realtime topic.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*
