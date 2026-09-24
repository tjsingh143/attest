# Gate A — compact decision sheet

Full reasoning and evidence: `WP3_AUTHOR_DECISIONS_REQUIRED.md`. Template:
`rubric/wp3-gate-a-decisions.json`. **Nothing below is decided; undecided = not approved.** WP3
has not been run; preflight passes except for the intent gate; `prove-gates` 66/66; Arc21 unchanged.

## 1. Intents — 240 AI drafts (76 rewritten by the 2026-09-24 audit)

Read: `evidence/runs/20260924T175203Z-5695a4c3df2d/gate-a-intent-review.md` (old and new side by side).

| Category | Rows | Your decision |
|---|---:|---|
| A — plain boundary | 117 | approve as written / review individually |
| B — subtle (membership, definer functions, Realtime, ledger, audit, identity, social) | 107 | approve as written / review individually |
| C — depends on C4, C5 or D-283 | 16 | decide after those / approve as written |
| Replacements | — | `Test ID → your sentence` (stored as `user_authored`) |

## 2. Contradictions — 57 Test IDs, each `not_measured` until decided

| Id | Rows | Smallest same-property change (verified, rolled back) | Other options |
|---|---:|---|---|
| C2-client-guard-before-grant *(mechanical)* | 34 | append `where true` → 42501 privilege refusal | keep `not_measured` |
| C3-tier-literal-invalid *(mechanical)* | 1 | `tier = 'casual'` + `where true` → 42501 | keep |
| C2-grant-before-trigger | 2 | none exists from a client (the grant always answers first) | **A** restate as the 42501 privilege refusal (a different, true property) · **B** keep; `.320`/`.322` carry the trigger |
| C2-fk-before-truncate-trigger | 1 | `truncate … cascade` → refused by `deny_truncate()`, ledger intact | restate as 0A000 (incidental FK) · keep |
| C2-definer-bypasses-named-policy | 1 | name the body's PT404 refusal, not the RLS policy | keep |
| C3-sender-cannot-accept *(mechanical)* | 1 | `'cancelled'` → 1 row, still alice's | keep |
| C3-username-literal-invalid *(mechanical)* | 2 | `'attest_probe_user'` → 1 row | keep |
| C3-cosmetic-literal-invalid *(mechanical)* | 1 | NULL, or an owned cosmetic → 1 row | keep |
| C4-anon-has-no-execute | 1 | run as a signed-in caller (Arc21 revokes EXECUTE from anon on purpose) | keep anon and expect 42501 (a different property) · keep |
| C5-deleted-user-subject-empty | 14 | **retarget `.331–.333`** at what the deletion leaves behind (dave seated `left`, deleted by Arc21, stale token reads the session: 3→0, 1→0, 1→0); other 11 stay `not_measured` | keep all 14 · characterization (changes 63/240/42) |

## 3. `F5.delete_own_account.283`

Its body has four documented cross-account effects (host handover, queue release, notification
cleanup, seat anonymisation); the literal "no bob or carol row … changes" forbids the first, which
is exactly what the smoke saw (the lobby alice hosted passed to bob).
**(a)** carve out the documented handover · **(b)** keep literal → `deficient`, weighed in WP5 ·
**(c)** reclassify with its own invariant · *(d) not_measured — not recommended.*

## 4. *(optional)* `F5.register_push_token.269` covers text

States the takeover's consequence backwards. **Correct** it, or **leave** it (execution unaffected).

## Answer format

```
Intents: A ___; B ___; C ___.  Replace: <Test ID> → "…"
C2-client-guard ___  C3-tier ___  C2-grant-trigger ___  C2-fk-truncate ___  C2-definer ___
C3-sender ___  C3-username ___  C3-cosmetic ___  C4 ___  C5 ___  D-283 ___  O-269 ___
```

Operational: do not use the shared local Supabase stack during the ~40–50 minute run. Your
development database from 2026-09-23 is backed up at
`.local-backups/arc21-shared-stack-before-wp3-20260924-172900.dump`.
