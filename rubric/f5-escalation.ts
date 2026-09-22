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
    "as alice, call remove_room_member(<a room hosted by bob>, <bob's user id>)",
    "returns FALSE and bob's membership is unchanged. Not an error: the body returns false for a non-host so that a caller learns nothing about whether the room exists"),
  G("get_room_state", "p_room_id uuid", "target_resource",
    "a joined member reads the state of the room they are in",
    "caller from auth.uid(); the room comes from the argument",
    "public.rooms joined to public.room_members and public.profiles",
    "reading the roster, codes and seat layout of a room the caller has not joined",
    "as carol, call get_room_state(<a room carol has not joined>)",
    "error PT404 — the body raises 'you are not at that table'. Note this is NOT 42501; the 42501 in this function guards the null-identity path"),
  G("set_room_ready", "p_room_id uuid, p_ready boolean", "target_resource",
    "a joined member marks themselves ready",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members",
    "setting ready state in a room the caller is not a member of",
    "as carol, call set_room_ready(<a room carol has not joined>, true)",
    "refusal or no effect; carol's absence from room_members must be unchanged"),
  G("invite_friend_to_room", "p_room_id uuid, p_friend uuid", "target_resource",
    "a member invites one of their own friends into their room",
    "caller from auth.uid(); both the room and the invitee come from arguments",
    "public.room_members and the friendship graph",
    "inviting into a room the caller is not in, or inviting a non-friend",
    "as carol, call invite_friend_to_room(<a room carol is not in>, <bob>)",
    "refusal; no room_members row is created for bob"),
  G("leave_room", "p_room_id uuid", "target_resource",
    "a member leaves their own room",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members, public.rooms",
    "affecting a room the caller is not a member of",
    "as carol, call leave_room(<a room carol is not in>)",
    "refusal or no effect; no other member's row is altered"),
  G("equip_cosmetic", "p_cosmetic_id uuid", "target_resource",
    "a player equips a cosmetic they own",
    "caller from auth.uid(); the cosmetic comes from the argument",
    "public.loadouts, validated against public.user_cosmetics",
    "equipping a cosmetic the caller does not own",
    "as alice, call equip_cosmetic(<a cosmetic alice has no user_cosmetics row for>)",
    "refusal — the loadouts_guard_slots trigger validates each slot against ownership and kind"),
  G("mark_notifications_read", "p_ids uuid[]", "target_resource",
    "a user marks their own notifications read",
    "caller from auth.uid(); the notification ids come from the argument",
    "public.notifications",
    "marking another account's notification read, or learning that an id exists",
    "as alice, call mark_notifications_read(ARRAY[<bob's notification id>])",
    "returns 0 and bob's notification read_at stays null — the body scopes its UPDATE with `where user_id = v_me`"),
  G("caller_is_room_member", "p_room_id uuid", "target_resource",
    "a helper the policies call to decide room membership",
    "caller from auth.uid(); the room comes from the argument",
    "public.room_members",
    "returning true for a room the caller is not in, which would widen every policy that calls it",
    "as carol, call caller_is_room_member(<a room carol is not in>)",
    "returns FALSE. This function does not raise; false is the safe answer"),
  G("is_session_participant", "p_game_session_id uuid", "target_resource",
    "a helper six policies call to decide session participation",
    "caller from auth.uid(); the session comes from the argument",
    "public.game_session_seats",
    "returning true for a session the caller holds no seat at, which would widen five relations' policies at once",
    "as carol, call is_session_participant(<the seeded session carol is not seated at>)",
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
    "as carol, call sprint_standings(<a tournament alice and bob have entered and carol has not>)",
    "error 42501, message 'you are not in that tournament'. Not an empty result: the body raises rather than returning zero rows"),
  // A second, sharper question about the same function, and a concrete one.
  G("sprint_standings", "p_tournament_id uuid (profiles join)", "target_resource",
    "the same function, examined for what its definer privilege exposes rather than for who may call it",
    "caller from auth.uid() gates ACCESS; the profiles join inside the body runs with the owner's privileges",
    "public.profiles directly, with NO block or privacy check — profiles_select_visible is not consulted because the function is SECURITY DEFINER",
    "a fellow entrant seeing the display_name of an account that has blocked them, or of a private-privacy account, which profiles_select_visible would have withheld",
    "seed alice and dave into the same tournament (the seed already has alice blocking dave), then as alice call sprint_standings(<that tournament>)",
    "dave's display_name IS returned. That is a definite prediction, not an open question: the body joins public.profiles with no block or privacy filter, and because the function is SECURITY DEFINER the caller's profiles_select_visible never runs. Recorded as a CHARACTERIZATION — co-entrants seeing each other's names in standings is plainly intended, so this is a fact for the WP5 narrative to weigh, not a control that passed or failed"),
  G("viewer_is_in_tournament", "p_tournament_id uuid", "target_resource",
    "a helper reporting whether the caller is in a tournament",
    "caller from auth.uid(); the tournament comes from the argument",
    "public.tournament_entries",
    "returning true for a tournament the caller has not entered",
    "as carol, call viewer_is_in_tournament(<a tournament carol has not entered>)",
    "returns FALSE"),

  // ---------------------------------------------------------------- target_user
  G("accept_friend_request", "p_from uuid", "target_user",
    "a REQUEST RECEIVER accepts a pending request sent to them",
    "caller from auth.uid() is the receiver; the sender comes from the argument",
    "public.friend_requests and public.friendships — and friendship widens profiles_select_visible",
    "accepting a request that was never sent to the caller, thereby manufacturing a friendship and the profile visibility it confers",
    "as carol, call accept_friend_request(<alice>) when no request from alice to carol exists",
    "refusal or no effect; no friendships row appears between alice and carol"),
  G("decline_friend_request", "p_from uuid", "target_user",
    "a request receiver declines a pending request",
    "caller from auth.uid() is the receiver; the sender comes from the argument",
    "public.friend_requests",
    "declining a request addressed to somebody else",
    "as carol, call decline_friend_request(<alice>) for a request alice sent to bob",
    "no effect on the alice→bob request"),
  G("send_friend_request", "p_to uuid", "target_user",
    "a user sends a request to another account",
    "caller from auth.uid() is the sender; the recipient comes from the argument",
    "public.friend_requests",
    "sending as somebody else, or sending to an account that has blocked the caller",
    "as alice, call send_friend_request(<dave>), whom alice has blocked",
    "refusal — friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id)"),
  G("block_player", "p_other uuid", "target_user",
    "a user blocks another account",
    "caller from auth.uid() is the blocker; the target comes from the argument",
    "public.blocks, and blocks feed profiles_select_visible",
    "creating a block attributed to another account, which would alter that account's visibility decisions",
    "as alice, call block_player(<bob>) and verify the row is attributed to alice and not to bob",
    "one blocks row with blocker_id = alice. No row appears with blocker_id = bob"),
  G("unblock_player", "p_other uuid", "target_user",
    "a user removes their own block",
    "caller from auth.uid() is the blocker; the target comes from the argument",
    "public.blocks",
    "removing somebody else's block, which would widen what they can see",
    "as carol, call unblock_player(<dave>) when the alice→dave block is the one that exists",
    "no effect; the alice→dave block survives"),
  G("remove_friend", "p_other uuid", "target_user",
    "a user removes their own friendship",
    "caller from auth.uid(); the other party comes from the argument",
    "public.friendships",
    "dissolving a friendship the caller is not part of",
    "as carol, call remove_friend(<bob>) when the friendship is alice↔bob",
    "no effect; the alice↔bob friendship survives"),
  G("player_public_profile", "p_user_id uuid", "target_user",
    "any signed-in user reads another account's PUBLIC profile. Cross-user by design",
    "caller from auth.uid() decides visibility; the subject comes from the argument",
    "public.profiles past the caller's own policies",
    "returning a profile the caller should not see (private, or blocked in either direction), or returning friend-only fields to a non-friend",
    "two cases. (a) as alice, call player_public_profile(<dave>), whom alice has blocked. (b) as alice, call it for <bob>, a non-friend with public privacy",
    "(a) returns NO rows — the body returns early on is_blocked_between. (b) returns one row carrying the NON-FRIEND projection only. Expecting 'no data' for (b) would fail a control that is working"),
  G("viewer_is_friend_of", "p_other uuid", "target_user",
    "a helper reporting whether the caller is friends with an account",
    "caller from auth.uid(); the other party comes from the argument",
    "public.friendships",
    "returning true where no friendship exists, which would widen profiles_select_visible",
    "as carol, call viewer_is_friend_of(<bob>) when the friendship is alice↔bob",
    "returns FALSE"),
  G("viewer_has_blocked", "p_other uuid", "target_user",
    "a helper reporting whether the caller has blocked an account",
    "caller from auth.uid(); the other party comes from the argument",
    "public.blocks",
    "reporting another account's block list",
    "as carol, call viewer_has_blocked(<dave>) when the block is alice→dave",
    "returns FALSE — carol has blocked nobody"),
  G("viewer_is_blocked_by", "p_other uuid", "target_user",
    "a helper reporting whether an account has blocked the caller",
    "caller from auth.uid(); the other party comes from the argument",
    "public.blocks",
    "letting a caller enumerate who has blocked whom beyond their own position",
    "as carol, call viewer_is_blocked_by(<alice>) when the block is alice→dave",
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
    "registering a token string already belonging to another account, which would redirect their notifications to the caller's device",
    "as alice, call register_push_token('ExponentPushToken[attest-bob]', 'ios', ...)",
    "refusal, or a row attributed to alice that does NOT displace bob's. Bob's row must still exist with user_id = bob"),
  G("join_private_room", "p_code text", "target_opaque",
    "a user joins a private room using its code",
    "caller from auth.uid(); the room code comes from the argument",
    "public.rooms and public.room_members",
    "joining without a valid code, or a code-guessing oracle that distinguishes 'wrong code' from 'room full'",
    "as carol, call join_private_room('<a code that does not exist>')",
    "refusal that does not distinguish a non-existent room from an ineligible one"),

  // ---------------------------------------------------------------- public_projection
  G("leaderboard_weekly_xp", "p_limit integer, p_offset integer", "public_projection",
    "any signed-in user reads the weekly XP leaderboard. Cross-user by design",
    "caller from auth.uid(); no target argument — limit and offset only",
    "public.player_daily_xp and profiles aggregated across all accounts",
    "returning a private-privacy account's identity, or being callable without an account at all. WP0's own pgTAP gate treats granting this to anon as a breach",
    "two cases. (a) as alice, call it and inspect the projection. (b) as anon, call it",
    "(a) a public-safe projection only. (b) error 42501 — this function is granted to authenticated and must not be reachable by anon"),
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
 * Functions with NO user-controlled target. There is no argument to point at
 * another account, so a 'pass Bob's resource' test would be inventing a
 * mechanism that does not exist. The valid escalation question for these is
 * whether the function returns or alters anything beyond the caller's own data
 * while another account's rows are present.
 */
export const F5_NO_TARGET: readonly string[] = [
  "claim_recovery_grant()", "delete_own_account()", "ensure_todays_daily_challenge()",
  "grant_earned_cosmetics()", "latest_verifiable_daily_challenge()", "leave_matchmaking()",
  "list_blocked()", "list_friend_requests()", "list_friends()", "my_active_session()",
  "my_career_progress()", "my_competition_record()", "my_daily_entry()", "my_inventory()",
  "my_level_progress()", "my_loadout()", "my_sprint_entry()",
  "my_strategy_accuracy_progress()", "poll_matchmaking()", "touch_last_seen()",
  "unread_notification_count()", "create_private_room(p_max_seats integer)",
  "enforce_rate_limit(p_action text)", "join_matchmaking(p_tier table_tier)",
  "my_leaderboard_position(p_category text)", "my_notifications(p_limit integer)",
];
