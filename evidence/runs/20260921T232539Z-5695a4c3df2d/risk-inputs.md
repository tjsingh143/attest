# Risk rubric — factual inputs (WP2 scaffold)

| | |
|---|---|
| Run | `20260921T232539Z-5695a4c3df2d` |
| Schema version | `5695a4c3df2d3f6c6311999ae268f776e96c3beb657e8a8a466be2ebb62aabec` |
| Generated | 2026-09-21T23:25:39.493Z |
| Resources | 40 |

> **There are no scores in this document, and there will not be.** Every line below is
> something the database says. What any of it is *worth* — which dimensions matter, what
> each level scores, how the dimensions combine, where the tier boundaries fall — is the
> rubric, and the rubric is written by hand in `RUBRIC.md`.
>
> The split is the point. A tier that came out of a tool is a tier nobody can defend when
> somebody disagrees with it.

## Which fact answers which dimension

The brief requires the rubric to score at least five dimensions. Four of them have facts
here. One does not, and that is worth saying plainly.

| Dimension | What is supplied below | What is still a judgment |
|---|---|---|
| **What the data is** | every column, its type, whether it is server-generated, and Arc21's own comment on the table and on each column | what kind of thing that makes it, and whether it matters |
| **Blast radius** | which relations hold a foreign key to this one, which it points at, and which columns carry the identity | whether "one user", "all users" or "shared state" is the right reading |
| **Integrity impact** | inbound cascades, refusing triggers, append-only guards | whether corruption here propagates in a way that matters |
| **Reversibility** | append-only guards, truncate guards, which server functions write it | whether damage could actually be undone in practice |
| **Exposure** | a classification of grants and policies together: anonymous, anonymous-latent, authenticated, server-only | what each class is worth relative to the others |

**Exposure is the one that is already mechanical**, and it is worth understanding why it is
a fact rather than an opinion. It is decided by the grant surface and the policy set
together, because either alone gives the wrong answer: `realtime.messages` grants `anon`
INSERT, SELECT and UPDATE, and every policy on it names `authenticated`, so it is granted to
anonymous callers and refused to them. Neither "anonymous" nor "server-only" describes that.
It gets its own class.

## Every resource, side by side

Sorted by exposure, then by how many other relations depend on it — not because that is the
ranking, but because reading them in a consistent order makes the outliers visible.

| Resource | Exposure | Identity column | Cols | Referenced by | Policies | Refusing triggers | Written by definer fns |
|---|---|---|---:|---:|---:|---:|---:|
| `public.rulesets` | anonymous | — | 9 | 6 | 1 | 1 | 1 |
| `public.cosmetics` | anonymous | — | 11 | 5 | 1 | 1 | 7 |
| `public.career_nodes` | anonymous | — | 17 | 3 | 1 | 1 | 3 |
| `public.tournaments` | anonymous | — | 22 | 3 | 1 | 1 | 3 |
| `realtime.messages` | anonymous (latent) | — | 9 | 0 | 3 | 0 | 0 |
| `public.profiles` | authenticated | `id` | 13 | 24 | 3 | 3 | 22 |
| `public.game_sessions` | authenticated | — | 19 | 11 | 1 | 2 | 6 |
| `public.wallet_ledger` | authenticated | — | 12 | 4 | 1 | 3 | 3 |
| `public.tournament_entries` | authenticated | — | 16 | 3 | 1 | 1 | 7 |
| `public.hand_records` | authenticated | — | 11 | 2 | 1 | 1 | 0 |
| `public.rooms` | authenticated | `host_user_id` | 12 | 2 | 1 | 1 | 13 |
| `public.career_attempts` | authenticated | — | 18 | 1 | 1 | 1 | 0 |
| `public.game_session_seats` | authenticated | — | 12 | 1 | 1 | 1 | 9 |
| `public.hand_players` | authenticated | — | 22 | 1 | 1 | 1 | 0 |
| `public.wallets` | authenticated | — | 8 | 1 | 1 | 2 | 3 |
| `public.blocks` | authenticated | — | 4 | 0 | 3 | 0 | 5 |
| `public.career_progress` | authenticated | — | 12 | 0 | 1 | 1 | 5 |
| `public.daily_challenges_public` | authenticated | — | 13 | 0 | 0 | 0 | 1 |
| `public.daily_entries` | authenticated | — | 14 | 0 | 1 | 1 | 5 |
| `public.friend_requests` | authenticated | — | 6 | 0 | 3 | 1 | 7 |
| `public.friendships` | authenticated | — | 4 | 0 | 2 | 0 | 6 |
| `public.game_events` | authenticated | — | 10 | 0 | 1 | 1 | 0 |
| `public.loadouts` | authenticated | — | 7 | 0 | 3 | 1 | 5 |
| `public.matchmaking_queue` | authenticated | `user_id` | 8 | 0 | 1 | 1 | 6 |
| `public.notifications` | authenticated | — | 12 | 0 | 3 | 1 | 9 |
| `public.player_actions` | authenticated | — | 16 | 0 | 1 | 1 | 0 |
| `public.player_daily_xp` | authenticated | `user_id` | 6 | 0 | 1 | 1 | 3 |
| `public.player_decision_periods` | authenticated | `user_id` | 6 | 0 | 1 | 1 | 3 |
| `public.player_mode_stats` | authenticated | — | 21 | 0 | 1 | 1 | 0 |
| `public.player_stats` | authenticated | — | 22 | 0 | 1 | 1 | 4 |
| `public.push_tokens` | authenticated | — | 9 | 0 | 4 | 0 | 5 |
| `public.room_members` | authenticated | `user_id` | 8 | 0 | 1 | 1 | 14 |
| `public.tournament_matches` | authenticated | — | 12 | 0 | 1 | 1 | 0 |
| `public.user_cosmetics` | authenticated | — | 6 | 0 | 1 | 1 | 3 |
| `public.daily_challenges` | server-only | — | 15 | 2 | 1 | 2 | 7 |
| `private.career_drill_seeds` | server-only | — | 5 | 0 | 0 | 0 | 0 |
| `private.game_commands` | server-only | — | 8 | 0 | 0 | 0 | 0 |
| `private.game_state_private` | server-only | — | 4 | 0 | 0 | 0 | 0 |
| `public.rate_limit_events` | server-only | `user_id` | 4 | 0 | 0 | 1 | 2 |
| `public.rate_limit_policies` | server-only | — | 5 | 0 | 0 | 1 | 2 |

Counts by exposure: **4** anonymous, **1** anonymous (latent), **29** authenticated, **6** server-only.

## Resource dossiers

One per resource, in the same order. Everything needed to score a row is in its own section,
so scoring does not require holding six tables in your head at once.

### `public.rulesets`

> **Arc21 says:** Persisted BlackjackRules values. Public read-only catalogue; written only by migrations and server code.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **anonymous** — anon holds SELECT and a policy names anon or PUBLIC |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 6 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `rulesets_select_active` | SELECT | PERMISSIVE | `anon`, `authenticated` | yes | no |

**Columns** (9)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `key` | text | yes | no | — |
| `version` | integer | yes | no | — |
| `ruleset_key` | text | no | yes | — |
| `label` | text | yes | no | — |
| `description` | text | no | no | — |
| `rules` | jsonb | yes | no | — |
| `is_active` | boolean | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

