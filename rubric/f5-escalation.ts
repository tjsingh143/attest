/**
 * Attest — F5 escalation specification, per function.
 *
 * A SECURITY DEFINER function executes with its owner's privileges, so the
 * caller's policies stop applying inside it. The control is therefore the
 * function's own argument handling, and there is no single test shape for that.
 *
 * The first WP3 plan emitted 37 copies of "pass Bob's resource as an argument".
 * That was wrong three ways: roughly half of these functions take no
 * user-controlled target at all, several are cross-user BY DESIGN so expecting
 * "no data" would have failed a working control, and the safe outcomes differ —
 * some raise 42501, one raises PT404, one returns `false`, one returns a count
 * of 0, and the boolean helpers return `false`.
 *
 * Classes below are derived from catalog signals (does the body read
 * auth.uid(); does it raise; does it return false; does the signature carry a
 * uuid) plus reads of the bodies where the signal was ambiguous.
 */

export type EscalationClass =
  /** A uuid naming a room/session/tournament/row the caller may not be entitled to. */
  | "target_resource"
  /** A uuid naming another account. Cross-user by design; must still be authorized. */
  | "target_user"
  /** A non-uuid argument that could name another account's resource (a token, a room code). */
  | "target_opaque"
  /** Intentionally returns other accounts' data. Escalation = leaking past the public projection. */
  | "public_projection"
  /** No user-controlled target. Identity derives solely from auth.uid(). */
  | "no_target";

export interface EscalationSpec {
  readonly fn: string;
  readonly args: string;
  readonly klass: EscalationClass;
  /** Intended caller and purpose. */
  readonly purpose: string;
  /** What identity comes from auth.uid() versus from an argument. */
  readonly identitySource: string;
  /** The privileged tables or actions it reaches past the caller's policies. */
  readonly privilegedReach: string;
  /** What outcome would constitute escalation. */
  readonly escalationWouldBe: string;
  /** The concrete attempt. */
  readonly attempt: string;
  /** The exact safe result. */
  readonly expectedSafe: string;
}

const G = (
  fn: string, args: string, klass: EscalationClass, purpose: string, identitySource: string,
  privilegedReach: string, escalationWouldBe: string, attempt: string, expectedSafe: string,
): EscalationSpec => ({ fn, args, klass, purpose, identitySource, privilegedReach, escalationWouldBe, attempt, expectedSafe });

const CALLER_ONLY = "caller from auth.uid(); no argument names an account or a resource";

