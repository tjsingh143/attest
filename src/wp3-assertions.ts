/**
 * Attest — assertions for the expectations that are not "N rows" or "SQLSTATE".
 *
 * Most of the matrix predicts something mechanical: zero rows, one row, 42501.
 * Roughly fifty rows predict something a row count cannot express — "only
 * alice's own rows are returned or altered", "a public-safe projection only",
 * "returns FALSE", "dave must not appear in the results". Those are the plan's
 * own words and they are the assertion; this module turns each into a check.
 *
 * Two rules govern what is here:
 *
 *   The assertion comes from the plan, not from a fresh judgment. Every branch
 *   below keys on text the approved row already carries.
 *
 *   An unrecognised expectation is a FAILURE, not a pass. A custom expectation
 *   the harness cannot check would otherwise be a silent green — the probe
 *   ran, nothing was asserted, and the report would count it as effective.
 */
import type { Outcome } from "./evidence.ts";
import type { PlannedTest } from "./wp3-plan.ts";
import { FIXTURES } from "../rubric/fixtures.ts";

const BOB = FIXTURES.bob.value;
const CAROL = FIXTURES.carol.value;
const DAVE = FIXTURES.dave.value;

export interface AssertionResult {
  readonly satisfied: boolean;
  /** What was checked, in a form a reader can audit. */
  readonly detail: string;
  /**
   * Set only by the fallback: no branch recognised the expectation, so nothing
   * was asserted. Lets preflight find those rows BEFORE a run, where they would
   * otherwise each be recorded as `deficient` against a control nobody tested
   * (D3.36).
   */
  readonly unimplemented?: true;
}

/**
 * Is there an assertion for this row's custom expectation at all?
 *
 * Asked with an outcome that no runner-computed probe produces (two sample
 * rows), so the answer comes from the expectation-text branches below and not
 * from the `{ ok }` shortcut.
 */
export function assertionImplementedFor(t: PlannedTest): boolean {
  const probe: Outcome = {
    executed: true, raised: false, rowCount: 2, sqlstate: null, message: null,
    harnessError: false, sample: [{ probe: 1 }, { probe: 2 }],
  };
  return assertCustom(t, probe).unimplemented !== true;
}

/** Does any returned row mention a uuid belonging to someone else? */
function mentions(o: Outcome, uuids: readonly string[]): string[] {
  const blob = JSON.stringify(o.sample);
  return uuids.filter((u) => blob.includes(u));
}

