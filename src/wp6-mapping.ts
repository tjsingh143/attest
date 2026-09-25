/**
 * Attest — WP6: build, check and write the framework mapping, the CSA note and the
 * CP5 record (D3.60). A STUDY / CONTROL-MAPPING EXERCISE; see wp6-framework.ts.
 *
 * Writes (only when every check holds):
 *   framework-mapping.json          the machine-readable mapping (brief §6)
 *   FRAMEWORK_MAPPING.md            the same, for reading
 *   CSA_NOTE.md                     the one-page CSA note: claims, then the longer limitations
 *   CP5_RECORD.md                   CP5, superseded by Amendment A2 — never "approved"
 *   evidence/runs/<wp3 run>/wp6/    copies, and the independent validation
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { countVerdicts, familyCode, FAMILIES, type Evidence, type Facts, type VerdictCounts } from "./evidence-facts.ts";
import { FRAMEWORK_SOURCES_PATH, type FrameworkSources } from "./framework-sources.ts";
import { MAPPINGS, BRIEF_MINIMUM, type Artifact, type FrameworkMappingSpec, type RecordSelector, type Support } from "./wp6-framework.ts";
import { lintClaims, wordCount, type LintProblem } from "./claims-lint.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAPPING_JSON_PATH = join(ATTEST_ROOT, "framework-mapping.json");
export const MAPPING_MD_PATH = join(ATTEST_ROOT, "FRAMEWORK_MAPPING.md");
export const CSA_NOTE_PATH = join(ATTEST_ROOT, "CSA_NOTE.md");
export const CP5_RECORD_PATH = join(ATTEST_ROOT, "CP5_RECORD.md");
export const PROVENANCE = "ai_drafted — rationale, demonstrates, does-not-demonstrate, limitations and arguable notes drafted by AI (Claude) under Amendment A2; not written by the author";

export const SUPPORT_TEXT: Readonly<Record<Support, string>> = {
  evidenced: "evidenced (tested paths only)",
  partial: "partial",
  not_mapped: "not mapped",
};

export interface MappingEntry {
  readonly key: string;
  readonly framework: string;
  readonly id: string;
  readonly title: string;
  readonly statement: readonly string[];
  readonly source: string;
  readonly inBriefMinimum: boolean;
  readonly subject: "arc21" | "attest";
  readonly support: Support;
  readonly evidence: {
    readonly selectors: readonly { readonly selector: RecordSelector; readonly testIds: readonly string[]; readonly counts: VerdictCounts }[];
    readonly testIds: readonly string[];
    readonly counts: VerdictCounts;
    readonly artifacts: readonly { readonly artifact: Artifact; readonly summary: string }[];
  };
  readonly relevance: string;
  readonly demonstrates: readonly string[];
  readonly doesNotDemonstrate: readonly string[];
  readonly limitations: readonly string[];
  readonly arguable: string | null;
  readonly adjacent: string | null;
  readonly provenance: string;
}

export interface MappingFile {
  readonly WARNING: string;
  readonly exercise: string;
  readonly provenance: string;
  readonly evidence: { readonly wp3Run: string; readonly planRun: string; readonly wp4Run: string; readonly frozenCp3Run: string };
  readonly sources: { readonly nist: string; readonly nistVersion: string; readonly part11: string; readonly part11AsOf: string; readonly retrievedOn: string };
  readonly supportLevels: Readonly<Record<Support, string>>;
  readonly mappings: readonly MappingEntry[];
  readonly byFamily: readonly { readonly family: string; readonly name: string; readonly counts: VerdictCounts; readonly mappedTo: readonly string[] }[];
}

/** The records one selector names. A selector that names nothing is a broken citation. */
export function resolveSelector(sel: RecordSelector, records: readonly Rec[]): Rec[] {
  if ("family" in sel) return records.filter((r) => familyCode(r) === sel.family);
  if ("controlIdSuffix" in sel) return records.filter((r) => String(r.controlId).endsWith(sel.controlIdSuffix));
  if ("testIdPrefix" in sel) return records.filter((r) => String(r.testId).startsWith(sel.testIdPrefix));
  return sel.testIds.map((id) => records.find((r) => r.testId === id)).filter((r): r is Rec => !!r);
}