Column comments:

- `rules` — Verbatim BlackjackRules object from shared/blackjack/rules.ts.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.career_nodes` | `ruleset_id` | NO ACTION |
| `public.daily_challenges` | `ruleset_id` | NO ACTION |
| `public.game_sessions` | `ruleset_id` | NO ACTION |
| `public.hand_records` | `ruleset_id` | NO ACTION |
| `public.rooms` | `ruleset_id` | NO ACTION |
| `public.tournaments` | `ruleset_id` | NO ACTION |

**Guards.** refusing triggers: `rulesets_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 1 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.ensure_daily_challenge_for(p_date date)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.cosmetics`

> **Arc21 says:** Public cosmetic catalogue. No price column and no randomised unlock type exists by design.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **anonymous** — anon holds SELECT and a policy names anon or PUBLIC |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 5 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `cosmetics_select_active` | SELECT | PERMISSIVE | `anon`, `authenticated` | yes | no |

**Columns** (11)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `code` | text | yes | no | — |
| `kind` | cosmetic_kind | yes | no | — |
| `name` | text | yes | no | — |
| `description` | text | no | no | — |
| `asset_key` | text | yes | no | — |
| `unlock_type` | cosmetic_unlock_type | yes | no | — |
| `unlock_config` | jsonb | yes | no | — |
| `sort_order` | integer | yes | no | — |
| `is_active` | boolean | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.career_nodes` | `reward_cosmetic_id` | SET NULL |
| `public.loadouts` | `avatar_cosmetic_id` | SET NULL |
| `public.loadouts` | `card_back_cosmetic_id` | SET NULL |
| `public.loadouts` | `table_theme_cosmetic_id` | SET NULL |
| `public.user_cosmetics` | `cosmetic_id` | CASCADE |

**Guards.** refusing triggers: `cosmetics_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 7 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.avatar_asset_for(p_user_id uuid)`
- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.equip_cosmetic(p_cosmetic_id uuid)`
- `public.grant_earned_cosmetics_for(p_user_id uuid)`
- `public.guard_loadout_slots()`
- `public.my_inventory()`
- `public.my_loadout()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.career_nodes`

> **Arc21 says:** Public catalogue of career objectives. Written by seed data and migrations only.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **anonymous** — anon holds SELECT and a policy names anon or PUBLIC |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 3 relation(s), 2 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `career_nodes_select_active` | SELECT | PERMISSIVE | `anon`, `authenticated` | yes | no |

**Columns** (17)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `code` | text | yes | no | — |
| `chapter` | career_chapter | yes | no | — |
| `chapter_order` | integer | yes | no | — |
| `node_order` | integer | yes | no | — |
| `title` | text | yes | no | — |
| `summary` | text | yes | no | — |
| `objective` | jsonb | yes | no | — |
| `ruleset_id` | uuid | yes | no | — |
| `tier` | table_tier | yes | no | — |
| `starting_chips` | bigint | yes | no | — |
| `reward_chips` | bigint | yes | no | — |
| `reward_xp` | integer | yes | no | — |
| `reward_cosmetic_id` | uuid | no | no | — |
| `requires_node_id` | uuid | no | no | — |
| `is_active` | boolean | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.career_attempts` | `career_node_id` | CASCADE |
| `public.career_nodes` | `requires_node_id` | SET NULL |
| `public.career_progress` | `career_node_id` | CASCADE |

**Depends on:** `public.career_nodes`, `public.cosmetics`, `public.rulesets`.

**Guards.** refusing triggers: `career_nodes_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.my_career_progress()`
- `public.my_inventory()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.tournaments`

> **Arc21 says:** Public tournament catalogue. Server-written.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **anonymous** — anon holds SELECT and a policy names anon or PUBLIC |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 3 relation(s), 2 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `tournaments_select_all` | SELECT | PERMISSIVE | `anon`, `authenticated` | yes | no |

**Columns** (22)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `code` | text | yes | no | — |
| `name` | text | yes | no | — |
| `description` | text | no | no | — |
| `format` | tournament_format | yes | no | — |
| `status` | tournament_status | yes | no | — |
| `ruleset_id` | uuid | yes | no | — |
| `tier` | table_tier | yes | no | — |
| `entry_fee_chips` | bigint | yes | no | — |
| `starting_chips` | bigint | yes | no | — |
| `min_entries` | integer | yes | no | — |
| `max_entries` | integer | yes | no | — |
| `prize_structure` | jsonb | yes | no | — |
| `registration_opens_at` | timestamp with time zone | yes | no | — |
| `starts_at` | timestamp with time zone | yes | no | — |
| `ends_at` | timestamp with time zone | no | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |
| `initial_button` | integer | no | no | — |
| `tie_break_hands_used` | integer | yes | no | — |
| `tie_break_boundary` | integer | no | no | — |
| `scheduled_hands_played` | integer | yes | no | — |

Column comments:

- `tie_break_boundary` — Scheduled hand whose boundary a sudden-death hand is resolving, else NULL. A tie-break hand carries the boundary hand's bet ceiling, not the next one's.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.game_sessions` | `tournament_id` | SET NULL |
| `public.tournament_entries` | `tournament_id` | CASCADE |
| `public.tournament_matches` | `tournament_id` | CASCADE |

**Depends on:** `public.rulesets`.

**Guards.** refusing triggers: `tournaments_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.leaderboard_tournament_wins(p_limit integer, p_offset integer)`
- `public.my_sprint_entry()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `realtime.messages`

> **Arc21 says:** *(no table comment)*

