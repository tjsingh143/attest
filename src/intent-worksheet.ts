/**
 * Attest — the AUTHOR INTENT authoring worksheet.
 *
 * Generated directly from the approved matrix. It carries exactly the negative
 * tests that require an intent sentence, with the Test IDs preserved verbatim
 * so every sentence the author writes maps one-to-one back to the evidence
 * record the probe will eventually produce.
 *
 * The harness does NOT write these sentences and does not derive them from the
 * `Covers` text. Brief §1.1 reserves them for the author, and a sentence
 * inferred from the rationale the planner already wrote would be the harness
 * agreeing with itself.
 *
 * The question in each row is a prompt, not a hint: it asks what attack or
 * misuse the author believes the probe simulates, and it deliberately does not
 * suggest an answer.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { registeredContradictionsFor } from "./wp3-contradictions.ts";
import { join } from "node:path";
import type { PlannedTest, Wp3Plan, Family } from "./wp3-plan.ts";
import type { AuthorIntent, IntentStore } from "./author-intents.ts";
import { isAdopted } from "./author-intents.ts";
import { effectiveActor } from "./plan-contradictions.ts";

export interface WorksheetRow {
  readonly testId: string;
  /** The entry in the canonical store, when one exists. */
  readonly proposal?: AuthorIntent;
  /** The caller the probe must actually run as; see plan-contradictions C1. */
  readonly runsAs?: string;
  readonly family: Family;
  readonly control: string;
  readonly identity: string;
  readonly operation: string;
  readonly expected: string;
  readonly covers: string;
  readonly question: string;
}