export const F5_SPECS: readonly EscalationSpec[] = [
  // ---------------------------------------------------------------- target_resource
  G("remove_room_member", "p_room_id uuid, p_user_id uuid", "target_resource",
    "the room HOST removes another member from their own room, in the lobby only",
    "caller from auth.uid(); BOTH the room and the member come from arguments",
    "public.rooms and public.room_members, neither of which a client may write",
    "removing a member from a room the caller does not host",
    "as alice, call remove_room_member(fixtures.roomBobHosts.id, fixtures.bob.id)",
    "returns FALSE and bob's membership is unchanged. Not an error: the body returns false for a non-host so that a caller learns nothing about whether the room exists"),
  G("get_room_state", "p_room_id uuid", "target_resource",
    "a joined member reads the state of the room they are in",
    "caller from auth.uid(); the room comes from the argument",
    "public.rooms joined to public.room_members and public.profiles",
    "reading the roster, codes and seat layout of a room the caller has not joined",
    "as carol, call get_room_state(fixtures.roomAliceBob.id)",
    "error PT404 — the body raises 'you are not at that table'. Note this is NOT 42501; the 42501 in this function guards the null-identity path"),
  G("set_room_ready", "p_room_id uuid, p_ready boolean", "target_resource",
    "a joined member marks themselves ready",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members",
    "setting ready state in a room the caller is not a member of",
    "as carol, call set_room_ready(fixtures.roomAliceBob.id, true)",
    "refusal or no effect; carol's absence from room_members must be unchanged"),
  G("invite_friend_to_room", "p_room_id uuid, p_friend uuid", "target_resource",
    "a member invites one of their own friends into their room",
    "caller from auth.uid(); both the room and the invitee come from arguments",
    "public.room_members and the friendship graph",
    "inviting into a room the caller is not in, or inviting a non-friend",
    "as carol, call invite_friend_to_room(fixtures.roomAliceBob.id, fixtures.bob.id)",
    "refusal; no room_members row is created for bob"),
  G("leave_room", "p_room_id uuid", "target_resource",
    "a member leaves their own room",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members, public.rooms",
    "affecting a room the caller is not a member of",
    "as carol, call leave_room(fixtures.roomAliceBob.id)",
    "refusal or no effect; no other member's row is altered"),
  G("equip_cosmetic", "p_cosmetic_id uuid", "target_resource",
    "a player equips a cosmetic they own",
    "caller from auth.uid(); the cosmetic comes from the argument",
    "public.loadouts, validated against public.user_cosmetics",
    "equipping a cosmetic the caller does not own",
    "as alice, call equip_cosmetic(fixtures.unownedCosmetic.id)",
    "refusal — the loadouts_guard_slots trigger validates each slot against ownership and kind"),
  G("mark_notifications_read", "p_ids uuid[]", "target_resource",
    "a user marks their own notifications read",
    "caller from auth.uid(); the notification ids come from the argument",
    "public.notifications",
    "marking another account's notification read, or learning that an id exists",
    "as alice, call mark_notifications_read(ARRAY[fixtures.bobNotification.id])",
    "returns 0 and bob's notification read_at stays null — the body scopes its UPDATE with `where user_id = v_me`"),
  G("caller_is_room_member", "p_room_id uuid", "target_resource",
    "a helper the policies call to decide room membership",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members",
    "returning true for a room the caller is not in, which would widen every policy that calls it",
    "as carol, call caller_is_room_member(fixtures.roomAliceBob.id)",
    "returns FALSE. This function does not raise; false is the safe answer"),
  G("is_session_participant", "p_game_session_id uuid", "target_resource",
    "a helper six policies call to decide session participation",
    "caller from auth.uid(); the session comes from the argument",
    "public.game_session_seats",
    "returning true for a session the caller holds no seat at, which would widen five relations' policies at once",
    "as carol, call is_session_participant(fixtures.session.id)",
    "returns FALSE"),
  // RESOLVED against the body. Access is ENTRANTS ONLY, not public and not
  // authenticated-general: the function raises 42501 'you are not in that
  // tournament' when auth.uid() has no tournament_entries row for the id.
  // Intentionally exposed to a fellow entrant: entry_id, display_name, chips,
  // status, placement, eliminated_after_hand, in_tie_break, prize_chips,
  // prize_xp, and an is_you flag.
  G("sprint_standings", "p_tournament_id uuid", "target_resource",
    "an ENTRANT reads the standings of a tournament they have entered. Not public: the body requires a tournament_entries row for auth.uid()",
    "caller from auth.uid() gates access; the tournament comes from the argument",
    "public.tournament_entries joined to public.profiles, both past the caller's own policies",
    "a NON-ENTRANT reading the standings — other entrants' display names, chip stacks, placements and prize amounts for a tournament the caller never joined",
    "as carol, call sprint_standings(fixtures.tournamentAliceBob.id)",
    "error 42501, message 'you are not in that tournament'. Not an empty result: the body raises rather than returning zero rows"),
  // A second, sharper question about the same function, and a concrete one.
  G("sprint_standings", "p_tournament_id uuid (profiles join)", "target_resource",
    "the same function, examined for what its definer privilege exposes rather than for who may call it",
    "caller from auth.uid() gates ACCESS; the profiles join inside the body runs with the owner's privileges",
    "public.profiles directly, with NO block or privacy check — profiles_select_visible is not consulted because the function is SECURITY DEFINER",
    "a fellow entrant seeing the display_name of an account that has blocked them, or of a private-privacy account, which profiles_select_visible would have withheld",
    "seed alice and dave into the same tournament (the seed already has alice blocking dave), then as alice call sprint_standings(fixtures.tournamentAliceDave.id)",
    "dave's display_name IS returned. That is a definite prediction, not an open question: the body joins public.profiles with no block or privacy filter, and because the function is SECURITY DEFINER the caller's profiles_select_visible never runs. Recorded as a CHARACTERIZATION — co-entrants seeing each other's names in standings is plainly intended, so this is a fact for the WP5 narrative to weigh, not a control that passed or failed"),
  G("viewer_is_in_tournament", "p_tournament_id uuid", "target_resource",
    "a helper reporting whether the caller is in a tournament",
    "caller from auth.uid(); the tournament comes from the argument",
    "public.tournament_entries",
    "returning true for a tournament the caller has not entered",
    "as carol, call viewer_is_in_tournament(fixtures.tournamentAliceBob.id)",
    "returns FALSE"),

  // ---------------------------------------------------------------- target_user
  G("accept_friend_request", "p_from uuid", "target_user",
    "a REQUEST RECEIVER accepts a pending request sent to them",
    "caller from auth.uid() is the receiver; the sender comes from the argument",
    "public.friend_requests and public.friendships — and friendship widens profiles_select_visible",
    "accepting a request that was never sent to the caller, thereby manufacturing a friendship and the profile visibility it confers",
    "as carol, call accept_friend_request(fixtures.alice.id) when no request from alice to carol exists",
    "refusal or no effect; no friendships row appears between alice and carol"),
  G("decline_friend_request", "p_from uuid", "target_user",
    "a request receiver declines a pending request",
    "caller from auth.uid() is the receiver; the sender comes from the argument",
    "public.friend_requests",
    "declining a request addressed to somebody else",
    "as carol, call decline_friend_request(fixtures.alice.id) for a request alice sent to bob",
    "no effect on the alice→bob request"),
  G("send_friend_request", "p_to uuid", "target_user",
    "a user sends a request to another account",
    "caller from auth.uid() is the sender; the recipient comes from the argument",
    "public.friend_requests",
    "sending as somebody else, or sending to an account that has blocked the caller",
    "as alice, call send_friend_request(fixtures.dave.id), whom alice has blocked",
    // Gate A, C2-definer-bypasses-named-policy (D3.54). Approved as "refusal —
    // friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id)";
    // the function is SECURITY DEFINER, so that policy is never consulted and the
    // refusal is the body's own. The property (no request across a block) is unchanged.
    "error PT404 — the SECURITY DEFINER body raises 'no such player' because is_blocked_between(caller, receiver) holds"),
  G("block_player", "p_other uuid", "target_user",
    "a user blocks another account",
    "caller from auth.uid() is the blocker; the target comes from the argument",
    "public.blocks, and blocks feed profiles_select_visible",
    "creating a block attributed to another account, which would alter that account's visibility decisions",
    "as alice, call block_player(fixtures.bob.id) and verify the row is attributed to alice and not to bob",
    "one blocks row with blocker_id = alice. No row appears with blocker_id = bob"),
  G("unblock_player", "p_other uuid", "target_user",
    "a user removes their own block",
    "caller from auth.uid() is the blocker; the target comes from the argument",
    "public.blocks",
    "removing somebody else's block, which would widen what they can see",
    "as carol, call unblock_player(fixtures.dave.id) when the alice→dave block is the one that exists",
    "no effect; the alice→dave block survives"),
  G("remove_friend", "p_other uuid", "target_user",
    "a user removes their own friendship",
    "caller from auth.uid(); the other party comes from the argument",
    "public.friendships",
    "dissolving a friendship the caller is not part of",
    "as carol, call remove_friend(fixtures.bob.id) when the friendship is alice↔bob",
    "no effect; the alice↔bob friendship survives"),
  G("player_public_profile", "p_user_id uuid", "target_user",
    "any signed-in user reads another account's PUBLIC profile. Cross-user by design",
    "caller from auth.uid() decides visibility; the subject comes from the argument",
    "public.profiles past the caller's own policies",
    "returning a profile the caller should not see (private, or blocked in either direction), or returning friend-only fields to a non-friend",
    "as alice, call player_public_profile(fixtures.dave.id), whom alice has blocked",
    "returns NO rows — the body returns early on is_blocked_between, and nothing distinguishes 'they blocked you' from 'no such player'"),
  G("player_public_profile", "p_user_id uuid [non-friend projection]", "target_user",
    "the same function, exercising the projection rather than the refusal",
    "caller from auth.uid() decides which fields are returned; the subject comes from the argument",
    "public.profiles past the caller's own policies",
    "returning friend-only fields to a caller who is not a friend",
    "as alice, call player_public_profile(fixtures.bob.id) — a non-friend whose privacy is 'public'",
    "returns exactly ONE row carrying the non-friend projection. Expecting 'no data' here would fail a control that is working correctly: bob's public profile is meant to be visible"),
  G("viewer_is_friend_of", "p_other uuid", "target_user",
    "a helper reporting whether the caller is friends with an account",
    "caller from auth.uid(); the other party comes from the argument",
    "public.friendships",
    "returning true where no friendship exists, which would widen profiles_select_visible",
    "as carol, call viewer_is_friend_of(fixtures.bob.id) when the friendship is alice↔bob",
    "returns FALSE"),
  G("viewer_has_blocked", "p_other uuid", "target_user",
    "a helper reporting whether the caller has blocked an account",
    "caller from auth.uid(); the other party comes from the argument",
    "public.blocks",
    "reporting another account's block list",
    "as carol, call viewer_has_blocked(fixtures.dave.id) when the block is alice→dave",
    "returns FALSE — carol has blocked nobody"),
  G("viewer_is_blocked_by", "p_other uuid", "target_user",
    "a helper reporting whether an account has blocked the caller",
    "caller from auth.uid(); the other party comes from the argument",
    "public.blocks",
    "letting a caller enumerate who has blocked whom beyond their own position",
    "as carol, call viewer_is_blocked_by(fixtures.alice.id) when the block is alice→dave",
    "returns FALSE"),

  // ---------------------------------------------------------------- target_opaque
  G("retire_push_token", "p_token text", "target_opaque",
    "a device retires its own push token",
    "caller from auth.uid(); the token string comes from the argument",
    "public.push_tokens",
    "retiring another account's token — a denial of their notifications",
    "as alice, call retire_push_token('ExponentPushToken[attest-bob]')",
    "no effect; bob's token row stays is_active = true"),
  G("register_push_token", "p_token text, p_platform push_platform, p_device_id text, p_kinds notification_kind[]", "target_opaque",
    "a device registers itself for push",
    "caller from auth.uid() owns the row; the token string comes from the argument",
    "public.push_tokens, which has a unique constraint on token",
    // Gate A, O-269 (D3.54): approved as "…which would redirect their notifications to
    // the caller's device" — the reverse of what the body does. Corrected to the
    // consequence the source establishes; the verdict is not prejudged.
    "registering a token string already belonging to another account, which reassigns that device's registration to the caller: the token still identifies the same physical device, so its previous owner may stop receiving their notifications on it and notifications for the caller may be delivered to it instead",
    "as alice, call register_push_token('ExponentPushToken[attest-bob]', 'ios', ...)",
    "refusal, or a row attributed to alice that does NOT displace bob's. Bob's row must still exist with user_id = bob"),
  G("join_private_room", "p_code text", "target_opaque",
    "a user joins a private room using its code",
    "caller from auth.uid(); the room code comes from the argument",
    "public.rooms and public.room_members",
    "joining without a valid code, or a code-guessing oracle that distinguishes 'wrong code' from 'room full'",
    "as carol, call join_private_room('fixtures.nonexistentRoomCode')",
    "refusal that does not distinguish a non-existent room from an ineligible one"),

  // ---------------------------------------------------------------- public_projection
  G("leaderboard_weekly_xp", "p_limit integer, p_offset integer", "public_projection",
    "any signed-in user reads the weekly XP leaderboard. Cross-user by design",
    "caller from auth.uid(); no target argument — limit and offset only",
    "public.player_daily_xp and profiles aggregated across all accounts",
    "returning a private-privacy account's identity, or being callable without an account at all. WP0's own pgTAP gate treats granting this to anon as a breach",
    "as alice, call leaderboard_weekly_xp(10, 0) and inspect every returned column",
    "a public-safe projection only: no private-privacy account identity and no column beyond what a leaderboard needs"),
  G("leaderboard_weekly_xp", "p_limit integer, p_offset integer [anon reachability]", "public_projection",
    "the same function, exercising who may call it rather than what it returns",
    "no identity at all — the probe runs as anon",
    "public.player_daily_xp and profiles aggregated across all accounts",
    "being callable without an account. WP0's own pgTAP gate treats granting this to anon as a breach",
    "as anon, call leaderboard_weekly_xp(10, 0)",
    "error 42501 — EXECUTE is granted to authenticated and must not be reachable by anon"),
  G("leaderboard_daily_challenge", "p_date date, p_limit integer, p_offset integer", "public_projection",
    "any signed-in user reads a day's challenge leaderboard",
    "caller from auth.uid(); the date and paging come from arguments",
    "public.daily_entries and profiles across all accounts",
    "returning a private account's identity, or leaking seed_secret through the join",
    "as alice, call it for the seeded challenge date and inspect every returned column",
    "a public-safe projection; no seed_secret and no private-privacy identity"),
  G("leaderboard_strategy_accuracy", "p_limit integer, p_offset integer", "public_projection",
    "any signed-in user reads the strategy-accuracy leaderboard",
    "caller from auth.uid(); paging only",
    "public.player_decision_periods across all accounts",
    "returning a private account's identity",
    "as alice, call it and inspect the projection",
    "a public-safe projection only"),
  G("leaderboard_tournament_wins", "p_limit integer, p_offset integer", "public_projection",
    "any signed-in user reads the tournament-wins leaderboard",
    "caller from auth.uid(); paging only",
    "public.tournament_entries across all accounts",
    "returning a private account's identity",
    "as alice, call it and inspect the projection",
    "a public-safe projection only"),
  G("search_players", "p_query text", "public_projection",
    "a user searches for other accounts by handle",
    "caller from auth.uid(); the query string comes from the argument",
    "public.profiles across all accounts",
    "returning private-privacy accounts, or accounts blocked in either direction",
    "as alice, call search_players('dave'), whom alice has blocked",
    "dave must not appear in the results"),
];

