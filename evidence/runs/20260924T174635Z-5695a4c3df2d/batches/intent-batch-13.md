# AUTHOR INTENT — batch 13 of 13

**B** · 23 rows · run `20260924T174635Z-5695a4c3df2d`

> **AI DRAFT — NOT YET ADOPTED BY AUTHOR.** 23 of the 23 proposed sentences in this file were written by the
> harness, not by the author, and 0 have been adopted. A proposal is a starting point to
> accept, correct or replace — never a sentence the author wrote. `execute-wp3` refuses to run while any
> required sentence is still an AI draft.

One sentence each, in your own words, naming the attack or misuse the probe simulates.
Test IDs are verbatim from the matrix — do not renumber them.

---

#### 1. `B.private_game_commands.323`

| | |
|---|---|
| Control | `private.game_commands#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from private.game_commands where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the accepted-command records written under that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 2. `B.public_blocks.324`

| | |
|---|---|
| Control | `public.blocks#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.blocks |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches who another player has blocked, which Arc21 keeps private because a blocked user is never told.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 3. `B.public_blocks.325`

| | |
|---|---|
| Control | `public.blocks#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.blocks where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the blocks that account had placed, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 4. `B.public_friend_requests.326`

| | |
|---|---|
| Control | `public.friend_requests#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.friend_requests |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches a friend request between two other people.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 5. `B.public_friend_requests.327`

| | |
|---|---|
| Control | `public.friend_requests#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.friend_requests where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the friend requests that account had sent, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 6. `B.public_friendships.328`

| | |
|---|---|
| Control | `public.friendships#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.friendships |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches a friendship between two other accounts, which is private social state.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 7. `B.public_friendships.329`

| | |
|---|---|
| Control | `public.friendships#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.friendships where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the friendships recorded under that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 8. `B.public_game_events.330`

| | |
|---|---|
| Control | `public.game_events#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.game_events |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches the live event stream of a table.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 9. `B.public_game_events.331`

| | |
|---|---|
| Control | `public.game_events#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_events where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the game events addressed to that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 10. `B.public_game_session_seats.332`

| | |
|---|---|
| Control | `public.game_session_seats#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_session_seats where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the table seats, with their stacks and buy-ins, held under that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 11. `B.public_game_sessions.333`

| | |
|---|---|
| Control | `public.game_sessions#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.game_sessions where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the game sessions that account hosted, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 12. `B.public_profiles.334`

| | |
|---|---|
| Control | `public.profiles#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.profiles |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches player profiles, which Arc21 shows only to an identified signed-in viewer and only as each player's privacy and block settings allow.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 13. `B.public_profiles.335`

| | |
|---|---|
| Control | `public.profiles#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.profiles where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read that account's own profile, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 14. `B.public_rate_limit_events.336`

| | |
|---|---|
| Control | `public.rate_limit_events#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.rate_limit_events where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read that account's rate-limit history, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 15. `B.public_room_members.337`

| | |
|---|---|
| Control | `public.room_members#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.room_members where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the room memberships held under that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 16. `B.public_rooms.338`

| | |
|---|---|
| Control | `public.rooms#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.rooms where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the rooms that account hosted, with their join codes, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 17. `B.public_tournament_entries.339`

| | |
|---|---|
| Control | `public.tournament_entries#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.tournament_entries |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches the entries and standings of a tournament.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 18. `B.public_tournament_entries.340`

| | |
|---|---|
| Control | `public.tournament_entries#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.tournament_entries where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read the tournament entries held under that account, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 19. `B.public_wallet_ledger.341`

| | |
|---|---|
| Control | `public.wallet_ledger#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.wallet_ledger |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches another player's chip history — every credit and debit their account has ever seen.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 20. `B.public_wallet_ledger.342`

| | |
|---|---|
| Control | `public.wallet_ledger#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.wallet_ledger where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read that account's chip ledger, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 21. `B.public_wallets.343`

| | |
|---|---|
| Control | `public.wallets#boundary:null-identity` |
| Runs as | authenticated with NO claims set (auth.uid() is null) |
| Operation | select from public.wallets |
| Expected safe result | no data — a policy comparing to a null auth.uid() matches nothing |
| Covers | the brief's null/absent-identity boundary, applicable here because a policy on this resource reads auth.uid() |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A request carrying no identity claims at all slips past a policy that compares against a null caller, and reaches another player's chip balance.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 22. `B.public_wallets.344`

| | |
|---|---|
| Control | `public.wallets#boundary:deleted-user` |
| Runs as | authenticated with claims for a deleted account (fixtures.dave.id, seeded then removed) |
| Operation | select from public.wallets where the owner column names fixtures.dave.id, the deleted account |
| Expected safe result | no data — and no error. A token outliving its account must not become a key to whatever the cascade left behind |
| Covers | the brief's deleted-user boundary, applicable here because this resource records an owner. The seed provisions a fourth account for exactly this |
| Pending author decision | registered contradiction `C5-deleted-user-subject-empty`: after a genuine deletion (Arc21's delete_own_account), every owner column these probes filter on is emptied by the schema's own ON DELETE CASCADE or SET NULL, so no row can name the deleted account: 'no data' is produced by referential actions, not by any control evaluating the stale identity. B.323 and B.336 also contradict 'and no error': authenticated holds no privilege on private.game_commands or rate_limit_events — until decided, this probe runs as approved and records `not_measured` |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A token issued to an account that has since been deleted is replayed to read that account's chip balance, anything the deletion left keyed to it.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*

#### 23. `B.suite.expired-session`

| | |
|---|---|
| Control | `PostgREST / GoTrue JWT verification` |
| Runs as | an expired JWT presented over HTTP |
| Operation | issue an authenticated request to the local PostgREST endpoint with an expired token |
| Expected safe result | HTTP 401 — rejected at the API boundary before any statement reaches PostgreSQL |
| Covers | the brief's expired-session boundary. Counted once for the suite rather than per resource, because an expired JWT never arrives at the database: PostgREST verifies and rejects it first, so there is no per-resource control to exercise and pretending otherwise would claim PostgreSQL enforced something it never saw |

> What attack or misuse is this negative test trying to prevent? Describe it in one sentence.

**PROPOSED (ai_draft — NOT YET ADOPTED BY AUTHOR, unreviewed):**

> A session token whose expiry has already passed is replayed against the API, so whoever holds the stale token keeps acting as that account after the session was meant to end.

**AUTHOR INTENT:** \_\_\_\_\_  *(accept the draft above, or write your own)*
