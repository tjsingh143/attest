/**
 * Attest — the canonical AUTHOR INTENT store.
 *
 * Brief §1.1 reserves one sentence per negative test to the author: what attack
 * or misuse does this probe simulate. The worksheet under
 * `evidence/runs/<run-id>/` is *generated output* and is replaced every run, so
 * a sentence written into it would be destroyed by the next `attest run`. This
 * file's store lives outside `evidence/` for exactly that reason: it is an
 * input to the harness, beside `RUBRIC.md` and `rubric/ratings.ts`, not an
 * output of it.
 *
 * ## Provenance is not decoration
 *
 * The store distinguishes three states and the distinction is load-bearing:
 *
 *   ai_draft              the harness wrote it. Not the author's sentence.
 *   user_reviewed_ai_draft the author read the draft and accepted it as written.
 *   user_authored         the author wrote or rewrote the sentence themselves.
 *
 * Only the second and third are adopted. An `ai_draft` can never satisfy the
 * execution gate no matter what `reviewStatus` says, because the harness
 * agreeing with itself is precisely what §1.1 exists to prevent — and an
 * evidence record whose "attack simulated" field was written by the thing doing
 * the simulating is not evidence of anything.
 *
 * ## Regeneration never overwrites a human
 *
 * `mergeDrafts` only fills entries that are still `ai_draft`. A sentence the
 * author has touched is preserved verbatim through any number of regenerations,
 * and a Test ID that disappears from the matrix is reported rather than deleted.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";

export const INTENTS_PATH = join(ATTEST_ROOT, "rubric", "author-intents.json");

export type IntentProvenance = "ai_draft" | "user_reviewed_ai_draft" | "user_authored";
export type IntentReviewStatus = "unreviewed" | "approved";

export interface AuthorIntent {
  readonly testId: string;
  readonly intent: string;
  readonly provenance: IntentProvenance;
  readonly reviewStatus: IntentReviewStatus;
  /** Free text: why the author changed it, or anything they want recorded. */
  readonly note?: string;
}

export interface IntentStore {
  /** Human-readable banner; first thing anyone opening the file sees. */
  readonly WARNING: string;
  /** The planning run whose matrix these Test IDs came from. */
  readonly matrixRunId: string;
  readonly schemaVersion: string;
  readonly provenanceMeanings: Readonly<Record<IntentProvenance, string>>;
  readonly howToAdopt: readonly string[];
  readonly intents: readonly AuthorIntent[];
}

const WARNING =
  "EVERY SENTENCE MARKED ai_draft WAS WRITTEN BY THE HARNESS, NOT BY THE AUTHOR. " +
  "Brief §1.1 reserves these sentences for the author. Drafts exist to be reviewed, corrected or " +
  "replaced — not to be adopted by default. attest execute-wp3 refuses to run while any required " +
  "intent is still an ai_draft.";

const PROVENANCE_MEANINGS: Readonly<Record<IntentProvenance, string>> = {
  ai_draft:
    "The harness generated this sentence. NOT the author's. Does not satisfy the execution gate.",
  user_reviewed_ai_draft:
    "The author read the generated draft and accepted it as written. Their decision, adopted.",
  user_authored:
    "The author wrote or rewrote this sentence themselves. Their words.",
};

const HOW_TO_ADOPT: readonly string[] = [
  "Read the draft beside its probe. The review worksheet for this run renders both:",
  "  evidence/runs/<run-id>/author-intent-worksheet.md  (all 240, grouped by family)",
  "  evidence/runs/<run-id>/batches/intent-batch-NN.md  (13 files of ~25, for one sitting at a time)",
  "  evidence/runs/<run-id>/author-intent-review.tsv    (Test ID and sentence only, for a fast pass)",
  "",
  "If the draft says what you would have said, set:",
  '  "provenance": "user_reviewed_ai_draft", "reviewStatus": "approved"',
  "",
  "If it does not, replace `intent` with your own sentence and set:",
  '  "provenance": "user_authored", "reviewStatus": "approved"',
  "",
  "Then: npm run attest preflight-wp3 -- --for-execution",
  "It will name every entry still outstanding, and refuse until none is.",
];

