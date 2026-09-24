/**
 * Attest — judging a probe, claim by claim.
 *
 * Every span of an approved expectation (wp3-claims.ts) names an evaluator.
 * Each evaluator returns one of:
 *
 *   met           the control was exercised and the observation is what the claim says
 *   unmet         the control was exercised and the observation contradicts the claim
 *   unmeasurable  the claim could not be judged, and why:
 *                   harness       the harness threw, or its own statement was malformed
 *                   precondition  a premise, fixture or catalog fact the claim rests on did not hold
 *                   not_reached   a DIFFERENT mechanism stopped the statement before the control
 *                                 the claim names could act — an earlier privilege check, a
 *                                 business prerequisite inside a function, an unrelated constraint
 *
 * The principle (D3.42): a claim is UNMET only when the control under test was
 * exercised and the observation contradicts it. A refusal by some other layer
 * is never "the control held" — 42501 satisfies an expectation only when it
 * came from the mechanism that expectation names — and it is never "the
 * control failed" either. It is not measured.
 *
 * Observation and verdict stay separate (D3.6 #4):
 *
 *   harness_error         → not_measured
 *   blocked_contradiction → not_measured   (a registered approved-row contradiction)
 *   precondition_failed   → not_measured
 *   control_not_reached   → not_measured
 *   not_as_predicted      → deficient, or characterized for a characterization row
 *   as_predicted          → the plan's verdictWhenPredicted (effective / characterized / gap)
 */
import type { Outcome } from "./evidence.ts";
import type { Mechanism } from "./wp3-outcome.ts";
import type { PlannedTest } from "./wp3-plan.ts";
import type { ExecSpec } from "./wp3-exec.ts";
import type { Binding } from "./wp3-bindings.ts";
import { ERIN } from "./wp3-bindings.ts";
import type { Span } from "./wp3-claims.ts";
import { FIXTURES } from "../rubric/fixtures.ts";
import { AUX } from "./seed-extensions.ts";

export type ClaimStatus = "met" | "unmet" | "unmeasurable";
export type UnmeasurableClass = "harness" | "precondition" | "not_reached";

export interface ClaimResult {
  readonly text: string;
  readonly kind: Span["kind"];
  readonly evaluator: string;
  readonly status: ClaimStatus;
  readonly cls?: UnmeasurableClass;
  readonly detail: string;
}

export type Wp3Observation =
  | "as_predicted" | "not_as_predicted" | "harness_error"
  | "precondition_failed" | "control_not_reached" | "blocked_contradiction";
export type Wp3Verdict = "effective" | "deficient" | "characterized" | "gap" | "not_measured";

export interface CheckResult { readonly id: string; readonly describe: string; readonly ok: boolean; readonly detail: string }

/** Everything observed about one probe, gathered by the executor. */
export interface Observed {
  readonly outcome: Outcome;
  readonly mechanism: Mechanism;
  readonly premises: readonly CheckResult[];
  readonly catalog: Readonly<Record<string, CheckResult>>;
  readonly guards: Readonly<Record<string, CheckResult>>;
  readonly results: Readonly<Record<string, CheckResult>>;
  readonly reference?: { readonly outcome: Outcome; readonly mechanism: Mechanism } | null;
  readonly reachability?: CheckResult | null;
  /** A runner's own claims. `cls` marks one the runner could not measure (a window that never went live, a reference that failed). */
  readonly runnerClaims?: Readonly<Record<string, { ok: boolean; detail: string; cls?: "precondition" | "harness" }>>;
  /** For anon-reach: anon's SELECT privilege on the relation and the relation's row count. */
  readonly anonGrant?: { readonly holdsSelect: boolean; readonly rows: number } | null;
  /** For column-privilege claims: whether the caller role holds the privilege on the probed column. */
  readonly columnPrivilege?: { readonly column: string; readonly held: boolean } | null;
  /** For result:columns_of:<view>: that view's columns, read from the catalog. */
  readonly viewColumns?: readonly string[];
  /** The identity the session read back. */
  readonly sessionAuthUid?: string | null;
  /**
   * The registered approved-row contradiction(s) on this Test ID. When the
   * outcome carries a SQLSTATE the registration predicts, that outcome IS the
   * contradiction (an invalid approved literal, a client guard before the
   * grant) — its disposition, not a harness defect.
   */
  readonly contradiction?: { readonly id: string; readonly reason: string; readonly predictedSqlstates?: readonly string[] } | null;
}

