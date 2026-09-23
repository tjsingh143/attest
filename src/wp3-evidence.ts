/**
 * Attest — the WP3 evidence record.
 *
 * WP1's record (`src/evidence.ts`) carries the core bundle the brief requires:
 * the statement, its parameters, the identity read back out of the database,
 * the expectation, the outcome, the timestamp and the schema version. A WP3
 * record carries everything else a reader needs to re-run the probe and to
 * check that its verdict means what it says (D3.43):
 *
 *   planned            the approved row, verbatim: family, tier, polarity,
 *                      control, operation, expected, fixture
 *   intent             the AUTHOR INTENT sentence and WHO wrote it; a record
 *                      whose "attack simulated" field came from the harness is
 *                      not evidence of the attack, and the provenance says so
 *   executed           the exact statement / RPC / socket / HTTP action, its
 *                      parameters, and every value the executor had to bind
 *   identity + claims  read back from the database session, not asserted
 *   setup              the probe-scoped fixture applied first, if any
 *   premises           each premise the claim rests on, checked live before
 *   guards             each state guard: before and after, as admin
 *   reference          a second observation a comparative claim needed
 *   actual + mechanism the raw outcome with every PostgreSQL error field, and
 *                      the layer that refused, classified from those fields
 *   claims             one result per claim span of the approved expectation
 *   observation        what happened relative to the prediction
 *   verdict            what that means for the control — a separate field,
 *                      because "happened as expected" is not "control effective"
 *   isolation          the baseline epoch the probe ran on, whether it was
 *                      rebuilt first, and what the probe changed
 *   provenance         schema version, Arc21 branch/HEAD/dirty state and
 *                      fingerprint, and the harness source hash
 */
import type { SessionIdentity } from "./db.ts";
import type { Outcome } from "./evidence.ts";
import type { Family, Polarity } from "./wp3-plan.ts";
import type { IntentProvenance, IntentReviewStatus } from "./author-intents.ts";
import type { Level } from "./scorer.ts";
import type { Mechanism } from "./wp3-outcome.ts";
import type { ClaimResult, CheckResult, Wp3Observation, Wp3Verdict } from "./wp3-evaluate.ts";

/** Bumped whenever the record's shape changes; preflight checks a sample record against it. */
export const WP3_EVIDENCE_SCHEMA_VERSION = "wp3-evidence/2";

/** What the harness actually did, as opposed to what the plan described. */
export interface ExecutedOperation {
  /** Which executor ran it. */
  readonly kind: string;
  /** The exact SQL, RPC call, websocket action or HTTP request issued. */
  readonly statement: string;
  readonly params: readonly unknown[];
  /** For an RPC: the fully-qualified function and its identity arguments. */
  readonly functionCall?: string;
  /** Statements issued on the same session first (the realtime.topic GUC). */
  readonly preStatements?: readonly { sql: string; params: readonly unknown[] }[];
  /** Values the executor bound that the approved operation leaves unstated (D3.39). */
  readonly bindingNotes?: readonly string[];
  /** Anything a composite runner needs a reader to know, e.g. concurrency ordering. */
  readonly notes?: readonly string[];
}

export interface SystemUnderTest {
  readonly schemaVersion: string;
  readonly migrationCount: number;
  readonly arc21: {
    readonly commit: string;
    readonly branch: string;
    readonly dirty: boolean;
    readonly uncommittedMigrations: readonly string[];
    /** The read-only guard's fingerprint of the checkout, taken before the run. */
    readonly fingerprintBefore?: string;
  };
  readonly instance: string;
}

export interface HarnessVersion {
  readonly version: string;
  readonly sourcesSha256: string;
  readonly fileCount: number;
}

export interface GuardRecord {
  readonly name: string;
  readonly describe: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly ok: boolean;
  readonly detail: string;
}

export interface IsolationRecord {
  /** The rebuilt baseline this probe ran on. */
  readonly epoch: number;
  /** A rebuild happened immediately before this probe. */
  readonly rebuiltBefore: boolean;
  /** A probe-scoped setup was applied before this probe. */
  readonly setupApplied: string | null;
  /** State relations whose content digest changed during this probe (setup excluded). */
  readonly changedRelations: readonly string[];
  /** Why the executor will rebuild before the next probe, if it will. */
  readonly rebuildAfterBecause: string | null;
  /** A fresh session was opened for this probe (no session state from another probe). */
  readonly freshSession: boolean;
}