/**
 * Functions with no caller-supplied target.
 *
 * `no_target` means only that: no argument names an account or a resource. It
 * does NOT mean the function touches only caller-owned data, and the generic
 * rule "bob's and carol's rows must never change" is wrong for several of
 * these. Three legitimately mutate other accounts' rows —
 * `expire_stale_queue_entries()` and `expire_stale_rooms()` are housekeeping
 * that runs on whatever is stale — and one does not read `auth.uid()` at all.
 *
 * So each records its own security invariant.
 */
export interface NoTargetSpec {
  readonly fn: string;
  readonly purpose: string;
  readonly identitySource: string;
  readonly privileged: string;
  /** Shared or cross-user effects that are legitimate and must not be flagged. */
  readonly legitimateSharedEffects: string;
  readonly escalationWouldBe: string;
  readonly attempt: string;
  readonly expectedSafe: string;
}

const N = (
  fn: string, purpose: string, identitySource: string, privileged: string,
  legitimateSharedEffects: string, escalationWouldBe: string, attempt: string, expectedSafe: string,
): NoTargetSpec => ({ fn, purpose, identitySource, privileged, legitimateSharedEffects, escalationWouldBe, attempt, expectedSafe });

const CALLER_SCOPED =
  "none — this function reads and writes only rows keyed to auth.uid()";

