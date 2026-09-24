/**
 * Attest — WP3 seed extensions.
 *
 * The standing seed (`seed/seed.sql`) builds the accounts, one game session,
 * one friendship and one block. The WP3 matrix needs more than that: rooms with
 * a non-member, tournaments with a non-entrant, catalogue rows whose
 * anon-admitting predicate is false, a daily challenge that is open and another
 * that is revealed, Realtime rows on two topics, and — since the structural
 * pass that followed D3.36 — rows in every table a probe acts on, so that no
 * refusal is true merely because there was nothing to refuse.
 *
 * The plan *states* those requirements (`plan.seedExtensions`, D3.23). This
 * module is the other half: one implementation per required key, and a runtime
 * verification for each. Preflight compares the two sets and refuses to run the
 * suite unless they are equal, so a fixture can no longer be assumed into
 * existence by a probe that happens to reference it.
 *
 * ## Two scopes, and why (D3.38)
 *
 *   baseline   Applied after every rebuild of the disposable database, before
 *              any probe. Additive rows that no probe's premise contradicts.
 *              Together with `seed/seed.sql` they are the *canonical baseline*.
 *
 *   probe      Applied as admin to a freshly verified baseline immediately
 *              before ONE probe, because that probe's premise contradicts the
 *              baseline (carol must have no tie to bob, alice must not be
 *              seated, dave must have deleted his account). A probe-scoped
 *              setup always dirties the baseline, so the executor rebuilds after
 *              the probe. It is setup, never an undo step: isolation is the
 *              rebuild (R7), not a compensating write.
 *
 *   runtime    Not database rows: roles created inside the F7 runner, JWTs
 *              signed in memory, and a value deliberately absent.
 *
 * Everything here runs as the admin role. That is deliberate and it is not a
 * control test: seeding is setup, and the write-guard triggers on these tables
 * (`deny_client_write`) refuse client roles by design — which is itself a
 * control that F2 tests. Seeding through a client role would fail, and seeding
 * *around* the guard would be lying about the state a client can reach. The
 * one exception is `probe:dave_deleted`, which deletes dave's account through
 * Arc21's own `delete_own_account()` as dave, for the reason the seed creates
 * accounts through Arc21's own bootstrap (D0.12): the resulting state is one the
 * application can actually produce.
 *
 * Identifiers are literals. Two rebuilds against the same migrations produce
 * the same rows, so a failing probe can be re-run against exactly the rows it
 * failed against. Catalogue rows (cosmetics, career nodes, rulesets) ship from
 * Arc21's migrations with generated ids, so they are selected by their stable
 * `code`, never by id.
 */
import type { Session } from "./db.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

const F = FIXTURES;

/** Sub-row identifiers no planned row references by name. Deterministic. */
export const AUX = {
  entryAliceInAB: "aaaa0000-0000-4000-8000-000000000001",
  entryBobInAB: "aaaa0000-0000-4000-8000-000000000002",
  entryAliceInAD: "aaaa0000-0000-4000-8000-000000000003",
  entryDaveInAD: "aaaa0000-0000-4000-8000-000000000004",
  // The alice-bob match used to live here as `matchInAB`. Two planned rows read
  // it, so it is now a declared fixture: FIXTURES.tournamentAliceBobMatch (D3.34).
  memberAliceRoomAB: "cccc0000-0000-4000-8000-000000000001",
  memberBobRoomAB: "cccc0000-0000-4000-8000-000000000002",
  memberBobRoomBH: "cccc0000-0000-4000-8000-000000000003",
  memberCarolRoomBH: "cccc0000-0000-4000-8000-000000000004",
  queueBob: "dddd0000-0000-4000-8000-000000000001",
  queueCarol: "dddd0000-0000-4000-8000-000000000002",
  queueAlice: "dddd0000-0000-4000-8000-000000000003",
  dailyOpen: "eeee0000-0000-4000-8000-000000000001",
  dailyRevealed: "eeee0000-0000-4000-8000-000000000002",
  /** 64 characters, satisfying the 32..256 length check on seed_secret. */
  dailySecretOpen: "attest-open-daily-secret-0000000000000000000000000000000000000001",
  dailySecretRevealed: "attest-revealed-daily-secret-000000000000000000000000000000000002",

  // --- rows every F1 pair and F5 caller-scoped probe acts on (D3.38) --------
  attemptAlice: "a1000000-0000-4000-8000-00000000000a",
  attemptBob: "a1000000-0000-4000-8000-00000000000b",
  dailyEntryAlice: "a2000000-0000-4000-8000-00000000000a",
  dailyEntryBob: "a2000000-0000-4000-8000-00000000000b",
  dailyEntryErin: "a2000000-0000-4000-8000-00000000000e",
  handRecord: "a3000000-0000-4000-8000-000000000001",
  handPlayerAlice: "a3000000-0000-4000-8000-00000000000a",
  handPlayerBob: "a3000000-0000-4000-8000-00000000000b",
  actionAlice: "a3100000-0000-4000-8000-00000000000a",
  actionBob: "a3100000-0000-4000-8000-00000000000b",
  dailyXpAlice: "a4000000-0000-4000-8000-00000000000a",
  dailyXpBob: "a4000000-0000-4000-8000-00000000000b",
  dailyXpErin: "a4000000-0000-4000-8000-00000000000e",
  decisionAlice: "a5000000-0000-4000-8000-00000000000a",
  decisionBob: "a5000000-0000-4000-8000-00000000000b",
  decisionErin: "a5000000-0000-4000-8000-00000000000e",
  modeStatsAlice: "a6000000-0000-4000-8000-00000000000a",
  modeStatsBob: "a6000000-0000-4000-8000-00000000000b",
  cosmeticOwnedAlice: "a7000000-0000-4000-8000-00000000000a",
  cosmeticOwnedBob: "a7000000-0000-4000-8000-00000000000b",
  commandAlice: "a8000000-0000-4000-8000-00000000000a",
  commandBob: "a8000000-0000-4000-8000-00000000000b",
  commandActionAlice: "a8100000-0000-4000-8000-00000000000a",
  commandActionBob: "a8100000-0000-4000-8000-00000000000b",
  rateBobStale: "a9000000-0000-4000-8000-000000000001",
  rateBobFresh: "a9000000-0000-4000-8000-000000000002",
  rateCarolStale: "a9000000-0000-4000-8000-000000000003",
  rateCarolFresh: "a9000000-0000-4000-8000-000000000004",
  blockBobDave: "bb000000-0000-4000-8000-000000000002",
  requestAliceErin: "44440000-0000-4000-8000-000000000003",
  requestCarolAlice: "44440000-0000-4000-8000-000000000004",
  requestAliceBob: "44440000-0000-4000-8000-000000000005",
  friendshipAliceErin: "44440000-0000-4000-8000-000000000006",
  roomExpired: "11110000-0000-4000-8000-000000000003",
  roomExpiredCode: "ATSTEX",
  tournamentDoneErin: "22220000-0000-4000-8000-000000000003",
  tournamentDoneBob: "22220000-0000-4000-8000-000000000004",
  entryErinInDoneErin: "aaaa0000-0000-4000-8000-000000000005",
  entryBobInDoneErin: "aaaa0000-0000-4000-8000-000000000006",
  entryBobInDoneBob: "aaaa0000-0000-4000-8000-000000000007",
  entryAliceInDoneBob: "aaaa0000-0000-4000-8000-000000000008",
  seatAlice: "f0000000-0000-4000-8000-000000000001",
  seatBob: "f0000000-0000-4000-8000-000000000002",
  /** Gate A, C5 (D3.54): the seat dave held and left before deleting his account. */
  seatDaveLeft: "f0000000-0000-4000-8000-00000000000d",
} as const;

/** The display name Arc21 gives erin, the one private-privacy account. */
export const ERIN_DISPLAY_NAME = "Erin";

export type SeedScope = "baseline" | "probe" | "runtime";

export interface SeedExtensionImpl {
  readonly key: string;
  readonly scope: SeedScope;
  /** Applied in order, as admin. Must be safe to re-run on the state it expects. */
  readonly statements: readonly string[];
  /**
   * SQL returning exactly one row: `ok boolean, detail text`.
   *
   * Verification is separate from application because "the insert ran" and
   * "the state a probe needs now holds" are different claims, and the second
   * is the one the executor depends on. A fixture that was created and then
   * consumed, expired or cascaded away would still pass the first.
   */
  readonly verify: string;
  /** Set when the state is not database rows and cannot be verified by SQL. */
  readonly runtimeOnly?: string;
  /**
   * A probe-scoped setup step that must run as a client through Arc21's own
   * function rather than as admin — after `statements`, which run first as
   * admin. `before`, when present, is a read made AS that client before the
   * statement (returning `ok boolean, detail text`): it shows the account had
   * the access in question while it was live, so a later refusal is the
   * deletion's doing and not a state that never existed. The deleted-user
   * setups use it (`probe:dave_deleted`, `probe:dave_left_seat_then_deleted`).
   */
  readonly asClient?: {
    readonly subject: "dave";
    readonly statement: string;
    readonly before?: { readonly describe: string; readonly sql: string };
  };
}

