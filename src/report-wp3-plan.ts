/**
 * Attest — rendering the WP3 test matrix and its reconciliation.
 *
 * The AUTHOR INTENT column is emitted empty on every negative test. That is
 * the point of the document: brief §1.1 reserves the sentence naming the
 * attack each negative test simulates, and the matrix is handed over with the
 * field visibly blank rather than quietly absent.
 */
import type { Family, PlannedTest, Wp3Plan } from "./wp3-plan.ts";

export interface Reconciliation {
  readonly highPlanned: number;
  readonly mediumPlanned: number;
  readonly suitePlanned: number;
  readonly totalPlanned: number;
  readonly estimate: number;
  readonly difference: number;
  readonly familyCoverage: readonly { family: Family; tests: number; positive: number; negative: number; characterization: number; notApplicable: number }[];
  readonly negativesAwaitingIntent: number;
  /** Families the branch-based estimator could count, and those it could not. */
  readonly inEstimatorModel: number;
  readonly outsideEstimatorModel: number;
  readonly outsideBreakdown: readonly { family: Family; tests: number; whyUnseen: string }[];
}

const cell = (v: unknown) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

const FAMILIES: readonly Family[] = [
  "F1 read isolation", "F2 write isolation", "F3 WITH CHECK enforcement", "F4 anonymous exposure",
  "F5 SECURITY DEFINER escalation", "F6 column-level leakage", "F7 forced RLS / owner bypass",
  "F8 realtime channel authorization", "F9 wallet / concurrency integrity", "F10 audit trail",
  "B boundary cases",
];

/**
 * Families whose cases the CP3 estimator could see.
 *
 * The estimator counted POLICY BRANCHES ON RELATIONS: policy USING/WITH CHECK
 * conditions, refusing triggers, the anon-vs-authenticated condition, and
 * deny-by-default. Four families are not relation-branch-shaped and were
 * therefore structurally invisible to it — not underestimated, unmodelled.
 */
const IN_ESTIMATOR_MODEL: ReadonlySet<Family> = new Set<Family>([
  "F1 read isolation", "F2 write isolation", "F3 WITH CHECK enforcement",
  "F4 anonymous exposure", "F6 column-level leakage",
  "F8 realtime channel authorization", "B boundary cases",
]);

const WHY_UNSEEN: Partial<Record<Family, string>> = {
  "F5 SECURITY DEFINER escalation":
    "the estimator counted branches on relations; a function was never a resource in that model, so all 37 escalation cases sat outside it",
  "F10 audit trail":
    "the estimator had no notion of whether a who-did-what-when record exists, so the family contributed nothing to the branch count",
  "F7 forced RLS / owner bypass":
    "`#rls_forced` is a table attribute rather than a policy branch, so it was not counted as one",
  "F9 wallet / concurrency integrity":
    "concurrency and idempotency are not policy branches; the two refusing triggers on wallets were counted, the interleaving cases were not",
};

export function reconcile(plan: Wp3Plan, estimate: number): Reconciliation {
  const t = plan.tests;
  const highPlanned = t.filter((x) => x.tier === "High").length;
  const mediumPlanned = t.filter((x) => x.tier === "Medium").length;
  const suitePlanned = t.filter((x) => x.tier === "suite").length;
  return {
    highPlanned, mediumPlanned, suitePlanned,
    totalPlanned: t.length,
    estimate,
    difference: t.length - estimate,
    familyCoverage: FAMILIES.map((family) => ({
      family,
      tests: t.filter((x) => x.family === family).length,
      positive: t.filter((x) => x.family === family && x.polarity === "positive").length,
      negative: t.filter((x) => x.family === family && x.polarity === "negative").length,
      characterization: t.filter((x) => x.family === family && x.polarity === "characterization").length,
      notApplicable: plan.notApplicable.filter((x) => x.family === family).length,
    })),
    negativesAwaitingIntent: t.filter((x) => x.polarity === "negative" && x.authorIntent === null).length,
    inEstimatorModel: t.filter((x) => IN_ESTIMATOR_MODEL.has(x.family)).length,
    outsideEstimatorModel: t.filter((x) => !IN_ESTIMATOR_MODEL.has(x.family)).length,
    outsideBreakdown: FAMILIES.filter((f) => !IN_ESTIMATOR_MODEL.has(f))
      .map((family) => ({
        family,
        tests: t.filter((x) => x.family === family).length,
        whyUnseen: WHY_UNSEEN[family] ?? "not represented in the branch model",
      }))
      .filter((x) => x.tests > 0),
  };
}

