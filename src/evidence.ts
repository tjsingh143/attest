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
  /** A small sample of returned rows, for a reader. Never used for pass/fail. */
  readonly sample: readonly unknown[];
}

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
  readonly outcome: "pass" | "fail";
  readonly detail: Outcome;
}

/** Canonical one-line form of an outcome. Two runs that produce the same string
 *  are indistinguishable to any assertion built on this statement. */
export function summarize(o: Outcome): string {
  return o.raised ? `error ${o.sqlstate ?? "?"}` : `${o.rowCount ?? 0} row(s)`;
}

export function describeExpectation(e: Expectation): string {
  if (e.kind === "rows") return `${e.count} row(s)`;
  if (e.kind === "no_data") return "no data (error or 0 rows)";
  return `error${e.sqlstate ? ` ${e.sqlstate}` : ""}`;
}

function matches(e: Expectation, o: Outcome): boolean {
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
    return {
      executed: true,
      raised: false,
      rowCount: res.rowCount ?? res.rows.length,
      sqlstate: null,
      message: null,
      sample: res.rows.slice(0, 3),
    };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return {
      executed: true,
      raised: true,
      rowCount: null,
      sqlstate: e.code ?? null,
      message: (e.message ?? String(err)).split("\n")[0] ?? null,
      sample: [],
    };
  }
}

export interface CheckSpec {
  readonly testId: string;
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
    outcome: matches(spec.expect, detail) ? "pass" : "fail",
    detail,
  };
}
