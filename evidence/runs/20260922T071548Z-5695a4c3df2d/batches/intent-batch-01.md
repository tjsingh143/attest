# AUTHOR INTENT — batch 1 of 13

**F1 (1–25 of 29)** · 25 rows · run `20260922T071548Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F1.public_blocks.023`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.blocks where blocker_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of blocks_select_own falsified. ownership on blocker_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F1.public_career_attempts.032`

| | |
|---|---|
| Control | `public.career_attempts#policy:career_attempts_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.career_attempts where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of career_attempts_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F1.public_career_progress.037`

| | |
|---|---|
| Control | `public.career_progress#policy:career_progress_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.career_progress where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of career_progress_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F1.public_daily_entries.051`

| | |
|---|---|
| Control | `public.daily_entries#policy:daily_entries_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.daily_entries where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of daily_entries_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 5. `F1.public_friend_requests.054`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_select_participants` |
| Runs as | authenticated:alice |
| Operation | select from public.friend_requests for a row where NONE of sender_id, receiver_id is fixtures.alice.id — the bob↔carol row |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of friend_requests_select_participants falsified. ownership on sender_id OR receiver_id; a row naming alice in either column is legitimately visible to her, so the negative must name neither |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 6. `F1.public_friendships.066`

| | |
|---|---|
| Control | `public.friendships#policy:friendships_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.friendships for a row where NONE of user_id_a, user_id_b is fixtures.alice.id — the bob↔carol row |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of friendships_select_own falsified. ownership on user_id_a OR user_id_b; a row naming alice in either column is legitimately visible to her, so the negative must name neither |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 7. `F1.public_game_events.073`

| | |
|---|---|
| Control | `public.game_events#policy:game_events_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_events for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_events_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none. The predicate is a conjunction of participation AND (public OR recipient), so the positive uses a public row and the negative falsifies the participation conjunct |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 8. `F1.public_game_session_seats.084`

| | |
|---|---|
| Control | `public.game_session_seats#policy:game_session_seats_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_session_seats for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_session_seats_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 9. `F1.public_game_sessions.092`

| | |
|---|---|
| Control | `public.game_sessions#policy:game_sessions_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.game_sessions for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of game_sessions_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 10. `F1.public_hand_players.100`

| | |
|---|---|
| Control | `public.hand_players#policy:hand_players_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.hand_players for that same game session fixtures.session.id — and the row selected belongs to alice, so carol falsifies BOTH disjuncts (user_id is not carol, and carol is not a participant) |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of hand_players_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none. The predicate is a disjunction, so the negative must falsify every branch |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 11. `F1.public_hand_records.103`

| | |
|---|---|
| Control | `public.hand_records#policy:hand_records_select_participant` |
| Runs as | authenticated:carol |
| Operation | select from public.hand_records for that same game session fixtures.session.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of hand_records_select_participant falsified. access is decided by is_session_participant(), not by any column on this table. Alice holds a live seat at that session; carol holds none |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 12. `F1.public_loadouts.111`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.loadouts where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of loadouts_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 13. `F1.public_matchmaking_queue.120`

| | |
|---|---|
| Control | `public.matchmaking_queue#policy:matchmaking_queue_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.matchmaking_queue where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of matchmaking_queue_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 14. `F1.public_notifications.123`

| | |
|---|---|
| Control | `public.notifications#policy:notifications_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.notifications where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of notifications_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 15. `F1.public_player_actions.131`

| | |
|---|---|
| Control | `public.player_actions#policy:player_actions_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_actions where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_actions_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 16. `F1.public_player_daily_xp.134`

| | |
|---|---|
| Control | `public.player_daily_xp#policy:player_daily_xp_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_daily_xp where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_daily_xp_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 17. `F1.public_player_decision_periods.137`

| | |
|---|---|
| Control | `public.player_decision_periods#policy:player_decision_periods_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_decision_periods where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_decision_periods_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 18. `F1.public_player_mode_stats.140`

| | |
|---|---|
| Control | `public.player_mode_stats#policy:player_mode_stats_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_mode_stats where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_mode_stats_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 19. `F1.public_player_stats.143`

| | |
|---|---|
| Control | `public.player_stats#policy:player_stats_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.player_stats where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of player_stats_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 20. `F1.public_profiles.146`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_select_self` |
| Runs as | authenticated:alice |
| Operation | select from public.profiles where id = fixtures.dave.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of profiles_select_self falsified. ownership on id. Dave is the negative rather than bob because the OTHER permissive SELECT policy (profiles_select_visible) admits bob's public profile, so a bob fixture would not isolate a refusal |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 21. `F1.public_profiles.148`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_select_visible` |
| Runs as | authenticated:alice |
| Operation | select from public.profiles where id = fixtures.dave.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of profiles_select_visible falsified. this policy is a conjunction of privacy, block and friendship terms. Bob satisfies it (privacy = 'public', no block either way); dave falsifies it because alice has blocked him and the policy requires NOT viewer_has_blocked(id). Bob would NOT work as the negative — his public profile is legitimately visible. The OTHER permissive SELECT policy on profiles, profiles_select_self, is also falsified because dave's id is not alice's, so the refusal reflects effective authorization across both |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 22. `F1.public_push_tokens.158`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.push_tokens where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of push_tokens_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 23. `F1.public_room_members.182`

| | |
|---|---|
| Control | `public.room_members#policy:room_members_select_same_room` |
| Runs as | authenticated:carol |
| Operation | select from public.room_members for that same room fixtures.roomAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of room_members_select_same_room falsified. access is decided by caller_is_room_member() — shared room membership, not ownership. host_user_id does not appear in this predicate |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 24. `F1.public_rooms.190`

| | |
|---|---|
| Control | `public.rooms#policy:rooms_select_member` |
| Runs as | authenticated:carol |
| Operation | select from public.rooms for that same room fixtures.roomAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of rooms_select_member falsified. access is decided by caller_is_room_member() — shared room membership, not ownership. host_user_id does not appear in this predicate |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 25. `F1.public_tournament_entries.205`

| | |
|---|---|
| Control | `public.tournament_entries#policy:tournament_entries_select_visible` |
| Runs as | authenticated:carol |
| Operation | select from public.tournament_entries for that same tournament fixtures.tournamentAliceBob.id — reading alice's entry, so carol falsifies both disjuncts (user_id is not carol, and carol is not in that tournament) |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of tournament_entries_select_visible falsified. access is decided by viewer_is_in_tournament() — shared tournament membership. Disjunction, so both branches must be falsified |

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
