/**
 * Attest — per-resource ratings under RUBRIC.md.
 *
 * The rubric is the author's. This file is its APPLICATION: each resource gets
 * a level per dimension, a one-line reason, and an evidence mark, derived from
 * the dossiers in evidence/runs/<run-id>/risk-inputs.md and from the Arc21
 * repository. No tier appears here — tiers are computed by src/scorer.ts from
 * the rubric's rules.
 *
 * `preDecidedBy` marks the five cases the author resolved in RUBRIC.md Part 4;
 * those levels are transcribed, not derived.
 *
 * Evidence marks follow the rubric: E established, P partially established,
 * U unknown. Per the uncertainty rule, no dimension is rated Low merely because
 * evidence is absent; where recovery is not established, reversibility is
 * Medium/U.
 */
import type { ResourceRating } from "../src/scorer.ts";

/** Reversibility shorthand: recovery not established anywhere in the repository. */
const UNRECOVERABLE_UNKNOWN = {
  level: "Medium", evidence: "U",
  why: "No backup, snapshot or reconstruction path is established anywhere in the repository; per the rubric's uncertainty rule this is Medium/U rather than Low/U.",
} as const;

/** Reversibility for rows that ship in a migration: a deterministic restore source exists. */
const RESTORABLE_FROM_MIGRATION = {
  level: "Low", evidence: "E",
  why: "Rows are written by an Arc21 migration, which is an authoritative deterministic source that can restore them exactly.",
} as const;

