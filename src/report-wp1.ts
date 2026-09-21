/**
 * Attest — rendering the WP1 validation for a human.
 *
 * The standard this has to meet is in the brief: the author can answer "how do
 * you know your tests were actually exercising the policy?" with a
 * demonstration rather than an assertion. So the document leads with the
 * transcript and the before/after outcomes, not with a summary of them.
 */
import type { ValidationResult } from "./validate.ts";

const yn = (v: boolean) => (v ? "yes" : "no");
const cell = (v: unknown) => String(v ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

export function renderValidationMarkdown(r: ValidationResult): string {
  const L: string[] = [];
  const p = (s = "") => L.push(s);

  p(`# Harness validation (WP1) — Arc21`);
  p();
  p(`Every line below is the recorded outcome of a statement that was executed. The controls`);
  p(`were deliberately broken in a disposable instance and put back.`);
  p();
  p(`| | |`);
  p(`|---|---|`);
  p(`| Run | \`${r.runId}\` |`);
  p(`| Started | ${r.startedAt} |`);
  p(`| Instance | ${r.instance} |`);
  p(`| Schema version | \`${r.schemaVersion}\` |`);
  p(`| Harness version | \`${r.harness.version}\` sources \`${r.harness.sourcesSha256.slice(0, 12)}\` |`);
  p(`| Evidence records | ${r.records.length} |`);
  p();
  p(`| Claim | Result |`);
  p(`|---|---|`);
  p(`| Every weakened control was detected | **${r.allDetected ? "yes" : "NO"}** |`);
  p(`| Every weakening was reverted | **${r.allRestored ? "yes" : "NO"}** |`);
  p(`| Control inventory identical before and after | **${r.inventoryUnchanged ? "yes" : "NO"}** |`);
  p();

  // --- identities --------------------------------------------------------
  p(`## 1. Who the tests run as`);
  p();
  p(`Read back out of the database after the role switch, not asserted by the harness.`);
  p();
  p(`| Identity | current_user | session_user | Superuser | **Bypasses RLS** | Owns an application table | auth.uid() |`);
  p(`|---|---|---|---|---|---|---|`);
  for (const i of r.identities.identities) {
    p(
      `| \`${cell(i.label)}\` | \`${cell(i.currentUser)}\` | \`${cell(i.sessionUser)}\` | ${yn(i.isSuperuser)} | **${yn(i.bypassesRls)}** | ${yn(i.ownsAnyApplicationTable)} | ${i.authUid ? `\`${cell(i.authUid)}\`` : "—"} |`,
    );
  }
  p();
  p(`The control tests use \`authenticated:*\`. It is not a superuser, does not bypass row-level`);
  p(`security, owns nothing, and carries a specific user's identity — so a policy that reads`);
  p(`\`auth.uid()\` has something real to read.`);
  p();

  p(`### Can the testing login escalate out of that?`);
  p();
  p(`Executed on the same login every control test uses.`);
  p();
  p(`| Statement | Permitted | Outcome |`);
  p(`|---|---|---|`);
  for (const e of r.identities.escalation) {
    p(`| \`${cell(e.statement)}\` | **${yn(e.permitted)}** | ${cell(e.outcome)} |`);
  }
  p();
  for (const e of r.identities.escalation) {
    p(`- \`${cell(e.statement)}\` — ${cell(e.consequence)}`);
  }
  p();
  p(`The second result is the honest one and it is not comfortable: the login the control tests`);
  p(`use **can** switch into \`service_role\`, which holds BYPASSRLS. Nothing in the database`);
  p(`prevents it. What prevents it here is the harness itself:`);
  p();
  p(`> \`${cell(r.identities.guardRefusal.attempted)}\``);
  p(`> → refused: **${yn(r.identities.guardRefusal.refused)}**`);
  p(`> \`${cell(r.identities.guardRefusal.message)}\``);
  p();
  p(`That is a guard in code, not a property of the database, and it should be read that way.`);
  p(`It is load-bearing precisely because the database would allow the mistake.`);
  p();

  // --- force rls ---------------------------------------------------------
  p(`## 2. What "enabled but not forced" actually does`);
  p();
  p(`Arc21 has row-level security enabled on ${r.forceRls.arc21.tablesEnabled} tables and forced on`);
  p(`${r.forceRls.arc21.tablesForced}. That is a fact. Whether it is a problem is a different question, and`);
  p(`this section separates the two by demonstrating the mechanism before drawing any conclusion.`);
  p();
  p(`On this instance \`${cell(r.forceRls.arc21.owner)}\` both owns the tables **and** holds BYPASSRLS, so`);
  p(`watching it ignore a policy would not show which rule did it. The demonstration below uses a`);
  p(`scratch table owned by a purpose-made role holding **no** BYPASSRLS, so ownership is the only`);
  p(`exemption in play. The table and the role are created and dropped inside the run; nothing in`);
  p(`Arc21 is touched.`);
  p();
  p(`The table holds 2 rows. The policy admits 1 of them.`);
  p();
  p(`| Run as | Table state | Rows returned | What it means |`);
  p(`|---|---|---|---|`);
  for (const s of r.forceRls.steps) {
    p(`| ${cell(s.as)} | ${cell(s.state)} | **${cell(s.outcome)}** | ${cell(s.meaning)} |`);
  }
  p();
  p(`### So does it matter for Arc21?`);
  p();
  p(`The setting is only worth something if somebody who benefits from its absence can be reached.`);
  p(`That is a reachability question and it has an executed answer:`);
  p();
  p(`| Question | Answer |`);
  p(`|---|---|`);
  p(`| Does the table owner (\`${cell(r.forceRls.arc21.owner)}\`) bypass RLS anyway? | **${yn(r.forceRls.arc21.ownerBypassesRls)}** |`);
  p(`| Can the client login reach the table owner? | **${yn(r.forceRls.arc21.ownerReachableFromClientLogin)}** |`);
  p(`| Can the client login reach a role that bypasses RLS? | **${yn(r.forceRls.arc21.bypassRoleReachableFromClientLogin)}** |`);
  p();
  p(`Read together: turning FORCE on would close the owner door, and would **not** close the other`);
  p(`one, because the owner holds BYPASSRLS as well. No client can reach the owner. A holder of the`);
  p(`\`authenticator\` credential can reach \`service_role\`, which bypasses row security — so on this`);
  p(`instance the exposure this creates is a function of credential handling, not of the FORCE`);
  p(`setting.`);
  p();
  p(`**This section deliberately stops here.** Whether that is acceptable is a risk judgment, it`);
  p(`belongs to the rubric in WP2, and it is the author's to make.`);
  p();

  // --- scenarios ---------------------------------------------------------
  p(`## 3. Deliberate-break scenarios`);
  p();
  p(`${r.scenarios.length} scenarios across ${new Set(r.scenarios.map((s) => s.family)).size} control families. For each: probe the intact`);
  p(`control, weaken it, probe again with the identical statement, restore, probe again.`);
  p();
  p(`| # | Control family | Detected the break | Restored cleanly |`);
  p(`|---|---|---|---|`);
  for (const s of r.scenarios) {
    p(`| ${s.id} | ${cell(s.family)} | **${yn(s.detected)}** | ${yn(s.restored)} |`);
  }
  p();

  for (const s of r.scenarios) {
    p(`### ${s.id} — ${s.family}`);
    p();
    p(`**The control.** ${cell(s.control)}`);
    p();
    p(`**Control identifier.** \`${cell(s.controlId)}\``);
    p();
    p(`**The probe.** Run as \`${cell(s.probeIdentity)}\`:`);
    p();
    p("```sql");
    p(s.statement);
    p("```");
    p();
    p(`| Point in the run | Expected | Actual | As expected |`);
    p(`|---|---|---|---|`);
    for (const t of s.timeline) {
      p(`| ${cell(t.at)} | ${cell(t.expected)} | **${cell(t.outcome)}** | ${yn(t.matched)} |`);
    }
    p();
    p(`Detected the break: **${yn(s.detected)}** — the recorded outcome ${s.detected ? "changed" : "did NOT change"} when the control was weakened.`);
    p();
    p(`**The same statement, on an over-privileged connection:**`);
    p();
    p(`| Identity | Bypasses RLS | Control intact | Control broken | Can tell them apart | Why |`);
    p(`|---|---|---|---|---|---|`);
    for (const o of s.overPrivileged) {
      const why = o.discriminates
        ? "—"
        : o.broken.startsWith("error")
          ? cell(o.brokenMessage ?? "refused in both states")
          : "succeeded in both states";
      p(`| \`${cell(o.identityLabel)}\` | ${yn(o.bypassesRls)} | ${cell(o.intact)} | ${cell(o.broken)} | **${yn(o.discriminates)}** | ${why} |`);
    }
    p();
    const blind = s.overPrivileged.filter((o) => !o.discriminates);
    if (blind.length === s.overPrivileged.length) {
      p(`Neither over-privileged connection could tell the two states apart — each returned the`);
      p(`**same answer** whether the control was intact or broken. No assertion built on either could`);
      p(`have detected this break.`);
      const alwaysOk = blind.filter((o) => !o.broken.startsWith("error"));
      const alwaysNo = blind.filter((o) => o.broken.startsWith("error"));
      if (alwaysOk.length && alwaysNo.length) {
        p();
        p(`They are blind for **opposite reasons**, which is worth separating.`);
        p(`${alwaysOk.map((o) => `\`${o.identityLabel}\``).join(", ")} succeeded in both states: it is exempt`);
        p(`from the policy, so the control was never consulted. ${alwaysNo.map((o) => `\`${o.identityLabel}\``).join(", ")}`);
        p(`was refused in both states for a different reason — it holds no privilege on this object at`);
        p(`all, so it never reached the policy either. One is over-privileged past the control; the`);
        p(`other is under-privileged short of it. Neither is standing where a client stands, which is`);
        p(`the only place the control can be observed.`);
      }
    } else if (blind.length) {
      p(`${blind.map((b) => `\`${b.identityLabel}\``).join(" and ")} returned the **same answer** whether the`);
      p(`control was intact or broken. ${s.overPrivileged.filter((o) => o.discriminates).map((o) => `\`${o.identityLabel}\``).join(" and ")}`);
      p(`did distinguish them, so this scenario demonstrates the scoping point only partially.`);
    } else {
      p(`Both over-privileged connections distinguished intact from broken here, so this scenario does`);
      p(`**not** demonstrate the scoping point — it demonstrates only detection. Reported rather than`);
      p(`dropped, because a validation section that silently kept the flattering cases would be worth`);
      p(`nothing.`);
    }
    p();
  }

  // --- closing -----------------------------------------------------------
  p(`## 4. The instance was left as found`);
  p();
  p(`The full control inventory was read before the first weakening and again after the last`);
  p(`restoration, and compared in its entirety rather than only across the controls that were`);
  p(`touched — so a restore that put something back in a subtly different shape would show up.`);
  p();
  p(`Identical: **${yn(r.inventoryUnchanged)}**`);
  p();
  if (!r.inventoryUnchanged) p(`> ${cell(r.inventoryDiff)}`);
  p();
  p(`## 5. What this does not establish`);
  p();
  p(`- It shows the probes detect **these** breaks. It does not show they would detect every`);
  p(`  possible weakening of the same control, and it says nothing about controls no scenario`);
  p(`  touches.`);
  p(`- Each scenario weakens a control to a deliberately obvious degree — an expression replaced`);
  p(`  by \`true\`, a trigger disabled. A subtler regression, such as a policy that is wrong only`);
  p(`  for a particular row shape, is a harder thing to catch and is not tested here.`);
  p(`- The evidence records carry no \`intent\` statement. Naming the attack each negative test`);
  p(`  simulates is reserved for the author in WP3; WP1's probes exist to validate the harness,`);
  p(`  not to assess Arc21, and they carry a mechanical description instead.`);
  p(`- Nothing here rates risk. No finding, tier or severity is assigned or implied.`);
  p();

  return L.join("\n");
}
