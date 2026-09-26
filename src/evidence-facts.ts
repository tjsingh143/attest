/**
 * Attest — the evidence WP6 and WP7 report from, loaded once and counted (D3.60, D3.61).
 *
 * Every number a WP6 or WP7 output prints comes from `computeFacts`, which reads
 * only persisted evidence: the official runs the author selected at CP4 (J14,
 * rubric/official-runs.json), the frozen CP1/CP3 run, the WP4 drift run, and the
 * WP5 package. Nothing here is typed in; nothing here queries a database.
 *
 * The independent checks (`validate-wp6`, `validate-reports`) deliberately do NOT
 * use this module: they re-read the raw files and recount with their own code, so a
 * counting mistake here cannot validate itself.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { diffInventories } from "./wp4-drift.ts";
import type { Inventory } from "./inventory.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const VERDICTS = ["effective", "deficient", "gap", "characterized", "not_measured"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type VerdictCounts = Record<Verdict, number> & { total: number };

/** The families as the brief numbers them (WP3), in report order. */
export const FAMILIES: readonly { readonly code: string; readonly name: string }[] = [
  { code: "F1", name: "Read isolation" },
  { code: "F2", name: "Write isolation" },
  { code: "F3", name: "WITH CHECK enforcement" },
  { code: "F4", name: "Anonymous exposure" },
  { code: "F5", name: "Privilege escalation through SECURITY DEFINER functions" },
  { code: "F6", name: "Column-level leakage" },
  { code: "F7", name: "Forced RLS / owner and BYPASSRLS exemption" },
  { code: "F8", name: "Realtime channel authorization" },
  { code: "F9", name: "Integrity under concurrency (wallet)" },
  { code: "F10", name: "Audit trail" },
  { code: "B", name: "Boundary cases: absent identity, deleted account, expired session" },
];

/** A record's family code: "F10 audit trail" → "F10" (never a prefix match: F1 is not F10). */
export const familyCode = (r: Rec): string => String(r.family).split(" ")[0]!;

export function countVerdicts(recs: readonly Rec[]): VerdictCounts {
  const c = { effective: 0, deficient: 0, gap: 0, characterized: 0, not_measured: 0, total: recs.length } as VerdictCounts;
  for (const r of recs) {
    if (!(VERDICTS as readonly string[]).includes(String(r.verdict))) throw new Error(`record ${r.testId} has verdict ${r.verdict}, which no report knows how to count`);
    c[r.verdict as Verdict]++;
  }
  return c;
}

export interface OfficialRunIds { readonly wp3: string; readonly plan: string; readonly wp4: string; readonly frozenCp3: string }

export interface Evidence {
  readonly runs: OfficialRunIds;
  readonly results: Rec;
  readonly records: readonly Rec[];
  readonly validation: Rec;
  readonly planTests: readonly Rec[];
  readonly tiers: Rec;
  readonly inventory: Inventory & Rec;
  readonly wp1: Rec;
  readonly cp3Run: Rec;
  readonly drift: Rec;
  readonly wp4States: Readonly<Record<string, Rec>>;
  readonly wp4Inventories: Readonly<Record<string, Inventory>>;
  readonly findings: Rec;
  readonly cp4: Rec;
  readonly official: Rec;
  /** framework-mapping.json (WP6), when it has been generated. */
  readonly framework: Rec | null;
}

const json = async (p: string): Promise<Rec> => JSON.parse(await readFile(p, "utf8")) as Rec;

