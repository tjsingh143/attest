/**
 * Attest — the CP3 report.
 *
 * Shows the tier distribution, every High resource with its rationale, the
 * non-obvious Medium/Low calls, the evidence marks that materially affected a
 * tier, the sensitivity result, and any rule outcome worth a second look —
 * reported, never adjusted.
 */
import type { Cp3Result } from "./cp3.ts";
import type { Scored } from "./scorer.ts";

const cell = (v: unknown) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

const EXPO: Record<string, string> = {
  server_only: "server-only", authenticated: "authenticated", anonymous: "anonymous",
};

function dimLine(s: Scored): string {
  const r = s.rating;
  return `Data ${r.data.level}/${r.data.evidence} · Blast ${r.blast.level}/${r.blast.evidence} · Integrity ${r.integrity.level}/${r.integrity.evidence} · Reversibility ${r.reversibility.level}/${r.reversibility.evidence} · Exposure ${r.exposure.level}/${r.exposure.evidence}`;
}

export function renderCp3Markdown(r: Cp3Result): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# CP3 — risk tiers and assurance allocation`);
  p();
  p(`Produced by applying \`RUBRIC.md\` — authored by the author — to the ${r.scored.length} resources in the`);
  p(`control inventory. The rules are the rubric's; this document is their output.`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Run | \`${r.runId}\` |`);
  p(`| Schema version | \`${r.schemaVersion}\` |`);
  p(`| Harness version | \`${r.harness.version}\` sources \`${r.harness.sourcesSha256.slice(0, 12)}\` |`);
  p(`| Instance | ${r.instance} |`);
  p();

  if (r.coverageGaps.length) {
    p(`> **Coverage gaps**`);
    for (const g of r.coverageGaps) p(`> - ${cell(g)}`);
    p();
  }
  if (r.issues.length) {
    p(`> **Rubric validation issues**`);
    for (const i of r.issues) p(`> - \`${cell(i.resource)}\` — ${cell(i.problem)}`);
    p();
  }

  // --- distribution -------------------------------------------------------
  p(`## 1. Tier distribution`);
  p();
  p(`| Tier | Resources | Share |`);
  p(`|---|---:|---:|`);
  for (const t of ["High", "Medium", "Low"] as const) {
    const n = r.distribution[t];
    p(`| **${t}** | ${n} | ${((n / r.scored.length) * 100).toFixed(0)}% |`);
  }
  p(`| | **${r.scored.length}** | |`);
  p();

  // --- high tier ----------------------------------------------------------
  const high = r.scored.filter((s) => s.tier === "High");
  p(`## 2. Every High resource, and why`);
  p();
  p(`${high.length} resources. The rule that fired is quoted from the rubric's Step 1; the deciding`);
  p(`dimension's own rationale follows it.`);
  p();
  for (const s of high) {
    const rule = s.impactRule;
    const driver =
      rule.startsWith("Data") ? s.rating.data.why
      : rule.startsWith("Integrity") ? s.rating.integrity.why
      : rule.startsWith("Reversibility") ? s.rating.reversibility.why
      : s.rating.blast.why;
    p(`### \`${cell(s.resource)}\``);
    p();
    p(`**Impact High** — ${cell(rule)}. Exposure scored as **${EXPO[s.scoredExposure]}** (${s.rating.exposure.drivingFailureMode} drives).`);
    p();
    p(`> ${cell(driver)}`);
    p();
    p(`${dimLine(s)}${s.rating.preDecidedBy ? ` · pre-decided by ${cell(s.rating.preDecidedBy)}` : ""}`);
    p();
  }

  // --- non-obvious medium / low ------------------------------------------
  p(`## 3. Non-obvious Medium and Low decisions`);
  p();
  p(`Resources that a reasonable reader might have expected to land elsewhere.`);
  p();
  const medium = r.scored.filter((s) => s.tier === "Medium");
  p(`| Resource | Tier | Why not higher | Dimensions |`);
  p(`|---|---|---|---|`);
  for (const s of medium) {
    p(`| \`${cell(s.resource)}\` | ${s.tier} | ${cell(s.impactRule)} | ${cell(dimLine(s))} |`);
  }
  p();
  if (r.distribution.Low === 0) {
    p(`**No resource reached Low tier.** That is a structural consequence of the rubric rather than`);
    p(`a judgment about any one resource — see §6.`);
    p();
  }

  // --- evidence -----------------------------------------------------------
  p(`## 4. Evidence marks that materially affected a tier`);
  p();
  p(`A mark is *material* when the dimension carrying it is the one that decided the impact level.`);
  p(`Evidence sufficiency never changes a tier arithmetically; it says how well the deciding`);
  p(`judgment is supported.`);
  p();
  const material = r.scored.filter((s) => {
    const rule = s.impactRule;
    const dim =
      rule.startsWith("Data") ? s.rating.data
      : rule.startsWith("Integrity") ? s.rating.integrity
      : rule.startsWith("Reversibility") ? s.rating.reversibility
      : null;
    return dim !== null && dim.evidence !== "E";
  });
  if (material.length === 0) {
    p(`None. Every tier-deciding dimension is marked \`E\`.`);
  } else {
    p(`| Resource | Tier | Deciding dimension | Mark | What is not established |`);
    p(`|---|---|---|---|---|`);
    for (const s of material) {
      const rule = s.impactRule;
      const [name, dim] =
        rule.startsWith("Data") ? ["Data criticality", s.rating.data] as const
        : rule.startsWith("Integrity") ? ["Integrity impact", s.rating.integrity] as const
        : ["Reversibility", s.rating.reversibility] as const;
      p(`| \`${cell(s.resource)}\` | ${s.tier} | ${name} | \`${dim.evidence}\` | ${cell(dim.why)} |`);
    }
  }
  p();
  const allWeak = r.scored.filter((s) => s.weakEvidence.length > 0);
  p(`Across all dimensions, ${allWeak.length} of ${r.scored.length} resources carry at least one non-\`E\` mark:`);
  p();
  for (const s of allWeak) p(`- \`${cell(s.resource)}\` — ${s.weakEvidence.join(", ")}`);
  p();

  // --- sensitivity --------------------------------------------------------
  const moved = r.sensitivity.filter((x) => x.changed);
  p(`## 5. Sensitivity — the single alternative exposure interpretation`);
  p();
  p(`**Alternative:** treat a resource as **anonymous** exposure whenever the anonymous role already`);
  p(`holds the underlying grant, even where a current policy prevents anonymous access. Applied to`);
  p(`every resource with that condition. Everything else in the rubric is unchanged.`);
  p();
  const candidates = r.sensitivity.filter((x) => {
    const s = r.scored.find((y) => y.resource === x.resource);
    return s?.rating.exposure.anonymousGrantExists === true;
  });
  p(`${candidates.length} resources carry an anonymous grant and are therefore affected by the`);
  p(`re-interpretation: ${candidates.map((c) => `\`${c.resource}\``).join(", ")}.`);
  p();
  if (moved.length === 0) {
    p(`**No resource changes tier.** The assurance allocation is robust to this exposure`);
    p(`interpretation.`);
  } else {
    p(`| Resource | Primary tier | Alternative tier | Primary tests | Alternative tests | Δ |`);
    p(`|---|---|---|---:|---:|---:|`);
    for (const m of moved) {
      p(`| \`${cell(m.resource)}\` | ${m.primaryTier} | **${m.alternativeTier}** | ${m.primaryTests} | ${m.alternativeTests} | ${m.alternativeTests - m.primaryTests >= 0 ? "+" : ""}${m.alternativeTests - m.primaryTests} |`);
    }
    p();
    p(`**${moved.length} resource(s) change tier.** This exposure assumption is therefore a material`);
    p(`driver of the assurance plan.`);
  }
  p();
  p(`| | Estimated tests |`);
  p(`|---|---:|`);
  p(`| Primary rubric | ${r.totalTestsPrimary} |`);
  p(`| Alternative | ${r.totalTestsAlternative} |`);
  p(`| **Delta** | **${r.totalTestsAlternative - r.totalTestsPrimary >= 0 ? "+" : ""}${r.totalTestsAlternative - r.totalTestsPrimary}** |`);
  p();

  // --- test allocation ----------------------------------------------------
  p(`## 6. Assurance allocation and test-count estimate`);
  p();
  p(`Per \`RUBRIC.md\` Part 5. A **policy branch** is a materially distinct authorization condition`);
  p(`that can independently change an allow/deny outcome.`);
  p();
  p(`**Estimator constants.** The rubric defines what each tier must cover; it does not fix these`);
  p(`numbers, so they are named here rather than buried:`);
  p();
  p(`| Constant | Value | Meaning |`);
  p(`|---|---:|---|`);
  p(`| \`highCasesPerBranch\` | ${r.estimator.highCasesPerBranch} | one positive and one negative per branch |`);
  p(`| \`highBoundaryCases\` | ${r.estimator.highBoundaryCases} | null identity, deleted user, expired session |`);
  p(`| \`mediumCasesPerCommand\` | ${r.estimator.mediumCasesPerCommand} | a representative positive and negative per important path |`);
  p(`| \`lowProbes\` | ${r.estimator.lowProbes} | recorded exploratory probing: one read, one write |`);
  p();
  p(`| Tier | Resources | Branches | Estimated tests |`);
  p(`|---|---:|---:|---:|`);
  for (const t of ["High", "Medium", "Low"] as const) {
    const rows = r.scored.filter((s) => s.tier === t);
    if (rows.length === 0) continue;
    p(`| ${t} | ${rows.length} | ${rows.reduce((a, s) => a + s.branches, 0)} | ${rows.reduce((a, s) => a + s.tests, 0)} |`);
  }
  p(`| **Total** | **${r.scored.length}** | **${r.scored.reduce((a, s) => a + s.branches, 0)}** | **${r.totalTestsPrimary}** |`);
  p();
  p(`Per resource:`);
  p();
  p(`| Resource | Tier | Branches | How the branches were counted | Tests |`);
  p(`|---|---|---:|---|---:|`);
  for (const s of r.scored) {
    p(`| \`${cell(s.resource)}\` | ${s.tier} | ${s.branches} | ${cell(s.branchDetail)} | ${s.tests} |`);
  }
  p();

  // --- structural observations -------------------------------------------
  p(`## 7. Rule outcomes worth a second look`);
  p();
  p(`Reported, not adjusted. Each of these follows from the rubric as written.`);
  p();

  p(`### The exposure dimension did not change a single tier`);
  p();
  p(`${r.exposureInertCount} of ${r.scored.length} resources have High impact, and the rubric's floor fixes those at High`);
  p(`whatever their exposure. The remaining ${r.exposureCouldHaveMattered.length} have Medium impact, where exposure *could* have`);
  p(`lifted a resource to High — but only anonymous exposure does that, and none of them is`);
  p(`anonymous. **Every tier in this run was decided by impact alone.**`);
  p();
  p(`That is not a defect. It is what the floor is for, and it is precisely why the sensitivity`);
  p(`analysis is informative: re-interpreting exposure is the only thing that makes the dimension`);
  p(`do any work at all, and it moves ${r.sensitivity.filter((x) => x.changed).length} resources when it does.`);
  p();

  if (r.distribution.Low === 0) {
    p(`### No resource reached Low tier`);
    p();
    p(`Low impact requires **all four** consequence dimensions to be Low. Combined with the rubric's`);
    p(`uncertainty rule — Low reversibility must be positively supported, otherwise Medium/\`U\` — a`);
    p(`resource can only reach Low tier if it is unimportant, isolated, harmless to corrupt **and**`);
    p(`has a demonstrated restore path. Only a handful of resources here have the last of those, and`);
    p(`each of them scores Medium or High somewhere else.`);
    p();
    p(`The practical consequence is that the Low assurance activity is currently unused, and every`);
    p(`resource earns at least limited scripted testing.`);
    p();
  }

  const lowestDims = r.scored.filter(
    (s) => s.rating.data.level === "Low" && s.rating.blast.level === "Low" && s.rating.integrity.level === "Low",
  );
  if (lowestDims.length) {
    p(`### The nearest thing to a Low-tier resource`);
    p();
    for (const s of lowestDims) {
      p(`- \`${cell(s.resource)}\` — Data, Blast and Integrity all Low; only Reversibility`);
      p(`  ${s.rating.reversibility.level}/\`${s.rating.reversibility.evidence}\` keeps it out of Low tier.`);
      p(`  > ${cell(s.rating.reversibility.why)}`);
    }
    p();
  }

  return L.join("\n");
}