export function artifactSummary(a: Artifact, f: Facts): string {
  switch (a) {
    case "wp0-inventory":
      return `WP0 inventory (run \`${f.runs.frozenCp3}\`): ${f.wp0.resources} resources, ${f.wp0.controls} (resource, control) pairs, ${f.wp0.policies} policies, ${f.wp0.definerFunctions} SECURITY DEFINER functions (${f.wp0.definerClientCallable} callable by a client role), ${f.wp0.roles} roles (${f.wp0.rolesBypassRls.length} with BYPASSRLS); row-level security enabled on ${f.wp0.rlsEnabled} of ${f.wp0.tables} tables and forced on ${f.wp0.rlsForced}.`;
    case "wp1-validation":
      return `WP1 harness validation (run \`${f.runs.frozenCp3}\`): ${f.wp1.detected} of ${f.wp1.scenarios} deliberately broken controls detected and ${f.wp1.restored} restored; over-privileged connections told intact from broken in ${f.wp1.overPrivilegedDiscriminated} of ${f.wp1.overPrivilegedChecks} checks; the testing login ${f.wp1.canSetServiceRole ? "can" : "cannot"} switch into service_role.`;
    case "wp3-validation":
      return `Independent validation of the official WP3 run (\`${f.runs.wp3}\`): ${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks} checks passed.`;
    case "wp4-drift":
      return `WP4 drift run \`${f.runs.wp4}\`: ${f.wp4.states.length} schema states (${f.wp4.states.map((s) => `${s.name}, ${s.migrationCount} migrations`).join("; ")}), every state exit ${[...new Set(f.wp4.states.map((s) => s.exit))].join("/")}.`;
    case "wp5-audit-scope":
      return f.wp5.scope
        ? `The author's J3/J4 rule applied to the ${f.wp5.scope.total} audit-absence resources (rubric/wp5-audit-scope.json): ${f.wp5.scope.trailRequired} require a trail, ${f.wp5.scope.excluded} excluded, ${f.wp5.scope.conditional} conditional.`
        : "No audit scope recorded.";
    case "arc21-guard":
      return `Arc21 read-only guard: fingerprint \`${f.wp3.arc21Fingerprint.slice(0, 16)}…\` ${f.wp3.arc21Unchanged ? "identical" : "NOT identical"} before and after the official run; schema version \`${f.wp3.schemaVersion.slice(0, 12)}\` (${f.wp3.migrationCount} migrations).`;
    case "cp3-tiers":
      return `Frozen WP2 tiers (run \`${f.runs.frozenCp3}\`): ${Object.entries(f.wp2.byTier).map(([t, n]) => `${n} ${t}`).join(", ")} of ${f.wp2.resources} resources.`;
  }
}

export function buildEntries(ev: Evidence, f: Facts, sources: FrameworkSources): MappingEntry[] {
  return MAPPINGS.map((m) => {
    const [fw, id] = m.ref.split(":", 2) as [string, string];
    const src = fw === "NIST"
      ? { framework: "NIST SP 800-53 Rev. 5", title: sources.nist.controls[id]?.title ?? "", statement: sources.nist.controls[id]?.statement ?? [], source: `NIST SP 800-53 Rev. 5, release ${sources.nist.catalogVersion} — NIST's OSCAL catalog, ${sources.nist.source}` }
      : { framework: "21 CFR Part 11", title: sources.part11.paragraphs[id]?.heading ?? "", statement: [sources.part11.paragraphs[id]?.text ?? ""], source: `eCFR, 21 CFR Part 11 as of ${sources.part11.pointInTime} (${sources.part11.source})` };
    const selectors = m.records.map((s) => {
      const rs = resolveSelector(s, ev.records);
      return { selector: s, testIds: rs.map((r) => String(r.testId)), counts: countVerdicts(rs) };
    });
    const ids = [...new Set(selectors.flatMap((s) => s.testIds))];
    const all = countVerdicts(ids.map((t) => ev.records.find((r) => r.testId === t)!));
    const ctx = { f, sel: (i: number) => selectors[i]!.counts, all };
    return {
      key: m.ref, framework: src.framework, id: fw === "P11" ? `§${id}` : id, title: src.title, statement: src.statement, source: src.source,
      inBriefMinimum: m.inBriefMinimum, subject: m.subject, support: m.support,
      evidence: { selectors, testIds: ids, counts: all, artifacts: m.artifacts.map((a) => ({ artifact: a, summary: artifactSummary(a, f) })) },
      relevance: m.relevance, demonstrates: m.demonstrates(ctx), doesNotDemonstrate: m.doesNotDemonstrate(ctx), limitations: m.limitations(ctx),
      arguable: m.arguable ?? null, adjacent: m.adjacent ?? null, provenance: PROVENANCE,
    };
  });
}

