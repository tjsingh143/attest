/**
 * Attest — AI-generated DRAFT intent sentences for the WP3 negative tests.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THESE ARE DRAFTS. THEY ARE NOT THE AUTHOR'S SENTENCES AND MUST NOT BE
 * PRESENTED AS SUCH.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Brief §1.1 reserves the intent statement for each negative test to the
 * author. That reservation has not moved. What changed is only the starting
 * point: reviewing and correcting 240 concrete sentences is a different task
 * from writing 240 from a blank page, and the author asked for the former.
 *
 * Every sentence this module produces is stored with `provenance: "ai_draft"`
 * and `reviewStatus: "unreviewed"`, and `attest preflight-wp3 --for-execution`
 * refuses to let the suite run while any of them is still in that state. The
 * harness cannot promote its own drafts; only an edit to
 * `rubric/author-intents.json` can.
 *
 * ## How a draft is built
 *
 * From the row's own facts — family, the authorization relationship the
 * planner established, the identity, the operation's verb — plus a lexicon
 * below that says what each resource actually holds and what an attacker gains
 * by reaching it. The lexicon is grounded in the author's own characterizations
 * in `rubric/ratings.ts` (the `data` and `integrity` dimensions), so a draft
 * asserts nothing about Arc21 that the rubric does not already assert.
 *
 * It deliberately does NOT read the planner's `covers` rationale as prose to
 * reword, except for F5, where `escalationWouldBe` is a per-function statement
 * of the attack and the honest thing is to use it rather than to invent a
 * parallel one.
 *
 * ## What a draft is trying to be
 *
 * One sentence naming the attacker's objective — what someone would have
 * *got away with* — not a restatement of the SQL and not the expected error.
 * "A signed-in player reads another account's push token" is an objective;
 * "SELECT returns zero rows" is not.
 */
import type { PlannedTest } from "../src/wp3-plan.ts";
import { effectiveActor } from "../src/plan-contradictions.ts";

/**
 * What each resource holds, and what reaching it gains an attacker.
 *
 * `read` completes "…to read/learn X". `insert`/`update`/`delete` complete
 * "…to X". Phrases are lower-case fragments so composers can place them.
 */
interface Lex {
  readonly read: string;
  /**
   * The noun a membership-gated read takes after "that table's" / "that room's"
   * / "that tournament's". The actor clause introduces the container ("…who
   * holds no seat at a table") and the object refers back to it, so the
   * sentence names it once and never says "that table" before there is one.
   */
  readonly readShared?: string;
  readonly insert: string;
  readonly update: string;
  readonly delete: string;
}

