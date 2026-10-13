/**
 * Attest — `attest reports` (D3.61): every generated deliverable, from persisted evidence.
 *
 * One builder produces every file `reports` writes — WP5 (FINDINGS.md, the CP4 record and
 * the evidence-store copies), WP6 (the framework mapping, the CSA note, their validation and
 * the CP5 record) and WP7 (the assurance report, the plain-language summary, the dashboard and
 * the README's generated sections). `reports` writes the map and then validates what it wrote;
 * `validate-reports` builds the same map without writing and requires the files on disk to be
 * byte-identical to it. No database is read: every number comes from files under evidence/
 * and rubric/.
 *
 * Also here: the record `prove-gates` writes, which the reports cite instead of a typed count.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import { computeFacts, loadEvidence, PROVE_GATES_DIR, PROVE_GATES_PATH } from "./evidence-facts.ts";
import { readHarnessVersion } from "./harness-version.ts";
import { buildWp5Files, loadOfficialRuns } from "./wp5-run.ts";
import { buildWp6Files } from "./wp6-run.ts";
import { renderReport, REPORT_PATH } from "./wp7-report.ts";
import { renderSummary, SUMMARY_PATH } from "./wp7-summary.ts";
import { renderDashboard, DASHBOARD_PATH } from "./wp7-dashboard.ts";
import { README_PATH, renderReadmeBlocks, spliceReadme } from "./wp7-readme.ts";
import type { InjectionResult } from "./wp3-fault-injection.ts";
import { presentationFiles } from "./presentation.ts";

const run = promisify(execFile);

export const rel = (p: string): string => relative(ATTEST_ROOT, p);

async function writeAll(files: ReadonlyMap<string, string>): Promise<void> {
  for (const [path, content] of files) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

export interface BuiltOutputs {
  readonly problems: readonly string[];
  /** Absolute path → exact content. */
  readonly files: ReadonlyMap<string, string>;
}

/**
 * Build every output. In "write" mode each package is written before the next is built,
 * because WP6 reads WP5's findings.json and WP7 reads both — exactly what a reader of the
 * repository would find on disk. In "compare" mode nothing is written; each package is built
 * from the files as they are, so a stale or hand-edited file shows up as a byte difference.
 */
export async function buildReportOutputs(mode: "write" | "compare"): Promise<BuiltOutputs> {
  const off = await loadOfficialRuns();
  const wp5 = await buildWp5Files({ wp3RunId: off.wp3, planRunId: off.plan, wp4RunId: off.wp4 });
  if (wp5.problems.length) return { problems: wp5.problems.map((p) => `WP5 refused: ${p}`), files: new Map() };
  if (mode === "write") await writeAll(wp5.files);
  const wp6 = await buildWp6Files();
  if (wp6.problems.length) return { problems: wp6.problems.map((p) => `WP6 refused: ${p}`), files: new Map() };
  if (mode === "write") await writeAll(wp6.files);
  const ev = await loadEvidence();
  const f = computeFacts(ev);
  const wp7 = presentationFiles(new Map<string, string>([
    [REPORT_PATH, renderReport(ev, f)],
    [SUMMARY_PATH, renderSummary(f)],
    [DASHBOARD_PATH, await renderDashboard(ev, f)],
    [README_PATH, spliceReadme(await readFile(README_PATH, "utf8"), renderReadmeBlocks(ev, f))],
  ]));
  if (mode === "write") await writeAll(wp7);
  return { problems: [], files: new Map([...wp5.files, ...wp6.files, ...wp7]) };
}

/** Every file `reports` writes, relative to the repository root, in a stable order. */
export async function reportOutputPaths(): Promise<string[]> {
  return [...(await buildReportOutputs("compare")).files.keys()].map(rel).sort();
}

/**
 * Record a prove-gates result (D3.61). Rewritten by every run, pass or fail: the reports cite
 * the counts computed from these rows, and `validate-reports` recounts them and requires the
 * record to be for the harness as it is now.
 */
export async function recordProveGates(rs: readonly InjectionResult[]): Promise<string> {
  const harness = await readHarnessVersion();
  let attestCommit: string | null = null;
  let trackedChangesUncommitted: boolean | null = null;
  try {
    attestCommit = (await run("git", ["-C", ATTEST_ROOT, "rev-parse", "HEAD"])).stdout.trim();
    trackedChangesUncommitted = (await run("git", ["-C", ATTEST_ROOT, "status", "--porcelain", "--untracked-files=no"])).stdout.trim().length > 0;
  } catch { /* not a git checkout: the harness hash still identifies the code */ }
  const injected = rs.filter((r) => !r.control), controls = rs.filter((r) => r.control);
  const record = {
    WARNING: "The latest `npm run attest prove-gates` result, rewritten by every run, pass or fail. Each row is one injected defect, or a control the gate must NOT fire on; a row may bundle several sub-cases, each named in its text. The reports cite counts computed from these rows. The harness hash identifies the code that ran; the commit is context (the tree may have had uncommitted changes, as recorded).",
    at: new Date().toISOString(),
    harness,
    attestCommit,
    trackedChangesUncommitted,
    summary: {
      injected: injected.length, caught: injected.filter((r) => r.caught).length,
      controls: controls.length, held: controls.filter((r) => r.caught).length,
      restored: rs.every((r) => r.restored),
    },
    rows: rs.map((r, i) => ({ n: i + 1, control: r.control === true, defect: r.defect, gate: r.gate, caught: r.caught, restored: r.restored, consequence: r.consequence, firedCheck: r.firedCheck })),
  };
  await mkdir(PROVE_GATES_DIR, { recursive: true });
  await writeFile(PROVE_GATES_PATH, JSON.stringify(record, null, 2) + "\n");
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const md = [
    "# prove-gates — the latest result",
    "",
    `> Written by \`npm run attest prove-gates\` at ${record.at}; rewritten by every run. Harness \`${harness.sourcesSha256.slice(0, 12)}\` (${harness.fileCount} files)${attestCommit ? `, Attest commit \`${attestCommit.slice(0, 12)}\`${trackedChangesUncommitted ? " with uncommitted tracked changes" : ""}` : ""}.`,
    "",
    `**${record.summary.caught} of ${record.summary.injected} injected defects caught; ${record.summary.held} of ${record.summary.controls} controls held; real state ${record.summary.restored ? "restored" : "NOT restored"}.**`,
    "",
    "| # | Injected defect | Gate | Caught | Consequence |",
    "|---:|---|---|:---:|---|",
    ...record.rows.map((r) => `| ${r.n} | ${r.control ? "*(control)* " : ""}${esc(r.defect)} | ${esc(r.gate)} | ${r.caught ? "yes" : "**NO**"} | ${esc(r.consequence)} |`),
    "",
  ].join("\n");
  await writeFile(join(PROVE_GATES_DIR, "prove-gates.md"), md);
  return rel(PROVE_GATES_PATH);
}
