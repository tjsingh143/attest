/**
 * Attest — WP3 planning: the concrete test matrix.
 *
 * Derived from the frozen WP2 tiers, the WP0 control inventory, and the ten
 * control families the brief requires. It plans; it executes nothing.
 *
 * Two rules govern the generator:
 *
 *   Depth follows the tier, not convenience. High gets every applicable
 *   meaningful branch positive and negative; Medium gets the important paths
 *   with representative coverage. No resource is Low, so that activity is
 *   unused.
 *
 *   A family that does not apply gets a stated factual reason, never an
 *   invented test. `notApplicable` rows carry the reason and no test id.
 *
 * `authorIntent` is null on every negative row. Brief §1.1 reserves that
 * sentence for the author, and the planner does not write it.
 */
import type { RiskInput } from "./risk-inputs.ts";
import { DELETE_OWN_ACCOUNT_INVARIANT, F5_CALLER_SCOPED, F5_NO_TARGET_SPECS, F5_SPECS } from "../rubric/f5-escalation.ts";
import { FIXTURES, literalFor } from "../rubric/fixtures.ts";
import type { Level } from "./scorer.ts";

export type Family =
  | "F1 read isolation"
  | "F2 write isolation"
  | "F3 WITH CHECK enforcement"
  | "F4 anonymous exposure"
  | "F5 SECURITY DEFINER escalation"
  | "F6 column-level leakage"
  | "F7 forced RLS / owner bypass"
  | "F8 realtime channel authorization"
  | "F9 wallet / concurrency integrity"
  | "F10 audit trail"
  | "B boundary cases";

/**
 * `characterization` is a third polarity, not a flavour of negative.
 *
 * A row that records what the catalog says — RLS enabled, FORCE absent, owner
 * is postgres — asserts no control and simulates no attack, so it needs no
 * AUTHOR INTENT. Only `negative` rows do.
 */
export type Polarity = "positive" | "negative" | "characterization";
export type Plumbing = "reuse WP1" | "extend WP1" | "new";

/** The assurance verdict this test records when execution matches prediction. */
export type PlannedVerdict = "effective" | "characterized" | "gap";

export interface PlannedTest {
  readonly testId: string;
  readonly family: Family;
  readonly resource: string;
  readonly control: string;
  readonly tier: Level | "suite";
  readonly polarity: Polarity;
  readonly identity: string;
  readonly operation: string;
  readonly expected: string;
  /** The exact seeded state this probe requires. Concrete, never hypothetical. */
  readonly fixture: string;
  /** Which policy branch or critical path this case covers, and why it exists. */
  readonly covers: string;
  readonly plumbing: Plumbing;
  /**
   * What a prediction-matching execution MEANS. Declared in the plan so that
   * "the probe did what we said" can never be read as "the control holds".
   * F7 rows are `characterized`; F10 absence rows are `gap`.
   */
  readonly verdictWhenPredicted: PlannedVerdict;
  /** Reserved for the author. Null on every negative test, by design. */
  readonly authorIntent: string | null;
}

export interface NotApplicable {
  readonly family: Family;
  readonly resource: string;
  readonly reason: string;
}

/**
 * One row per policy CONSIDERED for WITH CHECK testing, whether or not a test
 * was planned for it.
 *
 * It exists because the prose reconciliation was ambiguous: five UPDATE
 * policies had their command corrected, three were found non-exercisable, and
 * four negative tests were planned. Those three numbers are all correct and
 * describe different sets, which is exactly the kind of thing a table settles
 * and a sentence does not. Two of the five were never evaluated at all — the
 * Medium-tier representative rule selected the resource's INSERT policy and
 * the UPDATE one was dropped before the exercisability check ran. That is now
 * visible rather than invisible.
 */
export interface F3Applicability {
  readonly resource: string;
  readonly policy: string;
  readonly polcmd: string;
  readonly withCheck: string;
  readonly newRowColumns: readonly string[];
  readonly clientInsertColumns: readonly string[];
  readonly clientUpdateColumns: readonly string[];
  readonly exercisable: boolean;
  readonly reasonIfNot: string;
  readonly positiveTestId: string | null;
  readonly negativeTestId: string | null;
}

export interface Wp3Plan {
  readonly tests: readonly PlannedTest[];
  readonly notApplicable: readonly NotApplicable[];
  readonly f3Applicability: readonly F3Applicability[];
  /**
   * The state that must exist beyond the standing seed before any of this can
   * execute. Derived from the plan, not declared beside it. See
   * `buildSeedExtensions`.
   */
  readonly seedExtensions: readonly SeedExtension[];
}

const ALICE = "authenticated:alice";
const BOB = "authenticated:bob";
const CAROL = "authenticated:carol";
const ANON = "anon";
const OWNER = "owner(postgres)";

/**
 * The execution identity an F5 attempt names — "as carol, call …",
 * "… then as alice call …", "as anon, call …".
 *
 * Exactly one caller may be named; an attempt naming two would be two probes
 * and is refused here rather than resolved by picking one. An attempt naming
 * none runs as alice, the planner's default subject.
 */
export function callerNamedBy(attempt: string): string {
  const named = [
    ...new Set([...attempt.matchAll(/\bas (alice|bob|carol|dave|anon)\b/gi)].map((m) => m[1]!.toLowerCase())),
  ];
  if (named.length > 1) {
    throw new Error(`an F5 attempt names more than one caller (${named.join(", ")}): "${attempt}"`);
  }
  const who = named[0] ?? "alice";
  return who === "anon" ? ANON : `authenticated:${who}`;
}

/** Identity linkage column to use in a statement, or null. */
function ownerCol(f: RiskInput): string | null {
  return f.directIdentityColumns[0] ?? f.inferredIdentityColumns[0]?.column ?? null;
}

const slug = (r: string) => r.replace(/[^a-z0-9]+/gi, "_");

/**
 * Gate A (2026-09-24, D3.54): approved literals Arc21 refuses for a reason that
 * has nothing to do with the control the row examines, replaced by the author's
 * decision. Keyed by resource and column, and consulted only where a probe must
 * reach its control: the grant-surface UPDATE (C3-tier-literal-invalid) and the
 * F3/F6 UPDATE positives (C3-username-literal-invalid,
 * C3-cosmetic-literal-invalid). `literalFor()` reads neither enum labels, CHECK
 * constraints nor triggers, which is how each invalid literal arose.
 */
const GATE_A_LITERALS: Readonly<Record<string, string>> = {
  "public.game_sessions.tier": "'casual'",
  "public.profiles.username": "'attest_probe_user'",
  "public.loadouts.avatar_cosmetic_id": "NULL",
};
const probeLiteral = (resource: string, column: string, type: string): string =>
  GATE_A_LITERALS[`${resource}.${column}`] ?? literalFor(column, type);

/**
 * Gate A, C2-client-guard-before-grant (D3.54). Every client connection preloads
 * pg_safeupdate, which refuses an UPDATE or DELETE with no WHERE clause at parse
 * analysis — before the privilege check a grant-surface row examines. `where
 * true` satisfies the guard and reads no column, so the statement reaches the
 * same privilege check and nothing else about the question changes.
 */
const WHERE_PAST_CLIENT_GUARD = " where true";

/**
 * Gate A, C5-deleted-user-subject-empty (D3.54): the three deleted-user rows
 * whose resource Arc21 leaves behind after a genuine deletion — the session's
 * seats (user_id ON DELETE SET NULL), the session itself and its event stream —
 * are retargeted at that surviving state. The other eleven keep the approved
 * operation and stay registered (not_measured).
 */
const DELETED_USER_SURVIVING_SESSION: ReadonlySet<string> = new Set([
  "public.game_events", "public.game_session_seats", "public.game_sessions",
]);

/** The seed as it stands after seed/seed.sql. */
const FIXTURE_DEFAULT =
  "the standing seed: alice, bob, carol and dave, with alice and bob seated at session fixtures.session.id, carol not seated, alice↔bob friends, and alice blocking dave";

/**
 * Extra seeded state a probe needs beyond the standing seed.
 *
 * This used to be a `string[]` that `needSeed()` appended to and **nothing ever
 * read** — the accumulator was written on every planning run and dropped on the
 * floor, so a plan that depended on 19 fixtures the standing seed does not
 * create never said so anywhere a reader or an implementer would look. D3.18
 * claimed "the plan now lists explicitly"; it did not. D3.23 is the fix.
 *
 * Each requirement now carries a stable key, which fixture references it
 * materializes, and how it is set up, and the plan carries the set. The
 * executor's preflight refuses to run unless every required key has an
 * implementation, so a fixture can no longer be silently assumed.
 */
export type SeedExtensionKind =
  /** Rows inserted into application tables before the suite runs. */
  | "rows"
  /** Roles created and dropped inside the run. */
  | "roles"
  /** Signed tokens and service reachability, not database state. */
  | "credentials"
  /** A value deliberately chosen NOT to exist; setup verifies the absence. */
  | "absence";

/**
 * When a requirement's state is established (D3.38).
 *
 *   baseline  applied after every rebuild, before any probe; additive and
 *             contradicted by no probe's premise
 *   probe     applied to a verified baseline before the ONE probe that needs
 *             it, because its premise contradicts the baseline; the executor
 *             rebuilds afterwards
 *   runtime   not database rows (roles made in-run, signed tokens, an absence)
 */
export type SeedExtensionScope = "baseline" | "probe" | "runtime";

export interface SeedExtension {
  /** Stable key. The implementation is looked up by this and must match exactly. */
  readonly key: string;
  readonly kind: SeedExtensionKind;
  readonly scope: SeedExtensionScope;
  /** What state must hold, in the plan's own words. */
  readonly state: string;
  /** Fixture references from rubric/fixtures.ts that this requirement materializes. */
  readonly provides: readonly string[];
  /** How it comes into existence. */
  readonly setup: string;
  /** Test IDs that cannot execute without it. */
  readonly requiredBy: readonly string[];
  readonly families: readonly string[];
  /** Other requirements this one is built on top of. Their `requiredBy` includes this one's. */
  readonly dependsOn: readonly string[];
}

/**
 * Which declared fixture each F4 falsifying row materializes.
 *
 * The planner derives the falsifying predicate from the policy, but the row it
 * inserts has to be a specific one, and that id is declared in
 * `rubric/fixtures.ts` so the executor and the seeder agree on it.
 */
const ANON_FALSIFYING_FIXTURE: Readonly<Record<string, readonly string[]>> = {
  "public.career_nodes": ["inactiveCareerNode"],
  "public.cosmetics": ["inactiveCosmetic"],
  "public.rulesets": ["inactiveRuleset"],
  "public.tournaments": ["cancelledTournament"],
};

interface SeedNeed {
  readonly key: string;
  readonly kind: SeedExtensionKind;
  readonly scope: SeedExtensionScope;
  readonly state: string;
  readonly provides: readonly string[];
  readonly setup: string;
  readonly dependsOn: readonly string[];
}

const SEED_NEEDS = new Map<string, SeedNeed>();
/** Declare a required state and return its description unchanged, so the
 *  planned row's `fixture` text is exactly what it was before. */
const needSeed = (
  key: string,
  what: string,
  provides: readonly string[] = [],
  kind: SeedExtensionKind = "rows",
  setup = "seed extension — attest seed-extensions, applied server-side after the standing seed",
  dependsOn: readonly string[] = [],
  scope: SeedExtensionScope = kind === "rows" ? "baseline" : "runtime",
): string => {
  if (!SEED_NEEDS.has(key)) SEED_NEEDS.set(key, { key, kind, scope, state: what, provides, setup, dependsOn });
  return what;
};

