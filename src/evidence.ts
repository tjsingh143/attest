/**
 * Attest — evidence records.
 *
 * An evidence record is the output of one statement actually executed against
 * the instance. It carries everything someone else would need to re-run it and
 * get the same answer: the statement and its parameters, the identity it ran
 * as (read back out of the database, not asserted), what was expected, what
 * happened, and the schema version it happened against.
 *
 * Nothing in this module invents a result. If a statement was not executed,
 * there is no record.
 */
import type { Session, SessionIdentity } from "./db.ts";

/**
 * What the statement was expected to do.
 *
 * Two kinds, because row-level security refuses in two different ways and
 * conflating them loses the signal:
 *
 *   rows   A SELECT filtered by a policy does not raise. It returns fewer
 *          rows -- usually zero. "Denied" for a read means "zero rows".
 *   error  A write refused by WITH CHECK, by a missing privilege, or by a
 *          trigger raises. The SQLSTATE is the interesting part: 42501 is
 *          insufficient_privilege, which is what RLS write refusals and
 *          Arc21's write-guard triggers both use.
 */
export type Expectation =
  | { readonly kind: "rows"; readonly count: number }
  | { readonly kind: "error"; readonly sqlstate?: string }
  /**
   * No data reached the caller, by either route.
   *
   * This exists because "denied" is not one outcome. A missing privilege
   * raises 42501; a policy that admits no rows returns zero of them; and which
   * one a caller meets depends on which gate stops them first. An isolation
   * check that demanded a specific one of the two would report a failure when a
   * grant is added in front of a policy that still denies everything -- the
   * caller got no data either way, and the control held.
   */
  | { readonly kind: "no_data" };

/** What actually happened. */
export interface Outcome {
  readonly executed: true;
  readonly raised: boolean;
  /**
   * Rows affected, not rows returned.
   *
   * For a SELECT the two are the same. For an INSERT, UPDATE or DELETE without
   * a RETURNING clause they are not: nothing comes back, but the statement
   * either changed a row or it did not, and that is the outcome the check cares
   * about. Reading `rows.length` here would score a successful write as "0
   * rows" and make it indistinguishable from a read that returned nothing.
   */
  readonly rowCount: number | null;
  readonly sqlstate: string | null;
  readonly message: string | null;
  /**
   * True when the statement did not fail in the DATABASE -- the harness itself
   * threw.
   *
   * These are not results and must never be scored as one. A probe expecting a
   * refusal would otherwise be satisfied by the harness crashing, and the
   * report would state that a control held when in fact nothing was measured.
   * That happened: a multi-statement probe returned an array of results, a
   * property read threw a TypeError, and it was recorded as a database refusal
   * with no SQLSTATE. The report then contradicted itself two paragraphs apart.
   */
  readonly harnessError: boolean;
  /** A small sample of returned rows, for a reader. Never used for pass/fail. */
  readonly sample: readonly unknown[];
}

/**
 * Did the probe do what was predicted? A statement about EXECUTION only.
 *
 *   as_predicted     the observed outcome matched the expectation
 *   not_as_predicted the observed outcome differed
 *   harness_error    the harness threw; nothing was measured
 */
export type Observation = "as_predicted" | "not_as_predicted" | "harness_error";

/**
 * What the observation MEANS for the control. A separate judgment, and
 * deliberately not derivable from `observation` alone.
 *
 * The two were conflated in the WP3 plan's first draft and it produced two
 * false greens:
 *
 *   An owner-bypass probe (F7) returns every row, exactly as predicted,
 *   because row-level security is enabled and not forced. Execution matched.
 *   The control did not hold — it was never applied. That is `characterized`,
 *   not `effective`.
 *
 *   An audit-trail probe (F10) confirms that no trail exists, exactly as
 *   predicted. Execution matched. The assurance answer is a gap.
 *
 * So:
 *   effective     the control was exercised and held
 *   deficient     the control was exercised and did not hold
 *   characterized a fact was recorded; no control was asserted either way
 *   gap           the control does not exist to be exercised
 *   not_measured  the probe did not execute meaningfully (harness error)
 */
export type Verdict = "effective" | "deficient" | "characterized" | "gap" | "not_measured";

export interface EvidenceRecord {
  readonly recordId: string;
  readonly runId: string;
  readonly schemaVersion: string;
  readonly timestampUtc: string;
  readonly family: string;
  readonly controlId: string;
  readonly testId: string;
  /**
   * One sentence naming the attack this simulates.
   *
   * Reserved for the author (brief §1.1, WP3). WP1's probes exist to validate
   * the harness rather than to assess Arc21, so they carry a mechanical
   * description of what the statement does and leave `intent` null. The WP3
   * suite will not.
   */
  readonly intent: string | null;
  /** What the statement mechanically does. Not a substitute for `intent`. */
  readonly description: string;
  readonly statement: string;
  readonly params: readonly unknown[];
  readonly identity: SessionIdentity;
  readonly expected: string;
  readonly actual: string;
  /**
   * DEPRECATED in favour of `observation` + `verdict`. Retained so WP1's
   * records stay readable, and always consistent with `observation`.
   */
  readonly outcome: "pass" | "fail";
  /** Did execution match the prediction? */
  readonly observation: Observation;
  /** What that means for the control. Never inferred from `observation` alone. */
  readonly verdict: Verdict;
  readonly detail: Outcome;
}

