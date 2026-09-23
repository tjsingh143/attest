# AUTHOR INTENT worksheet — WP3 negative tests

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 240 of the 240 proposed sentences in this file were written by the
> harness, not by the author, and 0 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

Generated from the approved WP3 matrix. **240 negative tests**, each needing one
sentence in the author's own words naming the attack or misuse it simulates.

| | |
|---|---|
| Run | `20260923T094706Z-5695a4c3df2d` |
| Schema version | `5695a4c3df2d3f6c6311999ae268f776e96c3beb657e8a8a466be2ebb62aabec` |
| Rows requiring intent | 240 |
| Review batches | 13 |
| Validation | all checks pass |

> **The harness does not write these sentences and does not derive them from `Covers`.**
> Brief §1.1 reserves them for the author. A sentence inferred from the rationale the planner
> already wrote would be the harness agreeing with itself, which is exactly the thing the
> reservation exists to prevent.

Test IDs are preserved verbatim, so each sentence maps one-to-one to the evidence record its
probe will produce.

## Validation

| Check | Result | Detail |
|---|---|---|
| worksheet contains exactly 240 unique Test IDs | **pass** | 240 rows, 240 unique, 240 required |
| every worksheet ID is a matrix negative requiring intent | **pass** | all present and negative |
| every matrix negative requiring intent appears exactly once | **pass** | none missing |
| no positive, characterization or gap-assessment row appears | **pass** | none present |
| batches account for every row exactly once | **pass** | 13 batches totalling 240 of 240, 240 distinct |
| no AI draft is presented as the author's | **pass** | 240 still ai_draft, 0 adopted by the author, of 240 |

## Coverage by family

| Family | Rows needing intent |
|---|---:|
| F1 read isolation | 29 |
| F2 write isolation | 58 |
| F3 WITH CHECK enforcement | 4 |
| F4 anonymous exposure | 40 |
| F5 SECURITY DEFINER escalation | 57 |
| F6 column-level leakage | 6 |
| F8 realtime channel authorization | 5 |
| F9 wallet / concurrency integrity | 6 |
| F10 audit trail | 12 |
| B boundary cases | 23 |
| **Total** | **240** |

## Review batches

240 rows is too many to review safely at once, so they are also split into
13 batches of roughly 25. Each batch is a separate file under `batches/`; this
document is the canonical complete worksheet.

| Batch | Covers | Rows | First → last Test ID |
|---|---|---:|---|
| 1 | F1 (1–25 of 29) | 25 | `F1.public_blocks.023` → `F1.public_tournament_entries.205` |
| 2 | F1 (26–29 of 29) | 4 | `F1.public_tournament_matches.213` → `F1.public_wallets.237` |
| 3 | F2 (1–25 of 58) | 25 | `F2.private_career_drill_seeds.001` → `F2.public_hand_records.104` |
| 4 | F2 (26–50 of 58) | 25 | `F2.public_hand_records.105` → `F2.public_tournament_matches.214` |
| 5 | F2 (51–58 of 58) | 8 | `F2.public_tournament_matches.215` → `F2.public_wallets.240` |
| 6 | F3 | 4 | `F3.public_blocks.027` → `F3.public_push_tokens.162` |
| 7 | F4 (1–25 of 40) | 25 | `F4.private_career_drill_seeds.004` → `F4.public_player_mode_stats.141` |
| 8 | F4 (26–40 of 40) | 15 | `F4.public_player_stats.144` → `F4.realtime_messages.244` |
| 9 | F5 (1–25 of 57) | 25 | `F5.remove_room_member.245` → `F5.join_private_room.270` |
| 10 | F5 (26–50 of 57) | 25 | `F5.leaderboard_weekly_xp.271` → `F5.my_loadout.295` |
| 11 | F5 (51–57 of 57) | 7 | `F5.my_sprint_entry.296` → `F5.my_notifications.302` |
| 12 | F6 + F8 + F9 + F10 | 29 | `F6.public_daily_challenges.046` → `F10.public_wallet_ledger.235` |
| 13 | B | 23 | `B.private_game_commands.323` → `B.suite.expired-session` |

---

## F1 read isolation — 29 sentences needed

#### 1. `F1.public_blocks.023`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.blocks where blocker_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of blocks_select_own falsified. ownership on blocker_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 2. `F1.public_career_attempts.032`

| | |
|---|---|
| Control | `public.career_attempts#policy:career_attempts_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.career_attempts where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of career_attempts_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's reward-bearing career attempt record.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `F1.public_career_progress.037`

| | |
|---|---|
| Control | `public.career_progress#policy:career_progress_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.career_progress where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of career_progress_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's career progression, including which rewards they have already claimed.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 4. `F1.public_daily_entries.051`

| | |
|---|---|
| Control | `public.daily_entries#policy:daily_entries_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.daily_entries where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of daily_entries_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's daily-challenge attempt and score before or after their own.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 5. `F1.public_friend_requests.054`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_select_participants` |
| Runs as | authenticated:alice |
| Operation | select from public.friend_requests for a row where NONE of sender_id, receiver_id is fixtures.alice.id — the bob↔carol row |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of friend_requests_select_participants falsified. ownership on sender_id OR receiver_id; a row naming alice in either column is legitimately visible to her, so the negative must name neither |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads a friend request between two other people.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 6. `F1.public_friendships.066`

| | |
|---|---|
| Control | `public.friendships#policy:friendships_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.friendships for a row where NONE of user_id_a, user_id_b is fixtures.alice.id — the bob↔carol row |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of friendships_select_own falsified. ownership on user_id_a OR user_id_b; a row naming alice in either column is legitimately visible to her, so the negative must name neither |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 7. `F1.public_game_events.073`

| | |
|---|---|
| Control | `public.game_events#policy:game_events_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_events for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_events_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none. The predicate is a conjunction of participation AND (public OR recipient), so the positive uses a public row and the negative falsifies the participation conjunct |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads the live event stream at that table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 8. `F1.public_game_session_seats.084`

| | |
|---|---|
| Control | `public.game_session_seats#policy:game_session_seats_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_session_seats for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_session_seats_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads the seat list, and the stack and buy-in each player holds at that table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 9. `F1.public_game_sessions.092`

| | |
|---|---|
| Control | `public.game_sessions#policy:game_sessions_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_sessions for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_sessions_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads the session metadata at that table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 10. `F1.public_hand_players.100`

| | |
|---|---|
| Control | `public.hand_players#policy:hand_players_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.hand_players for that same game session fixtures.session.id — and the row selected belongs to alice, so carol falsifies BOTH disjuncts (user_id is not carol, and carol is not a participant) |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of hand_players_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none. The predicate is a disjunction, so the negative must falsify every branch |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads another player's settled hand at that table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 11. `F1.public_hand_records.103`

| | |
|---|---|
| Control | `public.hand_records#policy:hand_records_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.hand_records for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of hand_records_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads the completed-hand archive at that table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 12. `F1.public_loadouts.111`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.loadouts where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of loadouts_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's equipped cosmetics.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 13. `F1.public_matchmaking_queue.120`

| | |
|---|---|
| Control | `public.matchmaking_queue#policy:matchmaking_queue_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.matchmaking_queue where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of matchmaking_queue_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads who else is waiting for a seat, and for how long.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 14. `F1.public_notifications.123`

| | |
|---|---|
| Control | `public.notifications#policy:notifications_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.notifications where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of notifications_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's notifications.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 15. `F1.public_player_actions.131`

| | |
|---|---|
| Control | `public.player_actions#policy:player_actions_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_actions where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_actions_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's per-decision log, including how each decision was graded.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 16. `F1.public_player_daily_xp.134`

| | |
|---|---|
| Control | `public.player_daily_xp#policy:player_daily_xp_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_daily_xp where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_daily_xp_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's daily XP accrual.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 17. `F1.public_player_decision_periods.137`

| | |
|---|---|
| Control | `public.player_decision_periods#policy:player_decision_periods_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_decision_periods where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_decision_periods_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's server-graded basic-strategy accuracy for a week.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 18. `F1.public_player_mode_stats.140`

| | |
|---|---|
| Control | `public.player_mode_stats#policy:player_mode_stats_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_mode_stats where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_mode_stats_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's per-mode statistics.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 19. `F1.public_player_stats.143`

| | |
|---|---|
| Control | `public.player_stats#policy:player_stats_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_stats where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_stats_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's lifetime statistics, which Arc21 keeps private to their owner.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 20. `F1.public_profiles.146`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_select_self` |
| Runs as | authenticated:alice |
| Operation | select from public.profiles where id = fixtures.dave.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of profiles_select_self falsified. ownership on id. Dave is the negative rather than bob because the OTHER permissive SELECT policy (profiles_select_visible) admits bob's public profile, so a bob fixture would not isolate a refusal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads a profile row that is not their own by leaning on the self-access policy, rather than on the visibility rules that are supposed to decide who may see whom.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 21. `F1.public_profiles.148`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_select_visible` |
| Runs as | authenticated:alice |
| Operation | select from public.profiles where id = fixtures.dave.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of profiles_select_visible falsified. this policy is a conjunction of privacy, block and friendship terms. Bob satisfies it (privacy = 'public', no block either way); dave falsifies it because alice has blocked him and the policy requires NOT viewer_has_blocked(id). Bob would NOT work as the negative — his public profile is legitimately visible. The OTHER permissive SELECT policy on profiles, profiles_select_self, is also falsified because dave's id is not alice's, so the refusal reflects effective authorization across both |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads the profile of someone who has blocked them, defeating the block that is supposed to make that profile invisible to exactly this viewer.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 22. `F1.public_push_tokens.158`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.push_tokens where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of push_tokens_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another account's device push token, which is the address their phone notifications are delivered to.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 23. `F1.public_room_members.182`