const met = (detail: string) => ({ status: "met" as const, detail });
const unmet = (detail: string) => ({ status: "unmet" as const, detail });
const harness = (detail: string) => ({ status: "unmeasurable" as const, cls: "harness" as const, detail });
const precondition = (detail: string) => ({ status: "unmeasurable" as const, cls: "precondition" as const, detail });
const notReached = (detail: string) => ({ status: "unmeasurable" as const, cls: "not_reached" as const, detail });

type Partial = { status: ClaimStatus; cls?: UnmeasurableClass; detail: string };
type Ctx = { t: PlannedTest; spec: ExecSpec; b: Binding; ob: Observed; span: Span };

/**
 * Outcomes that answer nothing about ANY control. Checked first by every
 * outcome evaluator: a harness throw and a malformed probe are the harness's
 * fault; a client-connection guard (pg_safeupdate) refused before every
 * control, so whatever the claim names was not reached.
 */
function brokenProbe(ob: Observed): Partial | null {
  if (ob.mechanism.kind === "harness") return harness(ob.mechanism.detail);
  if (ob.mechanism.kind === "malformed") return harness(ob.mechanism.detail);
  if (ob.mechanism.kind === "client_guard") return notReached(ob.mechanism.detail);
  return null;
}

const rows = (o: Outcome) => o.rows ?? [];
const blob = (o: Outcome) => JSON.stringify(rows(o));
const firstScalar = (o: Outcome): unknown => {
  const r = rows(o)[0];
  if (!r) return undefined;
  const v = Object.values(r);
  return v.length === 1 ? v[0] : undefined;
};
const quoted = (s: string) => /'([^']+)'/.exec(s)?.[1] ?? null;

/** A raise that was not the harness's: the mechanism's own words. */
const raisedBy = (ob: Observed) => `${ob.mechanism.detail}`;

type Evaluator = (c: Ctx) => Partial;

const readRows = (want: (n: number) => boolean, label: string): Evaluator => ({ ob, t }) => {
  const bp = brokenProbe(ob); if (bp) return bp;
  const o = ob.outcome;
  if (o.raised) {
    if (ob.mechanism.kind === "privilege") return notReached(`a privilege check refused before any row policy was consulted: ${raisedBy(ob)}`);
    if (t.polarity === "positive" && ob.mechanism.kind === "constraint") return precondition(`an unrelated constraint failed: ${raisedBy(ob)}`);
    return unmet(`raised instead of returning rows: ${raisedBy(ob)}`);
  }
  const n = rows(o).length;
  return want(n) ? met(`${n} row(s) returned (${label})`) : unmet(`${n} row(s) returned; ${label} required`);
};

const affected = (want: number): Evaluator => ({ ob, t }) => {
  const bp = brokenProbe(ob); if (bp) return bp;
  const o = ob.outcome;
  if (!o.raised) {
    const n = o.rowCount ?? 0;
    return n === want ? met(`${n} row(s) affected`) : unmet(`${n} row(s) affected; ${want} required`);
  }
  const k = ob.mechanism.kind;
  if (k === "privilege") return notReached(`a privilege check refused before the policy was consulted: ${raisedBy(ob)}`);
  if (want > 0) {
    // A positive that did not complete. The policy under test was either never
    // consulted (a BEFORE trigger, an unrelated constraint) or refused the
    // caller's own row (WITH CHECK) — only the last is the control failing.
    if (k === "rls_with_check") return unmet(`row-level security refused the caller's own write: ${raisedBy(ob)}`);
    if (k === "constraint") return precondition(`an unrelated constraint stopped the positive before it could show the policy admits the write: ${raisedBy(ob)}`);
    return notReached(`another mechanism refused the write before the policy under test could admit it: ${raisedBy(ob)}`);
  }
  // A negative expecting the policy to filter the row out. A row-level trigger
  // or a constraint only fires for a row that PASSED the USING filter.
  return unmet(`the row reached ${k === "trigger_raise" ? "a row-level trigger" : "row processing"} — the policy did not filter it out: ${raisedBy(ob)}`);
};

