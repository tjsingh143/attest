/**
 * Attest — approved rows that cannot measure what they claim.
 *
 * Plan contradictions of the C1 kind (a row whose own fields disagree) live in
 * `plan-contradictions.ts` and block execution. This module holds a second
 * kind, found while hardening the executor: a row that is internally
 * consistent but whose approved expectation the SYSTEM makes unreachable —
 * the named trigger sits behind a grant the caller does not hold, the approved
 * literal violates a CHECK constraint, the deleted-user filter names rows the
 * schema's own cascades remove.
 *
 * None is resolved here, because each resolution changes an approved row's
 * frozen field (operation, expected, identity) and that is the author's
 * decision (brief §1.1, D3.35). None is worked around either: the executor
 * still runs the probe exactly as approved and records what happened, and the
 * disposition is `blocked_contradiction` → `not_measured`, never a verdict. A
 * false "effective" would be false assurance; a false "deficient" would be a
 * finding against a working control.
 *
 * Every registration carries a LIVE check — a catalog read that returns true
 * while the contradiction still holds. Preflight runs them all: a registration
 * whose check no longer holds (Arc21 changed, or the reading was wrong) fails
 * preflight as stale, so a contradiction cannot outlive its evidence.
 */
import type { Session } from "./db.ts";

export interface RegisteredContradiction {
  readonly id: string;
  readonly testIds: readonly string[];
  /** One line: why the approved claim cannot be measured. */
  readonly summary: string;
  /** The approved text that states the unreachable claim. */
  readonly approvedSays: string;
  /** What the system does instead, with where that was read from. */
  readonly systemSays: string;
  /** A catalog read returning `holds boolean, detail text`: true while the contradiction still holds. */
  readonly liveCheck: string;
  /** The smallest change the author could make. Not applied. */
  readonly proposedResolution: string;
  /**
   * Premise ids this contradiction makes false BY CONSTRUCTION, and so the
   * only ones preflight may excuse on these Test IDs. Every other premise must
   * still hold: C5 excuses the empty subject, never "dave is deleted".
   */
  readonly exemptPremises: readonly string[];
  /**
   * SQLSTATEs the approved statement is predicted to produce BECAUSE of this
   * contradiction. An outcome carrying one is the contradiction's disposition
   * (blocked_contradiction), not a harness defect — and a derived statement
   * that fails to compile with one is excused in preflight for the same reason.
   */
  readonly predictedSqlstates?: readonly string[];
}

const LEDGER_FKS = `(select string_agg(conrelid::regclass::text || '.' || conname, ', ') from pg_constraint where contype = 'f' and confrelid = 'public.wallet_ledger'::regclass)`;

