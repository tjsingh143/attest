/**
 * Attest — contradictions inside the approved WP3 plan.
 *
 * A contradiction is a row whose own fields disagree with each other, such that
 * executing it exactly as approved would produce a result that means nothing.
 * These are not defects the executor may quietly work around: the matrix was
 * approved, and silently substituting a different identity or a different
 * expectation would make the evidence a record of what the harness decided
 * rather than of what was approved.
 *
 * So they are detected, named, and left blocked. `attest preflight-wp3
 * --for-execution` refuses while any is unresolved. Resolving one is the
 * author's call, and the resolution belongs in the plan, not here.
 *
 * ## C1 — F5 rows whose `identity` contradicts their own `operation`
 *
 * The planner sets `identity: ALICE` for every `F5_SPECS` row. The `operation`
 * and `expected` text come from `rubric/f5-escalation.ts`, where the
 * per-function `attempt` often names a different caller — "as carol", because
 * carol is the seeded non-member, non-participant, non-entrant.
 *
 * On 17 rows those two disagree, and the approved `expected` value is only
 * reachable as the caller the operation names. Measured on the instance:
 *
 *   caller_is_room_member(roomAliceBob)  expected FALSE   alice -> true   carol -> false
 *   viewer_has_blocked(dave)             expected FALSE   alice -> true   carol -> false
 *   is_session_participant(session)      expected FALSE   alice -> true   carol -> false
 *   leaderboard_weekly_xp(10,0)          expected 42501   alice -> 0 rows, no error   anon -> 42501
 *
 * Run as `authenticated:alice`, those four probes would record
 * `not_as_predicted` and therefore verdict `deficient` — four findings against
 * controls that are working exactly as designed. That is worse than a missing
 * test, because it reads as evidence.
 *
 * > **Current state (2026-09-22): C1 is resolved in the plan (D3.33).** The
 * > planner now reads each F5 row's identity from the caller its own attempt
 * > names, so the seventeen rows carry `authenticated:carol` (sixteen) and
 * > `anon` (one). The detector below stays: it is what would catch the same
 * > defect coming back, and it now reads every caller an operation names rather
 * > than only a leading "as <who>". `checkIdentityConsistency` is the positive
 * > proof — for every row, operation caller = expected caller = structured
 * > identity = the caller the executor derives.
 */
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { callerFor } from "./wp3-exec.ts";

export interface PlanContradiction {
  readonly id: string;
  readonly testId: string;
  /** What the approved row asserts. */
  readonly approvedAssumption: string;
  /** What the repository or the instance says instead. */
  readonly evidence: string;
  /** The smallest change that would resolve it. Not applied. */
  readonly proposedResolution: string;
}

/** The caller an operation names, when it names one. */
export function operationActor(t: PlannedTest): string | null {
  return operationCallers(t)[0] ?? null;
}

/**
 * Every caller an operation names with "as <who>", wherever it appears —
 * "as carol, call …", "… then as alice call …", "call f() as alice while …",
 * "… over the websocket as carol". The first version read only a leading
 * "as <who>", which would have missed the last three shapes.
 */
export function operationCallers(t: PlannedTest): string[] {
  return [
    ...new Set([...t.operation.matchAll(/\bas (alice|bob|carol|dave|anon)\b/gi)].map((m) => m[1]!.toLowerCase())),
  ];
}

/** The account (or anon) a structured identity names; null for non-account identities. */
export function identitySubject(identity: string): string | null {
  const m = /^authenticated:(alice|bob|carol|dave)$/.exec(identity);
  if (m) return m[1]!;
  return identity === "anon" ? "anon" : null;
}

/**
 * Callers an expected result names in an ACTOR position — the account whose
 * outcome the expectation describes, as opposed to an account named as the
 * object of the probe ("bob's membership is unchanged").
 *
 * Deliberately narrow. These are the phrasings the approved expectations use
 * for the caller; anything else naming an account is treated as an object.
 */
