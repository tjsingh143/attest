/**
 * Attest — WP5: findings, risk prioritisation and remediation guidance (D3.57).
 *
 * Amendment A1 redefined WP5: consolidate the WP3 findings, rank them with the
 * FROZEN WP2 risk context and the observed evidence, give remediation
 * recommendations with their tradeoffs and exact re-verification procedures by
 * Test ID, and state plainly that nothing was remediated. The findings
 * narrative stays the author's.
 *
 * This module writes nothing it did not read:
 *
 *   evidence   the official WP3 run, which must have passed `validate-wp3`
 *   risk       the frozen CP3 tiers and ratings (cp3-tiers.json) — never
 *              re-scored; a finding's tier is its resource's frozen tier
 *   structure  the frozen WP0 inventory's structural observations
 *   drift      the WP4 run, if given: what the same Test IDs returned against
 *              Arc21's earlier schemas
 *   grouping   src/wp5-guidance.ts — AI-drafted, and checked here against the
 *              evidence: every record that is not `effective` must belong to
 *              exactly one item, each item's records must carry the verdict its
 *              prose assumes, and every record the prose calls "holding" must
 *              be `effective`. Any mismatch stops the command.
 *   narrative  rubric/wp5-author-narratives.json — the author's words and status
 *              decisions, merged in verbatim; blank until the author writes them
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import { WP5_ITEMS, confirmable, type ItemSpec, type RecordView } from "./wp5-guidance.ts";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The CP3 run whose tiers and inventory are frozen (CHECKPOINTS.md: CP1, CP3). */
export const FROZEN_CP3_RUN = "20260922T234324Z-5695a4c3df2d";
export const NARRATIVES_PATH = join(ATTEST_ROOT, "rubric", "wp5-author-narratives.json");
export const FINDINGS_PATH = join(ATTEST_ROOT, "FINDINGS.md");
export const CP4_PACKET_PATH = join(ATTEST_ROOT, "CP4_PACKET.md");

export type AuthorStatus = "open" | "accepted_design_intent" | "informational";

export interface AuthorEntry {
  readonly key: string;
  /** The author's own words, verbatim; null until written. */
  readonly narrative: string | null;
  /** The author's status decision; null until made. */
  readonly status: AuthorStatus | null;
  readonly provenance: "awaiting_author" | "user_authored";
  /** Where the words came from (a dated reply), never invented. */
  readonly recordedFrom: string | null;
}

export interface NarrativeStore {
  readonly WARNING: string;
  readonly entries: readonly AuthorEntry[];
}

const TIER_ORDER: Readonly<Record<string, number>> = { High: 0, Medium: 1, Low: 2 };
const CLASS_ORDER: Readonly<Record<string, number>> = { deficient: 0, gap: 1, characterized: 2, not_measured: 3, none: 4 };
const EXPOSURE_ORDER: Readonly<Record<string, number>> = { anonymous: 0, authenticated: 1, server_only: 2 };
const PART_ORDER: Readonly<Record<string, number>> = { finding: 0, informational: 1, limitation: 2 };
const PART_LETTER: Readonly<Record<string, string>> = { finding: "A", informational: "B", limitation: "C" };

export interface Wp5Item {
  readonly id: string;
  readonly key: string;
  readonly part: ItemSpec["part"];
  readonly title: string;
  readonly tier: string;
  readonly tierBasis: string;
  readonly exposure: string;
  readonly evidenceClass: string;
  readonly testIds: readonly string[];
  readonly supportingTestIds: readonly string[];
  readonly bullets: readonly string[];
  readonly approvedEscalations: readonly string[];
  readonly drift: readonly string[];
  readonly spec: ItemSpec;
  readonly author: AuthorEntry;
}

export interface Wp5Result {
  readonly wp3RunId: string;
  readonly wp4RunId: string | null;
  readonly items: readonly Wp5Item[];
  readonly totals: Readonly<Record<string, unknown>>;
  readonly problems: readonly string[];
}

const view = (r: Rec): RecordView => ({
  testId: String(r.testId), family: String(r.family), resource: String(r.resource), controlId: String(r.controlId),
  polarity: String(r.polarity), verdict: String(r.verdict), observation: String(r.observation),
});

