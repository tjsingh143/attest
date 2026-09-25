/**
 * Attest — `attest wp6` (D3.60): build the framework mapping and the CSA note from
 * the official evidence, refuse on any failed check, write them, validate the
 * written files independently, and record CP5 as superseded by Amendment A2 with
 * the validation's outcome.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import { computeFacts, loadEvidence } from "./evidence-facts.ts";
import { buildCsaNote, buildEntries, buildMappingFile, checkCsaNote, checkMappings, CP5_RECORD_PATH, loadSources, renderCp5Record, SUPPORT_TEXT, writeWp6Outputs } from "./wp6-mapping.ts";
import { validateWp6 } from "./wp6-validate.ts";

export async function runWp6(log: (s: string) => void): Promise<{ ok: boolean }> {
  const ev = await loadEvidence();
  const f = computeFacts(ev);
  const sources = await loadSources();
  const entries = buildEntries(ev, f, sources);
  const note = buildCsaNote(f, sources);
  const problems = [...checkMappings(entries, ev.records, sources), ...checkCsaNote(note)];
  if (problems.length) {
    log("WP6 REFUSED — the mapping or the CSA note does not match the evidence or the rules:");
    for (const p of problems) log(`  - ${p}`);
    return { ok: false };
  }
  const file = buildMappingFile(ev, f, sources, entries);
  const dir = await writeWp6Outputs(file, note, f.runs.wp3);
  for (const e of entries) log(`  ${e.framework.padEnd(22)} ${e.id.padEnd(10)} ${SUPPORT_TEXT[e.support].padEnd(30)} ${e.evidence.testIds.length ? `${e.evidence.counts.total} records` : "-"}${e.evidence.artifacts.length ? ` + ${e.evidence.artifacts.map((a) => a.artifact).join(", ")}` : ""}`);
  log(`  written: framework-mapping.json, FRAMEWORK_MAPPING.md, CSA_NOTE.md (copies in ${dir.replace(/^.*evidence/, "evidence")})`);

  const v = await validateWp6(f.runs.wp3);
  log(`\n  independent validation (validate-wp6):`);
  for (const c of v.checks) log(`    ${c.passed ? "ok  " : "FAIL"} ${c.name}\n         ${c.detail.slice(0, 240)}`);
  log(`  VALIDATION ${v.passed ? "PASSED" : "FAILED"} — ${v.checks.filter((c) => c.passed).length} of ${v.checks.length}`);

  const cp5 = renderCp5Record(file, v, note, f.wp5.cp4Date || "2026-09-25");
  await writeFile(CP5_RECORD_PATH, cp5);
  await writeFile(join(RUNS_ROOT, f.runs.wp3, "wp6", "CP5_RECORD.md"), cp5);
  log(`  CP5_RECORD.md written — CP5 recorded as superseded by Amendment A2 (not approved)`);
  return { ok: v.passed };
}
