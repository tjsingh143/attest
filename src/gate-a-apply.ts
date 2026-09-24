/**
 * Attest — applying the author's Gate A decisions (D3.54).
 *
 * Two things, both mechanical and both refusing anything the author did not
 * decide:
 *
 *   1. The frozen-manifest corrections. Every field in which the plan now
 *      differs from the approved matrix (the approved run plus the corrections
 *      already listed) must be one a Gate A decision authorises for that exact
 *      Test ID — otherwise nothing is written. Each becomes a listed correction
 *      with its old value, new value, reason and decision, exactly as the
 *      nineteen C1/tournament corrections and the 97 fixture corrections were
 *      (D3.35, D3.38). An authorised change the plan does NOT make is also a
 *      refusal: the decision would then be recorded as applied when it was not.
 *
 *   2. The intent approvals. Accepted wording is recorded as
 *      `user_reviewed_ai_draft` — including the five sentences the author
 *      supplied as AI-assisted wording they reviewed and adopted — never
 *      `user_authored`, which is the author's instruction. An "approve as
 *      written" decision applies only to the exact Gate A text: a draft whose
 *      text differs from the review table's is refused, not approved.
 *
 * The source of every decision is `rubric/wp3-gate-a-decisions.json`, which
 * records the author's reply and names it (`recordedFrom`).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { FROZEN_FIELDS, type ApprovedCorrection, type ApprovedManifest } from "./wp3-approved.ts";
import { requiresIntent, type AuthorIntent, type IntentStore } from "./author-intents.ts";
import { GATE_A_DECISIONS_PATH } from "./gate-a-package.ts";

type Field = ApprovedCorrection["field"];

const DATE = "2026-09-24";
const decisionLabel = (id: string) => `Gate A ${DATE} — ${id} (author's decision; D3.54)`;

/** Why each authorised change is made, per decision. */
const REASONS: Readonly<Record<string, string>> = {
  "C2-client-guard-before-grant":
    "Every client connection arrives through authenticator, which preloads pg_safeupdate; it refuses an UPDATE or DELETE with no WHERE " +
    "clause at parse analysis (21000), before the privilege check this row examines. `where true` satisfies the guard and reads no " +
    "column, so the statement reaches the same privilege check. The property (no client UPDATE/DELETE privilege) and the expected " +
    "refusal are unchanged.",
  "C3-tier-literal-invalid":
    "'attest-probe-tier' is not a table_tier label, so the statement failed enum parsing (22P02) before any privilege or client-guard " +
    "check; 'casual' is a label, and `where true` carries the statement past pg_safeupdate (C2-client-guard-before-grant). Same property.",
  "C2-fk-before-truncate-trigger":
    "Four foreign keys reference wallet_ledger, so a plain TRUNCATE is refused by the foreign-key check (0A000) before any BEFORE " +
    "TRUNCATE trigger fires. With CASCADE the keys no longer refuse and wallet_ledger_deny_truncate is what answers. Same property; the " +
    "statement is destructive only if the trigger were absent, and then only in the disposable database, which is rebuilt after any change.",
  "C2-definer-bypasses-named-policy":
    "send_friend_request is SECURITY DEFINER, so the RLS policy the approved text named is never consulted; the refusal is the " +
    "function body's own PT404 'no such player' on is_blocked_between(caller, receiver). The mechanism attribution is corrected; the " +
    "property — no friend request across a block — is unchanged.",
  "C3-sender-cannot-accept":
    "The caller is the request's sender, and guard_friend_request_transition lets only the receiver accept (42501, a BEFORE trigger " +
    "that runs before WITH CHECK). 'cancelled' is the sender's one legitimate transition. Same property: a participant's legitimate " +
    "update is admitted and the row stays attributed to them.",
  "C3-username-literal-invalid":
    "'attest-probe-username' is refused by guard_profile_username (23514) before the write can be admitted; 'attest_probe_user' is " +
    "accepted. Same property: the granted column on the caller's own profile is writable.",
  "C3-cosmetic-literal-invalid":
    "The approved uuid names no cosmetic, so guard_loadout_slots refused it (23503) before the granted column could be shown " +
    "writable. NULL (unequip) is accepted and adds no cosmetic-ownership prerequisite. Same property.",
  "C4-anon-has-no-execute":
    "Arc21 revokes EXECUTE on latest_verifiable_daily_challenge() from anon on purpose (migration 20260903130000_daily_seed_reveal), " +
    "so as anon the body never ran. The row's property is the revealed-only filter, which does not read the caller, so it runs as a " +
    "signed-in caller. The approved covers wording ('deliberately callable without an account') was not in the decision and is left as approved.",
  "C5-deleted-user-subject-empty":
    "After a genuine deletion no row names the account, so the approved filter measured referential actions rather than a control. " +
    "Retargeted at the state Arc21's own deletion leaves behind — the seats, session and event stream of a session the account had " +
    "joined and left (its seat survives by ON DELETE SET NULL) — read with the account's still-valid claims, after a read AS the live " +
    "account shows it had that access. Same property: a token outliving its account must not become a key to what the deletion left behind.",
  "D-283":
    "delete_own_account() is not caller-scoped: its body documents a host handover, a queue release, notification cleanup and seat " +
    "anonymisation, so the shared caller-scoped expectation forbade documented behaviour. The row now carries a function-specific " +
    "invariant: (A) the caller's own effects, (B) exactly the documented cleanup and reassignment, and (C) any other change to another " +
    "account's data, authority or unrelated state, which is forbidden. Operation, identity and fixture are unchanged.",
  "O-269":
    "The approved covers stated the takeover's consequence backwards ('redirect their notifications to the caller's device'). The " +
    "function reassigns the device-token row to the caller; the token still identifies the same physical device, so its previous owner " +
    "may stop receiving their notifications there and the caller's may be delivered to it instead. Only the factual description " +
    "changed; the verdict is not prejudged.",
};