/** One line of evidence, generated from a record. */
function recordLine(r: Rec): string {
  const who = r.identity?.label ?? r.identityPlanned;
  const stmt = String(r.executed?.statement ?? "").replace(/\s+/g, " ").trim();
  const shortStmt = stmt.length > 110 ? `${stmt.slice(0, 107)}…` : stmt;
  const params = Array.isArray(r.executed?.params) && r.executed.params.length ? ` ${JSON.stringify(r.executed.params).slice(0, 60)}` : "";
  const unmet = (r.claimResults as Rec[]).find((c) => c.status === "unmet");
  const key = unmet ?? (r.claimResults as Rec[])[0];
  const claim = key ? `; ${unmet ? "UNMET" : "met"}: "${String(key.text).slice(0, 70)}" — ${String(key.detail).slice(0, 230)}` : "";
  return `\`${r.testId}\` — as \`${who}\`: \`${shortStmt}\`${params} → ${r.actualSummary}${claim} → **${r.verdict}**`;
}

function escalationOf(covers: string): string | null {
  const m = /Escalation would be:\s*(.+)$/s.exec(covers);
  return m ? m[1]!.trim().replace(/\s+/g, " ") : null;
}

export async function loadNarratives(): Promise<NarrativeStore> {
  try {
    return JSON.parse(await readFile(NARRATIVES_PATH, "utf8")) as NarrativeStore;
  } catch {
    return { WARNING: "", entries: [] };
  }
}

export function blankNarratives(): NarrativeStore {
  return {
    WARNING:
      "The author's words, verbatim. Every narrative and every status decision here must come from the author — recorded with " +
      "`recordedFrom` naming the dated reply it came from. Nothing in this file may be drafted, paraphrased or completed by an AI. " +
      "An entry that is still `awaiting_author` renders as a blank in FINDINGS.md.",
    entries: WP5_ITEMS.filter((s) => s.part !== "limitation").map((s) => ({ key: s.key, narrative: null, status: null, provenance: "awaiting_author" as const, recordedFrom: null })),
  };
}

/**
 * The checks that tie the AI-drafted items to the evidence. Pure, so that
 * prove-gates can hand it broken evidence (D3.57).
 */
export function checkGrouping(items: readonly ItemSpec[], records: readonly Rec[], wp0: readonly Rec[]): string[] {
  const problems: string[] = [];
  const owner = new Map<string, string[]>();
  for (const spec of items) {
    const sel = records.filter((r) => spec.select(view(r)));
    for (const r of sel) owner.set(r.testId, [...(owner.get(r.testId) ?? []), spec.key]);
    if (sel.length !== spec.expectCount) problems.push(`${spec.key}: its rule selects ${sel.length} record(s), the item was written for ${spec.expectCount}`);
    for (const r of sel) if (!spec.expectVerdicts.includes(r.verdict)) problems.push(`${spec.key}: ${r.testId} is ${r.verdict}, the item was written for ${spec.expectVerdicts.join("/")}`);
    const sup = spec.supporting ? records.filter((r) => spec.supporting!(view(r))) : [];
    for (const r of sup) if (r.verdict !== "effective") problems.push(`${spec.key}: supporting ${r.testId} is ${r.verdict}; the item says the records around it hold`);
    for (const k of spec.wp0Kinds ?? []) if (!wp0.some((o) => o.kind === k)) problems.push(`${spec.key}: no WP0 observation of kind ${k}`);
  }
  for (const r of records) {
    const o = owner.get(r.testId) ?? [];
    if (r.verdict !== "effective" && o.length === 0) problems.push(`${r.testId} (${r.verdict}) belongs to no WP5 item: every non-effective record must be reported`);
    if (o.length > 1) problems.push(`${r.testId} belongs to ${o.length} items (${o.join(", ")})`);
  }
  return problems;
}

