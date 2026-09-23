/**
 * Attest — listing fixture corrections in the approved manifest (D3.38).
 *
 * The approved matrix is frozen (D3.35). Its `fixture` field is metadata the
 * manifest lets a correction change, provided the correction is LISTED, with
 * the approved value, the corrected value, the reason and the decision — the
 * mechanism D3.34 used for the tournament match.
 *
 * The structural pass after D3.36 found 95 rows whose `fixture` said "the
 * standing seed" (or restated the operation) while the probe needed rows the
 * standing seed never creates, or a premise the canonical baseline
 * contradicts. The planner now states each such requirement (`needSeed`). This
 * module turns the resulting fixture differences into listed corrections.
 *
 * It is not run by any ordinary command. `attest freeze-fixture-corrections`
 * runs it deliberately, and it REFUSES unless:
 *
 *   - no frozen field of any row differs from the approved manifest,
 *   - no identity differs,
 *   - every fixture difference is attributable to exactly one declared
 *     requirement, and that requirement has a written reason below.
 *
 * So it can only ever add metadata corrections it can explain, never a change
 * to the question a row asks.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import {
  APPROVED_PATH,
  buildManifest,
  compareToApproved,
  type ApprovedCorrection,
  type ApprovedManifest,
} from "./wp3-approved.ts";
import { createHash } from "node:crypto";

const R2 =
  "R2 (D3.36): the standing seed creates none of the rows this probe's own operation acts on, so a positive could not " +
  "succeed and a refusal would have been true of an empty set. The fixture now states those rows as a baseline " +
  "requirement applied after every rebuild. Operation, expected and covers are unchanged.";
const LEADERBOARD =
  "R2 (D3.36): the leaderboard this probe reads was empty, so 'no private-privacy identity' and 'public-safe " +
  "projection' held of zero rows. The fixture now states a populated board that includes a private-privacy account " +
  "(erin). Operation, expected and covers are unchanged.";
const R5 = (premise: string) =>
  `R5 (D3.36): the approved operation's own premise — ${premise} — contradicts the canonical baseline, which other ` +
  "rows need. It is established by a probe-scoped setup applied to a verified baseline before this probe only, and the " +
  "disposable database is rebuilt afterwards (R7). Operation, expected and covers are unchanged.";

/** One reason per requirement key. A fixture change to a key missing here is refused. */
export const CORRECTION_REASONS: Readonly<Record<string, string>> = {
  "owned_pair:public.career_attempts": R2,
  "owned_pair:public.daily_entries": `${R2} On the daily leaderboard row the same rows populate the board, including a private-privacy account.`,
  "owned_pair:public.player_daily_xp": `${R2} On the weekly-XP leaderboard row the same rows populate the board, including a private-privacy account.`,
  "owned_pair:public.player_decision_periods": `${R2} On the strategy-accuracy leaderboard row the same rows populate the board, including a private-privacy account.`,
  "owned_pair:public.player_mode_stats": R2,
  "owned_pair:public.user_cosmetics": R2,
  "session_hand": R2,
  "queue_population": R2,
  "alice_sent_request": `${R2} The one alice-sent request is to erin, not to bob or carol, so rows listing alice's relationships need not name them.`,
  "blocks_by_bob": R2,
  "game_commands_trail": `${R2} For the immutability probes, the one row an UPDATE or DELETE names now exists.`,
  "rate_limit_trail": `${R2} For the immutability probes, the one row an UPDATE or DELETE names now exists.`,
  "game_events_visibility_pair": `${R2} The rows already existed as a requirement of the F1 game_events probes; this row now states it.`,
  "pair_row_bob_carol:public.friend_requests": `${R2} The bob->carol row already existed as a requirement of F1.054; this row now states it.`,
  "pair_row_bob_carol:public.friendships":
    "The approved operation (a carol call against a room she is not in) is refused at the membership check only if carol is " +
    "bob's friend — invite_friend_to_room checks friendship first — so the bob<->carol friendship, already a requirement of " +
    "F1.066, is what lets this probe reach the property it names. For F2.068 it is the bob-authored row the negative must " +
    "fail to delete. Operation, expected and covers are unchanged.",
  "tournament_alice_bob": `${R2} The tournament's entries already existed as a requirement of F1.204/.205; this row now states it.`,
  "completed_tournaments": LEADERBOARD,
  "expired_room":
    "The approved expectation is a refusal 'that does not distinguish a non-existent room from an ineligible one'. That " +
    "claim compares two responses, so the ineligible room it is compared with — an expired private lobby, one of the " +
    "ineligible cases the function's own comment lists — is now a stated fixture (D3.40). Operation, expected and covers are unchanged.",
  "f5_state:ensure_todays_daily_challenge":
    "The approved fixture restated the operation ('state for <fn>: <attempt>') rather than naming a state; the concrete " +
    "state is now stated. For F6.045 the standing seed creates no daily challenge, so the positive's 'rows returned' was " +
    "unreachable (R2). Operation, expected and covers are unchanged.",
  "f5_state:latest_verifiable_daily_challenge":
    "The approved fixture restated the operation ('state for <fn>: <attempt>') rather than naming a state; the concrete " +
    "state is now stated. Operation, expected and covers are unchanged.",
  "f5_state:create_private_room":
    "The approved fixture restated the operation ('state for <fn>: <attempt>') rather than naming a state; the concrete " +
    "state is now stated. Operation, expected and covers are unchanged.",
  "f5_state:join_matchmaking":
    "The approved fixture restated the operation rather than naming a state. join_matchmaking refuses a caller holding a " +
    "live seat (PT409) before anything else — a business prerequisite, not the property this row asks about — and alice is " +
    "seated in the standing seed; so the state is probe-scoped: alice's seat 'left', no queue entry of her own, bob and carol " +
    "fresh. Operation, expected and covers are unchanged.",
  "f5_state:poll_matchmaking":
    "The approved fixture restated the operation rather than naming a state. poll_matchmaking reports the caller's live " +
    "entry, which the standing seed never created, so the call returned nothing and 'no bob or carol identity appears' held " +
    "of zero rows (R2); the entries are re-stamped fresh before the probe. Operation, expected and covers are unchanged.",
  "caller_scoped_population":
    "The approved operation calls the function 'while bob's and carol's rows are present in every table it reads'; several of " +
    "those tables held no bob or carol row in the standing seed, so 'no bob or carol row appears' held of nothing there (R2). " +
    "The fixture now states that population, and preflight verifies it live. Operation, expected and covers are unchanged.",
  "probe:alice_seat_left":
    "delete_own_account() refuses a caller holding an active seat at an active session (P0001), before the SECURITY " +
    "DEFINER behaviour this row examines is reached — and alice is seated in the standing seed. A refusal for that " +
    "business rule says nothing about caller scoping (D3.41). Alice's seat is 'left', the state the function's own comment " +
    "names as owing and holding nothing; Arc21's active-seat rule is untouched. Operation, expected and covers are unchanged.",
  "probe:alice_low_balance":
    "claim_recovery_grant() refuses a balance at or above 2,000 chips (P0001) before its definer path is reached, and alice " +
    "holds 25,000 in the standing seed; that business refusal says nothing about caller scoping. Her balance is brought " +
    "below 2,000 through apply_wallet_delta, so ledger and balance still reconcile. Operation, expected and covers are unchanged.",
  "probe:alice_friend_is_erin":
    "list_friends() returns the caller's friends' profiles, and in the standing seed alice's friend is bob, so the approved " +
    "'no bob or carol row appears in the result' would be false of a function working correctly. Alice's friend becomes " +
    "erin while the bob<->carol friendship stays present, so a leak past alice's own rows would show. Operation, expected " +
    "and covers are unchanged.",
  "probe:carol_no_tie_to_bob": R5("that carol shares no friendship or request with bob (\"when the friendship is alice↔bob\"), while F1.054/.066 need the bob↔carol rows"),
  "probe:carol_not_bobs_friend": R5("that carol and bob are not friends (\"when the friendship is alice↔bob\"), while F1.066 needs the bob↔carol friendship"),
  "probe:alice_sent_bob_request": R5("\"a request alice sent to bob\", which exists nowhere, and which the application only allows while they are not yet friends"),
  "probe:alice_bob_not_friends": R5("that bob is \"a non-friend\" of alice, while the standing seed makes them friends"),
  "probe:carol_sent_alice_request":
    "R2 (D3.36): the operation updates a friend request alice RECEIVED, and the standing seed has none. The request (from " +
    "carol) is probe-scoped because a baseline one would appear in rows listing alice's own requests. Operation, expected " +
    "and covers are unchanged.",
  "probe:alice_has_no_loadout":
    "R3 (D3.36): alice already holds the one loadout loadouts_user_id_key allows, so the positive INSERT hit a unique key " +
    "and could never reach WITH CHECK. Her loadout is removed for this probe only. Operation, expected and covers are unchanged.",
  "probe:bob_has_no_loadout":
    "A WITH CHECK negative must insert a row that WOULD be accepted if the policy admitted it; with bob's existing loadout " +
    "present a failed WITH CHECK would surface as a unique violation instead of an inserted row. Bob's loadout is removed " +
    "for this probe only. Operation, expected and covers are unchanged.",
  "probe:no_bob_to_carol_request":
    "A WITH CHECK negative must insert a row that WOULD be accepted if the policy admitted it; with the baseline's pending " +
    "bob->carol request present a failed WITH CHECK would surface as a unique violation. That request is removed for this " +
    "probe only. Operation, expected and covers are unchanged.",
  "probe:dave_deleted":
    "R5 (D3.36): the deleted-user boundary ran with dave's account live. The fixture now states a genuine deletion through " +
    "Arc21's own delete_own_account(), with dave's token signed before it. (Contradiction C5 records why, even so, the " +
    "approved operation cannot measure its claim.) Operation, expected and covers are unchanged.",
  "fixture:expiredJwt":
    "The expired-session probe needs a correctly signed but expired token; the approved fixture named only the standing " +
    "seed. The credential is now a stated requirement. Operation, expected and covers are unchanged.",
};

