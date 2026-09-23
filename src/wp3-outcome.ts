/**
 * Attest — which layer refused.
 *
 * "The statement raised" is not a result. A negative test that expects a
 * refusal is only answered by the refusal of the control it names, and three
 * different controls in Arc21 raise the same SQLSTATE: a missing grant, a
 * row-level-security WITH CHECK, and every write-guard trigger all raise
 * 42501. A syntax error in the harness's own probe raises 42601, which a
 * "no data" expectation used to accept (D3.30). So every outcome is classified
 * by the fields PostgreSQL's ErrorResponse carries — the message, the PL/pgSQL
 * `where` stack, the constraint — into the mechanism that produced it, and the
 * evaluator (`wp3-evaluate.ts`) asks whether THAT is the mechanism the approved
 * expectation names.
 *
 * The classification reads only what the database reported. It never infers a
 * mechanism from what the probe was expected to do.
 */
import type { Outcome } from "./evidence.ts";

export type MechanismKind =
  /** The statement ran without raising. */
  | "none"
  /** The harness itself threw: no SQLSTATE. Never a result. */
  | "harness"
  /** The PROBE is malformed: a parse or name-resolution error in Attest's own SQL. Never a result. */
  | "malformed"
  /**
   * A guard on the CLIENT CONNECTION refused the statement at parse analysis,
   * before any privilege or policy is consulted: pg_safeupdate, which the local
   * stack preloads for `authenticator` (the login every client request — and
   * every Attest role session — arrives through), refuses UPDATE and DELETE
   * without a WHERE clause (21000). Never the control an expectation names.
   */
  | "client_guard"
  /** A privilege check refused: "permission denied for table / column / schema / function / sequence". */
  | "privilege"
  /** A row-level-security WITH CHECK refused the new row. */
  | "rls_with_check"
  /** A PL/pgSQL RAISE inside a trigger function. */
  | "trigger_raise"
  /** A PL/pgSQL RAISE inside a called (non-trigger) function. */
  | "function_raise"
  /** An integrity constraint: CHECK, UNIQUE, NOT NULL, FOREIGN KEY, EXCLUSION. */
  | "constraint"
  /** TRUNCATE refused because another table references this one. */
  | "fk_truncate"
  /** Anything else PostgreSQL raised. */
  | "other";

export interface Mechanism {
  readonly kind: MechanismKind;
  /** For trigger_raise / function_raise: the innermost PL/pgSQL function that raised. */
  readonly fn?: string;
  /** Every PL/pgSQL function on the `where` stack, innermost first. */
  readonly stack?: readonly string[];
  readonly constraint?: string;
  readonly constraintType?: "check" | "unique" | "not_null" | "foreign_key" | "exclusion" | "other";
  readonly privilegeOn?: "table" | "column" | "schema" | "function" | "sequence" | "other";
  readonly sqlstate: string | null;
  readonly message: string | null;
  /** One line a reader can check against the raw error fields. */
  readonly detail: string;
}

/**
 * SQLSTATEs that mean Attest's OWN statement is malformed, when they are raised
 * outside any PL/pgSQL function. 42501 is deliberately absent — it is the real
 * refusal most of this suite expects. 22P02 is here because a malformed bound
 * value (the signature text "p_limit integer" passed as an integer, D3.39) is a
 * harness defect, not a refusal.
 */
export const MALFORMED_SQLSTATES: ReadonlySet<string> = new Set([
  "42601", // syntax_error
  "42703", // undefined_column
  "42P01", // undefined_table
  "42883", // undefined_function
  "42P02", // undefined_parameter
  "42P18", // indeterminate_datatype
  "42804", // datatype_mismatch
  "42725", // ambiguous_function
  "42P08", // ambiguous_parameter
  "42P10", // invalid_column_reference
  "42846", // cannot_coerce
  "22P02", // invalid_text_representation (a bound value of the wrong shape)
  "08P01", // protocol_violation
]);