const EVALUATORS: Readonly<Record<string, Evaluator>> = {
  "rows_returned>=1": readRows((n) => n >= 1, "at least 1"),
  "rows_returned=0": readRows((n) => n === 0, "exactly 0"),
  "returns_rows=0": readRows((n) => n === 0, "exactly 0"),
  "returns_rows=1": readRows((n) => n === 1, "exactly 1"),
  "rows_affected=0": affected(0),
  "rows_affected=1": affected(1),

  // Gate A, D-283 (D3.54): the call ran to completion. A refusal by a business
  // prerequisite (the active-seat rule) or a privilege is "not reached" — the
  // behaviour the row examines never ran — never a pass and never a finding.
  completes: ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return met("the call returned without error");
    const k = ob.mechanism.kind;
    if (k === "function_raise" || k === "privilege" || k === "trigger_raise") return notReached(`the call was refused before its behaviour ran: ${raisedBy(ob)}`);
    return unmet(`raised: ${raisedBy(ob)}`);
  },
  no_raise: ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    return ob.outcome.raised ? unmet(`raised: ${raisedBy(ob)}`) : met("no error");
  },
  error_any: ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    return ob.outcome.raised ? met(raisedBy(ob)) : unmet(`no error; ${ob.outcome.rowCount ?? 0} row(s)`);
  },
  message: ({ ob, span }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    const want = quoted(span.text);
    if (!ob.outcome.raised) return unmet("no error, so no message");
    const got = ob.outcome.error?.message ?? ob.outcome.message;
    return got === want ? met(`message '${got}'`) : unmet(`message '${got}', '${want}' required`);
  },

  "mech:privilege": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return unmet("no error: the privilege the claim says is absent was exercised");
    if (ob.mechanism.kind === "privilege") return met(raisedBy(ob));
    return unmet(`refused by a later layer, so the privilege check itself passed: ${raisedBy(ob)}`);
  },
  "mech:column_privilege:UPDATE": columnPrivilege("UPDATE"),
  "mech:column_privilege:SELECT": columnPrivilege("SELECT"),
  "mech:rls_filter": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return met("no error: the rows were filtered, not refused");
    if (ob.mechanism.kind === "privilege") return notReached(`a privilege check refused before the row policy was consulted: ${raisedBy(ob)}`);
    return unmet(`raised rather than filtering: ${raisedBy(ob)}`);
  },
  "mech:rls_with_check": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    const k = ob.mechanism.kind;
    if (!ob.outcome.raised) return unmet(`no error: the row was admitted (${ob.outcome.rowCount ?? 0} affected)`);
    if (k === "rls_with_check") return met(raisedBy(ob));
    if (k === "privilege") return notReached(`a privilege check refused before WITH CHECK was evaluated: ${raisedBy(ob)}`);
    if (k === "trigger_raise") return notReached(`a BEFORE trigger refused before WITH CHECK was evaluated: ${raisedBy(ob)}`);
    if (k === "constraint") return unmet(`an integrity constraint fired, which PostgreSQL checks only AFTER a row passes WITH CHECK: ${raisedBy(ob)}`);
    return unmet(`refused by something other than WITH CHECK: ${raisedBy(ob)}`);
  },
  "mech:function_body": ({ ob, spec }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return unmet("no error: the body did not raise");
    if (ob.mechanism.kind === "function_raise" && ob.mechanism.fn === spec.calledFunction) return met(raisedBy(ob));
    if (ob.mechanism.kind === "privilege") return notReached(`EXECUTE was refused before the body ran: ${raisedBy(ob)}`);
    return unmet(`raised, but not by ${spec.calledFunction}'s own body: ${raisedBy(ob)}`);
  },
  "mech:constraint:check": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return unmet("no error");
    return ob.mechanism.kind === "constraint" && ob.mechanism.constraintType === "check"
      ? met(raisedBy(ob)) : unmet(`not a CHECK constraint: ${raisedBy(ob)}`);
  },
  "mech:anon_grant_consistent": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    const g = ob.anonGrant;
    if (!g) return harness("anon's privilege on the relation was not read");
    if (ob.outcome.raised) {
      if (ob.mechanism.kind !== "privilege" || ob.outcome.sqlstate !== "42501") return unmet(`raised, but not a 42501 privilege refusal: ${raisedBy(ob)}`);
      return g.holdsSelect
        ? unmet(`a 42501 privilege refusal although anon holds SELECT — the refusal is not the absent grant the claim names`)
        : met(`42501 privilege refusal, and anon holds no SELECT on the relation: ${raisedBy(ob)}`);
    }
    if (!g.holdsSelect) return unmet("no error although anon holds no SELECT — the statement should have been refused at the grant");
    if (g.rows === 0) return precondition("anon holds a grant and the relation is empty, so 'no data' would be true of nothing");
    return met(`anon holds SELECT; the policy set returned no rows from a relation holding ${g.rows}`);
  },
  no_data_or_privilege: ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return rows(ob.outcome).length === 0 ? met("0 rows") : unmet(`${rows(ob.outcome).length} row(s) reached an anonymous caller`);
    return ob.mechanism.kind === "privilege" ? met(raisedBy(ob)) : unmet(`raised, but not a privilege refusal: ${raisedBy(ob)}`);
  },

  "returns:false": returnsValue(false),
  "returns:0": returnsValue(0),

  refusal: (c) => refusal(c),
  refusal_or_no_effect: (c) => {
    const r = refusal(c);
    // A raise is judged as a refusal: the named site (met), another site
    // (not reached), or the harness. Only a call that RETURNED goes on to be
    // judged from state — never from its return value (R4).
    if (c.ob.outcome.raised || r.status === "met") return r;
    const g = c.ob.guards.no_effect;
    if (!g) return harness("no 'no effect' guard was evaluated");
    return g.ok ? met(`the call returned without refusing and changed nothing: ${g.detail}`) : unmet(`the call changed state: ${g.detail}`);
  },
  refusal_or_non_displacing: (c) => {
    const r = refusal(c);
    if (r.status === "met" || c.ob.outcome.raised) return r;
    const kept = c.ob.guards.guard, own = c.ob.guards.caller_row;
    if (!kept || !own) return harness("the displacement guards were not evaluated");
    if (kept.ok && own.ok) return met(`not refused; a row for the caller exists (${own.detail}) and bob's is intact (${kept.detail})`);
    return unmet(`not refused, and the caller's registration ${own.ok ? "exists" : "does not exist"}; bob's row: ${kept.detail}`);
  },

  "reference:identical": ({ ob }) => {
    const r = ob.reference;
    if (!r) return harness("the reference observation was not made");
    if (r.mechanism.kind === "harness" || r.mechanism.kind === "malformed") return harness(`the reference call failed: ${r.mechanism.detail}`);
    const bp = brokenProbe(ob); if (bp) return bp;
    const shape = (o: Outcome) => JSON.stringify({ raised: o.raised, sqlstate: o.sqlstate, message: o.error?.message ?? null, rows: o.rows ?? [] });
    const a = shape(ob.outcome), b = shape(r.outcome);
    return a === b ? met(`the two responses are identical: ${a.slice(0, 160)}`) : unmet(`the responses differ: probe ${a.slice(0, 120)} vs reference ${b.slice(0, 120)}`);
  },

  "result:excludes_bob_carol": result("excludes_bob_carol"),
  "result:only_own": (c) => {
    const bp = brokenProbe(c.ob); if (bp) return bp;
    if (c.ob.outcome.raised) {
      return c.ob.mechanism.kind === "function_raise" || c.ob.mechanism.kind === "privilege" || c.ob.mechanism.kind === "trigger_raise"
        ? notReached(`the definer behaviour was not reached; the call was refused: ${raisedBy(c.ob)}`)
        : unmet(`raised: ${raisedBy(c.ob)}`);
    }
    return result("only_own")(c);
  },
  "result:own_queue_entry": result("own_queue_entry"),
  "result:non_friend_projection": result("non_friend_projection"),
  "result:excludes_dave": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
    const hit = [FIXTURES.dave.value, "dave_d", "\"Dave\""].filter((n) => blob(ob.outcome).includes(n));
    return hit.length ? unmet(`dave appears: ${hit.join(", ")}`) : met(`${rows(ob.outcome).length} row(s), dave absent`);
  },
  "result:includes_dave_display_name": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
    const has = rows(ob.outcome).some((r) => r.display_name === "Dave");
    return has ? met("a row carries display_name 'Dave'") : unmet(`no row carries dave's display_name among ${rows(ob.outcome).length}`);
  },
  "result:no_private_identity": ({ ob }) => privateIdentity(ob),
  "result:leaderboard_columns_only": ({ ob }) => leaderboardColumns(ob),
  "result:public_safe": ({ ob }) => {
    const a = privateIdentity(ob), b = leaderboardColumns(ob);
    if (a.status !== "met") return a;
    if (b.status !== "met") return b;
    return met(`${a.detail}; ${b.detail}`);
  },
  "result:excludes_seed_secret": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
    const cols = ob.outcome.columns ?? [];
    const secrets = [AUX.dailySecretOpen, AUX.dailySecretRevealed].filter((s) => blob(ob.outcome).includes(s));
    // A REVEALED seed is published by design; only the column and an
    // unrevealed secret's value count as exposure.
    const unrevealed = secrets.filter((s) => s === AUX.dailySecretOpen);
    if (cols.includes("seed_secret")) return unmet("a seed_secret column is present");
    if (unrevealed.length) return unmet("the still-open challenge's secret value appears in the result");
    return met(`columns: ${cols.join(", ") || "(none)"}; no seed_secret column and no unrevealed secret value`);
  },
  "result:columns_of:daily_challenges_public": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
    const got = (ob.outcome.columns ?? []).join(",");
    const want = (ob.viewColumns ?? []).join(",");
    if (!want) return harness("the view's columns were not read");
    return got === want ? met(`columns are exactly daily_challenges_public's: ${got}`) : unmet(`columns ${got}; daily_challenges_public has ${want}`);
  },
  "result:exactly_revealed": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return notReached(`the call was refused, so nothing was returned to judge: ${raisedBy(ob)}`);
    const r = rows(ob.outcome);
    return r.length === 1 && r[0]!.revealed_seed === AUX.dailySecretRevealed
      ? met("exactly one row: the revealed challenge") : unmet(`${r.length} row(s); the one revealed challenge required`);
  },
  "result:excludes_unrevealed": ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return notReached(`the call was refused: ${raisedBy(ob)}`);
    return blob(ob.outcome).includes(AUX.dailySecretOpen) ? unmet("the unrevealed challenge's secret appears") : met("the unrevealed challenge does not appear");
  },
  "result:trail_columns_present": ({ ob, b }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
    const cols = b.trailColumns ?? [];
    const r = rows(ob.outcome);
    if (!r.length) return unmet("no rows returned");
    const missing = r.filter((row) => cols.some((c) => row[c] === null || row[c] === undefined)).length;
    return missing === 0 ? met(`all ${r.length} row(s) carry ${cols.join(", ")}`) : unmet(`${missing} row(s) lack one of ${cols.join(", ")}`);
  },
};

