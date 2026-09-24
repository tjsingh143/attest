# AUTHOR INTENT — batch 2 of 13

**F1 (26–29 of 29)** · 4 rows · run `20260924T201920Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 4 proposed sentences in this file were written by the
> harness, not by the author, and 4 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F1.public_tournament_matches.213`

| | |
|---|---|
| Control | `public.tournament_matches#policy:tournament_matches_select_visible` |
| Runs as | authenticated:carol |
| Operation | select from public.tournament_matches for that same tournament fixtures.tournamentAliceBob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of tournament_matches_select_visible falsified. access is decided by viewer_is_in_tournament() — shared tournament membership |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player who has not entered a tournament reads that tournament's bracket.

**AUTHOR INTENT:** A signed-in player who has not entered a tournament reads that tournament's bracket.

#### 2. `F1.public_user_cosmetics.223`

| | |
|---|---|
| Control | `public.user_cosmetics#policy:user_cosmetics_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.user_cosmetics where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of user_cosmetics_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player reads which cosmetics another account owns.

**AUTHOR INTENT:** A signed-in player reads which cosmetics another account owns.

#### 3. `F1.public_wallet_ledger.226`

| | |
|---|---|
| Control | `public.wallet_ledger#policy:wallet_ledger_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallet_ledger where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallet_ledger_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player reads another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** A signed-in player reads another player's chip history — every credit and debit their account has ever seen.

#### 4. `F1.public_wallets.237`

| | |
|---|---|
| Control | `public.wallets#policy:wallets_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallets where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallets_select_own falsified. ownership on user_id |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player reads another player's chip balance.

**AUTHOR INTENT:** A signed-in player reads another player's chip balance.