export async function buildWp5(opts: { wp3RunId: string; wp4RunId?: string | null; planRunId: string }): Promise<Wp5Result> {
  const problems: string[] = [];
  const results = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp3RunId, "wp3-results.json"), "utf8")) as Rec;
  const records = results.records as Rec[];
  let validationPassed = false;
  try {
    validationPassed = (JSON.parse(await readFile(join(RUNS_ROOT, opts.wp3RunId, "wp3-validation.json"), "utf8")) as Rec).passed === true;
  } catch { /* no validation */ }
  if (!validationPassed) problems.push(`WP3 run ${opts.wp3RunId} has not passed validate-wp3; WP5 is built only on validated evidence`);
  if (results.meta?.aborted) problems.push(`WP3 run ${opts.wp3RunId} was aborted`);
  const plan = (JSON.parse(await readFile(join(RUNS_ROOT, opts.planRunId, "wp3-matrix.json"), "utf8")) as Rec).plan.tests as Rec[];
  const planById = new Map(plan.map((t) => [String(t.testId), t]));
  const tiers = JSON.parse(await readFile(join(RUNS_ROOT, FROZEN_CP3_RUN, "cp3-tiers.json"), "utf8")) as Rec;
  const scored = new Map((tiers.scored as Rec[]).map((s) => [String(s.resource), s]));
  const inventory = JSON.parse(await readFile(join(RUNS_ROOT, FROZEN_CP3_RUN, "inventory.json"), "utf8")) as Rec;
  let drift: Rec | null = null;
  const history: { name: string; label: string; verdictOf: Map<string, string>; incompatible: Set<string> }[] = [];
  if (opts.wp4RunId) {
    drift = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp4RunId, "wp4", "drift.json"), "utf8")) as Rec;
    for (const st of drift.states as Rec[]) {
      try {
        const res = JSON.parse(await readFile(join(RUNS_ROOT, opts.wp4RunId, "wp4", String(st.name), "results.json"), "utf8")) as Rec;
        history.push({
          name: String(st.name), label: String(st.label),
          verdictOf: new Map((res.records as Rec[]).map((r) => [String(r.testId), String(r.verdict)])),
          incompatible: new Set((res.incompatible as Rec[]).map((x) => String(x.testId))),
        });
      } catch { /* a state that ran no probes */ }
    }
  }
  const store = await loadNarratives();

  // --- grouping, checked against the evidence ---------------------------------
  problems.push(...checkGrouping(WP5_ITEMS, records, inventory.observations as Rec[]));
  const owner = new Map<string, string[]>();
  for (const spec of WP5_ITEMS) for (const r of records.filter((x) => spec.select(view(x)))) owner.set(r.testId, [...(owner.get(r.testId) ?? []), spec.key]);

  // --- items -----------------------------------------------------------------
  const built = WP5_ITEMS.map((spec) => {
    const sel = records.filter((r) => spec.select(view(r)));
    const sup = spec.supporting ? records.filter((r) => spec.supporting!(view(r))) : [];
    const resources = spec.resourcesAtRisk.length ? [...spec.resourcesAtRisk] : [...new Set(sel.filter((r) => !spec.riskFrom || spec.riskFrom(view(r))).map((r) => String(r.resource)))];
    const rated = resources.map((res) => ({ res, s: scored.get(res) })).filter((x) => x.s);
    for (const res of resources) if (!scored.has(res)) problems.push(`${spec.key}: ${res} has no frozen WP2 tier`);
    const tier = rated.map((x) => String(x.s!.tier)).sort((a, b) => (TIER_ORDER[a] ?? 9) - (TIER_ORDER[b] ?? 9))[0] ?? "untiered";
    const highest = rated.filter((x) => String(x.s!.tier) === tier).map((x) => x.res);
    const tierBasis = resources.length === 1
      ? `frozen WP2 tier of \`${resources[0]}\``
      : `highest frozen WP2 tier among ${resources.length} resources (${tier}: ${highest.slice(0, 4).map((r) => `\`${r}\``).join(", ")}${highest.length > 4 ? ", …" : ""})`;
    const exposures = rated.flatMap((x) => [x.s!.rating?.exposure?.readExposure, x.s!.rating?.exposure?.writeExposure]).filter(Boolean).map(String);
    const exposure = exposures.sort((a, b) => (EXPOSURE_ORDER[a] ?? 9) - (EXPOSURE_ORDER[b] ?? 9))[0] ?? "n/a";
    const evidenceClass = sel.length ? [...new Set(sel.map((r) => String(r.verdict)))].sort((a, b) => (CLASS_ORDER[a] ?? 9) - (CLASS_ORDER[b] ?? 9))[0]! : "none";

    // Three to six bullets: the count, examples, the rest by id, WP0, what holds
    // around it, and the frozen WP2 context — examples give way first.
    const tail: string[] = [];
    for (const k of spec.wp0Kinds ?? []) {
      const obs = (inventory.observations as Rec[]).filter((o) => o.kind === k);
      tail.push(`WP0 inventory (frozen, run \`${FROZEN_CP3_RUN}\`): ${obs.length} resource(s) with \`${k}\` — ${obs.slice(0, 6).map((o) => `\`${o.resource}\``).join(", ")}${obs.length > 6 ? ", …" : ""}.`);
    }
    if (sup.length) tail.push(`Holding around it (effective): ${sup.map((r) => `\`${r.testId}\``).join(", ")}.`);
    if (rated.length === 1) {
      const sc = rated[0]!.s!;
      const dim = ["data", "integrity", "blast", "reversibility"].map((k) => ({ k, d: sc.rating?.[k] as Rec | undefined })).find((x) => x.d?.level === sc.impact) ?? { k: "data", d: sc.rating?.data as Rec | undefined };
      tail.push(`Frozen WP2 rating of \`${rated[0]!.res}\` (CP3): tier ${sc.tier}, impact ${sc.impact} (${sc.impactRule}); ${dim.k} ${String(dim.d?.level ?? "")} — "${String(dim.d?.why ?? "").slice(0, 160)}".`);
    } else if (rated.length > 1) {
      const byTier = rated.reduce<Record<string, number>>((m, x) => ({ ...m, [String(x.s!.tier)]: (m[String(x.s!.tier)] ?? 0) + 1 }), {});
      tail.push(`Frozen WP2 tiers of the ${rated.length} resources (CP3): ${Object.entries(byTier).map(([k, n]) => `${n} ${k}`).join(", ")}.`);
    }
    const bullets: string[] = [];
    if (sel.length) {
      const byV = sel.reduce<Record<string, number>>((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] ?? 0) + 1 }), {});
      bullets.push(`${sel.length} record(s) in official WP3 run \`${opts.wp3RunId}\`: ${Object.entries(byV).map(([v, n]) => `${n} ${v}`).join(", ")}.`);
      const room = Math.max(1, 6 - 1 - tail.length);
      const shown = sel.length <= room ? sel.length : Math.max(1, room - 1);
      for (const r of sel.slice(0, shown)) bullets.push(recordLine(r));
      if (sel.length > shown) bullets.push(`… and ${sel.length - shown} more of the same kind: ${sel.slice(shown).map((r) => `\`${r.testId}\``).join(", ")}.`);
    }
    bullets.push(...tail);

    const approvedEscalations = [...new Set(sel.map((r) => escalationOf(String(planById.get(r.testId)?.covers ?? ""))).filter((x): x is string => !!x))].slice(0, 2);

    // The same Test IDs against Arc21's earlier schemas: today's questions, yesterday's schema (D3.56).
    // An item with no record of its own (a WP0 observation) is traced through the records holding around it.
    const basis = sel.length ? sel : sup;
    const driftLines: string[] = [];
    if (!sel.length && sup.length && history.length) driftLines.push(`Traced through the ${sup.length} record(s) holding around it:`);
    for (const h of history) {
      if (!basis.length) break;
      const tally: Record<string, number> = {};
      for (const r of basis) {
        const v = h.incompatible.has(r.testId) ? "could not be asked (schema lacks what the probe needs)" : (h.verdictOf.get(r.testId) ?? "not recorded");
        tally[v] = (tally[v] ?? 0) + 1;
      }
      driftLines.push(`\`${h.name}\` — ${h.label}: ${Object.entries(tally).map(([v, n]) => `${n} ${v}`).join(", ")}.`);
    }
    if (driftLines.length) driftLines.push(`Today, in the official run: ${Object.entries(basis.reduce<Record<string, number>>((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] ?? 0) + 1 }), {})).map(([v, n]) => `${n} ${v}`).join(", ")}.`);

    const author = store.entries.find((e) => e.key === spec.key) ?? { key: spec.key, narrative: null, status: null, provenance: "awaiting_author" as const, recordedFrom: null };
    return { spec, sel, sup, tier, tierBasis, exposure, evidenceClass, bullets, approvedEscalations, driftLines, author };
  });

  const ranked = [...built].sort((a, b) =>
    (PART_ORDER[a.spec.part]! - PART_ORDER[b.spec.part]!) ||
    ((TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9)) ||
    ((CLASS_ORDER[a.evidenceClass] ?? 9) - (CLASS_ORDER[b.evidenceClass] ?? 9)) ||
    ((EXPOSURE_ORDER[a.exposure] ?? 9) - (EXPOSURE_ORDER[b.exposure] ?? 9)) ||
    (b.sel.length - a.sel.length) || a.spec.key.localeCompare(b.spec.key));
  const counters: Record<string, number> = {};
  const items: Wp5Item[] = ranked.map((x) => {
    const letter = PART_LETTER[x.spec.part]!;
    counters[letter] = (counters[letter] ?? 0) + 1;
    return {
      id: `${letter}${counters[letter]}`, key: x.spec.key, part: x.spec.part, title: x.spec.title,
      tier: x.tier, tierBasis: x.tierBasis, exposure: x.exposure, evidenceClass: x.evidenceClass,
      testIds: x.sel.map((r) => String(r.testId)), supportingTestIds: x.sup.map((r) => String(r.testId)),
      bullets: x.bullets, approvedEscalations: x.approvedEscalations, drift: x.driftLines, spec: x.spec, author: x.author,
    };
  });

  const byVerdict = records.reduce<Record<string, number>>((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] ?? 0) + 1 }), {});
  return {
    wp3RunId: opts.wp3RunId, wp4RunId: opts.wp4RunId ?? null, items, problems,
    totals: { records: records.length, byVerdict, reported: [...owner.keys()].length, frozenCp3Run: FROZEN_CP3_RUN, planRunId: opts.planRunId },
  };
}

