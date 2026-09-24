# AUTHOR INTENT — batch 4 of 13

**F2 (26–50 of 58)** · 25 rows · run `20260924T201920Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 0 of the 25 proposed sentences in this file were written by the
> harness, not by the author, and 25 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `F2.public_hand_records.105`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.hand_records set dealer_total = 1 where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to falsify the archived history of a completed hand.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to falsify the archived history of a completed hand.

#### 2. `F2.public_hand_records.106`

| | |
|---|---|
| Control | `public.hand_records#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.hand_records where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a hand from the archive, destroying the record of what was played.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to delete a hand from the archive, destroying the record of what was played.

#### 3. `F2.public_loadouts.113`

| | |
|---|---|
| Control | `public.loadouts#policy:loadouts_update_own` |
| Runs as | authenticated:alice |
| Operation | update public.loadouts where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of loadouts_update_own (UPDATE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player uses a write they do hold to change what another player has equipped.

**AUTHOR INTENT:** A signed-in player uses a write they do hold to change what another player has equipped.

#### 4. `F2.public_notifications.125`

| | |
|---|---|
| Control | `public.notifications#policy:notifications_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.notifications where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of notifications_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player uses a write they do hold to delete another player's notifications before they read them.

**AUTHOR INTENT:** A signed-in player uses a write they do hold to delete another player's notifications before they read them.

#### 5. `F2.public_profiles.150`

| | |
|---|---|
| Control | `public.profiles#policy:profiles_update_self` |
| Runs as | authenticated:alice |
| Operation | update public.profiles where id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of profiles_update_self (UPDATE) falsified. The predicate keys on id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player uses a write they do hold to edit another player's public identity — their username, display name and bio.

**AUTHOR INTENT:** A signed-in player uses a write they do hold to edit another player's public identity — their username, display name and bio.

#### 6. `F2.public_push_tokens.160`

| | |
|---|---|
| Control | `public.push_tokens#policy:push_tokens_delete_own` |
| Runs as | authenticated:alice |
| Operation | delete from public.push_tokens where user_id = fixtures.bob.id |
| Expected safe result | 0 rows affected — the policy filters the row out of the write |
| Covers | USING of push_tokens_delete_own (DELETE) falsified. The predicate keys on user_id, and the fixture names bob there instead of alice |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player uses a write they do hold to deregister another account's device so its notifications stop arriving.

**AUTHOR INTENT:** A signed-in player uses a write they do hold to deregister another account's device so its notifications stop arriving.

#### 7. `F2.public_rate_limit_events.166`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_events (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to pad another account's rate-limit window so their legitimate actions start being refused.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to pad another account's rate-limit window so their legitimate actions start being refused.

#### 8. `F2.public_rate_limit_events.167`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_events set occurred_at = '2026-01-01T00:00:00Z' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to backdate their own rate-limit events so a spent window looks fresh.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to backdate their own rate-limit events so a spent window looks fresh.

#### 9. `F2.public_rate_limit_events.168`

| | |
|---|---|
| Control | `public.rate_limit_events#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_events where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to clear their own rate-limit window and resume an action the limiter had started refusing.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to clear their own rate-limit window and resume an action the limiter had started refusing.

#### 10. `F2.public_rate_limit_policies.175`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rate_limit_policies (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to add a rate-limit rule of their own.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to add a rate-limit rule of their own.

#### 11. `F2.public_rate_limit_policies.176`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rate_limit_policies set rationale = 'attest-probe-rationale' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to widen or disable a rate limit for every account at once, which is corruption of a security control rather than of data.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to widen or disable a rate limit for every account at once, which is corruption of a security control rather than of data.

#### 12. `F2.public_rate_limit_policies.177`

| | |
|---|---|
| Control | `public.rate_limit_policies#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rate_limit_policies where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to delete a rate-limit policy and remove the limit it enforced product-wide.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to delete a rate-limit policy and remove the limit it enforced product-wide.

#### 13. `F2.public_room_members.183`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.room_members (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to add themselves to a private room they were never invited to — and because caller_is_room_member reads this table, thereby grant themselves the room access it decides.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to add themselves to a private room they were never invited to — and because caller_is_room_member reads this table, thereby grant themselves the room access it decides.

#### 14. `F2.public_room_members.184`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.room_members set last_seen_at = '2026-01-01T00:00:00Z' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter a membership row that other policies read as an authorization decision.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to alter a membership row that other policies read as an authorization decision.

#### 15. `F2.public_room_members.185`

| | |
|---|---|
| Control | `public.room_members#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.room_members where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to eject another player from a private room.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to eject another player from a private room.

#### 16. `F2.public_rooms.191`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rooms (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to create a room record directly rather than through the function that enforces the seat bounds.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to create a room record directly rather than through the function that enforces the seat bounds.

#### 17. `F2.public_rooms.192`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rooms set ruleset_id = '00000000-0000-4000-8000-0000000000ff' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to change a private room's visibility or join code, altering who is able to get in.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to change a private room's visibility or join code, altering who is able to get in.

#### 18. `F2.public_rooms.193`

| | |
|---|---|
| Control | `public.rooms#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rooms where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to destroy a private room other players are sitting in.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to destroy a private room other players are sitting in.

#### 19. `F2.public_rulesets.197`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.rulesets (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to publish a ruleset the designers never authored.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to publish a ruleset the designers never authored.

#### 20. `F2.public_rulesets.198`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.rulesets set description = 'attest-probe-description' where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to alter the rules every live session and tournament plays under, and that hands are recorded against.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to alter the rules every live session and tournament plays under, and that hands are recorded against.

#### 21. `F2.public_rulesets.199`

| | |
|---|---|
| Control | `public.rulesets#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.rulesets where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to remove a ruleset that live sessions reference.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to remove a ruleset that live sessions reference.

#### 22. `F2.public_tournament_entries.206`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_entries (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to register themselves — or someone else — into a tournament without going through entry.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to register themselves — or someone else — into a tournament without going through entry.

#### 23. `F2.public_tournament_entries.207`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:UPDATE` |
| Runs as | authenticated:alice |
| Operation | update public.tournament_entries set bracket_seed = 1 where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for UPDATE specifically: `authenticated` holds no UPDATE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). UPDATE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to change a placement or prize marker, which is the authoritative outcome of a shared competition.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to change a placement or prize marker, which is the authoritative outcome of a shared competition.

#### 24. `F2.public_tournament_entries.208`

| | |
|---|---|
| Control | `public.tournament_entries#grant:authenticated:DELETE` |
| Runs as | authenticated:alice |
| Operation | delete from public.tournament_entries where true |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for DELETE specifically: `authenticated` holds no DELETE privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). DELETE is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to remove a rival's entry from a tournament in progress.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to remove a rival's entry from a tournament in progress.

#### 25. `F2.public_tournament_matches.214`

| | |
|---|---|
| Control | `public.tournament_matches#grant:authenticated:INSERT` |
| Runs as | authenticated:alice |
| Operation | insert into public.tournament_matches (default values, or the minimum NOT NULL set) |
| Expected safe result | error 42501 — refused before any policy is consulted |
| Covers | the grant surface for INSERT specifically: `authenticated` holds no INSERT privilege on this resource, so the control is the absence of that grant (and, where present, a write-guard trigger behind it). INSERT is a separate privilege bit from the other two and is therefore a separate probe |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (user_reviewed_ai_draft, approved):**

> A signed-in player writes straight to a table only the server is supposed to write, to insert a match into a bracket the server never scheduled.

**AUTHOR INTENT:** A signed-in player writes straight to a table only the server is supposed to write, to insert a match into a bracket the server never scheduled.