export const REGISTERED_CONTRADICTIONS: readonly RegisteredContradiction[] = [
  {
    id: "C2-grant-before-trigger",
    testIds: ["F9.public_wallets.319", "F9.public_wallets.321"],
    summary: "the approved expectation names a wallet_ledger trigger as the refusal, but an ordinary client holds no UPDATE or TRUNCATE privilege on wallet_ledger, so the privilege check refuses first and the trigger is never reached",
    approvedSays: "'error — UPDATE is rejected by wallet_ledger_append_only' (.319, as alice); 'error — refused by wallet_ledger_deny_truncate' (.321, as alice)",
    systemSays: "authenticated holds only SELECT on public.wallet_ledger; PostgreSQL checks table privileges before any trigger fires, so the refusal is 42501 'permission denied for table wallet_ledger'",
    liveCheck: `select (not has_table_privilege('authenticated', 'public.wallet_ledger', 'UPDATE') and not has_table_privilege('authenticated', 'public.wallet_ledger', 'TRUNCATE')) as holds,
                       'authenticated UPDATE: ' || has_table_privilege('authenticated', 'public.wallet_ledger', 'UPDATE')::text ||
                       ', TRUNCATE: ' || has_table_privilege('authenticated', 'public.wallet_ledger', 'TRUNCATE')::text as detail`,
    exemptPremises: [],
    // Gate A (D3.54): the author KEPT the approved trigger property and the
    // not_measured disposition. The client privilege refusal is not evidence the
    // trigger fired; F9.320 (and F9.322 since Gate A) carry the trigger's evidence.
    proposedResolution: "(decided at Gate A: keep, not_measured) restate each expectation as the privilege refusal it is ('error 42501 — refused before any trigger is consulted: authenticated holds no UPDATE/TRUNCATE on wallet_ledger'), or, if the trigger is the point, keep only the server-side rows (.320, .322) as the trigger's evidence",
  },
  {
    id: "C5-deleted-user-subject-empty",
    testIds: [
      "B.private_game_commands.323", "B.public_blocks.325", "B.public_friend_requests.327", "B.public_friendships.329",
      "B.public_profiles.335",
      "B.public_rate_limit_events.336", "B.public_room_members.337", "B.public_rooms.338", "B.public_tournament_entries.340",
      "B.public_wallet_ledger.342", "B.public_wallets.344",
    ],
    summary: "after a genuine deletion (Arc21's delete_own_account), every owner column these eleven probes filter on is ON DELETE CASCADE, so no row can name the deleted account and nothing it owned survives: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events. (Gate A, D3.54: the author kept these eleven not_measured — Arc21's deletion model removes the subject, an honest limit on what a stale-identity probe can measure — and retargeted the three session-scoped rows, .331–.333, at the state the deletion leaves behind)",
    approvedSays: "'select from <resource> where the owner column names fixtures.dave.id, the deleted account' → 'no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind'",
    systemSays: "every foreign key from those owner columns to profiles/auth.users is ON DELETE CASCADE or SET NULL (read from pg_constraint); the rows the cascade leaves behind (SET NULL) no longer name the account, so the approved filter cannot select them",
    liveCheck: `select bool_and(confdeltype = 'c') as holds,
                       string_agg(conrelid::regclass::text || '.' || a.attname || ' on delete ' || case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' else confdeltype::text end, ', ' order by 1) as detail
                  from pg_constraint c
                  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                 where c.contype = 'f'
                   and (c.conrelid::regclass::text, a.attname) in (
                     ('private.game_commands','user_id'), ('blocks','blocker_id'), ('friend_requests','sender_id'),
                     ('friendships','user_id_a'), ('profiles','id'), ('rate_limit_events','user_id'),
                     ('room_members','user_id'), ('rooms','host_user_id'), ('tournament_entries','user_id'),
                     ('wallet_ledger','user_id'), ('wallets','user_id'))`,
    exemptPremises: ["subject"],
    proposedResolution: "redefine the boundary probe to target what the cascade leaves behind — e.g. before the deletion, record a row the account could read that survives it (a seat whose user_id becomes NULL, a session it hosted), then query THAT row with the stale token — or accept these rows as characterization ('deletion cascades; nothing remains keyed to the account')",
  },
];

/**
 * Registrations the author RESOLVED at Gate A (2026-09-24, D3.54), kept as the
 * record of what stood and what was decided — not consulted by any gate. Each
 * resolution changed a frozen field, listed with its old and new value in
 * `rubric/wp3-approved-matrix.json`.
 */