export function expectedCallers(t: PlannedTest): string[] {
  const e = t.expected;
  const out = new Set<string>();
  for (const m of e.matchAll(/\b(alice|bob|carol|dave) (?:has blocked|holds (?:no|a)\b)/gi)) out.add(m[1]!.toLowerCase());
  for (const m of e.matchAll(/\b(alice|bob|carol|dave)'s (?:absence|client)\b/gi)) out.add(m[1]!.toLowerCase());
  for (const m of e.matchAll(/\battributed to (alice|bob|carol|dave)\b/gi)) out.add(m[1]!.toLowerCase());
  for (const m of e.matchAll(/\bonly (alice|bob|carol|dave)'s own rows\b/gi)) out.add(m[1]!.toLowerCase());
  if (/\b(?:reachable|callable) by anon\b|\bnames anon\b/i.test(e)) out.add("anon");
  return [...out];
}

export interface IdentityCheck {
  readonly testId: string;
  readonly identity: string;
  readonly operationCallers: readonly string[];
  readonly expectedCallers: readonly string[];
  /** The caller the executor derives, as a label. */
  readonly executorCaller: string;
  readonly problems: readonly string[];
}

/**
 * The positive proof behind C1's resolution, over every row of the plan.
 *
 *   exactly one execution identity   the identity names one caller, and the
 *                                    executor can derive one from it
 *   operation = identity             every "as <who>" in the operation is the
 *                                    identity's subject
 *   expected  = identity             every caller the expected result names in
 *                                    an actor position is the identity's subject
 *   executor  = identity             the caller `callerFor` derives is the
 *                                    identity, with the same role and subject —
 *                                    so the evidence record cannot say one
 *                                    thing while the probe ran as another
 */
export function checkIdentityConsistency(
  plan: Wp3Plan,
  /** The executor's derivation. Injectable only so `prove-gates` can show a wrong one is caught. */
  derive: (t: PlannedTest) => ReturnType<typeof callerFor> = callerFor,
): IdentityCheck[] {
  const out: IdentityCheck[] = [];
  for (const t of plan.tests) {
    const problems: string[] = [];
    const subject = identitySubject(t.identity);
    const opCallers = operationCallers(t);
    const exCallers = expectedCallers(t);

    if (opCallers.length > 1) problems.push(`the operation names ${opCallers.length} callers (${opCallers.join(", ")})`);
    for (const c of opCallers) {
      if (c !== subject) problems.push(`the operation runs "as ${c}" but the structured identity is "${t.identity}"`);
    }
    for (const c of exCallers) {
      if (c !== subject) problems.push(`the expected result is stated for ${c} but the structured identity is "${t.identity}"`);
    }

    let executorCaller = "(none)";
    try {
      const c = derive(t);
      executorCaller = c.label;
      if (subject === "anon" && !(c.kind === "role" && c.role === "anon" && c.subject === null)) {
        problems.push(`identity is anon but the executor derives ${c.label}`);
      } else if (subject && subject !== "anon" && !(c.kind === "role" && c.role === "authenticated" && c.subject === subject)) {
        problems.push(`identity is ${t.identity} but the executor derives ${c.label}`);
      }
    } catch (err) {
      problems.push(`the executor cannot derive a caller: ${(err as Error).message}`);
    }

    out.push({ testId: t.testId, identity: t.identity, operationCallers: opCallers, expectedCallers: exCallers, executorCaller, problems });
  }
  return out;
}

/**
 * The caller a probe must actually run as for its approved expectation to be
 * reachable.
 *
 * Where the row is self-consistent this is just its identity. Where C1 applies
 * it is the caller the operation names — but the row stays blocked regardless,
 * so this never silently substitutes anything into a real run.
 */
export function effectiveActor(t: PlannedTest): string {
  const named = operationActor(t);
  if (!named) return t.identity;
  if (t.identity.toLowerCase().includes(named)) return t.identity;
  if (named === "anon") return "anon";
  return `authenticated:${named}`;
}

export function findContradictions(plan: Wp3Plan): PlanContradiction[] {
  const out: PlanContradiction[] = [];

  for (const t of plan.tests) {
    const named = operationCallers(t);
    if (!named.length) continue;
    const subject = identitySubject(t.identity);
    if (named.length === 1 && named[0] === subject) continue;
    out.push({
      id: "C1",
      testId: t.testId,
      approvedAssumption: `identity = "${t.identity}"`,
      evidence:
        `the same row's operation reads "${t.operation.slice(0, 90)}…" and names ${named.join(" and ")} as the caller, ` +
        `and its expected value ("${t.expected.slice(0, 80)}…") is stated for that caller.`,
      proposedResolution:
        `The identity must be the caller the operation names. For F5 rows the planner reads it from spec.attempt ` +
        `(callerNamedBy, D3.33), so this firing means that derivation has regressed or a row was edited by hand. ` +
        `If the identity is the intended caller instead, the operation and expected text are what must change — ` +
        `which is a change to an approved row and the author's decision.`,
    });
  }

  return out;
}

/** Group them for a report. */
export function summarizeContradictions(
  cs: readonly PlanContradiction[],
): { id: string; count: number; testIds: string[]; proposedResolution: string }[] {
  const by = new Map<string, PlanContradiction[]>();
  for (const c of cs) by.set(c.id, [...(by.get(c.id) ?? []), c]);
  return [...by.entries()].map(([id, list]) => ({
    id,
    count: list.length,
    testIds: list.map((c) => c.testId),
    proposedResolution: list[0]!.proposedResolution,
  }));
}