const BASELINE_SETUP = "seed extension — attest seed-extensions, applied server-side after every rebuild, before any probe";
const PROBE_SETUP =
  "probe-scoped setup — applied server-side to a verified baseline immediately before the one probe that needs it; the executor rebuilds the disposable database afterwards";

/**
 * Requirements added by the structural pass after D3.36 (D3.38).
 *
 * Each is a state some approved row's own operation or expectation needs and
 * the standing seed does not provide — so the row's `fixture` said "the
 * standing seed" while its probe acted on an empty set (R2), could not succeed
 * (R3), or rested on a premise the baseline contradicts (R5). The rows that
 * need one get the requirement's text as their `fixture`; that is a metadata
 * correction listed in the approved manifest, and no frozen field moves.
 */
const STRUCTURAL_NEEDS: Readonly<Record<string, Omit<SeedNeed, "key" | "kind" | "setup"> & { readonly kind?: SeedExtensionKind }>> = {
  "account:erin": {
    scope: "baseline", provides: ["erin"], dependsOn: [],
    state: "a fifth synthetic account, fixtures.erin.id (erin), created through Arc21's own signup bootstrap, with profile privacy 'private'",
  },
  "owned_pair:public.career_attempts": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "one public.career_attempts row owned by alice and one owned by bob, inserted server-side",
  },
  "owned_pair:public.daily_entries": {
    scope: "baseline", provides: [], dependsOn: ["f5_state:ensure_todays_daily_challenge", "account:erin"],
    state: "today's daily challenge, with one completed public.daily_entries row each for alice, bob and erin (a private-privacy account), inserted server-side",
  },
  "session_hand": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "one settled hand at session fixtures.session.id: a public.hand_records row, a public.hand_players row for alice and one for bob, and one graded public.player_actions row each, inserted server-side",
  },
  "owned_pair:public.player_daily_xp": {
    scope: "baseline", provides: [], dependsOn: ["account:erin"],
    state: "one public.player_daily_xp row this UTC week each for alice, bob and erin (a private-privacy account), inserted server-side",
  },
  "owned_pair:public.player_decision_periods": {
    scope: "baseline", provides: [], dependsOn: ["account:erin"],
    state: "one public.player_decision_periods row for the current UTC week each for alice, bob and erin (a private-privacy account), each at or above the strategy-accuracy minimum, inserted server-side",
  },
  "owned_pair:public.player_mode_stats": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "one public.player_mode_stats row owned by alice and one owned by bob, inserted server-side",
  },
  "owned_pair:public.user_cosmetics": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "alice owning one default cosmetic and bob owning a different one, equipped in his loadout, with default cosmetics alice does not own remaining, inserted server-side",
  },
  "queue_population": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "alice, bob and carol each holding a waiting casual public.matchmaking_queue entry, inserted server-side",
  },
  "alice_sent_request": {
    scope: "baseline", provides: [], dependsOn: ["account:erin"],
    state: "exactly one friend request sent by alice: a pending alice->erin public.friend_requests row, inserted server-side",
  },
  "blocks_by_bob": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "a block authored by bob (bob->dave) alongside the seeded alice->dave block, inserted server-side",
  },
  "game_commands_trail": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "two accepted private.game_commands rows at session fixtures.session.id, one by alice and one by bob, inserted server-side",
  },
  "rate_limit_trail": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "public.rate_limit_events rows for bob and for carol on 'player_search', one inside the rate-limit window and one older than it, inserted server-side",
  },
  "completed_tournaments": {
    scope: "baseline", provides: [], dependsOn: ["account:erin"],
    state: "two completed tournaments: one won by erin (a private-privacy account) with bob second, one won by bob with alice second, inserted server-side",
  },
  "expired_room": {
    scope: "baseline", provides: [], dependsOn: [],
    state: "a private lobby room hosted by bob whose expires_at has passed (an ineligible room for a code-based join), inserted server-side",
  },
  "caller_scoped_population": {
    scope: "baseline", provides: [],
    dependsOn: [
      "owned_pair:public.user_cosmetics", "queue_population", "rate_limit_trail", "alice_sent_request",
      "blocks_by_bob", "pair_row_bob_carol:public.friendships", "pair_row_bob_carol:public.friend_requests",
      "owned_pair:public.daily_entries", "owned_pair:public.player_decision_periods", "owned_pair:public.player_daily_xp",
      "completed_tournaments",
    ],
    state: "the canonical baseline, in which bob and carol each hold rows in every table the caller-scoped SECURITY DEFINER functions read (wallets, ledger, profiles, notifications, loadouts, career progress, matchmaking, rate-limit history, friendships and friend requests)",
  },
  // --- probe-scoped ----------------------------------------------------------
  "probe:alice_seat_left": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with alice's seat at session fixtures.session.id marked 'left' (she has stood up), so she holds no active seat at an active session",
  },
  "probe:carol_no_tie_to_bob": {
    scope: "probe", provides: [], dependsOn: ["pair_row_bob_carol:public.friendships", "pair_row_bob_carol:public.friend_requests"],
    state: "the canonical baseline with the bob<->carol friendship and friend request removed, so carol shares no friendship or request with bob while the alice<->bob friendship remains",
  },
  "probe:carol_not_bobs_friend": {
    scope: "probe", provides: [], dependsOn: ["pair_row_bob_carol:public.friendships"],
    state: "the canonical baseline with the bob<->carol friendship removed, so carol and bob are not friends while the alice<->bob friendship remains",
  },
  "probe:alice_sent_bob_request": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with the alice<->bob friendship replaced by a pending friend request alice sent to bob",
  },
  "probe:alice_bob_not_friends": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with the alice<->bob friendship removed, so bob is a non-friend of alice whose privacy is 'public'",
  },
  "probe:carol_sent_alice_request": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline plus one pending friend request from carol to alice, the only request alice has received",
  },
  "probe:alice_has_no_loadout": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with alice's loadout row removed, so a new loadout attributed to alice violates no unique key",
  },
  "probe:bob_has_no_loadout": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with bob's loadout row removed, so a loadout attributed to bob would violate no unique key if the policy admitted it",
  },
  "probe:no_bob_to_carol_request": {
    scope: "probe", provides: [], dependsOn: ["pair_row_bob_carol:public.friend_requests"],
    state: "the canonical baseline with the pending bob->carol friend request removed, so a new bob->carol request would violate no unique key if the policy admitted it",
  },
  "probe:alice_low_balance": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline with alice's balance brought below 2,000 chips through apply_wallet_delta (a correction the ledger records), and no recovery grant in the last 12 hours",
  },
  "probe:alice_friend_is_erin": {
    scope: "probe", provides: [], dependsOn: ["account:erin", "pair_row_bob_carol:public.friendships"],
    state: "the canonical baseline with alice's only friendship being alice<->erin (the alice<->bob friendship removed) while the bob<->carol friendship remains",
  },
  "fixture:expiredJwt": {
    scope: "runtime", kind: "credentials", provides: ["expiredJwt"], dependsOn: [],
    state: "a token for alice signed with the local stack's JWT secret whose exp is in the past (fixtures.expiredJwt), and the local PostgREST endpoint reachable",
  },
  "probe:dave_deleted": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline after dave deleted his own account through Arc21's delete_own_account(), with a token for dave signed before the deletion",
  },
  // Gate A, C5 (D3.54): the surviving state three deleted-user rows are retargeted at.
  "probe:dave_left_seat_then_deleted": {
    scope: "probe", provides: [], dependsOn: [],
    state: "the canonical baseline in which dave held a seat at session fixtures.session.id and stood up from it (status 'left'), was shown to read that session as a participant, and then deleted his own account through Arc21's delete_own_account(); his seat survives with user_id NULL (ON DELETE SET NULL) and the name 'Deleted player', and a token for dave signed before the deletion",
  },
};

/** Register a structural requirement and return its state text. */
const require_ = (key: string): string => {
  if (key.startsWith("f5_state:")) {
    const sig = Object.keys(NO_TARGET_STATE).find((s) => `f5_state:${s.split("(")[0]}` === key);
    if (!sig) throw new Error(`no no-target state for "${key}"`);
    return noTargetNeed(sig);
  }
  const d = STRUCTURAL_NEEDS[key];
  if (!d) throw new Error(`no structural requirement "${key}"`);
  // A requirement built on another registers that one too, so a dependency no
  // row names directly (account:erin) is still in the requirement set.
  for (const dep of d.dependsOn) if (STRUCTURAL_NEEDS[dep] || dep.startsWith("f5_state:")) require_(dep);
  const setup = d.scope === "probe" ? PROBE_SETUP : d.scope === "runtime" ? "signed in-run from the local stack's JWT secret; never persisted" : BASELINE_SETUP;
  return needSeed(key, d.state, d.provides, d.kind ?? "rows", setup, d.dependsOn, d.scope);
};

/** The concrete requirement for a no-target F5 function, keyed `f5_state:<fn>`. */
function noTargetNeed(sig: string): string {
  const d = NO_TARGET_STATE[sig];
  if (!d) throw new Error(`no concrete state declared for no-target function ${sig}`);
  for (const dep of d.dependsOn) if (STRUCTURAL_NEEDS[dep] || dep.startsWith("f5_state:")) require_(dep);
  return needSeed(`f5_state:${sig.split("(")[0]}`, d.state, [], "rows",
    d.scope === "probe" ? PROBE_SETUP : BASELINE_SETUP, d.dependsOn, d.scope);
}

/**
 * Concrete state for the five no-target F5 functions. The first version read
 * "state for <fn>: <attempt>", which restated the operation rather than naming
 * the state (D3.38).
 */
const NO_TARGET_STATE: Readonly<Record<string, { state: string; scope: SeedExtensionScope; dependsOn: readonly string[] }>> = {
  "ensure_todays_daily_challenge()": {
    scope: "baseline", dependsOn: [],
    state: "today's daily challenge present, open (opens_at <= now < closes_at) and unrevealed, inserted server-side with a seed commitment computed from its secret",
  },
  "latest_verifiable_daily_challenge()": {
    scope: "baseline", dependsOn: ["f5_state:ensure_todays_daily_challenge"],
    state: "yesterday's daily challenge closed and revealed, and today's later challenge still unrevealed, inserted server-side",
  },
  "join_matchmaking(p_tier table_tier)": {
    scope: "probe", dependsOn: ["queue_population"],
    state: "the canonical baseline with alice's seat marked 'left' and alice holding no queue entry, while bob and carol hold fresh waiting casual entries",
  },
  "poll_matchmaking()": {
    scope: "probe", dependsOn: ["queue_population"],
    state: "the canonical baseline with alice, bob and carol each holding a fresh waiting casual queue entry",
  },
  "create_private_room(p_max_seats integer)": {
    scope: "baseline", dependsOn: [],
    state: "the canonical baseline; the out-of-range seat count needs no row, only create_private_room(integer) present as a SECURITY DEFINER function",
  },
};

/**
 * Which approved rows need which structural requirement (D3.38).
 *
 * Matched on what the row IS — family, resource, control, polarity, function —
 * never on a Test ID number, so a row can only receive a requirement its own
 * operation or expectation calls for.
 */