| | |
|---|---|
| Control | `public.room_members#policy:room_members_select_same_room` |
| Runs as | authenticated:carol |
| Operation | select from public.room_members for that same room fixtures.roomAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of room_members_select_same_room falsified. access is decided by caller_is_room_member() — shared room membership, not ownership. host_user_id does not appear in this predicate |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player who is not a member of that room reads the membership roster in that room.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 24. `F1.public_rooms.190`

| | |
|---|---|
| Control | `public.rooms#policy:rooms_select_member` |
| Runs as | authenticated:carol |
| Operation | select from public.rooms for that same room fixtures.roomAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of rooms_select_member falsified. access is decided by caller_is_room_member() — shared room membership, not ownership. host_user_id does not appear in this predicate |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player who is not a member of that room reads the private metadata, including the join code an outsider would need in that room.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 25. `F1.public_tournament_entries.205`

| | |
|---|---|
| Control | `public.tournament_entries#policy:tournament_entries_select_visible` |
| Runs as | authenticated:carol |
| Operation | select from public.tournament_entries for that same tournament fixtures.tournamentAliceBob.id — reading alice's entry, so carol falsifies both disjuncts (user_id is not carol, and carol is not in that tournament) |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of tournament_entries_select_visible falsified. access is decided by viewer_is_in_tournament() — shared tournament membership. Disjunction, so both branches must be falsified |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player who has not entered that tournament reads the entries and standings for that tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 26. `F1.public_tournament_matches.213`

| | |
|---|---|
| Control | `public.tournament_matches#policy:tournament_matches_select_visible` |
| Runs as | authenticated:carol |
| Operation | select from public.tournament_matches for that same tournament fixtures.tournamentAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of tournament_matches_select_visible falsified. access is decided by viewer_is_in_tournament() — shared tournament membership |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player who has not entered that tournament reads the bracket for that tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 27. `F1.public_user_cosmetics.223`

| | |
|---|---|
| Control | `public.user_cosmetics#policy:user_cosmetics_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.user_cosmetics where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of user_cosmetics_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads which cosmetics another account owns.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 28. `F1.public_wallet_ledger.226`

| | |
|---|---|
| Control | `public.wallet_ledger#policy:wallet_ledger_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallet_ledger where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallet_ledger_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 29. `F1.public_wallets.237`

| | |
|---|---|
| Control | `public.wallets#policy:wallets_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallets where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallets_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads another player's chip balance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F2 write isolation — 58 sentences needed

#### 30. `F2.private_career_drill_seeds.001`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.career_drill_seeds (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to plant a drill seed the server never issued, so an attempt is graded against scenarios of their own choosing.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 31. `F2.private_career_drill_seeds.002`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.career_drill_seeds set created_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the seed a reward-bearing drill attempt will be graded against.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 32. `F2.private_career_drill_seeds.003`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.career_drill_seeds |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the seed a drill attempt is graded against, so the attempt cannot be checked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 33. `F2.private_game_commands.007`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.game_commands (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to forge an accepted-command record and make the server treat a command it never ran as already applied.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 34. `F2.private_game_commands.008`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.game_commands set created_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter the idempotency ledger so an already-applied command is accepted a second time and its chip movement happens twice.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 35. `F2.private_game_commands.009`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.game_commands |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to erase the idempotency record that stops a retry from crediting or debiting twice.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 36. `F2.private_game_state_private.016`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.game_state_private (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to inject engine state the dealer never dealt, so commands are validated against a table of their own making.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 37. `F2.private_game_state_private.017`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.game_state_private set updated_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the authoritative engine state a live hand is being validated against.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 38. `F2.private_game_state_private.018`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.game_state_private |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the authoritative engine state a live session depends on.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 39. `F2.public_blocks.025`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.blocks where blocker_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of blocks_delete_own (DELETE) falsified. The predicate keys on blocker_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to remove a block they are not party to, making the blocker's profile visible again to the very account they blocked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 40. `F2.public_daily_challenges.041`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.daily_challenges (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to publish a daily challenge of their own, with a shoe they already know.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 41. `F2.public_daily_challenges.042`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.daily_challenges set revealed_seed = 'attest-probe-revealed_seed' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite a daily challenge's seed or its published commitment, changing the deal for every player and breaking the proof that the shoe was fixed in advance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 42. `F2.public_daily_challenges.043`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.daily_challenges |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the published commitment that makes a day's shoe verifiable after the fact.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 43. `F2.public_friend_requests.056`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_update_participants` |
| Runs as | authenticated:alice |
| Operation | update public.friend_requests where sender_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of friend_requests_update_participants (UPDATE) falsified. The predicate keys on sender_id OR receiver_id, and the fixture names bob there instead of alice in every clause, since a row naming alice in either column is legitimately writable by her |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to force a friend request to 'accepted' on someone else's behalf, which creates a friendship and therefore changes who may read a profile.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 44. `F2.public_friendships.068`