// ---- parameterized families ---------------------------------------------------

function columnPrivilege(priv: "UPDATE" | "SELECT"): Evaluator {
  return ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (!ob.outcome.raised) return unmet(`no error: the ${priv} the claim says is absent was exercised`);
    if (ob.mechanism.kind !== "privilege") return unmet(`refused by a later layer, so the privilege check passed: ${raisedBy(ob)}`);
    const cp = ob.columnPrivilege;
    if (!cp) return harness("the column's privilege was not read");
    return cp.held
      ? unmet(`a privilege refusal, but the caller DOES hold ${priv} on ${cp.column} — the refusal came from elsewhere`)
      : met(`${raisedBy(ob)}; authenticated holds no ${priv} on ${cp.column}`);
  };
}

function returnsValue(want: unknown): Evaluator {
  return ({ ob }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) {
      if (ob.mechanism.kind === "privilege") return notReached(`EXECUTE refused: ${raisedBy(ob)}`);
      return unmet(`raised: ${raisedBy(ob)}`);
    }
    const v = firstScalar(ob.outcome);
    const eq = v === want || (typeof want === "number" && String(v) === String(want));
    return eq ? met(`returned ${JSON.stringify(v)}`) : unmet(`returned ${JSON.stringify(v)}; ${JSON.stringify(want)} required`);
  };
}