export function renderWp3PlanMarkdown(
  plan: Wp3Plan, rec: Reconciliation,
  meta: { runId: string; schemaVersion: string; harness: string },
): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# WP3 — test matrix (PLAN ONLY, not executed)`);
  p();
  p(`Built from the frozen WP2 tiers, the WP0 control inventory, the WP1 validation plumbing, and`);
  p(`the ten control families the brief requires. **Nothing here has been run.**`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Run | \`${meta.runId}\` |`);
  p(`| Schema version | \`${meta.schemaVersion}\` |`);
  p(`| Harness version | \`${meta.harness}\` |`);
  p(`| Planned tests | ${rec.totalPlanned} |`);
  p(`| Negative tests awaiting AUTHOR INTENT | **${rec.negativesAwaitingIntent}** |`);
  p();
  p(`> **${rec.negativesAwaitingIntent} negative tests carry an empty AUTHOR INTENT field.** Brief §1.1`);
  p(`> reserves that sentence — one line naming the attack or misuse each negative test simulates —`);
  p(`> for the author. The harness does not write it, and the suite is not implemented until they`);
  p(`> are supplied.`);
  p();

  // --- reconciliation ------------------------------------------------------
  p(`## 1. Reconciliation against the planning estimate`);
  p();
  p(`| | Cases |`);
  p(`|---|---:|`);
  p(`| High tier, planned | ${rec.highPlanned} |`);
  p(`| Medium tier, planned | ${rec.mediumPlanned} |`);
  p(`| Suite-level, planned | ${rec.suitePlanned} |`);
  p(`| **Total concrete planned** | **${rec.totalPlanned}** |`);
  p(`| CP3 planning estimate | ${rec.estimate} |`);
  p(`| **Difference** | **${rec.difference >= 0 ? "+" : ""}${rec.difference}** |`);
  p();
  p(`### Where the difference comes from`);
  p();
  p(`The CP3 estimator counted **policy branches on relations**. Four of the ten families are not`);
  p(`relation-branch-shaped, so they were not underestimated — they were **unmodelled**.`);
  p();
  p(`| | Cases |`);
  p(`|---|---:|`);
  p(`| Planned within the estimator's model | ${rec.inEstimatorModel} |`);
  p(`| CP3 estimate | ${rec.estimate} |`);
  p(`| **Variance within the shared scope** | **${rec.inEstimatorModel - rec.estimate >= 0 ? "+" : ""}${rec.inEstimatorModel - rec.estimate}** |`);
  p();
  p(`| Family outside the model | Cases | Why the estimator could not see it |`);
  p(`|---|---:|---|`);
  for (const o of rec.outsideBreakdown) p(`| ${cell(o.family)} | ${o.tests} | ${cell(o.whyUnseen)} |`);
  p(`| **Subtotal outside the model** | **${rec.outsideEstimatorModel}** | |`);
  p();
  p(`${rec.inEstimatorModel} + ${rec.outsideEstimatorModel} = **${rec.totalPlanned}**. Within the scope both models share, the estimate was`);
  p(`accurate to ${rec.inEstimatorModel - rec.estimate >= 0 ? "+" : ""}${rec.inEstimatorModel - rec.estimate} cases. **The updated planning figure is ${rec.totalPlanned}**, and it is not a target — it`);
  p(`follows the applicable controls.`);
  p();

  // --- family coverage -----------------------------------------------------
  p(`## 2. Coverage of the ten required families`);
  p();
  p(`| Family | Tests | Positive | Negative *(needs intent)* | Characterization | Marked N/A |`);
  p(`|---|---:|---:|---:|---:|---:|`);
  for (const f of rec.familyCoverage) {
    p(`| ${cell(f.family)} | ${f.tests} | ${f.positive} | ${f.negative} | ${f.characterization} | ${f.notApplicable} |`);
  }
  p();

  // --- verdict semantics --------------------------------------------------
  p(`## 3. Execution versus assurance verdict`);
  p();
  p(`Every evidence record carries **two** independent fields, so that "the probe did what we`);
  p(`predicted" can never be read as "the control holds".`);
  p();
  p(`| Field | Values | Says |`);
  p(`|---|---|---|`);
  p(`| \`observation\` | as_predicted / not_as_predicted / harness_error | did execution match the prediction |`);
  p(`| \`verdict\` | effective / deficient / characterized / gap / not_measured | what that means for the control |`);
  p();
  p(`The two come apart in exactly the places that would otherwise produce a false green:`);
  p();
  p(`- **F7 owner bypass.** The probe returns every row, precisely as predicted, because row-level`);
  p(`  security is enabled and not forced. \`observation: as_predicted\`, \`verdict:\``);
  p(`  **\`characterized\`** — a fact was recorded and no control was asserted either way. It is`);
  p(`  never \`effective\`, because the control was not applied at all.`);
  p(`- **F10 audit trail.** The probe confirms no trail exists, precisely as predicted.`);
  p(`  \`observation: as_predicted\`, \`verdict:\` **\`gap\`** — the control does not exist to be`);
  p(`  exercised.`);
  p(`- **Partial trails.** Two of the four structures that look like audit trails answer only part`);
  p(`  of who-did-what-when, so their existence check also records \`gap\` rather than \`effective\`.`);
  p();
  p(`A harness error remains a third, separate state: it never matches an expectation, renders as`);
  p(`\`HARNESS ERROR\`, and yields \`verdict: not_measured\` (DECISIONS D1.13).`);
  p();
  const byVerdict = { effective: 0, characterized: 0, gap: 0 } as Record<string, number>;
  for (const t of plan.tests) byVerdict[t.verdictWhenPredicted] = (byVerdict[t.verdictWhenPredicted] ?? 0) + 1;
  p(`Planned verdicts when execution matches: **${byVerdict.effective}** effective, **${byVerdict.characterized}** characterized, **${byVerdict.gap}** gap.`);
  p();

  // --- F3 applicability ---------------------------------------------------
  p(`## 4. F3 applicability — every policy carrying a WITH CHECK`);
  p();
  p(`One row per policy **considered**, whether or not a test was planned for it. Three numbers`);
  p(`describe different sets and the table is what keeps them apart:`);
  p();
  const f3 = plan.f3Applicability;
  const corrected = f3.filter((x) => x.polcmd === "UPDATE");
  const nonEx = f3.filter((x) => !x.exercisable);
  const negs = f3.filter((x) => x.negativeTestId !== null);
  const skipped = f3.filter((x) => x.exercisable && x.negativeTestId === null);
  p(`- **${corrected.length}** UPDATE policies had their command corrected from INSERT to UPDATE.`);
  p(`- **${nonEx.length}** policies are **not independently exercisable** from a client session.`);
  p(`- **${negs.length}** negative tests are planned.`);
  p(`- **${skipped.length}** exercisable but not selected for a negative case by the tier's representative rule.`);
  p();
  p(`| Resource | Policy | polcmd | New-row check reads | Client INSERT cols | Client UPDATE cols | Exercisable | Reason if no | Positive | Negative |`);
  p(`|---|---|---|---|---|---|:---:|---|---|---|`);
  for (const x of f3) {
    p(
      `| \`${cell(x.resource)}\` | \`${cell(x.policy)}\` | ${cell(x.polcmd)} | ${x.newRowColumns.map((c) => `\`${c}\``).join(", ") || "—"} | ${x.clientInsertColumns.join(", ") || "none"} | ${x.clientUpdateColumns.map((c) => `\`${c}\``).join(", ") || "none"} | ${x.exercisable ? "yes" : "**no**"} | ${cell(x.reasonIfNot) || "—"} | ${x.positiveTestId ? `\`${x.positiveTestId}\`` : "—"} | ${x.negativeTestId ? `\`${x.negativeTestId}\`` : "—"} |`,
    );
  }
  p();

  // --- the matrix ----------------------------------------------------------
  p(`## 5. The matrix`);
  p();
  p(`Grouped by family. \`Plumbing\`: **reuse WP1** means the same mechanism WP1 already drives;`);
  p(`**extend WP1** means the mechanism exists but needs a new case or seeded row; **new** means it`);
  p(`must be built. Reuse refers to the *code*: every row below produces a fresh WP3 evidence`);
  p(`record, and no WP1 deliberate-break scenario counts as a completed WP3 control test.`);
  p();
  for (const family of FAMILIES) {
    const rows = plan.tests.filter((t) => t.family === family);
    const naRows = plan.notApplicable.filter((t) => t.family === family);
    if (rows.length === 0 && naRows.length === 0) continue;
    p(`### ${family}`);
    p();
    if (rows.length) {
      p(`| Test ID | Resource / control | Tier | ± | Identity | Operation | Expected | Verdict if predicted | Covers | Plumbing | AUTHOR INTENT |`);
      p(`|---|---|---|---|---|---|---|---|---|---|---|`);
      for (const t of rows) {
        const intent = t.polarity === "negative" ? "**AUTHOR INTENT:** \\_\\_\\_\\_\\_" : "—";
        const pol = t.polarity === "positive" ? "pos" : t.polarity === "negative" ? "**neg**" : "char";
        const v = t.verdictWhenPredicted === "effective" ? "effective"
          : t.verdictWhenPredicted === "gap" ? "**GAP**" : "**characterized**";
        p(
          `| \`${cell(t.testId)}\` | \`${cell(t.control)}\` | ${cell(t.tier)} | ${pol} | ${cell(t.identity)} | ${cell(t.operation)} | ${cell(t.expected)} | ${cell(t.fixture)} | ${v} | ${cell(t.covers)} | ${cell(t.plumbing)} | ${intent} |`,
        );
      }
      p();
    }
    if (naRows.length) {
      p(`**Not applicable (${naRows.length})** — stated reason, no invented test:`);
      p();
      for (const t of naRows) p(`- \`${cell(t.resource)}\` — ${cell(t.reason)}`);
      p();
    }
  }

  return L.join("\n");
}
