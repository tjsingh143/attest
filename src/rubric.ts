/**
 * Attest — WP2, the rubric's completeness check.
 *
 * Deliberately NOT a scorer yet.
 *
 * The rubric is one of the four artifacts brief §1.1 reserves for the author,
 * and that reservation covers its shape as well as its contents. A parser
 * written before the rubric exists would force the author to write a rubric
 * that fits the parser -- choosing dimensions, level counts and an aggregation
 * rule to satisfy a format rather than because they are right. That is the
 * harness authoring the rubric through the back door.
 *
 * So this module does the one useful thing that does not presume the answer:
 * it reports what is still blank. The scorer, the tier computation and the
 * sensitivity analysis are written once RUBRIC.md says what it is, and they are
 * written to fit it.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";

export const RUBRIC_PATH = join(ATTEST_ROOT, "RUBRIC.md");

export interface RubricStatus {
  readonly authored: boolean;
  /** Prose blanks: the `_____` placeholders. */
  readonly proseBlanks: number;
  /** Score cells still holding `?`. */
  readonly unscoredCells: number;
  /** Resources with no score in any dimension. */
  readonly unscoredResources: readonly string[];
  /** Section-by-section, what is outstanding. */
  readonly outstanding: readonly { readonly section: string; readonly missing: string }[];
}

const SECTIONS: readonly { readonly heading: RegExp; readonly label: string }[] = [
  { heading: /^## Dimension 1 —/m, label: "Dimension 1 — what the data is" },
  { heading: /^## Dimension 2 —/m, label: "Dimension 2 — blast radius" },
  { heading: /^## Dimension 3 —/m, label: "Dimension 3 — integrity impact" },
  { heading: /^## Dimension 4 —/m, label: "Dimension 4 — reversibility" },
  { heading: /^## Dimension 5 —/m, label: "Dimension 5 — exposure" },
  { heading: /^# Part 2 — Rubric architecture/m, label: "Part 2 — architecture (explanatory)" },
  { heading: /^## 2\.1 The architecture I have chosen/m, label: "Part 2.1 — architecture chosen" },
  { heading: /^## 2\.2 The specification/m, label: "Part 2.2 — its specification" },
  { heading: /^## 2\.3 Before you score/m, label: "Part 2.3 — (no input required)" },
  { heading: /^# Part 3 —/m, label: "Part 3 — per-resource scoring" },
  { heading: /^## 4\.1 /m, label: "Part 4.1 — FORCE ROW LEVEL SECURITY assessment" },
  { heading: /^## 4\.2 /m, label: "Part 4.2 — service_role reachability assessment" },
  { heading: /^# Part 5 —/m, label: "Part 5 — tier to assurance activity" },
  { heading: /^## 6\.1 The alternative/m, label: "Part 6.1 — the alternative rubric" },
  { heading: /^## 6\.2 Results/m, label: "Part 6.2 — results (computed)" },
  { heading: /^# Part 7 —/m, label: "Part 7 — limitations" },
];

/** Split the document into (label, body) by the headings above, in order. */
function sections(doc: string): { label: string; body: string }[] {
  const marks = SECTIONS.map((s) => ({ label: s.label, at: doc.search(s.heading) })).filter(
    (m) => m.at >= 0,
  );
  marks.sort((a, b) => a.at - b.at);
  return marks.map((m, i) => ({
    label: m.label,
    body: doc.slice(m.at, i + 1 < marks.length ? marks[i + 1]!.at : undefined),
  }));
}

export async function readRubricStatus(): Promise<RubricStatus> {
  let doc: string;
  try {
    doc = await readFile(RUBRIC_PATH, "utf8");
  } catch {
    return {
      authored: false,
      proseBlanks: -1,
      unscoredCells: -1,
      unscoredResources: [],
      outstanding: [{ section: "RUBRIC.md", missing: "the file does not exist" }],
    };
  }

  const outstanding: { section: string; missing: string }[] = [];
  let proseBlanks = 0;
  let unscoredCells = 0;

  for (const { label, body } of sections(doc)) {
    const blanks = (body.match(/_____/g) ?? []).length;
    // Two placeholder shapes mean "a number goes here": a bare `?` in the
    // scoring table, and a backticked underscore in the level, weight and
    // threshold tables. The first version counted only the former, so Part 2.1
    // reported nothing outstanding while every weight was still blank -- the
    // checker telling the author they had finished a section they had not
    // started.
    const cells =
      (body.match(/\|\s*\?\s*(?=\|)/g) ?? []).length +
      (body.match(/\|\s*`_+`\s*(?=\|)/g) ?? []).length;
    proseBlanks += blanks;
    unscoredCells += cells;
    const parts: string[] = [];
    if (blanks) parts.push(`${blanks} written answer${blanks === 1 ? "" : "s"}`);
    if (cells) parts.push(`${cells} score cell${cells === 1 ? "" : "s"}`);
    if (parts.length) outstanding.push({ section: label, missing: parts.join(", ") });
  }

  // Which resources have no score at all yet.
  const unscoredResources: string[] = [];
  for (const line of doc.split("\n")) {
    const m = /^\|\s*`([a-z_]+\.[a-z_]+)`\s*\|/.exec(line);
    if (!m) continue;
    const scoreCells = (line.match(/\|\s*\?\s*(?=\|)/g) ?? []).length;
    if (scoreCells >= 5) unscoredResources.push(m[1]!);
  }

  return {
    authored: proseBlanks === 0 && unscoredCells === 0,
    proseBlanks,
    unscoredCells,
    unscoredResources,
    outstanding,
  };
}

export function formatRubricStatus(st: RubricStatus): string {
  const L: string[] = [];
  if (st.authored) {
    L.push("  RUBRIC.md is complete.");
    L.push("  The scorer, tier computation and sensitivity analysis are written next, to fit it.");
    return L.join("\n");
  }
  L.push("  RUBRIC.md is NOT YET AUTHORED. No tiers can be computed and none will be guessed.");
  L.push("");
  for (const o of st.outstanding) L.push(`    ${o.section.padEnd(52)} ${o.missing}`);
  L.push("");
  L.push(`  ${st.proseBlanks} written answers and ${st.unscoredCells} score cells outstanding.`);
  L.push("  Part 2.2 offers three specifications; delete the two your architecture does not use,");
  L.push("  and that count drops accordingly.");
  if (st.unscoredResources.length) {
    L.push(`  ${st.unscoredResources.length} resources have no score in any dimension.`);
  }
  L.push("");
  L.push("  The facts to score from are in evidence/runs/<run-id>/risk-inputs.md.");
  return L.join("\n");
}
