/**
 * Attest — the command registry (D3.61).
 *
 * One list of every `attest` command: the CLI prints its usage from it, the README's
 * command table is generated from it, and `validate-reports` requires that every
 * command here has a `case` in src/cli.ts and every `case` there is listed here — so
 * the documentation cannot describe a command that does not exist, or miss one that does.
 */

export type DbUse = "none" | "reads" | "writes" | "rebuilds";

export interface CommandSpec {
  readonly name: string;
  /** How it is invoked after `npm run attest`, when it takes arguments. */
  readonly usage?: string;
  readonly does: string;
  /** What it does to the disposable local database. */
  readonly db: DbUse;
  readonly network?: boolean;
  readonly group: "reproduce" | "reports" | "assessment" | "history";
}

export const COMMANDS: readonly CommandSpec[] = [
  { name: "run", group: "reproduce", db: "rebuilds", does: "the one command: rebuild the disposable database from Arc21's migrations, re-read the inventory, re-run the harness validation (WP1), re-score (WP2), rebuild the fixtures, re-plan WP3, compare every one of those with the frozen evidence, re-prove every gate, then regenerate and validate every report" },
  { name: "run --confirm", usage: "run -- --confirm [--with-wp4]", group: "reproduce", db: "rebuilds", does: "all of `run`, then execute the full WP3 assessment again (a reproduction, never a new result), validate it independently and compare every Test ID with the official run; `--with-wp4` also repeats WP4 against it" },
  { name: "reports", group: "reports", db: "none", does: "regenerate FINDINGS.md, the CP4 and CP5 records, the framework mapping and CSA note, the assurance report, the dashboard, the plain-language summary and the README's generated sections from the persisted evidence, then run validate-reports" },
  { name: "validate-reports", group: "reports", db: "none", does: "re-derive every headline number from the raw evidence with its own code, check every report agrees with it and with each other, lint every generated document for overclaiming and stale wording, and require each file to be byte-identical to what the evidence regenerates" },
  { name: "wp5", usage: "wp5 -- [--wp3-run=<id> --plan-run=<id> --wp4-run=<id>]", group: "reports", db: "none", does: "WP5 alone: the ranked findings, remediation guidance and CP4 record, from validated evidence only (defaults to the official runs)" },
  { name: "wp6", group: "reports", db: "none", does: "WP6 alone: the framework mapping (a study exercise), the CSA note and the CP5 record, independently validated" },
  { name: "validate-wp6", group: "reports", db: "none", does: "re-derive every citation and count in the framework mapping from the raw records" },
  { name: "framework-sources", group: "reports", db: "none", network: true, does: "re-fetch the framework texts WP6 quotes (NIST OSCAL catalog, eCFR) into rubric/framework-sources.json — the only command that uses the network" },
  { name: "verify-finding", usage: "verify-finding -- <item> --official=<id> --candidate=<id>", group: "reports", db: "none", does: "would a future run confirm a fix of one finding: its Test IDs at the stated verdict, the run validated, and no regression" },
  { name: "compare-wp3", usage: "compare-wp3 -- <candidate id> [--official=<id>]", group: "reports", db: "none", does: "compare two WP3 runs Test ID by Test ID — verdict, observation, recorded outcome, identity" },
  { name: "bringup", group: "assessment", db: "rebuilds", does: "rebuild the disposable database from Arc21's migrations, verify the schema version, apply the deterministic seed" },
  { name: "inventory", group: "assessment", db: "reads", does: "read the control inventory from the live catalogs (WP0)" },
  { name: "validate", group: "assessment", db: "writes", does: "WP1: break controls on purpose in the disposable database, confirm the role-scoped probe notices and over-privileged connections do not, put them back" },
  { name: "risk-inputs", group: "assessment", db: "reads", does: "assemble the per-resource facts the risk rubric needs — no scores (WP2)" },
  { name: "rubric", group: "assessment", db: "none", does: "report what is unauthored in RUBRIC.md" },
  { name: "score", group: "assessment", db: "reads", does: "apply the author's rubric, compute the tiers, check the CP3 arithmetic (WP2)" },
  { name: "seed-extensions", group: "assessment", db: "writes", does: "build and verify the fixture state the WP3 matrix requires (some fixtures are date-bound: re-run after a UTC date change)" },
  { name: "plan-wp3", group: "assessment", db: "reads", does: "generate and validate the WP3 test matrix; executes nothing" },
  { name: "preflight-wp3", usage: "preflight-wp3 -- [--for-execution]", group: "assessment", db: "rebuilds", does: "check everything that must hold before WP3 may execute (rebuilds the disposable database once)" },
  { name: "prove-gates", group: "assessment", db: "reads", does: "break every gate on purpose — deep copies, rolled-back transactions, a throwaway git repo, tampered report copies — require each to fire, and record the result in evidence/prove-gates/" },
  { name: "execute-wp3", usage: "execute-wp3 -- --confirm", group: "assessment", db: "rebuilds", does: "run the approved WP3 suite (refused unless preflight passes for execution)" },
  { name: "validate-wp3", usage: "validate-wp3 -- <run id> [--plan-run=<id>]", group: "assessment", db: "none", does: "independently re-derive every verdict and total of a WP3 results file from its raw records" },
  { name: "wp4", usage: "wp4 -- --wp3-run=<id> --plan-run=<id>", group: "assessment", db: "rebuilds", does: "WP4 drift: rebuild Arc21's earlier schema states from its git history (read-only, into .wp4-states/), inventory each, run the approved probes each can answer, and diff them" },
  { name: "wp4-state", usage: "wp4-state -- <run id> <state> --plan-run=<id>", group: "assessment", db: "rebuilds", does: "one WP4 schema state, run in its own process by `wp4`" },
  { name: "wp4-report", usage: "wp4-report -- <wp4 run id> --wp3-run=<id> --plan-run=<id>", group: "assessment", db: "none", does: "regenerate a WP4 run's drift report from what its states persisted" },
  { name: "smoke-wp3", usage: "smoke-wp3 <Test ID>…", group: "history", db: "rebuilds", does: "plumbing smoke of a few named probes (the code caps the number), written under .smoke/ and stamped NOT WP3 EVIDENCE" },
  { name: "draft-intents", group: "history", db: "reads", does: "Gate A history: draft the attack sentences for the author to review (every one was adopted at Gate A; a draft never replaces an adopted sentence)" },
  { name: "gate-a-package", group: "history", db: "reads", does: "Gate A history: regenerate the intent review table and the decision template — approves nothing" },
  { name: "apply-gate-a", group: "history", db: "reads", does: "Gate A history: apply the author's recorded Gate A decisions — refuses unless every change is authorised" },
  { name: "freeze-fixture-corrections", group: "history", db: "reads", does: "list fixture-metadata corrections in the frozen manifest (D3.38) — refuses any other difference" },
];

/** The names `src/cli.ts` must dispatch (a flag variant such as `run --confirm` is the same case). */
export const DISPATCHED = [...new Set(COMMANDS.map((c) => c.name.split(" ")[0]!))];

export function usageText(): string {
  return `usage: npm run attest <command>\n${COMMANDS.map((c) => `  ${(c.usage ?? c.name).padEnd(52)} ${c.does.split(/[:;—]/)[0]!.trim()}`).join("\n")}`;
}