function refusal({ ob, b }: Ctx): Partial {
  const bp = brokenProbe(ob); if (bp) return bp;
  if (b.refusalByReturn) {
    if (ob.outcome.raised) {
      return ob.mechanism.kind === "function_raise" || ob.mechanism.kind === "privilege"
        ? notReached(`refused by a prerequisite rather than by the function's documented refusal: ${raisedBy(ob)}`)
        : unmet(`raised: ${raisedBy(ob)}`);
    }
    const r = b.refusalByReturn(ob.outcome);
    return r.ok ? met(r.detail) : unmet(r.detail);
  }
  if (!ob.outcome.raised) return unmet(`no refusal: the call returned ${rows(ob.outcome).length} row(s)`);
  const sites = b.refusalSites ?? [];
  const m = ob.mechanism;
  const hit = sites.find((s) => m.fn === s.fn && ob.outcome.sqlstate === s.sqlstate && s.message.test(ob.outcome.error?.message ?? ""));
  if (hit) return met(`${hit.describe}: ${raisedBy(ob)}`);
  if (m.kind === "privilege") return notReached(`EXECUTE (or an earlier privilege) refused before the function body ran: ${raisedBy(ob)}`);
  if (m.kind === "function_raise" || m.kind === "trigger_raise" || m.kind === "constraint" || m.kind === "other") {
    return notReached(
      `refused, but not at the site this row examines (${sites.map((s) => s.describe).join("; ") || "none declared"}): ${raisedBy(ob)}`,
    );
  }
  return unmet(`raised by an unexpected mechanism: ${raisedBy(ob)}`);
}