export const F5_NO_TARGET_SPECS: readonly NoTargetSpec[] = [
  N("ensure_todays_daily_challenge()",
    "mints today's daily challenge if it does not exist, and returns its public projection",
    "auth.uid() must be non-null; nothing else is taken from the caller",
    "public.daily_challenges including seed_secret, via ensure_daily_challenge_for() and reveal_closed_daily_seeds()",
    "YES, and substantial: it CREATES a global daily_challenges row every account then plays, and reveal_closed_daily_seeds() mutates rows belonging to no one in particular. Both are intended. A rule requiring 'no shared row changes' would flag correct behaviour",
    "returning seed_secret to the caller, or revealing the seed of a challenge that is still OPEN — either would let a caller know the shoe before playing it",
    "as alice, call ensure_todays_daily_challenge() while today's challenge is open, and inspect every returned column; then read daily_challenges.revealed_seed and seed_revealed_at for today's row",
    "the returned record is the daily_challenges_public projection, which has no seed_secret column at all; and today's still-open challenge has revealed_seed IS NULL afterwards"),
  N("latest_verifiable_daily_challenge()",
    "publishes the most recent challenge whose seed has already been revealed, so a past shoe can be verified",
    "NONE — this function does not read auth.uid(). It is deliberately callable without an account",
    "public.daily_challenges, selecting challenge_date, seed_commitment, revealed_seed, seed_revealed_at",
    "YES: it returns a row that belongs to no account and is meant to be public. There is no caller-scoping to assert",
    "returning a seed for a challenge that has NOT been revealed — the body's `where revealed_seed is not null` is the entire control",
    // Gate A, C4-anon-has-no-execute (D3.54): approved "as anon"; Arc21 revokes
    // EXECUTE from anon on purpose, so the row runs as a signed-in caller. The body
    // does not read auth.uid(), so the revealed-only filter is identity-independent.
    // `identitySource` above is the approved wording and is left as approved.
    "as alice, call latest_verifiable_daily_challenge() while one revealed and one unrevealed challenge both exist",
    "exactly the revealed challenge is returned; the unrevealed one does not appear, and no seed_secret column is exposed"),
  N("join_matchmaking(p_tier table_tier)",
    "enqueues the caller for a public seat at the requested tier",
    "caller from auth.uid(); only the tier comes from the argument",
    "public.matchmaking_queue, public.game_session_seats and public.game_sessions across all accounts",
    "YES: expire_stale_queue_entries() removes OTHER accounts' stale queue rows, which is intended housekeeping. It also reads other accounts' seats to decide seating",
    "enqueuing or seating an account other than the caller, or being seated at a live table the caller is not entitled to join",
    "as alice, call join_matchmaking('casual') while bob holds a fresh (non-stale) queue entry",
    "a matchmaking_queue row appears with user_id = alice and no other; bob's fresh entry is untouched. Stale entries belonging to anyone MAY be expired — that is not a failure"),
  N("poll_matchmaking()",
    "reports the caller's matchmaking progress and any room they have been assigned",
    "caller from auth.uid(); no arguments",
    "public.matchmaking_queue and public.rooms across all accounts",
    "YES: expire_stale_queue_entries() again, and it reads the waiting population to decide whether a room can be formed",
    "returning another account's queue entry or room assignment, or assigning the caller into a room they were not matched to",
    "as alice, call poll_matchmaking() while bob and carol also hold queue entries",
    "the returned entry is alice's own; no bob or carol queue identity appears in the result"),
  N("create_private_room(p_max_seats integer)",
    "creates a private room hosted by the caller",
    "caller from auth.uid(); only the seat count comes from the argument",
    "public.rooms and public.room_members, plus enforce_rate_limit()",
    "YES: expire_stale_rooms() closes OTHER accounts' expired rooms, which is intended housekeeping",
    "creating a room hosted by another account, or bypassing the 2-to-5 seat bound, or bypassing the room_create rate limit",
    "as alice, call create_private_room(9) — outside the permitted 2..5 range",
    "error P0001, 'a private table seats between 2 and 5 players'; no rooms row is created"),
];