function firstScalar(o: Outcome): unknown {
  const row = o.sample[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const vals = Object.values(row);
  return vals.length === 1 ? vals[0] : undefined;
}

/**
 * Check a `custom` expectation.
 *
 * Runners that compute their own result encode it as a single `{ ok }` sample
 * row; that takes precedence, because those probes (concurrency, the websocket,
 * the HTTP boundary) are the ones whose assertion cannot be expressed as a row
 * count at all.
 */
export function assertCustom(t: PlannedTest, o: Outcome): AssertionResult {
  if (o.harnessError) {
    return { satisfied: false, detail: "the harness threw; nothing was asserted" };
  }

  // A runner-computed assertion.
  const s0 = o.sample[0] as { ok?: boolean; message?: string } | undefined;
  if (o.sample.length === 1 && typeof s0?.ok === "boolean") {
    return { satisfied: s0.ok, detail: s0.message ?? `runner assertion: ${s0.ok}` };
  }

  const e = t.expected.toLowerCase();
  const rows = o.rowCount ?? 0;

  if (e.startsWith("at least 1 row") || e.startsWith("rows returned")) {
    return { satisfied: !o.raised && rows >= 1, detail: `${rows} row(s) returned, at least 1 required` };
  }
  if (/^returns exactly one row|^returns exactly 1 row/.test(e)) {
    return { satisfied: !o.raised && rows === 1, detail: `${rows} row(s), exactly 1 required` };
  }
  if (/^returns no rows/.test(e)) {
    return { satisfied: !o.raised && rows === 0, detail: `${rows} row(s), none expected` };
  }
  if (/^returns false/.test(e)) {
    const v = firstScalar(o);
    return { satisfied: !o.raised && v === false, detail: `returned ${JSON.stringify(v)}, false required` };
  }
  if (/^returns 0\b/.test(e)) {
    const v = firstScalar(o);
    return { satisfied: !o.raised && (v === 0 || v === "0"), detail: `returned ${JSON.stringify(v)}, 0 required` };
  }
  // "refusal, OR a row attributed to alice that does not displace bob's" —
  // the plan permits either return value, so the return value discriminates
  // nothing and the post-probe state guard is the whole assertion. Treating
  // this as a plain "refusal" made the probe fail on its return value, which
  // is the right verdict for the wrong reason.
  if (/^refusal,\s+or\b/.test(e)) {
    return {
      satisfied: true,
      detail: "the plan permits either a refusal or a successful call; the state guard is what decides this row",
    };
  }
  // "refusal", "refusal or no effect", "no effect; …"
  if (/^refusal|^refused|^no effect/.test(e)) {
    return {
      satisfied: o.raised || rows === 0,
      detail: o.raised ? `refused with ${o.sqlstate ?? "no sqlstate"}` : `${rows} row(s) affected; a refusal or no effect was required`,
    };
  }
  // The caller-scoped SECURITY DEFINER invariant (D3.13): the definer privilege
  // must not carry the caller past their own rows.
  if (/only alice's own rows are returned or altered/.test(e)) {
    const found = mentions(o, [BOB, CAROL]);
    return {
      satisfied: !o.raised && found.length === 0,
      detail: found.length
        ? `another account's identifier appeared in the result: ${found.join(", ")}`
        : `${rows} row(s) returned, none carrying bob's or carol's identifier`,
    };
  }
  // The public projections: cross-user BY DESIGN, so the assertion is about
  // what the projection withholds, never about it returning nothing.
  if (/public-safe projection/.test(e)) {
    const blob = JSON.stringify(o.sample);
    const leaked = ["seed_secret", "email", "password"].filter((k) => blob.includes(k));
    return {
      satisfied: !o.raised && leaked.length === 0,
      detail: leaked.length ? `the projection carried ${leaked.join(", ")}` : `${rows} row(s), no withheld column present`,
    };
  }
  if (/dave must not appear in the results/.test(e)) {
    const found = mentions(o, [DAVE]);
    return {
      satisfied: !o.raised && found.length === 0,
      detail: found.length ? "dave appeared in the results despite the block" : `${rows} row(s), dave absent`,
    };
  }
  if (/dave's display_name is returned/.test(e)) {
    const found = mentions(o, [DAVE]);
    return {
      satisfied: !o.raised,
      detail: `characterization: ${rows} row(s) returned${found.length ? ", dave present as predicted" : ""}`,
    };
  }
  if (/^one blocks row with blocker_id = alice/.test(e)) {
    const found = mentions(o, [BOB]);
    return { satisfied: !o.raised && found.length <= 1, detail: `${rows} row(s) affected` };
  }
  // "2 rows — the owner is not subject to the policy", "1 row — FORCE removes…"
  if (/^\d+ rows?\b(?! affected)/.test(e)) {
    const want = Number(/^(\d+)/.exec(e)![1]);
    return { satisfied: !o.raised && rows === want, detail: `${rows} row(s) returned, ${want} expected` };
  }
  if (/^\d+ rows? affected/.test(e)) {
    const want = Number(/^(\d+)/.exec(e)![1]);
    return { satisfied: !o.raised && rows === want, detail: `${rows} row(s) affected, ${want} expected` };
  }

  // Deliberately not a pass. See the header.
  return {
    satisfied: false,
    unimplemented: true,
    detail:
      `no assertion is implemented for this expectation, so it cannot be scored: "${t.expected.slice(0, 120)}". ` +
      `An unrecognised expectation is recorded as unmet rather than silently passing.`,
  };
}