function result(name: string): Evaluator {
  return ({ ob, b }) => {
    const bp = brokenProbe(ob); if (bp) return bp;
    if (ob.outcome.raised) {
      // A claim about what the call returned or changed cannot be judged when
      // a prerequisite refused the call before its behaviour ran (D3.42).
      const k = ob.mechanism.kind;
      if (k === "function_raise" || k === "privilege" || k === "trigger_raise") return notReached(`the call was refused before the behaviour this claim describes ran: ${raisedBy(ob)}`);
      return unmet(`raised: ${raisedBy(ob)}`);
    }
    const r = ob.results[name];
    if (!r) return harness(`result check '${name}' was not evaluated`);
    void b;
    return r.ok ? met(r.detail) : unmet(r.detail);
  };
}

function privateIdentity(ob: Observed): Partial {
  const bp = brokenProbe(ob); if (bp) return bp;
  if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
  const n = rows(ob.outcome).length;
  if (n === 0) return precondition("the board returned no rows, so 'no private-privacy identity' would be true of nothing");
  const hit = [ERIN.id, "erin_e", `"${ERIN.displayName}"`].filter((x) => blob(ob.outcome).includes(x));
  return hit.length
    ? unmet(`a private-privacy account's identity appears (erin): ${hit.join(", ")}`)
    : met(`${n} row(s); no private-privacy account's identity appears`);
}

/** Columns a leaderboard row may carry: the declared leaderboard_row shape, and nothing identifying or secret. */
const LEADERBOARD_ROW = ["rank", "display_name", "avatar_asset_key", "value", "detail", "is_you"];
const IDENTIFYING = /(^|_)(id|user_id|email|phone|token|secret|password|seed)($|_)/;
function leaderboardColumns(ob: Observed): Partial {
  const bp = brokenProbe(ob); if (bp) return bp;
  if (ob.outcome.raised) return unmet(`raised: ${raisedBy(ob)}`);
  const cols = ob.outcome.columns ?? [];
  const extra = cols.filter((c) => !LEADERBOARD_ROW.includes(c));
  const identifying = cols.filter((c) => IDENTIFYING.test(c));
  if (extra.length || identifying.length) return unmet(`columns beyond the leaderboard row: ${[...new Set([...extra, ...identifying])].join(", ")}`);
  return met(`columns ${cols.join(", ")}: the leaderboard row, no identifier or secret`);
}

