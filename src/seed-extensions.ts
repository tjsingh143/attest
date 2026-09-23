/**
 * Attest — WP3 seed extensions.
 *
 * The standing seed (`seed/seed.sql`) builds the accounts, one game session,
 * one friendship and one block. The WP3 matrix needs more than that: rooms with
 * a non-member, tournaments with a non-entrant, catalogue rows whose
 * anon-admitting predicate is false, a daily challenge that is open and another
 * that is revealed, and Realtime rows on two topics.
 *
 * The plan now *states* those requirements (`plan.seedExtensions`, D3.23). This
 * module is the other half: one implementation per required key, and a runtime
 * verification for each. Preflight compares the two sets and refuses to run the
 * suite unless they are equal, so a fixture can no longer be assumed into
 * existence by a probe that happens to reference it.
 *
 * Everything here runs as the admin role. That is deliberate and it is not a
 * control test: seeding is setup, and the write-guard triggers on these tables
 * (`deny_client_write`) refuse client roles by design — which is itself a
 * control that F2 tests. Seeding through a client role would fail, and seeding
 * *around* the guard would be lying about the state a client can reach.
 *
 * Identifiers are literals. Two runs against the same migrations produce
 * byte-identical state, so a failing probe can be re-run against exactly the
 * rows it failed against. Ids that a planned row names by fixture reference
 * come from `rubric/fixtures.ts`; ids for sub-rows no planned row names
 * (tournament entries, room memberships, queue rows) are literals declared here
 * and are implementation detail rather than part of the plan's vocabulary.
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
  dailyOpen: "eeee0000-0000-4000-8000-000000000001",
  dailyRevealed: "eeee0000-0000-4000-8000-000000000002",
  /** 64 characters, satisfying the 32..256 length check on seed_secret. */
  dailySecretOpen: "attest-open-daily-secret-0000000000000000000000000000000000000001",
  dailySecretRevealed: "attest-revealed-daily-secret-000000000000000000000000000000000002",
} as const;

export interface SeedExtensionImpl {
  readonly key: string;
  /** Applied in order, as admin. Must be safe to re-run. */
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
}

const RULESET = `(select id from public.rulesets where is_active order by key, version limit 1)`;
const FUTURE = `now() + interval '10 years'`;