/** Which fields each decision changes. */
const FIELDS: Readonly<Record<string, readonly Field[]>> = {
  "C2-client-guard-before-grant": ["operation"],
  "C3-tier-literal-invalid": ["operation"],
  "C2-fk-before-truncate-trigger": ["operation"],
  "C2-definer-bypasses-named-policy": ["expected"],
  "C3-sender-cannot-accept": ["operation"],
  "C3-username-literal-invalid": ["operation"],
  "C3-cosmetic-literal-invalid": ["operation"],
  "C4-anon-has-no-execute": ["identity", "operation"],
  "C5-deleted-user-subject-empty": ["operation", "fixture"],
  "D-283": ["expected", "covers"],
  "O-269": ["covers"],
};

/** The C5 rows the author retargeted; the other eleven were kept. */
const C5_RETARGETED = ["B.public_game_events.331", "B.public_game_session_seats.332", "B.public_game_sessions.333"];

interface Decisions {
  recordedFrom: string | null;
  intents: {
    categories: Record<"A" | "B" | "C", { decision: string }>;
    perRow: Record<string, { decision: string; sentence?: string }>;
  };
  contradictions: Record<string, { testIds: string[]; decision: string }>;
  d283: { testId: string; decision: string };
  optional: { covers269: { testId: string; decision: string } };
  applied: unknown;
}

export async function loadDecisions(): Promise<Decisions> {
  return JSON.parse(await readFile(GATE_A_DECISIONS_PATH, "utf8")) as Decisions;
}

/** (testId → field → decision id) for every change the decisions authorise. */
export function authorisedChanges(d: Decisions): Map<string, Map<Field, string>> {
  const out = new Map<string, Map<Field, string>>();
  const allow = (testId: string, id: string) => {
    for (const f of FIELDS[id] ?? []) {
      const m = out.get(testId) ?? new Map<Field, string>();
      if (m.has(f)) m.set(f, `${m.get(f)} + ${id}`); else m.set(f, id);
      out.set(testId, m);
    }
  };
  for (const [id, c] of Object.entries(d.contradictions)) {
    if (c.decision === "correct") for (const t of c.testIds) allow(t, id);
    if (c.decision === "correct_three_keep_eleven" && id === "C5-deleted-user-subject-empty") for (const t of C5_RETARGETED) allow(t, id);
  }
  if (d.d283.decision === "function_specific_invariant") allow(d.d283.testId, "D-283");
  if (d.optional.covers269.decision === "correct") allow(d.optional.covers269.testId, "O-269");
  return out;
}

const combinedReason = (ids: string) => ids.split(" + ").map((i) => REASONS[i] ?? `(no written reason for ${i})`).join(" ");

/** The approved rows as the manifest currently defines them: the approved run plus every listed correction. */
async function currentApproved(manifest: ApprovedManifest): Promise<Map<string, PlannedTest>> {
  const raw = JSON.parse(await readFile(join(RUNS_ROOT, manifest.sourceRunId, "wp3-matrix.json"), "utf8")) as { plan: Wp3Plan };
  const byId = new Map(raw.plan.tests.map((t) => [t.testId, { ...t } as PlannedTest]));
  for (const c of manifest.corrections) {
    const t = byId.get(c.testId);
    if (t) (t as unknown as Record<string, unknown>)[c.field] = c.to;
  }
  return byId;
}