export const RATINGS: readonly ResourceRating[] = [
  // =====================================================================
  // private schema — no client-presentable role holds USAGE
  // =====================================================================
  {
    resource: "private.career_drill_seeds",
    data: { level: "High", evidence: "E", why: "Holds `seed_secret`, the value a drill attempt's scenarios are derived from. Hidden game information whose disclosure enables answering a different question from the one asked." },
    blast: { level: "Low", evidence: "E", why: "Keyed by attempt_id; a row belongs to one user's single career attempt." },
    integrity: { level: "Medium", evidence: "P", why: "Corrupting a seed changes which scenarios are re-derived at grading for that one attempt. The attempt is reward-bearing, but the economy effect requires a further server action, so this is per-user corruption rather than overwriting economy truth." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Low", evidence: "E",
      why: "Confidentiality drives: the risk is disclosure of the secret. No client-presentable role holds USAGE on `private`, so the read path is server-only.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "confidentiality", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "private.game_commands",
    data: { level: "High", evidence: "E", why: "The accepted-command idempotency ledger — replay-protection state. Arc21's invariant is that retries cannot debit or credit twice, and this table is what enforces it." },
    blast: { level: "Medium", evidence: "E", why: "Keyed by game_session_id; a command applies within a session shared by its participants." },
    integrity: { level: "High", evidence: "E", why: "Corrupting it can cause an already-applied command to be treated as new, changing authoritative session state and duplicating its economic effect." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives. No client-presentable role holds USAGE on `private` or any privilege on the table.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "private.game_state_private",
    preDecidedBy: "RUBRIC.md Part 4.5",
    data: { level: "High", evidence: "E", why: "Authoritative engine state including the future shoe order and the dealer hole card — hidden game information whose disclosure enables cheating." },
    blast: { level: "Medium", evidence: "E", why: "Shared state for the affected game/session." },
    integrity: { level: "High", evidence: "E", why: "Corruption changes the authoritative state against which commands are validated." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Low", evidence: "E",
      why: "Server-only. `private` schema USAGE is granted to `postgres` alone — not to anon, authenticated or service_role — and no SQL function anywhere in public/private names the table, so there is no RPC path.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // server-owned control state
  // =====================================================================
  {
    resource: "public.rate_limit_events",
    data: { level: "Medium", evidence: "E", why: "(user_id, action, occurred_at) — operational per-user state. Not a secret and not an audit trail: the table records allowed attempts only, never refusals." },
    blast: { level: "Low", evidence: "E", why: "Rows are per user and per action." },
    integrity: { level: "High", evidence: "E", why: "Deleting rows resets a user's rate-limit window. That corrupts a security control." },
    reversibility: { level: "Medium", evidence: "P", why: "The table is pruned on every consume and holds at most one window by design, so it refills; but a wiped window lets a burst through in the interim and what was consumed cannot be reconstructed." },
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives. RLS is enabled with no policy and no client role holds any privilege, so neither read nor write is client-reachable.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.rate_limit_policies",
    data: { level: "Medium", evidence: "E", why: "Configuration rather than a secret, but its correctness is security-critical, which excludes the rubric's Low level." },
    blast: { level: "High", evidence: "E", why: "Every rate limit in the product in one place; a change affects all users." },
    integrity: { level: "High", evidence: "E", why: "Altering window_length or max_events disables or weakens rate limiting globally — corruption of a security control." },
    reversibility: RESTORABLE_FROM_MIGRATION,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives. RLS enabled with no policy and no client grant.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // catalogue resources — RUBRIC.md Part 4.4
  // =====================================================================
  {
    resource: "public.rulesets",
    preDecidedBy: "RUBRIC.md Part 4.4",
    data: { level: "Low", evidence: "E", why: "Intentionally readable catalogue data; confidentiality is Low by the author's decision." },
    blast: { level: "High", evidence: "E", why: "A global resource referenced by six relations including game_sessions, tournaments and hand_records." },
    integrity: { level: "High", evidence: "E", why: "Corrupted rules alter blackjack behaviour and the rules used by sessions and tournaments and recorded against hands." },
    reversibility: RESTORABLE_FROM_MIGRATION,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives, so write exposure is scored. Clients hold SELECT only and a deny_client_write trigger guards writes; the anonymous READ is intended public data and does not make this anonymously writable.",
      readExposure: "anonymous", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: true, anonymousPolicyPermits: true,
    },
  },
  {
    resource: "public.cosmetics",
    preDecidedBy: "RUBRIC.md Part 4.4",
    data: { level: "Low", evidence: "E", why: "Intentionally readable catalogue data; cosmetic descriptions." },
    blast: { level: "High", evidence: "E", why: "Global catalogue referenced by loadouts, user_cosmetics and career_nodes." },
    integrity: { level: "Medium", evidence: "E", why: "Corruption can break valid loadouts and rewards for many users, but does not control game outcomes or authorization." },
    reversibility: RESTORABLE_FROM_MIGRATION,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives; clients hold SELECT only, with a deny_client_write trigger.",
      readExposure: "anonymous", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: true, anonymousPolicyPermits: true,
    },
  },
  {
    resource: "public.career_nodes",
    data: { level: "Low", evidence: "E", why: "Public catalogue of career objectives; readable by design." },
    blast: { level: "High", evidence: "E", why: "Global catalogue; every account's career path is defined by it." },
    integrity: { level: "Medium", evidence: "E", why: "EVIDENCE CORRECTION (was High by analogy). Traced through the repository: the career reward is credited as `params.node.reward.chips` in supabase/functions/_shared/career-rewards.ts:57, a CODE-side CareerNode constant. create-session/index.ts:1838 does select reward_chips from this table, but `nodeRow` is thereafter used only for its `id` and the selected value is never referenced. What corruption here can still do is deactivate a node or break its `code` lookup — users observe incorrect behaviour and repair is needed, but no authoritative economy, authorization or game truth is overwritten." },
    reversibility: RESTORABLE_FROM_MIGRATION,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives; clients hold SELECT only, with a deny_client_write trigger.",
      readExposure: "anonymous", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: true, anonymousPolicyPermits: true,
    },
  },
  {
    resource: "public.tournaments",
    data: { level: "Low", evidence: "E", why: "Public tournament catalogue; readable by design." },
    blast: { level: "High", evidence: "E", why: "Global; a tournament row governs a competition many accounts enter." },
    integrity: { level: "Medium", evidence: "E", why: "EVIDENCE CORRECTION (was High by analogy). Traced: the entry fee is debited as `-SPRINT.entryFee` (create-session/index.ts:1611) and prizes credited as `placement.prizeChips` derived from `SPRINT.prizeChips` (tournament-format.ts:44,295) — both CODE-side constants. The tournaments row's entry_fee_chips, starting_chips and prize_structure are WRITTEN from those constants at creation (index.ts:1472-1480) and never read back to move chips. Independent validation: public.sprint_format() returns the figures as SQL literals and supabase/tests/16_sprint_and_daily.test.sql asserts it agrees field by field with the TypeScript constant, so neither money path reads this mutable row." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Low", evidence: "E",
      why: "Integrity drives; clients hold SELECT only, with a deny_client_write trigger.",
      readExposure: "anonymous", writeExposure: "server_only",
      drivingFailureMode: "integrity", anonymousGrantExists: true, anonymousPolicyPermits: true,
    },
  },
  {
    resource: "public.daily_challenges",
    data: { level: "High", evidence: "E", why: "Holds `seed_secret`, commented SERVER ONLY and never to be logged. Knowing it reveals the shoe for that day's challenge — hidden game information whose disclosure enables cheating." },
    blast: { level: "High", evidence: "E", why: "One challenge per date, played by every account that enters it." },
    integrity: { level: "High", evidence: "E", why: "Corrupting seed_secret or seed_commitment breaks the published commitment that makes the shoe verifiable, and changes the deal for everyone." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Low", evidence: "E",
      why: "Confidentiality of the secret drives. The 14 client column grants deliberately exclude seed_secret, so the risk-driving READ is server-only; writes are server-only too.",
      readExposure: "server_only", writeExposure: "server_only",
      drivingFailureMode: "confidentiality", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.daily_challenges_public",
    data: { level: "Low", evidence: "E", why: "A security_invoker view projecting daily_challenges with seed_secret absent — the public-safe projection by design." },
    blast: { level: "High", evidence: "E", why: "Global: one row per date, read by every account." },
    integrity: { level: "Low", evidence: "E", why: "A view holds no state of its own; there is nothing here to corrupt independently of the table beneath it." },
    reversibility: RESTORABLE_FROM_MIGRATION,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Confidentiality drives; the view is readable by any authenticated account and has no write path.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "confidentiality", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // economy
  // =====================================================================
  {
    resource: "public.wallets",
    data: { level: "High", evidence: "E", why: "Authoritative virtual-chip balance — the economy state the whole product turns on." },
    blast: { level: "Low", evidence: "E", why: "One row per account; a failure reaches that account's balance." },
    integrity: { level: "High", evidence: "E", why: "Modifies authoritative economy state directly." },
    reversibility: { level: "Low", evidence: "E", why: "Arc21's stated invariant is that balance and ledger must reconcile, and wallet_ledger is append-only with a truncate guard. A balance is therefore deterministically recomputable from the ledger — a positively supported restore path, not an assumed one." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter independently — reading another account's balance is a confidentiality failure, writing it an integrity one — so the more exposed path is scored: read is authenticated, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.wallet_ledger",
    data: { level: "High", evidence: "E", why: "The append-only chip ledger — authoritative economy history." },
    blast: { level: "Low", evidence: "E", why: "Rows are per account." },
    integrity: { level: "High", evidence: "E", why: "Modifies authoritative ledger state. UPDATE is rejected for all roles precisely because of this." },
    reversibility: { level: "High", evidence: "E", why: "The ledger IS the authoritative history. Nothing reconstructs it — wallets.balance is derived FROM it, not the other way round. Its append-only and deny-truncate guards exist for that reason." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; the more exposed path is the authenticated read of one's own ledger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // live game state
  // =====================================================================
  {
    resource: "public.game_sessions",
    data: { level: "Medium", evidence: "E", why: "Public, sanitised session metadata; the authoritative engine state lives in private.game_state_private, not here." },
    blast: { level: "Medium", evidence: "E", why: "One table/room shared by its seated participants; eleven relations reference it." },
    integrity: { level: "High", evidence: "E", why: "Carries status, version and escrow_chips. Changing them alters authoritative shared session state and the chips held in escrow." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and filtered to participants, write is server-only with a deny_client_write trigger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.game_session_seats",
    preDecidedBy: "RUBRIC.md Part 4.3 (blast radius)",
    data: { level: "High", evidence: "E", why: "Authorization state: session participation, read from this table, is what authorizes access to game_sessions, game_events, hand_players, hand_records and the Realtime game topic. It also carries stack and buy_in." },
    blast: { level: "Medium", evidence: "E", why: "Author's decision: shared state. A bad seat affects authorization and visibility for multiple participants in that session, scoped to the session rather than system-wide." },
    integrity: { level: "High", evidence: "E", why: "Six policies across five relations key on seat membership, so an unauthorized seat write alters access decisions." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and participant-filtered, write is server-only with a deny_client_write trigger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.game_events",
    data: { level: "Medium", evidence: "E", why: "Sanitised event payloads — the comment states they are toPublicState output only and never raw engine state." },
    blast: { level: "Medium", evidence: "E", why: "Scoped to one session's participants; some rows are seat-scoped to a single recipient." },
    integrity: { level: "Medium", evidence: "E", why: "The stream is derived from authoritative state rather than being it; corruption misleads clients without overwriting game truth." },
    reversibility: { level: "High", evidence: "E", why: "Commented append-only and described in the broadcast module as the durable, ordered record a client falls back to. It is the history; nothing reconstructs it." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and participant-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.hand_records",
    data: { level: "Medium", evidence: "E", why: "Completed-hand archive. It may hold dealer cards, but only once completed_at is set, so the hole card cannot leak through history." },
    blast: { level: "Medium", evidence: "E", why: "Scoped to the session whose hands it records." },
    integrity: { level: "Medium", evidence: "E", why: "A historical record derived from play; corrupting it falsifies history without altering authorization or current economy state." },
    reversibility: { level: "High", evidence: "P", why: "Commented an archive — it is the history of completed hands and no reconstruction path is established. Marked P because some economic consequences remain recoverable from wallet_ledger." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and participant-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.hand_players",
    data: { level: "Medium", evidence: "E", why: "One settled player hand; per-user gameplay record." },
    blast: { level: "Medium", evidence: "E", why: "Part of a shared session's settled record." },
    integrity: { level: "Medium", evidence: "E", why: "net = credit - wager is a database constraint, so the row cannot be made internally inconsistent; corruption falsifies a record rather than moving chips, which the ledger governs." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and participant-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // social graph — feeds profile-visibility authorization
  // =====================================================================
  {
    resource: "public.profiles",
    preDecidedBy: "RUBRIC.md Part 4.2 (blast radius)",
    data: { level: "Medium", evidence: "E", why: "Public-facing player identity — username, display name, bio, country, avatar. User-specific and materially personal, but not a credential and not authoritative system state." },
    blast: { level: "Low", evidence: "E", why: "Author's decision: one user. Most of the 24 dependants hold that same user's state, shared-game references use SET NULL rather than propagating edits, and display_name is copied into seat records rather than continuously propagating." },
    integrity: { level: "High", evidence: "E", why: "The `privacy` column is read by profiles_select_visible, so an unauthorized change to it alters who may read that profile — an access-control decision." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; any authenticated account can reach both the read and the six column-level writes, subject to the policies being assessed.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.blocks",
    data: { level: "Medium", evidence: "E", why: "A directed block is private social state — the comment notes a blocked user is never told." },
    blast: { level: "Medium", evidence: "E", why: "A social relationship: it binds two accounts, which the rubric places at shared state." },
    integrity: { level: "High", evidence: "E", why: "blocks is read by viewer_is_blocked_by inside profiles_select_visible. Removing someone's block makes their profile visible to an account they blocked — an access-control decision." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Integrity drives, and the write path is reachable: authenticated holds INSERT and DELETE.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.friend_requests",
    data: { level: "Medium", evidence: "E", why: "Private social state readable only by the sender and receiver." },
    blast: { level: "Medium", evidence: "E", why: "A social relationship between two accounts." },
    integrity: { level: "High", evidence: "E", why: "Accepting a request creates a friendship, and friendship is read by viewer_is_friend_of inside profiles_select_visible — so forcing a status change alters who may read a profile." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Integrity drives; authenticated holds INSERT and a column-level UPDATE on status.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.friendships",
    data: { level: "Medium", evidence: "E", why: "The undirected friend edge; private social state." },
    blast: { level: "Medium", evidence: "E", why: "A social relationship between two accounts." },
    integrity: { level: "High", evidence: "E", why: "Read by viewer_is_friend_of inside profiles_select_visible, so creating or removing an edge alters profile-visibility decisions." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Integrity drives; authenticated holds DELETE.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "integrity", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // rooms and matchmaking
  // =====================================================================
  {
    resource: "public.rooms",
    data: { level: "Medium", evidence: "E", why: "Private table metadata: code, visibility, host, ruleset, expiry." },
    blast: { level: "Medium", evidence: "E", why: "A room is a shared object with multiple members." },
    integrity: { level: "High", evidence: "P", why: "visibility and code govern who may join a private table, so an unauthorized change alters an access decision. Marked P: the authorization chain through caller_is_room_member is established, the precise effect of altering visibility is inferred from the column's role." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated, write is server-only with a deny_client_write trigger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.room_members",
    data: { level: "High", evidence: "P", why: "Room membership is read by caller_is_room_member, making it authorization state. Marked P: this table carries no COMMENT, so its purpose is established from the helper function that reads it rather than from a declared intent." },
    blast: { level: "Medium", evidence: "E", why: "Membership of a shared room." },
    integrity: { level: "High", evidence: "P", why: "An unauthorized membership row grants room access. Same evidence caveat as above." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated, write is server-only with a deny_client_write trigger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.matchmaking_queue",
    data: { level: "Medium", evidence: "E", why: "Transient per-user queue state — who is waiting for a public seat." },
    blast: { level: "Medium", evidence: "E", why: "A shared allocation workflow across waiting players." },
    integrity: { level: "Medium", evidence: "E", why: "Corruption can misallocate seats, but the comment is explicit that no chips move from here — they move through apply_wallet_delta in the session function." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated, write is server-only with a deny_client_write trigger.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // per-account progression and records
  // =====================================================================
  {
    resource: "public.career_progress",
    data: { level: "Medium", evidence: "E", why: "Per-user career progress: status, stars, best score, reward-claim markers." },
    blast: { level: "Low", evidence: "E", why: "One row per account per career node." },
    integrity: { level: "Medium", evidence: "E", why: "Changing reward_claimed_at or reward_ledger_id corrupts that user's progression and could set up a repeat claim, but the chips themselves move only through the ledger, so this does not itself overwrite economy truth." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.career_attempts",
    data: { level: "Medium", evidence: "E", why: "One reward-bearing attempt at one career node; every counter is server-written." },
    blast: { level: "Low", evidence: "E", why: "Rows belong to one account's attempts." },
    integrity: { level: "Medium", evidence: "E", why: "Corruption falsifies a user's attempt record. As with career_progress, the economic effect requires a further server action rather than following directly." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.daily_entries",
    data: { level: "Medium", evidence: "E", why: "One attempt per user per daily challenge, readable only by its owner." },
    blast: { level: "Medium", evidence: "E", why: "Scores feed a published leaderboard shared with other entrants." },
    integrity: { level: "Medium", evidence: "E", why: "Changing a score or placement corrupts a shared but derived leaderboard; the authoritative record of what was played is the entry itself and the challenge's published commitment." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.player_stats",
    data: { level: "Medium", evidence: "E", why: "Server-written lifetime statistics, private to the owning user." },
    blast: { level: "Low", evidence: "E", why: "One row per account." },
    integrity: { level: "Medium", evidence: "E", why: "Corrupts per-user derived state; no authorization or economy consequence." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.player_mode_stats",
    data: { level: "Medium", evidence: "E", why: "Server-written statistics bucketed by mode and ruleset version, private to the owner." },
    blast: { level: "Low", evidence: "E", why: "One row per account per bucket." },
    integrity: { level: "Medium", evidence: "E", why: "Corrupts per-user derived state." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.player_daily_xp",
    data: { level: "Medium", evidence: "E", why: "Repeatable XP earned per UTC day, the input to the 300/day cap." },
    blast: { level: "Low", evidence: "E", why: "One row per account per day." },
    integrity: { level: "Medium", evidence: "E", why: "Corrupting it lets an account exceed the daily XP cap. That is an abuse control over progression rather than a security control or economy state." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.player_decision_periods",
    data: { level: "Medium", evidence: "E", why: "Server-graded basic-strategy decisions per player per ISO week." },
    blast: { level: "Low", evidence: "E", why: "One row per account per week." },
    integrity: { level: "Medium", evidence: "E", why: "Corrupts a per-user derived grade. The comment notes practice, private tables and tournaments are excluded before a row is written." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.player_actions",
    data: { level: "Medium", evidence: "E", why: "Per-decision log with optional strategy grading, readable only by the player who made the decision." },
    blast: { level: "Low", evidence: "E", why: "Rows belong to one account." },
    integrity: { level: "Medium", evidence: "E", why: "Falsifies a per-user log; no authorization or economy consequence." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.user_cosmetics",
    data: { level: "Medium", evidence: "E", why: "Server-granted cosmetic ownership." },
    blast: { level: "Low", evidence: "E", why: "One row per account per cosmetic." },
    integrity: { level: "Medium", evidence: "E", why: "Granting an unowned cosmetic is an entitlement error, not an access-control or economy change — the catalogue has no price column by design." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated and owner-filtered, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.tournament_entries",
    data: { level: "Medium", evidence: "E", why: "Registrations and standings: chips, score, placement, prize markers." },
    blast: { level: "Medium", evidence: "E", why: "A tournament is a shared competition; an entry's standing affects the bracket other entrants face." },
    integrity: { level: "High", evidence: "E", why: "placement and prize_chips are the authoritative outcome of a shared competition, and changing them changes who won and what is paid." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated, write is server-only so the entry fee and the entry commit together.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.tournament_matches",
    data: { level: "Medium", evidence: "E", why: "Bracket slots; a winner must be one of the two entries in the slot." },
    blast: { level: "Medium", evidence: "E", why: "A shared bracket other entrants progress through." },
    integrity: { level: "High", evidence: "E", why: "The winner field is the authoritative outcome of a shared match and determines progression and prizes." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter; read is authenticated, write is server-only.",
      readExposure: "authenticated", writeExposure: "server_only",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.notifications",
    data: { level: "Medium", evidence: "E", why: "Server-written user notifications; clients may only mark them read." },
    blast: { level: "Low", evidence: "E", why: "Rows belong to one account." },
    integrity: { level: "Medium", evidence: "E", why: "Marking read or deleting corrupts one user's inbox state; no authorization or economy effect." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter, and the write path is reachable: authenticated holds DELETE and a column UPDATE on read_at.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  // =====================================================================
  // client-writable preferences and transport
  // =====================================================================
  {
    resource: "public.loadouts",
    data: { level: "Low", evidence: "E", why: "Equipped cosmetics — presentation data. Disclosure has little consequence and a wrong value is visible rather than harmful." },
    blast: { level: "Low", evidence: "E", why: "One row per account." },
    integrity: { level: "Low", evidence: "E", why: "Display-only. Every slot is validated against ownership and kind by the loadouts_guard_slots trigger, so a bad write cannot confer a cosmetic the account does not own." },
    reversibility: { level: "Medium", evidence: "U", why: "A user's chosen loadout is recorded nowhere else, so a corrupted row cannot be restored to what it was — only re-chosen. Per the rubric's uncertainty rule, Low reversibility must be positively supported and is not." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter, and the write path is reachable: authenticated holds INSERT and column UPDATE on all three slot columns.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "public.push_tokens",
    data: { level: "Medium", evidence: "E", why: "Per-device push registration — a device identifier tied to an account. Personal operational data rather than a credential." },
    blast: { level: "Low", evidence: "E", why: "Rows belong to one account's devices." },
    integrity: { level: "Medium", evidence: "E", why: "A bad token misroutes that account's notifications, which is a delivery fault rather than an authorization or economy change." },
    reversibility: UNRECOVERABLE_UNKNOWN,
    exposure: {
      level: "Medium", evidence: "E",
      why: "Both matter, and the write path is reachable: authenticated holds INSERT, DELETE and column UPDATE on device_id, is_active and last_used_at.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "both", anonymousGrantExists: false, anonymousPolicyPermits: false,
    },
  },
  {
    resource: "realtime.messages",
    preDecidedBy: "RUBRIC.md Part 4.1 (exposure)",
    data: { level: "Medium", evidence: "E", why: "Broadcast transport carrying sanitised PublicGameState and presence. The payload withholds the hole card and future shoe order by construction." },
    blast: { level: "Medium", evidence: "E", why: "A game topic reaches that session's seated participants; the presence topic is one shared roster." },
    integrity: { level: "Medium", evidence: "E", why: "A client writing to a game topic can push a fabricated table onto other players' screens — Arc21 measured exactly this before the policies existed. It corrupts shared non-authoritative behaviour; the server's state is unaffected." },
    reversibility: { level: "Low", evidence: "E", why: "Transport, not a record. public.game_events is described in the broadcast module as the durable ordered record a client falls back to, so a lost or corrupted message has an authoritative source to recover from." },
    exposure: {
      level: "Medium", evidence: "E",
      why: "Author's decision: effective current exposure is authenticated. All three policies name `authenticated`; the anonymous table grant exists beneath them but matches no applicable policy, and is recorded as defence-in-depth context rather than current reachability.",
      readExposure: "authenticated", writeExposure: "authenticated",
      drivingFailureMode: "both", anonymousGrantExists: true, anonymousPolicyPermits: false,
    },
  },
];