/** Every piece of prose an entry carries, for the lint. */
export const entryText = (e: MappingEntry): string =>
  [e.relevance, ...e.demonstrates, ...e.doesNotDemonstrate, ...e.limitations, e.arguable ?? "", e.adjacent ?? ""].join("\n");

/** A short Test ID in prose ("F9.316", "B.331") must name a record of that family. */
export function shortIdProblems(text: string, records: readonly Rec[], where: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b((?:F\d+[mi]?)|B)\.(\d{3})\b/g)) {
    const [, fam, num] = m;
    const code = fam!.replace(/[mi]$/, "");
    if (!records.some((r) => familyCode(r) === code && String(r.testId).endsWith(`.${num}`))) out.push(`${where}: "${m[0]}" names no record in the official run`);
  }
  return out;
}

/**
 * The support rules, and everything else a mapping must satisfy to be written.
 * Pure, so prove-gates can hand it a broken copy.
 */
export function checkMappings(entries: readonly MappingEntry[], records: readonly Rec[], sources: FrameworkSources): string[] {
  const p: string[] = [];
  for (const k of BRIEF_MINIMUM) if (!entries.some((e) => e.key === k)) p.push(`${k}: in the brief's minimum list but not mapped or explicitly not-mapped`);
  const keys = new Set<string>();
  for (const e of entries) {
    if (keys.has(e.key)) p.push(`${e.key}: listed twice`);
    keys.add(e.key);
    const [fw, id] = e.key.split(":", 2) as [string, string];
    const quoted = fw === "NIST" ? sources.nist.controls[id]?.statement : sources.part11.paragraphs[id] ? [sources.part11.paragraphs[id]!.text] : undefined;
    if (!quoted) p.push(`${e.key}: not in rubric/framework-sources.json`);
    else if (JSON.stringify(quoted) !== JSON.stringify(e.statement)) p.push(`${e.key}: the quoted statement is not the source text verbatim`);
    for (const s of e.evidence.selectors) if (s.testIds.length === 0) p.push(`${e.key}: a selector (${JSON.stringify(s.selector)}) cites no record`);
    const recs = e.evidence.testIds.map((t) => records.find((r) => r.testId === t));
    if (recs.some((r) => !r)) p.push(`${e.key}: cites a Test ID that is not in the official run`);
    const c = countVerdicts(recs.filter((r): r is Rec => !!r));
    if (JSON.stringify(c) !== JSON.stringify(e.evidence.counts)) p.push(`${e.key}: its verdict counts are not the counts of the records it cites`);
    const hasEvidence = e.evidence.testIds.length > 0 || e.evidence.artifacts.length > 0;
    if (e.support === "not_mapped" && hasEvidence) p.push(`${e.key}: not mapped, yet it cites evidence`);
    if (e.support !== "not_mapped" && !hasEvidence) p.push(`${e.key}: ${e.support} with no evidence cited`);
    if (e.support === "evidenced") {
      if (!e.evidence.testIds.length) p.push(`${e.key}: evidenced requires test records`);
      if (c.deficient || c.gap) p.push(`${e.key}: evidenced, yet ${c.deficient} deficient and ${c.gap} gap records are cited — at most partial`);
      if (fw === "P11") p.push(`${e.key}: a Part 11 provision is never more than partial here — Arc21 keeps no Part 11 record`);
      if (e.subject === "attest") p.push(`${e.key}: an activity of Attest itself is never more than partial`);
    }
    if (!e.doesNotDemonstrate.length) p.push(`${e.key}: says nothing about what it does not demonstrate`);
    if (e.support !== "not_mapped" && !e.demonstrates.length) p.push(`${e.key}: mapped, but demonstrates nothing`);
    if (!/^ai_drafted\b/.test(e.provenance)) p.push(`${e.key}: rationale provenance is not labelled AI-drafted`);
    for (const l of lintClaims(entryText(e), e.key)) p.push(`${l.where}: ${l.why}: "${l.sentence}"`);
    p.push(...shortIdProblems(entryText(e), records, e.key));
  }
  return p;
}