export interface GateACorrectionPlan {
  readonly added: readonly ApprovedCorrection[];
  readonly corrections: readonly ApprovedCorrection[];
  readonly refusals: readonly string[];
}

/** Compute the corrections the Gate A decisions authorise, or refuse. */
export async function planGateACorrections(plan: Wp3Plan, manifest: ApprovedManifest, d: Decisions): Promise<GateACorrectionPlan> {
  const refusals: string[] = [];
  const auth = authorisedChanges(d);
  const approved = await currentApproved(manifest);
  const added: ApprovedCorrection[] = [];
  const seen = new Set<string>();
  const fields: readonly string[] = [...FROZEN_FIELDS, "identity", "fixture"];
  for (const t of plan.tests) {
    const a = approved.get(t.testId);
    if (!a) { refusals.push(`${t.testId}: not in the approved matrix`); continue; }
    for (const f of fields) {
      const now = (t as unknown as Record<string, unknown>)[f];
      const was = (a as unknown as Record<string, unknown>)[f];
      if (JSON.stringify(now) === JSON.stringify(was)) continue;
      const by = auth.get(t.testId)?.get(f as Field);
      if (!by) { refusals.push(`${t.testId}.${f} changed, and no Gate A decision authorises that change`); continue; }
      seen.add(`${t.testId}.${f}`);
      added.push({ testId: t.testId, field: f as Field, from: String(was), to: String(now), reason: combinedReason(by), decision: decisionLabel(by) });
    }
  }
  for (const [testId, m] of auth) for (const f of m.keys()) {
    if (!seen.has(`${testId}.${f}`)) refusals.push(`${testId}.${f}: a Gate A decision authorises a change the plan does not make`);
  }
  return { added, corrections: [...manifest.corrections, ...added], refusals };
}

export interface GateAIntentResult {
  readonly store: IntentStore;
  readonly approvedAsWritten: number;
  readonly adoptedGiven: number;
  readonly refusals: readonly string[];
}

/** Apply the intent decisions against the exact Gate A review text. */
export async function applyGateAIntents(plan: Wp3Plan, store: IntentStore, d: Decisions, reviewPath: string): Promise<GateAIntentResult> {
  const review = JSON.parse(await readFile(reviewPath, "utf8")) as { rows: { testId: string; category: "A" | "B" | "C"; draft: string }[] };
  const gateText = new Map(review.rows.map((r) => [r.testId, r]));
  const refusals: string[] = [];
  let approvedAsWritten = 0, adoptedGiven = 0;
  const required = new Set(plan.tests.filter(requiresIntent).map((t) => t.testId));
  const intents: AuthorIntent[] = store.intents.map((e) => {
    if (!required.has(e.testId)) { refusals.push(`${e.testId}: in the store but not required by the plan`); return e; }
    const g = gateText.get(e.testId);
    if (!g) { refusals.push(`${e.testId}: not in the Gate A review table`); return e; }
    const row = d.intents.perRow[e.testId];
    const decision = row?.decision ?? d.intents.categories[g.category].decision;
    if (decision === "adopt_given_wording") {
      if (!row?.sentence) { refusals.push(`${e.testId}: adopt_given_wording with no sentence`); return e; }
      adoptedGiven++;
      return {
        testId: e.testId, intent: row.sentence.replace(/\s+$/, ""), provenance: "user_reviewed_ai_draft", reviewStatus: "approved",
        note: `Gate A ${DATE}: wording supplied in the author's Gate A reply as AI-assisted wording the author reviewed and adopted (category C; the probe changed with the author's decision)`,
      };
    }
    if (decision === "approve_as_written") {
      if (e.intent !== g.draft) { refusals.push(`${e.testId}: the store's text differs from the Gate A text the author approved`); return e; }
      approvedAsWritten++;
      return {
        testId: e.testId, intent: e.intent, provenance: "user_reviewed_ai_draft", reviewStatus: "approved",
        note: `Gate A ${DATE}: the AI draft approved as written by the author (category ${g.category})`,
      };
    }
    refusals.push(`${e.testId}: no applicable decision (category ${g.category}: ${decision})`);
    return e;
  });
  for (const id of required) if (!store.intents.some((e) => e.testId === id)) refusals.push(`${id}: required but missing from the store`);
  return { store: { ...store, intents }, approvedAsWritten, adoptedGiven, refusals };
}

export async function recordApplied(summary: Record<string, unknown>): Promise<void> {
  const d = await loadDecisions();
  (d as unknown as Record<string, unknown>).applied = summary;
  await writeFile(GATE_A_DECISIONS_PATH, JSON.stringify(d, null, 2) + "\n");
}
