# CSA note — how this output would, and would not, serve as assurance evidence

*A study note, generated from the recorded evidence. It is not a compliance statement, not validation and not audit experience, and Arc21 is not a regulated system.* Source: FDA, *Computer Software Assurance for Production and Quality Management System Software — Guidance for Industry and Food and Drug Administration Staff*, final guidance issued February 3, 2026 (supersedes "Computer Software Assurance for Production and Quality System Software," issued September 24, 2025), docket FDA-2022-D-0795, section V.A.

## What it could serve as

- **A risk-based assurance activity with a record.** The guidance asks for assurance proportionate to risk and a record of it (V.A(2), (4), (6)). Attest rates every resource with a written rubric (21 High, 19 Medium), scales test depth to the tier — robust scripted testing for High, limited scripted testing for Medium — and records for each of its 345 tests what was run, as whom, what was expected, what happened, when, and against which schema version.
- **Digital, automated, reproducible evidence**, which V.A(6) prefers to screenshots: every verdict is re-derived from the raw records by a separate check (19 of 19), and every report is regenerated from the evidence rather than edited.
- **Issues found, each with a recorded disposition** (V.A(6)): 4 findings, 4 informational items and 2 limitations, each with the recorded CP4 status.

## What it would not cover

1. **No intended use (V.A(1)).** Arc21 is a personal game, not production or quality-system software, so there is no intended use in a regulated process to assess against. The rubric rates assurance priority for data access, not the process risk the guidance defines — a quality problem that could foreseeably compromise safety (V.A(2)).
2. **No supplier assessment (V.A(5)).** PostgreSQL, Supabase, PostgREST and Realtime were not assessed; the platform's defaults were reported, not tested.
3. **No change-control process (V.A(3)).** WP4 detects control changes after they happen. Nobody reviews, approves or re-assesses a change, and nothing requires a re-run.
4. **No qualification of the harness as a validated tool.** Deliberately broken controls (WP1) and injected defects (prove-gates) show that the harness notices those specific breaks; that is not validation for an intended use, and the harness itself produced wrong output during development, each instance written up in DECISIONS.md.
5. **No independent review and no signed approval (V.A(6)).** The assessment and its review occurred within the same project; no independent review or signed approval was obtained.
6. **No conclusion of acceptability, and issues unresolved.** Nothing was remediated (Amendment A1): 2 findings are open, and 13 tests were not measured.
7. **Narrow scope.** Data-layer access control only, on one schema version in a disposable local database with synthetic accounts — not authentication, infrastructure, the network, the HTTP layer, or a production system.
8. **Part 11.** Arc21 keeps no electronic record required by a predicate rule, so the Part 11 mapping is a study exercise and nothing here is a Part 11 control.