const LEX: Readonly<Record<string, Lex>> = {
  "private.career_drill_seeds": {
    read: "the hidden seed a career drill's scenarios are derived from",
    insert: "plant a drill seed the server never issued, so an attempt is graded against scenarios of their own choosing",
    update: "rewrite the seed a reward-bearing drill attempt will be graded against",
    delete: "destroy the seed a drill attempt is graded against, so the attempt cannot be checked",
  },
  "private.game_commands": {
    read: "the replay-protection ledger recording which commands the server has already accepted",
    insert: "forge an accepted-command record and make the server treat a command it never ran as already applied",
    update: "alter the idempotency ledger so an already-applied command is accepted a second time and its chip movement happens twice",
    delete: "erase the idempotency record that stops a retry from crediting or debiting twice",
  },
  "private.game_state_private": {
    read: "the authoritative engine state, meaning the undealt shoe order and the dealer's hole card",
    insert: "inject engine state the dealer never dealt, so commands are validated against a table of their own making",
    update: "rewrite the authoritative engine state a live hand is being validated against",
    delete: "destroy the authoritative engine state a live session depends on",
  },
  "public.blocks": {
    read: "who another player has blocked, which Arc21 keeps private because a blocked user is never told",
    insert: "fabricate a block on another player's behalf and cut them off from someone they never blocked",
    update: "redirect another player's block so it names someone they never chose",
    delete: "remove a block they are not party to, making the blocker's profile visible again to the very account they blocked",
  },
  "public.career_attempts": {
    read: "another player's reward-bearing career attempt record",
    insert: "fabricate a career attempt that was never played, to claim its reward",
    update: "inflate the counters on a career attempt so it appears to have earned more than it did",
    delete: "erase a career attempt record to retry a node that should already be spent",
  },
  "public.career_nodes": {
    read: "the career catalogue, which is published deliberately and carries nothing private",
    insert: "add a career node the designers never authored, with rewards of their own choosing",
    update: "retune a published career node's rewards or gating for every player at once",
    delete: "remove a career node from the published catalogue, breaking progression for everyone",
  },
  "public.career_progress": {
    read: "another player's career progression, including which rewards they have already claimed",
    insert: "fabricate progression they never earned",
    update: "clear their own reward-claimed marker to set up a repeat claim, or rewrite another player's progression",
    delete: "erase a reward-claim marker so an already-paid career reward can be claimed again",
  },
  "public.cosmetics": {
    read: "the cosmetic catalogue, which is published deliberately",
    insert: "add a cosmetic the catalogue never shipped",
    update: "alter a published cosmetic's unlock rule, changing who is entitled to it",
    delete: "remove a cosmetic from the catalogue and break every loadout that equips it",
  },
  "public.daily_challenges": {
    read: "the daily challenge row, which carries the server-only seed_secret that reveals the day's shoe",
    insert: "publish a daily challenge of their own, with a shoe they already know",
    update: "rewrite a daily challenge's seed or its published commitment, changing the deal for every player and breaking the proof that the shoe was fixed in advance",
    delete: "destroy the published commitment that makes a day's shoe verifiable after the fact",
  },
  "public.daily_challenges_public": {
    read: "the daily-challenge projection — each day's schedule, seed commitment and rewards — which Arc21 grants to signed-in players only",
    insert: "write through a view whose whole purpose is to be a read-only public projection",
    update: "alter the public projection of a daily challenge",
    delete: "remove a daily challenge from its public projection",
  },
  "public.daily_entries": {
    read: "another player's daily-challenge entry — the score, final chips and decision accuracy they posted on the challenge every account plays",
    insert: "fabricate a daily-challenge entry that was never played",
    update: "inflate a score that feeds the shared daily leaderboard",
    delete: "erase a daily entry to take a second attempt at a one-attempt-per-day challenge",
  },
  "public.friend_requests": {
    read: "a friend request between two other people",
    insert: "send a friend request in someone else's name",
    update: "cancel a friend request between two other accounts, overriding a decision that belongs only to its sender",
    delete: "withdraw a friend request they are not party to",
  },
  "public.friendships": {
    read: "a friendship between two other accounts, which is private social state",
    insert: "manufacture a friendship that neither party agreed to, and with it the profile visibility friendship confers",
    update: "redirect a friendship edge to an account that never consented to it",
    delete: "sever a friendship they are not party to, revoking the profile visibility it granted",
  },
  "public.game_events": {
    read: "the live event stream of a table",
    readShared: "live event stream",
    insert: "inject a fabricated event into a live table's stream and mislead the players at it",
    update: "rewrite an event already delivered to the players at a table",
    delete: "delete events from a live table's stream so clients reconstruct a hand that did not happen",
  },
  "public.game_session_seats": {
    read: "who is seated at a table, and each player's stack and buy-in",
    readShared: "seat list, including each seated player's stack and buy-in",
    insert: "seat themselves at a table they were never invited to — and because six policies key on seat membership, thereby grant themselves read access to that session, its events, its hands and its Realtime topic",
    update: "alter a seat row, changing either another player's stack or the membership that five other policies read as authorization",
    delete: "unseat another player, removing the seat that authorizes their access to the table",
  },
  "public.game_sessions": {
    read: "a live table's metadata",
    readShared: "session metadata",
    insert: "conjure a game session that the server never created",
    update: "alter a live session's status, version or escrowed chips",
    delete: "destroy a live session other players are seated at",
  },
  "public.hand_players": {
    read: "another player's settled hand",
    readShared: "settled hands — each player's cards, wager and payout",
    insert: "fabricate a settled hand that was never played",
    update: "rewrite the record of how a hand was settled",
    delete: "erase the record of a settled hand",
  },
  "public.hand_records": {
    read: "the completed-hand archive of a table",
    readShared: "completed-hand archive",
    insert: "write a hand into the archive that was never dealt",
    update: "falsify the archived history of a completed hand",
    delete: "delete a hand from the archive, destroying the record of what was played",
  },
  "public.loadouts": {
    read: "another player's equipped cosmetics",
    insert: "choose what that player appears to have equipped, taking the single loadout the account is allowed",
    update: "change what another player has equipped",
    delete: "delete another player's loadout",
  },
  "public.matchmaking_queue": {
    read: "which other players are waiting for a seat, at what tier, and since when",
    insert: "insert a queue entry directly instead of going through the matchmaking function, jumping or flooding the queue",
    update: "alter a queue entry to take a seat ahead of the players already waiting",
    delete: "drop other players out of the matchmaking queue",
  },
  "public.notifications": {
    read: "another player's notifications",
    insert: "deliver a notification to another player that the server never sent, which is a phishing surface inside the product",
    update: "rewrite the content of a notification already delivered to someone else",
    delete: "delete another player's notifications before they read them",
  },
  "public.player_actions": {
    read: "another player's per-decision log, including how each decision was graded",
    insert: "fabricate decisions that were never made",
    update: "rewrite a graded decision to improve a strategy score",
    delete: "delete unfavourable decisions from a graded log",
  },
  "public.player_daily_xp": {
    read: "another player's daily XP accrual",
    insert: "fabricate a daily XP row",
    update: "reset their own daily XP counter and earn past the 300/day cap",
    delete: "delete the daily XP row that enforces the cap, and keep earning",
  },
  "public.player_decision_periods": {
    read: "another player's server-graded basic-strategy accuracy for a week",
    insert: "fabricate a graded decision period",
    update: "inflate a graded accuracy figure",
    delete: "discard a weak grading period so it does not count",
  },
  "public.player_mode_stats": {
    read: "another player's per-mode statistics",
    insert: "fabricate per-mode statistics",
    update: "inflate statistics the server is supposed to be the only writer of",
    delete: "erase statistics that record how an account actually played",
  },
  "public.player_stats": {
    read: "another player's lifetime statistics, which Arc21 keeps private to their owner",
    insert: "fabricate lifetime statistics",
    update: "inflate lifetime statistics the server alone is meant to write",
    delete: "erase an account's statistical history",
  },
  "public.profiles": {
    read: "player profiles, which Arc21 shows only to an identified signed-in viewer and only as each player's privacy and block settings allow",
    insert: "create a profile row not backed by a real account",
    update: "edit another player's public identity — their username, display name and bio",
    delete: "delete another player's profile",
  },
  "public.push_tokens": {
    read: "another account's device push token, which is the address their phone notifications are delivered to",
    insert: "register a push token against another account and receive that account's notifications on their own device",
    update: "repoint another account's push token at a device they control",
    delete: "deregister another account's device so its notifications stop arriving",
  },
  "public.rate_limit_events": {
    read: "another account's rate-limit history, learning what they have been doing and how often",
    insert: "pad another account's rate-limit window so their legitimate actions start being refused",
    update: "backdate their own rate-limit events so a spent window looks fresh",
    delete: "clear their own rate-limit window and resume an action the limiter had started refusing",
  },
  "public.rate_limit_policies": {
    read: "the rate-limit configuration, learning exactly how many attempts are permitted before the limiter refuses",
    insert: "add a rate-limit rule of their own",
    update: "widen or disable a rate limit for every account at once, which is corruption of a security control rather than of data",
    delete: "delete a rate-limit policy and remove the limit it enforced product-wide",
  },
  "public.rulesets": {
    read: "the published ruleset catalogue, which is readable by design",
    insert: "publish a ruleset the designers never authored",
    update: "alter the rules every live session and tournament plays under, and that hands are recorded against",
    delete: "remove a ruleset that live sessions reference",
  },
  "public.room_members": {
    read: "the membership of a private room",
    readShared: "membership roster",
    insert: "add themselves to a private room they were never invited to — and because caller_is_room_member reads this table, thereby grant themselves the room access it decides",
    update: "alter a membership row that other policies read as an authorization decision",
    delete: "eject another player from a private room",
  },
  "public.rooms": {
    read: "a private room's metadata, including the join code that gets someone in",
    readShared: "private metadata, including the join code an outsider would need to get in",
    insert: "create a room record directly rather than through the function that enforces the seat bounds",
    update: "change a private room's visibility or join code, altering who is able to get in",
    delete: "destroy a private room other players are sitting in",
  },
  "public.tournament_entries": {
    read: "the entries and standings of a tournament",
    readShared: "entries and standings",
    insert: "register themselves — or someone else — into a tournament without going through entry",
    update: "change a placement or prize marker, which is the authoritative outcome of a shared competition",
    delete: "remove a rival's entry from a tournament in progress",
  },
  "public.tournament_matches": {
    read: "a tournament bracket",
    readShared: "bracket",
    insert: "insert a match into a bracket the server never scheduled",
    update: "declare a different winner in a tournament bracket",
    delete: "delete a match from a tournament bracket",
  },
  "public.tournaments": {
    read: "the tournament catalogue, which is published deliberately",
    insert: "publish a tournament the operators never scheduled",
    update: "alter a published tournament's configuration",
    delete: "remove a tournament players have already entered",
  },
  "public.user_cosmetics": {
    read: "which cosmetics another account owns",
    insert: "grant themselves a cosmetic they never unlocked",
    update: "rewrite how a cosmetic entitlement was acquired",
    delete: "strip another account of a cosmetic they earned",
  },
  "public.wallet_ledger": {
    read: "another player's chip history — every credit and debit their account has ever seen",
    insert: "write a ledger entry the server never issued and credit themselves chips",
    update: "rewrite the append-only economy history that wallet balances are recomputed from",
    delete: "delete ledger entries, destroying the authoritative record the balance is derived from",
  },
  "public.wallets": {
    read: "another player's chip balance",
    insert: "create a wallet outside the account-bootstrap path",
    update: "set a chip balance directly, bypassing the ledger the economy is supposed to move through",
    delete: "delete a wallet and the balance it holds",
  },
  "realtime.messages": {
    read: "traffic on a Realtime topic",
    insert: "publish onto a Realtime topic they are not authorized to write",
    update: "rewrite a message already broadcast on a topic",
    delete: "delete messages from a Realtime topic",
  },
};