function structuralFixtureFor(t: PlannedTest): string | null {
  const fam = t.family.split(" ")[0];
  const res = t.resource;
  const pos = t.polarity === "positive";
  const neg = t.polarity === "negative";
  const ctl = t.control;

  if (fam === "F1") {
    const pairs: Record<string, string> = {
      "public.career_attempts": "owned_pair:public.career_attempts",
      "public.daily_entries": "owned_pair:public.daily_entries",
      "public.player_daily_xp": "owned_pair:public.player_daily_xp",
      "public.player_decision_periods": "owned_pair:public.player_decision_periods",
      "public.player_mode_stats": "owned_pair:public.player_mode_stats",
      "public.user_cosmetics": "owned_pair:public.user_cosmetics",
      "public.matchmaking_queue": "queue_population",
      "public.hand_players": "session_hand",
      "public.hand_records": "session_hand",
      "public.player_actions": "session_hand",
    };
    if (pairs[res]) return require_(pairs[res]!);
    if (res === "public.friend_requests" && pos) return require_("alice_sent_request");
    if (res === "public.blocks" && neg) return require_("blocks_by_bob");
  }
  if (fam === "F2" && ctl.includes("#policy:")) {
    if (res === "public.blocks" && neg) return require_("blocks_by_bob");
    if (res === "public.friend_requests" && pos) return require_("alice_sent_request");
    if (res === "public.friend_requests" && neg) {
      return needSeed(`pair_row_bob_carol:${res}`, `one ${res} row linking bob and carol, with alice named in neither sender_id nor receiver_id`, ["bobNotSentRequest"]);
    }
    if (res === "public.friendships" && neg) {
      return needSeed(`pair_row_bob_carol:${res}`, `one ${res} row linking bob and carol, with alice named in neither user_id_a nor user_id_b`, ["bobCarolFriendship"]);
    }
  }
  if (fam === "F3") {
    if (res === "public.friend_requests" && neg) return require_("probe:no_bob_to_carol_request");
    // The approved UPDATE positive targets alice's sent request; without one its
    // WHERE names no row. (The row is blocked by C3 regardless — D3.39.)
    if (res === "public.friend_requests" && pos && ctl.endsWith("friend_requests_update_participants")) return require_("alice_sent_request");
    if (res === "public.loadouts" && pos) return require_("probe:alice_has_no_loadout");
    if (res === "public.loadouts" && neg) return require_("probe:bob_has_no_loadout");
  }
  if (fam === "F6") {
    if (res === "public.daily_challenges" && pos) return require_("f5_state:ensure_todays_daily_challenge");
    if (res === "public.friend_requests" && pos) return require_("probe:carol_sent_alice_request");
  }
  if (fam === "F10") {
    if (res === "private.game_commands" && (ctl.endsWith("#audit:exists") || /immutable:(UPDATE|DELETE)$/.test(ctl))) return require_("game_commands_trail");
    if (res === "public.rate_limit_events" && (ctl.endsWith("#audit:exists") || /immutable:(UPDATE|DELETE)$/.test(ctl))) return require_("rate_limit_trail");
    if (res === "public.game_events" && (ctl.endsWith("#audit:exists") || /immutable:(UPDATE|DELETE)$/.test(ctl))) {
      return needSeed("game_events_visibility_pair",
        `one public-visibility game_events row and one seat-scoped row whose recipient_user_id is bob, both for session fixtures.session.id`,
        ["publicGameEvent", "bobScopedGameEvent"]);
    }
  }
  if (fam === "B") {
    if (ctl.endsWith("#boundary:deleted-user")) {
      return require_(DELETED_USER_SURVIVING_SESSION.has(res) ? "probe:dave_left_seat_then_deleted" : "probe:dave_deleted");
    }
    if (t.testId === "B.suite.expired-session") return require_("fixture:expiredJwt");
    if (ctl.endsWith("#boundary:null-identity")) {
      if (res === "public.friend_requests") {
        return needSeed(`pair_row_bob_carol:${res}`, `one ${res} row linking bob and carol, with alice named in neither sender_id nor receiver_id`, ["bobNotSentRequest"]);
      }
      if (res === "public.game_events") {
        return needSeed("game_events_visibility_pair",
          `one public-visibility game_events row and one seat-scoped row whose recipient_user_id is bob, both for session fixtures.session.id`,
          ["publicGameEvent", "bobScopedGameEvent"]);
      }
      if (res === "public.tournament_entries") {
        return needSeed("tournament_alice_bob", "one tournament with alice and bob holding tournament_entries rows, and carol holding none", ["tournamentAliceBob"]);
      }
    }
  }
  if (fam === "F5") {
    const fn = res.replace(/^public\./, "").split("(")[0]!.trim();
    // Its own invariant since Gate A (D3.54); the fixture is unchanged.
    if (fn === "delete_own_account") return require_("probe:alice_seat_left");
    if (/\[no_target, caller-scoped\]/.test(t.covers)) {
      if (fn === "list_friends") return require_("probe:alice_friend_is_erin");
      if (fn === "claim_recovery_grant") return require_("probe:alice_low_balance");
      if (fn === "delete_own_account") return require_("probe:alice_seat_left");
      return require_("caller_scoped_population");
    }
    const byFn: Record<string, string> = {
      invite_friend_to_room: "pair_row_bob_carol:public.friendships",
      decline_friend_request: "probe:alice_sent_bob_request",
      remove_friend: "probe:carol_no_tie_to_bob",
      viewer_is_friend_of: "probe:carol_not_bobs_friend",
      join_private_room: "expired_room",
      leaderboard_daily_challenge: "owned_pair:public.daily_entries",
      leaderboard_strategy_accuracy: "owned_pair:public.player_decision_periods",
      leaderboard_tournament_wins: "completed_tournaments",
    };
    if (fn === "leaderboard_weekly_xp" && t.identity !== ANON) return require_("owned_pair:public.player_daily_xp");
    if (fn === "player_public_profile" && /non-friend projection/.test(res)) return require_("probe:alice_bob_not_friends");
    const key = byFn[fn];
    if (key === "pair_row_bob_carol:public.friendships") {
      return needSeed(key, `one public.friendships row linking bob and carol, with alice named in neither user_id_a nor user_id_b`, ["bobCarolFriendship"]);
    }
    if (key) return require_(key);
  }
  return null;
}