export const RESOLVED_CONTRADICTIONS: readonly { readonly id: string; readonly testIds: readonly string[]; readonly resolution: string; readonly decision: string }[] = [
  { id: "C2-fk-before-truncate-trigger", testIds: ["F9.public_wallets.322"], resolution: 'the server-side TRUNCATE is `truncate public.wallet_ledger cascade`, so the referencing foreign keys no longer refuse first and wallet_ledger_deny_truncate answers', decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C2-definer-bypasses-named-policy", testIds: ["F5.send_friend_request.259"], resolution: "the expected result now names the SECURITY DEFINER body's PT404 'no such player' refusal (is_blocked_between) instead of the bypassed RLS policy; the property — no friend request across a block — is unchanged", decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C3-sender-cannot-accept", testIds: ["F3.public_friend_requests.059"], resolution: "the positive's literal is the sender's one legitimate transition, status = 'cancelled'", decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C3-username-literal-invalid", testIds: ["F3.public_profiles.151", "F6.public_profiles.153"], resolution: "the positives' literal is 'attest_probe_user', which the username rules accept", decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C3-cosmetic-literal-invalid", testIds: ["F6.public_loadouts.117"], resolution: 'the positive sets avatar_cosmetic_id = NULL (unequip), which the slot guard accepts', decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C4-anon-has-no-execute", testIds: ["F5.latest_verifiable_daily_challenge.278"], resolution: "the row runs as a signed-in caller (alice); the property is the revealed-only filter, which does not read the caller; anonymous EXECUTE is revoked on purpose and is not this row's question", decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C2-client-guard-before-grant", testIds: ["F2.private_career_drill_seeds.002", "F2.private_career_drill_seeds.003", "F2.private_game_commands.008", "F2.private_game_commands.009", "F2.private_game_state_private.017", "F2.private_game_state_private.018", "F2.public_daily_challenges.042", "F2.public_daily_challenges.043", "F2.public_game_events.075", "F2.public_game_events.076", "F2.public_game_session_seats.086", "F2.public_game_session_seats.087", "F2.public_game_sessions.094", "F2.public_game_sessions.095", "F2.public_hand_records.105", "F2.public_hand_records.106", "F2.public_rate_limit_events.167", "F2.public_rate_limit_events.168", "F2.public_rate_limit_policies.176", "F2.public_rate_limit_policies.177", "F2.public_room_members.184", "F2.public_room_members.185", "F2.public_rooms.192", "F2.public_rooms.193", "F2.public_rulesets.198", "F2.public_rulesets.199", "F2.public_tournament_entries.207", "F2.public_tournament_entries.208", "F2.public_tournament_matches.215", "F2.public_tournament_matches.216", "F2.public_wallet_ledger.228", "F2.public_wallet_ledger.229", "F2.public_wallets.239", "F2.public_wallets.240",], resolution: 'each of the 34 grant-surface UPDATE/DELETE statements ends in `where true`, so pg_safeupdate no longer refuses before the privilege check the row examines', decision: "Gate A, 2026-09-24 (D3.54)" },
  { id: "C3-tier-literal-invalid", testIds: ["F2.public_game_sessions.094"], resolution: "the grant-surface UPDATE on game_sessions sets tier = 'casual' (a table_tier label) and ends in `where true`", decision: "Gate A, 2026-09-24 (D3.54)" },
];

const BY_TEST = new Map<string, RegisteredContradiction[]>();
for (const c of REGISTERED_CONTRADICTIONS) for (const id of c.testIds) BY_TEST.set(id, [...(BY_TEST.get(id) ?? []), c]);

/** Every registration naming this Test ID (one row can carry more than one, e.g. F2.094). */
export function registeredContradictionsFor(testId: string): readonly RegisteredContradiction[] {
  return BY_TEST.get(testId) ?? [];
}

/** The combined disposition an evidence record carries. */
export function contradictionDisposition(testId: string): { id: string; reason: string; predictedSqlstates: string[] } | null {
  const cs = registeredContradictionsFor(testId);
  if (!cs.length) return null;
  return { id: cs.map((c) => c.id).join(" + "), reason: cs.map((c) => c.summary).join(" | "), predictedSqlstates: cs.flatMap((c) => c.predictedSqlstates ?? []) };
}

export interface ContradictionCheck {
  readonly id: string;
  readonly testIds: readonly string[];
  readonly holds: boolean;
  readonly detail: string;
}

/** Run every registration's live check. A registration that no longer holds is stale. */
export async function checkRegisteredContradictions(admin: Session): Promise<ContradictionCheck[]> {
  const out: ContradictionCheck[] = [];
  for (const c of REGISTERED_CONTRADICTIONS) {
    try {
      const { rows } = await admin.query(c.liveCheck);
      const r = rows[0] as { holds?: boolean; detail?: string } | undefined;
      out.push({ id: c.id, testIds: c.testIds, holds: r?.holds === true, detail: String(r?.detail ?? "no row") });
    } catch (err) {
      out.push({ id: c.id, testIds: c.testIds, holds: false, detail: `the live check raised: ${(err as Error).message}` });
    }
  }
  return out;
}
