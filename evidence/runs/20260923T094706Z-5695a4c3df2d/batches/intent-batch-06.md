# AUTHOR INTENT — batch 6 of 13

**F3** · 4 rows · run `20260923T094706Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 4 of the 4 proposed sentences in this file were written by the
> harness, not by the author, and 0 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F3.public_blocks.027`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.blocks with blocker_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of blocks_insert_own (INSERT) unsatisfied: the policy compares `blocker_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.blocks attributed to somebody else by setting blocker_id to another account, in order to fabricate a block on another player's behalf and cut them off from someone they never blocked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 2. `F3.public_friend_requests.058`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_insert_as_sender` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.friend_requests with sender_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of friend_requests_insert_as_sender (INSERT) unsatisfied: the policy compares `sender_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.friend_requests attributed to somebody else by setting sender_id to another account, in order to send a friend request in someone else's name.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `F3.public_loadouts.115`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.loadouts with user_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of loadouts_insert_own (INSERT) unsatisfied: the policy compares `user_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.loadouts attributed to somebody else by setting user_id to another account, in order to create a loadout attributed to another account.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 4. `F3.public_push_tokens.162`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_insert_own` |
| Runs as | authenticated:alice |
| Operation | INSERT into public.push_tokens with user_id = fixtures.bob.id (no RETURNING clause) |
| Expected safe result | error 42501 — new row violates row-level security policy |
| Covers | WITH CHECK of push_tokens_insert_own (INSERT) unsatisfied: the policy compares `user_id`, so that is the column set to another account. No RETURNING, so the SELECT policy is not pulled in (DECISIONS D1.5) |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player creates a row in public.push_tokens attributed to somebody else by setting user_id to another account, in order to register a push token against another account and receive that account's notifications on their own device.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*