export function planWp3(
  resources: readonly RiskInput[],
  tiers: ReadonlyMap<string, Level>,
  definerFunctions: readonly { resource: string; executableBy: readonly string[]; touches: readonly string[] }[],
): Wp3Plan {
  const tests: PlannedTest[] = [];
  const na: NotApplicable[] = [];
  const f3rows: F3Applicability[] = [];
  let seq = 0;
  const id = (fam: string, res: string) => `${fam}.${slug(res)}.${String(++seq).padStart(3, "0")}`;

  for (const f of resources) {
    const tier = tiers.get(f.resource) ?? "Medium";
    const isHigh = tier === "High";
    const oc = ownerCol(f);
    const selectPolicies = f.policies.filter((p) => p.command === "SELECT" || p.command === "ALL");
    const writePolicies = f.policies.filter(
      (p) => (p.command === "UPDATE" || p.command === "DELETE" || p.command === "ALL") && p.hasUsing,
    );
    const checkPolicies = f.policies.filter((p) => p.hasWithCheck);

    // ---------------------------------------------------------------- F1
    // The fixture comes from the policy's AUTHORIZATION DRIVERS, read from the
    // complete USING expression — not from whether the table happens to have
    // an owner column.
    //
    // That distinction was getting several cases wrong.
    // `game_sessions_select_participant` is `is_session_participant(id)`: it
    // never reads host_user_id, yet host_user_id was the fixture.
    // `hand_players_select_participant` is
    // `user_id = uid OR is_session_participant(...)`, so a negative that only
    // changes the owner is still admitted through the second disjunct.
    const clientReadable = f.effectiveReadExposure !== "server_only";
    if (clientReadable && selectPolicies.length) {
      const branches = isHigh ? selectPolicies : selectPolicies.slice(0, 1);
      for (const p of branches) {
        const drivers = p.authDrivers;
        // Membership-style drivers decide access wherever they appear, so they
        // take precedence over an ownership term in the same expression.
        const membership = drivers.find((d) =>
          d.kind === "session_participation" || d.kind === "room_membership" || d.kind === "tournament_membership");
        const ownerDrivers = drivers.filter((d) => d.kind === "ownership");
        const isProfilesVisible = p.name === "profiles_select_visible";
        const isProfilesSelf = p.name === "profiles_select_self";

        let posIdentity = ALICE, negIdentity = ALICE;
        let posOp = "", negOp = "", posFix = FIXTURE_DEFAULT, negFix = FIXTURE_DEFAULT, why = "";

        if (membership?.kind === "session_participation") {
          negIdentity = CAROL;
          posOp = `select from ${f.resource} for game session fixtures.session.id`;
          negOp = `select from ${f.resource} for that same game session fixtures.session.id`;
          why = `access is decided by ${membership.detail}, not by any column on this table. Alice holds a live seat at that session; carol holds none`;
          if (ownerDrivers.length && p.combinator === "or") {
            negOp += ` — and the row selected belongs to alice, so carol falsifies BOTH disjuncts (${ownerDrivers.map((d) => d.detail).join(", ")} is not carol, and carol is not a participant)`;
            why += `. The predicate is a disjunction, so the negative must falsify every branch`;
          }
          if (p.combinator === "mixed" && ownerDrivers.length) {
            posOp += ` restricted to a row whose visibility = 'public'`;
            posFix = needSeed("game_events_visibility_pair",
              `one public-visibility game_events row and one seat-scoped row whose recipient_user_id is bob, both for session fixtures.session.id`,
              ["publicGameEvent", "bobScopedGameEvent"]);
            negFix = posFix;
            why += `. The predicate is a conjunction of participation AND (public OR recipient), so the positive uses a public row and the negative falsifies the participation conjunct`;
          }
        } else if (membership?.kind === "room_membership") {
          negIdentity = CAROL;
          posOp = `select from ${f.resource} for fixtures.roomAliceBob.id`;
          negOp = `select from ${f.resource} for that same room fixtures.roomAliceBob.id`;
          posFix = negFix = needSeed("room_alice_bob",
            "one private room hosted by alice with alice and bob as joined room_members, and carol NOT a member",
            ["roomAliceBob"]);
          why = `access is decided by ${membership.detail} — shared room membership, not ownership. host_user_id does not appear in this predicate`;
        } else if (membership?.kind === "tournament_membership") {
          negIdentity = CAROL;
          posOp = `select from ${f.resource} for fixtures.tournamentAliceBob.id`;
          negOp = `select from ${f.resource} for that same tournament fixtures.tournamentAliceBob.id`;
          posFix = negFix = needSeed("tournament_alice_bob",
            "one tournament with alice and bob holding tournament_entries rows, and carol holding none",
            ["tournamentAliceBob"]);
          // A read of tournament_matches returns MATCH rows. The tournament and
          // its entries alone leave that table empty for this tournament, so
          // the positive could not return its "at least 1 row" and the
          // negative's "no data" would be true for the wrong reason. The stated
          // fixture was thinner than its own test (D3.23); D3.34 names the
          // match as a requirement of its own, on top of the tournament.
          if (f.resource === "public.tournament_matches") {
            posFix = negFix = needSeed("tournament_alice_bob_match",
              "one tournament with alice and bob holding tournament_entries rows, and carol holding none, " +
                "plus one pending round-1 tournament_matches row in that tournament (fixtures.tournamentAliceBobMatch.id) " +
                "pairing alice's entry against bob's, with carol in neither slot",
              ["tournamentAliceBobMatch"], "rows",
              "seed extension — attest seed-extensions, applied server-side after tournament_alice_bob",
              ["tournament_alice_bob"]);
          }
          why = `access is decided by ${membership.detail} — shared tournament membership`;
          if (ownerDrivers.length && p.combinator === "or") {
            negOp += ` — reading alice's entry, so carol falsifies both disjuncts (${ownerDrivers.map((d) => d.detail).join(", ")} is not carol, and carol is not in that tournament)`;
            why += `. Disjunction, so both branches must be falsified`;
          }
        } else if (isProfilesVisible) {
          posOp = `select from public.profiles where id = ${FIXTURES.bob.ref}`;
          negOp = `select from public.profiles where id = ${FIXTURES.dave.ref}`;
          why = `this policy is a conjunction of privacy, block and friendship terms. Bob satisfies it (privacy = 'public', no block either way); dave falsifies it because alice has blocked him and the policy requires NOT viewer_has_blocked(id). Bob would NOT work as the negative — his public profile is legitimately visible. The OTHER permissive SELECT policy on profiles, profiles_select_self, is also falsified because dave's id is not alice's, so the refusal reflects effective authorization across both`;
        } else if (isProfilesSelf) {
          posOp = `select from public.profiles where id = ${FIXTURES.alice.ref}`;
          negOp = `select from public.profiles where id = ${FIXTURES.dave.ref}`;
          why = `ownership on id. Dave is the negative rather than bob because the OTHER permissive SELECT policy (profiles_select_visible) admits bob's public profile, so a bob fixture would not isolate a refusal`;
        } else if (ownerDrivers.length) {
          const cols = ownerDrivers.map((d) => d.detail);
          posOp = `select from ${f.resource} where ${cols[0]} = ${FIXTURES.alice.ref}`;
          negOp = cols.length > 1
            ? `select from ${f.resource} for a row where NONE of ${cols.join(", ")} is ${FIXTURES.alice.ref} — the bob↔carol row`
            : `select from ${f.resource} where ${cols[0]} = ${FIXTURES.bob.ref}`;
          if (cols.length > 1) negFix = needSeed(`pair_row_bob_carol:${f.resource}`,
            `one ${f.resource} row linking bob and carol, with alice named in neither ${cols.join(" nor ")}`,
            f.resource === "public.friend_requests" ? ["bobNotSentRequest"] : f.resource === "public.friendships" ? ["bobCarolFriendship"] : []);
          why = cols.length > 1
            ? `ownership on ${cols.join(" OR ")}; a row naming alice in either column is legitimately visible to her, so the negative must name neither`
            : `ownership on ${cols[0]}`;
        } else {
          na.push({
            family: "F1 read isolation", resource: f.resource,
            reason: `${p.name} USING has no per-caller authorization driver (${p.authDrivers.map((d) => d.detail).join(", ") || "no recognised driver"}); it is an unconditional or row-flag predicate, so there is no per-caller subset to isolate. Covered under F4`,
          });
          continue;
        }

        tests.push({
          testId: id("F1", f.resource), family: "F1 read isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: posIdentity,
          operation: posOp, expected: "at least 1 row", fixture: posFix,
          covers: `USING of ${p.name} satisfied. ${why}`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F1", f.resource), family: "F1 read isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: negIdentity,
          operation: negOp, expected: "no data (0 rows — RLS filters rather than raising)", fixture: negFix,
          covers: `USING of ${p.name} falsified. ${why}` +
            (selectPolicies.length > 1 && !isProfilesVisible && !isProfilesSelf
              ? `. This resource carries ${selectPolicies.length} permissive SELECT policies, so the claim is about effective authorization`
              : ""),
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
        });
      }
    } else {
      na.push({
        family: "F1 read isolation", resource: f.resource,
        reason: !selectPolicies.length
          ? "no SELECT policy exists; reads are refused by the grant surface or by deny-by-default, covered under F4"
          : "effective read exposure is server-only: no client read path exists to isolate",
      });
    }

    // ---------------------------------------------------------------- F2
    if (f.effectiveWriteExposure === "authenticated" && writePolicies.length && oc) {
      const branches = isHigh ? writePolicies : writePolicies.slice(0, 1);
      for (const p of branches) {
        const verb = p.command === "DELETE" ? "delete from" : "update";
        const pcol = p.predicateColumns[0] ?? oc;
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
          operation: `${verb} ${f.resource} where ${pcol} = ${FIXTURES.alice.ref}`,
          expected: "1 row affected",
          fixture: FIXTURE_DEFAULT,
          covers: `USING branch of ${p.name} (${p.command}) satisfied for the owner`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
        });
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
          operation: `${verb} ${f.resource} where ${pcol} = ${FIXTURES.bob.ref}`,
          expected: "0 rows affected — the policy filters the row out of the write",
          fixture: FIXTURE_DEFAULT,
          covers: `USING of ${p.name} (${p.command}) falsified. The predicate keys on ${p.authDrivers.map((d) => d.detail).join(" OR ") || pcol}, and the fixture names bob there instead of alice${p.authDrivers.filter((d) => d.kind === "ownership").length > 1 ? " in every clause, since a row naming alice in either column is legitimately writable by her" : ""}`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
        });
      }
    } else if (isHigh) {
      // One Test ID per statement. INSERT, UPDATE and DELETE are three
      // distinct privilege bits on the grant surface, and the control claim
      // here is that `authenticated` holds none of them — so each is its own
      // probe with its own evidence record rather than a slash-alternative.
      for (const stmt of ["INSERT", "UPDATE", "DELETE"] as const) {
        const op =
          stmt === "INSERT"
            ? `insert into ${f.resource} (default values, or the minimum NOT NULL set)`
            : stmt === "UPDATE"
              ? `update ${f.resource} set ${f.columns.find((c) => !c.notNull && !c.serverGenerated)?.name ?? f.columns[f.columns.length - 1]!.name} = ${probeLiteral(f.resource, f.columns.find((c) => !c.notNull && !c.serverGenerated)?.name ?? f.columns[f.columns.length - 1]!.name, f.columns.find((c) => !c.notNull && !c.serverGenerated)?.type ?? f.columns[f.columns.length - 1]!.type)}${WHERE_PAST_CLIENT_GUARD}`
              : `delete from ${f.resource}${WHERE_PAST_CLIENT_GUARD}`;
        tests.push({
          testId: id("F2", f.resource), family: "F2 write isolation", resource: f.resource,
          control: `${f.resource}#grant:authenticated:${stmt}`, tier, polarity: "negative",
          identity: ALICE,
          operation: op,
          expected: "error 42501 — refused before any policy is consulted",
          fixture: FIXTURE_DEFAULT,
          covers: `the grant surface for ${stmt} specifically: \`authenticated\` holds no ${stmt} privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). ${stmt} is a separate privilege bit from the other two and is therefore a separate probe`,
          plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
        });
      }
    } else {
      na.push({
        family: "F2 write isolation", resource: f.resource,
        reason: `effective write exposure is ${f.effectiveWriteExposure} and the tier is ${tier}: the client-reachable critical path here is the read, covered under F1`,
      });
    }

    // ---------------------------------------------------------------- F3
    // The command comes from the POLICY, not from a template. An INSERT policy
    // is tested with INSERT; an UPDATE policy with UPDATE. They are different
    // controls: an INSERT WITH CHECK governs the row being created, an UPDATE
    // WITH CHECK governs the row as it will be AFTER the update.
    //
    // And an UPDATE WITH CHECK is only independently exercisable if the caller
    // can change a column the expression reads. In Arc21 it never can: every
    // UPDATE WITH CHECK compares the owner column, and no owner column appears
    // in any client column-level UPDATE grant. That is recorded rather than
    // faked, because a negative test that cannot be constructed must not be
    // planned as though it could.
    if (f.effectiveWriteExposure === "authenticated" && checkPolicies.length && oc) {
      const branches = isHigh ? checkPolicies : checkPolicies.slice(0, 1);
      for (const p of branches) {
        // The column the WITH CHECK actually compares to auth.uid().
        const pcol = p.predicateColumns[0] ?? oc;
        const ownerColGranted = f.columns.some(
          (c) => c.name === pcol && c.clientUpdate.length > 0,
        );
        const tableUpdateGrant = (f.reachableBy["authenticated"] ?? []).includes("UPDATE");

        if (p.command === "INSERT") {
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
            operation: `INSERT into ${f.resource} with ${pcol} = ${FIXTURES.alice.ref}`,
            expected: "1 row affected",
            fixture: FIXTURE_DEFAULT,
            covers: `WITH CHECK of ${p.name} (INSERT) satisfied: a row attributed to the caller`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
          });
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
            operation: `INSERT into ${f.resource} with ${pcol} = ${FIXTURES.bob.ref} (no RETURNING clause)`,
            expected: "error 42501 — new row violates row-level security policy",
            fixture: FIXTURE_DEFAULT,
            covers: `WITH CHECK of ${p.name} (INSERT) unsatisfied: the policy compares \`${pcol}\`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5)`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
          });
        } else if (p.command === "UPDATE") {
          tests.push({
            testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
            control: `${f.resource}#policy:${p.name}`, tier, polarity: "positive", identity: ALICE,
            operation: (() => {
              const g = f.columns.find((c) => c.clientUpdate.length > 0);
              // Gate A, C3-sender-cannot-accept (D3.54): the caller is the request's
              // SENDER here, and the one transition a sender may make is
              // 'cancelled' — 'accepted' is the receiver's, and the transition
              // trigger refuses it before WITH CHECK is evaluated.
              const lit = f.resource === "public.friend_requests" && g!.name === "status" && pcol === "sender_id"
                ? "'cancelled'"
                : probeLiteral(f.resource, g!.name, g!.type);
              return `UPDATE ${f.resource} set ${g!.name} = ${lit} where ${pcol} = ${FIXTURES.alice.ref}`;
            })(),
            expected: "1 row affected, and the row is still attributed to alice afterwards",
            fixture: FIXTURE_DEFAULT,
            covers: `WITH CHECK of ${p.name} (UPDATE) satisfied: the post-update row still belongs to the caller`,
            plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
          });
          if (ownerColGranted || tableUpdateGrant) {
            tests.push({
              testId: id("F3", f.resource), family: "F3 WITH CHECK enforcement", resource: f.resource,
              control: `${f.resource}#policy:${p.name}`, tier, polarity: "negative", identity: ALICE,
              operation: `UPDATE ${f.resource} set ${pcol} = ${FIXTURES.bob.ref} where ${pcol} = ${FIXTURES.alice.ref} — satisfying USING, violating WITH CHECK`,
              expected: "error 42501 — the post-update row would violate the policy's WITH CHECK",
              fixture: FIXTURE_DEFAULT,
              covers: `WITH CHECK of ${p.name} (UPDATE) unsatisfied while USING is satisfied. This is the only shape that isolates the WITH CHECK half from the USING half on an UPDATE`,
              plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
            });
          } else {
            na.push({
              family: "F3 WITH CHECK enforcement", resource: f.resource,
              reason: `${p.name} is an UPDATE policy whose WITH CHECK compares \`${oc}\`, and \`${oc}\` appears in no client column-level UPDATE grant (granted: ${f.columns.filter((c) => c.clientUpdate.length).map((c) => c.name).join(", ") || "none"}). A client cannot construct a row that satisfies USING and violates WITH CHECK, so that branch is not independently exercisable from a client session. It is defence in depth behind the column grant, and becomes reachable only if the grant is ever widened`,
            });
          }
        }
      }
    } else {
      na.push({
        family: "F3 WITH CHECK enforcement", resource: f.resource,
        reason: !checkPolicies.length
          ? "no policy on this resource carries a WITH CHECK expression, so there is no write branch to enforce"
          : `effective write exposure is ${f.effectiveWriteExposure}: no client can reach a write, so no WITH CHECK branch is exercisable`,
      });
    }

    // ---------------------------------------------------------------- F4
    // The anon-admitting predicate is read from the policy and stated exactly.
    // No "e.g." and no hypothetical row: either a concrete falsifying row can
    // exist and is named, or the policy is unconditional and the negative
    // branch does not exist and is not invented.
    const anonPolicy = f.policies.find(
      (p) => (p.command === "SELECT" || p.command === "ALL") && (p.roles.includes("anon") || p.roles.includes("PUBLIC")),
    );
    if (f.anonymousPolicyPermits && anonPolicy) {
      const flag = anonPolicy.authDrivers.find((d) => d.kind === "row_flag");
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#policy:${anonPolicy.name}`, tier, polarity: "positive", identity: ANON,
        operation: `select from ${f.resource} for a row satisfying ${flag ? flag.detail : "the policy"}`,
        expected: "at least 1 row — this resource is deliberately readable without an account",
        fixture: FIXTURE_DEFAULT + `, whose catalogue rows ship from Arc21's migrations and satisfy ${flag ? flag.detail : "the policy"}`,
        covers: `the intended anonymous read path. ${anonPolicy.name} USING is exactly \`${flag ? flag.detail : "(unconditional)"}\``,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      if (flag) {
        // Derive the exact falsifying value from the predicate itself.
        const m = /^(\w+) is true$/.exec(flag.detail);
        const cmp = /^(\w+) (<>|=) '([^']+)'$/.exec(flag.detail);
        const falsify = m
          ? `${m[1]} = false`
          : cmp
            ? cmp[2] === "<>" ? `${cmp[1]} = '${cmp[3]}'` : `${cmp[1]} <> '${cmp[3]}'`
            : null;
        if (falsify) {
          tests.push({
            testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
            control: `${f.resource}#policy:${anonPolicy.name}`, tier, polarity: "negative", identity: ANON,
            operation: `select from ${f.resource} for the seeded row where ${falsify}`,
            expected: `no data — ${anonPolicy.name} USING is \`${flag.detail}\`, which that row does not satisfy`,
            fixture: needSeed(`anon_falsifying_row:${f.resource}`,
              `one ${f.resource} row with ${falsify}, inserted server-side, so the anon-admitting predicate has a concrete falsifying subject`,
              ANON_FALSIFYING_FIXTURE[f.resource] ?? []),
            covers: `the unsatisfied branch of ${anonPolicy.name}. The predicate is exactly \`${flag.detail}\` and the fixture sets ${falsify}`,
            plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
          });
        } else {
          na.push({
            family: "F4 anonymous exposure", resource: f.resource,
            reason: `${anonPolicy.name} USING is \`${flag.detail}\`, from which no concrete falsifying value could be derived mechanically. No negative is invented for it`,
          });
        }
      } else {
        na.push({
          family: "F4 anonymous exposure", resource: f.resource,
          reason: `${anonPolicy.name} admits anon unconditionally — its USING carries no row predicate to falsify — so there is no negative branch to test and none is invented. The anonymous read here is intentionally unconditional`,
        });
      }
    } else {
      tests.push({
        testId: id("F4", f.resource), family: "F4 anonymous exposure", resource: f.resource,
        control: `${f.resource}#anon-reach`, tier, polarity: "negative", identity: ANON,
        operation: `select from ${f.resource}`,
        expected: f.anonymousGrantExists
          ? "no data — a grant exists but no policy names anon, so row security refuses every row"
          : "no data, or error 42501 where no anon grant exists at all",
        fixture: FIXTURE_DEFAULT,
        covers: f.anonymousGrantExists
          ? "the latent anonymous grant recorded in WP2: this probe is what shows the policy set is the only thing denying it"
          : "the anonymous reach surface: a signed-out caller obtains nothing here",
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    // ---------------------------------------------------------------- F6
    // The privilege TYPE decides the statement. A column-level SELECT grant is
    // a confidentiality boundary and is tested by reading; a column-level
    // UPDATE grant is an integrity boundary and is tested by writing.
    //
    // Collapsing the two is what produced the previous plan's invalid case:
    // public.daily_challenges grants column-level SELECT on 14 columns and
    // excludes seed_secret, and the collapsed facts made that look like 14
    // writable columns, so the planner proposed UPDATEs against a read boundary.
    const selGranted = f.columns.filter((c) => c.clientSelect.length > 0);
    const updGranted = f.columns.filter((c) => c.clientUpdate.length > 0);
    const selExcluded = f.columns.filter((c) => c.clientSelect.length === 0);
    const updExcluded = f.columns.filter((c) => c.clientUpdate.length === 0);

    if (selGranted.length > 0 && selExcluded.length > 0) {
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:SELECT`, tier, polarity: "positive", identity: ALICE,
        operation: `SELECT ${selGranted.slice(0, 3).map((c) => c.name).join(", ")} from ${f.resource}`,
        expected: `rows returned — ${selGranted.length} of ${f.columnCount} columns carry a client SELECT grant`,
        fixture: FIXTURE_DEFAULT,
        covers: `the granted half of the READ column surface: the caller may see the intended exposed columns`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:SELECT`, tier, polarity: "negative", identity: ALICE,
        operation: `SELECT ${selExcluded[0]!.name} from ${f.resource}`,
        expected: "error 42501 — no column-level SELECT privilege on that column",
        fixture: FIXTURE_DEFAULT,
        covers: `the confidentiality boundary INSIDE a readable row: ${selExcluded.map((c) => c.name).join(", ")} ${selExcluded.length === 1 ? "is" : "are"} excluded from every client SELECT grant. A row-level check cannot see this, and a table-level one cannot either`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    if (updGranted.length > 0 && updExcluded.length > 0) {
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:UPDATE`, tier, polarity: "positive", identity: ALICE,
        operation: `UPDATE ${f.resource} set ${updGranted[0]!.name} = ${probeLiteral(f.resource, updGranted[0]!.name, updGranted[0]!.type)} where ${oc ?? "id"} = ${FIXTURES.alice.ref}`,
        expected: "1 row affected — a granted column on the caller's own row",
        fixture: FIXTURE_DEFAULT,
        covers: `the granted half of the WRITE column surface (${updGranted.map((c) => c.name).join(", ")})`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: "n/a (positive)",
      });
      tests.push({
        testId: id("F6", f.resource), family: "F6 column-level leakage", resource: f.resource,
        control: `${f.resource}#colgrant:UPDATE`, tier, polarity: "negative", identity: ALICE,
        operation: `UPDATE ${f.resource} set ${updExcluded[0]!.name} = ${literalFor(updExcluded[0]!.name, updExcluded[0]!.type)} where ${oc ?? "id"} = ${FIXTURES.alice.ref}`,
        expected: "error 42501 — no column-level UPDATE privilege on that column",
        fixture: FIXTURE_DEFAULT,
        covers: `a column deliberately excluded from the client UPDATE grant (${updExcluded.map((c) => c.name).slice(0, 4).join(", ")}${updExcluded.length > 4 ? ", …" : ""})`,
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }

    if (selGranted.length === 0 && updGranted.length === 0) {
      na.push({
        family: "F6 column-level leakage", resource: f.resource,
        reason: "no client role holds a column-level privilege of any type here, so there is no column surface to leak through — access is decided at the table level",
      });
    }

    // ---------------------------------------------------------------- F7
    // TWO LAYERS, kept apart because conflating them was a logical error.
    //
    // The previous plan ran these probes as owner(postgres) and claimed they
    // demonstrated the owner exemption. They cannot. WP1 established that
    // `postgres` holds BYPASSRLS, so it would see every row even with FORCE
    // enabled — the probe cannot distinguish "not forced" from "bypasses
    // anyway". The observation is real; the attribution was wrong.
    //
    // Layer 1, here: per-resource CHARACTERIZATION of the catalog state. It
    // records relrowsecurity, relforcerowsecurity and the owner. It asserts no
    // control, simulates no attack, and therefore needs no AUTHOR INTENT.
    //
    // Layer 2, below: the mechanism demonstration, on a scratch table owned by
    // a role holding no BYPASSRLS, where the variable CAN be isolated. Arc21's
    // ownership model is not mutated to manufacture a per-resource test.
    if (isHigh) {
      tests.push({
        testId: id("F7", f.resource), family: "F7 forced RLS / owner bypass", resource: f.resource,
        control: `${f.resource}#rls_forced`, tier, polarity: "characterization",
        identity: "server-side catalog read (no control is exercised)",
        operation: `read relrowsecurity, relforcerowsecurity and the owner for ${f.resource} from pg_class`,
        expected: `rls_enabled = true, rls_forced = FALSE, owner = ${f.owner}`,
        fixture: FIXTURE_DEFAULT,
        covers:
          "records the enabled-versus-forced state for a High-tier resource. A characterization fact: no statement is issued against the table and no control is asserted, so this row carries no AUTHOR INTENT. What the absence of FORCE would MEAN is demonstrated separately on a scratch owner that does not hold BYPASSRLS",
        plumbing: "reuse WP1", verdictWhenPredicted: "characterized", authorIntent: "n/a (characterization)",
      });
    } else {
      na.push({
        family: "F7 forced RLS / owner bypass", resource: f.resource,
        reason: `tier is ${tier}; per-resource characterization is scoped to High-tier resources, and the catalog fact is inventoried for all 39 tables in WP0`,
      });
    }

    // ---------------------------------------------------------------- F10
    // Two corrections over the first draft.
    //
    // IDENTITY. The existence check must run as a role that can legitimately
    // read the trail. The first draft used alice for all four, including
    // private.game_commands and public.rate_limit_events — which F1 had
    // correctly marked as having no client read path at all. Those existence
    // checks run server-side; only the tamper attempt runs as a client.
    //
    // SEMANTICS. "Who did what when" needs an ACTOR, an ACTION and a TIME. A
    // recipient or affected-user column is not an actor. Where a table is
    // missing one of the three it is recorded as a PARTIAL trail and kept as a
    // finding candidate, not relabelled as a complete one.
    interface TrailSpec {
      readonly inspectAs: string;
      readonly actor: string | null;
      readonly action: string | null;
      readonly time: string | null;
      readonly completeness: "complete" | "partial";
      readonly note: string;
    }
    const TRAILS: Record<string, TrailSpec> = {
      "public.wallet_ledger": {
        inspectAs: ALICE,
        actor: "user_id (the account whose balance moved)",
        action: "reason (a ledger_reason enum) plus delta and reference_type/reference_id",
        time: "created_at, plus seq for a total order",
        completeness: "complete",
        note: "the only structure in Arc21 carrying all three of actor, action and time, guarded append-only with a truncate guard. Readable by its owner, so alice can inspect her own",
      },
      "public.game_events": {
        inspectAs: ALICE,
        actor: null,
        action: "type plus a sanitised payload",
        time: "created_at, plus seq for a total order",
        completeness: "partial",
        note: "PARTIAL. recipient_user_id names who a seat-scoped event is FOR, not who caused it. There is no actor column, so this answers what-happened-when for a session but not who-did-it. Finding candidate",
      },
      "private.game_commands": {
        inspectAs: "server-side (admin) — no client role holds USAGE on the private schema",
        actor: "user_id, derived from the verified JWT rather than from a payload",
        action: "command_type plus applied_version and the committed response",
        time: "created_at",
        completeness: "complete",
        note: "carries all three, and its comment records that user_id comes from the verified JWT so a replay under another account is rejected. Not client-readable at all, so the existence check is server-side",
      },
      "public.rate_limit_events": {
        inspectAs: "server-side (admin) — RLS is enabled with no policy and no client grant exists",
        actor: "user_id",
        action: "action (the rate-limited operation)",
        time: "occurred_at",
        completeness: "partial",
        note: "PARTIAL for security purposes. It records ALLOWED attempts only — refusals are deliberately not recorded — and it is pruned on every consume, so it holds at most one window. It cannot answer 'who was refused, when'. Finding candidate",
      },
    };

    /**
     * What change on THIS resource would lack attribution or history.
     *
     * One sentence each, supported by the repository. The first version copied
     * the "removing a block" example onto all seventeen resources, which was
     * true of one of them.
     */
    const GAP_RATIONALE: Record<string, string> = {
      "private.career_drill_seeds":
        "the per-attempt drill seed determines which scenarios an attempt is graded against, and its regeneration or alteration leaves no record of when it changed or what it was before",
      "private.game_state_private":
        "mutation of the authoritative engine state — the undealt shoe order, the hole card, the version the next command is validated against — leaves no record of what changed it; only the current row survives, with updated_at",
      "public.blocks":
        "block creation and especially REMOVAL leave no trace at all: there is no soft-delete column and no delete trigger, and blocks are read by viewer_is_blocked_by inside profiles_select_visible, so an authorization-relevant change is unattributed",
      "public.daily_challenges":
        "a challenge being minted, and its seed being revealed by setting revealed_seed and seed_revealed_at in place, leave no record of what triggered the reveal or whether it preceded the challenge closing",
      "public.friend_requests":
        "a status transition from pending to accepted or declined is overwritten in place; responded_at records when but not which participant acted, and a deleted request leaves nothing behind",
      "public.friendships":
        "creation and removal of a friend edge widen or narrow profiles_select_visible through viewer_is_friend_of, and removal in particular leaves no record whatsoever",
      "public.game_session_seats":
        "seat occupancy, status and stack are overwritten in place, and seat membership is what authorizes five other relations plus the Realtime game topic — so a change to who is seated carries no attribution and no prior value",
      "public.game_sessions":
        "status and version transitions and changes to escrow_chips are overwritten in place; started_at and ended_at record timing but nothing attributes the transition",
      "public.hand_records":
        "the archive holds neither an actor column nor a creation timestamp among the recognised names, so an inserted or altered hand record carries no attribution for who wrote it or when",
      "public.profiles":
        "a change to privacy gates profiles_select_visible and is therefore an access-control decision, yet it is overwritten in place with updated_at recording only that something changed — not which of the six client-writable fields, nor its prior value",
      "public.rate_limit_policies":
        "a change to window_length or max_events alters enforcement configuration for every account and every action, and nothing records the change, its origin or the previous value",
      "public.room_members":
        "joining and leaving alter what caller_is_room_member authorizes; status and left_at are overwritten in place, and a removal performed by the host through remove_room_member leaves no record of who removed whom",
      "public.rooms":
        "a change to visibility or code alters who may join a private table, and no record of such a change is kept",
      "public.rulesets":
        "a change to the rules jsonb alters blackjack behaviour for every session, tournament and archived hand that references the ruleset, and neither the change nor the prior value is recorded",
      "public.tournament_entries":
        "placement, prize_chips and status are written in place as a competition resolves; prize_ledger_id names the ledger row that paid, but nothing records a placement or prize being altered after the fact",
      "public.tournament_matches":
        "setting or changing a winner determines bracket progression and therefore prizes, and no record of such a change is kept",
      "public.wallets":
        "the balance is overwritten in place and carries no attribution for the change; it is reconstructable from wallet_ledger, which is precisely why that ledger exists — the wallets row itself answers no who-did-what-when question",
    };

    const trail = TRAILS[f.resource];
    if (isHigh && trail) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit:exists`, tier, polarity: "positive", identity: trail.inspectAs,
        operation: `select the actor, action and time columns from ${f.resource}`,
        expected: `rows returned carrying ${[trail.actor && "an actor", trail.action && "an action", trail.time && "a timestamp"].filter(Boolean).join(", ")}`,
        fixture: FIXTURE_DEFAULT,
        covers: `does a who-did-what-when record exist, and is it timestamped. ${trail.note}`,
        plumbing: "new",
        verdictWhenPredicted: trail.completeness === "complete" ? "effective" : "gap",
        authorIntent: "n/a (positive)",
      });
      // One Test ID = one statement. UPDATE, DELETE and TRUNCATE are three
      // materially different statements hitting three different controls, so
      // they are three probes and three evidence records.
      for (const [stmt, note] of [
        ["UPDATE", "rejected for all roles by the append-only guard where one exists"],
        ["DELETE", "the row-level and trigger path for removal"],
        ["TRUNCATE", "row-level security does not apply to TRUNCATE at all, so only a trigger can refuse it"],
      ] as const) {
        tests.push({
          testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
          control: `${f.resource}#audit:immutable:${stmt}`, tier, polarity: "negative", identity: ALICE,
          operation: `as an ordinary client, ${stmt} ${stmt === "TRUNCATE" ? "" : "one row of "}${f.resource}`,
          expected: "error 42501 — the trail is not client-modifiable by this statement",
          fixture: FIXTURE_DEFAULT,
          covers: `can a user modify or delete the record, via ${stmt} specifically: ${note}`,
          plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
        });
      }
    } else if (isHigh) {
      tests.push({
        testId: id("F10", f.resource), family: "F10 audit trail", resource: f.resource,
        control: `${f.resource}#audit:absent`, tier, polarity: "characterization", identity: OWNER,
        operation:
          "search the catalogs for any history, versioning or audit relation recording changes to this resource, and for a soft-delete column or delete trigger that would retain a record",
        expected:
          "NONE FOUND — recorded as a factual absence, and no trail is created to make the family pass",
        fixture: FIXTURE_DEFAULT,
        covers:
          `the brief's family 10 question for this High-tier resource. Zero history, versioning or audit relations exist anywhere in public or private. Specific to ${f.resource}: ${GAP_RATIONALE[f.resource] ?? "no resource-specific rationale has been written, which is itself a defect in this plan"}`,
        plumbing: "new", verdictWhenPredicted: "gap", authorIntent: "n/a (gap assessment, not a simulated attack)",
      });
    } else {
      na.push({
        family: "F10 audit trail", resource: f.resource,
        reason: `tier is ${tier}; the brief scopes the audit-trail question to high-tier resources`,
      });
    }
  }

  // =======================================================================
  // Families that are not per-resource
  // =======================================================================

  // ------------------------------------------------------------------- F5
  // One case per function, from rubric/f5-escalation.ts, where each carries its
  // own purpose, identity source, privileged reach, escalation shape, concrete
  // attempt and exact safe result. The generic "pass Bob's resource" template
  // is gone: it faked a target argument on functions that have none, and it
  // expected "no data" from functions that are cross-user by design.
  //
  // The identity is the caller the spec's own attempt names. It used to be
  // `ALICE` for every row, while the attempt — and so the approved operation
  // and expectation — named carol on sixteen rows and anon on one. That was
  // contradiction C1 (D3.26); reading the caller from the same record the
  // operation and expectation come from is its resolution (D3.33).
  for (const spec of F5_SPECS) {
    // A spec whose predicted safe result is itself a recorded fact rather than
    // a refusal is a characterization, and carries no AUTHOR INTENT.
    const isCharacterization = spec.expectedSafe.includes("CHARACTERIZATION");
    tests.push({
      testId: id("F5", spec.fn), family: "F5 SECURITY DEFINER escalation",
      resource: `public.${spec.fn}(${spec.args})`,
      control: `public.${spec.fn}#security_definer`, tier: "High",
      polarity: isCharacterization ? "characterization" : "negative",
      identity: callerNamedBy(spec.attempt),
      operation: spec.attempt,
      expected: spec.expectedSafe,
      fixture: FIXTURE_DEFAULT,
      covers: `[${spec.klass}] ${spec.purpose}. Identity: ${spec.identitySource}. Reaches: ${spec.privilegedReach}. Escalation would be: ${spec.escalationWouldBe}`,
      plumbing: "new",
      verdictWhenPredicted: isCharacterization ? "characterized" : "effective",
      authorIntent: isCharacterization ? "n/a (characterization)" : null,
    });
  }
  // No caller-supplied target, but a real invariant each. Three of these
  // legitimately mutate other accounts' rows via housekeeping, so the generic
  // "nobody else's rows change" rule does not apply to them.
  for (const spec of F5_NO_TARGET_SPECS) {
    tests.push({
      testId: id("F5", spec.fn.split("(")[0] ?? spec.fn), family: "F5 SECURITY DEFINER escalation",
      resource: `public.${spec.fn}`,
      control: `public.${spec.fn.split("(")[0]}#security_definer`, tier: "High", polarity: "negative",
      // Same rule as F5_SPECS. For these five it reproduces what was here
      // before exactly — anon for latest_verifiable_daily_challenge, alice for
      // the rest — but from the attempt rather than from a function-name test.
      identity: callerNamedBy(spec.attempt),
      operation: spec.attempt,
      expected: spec.expectedSafe,
      fixture: noTargetNeed(spec.fn),
      covers: `[no_target] ${spec.purpose}. Identity: ${spec.identitySource}. Reaches: ${spec.privileged}. LEGITIMATE shared effects: ${spec.legitimateSharedEffects}. Escalation would be: ${spec.escalationWouldBe}`,
      plumbing: "new", verdictWhenPredicted: "effective", authorIntent: null,
    });
  }
  // Genuinely caller-scoped: one shared invariant, one probe each.
  for (const fn of F5_CALLER_SCOPED) {
    // Gate A, D-283 (D3.54): delete_own_account keeps its place, and so its
    // Test ID, but carries its own function-specific invariant.
    const own = fn === "delete_own_account()" ? DELETE_OWN_ACCOUNT_INVARIANT : null;
    tests.push({
      testId: id("F5", fn.split("(")[0] ?? fn), family: "F5 SECURITY DEFINER escalation",
      resource: `public.${fn}`,
      control: `public.${fn.split("(")[0]}#security_definer`, tier: "High", polarity: "negative",
      identity: ALICE,
      operation: `call ${fn} as alice while bob's and carol's rows are present in every table it reads`,
      expected: own?.expected ?? "only alice's own rows are returned or altered; no bob or carol row appears in the result or changes",
      fixture: FIXTURE_DEFAULT,
      covers: own?.covers ??
        "[no_target, caller-scoped] this function takes no argument naming another account or resource AND has no shared or global effect — it reads and writes only rows keyed to auth.uid(). Verified against its body, so the caller-scoped invariant is asserted rather than assumed. The escalation question is whether the definer privilege leaks past the caller's own data",
      plumbing: "new", verdictWhenPredicted: "effective", authorIntent: null,
    });
  }

  // ------------------------------------------------- F7 mechanism demonstration
  // The only place the owner exemption can actually be isolated: a scratch
  // table owned by a purpose-made role holding NO BYPASSRLS, created and
  // dropped inside the run. This is WP1 §2's experiment, re-executed to produce
  // WP3 evidence rather than cited from WP1.
  const F7M = "(scratch table, owner without BYPASSRLS)";
  const f7Mech: readonly [Polarity, string, string, string, string][] = [
    ["characterization", "scratch owner (owns the table, no BYPASSRLS, not a superuser)",
     "with RLS enabled and NOT forced, select from the scratch table whose policy admits 1 of its 2 rows",
     "2 rows — the owner is not subject to the policy",
     "isolates the OWNER exemption. The role holds no BYPASSRLS, so this outcome can only be ownership, which is the inference the Arc21 probes could not support"],
    ["positive", "the same scratch owner, same statement",
     "enable FORCE ROW LEVEL SECURITY on the scratch table and repeat the select",
     "1 row — FORCE removes the owner's exemption and the policy now applies",
     "demonstrates what FORCE changes, with ownership as the only variable moved"],
    ["characterization", "a SECOND scratch role: NOSUPERUSER, BYPASSRLS, NOT the owner, and NOT a member of the owner role",
     "with FORCE still enabled, select from the scratch table as that role",
     "2 rows — BYPASSRLS is a separate exemption that FORCE does not touch",
     "isolates BYPASSRLS from BOTH ownership and superuser status. `postgres` cannot serve here even though it is NOSUPERUSER (rolsuper = f, rolbypassrls = t, verified): it is granted the owner role with INHERIT so that it can create the fixture, and PostgreSQL's check_enable_rls uses has_privs_of_role, which counts inherited membership — so postgres would be treated as the OWNER and the result would confound the two exemptions again. A separate role holding only BYPASSRLS is the only clean demonstration"],
  ];
  for (const [polarity, identity, operation, expected, covers] of f7Mech) {
    tests.push({
      testId: id("F7m", "mechanism"), family: "F7 forced RLS / owner bypass", resource: F7M,
      control: "FORCE ROW LEVEL SECURITY vs BYPASSRLS", tier: "suite", polarity, identity,
      operation, expected, covers,
      fixture: needSeed("f7_scratch_roles",
        "a scratch schema and table holding exactly 2 rows, one admitted by its policy and one not, owned by a purpose-made NOSUPERUSER NOBYPASSRLS role; plus a second purpose-made NOSUPERUSER BYPASSRLS role that is neither the owner nor a member of the owner role. Both created and dropped inside the run",
        [], "roles", "created and dropped inside the run by the F7 mechanism executor"),
      plumbing: "reuse WP1", verdictWhenPredicted: polarity === "positive" ? "effective" : "characterized",
      authorIntent: polarity === "negative" ? null : "n/a (mechanism demonstration)",
    });
  }

  tests.push({
    testId: id("F7m", "role-properties"), family: "F7 forced RLS / owner bypass",
    resource: "(role attributes)", control: "pg_roles: rolsuper / rolbypassrls / relowner",
    tier: "suite", polarity: "characterization",
    identity: "server-side catalog read",
    operation:
      "read rolsuper and rolbypassrls for postgres, the scratch owner role and the scratch BYPASSRLS role, and read relowner for the scratch table",
    expected:
      "postgres: rolsuper = false, rolbypassrls = true. Scratch owner: rolsuper = false, rolbypassrls = false, and IS relowner of the scratch table. Scratch bypass role: rolsuper = false, rolbypassrls = true, NOT relowner, not a member of the owner role",
    fixture: FIXTURE_DEFAULT,
    covers:
      "records the exact role properties the three mechanism probes rest on, so a reader can check that each exemption was isolated rather than taking it on trust. Without this row the mechanism demonstration is an assertion about roles",
    plumbing: "new", verdictWhenPredicted: "characterized", authorIntent: "n/a (characterization)",
  });

  // ------------------------------------------------------------------- F8
  // Realtime authorization is RLS on realtime.messages keyed on
  // realtime.topic(), which reads a GUC — so all three branches are testable
  // in-database without the Realtime server running.
  const RT = "realtime.messages";
  const rtCases: readonly [string, Polarity, string, string, string, string][] = [
    ["arc21_game_topic_is_for_its_seated_players", "positive", ALICE,
     "set realtime.topic to fixtures.session.topic, then select from realtime.messages",
     "at least 1 row — alice holds a live seat at that game",
     "the EXISTS branch satisfied: a seated player reads her own game's topic"],
    ["arc21_game_topic_is_for_its_seated_players", "negative", CAROL,
     "set realtime.topic to fixtures.session.topic, then select from realtime.messages",
     "no data — carol holds no seat at that game",
     "the EXISTS branch unsatisfied: the seeded non-participant. This is why the seed seats two of three accounts. Both drivers are falsified — the seat subquery finds no row for carol, and the sibling permissive policy arc21_presence_roster_needs_an_account is falsified too because realtime.topic() is the game topic and not 'presence:players', so the refusal reflects effective authorization across both policies"],
    ["arc21_presence_roster_needs_an_account", "positive", ALICE,
     "set realtime.topic to fixtures.presenceTopic, then select from realtime.messages",
     "at least 1 row — the shared roster requires only an account",
     "the presence read branch satisfied"],
    ["arc21_presence_roster_needs_an_account", "negative", ANON,
     "set realtime.topic to fixtures.presenceTopic, then select from realtime.messages",
     "no data — no policy on realtime.messages names anon",
     "the presence read branch for a signed-out socket, exercising the latent anon grant. realtime.topic() matches this policy's predicate exactly, so the refusal is not the predicate failing — it is that neither this policy nor the sibling arc21_game_topic_is_for_its_seated_players names anon, which is effective authorization across both permissive policies"],
    ["arc21_only_presence_may_be_written_by_a_client", "positive", ALICE,
     "set realtime.topic to fixtures.presenceTopic, then insert into realtime.messages",
     "1 row affected — a client may publish its own presence",
     "the WITH CHECK branch satisfied: the one topic a client may write"],
    ["arc21_only_presence_may_be_written_by_a_client", "negative", CAROL,
     "set realtime.topic to the game topic, then insert into realtime.messages",
     "error 42501 — no insert policy admits a game topic",
     "the WITH CHECK branch unsatisfied: the fabricated-state injection Arc21 measured against a running stack before these policies existed"],
  ];
  for (const [policy, polarity, identity, operation, expected, covers] of rtCases) {
    tests.push({
      testId: id("F8", RT), family: "F8 realtime channel authorization", resource: RT,
      control: `${RT}#policy:${policy}`, tier: tiers.get(RT) ?? "Medium", polarity, identity,
      operation, expected, covers,
      fixture: needSeed("realtime_seed_rows",
        "one realtime.messages row on topic 'game:fixtures.session.id' and one on 'presence:players', inserted server-side so a read has something to return",
        ["gameTopicMessage", "presenceMessage"]),
      plumbing: polarity === "negative" && policy.includes("only_presence") ? "reuse WP1" : "extend WP1",
      verdictWhenPredicted: "effective",
      authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // The SQL policy tests above prove the POLICIES behave. They do not prove the
  // real client path reaches them. Realtime only consults these policies when a
  // channel is declared private, so a client that subscribed non-privately
  // would bypass them entirely while every SQL test still passed. These cases
  // drive the actual local Supabase Realtime socket.
  const rtIntegration: readonly [Polarity, string, string, string, string][] = [
    ["positive", ALICE,
     "subscribe to the private channel fixtures.session.topic over the local Realtime websocket using fixtures.aliceJwt, then have the server broadcast a state message",
     "the subscription is accepted and alice's client receives the payload",
     "end-to-end: confirms the real client path declares the channel private and therefore reaches arc21_game_topic_is_for_its_seated_players at all. An SQL-only suite cannot detect a client that subscribed non-privately"],
    ["negative", CAROL,
     "subscribe to that same private channel fixtures.session.topic using fixtures.carolJwt, who holds no seat",
     "the subscription is refused, or is accepted and delivers nothing; carol's client must receive no game payload",
     "the brief's family 8 question in its literal form — can a client subscribe to another user's channel — exercised through the socket rather than through SQL"],
    ["negative", CAROL,
     "publish a `state` broadcast to fixtures.session.topic over the websocket as carol",
     "refused; no other subscriber receives a carol-originated state message",
     "the fabricated-state injection Arc21 measured against a running stack before these policies existed, retested at the layer where it actually happened"],
  ];
  for (const [polarity, identity, operation, expected, covers] of rtIntegration) {
    tests.push({
      testId: id("F8i", RT), family: "F8 realtime channel authorization", resource: RT,
      control: `${RT}#realtime-socket`, tier: tiers.get(RT) ?? "Medium", polarity, identity,
      operation, expected, covers,
      fixture: needSeed("realtime_client_jwts",
        "signed JWTs for alice and carol against the local stack's JWT secret, and the local Realtime service reachable on its published port",
        ["aliceJwt", "carolJwt"], "credentials", "signed in-run from the local stack's JWT secret; the Realtime service must be reachable on its published port"),
      plumbing: "new", verdictWhenPredicted: "effective",
      authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // ------------------------------------------------------------------- F9
  // Arc21 already has transactional wallet logic. This tests whether it holds.
  const W = "public.wallets";
  const f9: readonly [Polarity, string, string, string, string, Plumbing][] = [
    ["positive",
     "two concurrent sessions each call apply_wallet_delta on alice's wallet, interleaved",
     "final balance equals the sum of both deltas, and reconciles with the ledger",
     "the concurrency control on the balance: Arc21's stated invariant is that balance and ledger must reconcile. Requires two simultaneous connections",
     "server-side (apply_wallet_delta under two concurrent sessions)", "new"],
    ["negative",
     "call apply_wallet_delta twice with the SAME idempotency key",
     "exactly one ledger row and one balance movement — the second call is a no-op, not a second credit",
     "the retry path: Arc21's invariant is that retries cannot debit or credit twice. This is the control private.game_commands and the ledger's unique idempotency key exist to provide",
     "server-side (apply_wallet_delta, same key twice)", "new"],
    ["negative",
     "call apply_wallet_delta with a debit larger than the balance",
     "refusal — balances stay non-negative (a CHECK constraint violation, SQLSTATE 23514)",
     "the non-negative-balance invariant, which is enforced as a database constraint rather than in application code",
     "server-side (apply_wallet_delta over-debit)", "new"],
    ["negative",
     `update public.wallet_ledger set delta = 1 where user_id = ${FIXTURES.alice.ref}`,
     "error — UPDATE is rejected by wallet_ledger_append_only",
     "append-only enforcement on the economy history, exercised as an ordinary client. The ledger is the authoritative source wallets.balance is recomputed from, which is why WP2 rated its reversibility High",
     ALICE, "extend WP1"],
    ["negative",
     `update public.wallet_ledger set delta = 1 where user_id = ${FIXTURES.alice.ref}`,
     "error — the trigger raises for every role, not only client roles",
     "the same statement from the SERVER side. A separate Test ID because it is a separate identity and a materially different claim: the guard is not merely a client-role check but applies to the privileged path too, which is what makes the ledger authoritative",
     "server-side (direct Postgres connection)", "extend WP1"],
    ["negative",
     "truncate public.wallet_ledger",
     "error — refused by wallet_ledger_deny_truncate",
     "TRUNCATE is not reachable through a row policy at all, so a trigger is the only thing that can refuse it. Exercised as an ordinary client",
     ALICE, "extend WP1"],
    ["negative",
     // Gate A, C2-fk-before-truncate-trigger (D3.54): approved as a plain
     // TRUNCATE, which the foreign keys referencing the ledger refuse (0A000)
     // before any BEFORE TRUNCATE trigger fires. With CASCADE the keys no longer
     // refuse and the ledger's own trigger answers first. Destructive only if the
     // trigger is absent, and then only in the disposable database, which the
     // executor rebuilds after any change (R7).
     "truncate public.wallet_ledger cascade",
     "error — refused by wallet_ledger_deny_truncate",
     "the same TRUNCATE from the SERVER side, as its own Test ID for the same reason as the UPDATE pair above",
     "server-side (direct Postgres connection)", "extend WP1"],
  ];
  for (const [polarity, operation, expected, covers, identity, plumbing] of f9) {
    tests.push({
      testId: id("F9", W), family: "F9 wallet / concurrency integrity", resource: W,
      control: `${W}#integrity`, tier: "High", polarity, identity, operation, expected, covers,
      fixture: FIXTURE_DEFAULT + ", whose wallets each hold the 25,000-chip initial grant and one matching wallet_ledger row",
      plumbing, verdictWhenPredicted: "effective", authorIntent: polarity === "negative" ? null : "n/a (positive)",
    });
  }

  // ------------------------------------------------- boundary cases
  for (const f of resources) {
    const tier = tiers.get(f.resource) ?? "Medium";
    if (tier !== "High") continue;
    if (f.anyPolicyReferencesAuthUid) {
      tests.push({
        testId: id("B", f.resource), family: "B boundary cases", resource: f.resource,
        control: `${f.resource}#boundary:null-identity`, tier, polarity: "negative",
        identity: "authenticated with NO claims set (auth.uid() is null)",
        operation: `select from ${f.resource}`,
        expected: "no data — a policy comparing to a null auth.uid() matches nothing",
        fixture: FIXTURE_DEFAULT,
        covers:
          "the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid()",
        plumbing: "reuse WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }
    if (f.hasIdentityLinkage) {
      tests.push({
        testId: id("B", f.resource), family: "B boundary cases", resource: f.resource,
        control: `${f.resource}#boundary:deleted-user`, tier, polarity: "negative",
        identity: "authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed)",
        operation: DELETED_USER_SURVIVING_SESSION.has(f.resource)
          ? `select from ${f.resource} for the game session ${FIXTURES.session.ref} that the deleted account had joined, after its deletion`
          : `select from ${f.resource} where the owner column names ${FIXTURES.dave.ref}, the deleted account`,
        expected:
          "no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind",
        fixture: FIXTURE_DEFAULT,
        covers:
          "the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this",
        plumbing: "extend WP1", verdictWhenPredicted: "effective", authorIntent: null,
      });
    }
  }

  // Suite-level: expired session. Deliberately NOT a PostgreSQL test.
  tests.push({
    testId: "B.suite.expired-session", family: "B boundary cases", resource: "(API boundary)",
    control: "PostgREST / GoTrue JWT verification", tier: "suite", polarity: "negative",
    identity: "an expired JWT presented over HTTP",
    operation: "issue an authenticated request to the local PostgREST endpoint with an expired token",
    expected: "HTTP 401 — rejected at the API boundary before any statement reaches PostgreSQL",
    fixture: FIXTURE_DEFAULT,
    covers:
      "the brief's expired-session boundary. Counted once for the suite rather than per resource, because an expired JWT never arrives at the database: PostgREST verifies and rejects it first, so there is no per-resource control to exercise and pretending otherwise would claim PostgreSQL enforced something it never saw",
    plumbing: "new", verdictWhenPredicted: "effective", authorIntent: null,
  });

  // ---------------------------------------------------- F3 applicability table
  // Evaluated for EVERY policy carrying a WITH CHECK, independently of whether
  // the tier's representative rule selected it for a test.
  for (const f of resources) {
    for (const p of f.policies.filter((x) => x.hasWithCheck)) {
      const pcol = p.predicateColumns[0] ?? ownerCol(f);
      const newRowCols = p.predicateColumns.length ? [...p.predicateColumns] : pcol ? [pcol] : [];
      const insCols = (f.reachableBy["authenticated"] ?? []).includes("INSERT")
        ? ["(table-level INSERT: all columns)"]
        : [];
      const updCols = f.columns.filter((c) => c.clientUpdate.length > 0).map((c) => c.name);
      const tableUpd = (f.reachableBy["authenticated"] ?? []).includes("UPDATE");
      const pos = tests.find(
        (t) => t.family === "F3 WITH CHECK enforcement" && t.control.endsWith(`#policy:${p.name}`) && t.polarity === "positive",
      );
      const neg = tests.find(
        (t) => t.family === "F3 WITH CHECK enforcement" && t.control.endsWith(`#policy:${p.name}`) && t.polarity === "negative",
      );

      let exercisable: boolean;
      let reason = "";
      if (f.effectiveWriteExposure !== "authenticated") {
        exercisable = false;
        reason = `effective write exposure is ${f.effectiveWriteExposure}: no client can reach a write on this resource at all`;
      } else if (p.command === "INSERT") {
        exercisable = insCols.length > 0;
        reason = exercisable ? "" : "no client INSERT grant, so the new-row check cannot be reached";
      } else {
        // UPDATE: the WITH CHECK is only independently exercisable if the
        // caller can change a column the check reads.
        const canChange = newRowCols.some((c) => updCols.includes(c)) || tableUpd;
        exercisable = canChange;
        reason = canChange
          ? ""
          : `UPDATE policy whose new-row check reads ${newRowCols.join(", ")}; the client's column-level UPDATE grant covers only ${updCols.join(", ") || "nothing"}, so no client statement can satisfy USING while violating WITH CHECK. Defence in depth behind the column grant; reachable only if that grant is widened`;
      }

      f3rows.push({
        resource: f.resource, policy: p.name, polcmd: p.command,
        withCheck: "present (explicit)",
        newRowColumns: newRowCols,
        clientInsertColumns: insCols,
        clientUpdateColumns: updCols,
        exercisable,
        reasonIfNot: exercisable
          ? neg
            ? ""
            : f.resource === "realtime.messages"
              ? "exercisable, and tested under F8 realtime channel authorization rather than F3, so the three realtime policies stay documented in one place"
              : "exercisable, but the tier's representative rule selected another WITH CHECK policy on this resource for the negative case"
          : reason,
        positiveTestId: pos?.testId ?? null,
        negativeTestId: neg?.testId ?? null,
      });
    }
  }

  // Metadata only: a row whose own operation needs state the standing seed does
  // not create states that requirement as its fixture (D3.38). No frozen field
  // — operation, expected, covers, identity — is touched here.
  const finalTests = tests.map((t) => {
    const fx = structuralFixtureFor(t);
    return fx === null || fx === t.fixture ? t : { ...t, fixture: fx };
  });

  return {
    tests: finalTests,
    notApplicable: na,
    f3Applicability: f3rows,
    seedExtensions: buildSeedExtensions(finalTests),
  };
}

/**
 * The seed-extension requirement set, derived from the plan rather than
 * declared beside it.
 *
 * Two sources, because neither alone is complete:
 *
 *   The declared states. Every `needSeed()` call names a state some row cannot
 *   run without, and the rows carrying that state are its `requiredBy`.
 *
 *   A reference scan. A row can name `fixtures.roomBobHosts.id` in its
 *   operation while its `fixture` text says only "the standing seed" — and
 *   several F5 rows do exactly that. Scanning every row for every declared
 *   fixture reference catches the ones the `needSeed()` calls miss, which is
 *   the half that would otherwise reach the executor as a silent assumption.
 *
 * Anything declared `extension` in `rubric/fixtures.ts` that neither source
 * reaches is still emitted, marked as required by no test, so that a fixture
 * nobody uses is visible rather than quietly carried.
 *
 * `requiredBy` for a declared state is every row that states it as its fixture,
 * every row that references a fixture it provides, and every row that needs a
 * requirement built on top of it (`dependsOn`). The first version counted only
 * the first of those, so `tournament_alice_bob` did not list the F5 rows that
 * call `sprint_standings(fixtures.tournamentAliceBob.id)` — the reference scan
 * skipped them because the fixture was already claimed (D3.34).
 */
function buildSeedExtensions(tests: readonly PlannedTest[]): SeedExtension[] {
  const out = new Map<string, SeedExtension>();
  const textOf = (t: PlannedTest) => `${t.operation} ${t.expected} ${t.fixture}`;
  const refsOf = (provides: readonly string[]) =>
    provides.map((k) => (FIXTURES as Record<string, { ref: string }>)[k]?.ref).filter((r): r is string => !!r);
  const references = (t: PlannedTest, refs: readonly string[]) =>
    refs.some((r) => new RegExp(`${r.replace(/\./g, "\\.")}\\b`).test(textOf(t)));

  // --- source 1: the declared states -------------------------------------
  // Direct consumers first, then fold each requirement's consumers into the
  // requirements it depends on.
  const direct = new Map<string, Set<string>>();
  for (const need of SEED_NEEDS.values()) {
    const refs = refsOf(need.provides);
    direct.set(
      need.key,
      new Set(tests.filter((t) => t.fixture === need.state || references(t, refs)).map((t) => t.testId)),
    );
  }
  const consumers = new Map([...direct].map(([k, v]) => [k, new Set(v)]));
  const fold = (key: string, ids: ReadonlySet<string>, seen: Set<string>) => {
    for (const dep of SEED_NEEDS.get(key)?.dependsOn ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      for (const id of ids) consumers.get(dep)?.add(id);
      fold(dep, ids, seen);
    }
  };
  for (const [key, ids] of direct) fold(key, ids, new Set([key]));

  for (const need of SEED_NEEDS.values()) {
    const ids = consumers.get(need.key) ?? new Set<string>();
    const rows = tests.filter((t) => ids.has(t.testId));
    out.set(need.key, {
      ...need,
      requiredBy: rows.map((t) => t.testId),
      families: [...new Set(rows.map((t) => t.family))],
    });
  }

  // --- source 2: fixture references the declared states did not cover -----
  const claimed = new Set([...out.values()].flatMap((e) => e.provides));
  for (const [fxKey, fx] of Object.entries(FIXTURES)) {
    if (fx.seed !== "extension" || claimed.has(fxKey)) continue;
    const rows = tests.filter((t) => textOf(t).includes(fx.ref));
    const absence = fxKey === "nonexistentRoomCode";
    out.set(`fixture:${fxKey}`, {
      key: `fixture:${fxKey}`,
      kind: absence ? "absence" : fxKey.endsWith("Jwt") ? "credentials" : "rows",
      scope: absence || fxKey.endsWith("Jwt") ? "runtime" : "baseline",
      state: `${fx.ref} = ${fx.value} — ${fx.note}`,
      provides: [fxKey],
      setup: absence
        ? "no row is created; setup asserts that nothing carries this value"
        : fxKey.endsWith("Jwt")
          ? "signed in-run from the local stack's JWT secret"
          : "seed extension — attest seed-extensions, applied server-side after the standing seed",
      requiredBy: rows.map((t) => t.testId),
      families: [...new Set(rows.map((t) => t.family))],
      dependsOn: [],
    });
  }

  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}