/** Resolve the evaluator for a span, including the table-driven prefixes. */
export function evaluatorFor(name: string): Evaluator | null {
  if (EVALUATORS[name]) return EVALUATORS[name]!;
  const m = /^(catalog|catalog_read|premise|state|runner|mech|error_sqlstate):(.+)$/.exec(name);
  if (!m) return null;
  const [, kind, key] = m;
  switch (kind) {
    case "error_sqlstate":
      return ({ ob }) => {
        const bp = brokenProbe(ob); if (bp) return bp;
        if (!ob.outcome.raised) return unmet(`no error; ${ob.outcome.rowCount ?? 0} row(s)`);
        return ob.outcome.sqlstate === key ? met(`SQLSTATE ${key}`) : unmet(`SQLSTATE ${ob.outcome.sqlstate}, ${key} required: ${raisedBy(ob)}`);
      };
    case "catalog":
      return ({ ob }) => {
        const r = ob.catalog[key!];
        if (!r) return harness(`catalog fact '${key}' was not read`);
        return r.ok ? met(r.detail) : precondition(`the approved text states a catalog fact that does not hold: ${r.detail}`);
      };
    case "catalog_read":
      return ({ ob, span }) => {
        const bp = brokenProbe(ob); if (bp) return bp;
        if (ob.outcome.raised) return harness(`the catalog read raised: ${raisedBy(ob)}`);
        const r = rows(ob.outcome)[0] ?? {};
        if (key === "owner") {
          const want = /owner = ([a-z_]+)/.exec(span.text)?.[1];
          return r.owner === want ? met(`owner = ${String(r.owner)}`) : unmet(`owner = ${String(r.owner)}, ${want} predicted`);
        }
        return r[key!] === true ? met(`${key} = true (${String(r.detail ?? "")})`) : unmet(`${key} = ${String(r[key!])} (${String(r.detail ?? "")})`);
      };
    case "premise":
      return ({ ob }) => {
        const ps = ob.premises.filter((p) => p.id === key);
        if (!ps.length) return harness(`premise '${key}' was not checked`);
        const bad = ps.filter((p) => !p.ok);
        return bad.length ? precondition(bad.map((p) => `${p.describe}: ${p.detail}`).join("; ")) : met(ps.map((p) => p.detail).join("; "));
      };
    case "state":
      return ({ ob, b }) => {
        if (key === "stale_expiry_permitted") {
          const g = b.guards.guard2;
          return g?.permitsStaleExpiry ? met("the queue guard counts a stale entry turning 'expired' as unchanged, as the claim permits") : harness("no guard declares the stale-expiry permission");
        }
        const g = ob.guards[key!];
        if (!g) return harness(`state guard '${key}' was not evaluated`);
        return g.ok ? met(g.detail) : unmet(g.detail);
      };
    case "runner":
      return ({ ob }) => {
        const bp = brokenProbe(ob); if (bp) return bp;
        const r = ob.runnerClaims?.[key!];
        if (!r) return harness(`the runner did not report '${key}'`);
        if (!r.ok && r.cls === "precondition") return precondition(r.detail);
        if (!r.ok && r.cls === "harness") return harness(r.detail);
        return r.ok ? met(r.detail) : unmet(r.detail);
      };
    case "mech":
      if (key!.startsWith("trigger:")) {
        return ({ ob, b, spec }) => {
          const bp = brokenProbe(ob); if (bp) return bp;
          const want = b.namedTrigger;
          if (!want) return harness("the named trigger was not resolved");
          if (!ob.outcome.raised) {
            // A row-level trigger acts on the rows the statement touches; with
            // none touched it had nothing to refuse — not reached, not "failed".
            if ((ob.outcome.rowCount ?? 0) === 0 && /^\s*(update|delete)\b/i.test(spec.statement)) {
              return notReached(`the statement touched no row, so the row-level trigger ${want.trigger} had nothing to act on`);
            }
            return unmet("no error: the trigger did not refuse");
          }
          const k = ob.mechanism.kind;
          if (k === "trigger_raise" && ob.mechanism.fn === want.fn) return met(`${want.trigger} (${want.fn}) raised: ${raisedBy(ob)}`);
          if (k === "privilege" || k === "fk_truncate") return notReached(`refused before ${want.trigger} could fire: ${raisedBy(ob)}`);
          if (k === "trigger_raise") return notReached(`a different trigger refused first: ${raisedBy(ob)}`);
          if (k === "function_raise") return notReached(`the function body refused before the row reached ${want.trigger}: ${raisedBy(ob)}`);
          return unmet(`not refused by ${want.trigger}: ${raisedBy(ob)}`);
        };
      }
      if (key!.startsWith("policy:")) {
        return ({ ob, t }) => {
          const bp = brokenProbe(ob); if (bp) return bp;
          if (!ob.outcome.raised) return unmet("no error: nothing refused");
          if (ob.mechanism.kind === "rls_with_check") return met(raisedBy(ob));
          return notReached(`the named policy was not what refused — inside a SECURITY DEFINER function the caller's policies are not consulted (${t.resource}): ${raisedBy(ob)}`);
        };
      }
      return null;
  }
  return null;
}

export function evaluatorExists(name: string): boolean {
  return evaluatorFor(name) !== null;
}