/** Canonical one-line form of an outcome. Two runs that produce the same string
 *  are indistinguishable to any assertion built on this statement. */
export function summarize(o: Outcome): string {
  if (o.harnessError) return `HARNESS ERROR`;
  return o.raised ? `error ${o.sqlstate ?? "?"}` : `${o.rowCount ?? 0} row(s)`;
}

export function describeExpectation(e: Expectation): string {
  if (e.kind === "rows") return `${e.count} row(s)`;
  if (e.kind === "no_data") return "no data (error or 0 rows)";
  return `error${e.sqlstate ? ` ${e.sqlstate}` : ""}`;
}

function matches(e: Expectation, o: Outcome): boolean {
  // The harness breaking is never evidence that a control worked.
  if (o.harnessError) return false;
  if (e.kind === "rows") return !o.raised && o.rowCount === e.count;
  if (e.kind === "no_data") return o.raised || o.rowCount === 0;
  if (!o.raised) return false;
  return e.sqlstate === undefined || o.sqlstate === e.sqlstate;
}

/** Execute one statement and capture what happened. Never throws on SQL errors —
 *  a refusal is a result, not a failure of the harness. */
export async function execute(
  session: Session,
  statement: string,
  params: readonly unknown[] = [],
): Promise<Outcome> {
  try {
    const res = await session.query(statement, params);
    // A statement string containing more than one command comes back as an
    // array of results rather than a single one.
    const last = (Array.isArray(res) ? res[res.length - 1] : res) as
      | { rows?: unknown[]; rowCount?: number | null }
      | undefined;
    const rows = last?.rows ?? [];
    return {
      executed: true,
      raised: false,
      rowCount: last?.rowCount ?? rows.length,
      sqlstate: null,
      message: null,
      harnessError: false,
      sample: rows.slice(0, 3),
    };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    // A PostgreSQL error carries a five-character SQLSTATE. Anything else came
    // from this process, not from the database.
    const isSqlState = typeof e.code === "string" && /^[0-9A-Za-z]{5}$/.test(e.code);
    return {
      executed: true,
      raised: true,
      rowCount: null,
      sqlstate: isSqlState ? (e.code as string) : null,
      message: (e.message ?? String(err)).split("\n")[0] ?? null,
      harnessError: !isSqlState,
      sample: [],
    };
  }
}

export interface CheckSpec {
  readonly testId: string;
  /**
   * The assurance verdict to record when execution matches the prediction.
   *
   * Defaults to `effective`, because most probes assert a control. A probe that
   * merely records a fact declares `characterized`; one that confirms an
   * absence declares `gap`. A mismatch is always `deficient`, and a harness
   * error is always `not_measured`, whatever this says.
   */
  readonly verdictWhenPredicted?: Verdict;
  readonly family: string;
  readonly controlId: string;
  readonly description: string;
  readonly statement: string;
  readonly params?: readonly unknown[];
  readonly expect: Expectation;
}

export interface RecordContext {
  readonly runId: string;
  readonly schemaVersion: string;
}

/** Execute a check as a given session and produce the evidence record. */
export async function record(
  ctx: RecordContext,
  session: Session,
  spec: CheckSpec,
  suffix: string,
): Promise<EvidenceRecord> {
  const params = spec.params ?? [];
  const detail = await execute(session, spec.statement, params);
  const expected = describeExpectation(spec.expect);
  const actual = summarize(detail);
  const matched = matches(spec.expect, detail);
  const observation: Observation = detail.harnessError
    ? "harness_error"
    : matched ? "as_predicted" : "not_as_predicted";
  const verdict: Verdict =
    observation === "harness_error" ? "not_measured"
    : observation === "as_predicted" ? (spec.verdictWhenPredicted ?? "effective")
    : "deficient";
  return {
    recordId: `${spec.testId}:${session.identity.label}:${suffix}`,
    runId: ctx.runId,
    schemaVersion: ctx.schemaVersion,
    timestampUtc: new Date().toISOString(),
    family: spec.family,
    controlId: spec.controlId,
    testId: spec.testId,
    intent: null,
    description: spec.description,
    statement: spec.statement,
    params,
    identity: session.identity,
    expected,
    actual,
    outcome: matched ? "pass" : "fail",
    observation,
    verdict,
    detail,
  };
}
