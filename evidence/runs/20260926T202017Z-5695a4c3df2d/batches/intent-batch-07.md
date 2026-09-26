# AUTHOR INTENT — batch 7 of 13

**F4 (1–25 of 40)** · 25 rows · run `20260926T202017Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 25 proposed sentences in this file were written by the
> harness, not by the author, and 25 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F4.private_career_drill_seeds.004`

| | |
|---|---|
| Control | `private.career_drill_seeds#anon-reach` |
| Runs as | anon |
| Operation | select from private.career_drill_seeds |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the hidden seed a career drill's scenarios are derived from.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the hidden seed a career drill's scenarios are derived from.

#### 2. `F4.private_game_commands.010`

| | |
|---|---|
| Control | `private.game_commands#anon-reach` |
| Runs as | anon |
| Operation | select from private.game_commands |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the replay-protection ledger recording which commands the server has already accepted.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the replay-protection ledger recording which commands the server has already accepted.

#### 3. `F4.private_game_state_private.019`

| | |
|---|---|
| Control | `private.game_state_private#anon-reach` |
| Runs as | anon |
| Operation | select from private.game_state_private |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the authoritative engine state, meaning the undealt shoe order and the dealer's hole card.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the authoritative engine state, meaning the undealt shoe order and the dealer's hole card.

#### 4. `F4.public_blocks.028`

| | |
|---|---|
| Control | `public.blocks#anon-reach` |
| Runs as | anon |
| Operation | select from public.blocks |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads who another player has blocked, which Arc21 keeps private because a blocked user is never told.

#### 5. `F4.public_career_attempts.033`

| | |
|---|---|
| Control | `public.career_attempts#anon-reach` |
| Runs as | anon |
| Operation | select from public.career_attempts |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's reward-bearing career attempt record.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's reward-bearing career attempt record.

#### 6. `F4.public_career_nodes.035`

| | |
|---|---|
| Control | `public.career_nodes#policy:career_nodes_select_active` |
| Runs as | anon |
| Operation | select from public.career_nodes for the seeded row where is_active = false |
| Expected safe result | no data — career_nodes_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of career_nodes_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-out visitor reads a public.career_nodes row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** A signed-out visitor reads a public.career_nodes row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

#### 7. `F4.public_career_progress.038`

| | |
|---|---|
| Control | `public.career_progress#anon-reach` |
| Runs as | anon |
| Operation | select from public.career_progress |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's career progression, including which rewards they have already claimed.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's career progression, including which rewards they have already claimed.

#### 8. `F4.public_cosmetics.040`

| | |
|---|---|
| Control | `public.cosmetics#policy:cosmetics_select_active` |
| Runs as | anon |
| Operation | select from public.cosmetics for the seeded row where is_active = false |
| Expected safe result | no data — cosmetics_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of cosmetics_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-out visitor reads a public.cosmetics row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** A signed-out visitor reads a public.cosmetics row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

#### 9. `F4.public_daily_challenges.044`

| | |
|---|---|
| Control | `public.daily_challenges#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_challenges |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the daily challenge row, which carries the server-only seed_secret that reveals the day's shoe.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the daily challenge row, which carries the server-only seed_secret that reveals the day's shoe.

#### 10. `F4.public_daily_challenges_public.049`

| | |
|---|---|
| Control | `public.daily_challenges_public#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_challenges_public |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the daily-challenge projection — each day's schedule, seed commitment and rewards — which Arc21 grants to signed-in players only.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the daily-challenge projection — each day's schedule, seed commitment and rewards — which Arc21 grants to signed-in players only.

#### 11. `F4.public_daily_entries.052`

| | |
|---|---|
| Control | `public.daily_entries#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_entries |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's daily-challenge entry — the score, final chips and decision accuracy they posted on the challenge every account plays.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's daily-challenge entry — the score, final chips and decision accuracy they posted on the challenge every account plays.

#### 12. `F4.public_friend_requests.060`

| | |
|---|---|
| Control | `public.friend_requests#anon-reach` |
| Runs as | anon |
| Operation | select from public.friend_requests |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads a friend request between two other people.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads a friend request between two other people.

#### 13. `F4.public_friendships.069`

| | |
|---|---|
| Control | `public.friendships#anon-reach` |
| Runs as | anon |
| Operation | select from public.friendships |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads a friendship between two other accounts, which is private social state.

#### 14. `F4.public_game_events.077`

| | |
|---|---|
| Control | `public.game_events#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_events |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the live event stream of a table.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the live event stream of a table.

#### 15. `F4.public_game_session_seats.088`

| | |
|---|---|
| Control | `public.game_session_seats#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_session_seats |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads who is seated at a table, and each player's stack and buy-in.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads who is seated at a table, and each player's stack and buy-in.

#### 16. `F4.public_game_sessions.096`

| | |
|---|---|
| Control | `public.game_sessions#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_sessions |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads a live table's metadata.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads a live table's metadata.

#### 17. `F4.public_hand_players.101`

| | |
|---|---|
| Control | `public.hand_players#anon-reach` |
| Runs as | anon |
| Operation | select from public.hand_players |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's settled hand.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's settled hand.

#### 18. `F4.public_hand_records.107`

| | |
|---|---|
| Control | `public.hand_records#anon-reach` |
| Runs as | anon |
| Operation | select from public.hand_records |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads the completed-hand archive of a table.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads the completed-hand archive of a table.

#### 19. `F4.public_loadouts.116`

| | |
|---|---|
| Control | `public.loadouts#anon-reach` |
| Runs as | anon |
| Operation | select from public.loadouts |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's equipped cosmetics.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's equipped cosmetics.

#### 20. `F4.public_matchmaking_queue.121`

| | |
|---|---|
| Control | `public.matchmaking_queue#anon-reach` |
| Runs as | anon |
| Operation | select from public.matchmaking_queue |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads which other players are waiting for a seat, at what tier, and since when.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads which other players are waiting for a seat, at what tier, and since when.

#### 21. `F4.public_notifications.127`

| | |
|---|---|
| Control | `public.notifications#anon-reach` |
| Runs as | anon |
| Operation | select from public.notifications |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's notifications.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's notifications.

#### 22. `F4.public_player_actions.132`

| | |
|---|---|
| Control | `public.player_actions#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_actions |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's per-decision log, including how each decision was graded.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's per-decision log, including how each decision was graded.

#### 23. `F4.public_player_daily_xp.135`

| | |
|---|---|
| Control | `public.player_daily_xp#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_daily_xp |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's daily XP accrual.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's daily XP accrual.

#### 24. `F4.public_player_decision_periods.138`

| | |
|---|---|
| Control | `public.player_decision_periods#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_decision_periods |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's server-graded basic-strategy accuracy for a week.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's server-graded basic-strategy accuracy for a week.

#### 25. `F4.public_player_mode_stats.141`

| | |
|---|---|
| Control | `public.player_mode_stats#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_mode_stats |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> Without ever signing in or holding an account, someone reads another player's per-mode statistics.

**AUTHOR INTENT:** Without ever signing in or holding an account, someone reads another player's per-mode statistics.