/** Which planned rows require a sentence. The single definition of that. */
export function requiresIntent(t: PlannedTest): boolean {
  return t.polarity === "negative" && t.authorIntent === null;
}

/** Adopted means the author owns it. `ai_draft` is never adopted. */
export function isAdopted(e: AuthorIntent): boolean {
  return (
    e.provenance !== "ai_draft" &&
    e.reviewStatus === "approved" &&
    typeof e.intent === "string" &&
    e.intent.trim().length > 0
  );
}

export async function loadIntentStore(): Promise<IntentStore | null> {
  try {
    return JSON.parse(await readFile(INTENTS_PATH, "utf8")) as IntentStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`rubric/author-intents.json is present but unreadable: ${(err as Error).message}`);
  }
}

export async function writeIntentStore(store: IntentStore): Promise<void> {
  await writeFile(INTENTS_PATH, JSON.stringify(store, null, 2) + "\n");
}

export interface MergeOutcome {
  readonly store: IntentStore;
  readonly added: readonly string[];
  readonly draftsRefreshed: readonly string[];
  readonly humanPreserved: readonly string[];
  /** In the store but no longer required by the matrix. Reported, never deleted. */
  readonly orphaned: readonly string[];
}

/**
 * Fold a fresh set of drafts into the store.
 *
 * The rule that matters: an entry whose provenance is not `ai_draft` is copied
 * through untouched, including its `note`. Regenerating drafts must never cost
 * the author a sentence they have already written.
 */
export function mergeDrafts(
  existing: IntentStore | null,
  required: readonly { testId: string; draft: string }[],
  meta: { matrixRunId: string; schemaVersion: string },
): MergeOutcome {
  const prior = new Map((existing?.intents ?? []).map((e) => [e.testId, e]));
  const requiredIds = new Set(required.map((r) => r.testId));

  const added: string[] = [];
  const draftsRefreshed: string[] = [];
  const humanPreserved: string[] = [];

  const intents: AuthorIntent[] = required.map(({ testId, draft }) => {
    const was = prior.get(testId);
    if (!was) {
      added.push(testId);
      return { testId, intent: draft, provenance: "ai_draft", reviewStatus: "unreviewed" };
    }
    if (was.provenance !== "ai_draft") {
      humanPreserved.push(testId);
      return was;
    }
    if (was.intent !== draft) draftsRefreshed.push(testId);
    return { ...was, intent: draft, provenance: "ai_draft", reviewStatus: "unreviewed" };
  });

  const orphaned = [...prior.keys()].filter((id) => !requiredIds.has(id));

  return {
    store: {
      WARNING,
      matrixRunId: meta.matrixRunId,
      schemaVersion: meta.schemaVersion,
      provenanceMeanings: PROVENANCE_MEANINGS,
      howToAdopt: HOW_TO_ADOPT,
      intents: intents.sort((a, b) => a.testId.localeCompare(b.testId)),
    },
    added,
    draftsRefreshed,
    humanPreserved,
    orphaned,
  };
}

export interface IntentValidation {
  readonly check: string;
  readonly passed: boolean;
  readonly detail: string;
  /** False for checks that only gate a real execution, not planning. */
  readonly blocksPlanningToo: boolean;
}

/**
 * Compare the store against the matrix.
 *
 * `forExecution` turns on the gate that matters: every required sentence must
 * be the author's. Planning runs pass with drafts in place, because the whole
 * point of the drafts is to be reviewed before a run happens.
 */
