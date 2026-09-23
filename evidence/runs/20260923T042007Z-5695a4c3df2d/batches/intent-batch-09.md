# AUTHOR INTENT — batch 9 of 13

**F5 (1–25 of 57)** · 25 rows · run `20260923T042007Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F5.remove_room_member.245`

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

#### 2. `F5.get_room_state.246`

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

#### 3. `F5.set_room_ready.247`

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

#### 4. `F5.invite_friend_to_room.248`

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

#### 5. `F5.leave_room.249`

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

#### 6. `F5.equip_cosmetic.250`

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

#### 7. `F5.mark_notifications_read.251`

| | |
|---|---|
| Control | `public.mark_notifications_read#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call mark_notifications_read(ARRAY[fixtures.bobNotification.id]) |
| Expected safe result | returns 0 and bob's notification read_at stays null — the body scopes its UPDATE with `where user_id = v_me` |
| Covers | [target_resource] a user marks their own notifications read. Identity: caller from auth.uid(); the notification ids come from the argument. Reaches: public.notifications. Escalation would be: marking another account's notification read, or learning that an id exists |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls mark_notifications_read() naming a notification ids that is not theirs, getting its owner privilege to do what the caller's own policies forbid: marking another account's notification read, or learning that an id exists.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 8. `F5.caller_is_room_member.252`

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

#### 9. `F5.is_session_participant.253`

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

#### 10. `F5.sprint_standings.254`

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

#### 11. `F5.viewer_is_in_tournament.256`

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

#### 12. `F5.accept_friend_request.257`

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

#### 13. `F5.decline_friend_request.258`

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

#### 14. `F5.send_friend_request.259`

| | |
|---|---|
| Control | `public.send_friend_request#security_definer` |
| Runs as | authenticated:alice |
| Operation | as alice, call send_friend_request(fixtures.dave.id), whom alice has blocked |
| Expected safe result | refusal — friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id) |
| Covers | [target_user] a user sends a request to another account. Identity: caller from auth.uid() is the sender; the recipient comes from the argument. Reaches: public.friend_requests. Escalation would be: sending as somebody else, or sending to an account that has blocked the caller |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player calls send_friend_request() naming a recipient that is not theirs, getting its owner privilege to do what the caller's own policies forbid: sending as somebody else, or sending to an account that has blocked the caller.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 15. `F5.block_player.260`

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

#### 16. `F5.unblock_player.261`

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

#### 17. `F5.remove_friend.262`

| | |
|---|---|
| Control | `public.remove_friend#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call remove_friend(fixtures.bob.id) when the friendship is alice↔bob |
| Expected safe result | no effect; the alice↔bob friendship survives |
| Covers | [target_user] a user removes their own friendship. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.friendships. Escalation would be: dissolving a friendship the caller is not part of |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls remove_friend() naming a other party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: dissolving a friendship the caller is not part of.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 18. `F5.player_public_profile.263`

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

#### 19. `F5.player_public_profile.264`

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

#### 20. `F5.viewer_is_friend_of.265`

| | |
|---|---|
| Control | `public.viewer_is_friend_of#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_is_friend_of(fixtures.bob.id) when the friendship is alice↔bob |
| Expected safe result | returns FALSE |
| Covers | [target_user] a helper reporting whether the caller is friends with an account. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.friendships. Escalation would be: returning true where no friendship exists, which would widen profiles_select_visible |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_is_friend_of() naming a other party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: returning true where no friendship exists, which would widen profiles_select_visible.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 21. `F5.viewer_has_blocked.266`

| | |
|---|---|
| Control | `public.viewer_has_blocked#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_has_blocked(fixtures.dave.id) when the block is alice→dave |
| Expected safe result | returns FALSE — carol has blocked nobody |
| Covers | [target_user] a helper reporting whether the caller has blocked an account. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.blocks. Escalation would be: reporting another account's block list |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_has_blocked() naming a other party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: reporting another account's block list.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 22. `F5.viewer_is_blocked_by.267`

| | |
|---|---|
| Control | `public.viewer_is_blocked_by#security_definer` |
| Runs as | authenticated:carol |
| Operation | as carol, call viewer_is_blocked_by(fixtures.alice.id) when the block is alice→dave |
| Expected safe result | returns FALSE |
| Covers | [target_user] a helper reporting whether an account has blocked the caller. Identity: caller from auth.uid(); the other party comes from the argument. Reaches: public.blocks. Escalation would be: letting a caller enumerate who has blocked whom beyond their own position |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player with no claim on it calls viewer_is_blocked_by() naming a other party that is not theirs, getting its owner privilege to do what the caller's own policies forbid: letting a caller enumerate who has blocked whom beyond their own position.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 23. `F5.retire_push_token.268`

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

#### 24. `F5.register_push_token.269`

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

#### 25. `F5.join_private_room.270`

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