export interface WorksheetValidation {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Worksheet {
  readonly rows: readonly WorksheetRow[];
  readonly byFamily: readonly { family: Family; rows: readonly WorksheetRow[] }[];
  readonly batches: readonly { index: number; label: string; rows: readonly WorksheetRow[] }[];
  readonly validation: readonly WorksheetValidation[];
  readonly valid: boolean;
}

const FAMILY_ORDER: readonly Family[] = [
  "F1 read isolation", "F2 write isolation", "F3 WITH CHECK enforcement",
  "F4 anonymous exposure", "F5 SECURITY DEFINER escalation", "F6 column-level leakage",
  "F7 forced RLS / owner bypass", "F8 realtime channel authorization",
  "F9 wallet / concurrency integrity", "F10 audit trail", "B boundary cases",
];

/** Which rows need an intent sentence: negative polarity with the field blank. */
export function requiresIntent(t: PlannedTest): boolean {
  return t.polarity === "negative" && t.authorIntent === null;
}

/**
 * A neutral prompt.
 *
 * It used to interpolate the caller — "If alice could actually do this…" —
 * which read oddly on the many rows whose caller is carol, anon, the server, or
 * a token for a deleted account. One neutral question asked of every row also
 * avoids nudging the answer toward the identity rather than the objective.
 */
function question(_t: PlannedTest): string {
  return `What attack or misuse is this negative test trying to prevent? Describe it in one sentence.`;
}

const TARGET_BATCH = 25;

export function buildWorksheet(plan: Wp3Plan, store?: IntentStore | null): Worksheet {
  const needed = plan.tests.filter(requiresIntent);
  const proposals = new Map((store?.intents ?? []).map((e) => [e.testId, e]));

  const rows: WorksheetRow[] = FAMILY_ORDER.flatMap((family) =>
    needed
      .filter((t) => t.family === family)
      .map((t) => ({
        testId: t.testId,
        family: t.family,
        control: t.control,
        identity: t.identity,
        operation: t.operation,
        expected: t.expected,
        covers: t.covers,
        question: question(t),
        proposal: proposals.get(t.testId),
        runsAs: effectiveActor(t),
      })),
  );

  const byFamily = FAMILY_ORDER.map((family) => ({
    family,
    rows: rows.filter((r) => r.family === family),
  })).filter((g) => g.rows.length > 0);

  // Batches respect family boundaries where they can: a family shorter than a
  // batch is never split across two, so a review session covers one kind of
  // control at a time rather than straddling two.
  const batches: { index: number; label: string; rows: WorksheetRow[] }[] = [];
  let current: WorksheetRow[] = [];
  let labels: Family[] = [];
  const flush = () => {
    if (!current.length) return;
    batches.push({
      index: batches.length + 1,
      label: [...new Set(labels.map((f) => f.split(" ")[0]))].join(" + "),
      rows: current,
    });
    current = [];
    labels = [];
  };
  for (const g of byFamily) {
    if (g.rows.length > TARGET_BATCH) {
      flush();
      for (let i = 0; i < g.rows.length; i += TARGET_BATCH) {
        const slice = g.rows.slice(i, i + TARGET_BATCH);
        batches.push({
          index: batches.length + 1,
          label: `${g.family.split(" ")[0]} (${i + 1}–${i + slice.length} of ${g.rows.length})`,
          rows: slice,
        });
      }
      continue;
    }
    if (current.length + g.rows.length > TARGET_BATCH + 5) flush();
    current.push(...g.rows);
    labels.push(g.family);
  }
  flush();

  // --- validation ---------------------------------------------------------
  const ids = rows.map((r) => r.testId);
  const unique = new Set(ids);
  const matrixById = new Map(plan.tests.map((t) => [t.testId, t]));
  const notNegative = ids.filter((id) => {
    const t = matrixById.get(id);
    return !t || !requiresIntent(t);
  });
  const missing = needed.filter((t) => !unique.has(t.testId)).map((t) => t.testId);
  const forbidden = rows.filter((r) => {
    const t = matrixById.get(r.testId);
    return t ? t.polarity !== "negative" : true;
  });
  const batchTotal = batches.reduce((a, b) => a + b.rows.length, 0);

  const validation: WorksheetValidation[] = [
    {
      check: `worksheet contains exactly ${needed.length} unique Test IDs`,
      passed: ids.length === needed.length && unique.size === needed.length,
      detail: `${ids.length} rows, ${unique.size} unique, ${needed.length} required`,
    },
    {
      check: "every worksheet ID is a matrix negative requiring intent",
      passed: notNegative.length === 0,
      detail: notNegative.length ? `offenders: ${notNegative.slice(0, 5).join(", ")}` : "all present and negative",
    },
    {
      check: "every matrix negative requiring intent appears exactly once",
      passed: missing.length === 0,
      detail: missing.length ? `missing: ${missing.slice(0, 5).join(", ")}` : "none missing",
    },
    {
      check: "no positive, characterization or gap-assessment row appears",
      passed: forbidden.length === 0,
      detail: forbidden.length ? `offenders: ${forbidden.slice(0, 5).map((r) => r.testId).join(", ")}` : "none present",
    },
    {
      // A total alone would pass if one row were duplicated and another
      // dropped, which is exactly the shape "exactly once" is meant to exclude.
      check: "batches account for every row exactly once",
      passed:
        batchTotal === rows.length &&
        new Set(batches.flatMap((b) => b.rows.map((r) => r.testId))).size === rows.length,
      detail: `${batches.length} batches totalling ${batchTotal} of ${rows.length}, ${new Set(batches.flatMap((b) => b.rows.map((r) => r.testId))).size} distinct`,
    },
    {
      // Computed, not asserted. The old version hard-coded `passed: true`.
      check: "no AI draft is presented as the author's",
      passed: rows.every((r) => !r.proposal || !isAdopted(r.proposal) || r.proposal.provenance !== "ai_draft"),
      detail: (() => {
        const withP = rows.filter((r) => r.proposal);
        const drafts = withP.filter((r) => r.proposal!.provenance === "ai_draft").length;
        const adopted = withP.filter((r) => isAdopted(r.proposal!)).length;
        return withP.length === 0
          ? "no proposals rendered; every AUTHOR INTENT field is blank"
          : `${drafts} still ai_draft, ${adopted} adopted by the author, of ${rows.length}`;
      })(),
    },
  ];

  return { rows, byFamily, batches, validation, valid: validation.every((v) => v.passed) };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const cell = (v: unknown) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

/** The label every harness-written proposal carries, wherever it is rendered (§22). */
export const AI_DRAFT_LABEL = "AI DRAFT — NOT YET ADOPTED BY AUTHOR";

function banner(rows: readonly WorksheetRow[]): string[] {
  const drafts = rows.filter((r) => r.proposal?.provenance === "ai_draft").length;
  const adopted = rows.filter((r) => r.proposal && isAdopted(r.proposal)).length;
  return [
    `> **${AI_DRAFT_LABEL}.** ${drafts} of the ${rows.length} proposed sentences in this file were written by the`,
    `> harness, not by the author, and ${adopted} ${adopted === 1 ? "has" : "have"} been adopted. A proposal is a starting point to`,
    `> accept, correct or replace — never a sentence the author wrote. \`execute-wp3\` refuses to run while any`,
    `> required sentence is still an AI draft.`,
    ``,
  ];
}

function renderRow(r: WorksheetRow, n: number): string[] {
  return [
    `#### ${n}. \`${r.testId}\``,
    ``,
    `| | |`,
    `|---|---|`,
    `| Control | \`${cell(r.control)}\` |`,
    `| Runs as | ${cell(r.identity)}${r.runsAs && r.runsAs !== r.identity ? ` **— must actually run as ${cell(r.runsAs)}; see contradiction C1**` : ""} |`,
    `| Operation | ${cell(r.operation)} |`,
    `| Expected safe result | ${cell(r.expected)} |`,
    `| Covers | ${cell(r.covers)} |`,
    ...registeredContradictionsFor(r.testId).map((c) =>
      `| Pending author decision | registered contradiction \`${c.id}\`: ${cell(c.summary)} — until decided, this probe runs as approved and records \`not_measured\` |`),
    ``,
    `> ${cell(r.question)}`,
    ``,
    ...(r.proposal
      ? [
          `**PROPOSED (${r.proposal.provenance}${r.proposal.provenance === "ai_draft" ? " — NOT YET ADOPTED BY AUTHOR" : ""}, ${r.proposal.reviewStatus}):**`,
          ``,
          `> ${cell(r.proposal.intent)}`,
          ``,
          `**AUTHOR INTENT:** ${isAdopted(r.proposal) ? cell(r.proposal.intent) : "\\_\\_\\_\\_\\_  *(accept the draft above, or write your own)*"}`,
        ]
      : [`**AUTHOR INTENT:** \\_\\_\\_\\_\\_`]),
    ``,
  ];
}

export function renderWorksheetMarkdown(w: Worksheet, meta: { runId: string; schemaVersion: string }): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# AUTHOR INTENT worksheet — WP3 negative tests`);
  p();
  for (const line of banner(w.rows)) p(line);
  p(`Generated from the approved WP3 matrix. **${w.rows.length} negative tests**, each needing one`);
  p(`sentence in the author's own words naming the attack or misuse it simulates.`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Run | \`${meta.runId}\` |`);
  p(`| Schema version | \`${meta.schemaVersion}\` |`);
  p(`| Rows requiring intent | ${w.rows.length} |`);
  p(`| Review batches | ${w.batches.length} |`);
  p(`| Validation | ${w.valid ? "all checks pass" : "**FAILED**"} |`);
  p();
  p(`> **The harness does not write these sentences and does not derive them from \`Covers\`.**`);
  p(`> Brief §1.1 reserves them for the author. A sentence inferred from the rationale the planner`);
  p(`> already wrote would be the harness agreeing with itself, which is exactly the thing the`);
  p(`> reservation exists to prevent.`);
  p();
  p(`Test IDs are preserved verbatim, so each sentence maps one-to-one to the evidence record its`);
  p(`probe will produce.`);
  p();

  p(`## Validation`);
  p();
  p(`| Check | Result | Detail |`);
  p(`|---|---|---|`);
  for (const v of w.validation) {
    p(`| ${cell(v.check)} | ${v.passed ? "**pass**" : "**FAIL**"} | ${cell(v.detail)} |`);
  }
  p();

  p(`## Coverage by family`);
  p();
  p(`| Family | Rows needing intent |`);
  p(`|---|---:|`);
  for (const g of w.byFamily) p(`| ${cell(g.family)} | ${g.rows.length} |`);
  p(`| **Total** | **${w.rows.length}** |`);
  p();

  p(`## Review batches`);
  p();
  p(`${w.rows.length} rows is too many to review safely at once, so they are also split into`);
  p(`${w.batches.length} batches of roughly 25. Each batch is a separate file under \`batches/\`; this`);
  p(`document is the canonical complete worksheet.`);
  p();
  p(`| Batch | Covers | Rows | First → last Test ID |`);
  p(`|---|---|---:|---|`);
  for (const b of w.batches) {
    p(`| ${b.index} | ${cell(b.label)} | ${b.rows.length} | \`${b.rows[0]!.testId}\` → \`${b.rows[b.rows.length - 1]!.testId}\` |`);
  }
  p();

  p(`---`);
  p();
  let n = 0;
  for (const g of w.byFamily) {
    p(`## ${g.family} — ${g.rows.length} sentence${g.rows.length === 1 ? "" : "s"} needed`);
    p();
    for (const r of g.rows) L.push(...renderRow(r, ++n));
  }
  return L.join("\n");
}

export function renderBatchMarkdown(
  b: { index: number; label: string; rows: readonly WorksheetRow[] },
  totalBatches: number,
  meta: { runId: string },
): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p(`# AUTHOR INTENT — batch ${b.index} of ${totalBatches}`);
  p();
  p(`**${b.label}** · ${b.rows.length} rows · run \`${meta.runId}\``);
  p();
  for (const line of banner(b.rows)) p(line);
  p(`One sentence each, in your own words, naming the attack or misuse the probe simulates.`);
  p(`Test IDs are verbatim from the matrix — do not renumber them.`);
  p();
  p(`---`);
  p();
  let n = 0;
  for (const r of b.rows) L.push(...renderRow(r, ++n));
  return L.join("\n");
}

