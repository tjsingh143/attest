/**
 * Attest — WP3 evidence records.
 *
 * WP1's record (`src/evidence.ts`) already carries the core bundle: the
 * statement, its parameters, the identity read back out of the database, the
 * expectation, the outcome, the timestamp and the schema version. WP3 needs
 * more, and the additions are not cosmetic:
 *
 *   tier + polarity      so a reader can slice results the way the plan is
 *                        sliced, without joining back to the matrix
 *   authorIntent +       the sentence the author wrote, and WHO wrote it. A
 *   intentProvenance     record whose "attack simulated" field came from the
 *                        harness is not evidence of the attack; carrying the
 *                        provenance makes that visible in the artefact rather
 *                        than only in the process
 *   arc21                the commit, branch and dirty state of the system
 *                        under test — including which migrations were
 *                        uncommitted when it ran
 *   harness              version and source hash, so a record can be tied to
 *                        the code that produced it
 *
 * The observation/verdict split from WP1 (D3.6 #4) is preserved exactly. A
 * harness exception is `harness_error` / `not_measured` and can never satisfy
 * an expected refusal.
 */
import type { SessionIdentity } from "./db.ts";
import type { Observation, Verdict, Expectation, Outcome } from "./evidence.ts";
import type { Family, Polarity } from "./wp3-plan.ts";
import type { IntentProvenance } from "./author-intents.ts";
import type { Level } from "./scorer.ts";

/** What the harness actually did, as opposed to what the plan described. */
export interface ExecutedOperation {
  /** Which executor ran it. */
  readonly kind: string;
  /** The exact SQL, RPC call, websocket action or HTTP request issued. */
  readonly statement: string;
  readonly params: readonly unknown[];
  /** For an RPC: the fully-qualified function and its identity arguments. */
  readonly functionCall?: string;
  /** Anything the executor needs a reader to know, e.g. concurrency ordering. */
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
  };
  readonly instance: string;
}

export interface HarnessVersion {
  readonly version: string;
  readonly sourcesSha256: string;
  readonly fileCount: number;
}

export interface Wp3EvidenceRecord {
  readonly recordId: string;
  readonly runId: string;
  readonly timestampUtc: string;

  // --- what was planned -----------------------------------------------------
  readonly testId: string;
  readonly family: Family;
  readonly resource: string;
  readonly controlId: string;
  readonly tier: Level | "suite";
  readonly polarity: Polarity;
  readonly operationPlanned: string;
  readonly expectedPlanned: string;

  // --- what the author said this simulates ----------------------------------
  /**
   * Null on positives and characterizations, which simulate no attack. On a
   * negative this is the author's sentence — and `intentProvenance` says
   * whether "the author's" is true.
   */
  readonly authorIntent: string | null;
  readonly intentProvenance: IntentProvenance | null;

  // --- what actually happened -----------------------------------------------
  readonly executed: ExecutedOperation;
  /** Read back out of the database, never asserted by the harness. */
  readonly identity: SessionIdentity | null;
  /** The claims installed for this probe, for reproducibility. */
  readonly claims: Record<string, unknown> | null;
  readonly expectation: Expectation | { readonly kind: "custom"; readonly describe: string };
  readonly actual: Outcome;
  readonly actualSummary: string;

  // --- what it means --------------------------------------------------------
  readonly observation: Observation;
  readonly verdict: Verdict;
  /** Why the verdict is what it is, when it is not the obvious mapping. */
  readonly verdictReason?: string;

  // --- provenance -----------------------------------------------------------
  readonly sut: SystemUnderTest;
  readonly harness: HarnessVersion;
}

/**
 * Decide observation and verdict from a matched/unmatched execution.
 *
 * The only rule that is not mechanical: a harness error is never a result.
 * Everything else follows the plan's declared `verdictWhenPredicted`, so a
 * probe that behaves exactly as predicted still records `characterized` or
 * `gap` where the plan said it should, rather than silently becoming a pass.
 */
export function judge(
  matched: boolean,
  outcome: Outcome,
  verdictWhenPredicted: "effective" | "characterized" | "gap",
): { observation: Observation; verdict: Verdict; verdictReason?: string } {
  if (outcome.harnessError) {
    return {
      observation: "harness_error",
      verdict: "not_measured",
      verdictReason:
        "the harness threw rather than the database refusing; nothing was measured and this cannot satisfy an expected refusal",
    };
  }
  if (!matched) {
    return {
      observation: "not_as_predicted",
      verdict: "deficient",
      verdictReason: `execution did not match the plan's prediction`,
    };
  }
  return {
    observation: "as_predicted",
    verdict: verdictWhenPredicted,
    verdictReason:
      verdictWhenPredicted === "effective"
        ? undefined
        : verdictWhenPredicted === "characterized"
          ? "a fact was recorded; no control was asserted either way"
          : "the control does not exist to be exercised — this is an absence, not a pass",
  };
}
