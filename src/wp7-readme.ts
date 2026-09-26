/**
 * Attest — the README's generated block (D3.61).
 *
 * The README is documentation, but its headline numbers are evidence: everything
 * between the two markers below is rewritten by `attest reports` from the facts,
 * and `validate-reports` refuses a README whose block differs from what the
 * evidence regenerates. Nothing numeric in the README is typed by hand.
 */
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import { FAMILIES, type Facts } from "./evidence-facts.ts";

export const README_PATH = join(ATTEST_ROOT, "README.md");
export const README_START = "<!-- attest:generated:start — rewritten by `npm run attest reports`; do not edit by hand -->";
export const README_END = "<!-- attest:generated:end -->";

export function renderReadmeBlock(f: Facts): string {
  const bv = f.wp3.byVerdict;
  const items = f.wp5.items;
  const L: string[] = [];
  const p = (s = "") => L.push(s);
  p(README_START);
  p();
  p(`**Evidence:** WP3 run \`${f.runs.wp3}\` (validated ${f.wp3.validationChecksPassed}/${f.wp3.validationChecks}) · WP4 run \`${f.runs.wp4}\` · frozen CP1/CP3 run \`${f.runs.frozenCp3}\` · schema \`${f.wp3.schemaVersion.slice(0, 12)}\` (${f.wp3.migrationCount} migrations).`);
  p();
  p("| Inventory (WP0), read from the live catalogs | |");
  p("|---|---:|");
  p(`| Resources in scope | ${f.wp0.resources} |`);
  p(`| (resource, control) pairs | ${f.wp0.controls} |`);
  p(`| Row-level security policies | ${f.wp0.policies} |`);
  p(`| \`SECURITY DEFINER\` functions | ${f.wp0.definerFunctions} (${f.wp0.definerClientCallable} callable by a client role) |`);
  p(`| Triggers (${f.wp0.triggersThatCanRefuse} of which can refuse a write) | ${f.wp0.triggers} |`);
  p(`| Column-level grants | ${f.wp0.columnGrants} |`);
  p(`| Tables with row-level security **enabled** | ${f.wp0.rlsEnabled} of ${f.wp0.tables} |`);
  p(`| Tables with row-level security **forced** | **${f.wp0.rlsForced} of ${f.wp0.tables}** |`);
  p(`| Resources with no control at all | ${f.wp0.resourcesWithoutControl.length} |`);
  p();
  p(`**WP3, the assessment** — ${f.wp3.total} Test IDs (${f.wp3.byPolarity.positive ?? 0} positive, ${f.wp3.byPolarity.negative ?? 0} negative, ${f.wp3.byPolarity.characterization ?? 0} characterization) under role-scoped sessions:`);
  p();
  p("| Verdict | Tests |");
  p("|---|---:|");
  p(`| effective | ${bv.effective} |`);
  p(`| gap | ${bv.gap} |`);
  p(`| characterized | ${bv.characterized} |`);
  p(`| deficient | ${bv.deficient} |`);
  p(`| not measured (never counted as effective) | ${bv.not_measured} |`);
  p();
  p("| Family | Tests | effective | not effective |");
  p("|---|---:|---:|---|");
  for (const fam of FAMILIES) {
    const c = f.wp3.byFamily[fam.code]!;
    const rest = [c.deficient && `${c.deficient} deficient`, c.gap && `${c.gap} gap`, c.characterized && `${c.characterized} characterized`, c.not_measured && `${c.not_measured} not measured`].filter(Boolean).join(", ");
    p(`| ${fam.code} ${fam.name} | ${c.total} | ${c.effective} | ${rest || "—"} |`);
  }
  p();
  p(`**WP5, after CP4** (${f.wp5.cp4Approved ? `approved by the author ${f.wp5.cp4Date}` : "not approved"}): ${items.filter((i) => i.part === "finding").length} findings, ${items.filter((i) => i.part === "informational").length} informational items, ${items.filter((i) => i.part === "limitation").length} limitations.`);
  p();
  p("| # | Item | Tier | Evidence | The author's status |");
  p("|---|---|---|---|---|");
  for (const i of items) p(`| ${i.id} | ${i.title} | ${i.tier} | ${i.evidenceClass === "none" ? "WP0" : `${i.testIds.length} ${i.evidenceClass}`} | ${i.status.replace(/_/g, " ")} |`);
  p();
  p(`**WP4, drift:** ${f.wp4.states.length} schema states; ${f.wp4.diffs.reduce((m, d) => m + (d.passToFail ?? 0), 0)} approved questions went from pass to fail across Arc21's history; the Attest-only unprotected table (${f.wp4.newUnprotected.map((u) => `\`${u.resource}\``).join(", ")}) was reported on the run that added it.`);
  p();
  p(README_END);
  return L.join("\n");
}

/** Replace the block between the markers; refuse if the markers are missing. */
export function spliceReadme(readme: string, block: string): string {
  const a = readme.indexOf(README_START), b = readme.indexOf(README_END);
  if (a < 0 || b < 0 || b < a) throw new Error("README.md has no generated block (markers missing)");
  return readme.slice(0, a) + block + readme.slice(b + README_END.length);
}
