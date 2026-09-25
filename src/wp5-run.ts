/**
 * Attest — `attest wp5` and `attest verify-finding` (D3.57).
 *
 * Writes, and only when every check in buildWp5 holds:
 *   evidence/runs/<wp3 run>/wp5/findings.{json,md}   the evidence-store copy
 *   FINDINGS.md                                      the same, at the root (brief §6)
 *   CP4_PACKET.md                                    the checkpoint packet; once the
 *                                                    author's reply is recorded, the
 *                                                    CP4 record (D3.59)
 *   rubric/wp5-author-narratives.json                created blank if absent;
 *                                                    never overwritten
 *
 * The official runs are the author's decision (CP4, J14) and are read from
 * rubric/official-runs.json, as is why each earlier run is not the result.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { buildWp5, blankNarratives, renderFindings, statusSummary, verifyItem, CP4_PACKET_PATH, FINDINGS_PATH, NARRATIVES_PATH, type ItemVerification } from "./wp5-findings.ts";
import { renderCp4Packet } from "./cp4-packet.ts";
import { WP5_ITEMS } from "./wp5-guidance.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const OFFICIAL_RUNS_PATH = join(ATTEST_ROOT, "rubric", "official-runs.json");

/** The author's selection of official runs (J14), and why each other run is not a result. */
export interface OfficialRuns {
  readonly wp3: string;
  readonly plan: string;
  readonly wp4: string;
  readonly frozenCp3: string;
  readonly decidedBy: string;
  readonly notResults: readonly { readonly runId: string; readonly kind: string; readonly disposition: string; readonly why: string }[];
}

export async function loadOfficialRuns(): Promise<OfficialRuns> {
  return JSON.parse(await readFile(OFFICIAL_RUNS_PATH, "utf8")) as OfficialRuns;
}

async function exists(path: string): Promise<boolean> {
  try { await readFile(path); return true; } catch { return false; }
}

export async function writeWp5(opts: { wp3RunId: string; planRunId: string; wp4RunId: string | null; log: (s: string) => void }): Promise<{ ok: boolean }> {
  const r = await buildWp5(opts);
  if (r.problems.length) {
    opts.log("WP5 REFUSED — the findings would not match the evidence or the author's recorded reply:");
    for (const p of r.problems) opts.log(`  - ${p}`);
    return { ok: false };
  }
  if (!(await exists(NARRATIVES_PATH))) {
    await writeFile(NARRATIVES_PATH, JSON.stringify(blankNarratives(), null, 2) + "\n");
    opts.log(`  created ${NARRATIVES_PATH} — every entry awaiting the author`);
  }
  const md = renderFindings(r);
  const dir = join(RUNS_ROOT, opts.wp3RunId, "wp5");
  await mkdir(dir, { recursive: true });
  const json = {
    WARNING: "WP5 findings. Arc21 is a read-only target: nothing here was remediated or closed. Titles, explanations, remediation options, the audit-trail scope and the notes on each CP4 decision are AI-drafted; every status, judgment and the CP4 approval is the author's decision; the narratives and answers are AI-assisted wording the author reviewed and adopted (Amendment A2), merged verbatim from rubric/cp4-author-response.json.",
    wp3RunId: r.wp3RunId, wp4RunId: r.wp4RunId, totals: r.totals,
    cp4: r.cp4 ? { approval: r.cp4.approval, recordedFrom: r.cp4.recordedFrom, provenance: r.cp4.provenance } : null,
    statusSummary: statusSummary(r),
    auditScope: r.auditScope,
    general: r.cp4General,
    items: r.items.map((i) => ({
      id: i.id, key: i.key, part: i.part, title: i.title, tier: i.tier, tierBasis: i.tierBasis, exposure: i.exposure,
      evidenceClass: i.evidenceClass, testIds: i.testIds, supportingTestIds: i.supportingTestIds, bullets: i.bullets,
      approvedEscalations: i.approvedEscalations, drift: i.drift, author: i.author, cp4Judgments: i.cp4Judgments,
      whatHappened: i.spec.whatHappened, whyItMatters: i.spec.whyItMatters, contrary: i.spec.contrary ?? [],
      limitations: i.spec.limitations, judgment: i.spec.judgment, cp4Notes: i.spec.cp4Notes ?? [],
      remediation: i.spec.remediation, verification: i.spec.verification,
    })),
  };
  await writeFile(join(dir, "findings.json"), JSON.stringify(json, null, 2) + "\n");
  await writeFile(join(dir, "findings.md"), md);
  await writeFile(FINDINGS_PATH, md);

  const validation = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp3RunId, "wp3-validation.json"), "utf8")) as Rec;
  const official = await loadOfficialRuns();
  const why = new Map(official.notResults.map((n) => [n.runId, n.why]));
  const superseded: { runId: string; why: string }[] = [];
  for (const d of (await readdir(RUNS_ROOT)).sort()) {
    if (d === opts.wp3RunId || !(await exists(join(RUNS_ROOT, d, "wp3-results.json")))) continue;
    superseded.push({ runId: d, why: why.get(d) ?? "an earlier official run; see DECISIONS.md" });
  }
  const drift = opts.wp4RunId ? (JSON.parse(await readFile(join(RUNS_ROOT, opts.wp4RunId, "wp4", "drift.json"), "utf8")) as Rec) : null;
  const supersededWp4: { runId: string; why: string }[] = [];
  for (const d of (await readdir(RUNS_ROOT)).sort()) {
    if (!d.endsWith("-wp4") || d === opts.wp4RunId) continue;
    supersededWp4.push({ runId: d, why: why.get(d) ?? "an earlier WP4 run; see DECISIONS.md D3.56" });
  }
  await writeFile(CP4_PACKET_PATH, renderCp4Packet({ wp5: r, validation, superseded, supersededWp4, drift, generatedAt: new Date().toISOString() }));
  opts.log(`WP5 written: ${r.items.length} items (${r.items.filter((i) => i.part === "finding").length} findings, ${r.items.filter((i) => i.part === "informational").length} informational, ${r.items.filter((i) => i.part === "limitation").length} limitations)`);
  for (const i of r.items) opts.log(`  ${i.id.padEnd(3)} ${i.tier.padEnd(6)} ${i.evidenceClass.padEnd(13)} ${String(i.testIds.length).padStart(3)}  ${(i.author.status ?? (i.part === "limitation" ? "not_measured" : "pending")).padEnd(22)} ${i.title}`);
  opts.log(`  CP4: ${r.cp4 ? `${r.cp4.approval.CP4} (the author's reply, recorded)` : "not answered"}`);
  opts.log(`  FINDINGS.md, CP4_PACKET.md, evidence/runs/${opts.wp3RunId}/wp5/`);
  return { ok: true };
}

export async function verifyFindingCommand(key: string, official: string, candidate: string): Promise<ItemVerification> {
  const spec = WP5_ITEMS.find((s) => s.key === key);
  if (!spec) return { item: key, verified: false, lines: [`no WP5 item "${key}"; items: ${WP5_ITEMS.map((s) => s.key).join(", ")}`] };
  const load = async (id: string) => (JSON.parse(await readFile(join(RUNS_ROOT, id, "wp3-results.json"), "utf8")) as Rec).records as Rec[];
  let validated = false;
  try { validated = (JSON.parse(await readFile(join(RUNS_ROOT, candidate, "wp3-validation.json"), "utf8")) as Rec).passed === true; } catch { /* none */ }
  return verifyItem(spec, await load(official), await load(candidate), validated);
}
