/**
 * Attest — the WP4 run: every schema state, then the drift between them (D3.56).
 *
 * Each state runs in a child process (`attest wp4-state`) with ATTEST_SUT_REPO
 * pointing at its scratch directory; each child fingerprints the protected Arc21
 * checkout before and after, exactly as every attest command does. The chain is
 * then diffed pairwise — H1 → H2 → C → T — plus the whole span H1 → C.
 *
 * The current state's results are the official WP3 run's, linked by run id and
 * never re-executed; the controlled state exists to show the detector catching
 * a new unprotected table, not to be assessed.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { WP4_STATES, materialize, type MaterializedState } from "./wp4-states.ts";
import { diffInventories, diffResults, type InventoryDiff, type ResultPoint } from "./wp4-drift.ts";
import type { Inventory } from "./inventory.ts";

export interface Wp4Options {
  readonly wp3RunId: string;
  readonly planRunId: string;
  readonly log: (s: string) => void;
  /** Skip executing probes in historical states (inventories only). */
  readonly inventoriesOnly?: boolean;
}

async function child(args: string[], env: NodeJS.ProcessEnv, logPath: string): Promise<number> {
  const out: string[] = [];
  const code = await new Promise<number>((res) => {
    const p = spawn(process.execPath, [join(ATTEST_ROOT, "src", "cli.ts"), ...args], { cwd: ATTEST_ROOT, env: { ...process.env, ...env } });
    p.stdout.on("data", (d) => { out.push(String(d)); process.stdout.write(d); });
    p.stderr.on("data", (d) => { out.push(String(d)); process.stderr.write(d); });
    p.on("close", (c) => res(c ?? 1));
  });
  await writeFile(logPath, out.join(""));
  return code;
}

const pointsOf = (records: readonly Record<string, unknown>[]) =>
  new Map(records.map((r) => [String(r.testId), { verdict: String(r.verdict), observation: String(r.observation) } as ResultPoint]));