const RULESET = `(select id from public.rulesets where is_active order by key, version limit 1)`;
const FUTURE = `now() + interval '10 years'`;
const COSMETIC = (code: string) => `(select id from public.cosmetics where code = '${code}')`;
const NODE = (code: string) => `(select id from public.career_nodes where code = '${code}')`;
const TODAY = `(now() at time zone 'utc')::date`;

/** "count = n" as an ok/detail pair, for the verification queries. */
const need = (label: string, expr: string, want: string) =>
  `'${label.replace(/'/g, "''")}: ' || (${expr})::text || ' (need ${want})'`;

export const SEED_EXTENSION_IMPLS: readonly SeedExtensionImpl[] = [
  // ===========================================================================
  // BASELINE
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // F4 — a concrete row that FALSIFIES each anon-admitting predicate.
  // ---------------------------------------------------------------------------
  {
    key: "anon_falsifying_row:public.career_nodes",
    scope: "baseline",
    statements: [
      `insert into public.career_nodes
         (id, code, chapter, chapter_order, node_order, title, summary, objective,
          ruleset_id, tier, starting_chips, reward_chips, reward_xp, is_active)
       values ('${F.inactiveCareerNode.value}', 'attest-inactive-node', 'SKYLINE', 3, 20,
               'Attest inactive node', 'Synthetic row: is_active = false, the falsifying subject for career_nodes_select_active.',
               '{"type":"attest"}'::jsonb, ${RULESET}, 'casual', 1000, 0, 0, false)
       on conflict (id) do update set is_active = false`,
    ],
    verify: `select count(*) = 1 as ok,
                    'career_nodes row ' || '${F.inactiveCareerNode.value}' || ' with is_active = false: ' || count(*)::text as detail
             from public.career_nodes where id = '${F.inactiveCareerNode.value}' and is_active = false`,
  },
  {
    key: "anon_falsifying_row:public.cosmetics",
    scope: "baseline",
    statements: [
      `insert into public.cosmetics (id, code, kind, name, asset_key, unlock_type, unlock_config, sort_order, is_active)
       values ('${F.inactiveCosmetic.value}', 'attest-inactive-cosmetic', 'avatar', 'Attest inactive',
               'attest/inactive', 'default', '{}'::jsonb, 9001, false)
       on conflict (id) do update set is_active = false`,
    ],
    verify: `select count(*) = 1 as ok,
                    'cosmetics row with is_active = false: ' || count(*)::text as detail
             from public.cosmetics where id = '${F.inactiveCosmetic.value}' and is_active = false`,
  },
  {
    key: "anon_falsifying_row:public.rulesets",
    scope: "baseline",
    statements: [
      // rules must carry the eight required keys, and its id/version must match
      // the row's own key/version (rulesets_payload_matches_identity).
      `insert into public.rulesets (id, key, version, label, rules, is_active)
       values ('${F.inactiveRuleset.value}', 'attest-inactive', 1, 'Attest inactive ruleset',
               '{"id":"attest-inactive","version":1,"deckCount":6,"dealerHitsSoft17":true,
                 "blackjackPayoutNumerator":3,"blackjackPayoutDenominator":2,"targetPenetration":0.75,
                 "minBet":10,"maxBet":1000,"betIncrement":10}'::jsonb, false)
       on conflict (id) do update set is_active = false`,
    ],
    verify: `select count(*) = 1 as ok,
                    'rulesets row with is_active = false: ' || count(*)::text as detail
             from public.rulesets where id = '${F.inactiveRuleset.value}' and is_active = false`,
  },
  {
    key: "anon_falsifying_row:public.tournaments",
    scope: "baseline",
    statements: [
      `insert into public.tournaments
         (id, code, name, format, status, ruleset_id, tier, entry_fee_chips, starting_chips,
          min_entries, max_entries, prize_structure, registration_opens_at, starts_at)
       values ('${F.cancelledTournament.value}', 'attest-cancelled', 'Attest cancelled', 'leaderboard',
               'cancelled', ${RULESET}, 'standard', 0, 1000, 2, 8, '[]'::jsonb, now(), now())
       on conflict (id) do update set status = 'cancelled'`,
    ],
    verify: `select count(*) = 1 as ok,
                    'tournaments row with status = cancelled: ' || count(*)::text as detail
             from public.tournaments where id = '${F.cancelledTournament.value}' and status = 'cancelled'`,
  },

  // ---------------------------------------------------------------------------
  // The fifth account. Created through Arc21's own bootstrap, like the others.
  // ---------------------------------------------------------------------------
  {
    key: "account:erin",
    scope: "baseline",
    statements: [
      `insert into auth.users (id, email, aud, role, raw_user_meta_data)
       values ('${F.erin.value}', 'erin@attest.test', 'authenticated', 'authenticated',
               '{"username": "erin_e", "display_name": "${ERIN_DISPLAY_NAME}"}'::jsonb)
       on conflict (id) do nothing`,
      // Privacy is a client-writable profile column, so it is set here the way
      // the settings screen would set it; it is not a server-owned column.
      `update public.profiles set privacy = 'private' where id = '${F.erin.value}'`,
    ],
    verify: `select (p = 1 and w = 1) as ok,
                    ${need("erin profile with privacy private and display name Erin", "p", "1")} ||
                    ', ' || ${need("erin wallet", "w", "1")} as detail
             from (select
                     (select count(*) from public.profiles where id = '${F.erin.value}'
                        and privacy = 'private' and display_name = '${ERIN_DISPLAY_NAME}') p,
                     (select count(*) from public.wallets where user_id = '${F.erin.value}') w) x`,
  },

  // ---------------------------------------------------------------------------
  // F5 — daily challenge states.
  // ---------------------------------------------------------------------------
  {
    key: "f5_state:ensure_todays_daily_challenge",
    scope: "baseline",
    statements: [
      `insert into public.daily_challenges
         (id, challenge_date, ruleset_id, seed_secret, seed_commitment, hand_count,
          starting_chips, tier, opens_at, closes_at)
       values ('${AUX.dailyOpen}', ${TODAY}, ${RULESET},
               '${AUX.dailySecretOpen}',
               encode(extensions.digest('${AUX.dailySecretOpen}', 'sha256'), 'hex'),
               10, 1000, 'standard', now() - interval '1 hour', now() + interval '23 hours')
       on conflict (challenge_date) do nothing`,
    ],
    verify: `select count(*) = 1 as ok,
                    'today''s challenge open (opens_at <= now < closes_at, unrevealed): ' || count(*)::text as detail
             from public.daily_challenges
             where id = '${AUX.dailyOpen}' and challenge_date = ${TODAY}
               and opens_at <= now() and closes_at > now() and revealed_seed is null`,
  },
  {
    key: "f5_state:latest_verifiable_daily_challenge",
    scope: "baseline",
    statements: [
      `insert into public.daily_challenges
         (id, challenge_date, ruleset_id, seed_secret, seed_commitment, hand_count,
          starting_chips, tier, opens_at, closes_at, revealed_seed, seed_revealed_at)
       values ('${AUX.dailyRevealed}', ${TODAY} - 1, ${RULESET},
               '${AUX.dailySecretRevealed}',
               encode(extensions.digest('${AUX.dailySecretRevealed}', 'sha256'), 'hex'),
               10, 1000, 'standard', now() - interval '2 days', now() - interval '1 day',
               '${AUX.dailySecretRevealed}', now() - interval '23 hours')
       on conflict (challenge_date) do nothing`,
    ],
    // The unrevealed one is the LATER date, so a broken filter would return it first.
    verify: `select (revealed = 1 and later_unrevealed = 1) as ok,
                    ${need("revealed challenge yesterday", "revealed", "1")} || ', ' ||
                    ${need("a later, unrevealed challenge", "later_unrevealed", "1")} as detail
             from (select
                     (select count(*) from public.daily_challenges where id = '${AUX.dailyRevealed}' and revealed_seed is not null) revealed,
                     (select count(*) from public.daily_challenges where revealed_seed is null
                        and challenge_date > (select challenge_date from public.daily_challenges where id = '${AUX.dailyRevealed}')) later_unrevealed) x`,
  },
  // ---------------------------------------------------------------------------
  // F1 — shared membership, with a genuine non-member.
  // ---------------------------------------------------------------------------
  {
    key: "room_alice_bob",
    scope: "baseline",
    statements: [
      `insert into public.rooms (id, code, host_user_id, visibility, mode, ruleset_id, max_seats, status, expires_at)
       values ('${F.roomAliceBob.value}', 'ATSTAB', '${F.alice.value}', 'private', 'private_table',
               ${RULESET}, 5, 'lobby', ${FUTURE})
       on conflict (id) do update set status = 'lobby', expires_at = ${FUTURE}`,
      `insert into public.room_members (id, room_id, user_id, seat_index, status)
       values ('${AUX.memberAliceRoomAB}', '${F.roomAliceBob.value}', '${F.alice.value}', 0, 'joined'),
              ('${AUX.memberBobRoomAB}',   '${F.roomAliceBob.value}', '${F.bob.value}',   1, 'joined')
       on conflict (room_id, user_id) do update set status = 'joined'`,
    ],
    verify: `select (r = 1 and m = 2 and carol = 0) as ok,
                    'room ' || case when r=1 then 'present' else 'MISSING' end ||
                    ', joined members ' || m::text || ' (need 2), carol memberships ' || carol::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.rooms where id = '${F.roomAliceBob.value}' and status <> 'closed') r,
                     (select count(*) from public.room_members where room_id = '${F.roomAliceBob.value}' and status = 'joined') m,
                     (select count(*) from public.room_members where room_id = '${F.roomAliceBob.value}' and user_id = '${F.carol.value}') carol
                  ) x`,
  },
  {
    key: "fixture:roomBobHosts",
    scope: "baseline",
    statements: [
      `insert into public.rooms (id, code, host_user_id, visibility, mode, ruleset_id, max_seats, status, expires_at)
       values ('${F.roomBobHosts.value}', 'ATSTBH', '${F.bob.value}', 'private', 'private_table',
               ${RULESET}, 5, 'lobby', ${FUTURE})
       on conflict (id) do update set status = 'lobby', expires_at = ${FUTURE}`,
      `insert into public.room_members (id, room_id, user_id, seat_index, status)
       values ('${AUX.memberBobRoomBH}',   '${F.roomBobHosts.value}', '${F.bob.value}',   0, 'joined'),
              ('${AUX.memberCarolRoomBH}', '${F.roomBobHosts.value}', '${F.carol.value}', 1, 'joined')
       on conflict (room_id, user_id) do update set status = 'joined'`,
    ],
    verify: `select (r = 1 and m = 2 and alice = 0) as ok,
                    'bob-hosted private lobby room without a game ' || case when r=1 then 'present' else 'MISSING' end ||
                    ', joined members ' || m::text || ' (need 2), alice memberships ' || alice::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.rooms where id = '${F.roomBobHosts.value}' and host_user_id = '${F.bob.value}'
                        and visibility = 'private' and status = 'lobby' and game_session_id is null) r,
                     (select count(*) from public.room_members where room_id = '${F.roomBobHosts.value}' and status = 'joined') m,
                     (select count(*) from public.room_members where room_id = '${F.roomBobHosts.value}' and user_id = '${F.alice.value}') alice
                  ) x`,
  },
  {
    // The reference room for F5.join_private_room.270, whose approved result
    // is a refusal "that does not distinguish a non-existent room from an
    // ineligible one". An expired private lobby is one of the ineligible cases
    // the function's own comment lists, so a call with this room's code is the
    // ineligible half of that comparison (D3.40).
    key: "expired_room",
    scope: "baseline",
    statements: [
      `insert into public.rooms (id, code, host_user_id, visibility, mode, ruleset_id, max_seats, status, expires_at)
       values ('${AUX.roomExpired}', '${AUX.roomExpiredCode}', '${F.bob.value}', 'private', 'private_table',
               ${RULESET}, 5, 'lobby', now() - interval '1 hour')
       on conflict (id) do update set status = 'lobby', expires_at = now() - interval '1 hour'`,
    ],
    verify: `select count(*) = 1 as ok,
                    'private lobby room ${AUX.roomExpiredCode} whose expires_at has passed: ' || count(*)::text as detail
             from public.rooms where id = '${AUX.roomExpired}' and code = '${AUX.roomExpiredCode}'
               and status = 'lobby' and visibility = 'private' and expires_at < now()`,
  },
  {
    key: "tournament_alice_bob",
    scope: "baseline",
    statements: [
      `insert into public.tournaments
         (id, code, name, format, status, ruleset_id, tier, entry_fee_chips, starting_chips,
          min_entries, max_entries, prize_structure, registration_opens_at, starts_at)
       values ('${F.tournamentAliceBob.value}', 'attest-ab', 'Attest alice-bob', 'leaderboard',
               'running', ${RULESET}, 'standard', 0, 1000, 2, 8, '[]'::jsonb, now(), now())
       on conflict (id) do update set status = 'running'`,
      `insert into public.tournament_entries (id, tournament_id, user_id, status, chips)
       values ('${AUX.entryAliceInAB}', '${F.tournamentAliceBob.value}', '${F.alice.value}', 'active', 1000),
              ('${AUX.entryBobInAB}',   '${F.tournamentAliceBob.value}', '${F.bob.value}',   'active', 1000)
       on conflict (tournament_id, user_id) do update set status = 'active'`,
    ],
    verify: `select (t = 1 and e = 2 and carol = 0) as ok,
                    'tournament ' || case when t=1 then 'present' else 'MISSING' end ||
                    ', entries ' || e::text || ' (need 2), carol entries ' || carol::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.tournaments where id = '${F.tournamentAliceBob.value}' and status <> 'cancelled') t,
                     (select count(*) from public.tournament_entries where tournament_id = '${F.tournamentAliceBob.value}') e,
                     (select count(*) from public.tournament_entries where tournament_id = '${F.tournamentAliceBob.value}' and user_id = '${F.carol.value}') carol
                  ) x`,
  },
  {
    // D3.34. The match is a requirement of its own; see the entry.
    key: "tournament_alice_bob_match",
    scope: "baseline",
    statements: [
      `insert into public.tournament_matches
         (id, tournament_id, round, match_index, entry_a_id, entry_b_id, winner_entry_id, status)
       values ('${F.tournamentAliceBobMatch.value}', '${F.tournamentAliceBob.value}', 1, 0,
               '${AUX.entryAliceInAB}', '${AUX.entryBobInAB}', null, 'pending')
       on conflict (id) do update
         set tournament_id = excluded.tournament_id, round = excluded.round, match_index = excluded.match_index,
             entry_a_id = excluded.entry_a_id, entry_b_id = excluded.entry_b_id,
             winner_entry_id = null, status = 'pending'`,
    ],
    verify: `select (present = 1 and right_tournament and slot_a_alice and slot_b_bob and pending_r1s0
                     and carol_in_bracket = 0 and tournament_live) as ok,
                    'match ${F.tournamentAliceBobMatch.value} ' || case when present = 1 then 'present' else 'MISSING' end ||
                    '; in fixtures.tournamentAliceBob: ' || right_tournament::text ||
                    '; slot A is alice''s entry in it: ' || slot_a_alice::text ||
                    '; slot B is bob''s entry in it: ' || slot_b_bob::text ||
                    '; pending, round 1, slot 0, no winner: ' || pending_r1s0::text ||
                    '; carol in that tournament''s bracket: ' || carol_in_bracket::text || ' (need 0)' ||
                    '; tournament present and not cancelled: ' || tournament_live::text as detail
             from (select
                     (select count(*) from public.tournament_matches where id = '${F.tournamentAliceBobMatch.value}') present,
                     coalesce((select m.tournament_id = '${F.tournamentAliceBob.value}'
                                 from public.tournament_matches m where m.id = '${F.tournamentAliceBobMatch.value}'), false) right_tournament,
                     coalesce((select e.user_id = '${F.alice.value}' and e.tournament_id = '${F.tournamentAliceBob.value}'
                                 from public.tournament_matches m join public.tournament_entries e on e.id = m.entry_a_id
                                where m.id = '${F.tournamentAliceBobMatch.value}'), false) slot_a_alice,
                     coalesce((select e.user_id = '${F.bob.value}' and e.tournament_id = '${F.tournamentAliceBob.value}'
                                 from public.tournament_matches m join public.tournament_entries e on e.id = m.entry_b_id
                                where m.id = '${F.tournamentAliceBobMatch.value}'), false) slot_b_bob,
                     coalesce((select m.status = 'pending' and m.round = 1 and m.match_index = 0 and m.winner_entry_id is null
                                 from public.tournament_matches m where m.id = '${F.tournamentAliceBobMatch.value}'), false) pending_r1s0,
                     (select count(*) from public.tournament_matches m
                        join public.tournament_entries e on e.id in (m.entry_a_id, m.entry_b_id)
                       where m.tournament_id = '${F.tournamentAliceBob.value}' and e.user_id = '${F.carol.value}') carol_in_bracket,
                     coalesce((select t.status <> 'cancelled'
                                 from public.tournaments t where t.id = '${F.tournamentAliceBob.value}'), false) tournament_live
                  ) x`,
  },
  {
    // D3.9: alice and dave in the SAME tournament, with the seeded alice->dave
    // block in place, so sprint_standings' unfiltered profiles join can be
    // characterized. The block is what makes this fixture mean something.
    key: "fixture:tournamentAliceDave",
    scope: "baseline",
    statements: [
      `insert into public.tournaments
         (id, code, name, format, status, ruleset_id, tier, entry_fee_chips, starting_chips,
          min_entries, max_entries, prize_structure, registration_opens_at, starts_at)
       values ('${F.tournamentAliceDave.value}', 'attest-ad', 'Attest alice-dave', 'leaderboard',
               'running', ${RULESET}, 'standard', 0, 1000, 2, 8, '[]'::jsonb, now(), now())
       on conflict (id) do update set status = 'running'`,
      `insert into public.tournament_entries (id, tournament_id, user_id, status, chips)
       values ('${AUX.entryAliceInAD}', '${F.tournamentAliceDave.value}', '${F.alice.value}', 'active', 1000),
              ('${AUX.entryDaveInAD}',  '${F.tournamentAliceDave.value}', '${F.dave.value}',  'active', 900)
       on conflict (tournament_id, user_id) do update set status = 'active'`,
    ],
    verify: `select (t = 1 and e = 2 and blk = 1) as ok,
                    'tournament ' || case when t=1 then 'present' else 'MISSING' end ||
                    ', alice+dave entries ' || e::text || ' (need 2), seeded alice->dave block ' || blk::text || ' (need 1)' as detail
             from (select
                     (select count(*) from public.tournaments where id = '${F.tournamentAliceDave.value}') t,
                     (select count(*) from public.tournament_entries
                       where tournament_id = '${F.tournamentAliceDave.value}'
                         and user_id in ('${F.alice.value}','${F.dave.value}')) e,
                     (select count(*) from public.blocks
                       where blocker_id = '${F.alice.value}' and blocked_id = '${F.dave.value}') blk
                  ) x`,
  },
  {
    // Two finished tournaments, so the tournament-wins leaderboard has a public
    // winner (bob) and a private one (erin), and alice has a placement to show
    // in her own competition record.
    key: "completed_tournaments",
    scope: "baseline",
    statements: [
      `insert into public.tournaments
         (id, code, name, format, status, ruleset_id, tier, entry_fee_chips, starting_chips,
          min_entries, max_entries, prize_structure, registration_opens_at, starts_at, ends_at)
       values ('${AUX.tournamentDoneErin}', 'attest-done-erin', 'Attest finished (erin won)', 'leaderboard',
               'completed', ${RULESET}, 'standard', 0, 1000, 2, 8, '[]'::jsonb,
               now() - interval '3 days', now() - interval '3 days', now() - interval '2 days'),
              ('${AUX.tournamentDoneBob}', 'attest-done-bob', 'Attest finished (bob won)', 'leaderboard',
               'completed', ${RULESET}, 'standard', 0, 1000, 2, 8, '[]'::jsonb,
               now() - interval '3 days', now() - interval '3 days', now() - interval '2 days')
       on conflict (id) do update set status = 'completed'`,
      `insert into public.tournament_entries (id, tournament_id, user_id, status, chips, placement)
       values ('${AUX.entryErinInDoneErin}', '${AUX.tournamentDoneErin}', '${F.erin.value}',  'active', 1500, 1),
              ('${AUX.entryBobInDoneErin}',  '${AUX.tournamentDoneErin}', '${F.bob.value}',   'active',  500, 2),
              ('${AUX.entryBobInDoneBob}',   '${AUX.tournamentDoneBob}',  '${F.bob.value}',   'active', 1500, 1),
              ('${AUX.entryAliceInDoneBob}', '${AUX.tournamentDoneBob}',  '${F.alice.value}', 'active',  500, 2)
       on conflict (tournament_id, user_id) do nothing`,
    ],
    verify: `select (t = 2 and w_erin = 1 and w_bob = 1) as ok,
                    ${need("completed tournaments", "t", "2")} || ', ' ||
                    ${need("erin wins", "w_erin", "1")} || ', ' || ${need("bob wins", "w_bob", "1")} as detail
             from (select
                     (select count(*) from public.tournaments where id in ('${AUX.tournamentDoneErin}','${AUX.tournamentDoneBob}') and status = 'completed') t,
                     (select count(*) from public.tournament_entries where user_id = '${F.erin.value}' and placement = 1) w_erin,
                     (select count(*) from public.tournament_entries where user_id = '${F.bob.value}' and placement = 1) w_bob) x`,
  },

  // ---------------------------------------------------------------------------
  // F1 — multi-clause OR predicates need a row naming NEITHER party.
  // ---------------------------------------------------------------------------
  {
    key: "pair_row_bob_carol:public.friend_requests",
    scope: "baseline",
    statements: [
      `insert into public.friend_requests (id, sender_id, receiver_id, status)
       values ('${F.bobNotSentRequest.value}', '${F.bob.value}', '${F.carol.value}', 'pending')
       on conflict (id) do nothing`,
    ],
    verify: `select count(*) = 1 as ok,
                    'bob->carol friend_request naming alice in neither column: ' || count(*)::text as detail
             from public.friend_requests
             where id = '${F.bobNotSentRequest.value}'
               and sender_id = '${F.bob.value}' and receiver_id = '${F.carol.value}'
               and '${F.alice.value}' not in (sender_id, receiver_id)`,
  },
  {
    key: "pair_row_bob_carol:public.friendships",
    scope: "baseline",
    statements: [
      // friendships_canonical_order requires user_id_a < user_id_b. bob (...b)
      // sorts before carol (...c), so this order is the canonical one.
      `insert into public.friendships (id, user_id_a, user_id_b)
       values ('${F.bobCarolFriendship.value}', '${F.bob.value}', '${F.carol.value}')
       on conflict (user_id_a, user_id_b) do nothing`,
    ],
    verify: `select count(*) = 1 as ok,
                    'bob<->carol friendship naming alice in neither column: ' || count(*)::text as detail
             from public.friendships
             where user_id_a = '${F.bob.value}' and user_id_b = '${F.carol.value}'
               and '${F.alice.value}' not in (user_id_a, user_id_b)`,
  },
  {
    // alice's own outgoing request, to erin — not to bob or carol, so a probe
    // listing alice's requests (F5.list_friend_requests.287) can hold her to
    // "no bob or carol row appears" without that being false of correct
    // behaviour. It is also the one alice-sent row F1.053 reads and F2.055
    // cancels.
    key: "alice_sent_request",
    scope: "baseline",
    statements: [
      `insert into public.friend_requests (id, sender_id, receiver_id, status)
       values ('${AUX.requestAliceErin}', '${F.alice.value}', '${F.erin.value}', 'pending')
       on conflict (id) do nothing`,
    ],
    verify: `select (mine = 1 and pending = 1) as ok,
                    ${need("friend_requests with sender alice", "mine", "exactly 1")} || ', ' ||
                    ${need("of them pending alice->erin", "pending", "1")} as detail
             from (select
                     (select count(*) from public.friend_requests where sender_id = '${F.alice.value}') mine,
                     (select count(*) from public.friend_requests where id = '${AUX.requestAliceErin}'
                        and sender_id = '${F.alice.value}' and receiver_id = '${F.erin.value}' and status = 'pending') pending) x`,
  },
  {
    // A block authored by somebody other than alice, so F1.023 and F2.025 have
    // a bob-authored row to be refused. Bob blocks dave, not carol: a block on
    // carol would fire apply_block_side_effects and dissolve the bob<->carol
    // rows the F1 negatives read.
    key: "blocks_by_bob",
    scope: "baseline",
    statements: [
      `insert into public.blocks (id, blocker_id, blocked_id)
       values ('${AUX.blockBobDave}', '${F.bob.value}', '${F.dave.value}')
       on conflict (blocker_id, blocked_id) do nothing`,
    ],
    verify: `select (bob = 1 and alice = 1) as ok,
                    ${need("blocks with blocker bob", "bob", "1")} || ', ' || ${need("blocks with blocker alice", "alice", "exactly 1")} as detail
             from (select
                     (select count(*) from public.blocks where blocker_id = '${F.bob.value}') bob,
                     (select count(*) from public.blocks where blocker_id = '${F.alice.value}') alice) x`,
  },

  // ---------------------------------------------------------------------------
  // F1 — game_events is participation AND (public OR recipient).
  // ---------------------------------------------------------------------------
  {
    key: "game_events_visibility_pair",
    scope: "baseline",
    statements: [
      `insert into public.game_events (id, game_session_id, seq, type, payload, visibility, recipient_user_id)
       values ('${F.publicGameEvent.value}', '${F.session.value}', 1, 'attest.public',
               '{"attest_synthetic":true}'::jsonb, 'public', null)
       on conflict (game_session_id, seq) do nothing`,
      `insert into public.game_events (id, game_session_id, seq, type, payload, visibility, recipient_user_id)
       values ('${F.bobScopedGameEvent.value}', '${F.session.value}', 2, 'attest.seat',
               '{"attest_synthetic":true}'::jsonb, 'seat', '${F.bob.value}')
       on conflict (game_session_id, seq) do nothing`,
    ],
    verify: `select (pub = 1 and seat = 1) as ok,
                    'public-visibility rows ' || pub::text || ' (need 1), bob-scoped seat rows ' || seat::text || ' (need 1)' as detail
             from (select
                     (select count(*) from public.game_events
                       where game_session_id = '${F.session.value}' and visibility = 'public') pub,
                     (select count(*) from public.game_events
                       where game_session_id = '${F.session.value}' and visibility = 'seat'
                         and recipient_user_id = '${F.bob.value}') seat
                  ) x`,
  },

  // ---------------------------------------------------------------------------
  // F1 / F5 — one row owned by alice and one owned by bob, in every table a
  // positive reads and a negative refuses (R2, D3.38).
  // ---------------------------------------------------------------------------
  {
    key: "owned_pair:public.career_attempts",
    scope: "baseline",
    statements: [
      `insert into public.career_attempts (id, user_id, career_node_id, format, starting_chips)
       values ('${AUX.attemptAlice}', '${F.alice.value}', ${NODE("first-deal")}, 'drill', 1000),
              ('${AUX.attemptBob}',   '${F.bob.value}',   ${NODE("first-deal")}, 'drill', 1000)
       on conflict (id) do nothing`,
    ],
    verify: pairVerify("public.career_attempts", "user_id"),
  },
  {
    key: "owned_pair:public.daily_entries",
    scope: "baseline",
    statements: [
      // Completed entries on TODAY's challenge, so the daily leaderboard for
      // the seeded date has rows, and erin's (private) entry is among them.
      `insert into public.daily_entries
         (id, daily_challenge_id, user_id, status, hands_played, final_chips, score,
          completed_at, decisions_total, decisions_optimal)
       values ('${AUX.dailyEntryAlice}', '${AUX.dailyOpen}', '${F.alice.value}', 'completed', 10, 1100, 100, now(), 20, 15),
              ('${AUX.dailyEntryBob}',   '${AUX.dailyOpen}', '${F.bob.value}',   'completed', 10, 1200, 200, now(), 20, 16),
              ('${AUX.dailyEntryErin}',  '${AUX.dailyOpen}', '${F.erin.value}',  'completed', 10, 1300, 300, now(), 20, 17)
       on conflict (id) do nothing`,
    ],
    verify: `select (a = 1 and b = 1 and e = 1) as ok,
                    ${need("completed alice entries today", "a", "1")} || ', ' || ${need("bob", "b", "1")} || ', ' || ${need("erin", "e", "1")} as detail
             from (select
                     (select count(*) from public.daily_entries d join public.daily_challenges c on c.id = d.daily_challenge_id
                       where d.user_id = '${F.alice.value}' and d.status = 'completed' and c.challenge_date = ${TODAY}) a,
                     (select count(*) from public.daily_entries d join public.daily_challenges c on c.id = d.daily_challenge_id
                       where d.user_id = '${F.bob.value}' and d.status = 'completed' and c.challenge_date = ${TODAY}) b,
                     (select count(*) from public.daily_entries d join public.daily_challenges c on c.id = d.daily_challenge_id
                       where d.user_id = '${F.erin.value}' and d.status = 'completed' and c.challenge_date = ${TODAY}) e) x`,
  },
  {
    // One settled hand at the seeded session: the archive row, a hand_players
    // row per seated player, and one graded decision each.
    key: "session_hand",
    scope: "baseline",
    statements: [
      `insert into public.hand_records
         (id, game_session_id, ruleset_id, hand_number, shuffle_number, dealer_cards, dealer_total, completed_at)
       select '${AUX.handRecord}', s.id, s.ruleset_id, 1, 0, '[]'::jsonb, 19, now()
         from public.game_sessions s where s.id = '${F.session.value}'
       on conflict (id) do nothing`,
      `insert into public.hand_players
         (id, hand_record_id, game_session_id, seat_id, user_id, engine_hand_id, wager, status, outcome, credit, net, best_total)
       values ('${AUX.handPlayerAlice}', '${AUX.handRecord}', '${F.session.value}', '${AUX.seatAlice}', '${F.alice.value}',
               'attest-h1-alice', 100, 'STOOD', 'LOSS', 0, -100, 18),
              ('${AUX.handPlayerBob}',   '${AUX.handRecord}', '${F.session.value}', '${AUX.seatBob}',   '${F.bob.value}',
               'attest-h1-bob',   100, 'STOOD', 'WIN', 200, 100, 20)
       on conflict (id) do nothing`,
      `insert into public.player_actions
         (id, hand_player_id, hand_record_id, game_session_id, user_id, seq, action, optimal_action, was_optimal)
       values ('${AUX.actionAlice}', '${AUX.handPlayerAlice}', '${AUX.handRecord}', '${F.session.value}', '${F.alice.value}', 1, 'STAND', 'STAND', true),
              ('${AUX.actionBob}',   '${AUX.handPlayerBob}',   '${AUX.handRecord}', '${F.session.value}', '${F.bob.value}',   1, 'STAND', 'STAND', true)
       on conflict (id) do nothing`,
    ],
    verify: `select (hr = 1 and hp = 2 and pa_a = 1 and pa_b = 1) as ok,
                    ${need("hand_records at the session", "hr", "1")} || ', ' || ${need("hand_players (alice, bob)", "hp", "2")} || ', ' ||
                    ${need("player_actions alice", "pa_a", "1")} || ', ' || ${need("player_actions bob", "pa_b", "1")} as detail
             from (select
                     (select count(*) from public.hand_records where game_session_id = '${F.session.value}') hr,
                     (select count(*) from public.hand_players where game_session_id = '${F.session.value}'
                        and user_id in ('${F.alice.value}','${F.bob.value}')) hp,
                     (select count(*) from public.player_actions where user_id = '${F.alice.value}') pa_a,
                     (select count(*) from public.player_actions where user_id = '${F.bob.value}') pa_b) x`,
  },
  {
    key: "owned_pair:public.player_daily_xp",
    scope: "baseline",
    statements: [
      // Today, so every row falls in the current UTC week the weekly board reads.
      `insert into public.player_daily_xp (id, user_id, utc_day, repeatable_xp, milestone_xp)
       values ('${AUX.dailyXpAlice}', '${F.alice.value}', ${TODAY},  50, 0),
              ('${AUX.dailyXpBob}',   '${F.bob.value}',   ${TODAY},  80, 0),
              ('${AUX.dailyXpErin}',  '${F.erin.value}',  ${TODAY}, 120, 0)
       on conflict (id) do nothing`,
    ],
    verify: `select (a = 1 and b = 1 and e = 1) as ok,
                    ${need("alice xp rows this week", "a", "1")} || ', ' || ${need("bob", "b", "1")} || ', ' || ${need("erin", "e", "1")} as detail
             from (select
                     (select count(*) from public.player_daily_xp where user_id = '${F.alice.value}' and utc_day >= public.utc_week_start()) a,
                     (select count(*) from public.player_daily_xp where user_id = '${F.bob.value}'   and utc_day >= public.utc_week_start()) b,
                     (select count(*) from public.player_daily_xp where user_id = '${F.erin.value}'  and utc_day >= public.utc_week_start()) e) x`,
  },
  {
    key: "owned_pair:public.player_decision_periods",
    scope: "baseline",
    statements: [
      // At or above strategy_accuracy_minimum_decisions() (100), so each account
      // qualifies for the weekly strategy-accuracy board.
      `insert into public.player_decision_periods (id, user_id, period_start, decisions_total, decisions_optimal)
       values ('${AUX.decisionAlice}', '${F.alice.value}', public.utc_week_start(), 150, 120),
              ('${AUX.decisionBob}',   '${F.bob.value}',   public.utc_week_start(), 200, 150),
              ('${AUX.decisionErin}',  '${F.erin.value}',  public.utc_week_start(), 300, 280)
       on conflict (id) do nothing`,
    ],
    verify: `select (q = 3) as ok,
                    ${need("qualifying decision periods this week (alice, bob, erin)", "q", "3")} as detail
             from (select count(*) q from public.player_decision_periods
                    where period_start = public.utc_week_start()
                      and decisions_total >= public.strategy_accuracy_minimum_decisions()
                      and user_id in ('${F.alice.value}','${F.bob.value}','${F.erin.value}')) x`,
  },
  {
    key: "owned_pair:public.player_mode_stats",
    scope: "baseline",
    statements: [
      `insert into public.player_mode_stats (id, user_id, mode, ruleset_key, sessions_played, hands_played, hands_won)
       values ('${AUX.modeStatsAlice}', '${F.alice.value}', 'solo', 'arc-standard@1', 1, 10, 4),
              ('${AUX.modeStatsBob}',   '${F.bob.value}',   'solo', 'arc-standard@1', 1, 12, 6)
       on conflict (id) do nothing`,
    ],
    verify: pairVerify("public.player_mode_stats", "user_id"),
  },
  {
    // alice owns one default cosmetic; bob owns a different one and has it
    // equipped. So alice still has earnable-but-unowned cosmetics (the write
    // path of grant_earned_cosmetics is exercised, not skipped), and bob holds
    // an owned and equipped item alice's inventory and loadout must not show.
    key: "owned_pair:public.user_cosmetics",
    scope: "baseline",
    statements: [
      `insert into public.user_cosmetics (id, user_id, cosmetic_id, source)
       values ('${AUX.cosmeticOwnedAlice}', '${F.alice.value}', ${COSMETIC("avatar-house-dealer")}, 'default'),
              ('${AUX.cosmeticOwnedBob}',   '${F.bob.value}',   ${COSMETIC("avatar-first-chip")},   'default')
       on conflict (id) do nothing`,
      `update public.loadouts set avatar_cosmetic_id = ${COSMETIC("avatar-first-chip")} where user_id = '${F.bob.value}'`,
    ],
    verify: `select (a = 1 and b = 1 and eq = 1 and unowned >= 1) as ok,
                    ${need("alice-owned cosmetics", "a", "1")} || ', ' || ${need("bob-owned", "b", "1")} || ', ' ||
                    ${need("bob equips avatar-first-chip", "eq", "1")} || ', ' ||
                    ${need("default cosmetics alice does not own", "unowned", ">= 1")} as detail
             from (select
                     (select count(*) from public.user_cosmetics where user_id = '${F.alice.value}') a,
                     (select count(*) from public.user_cosmetics where user_id = '${F.bob.value}') b,
                     (select count(*) from public.loadouts where user_id = '${F.bob.value}'
                        and avatar_cosmetic_id = ${COSMETIC("avatar-first-chip")}) eq,
                     (select count(*) from public.cosmetics c where c.is_active and c.unlock_type = 'default'
                        and not exists (select 1 from public.user_cosmetics u
                                         where u.user_id = '${F.alice.value}' and u.cosmetic_id = c.id)) unowned) x`,
  },
  {
    // Everyone waiting at the casual tier. The app's own default expiry (five
    // minutes) is kept; the two matchmaking probes re-stamp the entries they
    // depend on immediately before they run (probe-scoped, below), because a
    // "fresh" entry is a property of the moment, not of the seed.
    key: "queue_population",
    scope: "baseline",
    statements: [
      `insert into public.matchmaking_queue (id, user_id, tier, status, enqueued_at, expires_at)
       values ('${AUX.queueAlice}', '${F.alice.value}', 'casual', 'waiting', now(), now() + interval '5 minutes'),
              ('${AUX.queueBob}',   '${F.bob.value}',   'casual', 'waiting', now(), now() + interval '5 minutes'),
              ('${AUX.queueCarol}', '${F.carol.value}', 'casual', 'waiting', now(), now() + interval '5 minutes')
       on conflict (id) do nothing`,
    ],
    verify: `select (count(*) = 3) as ok,
                    ${need("waiting casual entries for alice, bob and carol", "count(*)", "3")} as detail
             from public.matchmaking_queue
             where user_id in ('${F.alice.value}','${F.bob.value}','${F.carol.value}') and status = 'waiting' and tier = 'casual'`,
  },
  {
    // The accepted-command trail F10.012 reads, and the row F10.013/.014 aim at.
    key: "game_commands_trail",
    scope: "baseline",
    statements: [
      `insert into private.game_commands
         (id, game_session_id, user_id, client_action_id, command_type, applied_version, response)
       values ('${AUX.commandAlice}', '${F.session.value}', '${F.alice.value}', '${AUX.commandActionAlice}', 'stand', 1, '{"status":"accepted"}'::jsonb),
              ('${AUX.commandBob}',   '${F.session.value}', '${F.bob.value}',   '${AUX.commandActionBob}',   'stand', 2, '{"status":"accepted"}'::jsonb)
       on conflict (id) do nothing`,
    ],
    verify: `select (count(*) = 2) as ok, ${need("game_commands rows (alice, bob)", "count(*)", "2")} as detail
             from private.game_commands where id in ('${AUX.commandAlice}','${AUX.commandBob}')`,
  },
  {
    // Allowed-attempt history for bob and carol on 'player_search': one inside
    // the window and one older than the longest window. A rate-limit call by
    // alice prunes only alice's stale rows, so the stale bob and carol rows are
    // exactly what a definer function that forgot its user filter would delete.
    key: "rate_limit_trail",
    scope: "baseline",
    statements: [
      `insert into public.rate_limit_events (id, user_id, action, occurred_at)
       values ('${AUX.rateBobStale}',   '${F.bob.value}',   'player_search', now() - interval '2 hours'),
              ('${AUX.rateBobFresh}',   '${F.bob.value}',   'player_search', now() - interval '30 seconds'),
              ('${AUX.rateCarolStale}', '${F.carol.value}', 'player_search', now() - interval '2 hours'),
              ('${AUX.rateCarolFresh}', '${F.carol.value}', 'player_search', now() - interval '30 seconds')
       on conflict (id) do nothing`,
    ],
    verify: `select (count(*) = 4) as ok, ${need("rate_limit_events for bob and carol (fresh and stale)", "count(*)", "4")} as detail
             from public.rate_limit_events
             where id in ('${AUX.rateBobStale}','${AUX.rateBobFresh}','${AUX.rateCarolStale}','${AUX.rateCarolFresh}')`,
  },

  // ---------------------------------------------------------------------------
  // F5 — a cosmetic that EXISTS but that alice does not own.
  // ---------------------------------------------------------------------------
  {
    key: "fixture:unownedCosmetic",
    scope: "baseline",
    statements: [
      `insert into public.cosmetics (id, code, kind, name, asset_key, unlock_type, unlock_config, sort_order, is_active)
       values ('${F.unownedCosmetic.value}', 'attest-unowned', 'avatar', 'Attest unowned',
               'attest/unowned', 'achievement', '{"achievement":"attest-never-granted"}'::jsonb, 9002, true)
       on conflict (id) do nothing`,
      `delete from public.user_cosmetics
        where cosmetic_id = '${F.unownedCosmetic.value}' and user_id = '${F.alice.value}'`,
    ],
    verify: `select (c = 1 and owned = 0) as ok,
                    'active avatar cosmetic exists ' || c::text || ' (need 1), alice ownership rows ' || owned::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.cosmetics where id = '${F.unownedCosmetic.value}' and is_active and kind = 'avatar') c,
                     (select count(*) from public.user_cosmetics
                       where cosmetic_id = '${F.unownedCosmetic.value}' and user_id = '${F.alice.value}') owned
                  ) x`,
  },

  {
    // create_private_room(9) is refused by the 2..5 bound; nothing needs
    // seeding. Verified by confirming the function is there to be called.
    key: "f5_state:create_private_room",
    scope: "baseline",
    statements: [],
    verify: `select count(*) = 1 as ok,
                    'create_private_room(integer) present and SECURITY DEFINER: ' || count(*)::text as detail
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'create_private_room' and p.prosecdef`,
  },

  // ---------------------------------------------------------------------------
  // F8 — Realtime rows, so a permitted read has something to return.
  // ---------------------------------------------------------------------------
  {
    key: "realtime_seed_rows",
    scope: "baseline",
    statements: [
      `insert into realtime.messages (id, topic, extension, payload, event, private, inserted_at, updated_at)
       values ('${F.gameTopicMessage.value}', '${F.gameTopic.value}', 'broadcast',
               '{"attest_synthetic":true}'::jsonb, 'state', true, now(), now())
       on conflict do nothing`,
      `insert into realtime.messages (id, topic, extension, payload, event, private, inserted_at, updated_at)
       values ('${F.presenceMessage.value}', '${F.presenceTopic.value}', 'presence',
               '{"attest_synthetic":true}'::jsonb, 'track', true, now(), now())
       on conflict do nothing`,
    ],
    verify: `select (g >= 1 and p >= 1) as ok,
                    'rows on the game topic ' || g::text || ' (need >= 1), on presence:players ' || p::text || ' (need >= 1)' as detail
             from (select
                     (select count(*) from realtime.messages where topic = '${F.gameTopic.value}') g,
                     (select count(*) from realtime.messages where topic = '${F.presenceTopic.value}') p
                  ) x`,
  },

  // ---------------------------------------------------------------------------
  // A composite requirement: the rows every caller-scoped F5 function reads.
  // Nothing to apply — every component is its own baseline key — but the
  // verification is the one premise those 21 probes share, checked live.
  // ---------------------------------------------------------------------------
  {
    key: "caller_scoped_population",
    scope: "baseline",
    statements: [],
    verify: `select (bad = 0) as ok,
                    case when bad = 0 then 'bob and carol each hold rows in every table the caller-scoped functions read'
                         else 'tables without both a bob and a carol row: ' || missing end as detail
             from (select count(*) bad, string_agg(t, ', ') missing from (
                     select t from (values
                       ('wallets'), ('wallet_ledger'), ('profiles'), ('notifications'), ('loadouts'),
                       ('career_progress'), ('matchmaking_queue'), ('rate_limit_events'), ('friendships'), ('friend_requests')
                     ) v(t)
                     where not exists (
                       select 1 from (
                         select 'wallets' t, user_id u from public.wallets
                         union all select 'wallet_ledger', user_id from public.wallet_ledger
                         union all select 'profiles', id from public.profiles
                         union all select 'notifications', user_id from public.notifications
                         union all select 'loadouts', user_id from public.loadouts
                         union all select 'career_progress', user_id from public.career_progress
                         union all select 'matchmaking_queue', user_id from public.matchmaking_queue
                         union all select 'rate_limit_events', user_id from public.rate_limit_events
                         union all select 'friendships', user_id_a from public.friendships
                         union all select 'friendships', user_id_b from public.friendships
                         union all select 'friend_requests', sender_id from public.friend_requests
                         union all select 'friend_requests', receiver_id from public.friend_requests
                       ) r where r.t = v.t and r.u = '${F.bob.value}')
                        or not exists (
                       select 1 from (
                         select 'wallets' t, user_id u from public.wallets
                         union all select 'wallet_ledger', user_id from public.wallet_ledger
                         union all select 'profiles', id from public.profiles
                         union all select 'notifications', user_id from public.notifications
                         union all select 'loadouts', user_id from public.loadouts
                         union all select 'career_progress', user_id from public.career_progress
                         union all select 'matchmaking_queue', user_id from public.matchmaking_queue
                         union all select 'rate_limit_events', user_id from public.rate_limit_events
                         union all select 'friendships', user_id_a from public.friendships
                         union all select 'friendships', user_id_b from public.friendships
                         union all select 'friend_requests', sender_id from public.friend_requests
                         union all select 'friend_requests', receiver_id from public.friend_requests
                       ) r where r.t = v.t and r.u = '${F.carol.value}')) m) x`,
  },

  // ===========================================================================
  // PROBE-SCOPED — applied to a verified baseline before one probe; the
  // executor rebuilds afterwards.
  // ===========================================================================
  {
    // join_matchmaking refuses a caller holding a live seat (PT409 "you are
    // already seated at a table") before it does anything else — a business
    // prerequisite, not the property F5.279 asks about. So alice stands up
    // (her seat 'left', the state `syncSeatRow` leaves after settlement) and
    // holds no queue entry of her own; bob and carol are re-stamped fresh.
    key: "f5_state:join_matchmaking",
    scope: "probe",
    statements: [
      `update public.game_session_seats set status = 'left', left_at = now() where id = '${AUX.seatAlice}'`,
      `delete from public.matchmaking_queue where user_id = '${F.alice.value}'`,
      `update public.matchmaking_queue set enqueued_at = now(), expires_at = now() + interval '5 minutes', status = 'waiting'
        where id in ('${AUX.queueBob}', '${AUX.queueCarol}')`,
    ],
    verify: `select (seated = 0 and mine = 0 and bob_fresh = 1) as ok,
                    ${need("live seats held by alice", "seated", "0")} || ', ' || ${need("queue entries held by alice", "mine", "0")} || ', ' ||
                    ${need("bob's fresh waiting entry", "bob_fresh", "1")} as detail
             from (select
                     (select count(*) from public.game_session_seats s join public.game_sessions g on g.id = s.game_session_id
                       where s.user_id = '${F.alice.value}' and s.status <> 'left' and g.status in ('lobby','active')) seated,
                     (select count(*) from public.matchmaking_queue where user_id = '${F.alice.value}') mine,
                     (select count(*) from public.matchmaking_queue where id = '${AUX.queueBob}' and status = 'waiting' and expires_at > now()) bob_fresh) x`,
  },
  {
    // poll_matchmaking reports the caller's live entry; alice holds one, and bob
    // and carol wait at the same tier, so "others waiting" is non-zero and the
    // allocation branch runs. All three are re-stamped fresh.
    key: "f5_state:poll_matchmaking",
    scope: "probe",
    statements: [
      `update public.matchmaking_queue set enqueued_at = now(), expires_at = now() + interval '5 minutes', status = 'waiting'
        where id in ('${AUX.queueAlice}', '${AUX.queueBob}', '${AUX.queueCarol}')`,
    ],
    verify: `select (count(*) = 3) as ok, ${need("fresh waiting casual entries for alice, bob and carol", "count(*)", "3")} as detail
             from public.matchmaking_queue
             where id in ('${AUX.queueAlice}','${AUX.queueBob}','${AUX.queueCarol}') and status = 'waiting' and expires_at > now()`,
  },
  {
    // delete_own_account refuses a caller holding an active seat at an active
    // session (P0001 "leave your table before deleting your account") — the
    // business rule F5.283 must not be allowed to satisfy. Alice's seat is
    // 'left', which the function's own comment names as the state in which a
    // player owes and holds nothing. Arc21's active-seat rule is untouched.
    key: "probe:alice_seat_left",
    scope: "probe",
    statements: [
      `update public.game_session_seats set status = 'left', left_at = now() where id = '${AUX.seatAlice}'`,
    ],
    verify: `select (count(*) = 0) as ok, ${need("active seats alice holds at an active session", "count(*)", "0")} as detail
             from public.game_sessions s join public.game_session_seats seat on seat.game_session_id = s.id
             where seat.user_id = '${F.alice.value}' and seat.status <> 'left' and s.status = 'active'`,
  },
  {
    key: "probe:carol_no_tie_to_bob",
    scope: "probe",
    statements: [
      `delete from public.friendships where user_id_a = '${F.bob.value}' and user_id_b = '${F.carol.value}'`,
      `delete from public.friend_requests where (sender_id, receiver_id) in (('${F.bob.value}','${F.carol.value}'), ('${F.carol.value}','${F.bob.value}'))`,
    ],
    verify: `select (f = 0 and r = 0 and ab = 1) as ok,
                    ${need("carol<->bob friendships", "f", "0")} || ', ' || ${need("carol<->bob friend_requests", "r", "0")} || ', ' ||
                    ${need("alice<->bob friendship", "ab", "1")} as detail
             from (select
                     (select count(*) from public.friendships where (user_id_a, user_id_b) in (('${F.bob.value}','${F.carol.value}'))) f,
                     (select count(*) from public.friend_requests where (sender_id, receiver_id) in (('${F.bob.value}','${F.carol.value}'),('${F.carol.value}','${F.bob.value}'))) r,
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}') ab) x`,
  },
  {
    key: "probe:carol_not_bobs_friend",
    scope: "probe",
    statements: [
      `delete from public.friendships where user_id_a = '${F.bob.value}' and user_id_b = '${F.carol.value}'`,
    ],
    verify: `select (f = 0 and ab = 1) as ok,
                    ${need("carol<->bob friendships", "f", "0")} || ', ' || ${need("alice<->bob friendship", "ab", "1")} as detail
             from (select
                     (select count(*) from public.friendships where user_id_a = '${F.bob.value}' and user_id_b = '${F.carol.value}') f,
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}') ab) x`,
  },
  {
    // "a request alice sent to bob" can only exist while they are not yet
    // friends — send_friend_request answers 'friends' and the insert policy
    // requires NOT viewer_is_friend_of — so the friendship is dissolved and
    // the request is the application-consistent state that precedes it.
    key: "probe:alice_sent_bob_request",
    scope: "probe",
    statements: [
      `delete from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}'`,
      `insert into public.friend_requests (id, sender_id, receiver_id, status)
       values ('${AUX.requestAliceBob}', '${F.alice.value}', '${F.bob.value}', 'pending')`,
    ],
    verify: `select (req = 1 and fr = 0 and carol_recv = 0) as ok,
                    ${need("pending alice->bob requests", "req", "1")} || ', ' || ${need("alice<->bob friendships", "fr", "0")} || ', ' ||
                    ${need("requests from alice received by carol", "carol_recv", "0")} as detail
             from (select
                     (select count(*) from public.friend_requests where id = '${AUX.requestAliceBob}' and status = 'pending') req,
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}') fr,
                     (select count(*) from public.friend_requests where sender_id = '${F.alice.value}' and receiver_id = '${F.carol.value}') carol_recv) x`,
  },
  {
    key: "probe:alice_bob_not_friends",
    scope: "probe",
    statements: [
      `delete from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}'`,
    ],
    verify: `select (fr = 0 and pub) as ok,
                    ${need("alice<->bob friendships", "fr", "0")} || ', bob privacy public: ' || pub::text as detail
             from (select
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}') fr,
                     coalesce((select privacy = 'public' from public.profiles where id = '${F.bob.value}'), false) pub) x`,
  },
  {
    key: "probe:carol_sent_alice_request",
    scope: "probe",
    statements: [
      `insert into public.friend_requests (id, sender_id, receiver_id, status)
       values ('${AUX.requestCarolAlice}', '${F.carol.value}', '${F.alice.value}', 'pending')`,
    ],
    verify: `select (count(*) = 1) as ok, ${need("pending requests received by alice", "count(*)", "exactly 1")} as detail
             from public.friend_requests where receiver_id = '${F.alice.value}' and status = 'pending'`,
  },
  {
    key: "probe:alice_has_no_loadout",
    scope: "probe",
    statements: [`delete from public.loadouts where user_id = '${F.alice.value}'`],
    verify: `select (count(*) = 0) as ok, ${need("loadouts owned by alice", "count(*)", "0")} as detail
             from public.loadouts where user_id = '${F.alice.value}'`,
  },
  {
    key: "probe:bob_has_no_loadout",
    scope: "probe",
    statements: [`delete from public.loadouts where user_id = '${F.bob.value}'`],
    verify: `select (count(*) = 0) as ok, ${need("loadouts owned by bob", "count(*)", "0")} as detail
             from public.loadouts where user_id = '${F.bob.value}'`,
  },
  {
    // So F3.058's bob->carol row is otherwise valid: with the baseline's pending
    // bob->carol request present, a broken WITH CHECK would surface as a unique
    // violation instead of an inserted row.
    key: "probe:no_bob_to_carol_request",
    scope: "probe",
    statements: [
      `delete from public.friend_requests where sender_id = '${F.bob.value}' and receiver_id = '${F.carol.value}'`,
    ],
    verify: `select (count(*) = 0) as ok, ${need("bob->carol friend_requests", "count(*)", "0")} as detail
             from public.friend_requests where sender_id = '${F.bob.value}' and receiver_id = '${F.carol.value}'`,
  },
  {
    // claim_recovery_grant refuses a balance at or above 2,000 (P0001) — a
    // business rule. Alice's balance is brought to 1,000 through the server's
    // own chip-movement path, so the ledger and the balance still reconcile.
    key: "probe:alice_low_balance",
    scope: "probe",
    statements: [
      `select public.apply_wallet_delta('${F.alice.value}', -24000, 'correction', 'attest-probe-low-balance', 'attest', null, '{}'::jsonb)`,
    ],
    verify: `select (bal < 2000 and recon and grants = 0) as ok,
                    'alice balance ' || bal::text || ' (need < 2000), reconciles with ledger: ' || recon::text ||
                    ', ' || ${need("recovery grants in the last 12h", "grants", "0")} as detail
             from (select
                     (select balance from public.wallets where user_id = '${F.alice.value}') bal,
                     (select balance = (select coalesce(sum(delta),0) from public.wallet_ledger where user_id = '${F.alice.value}')
                        from public.wallets where user_id = '${F.alice.value}') recon,
                     (select count(*) from public.wallet_ledger where user_id = '${F.alice.value}' and reason = 'recovery_grant'
                        and created_at > now() - interval '12 hours') grants) x`,
  },
  {
    // list_friends returns the caller's friends' profiles. Under the standing
    // seed alice's friend IS bob, so "no bob row appears in the result" would be
    // false of a function working correctly. Alice's friend becomes erin; the
    // bob<->carol friendship stays present, so a leak past alice's own rows
    // would show.
    key: "probe:alice_friend_is_erin",
    scope: "probe",
    statements: [
      `delete from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}'`,
      `insert into public.friendships (id, user_id_a, user_id_b)
       values ('${AUX.friendshipAliceErin}', '${F.alice.value}', '${F.erin.value}')`,
    ],
    verify: `select (ae = 1 and ab = 0 and bc = 1) as ok,
                    ${need("alice<->erin friendship", "ae", "1")} || ', ' || ${need("alice<->bob friendship", "ab", "0")} || ', ' ||
                    ${need("bob<->carol friendship", "bc", "1")} as detail
             from (select
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.erin.value}') ae,
                     (select count(*) from public.friendships where user_id_a = '${F.alice.value}' and user_id_b = '${F.bob.value}') ab,
                     (select count(*) from public.friendships where user_id_a = '${F.bob.value}' and user_id_b = '${F.carol.value}') bc) x`,
  },
  {
    // The deleted-user boundary, made real: dave deletes his own account through
    // Arc21's delete_own_account(), as dave, exactly as the app would. The
    // executor signs dave's token BEFORE this runs and uses those claims after.
    key: "probe:dave_deleted",
    scope: "probe",
    statements: [],
    asClient: { subject: "dave", statement: `select public.delete_own_account()` },
    verify: `select (u = 0 and p = 0) as ok,
                    ${need("auth.users rows for dave", "u", "0")} || ', ' || ${need("profiles rows for dave", "p", "0")} as detail
             from (select
                     (select count(*) from auth.users where id = '${F.dave.value}') u,
                     (select count(*) from public.profiles where id = '${F.dave.value}') p) x`,
  },
  {
    // Gate A, C5 (D3.54). The surviving state three deleted-user rows measure:
    // dave holds a seat at the session and has stood up from it ('left', which
    // delete_own_account() permits), is shown AS DAVE to read the session as a
    // participant, then deletes his own account through Arc21's function. The
    // schema's ON DELETE SET NULL leaves his seat behind, anonymised by the
    // function. Nothing about referential integrity is disabled or bypassed.
    key: "probe:dave_left_seat_then_deleted",
    scope: "probe",
    statements: [
      `insert into public.game_session_seats (id, game_session_id, seat_index, user_id, display_name, stack, buy_in, status)
       values ('${AUX.seatDaveLeft}', '${F.session.value}', 2, '${F.dave.value}', 'Dave', 0, 0, 'left')`,
    ],
    asClient: {
      subject: "dave",
      before: {
        describe: "dave, while his account is live, reads the session's seats as a participant",
        sql: `select count(*) >= 1 as ok,
                     'seats of session ${F.session.value} visible to dave while his account is live: ' || count(*)::text || ' (need >= 1)' as detail
                from public.game_session_seats where game_session_id = '${F.session.value}'`,
      },
      statement: `select public.delete_own_account()`,
    },
    verify: `select (u = 0 and p = 0 and seat = 1) as ok,
                    ${need("auth.users rows for dave", "u", "0")} || ', ' || ${need("profiles rows for dave", "p", "0")} || ', ' ||
                    ${need("dave's former seat surviving with user_id NULL and the name 'Deleted player'", "seat", "1")} as detail
             from (select
                     (select count(*) from auth.users where id = '${F.dave.value}') u,
                     (select count(*) from public.profiles where id = '${F.dave.value}') p,
                     (select count(*) from public.game_session_seats
                       where id = '${AUX.seatDaveLeft}' and game_session_id = '${F.session.value}'
                         and user_id is null and display_name = 'Deleted player' and status = 'left') seat) x`,
  },

  // ===========================================================================
  // RUNTIME — states that are not database rows.
  // ===========================================================================
  {
    key: "f7_scratch_roles",
    scope: "runtime",
    statements: [],
    runtimeOnly: "created and dropped inside the run by the F7 mechanism executor",
    verify: `select (leftover = 0 and can_create) as ok,
                    'leftover scratch roles from a previous run: ' || leftover::text ||
                    ' (need 0); current role may CREATEROLE: ' || can_create::text as detail
             from (select
                     (select count(*) from pg_roles where rolname like 'attest_wp3_scratch%') leftover,
                     (select rolcreaterole or rolsuper from pg_roles where rolname = current_user) can_create
                  ) x`,
  },
  {
    key: "realtime_client_jwts",
    scope: "runtime",
    statements: [],
    runtimeOnly: "signed in-run from the local stack's JWT secret; the Realtime service must be reachable",
    verify: `select true as ok, 'signed in-run; JWT secret and Realtime reachability are checked by preflight, not by SQL' as detail`,
  },
  {
    key: "fixture:expiredJwt",
    scope: "runtime",
    statements: [],
    runtimeOnly: "signed in-run with exp in the past",
    verify: `select true as ok, 'signed in-run; the PostgREST endpoint''s reachability is checked by preflight, not by SQL' as detail`,
  },
  {
    // An absence, not a row. join_private_room('ZZZZZZ') is only a meaningful
    // probe if nothing carries that code.
    key: "fixture:nonexistentRoomCode",
    scope: "runtime",
    statements: [],
    verify: `select count(*) = 0 as ok,
                    'rooms carrying the deliberately-absent code ${F.nonexistentRoomCode.value}: ' || count(*)::text || ' (need 0)' as detail
             from public.rooms where code = '${F.nonexistentRoomCode.value}'`,
  },
];