/**
 * The remaining no-target functions ARE caller-scoped: they read and write only
 * rows keyed to auth.uid(), with no shared or global effect. They share one
 * invariant, stated once, with one executable probe each.
 */
export const F5_CALLER_SCOPED: readonly string[] = [
  "claim_recovery_grant()", "delete_own_account()", "grant_earned_cosmetics()",
  "leave_matchmaking()", "list_blocked()", "list_friend_requests()", "list_friends()",
  "my_active_session()", "my_career_progress()", "my_competition_record()", "my_daily_entry()",
  "my_inventory()", "my_level_progress()", "my_loadout()", "my_sprint_entry()",
  "my_strategy_accuracy_progress()", "touch_last_seen()", "unread_notification_count()",
  "enforce_rate_limit(p_action text)", "my_leaderboard_position(p_category text)",
  "my_notifications(p_limit integer)",
];

export const CALLER_SCOPED_INVARIANT = CALLER_SCOPED;

/**
 * Gate A, D-283 (D3.54): delete_own_account() is NOT caller-scoped, and its row
 * carries a function-specific invariant instead of the shared one.
 *
 * Its body documents four cross-account effects: it stands the caller up from
 * every lobby through leave_room (release_room_seat hands a hosted lobby to the
 * joined member with the earliest joined_at), cancels other players' queue
 * entries that point at a room it still hosts, deletes other players'
 * notifications about the account, and anonymises the caller's seats; then the
 * schema's own foreign keys cascade or set null. The invariant separates
 * (A) the caller's own effects, (B) exactly those documented effects, and
 * (C) any other change to another account's data, authority or unrelated state,
 * which stays forbidden. Keeping the function in F5_CALLER_SCOPED keeps its
 * position, and so its Test ID.
 */
export const DELETE_OWN_ACCOUNT_INVARIANT = {
  expected:
    "delete_own_account() completes and alice's own account is removed; rows of other accounts change only through its " +
    "documented deletion effects — a lobby alice hosted passes to its longest-joined remaining member, other players' queue " +
    "entries pointing at a room she still hosts are cancelled, notifications about her are deleted, rows involving her are " +
    "deleted or have her id cleared by their foreign keys, and her seats are anonymised; and no row in a table the " +
    "account's foreign keys do not reach changes",
  covers:
    "[no_target, function-specific invariant] deletes the caller's own account. NOT caller-scoped: its body has documented " +
    "cross-account effects — it stands the caller up from every lobby through leave_room (a hosted lobby passes to its " +
    "longest-joined remaining member), cancels other players' queue entries that point at a room it still hosts, deletes " +
    "other players' notifications about the account and anonymises the caller's seats — and the schema's foreign keys then " +
    "cascade or set null. The escalation question is whether the definer privilege changes another account's data, " +
    "authority or unrelated state beyond those documented effects",
} as const;