// ---------------------------------------------------------------------------
// the CSA note (one page; limitations longer than claims)
// ---------------------------------------------------------------------------

export interface CsaNote { readonly markdown: string; readonly claims: string; readonly limitations: string }

export function buildCsaNote(f: Facts, sources: FrameworkSources): CsaNote {
  const findings = f.wp5.items.filter((i) => i.part === "finding");
  const open = findings.filter((i) => i.status === "open");
  const tiers = Object.entries(f.wp2.byTier).map(([t, n]) => `${n} ${t}`).join(", ");
  const claims = [
    `- **A risk-based assurance activity with a record.** The guidance asks for assurance proportionate to risk and a record of it (V.A(2), (4), (6)). Attest rates every resource with a written rubric (${tiers}), scales test depth to the tier — robust scripted testing for High, limited scripted testing for Medium — and records for each of its ${f.wp3.total} tests what was run, as whom, what was expected, what happened, when, and against which schema version.`,
    `- **Digital, automated, reproducible evidence**, which V.A(6) prefers to screenshots: every verdict is re-derived from the raw records by a separate check (${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks}), and every report is regenerated from the evidence rather than edited.`,
    `- **Issues found, each with a recorded disposition** (V.A(6)): ${f.wp5.items.filter((i) => i.part === "finding").length} findings, ${f.wp5.items.filter((i) => i.part === "informational").length} informational items and ${f.wp5.items.filter((i) => i.part === "limitation").length} limitations, each with the author's CP4 status.`,
  ].join("\n");
  const limitations = [
    "1. **No intended use (V.A(1)).** Arc21 is a personal game, not production or quality-system software, so there is no intended use in a regulated process to assess against. The rubric rates assurance priority for data access, not the process risk the guidance defines — a quality problem that could foreseeably compromise safety (V.A(2)).",
    "2. **No supplier assessment (V.A(5)).** PostgreSQL, Supabase, PostgREST and Realtime were not assessed; the platform's defaults were reported, not tested.",
    "3. **No change-control process (V.A(3)).** WP4 detects control changes after they happen. Nobody reviews, approves or re-assesses a change, and nothing requires a re-run.",
    "4. **No qualification of the harness as a validated tool.** Deliberately broken controls (WP1) and injected defects (prove-gates) show that the harness notices those specific breaks; that is not validation for an intended use, and the harness itself produced wrong output during development, each instance written up in DECISIONS.md.",
    "5. **No independent review and no signed approval (V.A(6)).** The author wrote Arc21, the harness, the plan and the expectations, and approved the findings; the framework rationale and this note are AI-drafted (Amendment A2).",
    `6. **No conclusion of acceptability, and issues unresolved.** Nothing was remediated (Amendment A1): ${open.length} findings are open, and ${f.wp3.byVerdict.not_measured} tests were not measured.`,
    "7. **Narrow scope.** Data-layer access control only, on one schema version in a disposable local database with synthetic accounts — not authentication, infrastructure, the network, the HTTP layer, or a production system.",
    "8. **Part 11.** Arc21 keeps no electronic record required by a predicate rule, so the Part 11 mapping is a study exercise and nothing here is a Part 11 control.",
  ].join("\n");
  const md = [
    "# CSA note — how this output would, and would not, serve as assurance evidence",
    "",
    `*A study note, AI-drafted under Amendment A2 and generated from the evidence; not written by the author. It is not a compliance statement, not validation and not audit experience, and Arc21 is not a regulated system.* Source: FDA, *${sources.csa.title}*, final guidance issued ${sources.csa.issued} (supersedes ${sources.csa.supersedes}), docket ${sources.csa.docket}, section V.A.`,
    "",
    "## What it could serve as",
    "",
    claims,
    "",
    "## What it would not cover",
    "",
    limitations,
    "",
  ].join("\n");
  return { markdown: md, claims, limitations };
}

