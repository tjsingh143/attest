# AUTHOR INTENT — batch 5 of 13

**F2 (51–58 of 58)** · 8 rows · run `20260924T201920Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 8 proposed sentences in this file were written by the
> harness, not by the author, and 8 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F2.public_tournament_matches.215`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.tournament_matches set entry_a_id = '00000000-0000-4000-8000-0000000000ff' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to declare a different winner in a tournament bracket.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to declare a different winner in a tournament bracket.

#### 2. `F2.public_tournament_matches.216`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.tournament_matches where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a match from a tournament bracket.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to delete a match from a tournament bracket.

#### 3. `F2.public_wallet_ledger.227`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.wallet_ledger (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to write a ledger entry the server never issued and credit themselves chips.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to write a ledger entry the server never issued and credit themselves chips.

#### 4. `F2.public_wallet_ledger.228`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.wallet_ledger set reference_type = 'attest-probe-reference_type' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the append-only economy history that wallet balances are recomputed from.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to rewrite the append-only economy history that wallet balances are recomputed from.

#### 5. `F2.public_wallet_ledger.229`

| | |
|---|---|
| Control | `public.wallet_ledger#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.wallet_ledger where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete ledger entries, destroying the authoritative record the balance is derived from.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to delete ledger entries, destroying the authoritative record the balance is derived from.

#### 6. `F2.public_wallets.238`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.wallets (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to create a wallet outside the account-bootstrap path.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to create a wallet outside the account-bootstrap path.

#### 7. `F2.public_wallets.239`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.wallets set updated_at = '2026-01-01T00:00:00Z' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to set a chip balance directly, bypassing the ledger the economy is supposed to move through.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to set a chip balance directly, bypassing the ledger the economy is supposed to move through.

#### 8. `F2.public_wallets.240`

| | |
|---|---|
| Control | `public.wallets#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.wallets where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a wallet and the balance it holds.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to delete a wallet and the balance it holds.