/** Per-function objective for the 21 caller-scoped SECURITY DEFINER helpers. */
const CALLER_SCOPED_OBJECT: Readonly<Record<string, string>> = {
  claim_recovery_grant: "claim the bankruptcy recovery grant into an account other than their own",
  delete_own_account: "trigger account deletion against somebody else's account",
  grant_earned_cosmetics: "have cosmetic entitlements granted to an account other than the caller's",
  leave_matchmaking: "pull another player out of the matchmaking queue",
  list_blocked: "see who a different account has blocked",
  list_friend_requests: "see the pending friend requests of a different account",
  list_friends: "enumerate a different account's friend list",
  my_active_session: "discover which table a different player is currently sitting at",
  my_career_progress: "read a different account's career progression",
  my_competition_record: "read a different account's tournament and daily-challenge record",
  my_daily_entry: "read a different account's daily-challenge attempt",
  my_inventory: "enumerate a different account's cosmetic inventory",
  my_level_progress: "read a different account's level and XP standing",
  my_loadout: "see what a different player has equipped",
  my_sprint_entry: "read a different account's live tournament position",
  my_strategy_accuracy_progress: "read a different account's graded strategy accuracy",
  touch_last_seen: "move a different account's last-seen timestamp, making a dormant account look active",
  unread_notification_count: "learn how many unread notifications a different account is holding",
  enforce_rate_limit: "consume — or reset — a different account's rate-limit budget",
  my_leaderboard_position: "read a different account's private leaderboard standing",
  my_notifications: "read a different account's notifications",
};