export async function runWp4(opts: Wp4Options): Promise<{ runId: string; ok: boolean; safetyViolation: boolean }> {
  const runId = `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-wp4`;
  const root = join(RUNS_ROOT, runId, "wp4");
  await mkdir(root, { recursive: true });
  opts.log(`WP4 run ${runId}`);
  const materialized: MaterializedState[] = [];
  const outcome: Record<string, { exit: number; dir: string }> = {};
  for (const spec of WP4_STATES) {
    const m = await materialize(spec);
    materialized.push(m);
    const dir = join(root, spec.name);
    await mkdir(dir, { recursive: true });
    const meta = {
      label: spec.label, why: spec.why, source: spec.source.kind,
      commit: spec.source.kind === "git-commit" ? spec.source.commit : null,
      provenance: m.provenance, migrationSetSha256: m.migrationSetSha256, migrationCount: m.migrations.length,
    };
    await writeFile(join(dir, "state-meta.json"), JSON.stringify(meta, null, 2) + "\n");
    const probes = spec.runProbes && !opts.inventoriesOnly;
    opts.log(`\n--- ${spec.name}: ${spec.label}${probes ? " (inventory and compatible approved probes)" : " (inventory)"}`);
    const code = await child(["wp4-state", runId, spec.name, `--plan-run=${opts.planRunId}`, ...(probes ? ["--probes"] : [])], { ATTEST_SUT_REPO: m.dir }, join(dir, "run.log"));
    outcome[spec.name] = { exit: code, dir };
    if (code === 3) {
      opts.log(`\nHARNESS SAFETY VIOLATION in state ${spec.name}: stopping WP4.`);
      return { runId, ok: false, safetyViolation: true };
    }
  }
  // Leave the disposable database as the current state's canonical build.
  opts.log(`\n--- restoring the current state's build (bringup)`);
  const restore = await child(["bringup"], {}, join(root, "restore.log"));

  // ---- drift -------------------------------------------------------------
  const inv = async (s: string) => JSON.parse(await readFile(join(root, s, "inventory.json"), "utf8")) as Inventory;
  const res = async (s: string): Promise<{ points: Map<string, ResultPoint>; source: string; incompatible: number } | null> => {
    if (s === "C-current") {
      const f = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp3RunId, "wp3-results.json"), "utf8")) as { records: Record<string, unknown>[] };
      return { points: pointsOf(f.records), source: `the official WP3 run ${opts.wp3RunId}`, incompatible: 0 };
    }
    try {
      const f = JSON.parse(await readFile(join(root, s, "results.json"), "utf8")) as { records: Record<string, unknown>[]; incompatible: unknown[] };
      return { points: pointsOf(f.records), source: `${runId}/${s}`, incompatible: f.incompatible.length };
    } catch { return null; }
  };
  const names = WP4_STATES.map((s) => s.name);
  const pairs: [string, string][] = [[names[0]!, names[1]!], [names[1]!, names[2]!], [names[2]!, names[3]!], [names[0]!, names[2]!]];
  const diffs: { from: string; to: string; inventory: InventoryDiff; results: ReturnType<typeof diffResults> | null; resultsNote: string }[] = [];
  for (const [a, b] of pairs) {
    if (outcome[a]!.exit !== 0 || outcome[b]!.exit !== 0) { opts.log(`  (no diff ${a} → ${b}: a state run failed)`); continue; }
    const inventory = diffInventories(await inv(a), await inv(b));
    const ra = await res(a), rb = await res(b);
    const results = ra && rb ? diffResults(ra.points, rb.points) : null;
    diffs.push({ from: a, to: b, inventory, results, resultsNote: ra && rb ? `${ra.source} → ${rb.source}` : "results exist for only one side" });
  }
  const summary = {
    WARNING: "WP4 drift evidence. Historical states are Arc21's own earlier schemas, rebuilt in a disposable database; their results are what TODAY's approved questions return against THAT schema, not findings about current Arc21. The controlled state contains one Attest-only migration and is a detector test, not an assessment.",
    runId, wp3RunId: opts.wp3RunId, planRunId: opts.planRunId,
    states: WP4_STATES.map((s, i) => ({ name: s.name, label: s.label, why: s.why, source: s.source.kind === "git-commit" ? `commit ${s.source.commit}` : s.source.kind, migrationSetSha256: materialized[i]!.migrationSetSha256, migrationCount: materialized[i]!.migrations.length, exit: outcome[s.name]!.exit })),
    restoreExit: restore,
    diffs: diffs.map((d) => ({ from: d.from, to: d.to, inventory: d.inventory, results: d.results ? { counts: d.results.counts, transitions: d.results.transitions.filter((t) => t.kind !== "unchanged") } : null, resultsNote: d.resultsNote })),
  };
  await writeFile(join(root, "drift.json"), JSON.stringify(summary, null, 2) + "\n");
  await writeFile(join(root, "drift-report.md"), renderDriftReport(summary));
  const ok = Object.values(outcome).every((o) => o.exit === 0) && restore === 0;
  return { runId, ok, safetyViolation: false };
}