export async function loadEvidence(): Promise<Evidence> {
  const official = await json(join(ATTEST_ROOT, "rubric", "official-runs.json"));
  const runs: OfficialRunIds = { wp3: String(official.wp3), plan: String(official.plan), wp4: String(official.wp4), frozenCp3: String(official.frozenCp3) };
  const results = await json(join(RUNS_ROOT, runs.wp3, "wp3-results.json"));
  const drift = await json(join(RUNS_ROOT, runs.wp4, "wp4", "drift.json"));
  const wp4States: Record<string, Rec> = {};
  const wp4Inventories: Record<string, Inventory> = {};
  for (const s of drift.states as Rec[]) {
    try { wp4States[String(s.name)] = await json(join(RUNS_ROOT, runs.wp4, "wp4", String(s.name), "results.json")); } catch { /* a state that ran no probes */ }
    wp4Inventories[String(s.name)] = (await json(join(RUNS_ROOT, runs.wp4, "wp4", String(s.name), "inventory.json"))) as unknown as Inventory;
  }
  return {
    runs,
    results,
    records: results.records as Rec[],
    validation: await json(join(RUNS_ROOT, runs.wp3, "wp3-validation.json")),
    planTests: ((await json(join(RUNS_ROOT, runs.plan, "wp3-matrix.json"))).plan as Rec).tests as Rec[],
    tiers: await json(join(RUNS_ROOT, runs.frozenCp3, "cp3-tiers.json")),
    inventory: (await json(join(RUNS_ROOT, runs.frozenCp3, "inventory.json"))) as Inventory & Rec,
    wp1: await json(join(RUNS_ROOT, runs.frozenCp3, "wp1-validation.json")),
    cp3Run: await json(join(RUNS_ROOT, runs.frozenCp3, "run.json")),
    drift,
    wp4States,
    wp4Inventories,
    findings: await json(join(RUNS_ROOT, runs.wp3, "wp5", "findings.json")),
    cp4: await json(join(ATTEST_ROOT, "rubric", "cp4-author-response.json")),
    official,
    framework: await json(join(ATTEST_ROOT, "framework-mapping.json")).catch(() => null),
  };
}

/** The tier-to-assurance-activity mapping, as RUBRIC.md Part 5 states it (the author's). */
export const TIER_ACTIVITY: Readonly<Record<string, string>> = {
  High: "robust scripted testing — every applicable authorization branch, positive and negative, with applicable boundary cases and a complete evidence record",
  Medium: "limited scripted testing of critical paths — representative positive and negative cases, and a boundary case where directly relevant",
  Low: "recorded unscripted or exploratory testing — scenario testing, error guessing, exploratory probing, still with an evidence record",
};

/**
 * Which inventory controls a record names. Records name controls more finely than
 * the inventory does: a grant per privilege (`#grant:authenticated:INSERT`), a
 * column test per privilege (`#colgrant:UPDATE`), a function by name without its
 * signature (`public.leave_room#security_definer`). So the match is exact; else a
 * grant record to that role's grant on the resource; a column-grant record to the
 * resource's column grants; a function record to that function's definer and
 * execute controls (every overload). A mechanism claim that names a trigger
 * (`mech:trigger:wallet_ledger_append_only`) names that trigger too, and a function
 * the executed statement calls names that function. Anything else tests the
 * resource as a whole (anonymous reach, audit trail, boundary, integrity).
 */