/** The one-page rule: limitations longer than claims, the four named gaps present, one page. */
export function checkCsaNote(n: CsaNote): string[] {
  const p: string[] = [];
  const wc = wordCount(n.claims), wl = wordCount(n.limitations), total = wordCount(n.markdown);
  if (wl <= wc) p.push(`CSA note: the limitations (${wl} words) must be longer than the claims (${wc})`);
  if (total > 650) p.push(`CSA note: ${total} words — more than one page`);
  for (const [gap, re] of [["intended use", /intended use/i], ["supplier assessment", /supplier assessment/i], ["change control", /change-control|change control/i], ["qualification of the harness", /qualification of the harness|validated tool/i]] as const) {
    if (!re.test(n.limitations)) p.push(`CSA note: does not name the gap "${gap}" (brief WP6)`);
  }
  for (const l of lintClaims(n.markdown, "CSA_NOTE.md")) p.push(`${l.where}: ${l.why}: "${l.sentence}"`);
  return p;
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

const idList = (ids: readonly string[], max = 12) => (ids.length <= max ? ids.map((t) => `\`${t}\``).join(", ") : `${ids.slice(0, max).map((t) => `\`${t}\``).join(", ")}, … ${ids.length - max} more (all listed in framework-mapping.json)`);
const counts = (c: VerdictCounts) => `${c.total} records: ${c.effective} effective, ${c.deficient} deficient, ${c.gap} gap, ${c.characterized} characterized, ${c.not_measured} not measured`;
const describeSel = (s: RecordSelector) => ("family" in s ? `family ${s.family}` : "controlIdSuffix" in s ? `control ids ending \`${s.controlIdSuffix}\`` : "testIdPrefix" in s ? (s.testIdPrefix ? `Test IDs beginning \`${s.testIdPrefix}\`` : "every record of the run") : `${s.testIds.length} named Test ID(s)`);

export const EXERCISE_BANNER = [
  "> **A STUDY / CONTROL-MAPPING EXERCISE.** It maps technical controls tested in Arc21 — a personal application used as a test",
  "> subject, not a regulated system — to NIST SP 800-53 Rev. 5 and 21 CFR Part 11 identifiers, and says what the evidence does",
  "> and does not show. It is **not** regulatory compliance, **not** FDA validation, **not** GxP validation or computer system",
  "> validation (CSV), **not** 21 CFR Part 11 compliance, **not** a certification, and **not** an independent regulatory audit.",
  "> No statement here claims that Arc21 meets any control.",
].join("\n");

