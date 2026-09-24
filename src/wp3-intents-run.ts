/**
 * Attest — build the AUTHOR INTENT review package.
 *
 * Drafts every required sentence, folds the drafts into the canonical store
 * without touching anything the author has already written, validates the
 * drafts against their own matrix rows, and regenerates the review artefacts.
 *
 * It does not, and cannot, adopt a draft. Adoption is an edit to
 * `rubric/author-intents.json` by a human.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RUNS_ROOT } from "./config.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import { draftFor, EXPIRED_SESSION_DRAFT } from "../rubric/intent-drafts.ts";
import { requiresIntent, loadIntentStore, mergeDrafts, writeIntentStore, isAdopted } from "./author-intents.ts";
import { validateDraftQuality } from "./intent-quality.ts";
import { buildWorksheet, writeWorksheet } from "./intent-worksheet.ts";

export interface IntentRunResult {
  readonly required: number;
  readonly drafted: number;
  readonly aiDraft: number;
  readonly adopted: number;
  readonly qualityIssues: ReturnType<typeof validateDraftQuality>;
  readonly worksheetValid: boolean;
  readonly orphaned: readonly string[];
  readonly humanPreserved: readonly string[];
}

export async function buildIntentPackage(
  plan: Wp3Plan,
  runId: string,
  schemaVersion: string,
  log: (s: string) => void = () => {},
): Promise<IntentRunResult> {
  const needed = plan.tests.filter(requiresIntent);

  const drafts = new Map<string, string>();
  for (const t of needed) {
    drafts.set(t.testId, t.testId === "B.suite.expired-session" ? EXPIRED_SESSION_DRAFT : draftFor(t));
  }

  const qualityIssues = validateDraftQuality(plan, drafts);

  const existing = await loadIntentStore();
  const merged = mergeDrafts(
    existing,
    needed.map((t) => ({ testId: t.testId, draft: drafts.get(t.testId)! })),
    { matrixRunId: runId, schemaVersion },
  );
  await writeIntentStore(merged.store);

  const aiDraft = merged.store.intents.filter((e) => e.provenance === "ai_draft").length;
  const adopted = merged.store.intents.filter(isAdopted).length;

  log(`  ${needed.length} sentences required, ${drafts.size} drafted`);
  log(`  canonical store: ${merged.store.intents.length} entries — ${aiDraft} ai_draft, ${adopted} adopted by the author`);
  if (merged.humanPreserved.length) {
    const reviewed = merged.store.intents.filter((e) => e.provenance === "user_reviewed_ai_draft").length;
    const written = merged.store.intents.filter((e) => e.provenance === "user_authored").length;
    log(`  ${merged.humanPreserved.length} sentence(s) the author adopted preserved through regeneration (${reviewed} user_reviewed_ai_draft, ${written} user_authored)`);
  }
  if (merged.orphaned.length) log(`  !! ${merged.orphaned.length} store entr(ies) no longer required by the matrix: ${merged.orphaned.slice(0, 5).join(", ")}`);
  if (qualityIssues.length) {
    const byCheck = new Map<string, number>();
    for (const i of qualityIssues) byCheck.set(i.check, (byCheck.get(i.check) ?? 0) + 1);
    log(`  !! ${qualityIssues.length} draft-quality issue(s):`);
    for (const [c, n] of byCheck) log(`       ${c}: ${n}`);
  } else {
    log(`  draft quality: clean against ${needed.length} matrix rows`);
  }

  const worksheet = buildWorksheet(plan, merged.store);
  const runDir = join(RUNS_ROOT, runId);
  await mkdir(runDir, { recursive: true });
  await writeWorksheet(worksheet, runDir, { runId, schemaVersion });
  log(`  worksheet: ${worksheet.rows.length} rows in ${worksheet.batches.length} batches — ${worksheet.valid ? "validation passes" : "VALIDATION FAILED"}`);
  for (const v of worksheet.validation.filter((x) => !x.passed)) log(`       !! ${v.check}: ${v.detail}`);

  return {
    required: needed.length,
    drafted: drafts.size,
    aiDraft,
    adopted,
    qualityIssues,
    worksheetValid: worksheet.valid,
    orphaned: merged.orphaned,
    humanPreserved: merged.humanPreserved,
  };
}
