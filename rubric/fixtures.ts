/**
 * Attest — deterministic fixture references for the WP3 matrix.
 *
 * Every symbolic reference here maps to exactly one value, so a row reading
 * `fixtures.bobNotification.id` can be turned into SQL without a fresh
 * judgment. Prose targets like `<a room hosted by bob>` cannot, which is why
 * they are gone.
 *
 * `seed: "standing"` values exist after seed/seed.sql today.
 * `seed: "extension"` values must be added to the seed before WP3 executes;
 * they are listed as seed extensions in the matrix.
 */
export interface FixtureRef {
  readonly ref: string;
  readonly value: string;
  readonly seed: "standing" | "extension";
  readonly note: string;
}

const F = (ref: string, value: string, seed: "standing" | "extension", note: string): FixtureRef =>
  ({ ref, value, seed, note });

export const FIXTURES = {
  // --- accounts (standing) ------------------------------------------------
  alice: F("fixtures.alice.id", "00000000-0000-4000-8000-00000000000a", "standing", "seeded account, seated at the game session"),
  bob: F("fixtures.bob.id", "00000000-0000-4000-8000-00000000000b", "standing", "seeded account, seated at the game session, friends with alice"),
  carol: F("fixtures.carol.id", "00000000-0000-4000-8000-00000000000c", "standing", "seeded account, deliberately NOT seated and NOT a member of anything"),
  dave: F("fixtures.dave.id", "00000000-0000-4000-8000-00000000000d", "standing", "seeded account blocked by alice; also the deleted-identity subject"),

  // --- shared game state (standing) ---------------------------------------
  session: F("fixtures.session.id", "e0000000-0000-4000-8000-000000000001", "standing", "the private_table session alice and bob are seated at, carol is not"),
  gameTopic: F("fixtures.session.topic", "game:e0000000-0000-4000-8000-000000000001", "standing", "the Realtime topic derived from that session id"),
  presenceTopic: F("fixtures.presenceTopic", "presence:players", "standing", "the one shared topic a client may write"),

  // --- per-account rows (standing) ----------------------------------------
  bobNotification: F("fixtures.bobNotification.id", "c0000000-0000-4000-8000-000000000002", "standing", "bob's seeded notification"),
  aliceNotification: F("fixtures.aliceNotification.id", "c0000000-0000-4000-8000-000000000001", "standing", "alice's seeded notification"),
  bobPushToken: F("fixtures.bobPushToken.token", "ExponentPushToken[attest-bob]", "standing", "bob's seeded push token string"),
  aliceLoadout: F("fixtures.aliceLoadout.id", "a0000000-0000-4000-8000-000000000001", "standing", "alice's seeded loadout"),
  blockAliceDave: F("fixtures.blockAliceDave.id", "bb000000-0000-4000-8000-000000000001", "standing", "the seeded alice-blocks-dave row"),
  friendshipAliceBob: F("fixtures.friendshipAliceBob.id", "aa000000-0000-4000-8000-000000000001", "standing", "the seeded alice-bob friendship"),

  // --- seed extensions the corrected fixtures require ---------------------
  roomBobHosts: F("fixtures.roomBobHosts.id", "11110000-0000-4000-8000-000000000001", "extension", "a private room hosted by BOB, with bob and carol joined and alice not a member"),
  roomAliceBob: F("fixtures.roomAliceBob.id", "11110000-0000-4000-8000-000000000002", "extension", "a private room hosted by alice, with alice and bob joined and carol NOT a member"),
  tournamentAliceBob: F("fixtures.tournamentAliceBob.id", "22220000-0000-4000-8000-000000000001", "extension", "a tournament with alice and bob entered and carol not"),
  tournamentAliceDave: F("fixtures.tournamentAliceDave.id", "22220000-0000-4000-8000-000000000002", "extension", "a tournament with alice and dave both entered, for the sprint_standings block-bypass characterization"),
  unownedCosmetic: F("fixtures.unownedCosmetic.id", "33330000-0000-4000-8000-000000000001", "extension", "a cosmetic alice holds no user_cosmetics row for"),
  bobNotSentRequest: F("fixtures.bobCarolRequest.id", "44440000-0000-4000-8000-000000000001", "extension", "a friend_request from bob to carol, naming alice in neither column"),
  bobCarolFriendship: F("fixtures.bobCarolFriendship.id", "44440000-0000-4000-8000-000000000002", "extension", "a friendship between bob and carol, naming alice in neither column"),
  inactiveCareerNode: F("fixtures.inactiveCareerNode.id", "55550000-0000-4000-8000-000000000001", "extension", "a career_nodes row with is_active = false"),
  inactiveCosmetic: F("fixtures.inactiveCosmetic.id", "55550000-0000-4000-8000-000000000002", "extension", "a cosmetics row with is_active = false"),
  inactiveRuleset: F("fixtures.inactiveRuleset.id", "55550000-0000-4000-8000-000000000003", "extension", "a rulesets row with is_active = false"),
  cancelledTournament: F("fixtures.cancelledTournament.id", "55550000-0000-4000-8000-000000000004", "extension", "a tournaments row with status = 'cancelled'"),
  nonexistentRoomCode: F("fixtures.nonexistentRoomCode", "ZZZZZZ", "extension", "a room code guaranteed not to exist"),
  publicGameEvent: F("fixtures.publicGameEvent.id", "66660000-0000-4000-8000-000000000001", "extension", "a game_events row for the seeded session with visibility = 'public'"),
  bobScopedGameEvent: F("fixtures.bobScopedGameEvent.id", "66660000-0000-4000-8000-000000000002", "extension", "a game_events row for the seeded session with recipient_user_id = bob"),
  gameTopicMessage: F("fixtures.gameTopicMessage.id", "77770000-0000-4000-8000-000000000001", "extension", "a realtime.messages row on the seeded game topic"),
  presenceMessage: F("fixtures.presenceMessage.id", "77770000-0000-4000-8000-000000000002", "extension", "a realtime.messages row on presence:players"),
  aliceJwt: F("fixtures.aliceJwt", "(signed against the local stack's JWT secret, sub = fixtures.alice.id)", "extension", "for the Realtime websocket cases"),
  carolJwt: F("fixtures.carolJwt", "(signed against the local stack's JWT secret, sub = fixtures.carol.id)", "extension", "for the Realtime websocket cases"),
  expiredJwt: F("fixtures.expiredJwt", "(signed with exp in the past, sub = fixtures.alice.id)", "extension", "for the expired-session boundary at the API boundary"),
} as const;

/** Deterministic literal for a column of a given type, used in UPDATE probes. */
export function literalFor(column: string, type: string): string {
  const t = type.toLowerCase();
  if (t.includes("bool")) return "false";
  if (t.includes("int") || t.includes("bigint") || t.includes("numeric")) return "1";
  if (t.includes("timestamp")) return "'2026-01-01T00:00:00Z'";
  if (t.includes("uuid")) return "'00000000-0000-4000-8000-0000000000ff'";
  if (t.includes("[]")) return "'{}'";
  if (t.includes("jsonb") || t.includes("json")) return "'{}'::jsonb";
  if (t.includes("date")) return "'2026-01-01'";
  // enum or text
  if (t.includes("privacy")) return "'private'";
  if (t.includes("status")) return "'accepted'";
  return `'attest-probe-${column}'`;
}

export const SEED_EXTENSION_LIST: readonly FixtureRef[] = Object.values(FIXTURES).filter(
  (f) => f.seed === "extension",
);