export function renderMapping(file: MappingFile): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p("# Framework mapping — Arc21 access controls to NIST SP 800-53 Rev. 5 and 21 CFR Part 11");
  p();
  p(EXERCISE_BANNER);
  p();
  p("> **Provenance.** The rationale in every entry — relevance, what it demonstrates, what it does not, limitations, and the notes on");
  p("> arguable mappings — is **AI-drafted** (Claude) under Amendment A2 and is not the author's writing. What is not drafted: each");
  p("> quoted control statement is verbatim from the primary source (`rubric/framework-sources.json`), every number is computed from");
  p("> the evidence, and every cited Test ID resolves to a record of the official run. Generated by `npm run attest wp6`; never edited.");
  p();
  p(`Evidence: official WP3 run \`${file.evidence.wp3Run}\` · WP4 run \`${file.evidence.wp4Run}\` · frozen CP1/CP3 run \`${file.evidence.frozenCp3Run}\` · planning run \`${file.evidence.planRun}\`.`);
  p(`Sources: ${file.sources.nistVersion} (${file.sources.nist}); 21 CFR Part 11 from the eCFR as of ${file.sources.part11AsOf} (${file.sources.part11}); retrieved ${file.sources.retrievedOn}.`);
  p();
  p("## Support levels");
  p();
  for (const [k, v] of Object.entries(file.supportLevels)) p(`- **${SUPPORT_TEXT[k as Support]}** — ${v}`);
  p();
  p("## Summary");
  p();
  p("| Framework | Identifier | Title | Support | Evidence | In the brief's list |");
  p("|---|---|---|---|---|:---:|");
  for (const e of file.mappings) p(`| ${e.framework} | ${e.id} | ${e.title.replace(/^§ ?[\d.]+ /, "").replace(/\.$/, "")} | ${SUPPORT_TEXT[e.support]}${e.subject === "attest" ? " (Attest's own activity)" : ""} | ${e.evidence.testIds.length ? `${e.evidence.counts.total} records (${e.evidence.counts.effective} effective${e.evidence.counts.deficient ? `, ${e.evidence.counts.deficient} deficient` : ""}${e.evidence.counts.gap ? `, ${e.evidence.counts.gap} gap` : ""}${e.evidence.counts.characterized ? `, ${e.evidence.counts.characterized} characterized` : ""}${e.evidence.counts.not_measured ? `, ${e.evidence.counts.not_measured} not measured` : ""})` : "—"}${e.evidence.artifacts.length ? `${e.evidence.testIds.length ? " + " : ""}${e.evidence.artifacts.map((a) => a.artifact).join(", ")}` : ""} | ${e.inBriefMinimum ? "yes" : "added"} |`.replace("| —wp", "| wp").replace("| — | yes |", "| none | yes |"));
  p();
  p("## By WP3 control family");
  p();
  p("| Family | Records | Mapped to |");
  p("|---|---|---|");
  for (const b of file.byFamily) p(`| ${b.family} — ${b.name} | ${b.counts.total} (${b.counts.effective} effective${b.counts.deficient ? `, ${b.counts.deficient} deficient` : ""}${b.counts.gap ? `, ${b.counts.gap} gap` : ""}${b.counts.characterized ? `, ${b.counts.characterized} characterized` : ""}${b.counts.not_measured ? `, ${b.counts.not_measured} not measured` : ""}) | ${b.mappedTo.join(", ") || "—"} |`);
  p();
  for (const e of file.mappings) {
    p(`## ${e.framework} ${e.id} — ${e.title}`);
    p();
    p(`| | |`);
    p(`|---|---|`);
    p(`| Support | **${SUPPORT_TEXT[e.support]}**${e.subject === "attest" ? " — maps an activity of Attest itself, not a control of Arc21" : ""} |`);
    p(`| In the brief's minimum list | ${e.inBriefMinimum ? "yes" : "no — added because the evidence bears on it directly"} |`);
    p(`| Evidence | ${e.evidence.testIds.length ? counts(e.evidence.counts) : "no WP3 record"}${e.evidence.artifacts.length ? `; ${e.evidence.artifacts.map((a) => a.artifact).join(", ")}` : ""} |`);
    p();
    p(`**The ${e.framework === "21 CFR Part 11" ? "provision" : "control"}, verbatim** (${e.source}):`);
    p();
    for (const s of e.statement) p(`> ${s}`);
    p();
    if (e.evidence.selectors.length) {
      p("**Records cited**");
      p();
      for (const s of e.evidence.selectors) p(`- ${describeSel(s.selector)} — ${counts(s.counts)}: ${idList(s.testIds)}`);
      p();
    }
    if (e.evidence.artifacts.length) {
      p("**Other evidence**");
      p();
      for (const a of e.evidence.artifacts) p(`- ${a.summary}`);
      p();
    }
    p("**Why it is relevant** *(AI-drafted)*");
    p();
    p(e.relevance);
    p();
    if (e.demonstrates.length) {
      p("**What the evidence demonstrates** *(AI-drafted; numbers computed from the evidence)*");
      p();
      for (const d of e.demonstrates) p(`- ${d}`);
      p();
    }
    p("**What it does not demonstrate** *(AI-drafted)*");
    p();
    for (const d of e.doesNotDemonstrate) p(`- ${d}`);
    p();
    p("**Limitations** *(AI-drafted)*");
    p();
    for (const d of e.limitations) p(`- ${d}`);
    p();
    if (e.arguable) { p(`**Why this mapping is arguable** *(AI-drafted)* — ${e.arguable}`); p(); }
    if (e.adjacent) { p(`**Adjacent results, not evidence for this entry** — ${e.adjacent}`); p(); }
  }
  return L.join("\n") + "\n";
}

