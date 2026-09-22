/**
 * Attest — semantic validation of the WP3 plan.
 *
 * A keyword scan already reported zero placeholders while the matrix still
 * contained "e.g. is_active = false" and rows bundling three statements. So
 * this checks meaning instead: that each probe names a real command and a real
 * predicate, that each negative fixture actually falsifies the effective
 * authorization condition, that no other permissive policy admits it, that
 * every Test ID maps to one executable probe, and that only genuine attack
 * rows carry a blank AUTHOR INTENT.
 */
import type { RiskInput } from "./risk-inputs.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";

export interface PlanIssue {
  readonly check: string;
  readonly testId: string;
  readonly problem: string;
}

/** Text that is not a concrete operation. */
const VAGUE = [
  /\be\.g\.\s/i, /\betc\b/i, /\bTBD\b/i, /\bTODO\b/i, /placeholder/i, /_____/,
  /to be (confirmed|derived|decided|judged)/i, /\bderive later\b/i,
  /\bsome\b.*\brow\b/i, /\bappropriate\b/i, /\bas needed\b/i,
];
/** Slash-separated alternatives that mean two statements in one row. */
const BUNDLED = [
  /\bUPDATE\b[^.]*\bDELETE\b/i, /\bUPDATE\b\s*[/,]\s*\bDELETE\b/i,
  /\bINSERT\b\s*\/\s*\bUPDATE\b/i, /\btwo cases\b/i, /\(a\).*\(b\)/,
  /\band\b\s+\bTRUNCATE\b/i,
];

export function validatePlan(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const byResource = new Map(resources.map((r) => [r.resource, r]));
  const add = (check: string, t: PlannedTest, problem: string) =>
    issues.push({ check, testId: t.testId, problem });

  // 1. Every Test ID is unique and maps to one probe.
  const seen = new Map<string, number>();
  for (const t of plan.tests) seen.set(t.testId, (seen.get(t.testId) ?? 0) + 1);
  for (const [tid, n] of seen) {
    if (n > 1) issues.push({ check: "one Test ID = one probe", testId: tid, problem: `${n} rows share this Test ID` });
  }

  for (const t of plan.tests) {
    const text = `${t.operation} ${t.expected} ${t.fixture}`;

    // 2. Concrete operations only.
    for (const re of VAGUE) {
      if (re.test(text)) add("concrete operation", t, `vague text matching ${re}: "${text.slice(0, 120)}"`);
    }
    // 3. No row bundles two materially different statements.
    for (const re of BUNDLED) {
      if (re.test(t.operation)) add("one probe per row", t, `operation bundles more than one statement: "${t.operation.slice(0, 120)}"`);
    }
    // 4. AUTHOR INTENT is blank only on genuine attack rows.
    if (t.authorIntent === null && t.polarity !== "negative") {
      add("intent only for negatives", t, `polarity is ${t.polarity} but AUTHOR INTENT is blank`);
    }
    if (t.polarity === "negative" && t.authorIntent !== null) {
      add("negatives await intent", t, "a negative row already carries an intent string");
    }
    // 5. Characterization and gap rows must not be framed as attacks.
    if (t.polarity === "characterization" && t.verdictWhenPredicted === "effective") {
      add("characterization verdict", t, "a characterization row claims verdict 'effective'");
    }

    // 6. A policy test names the real command and a real predicate.
    const m = /^(.+)#policy:(.+)$/.exec(t.control);
    if (m) {
      const res = byResource.get(m[1] as string);
      const pol = res?.policies.find((p) => p.name === m[2]);
      if (!res) add("policy exists", t, `control names resource ${m[1]} which is not in the inventory`);
      else if (!pol) add("policy exists", t, `control names policy ${m[2]} which does not exist on ${m[1]}`);
      else {
        // The operation's verb must match the policy's command (SELECT policies
        // are read with select; INSERT policies written with insert; and so on).
        const verb = /\b(select|insert|update|delete|truncate|subscribe|publish)\b/i.exec(t.operation)?.[1]?.toUpperCase();
        const cmd = pol.command;
        const ok =
          cmd === "ALL" ||
          (cmd === "SELECT" && (verb === "SELECT" || verb === "SUBSCRIBE")) ||
          (cmd === "INSERT" && (verb === "INSERT" || verb === "PUBLISH")) ||
          (cmd === "UPDATE" && verb === "UPDATE") ||
          (cmd === "DELETE" && verb === "DELETE");
        if (!ok) add("command matches policy", t, `policy ${pol.name} is ${cmd} but the operation's verb is ${verb ?? "none"}`);

        // A negative on a policy with recognised drivers must say what it falsifies.
        if (t.polarity === "negative" && pol.authDrivers.length > 0) {
          const namesDriver = pol.authDrivers.some((d) =>
            t.covers.toLowerCase().includes(d.detail.toLowerCase().split("(")[0]!.trim()) ||
            t.covers.toLowerCase().includes(d.kind.replace(/_/g, " ")));
          if (!namesDriver) {
            add("negative falsifies the predicate", t,
              `negative does not name which driver it falsifies (policy drivers: ${pol.authDrivers.map((d) => d.detail).join(", ")})`);
          }
        }
        // Where more than one permissive policy governs the command, the row
        // must acknowledge effective authorization rather than attributing the
        // outcome to one policy.
        const siblings = (res?.policies ?? []).filter(
          (q) => q.name !== pol.name && (q.command === pol.command || q.command === "ALL"),
        );
        if (t.polarity === "negative" && siblings.length > 0) {
          const acknowledges = /permissive|effective authorization|other policy|OTHER permissive/i.test(t.covers);
          if (!acknowledges) {
            add("permissive overlap acknowledged", t,
              `${siblings.length} sibling permissive ${pol.command} policy/policies exist (${siblings.map((q) => q.name).join(", ")}) and the row does not acknowledge effective authorization`);
          }
        }
      }
    }
  }
  return issues;
}
