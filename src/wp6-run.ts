/**
 * Attest — `attest wp6` (D3.60): build the framework mapping and the CSA note from
 * the official evidence, refuse on any failed check, write them, validate the
 * written files independently, and record CP5 as superseded by Amendment A2 with
 * the validation's outcome.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import { computeFacts, loadEvidence, type Evidence, type Facts } from "./evidence-facts.ts";
import { FRAMEWORK_SOURCES_PATH } from "./framework-sources.ts";
import {
  buildCsaNote, buildEntries, buildMappingFile, checkCsaNote, checkMappings, CP5_RECORD_PATH, CSA_NOTE_PATH, loadSources,
  MAPPING_JSON_PATH, MAPPING_MD_PATH, renderCp5Record, renderMapping, SUPPORT_TEXT, type MappingEntry,
} from "./wp6-mapping.ts";
import { validateWp6, validateWp6Loaded, type Wp6Validation } from "./wp6-validate.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Every file `attest wp6` writes, built in memory (D3.61): the mapping, the CSA note,
 * their evidence-store copies, the independent validation of exactly those bytes, and
 * the CP5 record that reports it. `runWp6` writes the map; `attest reports` and
 * `validate-reports` build the same map to write, or to compare with disk.
 */
export async function buildWp6Files(ev?: Evidence, f?: Facts): Promise<{ problems: readonly string[]; files: Map<string, string>; entries: readonly MappingEntry[]; validation: Wp6Validation | null }> {
  const evidence = ev ?? (await loadEvidence());
  const facts = f ?? computeFacts(evidence);
  const sources = await loadSources();
  const entries = buildEntries(evidence, facts, sources);
  const note = buildCsaNote(facts, sources);
  const files = new Map<string, string>();
  const problems = [...checkMappings(entries, evidence.records, sources), ...checkCsaNote(note)];
  if (problems.length) return { problems, files, entries, validation: null };
  const file = buildMappingFile(evidence, facts, sources, entries);
  const json = JSON.stringify(file, null, 2) + "\n";
  const md = renderMapping(file);
  const dir = join(RUNS_ROOT, facts.runs.wp3, "wp6");
  // The validator reads the bytes that will be written, parsed the way it parses them from disk.
  const sourcesRaw = JSON.parse(await readFile(FRAMEWORK_SOURCES_PATH, "utf8")) as Rec;
  const validation = validateWp6Loaded(JSON.parse(json) as Rec, note.markdown, sourcesRaw, evidence.records);
  const cp5 = renderCp5Record(file, validation, note, facts.wp5.cp4Date || "2026-09-25");
  files.set(MAPPING_JSON_PATH, json);
  files.set(MAPPING_MD_PATH, md);
  files.set(CSA_NOTE_PATH, note.markdown);
  files.set(join(dir, "framework-mapping.json"), json);
  files.set(join(dir, "FRAMEWORK_MAPPING.md"), md);
  files.set(join(dir, "CSA_NOTE.md"), note.markdown);
  files.set(join(dir, "wp6-validation.json"), JSON.stringify({ wp3RunId: facts.runs.wp3, ...validation }, null, 2) + "\n");
  files.set(CP5_RECORD_PATH, cp5);
  files.set(join(dir, "CP5_RECORD.md"), cp5);
  return { problems: [], files, entries, validation };
}

export async function runWp6(log: (s: string) => void): Promise<{ ok: boolean }> {
  const ev = await loadEvidence();
  const f = computeFacts(ev);
  const built = await buildWp6Files(ev, f);
  if (built.problems.length) {
    log("WP6 REFUSED — the mapping or the CSA note does not match the evidence or the rules:");
    for (const p of built.problems) log(`  - ${p}`);
    return { ok: false };
  }
  await mkdir(join(RUNS_ROOT, f.runs.wp3, "wp6"), { recursive: true });
  for (const [path, content] of built.files) await writeFile(path, content);
  for (const e of built.entries) log(`  ${e.framework.padEnd(22)} ${e.id.padEnd(10)} ${SUPPORT_TEXT[e.support].padEnd(30)} ${e.evidence.testIds.length ? `${e.evidence.counts.total} records` : "-"}${e.evidence.artifacts.length ? ` + ${e.evidence.artifacts.map((a) => a.artifact).join(", ")}` : ""}`);
  log(`  written: framework-mapping.json, FRAMEWORK_MAPPING.md, CSA_NOTE.md (copies in evidence/runs/${f.runs.wp3}/wp6)`);

  // Re-read what was written, independently of the in-memory build.
  const v = await validateWp6(f.runs.wp3);
  log(`\n  independent validation (validate-wp6):`);
  for (const c of v.checks) log(`    ${c.passed ? "ok  " : "FAIL"} ${c.name}\n         ${c.detail.slice(0, 240)}`);
  log(`  VALIDATION ${v.passed ? "PASSED" : "FAILED"} — ${v.checks.filter((c) => c.passed).length} of ${v.checks.length}`);
  if (JSON.stringify(v) !== JSON.stringify(built.validation)) {
    log("  !! the validation of the written files differs from the validation of the bytes before writing");
    return { ok: false };
  }
  log(`  CP5_RECORD.md written — CP5 recorded as superseded by Amendment A2 (not approved)`);
  return { ok: v.passed };
}