export function buildMappingFile(ev: Evidence, f: Facts, sources: FrameworkSources, entries: readonly MappingEntry[]): MappingFile {
  return {
    WARNING: "A study / control-mapping exercise, generated by `npm run attest wp6`. Not compliance, not FDA validation, not GxP validation or CSV, not 21 CFR Part 11 compliance, not certification, not an independent audit; Arc21 is not a regulated system. Rationale is AI-drafted (Amendment A2); quoted texts are verbatim from rubric/framework-sources.json; counts are computed from the official evidence.",
    exercise: "study / control-mapping exercise",
    provenance: PROVENANCE,
    evidence: { wp3Run: f.runs.wp3, planRun: f.runs.plan, wp4Run: f.runs.wp4, frozenCp3Run: f.runs.frozenCp3 },
    sources: { nist: sources.nist.source, nistVersion: `${sources.nist.catalogTitle.replace(/^Electronic \(OSCAL\) Version of /, "")}`, part11: sources.part11.source, part11AsOf: sources.part11.pointInTime, retrievedOn: sources.retrievedOn },
    supportLevels: {
      evidenced: "the tested behaviour is what the statement describes and every cited record held (no deficient, no gap). Tested paths only — never a statement that the control is met.",
      partial: "the evidence bears on part of what the statement asks, or cited records include deficient or gap results, or the relationship is an analogy. Every Part 11 provision and every activity of Attest itself is capped here.",
      not_mapped: "no Attest evidence supports a mapping; nothing is cited as evidence.",
    },
    mappings: entries,
    byFamily: FAMILIES.map((fam) => ({
      family: fam.code, name: fam.name, counts: f.wp3.byFamily[fam.code]!,
      mappedTo: entries.filter((e) => e.evidence.selectors.some((s) => s.testIds.some((t) => familyCode(ev.records.find((r) => r.testId === t)!) === fam.code) && !("testIdPrefix" in s.selector && s.selector.testIdPrefix === ""))).map((e) => `${e.id}`),
    })),
  };
}

