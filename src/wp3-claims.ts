/**
 * Attest — what each approved expectation claims, span by span.
 *
 * An approved `expected` text is a sentence, and a sentence can make several
 * independent claims: "returns 0 and bob's notification read_at stays null"
 * is a returned value AND a state. D3.30 found twelve rows whose second claim
 * nobody checked. This module makes that class of defect structurally
 * impossible rather than individually fixed.
 *
 * Every distinct approved `expected` text is matched by exactly one template,
 * and the template partitions the text — character for character, start to
 * end — into spans. Each span is one of:
 *
 *   outcome     asserted on the probe's own result: rows, value, SQLSTATE, message
 *   mechanism   asserted on which layer refused or filtered (see wp3-outcome.ts)
 *   state       asserted by a privileged post-probe guard
 *   premise     a fixture fact the claim rests on, checked live before the probe
 *   catalog     a catalog fact the claim rests on, checked live at probe time
 *   reference   asserted by comparing the probe's response with a reference call
 *   runner      asserted by a composite runner (F7, F9, the socket, HTTP)
 *   rationale   explains; asserts nothing observable — and says why, in `why`
 *   connective  punctuation or a joining word, from a closed vocabulary
 *
 * `validateClaimCoverage` fails if any text is matched by no template, if a
 * template's spans do not consume the whole text, if a non-rationale span has
 * no evaluator, if a rationale span has no `why`, or if a connective carries a
 * word outside the closed vocabulary. Deleting the span for a second claim
 * therefore leaves text uncovered, and the run refuses — which is what
 * `prove-gates` injects to show it.
 *
 * The span kinds and evaluator names are Attest's reading of the approved
 * text. They are the part of this module a reviewer should argue with, and the
 * review artefact prints every span beside its evaluator for exactly that.
 */
import type { PlannedTest } from "./wp3-plan.ts";

export type SpanKind =
  | "outcome" | "mechanism" | "state" | "premise" | "catalog" | "reference" | "runner"
  | "rationale" | "connective";

export interface SpanDef {
  /** Matched at the current position (sticky). */
  readonly re: RegExp;
  readonly kind: SpanKind;
  /** The evaluator, for every kind but rationale and connective. */
  readonly eval?: string;
  /** For rationale spans: why the span is not asserted. */
  readonly why?: string;
}

export interface ClaimTemplate {
  readonly id: string;
  readonly spans: readonly SpanDef[];
}

export interface Span {
  readonly text: string;
  readonly kind: SpanKind;
  readonly eval?: string;
  readonly why?: string;
}

const S = (re: RegExp | string, kind: SpanKind, evalOrWhy?: string): SpanDef => {
  const r = typeof re === "string" ? new RegExp(escape(re), "y") : new RegExp(re.source, "y" + re.flags.replace(/[gy]/g, ""));
  if (kind === "rationale") return { re: r, kind, why: evalOrWhy };
  if (kind === "connective") return { re: r, kind };
  return { re: r, kind, eval: evalOrWhy };
};
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const C = (s: string | RegExp) => S(s, "connective");
const DASH = C(" — ");

/** The only words a connective span may carry. */
const CONNECTIVE_WORDS = new Set(["", "and", "or", "carrying", "that", "which", "but", "so"]);

const RESTATES = (what: string) => `restates ${what}, which is asserted by its own span`;

