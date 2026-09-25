/**
 * Attest — WP4 drift: what changed between two runs (D3.56).
 *
 * The brief's classification, computed from two persisted runs:
 *
 *   control added / removed      a control id present in one inventory only
 *   control definition changed   a policy's USING or WITH CHECK expression differs
 *   control attributes changed   anything else about the same control differs —
 *                                a policy's command, roles or permissiveness; a
 *                                grant's privileges; RLS enabled or forced; a
 *                                trigger's events or enabled state; a function's
 *                                EXECUTE grantees or definer flag
 *   new resource with no control a resource present only in the later run, which
 *                                the later inventory classifies as reachable with
 *                                row-level security off
 *   newly exposed resource       an existing resource that gains such an
 *                                observation (or anonymous reach)
 *   result transitions           per Test ID executed in both runs: pass → fail
 *                                (effective → deficient), fail → pass, and every
 *                                change into or out of "measured"
 *
 * Nothing here is ranked or called a finding; WP5 decides what a change means.
 * "Pass" and "fail" are the evidence's own verdicts, never re-judged here.
 */
import type { ControlRow, Inventory, Observation } from "./inventory.ts";

/** Observations that mean "a client can reach this with no row control". */
export const UNPROTECTED_KINDS: ReadonlySet<string> = new Set(["rls_disabled_and_reachable", "anon_reachable", "public_grant", "view_bypasses_invoker_rls"]);

export interface ControlChange {
  readonly controlId: string;
  readonly resource: string;
  readonly controlKind: string;
  readonly change: "definition" | "attributes";
  readonly fields: readonly string[];
  readonly before: Record<string, unknown>;
  readonly after: Record<string, unknown>;
}

export interface ResourceDrift {
  readonly resource: string;
  readonly unprotected: boolean;
  readonly observations: readonly Observation[];
}

export interface InventoryDiff {
  readonly added: readonly ControlRow[];
  readonly removed: readonly ControlRow[];
  readonly changed: readonly ControlChange[];
  readonly newResources: readonly ResourceDrift[];
  readonly removedResources: readonly string[];
  /** Resources in both runs whose later observations add an unprotected kind. */
  readonly newlyExposed: readonly { readonly resource: string; readonly gained: readonly Observation[] }[];
  readonly counts: Readonly<Record<string, number>>;
}

const stable = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : Array.isArray(v) ? [...v].map((e) => (typeof e === "string" ? e : e)).sort() : v));

export function diffInventories(a: Inventory, b: Inventory): InventoryDiff {
  const A = new Map(a.controls.map((c) => [c.controlId, c]));
  const B = new Map(b.controls.map((c) => [c.controlId, c]));
  const added = [...B.values()].filter((c) => !A.has(c.controlId));
  const removed = [...A.values()].filter((c) => !B.has(c.controlId));
  const changed: ControlChange[] = [];
  for (const [id, cb] of B) {
    const ca = A.get(id);
    if (!ca) continue;
    const da = (ca.detail ?? {}) as Record<string, unknown>, db = (cb.detail ?? {}) as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(da), ...Object.keys(db)])].filter((k) => stable(da[k]) !== stable(db[k]));
    if (ca.present !== cb.present) fields.push("present");
    if (!fields.length) continue;
    const definition = cb.controlKind === "policy" && fields.some((f) => f === "using_expr" || f === "with_check_expr");
    changed.push({ controlId: id, resource: cb.resource, controlKind: cb.controlKind, change: definition ? "definition" : "attributes", fields, before: da, after: db });
  }
  const resA = new Set(a.resources.map((r) => r.resource));
  const resB = new Set(b.resources.map((r) => r.resource));
  const obsOf = (inv: Inventory, res: string) => inv.observations.filter((o) => o.resource === res);
  const newResources = [...resB].filter((r) => !resA.has(r)).sort().map((r) => {
    const obs = obsOf(b, r);
    return { resource: r, unprotected: obs.some((o) => UNPROTECTED_KINDS.has(o.kind)), observations: obs };
  });
  const removedResources = [...resA].filter((r) => !resB.has(r)).sort();
  const newlyExposed = [...resB].filter((r) => resA.has(r)).sort().map((r) => {
    const before = new Set(obsOf(a, r).filter((o) => UNPROTECTED_KINDS.has(o.kind)).map((o) => o.kind));
    return { resource: r, gained: obsOf(b, r).filter((o) => UNPROTECTED_KINDS.has(o.kind) && !before.has(o.kind)) };
  }).filter((x) => x.gained.length > 0);
  const byKind = (xs: readonly { controlKind: string }[], label: string) =>
    Object.fromEntries(Object.entries(xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x.controlKind]: (m[x.controlKind] ?? 0) + 1 }), {})).map(([k, n]) => [`${label}.${k}`, n]));
  return {
    added, removed, changed, newResources, removedResources, newlyExposed,
    counts: {
      added: added.length, removed: removed.length, changed: changed.length,
      definitionChanged: changed.filter((c) => c.change === "definition").length,
      attributesChanged: changed.filter((c) => c.change === "attributes").length,
      newResources: newResources.length, newUnprotectedResources: newResources.filter((r) => r.unprotected).length,
      removedResources: removedResources.length, newlyExposed: newlyExposed.length,
      ...byKind(added, "added"), ...byKind(removed, "removed"), ...byKind(changed, "changed"),
    },
  };
}

// ---------------------------------------------------------------------------
// result transitions
// ---------------------------------------------------------------------------

export interface ResultPoint { readonly verdict: string; readonly observation: string }

export type TransitionKind =
  | "pass → fail" | "fail → pass"
  | "became not_measured" | "became measured"
  | "only in the earlier run" | "only in the later run"
  | "other change" | "unchanged";

export interface ResultTransition {
  readonly testId: string;
  readonly kind: TransitionKind;
  readonly from: ResultPoint | null;
  readonly to: ResultPoint | null;
}

export function classifyTransition(from: ResultPoint | null, to: ResultPoint | null): TransitionKind {
  if (!from && !to) return "unchanged";
  if (!from) return "only in the later run";
  if (!to) return "only in the earlier run";
  if (from.verdict === to.verdict) return "unchanged";
  if (from.verdict === "effective" && to.verdict === "deficient") return "pass → fail";
  if (from.verdict === "deficient" && to.verdict === "effective") return "fail → pass";
  if (to.verdict === "not_measured") return "became not_measured";
  if (from.verdict === "not_measured") return "became measured";
  return "other change";
}

/**
 * Compare two result sets by Test ID. A Test ID the state could not execute
 * (incompatible schema) is absent from that side — never a pass and never a
 * failure.
 */
export function diffResults(a: ReadonlyMap<string, ResultPoint>, b: ReadonlyMap<string, ResultPoint>): { transitions: ResultTransition[]; counts: Record<string, number> } {
  const ids = [...new Set([...a.keys(), ...b.keys()])].sort();
  const transitions = ids.map((testId) => {
    const from = a.get(testId) ?? null, to = b.get(testId) ?? null;
    return { testId, kind: classifyTransition(from, to), from, to };
  });
  const counts: Record<string, number> = {};
  for (const t of transitions) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
  return { transitions, counts };
}
