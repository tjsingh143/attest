/**
 * Attest — `attest validate-wp6`: the framework mapping checked by code that did
 * not write it (D3.60).
 *
 * Reads only persisted files — framework-mapping.json, CSA_NOTE.md, the pinned
 * framework sources, and the official run's raw records — and re-derives, with its
 * own selection and counting, every citation and count the mapping states. It does
 * not import the generator's fact computation (evidence-facts.ts) or its selector
 * resolution, so a counting or selection mistake there cannot validate itself. It
 * shares only the overclaiming lint, which is a rule set, and which prove-gates
 * breaks separately.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { lintClaims, wordCount } from "./claims-lint.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Check { readonly name: string; readonly passed: boolean; readonly detail: string }
export interface Wp6Validation { readonly passed: boolean; readonly checks: readonly Check[] }

const VERDICTS = ["effective", "deficient", "gap", "characterized", "not_measured"];
const BRIEF = ["AC-2", "AC-3", "AC-6", "AC-24", "AU-2", "AU-3", "AU-12", "CM-3", "SI-7", "11.10(d)", "11.10(e)", "11.10(g)", "11.300"];

/** This validator's own reading of a selector — deliberately not the generator's. */
function select(sel: Rec, recs: readonly Rec[]): string[] {
  if (typeof sel.family === "string") return recs.filter((r) => String(r.family).split(" ")[0] === sel.family).map((r) => String(r.testId));
  if (typeof sel.controlIdSuffix === "string") return recs.filter((r) => String(r.controlId).endsWith(sel.controlIdSuffix)).map((r) => String(r.testId));
  if (typeof sel.testIdPrefix === "string") return recs.filter((r) => String(r.testId).startsWith(sel.testIdPrefix)).map((r) => String(r.testId));
  if (Array.isArray(sel.testIds)) return (sel.testIds as string[]).filter((t) => recs.some((r) => r.testId === t));
  return [];
}

function tally(ids: readonly string[], byId: ReadonlyMap<string, Rec>): Record<string, number> {
  const c: Record<string, number> = { effective: 0, deficient: 0, gap: 0, characterized: 0, not_measured: 0, total: ids.length };
  for (const t of ids) c[String(byId.get(t)?.verdict)] = (c[String(byId.get(t)?.verdict)] ?? 0) + 1;
  return c;
}