export function validateIntents(
  plan: Wp3Plan,
  store: IntentStore | null,
  forExecution: boolean,
): IntentValidation[] {
  const out: IntentValidation[] = [];
  const add = (check: string, passed: boolean, detail: string, blocksPlanningToo = true) =>
    out.push({ check, passed, detail, blocksPlanningToo });

  if (!store) {
    add("canonical intent store exists", false, `${INTENTS_PATH} is missing — run: attest draft-intents`);
    return out;
  }

  const required = plan.tests.filter(requiresIntent).map((t) => t.testId);
  const requiredSet = new Set(required);
  const storeIds = store.intents.map((e) => e.testId);
  const storeSet = new Set(storeIds);

  const missing = required.filter((id) => !storeSet.has(id));
  const extra = storeIds.filter((id) => !requiredSet.has(id));
  const dupes = storeIds.filter((id, i) => storeIds.indexOf(id) !== i);

  add(
    "every matrix negative has a canonical entry",
    missing.length === 0,
    missing.length ? `${missing.length} missing: ${missing.slice(0, 5).join(", ")}` : `all ${required.length} present`,
  );
  add(
    "no entry that the matrix does not require",
    extra.length === 0,
    extra.length ? `${extra.length} extra: ${extra.slice(0, 5).join(", ")}` : "none extra",
  );
  add(
    "no duplicate Test ID in the store",
    dupes.length === 0,
    dupes.length ? `${dupes.length} duplicated: ${[...new Set(dupes)].slice(0, 5).join(", ")}` : `${storeSet.size} unique`,
  );

  const blank = store.intents.filter((e) => typeof e.intent !== "string" || e.intent.trim().length === 0);
  add(
    "no entry carries a blank sentence",
    blank.length === 0,
    blank.length ? `${blank.length} blank: ${blank.slice(0, 5).map((e) => e.testId).join(", ")}` : "none blank",
  );

  const badProv = store.intents.filter(
    (e) => !["ai_draft", "user_reviewed_ai_draft", "user_authored"].includes(e.provenance),
  );
  add(
    "every provenance value is one of the three known",
    badProv.length === 0,
    badProv.length ? `unknown: ${badProv.slice(0, 5).map((e) => `${e.testId}=${e.provenance}`).join(", ")}` : "all recognised",
  );

  const badStatus = store.intents.filter((e) => !["unreviewed", "approved"].includes(e.reviewStatus));
  add(
    "every reviewStatus value is one of the two known",
    badStatus.length === 0,
    badStatus.length ? `unknown: ${badStatus.slice(0, 5).map((e) => `${e.testId}=${e.reviewStatus}`).join(", ")}` : "all recognised",
  );

  // An ai_draft marked approved is the exact mislabel this store exists to
  // prevent, so it is an error rather than a promotion.
  const draftApproved = store.intents.filter((e) => e.provenance === "ai_draft" && e.reviewStatus === "approved");
  add(
    "no ai_draft is marked approved",
    draftApproved.length === 0,
    draftApproved.length
      ? `${draftApproved.length} marked approved while still ai_draft — set provenance to user_reviewed_ai_draft or user_authored: ${draftApproved.slice(0, 5).map((e) => e.testId).join(", ")}`
      : "none mislabelled",
  );

  const notAdopted = store.intents.filter((e) => requiredSet.has(e.testId) && !isAdopted(e));
  add(
    "every required intent is authored or reviewed by the author",
    notAdopted.length === 0,
    notAdopted.length
      ? `${notAdopted.length} of ${required.length} still awaiting the author (${store.intents.filter((e) => e.provenance === "ai_draft").length} ai_draft, ${store.intents.filter((e) => e.reviewStatus === "unreviewed" && e.provenance !== "ai_draft").length} unreviewed)`
      : `all ${required.length} adopted`,
    false,
  );

  if (!forExecution) {
    return out.map((v) => (v.blocksPlanningToo ? v : { ...v, passed: true, detail: `${v.detail} — not gating (planning only)` }));
  }
  return out;
}

/** The sentence and provenance to stamp on an evidence record. */
export function intentFor(store: IntentStore | null, testId: string): { intent: string | null; provenance: IntentProvenance | null } {
  const e = store?.intents.find((x) => x.testId === testId);
  if (!e) return { intent: null, provenance: null };
  return { intent: e.intent, provenance: e.provenance };
}