| | |
|---|---|
| Control | `public.friendships#policy:friendships_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.friendships where user_id_a = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of friendships_delete_own (DELETE) falsified. The predicate keys on user_id_a OR user_id_b, and the fixture names bob there instead of alice in every clause, since a row naming alice in either column is legitimately writable by her |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to sever a friendship they are not party to, revoking the profile visibility it granted.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 45. `F2.public_game_events.074`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_events (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to inject a fabricated event into a live table's stream and mislead the players at it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 46. `F2.public_game_events.075`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_events set recipient_user_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite an event already delivered to the players at a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 47. `F2.public_game_events.076`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_events |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete events from a live table's stream so clients reconstruct a hand that did not happen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 48. `F2.public_game_session_seats.085`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_session_seats (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to seat themselves at a table they were never invited to — and because six policies key on seat membership, thereby grant themselves read access to that session, its events, its hands and its Realtime topic.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 49. `F2.public_game_session_seats.086`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_session_seats set user_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a seat row, changing either another player's stack or the membership that five other policies read as authorization.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 50. `F2.public_game_session_seats.087`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_session_seats |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to unseat another player, removing the seat that authorizes their access to the table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 51. `F2.public_game_sessions.093`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_sessions (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to conjure a game session that the server never created.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 52. `F2.public_game_sessions.094`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_sessions set tier = 'attest-probe-tier' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |
| Pending author decision | registered contradiction `C3-tier-literal-invalid`: the approved statement sets tier = 'attest-probe-tier', which is not a value of the enum table_tier, so the statement fails to parse (22P02) before any privilege or client guard is consulted — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a live session's status, version or escrowed chips.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 53. `F2.public_game_sessions.095`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_sessions |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy a live session other players are seated at.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 54. `F2.public_hand_records.104`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.hand_records (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to write a hand into the archive that was never dealt.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 55. `F2.public_hand_records.105`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.hand_records set dealer_total = 1 |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to falsify the archived history of a completed hand.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 56. `F2.public_hand_records.106`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.hand_records |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a hand from the archive, destroying the record of what was played.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 57. `F2.public_loadouts.113`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_update_own` |
| Runs as | authenticated:alice |
| Operation | update public.loadouts where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of loadouts_update_own (UPDATE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to change what another player has equipped.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 58. `F2.public_notifications.125`

| | |
|---|---|
| Control | `public.notifications#policy:notifications_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.notifications where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of notifications_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to delete another player's notifications before they read them.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 59. `F2.public_profiles.150`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_update_self` |
| Runs as | authenticated:alice |
| Operation | update public.profiles where id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of profiles_update_self (UPDATE) falsified. The predicate keys on id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to edit another player's public identity — their username, display name and bio.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 60. `F2.public_push_tokens.160`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.push_tokens where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of push_tokens_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to deregister another account's device so its notifications stop arriving.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 61. `F2.public_rate_limit_events.166`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_events (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to pad another account's rate-limit window so their legitimate actions start being refused.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 62. `F2.public_rate_limit_events.167`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_events set occurred_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to backdate their own rate-limit events so a spent window looks fresh.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 63. `F2.public_rate_limit_events.168`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_events |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to clear their own rate-limit window and resume an action the limiter had started refusing.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 64. `F2.public_rate_limit_policies.175`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_policies (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to add a rate-limit rule of their own.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 65. `F2.public_rate_limit_policies.176`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_policies set rationale = 'attest-probe-rationale' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to widen or disable a rate limit for every account at once, which is corruption of a security control rather than of data.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 66. `F2.public_rate_limit_policies.177`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_policies |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a rate-limit policy and remove the limit it enforced product-wide.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 67. `F2.public_room_members.183`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.room_members (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to add themselves to a private room they were never invited to — and because caller_is_room_member reads this table, thereby grant themselves the room access it decides.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 68. `F2.public_room_members.184`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.room_members set last_seen_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a membership row that other policies read as an authorization decision.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 69. `F2.public_room_members.185`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.room_members |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to eject another player from a private room.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 70. `F2.public_rooms.191`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rooms (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to create a room record directly rather than through the function that enforces the seat bounds.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 71. `F2.public_rooms.192`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rooms set ruleset_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to change a private room's visibility or join code, altering who is able to get in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 72. `F2.public_rooms.193`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rooms |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy a private room other players are sitting in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 73. `F2.public_rulesets.197`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rulesets (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to publish a ruleset the designers never authored.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 74. `F2.public_rulesets.198`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rulesets set description = 'attest-probe-description' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter the rules every live session and tournament plays under, and that hands are recorded against.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 75. `F2.public_rulesets.199`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rulesets |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to remove a ruleset that live sessions reference.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 76. `F2.public_tournament_entries.206`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_entries (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to register themselves — or someone else — into a tournament without going through entry.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 77. `F2.public_tournament_entries.207`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.tournament_entries set bracket_seed = 1 |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to change a placement or prize marker, which is the authoritative outcome of a shared competition.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 78. `F2.public_tournament_entries.208`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.tournament_entries |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to remove a rival's entry from a tournament in progress.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 79. `F2.public_tournament_matches.214`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_matches (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to insert a match into a bracket the server never scheduled.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 80. `F2.public_tournament_matches.215`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.tournament_matches set entry_a_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to declare a different winner in a tournament bracket.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 81. `F2.public_tournament_matches.216`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.tournament_matches |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a match from a tournament bracket.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 82. `F2.public_wallet_ledger.227`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.wallet_ledger (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to write a ledger entry the server never issued and credit themselves chips.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 83. `F2.public_wallet_ledger.228`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.wallet_ledger set reference_type = 'attest-probe-reference_type' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the append-only economy history that wallet balances are recomputed from.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 84. `F2.public_wallet_ledger.229`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.wallet_ledger |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete ledger entries, destroying the authoritative record the balance is derived from.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 85. `F2.public_wallets.238`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.wallets (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to create a wallet outside the account-bootstrap path.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 86. `F2.public_wallets.239`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.wallets set updated_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to set a chip balance directly, bypassing the ledger the economy is supposed to move through.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 87. `F2.public_wallets.240`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.wallets |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |
| Pending author decision | registered contradiction `C2-client-guard-before-grant`: the approved grant-surface statement is an UPDATE or DELETE with no WHERE clause; every client connection arrives through `authenticator`, which preloads pg_safeupdate, and pg_safeupdate refuses such a statement at parse analysis (21000) — before the privilege check the expectation names is ever made — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a wallet and the balance it holds.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F3 WITH CHECK enforcement — 4 sentences needed

#### 88. `F3.public_blocks.027`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.blocks with blocker_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of blocks_insert_own (INSERT) unsatisfied: the policy compares `blocker_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.blocks attributed to somebody else by setting blocker_id to another account, in order to fabricate a block on another player's behalf and cut them off from someone they never blocked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 89. `F3.public_friend_requests.058`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_insert_as_sender` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.friend_requests with sender_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of friend_requests_insert_as_sender (INSERT) unsatisfied: the policy compares `sender_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.friend_requests attributed to somebody else by setting sender_id to another account, in order to send a friend request in someone else's name.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 90. `F3.public_loadouts.115`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.loadouts with user_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of loadouts_insert_own (INSERT) unsatisfied: the policy compares `user_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.loadouts attributed to somebody else by setting user_id to another account, in order to create a loadout attributed to another account.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 91. `F3.public_push_tokens.162`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.push_tokens with user_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of push_tokens_insert_own (INSERT) unsatisfied: the policy compares `user_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.push_tokens attributed to somebody else by setting user_id to another account, in order to register a push token against another account and receive that account's notifications on their own device.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F4 anonymous exposure — 40 sentences needed

#### 92. `F4.private_career_drill_seeds.004`

| | |
|---|---|
| Control | `private.career_drill_seeds#anon-reach` |
| Runs as | anon |
| Operation | select from private.career_drill_seeds |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the hidden seed a career drill's scenarios are derived from.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 93. `F4.private_game_commands.010`

| | |
|---|---|
| Control | `private.game_commands#anon-reach` |
| Runs as | anon |
| Operation | select from private.game_commands |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the replay-protection ledger recording which commands the server has already accepted.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 94. `F4.private_game_state_private.019`

| | |
|---|---|
| Control | `private.game_state_private#anon-reach` |
| Runs as | anon |
| Operation | select from private.game_state_private |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the authoritative engine state, meaning the undealt shoe order and the dealer's hole card.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 95. `F4.public_blocks.028`

| | |
|---|---|
| Control | `public.blocks#anon-reach` |
| Runs as | anon |
| Operation | select from public.blocks |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 96. `F4.public_career_attempts.033`

| | |
|---|---|
| Control | `public.career_attempts#anon-reach` |
| Runs as | anon |
| Operation | select from public.career_attempts |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's reward-bearing career attempt record.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 97. `F4.public_career_nodes.035`

| | |
|---|---|
| Control | `public.career_nodes#policy:career_nodes_select_active` |
| Runs as | anon |
| Operation | select from public.career_nodes for the seeded row where is_active = false |
| Expected safe result | no data — career_nodes_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of career_nodes_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor reads a public.career_nodes row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 98. `F4.public_career_progress.038`

| | |
|---|---|
| Control | `public.career_progress#anon-reach` |
| Runs as | anon |
| Operation | select from public.career_progress |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's career progression, including which rewards they have already claimed.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 99. `F4.public_cosmetics.040`

| | |
|---|---|
| Control | `public.cosmetics#policy:cosmetics_select_active` |
| Runs as | anon |
| Operation | select from public.cosmetics for the seeded row where is_active = false |
| Expected safe result | no data — cosmetics_select_active USING is `is_active is true`, which that row does not satisfy |
| Covers | the unsatisfied branch of cosmetics_select_active. The predicate is exactly `is_active is true` and the fixture sets is_active = false |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor reads a public.cosmetics row that has been withdrawn from publication, reaching content the `is_active is true` predicate is there to keep out of the public catalogue.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 100. `F4.public_daily_challenges.044`

| | |
|---|---|
| Control | `public.daily_challenges#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_challenges |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the daily challenge row, which carries the server-only seed_secret that reveals the day's shoe.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 101. `F4.public_daily_challenges_public.049`

| | |
|---|---|
| Control | `public.daily_challenges_public#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_challenges_public |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the public projection of the daily challenge, which exists precisely so the secret beside it is not exposed.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 102. `F4.public_daily_entries.052`

| | |
|---|---|
| Control | `public.daily_entries#anon-reach` |
| Runs as | anon |
| Operation | select from public.daily_entries |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's daily-challenge attempt and score before or after their own.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 103. `F4.public_friend_requests.060`

| | |
|---|---|
| Control | `public.friend_requests#anon-reach` |
| Runs as | anon |
| Operation | select from public.friend_requests |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a friend request between two other people.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 104. `F4.public_friendships.069`

| | |
|---|---|
| Control | `public.friendships#anon-reach` |
| Runs as | anon |
| Operation | select from public.friendships |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 105. `F4.public_game_events.077`

| | |
|---|---|
| Control | `public.game_events#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_events |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the live event stream of a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 106. `F4.public_game_session_seats.088`

| | |
|---|---|
| Control | `public.game_session_seats#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_session_seats |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads who is seated at a table, and each player's stack and buy-in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 107. `F4.public_game_sessions.096`

| | |
|---|---|
| Control | `public.game_sessions#anon-reach` |
| Runs as | anon |
| Operation | select from public.game_sessions |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads a live table's metadata.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 108. `F4.public_hand_players.101`

| | |
|---|---|
| Control | `public.hand_players#anon-reach` |
| Runs as | anon |
| Operation | select from public.hand_players |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's settled hand.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 109. `F4.public_hand_records.107`

| | |
|---|---|
| Control | `public.hand_records#anon-reach` |
| Runs as | anon |
| Operation | select from public.hand_records |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads the completed-hand archive of a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 110. `F4.public_loadouts.116`

| | |
|---|---|
| Control | `public.loadouts#anon-reach` |
| Runs as | anon |
| Operation | select from public.loadouts |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's equipped cosmetics.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 111. `F4.public_matchmaking_queue.121`

| | |
|---|---|
| Control | `public.matchmaking_queue#anon-reach` |
| Runs as | anon |
| Operation | select from public.matchmaking_queue |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads who else is waiting for a seat, and for how long.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 112. `F4.public_notifications.127`

| | |
|---|---|
| Control | `public.notifications#anon-reach` |
| Runs as | anon |
| Operation | select from public.notifications |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's notifications.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 113. `F4.public_player_actions.132`

| | |
|---|---|
| Control | `public.player_actions#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_actions |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's per-decision log, including how each decision was graded.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 114. `F4.public_player_daily_xp.135`

| | |
|---|---|
| Control | `public.player_daily_xp#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_daily_xp |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's daily XP accrual.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 115. `F4.public_player_decision_periods.138`

| | |
|---|---|
| Control | `public.player_decision_periods#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_decision_periods |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's server-graded basic-strategy accuracy for a week.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 116. `F4.public_player_mode_stats.141`

| | |
|---|---|
| Control | `public.player_mode_stats#anon-reach` |
| Runs as | anon |
| Operation | select from public.player_mode_stats |
| Expected safe result | no data, or error 42501 where no anon grant exists at all |
| Covers | the anonymous reach surface: a signed-out caller obtains nothing here |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Without ever signing in or holding an account, someone reads another player's per-mode statistics.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 117. `F4.public_player_stats.144`

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

#### 118. `F4.public_profiles.152`

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

#### 119. `F4.public_push_tokens.163`

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

#### 120. `F4.public_rate_limit_events.169`

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

#### 121. `F4.public_rate_limit_policies.178`

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

#### 122. `F4.public_room_members.186`

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

#### 123. `F4.public_rooms.194`

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

#### 124. `F4.public_rulesets.201`

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

#### 125. `F4.public_tournament_entries.209`

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

#### 126. `F4.public_tournament_matches.217`

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

#### 127. `F4.public_tournaments.221`

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

#### 128. `F4.public_user_cosmetics.224`

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

#### 129. `F4.public_wallet_ledger.230`

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

#### 130. `F4.public_wallets.241`

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

#### 131. `F4.realtime_messages.244`

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

## F5 SECURITY DEFINER escalation — 57 sentences needed

#### 132. `F5.remove_room_member.245`

| | |
|---|---|
| Control | `public.remove_room_member#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call remove_room_member(fixtures.roomBobHosts.id, fixtures.bob.id) |
| Expected safe result | returns FALSE and bob's membership is unchanged. Not an error: the body returns false for a non-host so that a caller learns nothing about whether the room exists |
| Covers | [target_resource] the room HOST removes another member from their own room, in the lobby only. Identity: caller from auth.uid(); BOTH the room and the member come from arguments. Reaches: public.rooms and public.room_members, neither of which a client may write. Escalation would be: removing a member from a room the caller does not host |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls remove_room_member() with an argument that is not theirs to name, getting its owner privilege to do what the caller's own policies forbid: removing a member from a room the caller does not host.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 133. `F5.get_room_state.246`

| | |
|---|---|
| Control | `public.get_room_state#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call get_room_state(fixtures.roomAliceBob.id) |
| Expected safe result | error PT404 — the body raises 'you are not at that table'. Note this is NOT 42501; the 42501 in this function guards the null-identity path |
| Covers | [target_resource] a joined member reads the state of the room they are in. Identity: caller from auth.uid(); the room comes from the argument. Reaches: public.rooms joined to public.room_members and public.profiles. Escalation would be: reading the roster, codes and seat layout of a room the caller has not joined |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls get_room_state() naming a room that is not theirs, getting its owner privilege to do what the caller's own policies forbid: reading the roster, codes and seat layout of a room the caller has not joined.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 134. `F5.set_room_ready.247`

| | |
|---|---|
| Control | `public.set_room_ready#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call set_room_ready(fixtures.roomAliceBob.id, true) |
| Expected safe result | refusal or no effect; carol's absence from room_members must be unchanged |
| Covers | [target_resource] a joined member marks themselves ready. Identity: caller from auth.uid(); the room comes from the argument. Reaches: public.room_members. Escalation would be: setting ready state in a room the caller is not a member of |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls set_room_ready() naming a room that is not theirs, getting its owner privilege to do what the caller's own policies forbid: setting ready state in a room the caller is not a member of.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 135. `F5.invite_friend_to_room.248`

| | |
|---|---|
| Control | `public.invite_friend_to_room#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call invite_friend_to_room(fixtures.roomAliceBob.id, fixtures.bob.id) |
| Expected safe result | refusal; no room_members row is created for bob |
| Covers | [target_resource] a member invites one of their own friends into their room. Identity: caller from auth.uid(); both the room and the invitee come from arguments. Reaches: public.room_members and the friendship graph. Escalation would be: inviting into a room the caller is not in, or inviting a non-friend |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls invite_friend_to_room() with an argument that is not theirs to name, getting its owner privilege to do what the caller's own policies forbid: inviting into a room the caller is not in, or inviting a non-friend.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 136. `F5.leave_room.249`

| | |
|---|---|
| Control | `public.leave_room#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call leave_room(fixtures.roomAliceBob.id) |
| Expected safe result | refusal or no effect; no other member's row is altered |
| Covers | [target_resource] a member leaves their own room. Identity: caller from auth.uid(); the room comes from the argument. Reaches: public.room_members, public.rooms. Escalation would be: affecting a room the caller is not a member of |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls leave_room() naming a room that is not theirs, getting its owner privilege to do what the caller's own policies forbid: affecting a room the caller is not a member of.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 137. `F5.equip_cosmetic.250`

| | |
|---|---|
| Control | `public.equip_cosmetic#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call equip_cosmetic(fixtures.unownedCosmetic.id) |
| Expected safe result | refusal — the loadouts_guard_slots trigger validates each slot against ownership and kind |
| Covers | [target_resource] a player equips a cosmetic they own. Identity: caller from auth.uid(); the cosmetic comes from the argument. Reaches: public.loadouts, validated against public.user_cosmetics. Escalation would be: equipping a cosmetic the caller does not own |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls equip_cosmetic() naming a cosmetic that is not theirs, getting its owner privilege to do what the caller's own policies forbid: equipping a cosmetic the caller does not own.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 138. `F5.mark_notifications_read.251`

| | |
|---|---|
| Control | `public.mark_notifications_read#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call mark_notifications_read(ARRAY[fixtures.bobNotification.id]) |
| Expected safe result | returns 0 and bob's notification read_at stays null — the body scopes its UPDATE with `where user_id = v_me` |
| Covers | [target_resource] a user marks their own notifications read. Identity: caller from auth.uid(); the notification ids come from the argument. Reaches: public.notifications. Escalation would be: marking another account's notification read, or learning that an id exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls mark_notifications_read() naming notification ids that are not theirs, getting its owner privilege to do what the caller's own policies forbid: marking another account's notification read, or learning that an id exists.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 139. `F5.caller_is_room_member.252`

| | |
|---|---|
| Control | `public.caller_is_room_member#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call caller_is_room_member(fixtures.roomAliceBob.id) |
| Expected safe result | returns FALSE. This function does not raise; false is the safe answer |
| Covers | [target_resource] a helper the policies call to decide room membership. Identity: caller from auth.uid(); the room comes from the argument. Reaches: public.room_members. Escalation would be: returning true for a room the caller is not in, which would widen every policy that calls it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls caller_is_room_member() naming a room that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning true for a room the caller is not in, which would widen every policy that calls it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 140. `F5.is_session_participant.253`

| | |
|---|---|
| Control | `public.is_session_participant#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call is_session_participant(fixtures.session.id) |
| Expected safe result | returns FALSE |
| Covers | [target_resource] a helper six policies call to decide session participation. Identity: caller from auth.uid(); the session comes from the argument. Reaches: public.game_session_seats. Escalation would be: returning true for a session the caller holds no seat at, which would widen five relations' policies at once |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls is_session_participant() naming a session that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning true for a session the caller holds no seat at, which would widen five relations' policies at once.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 141. `F5.sprint_standings.254`

| | |
|---|---|
| Control | `public.sprint_standings#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call sprint_standings(fixtures.tournamentAliceBob.id) |
| Expected safe result | error 42501, message 'you are not in that tournament'. Not an empty result: the body raises rather than returning zero rows |
| Covers | [target_resource] an ENTRANT reads the standings of a tournament they have entered. Not public: the body requires a tournament_entries row for auth.uid(). Identity: caller from auth.uid() gates access; the tournament comes from the argument. Reaches: public.tournament_entries joined to public.profiles, both past the caller's own policies. Escalation would be: a NON-ENTRANT reading the standings — other entrants' display names, chip stacks, placements and prize amounts for a tournament the caller never joined |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls sprint_standings() naming a tournament that is not theirs, getting its owner privilege to do what the caller's own policies forbid: a NON-ENTRANT reading the standings — other entrants' display names, chip stacks, placements and prize amounts for a tournament the caller never joined.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 142. `F5.viewer_is_in_tournament.256`

| | |
|---|---|
| Control | `public.viewer_is_in_tournament#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_is_in_tournament(fixtures.tournamentAliceBob.id) |
| Expected safe result | returns FALSE |
| Covers | [target_resource] a helper reporting whether the caller is in a tournament. Identity: caller from auth.uid(); the tournament comes from the argument. Reaches: public.tournament_entries. Escalation would be: returning true for a tournament the caller has not entered |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_is_in_tournament() naming a tournament that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning true for a tournament the caller has not entered.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 143. `F5.accept_friend_request.257`

| | |
|---|---|
| Control | `public.accept_friend_request#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call accept_friend_request(fixtures.alice.id) when no request from alice to carol exists |
| Expected safe result | refusal or no effect; no friendships row appears between alice and carol |
| Covers | [target_user] a REQUEST RECEIVER accepts a pending request sent to them. Identity: caller from auth.uid() is the receiver; the sender comes from the argument. Reaches: public.friend_requests and public.friendships — and friendship widens profiles_select_visible. Escalation would be: accepting a request that was never sent to the caller, thereby manufacturing a friendship and the profile visibility it confers |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls accept_friend_request() naming a sender that is not theirs, getting its owner privilege to do what the caller's own policies forbid: accepting a request that was never sent to the caller, thereby manufacturing a friendship and the profile visibility it confers.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 144. `F5.decline_friend_request.258`

| | |
|---|---|
| Control | `public.decline_friend_request#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call decline_friend_request(fixtures.alice.id) for a request alice sent to bob |
| Expected safe result | no effect on the alice→bob request |
| Covers | [target_user] a request receiver declines a pending request. Identity: caller from auth.uid() is the receiver; the sender comes from the argument. Reaches: public.friend_requests. Escalation would be: declining a request addressed to somebody else |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls decline_friend_request() naming a sender that is not theirs, getting its owner privilege to do what the caller's own policies forbid: declining a request addressed to somebody else.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 145. `F5.send_friend_request.259`

| | |
|---|---|
| Control | `public.send_friend_request#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call send_friend_request(fixtures.dave.id), whom alice has blocked |
| Expected safe result | refusal — friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id) |
| Covers | [target_user] a user sends a request to another account. Identity: caller from auth.uid() is the sender; the recipient comes from the argument. Reaches: public.friend_requests. Escalation would be: sending as somebody else, or sending to an account that has blocked the caller |
| Pending author decision | registered contradiction `C2-definer-bypasses-named-policy`: the approved expectation attributes the refusal to the RLS policy friend_requests_insert_as_sender, but send_friend_request is SECURITY DEFINER, so the caller's policies are never consulted; the refusal is the body's own is_blocked_between check — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls send_friend_request() naming a recipient that is not theirs, getting its owner privilege to do what the caller's own policies forbid: sending as somebody else, or sending to an account that has blocked the caller.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 146. `F5.block_player.260`

| | |
|---|---|
| Control | `public.block_player#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call block_player(fixtures.bob.id) and verify the row is attributed to alice and not to bob |
| Expected safe result | one blocks row with blocker_id = alice. No row appears with blocker_id = bob |
| Covers | [target_user] a user blocks another account. Identity: caller from auth.uid() is the blocker; the target comes from the argument. Reaches: public.blocks, and blocks feed profiles_select_visible. Escalation would be: creating a block attributed to another account, which would alter that account's visibility decisions |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls block_player() naming a target that is not theirs, getting its owner privilege to do what the caller's own policies forbid: creating a block attributed to another account, which would alter that account's visibility decisions.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 147. `F5.unblock_player.261`

| | |
|---|---|
| Control | `public.unblock_player#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call unblock_player(fixtures.dave.id) when the alice→dave block is the one that exists |
| Expected safe result | no effect; the alice→dave block survives |
| Covers | [target_user] a user removes their own block. Identity: caller from auth.uid() is the blocker; the target comes from the argument. Reaches: public.blocks. Escalation would be: removing somebody else's block, which would widen what they can see |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls unblock_player() naming a target that is not theirs, getting its owner privilege to do what the caller's own policies forbid: removing somebody else's block, which would widen what they can see.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 148. `F5.remove_friend.262`

| | |
|---|---|
| Control | `public.remove_friend#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call remove_friend(fixtures.bob.id) when the friendship is alice↔bob |
| Expected safe result | no effect; the alice↔bob friendship survives |
| Covers | [target_user] a user removes their own friendship. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.friendships. Escalation would be: dissolving a friendship the caller is not part of |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls remove_friend() naming another party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: dissolving a friendship the caller is not part of.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 149. `F5.player_public_profile.263`

| | |
|---|---|
| Control | `public.player_public_profile#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call player_public_profile(fixtures.dave.id), whom alice has blocked |
| Expected safe result | returns NO rows — the body returns early on is_blocked_between, and nothing distinguishes 'they blocked you' from 'no such player' |
| Covers | [target_user] any signed-in user reads another account's PUBLIC profile. Cross-user by design. Identity: caller from auth.uid() decides visibility; the subject comes from the argument. Reaches: public.profiles past the caller's own policies. Escalation would be: returning a profile the caller should not see (private, or blocked in either direction), or returning friend-only fields to a non-friend |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls player_public_profile() naming a subject that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning a profile the caller should not see (private, or blocked in either direction), or returning friend-only fields to a non-friend.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 150. `F5.player_public_profile.264`

| | |
|---|---|
| Control | `public.player_public_profile#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call player_public_profile(fixtures.bob.id) — a non-friend whose privacy is 'public' |
| Expected safe result | returns exactly ONE row carrying the non-friend projection. Expecting 'no data' here would fail a control that is working correctly: bob's public profile is meant to be visible |
| Covers | [target_user] the same function, exercising the projection rather than the refusal. Identity: caller from auth.uid() decides which fields are returned; the subject comes from the argument. Reaches: public.profiles past the caller's own policies. Escalation would be: returning friend-only fields to a caller who is not a friend |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls player_public_profile() naming a subject that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning friend-only fields to a caller who is not a friend.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 151. `F5.viewer_is_friend_of.265`

| | |
|---|---|
| Control | `public.viewer_is_friend_of#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_is_friend_of(fixtures.bob.id) when the friendship is alice↔bob |
| Expected safe result | returns FALSE |
| Covers | [target_user] a helper reporting whether the caller is friends with an account. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.friendships. Escalation would be: returning true where no friendship exists, which would widen profiles_select_visible |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_is_friend_of() naming another party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning true where no friendship exists, which would widen profiles_select_visible.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 152. `F5.viewer_has_blocked.266`

| | |
|---|---|
| Control | `public.viewer_has_blocked#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_has_blocked(fixtures.dave.id) when the block is alice→dave |
| Expected safe result | returns FALSE — carol has blocked nobody |
| Covers | [target_user] a helper reporting whether the caller has blocked an account. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.blocks. Escalation would be: reporting another account's block list |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_has_blocked() naming another party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: reporting another account's block list.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 153. `F5.viewer_is_blocked_by.267`

| | |
|---|---|
| Control | `public.viewer_is_blocked_by#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_is_blocked_by(fixtures.alice.id) when the block is alice→dave |
| Expected safe result | returns FALSE |
| Covers | [target_user] a helper reporting whether an account has blocked the caller. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.blocks. Escalation would be: letting a caller enumerate who has blocked whom beyond their own position |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_is_blocked_by() naming another party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: letting a caller enumerate who has blocked whom beyond their own position.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 154. `F5.retire_push_token.268`

| | |
|---|---|
| Control | `public.retire_push_token#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call retire_push_token('ExponentPushToken[attest-bob]') |
| Expected safe result | no effect; bob's token row stays is_active = true |
| Covers | [target_opaque] a device retires its own push token. Identity: caller from auth.uid(); the token string comes from the argument. Reaches: public.push_tokens. Escalation would be: retiring another account's token — a denial of their notifications |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls retire_push_token() naming a token string that is not theirs, getting its owner privilege to do what the caller's own policies forbid: retiring another account's token — a denial of their notifications.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 155. `F5.register_push_token.269`

| | |
|---|---|
| Control | `public.register_push_token#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call register_push_token('ExponentPushToken[attest-bob]', 'ios', ...) |
| Expected safe result | refusal, or a row attributed to alice that does NOT displace bob's. Bob's row must still exist with user_id = bob |
| Covers | [target_opaque] a device registers itself for push. Identity: caller from auth.uid() owns the row; the token string comes from the argument. Reaches: public.push_tokens, which has a unique constraint on token. Escalation would be: registering a token string already belonging to another account, which would redirect their notifications to the caller's device |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls register_push_token() naming a token string that is not theirs, getting its owner privilege to do what the caller's own policies forbid: registering a token string already belonging to another account, which would redirect their notifications to the caller's device.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 156. `F5.join_private_room.270`

| | |
|---|---|
| Control | `public.join_private_room#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call join_private_room('fixtures.nonexistentRoomCode') |
| Expected safe result | refusal that does not distinguish a non-existent room from an ineligible one |
| Covers | [target_opaque] a user joins a private room using its code. Identity: caller from auth.uid(); the room code comes from the argument. Reaches: public.rooms and public.room_members. Escalation would be: joining without a valid code, or a code-guessing oracle that distinguishes 'wrong code' from 'room full' |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls join_private_room() naming a room code that is not theirs, getting its owner privilege to do what the caller's own policies forbid: joining without a valid code, or a code-guessing oracle that distinguishes 'wrong code' from 'room full'.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 157. `F5.leaderboard_weekly_xp.271`

| | |
|---|---|
| Control | `public.leaderboard_weekly_xp#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call leaderboard_weekly_xp(10, 0) and inspect every returned column |
| Expected safe result | a public-safe projection only: no private-privacy account identity and no column beyond what a leaderboard needs |
| Covers | [public_projection] any signed-in user reads the weekly XP leaderboard. Cross-user by design. Identity: caller from auth.uid(); no target argument — limit and offset only. Reaches: public.player_daily_xp and profiles aggregated across all accounts. Escalation would be: returning a private-privacy account's identity, or being callable without an account at all. WP0's own pgTAP gate treats granting this to anon as a breach |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player gets leaderboard_weekly_xp() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: returning a private-privacy account's identity, or being callable without an account at all.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 158. `F5.leaderboard_weekly_xp.272`

| | |
|---|---|
| Control | `public.leaderboard_weekly_xp#security_definer` |
| Runs as | anon |
| Operation | as anon, call leaderboard_weekly_xp(10, 0) |
| Expected safe result | error 42501 — EXECUTE is granted to authenticated and must not be reachable by anon |
| Covers | [public_projection] the same function, exercising who may call it rather than what it returns. Identity: no identity at all — the probe runs as anon. Reaches: public.player_daily_xp and profiles aggregated across all accounts. Escalation would be: being callable without an account. WP0's own pgTAP gate treats granting this to anon as a breach |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Someone with no account at all executes leaderboard_weekly_xp(), which is granted to signed-in callers only, and reads aggregated data across every account without ever holding one.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 159. `F5.leaderboard_daily_challenge.273`

| | |
|---|---|
| Control | `public.leaderboard_daily_challenge#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call it for the seeded challenge date and inspect every returned column |
| Expected safe result | a public-safe projection; no seed_secret and no private-privacy identity |
| Covers | [public_projection] any signed-in user reads a day's challenge leaderboard. Identity: caller from auth.uid(); the date and paging come from arguments. Reaches: public.daily_entries and profiles across all accounts. Escalation would be: returning a private account's identity, or leaking seed_secret through the join |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player gets leaderboard_daily_challenge() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: returning a private account's identity, or leaking seed_secret through the join.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 160. `F5.leaderboard_strategy_accuracy.274`

| | |
|---|---|
| Control | `public.leaderboard_strategy_accuracy#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call it and inspect the projection |
| Expected safe result | a public-safe projection only |
| Covers | [public_projection] any signed-in user reads the strategy-accuracy leaderboard. Identity: caller from auth.uid(); paging only. Reaches: public.player_decision_periods across all accounts. Escalation would be: returning a private account's identity |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player gets leaderboard_strategy_accuracy() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: returning a private account's identity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 161. `F5.leaderboard_tournament_wins.275`

| | |
|---|---|
| Control | `public.leaderboard_tournament_wins#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call it and inspect the projection |
| Expected safe result | a public-safe projection only |
| Covers | [public_projection] any signed-in user reads the tournament-wins leaderboard. Identity: caller from auth.uid(); paging only. Reaches: public.tournament_entries across all accounts. Escalation would be: returning a private account's identity |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player gets leaderboard_tournament_wins() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: returning a private account's identity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 162. `F5.search_players.276`

| | |
|---|---|
| Control | `public.search_players#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call search_players('dave'), whom alice has blocked |
| Expected safe result | dave must not appear in the results |
| Covers | [public_projection] a user searches for other accounts by handle. Identity: caller from auth.uid(); the query string comes from the argument. Reaches: public.profiles across all accounts. Escalation would be: returning private-privacy accounts, or accounts blocked in either direction |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player gets search_players() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: returning private-privacy accounts, or accounts blocked in either direction.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 163. `F5.ensure_todays_daily_challenge.277`

| | |
|---|---|
| Control | `public.ensure_todays_daily_challenge#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call ensure_todays_daily_challenge() while today's challenge is open, and inspect every returned column; then read daily_challenges.revealed_seed and seed_revealed_at for today's row |
| Expected safe result | the returned record is the daily_challenges_public projection, which has no seed_secret column at all; and today's still-open challenge has revealed_seed IS NULL afterwards |
| Covers | [no_target] mints today's daily challenge if it does not exist, and returns its public projection. Identity: auth.uid() must be non-null; nothing else is taken from the caller. Reaches: public.daily_challenges including seed_secret, via ensure_daily_challenge_for() and reveal_closed_daily_seeds(). LEGITIMATE shared effects: YES, and substantial: it CREATES a global daily_challenges row every account then plays, and reveal_closed_daily_seeds() mutates rows belonging to no one in particular. Both are intended. A rule requiring 'no shared row changes' would flag correct behaviour. Escalation would be: returning seed_secret to the caller, or revealing the seed of a challenge that is still OPEN — either would let a caller know the shoe before playing it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls ensure_todays_daily_challenge(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: returning seed_secret to the caller, or revealing the seed of a challenge that is still OPEN — either would let a caller know the shoe before playing it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 164. `F5.latest_verifiable_daily_challenge.278`

| | |
|---|---|
| Control | `public.latest_verifiable_daily_challenge#security_definer` |
| Runs as | anon |
| Operation | as anon, call latest_verifiable_daily_challenge() while one revealed and one unrevealed challenge both exist |
| Expected safe result | exactly the revealed challenge is returned; the unrevealed one does not appear, and no seed_secret column is exposed |
| Covers | [no_target] publishes the most recent challenge whose seed has already been revealed, so a past shoe can be verified. Identity: NONE — this function does not read auth.uid(). It is deliberately callable without an account. Reaches: public.daily_challenges, selecting challenge_date, seed_commitment, revealed_seed, seed_revealed_at. LEGITIMATE shared effects: YES: it returns a row that belongs to no account and is meant to be public. There is no caller-scoping to assert. Escalation would be: returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control |
| Pending author decision | registered contradiction `C4-anon-has-no-execute`: the approved row calls latest_verifiable_daily_challenge() as anon and expects the revealed challenge back, but EXECUTE is granted to authenticated only, so anon is refused (42501) before the function body — the control the row examines — runs — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor calls latest_verifiable_daily_challenge(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 165. `F5.join_matchmaking.279`

| | |
|---|---|
| Control | `public.join_matchmaking#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call join_matchmaking('casual') while bob holds a fresh (non-stale) queue entry |
| Expected safe result | a matchmaking_queue row appears with user_id = alice and no other; bob's fresh entry is untouched. Stale entries belonging to anyone MAY be expired — that is not a failure |
| Covers | [no_target] enqueues the caller for a public seat at the requested tier. Identity: caller from auth.uid(); only the tier comes from the argument. Reaches: public.matchmaking_queue, public.game_session_seats and public.game_sessions across all accounts. LEGITIMATE shared effects: YES: expire_stale_queue_entries() removes OTHER accounts' stale queue rows, which is intended housekeeping. It also reads other accounts' seats to decide seating. Escalation would be: enqueuing or seating an account other than the caller, or being seated at a live table the caller is not entitled to join |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls join_matchmaking(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: enqueuing or seating an account other than the caller, or being seated at a live table the caller is not entitled to join.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 166. `F5.poll_matchmaking.280`

| | |
|---|---|
| Control | `public.poll_matchmaking#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call poll_matchmaking() while bob and carol also hold queue entries |
| Expected safe result | the returned entry is alice's own; no bob or carol queue identity appears in the result |
| Covers | [no_target] reports the caller's matchmaking progress and any room they have been assigned. Identity: caller from auth.uid(); no arguments. Reaches: public.matchmaking_queue and public.rooms across all accounts. LEGITIMATE shared effects: YES: expire_stale_queue_entries() again, and it reads the waiting population to decide whether a room can be formed. Escalation would be: returning another account's queue entry or room assignment, or assigning the caller into a room they were not matched to |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls poll_matchmaking(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: returning another account's queue entry or room assignment, or assigning the caller into a room they were not matched to.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 167. `F5.create_private_room.281`

| | |
|---|---|
| Control | `public.create_private_room#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call create_private_room(9) — outside the permitted 2..5 range |
| Expected safe result | error P0001, 'a private table seats between 2 and 5 players'; no rooms row is created |
| Covers | [no_target] creates a private room hosted by the caller. Identity: caller from auth.uid(); only the seat count comes from the argument. Reaches: public.rooms and public.room_members, plus enforce_rate_limit(). LEGITIMATE shared effects: YES: expire_stale_rooms() closes OTHER accounts' expired rooms, which is intended housekeeping. Escalation would be: creating a room hosted by another account, or bypassing the 2-to-5 seat bound, or bypassing the room_create rate limit |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls create_private_room(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: creating a room hosted by another account, or bypassing the 2-to-5 seat bound, or bypassing the room_create rate limit.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 168. `F5.claim_recovery_grant.282`

| | |
|---|---|
| Control | `public.claim_recovery_grant#security_definer` |
| Runs as | authenticated:alice |
| Operation | call claim_recovery_grant() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside claim_recovery_grant() past their own rows to claim the bankruptcy recovery grant into an account other than their own.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 169. `F5.delete_own_account.283`

| | |
|---|---|
| Control | `public.delete_own_account#security_definer` |
| Runs as | authenticated:alice |
| Operation | call delete_own_account() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside delete_own_account() past their own rows to trigger account deletion against somebody else's account.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 170. `F5.grant_earned_cosmetics.284`

| | |
|---|---|
| Control | `public.grant_earned_cosmetics#security_definer` |
| Runs as | authenticated:alice |
| Operation | call grant_earned_cosmetics() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside grant_earned_cosmetics() past their own rows to have cosmetic entitlements granted to an account other than the caller's.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 171. `F5.leave_matchmaking.285`

| | |
|---|---|
| Control | `public.leave_matchmaking#security_definer` |
| Runs as | authenticated:alice |
| Operation | call leave_matchmaking() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside leave_matchmaking() past their own rows to pull another player out of the matchmaking queue.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 172. `F5.list_blocked.286`

| | |
|---|---|
| Control | `public.list_blocked#security_definer` |
| Runs as | authenticated:alice |
| Operation | call list_blocked() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside list_blocked() past their own rows to see who a different account has blocked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 173. `F5.list_friend_requests.287`

| | |
|---|---|
| Control | `public.list_friend_requests#security_definer` |
| Runs as | authenticated:alice |
| Operation | call list_friend_requests() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside list_friend_requests() past their own rows to see the pending friend requests of a different account.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 174. `F5.list_friends.288`

| | |
|---|---|
| Control | `public.list_friends#security_definer` |
| Runs as | authenticated:alice |
| Operation | call list_friends() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside list_friends() past their own rows to enumerate a different account's friend list.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 175. `F5.my_active_session.289`

| | |
|---|---|
| Control | `public.my_active_session#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_active_session() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_active_session() past their own rows to discover which table a different player is currently sitting at.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 176. `F5.my_career_progress.290`

| | |
|---|---|
| Control | `public.my_career_progress#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_career_progress() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_career_progress() past their own rows to read a different account's career progression.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 177. `F5.my_competition_record.291`

| | |
|---|---|
| Control | `public.my_competition_record#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_competition_record() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_competition_record() past their own rows to read a different account's tournament and daily-challenge record.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 178. `F5.my_daily_entry.292`

| | |
|---|---|
| Control | `public.my_daily_entry#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_daily_entry() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_daily_entry() past their own rows to read a different account's daily-challenge attempt.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 179. `F5.my_inventory.293`

| | |
|---|---|
| Control | `public.my_inventory#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_inventory() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_inventory() past their own rows to enumerate a different account's cosmetic inventory.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 180. `F5.my_level_progress.294`

| | |
|---|---|
| Control | `public.my_level_progress#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_level_progress() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_level_progress() past their own rows to read a different account's level and XP standing.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 181. `F5.my_loadout.295`

| | |
|---|---|
| Control | `public.my_loadout#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_loadout() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_loadout() past their own rows to see what a different player has equipped.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 182. `F5.my_sprint_entry.296`

| | |
|---|---|
| Control | `public.my_sprint_entry#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_sprint_entry() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_sprint_entry() past their own rows to read a different account's live tournament position.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 183. `F5.my_strategy_accuracy_progress.297`

| | |
|---|---|
| Control | `public.my_strategy_accuracy_progress#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_strategy_accuracy_progress() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_strategy_accuracy_progress() past their own rows to read a different account's graded strategy accuracy.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 184. `F5.touch_last_seen.298`

| | |
|---|---|
| Control | `public.touch_last_seen#security_definer` |
| Runs as | authenticated:alice |
| Operation | call touch_last_seen() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside touch_last_seen() past their own rows to move a different account's last-seen timestamp, making a dormant account look active.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 185. `F5.unread_notification_count.299`

| | |
|---|---|
| Control | `public.unread_notification_count#security_definer` |
| Runs as | authenticated:alice |
| Operation | call unread_notification_count() as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside unread_notification_count() past their own rows to learn how many unread notifications a different account is holding.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 186. `F5.enforce_rate_limit.300`

| | |
|---|---|
| Control | `public.enforce_rate_limit#security_definer` |
| Runs as | authenticated:alice |
| Operation | call enforce_rate_limit(p_action text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside enforce_rate_limit() past their own rows to consume — or reset — a different account's rate-limit budget.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 187. `F5.my_leaderboard_position.301`

| | |
|---|---|
| Control | `public.my_leaderboard_position#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_leaderboard_position(p_category text) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_leaderboard_position() past their own rows to read a different account's private leaderboard standing.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 188. `F5.my_notifications.302`

| | |
|---|---|
| Control | `public.my_notifications#security_definer` |
| Runs as | authenticated:alice |
| Operation | call my_notifications(p_limit integer) as alice while bob's and carol's rows are present in every table it reads |
| Expected safe result | only alice's own rows are returned or altered; no bob or carol row appears in the result or changes |
| Covers | [no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rides the definer privilege inside my_notifications() past their own rows to read a different account's notifications.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F6 column-level leakage — 6 sentences needed

#### 189. `F6.public_daily_challenges.046`

| | |
|---|---|
| Control | `public.daily_challenges#colgrant:SELECT` |
| Runs as | authenticated:alice |
| Operation | SELECT seed_secret from public.daily_challenges |
| Expected safe result | error 42501 — no column-level SELECT privilege on that column |
| Covers | the confidentiality boundary INSIDE a readable row: seed_secret is excluded from every client SELECT grant. A row-level check cannot see this, and a table-level one cannot either |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player reads seed_secret out of a public.daily_challenges row they are otherwise entitled to see, taking a column that is withheld from every client grant even where the row itself is permitted.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 190. `F6.public_friend_requests.062`

| | |
|---|---|
| Control | `public.friend_requests#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.friend_requests set id = '00000000-0000-4000-8000-0000000000ff' where receiver_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, sender_id, receiver_id, created_at, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes id on a public.friend_requests row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 191. `F6.public_loadouts.118`

| | |
|---|---|
| Control | `public.loadouts#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.loadouts set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, created_at, updated_at) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes id on a public.loadouts row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 192. `F6.public_notifications.129`

| | |
|---|---|
| Control | `public.notifications#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.notifications set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, kind, title, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes id on a public.notifications row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 193. `F6.public_profiles.154`

| | |
|---|---|
| Control | `public.profiles#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.profiles set id = '00000000-0000-4000-8000-0000000000ff' where id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, level, xp, username_changed_at, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes id on a public.profiles row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 194. `F6.public_push_tokens.165`

| | |
|---|---|
| Control | `public.push_tokens#colgrant:UPDATE` |
| Runs as | authenticated:alice |
| Operation | UPDATE public.push_tokens set id = '00000000-0000-4000-8000-0000000000ff' where user_id = fixtures.alice.id |
| Expected safe result | error 42501 — no column-level UPDATE privilege on that column |
| Covers | a column deliberately excluded from the client UPDATE grant (id, user_id, token, platform, …) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes id on a public.push_tokens row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F8 realtime channel authorization — 5 sentences needed

#### 195. `F8.realtime_messages.308`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_game_topic_is_for_its_seated_players` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to fixtures.session.topic, then select from realtime.messages |
| Expected safe result | no data — carol holds no seat at that game |
| Covers | the EXISTS branch unsatisfied: the seeded non-participant. This is why the seed seats two of three accounts. Both drivers are falsified — the seat subquery finds no row for carol, and the sibling permissive policy arc21_presence_roster_needs_an_account is falsified too because realtime.topic() is the game topic and not 'presence:players', so the refusal reflects effective authorization across both policies |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table reads the Realtime traffic of a game topic at the SQL layer, obtaining the broadcasts belonging to a table they hold no seat at.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 196. `F8.realtime_messages.310`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_presence_roster_needs_an_account` |
| Runs as | anon |
| Operation | set realtime.topic to fixtures.presenceTopic, then select from realtime.messages |
| Expected safe result | no data — no policy on realtime.messages names anon |
| Covers | the presence read branch for a signed-out socket, exercising the latent anon grant. realtime.topic() matches this policy's predicate exactly, so the refusal is not the predicate failing — it is that neither this policy nor the sibling arc21_game_topic_is_for_its_seated_players names anon, which is effective authorization across both permissive policies |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Someone with no account at all reads the presence roster over Realtime, using a grant that reaches the table even though no policy names them.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 197. `F8.realtime_messages.312`

| | |
|---|---|
| Control | `realtime.messages#policy:arc21_only_presence_may_be_written_by_a_client` |
| Runs as | authenticated:carol |
| Operation | set realtime.topic to the game topic, then insert into realtime.messages |
| Expected safe result | error 42501 — no insert policy admits a game topic |
| Covers | the WITH CHECK branch unsatisfied: the fabricated-state injection Arc21 measured against a running stack before these policies existed |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table writes a message onto a game topic at the SQL layer, injecting fabricated state into a channel only the server should broadcast on.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 198. `F8i.realtime_messages.314`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | subscribe to that same private channel fixtures.session.topic using fixtures.carolJwt, who holds no seat |
| Expected safe result | the subscription is refused, or is accepted and delivers nothing; carol's client must receive no game payload |
| Covers | the brief's family 8 question in its literal form — can a client subscribe to another user's channel — exercised through the socket rather than through SQL |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table subscribes to another table's private Realtime channel through a real websocket client and receives that game's live payloads.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 199. `F8i.realtime_messages.315`

| | |
|---|---|
| Control | `realtime.messages#realtime-socket` |
| Runs as | authenticated:carol |
| Operation | publish a `state` broadcast to fixtures.session.topic over the websocket as carol |
| Expected safe result | refused; no other subscriber receives a carol-originated state message |
| Covers | the fabricated-state injection Arc21 measured against a running stack before these policies existed, retested at the layer where it actually happened |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player holding no seat at that table publishes a fabricated game-state broadcast onto another table's Realtime channel through a real websocket client, so the players at that table act on a message the server never sent.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F9 wallet / concurrency integrity — 6 sentences needed

#### 200. `F9.public_wallets.317`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta, same key twice) |
| Operation | call apply_wallet_delta twice with the SAME idempotency key |
| Expected safe result | exactly one ledger row and one balance movement — the second call is a no-op, not a second credit |
| Covers | the retry path: Arc21's invariant is that retries cannot debit or credit twice. This is the control private.game_commands and the ledger's unique idempotency key exist to provide |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A retry on the server's own chip-movement path is applied twice under one idempotency key, so a single credit or debit lands on the balance two times.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 201. `F9.public_wallets.318`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (apply_wallet_delta over-debit) |
| Operation | call apply_wallet_delta with a debit larger than the balance |
| Expected safe result | refusal — balances stay non-negative (a CHECK constraint violation, SQLSTATE 23514) |
| Covers | the non-negative-balance invariant, which is enforced as a database constraint rather than in application code |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A debit larger than the balance is pushed through the server's chip-movement path and drives an account negative, manufacturing value the economy never issued.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 202. `F9.public_wallets.319`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — UPDATE is rejected by wallet_ledger_append_only |
| Covers | append-only enforcement on the economy history, exercised as an ordinary client. The ledger is the authoritative source wallets.balance is recomputed from, which is why WP2 rated its reversibility High |
| Pending author decision | registered contradiction `C2-grant-before-trigger`: the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player rewrites a settled entry in their own chip ledger, altering the authoritative history their balance is derived from.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 203. `F9.public_wallets.320`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | update public.wallet_ledger set delta = 1 where user_id = fixtures.alice.id |
| Expected safe result | error — the trigger raises for every role, not only client roles |
| Covers | the same statement from the SERVER side. A separate Test ID because it is a separate identity and a materially different claim: the guard is not merely a client-role check but applies to the privileged path too, which is what makes the ledger authoritative |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> The server's own privileged connection rewrites a settled ledger entry, treating the append-only economy history as editable from the trusted side.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 204. `F9.public_wallets.321`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | authenticated:alice |
| Operation | truncate public.wallet_ledger |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | TRUNCATE is not reachable through a row policy at all, so a trigger is the only thing that can refuse it. Exercised as an ordinary client |
| Pending author decision | registered contradiction `C2-grant-before-trigger`: the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player empties the chip ledger with a TRUNCATE, which no row policy can refuse, destroying the economy's authoritative history.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 205. `F9.public_wallets.322`

| | |
|---|---|
| Control | `public.wallets#integrity` |
| Runs as | server-side (direct Postgres connection) |
| Operation | truncate public.wallet_ledger |
| Expected safe result | error — refused by wallet_ledger_deny_truncate |
| Covers | the same TRUNCATE from the SERVER side, as its own Test ID for the same reason as the UPDATE pair above |
| Pending author decision | registered contradiction `C2-fk-before-truncate-trigger`: TRUNCATE of a table another table references is refused by PostgreSQL's foreign-key check (0A000) before BEFORE TRUNCATE triggers fire, so wallet_ledger_deny_truncate is never reached by the approved statement — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> The server's own privileged connection empties the chip ledger, destroying the authoritative history every balance is recomputed from.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## F10 audit trail — 12 sentences needed

#### 206. `F10.private_game_commands.013`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player edits the accepted-command trail so it reports something other than what actually happened.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 207. `F10.private_game_commands.014`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player deletes entries from the accepted-command trail to remove the trace of something they did.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 208. `F10.private_game_commands.015`

| | |
|---|---|
| Control | `private.game_commands#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE private.game_commands |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player wipes out the accepted-command trail, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 209. `F10.public_game_events.080`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player edits the delivered event stream so it reports something other than what actually happened.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 210. `F10.public_game_events.081`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player deletes entries from the delivered event stream to remove the trace of something they did.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 211. `F10.public_game_events.082`

| | |
|---|---|
| Control | `public.game_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.game_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player wipes out the delivered event stream, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 212. `F10.public_rate_limit_events.172`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player edits the trail of attempts an account has already made so it reports something other than what actually happened.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 213. `F10.public_rate_limit_events.173`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player deletes entries from the trail of attempts an account has already made to remove the trace of something they did.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 214. `F10.public_rate_limit_events.174`

| | |
|---|---|
| Control | `public.rate_limit_events#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.rate_limit_events |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player wipes out the trail of attempts an account has already made, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 215. `F10.public_wallet_ledger.233`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:UPDATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, UPDATE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via UPDATE specifically: rejected for all roles by the append-only guard where one exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player edits the chip ledger so it reports something other than what actually happened.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 216. `F10.public_wallet_ledger.234`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:DELETE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, DELETE one row of public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via DELETE specifically: the row-level and trigger path for removal |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player deletes entries from the chip ledger to remove the trace of something they did.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 217. `F10.public_wallet_ledger.235`

| | |
|---|---|
| Control | `public.wallet_ledger#audit:immutable:TRUNCATE` |
| Runs as | authenticated:alice |
| Operation | as an ordinary client, TRUNCATE public.wallet_ledger |
| Expected safe result | error 42501 — the trail is not client-modifiable by this statement |
| Covers | can a user modify or delete the record, via TRUNCATE specifically: row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player wipes out the chip ledger, in one statement and by a route no row policy can intercept, removing the evidence of their own activity.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

## B boundary cases — 23 sentences needed

#### 218. `B.private_game_commands.323`

| | |
|---|---|
| Control | `private.game_commands#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from private.game_commands where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach the replay-protection ledger recording which commands the server has already accepted.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 219. `B.public_blocks.324`

| | |
|---|---|
| Control | `public.blocks#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.blocks |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 220. `B.public_blocks.325`

| | |
|---|---|
| Control | `public.blocks#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.blocks where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 221. `B.public_friend_requests.326`

| | |
|---|---|
| Control | `public.friend_requests#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.friend_requests |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches a friend request between two other people.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 222. `B.public_friend_requests.327`

| | |
|---|---|
| Control | `public.friend_requests#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.friend_requests where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach a friend request between two other people.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 223. `B.public_friendships.328`

| | |
|---|---|
| Control | `public.friendships#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.friendships |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 224. `B.public_friendships.329`

| | |
|---|---|
| Control | `public.friendships#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.friendships where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 225. `B.public_game_events.330`

| | |
|---|---|
| Control | `public.game_events#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.game_events |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches the live event stream of a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 226. `B.public_game_events.331`

| | |
|---|---|
| Control | `public.game_events#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_events where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach the live event stream of a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 227. `B.public_game_session_seats.332`

| | |
|---|---|
| Control | `public.game_session_seats#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_session_seats where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach who is seated at a table, and each player's stack and buy-in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 228. `B.public_game_sessions.333`

| | |
|---|---|
| Control | `public.game_sessions#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_sessions where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach a live table's metadata.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 229. `B.public_profiles.334`

| | |
|---|---|
| Control | `public.profiles#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.profiles |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches a profile the viewer is not entitled to see.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 230. `B.public_profiles.335`

| | |
|---|---|
| Control | `public.profiles#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.profiles where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach a profile the viewer is not entitled to see.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 231. `B.public_rate_limit_events.336`

| | |
|---|---|
| Control | `public.rate_limit_events#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.rate_limit_events where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach another account's rate-limit history, learning what they have been doing and how often.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 232. `B.public_room_members.337`

| | |
|---|---|
| Control | `public.room_members#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.room_members where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach the membership of a private room.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 233. `B.public_rooms.338`

| | |
|---|---|
| Control | `public.rooms#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.rooms where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach a private room's metadata, including the join code that gets someone in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 234. `B.public_tournament_entries.339`

| | |
|---|---|
| Control | `public.tournament_entries#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.tournament_entries |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches the entries and standings of a tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 235. `B.public_tournament_entries.340`

| | |
|---|---|
| Control | `public.tournament_entries#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.tournament_entries where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach the entries and standings of a tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 236. `B.public_wallet_ledger.341`

| | |
|---|---|
| Control | `public.wallet_ledger#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.wallet_ledger |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 237. `B.public_wallet_ledger.342`

| | |
|---|---|
| Control | `public.wallet_ledger#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.wallet_ledger where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 238. `B.public_wallets.343`

| | |
|---|---|
| Control | `public.wallets#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.wallets |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches another player's chip balance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 239. `B.public_wallets.344`

| | |
|---|---|
| Control | `public.wallets#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.wallets where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token that outlived the account it was issued for is replayed, so a deleted user's credentials still reach another player's chip balance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 240. `B.suite.expired-session`

| | |
|---|---|
| Control | `PostgREST / GoTrue JWT verification` |
| Runs as | an expired JWT presented over HTTP |
| Operation | issue an authenticated request to the local PostgREST endpoint with an expired token |
| Expected safe result | HTTP 401 — rejected at the API boundary before any statement reaches PostgreSQL |
| Covers | the brief's expired-session boundary. Counted once for the suite rather than per resource, because an expired JWT never arrives at the database: PostgREST verifies and rejects it first, so there is no per-resource control to exercise and pretending otherwise would claim PostgreSQL enforced something it never saw |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A session token whose expiry has already passed is replayed against the API, so an account that has been signed out for hours keeps acting as though it were still signed in.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*