// ---------------------------------------------------------------------------
// verification of a future fix (D3.57)
// ---------------------------------------------------------------------------

export interface ItemVerification {
  readonly item: string;
  readonly verified: boolean;
  readonly lines: readonly string[];
}

/**
 * Would a candidate run confirm a fix of one item? Every record the item
 * selects in the official run must carry the item's `mustBecome` verdict in the
 * candidate, and no Test ID that was `effective` in the official run may be
 * anything else. Pure: the command and prove-gates both call it.
 */
export function verifyItem(spec: ItemSpec, official: readonly Rec[], candidate: readonly Rec[], candidateValidated: boolean): ItemVerification {
  const lines: string[] = [];
  let ok = candidateValidated;
  if (!candidateValidated) lines.push("the candidate run has not passed validate-wp3");
  if (spec.part === "limitation" || !spec.expectCount) {
    return { item: spec.key, verified: false, lines: [...lines, `${spec.key} has no Test ID a fix could change; it cannot be verified this way`] };
  }
  if (!confirmable(spec)) {
    return { item: spec.key, verified: false, lines: [...lines, `${spec.key}: the frozen rows cannot confirm a fix — ${spec.verification.caveat ?? "their verdict would not change"}`] };
  }
  const cand = new Map(candidate.map((r) => [String(r.testId), r]));
  const want = spec.verification.mustObserve;
  for (const r of official.filter((x) => spec.select(view(x)))) {
    const c = cand.get(String(r.testId));
    const good = want ? c?.observation === want : c?.verdict === spec.verification.mustBecome;
    ok &&= good;
    lines.push(want
      ? `${r.testId}: observed ${r.observation} → ${c?.observation ?? "MISSING"} (must be ${want}) ${good ? "ok" : "NOT MET"}`
      : `${r.testId}: ${r.verdict} → ${c?.verdict ?? "MISSING"} (must be ${spec.verification.mustBecome}) ${good ? "ok" : "NOT MET"}`);
  }
  const regressions = official.filter((r) => r.verdict === "effective" && cand.get(String(r.testId))?.verdict !== "effective");
  if (regressions.length) {
    ok = false;
    lines.push(`REGRESSION: ${regressions.length} Test ID(s) effective in the official run are not effective in the candidate: ${regressions.slice(0, 8).map((r) => `${r.testId} → ${cand.get(String(r.testId))?.verdict ?? "missing"}`).join(", ")}`);
  } else lines.push("no regression: every Test ID effective in the official run is effective in the candidate");
  return { item: spec.key, verified: ok, lines };
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

const STATUS_TEXT: Readonly<Record<string, string>> = {
  open: "OPEN — the author's decision",
  accepted_design_intent: "ACCEPTED / DESIGN INTENT — the author's decision",
  informational: "INFORMATIONAL — the author's decision",
};

function statusLine(i: Wp5Item): string {
  if (i.part === "limitation") return "NOT MEASURED — a limitation of the assessment, not a finding";
  if (i.author.status) return `${STATUS_TEXT[i.author.status]} (${i.author.recordedFrom ?? "source not recorded"})`;
  return i.part === "finding"
    ? "OPEN, pending the author's judgment at CP4 — never remediated by Attest, never closed"
    : "INFORMATIONAL, pending the author's judgment at CP4 (open, or accepted / design intent)";
}

export function renderItem(i: Wp5Item, wp3RunId: string): string[] {
  const s = i.spec;
  const L: string[] = [];
  const p = (x = "") => L.push(x);
  p(`### ${i.id}. ${i.title}`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Status | ${statusLine(i)} |`);
  p(`| Tier | **${i.tier}** — ${i.tierBasis} |`);
  p(`| Most exposed path (frozen rating) | ${i.exposure} |`);
  p(`| Evidence class | ${i.evidenceClass === "none" ? "WP0 structural observation (no WP3 record is non-effective)" : i.evidenceClass} |`);
  p(`| Test IDs | ${i.testIds.length ? i.testIds.map((t) => `\`${t}\``).join(", ") : "—"} |`);
  p();
  p("**Evidence** (generated from the records)");
  p();
  for (const b of i.bullets) p(`- ${b}`);
  p();
  p("**What happened** *(AI-drafted)*");
  p();
  p(s.whatHappened);
  p();
  p("**Why it matters** *(AI-drafted, grounded in the approved matrix and the frozen ratings)*");
  p();
  p(s.whyItMatters);
  if (i.approvedEscalations.length) {
    p();
    for (const e of i.approvedEscalations) p(`> Approved matrix, "Escalation would be": ${e}`);
  }
  p();
  if (s.contrary?.length) {
    p("**Evidence pointing the other way, or context to weigh**");
    p();
    for (const c of s.contrary) p(`- ${c}`);
    p();
  }
  if (i.drift.length) {
    p("**Across Arc21's earlier schemas (WP4)**");
    p();
    for (const d of i.drift) p(`- ${d}`);
    p();
  }
  if (s.limitations.length) {
    p("**Limitations**");
    p();
    for (const l of s.limitations) p(`- ${l}`);
    p();
  }
  if (s.judgment.length) {
    p("**Judgment needed from the author**");
    p();
    for (const j of s.judgment) p(`- ${j}`);
    p();
  }
  if (s.remediation.length) {
    p("**Remediation options** *(AI-drafted recommendations — not implemented; Arc21 is a read-only target)*");
    p();
    s.remediation.forEach((r, n) => { p(`${n + 1}. ${r.option}`); p(`   *Tradeoffs:* ${r.tradeoffs}`); });
    p();
  }
  if (s.verification.steps.length) {
    const can = confirmable(s);
    p(can
      ? (s.verification.mustObserve
        ? `**Verifying a future change** — each listed Test ID must be observed \`${s.verification.mustObserve}\`: its frozen prediction no longer holds`
        : `**Verifying a future fix** — each listed Test ID must become \`${s.verification.mustBecome}\``)
      : "**Re-checking after a future change** — these frozen rows cannot confirm a fix (see the caveat)");
    p();
    const steps = [...s.verification.steps];
    if (can) steps.splice(4, 0, `\`npm run attest verify-finding ${s.key} --official=${wp3RunId} --candidate=<new run>\` — every Test ID of this item must reach the state above, the candidate run must have passed validation, and no Test ID that was \`effective\` in the official run may be anything else.`);
    steps.forEach((st, n) => p(`${n + 1}. ${st}`));
    if (s.verification.caveat) { p(); p(`*Caveat:* ${s.verification.caveat}`); }
    p();
  }
  if (i.part !== "limitation") {
    p(`**AUTHOR NARRATIVE:** ${i.author.narrative ? i.author.narrative : "______"}`);
    if (i.author.narrative) p(`*(the author's words, ${i.author.recordedFrom ?? "source not recorded"})*`);
    p();
  }
  return L;
}

