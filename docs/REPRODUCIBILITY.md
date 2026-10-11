# Reproducibility and target setup

## Reports without a database

Node 23.6 or later is required because the CLI executes TypeScript directly.
Every CLI command also fingerprints a Git-backed Arc21 checkout before and after
execution. Set `ATTEST_ARC21_CHECKOUT` to that checkout even for commands that do
not use a database. A clean current Arc21 clone can serve this guard for report-only
commands; it is not used to recompute the frozen assessment results.

```sh
npm ci
npm run typecheck
export ATTEST_ARC21_CHECKOUT=/absolute/path/to/arc21-checkout
npm run attest reports
npm run attest validate-reports
npm run attest validate-wp6
```

These commands read the committed assessment evidence. `reports` writes generated
report files; validators may write validation summaries. Use a working checkout if
you want to preserve the committed artifacts for comparison. These commands do not
execute the assessment probes against a live database.

## Database reproduction uses a historical target

The official results describe schema `5695a4c3df2d`: 59 migration files, recorded
with Arc21 HEAD `58dcf39fc66a3d1fcb81a20c34beb77875ff929a` **and a dirty working
tree**. The recorded uncommitted changes include a migration. That commit alone
is therefore insufficient to reconstruct the measured schema; see
[decision D0.2](../DECISIONS.md#d02--the-schema-version-is-a-content-hash-of-the-migration-set-not-a-commit-sha)
and [the frozen inventory](../evidence/runs/20260922T234324Z-5695a4c3df2d/inventory.md).

Current Arc21 `main` includes the later Refresh B migrations. Running the frozen
assessment against that newer target is not a reproduction of the official
results. Use the preserved target checkout whose migration-content hash matches
the recorded schema, or limit the review to report-only commands. This repository
does not establish a clean-clone recipe for recreating the dirty historical target.

`validate-wp3` does not run database probes, but it compares the saved run against
the **selected checkout's** migration-content hash, commit and working-tree
fingerprint. Validating the official run therefore also needs the preserved
historical checkout. With that checkout selected, provide the matching planning run:

```sh
npm run attest validate-wp3 20260925T014011Z-5695a4c3df2d -- --plan-run=20260924T201920Z-5695a4c3df2d
```

Selecting a clean current clone for this command produces target-identity failures;
that does not revise the official assessment. Keep any new validation summaries
separate from the frozen evidence. The committed official validation remains the
record of the historical run.

`ATTEST_ARC21_CHECKOUT` selects the protected checkout. Its default is
`arc21 copy/` inside the Attest repository, not a sibling folder. The checkout
remains read-only under Attest's before/after guard. The database rebuilt by
`attest run` is disposable, uses the selected checkout's local Supabase stack,
and must not contain development data needed elsewhere.

## Evidence boundaries

Official WP3 results are retained in `20260925T014011Z-5695a4c3df2d`.
Validation, historical approvals, draft/review status, superseded runs, and
`not_measured` outcomes remain in the evidence. Report checks cannot establish
current Arc21 security or remediate the assessment target.
