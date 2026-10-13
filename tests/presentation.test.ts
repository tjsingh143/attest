import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ATTEST_ROOT } from "../src/config.ts";
import { neutralPresentation, presentationFiles, presentationIssues } from "../src/presentation.ts";
import { buildReportOutputs } from "../src/wp7-run.ts";
import { loadReportInputs, validateReportsLoaded, PROVE_GATES_CURRENCY_CHECK } from "../src/wp7-validate.ts";

test("credit claims are rejected for either people or assistants", () => {
  for (const text of ["Taij Singh", "Created by ChatGPT", "Built by me", "We developed this", "AI-drafted report", "The author wrote the system"]) {
    assert.ok(presentationIssues(text, "view").length, text);
  }
  assert.deepEqual(presentationIssues("Counts from the recorded tests; no independent review was performed.", "view"), []);
});

test("prose edits preserve SQL/code bytes and authorizing-official quotations", () => {
  const code = "```sql\nselect 'AI-drafted' as original_label;\n```";
  const quote = "> c. Ensure the control assessment plan is reviewed and approved by the authorizing official or designated representative prior to conducting the assessment;";
  const result = neutralPresentation(`Remediation options (AI-drafted, not implemented).\n${code}\n${quote}\n`);
  assert.ok(result.includes(code));
  assert.ok(result.includes(quote));
  assert.match(result, /Remediation options \(not implemented\)/);
});

test("only named current root views are projected; evidence and JSON stay exact", () => {
  const raw = "**What happened** *(AI-drafted)*\n";
  const files = new Map([
    [join(ATTEST_ROOT, "FINDINGS.md"), raw],
    [join(ATTEST_ROOT, "evidence", "runs", "original", "FINDINGS.md"), raw],
    [join(ATTEST_ROOT, "framework-mapping.json"), '{"provenance":"ai_drafted"}\n'],
  ]);
  const projected = presentationFiles(files);
  assert.notEqual(projected.get(join(ATTEST_ROOT, "FINDINGS.md")), raw);
  for (const [path, text] of files) if (path !== join(ATTEST_ROOT, "FINDINGS.md")) assert.equal(projected.get(path), text);
  assert.equal(files.get(join(ATTEST_ROOT, "FINDINGS.md")), raw);
});

test("generated views are neutral and stable; all frozen outputs remain identical", async () => {
  const built = await buildReportOutputs("compare");
  assert.deepEqual(built.problems, []);
  for (const [path, content] of built.files) {
    assert.equal(await readFile(path, "utf8"), content, relative(ATTEST_ROOT, path));
    if (path.includes("/evidence/") || path.endsWith(".json")) continue;
    assert.deepEqual(presentationIssues(content, path), []);
    assert.equal(neutralPresentation(content), content, path);
  }
});

test("every framework statement and checkpoint narrative remains literal", async () => {
  const mapping = JSON.parse(await readFile(join(ATTEST_ROOT, "framework-mapping.json"), "utf8"));
  const view = await readFile(join(ATTEST_ROOT, "FRAMEWORK_MAPPING.md"), "utf8");
  for (const entry of mapping.mappings) for (const statement of entry.statement) assert.ok(view.includes(`> ${statement}`), entry.id);
  const response = JSON.parse(await readFile(join(ATTEST_ROOT, "rubric", "cp4-author-response.json"), "utf8"));
  const findings = await readFile(join(ATTEST_ROOT, "FINDINGS.md"), "utf8");
  for (const item of response.items ?? []) if (item.narrative) assert.ok(findings.includes(item.narrative), item.key);
});

async function inputs() {
  const built = await buildReportOutputs("compare");
  return loadReportInputs(new Map([...built.files].map(([path, content]) => [relative(ATTEST_ROOT, path), content])));
}

test("report facts and views pass; full-gate currency still follows the source hash", async () => {
  const data = await inputs();
  const validation = validateReportsLoaded(data);
  for (const check of validation.checks) if (check.name !== PROVE_GATES_CURRENCY_CHECK) assert.equal(check.passed, true, check.name + ": " + check.detail);
  const currency = validation.checks.find((c) => c.name === PROVE_GATES_CURRENCY_CHECK)!;
  assert.equal(currency.passed, data.proveGates?.harness?.sourcesSha256 === data.harnessNow);
});

test("tampered result counts and injected bylines still fail the current validator", async () => {
  const data = await inputs();
  const count = structuredClone(data);
  count.docs.summary = count.docs.summary.replace("283 of the 345", "284 of the 345");
  assert.ok(validateReportsLoaded(count).checks.some((c) => !c.passed && /summary/i.test(c.name)));
  const byline = structuredClone(data);
  byline.docs.report += "\nCreated by ChatGPT.\n";
  assert.ok(validateReportsLoaded(byline).checks.some((c) => !c.passed && /neutral/i.test(c.name)));
});