export function renderFindings(r: Wp5Result): string {
  const L: string[] = [];
  const p = (x = "") => L.push(x);
  const findings = r.items.filter((i) => i.part === "finding");
  const info = r.items.filter((i) => i.part === "informational");
  const lim = r.items.filter((i) => i.part === "limitation");
  const t = r.totals as Rec;
  p("# FINDINGS — Arc21 access-control assessment");
  p();
  p("> Generated by `npm run attest wp5` from the evidence named below. Regenerated, never hand-edited: the author's narrative");
  p("> and status decisions live in `rubric/wp5-author-narratives.json` and are merged in verbatim.");
  p(">");
  p("> **Arc21 is a read-only assessment target (Amendment A1).** Nothing below was remediated by Attest, nothing is claimed");
  p("> closed or fixed, and no remediation was implemented or independently verified. Every remediation is a recommendation,");
  p("> and every verification procedure is a procedure for a future fix made by Arc21's author.");
  p(">");
  p("> **Provenance.** Evidence bullets are generated from the records. Titles, \"what happened\", \"why it matters\", limitations,");
  p("> remediation options and tradeoffs are AI-drafted (Claude) for the author's review at CP4 — they are not the author's words.");
  p("> The **AUTHOR NARRATIVE** under each item is the author's alone and stays blank until the author writes it.");
  p();
  p(`Evidence: official WP3 run \`${r.wp3RunId}\` (${t.records} records, validated) · frozen WP2 tiers and WP0 inventory: CP3 run \`${t.frozenCp3Run}\` · planning run \`${t.planRunId}\`${r.wp4RunId ? ` · WP4 drift run \`${r.wp4RunId}\`` : ""}`);
  p();
  p("## How the list is ranked");
  p();
  p("Mechanically, from frozen inputs only (DECISIONS D3.57). No severity, score or tier is assigned here.");
  p();
  p("1. **Part**: findings (a WP3 failure or gap) before informational items (characterizations and WP0 structural observations), before limitations.");
  p("2. **Frozen WP2 tier** of the resource whose data or integrity is affected (High before Medium). For a SECURITY DEFINER function that is the table it exposes or changes — every F5 test row is High-depth by the planning rule, which is a depth rule, not a risk rating.");
  p("3. **Evidence class**: `deficient` (an approved expectation was violated) before `gap` (a control the plan asked about does not exist) before `characterized`.");
  p("4. **Most exposed path** in the frozen rating: anonymous before authenticated before server-only.");
  p("5. More Test IDs before fewer; then the item's name.");
  p();
  p("| # | Item | Tier | Evidence | Test IDs | Status |");
  p("|---|---|---|---|---:|---|");
  for (const i of r.items) p(`| ${i.id} | ${i.title} | ${i.tier} | ${i.evidenceClass === "none" ? "WP0" : i.evidenceClass} | ${i.testIds.length} | ${statusLine(i).split(" — ")[0]!.split(",")[0]} |`);
  p();
  p("## Part A — Findings");
  p();
  for (const i of findings) L.push(...renderItem(i, r.wp3RunId));
  p("## Part B — Informational: characterizations and WP0 structural observations");
  p();
  p("WP0 found no resource without a control: every application table has row-level security enabled. Its structural observations are carried here, each with the WP3 Test IDs that exercised it. Whether any of them is open is the author's decision.");
  p();
  for (const i of info) L.push(...renderItem(i, r.wp3RunId));
  p("## Part C — What WP3 could not measure");
  p();
  for (const i of lim) L.push(...renderItem(i, r.wp3RunId));
  p("## Everything else");
  p();
  const bv = t.byVerdict as Record<string, number>;
  p(`Of ${t.records} Test IDs, ${bv.effective ?? 0} are \`effective\`: the control held as approved. Every one of the ${t.records - (bv.effective ?? 0)} that is not appears in exactly one item above — \`attest wp5\` refuses to write this file otherwise.`);
  p();
  return L.join("\n") + "\n";
}