/**
 * Per-function F5 drafts, keyed by the planner's resource string (function and
 * argument list, with the D3.14 variant tag where one exists) — never by Test ID
 * number.
 *
 * Added by the 2026-09-24 audit. The composed form — "<actor> calls f() naming
 * <arg> that is not theirs, getting its owner privilege to do what the caller's
 * own policies forbid: <the planner's escalationWouldBe>" — was wrong or wider
 * than the probe for most target, projection and shared-effect functions:
 * `escalationWouldBe` often names two attacks where the probe exercises one
 * (send_friend_request, search_players, leaderboard_weekly_xp), names the wrong
 * direction of a block (send_friend_request), calls a legitimate argument "not
 * theirs to name" (block_player), claims housekeeping over other accounts' rows
 * for functions that have none (ensure_todays_daily_challenge,
 * latest_verifiable_daily_challenge), or copies a consequence the function body
 * contradicts (register_push_token: taking over another device's token sends the
 * CALLER's notifications to THAT device; it does not bring the victim's to the
 * caller). Each sentence below is written against the row's operation, expected
 * result and guards, and claims no more than they can show. Still AI drafts.
 */
const F5_DRAFTS: Readonly<Record<string, string>> = {
  "public.remove_room_member(p_room_id uuid, p_user_id uuid)":
    "A signed-in player calls remove_room_member() on a room someone else hosts to eject one of its members, a removal only that room's host may make",
  "public.get_room_state(p_room_id uuid)":
    "A signed-in player who has not joined a room calls get_room_state() on it to read its roster, join code and seat layout, which only its members may see",
  "public.set_room_ready(p_room_id uuid, p_ready boolean)":
    "A signed-in player who is not in a room calls set_room_ready() on it, acting as a member of a room they never joined — setting a ready state there or gaining a membership row",
  "public.invite_friend_to_room(p_room_id uuid, p_friend uuid)":
    "A signed-in player who is not in a room calls invite_friend_to_room() to pull one of their friends into it, issuing an invitation only the room's own members may extend",
  "public.leave_room(p_room_id uuid)":
    "A signed-in player who is not in a room calls leave_room() on it and, through the function's owner privilege, alters that room or its members' rows although they were never part of it",
  "public.equip_cosmetic(p_cosmetic_id uuid)":
    "A signed-in player calls equip_cosmetic() with a cosmetic they do not own, wearing an item they never unlocked",
  "public.mark_notifications_read(p_ids uuid[])":
    "A signed-in player calls mark_notifications_read() with another account's notification ids, marking that account's notifications read or learning from the reply that those ids exist",
  "public.caller_is_room_member(p_room_id uuid)":
    "A signed-in player who is not in a room gets caller_is_room_member() to report them as a member of it, which would open every room policy that trusts that helper",
  "public.is_session_participant(p_game_session_id uuid)":
    "A signed-in player who holds no seat at a table gets is_session_participant() to report them as seated there, which would open every session policy that trusts that helper",
  "public.sprint_standings(p_tournament_id uuid)":
    "A signed-in player who has not entered a tournament calls sprint_standings() on it to read the entrants' display names, chip stacks, placements and prizes, which only entrants may see",
  "public.viewer_is_in_tournament(p_tournament_id uuid)":
    "A signed-in player who has not entered a tournament gets viewer_is_in_tournament() to report them as an entrant, which would open the tournament rows its policies guard",
  "public.accept_friend_request(p_from uuid)":
    "A signed-in player calls accept_friend_request() naming an account that never sent them a request, manufacturing a friendship — and the profile visibility it confers — that the other account never asked for",
  "public.decline_friend_request(p_from uuid)":
    "A signed-in player calls decline_friend_request() naming a sender whose request went to someone else, rejecting that request on its real recipient's behalf",
  "public.send_friend_request(p_to uuid)":
    "A signed-in player calls send_friend_request() toward an account they have blocked, getting a request across a block that Arc21 says stops either party acting on the other",
  "public.block_player(p_other uuid)":
    "A signed-in player calls block_player() and gets the resulting block recorded under another account's name, altering what that account can see",
  "public.unblock_player(p_other uuid)":
    "A signed-in player calls unblock_player() to lift a block someone else placed, making the blocker's profile visible again to the very account they blocked",
  "public.remove_friend(p_other uuid)":
    "A signed-in player calls remove_friend() to dissolve a friendship between two other accounts, revoking the profile visibility it gave them",
  "public.player_public_profile(p_user_id uuid)":
    "A signed-in player calls player_public_profile() for an account they have blocked and still gets its profile back, or an answer that reveals the block exists",
  "public.player_public_profile(p_user_id uuid [non-friend projection])":
    "A signed-in player calls player_public_profile() for a public account they are not friends with and receives the friend-only fields reserved for that account's friends",
  "public.viewer_is_friend_of(p_other uuid)":
    "A signed-in player gets viewer_is_friend_of() to report a friendship with an account they are not friends with, which would widen what profiles_select_visible shows them",
  "public.viewer_has_blocked(p_other uuid)":
    "A signed-in player uses viewer_has_blocked() to learn whether some other account has blocked a third party, reading another account's private block list through a helper meant to answer only about the caller's own blocks",
  "public.viewer_is_blocked_by(p_other uuid)":
    "A signed-in player uses viewer_is_blocked_by() to learn about blocks that do not involve them, mapping who has blocked whom beyond their own position",
  "public.retire_push_token(p_token text)":
    "A signed-in player calls retire_push_token() with another account's token string, switching off that account's push notifications on its device",
  "public.register_push_token(p_token text, p_platform push_platform, p_device_id text, p_kinds notification_kind[])":
    "A signed-in player calls register_push_token() with a token string that belongs to another account's device, taking over that registration so the device's owner stops receiving their own notifications and starts receiving the caller's",
  "public.join_private_room(p_code text)":
    "A signed-in player calls join_private_room() with a guessed code, either getting into a room without its real code or learning from the refusal whether that code belongs to a room",
  "public.leaderboard_weekly_xp(p_limit integer, p_offset integer)":
    "A signed-in player calls leaderboard_weekly_xp() and gets back the identity of an account whose privacy is set to private, or columns beyond what a leaderboard needs",
  "public.leaderboard_daily_challenge(p_date date, p_limit integer, p_offset integer)":
    "A signed-in player calls leaderboard_daily_challenge() and gets back a private account's identity, or the day's seed_secret leaked through the join behind it",
  "public.leaderboard_strategy_accuracy(p_limit integer, p_offset integer)":
    "A signed-in player calls leaderboard_strategy_accuracy() and gets back the graded accuracy of an account whose privacy is set to private, together with its identity",
  "public.leaderboard_tournament_wins(p_limit integer, p_offset integer)":
    "A signed-in player calls leaderboard_tournament_wins() and gets back the tournament record of an account whose privacy is set to private, together with its identity",
  "public.search_players(p_query text)":
    "A signed-in player calls search_players() with the handle of an account they have blocked and finds it, although search is meant to hide accounts on either side of a block",
  "public.ensure_todays_daily_challenge()":
    "A signed-in player calls ensure_todays_daily_challenge() and gets back the day's seed_secret, or causes the seed of a challenge still open to be revealed — either of which tells them the shoe before they play it",
  // Gate A (D3.54): the row now runs as a signed-in caller (C4), and the author
  // adopted this wording (recorded as user_reviewed_ai_draft in the store). The
  // generator emits the same text so a regenerated worksheet cannot diverge.
  "public.latest_verifiable_daily_challenge()":
    "A signed-in player calls latest_verifiable_daily_challenge() and receives the seed of a challenge that has not yet been revealed",
  "public.join_matchmaking(p_tier table_tier)":
    "A signed-in player calls join_matchmaking(), whose housekeeping legitimately expires other accounts' stale queue entries, and gets it to enqueue or seat an account other than themselves or to disturb another player's fresh entry",
  "public.poll_matchmaking()":
    "A signed-in player calls poll_matchmaking(), whose housekeeping legitimately expires other accounts' stale queue entries, and gets back another waiting player's queue entry or room assignment instead of only their own",
  "public.create_private_room(p_max_seats integer)":
    "A signed-in player calls create_private_room() asking for nine seats, creating a room outside the 2-to-5 seat bound the function exists to enforce",
  // Caller-scoped by the planner's classification, which the 2026-09-24 audit
  // found to be wrong for this one function: its body hands a hosted lobby to
  // another member, cancels other players' queue entries pointing at a room it
  // hosts, deletes other players' notifications about the account and anonymises
  // shared seats. The sentence states the literal approved claim; the reading of
  // that claim is the author's (WP3_AUTHOR_DECISIONS_REQUIRED.md, D-283).
  // Gate A (D3.54): the row carries a function-specific invariant (D-283), and the
  // author adopted this wording (user_reviewed_ai_draft in the store).
  "public.delete_own_account()":
    "A signed-in player uses delete_own_account() to alter another account's data or authority beyond the function's documented account-deletion cleanup and reassignment effects",
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const lex = (resource: string): Lex =>
  LEX[resource] ?? {
    read: `data held in ${resource} that the caller is not entitled to`,
    insert: `write a row into ${resource} they are not entitled to create`,
    update: `alter a row in ${resource} they are not entitled to change`,
    delete: `delete a row from ${resource} they are not entitled to remove`,
  };

/** The membership relation a participation policy turns on, if any. */
function membership(t: PlannedTest): "session" | "room" | "tournament" | null {
  const c = t.covers;
  if (/is_session_participant/.test(c)) return "session";
  if (/caller_is_room_member/.test(c)) return "room";
  if (/viewer_is_in_tournament/.test(c)) return "tournament";
  return null;
}

/**
 * How to name the actor.
 *
 * Uses the EFFECTIVE actor, not the `identity` column. On 17 F5 rows the two
 * disagree and the operation's caller is the one the approved expectation
 * requires (contradiction C1). Drafting against the identity column would
 * describe an attack the probe does not model.
 */
function actor(t: PlannedTest): string {
  const i = effectiveActor(t);
  if (i.startsWith("anon")) return "A signed-out visitor";
  if (i.includes("NO claims")) return "A session carrying no identity at all";
  if (i.includes("deleted account")) return "A token still bearing the claims of a deleted account";
  if (i.includes("server-side")) return "The server's own privileged connection";
  if (i.includes("carol")) {
    // The container is introduced here ("a table") and referred back to by the
    // object ("that table's …"). The 2026-09-23 drafts said "that table" in the
    // actor clause, before any table had been mentioned (2026-09-24 audit).
    const m = membership(t);
    if (m === "session") return "A signed-in player who holds no seat at a table";
    if (m === "room") return "A signed-in player who is not a member of a private room";
    if (m === "tournament") return "A signed-in player who has not entered a tournament";
    if (t.family.startsWith("F8")) return "A signed-in player who holds no seat at a table";
    return "A signed-in player with no part in the target";
  }
  return "A signed-in player";
}

/** The write verb a probe issues, from the operation text. */
function verb(t: PlannedTest): "insert" | "update" | "delete" | "truncate" | "select" | "other" {
  const m = /\b(insert|update|delete|truncate|select)\b/i.exec(t.operation);
  return (m?.[1]?.toLowerCase() as ReturnType<typeof verb>) ?? "other";
}

/** Strip the disambiguating tag the D3.14 splits added to a function resource. */
const fnName = (resource: string): string => resource.replace(/^public\./, "").split("(")[0]!.trim();

/**
 * The planner's own per-function statement of what escalation would be.
 *
 * Cut at the first sentence boundary: several `covers` values continue past it
 * with a further remark ("WP0's own pgTAP gate treats …"), and folding that
 * into a one-sentence intent would both run long and stop being an objective.
 */
function escalationWouldBe(t: PlannedTest): string | null {
  const m = /Escalation would be:\s*([\s\S]+)/.exec(t.covers);
  if (!m) return null;
  const first = m[1]!.split(/\.\s+(?=[A-Z])/)[0] ?? m[1]!;
  return first.trim().replace(/\.$/, "");
}

/** The escalation class the planner assigned, from its `covers` prefix. */
function f5Class(t: PlannedTest): string | null {
  return /^\[([a-z_]+)(?:,|\])/.exec(t.covers)?.[1] ?? null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const oneSentence = (s: string) => `${s.replace(/\s+/g, " ").trim().replace(/\.+$/, "")}.`;

// ---------------------------------------------------------------------------
// family composers
// ---------------------------------------------------------------------------

function draftF1(t: PlannedTest): string {
  const L = lex(t.resource);
  const a = actor(t);
  // public.profiles carries two permissive SELECT policies and therefore two
  // materially different negatives; they must not read the same.
  if (t.control.endsWith("profiles_select_self")) {
    return `${a} reads a profile row that is not their own by leaning on the self-access policy, rather than on the visibility rules that are supposed to decide who may see whom`;
  }
  if (t.control.endsWith("profiles_select_visible")) {
    // The probe's viewer is the BLOCKER: alice reads dave, whom she blocked, and
    // the conjunct it falsifies is NOT viewer_has_blocked(id). The 2026-09-23
    // draft had the direction reversed ("someone who has blocked them").
    return `${a} reads the profile of an account they have blocked, although Arc21 treats a block as hiding each party's profile from the other`;
  }
  const mk = membership(t);
  // The actor phrase introduces the container and carries the membership
  // clause, so the object refers back to it rather than repeating it.
  if (mk && t.identity.includes("carol")) {
    const that = mk === "session" ? "that table's" : mk === "room" ? "that room's" : "that tournament's";
    return `${a} reads ${that} ${L.readShared ?? L.read}`;
  }
  return `${a} reads ${L.read}`;
}

function draftF2(t: PlannedTest): string {
  const L = lex(t.resource);
  const a = actor(t);
  const v = verb(t);
  const grantSurface = /#grant:/.test(t.control);
  const objective = v === "insert" ? L.insert : v === "update" ? L.update : v === "delete" ? L.delete : L.update;
  if (grantSurface) {
    // The control is the ABSENCE of the privilege, so the attack is reaching a
    // server-controlled table directly instead of through the server.
    return `${a} writes straight to a table only the server is supposed to write, to ${objective}`;
  }
  return `${a} uses a write they do hold to ${objective}`;
}

function draftF3(t: PlannedTest): string {
  const a = actor(t);
  const col = /compares \`([a-z_]+)\`/.exec(t.covers)?.[1] ?? "the owner column";
  const L = lex(t.resource);
  return `${a} creates a row in ${t.resource} attributed to somebody else by setting ${col} to another account, in order to ${L.insert}`;
}

function draftF4(t: PlannedTest): string {
  const L = lex(t.resource);
  // The four rows that falsify an anon-admitting predicate are a different
  // attack from the thirty-six that test a resource anon should not reach.
  if (/the unsatisfied branch of/.test(t.covers)) {
    const pred = /The predicate is exactly \`([^`]+)\`/.exec(t.covers)?.[1] ?? "its publication predicate";
    return `A signed-out visitor reads a ${t.resource} row that has been withdrawn from publication, reaching content the \`${pred}\` predicate is there to keep out of the public catalogue`;
  }
  return `Without ever signing in or holding an account, someone reads ${L.read}`;
}