export function renderCp5Record(file: MappingFile, validation: { passed: boolean; checks: readonly { name: string; passed: boolean }[] }, note: CsaNote, a2Date: string): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  const ac3 = file.mappings.find((e) => e.key === "NIST:AC-3");
  const ac6 = file.mappings.find((e) => e.key === "NIST:AC-6");
  p("# CP5 — framework mapping and limitations: the record");
  p();
  p(`> **CP5's separate author interaction was superseded by Amendment A2 (${a2Date}), waived prospectively by the author.** The`);
  p("> framework mapping and the CSA note were generated from the evidence and independently validated, with explicit AI-assisted");
  p("> provenance. CP5 is **not** recorded as approved by the author: the author did not separately review or approve this package.");
  p("> Generated by `npm run attest wp6`; never edited by hand.");
  p();
  p("## Why the workflow differs from the brief");
  p();
  p("The brief (§9) made CP5 a stop after WP6: present the mapping and the limitations note, and have the author explain why a");
  p("control maps to AC-3 rather than AC-6 and state what the exercise is not. It also reserved every mapping rationale to the author");
  p(`(§1.1). In the reply that approved CP4, the author amended the brief (Amendment A2, ${a2Date}; DECISIONS.md D3.58): remaining`);
  p("rationale may be AI-drafted if it is labelled so, and CP5's separate interaction is waived prospectively. The record below is what");
  p("CP5 would have presented, with each answer the brief expected from the author supplied instead by AI-drafted text — labelled as such.");
  p();
  p("## The package");
  p();
  p(`- \`framework-mapping.json\` and \`FRAMEWORK_MAPPING.md\` — ${file.mappings.length} entries: ${file.mappings.filter((e) => e.support === "evidenced").length} evidenced (tested paths only), ${file.mappings.filter((e) => e.support === "partial").length} partial, ${file.mappings.filter((e) => e.support === "not_mapped").length} not mapped; ${file.mappings.filter((e) => e.inBriefMinimum).length} from the brief's minimum list, ${file.mappings.filter((e) => !e.inBriefMinimum).length} added where the evidence bears directly.`);
  p(`- \`CSA_NOTE.md\` — one page: claims ${wordCount(note.claims)} words, limitations ${wordCount(note.limitations)} words.`);
  p(`- Independent validation (\`npm run attest validate-wp6\`): **${validation.passed ? "PASSED" : "FAILED"}**, ${validation.checks.filter((c) => c.passed).length} of ${validation.checks.length} checks.`);
  p();
  p("## What CP5 would have asked, answered by the generated material *(AI-drafted)*");
  p();
  p("**Why does a given control map to AC-3 rather than AC-6?**");
  p();
  if (ac3?.arguable) p(`- ${ac3.arguable}`);
  if (ac6?.arguable) p(`- ${ac6.arguable}`);
  p();
  p("**What is this exercise not?**");
  p();
  p("- Not regulatory compliance, not FDA validation, not GxP validation or computer system validation (CSV), not 21 CFR Part 11");
  p("  compliance, not a certification, and not an independent regulatory audit.");
  p("- Not a statement that Arc21 meets any control: Arc21 is a personal application used as a test subject, not a regulated system,");
  p("  and it keeps no electronic record under an FDA predicate rule.");
  p("- Not the author's rationale: every rationale is AI-drafted under Amendment A2.");
  p("- Not evidence of the author's regulatory, validation, audit or compliance experience; the author has none, and this is a study.");
  p();
  p("## Checkpoint state");
  p();
  p("| Checkpoint | State |");
  p("|---|---|");
  p(`| CP5 | **superseded by Amendment A2** — separate human-authorship and approval interaction waived prospectively by the author (${a2Date}); package generated and ${validation.passed ? "validated" : "NOT validated"} with explicit AI-assisted provenance |`);
  p();
  return L.join("\n") + "\n";
}

export async function loadSources(): Promise<FrameworkSources> {
  return JSON.parse(await readFile(FRAMEWORK_SOURCES_PATH, "utf8")) as FrameworkSources;
}

export async function writeWp6Outputs(file: MappingFile, note: CsaNote, wp3RunId: string): Promise<string> {
  const dir = join(RUNS_ROOT, wp3RunId, "wp6");
  await mkdir(dir, { recursive: true });
  const json = JSON.stringify(file, null, 2) + "\n";
  const md = renderMapping(file);
  await writeFile(MAPPING_JSON_PATH, json);
  await writeFile(MAPPING_MD_PATH, md);
  await writeFile(CSA_NOTE_PATH, note.markdown);
  await writeFile(join(dir, "framework-mapping.json"), json);
  await writeFile(join(dir, "FRAMEWORK_MAPPING.md"), md);
  await writeFile(join(dir, "CSA_NOTE.md"), note.markdown);
  return dir;
}

export type { LintProblem };