export interface Judgement {
  readonly claims: readonly ClaimResult[];
  readonly observation: Wp3Observation;
  readonly verdict: Wp3Verdict;
  readonly verdictReason: string;
}

/** Judge every span, then combine. */
export function judgeProbe(t: PlannedTest, spec: ExecSpec, b: Binding, spans: readonly Span[], ob: Observed): Judgement {
  const claims: ClaimResult[] = [];
  for (const span of spans) {
    if (span.kind === "rationale" || span.kind === "connective") continue;
    const ev = span.eval ? evaluatorFor(span.eval) : null;
    const r: Partial = ev ? ev({ t, spec, b, ob, span }) : harness(`no evaluator for ${span.eval}`);
    claims.push({ text: span.text, kind: span.kind, evaluator: span.eval ?? "(none)", ...r });
  }
  // Whatever the claims are, the probe must have EXECUTED and been answered by
  // the database. A state claim alone ("no effect on the alice→bob request")
  // is trivially true of a probe that never ran — prove-gates found six rows
  // that would have read a harness exception as "effective".
  const broken = brokenProbe(ob);
  if (broken) {
    claims.unshift({ text: "(the probe executed, and the database — not the harness — answered it)", kind: "premise", evaluator: "executed", ...broken });
  }
  // Caller-scoped F5: the definer behaviour must actually have run (D3.41).
  if (ob.reachability) {
    claims.push({
      text: "(the SECURITY DEFINER behaviour this row examines actually ran)", kind: "premise", evaluator: "reachability",
      ...(ob.reachability.ok ? met(ob.reachability.detail) : notReached(`${ob.reachability.describe}: ${ob.reachability.detail}`)),
    });
  }
  const badPremises = ob.premises.filter((p) => !p.ok);

  const worst = (cls: UnmeasurableClass) => claims.filter((c) => c.status === "unmeasurable" && c.cls === cls);
  const reasons = (cs: readonly ClaimResult[]) => cs.map((c) => `"${c.text}": ${c.detail}`).join(" | ");

  const c = ob.contradiction;
  if (c && !ob.outcome.harnessError && ob.outcome.sqlstate && (c.predictedSqlstates ?? []).includes(ob.outcome.sqlstate)) {
    return {
      claims, observation: "blocked_contradiction", verdict: "not_measured",
      verdictReason: `registered contradiction ${c.id}: the approved statement produced exactly the refusal the registration predicts (${ob.outcome.sqlstate} ${ob.outcome.error?.message ?? ob.outcome.message ?? ""}) — ${c.reason}`,
    };
  }
  if (worst("harness").length) {
    return { claims, observation: "harness_error", verdict: "not_measured", verdictReason: `the harness, not the database, answered: ${reasons(worst("harness"))}` };
  }
  if (ob.contradiction) {
    return { claims, observation: "blocked_contradiction", verdict: "not_measured", verdictReason: `registered contradiction ${ob.contradiction.id}: ${ob.contradiction.reason}` };
  }
  if (badPremises.length || worst("precondition").length) {
    return {
      claims, observation: "precondition_failed", verdict: "not_measured",
      verdictReason: `a premise did not hold, so the probe could not measure its claim: ${[...badPremises.map((p) => `${p.describe}: ${p.detail}`), reasons(worst("precondition"))].filter(Boolean).join(" | ")}`,
    };
  }
  if (worst("not_reached").length) {
    return { claims, observation: "control_not_reached", verdict: "not_measured", verdictReason: `the control this row names was not reached: ${reasons(worst("not_reached"))}` };
  }
  const bad = claims.filter((c) => c.status === "unmet");
  if (bad.length) {
    return {
      claims, observation: "not_as_predicted",
      verdict: t.polarity === "characterization" ? "characterized" : "deficient",
      verdictReason: t.polarity === "characterization"
        ? `the recorded fact differs from the plan's prediction: ${reasons(bad)}`
        : `the control was exercised and did not hold: ${reasons(bad)}`,
    };
  }
  return {
    claims, observation: "as_predicted", verdict: t.verdictWhenPredicted,
    verdictReason: t.verdictWhenPredicted === "effective" ? "every claim met"
      : t.verdictWhenPredicted === "characterized" ? "a fact was recorded; no control was asserted either way"
      : "the control does not exist to be exercised — this is an absence, not a pass",
  };
}
