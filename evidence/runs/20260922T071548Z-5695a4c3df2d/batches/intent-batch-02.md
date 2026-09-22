# AUTHOR INTENT — batch 2 of 13

**F1 (26–29 of 29)** · 4 rows · run `20260922T071548Z-5695a4c3df2d`

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

> If carol could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 2. `F1.public_user_cosmetics.223`

| | |
|---|---|
| Control | `public.user_cosmetics#policy:user_cosmetics_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.user_cosmetics where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of user_cosmetics_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 3. `F1.public_wallet_ledger.226`

| | |
|---|---|
| Control | `public.wallet_ledger#policy:wallet_ledger_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallet_ledger where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallet_ledger_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_

#### 4. `F1.public_wallets.237`

| | |
|---|---|
| Control | `public.wallets#policy:wallets_select_own` |
| Runs as | authenticated:alice |
| Operation | select from public.wallets where user_id = fixtures.bob.id |
| Expected safe result | no data (0 rows — RLS filters rather than raising) |
| Covers | USING of wallets_select_own falsified. ownership on user_id |

> If alice could actually do this and it succeeded, what would they have got away with? Name the attack or the mistake in one sentence.

**AUTHOR INTENT:** \_\_\_\_\_
