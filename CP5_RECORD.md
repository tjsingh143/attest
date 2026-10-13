# CP5 — framework mapping and limitations: the record

> **CP5 was superseded by Amendment A2 (2026-09-25); it was not separately approved.** The framework package was generated from the official evidence and checked by the recorded validator. The original amendment and provenance remain in `DECISIONS.md`, `rubric/` and the frozen WP6 evidence copy.

## Why the workflow differs from the brief

The original brief required a separate CP5 review. Amendment A2 waived that interaction prospectively after CP4. This view preserves the superseded checkpoint state; it makes no claim of a separate CP5 approval. The word counts below describe the frozen evidence copy.

## The package

- `framework-mapping.json` and `FRAMEWORK_MAPPING.md` — 16 entries: 1 evidenced (tested paths only), 14 partial, 1 not mapped; 13 from the brief's minimum list, 3 added where the evidence bears directly.
- `CSA_NOTE.md` — one page: claims 137 words, limitations 275 words.
- Independent validation (`npm run attest validate-wp6`): **PASSED**, 9 of 9 checks.

## What CP5 would have asked, answered by the generated material

**Why does a given control map to AC-3 rather than AC-6?**

- Why AC-3 and not AC-6: these tests ask whether a request the rules forbid is refused — enforcement. Whether the rules themselves grant more than a role needs is AC-6's question. The column-level family bears on both and is listed under both.
- Why the definer functions map to AC-6 rather than AC-3: a definer function's refusal is written in its own body and runs with its owner's full privileges, so the question is whether that elevated privilege stays within what the caller may do — least privilege for a process acting on a user's behalf. A4 is where it does not. AC-24 covers the same functions from the decision side.

**What is this exercise not?**

- Not regulatory compliance, not FDA validation, not GxP validation or computer system validation (CSV), not 21 CFR Part 11
  compliance, not a certification, and not an independent regulatory audit.
- Not a statement that Arc21 meets any control: Arc21 is a personal application used as a test subject, not a regulated system,
  and it keeps no electronic record under an FDA predicate rule.
- The rationale is a study interpretation of the recorded evidence, not an independent assessment.
- The exercise provides no evidence of professional regulatory, validation or audit experience.

## Checkpoint state

| Checkpoint | State |
|---|---|
| CP5 | **superseded by Amendment A2** — separate review interaction waived prospectively (2026-09-25); package generated and validated; original provenance retained in the frozen record |

