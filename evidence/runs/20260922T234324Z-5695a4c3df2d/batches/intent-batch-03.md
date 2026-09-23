# AUTHOR INTENT — batch 3 of 13

**F2 (1–25 of 58)** · 25 rows · run `20260922T234324Z-5695a4c3df2d`

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F2.private_career_drill_seeds.001`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.career_drill_seeds (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to plant a drill seed the server never issued, so an attempt is graded against scenarios of their own choosing.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 2. `F2.private_career_drill_seeds.002`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.career_drill_seeds set created_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the seed a reward-bearing drill attempt will be graded against.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `F2.private_career_drill_seeds.003`

| | |
|---|---|
| Control | `private.career_drill_seeds#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.career_drill_seeds |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the seed a drill attempt is graded against, so the attempt cannot be checked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 4. `F2.private_game_commands.007`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.game_commands (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to forge an accepted-command record and make the server treat a command it never ran as already applied.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 5. `F2.private_game_commands.008`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.game_commands set created_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter the idempotency ledger so an already-applied command is accepted a second time and its chip movement happens twice.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 6. `F2.private_game_commands.009`

| | |
|---|---|
| Control | `private.game_commands#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.game_commands |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to erase the idempotency record that stops a retry from crediting or debiting twice.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 7. `F2.private_game_state_private.016`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into private.game_state_private (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to inject engine state the dealer never dealt, so commands are validated against a table of their own making.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 8. `F2.private_game_state_private.017`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update private.game_state_private set updated_at = '2026-01-01T00:00:00Z' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite the authoritative engine state a live hand is being validated against.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 9. `F2.private_game_state_private.018`

| | |
|---|---|
| Control | `private.game_state_private#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from private.game_state_private |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the authoritative engine state a live session depends on.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 10. `F2.public_blocks.025`

| | |
|---|---|
| Control | `public.blocks#policy:blocks_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.blocks where blocker_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of blocks_delete_own (DELETE) falsified. The predicate keys on blocker_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to remove a block they are not party to, making the blocker's profile visible again to the very account they blocked.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 11. `F2.public_daily_challenges.041`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.daily_challenges (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to publish a daily challenge of their own, with a shoe they already know.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 12. `F2.public_daily_challenges.042`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.daily_challenges set revealed_seed = 'attest-probe-revealed_seed' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite a daily challenge's seed or its published commitment, changing the deal for every player and breaking the proof that the shoe was fixed in advance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 13. `F2.public_daily_challenges.043`

| | |
|---|---|
| Control | `public.daily_challenges#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.daily_challenges |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy the published commitment that makes a day's shoe verifiable after the fact.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 14. `F2.public_friend_requests.056`

| | |
|---|---|
| Control | `public.friend_requests#policy:friend_requests_update_participants` |
| Runs as | authenticated:alice |
| Operation | update public.friend_requests where sender_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of friend_requests_update_participants (UPDATE) falsified. The predicate keys on sender_id OR receiver_id, and the fixture names bob there instead of alice in every clause, since a row naming alice in either column is legitimately writable by her |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to force a friend request to 'accepted' on someone else's behalf, which creates a friendship and therefore changes who may read a profile.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 15. `F2.public_friendships.068`

| | |
|---|---|
| Control | `public.friendships#policy:friendships_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.friendships where user_id_a = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of friendships_delete_own (DELETE) falsified. The predicate keys on user_id_a OR user_id_b, and the fixture names bob there instead of alice in every clause, since a row naming alice in either column is legitimately writable by her |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player uses a write they do hold to sever a friendship they are not party to, revoking the profile visibility it granted.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 16. `F2.public_game_events.074`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_events (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to inject a fabricated event into a live table's stream and mislead the players at it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 17. `F2.public_game_events.075`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_events set recipient_user_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to rewrite an event already delivered to the players at a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 18. `F2.public_game_events.076`

| | |
|---|---|
| Control | `public.game_events#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_events |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete events from a live table's stream so clients reconstruct a hand that did not happen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 19. `F2.public_game_session_seats.085`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_session_seats (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to seat themselves at a table they were never invited to — and because six policies key on seat membership, thereby grant themselves read access to that session, its events, its hands and its Realtime topic.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 20. `F2.public_game_session_seats.086`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_session_seats set user_id = '00000000-0000-4000-8000-0000000000ff' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a seat row, changing either another player's stack or the membership that five other policies read as authorization.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 21. `F2.public_game_session_seats.087`

| | |
|---|---|
| Control | `public.game_session_seats#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_session_seats |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to unseat another player, removing the seat that authorizes their access to the table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 22. `F2.public_game_sessions.093`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.game_sessions (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to conjure a game session that the server never created.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 23. `F2.public_game_sessions.094`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.game_sessions set tier = 'attest-probe-tier' |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a live session's status, version or escrowed chips.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 24. `F2.public_game_sessions.095`

| | |
|---|---|
| Control | `public.game_sessions#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.game_sessions |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy a live session other players are seated at.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 25. `F2.public_hand_records.104`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.hand_records (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A signed-in player writes straight to a table only the server is supposed to write, to write a hand into the archive that was never dealt.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*