/** Pure: prove-gates hands it a tampered mapping. */
export function validateWp6Loaded(m: Rec, note: string, sources: Rec, recs: readonly Rec[]): Wp6Validation {
  const checks: Check[] = [];
  const add = (name: string, bad: string[], ok: string) => checks.push({ name, passed: bad.length === 0, detail: bad.length ? bad.slice(0, 8).join(" | ") : ok });
  const byId = new Map(recs.map((r) => [String(r.testId), r]));
  const entries = (m.mappings ?? []) as Rec[];

  add("the mapping says what it is: a study exercise, AI-drafted rationale",
    [
      ...(/study/i.test(String(m.exercise)) ? [] : ["exercise is not labelled a study"]),
      ...(/^ai_drafted\b/.test(String(m.provenance)) ? [] : ["file provenance is not AI-drafted"]),
      ...entries.filter((e) => !/^ai_drafted\b/.test(String(e.provenance))).map((e) => `${e.key}: provenance not AI-drafted`),
    ], `${entries.length} entries, all labelled ai_drafted`);

  add("every provision in the brief's minimum list is present (mapped or explicitly not mapped)",
    BRIEF.filter((id) => !entries.some((e) => String(e.id).replace(/^§/, "") === id)).map((id) => `${id} missing`), `${BRIEF.length} of ${BRIEF.length}`);

  const quoteBad: string[] = [];
  for (const e of entries) {
    const [fw, id] = String(e.key).split(":", 2) as [string, string];
    const src = fw === "NIST" ? sources.nist?.controls?.[id]?.statement : sources.part11?.paragraphs?.[id] ? [sources.part11.paragraphs[id].text] : undefined;
    if (!src) quoteBad.push(`${e.key}: no source text`);
    else if (JSON.stringify(src) !== JSON.stringify(e.statement)) quoteBad.push(`${e.key}: statement differs from the source`);
    const title = fw === "NIST" ? sources.nist?.controls?.[id]?.title : sources.part11?.paragraphs?.[id]?.heading;
    if (title !== e.title) quoteBad.push(`${e.key}: title differs from the source`);
  }
  add("every quoted statement and title is the pinned source text, verbatim", quoteBad, "all verbatim");

  const citeBad: string[] = [];
  for (const e of entries) {
    for (const s of (e.evidence?.selectors ?? []) as Rec[]) {
      const mine = select(s.selector, recs);
      if (!mine.length) citeBad.push(`${e.key}: ${JSON.stringify(s.selector)} selects nothing`);
      if (JSON.stringify(mine) !== JSON.stringify(s.testIds)) citeBad.push(`${e.key}: ${JSON.stringify(s.selector)} lists ${s.testIds.length} Test IDs; the records give ${mine.length}`);
      if (JSON.stringify(tally(mine, byId)) !== JSON.stringify(s.counts)) citeBad.push(`${e.key}: ${JSON.stringify(s.selector)} counts differ from the records`);
    }
    const union = [...new Set(((e.evidence?.selectors ?? []) as Rec[]).flatMap((s) => select(s.selector, recs)))];
    if (JSON.stringify(union) !== JSON.stringify(e.evidence?.testIds)) citeBad.push(`${e.key}: its Test ID list is not the union of its selectors`);
    if (JSON.stringify(tally(union, byId)) !== JSON.stringify(e.evidence?.counts)) citeBad.push(`${e.key}: its verdict counts are not the records'`);
    for (const t of (e.evidence?.testIds ?? []) as string[]) if (!byId.has(t)) citeBad.push(`${e.key}: ${t} is not in the official run`);
  }
  add("every cited Test ID is in the official run, and every count is recomputed from the raw records", citeBad, `${entries.reduce((n, e) => n + ((e.evidence?.testIds ?? []) as string[]).length, 0)} citations re-derived`);

  const supBad: string[] = [];
  for (const e of entries) {
    const c = tally((e.evidence?.testIds ?? []) as string[], byId);
    const cites = ((e.evidence?.testIds ?? []) as string[]).length + ((e.evidence?.artifacts ?? []) as Rec[]).length;
    if (!["evidenced", "partial", "not_mapped"].includes(String(e.support))) supBad.push(`${e.key}: unknown support ${e.support}`);
    if (e.support === "not_mapped" && cites) supBad.push(`${e.key}: not mapped yet cites evidence`);
    if (e.support !== "not_mapped" && !cites) supBad.push(`${e.key}: ${e.support} without evidence`);
    if (e.support === "evidenced") {
      if (c.deficient || c.gap) supBad.push(`${e.key}: evidenced with ${c.deficient} deficient / ${c.gap} gap cited`);
      if (!c.total) supBad.push(`${e.key}: evidenced without test records`);
      if (String(e.key).startsWith("P11:")) supBad.push(`${e.key}: Part 11 above partial`);
      if (e.subject === "attest") supBad.push(`${e.key}: an Attest activity above partial`);
    }
    if (!((e.doesNotDemonstrate ?? []) as string[]).length) supBad.push(`${e.key}: no "does not demonstrate"`);
  }
  add("support levels follow the rules (evidenced only with no deficient or gap record; Part 11 and Attest's activities at most partial; not mapped cites nothing)", supBad, "all within the rules");

  const lint = entries.flatMap((e) => lintClaims([e.relevance, ...(e.demonstrates ?? []), ...(e.doesNotDemonstrate ?? []), ...(e.limitations ?? []), e.arguable ?? "", e.adjacent ?? ""].join("\n"), String(e.key)));
  add("no mapping text claims compliance, validation, certification or independence", lint.map((l) => `${l.where}: ${l.sentence}`), "clean");

  const shortBad: string[] = [];
  for (const e of entries) {
    const text = [e.relevance, ...(e.demonstrates ?? []), ...(e.doesNotDemonstrate ?? []), ...(e.limitations ?? []), e.arguable ?? "", e.adjacent ?? ""].join("\n");
    for (const mm of text.matchAll(/\b((?:F\d+[mi]?)|B)\.(\d{3})\b/g)) {
      const code = mm[1]!.replace(/[mi]$/, "");
      if (!recs.some((r) => String(r.family).split(" ")[0] === code && String(r.testId).endsWith(`.${mm[2]}`))) shortBad.push(`${e.key}: ${mm[0]}`);
    }
  }
  add("every Test ID named in the prose exists in the official run", shortBad, "all resolve");

  const claimsPart = note.split(/^## What it would not cover/m)[0]!.split(/^## What it could serve as/m)[1] ?? "";
  const limitsPart = note.split(/^## What it would not cover/m)[1] ?? "";
  const noteBad: string[] = [];
  if (!claimsPart.trim() || !limitsPart.trim()) noteBad.push("CSA note: claims or limitations section missing");
  if (wordCount(limitsPart) <= wordCount(claimsPart)) noteBad.push(`CSA note: limitations ${wordCount(limitsPart)} words, claims ${wordCount(claimsPart)}`);
  if (wordCount(note) > 650) noteBad.push(`CSA note: ${wordCount(note)} words, more than a page`);
  for (const [g, re] of [["intended use", /intended use/i], ["supplier assessment", /supplier assessment/i], ["change control", /change-control|change control/i], ["qualification of the harness", /qualification of the harness|validated tool/i]] as const) if (!re.test(limitsPart)) noteBad.push(`CSA note: gap "${g}" not named`);
  if (!/AI-drafted/.test(note)) noteBad.push("CSA note: not labelled AI-drafted");
  noteBad.push(...lintClaims(note, "CSA_NOTE.md").map((l) => `CSA_NOTE.md: ${l.sentence}`));
  add("the CSA note is one page, names the four gaps, and its limitations are longer than its claims", noteBad, `claims ${wordCount(claimsPart)} words, limitations ${wordCount(limitsPart)}, total ${wordCount(note)}`);

  const vBad = recs.filter((r) => !VERDICTS.includes(String(r.verdict))).map((r) => String(r.testId));
  add("every record carries a known verdict (not_measured is never counted as effective)", vBad, `${recs.length} records`);

  return { passed: checks.every((c) => c.passed), checks };
}

export async function validateWp6(wp3RunId: string): Promise<Wp6Validation> {
  const m = JSON.parse(await readFile(join(ATTEST_ROOT, "framework-mapping.json"), "utf8")) as Rec;
  const note = await readFile(join(ATTEST_ROOT, "CSA_NOTE.md"), "utf8");
  const sources = JSON.parse(await readFile(join(ATTEST_ROOT, "rubric", "framework-sources.json"), "utf8")) as Rec;
  const recs = (JSON.parse(await readFile(join(RUNS_ROOT, wp3RunId, "wp3-results.json"), "utf8")) as Rec).records as Rec[];
  if (m.evidence?.wp3Run !== wp3RunId) {
    return { passed: false, checks: [{ name: "the mapping is built from the official run", passed: false, detail: `mapping built from ${m.evidence?.wp3Run}, official run is ${wp3RunId}` }] };
  }
  const v = validateWp6Loaded(m, note, sources, recs);
  await writeFile(join(RUNS_ROOT, wp3RunId, "wp6", "wp6-validation.json"), JSON.stringify({ wp3RunId, ...v }, null, 2) + "\n");
  return v;
}