| | |
|---|---|
| Kind | partitioned_table, owned by `supabase_realtime_admin` |
| Exposure | **anonymous (latent)** — anon holds INSERT, SELECT, UPDATE, but no policy admits anon — refused today by row security alone |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (3 across INSERT, SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `arc21_game_topic_is_for_its_seated_players` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `arc21_only_presence_may_be_written_by_a_client` | INSERT | PERMISSIVE | `authenticated` | no | yes |
| `arc21_presence_roster_needs_an_account` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (9)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `topic` | text | yes | no | — |
| `extension` | text | yes | no | — |
| `payload` | jsonb | no | no | — |
| `event` | text | no | no | — |
| `private` | boolean | no | no | — |
| `updated_at` | timestamp without time zone | yes | no | — |
| `inserted_at` | timestamp without time zone | yes | no | — |
| `id` | uuid | yes | no | — |
| `binary_payload` | bytea | no | no | — |

### `public.profiles`

> **Arc21 says:** Public-facing player identity. level and xp are server-owned and are not client-writable.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `id` → `auth.users` |
| Depended on by | 24 relation(s), 20 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (3 across SELECT, UPDATE)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `profiles_select_self` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `profiles_select_visible` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `profiles_update_self` | UPDATE | PERMISSIVE | `authenticated` | yes | yes |

**Columns** (13)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `username` | text | yes | no | authenticated: UPDATE |
| `display_name` | text | yes | no | authenticated: UPDATE |
| `bio` | text | no | no | authenticated: UPDATE |
| `avatar_url` | text | no | no | authenticated: UPDATE |
| `country_code` | text | no | no | authenticated: UPDATE |
| `privacy` | profile_privacy | yes | no | authenticated: UPDATE |
| `level` | integer | yes | no | — |
| `xp` | bigint | yes | no | — |
| `username_changed_at` | timestamp with time zone | no | no | — |
| `last_seen_at` | timestamp with time zone | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

Column comments:

- `level` — Server-owned. Protected by column-level GRANT and by guard_profile_server_columns().
- `xp` — Server-owned. Protected by column-level GRANT and by guard_profile_server_columns().
- `username_changed_at` — When this handle last moved. Stamped by guard_profile_username() and absent from the client UPDATE grant. It records the change; the LIMIT on how often one may happen lives in rate_limit_policies like every other limit.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `private.game_commands` | `user_id` | CASCADE |
| `public.blocks` | `blocked_id` | CASCADE |
| `public.blocks` | `blocker_id` | CASCADE |
| `public.career_attempts` | `user_id` | CASCADE |
| `public.career_progress` | `user_id` | CASCADE |
| `public.daily_entries` | `user_id` | CASCADE |
| `public.friend_requests` | `receiver_id` | CASCADE |
| `public.friend_requests` | `sender_id` | CASCADE |
| `public.friendships` | `user_id_a` | CASCADE |
| `public.friendships` | `user_id_b` | CASCADE |
| `public.game_events` | `recipient_user_id` | CASCADE |
| `public.game_session_seats` | `user_id` | SET NULL |
| `public.game_sessions` | `host_user_id` | SET NULL |
| `public.hand_players` | `user_id` | SET NULL |
| `public.loadouts` | `user_id` | CASCADE |
| `public.notifications` | `user_id` | CASCADE |
| `public.player_actions` | `user_id` | SET NULL |
| `public.player_mode_stats` | `user_id` | CASCADE |
| `public.player_stats` | `user_id` | CASCADE |
| `public.push_tokens` | `user_id` | CASCADE |
| `public.tournament_entries` | `user_id` | CASCADE |
| `public.user_cosmetics` | `user_id` | CASCADE |
| `public.wallet_ledger` | `user_id` | CASCADE |
| `public.wallets` | `user_id` | CASCADE |

**Depends on:** `auth.users`.

**Guards.** refusing triggers: `profiles_guard_server_columns`, `profiles_guard_username`, `profiles_normalise_display_name`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 22 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.accept_friend_request(p_from uuid)`
- `public.assert_client_authorization_surface()`
- `public.award_milestone_xp(p_user_id uuid, p_xp integer)`
- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.get_room_state(p_room_id uuid)`
- `public.handle_new_user()`
- `public.invite_friend_to_room(p_room_id uuid, p_friend uuid)`
- `public.join_matchmaking(p_tier table_tier)`
- `public.leaderboard_daily_challenge(p_date date, p_limit integer, p_offset integer)`
- `public.leaderboard_strategy_accuracy(p_limit integer, p_offset integer)`
- `public.leaderboard_tournament_wins(p_limit integer, p_offset integer)`
- `public.leaderboard_weekly_xp(p_limit integer, p_offset integer)`
- *…and 10 more; the full list is in `risk-inputs.json`.*

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.game_sessions`

> **Arc21 says:** One table/room. Public, sanitised metadata only; the authoritative engine state lives in private.game_state_private.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 11 relation(s), 7 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `game_sessions_select_participant` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (19)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `mode` | game_mode | yes | no | — |
| `ruleset_id` | uuid | yes | no | — |
| `tier` | table_tier | no | no | — |
| `host_user_id` | uuid | no | no | — |
| `room_code` | text | no | no | — |
| `status` | game_session_status | yes | no | — |
| `max_seats` | integer | yes | no | — |
| `version` | bigint | yes | no | — |
| `hand_number` | integer | yes | no | — |
| `shuffle_number` | integer | yes | no | — |
| `deadline_at` | timestamp with time zone | no | no | — |
| `escrow_chips` | bigint | yes | no | — |
| `tournament_id` | uuid | no | no | — |
| `daily_challenge_id` | uuid | no | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `started_at` | timestamp with time zone | no | no | — |
| `ended_at` | timestamp with time zone | no | no | — |
| `assistance` | assistance_mode | yes | no | — |

Column comments:

- `escrow_chips` — Chips held in seat stacks. A session row may not be deleted while this is non-zero.
- `assistance` — How much help the table shows. Chosen once at OPEN and never revisable by a client, because it decides whether the session's decisions count towards the strategy leaderboard. Only Quick Play offers a choice; everything else is play.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `private.game_commands` | `game_session_id` | CASCADE |
| `private.game_state_private` | `game_session_id` | CASCADE |
| `public.career_attempts` | `game_session_id` | SET NULL |
| `public.daily_entries` | `game_session_id` | SET NULL |
| `public.game_events` | `game_session_id` | CASCADE |
| `public.game_session_seats` | `game_session_id` | CASCADE |
| `public.hand_players` | `game_session_id` | CASCADE |
| `public.hand_records` | `game_session_id` | CASCADE |
| `public.player_actions` | `game_session_id` | CASCADE |
| `public.rooms` | `game_session_id` | NO ACTION |
| `public.tournament_matches` | `game_session_id` | SET NULL |

**Depends on:** `public.daily_challenges`, `public.profiles`, `public.rulesets`, `public.tournaments`.

**Guards.** refusing triggers: `game_sessions_deny_client_write`, `game_sessions_guard_escrow`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 6 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.delete_own_account()`
- `public.expire_stale_rooms()`
- `public.join_matchmaking(p_tier table_tier)`
- `public.my_active_session()`
- `public.my_sprint_entry()`
- `public.poll_matchmaking()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.wallet_ledger`

> **Arc21 says:** Append-only chip ledger. Every row carries a unique idempotency key; UPDATE is rejected for all roles.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 4 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `wallet_ledger_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `wallet_id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `delta` | bigint | yes | no | — |
| `balance_after` | bigint | yes | no | — |
| `reason` | ledger_reason | yes | no | — |
| `reference_type` | text | no | no | — |
| `reference_id` | uuid | no | no | — |
| `idempotency_key` | text | yes | no | — |
| `metadata` | jsonb | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `seq` | bigint | yes | yes | — |

Column comments:

- `created_at` — Transaction START time. Correct for "roughly when", wrong for ordering — see seq.
- `seq` — Monotonic apply order. Assigned at INSERT, under the wallet lock, so it reflects the order entries were actually applied. Order the ledger by this and never by created_at, which is transaction-start time and inverts under concurrency. Gaps are normal (a rolled-back command consumes a value).

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.career_progress` | `reward_ledger_id` | SET NULL |
| `public.daily_entries` | `reward_ledger_id` | SET NULL |
| `public.tournament_entries` | `entry_ledger_id` | SET NULL |
| `public.tournament_entries` | `prize_ledger_id` | SET NULL |

**Depends on:** `public.profiles`, `public.wallets`.

**Guards.** refusing triggers: `wallet_ledger_append_only`, `wallet_ledger_deny_client_write`, `wallet_ledger_deny_truncate`; append-only / truncate guards: `wallet_ledger_append_only`, `wallet_ledger_deny_truncate`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.apply_wallet_delta(p_user_id uuid, p_delta bigint, p_reason ledger_reason, p_idempotency_key text, p_reference_type text, p_reference_id uuid, p_metadata jsonb)`
- `public.claim_recovery_grant()`
- `public.handle_new_user()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.tournament_entries`

> **Arc21 says:** Registrations and standings. Publicly readable; created only by the server so the entry fee and the entry commit together.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 3 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `tournament_entries_select_visible` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (16)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `tournament_id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `status` | tournament_entry_status | yes | no | — |
| `bracket_seed` | integer | no | no | — |
| `chips` | bigint | yes | no | — |
| `score` | bigint | yes | no | — |
| `placement` | integer | no | no | — |
| `entry_ledger_id` | uuid | no | no | — |
| `prize_ledger_id` | uuid | no | no | — |
| `registered_at` | timestamp with time zone | yes | no | — |
| `eliminated_at` | timestamp with time zone | no | no | — |
| `eliminated_after_hand` | integer | no | no | — |
| `in_tie_break` | boolean | yes | no | — |
| `prize_chips` | bigint | yes | no | — |
| `prize_xp` | integer | yes | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.tournament_matches` | `entry_a_id` | SET NULL |
| `public.tournament_matches` | `entry_b_id` | SET NULL |
| `public.tournament_matches` | `winner_entry_id` | SET NULL |

**Depends on:** `public.wallet_ledger`, `public.wallet_ledger`, `public.tournaments`, `public.profiles`.

**Guards.** refusing triggers: `tournament_entries_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 7 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.leaderboard_tournament_wins(p_limit integer, p_offset integer)`
- `public.my_competition_record()`
- `public.my_sprint_entry()`
- `public.player_public_profile(p_user_id uuid)`
- `public.sprint_standings(p_tournament_id uuid)`
- `public.viewer_is_in_tournament(p_tournament_id uuid)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.hand_records`

> **Arc21 says:** Completed-hand archive. Dealer cards may only be stored once completed_at is set, so the hole card cannot leak through history.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 2 relation(s), 2 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `hand_records_select_participant` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (11)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `ruleset_id` | uuid | yes | no | — |
| `hand_number` | integer | yes | no | — |
| `shuffle_number` | integer | yes | no | — |
| `dealer_cards` | jsonb | yes | no | — |
| `dealer_total` | integer | no | no | — |
| `dealer_is_natural` | boolean | yes | no | — |
| `dealer_busted` | boolean | yes | no | — |
| `started_at` | timestamp with time zone | yes | no | — |
| `completed_at` | timestamp with time zone | no | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.hand_players` | `hand_record_id` | CASCADE |
| `public.player_actions` | `hand_record_id` | CASCADE |

**Depends on:** `public.game_sessions`, `public.rulesets`.

**Guards.** refusing triggers: `hand_records_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.rooms`

> **Arc21 says:** Private tables. No wallet movement is possible from here — seats use a fixed session stack, which is the anti-collusion rule, not a shortcut.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `host_user_id` → `auth.users` |
| Depended on by | 2 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `rooms_select_member` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `code` | text | yes | no | — |
| `host_user_id` | uuid | yes | no | — |
| `visibility` | text | yes | no | — |
| `mode` | text | yes | no | — |
| `ruleset_id` | uuid | no | no | — |
| `max_seats` | integer | yes | no | — |
| `status` | room_status | yes | no | — |
| `game_session_id` | uuid | no | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `expires_at` | timestamp with time zone | yes | no | — |
| `tier` | table_tier | no | no | — |

Column comments:

- `tier` — Stakes for a public table. NULL for private tables, whose chips are the table's own and never come from a wallet.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.matchmaking_queue` | `room_id` | SET NULL |
| `public.room_members` | `room_id` | CASCADE |

**Depends on:** `public.game_sessions`, `auth.users`, `public.rulesets`.

**Guards.** refusing triggers: `rooms_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 13 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.create_private_room(p_max_seats integer)`
- `public.delete_own_account()`
- `public.expire_stale_queue_entries()`
- `public.expire_stale_rooms()`
- `public.get_room_state(p_room_id uuid)`
- `public.invite_friend_to_room(p_room_id uuid, p_friend uuid)`
- `public.join_matchmaking(p_tier table_tier)`
- `public.join_private_room(p_code text)`
- `public.leave_matchmaking()`
- `public.poll_matchmaking()`
- `public.release_room_seat(p_room_id uuid, p_user_id uuid)`
- `public.remove_room_member(p_room_id uuid, p_user_id uuid)`
- *…and 1 more; the full list is in `risk-inputs.json`.*

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.career_attempts`

> **Arc21 says:** One reward-bearing attempt at one career node. Every counter is written by the server from its own authoritative state; the client reports nothing. career_progress is the aggregate computed from these.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 1 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `career_attempts_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (18)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `career_node_id` | uuid | yes | no | — |
| `game_session_id` | uuid | no | no | — |
| `format` | text | yes | no | — |
| `status` | text | yes | no | — |
| `hands_played` | integer | yes | no | — |
| `decisions_total` | integer | yes | no | — |
| `decisions_optimal` | integer | yes | no | — |
| `unaided_total` | integer | yes | no | — |
| `unaided_optimal` | integer | yes | no | — |
| `ev_lost_micros` | bigint | yes | no | — |
| `starting_chips` | bigint | yes | no | — |
| `final_chips` | bigint | yes | no | — |
| `stars` | integer | yes | no | — |
| `started_at` | timestamp with time zone | yes | no | — |
| `completed_at` | timestamp with time zone | no | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `private.career_drill_seeds` | `attempt_id` | CASCADE |

**Depends on:** `public.career_nodes`, `public.game_sessions`, `public.profiles`.

**Guards.** refusing triggers: `career_attempts_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.game_session_seats`

> **Arc21 says:** Seat occupancy and table stack. Membership source for every game-scoped RLS policy.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 1 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `game_session_seats_select_participant` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `seat_index` | integer | yes | no | — |
| `user_id` | uuid | no | no | — |
| `display_name` | text | yes | no | — |
| `stack` | bigint | yes | no | — |
| `buy_in` | bigint | yes | no | — |
| `status` | seat_status | yes | no | — |
| `connected` | boolean | yes | no | — |
| `disconnected_at` | timestamp with time zone | no | no | — |
| `joined_at` | timestamp with time zone | yes | no | — |
| `left_at` | timestamp with time zone | no | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.hand_players` | `seat_id` | SET NULL |

**Depends on:** `public.game_sessions`, `public.profiles`.

**Guards.** refusing triggers: `game_session_seats_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 9 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.delete_own_account()`
- `public.expire_stale_queue_entries()`
- `public.expire_stale_rooms()`
- `public.is_session_participant(p_game_session_id uuid)`
- `public.join_matchmaking(p_tier table_tier)`
- `public.join_private_room(p_code text)`
- `public.leave_matchmaking()`
- `public.my_active_session()`
- `public.my_sprint_entry()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.hand_players`

> **Arc21 says:** One settled player hand. net = credit - wager is a database constraint.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 1 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `hand_players_select_participant` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (22)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `hand_record_id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `seat_id` | uuid | no | no | — |
| `user_id` | uuid | no | no | — |
| `engine_hand_id` | text | yes | no | — |
| `hand_index` | integer | yes | no | — |
| `cards` | jsonb | yes | no | — |
| `wager` | bigint | yes | no | — |
| `insurance_bet` | bigint | yes | no | — |
| `insurance_decision` | insurance_decision | yes | no | — |
| `insurance_credit` | bigint | yes | no | — |
| `status` | player_hand_status | yes | no | — |
| `outcome` | hand_outcome_kind | no | no | — |
| `credit` | bigint | yes | no | — |
| `net` | bigint | yes | no | — |
| `best_total` | integer | no | no | — |
| `is_soft` | boolean | yes | no | — |
| `is_natural` | boolean | yes | no | — |
| `came_from_split` | boolean | yes | no | — |
| `came_from_split_aces` | boolean | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.player_actions` | `hand_player_id` | CASCADE |

**Depends on:** `public.game_sessions`, `public.hand_records`, `public.game_session_seats`, `public.profiles`.

**Guards.** refusing triggers: `hand_players_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.wallets`

> **Arc21 says:** Global virtual-chip balance. Server-authoritative: readable by its owner, writable by no client role.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 1 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `wallets_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (8)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `balance` | bigint | yes | no | — |
| `lifetime_credited` | bigint | yes | no | — |
| `lifetime_debited` | bigint | yes | no | — |
| `version` | bigint | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

Column comments:

- `balance` — Integer chips. balance >= 0 is enforced by the wallets_balance_non_negative CHECK constraint.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.wallet_ledger` | `wallet_id` | CASCADE |

**Depends on:** `public.profiles`.

**Guards.** refusing triggers: `wallets_deny_client_write`, `wallets_deny_truncate`; append-only / truncate guards: `wallets_deny_truncate`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.apply_wallet_delta(p_user_id uuid, p_delta bigint, p_reason ledger_reason, p_idempotency_key text, p_reference_type text, p_reference_id uuid, p_metadata jsonb)`
- `public.claim_recovery_grant()`
- `public.handle_new_user()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.blocks`

> **Arc21 says:** Directed block. Readable only by the blocker: a blocked user is never told.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds DELETE, INSERT, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (3 across DELETE, INSERT, SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `blocks_delete_own` | DELETE | PERMISSIVE | `authenticated` | yes | no |
| `blocks_insert_own` | INSERT | PERMISSIVE | `authenticated` | no | yes |
| `blocks_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (4)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `blocker_id` | uuid | yes | no | — |
| `blocked_id` | uuid | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.profiles`, `public.profiles`.

**Named by 5 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.block_player(p_other uuid)`
- `public.has_blocked(p_blocker uuid, p_blocked uuid)`
- `public.is_blocked_between(p_a uuid, p_b uuid)`
- `public.list_blocked()`
- `public.unblock_player(p_other uuid)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.career_progress`

> **Arc21 says:** Per-user career progress. Readable by its owner; every write, including reward payment, is server-controlled.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `career_progress_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `career_node_id` | uuid | yes | no | — |
| `status` | career_status | yes | no | — |
| `stars` | integer | yes | no | — |
| `best_score` | bigint | yes | no | — |
| `attempts` | integer | yes | no | — |
| `first_completed_at` | timestamp with time zone | no | no | — |
| `reward_claimed_at` | timestamp with time zone | no | no | — |
| `reward_ledger_id` | uuid | no | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.career_nodes`, `public.wallet_ledger`, `public.profiles`.

**Guards.** refusing triggers: `career_progress_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 5 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.cosmetic_is_earned(p_user_id uuid, p_cosmetic_id uuid)`
- `public.my_career_progress()`
- `public.player_public_profile(p_user_id uuid)`
- `public.record_career_attempt_started(p_user_id uuid, p_node_id uuid)`
- `public.record_career_completion(p_user_id uuid, p_node_id uuid, p_stars integer, p_score bigint, p_at timestamp with time zone)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.daily_challenges_public`

> **Arc21 says:** Client-facing projection of daily_challenges with seed_secret absent. security_invoker, so the row policy still applies.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | view, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, with row-level security OFF |
| Row-level security | enabled: no, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none.

**Columns** (13)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | no | no | — |
| `challenge_date` | date | no | no | — |
| `ruleset_id` | uuid | no | no | — |
| `seed_commitment` | text | no | no | — |
| `revealed_seed` | text | no | no | — |
| `seed_revealed_at` | timestamp with time zone | no | no | — |
| `hand_count` | integer | no | no | — |
| `starting_chips` | bigint | no | no | — |
| `tier` | table_tier | no | no | — |
| `reward_chips` | bigint | no | no | — |
| `reward_xp` | integer | no | no | — |
| `opens_at` | timestamp with time zone | no | no | — |
| `closes_at` | timestamp with time zone | no | no | — |

**Named by 1 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.ensure_todays_daily_challenge()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.daily_entries`

> **Arc21 says:** One attempt per user per challenge. Readable only by its owner; leaderboards are published as server-produced, public-safe output.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `daily_entries_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (14)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `daily_challenge_id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `game_session_id` | uuid | no | no | — |
| `status` | daily_entry_status | yes | no | — |
| `hands_played` | integer | yes | no | — |
| `final_chips` | bigint | yes | no | — |
| `score` | bigint | yes | no | — |
| `reward_ledger_id` | uuid | no | no | — |
| `started_at` | timestamp with time zone | yes | no | — |
| `completed_at` | timestamp with time zone | no | no | — |
| `decisions_total` | integer | yes | no | — |
| `decisions_optimal` | integer | yes | no | — |
| `ev_lost_micros` | bigint | yes | no | — |

Column comments:

- `decisions_total` — Server-graded decisions in THIS attempt. Distinct from the week bucket in player_decision_periods, which mixes in every other ranked mode.
- `decisions_optimal` — How many of them matched the generated strategy chart.
- `ev_lost_micros` — Total expected value given up, in millionths of one unit wagered, measured against the best LEGAL action at each decision. An integer because no floating-point column exists in this schema.

**Depends on:** `public.daily_challenges`, `public.game_sessions`, `public.wallet_ledger`, `public.profiles`.

**Guards.** refusing triggers: `daily_entries_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 5 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.daily_challenge_streak(p_user_id uuid)`
- `public.leaderboard_daily_challenge(p_date date, p_limit integer, p_offset integer)`
- `public.my_competition_record()`
- `public.my_daily_entry()`
- `public.record_daily_attempt_decisions(p_game_session_id uuid, p_total integer, p_optimal integer, p_ev_lost_micros bigint)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.friend_requests`

> **Arc21 says:** Readable only by the sender and the receiver.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds INSERT, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (3 across INSERT, SELECT, UPDATE)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `friend_requests_insert_as_sender` | INSERT | PERMISSIVE | `authenticated` | no | yes |
| `friend_requests_select_participants` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `friend_requests_update_participants` | UPDATE | PERMISSIVE | `authenticated` | yes | yes |

**Columns** (6)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `sender_id` | uuid | yes | no | — |
| `receiver_id` | uuid | yes | no | — |
| `status` | friend_request_status | yes | no | authenticated: UPDATE |
| `created_at` | timestamp with time zone | yes | no | — |
| `responded_at` | timestamp with time zone | no | no | — |

**Depends on:** `public.profiles`, `public.profiles`.

**Guards.** refusing triggers: `friend_requests_guard_transition`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 7 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.accept_friend_request(p_from uuid)`
- `public.apply_block_side_effects()`
- `public.decline_friend_request(p_from uuid)`
- `public.list_friend_requests()`
- `public.remove_friend(p_other uuid)`
- `public.search_players(p_query text)`
- `public.send_friend_request(p_to uuid)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.friendships`

> **Arc21 says:** Undirected friend edge, stored once with user_id_a < user_id_b. Created only by server code.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds DELETE, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (2 across DELETE, SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `friendships_delete_own` | DELETE | PERMISSIVE | `authenticated` | yes | no |
| `friendships_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (4)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id_a` | uuid | yes | no | — |
| `user_id_b` | uuid | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.profiles`, `public.profiles`.

**Named by 6 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.accept_friend_request(p_from uuid)`
- `public.apply_block_side_effects()`
- `public.are_friends(p_a uuid, p_b uuid)`
- `public.create_friendship_on_accept()`
- `public.list_friends()`
- `public.remove_friend(p_other uuid)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.game_events`

> **Arc21 says:** Append-only, sanitised event stream. Participants read public rows; a seat-scoped row is readable only by its recipient.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `game_events_select_participant` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (10)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `seq` | bigint | yes | no | — |
| `type` | text | yes | no | — |
| `payload` | jsonb | yes | no | — |
| `visibility` | event_visibility | yes | no | — |
| `recipient_user_id` | uuid | no | no | — |
| `state_version` | bigint | yes | no | — |
| `hand_number` | integer | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

Column comments:

- `payload` — Sanitised output of toPublicState only. Never a raw BlackjackGameState.

**Depends on:** `public.game_sessions`, `public.profiles`.

**Guards.** refusing triggers: `game_events_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.loadouts`

> **Arc21 says:** Equipped cosmetics. Client-writable, but every slot is validated against ownership and kind by trigger.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds INSERT, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (3 across INSERT, SELECT, UPDATE)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `loadouts_insert_own` | INSERT | PERMISSIVE | `authenticated` | no | yes |
| `loadouts_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `loadouts_update_own` | UPDATE | PERMISSIVE | `authenticated` | yes | yes |

**Columns** (7)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `avatar_cosmetic_id` | uuid | no | no | authenticated: UPDATE |
| `card_back_cosmetic_id` | uuid | no | no | authenticated: UPDATE |
| `table_theme_cosmetic_id` | uuid | no | no | authenticated: UPDATE |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.cosmetics`, `public.cosmetics`, `public.cosmetics`, `public.profiles`.

**Guards.** refusing triggers: `loadouts_guard_slots`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 5 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.avatar_asset_for(p_user_id uuid)`
- `public.equip_cosmetic(p_cosmetic_id uuid)`
- `public.grant_earned_cosmetics_for(p_user_id uuid)`
- `public.my_inventory()`
- `public.my_loadout()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.matchmaking_queue`

> **Arc21 says:** Players waiting for a public seat. Allocates seats only — chips move through apply_wallet_delta in the session function, never from here.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `user_id` → `auth.users` |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `matchmaking_queue_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (8)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `tier` | table_tier | yes | no | — |
| `status` | queue_status | yes | no | — |
| `room_id` | uuid | no | no | — |
| `enqueued_at` | timestamp with time zone | yes | no | — |
| `matched_at` | timestamp with time zone | no | no | — |
| `expires_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.rooms`, `auth.users`.

**Guards.** refusing triggers: `matchmaking_queue_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 6 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.delete_own_account()`
- `public.expire_stale_queue_entries()`
- `public.join_matchmaking(p_tier table_tier)`
- `public.leave_matchmaking()`
- `public.poll_matchmaking()`
- `public.release_room_seat(p_room_id uuid, p_user_id uuid)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.notifications`

> **Arc21 says:** Server-written user notifications. Clients may only mark them read.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds DELETE, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (3 across DELETE, SELECT, UPDATE)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `notifications_delete_own` | DELETE | PERMISSIVE | `authenticated` | yes | no |
| `notifications_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `notifications_update_own` | UPDATE | PERMISSIVE | `authenticated` | yes | yes |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `kind` | notification_kind | yes | no | — |
| `title` | text | yes | no | — |
| `body` | text | yes | no | — |
| `data` | jsonb | yes | no | — |
| `read_at` | timestamp with time zone | no | no | authenticated: UPDATE |
| `sent_at` | timestamp with time zone | no | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `delivery` | notification_delivery | yes | no | — |
| `delivery_detail` | text | no | no | — |
| `dedupe_key` | text | no | no | — |

Column comments:

- `data` — Deep-link parameters only. Must never carry a daily-challenge seed, shoe order or hole card.
- `dedupe_key` — Collapses repeats for one user. Null means every write is its own notification.

**Depends on:** `public.profiles`.

**Guards.** refusing triggers: `notifications_guard_client_update`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 9 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.accept_friend_request(p_from uuid)`
- `public.delete_own_account()`
- `public.mark_notifications_read(p_ids uuid[])`
- `public.my_notifications(p_limit integer)`
- `public.notify_user(p_user_id uuid, p_kind notification_kind, p_title text, p_body text, p_data jsonb, p_dedupe_key text)`
- `public.pending_push_deliveries(p_limit integer)`
- `public.pending_without_device(p_limit integer)`
- `public.record_push_delivery(p_id uuid, p_delivery notification_delivery, p_detail text)`
- `public.unread_notification_count()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.player_actions`

> **Arc21 says:** Per-decision log with optional strategy grading. Readable only by the player who made the decision.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `player_actions_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (16)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `hand_player_id` | uuid | yes | no | — |
| `hand_record_id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `user_id` | uuid | no | no | — |
| `seq` | integer | yes | no | — |
| `action` | player_action_type | yes | no | — |
| `cards_before` | jsonb | yes | no | — |
| `total_before` | integer | no | no | — |
| `is_soft_before` | boolean | yes | no | — |
| `dealer_upcard` | jsonb | no | no | — |
| `optimal_action` | player_action_type | no | no | — |
| `was_optimal` | boolean | no | no | — |
| `decision_ms` | integer | no | no | — |
| `from_timeout` | boolean | yes | no | — |
| `decided_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.game_sessions`, `public.hand_players`, `public.hand_records`, `public.profiles`.

**Guards.** refusing triggers: `player_actions_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.player_daily_xp`

> **Arc21 says:** Repeatable XP earned per UTC day, for the 300/day cap. Server-written only.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `user_id` → `auth.users` |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `player_daily_xp_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (6)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `utc_day` | date | yes | no | — |
| `repeatable_xp` | integer | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |
| `milestone_xp` | integer | yes | no | — |

Column comments:

- `milestone_xp` — One-off XP earned on this day — tournament placements, daily rewards. Dated so the weekly board can include it; deliberately NOT subject to the repeatable cap.

**Depends on:** `auth.users`.

**Guards.** refusing triggers: `player_daily_xp_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.award_milestone_xp(p_user_id uuid, p_xp integer)`
- `public.leaderboard_weekly_xp(p_limit integer, p_offset integer)`
- `public.record_hand_settlement(p_user_id uuid, p_hands_played integer, p_hands_won integer, p_hands_lost integer, p_hands_pushed integer, p_hands_surrendered integer, p_blackjacks integer, p_busts integer, p_chips_wagered bigint, p_chips_net bigint, p_biggest_win bigint, p_trailing_win_streak integer, p_streak_broken boolean, p_xp integer, p_utc_day date, p_daily_cap integer)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.player_decision_periods`

> **Arc21 says:** Server-graded basic-strategy decisions per player per ISO week. Written only by record_decisions, which is reachable by no API role. Practice, private tables and tournaments are excluded before a row is ever written.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `user_id` → `auth.users` |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `player_decision_periods_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (6)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `period_start` | date | yes | no | — |
| `decisions_total` | integer | yes | no | — |
| `decisions_optimal` | integer | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `auth.users`.

**Guards.** refusing triggers: `player_decision_periods_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.leaderboard_strategy_accuracy(p_limit integer, p_offset integer)`
- `public.my_strategy_accuracy_progress()`
- `public.record_decisions(p_user_id uuid, p_total integer, p_optimal integer, p_at timestamp with time zone)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.player_mode_stats`

> **Arc21 says:** Server-written statistics bucketed by mode and ruleset version. Private to the owning user.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `player_mode_stats_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (21)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `mode` | game_mode | yes | no | — |
| `ruleset_key` | text | yes | no | — |
| `sessions_played` | integer | yes | no | — |
| `hands_played` | integer | yes | no | — |
| `hands_won` | integer | yes | no | — |
| `hands_lost` | integer | yes | no | — |
| `hands_pushed` | integer | yes | no | — |
| `hands_surrendered` | integer | yes | no | — |
| `blackjacks` | integer | yes | no | — |
| `busts` | integer | yes | no | — |
| `doubles` | integer | yes | no | — |
| `splits` | integer | yes | no | — |
| `insurance_taken` | integer | yes | no | — |
| `chips_wagered` | bigint | yes | no | — |
| `chips_net` | bigint | yes | no | — |
| `decisions_total` | integer | yes | no | — |
| `decisions_optimal` | integer | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.profiles`.

**Guards.** refusing triggers: `player_mode_stats_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.player_stats`

> **Arc21 says:** Server-written lifetime statistics. Private to the owning user.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `player_stats_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (22)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `sessions_played` | integer | yes | no | — |
| `hands_played` | integer | yes | no | — |
| `hands_won` | integer | yes | no | — |
| `hands_lost` | integer | yes | no | — |
| `hands_pushed` | integer | yes | no | — |
| `hands_surrendered` | integer | yes | no | — |
| `blackjacks` | integer | yes | no | — |
| `busts` | integer | yes | no | — |
| `doubles` | integer | yes | no | — |
| `splits` | integer | yes | no | — |
| `insurance_taken` | integer | yes | no | — |
| `chips_wagered` | bigint | yes | no | — |
| `chips_net` | bigint | yes | no | — |
| `biggest_win` | bigint | yes | no | — |
| `current_win_streak` | integer | yes | no | — |
| `longest_win_streak` | integer | yes | no | — |
| `decisions_total` | integer | yes | no | — |
| `decisions_optimal` | integer | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.profiles`.

**Guards.** refusing triggers: `player_stats_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 4 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.handle_new_user()`
- `public.player_public_profile(p_user_id uuid)`
- `public.record_decisions(p_user_id uuid, p_total integer, p_optimal integer, p_at timestamp with time zone)`
- `public.record_hand_settlement(p_user_id uuid, p_hands_played integer, p_hands_won integer, p_hands_lost integer, p_hands_pushed integer, p_hands_surrendered integer, p_blackjacks integer, p_busts integer, p_chips_wagered bigint, p_chips_net bigint, p_biggest_win bigint, p_trailing_win_streak integer, p_streak_broken boolean, p_xp integer, p_utc_day date, p_daily_cap integer)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.push_tokens`

> **Arc21 says:** Per-device push registration. A user manages only their own rows.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds DELETE, INSERT, SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (4 across DELETE, INSERT, SELECT, UPDATE)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `push_tokens_delete_own` | DELETE | PERMISSIVE | `authenticated` | yes | no |
| `push_tokens_insert_own` | INSERT | PERMISSIVE | `authenticated` | no | yes |
| `push_tokens_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |
| `push_tokens_update_own` | UPDATE | PERMISSIVE | `authenticated` | yes | yes |

**Columns** (9)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `token` | text | yes | no | — |
| `platform` | push_platform | yes | no | — |
| `device_id` | text | no | no | authenticated: UPDATE |
| `is_active` | boolean | yes | no | authenticated: UPDATE |
| `created_at` | timestamp with time zone | yes | no | — |
| `last_used_at` | timestamp with time zone | yes | no | authenticated: UPDATE |
| `allowed_kinds` | notification_kind[] | yes | no | — |

Column comments:

- `allowed_kinds` — Per-device kind allowlist, mirroring the Settings toggles. Empty means this device is registered but wants nothing pushed.

**Depends on:** `public.profiles`.

**Named by 5 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.deactivate_push_token(p_token text)`
- `public.pending_push_deliveries(p_limit integer)`
- `public.pending_without_device(p_limit integer)`
- `public.register_push_token(p_token text, p_platform push_platform, p_device_id text, p_kinds notification_kind[])`
- `public.retire_push_token(p_token text)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.room_members`

> **Arc21 says:** *(no table comment)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | `user_id` → `auth.users` |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `room_members_select_same_room` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (8)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `room_id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `seat_index` | integer | yes | no | — |
| `status` | room_member_status | yes | no | — |
| `is_ready` | boolean | yes | no | — |
| `joined_at` | timestamp with time zone | yes | no | — |
| `last_seen_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.rooms`, `auth.users`.

**Guards.** refusing triggers: `room_members_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 14 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.caller_is_room_member(p_room_id uuid)`
- `public.create_private_room(p_max_seats integer)`
- `public.delete_own_account()`
- `public.expire_stale_queue_entries()`
- `public.get_room_state(p_room_id uuid)`
- `public.invite_friend_to_room(p_room_id uuid, p_friend uuid)`
- `public.join_matchmaking(p_tier table_tier)`
- `public.join_private_room(p_code text)`
- `public.leave_matchmaking()`
- `public.poll_matchmaking()`
- `public.release_room_seat(p_room_id uuid, p_user_id uuid)`
- `public.remove_room_member(p_room_id uuid, p_user_id uuid)`
- *…and 2 more; the full list is in `risk-inputs.json`.*

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.tournament_matches`

> **Arc21 says:** Bracket slots. A winner must be one of the two entries in the slot.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `tournament_matches_select_visible` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (12)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `tournament_id` | uuid | yes | no | — |
| `round` | integer | yes | no | — |
| `match_index` | integer | yes | no | — |
| `entry_a_id` | uuid | no | no | — |
| `entry_b_id` | uuid | no | no | — |
| `winner_entry_id` | uuid | no | no | — |
| `game_session_id` | uuid | no | no | — |
| `status` | tournament_match_status | yes | no | — |
| `scheduled_at` | timestamp with time zone | no | no | — |
| `started_at` | timestamp with time zone | no | no | — |
| `completed_at` | timestamp with time zone | no | no | — |

**Depends on:** `public.tournament_entries`, `public.tournament_entries`, `public.game_sessions`, `public.tournaments`, `public.tournament_entries`.

**Guards.** refusing triggers: `tournament_matches_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

### `public.user_cosmetics`

> **Arc21 says:** Server-granted cosmetic ownership. Readable by its owner; no client write path.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **authenticated** — authenticated holds SELECT, filtered by policy |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `user_cosmetics_select_own` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (6)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `cosmetic_id` | uuid | yes | no | — |
| `source` | cosmetic_unlock_type | yes | no | — |
| `source_ref` | text | no | no | — |
| `acquired_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.cosmetics`, `public.profiles`.

**Guards.** refusing triggers: `user_cosmetics_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 3 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.grant_earned_cosmetics_for(p_user_id uuid)`
- `public.guard_loadout_slots()`
- `public.my_inventory()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.daily_challenges`

> **Arc21 says:** One challenge per date. seed_secret is server-only; seed_commitment is the published SHA-256 that makes the shoe verifiable after the fact.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 2 relation(s), 1 of them ON DELETE CASCADE |
| Published to realtime | no |

**Policies** (1 across SELECT)

| Policy | Command | Kind | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| `daily_challenges_select_open` | SELECT | PERMISSIVE | `authenticated` | yes | no |

**Columns** (15)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | authenticated: SELECT |
| `challenge_date` | date | yes | no | authenticated: SELECT |
| `ruleset_id` | uuid | yes | no | authenticated: SELECT |
| `seed_secret` | text | yes | no | — |
| `seed_commitment` | text | yes | no | authenticated: SELECT |
| `revealed_seed` | text | no | no | authenticated: SELECT |
| `seed_revealed_at` | timestamp with time zone | no | no | authenticated: SELECT |
| `hand_count` | integer | yes | no | authenticated: SELECT |
| `starting_chips` | bigint | yes | no | authenticated: SELECT |
| `tier` | table_tier | yes | no | authenticated: SELECT |
| `reward_chips` | bigint | yes | no | authenticated: SELECT |
| `reward_xp` | integer | yes | no | authenticated: SELECT |
| `opens_at` | timestamp with time zone | yes | no | authenticated: SELECT |
| `closes_at` | timestamp with time zone | yes | no | authenticated: SELECT |
| `created_at` | timestamp with time zone | yes | no | authenticated: SELECT |

Column comments:

- `seed_secret` — SERVER ONLY. Excluded from every client GRANT. Never log this value.
- `seed_commitment` — SHA-256 (hex) of seed_secret, published when the challenge opens.

**Depended on by**

| Relation | Via column(s) | ON DELETE |
|---|---|---|
| `public.daily_entries` | `daily_challenge_id` | CASCADE |
| `public.game_sessions` | `daily_challenge_id` | SET NULL |

**Depends on:** `public.rulesets`.

**Guards.** refusing triggers: `daily_challenges_deny_client_write`, `daily_challenges_guard_seed`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 7 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.assert_client_authorization_surface()`
- `public.daily_challenge_streak(p_user_id uuid)`
- `public.ensure_daily_challenge_for(p_date date)`
- `public.latest_verifiable_daily_challenge()`
- `public.leaderboard_daily_challenge(p_date date, p_limit integer, p_offset integer)`
- `public.my_daily_entry()`
- `public.reveal_closed_daily_seeds()`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `private.career_drill_seeds`

> **Arc21 says:** The secret a drill attempt's scenarios are derived from. Never leaves the server; regenerated at grading time so a client cannot answer a different question from the one it was asked.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none. Row-level security is enabled, so every non-owner is denied by default.

**Columns** (5)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `attempt_id` | uuid | yes | no | — |
| `seed_secret` | text | yes | no | — |
| `focus` | text | yes | no | — |
| `scenario_count` | integer | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.career_attempts`.

### `private.game_commands`

> **Arc21 says:** Accepted-command idempotency ledger. A duplicate clientActionId returns the first committed response unchanged. Server-only: no API role has any privilege on this table or on the schema that contains it.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none. Row-level security is enabled, so every non-owner is denied by default.

**Columns** (8)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `game_session_id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `client_action_id` | uuid | yes | no | — |
| `command_type` | text | yes | no | — |
| `applied_version` | bigint | yes | no | — |
| `response` | jsonb | yes | no | — |
| `created_at` | timestamp with time zone | yes | no | — |

Column comments:

- `user_id` — Derived from the verified JWT. A replay under a different account is rejected as a conflict.
- `response` — The verbatim committed response body — a sanitised toPublicState payload. Never engine state.

**Depends on:** `public.game_sessions`, `public.profiles`.

### `private.game_state_private`

> **Arc21 says:** Authoritative BlackjackGameState including future shoe order and the dealer hole card. No API role has any privilege on this table or on the schema that contains it.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none. Row-level security is enabled, so every non-owner is denied by default.

**Columns** (4)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `game_session_id` | uuid | yes | no | — |
| `engine_state` | jsonb | yes | no | — |
| `version` | bigint | yes | no | — |
| `updated_at` | timestamp with time zone | yes | no | — |

**Depends on:** `public.game_sessions`.

### `public.rate_limit_events`

> **Arc21 says:** One row per ALLOWED attempt. Refusals are not recorded — see the header of this migration. Pruned on every consume, so the table holds at most one window of history per player per action.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | `user_id` → `auth.users` |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none. Row-level security is enabled, so every non-owner is denied by default.

**Columns** (4)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `user_id` | uuid | yes | no | — |
| `action` | text | yes | no | — |
| `occurred_at` | timestamp with time zone | yes | no | — |

**Depends on:** `auth.users`.

**Guards.** refusing triggers: `rate_limit_events_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 2 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.consume_rate_limit(p_user_id uuid, p_action text)`
- `public.rate_limit_check(p_user_id uuid, p_action text)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*

### `public.rate_limit_policies`

> **Arc21 says:** Every rate limit in the product, in one place. Read through rate_limit_for(); never duplicated as a literal inside a function. Server-owned: no client role holds any privilege on it, and RLS is enabled with no policy, so it is unreachable through PostgREST even if a grant were added by accident.
>
> *(The author's `COMMENT`. A claim about the resource, recorded beside the facts, not in place of them.)*

| | |
|---|---|
| Kind | table, owned by `postgres` |
| Exposure | **server-only** — no client-presentable role holds any privilege on this resource |
| Row-level security | enabled: yes, forced: no |
| Identity column | none — this table does not record whose row it is |
| Depended on by | 0 relation(s) |
| Published to realtime | no |

**Policies:** none. Row-level security is enabled, so every non-owner is denied by default.

**Columns** (5)

| Column | Type | Not null | Server-generated | Client privilege on this column |
|---|---|---|---|---|
| `id` | uuid | yes | no | — |
| `action` | text | yes | no | — |
| `window_length` | interval | yes | no | — |
| `max_events` | integer | yes | no | — |
| `rationale` | text | yes | no | — |

Column comments:

- `window_length` — The ROLLING window. Events are counted against now() - window_length, never against a calendar boundary.

**Guards.** refusing triggers: `rate_limit_policies_deny_client_write`.

*Whether these actually refuse anything is settled by executing a statement, not by their
names. WP1 proved it for `profiles_guard_server_columns`; the rest are untested until WP3.*

**Named by 2 SECURITY DEFINER function(s)**, which execute with their owner's
privileges rather than the caller's — so these are the server-side paths that can reach this
resource regardless of the caller's policies:

- `public.rate_limit_check(p_user_id uuid, p_action text)`
- `public.rate_limit_for(p_action text)`

*Text match on the function body. It misses anything reached through dynamic SQL and
over-reports a name that appears only in a comment.*
