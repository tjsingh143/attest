# AUTHOR INTENT — batch 10 of 13

**F5 (26–50 of 57)** · 25 rows · run `20260922T234324Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F5.leaderboard_weekly_xp.271`

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

#### 2. `F5.leaderboard_weekly_xp.272`

| | |
|---|---|
| Control | `public.leaderboard_weekly_xp#security_definer` |
| Runs as | authenticated:alice **— must actually run as anon; see contradiction C1** |
| Operation | as anon, call leaderboard_weekly_xp(10, 0) |
| Expected safe result | error 42501 — EXECUTE is granted to authenticated and must not be reachable by anon |
| Covers | [public_projection] the same function, exercising who may call it rather than what it returns. Identity: no identity at all — the probe runs as anon. Reaches: public.player_daily_xp and profiles aggregated across all accounts. Escalation would be: being callable without an account. WP0's own pgTAP gate treats granting this to anon as a breach |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> Someone with no account at all executes leaderboard_weekly_xp(), which is granted to signed-in callers only, and reads aggregated data across every account without ever holding one.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `F5.leaderboard_daily_challenge.273`

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

#### 4. `F5.leaderboard_strategy_accuracy.274`

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

#### 5. `F5.leaderboard_tournament_wins.275`

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

#### 6. `F5.search_players.276`

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

#### 7. `F5.ensure_todays_daily_challenge.277`

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

#### 8. `F5.latest_verifiable_daily_challenge.278`

| | |
|---|---|
| Control | `public.latest_verifiable_daily_challenge#security_definer` |
| Runs as | anon |
| Operation | as anon, call latest_verifiable_daily_challenge() while one revealed and one unrevealed challenge both exist |
| Expected safe result | exactly the revealed challenge is returned; the unrevealed one does not appear, and no seed_secret column is exposed |
| Covers | [no_target] publishes the most recent challenge whose seed has already been revealed, so a past shoe can be verified. Identity: NONE — this function does not read auth.uid(). It is deliberately callable without an account. Reaches: public.daily_challenges, selecting challenge_date, seed_commitment, revealed_seed, seed_revealed_at. LEGITIMATE shared effects: YES: it returns a row that belongs to no account and is meant to be public. There is no caller-scoping to assert. Escalation would be: returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-out visitor calls latest_verifiable_daily_challenge(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 9. `F5.join_matchmaking.279`

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

#### 10. `F5.poll_matchmaking.280`

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

#### 11. `F5.create_private_room.281`

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

#### 12. `F5.claim_recovery_grant.282`

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

#### 13. `F5.delete_own_account.283`

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

#### 14. `F5.grant_earned_cosmetics.284`

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

#### 15. `F5.leave_matchmaking.285`

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

#### 16. `F5.list_blocked.286`

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

#### 17. `F5.list_friend_requests.287`

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

#### 18. `F5.list_friends.288`

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

#### 19. `F5.my_active_session.289`

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

#### 20. `F5.my_career_progress.290`

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

#### 21. `F5.my_competition_record.291`

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

#### 22. `F5.my_daily_entry.292`

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

#### 23. `F5.my_inventory.293`

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

#### 24. `F5.my_level_progress.294`

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

#### 25. `F5.my_loadout.295`

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
