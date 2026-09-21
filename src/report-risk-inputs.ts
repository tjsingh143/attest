/**
 * Attest — rendering the WP2 factual inputs.
 *
 * This document exists to be read and argued with before a single score is
 * written. It contains no scores, no tiers and no severity, because those are
 * the author's (brief §1.1) and because a worksheet that arrives pre-filled is
 * a worksheet nobody actually thinks about.
 */
import type { RiskInputs, RiskInput } from "./risk-inputs.ts";

const cell = (v: unknown) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const yn = (v: boolean) => (v ? "yes" : "no");

const EXPOSURE_LABEL: Record<string, string> = {
  anonymous: "anonymous",
  anonymous_latent: "anonymous (latent)",
  authenticated: "authenticated",
  server_only: "server-only",
};

export function renderRiskInputsMarkdown(
  inputs: RiskInputs,
  meta: { runId: string; schemaVersion: string; startedAt: string },
): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# Risk rubric — factual inputs (WP2 scaffold)`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Run | \`${meta.runId}\` |`);
  p(`| Schema version | \`${meta.schemaVersion}\` |`);
  p(`| Generated | ${meta.startedAt} |`);
  p(`| Resources | ${inputs.counts.resources} |`);
  p();
  p(`> **There are no scores in this document, and there will not be.** Every line below is`);
  p(`> something the database says. What any of it is *worth* — which dimensions matter, what`);
  p(`> each level scores, how the dimensions combine, where the tier boundaries fall — is the`);
  p(`> rubric, and the rubric is written by hand in \`RUBRIC.md\`.`);
  p(`>`);
  p(`> The split is the point. A tier that came out of a tool is a tier nobody can defend when`);
  p(`> somebody disagrees with it.`);
  p();

  // --- how the facts map to the required dimensions ----------------------
  p(`## Which fact answers which dimension`);
  p();
  p(`The brief requires the rubric to score at least five dimensions. Four of them have facts`);
  p(`here. One does not, and that is worth saying plainly.`);
  p();
  p(`| Dimension | What is supplied below | What is still a judgment |`);
  p(`|---|---|---|`);
  p(`| **What the data is** | every column, its type, whether it is server-generated, and Arc21's own comment on the table and on each column | what kind of thing that makes it, and whether it matters |`);
  p(`| **Blast radius** | which relations hold a foreign key to this one, which it points at, and which columns carry the identity | whether "one user", "all users" or "shared state" is the right reading |`);
  p(`| **Integrity impact** | inbound cascades, refusing triggers, append-only guards | whether corruption here propagates in a way that matters |`);
  p(`| **Reversibility** | append-only guards, truncate guards, which server functions write it | whether damage could actually be undone in practice |`);
  p(`| **Exposure** | a classification of grants and policies together: anonymous, anonymous-latent, authenticated, server-only | what each class is worth relative to the others |`);
  p();
  p(`**Exposure is the one that is already mechanical**, and it is worth understanding why it is`);
  p(`a fact rather than an opinion. It is decided by the grant surface and the policy set`);
  p(`together, because either alone gives the wrong answer: \`realtime.messages\` grants \`anon\``);
  p(`INSERT, SELECT and UPDATE, and every policy on it names \`authenticated\`, so it is granted to`);
  p(`anonymous callers and refused to them. Neither "anonymous" nor "server-only" describes that.`);
  p(`It gets its own class.`);
  p();

  // --- the landscape ------------------------------------------------------
  p(`## Every resource, side by side`);
  p();
  p(`Sorted by exposure, then by how many other relations depend on it — not because that is the`);
  p(`ranking, but because reading them in a consistent order makes the outliers visible.`);
  p();
  p(`| Resource | Exposure | Identity column | Cols | Referenced by | Policies | Refusing triggers | Written by definer fns |`);
  p(`|---|---|---|---:|---:|---:|---:|---:|`);

  const order: Record<string, number> = { anonymous: 0, anonymous_latent: 1, authenticated: 2, server_only: 3 };
  const sorted = [...inputs.resources].sort(
    (a, b) =>
      (order[a.exposure] ?? 9) - (order[b.exposure] ?? 9) ||
      b.referencedByCount - a.referencedByCount ||
      a.resource.localeCompare(b.resource),
  );

  for (const r of sorted) {
    p(
      `| \`${cell(r.resource)}\` | ${EXPOSURE_LABEL[r.exposure]} | ${r.identityColumns.length ? r.identityColumns.map((c) => `\`${c}\``).join(", ") : "—"} | ${r.columnCount} | ${r.referencedByCount} | ${r.policyCount} | ${r.refusingTriggers.length} | ${r.writtenByDefinerFunctions.length} |`,
    );
  }
  p();
  p(`Counts by exposure: ` +
    (["anonymous", "anonymous_latent", "authenticated", "server_only"] as const)
      .map((e) => `**${inputs.counts[`exposure.${e}`]}** ${EXPOSURE_LABEL[e]}`)
      .join(", ") + `.`);
  p();

  // --- per-resource dossiers ---------------------------------------------
  p(`## Resource dossiers`);
  p();
  p(`One per resource, in the same order. Everything needed to score a row is in its own section,`);
  p(`so scoring does not require holding six tables in your head at once.`);
  p();

  for (const r of sorted) {
    p(`### \`${r.resource}\``);
    p();
    if (r.declaredIntent) {
      p(`> **Arc21 says:** ${cell(r.declaredIntent)}`);
      p(`>`);
      p(`> *(The author's \`COMMENT\`. A claim about the resource, recorded beside the facts, not in place of them.)*`);
      p();
    } else {
      p(`> **Arc21 says:** *(no table comment)*`);
      p();
    }

    p(`| | |`);
    p(`|---|---|`);
    p(`| Kind | ${cell(r.kind)}, owned by \`${cell(r.owner)}\` |`);
    p(`| Exposure | **${EXPOSURE_LABEL[r.exposure]}** — ${cell(r.exposureDetail)} |`);
    p(`| Row-level security | enabled: ${yn(r.rlsEnabled)}, forced: ${yn(r.rlsForced)} |`);
    p(`| Identity column | ${r.identityColumns.length ? r.identityColumns.map((c) => `\`${c}\``).join(", ") + " → `auth.users`" : "none — this table does not record whose row it is"} |`);
    p(`| Depended on by | ${r.referencedByCount} relation(s)${r.cascadingInbound.length ? `, ${r.cascadingInbound.length} of them ON DELETE CASCADE` : ""} |`);
    p(`| Published to realtime | ${yn(r.realtimePublished)} |`);
    p();

    if (r.policies.length) {
      p(`**Policies** (${r.policyCount} across ${r.commandsWithPolicy.join(", ")})`);
      p();
      p(`| Policy | Command | Kind | Roles | USING | WITH CHECK |`);
      p(`|---|---|---|---|---|---|`);
      for (const pol of r.policies) {
        p(`| \`${cell(pol.name)}\` | ${cell(pol.command)} | ${cell(pol.permissive)} | ${pol.roles.map((x) => `\`${x}\``).join(", ")} | ${yn(pol.hasUsing)} | ${yn(pol.hasWithCheck)} |`);
      }
      p();
    } else {
      p(`**Policies:** none.${r.rlsEnabled ? " Row-level security is enabled, so every non-owner is denied by default." : ""}`);
      p();
    }

    p(`**Columns** (${r.columnCount})`);
    p();
    p(`| Column | Type | Not null | Server-generated | Client privilege on this column |`);
    p(`|---|---|---|---|---|`);
    for (const c of r.columns) {
      p(`| \`${cell(c.name)}\` | ${cell(c.type)} | ${yn(c.notNull)} | ${yn(c.serverGenerated)} | ${c.clientWritable.length ? cell(c.clientWritable.join("; ")) : "—"} |`);
    }
    p();

    const colNotes = r.columns.filter((c) => c.declaredIntent);
    if (colNotes.length) {
      p(`Column comments:`);
      p();
      for (const c of colNotes) p(`- \`${cell(c.name)}\` — ${cell(c.declaredIntent)}`);
      p();
    }

    if (r.referencedBy.length) {
      p(`**Depended on by**`);
      p();
      p(`| Relation | Via column(s) | ON DELETE |`);
      p(`|---|---|---|`);
      for (const l of r.referencedBy) {
        p(`| \`${cell(l.relation)}\` | ${l.columns.map((c) => `\`${c}\``).join(", ")} | ${cell(l.onDelete)} |`);
      }
      p();
    }

    if (r.references.length) {
      p(`**Depends on:** ` + r.references.map((l) => `\`${l.relation}\``).join(", ") + `.`);
      p();
    }

    const guards: string[] = [];
    if (r.refusingTriggers.length) guards.push(`refusing triggers: ${r.refusingTriggers.map((t) => `\`${t}\``).join(", ")}`);
    if (r.appendOnlyGuards.length) guards.push(`append-only / truncate guards: ${r.appendOnlyGuards.map((t) => `\`${t}\``).join(", ")}`);
    if (guards.length) {
      p(`**Guards.** ${guards.join("; ")}.`);
      p();
      p(`*Whether these actually refuse anything is settled by executing a statement, not by their`);
      p(`names. WP1 proved it for \`profiles_guard_server_columns\`; the rest are untested until WP3.*`);
      p();
    }

    if (r.writtenByDefinerFunctions.length) {
      p(`**Named by ${r.writtenByDefinerFunctions.length} SECURITY DEFINER function(s)**, which execute with their owner's`);
      p(`privileges rather than the caller's — so these are the server-side paths that can reach this`);
      p(`resource regardless of the caller's policies:`);
      p();
      for (const f of r.writtenByDefinerFunctions.slice(0, 12)) p(`- \`${cell(f)}\``);
      if (r.writtenByDefinerFunctions.length > 12) {
        p(`- *…and ${r.writtenByDefinerFunctions.length - 12} more; the full list is in \`risk-inputs.json\`.*`);
      }
      p();
      p(`*Text match on the function body. It misses anything reached through dynamic SQL and`);
      p(`over-reports a name that appears only in a comment.*`);
      p();
    }
  }

  return L.join("\n");
}
