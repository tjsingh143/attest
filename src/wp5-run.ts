/**
 * Attest — `attest wp5` and `attest verify-finding` (D3.57).
 *
 * Writes, and only when every check in buildWp5 holds:
 *   evidence/runs/<wp3 run>/wp5/findings.{json,md}   the evidence-store copy
 *   FINDINGS.md                                      the same, at the root (brief §6)
 *   CP4_PACKET.md                                    the checkpoint packet
 *   rubric/wp5-author-narratives.json                created blank if absent;
 *                                                    never overwritten
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import { buildWp5, blankNarratives, renderFindings, verifyItem, CP4_PACKET_PATH, FINDINGS_PATH, NARRATIVES_PATH, type ItemVerification } from "./wp5-findings.ts";
import { renderCp4Packet } from "./cp4-packet.ts";
import { WP5_ITEMS } from "./wp5-guidance.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Why an earlier official run is not the result — the facts D3.55 records,
 * shown beside whatever the run's own file and validation say.
 */
const RUN_NOTES: Readonly<Record<string, string>> = {
  "20260924T203033Z-5695a4c3df2d": "complete (345 records) but superseded: its validation fails one check (three F9 server-side records carry no read-back identity), and an Attest heuristic defect turned eleven F10 audit absences into `not_as_predicted` (D3.55)",
  "20260925T010904Z-5695a4c3df2d": "aborted after 55 records: a `supabase db reset` failed while the CLI restarted containers on a heavily loaded host (D3.55)",
};

async function exists(path: string): Promise<boolean> {
  try { await readFile(path); return true; } catch { return false; }
}

export async function writeWp5(opts: { wp3RunId: string; planRunId: string; wp4RunId: string | null; log: (s: string) => void }): Promise<{ ok: boolean }> {
  const r = await buildWp5(opts);
  if (r.problems.length) {
    opts.log("WP5 REFUSED — the findings would not match the evidence:");
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
    WARNING: "WP5 findings. Arc21 is a read-only target: nothing here was remediated or closed. Titles, explanations and remediation options are AI-drafted for the author's review; the author's narrative is merged from rubric/wp5-author-narratives.json.",
    wp3RunId: r.wp3RunId, wp4RunId: r.wp4RunId, totals: r.totals,
    items: r.items.map((i) => ({
      id: i.id, key: i.key, part: i.part, title: i.title, tier: i.tier, tierBasis: i.tierBasis, exposure: i.exposure,
      evidenceClass: i.evidenceClass, testIds: i.testIds, supportingTestIds: i.supportingTestIds, bullets: i.bullets,
      approvedEscalations: i.approvedEscalations, drift: i.drift, author: i.author,
      whatHappened: i.spec.whatHappened, whyItMatters: i.spec.whyItMatters, contrary: i.spec.contrary ?? [],
      limitations: i.spec.limitations, judgment: i.spec.judgment, remediation: i.spec.remediation, verification: i.spec.verification,
    })),
  };
  await writeFile(join(dir, "findings.json"), JSON.stringify(json, null, 2) + "\n");
  await writeFile(join(dir, "findings.md"), md);
  await writeFile(FINDINGS_PATH, md);

  const validation = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp3RunId, "wp3-validation.json"), "utf8")) as Rec;
  const superseded: { runId: string; why: string }[] = [];
  for (const d of (await readdir(RUNS_ROOT)).sort()) {
    if (d === opts.wp3RunId || !(await exists(join(RUNS_ROOT, d, "wp3-results.json")))) continue;
    superseded.push({ runId: d, why: RUN_NOTES[d] ?? "an earlier official run; see DECISIONS.md" });
  }
  const drift = opts.wp4RunId ? (JSON.parse(await readFile(join(RUNS_ROOT, opts.wp4RunId, "wp4", "drift.json"), "utf8")) as Rec) : null;
  await writeFile(CP4_PACKET_PATH, renderCp4Packet({ wp5: r, validation, superseded, drift, generatedAt: new Date().toISOString() }));
  opts.log(`WP5 written: ${r.items.length} items (${r.items.filter((i) => i.part === "finding").length} findings, ${r.items.filter((i) => i.part === "informational").length} informational, ${r.items.filter((i) => i.part === "limitation").length} limitations)`);
  for (const i of r.items) opts.log(`  ${i.id.padEnd(3)} ${i.tier.padEnd(6)} ${i.evidenceClass.padEnd(13)} ${String(i.testIds.length).padStart(3)}  ${i.title}`);
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