export const SEED_EXTENSION_IMPLS: readonly SeedExtensionImpl[] = [
  // ---------------------------------------------------------------------------
  // F4 — a concrete row that FALSIFIES each anon-admitting predicate.
  //
  // The predicate is read from the policy by the planner; these rows are the
  // falsifying subject it names. Without them the negative case has nothing to
  // select and "no data" would be true for the wrong reason.
  // ---------------------------------------------------------------------------
  {
    key: "anon_falsifying_row:public.career_nodes",
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
  // F1 — shared membership, with a genuine non-member.
  //
  // These are the fixtures D3.11 turned on: the negative subject for a
  // membership policy is carol, who is deliberately left out of each one.
  // ---------------------------------------------------------------------------
  {
    key: "room_alice_bob",
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
                    'bob-hosted room ' || case when r=1 then 'present' else 'MISSING' end ||
                    ', joined members ' || m::text || ' (need 2), alice memberships ' || alice::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.rooms where id = '${F.roomBobHosts.value}' and host_user_id = '${F.bob.value}') r,
                     (select count(*) from public.room_members where room_id = '${F.roomBobHosts.value}' and status = 'joined') m,
                     (select count(*) from public.room_members where room_id = '${F.roomBobHosts.value}' and user_id = '${F.alice.value}') alice
                  ) x`,
  },
  {
    key: "tournament_alice_bob",
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
    // D3.34. F1.public_tournament_matches.212 (alice, "at least 1 row") and .213
    // (carol, "no data") read MATCH rows for fixtures.tournamentAliceBob.id. The
    // tournament and its entries alone leave that set empty: the positive could
    // not succeed, and the negative's refusal would be true because there was
    // nothing to return. This row used to be added silently under
    // tournament_alice_bob; it is a requirement of its own now.
    //
    // Pinned exactly, because the two probes depend on every part of it: the
    // tournament is the one alice and bob entered and carol did not, slot A is
    // alice's entry, slot B is bob's, and nothing in that tournament's bracket
    // involves carol. Status is `pending` — the policy under test,
    // tournament_matches_select_visible, reads only viewer_is_in_tournament(),
    // so any status would do, and the deterministic choice is the default one.
    //
    // `on conflict (id) do update` puts a drifted row back to exactly this
    // state. A DIFFERENT row occupying the same (tournament, round, slot) is
    // not overwritten: the unique slot constraint raises, and the setup fails
    // loudly rather than adopting someone else's row.
    key: "tournament_alice_bob_match",
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

  // ---------------------------------------------------------------------------
  // F1 — multi-clause OR predicates need a row naming NEITHER party.
  //
  // D3.6 #7: `friend_requests_select_participants` is sender OR receiver, so a
  // row naming alice in either column is legitimately hers. The negative has to
  // be a bob<->carol row.
  // ---------------------------------------------------------------------------
  {
    key: "pair_row_bob_carol:public.friend_requests",
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

  // ---------------------------------------------------------------------------
  // F1 — game_events is participation AND (public OR recipient).
  //
  // The positive needs a public-visibility row; the negative falsifies the
  // participation conjunct. The CHECK constraint pairs visibility with
  // recipient_user_id, so these two rows are the only shapes that exist.
  // ---------------------------------------------------------------------------
  {
    key: "game_events_visibility_pair",
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
  // F5 — a cosmetic that EXISTS but that alice does not own.
  //
  // equip_cosmetic must refuse it. A cosmetic that did not exist would be
  // refused for the wrong reason, and the probe would pass without testing
  // ownership at all.
  // ---------------------------------------------------------------------------
  {
    key: "fixture:unownedCosmetic",
    statements: [
      `insert into public.cosmetics (id, code, kind, name, asset_key, unlock_type, unlock_config, sort_order, is_active)
       values ('${F.unownedCosmetic.value}', 'attest-unowned', 'avatar', 'Attest unowned',
               'attest/unowned', 'achievement', '{"achievement":"attest-never-granted"}'::jsonb, 9002, true)
       on conflict (id) do nothing`,
      `delete from public.user_cosmetics
        where cosmetic_id = '${F.unownedCosmetic.value}' and user_id = '${F.alice.value}'`,
    ],
    verify: `select (c = 1 and owned = 0) as ok,
                    'cosmetic exists ' || c::text || ' (need 1), alice ownership rows ' || owned::text || ' (need 0)' as detail
             from (select
                     (select count(*) from public.cosmetics where id = '${F.unownedCosmetic.value}' and is_active) c,
                     (select count(*) from public.user_cosmetics
                       where cosmetic_id = '${F.unownedCosmetic.value}' and user_id = '${F.alice.value}') owned
                  ) x`,
  },

  // ---------------------------------------------------------------------------
  // F5 — daily challenge states.
  //
  // guard_daily_challenge_seed enforces that seed_commitment is the SHA-256 of
  // seed_secret, and that a revealed seed may only appear after closes_at. Both
  // rows are built to satisfy it rather than around it, so the commitment is
  // computed in SQL from the secret itself.
  // ---------------------------------------------------------------------------
  {
    key: "f5_state:ensure_todays_daily_challenge",
    statements: [
      `insert into public.daily_challenges
         (id, challenge_date, ruleset_id, seed_secret, seed_commitment, hand_count,
          starting_chips, tier, opens_at, closes_at)
       values ('${AUX.dailyOpen}', current_date, ${RULESET},
               '${AUX.dailySecretOpen}',
               encode(extensions.digest('${AUX.dailySecretOpen}', 'sha256'), 'hex'),
               10, 1000, 'standard', now() - interval '1 hour', now() + interval '23 hours')
       on conflict (challenge_date) do nothing`,
    ],
    verify: `select count(*) = 1 as ok,
                    'today''s challenge open (opens_at <= now < closes_at, unrevealed): ' || count(*)::text as detail
             from public.daily_challenges
             where challenge_date = current_date
               and opens_at <= now() and closes_at > now() and revealed_seed is null`,
  },
  {
    key: "f5_state:latest_verifiable_daily_challenge",
    statements: [
      // A past, closed challenge whose seed IS revealed. The guard permits the
      // reveal only because closes_at is already behind us.
      `insert into public.daily_challenges
         (id, challenge_date, ruleset_id, seed_secret, seed_commitment, hand_count,
          starting_chips, tier, opens_at, closes_at, revealed_seed, seed_revealed_at)
       values ('${AUX.dailyRevealed}', current_date - 1, ${RULESET},
               '${AUX.dailySecretRevealed}',
               encode(extensions.digest('${AUX.dailySecretRevealed}', 'sha256'), 'hex'),
               10, 1000, 'standard', now() - interval '2 days', now() - interval '1 day',
               '${AUX.dailySecretRevealed}', now() - interval '23 hours')
       on conflict (challenge_date) do nothing`,
    ],
    verify: `select (revealed >= 1 and unrevealed >= 1) as ok,
                    'revealed challenges ' || revealed::text || ' (need >= 1), unrevealed ' || unrevealed::text || ' (need >= 1)' as detail
             from (select
                     (select count(*) from public.daily_challenges where revealed_seed is not null) revealed,
                     (select count(*) from public.daily_challenges where revealed_seed is null) unrevealed
                  ) x`,
  },

  // ---------------------------------------------------------------------------
  // F5 — matchmaking population.
  //
  // D3.13: join_matchmaking runs expire_stale_queue_entries(), which removes
  // OTHER accounts' stale rows. The invariant is that bob's FRESH entry is left
  // alone, so bob's entry has to be fresh — an expired one would be removed
  // legitimately and the probe would read that as escalation.
  // ---------------------------------------------------------------------------
  {
    key: "f5_state:join_matchmaking",
    statements: [
      `insert into public.matchmaking_queue (id, user_id, tier, status, enqueued_at, expires_at)
       values ('${AUX.queueBob}', '${F.bob.value}', 'casual', 'waiting', now(), now() + interval '1 hour')
       on conflict (id) do update set status = 'waiting', expires_at = now() + interval '1 hour'`,
    ],
    verify: `select count(*) = 1 as ok,
                    'bob holds a fresh waiting queue entry (expires_at in the future): ' || count(*)::text as detail
             from public.matchmaking_queue
             where id = '${AUX.queueBob}' and user_id = '${F.bob.value}'
               and status = 'waiting' and expires_at > now()`,
  },
  {
    key: "f5_state:poll_matchmaking",
    statements: [
      `insert into public.matchmaking_queue (id, user_id, tier, status, enqueued_at, expires_at)
       values ('${AUX.queueBob}',   '${F.bob.value}',   'casual', 'waiting', now(), now() + interval '1 hour'),
              ('${AUX.queueCarol}', '${F.carol.value}', 'casual', 'waiting', now(), now() + interval '1 hour')
       on conflict (id) do update set status = 'waiting', expires_at = now() + interval '1 hour'`,
    ],
    verify: `select count(*) = 2 as ok,
                    'bob and carol both hold waiting queue entries: ' || count(*)::text || ' of 2' as detail
             from public.matchmaking_queue
             where user_id in ('${F.bob.value}', '${F.carol.value}')
               and status = 'waiting' and expires_at > now()`,
  },
  {
    // create_private_room(9) is refused by the 2..5 bound; nothing needs
    // seeding. Verified by confirming the function is there to be called, so a
    // renamed or dropped function fails preflight rather than the probe.
    key: "f5_state:create_private_room",
    statements: [],
    verify: `select count(*) = 1 as ok,
                    'create_private_room(integer) present and SECURITY DEFINER: ' || count(*)::text as detail
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'create_private_room' and p.prosecdef`,
  },

  // ---------------------------------------------------------------------------
  // F8 — Realtime rows, so a permitted read has something to return.
  //
  // A policy test that returns zero rows because the table is empty proves
  // nothing: it cannot tell "the policy admitted you and there was nothing"
  // from "the policy refused you".
  // ---------------------------------------------------------------------------
  {
    key: "realtime_seed_rows",
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
  // States that are not database rows.
  // ---------------------------------------------------------------------------
  {
    // D3.8/D3.15. Created and dropped inside the F7 mechanism executor, because
    // leaving two roles lying around would change the instance's role surface
    // between runs. Preflight checks the run can create them and that none is
    // left over from a crashed run.
    key: "f7_scratch_roles",
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
    statements: [],
    runtimeOnly: "signed in-run from the local stack's JWT secret; the Realtime service must be reachable",
    verify: `select true as ok, 'signed in-run; JWT secret and Realtime reachability are checked by preflight, not by SQL' as detail`,
  },
  {
    key: "fixture:expiredJwt",
    statements: [],
    runtimeOnly: "signed in-run with exp in the past",
    verify: `select true as ok, 'signed in-run; the PostgREST endpoint''s reachability is checked by preflight, not by SQL' as detail`,
  },
  {
    // An absence, not a row. join_private_room('ZZZZZZ') is only a meaningful
    // probe if nothing carries that code.
    key: "fixture:nonexistentRoomCode",
    statements: [],
    verify: `select count(*) = 0 as ok,
                    'rooms carrying the deliberately-absent code ${F.nonexistentRoomCode.value}: ' || count(*)::text || ' (need 0)' as detail
             from public.rooms where code = '${F.nonexistentRoomCode.value}'`,
  },
];

/**
 * Where the plan's stated fixture is thinner than what the probe it belongs to
 * actually needs.
 *
 * These are not semantic changes to an approved test. They are places where the
 * `fixture` sentence under-describes the state its own `expected` requires, and
 * the seeder supplies the difference. Recorded here rather than absorbed
 * silently, because a fixture description that does not support its own
 * expectation is the kind of thing that should be visible to the author.
 */
export const FIXTURE_COMPLETENESS_NOTES: readonly { key: string; note: string }[] = [
  // Empty since D3.34. The one entry this held — tournament_alice_bob's stated
  // fixture not creating the match row its own tournament_matches probes read —
  // is resolved: the match is `tournament_alice_bob_match`, a requirement the
  // plan states and preflight verifies, rather than a row added silently here.
];

export interface SeedExtensionResult {
  readonly key: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Apply every implementation, in declaration order, as admin. */
export async function applySeedExtensions(
  admin: Session,
  log: (s: string) => void = () => {},
): Promise<void> {
  for (const impl of SEED_EXTENSION_IMPLS) {
    if (impl.statements.length === 0) continue;
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

/** Check that every required state actually holds right now. */
export async function verifySeedExtensions(admin: Session): Promise<SeedExtensionResult[]> {
  const out: SeedExtensionResult[] = [];
  for (const impl of SEED_EXTENSION_IMPLS) {
    try {
      const { rows } = await admin.query(impl.verify);
      const r = rows[0] as { ok?: boolean; detail?: string } | undefined;
      out.push({ key: impl.key, ok: r?.ok === true, detail: r?.detail ?? "verification returned no row" });
    } catch (err) {
      out.push({ key: impl.key, ok: false, detail: `verification raised: ${(err as Error).message}` });
    }
  }
  return out;
}

/** Keys this module implements. Compared against the plan's required keys. */
export const IMPLEMENTED_KEYS: readonly string[] = SEED_EXTENSION_IMPLS.map((i) => i.key);
