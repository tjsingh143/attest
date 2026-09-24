/**
 * Attest — the Gate A review table: every AUTHOR INTENT draft beside what the
 * author needs to judge it.
 *
 * Generated, never hand-edited. For each of the 240 negatives it prints the
 * current draft, the draft it replaced (from the intent store as it stood at
 * `baselineCommit`, read out of Attest's own git history), the pre-audit draft's
 * failures under today's quality checks, any registered contradiction, and a
 * review-effort category:
 *
 *   A  the draft states the probe's attack on a plain ownership, grant, column
 *      or anonymous-reach boundary
 *   B  technically sound, but the row turns on membership, a SECURITY DEFINER
 *      function, Realtime, the ledger, audit semantics, an identity boundary or
 *      interacting social policies — read these slowly
 *   C  the right wording depends on a decision still open in Gate A
 *
 * The category is review assistance and nothing else. It approves nothing, and
 * a category-A draft is exactly as much an AI draft as a category-C one.
 *
 * The decision template (`rubric/wp3-gate-a-decisions.json`) is written only if
 * it does not exist, so re-running this can never overwrite the author's input.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT, RUNS_ROOT } from "./config.ts";
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { requiresIntent, type IntentStore } from "./author-intents.ts";
import { validateDraftQuality } from "./intent-quality.ts";
import { registeredContradictionsFor, REGISTERED_CONTRADICTIONS } from "./wp3-contradictions.ts";

const run = promisify(execFile);

export const GATE_A_DECISIONS_PATH = join(ATTEST_ROOT, "rubric", "wp3-gate-a-decisions.json");

export type ReviewCategory = "A" | "B" | "C";

const SOCIAL = new Set(["public.blocks", "public.friend_requests", "public.friendships"]);

/** The review category and the one-line reason, from the row's own facts. */
export function reviewCategory(t: PlannedTest): { category: ReviewCategory; why: string } {
  const fam = t.family.split(" ")[0]!;
  const fn = t.resource.replace(/^public\./, "").split("(")[0]!.trim();
  if (/#boundary:deleted-user/.test(t.control)) {
    return { category: "C", why: "C5 is open: whether these rows are retargeted at what the deletion leaves behind, kept not_measured, or re-described decides the sentence" };
  }
  if (fn === "latest_verifiable_daily_challenge") {
    return { category: "C", why: "C4 is open: if the row runs as a signed-in caller, the actor in the sentence changes" };
  }
  if (fn === "delete_own_account") {
    return { category: "C", why: "D-283 is open: the reading of the expectation decides which attack the sentence names" };
  }
  if (fam === "F5") return { category: "B", why: "SECURITY DEFINER function: the caller's own policies do not apply inside it" };
  if (fam === "F8") return { category: "B", why: "Realtime channel authorization" };
  if (fam === "F9") return { category: "B", why: "ledger integrity, idempotency or concurrency" };
  if (fam === "F10") return { category: "B", why: "audit-trail tampering" };
  if (fam === "B") return { category: "B", why: t.testId === "B.suite.expired-session" ? "identity boundary enforced at the API gateway, not in PostgreSQL" : "identity boundary: no identity claims at all" };
  if (fam === "F1" && /is_session_participant|caller_is_room_member|viewer_is_in_tournament/.test(t.covers) && t.identity.includes("carol")) {
    return { category: "B", why: "access turns on shared membership (seat, room or tournament), not ownership" };
  }
  if (t.resource === "public.profiles" && fam === "F1") return { category: "B", why: "two permissive SELECT policies interact; the subject is chosen to falsify both" };
  if (SOCIAL.has(t.resource) && ["F1", "F2", "F3", "F6"].includes(fam)) return { category: "B", why: "social rows feed profile visibility, an authorization decision" };
  const why =
    fam === "F1" ? "ownership: the caller reads another account's row"
    : fam === "F2" ? (/#grant:/.test(t.control) ? "grant surface: no client write privilege on a server-written table" : "ownership: the caller writes another account's row")
    : fam === "F3" ? "WITH CHECK: a new row attributed to another account"
    : fam === "F4" ? (/the unsatisfied branch of/.test(t.covers) ? "anonymous read of a catalogue row withdrawn from publication" : "anonymous reach")
    : fam === "F6" ? "column privilege on a row the caller may otherwise use"
    : "plain boundary";
  return { category: "A", why };
}

export interface ReviewRow {
  readonly testId: string;
  readonly family: string;
  readonly identity: string;
  readonly category: ReviewCategory;
  readonly why: string;
  readonly contradictions: readonly string[];
  readonly draft: string;
  readonly provenance: string;
  readonly reviewStatus: string;
  readonly changedSinceBaseline: boolean;
  readonly baselineDraft: string | null;
  readonly baselineDraftFails: readonly string[];
}

async function storeAt(commit: string): Promise<IntentStore | null> {
  try {
    const { stdout } = await run("git", ["-C", ATTEST_ROOT, "show", `${commit}:rubric/author-intents.json`], { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(stdout) as IntentStore;
  } catch {
    return null;
  }
}

export async function buildReviewRows(plan: Wp3Plan, store: IntentStore, baselineCommit: string): Promise<{ rows: ReviewRow[]; baselineFound: boolean }> {
  const base = await storeAt(baselineCommit);
  const baseDrafts = new Map((base?.intents ?? []).map((e) => [e.testId, e.intent]));
  const baseIssues = base ? validateDraftQuality(plan, baseDrafts) : [];
  const now = new Map(store.intents.map((e) => [e.testId, e]));
  const rows = plan.tests.filter(requiresIntent).map((t): ReviewRow => {
    const e = now.get(t.testId);
    const { category, why } = reviewCategory(t);
    const was = baseDrafts.get(t.testId) ?? null;
    return {
      testId: t.testId, family: t.family, identity: t.identity, category, why,
      contradictions: registeredContradictionsFor(t.testId).map((c) => c.id),
      draft: e?.intent ?? "(missing)", provenance: e?.provenance ?? "(missing)", reviewStatus: e?.reviewStatus ?? "(missing)",
      changedSinceBaseline: was !== null && was !== e?.intent,
      baselineDraft: was,
      baselineDraftFails: baseIssues.filter((i) => i.testId === t.testId).map((i) => i.check),
    };
  });
  return { rows, baselineFound: base !== null };
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderReviewMarkdown(rows: readonly ReviewRow[], meta: { runId: string; schemaVersion: string; baselineCommit: string }): string {
  const by = (c: ReviewCategory) => rows.filter((r) => r.category === c);
  const changed = rows.filter((r) => r.changedSinceBaseline);
  const L: string[] = [];
  L.push("# Gate A — AUTHOR INTENT review table (generated)");
  L.push("");
  L.push("> **GENERATED by `npm run attest gate-a-package`. Do not edit.** Every sentence below is an");
  L.push("> **AI DRAFT — NOT YET ADOPTED BY AUTHOR** (`ai_draft` / `unreviewed`). The canonical store, and");
  L.push("> the only file whose contents count, is `rubric/author-intents.json`. The A/B/C category is");
  L.push("> review assistance only; it approves nothing.");
  L.push("");
  L.push(`Run \`${meta.runId}\` · schema \`${meta.schemaVersion.slice(0, 12)}…\` · drafts compared with the store at Attest commit \`${meta.baselineCommit}\`.`);
  L.push("");
  L.push("| | Rows |");
  L.push("|---|---:|");
  L.push(`| Negatives requiring an intent | ${rows.length} |`);
  L.push(`| A — plain boundary | ${by("A").length} |`);
  L.push(`| B — subtle | ${by("B").length} |`);
  L.push(`| C — depends on an open Gate A decision | ${by("C").length} |`);
  L.push(`| Draft changed by the 2026-09-24 audit | ${changed.length} |`);
  L.push(`| Carrying a registered contradiction | ${rows.filter((r) => r.contradictions.length).length} |`);
  L.push(`| Adopted by the author | ${rows.filter((r) => r.provenance !== "ai_draft" && r.reviewStatus === "approved").length} |`);
  L.push("");
  for (const c of ["C", "B", "A"] as ReviewCategory[]) {
    const title = c === "A" ? "A — plain boundary" : c === "B" ? "B — subtle: read these slowly" : "C — depends on an open decision";
    L.push(`## ${title} (${by(c).length})`);
    L.push("");
    L.push("| Test ID | Runs as | Why this category | Contradiction | AI draft (current) | Changed from (pre-audit draft) | Pre-audit draft failed |");
    L.push("|---|---|---|---|---|---|---|");
    for (const r of by(c)) {
      L.push(`| \`${r.testId}\` | ${cell(r.identity)} | ${cell(r.why)} | ${r.contradictions.join(" + ") || "—"} | ${cell(r.draft)} | ${r.changedSinceBaseline ? cell(r.baselineDraft ?? "") : "unchanged"} | ${r.baselineDraftFails.length ? cell(r.baselineDraftFails.join("; ")) : "—"} |`);
    }
    L.push("");
  }
  return L.join("\n") + "\n";
}

export function renderReviewTsv(rows: readonly ReviewRow[]): string {
  const head = ["testId", "category", "why", "contradictions", "provenance", "reviewStatus", "changed", "draft", "preAuditDraft", "preAuditFails"];
  const t = (s: string) => s.replace(/[\t\n]/g, " ");
  return [head.join("\t"), ...rows.map((r) => [r.testId, r.category, r.why, r.contradictions.join("+"), r.provenance, r.reviewStatus, r.changedSinceBaseline ? "yes" : "no", r.draft, r.baselineDraft ?? "", r.baselineDraftFails.join("; ")].map(t).join("\t"))].join("\n") + "\n";
}

/** The machine-readable decision template. Every decision is "pending"; nothing is pre-filled. */
export function decisionTemplate(rows: readonly ReviewRow[], meta: { runId: string; schemaVersion: string }): unknown {
  const count = (c: ReviewCategory) => rows.filter((r) => r.category === c).length;
  return {
    WARNING:
      "THE AUTHOR FILLS THIS IN. Every value 'pending' is undecided, and Attest treats undecided as 'not approved'. " +
      "Nothing here is pre-filled, and nothing in it has been decided on the author's behalf. Explanations and evidence: " +
      "WP3_AUTHOR_DECISIONS_REQUIRED.md. A decision may instead be given in conversation; Attest then records it here " +
      "with `recordedFrom` naming that reply, and never records a decision the author did not make.",
    gate: "A — before WP3 execution",
    preparedAgainst: { intentReviewRun: meta.runId, schemaVersion: meta.schemaVersion, approvedMatrix: "rubric/wp3-approved-matrix.json" },
    recordedFrom: null,
    intents: {
      howToAnswer:
        "For each category choose 'approve_as_written' (every draft in it becomes user_reviewed_ai_draft / approved) or " +
        "'review_individually' (list each decision under perRow). perRow always wins over the category default. A replacement " +
        "sentence is stored as user_authored.",
      categories: {
        A: { rows: count("A"), decision: "pending" },
        B: { rows: count("B"), decision: "pending" },
        C: { rows: count("C"), decision: "pending", note: "C rows depend on C4, C5 and D-283 below; their drafts may need to change once those are decided" },
      },
      perRow: {},
      perRowExample: {
        "F1.public_blocks.023": { decision: "approve_as_written" },
        "F1.public_wallets.237": { decision: "replace", sentence: "(the author's own sentence)" },
      },
    },
    contradictions: Object.fromEntries(REGISTERED_CONTRADICTIONS.map((c) => [c.id, { testIds: c.testIds, decision: "pending" }])),
    contradictionOptions: "the options for each contradiction, with their consequences, are listed in WP3_AUTHOR_DECISIONS_REQUIRED.md §2",
    d283: { testId: "F5.delete_own_account.283", decision: "pending", options: "WP3_AUTHOR_DECISIONS_REQUIRED.md §3" },
    optional: {
      covers269: { testId: "F5.register_push_token.269", decision: "pending", options: "WP3_AUTHOR_DECISIONS_REQUIRED.md §4 — the approved `covers` text states the takeover's consequence backwards; correct it, or leave it and let the evidence record say so" },
    },
  };
}

export async function writeGateAPackage(
  plan: Wp3Plan, store: IntentStore, meta: { runId: string; schemaVersion: string; baselineCommit: string },
): Promise<{ dir: string; rows: ReviewRow[]; baselineFound: boolean; templateWritten: boolean }> {
  const { rows, baselineFound } = await buildReviewRows(plan, store, meta.baselineCommit);
  const dir = join(RUNS_ROOT, meta.runId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "gate-a-intent-review.md"), renderReviewMarkdown(rows, meta));
  await writeFile(join(dir, "gate-a-intent-review.tsv"), renderReviewTsv(rows));
  await writeFile(join(dir, "gate-a-intent-review.json"), JSON.stringify({ meta, rows }, null, 2) + "\n");
  let templateWritten = false;
  try {
    await access(GATE_A_DECISIONS_PATH);
  } catch {
    await writeFile(GATE_A_DECISIONS_PATH, JSON.stringify(decisionTemplate(rows, meta), null, 2) + "\n");
    templateWritten = true;
  }
  return { dir, rows, baselineFound, templateWritten };
}