type Summary = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function renderDriftReport(s: Summary): string {
  const L: string[] = [];
  const p = (x = "") => L.push(x);
  p("# WP4 — drift across schema states");
  p();
  p("> Generated by `npm run attest wp4` from the persisted runs below. Nothing in it is hand-written.");
  p(`> ${s.WARNING}`);
  p();
  p(`WP4 run \`${s.runId}\` · current-state results: official WP3 run \`${s.wp3RunId}\` · approved probes from planning run \`${s.planRunId}\``);
  p();
  p("## The states");
  p();
  p("| State | Source | Migrations | Schema hash | Why this state |");
  p("|---|---|---:|---|---|");
  for (const st of s.states) p(`| \`${st.name}\` | ${st.source} | ${st.migrationCount} | \`${String(st.migrationSetSha256).slice(0, 12)}…\` | ${st.why}${st.exit !== 0 ? ` **(run exit ${st.exit})**` : ""} |`);
  p();
  for (const d of s.diffs) {
    const c = d.inventory.counts;
    p(`## ${d.from} → ${d.to}`);
    p();
    p("| Drift class | Count |");
    p("|---|---:|");
    p(`| controls added | ${c.added} |`);
    p(`| controls removed | ${c.removed} |`);
    p(`| control definition changed (USING / WITH CHECK) | ${c.definitionChanged} |`);
    p(`| control attributes changed (command, roles, privileges, flags, grantees) | ${c.attributesChanged} |`);
    p(`| new resources | ${c.newResources} |`);
    p(`| **new resources with no control** (no row-level security, or a view not run as its invoker) | **${c.newUnprotectedResources}** |`);
    p(`| … of which a client role can reach now | ${c.newUnprotectedReachable ?? 0} |`);
    p(`| resources removed | ${c.removedResources} |`);
    p(`| existing resources newly exposed | ${c.newlyExposed} |`);
    p();
    const inv = d.inventory;
    if (inv.newResources.length) {
      p("**New resources**");
      p();
      for (const r of inv.newResources) p(`- \`${r.resource}\` — ${r.unprotected ? `**NO ROW-LEVEL CONTROL**, ${r.clientReachable ? "reachable by a client role now" : "not reachable by any client role today (no grant): one GRANT from exposed"}` : "controlled"}${r.observations.length ? `; ${r.observations.map((o: Summary) => `${o.kind} (${o.detail})`).join("; ")}` : ""}`);
      p();
    }
    if (inv.newlyExposed.length) {
      p("**Newly exposed**");
      p();
      for (const r of inv.newlyExposed) p(`- \`${r.resource}\` — ${[...(r.lostRowControl ? ["lost its row-level control"] : []), ...r.gained.map((o: Summary) => o.kind)].join(", ")}`);
      p();
    }
    const list = (title: string, xs: Summary[], f: (x: Summary) => string, max = 40) => {
      if (!xs.length) return;
      p(`**${title}** (${xs.length})`);
      p();
      for (const x of xs.slice(0, max)) p(`- ${f(x)}`);
      if (xs.length > max) p(`- … ${xs.length - max} more in drift.json`);
      p();
    };
    list("Controls added", inv.added, (x) => `\`${x.controlId}\``);
    list("Controls removed", inv.removed, (x) => `\`${x.controlId}\``);
    list("Control definitions changed", inv.changed.filter((x: Summary) => x.change === "definition"), (x) => `\`${x.controlId}\` — USING \`${x.before.using_expr ?? "∅"}\` → \`${x.after.using_expr ?? "∅"}\`; WITH CHECK \`${x.before.with_check_expr ?? "∅"}\` → \`${x.after.with_check_expr ?? "∅"}\``);
    list("Control attributes changed", inv.changed.filter((x: Summary) => x.change === "attributes"), (x) => `\`${x.controlId}\` — ${x.fields.join(", ")}: ${x.fields.map((f: string) => `${JSON.stringify(x.before[f])} → ${JSON.stringify(x.after[f])}`).join("; ").slice(0, 300)}`);
    if (d.results) {
      p(`**Result transitions** (${d.resultsNote})`);
      p();
      p("| Transition | Test IDs |");
      p("|---|---:|");
      for (const [k, n] of Object.entries(d.results.counts)) p(`| ${k} | ${n} |`);
      p();
      const t = d.results.transitions as Summary[];
      list("pass → fail", t.filter((x) => x.kind === "pass → fail"), (x) => `\`${x.testId}\``, 60);
      list("fail → pass", t.filter((x) => x.kind === "fail → pass"), (x) => `\`${x.testId}\``, 60);
    } else {
      p(`*Result transitions: ${d.resultsNote}.*`);
      p();
    }
  }
  return L.join("\n") + "\n";
}