/** "a sender", "an account", "another party" — the article the noun takes. */
function withArticle(noun: string): string {
  if (/^other\b/i.test(noun)) return `an${noun}`;
  return /^[aeiou]/i.test(noun) && !/^(u[sn]i|use|one\b|eu)/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function draftF5(t: PlannedTest): string {
  const own = F5_DRAFTS[t.resource];
  if (own) return own;
  const fn = fnName(t.resource);
  const a = actor(t);
  const callerScoped = /\[no_target, caller-scoped\]/.test(t.covers);
  if (callerScoped) {
    const obj = CALLER_SCOPED_OBJECT[fn] ?? `reach another account's data through ${fn}()`;
    return `${a} rides the definer privilege inside ${fn}() past their own rows to ${obj}`;
  }
  const esc = escalationWouldBe(t);
  const klass = f5Class(t);
  // Whether the function may be called at all, rather than what it returns.
  if (/exercising who may call it/.test(t.covers)) {
    return `Someone with no account at all executes ${fn}(), which is granted to signed-in callers only, and reads aggregated data across every account without ever holding one`;
  }
  if (esc) {
    if (klass === "public_projection") {
      return `${a} gets ${fn}() to hand back more than its public projection is meant to carry, reaching what that projection exists to withhold: ${esc}`;
    }
    if (klass === "no_target") {
      return `${a} calls ${fn}(), whose housekeeping legitimately touches other accounts' rows, and gets it to go further than that: ${esc}`;
    }
    // The argument's own noun, read from the planner's identity note, so the
    // sentence names what was passed rather than listing every possibility.
    // "comes" or "come": the planner's own verb says whether the noun is plural.
    const argM = /;\s*the ([a-z][a-z ]{0,24}?) (comes?) from the argument/.exec(t.covers);
    const arg = argM?.[1]?.trim();
    const plural = argM?.[2] === "come";
    const naming = !arg ? `with an argument that is not theirs to name`
      : plural ? `naming ${arg} that are not theirs`
      : `naming ${withArticle(arg)} that is not theirs`;
    return `${a} calls ${fn}() ${naming}, getting its owner privilege to do what the caller's own policies forbid: ${esc}`;
  }
  return `${a} calls ${fn}() to reach, through its owner privilege, data or an effect their own policies forbid`;
}

function draftF6(t: PlannedTest): string {
  const a = actor(t);
  const isRead = /colgrant:SELECT/.test(t.control);
  const col = /^\s*(?:SELECT|UPDATE)\s+(?:[a-z_.]+\s+set\s+)?([a-z_]+)/i.exec(t.operation)?.[1] ?? "an excluded column";
  if (isRead) {
    return `${a} reads ${col} out of a ${t.resource} row they are otherwise entitled to see, taking a column that is withheld from every client grant even where the row itself is permitted`;
  }
  // A friend request is shared between its two parties; the probe's row is one
  // addressed TO the caller, which they may answer but do not own.
  if (t.resource === "public.friend_requests") {
    return `${a} writes ${col} on a friend request addressed to them, reaching a column the client update grant deliberately excludes — they may answer the request, not rewrite it`;
  }
  return `${a} writes ${col} on a ${t.resource} row they do own, reaching a column the client update grant deliberately excludes — the row is theirs, the column is not`;
}

function draftF8(t: PlannedTest): string {
  const socket = /#realtime-socket/.test(t.control);
  const a = actor(t);
  const writes = /insert|publish/i.test(t.operation);
  // A write onto a game topic is refused to EVERY client — the only topic a
  // client may write is presence — so the seat is not what the control turns on
  // and the sentence does not say it is (2026-09-24 audit).
  if (socket) {
    return writes
      ? `A signed-in player publishes a fabricated game-state broadcast onto a table's private Realtime channel through a real websocket client — a channel only the server may broadcast on — so the players there act on a message the server never sent`
      : `${a} subscribes to that table's private Realtime channel through a real websocket client and receives the game's live payloads`;
  }
  if (writes) {
    return `A signed-in player writes a message onto a game topic at the SQL layer, injecting fabricated state into a channel that no client, seated or not, is admitted to write`;
  }
  if (t.identity.startsWith("anon")) {
    return `Someone with no account reads the presence roster straight from realtime.messages at the SQL layer, relying on the anonymous grant that reaches the table although no policy names anon`;
  }
  return `${a} reads that table's Realtime game topic directly at the SQL layer, obtaining broadcasts meant only for its seated players`;
}

function draftF9(t: PlannedTest): string {
  const op = t.operation;
  if (/SAME idempotency key/i.test(op)) {
    return `A retry on the server's own chip-movement path is applied twice under one idempotency key, so a single credit or debit lands on the balance two times`;
  }
  if (/debit larger than the balance/i.test(op)) {
    return `A debit larger than the balance is pushed through the server's chip-movement path and drives an account negative, manufacturing value the economy never issued`;
  }
  const server = /server-side/.test(t.identity);
  if (/truncate/i.test(op)) {
    return server
      ? `The server's own privileged connection empties the chip ledger, destroying the authoritative history every balance is recomputed from`
      : `A signed-in player empties the chip ledger with a TRUNCATE, which no row policy can refuse, destroying the economy's authoritative history`;
  }
  return server
    ? `The server's own privileged connection rewrites a settled ledger entry, treating the append-only economy history as editable from the trusted side`
    : `A signed-in player rewrites a settled entry in their own chip ledger, altering the authoritative history their balance is derived from`;
}

function draftF10(t: PlannedTest): string {
  const v = verb(t);
  const what: Record<string, string> = {
    "private.game_commands": "the accepted-command trail",
    "public.game_events": "the delivered event stream",
    "public.rate_limit_events": "the trail of attempts an account has already made",
    "public.wallet_ledger": "the chip ledger",
  };
  const subject = what[t.resource] ?? `the trail recorded in ${t.resource}`;
  if (v === "truncate") {
    return `A signed-in player wipes out ${subject}, in one statement and by a route no row policy can intercept, removing the evidence of their own activity`;
  }
  if (v === "delete") {
    return `A signed-in player deletes entries from ${subject} to remove the trace of something they did`;
  }
  return `A signed-in player edits ${subject} so it reports something other than what actually happened`;
}

/**
 * What a deleted-user probe reads: the rows its filter selects, which are the
 * DELETED account's own (`where <owner column> = dave`). The 2026-09-23 drafts
 * reused the F1 read phrase and so said a stale token reached "another
 * player's" data, which is not what any of these fourteen probes asks.
 */
const DELETED_OBJECT: Readonly<Record<string, string>> = {
  "private.game_commands": "the accepted-command records written under that account",
  "public.blocks": "the blocks that account had placed",
  "public.friend_requests": "the friend requests that account had sent",
  "public.friendships": "the friendships recorded under that account",
  "public.game_events": "the game events addressed to that account",
  "public.game_session_seats": "the table seats, with their stacks and buy-ins, held under that account",
  "public.game_sessions": "the game sessions that account hosted",
  "public.profiles": "that account's own profile",
  "public.rate_limit_events": "that account's rate-limit history",
  "public.room_members": "the room memberships held under that account",
  "public.rooms": "the rooms that account hosted, with their join codes",
  "public.tournament_entries": "the tournament entries held under that account",
  "public.wallet_ledger": "that account's chip ledger",
  "public.wallets": "that account's chip balance",
};

/**
 * Gate A (D3.54, C5): the three deleted-user rows retargeted at the surviving
 * state of a session the deleted account had joined, with the wording the author
 * adopted (user_reviewed_ai_draft in the store).
 */
const DELETED_SURVIVING: Readonly<Record<string, string>> = {
  "public.game_events": "A token issued to an account that has since been deleted is replayed to retain participant access to the surviving event stream of a game session that account previously joined",
  "public.game_session_seats": "A token issued to an account that has since been deleted is replayed to retain participant access to the surviving seat list, stacks, and buy-ins of a game session that account previously joined",
  "public.game_sessions": "A token issued to an account that has since been deleted is replayed to retain participant access to the surviving metadata of a game session that account previously joined",
};

function draftBoundary(t: PlannedTest): string {
  const L = lex(t.resource);
  if (/deleted-user/.test(t.control) && / for the game session .* that the deleted account had joined/.test(t.operation)) {
    const own = DELETED_SURVIVING[t.resource];
    if (own) return own;
  }
  if (/deleted-user/.test(t.control)) {
    const obj = DELETED_OBJECT[t.resource] ?? `whatever ${t.resource} still holds keyed to that account`;
    return `A token issued to an account that has since been deleted is replayed to read ${obj}, anything the deletion left keyed to it`;
  }
  return `A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches ${L.read}`;
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/** One AI-drafted attack sentence for one negative test. */
export function draftFor(t: PlannedTest): string {
  const fam = t.family.split(" ")[0];
  const body =
    fam === "F1" ? draftF1(t)
    : fam === "F2" ? draftF2(t)
    : fam === "F3" ? draftF3(t)
    : fam === "F4" ? draftF4(t)
    : fam === "F5" ? draftF5(t)
    : fam === "F6" ? draftF6(t)
    : fam === "F8" ? draftF8(t)
    : fam === "F9" ? draftF9(t)
    : fam === "F10" ? draftF10(t)
    : fam === "B" ? draftBoundary(t)
    : `${actor(t)} reaches ${t.resource} in a way the control is meant to prevent`;
  return oneSentence(cap(body));
}

/** The expired-session boundary is the one suite-level row and is its own case. */
export const EXPIRED_SESSION_DRAFT =
  // Expiry is not sign-out, and the fixture's token expired one hour earlier
  // (2026-09-24 audit: the previous draft said "signed out for hours").
  "A session token whose expiry has already passed is replayed against the API, so whoever holds the stale token " +
  "keeps acting as that account after the session was meant to end.";