export interface Wp3EvidenceRecord {
  readonly schema: typeof WP3_EVIDENCE_SCHEMA_VERSION;
  readonly recordId: string;
  readonly runId: string;
  readonly timestampUtc: string;

  // --- what was planned (the approved row, verbatim) ------------------------
  readonly testId: string;
  readonly family: Family;
  readonly resource: string;
  readonly controlId: string;
  readonly tier: Level | "suite";
  readonly polarity: Polarity;
  readonly identityPlanned: string;
  readonly operationPlanned: string;
  readonly expectedPlanned: string;
  readonly fixturePlanned: string;
  readonly verdictWhenPredicted: string;

  // --- what the author said this simulates ----------------------------------
  /** Null on positives and characterizations, which simulate no attack. */
  readonly authorIntent: string | null;
  readonly intentProvenance: IntentProvenance | null;
  readonly intentReviewStatus: IntentReviewStatus | null;

  // --- what actually happened -----------------------------------------------
  readonly executed: ExecutedOperation;
  /** Read back out of the database, never asserted by the harness. */
  readonly identity: SessionIdentity | null;
  /** The claims installed for this probe, for reproducibility. */
  readonly claims: Record<string, unknown> | null;
  readonly setup: { readonly key: string; readonly statements: readonly string[]; readonly verified: boolean; readonly detail: string } | null;
  readonly premises: readonly CheckResult[];
  readonly catalogFacts: readonly CheckResult[];
  readonly guards: readonly GuardRecord[];
  readonly reference: { readonly describe: string; readonly statement: string; readonly params: readonly unknown[]; readonly outcome: Outcome; readonly mechanism: Mechanism } | null;
  readonly actual: Outcome;
  readonly mechanism: Mechanism;
  readonly actualSummary: string;
  readonly runnerClaims: Readonly<Record<string, { ok: boolean; detail: string }>> | null;

  // --- what it means --------------------------------------------------------
  readonly claimResults: readonly ClaimResult[];
  readonly observation: Wp3Observation;
  readonly verdict: Wp3Verdict;
  readonly verdictReason: string;
  /** Set when a registered approved-row contradiction decides the disposition. */
  readonly contradiction: { readonly id: string; readonly reason: string } | null;

  // --- isolation and provenance ---------------------------------------------
  readonly isolation: IsolationRecord;
  readonly sut: SystemUnderTest;
  readonly harness: HarnessVersion;
}

/** Fields every record must carry, for the preflight schema check (§26). */
export const REQUIRED_FIELDS: readonly (keyof Wp3EvidenceRecord)[] = [
  "schema", "recordId", "runId", "timestampUtc", "testId", "family", "resource", "controlId", "tier", "polarity",
  "identityPlanned", "operationPlanned", "expectedPlanned", "fixturePlanned", "verdictWhenPredicted",
  "authorIntent", "intentProvenance", "intentReviewStatus", "executed", "identity", "claims", "setup",
  "premises", "catalogFacts", "guards", "reference", "actual", "mechanism", "actualSummary", "runnerClaims",
  "claimResults", "observation", "verdict", "verdictReason", "contradiction", "isolation", "sut", "harness",
];

/** A record is well-formed: every required field present, and observation/verdict consistent. */
export function validateRecord(r: Partial<Wp3EvidenceRecord>): string[] {
  const problems: string[] = [];
  for (const f of REQUIRED_FIELDS) if (!(f in r)) problems.push(`missing field ${String(f)}`);
  if (r.schema !== WP3_EVIDENCE_SCHEMA_VERSION) problems.push(`schema ${String(r.schema)}, ${WP3_EVIDENCE_SCHEMA_VERSION} required`);
  const notMeasured = ["harness_error", "precondition_failed", "control_not_reached", "blocked_contradiction"];
  if (r.observation && notMeasured.includes(r.observation) && r.verdict !== "not_measured") {
    problems.push(`observation ${r.observation} must carry verdict not_measured, not ${r.verdict}`);
  }
  if (r.verdict === "effective" && r.observation !== "as_predicted") problems.push("an effective verdict requires observation as_predicted");
  if (r.polarity === "negative" && r.authorIntent === null) problems.push("a negative record carries no intent sentence");
  if (r.polarity !== "negative" && r.authorIntent !== null) problems.push("only negative records carry an intent sentence");
  if (r.verdict === "effective" && (r.claimResults ?? []).some((c) => c.status !== "met")) problems.push("an effective verdict with a claim not met");
  return problems;
}