export function controlsNamedBy(r: Rec, controlIds: ReadonlySet<string>, byResource: ReadonlyMap<string, readonly string[]>): string[] {
  const out = new Set<string>();
  const id = String(r.controlId);
  const [res, ctl = ""] = id.split("#", 2) as [string, string?];
  const same = byResource.get(res) ?? [];
  if (controlIds.has(id)) out.add(id);
  const g = /^grant:([a-z_]+):[A-Z]+$/.exec(ctl);
  if (g) for (const c of same) if (c === `${res}#grant:${g[1]}`) out.add(c);
  if (/^colgrant:[A-Z]+$/.test(ctl)) for (const c of same) if (c.startsWith(`${res}#colgrant:`)) out.add(c);
  if (ctl === "security_definer") {
    for (const c of controlIds) if (c.startsWith(`${res}(`) && (c.endsWith("#security_definer") || c.endsWith("#execute"))) out.add(c);
  }
  for (const cr of (r.claimResults ?? []) as Rec[]) {
    const t = /^mech:trigger:(.+)$/.exec(String(cr.evaluator));
    if (t) for (const c of controlIds) if (c.endsWith(`#trigger:${t[1]}`)) out.add(c);
  }
  // A function the executed statement itself calls (F9 calls apply_wallet_delta on the server path).
  for (const m of String(r.executed?.statement ?? "").matchAll(/\b((?:public|private)\.[a-z_][a-z0-9_]*)\s*\(/g)) {
    for (const c of controlIds) if (c.startsWith(`${m[1]}(`) && (c.endsWith("#security_definer") || c.endsWith("#execute"))) out.add(c);
  }
  return [...out];
}

export interface Facts {
  readonly runs: OfficialRunIds;
  readonly wp3: {
    readonly total: number; readonly byVerdict: VerdictCounts; readonly byFamily: Readonly<Record<string, VerdictCounts>>;
    readonly byTier: Readonly<Record<string, VerdictCounts>>; readonly byPolarity: Readonly<Record<string, number>>;
    readonly identities: number; readonly firstTimestamp: string; readonly lastTimestamp: string;
    readonly schemaVersion: string; readonly migrationCount: number; readonly harnessSha256: string; readonly harnessFiles: number;
    readonly arc21Commit: string; readonly arc21Fingerprint: string; readonly arc21Unchanged: boolean;
    readonly rebuilds: number; readonly elapsedSeconds: number;
    readonly validationPassed: boolean; readonly validationChecks: number; readonly validationChecksPassed: number;
  };
  readonly wp2: { readonly resources: number; readonly byTier: Readonly<Record<string, number>>; readonly resourceTier: ReadonlyMap<string, string> };
  readonly wp0: {
    readonly resources: number; readonly controls: number; readonly policies: number; readonly definerFunctions: number; readonly definerClientCallable: number;
    readonly triggers: number; readonly triggersThatCanRefuse: number; readonly columnGrants: number; readonly tableGrants: number;
    readonly rlsEnabled: number; readonly rlsForced: number; readonly tables: number; readonly roles: number; readonly rolesBypassRls: readonly string[];
    readonly anonReach: number; readonly anonReachApplication: number; readonly observations: Readonly<Record<string, number>>;
    readonly resourcesWithoutControl: readonly string[];
  };
  readonly coverage: {
    readonly controlsNamed: number; readonly controlsResourceOnly: number; readonly controlsUnexercised: number;
    readonly byKind: Readonly<Record<string, { total: number; named: number }>>;
  };
  readonly wp1: { readonly scenarios: number; readonly detected: number; readonly restored: number; readonly inventoryUnchanged: boolean; readonly overPrivilegedChecks: number; readonly overPrivilegedDiscriminated: number; readonly families: readonly string[]; readonly canSetServiceRole: boolean | null };
  readonly wp4: {
    readonly states: readonly { name: string; label: string; migrationCount: number; exit: number }[];
    readonly diffs: readonly { from: string; to: string; added: number; removed: number; definitionChanged: number; attributesChanged: number; newResources: number; newUnprotected: number; newlyExposed: number; passToFail: number | null; failToPass: number | null }[];
    readonly newUnprotected: readonly { resource: string; clientReachable: boolean; state: string }[];
    readonly currentMatchesFrozen: boolean; readonly currentVsFrozenDifferences: number;
  };
  readonly wp5: {
    readonly items: readonly { id: string; key: string; part: string; title: string; tier: string; evidenceClass: string; testIds: readonly string[]; status: string }[];
    readonly scope: { trailRequired: number; excluded: number; conditional: number; total: number } | null;
    readonly cp4Approved: boolean; readonly cp4Date: string;
  };
}

export function computeFacts(ev: Evidence): Facts {
  const recs = ev.records;
  const byFamily: Record<string, VerdictCounts> = {};
  for (const f of FAMILIES) byFamily[f.code] = countVerdicts(recs.filter((r) => familyCode(r) === f.code));
  const unknownFamily = recs.filter((r) => !FAMILIES.some((f) => f.code === familyCode(r)));
  if (unknownFamily.length) throw new Error(`records in no known family: ${unknownFamily.map((r) => r.testId).join(", ")}`);
  const tiersSeen = [...new Set(recs.map((r) => String(r.tier)))].sort();
  const byTier = Object.fromEntries(tiersSeen.map((t) => [t, countVerdicts(recs.filter((r) => String(r.tier) === t))]));
  const byPolarity = recs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.polarity]: (m[r.polarity] ?? 0) + 1 }), {});
  const stamps = recs.map((r) => String(r.timestampUtc)).sort();
  const meta = ev.results.meta as Rec;
  const checks = ev.validation.checks as Rec[];

  const scored = ev.tiers.scored as Rec[];
  const resourceTier = new Map(scored.map((s) => [String(s.resource), String(s.tier)]));
  const wp2ByTier = scored.reduce<Record<string, number>>((m, s) => ({ ...m, [s.tier]: (m[s.tier] ?? 0) + 1 }), {});

  const inv = ev.inventory as Rec;
  const controls = inv.controls as Rec[];
  const kind = (k: string) => controls.filter((c) => c.controlKind === k);
  const definers = kind("security_definer_function");
  const roles = inv.roles as Rec[];
  const observations = (inv.observations as Rec[]).reduce<Record<string, number>>((m, o) => ({ ...m, [o.kind]: (m[o.kind] ?? 0) + 1 }), {});
  const resources = inv.resources as Rec[];
  const withControl = new Set(controls.map((c) => String(c.resource)));

  // coverage: which inventory controls a Test ID names
  const controlIds = new Set(controls.map((c) => String(c.controlId)));
  const byResource = new Map<string, string[]>();
  for (const c of controls) byResource.set(String(c.resource), [...(byResource.get(String(c.resource)) ?? []), String(c.controlId)]);
  const named = new Set<string>();
  for (const r of recs) for (const c of controlsNamedBy(r, controlIds, byResource)) named.add(c);
  const testedResources = new Set(recs.map((r) => String(r.resource)));
  const byKind: Record<string, { total: number; named: number }> = {};
  for (const c of controls) {
    const k = String(c.controlKind);
    byKind[k] = byKind[k] ?? { total: 0, named: 0 };
    byKind[k]!.total++;
    if (named.has(String(c.controlId))) byKind[k]!.named++;
  }
  const resourceOnly = controls.filter((c) => !named.has(String(c.controlId)) && testedResources.has(String(c.resource))).length;

  // WP1
  const scenarios = ev.wp1.scenarios as Rec[];
  const over = scenarios.flatMap((s) => (s.overPrivileged ?? []) as Rec[]);
  const esc = ((ev.wp1.identities ?? {}) as Rec).escalation as Rec[] | undefined;
  const setService = Array.isArray(esc) ? esc.find((e) => /service_role/.test(String(e.statement ?? ""))) : undefined;

  // WP4
  const drift = ev.drift;
  const diffs = (drift.diffs as Rec[]).map((d) => ({
    from: String(d.from), to: String(d.to),
    added: Number(d.inventory.counts.added), removed: Number(d.inventory.counts.removed),
    definitionChanged: Number(d.inventory.counts.definitionChanged), attributesChanged: Number(d.inventory.counts.attributesChanged),
    newResources: Number(d.inventory.counts.newResources), newUnprotected: Number(d.inventory.counts.newUnprotectedResources),
    newlyExposed: Number(d.inventory.counts.newlyExposed),
    passToFail: d.results ? Number(d.results.counts["pass → fail"] ?? 0) : null,
    failToPass: d.results ? Number(d.results.counts["fail → pass"] ?? 0) : null,
  }));
  const newUnprotected = (drift.diffs as Rec[]).flatMap((d) => ((d.inventory.newResources ?? []) as Rec[]).filter((x) => x.unprotected).map((x) => ({ resource: String(x.resource), clientReachable: x.clientReachable === true, state: String(d.to) })));
  const current = ev.wp4Inventories["C-current"];
  let currentVsFrozen = -1;
  if (current) {
    const d = diffInventories(ev.inventory, current);
    const n = (k: string): number => Number((d.counts as Record<string, number | undefined>)[k] ?? 0);
    currentVsFrozen = n("added") + n("removed") + n("changed") + n("newResources") + n("removedResources") + n("newlyExposed");
  }

  // WP5
  const f = ev.findings;
  const scope = f.auditScope as Rec | null;
  const sc = scope ? (scope.resources as Rec[]) : null;
  return {
    runs: ev.runs,
    wp3: {
      total: recs.length, byVerdict: countVerdicts(recs), byFamily, byTier, byPolarity,
      identities: new Set(recs.map((r) => String(r.identity?.label ?? r.identityPlanned))).size,
      firstTimestamp: stamps[0]!, lastTimestamp: stamps[stamps.length - 1]!,
      schemaVersion: String(meta.sut.schemaVersion), migrationCount: Number(meta.sut.migrationCount),
      harnessSha256: String(meta.harness.sourcesSha256), harnessFiles: Number(meta.harness.fileCount),
      arc21Commit: String(meta.sut.arc21.commit), arc21Fingerprint: String(meta.sut.arc21.fingerprintBefore),
      arc21Unchanged: ev.results.arc21ReadOnlyGuard?.identical === true,
      rebuilds: Number(meta.rebuilds), elapsedSeconds: Number(meta.elapsedSeconds),
      validationPassed: ev.validation.passed === true, validationChecks: checks.length, validationChecksPassed: checks.filter((c) => c.passed).length,
    },
    wp2: { resources: scored.length, byTier: wp2ByTier, resourceTier },
    wp0: {
      resources: resources.length, controls: controls.length, policies: kind("policy").length,
      definerFunctions: definers.length,
      definerClientCallable: definers.filter((d) => ((d.detail?.executable_by ?? []) as string[]).some((g) => g === "anon" || g === "authenticated")).length,
      triggers: kind("trigger").length, triggersThatCanRefuse: kind("trigger").filter((t) => t.detail?.can_refuse).length,
      columnGrants: kind("column_grant").length, tableGrants: kind("table_grant").length,
      rlsEnabled: kind("rls_enabled").filter((c) => c.detail?.rls_enabled === true).length,
      rlsForced: kind("rls_forced").filter((c) => c.detail?.rls_forced === true).length,
      tables: kind("rls_enabled").length,
      roles: roles.length, rolesBypassRls: roles.filter((r) => r.bypasses_rls).map((r) => String(r.role_name)),
      anonReach: (inv.anonymousReach as Rec[]).length, anonReachApplication: (inv.anonymousReach as Rec[]).filter((a) => a.in_application_schema).length,
      observations, resourcesWithoutControl: resources.map((r) => String(r.resource)).filter((r) => !withControl.has(r)),
    },
    coverage: { controlsNamed: named.size, controlsResourceOnly: resourceOnly, controlsUnexercised: controls.length - named.size - resourceOnly, byKind },
    wp1: {
      scenarios: scenarios.length, detected: scenarios.filter((s) => s.detected).length, restored: scenarios.filter((s) => s.restored).length,
      inventoryUnchanged: ev.wp1.inventoryUnchanged === true,
      overPrivilegedChecks: over.length, overPrivilegedDiscriminated: over.filter((o) => o.discriminates).length,
      families: scenarios.map((s) => String(s.family ?? s.mechanism ?? s.id)),
      canSetServiceRole: setService ? setService.permitted === true : null,
    },
    wp4: {
      states: (drift.states as Rec[]).map((s) => ({ name: String(s.name), label: String(s.label), migrationCount: Number(s.migrationCount), exit: Number(s.exit) })),
      diffs, newUnprotected, currentMatchesFrozen: currentVsFrozen === 0, currentVsFrozenDifferences: currentVsFrozen,
    },
    wp5: {
      items: (f.items as Rec[]).map((i) => ({
        id: String(i.id), key: String(i.key), part: String(i.part), title: String(i.title), tier: String(i.tier), evidenceClass: String(i.evidenceClass), testIds: i.testIds as string[],
        status: i.part === "limitation" ? "not_measured" : String(i.author?.status ?? "pending"),
      })),
      scope: sc ? { trailRequired: sc.filter((x) => x.disposition === "trail_required").length, excluded: sc.filter((x) => x.disposition === "excluded_transient").length, conditional: sc.filter((x) => x.disposition === "ledger_conditional").length, total: sc.length } : null,
      cp4Approved: /^approved\b/.test(String(ev.cp4.approval?.CP4 ?? "")),
      cp4Date: /\b(\d{4}-\d{2}-\d{2})\b/.exec(String(ev.cp4.recordedFrom ?? ""))?.[1] ?? "",
    },
  };
}