const WHERE_FN = /PL\/pgSQL function ([a-z_][a-z0-9_.]*)\(/gi;
const SQL_FN = /SQL function "([a-z_][a-z0-9_]*)"/gi;

/** The PL/pgSQL / SQL functions named on the `where` stack, innermost first. */
export function whereStack(where: string | null | undefined): string[] {
  if (!where) return [];
  const out: string[] = [];
  for (const line of where.split("\n")) {
    for (const m of line.matchAll(WHERE_FN)) out.push(m[1]!.replace(/^public\./, ""));
    for (const m of line.matchAll(SQL_FN)) out.push(m[1]!);
  }
  return out;
}

/**
 * Classify an outcome.
 *
 * `triggerFunctions` is the set of trigger-function names read from the
 * catalog (`prorettype = 'trigger'`), so a RAISE inside `guard_loadout_slots`
 * is told apart from one inside the called function body.
 */
export function classify(o: Outcome, triggerFunctions: ReadonlySet<string>): Mechanism {
  if (o.harnessError) {
    return { kind: "harness", sqlstate: null, message: o.message, detail: `the harness threw: ${o.message ?? "(no message)"}` };
  }
  if (!o.raised) {
    return { kind: "none", sqlstate: null, message: null, detail: `no error; ${o.rowCount ?? 0} row(s)` };
  }
  const e = o.error;
  const code = o.sqlstate;
  const msg = e?.message ?? o.message ?? "";
  const stack = whereStack(e?.where);
  const base = { sqlstate: code, message: msg, stack };

  // A parse/resolution error raised by Attest's own statement: no PL/pgSQL
  // frame on the stack. The same SQLSTATE raised INSIDE an Arc21 function is
  // that function's error, not a malformed probe, and is classified below.
  if (code && MALFORMED_SQLSTATES.has(code) && stack.length === 0) {
    return { ...base, kind: "malformed", detail: `malformed probe: ${code} ${msg}` };
  }
  if (code === "21000" && /^(UPDATE|DELETE) requires a WHERE clause$/i.test(msg) && stack.length === 0) {
    return { ...base, kind: "client_guard", detail: `pg_safeupdate refused at parse analysis, before any privilege or policy check: ${msg}` };
  }
  if (/^permission denied for (table|relation|column|schema|function|sequence|view)\b/i.test(msg)) {
    const on = /^permission denied for (\w+)/i.exec(msg)![1]!.toLowerCase();
    return {
      ...base, kind: "privilege",
      privilegeOn: (on === "relation" || on === "view" ? "table" : (["table", "column", "schema", "function", "sequence"].includes(on) ? on : "other")) as Mechanism["privilegeOn"],
      detail: `privilege check: ${msg}`,
    };
  }
  if (/new row violates row-level security policy/i.test(msg)) {
    return { ...base, kind: "rls_with_check", detail: `row-level security WITH CHECK: ${msg}` };
  }
  if (code === "0A000" && /cannot truncate a table referenced in a foreign key constraint/i.test(msg)) {
    return { ...base, kind: "fk_truncate", detail: `TRUNCATE refused by a referencing foreign key: ${msg}${e?.detail ? ` (${e.detail})` : ""}` };
  }
  // Only the innermost frame decides: "PL/pgSQL function f() line N at RAISE"
  // on the first line of `where` means f's own RAISE statement raised.
  const innermost = (e?.where ?? "").split("\n")[0] ?? "";
  if (stack.length > 0 && /\bat RAISE\b/i.test(innermost)) {
    // The innermost frame is the one that raised.
    const fn = stack[0]!;
    const kind: MechanismKind = triggerFunctions.has(fn) ? "trigger_raise" : "function_raise";
    return { ...base, kind, fn, detail: `${kind === "trigger_raise" ? "trigger" : "function"} ${fn}() raised ${code}: ${msg}` };
  }
  if (code && code.startsWith("23")) {
    const ctype: Mechanism["constraintType"] =
      code === "23514" ? "check" : code === "23505" ? "unique" : code === "23502" ? "not_null"
      : code === "23503" ? "foreign_key" : code === "23P01" ? "exclusion" : "other";
    return {
      ...base, kind: "constraint", constraint: e?.constraint ?? undefined, constraintType: ctype,
      fn: stack[0],
      detail: `${ctype} constraint${e?.constraint ? ` ${e.constraint}` : ""}${stack.length ? ` inside ${stack[0]}()` : ""}: ${msg}`,
    };
  }
  if (stack.length > 0) {
    // Raised inside a function but not by a RAISE statement (e.g. a runtime
    // error in the body). Attributed to the innermost function.
    return { ...base, kind: "other", fn: stack[0], detail: `${code} inside ${stack[0]}(): ${msg}` };
  }
  return { ...base, kind: "other", detail: `${code}: ${msg}` };
}