/** "alice owns exactly one row and bob owns exactly one row" for a table. */
function pairVerify(rel: string, col: string): string {
  return `select (a = 1 and b = 1) as ok,
                 'rows in ${rel} owned by alice: ' || a::text || ' (need 1), by bob: ' || b::text || ' (need 1)' as detail
          from (select
                  (select count(*) from ${rel} where ${col} = '${F.alice.value}') a,
                  (select count(*) from ${rel} where ${col} = '${F.bob.value}') b) x`;
}

/**
 * Where the plan's stated fixture is thinner than what the probe it belongs to
 * actually needs. Empty since D3.34; kept so that such a gap, if one returns,
 * has somewhere visible to be recorded rather than being absorbed silently.
 */
export const FIXTURE_COMPLETENESS_NOTES: readonly { key: string; note: string }[] = [];

export interface SeedExtensionResult {
  readonly key: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Apply every BASELINE implementation, in declaration order, as admin. */
export async function applySeedExtensions(
  admin: Session,
  log: (s: string) => void = () => {},
): Promise<void> {
  for (const impl of SEED_EXTENSION_IMPLS) {
    if (impl.scope !== "baseline" || impl.statements.length === 0) continue;
    for (const sql of impl.statements) {
      try {
        await admin.query(sql);
      } catch (err) {
        throw new Error(
          `seed extension ${impl.key} failed to apply: ${(err as Error).message}\n  statement: ${sql.replace(/\s+/g, " ").slice(0, 300)}`,
        );
      }
    }
    log(`  applied ${impl.key}`);
  }
}

/** Run one implementation's verification. */
export async function verifyOne(admin: Session, impl: SeedExtensionImpl): Promise<SeedExtensionResult> {
  try {
    const { rows } = await admin.query(impl.verify);
    const r = rows[0] as { ok?: boolean; detail?: string } | undefined;
    return { key: impl.key, ok: r?.ok === true, detail: r?.detail ?? "verification returned no row" };
  } catch (err) {
    return { key: impl.key, ok: false, detail: `verification raised: ${(err as Error).message}` };
  }
}

/**
 * Check that every BASELINE and RUNTIME state holds right now. Probe-scoped
 * states are verified by the executor, after their setup and before their probe
 * — verifying them against the baseline would demand the baseline contradict
 * itself.
 */
export async function verifySeedExtensions(admin: Session): Promise<SeedExtensionResult[]> {
  const out: SeedExtensionResult[] = [];
  for (const impl of SEED_EXTENSION_IMPLS) {
    if (impl.scope === "probe") continue;
    out.push(await verifyOne(admin, impl));
  }
  return out;
}

/** Keys this module implements. Compared against the plan's required keys. */
export const IMPLEMENTED_KEYS: readonly string[] = SEED_EXTENSION_IMPLS.map((i) => i.key);

export function implFor(key: string): SeedExtensionImpl | undefined {
  return SEED_EXTENSION_IMPLS.find((i) => i.key === key);
}