export interface CorrectionPlan {
  readonly corrections: readonly ApprovedCorrection[];
  readonly refusals: readonly string[];
}

/** Compute the listed corrections the current plan needs, or say why not. */
export async function planFixtureCorrections(plan: Wp3Plan, manifest: ApprovedManifest): Promise<CorrectionPlan> {
  const refusals: string[] = [];
  const cmp = compareToApproved(plan, manifest);
  if (cmp.missing.length || cmp.extra.length || cmp.duplicated.length || cmp.orderChanged) {
    refusals.push("the plan's Test IDs are not the approved set in the approved order");
  }
  if (cmp.frozenDrift.length) refusals.push(`frozen fields changed on ${cmp.frozenDrift.length} row(s): ${cmp.frozenDrift.slice(0, 4).join(", ")}`);
  if (cmp.identityDrift.length) refusals.push(`identities changed: ${cmp.identityDrift.slice(0, 3).join("; ")}`);

  const approvedRun = JSON.parse(await readFile(join(RUNS_ROOT, manifest.sourceRunId, "wp3-matrix.json"), "utf8")) as { plan: Wp3Plan };
  const approvedById = new Map(approvedRun.plan.tests.map((t) => [t.testId, t]));
  const already = new Set(manifest.corrections.filter((c) => c.field === "fixture").map((c) => c.testId));
  const byState = new Map(plan.seedExtensions.map((e) => [e.state, e.key]));

  const corrections: ApprovedCorrection[] = [...manifest.corrections];
  for (const id of cmp.fixtureDrift) {
    if (already.has(id)) {
      refusals.push(`${id}: already carries a listed fixture correction; a second one is not stacked silently`);
      continue;
    }
    const t = plan.tests.find((x) => x.testId === id) as PlannedTest;
    const approved = approvedById.get(id);
    if (!approved) { refusals.push(`${id}: not in the approved run`); continue; }
    const key = byState.get(t.fixture);
    if (!key) { refusals.push(`${id}: its new fixture is not the state of any declared requirement`); continue; }
    const reason = CORRECTION_REASONS[key];
    if (!reason) { refusals.push(`${id}: requirement ${key} has no written reason`); continue; }
    corrections.push({ testId: id, field: "fixture", from: approved.fixture, to: t.fixture, reason, decision: "D3.38" });
  }
  return { corrections, refusals };
}

/** Rebuild the manifest from the approved run plus the listed corrections, and write it. */
export async function writeCorrectedManifest(manifest: ApprovedManifest, corrections: readonly ApprovedCorrection[]): Promise<ApprovedManifest> {
  const raw = await readFile(join(RUNS_ROOT, manifest.sourceRunId, "wp3-matrix.json"), "utf8");
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== manifest.sourceMatrixSha256) {
    throw new Error(`the approved run's matrix hashes to ${sha.slice(0, 16)}…, not the recorded ${manifest.sourceMatrixSha256.slice(0, 16)}…`);
  }
  const rebuilt = buildManifest((JSON.parse(raw) as { plan: Wp3Plan }).plan.tests, { runId: manifest.sourceRunId, matrixSha256: sha }, corrections);
  await writeFile(APPROVED_PATH, JSON.stringify(rebuilt, null, 2) + "\n");
  return rebuilt;
}