export async function writeWorksheet(
  w: Worksheet, runDir: string, meta: { runId: string; schemaVersion: string },
): Promise<void> {
  await writeFile(join(runDir, "author-intent-worksheet.md"), renderWorksheetMarkdown(w, meta));
  await writeFile(
    join(runDir, "author-intent-worksheet.json"),
    JSON.stringify({
      WARNING: `${AI_DRAFT_LABEL}: every proposal whose provenance is ai_draft was written by the harness, not the author. None is adopted until the author edits rubric/author-intents.json.`,
      rows: w.rows.map((r) => ({ ...r, label: r.proposal?.provenance === "ai_draft" ? AI_DRAFT_LABEL : r.proposal && isAdopted(r.proposal) ? "ADOPTED BY AUTHOR" : "NOT ADOPTED" })),
      batches: w.batches, validation: w.validation,
    }, null, 2) + "\n",
  );
  const batchDir = join(runDir, "batches");
  await mkdir(batchDir, { recursive: true });
  for (const b of w.batches) {
    await writeFile(
      join(batchDir, `intent-batch-${String(b.index).padStart(2, "0")}.md`),
      renderBatchMarkdown(b, w.batches.length, meta),
    );
  }
  // A compact two-column pass, for reading all 240 sentences end to end without
  // the surrounding detail. Tab-separated so it opens in a spreadsheet and the
  // sentences can be edited in a column.
  const tsv = [
    "test_id\tlabel\tprovenance\treview_status\tproposed_intent",
    ...w.rows.map((r) =>
      [
        r.testId,
        r.proposal?.provenance === "ai_draft" ? AI_DRAFT_LABEL : r.proposal && isAdopted(r.proposal) ? "ADOPTED BY AUTHOR" : "NOT ADOPTED",
        r.proposal?.provenance ?? "none",
        r.proposal?.reviewStatus ?? "none",
        (r.proposal?.intent ?? "").replaceAll("\t", " ").replaceAll("\n", " "),
      ].join("\t"),
    ),
  ].join("\n");
  await writeFile(join(runDir, "author-intent-review.tsv"), tsv + "\n");
}