export const TEMPLATES: readonly ClaimTemplate[] = [
  // ---------------------------------------------------------------- privileges
  { id: "grant_surface", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("refused before any policy is consulted", "mechanism", "mech:privilege"),
  ]},
  { id: "anon_reach", spans: [
    S("no data", "outcome", "no_data_or_privilege"), C(", or "),
    S("error 42501 where no anon grant exists at all", "mechanism", "mech:anon_grant_consistent"),
  ]},
  { id: "column_update_denied", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("no column-level UPDATE privilege on that column", "mechanism", "mech:column_privilege:UPDATE"),
  ]},
  { id: "column_select_denied", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("no column-level SELECT privilege on that column", "mechanism", "mech:column_privilege:SELECT"),
  ]},
  { id: "anon_execute_denied", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("EXECUTE is granted to authenticated", "catalog", "catalog:execute_granted_authenticated"), C(" and "),
    S("must not be reachable by anon", "mechanism", "mech:privilege"),
  ]},

  // ---------------------------------------------------------------- row policy
  { id: "at_least_one_row", spans: [S(/^at least 1 row$/, "outcome", "rows_returned>=1")] },
  { id: "rls_no_data", spans: [
    S("no data (0 rows", "outcome", "rows_returned=0"), DASH,
    S("RLS filters rather than raising", "mechanism", "mech:rls_filter"), C(")"),
  ]},
  { id: "one_row_affected", spans: [S(/^1 row affected$/, "outcome", "rows_affected=1")] },
  { id: "zero_rows_affected", spans: [
    S("0 rows affected", "outcome", "rows_affected=0"), DASH,
    S("the policy filters the row out of the write", "mechanism", "mech:rls_filter"),
  ]},
  { id: "with_check_refused", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("new row violates row-level security policy", "mechanism", "mech:rls_with_check"),
  ]},
  { id: "update_still_attributed", spans: [
    S("1 row affected", "outcome", "rows_affected=1"), C(", and "),
    S("the row is still attributed to alice afterwards", "state", "state:still_attributed"),
  ]},
  { id: "granted_column_own_row", spans: [
    S("1 row affected", "outcome", "rows_affected=1"), DASH,
    S("a granted column on the caller's own row", "catalog", "catalog:granted_column_own_row"),
  ]},
  { id: "select_colgrant_positive", spans: [
    S("rows returned", "outcome", "rows_returned>=1"), DASH,
    S(/14 of 15 columns carry a client SELECT grant/, "catalog", "catalog:column_grant_count"),
  ]},

  // ---------------------------------------------------------------- anonymous
  { id: "anon_readable", spans: [
    S("at least 1 row", "outcome", "rows_returned>=1"), DASH,
    S("this resource is deliberately readable without an account", "catalog", "catalog:anon_policy_admits"),
  ]},
  { id: "anon_predicate_falsified", spans: [
    S("no data", "outcome", "rows_returned=0"), DASH,
    S(/[a-z_]+ USING is `[^`]+`/, "catalog", "catalog:policy_using_exact"), C(", which "),
    S("that row does not satisfy", "premise", "premise:falsifying_row"),
  ]},
  { id: "anon_latent_grant", spans: [
    S("no data", "outcome", "rows_returned=0"), DASH,
    S("a grant exists", "catalog", "catalog:anon_holds_select"), C(" but "),
    S("no policy names anon", "catalog", "catalog:no_policy_names_anon"), C(", so "),
    S("row security refuses every row", "mechanism", "mech:rls_filter"),
  ]},

  // ---------------------------------------------------------------- boundaries
  { id: "null_identity", spans: [
    S("no data", "outcome", "rows_returned=0"), DASH,
    S("a policy comparing to a null auth.uid() matches nothing", "mechanism", "mech:rls_filter"),
  ]},
  { id: "deleted_identity", spans: [
    S("no data", "outcome", "rows_returned=0"), C(" — and "),
    S("no error", "outcome", "no_raise"), C(". "),
    S("A token outliving its account must not become a key to whatever the cascade left behind", "rationale",
      "names the property the two outcome claims protect; its observable content is 'no data' and 'no error'"),
  ]},
  { id: "expired_session", spans: [
    S("HTTP 401", "runner", "runner:http_401"), DASH,
    S("rejected at the API boundary before any statement reaches PostgreSQL", "runner", "runner:rejected_at_gateway"),
  ]},

  // ---------------------------------------------------------------- F7
  { id: "f7_catalog", spans: [
    S("rls_enabled = true", "outcome", "catalog_read:rls_enabled"), C(", "),
    S("rls_forced = FALSE", "outcome", "catalog_read:rls_not_forced"), C(", "),
    S(/owner = [a-z_]+/, "outcome", "catalog_read:owner"),
  ]},
  { id: "f7_unforced_owner", spans: [
    S("2 rows", "runner", "runner:rows=2"), DASH,
    S("the owner is not subject to the policy", "runner", "runner:ran_as_owner_without_bypass"),
  ]},
  { id: "f7_forced_owner", spans: [
    S("1 row", "runner", "runner:rows=1"), DASH,
    S("FORCE removes the owner's exemption and the policy now applies", "runner", "runner:force_applied_to_owner"),
  ]},
  { id: "f7_forced_bypass", spans: [
    S("2 rows", "runner", "runner:rows=2"), DASH,
    S("BYPASSRLS is a separate exemption that FORCE does not touch", "runner", "runner:bypass_with_force"),
  ]},
  { id: "f7_roles", spans: [
    S("postgres: rolsuper = false, rolbypassrls = true", "runner", "runner:postgres_props"), C(". "),
    S("Scratch owner: rolsuper = false, rolbypassrls = false", "runner", "runner:owner_props"), C(", and "),
    S("IS relowner of the scratch table", "runner", "runner:owner_owns"), C(". "),
    S("Scratch bypass role: rolsuper = false, rolbypassrls = true", "runner", "runner:bypass_props"), C(", "),
    S("NOT relowner", "runner", "runner:bypass_not_owner"), C(", "),
    S("not a member of the owner role", "runner", "runner:bypass_not_member"),
  ]},

  // ---------------------------------------------------------------- F8
  { id: "rt_seated_read", spans: [
    S("at least 1 row", "outcome", "rows_returned>=1"), DASH,
    S("alice holds a live seat at that game", "premise", "premise:relationship"),
  ]},
  { id: "rt_unseated_read", spans: [
    S("no data", "outcome", "rows_returned=0"), DASH,
    S("carol holds no seat at that game", "premise", "premise:relationship"),
  ]},
  { id: "rt_presence_read", spans: [
    S("at least 1 row", "outcome", "rows_returned>=1"), DASH,
    S("the shared roster requires only an account", "catalog", "catalog:policy_using_exact"),
  ]},
  { id: "rt_anon_read", spans: [
    S("no data", "outcome", "rows_returned=0"), DASH,
    S("no policy on realtime.messages names anon", "catalog", "catalog:no_policy_names_anon"),
  ]},
  { id: "rt_presence_write", spans: [
    S("1 row affected", "outcome", "rows_affected=1"), DASH,
    S("a client may publish its own presence", "catalog", "catalog:policy_using_exact"),
  ]},
  { id: "rt_game_write", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("no insert policy admits a game topic", "mechanism", "mech:rls_with_check"),
  ]},
  { id: "socket_subscribe_ok", spans: [
    S("the subscription is accepted", "runner", "runner:joined"), C(" and "),
    S("alice's client receives the payload", "runner", "runner:received_server_payload"),
  ]},
  { id: "socket_subscribe_denied", spans: [
    S("the subscription is refused, or is accepted and delivers nothing", "runner", "runner:refused_or_silent"), C("; "),
    S("carol's client must receive no game payload", "runner", "runner:no_payload_received"),
  ]},
  { id: "socket_publish_denied", spans: [
    S("refused", "runner", "runner:publish_not_delivered"), C("; "),
    S("no other subscriber receives a carol-originated state message", "runner", "runner:observer_saw_no_carol_message"),
  ]},

  // ---------------------------------------------------------------- F9
  { id: "f9_concurrent", spans: [
    S("final balance equals the sum of both deltas", "runner", "runner:balance_is_sum"), C(", and "),
    S("reconciles with the ledger", "runner", "runner:reconciles"),
  ]},
  { id: "f9_idempotent", spans: [
    S("exactly one ledger row", "runner", "runner:one_ledger_row"), C(" and "),
    S("one balance movement", "runner", "runner:one_balance_movement"), DASH,
    S("the second call is a no-op, not a second credit", "runner", "runner:second_call_returned_first_row"),
  ]},
  { id: "f9_overdebit", spans: [
    S("refusal", "outcome", "error_any"), DASH,
    S("balances stay non-negative", "state", "state:balance_unchanged_non_negative"), C(" ("),
    S("a CHECK constraint violation", "mechanism", "mech:constraint:check"), C(", "),
    S("SQLSTATE 23514", "outcome", "error_sqlstate:23514"), C(")"),
  ]},
  { id: "f9_client_update", spans: [
    S("error", "outcome", "error_any"), DASH,
    S("UPDATE is rejected by wallet_ledger_append_only", "mechanism", "mech:trigger:wallet_ledger_append_only"),
  ]},
  { id: "f9_server_update", spans: [
    S("error", "outcome", "error_any"), DASH,
    S("the trigger raises for every role", "mechanism", "mech:trigger:wallet_ledger_append_only"), C(", "),
    S("not only client roles", "rationale", RESTATES("that the trigger raised on this (non-client) connection")),
  ]},
  { id: "f9_truncate", spans: [
    S("error", "outcome", "error_any"), DASH,
    S("refused by wallet_ledger_deny_truncate", "mechanism", "mech:trigger:wallet_ledger_deny_truncate"),
  ]},

  // ---------------------------------------------------------------- F10
  { id: "trail_exists_full", spans: [
    S("rows returned", "outcome", "rows_returned>=1"), C(" carrying "),
    S("an actor, an action, a timestamp", "outcome", "result:trail_columns_present"),
  ]},
  { id: "trail_exists_partial", spans: [
    S("rows returned", "outcome", "rows_returned>=1"), C(" carrying "),
    S("an action, a timestamp", "outcome", "result:trail_columns_present"),
  ]},
  { id: "trail_immutable", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), DASH,
    S("the trail is not client-modifiable by this statement", "state", "state:table_unchanged"),
  ]},
  { id: "trail_absent", spans: [
    S("NONE FOUND", "outcome", "catalog_read:no_trail"), DASH,
    S("recorded as a factual absence", "rationale", "describes how the result is recorded (verdict gap); it is not an observation of the system"), C(", and "),
    S("no trail is created to make the family pass", "state", "state:catalog_unchanged"),
  ]},

  // ---------------------------------------------------------------- F5
  { id: "caller_scoped", spans: [
    S("only alice's own rows are returned", "outcome", "result:only_own"), C(" or "),
    S("altered", "state", "state:only_own_altered"), C("; "),
    S("no bob or carol row appears in the result", "outcome", "result:excludes_bob_carol"), C(" or "),
    S("changes", "state", "state:no_bob_carol_change"),
  ]},
  { id: "returns_false", spans: [S(/^returns FALSE$/, "outcome", "returns:false")] },
  { id: "returns_false_nobody_blocked", spans: [
    S("returns FALSE", "outcome", "returns:false"), DASH,
    S("carol has blocked nobody", "premise", "premise:relationship"),
  ]},
  { id: "returns_false_no_raise", spans: [
    S("returns FALSE", "outcome", "returns:false"), C(". "),
    S("This function does not raise", "outcome", "no_raise"), C("; "),
    S("false is the safe answer", "rationale", RESTATES("'returns FALSE'")),
  ]},
  { id: "remove_room_member", spans: [
    S("returns FALSE", "outcome", "returns:false"), C(" and "),
    S("bob's membership is unchanged", "state", "state:guard"), C(". "),
    S("Not an error", "outcome", "no_raise"), C(": "),
    S("the body returns false for a non-host so that a caller learns nothing about whether the room exists", "rationale",
      "the design reason for the two outcome claims ('returns FALSE', 'Not an error'); it asserts nothing further"),
  ]},
  { id: "get_room_state", spans: [
    S("error PT404", "outcome", "error_sqlstate:PT404"), DASH,
    S("the body raises", "mechanism", "mech:function_body"), C(" "),
    S("'you are not at that table'", "outcome", "message"), C(". "),
    S("Note this is NOT 42501", "rationale", RESTATES("'error PT404'")), C("; "),
    S("the 42501 in this function guards the null-identity path", "rationale",
      "describes a different branch of the body, which this probe's identity does not take"),
  ]},
  { id: "sprint_non_entrant", spans: [
    S("error 42501", "outcome", "error_sqlstate:42501"), C(", "),
    S("message 'you are not in that tournament'", "outcome", "message"), C(". "),
    S("Not an empty result", "rationale", RESTATES("'error 42501' (a raise is not an empty result)")), C(": "),
    S("the body raises rather than returning zero rows", "mechanism", "mech:function_body"),
  ]},
  { id: "sprint_characterization", spans: [
    S("dave's display_name IS returned", "outcome", "result:includes_dave_display_name"), C(". "),
    S("That is a definite prediction, not an open question", "rationale", "states the planner's confidence, not a property of the system"), C(": "),
    S("the body joins public.profiles with no block or privacy filter", "catalog", "catalog:body_lacks_block_filter"), C(", and "),
    S("because the function is SECURITY DEFINER the caller's profiles_select_visible never runs", "catalog", "catalog:prosecdef"), C(". "),
    S(/Recorded as a CHARACTERIZATION — co-entrants seeing each other's names in standings is plainly intended, so this is a fact for the WP5 narrative to weigh, not a control that passed or failed/, "rationale",
      "classifies the row (characterization, verdict 'characterized'); it asserts nothing observable"),
  ]},
  { id: "refusal_or_no_effect_state", spans: [
    S("refusal or no effect", "outcome", "refusal_or_no_effect"), C("; "),
    S(/[^;]+$/, "state", "state:guard"),
  ]},
  { id: "refusal_then_state", spans: [
    S("refusal", "outcome", "refusal"), C("; "),
    S(/no room_members row is created for bob$/, "state", "state:guard"),
  ]},
  { id: "refusal_by_trigger", spans: [
    S("refusal", "outcome", "refusal"), DASH,
    S("the loadouts_guard_slots trigger validates each slot against ownership and kind", "mechanism", "mech:trigger:loadouts_guard_slots"),
  ]},
  { id: "refusal_by_policy", spans: [
    S("refusal", "outcome", "refusal"), DASH,
    S("friend_requests_insert_as_sender requires NOT viewer_has_blocked(receiver_id)", "mechanism", "mech:policy:friend_requests_insert_as_sender"),
  ]},
  { id: "mark_read", spans: [
    S("returns 0", "outcome", "returns:0"), C(" and "),
    S("bob's notification read_at stays null", "state", "state:guard"), DASH,
    S("the body scopes its UPDATE with `where user_id = v_me`", "catalog", "catalog:body_contains"),
  ]},
  { id: "no_effect_on_request", spans: [S(/^no effect on the alice→bob request$/, "state", "state:guard")] },
  { id: "no_effect_survives", spans: [
    S("no effect", "state", "state:no_effect"), C("; "),
    S(/[^;]+$/, "state", "state:guard"),
  ]},
  { id: "block_player", spans: [
    S("one blocks row with blocker_id = alice", "state", "state:guard"), C(". "),
    S("No row appears with blocker_id = bob", "state", "state:guard2"),
  ]},
  { id: "profile_blocked", spans: [
    S("returns NO rows", "outcome", "returns_rows=0"), DASH,
    S("the body returns early on is_blocked_between", "catalog", "catalog:body_contains"), C(", and "),
    S("nothing distinguishes 'they blocked you' from 'no such player'", "reference", "reference:identical"),
  ]},
  { id: "profile_non_friend", spans: [
    S("returns exactly ONE row", "outcome", "returns_rows=1"), C(" carrying "),
    S("the non-friend projection", "outcome", "result:non_friend_projection"), C(". "),
    S("Expecting 'no data' here would fail a control that is working correctly", "rationale",
      "explains why the row is not a 'no data' negative; asserts nothing further"), C(": "),
    S("bob's public profile is meant to be visible", "rationale", "states the design intent behind 'returns exactly ONE row'; bob's public privacy is a verified premise of the fixture"),
  ]},
  { id: "register_push_token", spans: [
    S("refusal, or a row attributed to alice that does NOT displace bob's", "outcome", "refusal_or_non_displacing"), C(". "),
    S("Bob's row must still exist with user_id = bob", "state", "state:guard"),
  ]},
  { id: "join_private_room", spans: [
    S("refusal", "outcome", "refusal"), C(" that "),
    S("does not distinguish a non-existent room from an ineligible one", "reference", "reference:identical"),
  ]},
  { id: "leaderboard_weekly", spans: [
    S("a public-safe projection only", "rationale", "an umbrella the two claims after the colon define; each is asserted by its own span"), C(": "),
    S("no private-privacy account identity", "outcome", "result:no_private_identity"), C(" and "),
    S("no column beyond what a leaderboard needs", "outcome", "result:leaderboard_columns_only"),
  ]},
  { id: "leaderboard_daily", spans: [
    S("a public-safe projection", "rationale", "an umbrella the two claims after the semicolon define; each is asserted by its own span"), C("; "),
    S("no seed_secret", "outcome", "result:excludes_seed_secret"), C(" and "),
    S("no private-privacy identity", "outcome", "result:no_private_identity"),
  ]},
  { id: "public_safe_projection", spans: [S(/^a public-safe projection only$/, "outcome", "result:public_safe")] },
  { id: "search_excludes_dave", spans: [S(/^dave must not appear in the results$/, "outcome", "result:excludes_dave")] },
  { id: "ensure_daily", spans: [
    S("the returned record is the daily_challenges_public projection", "outcome", "result:columns_of:daily_challenges_public"), C(", which "),
    S("has no seed_secret column at all", "outcome", "result:excludes_seed_secret"), C("; and "),
    S("today's still-open challenge has revealed_seed IS NULL afterwards", "state", "state:guard"),
  ]},
  { id: "latest_verifiable", spans: [
    S("exactly the revealed challenge is returned", "outcome", "result:exactly_revealed"), C("; "),
    S("the unrevealed one does not appear", "outcome", "result:excludes_unrevealed"), C(", and "),
    S("no seed_secret column is exposed", "outcome", "result:excludes_seed_secret"),
  ]},
  { id: "join_matchmaking", spans: [
    S("a matchmaking_queue row appears with user_id = alice", "state", "state:guard"), C(" and "),
    S("no other", "state", "state:guard2"), C("; "),
    S("bob's fresh entry is untouched", "state", "state:guard3"), C(". "),
    S("Stale entries belonging to anyone MAY be expired — that is not a failure", "state", "state:stale_expiry_permitted"),
  ]},
  { id: "poll_matchmaking", spans: [
    S("the returned entry is alice's own", "outcome", "result:own_queue_entry"), C("; "),
    S("no bob or carol queue identity appears in the result", "outcome", "result:excludes_bob_carol"),
  ]},
  { id: "create_private_room", spans: [
    S("error P0001", "outcome", "error_sqlstate:P0001"), C(", "),
    S("'a private table seats between 2 and 5 players'", "outcome", "message"), C("; "),
    S("no rooms row is created", "state", "state:guard"),
  ]},
];

/** Split an expected text into spans with one template, or say why it cannot be. */
export function spansFor(expected: string): { template: ClaimTemplate; spans: Span[] } | { error: string } {
  const failures: string[] = [];
  for (const tpl of TEMPLATES) {
    const spans: Span[] = [];
    let pos = 0;
    let ok = true;
    for (const d of tpl.spans) {
      d.re.lastIndex = pos;
      const m = d.re.exec(expected);
      if (!m || m.index !== pos) { ok = false; break; }
      spans.push({ text: m[0], kind: d.kind, eval: d.eval, why: d.why });
      pos += m[0].length;
    }
    if (ok && pos === expected.length) return { template: tpl, spans };
    if (ok) failures.push(`${tpl.id}: stopped at ${pos} of ${expected.length}`);
  }
  return { error: `no template consumes the whole text${failures.length ? ` (${failures.join("; ")})` : ""}: "${expected.slice(0, 100)}"` };
}

export interface CoverageIssue {
  readonly testId: string;
  readonly problem: string;
}

/**
 * Every approved expectation is fully covered, every claim has an evaluator,
 * every rationale says why, and connectives are only connectives.
 * `knownEvaluators` is the evaluator registry (wp3-evaluate.ts), injected so
 * an evaluator name no implementation answers to is a coverage failure too.
 */
export function validateClaimCoverage(
  tests: readonly PlannedTest[],
  knownEvaluators: (name: string) => boolean,
  templates: readonly ClaimTemplate[] = TEMPLATES,
): CoverageIssue[] {
  const issues: CoverageIssue[] = [];
  for (const t of tests) {
    const r = spansForWith(t.expected, templates);
    if ("error" in r) { issues.push({ testId: t.testId, problem: r.error }); continue; }
    for (const s of r.spans) {
      if (s.kind === "rationale") {
        if (!s.why || s.why.trim().length < 10) issues.push({ testId: t.testId, problem: `rationale span "${s.text}" does not say why it is not asserted` });
        continue;
      }
      if (s.kind === "connective") {
        const word = s.text.toLowerCase().replace(/[\s,;:.()—–-]+/g, " ").trim();
        if (!CONNECTIVE_WORDS.has(word)) issues.push({ testId: t.testId, problem: `connective span "${s.text}" carries "${word}", which is not a connective` });
        continue;
      }
      if (!s.eval) { issues.push({ testId: t.testId, problem: `${s.kind} span "${s.text}" has no evaluator` }); continue; }
      if (!knownEvaluators(s.eval)) issues.push({ testId: t.testId, problem: `${s.kind} span "${s.text}" names evaluator "${s.eval}", which is not implemented` });
    }
  }
  return issues;
}

function spansForWith(expected: string, templates: readonly ClaimTemplate[]) {
  if (templates === TEMPLATES) return spansFor(expected);
  // Same algorithm over an injected template set (prove-gates).
  for (const tpl of templates) {
    const spans: Span[] = [];
    let pos = 0;
    let ok = true;
    for (const d of tpl.spans) {
      d.re.lastIndex = pos;
      const m = d.re.exec(expected);
      if (!m || m.index !== pos) { ok = false; break; }
      spans.push({ text: m[0], kind: d.kind, eval: d.eval, why: d.why });
      pos += m[0].length;
    }
    if (ok && pos === expected.length) return { template: tpl, spans };
  }
  return { error: `no template consumes the whole text: "${expected.slice(0, 100)}"` };
}
