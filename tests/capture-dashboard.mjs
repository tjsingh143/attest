import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "presentation-captures");
await mkdir(out, { recursive: true });
const source = await readFile(join(root, "dashboard", "index.html"));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto(pathToFileURL(join(root, "dashboard", "index.html")).href);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  assert.ok(await page.getByText("Recorded status", { exact: true }).isVisible());
  assert.doesNotMatch(await page.locator("body").innerText(), /AI[- ](?:drafted|assisted|generated)|the author's|the author tested|built by (?:me|ChatGPT)/i);
  const captures = [
    ["01-dashboard-posture-overview.png", null],
    ["02-dashboard-effectiveness-by-family-and-tier.png", "#effectiveness"],
    ["03-dashboard-ranked-findings.png", "#findings"],
    ["04-dashboard-drift-across-schema-history.png", "#drift"],
    ["05-dashboard-framework-mapping.png", "#framework"],
  ];
  for (const [name, selector] of captures) {
    if (selector) await page.locator(selector).screenshot({ path: join(out, name) });
    else { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: join(out, name) }); }
  }
  await page.locator("#f-tier").selectOption("functions");
  await page.locator("#q").fill("register_push_token");
  await page.locator("#list button").filter({ hasText: "register_push_token" }).first().click();
  assert.ok(await page.locator("#detail").getByText("F5.register_push_token.269", { exact: true }).isVisible());
  await page.locator("#drill").screenshot({ path: join(out, "06-dashboard-evidence-drilldown.png") });
  assert.deepEqual(errors, []);
  const names = [...captures.map(([name]) => name), "06-dashboard-evidence-drilldown.png"];
  const files = [];
  for (const name of names) {
    const bytes = await readFile(join(out, name));
    files.push({ name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(join(out, "capture-manifest.json"), JSON.stringify({
    sourceCommit: process.env.GITHUB_SHA ?? null,
    dashboardSha256: createHash("sha256").update(source).digest("hex"),
    evidenceScope: "Frozen 2026-09-25 assessment; current presentation only, no new database assessment",
    files,
  }, null, 2) + "\n");
  console.log(`Captured ${files.length} current dashboard views; display labels and evidence drill-down verified.`);
} finally { await browser.close(); }
