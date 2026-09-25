/**
 * Attest — WP5 finding definitions and remediation guidance (D3.57).
 *
 * PROVENANCE: everything in this file is AI-DRAFTED (Claude) for the author's
 * review at CP4. None of it is the author's words, and none of it is the
 * findings narrative — that is the author's to write (brief §1.1), and
 * FINDINGS.md leaves a blank for it under every item.
 *
 * What this file decides, and what it does not:
 *
 *   - It GROUPS WP3 records into findings. Every WP3 record that is not
 *     `effective` must land in exactly one item here or in a stated
 *     limitation; `attest wp5` refuses to write anything otherwise.
 *   - It says which verdict each grouped record must carry. If the official
 *     run disagrees, `attest wp5` stops: the prose below cannot silently
 *     outlive the evidence it describes.
 *   - It names the resource whose data or integrity is at risk, so that the
 *     ranking can use that resource's FROZEN WP2 tier (cp3-tiers.json). It does
 *     not assign any tier, severity or score of its own.
 *   - It drafts remediation options with their tradeoffs, and the exact
 *     re-verification: which Test IDs must change to which verdict.
 *
 * It never decides whether an item is accepted as design intent. Where the
 * evidence points both ways, both sides are stated and the question is put to
 * the author.
 *
 * After CP4 (2026-09-25). The author answered: every status, judgment and the
 * approval are the author's and live verbatim in rubric/cp4-author-response.json.
 * `cp4Notes` below are AI-DRAFTED too (Amendment A2): they state what each of
 * those decisions means for the evidence — never a decision of their own.
 */

/** The fields of a WP3 evidence record the selectors read. */
export interface RecordView {
  readonly testId: string;
  readonly family: string;
  readonly resource: string;
  readonly controlId: string;
  readonly polarity: string;
  readonly verdict: string;
  readonly observation: string;
}

export type ItemPart = "finding" | "informational" | "limitation";

export interface RemediationOption {
  readonly option: string;
  readonly tradeoffs: string;
}

export interface ItemSpec {
  /** Stable identifier; the rank is computed, not encoded here. */
  readonly key: string;
  readonly part: ItemPart;
  /** Short and factual. */
  readonly title: string;
  /** The records that ARE this item. */
  readonly select: (r: RecordView) => boolean;
  /** Every selected record must carry one of these verdicts. */
  readonly expectVerdicts: readonly string[];
  /** How many records the rule must select — a guard against a selector drifting. */
  readonly expectCount: number;
  /** Effective records that bound the item (what still holds around it). */
  readonly supporting?: (r: RecordView) => boolean;
  /** WP0 inventory observation kinds this item carries (CP1's structural observations). */
  readonly wp0Kinds?: readonly string[];
  /**
   * The WP2-tiered resources whose data or integrity the observed behaviour
   * affects. Empty: the resources of the selected records — those `riskFrom`
   * admits, when given (a mechanism row on an Attest scratch table has no tier).
   */
  readonly resourcesAtRisk: readonly string[];
  readonly riskFrom?: (r: RecordView) => boolean;
  /** What happened, stated from the evidence. AI-drafted. */
  readonly whatHappened: string;
  /** Why it matters, grounded in the approved matrix and the frozen ratings. AI-drafted. */
  readonly whyItMatters: string;
  /** Evidence that points the other way, or context the author should weigh. */
  readonly contrary?: readonly string[];
  readonly limitations: readonly string[];
  /** The specific judgment only the author can make. */
  readonly judgment: readonly string[];
  /**
   * AI-drafted (Amendment A2): what the author's CP4 decision on this item means
   * for its evidence. Rendered beside the author's verbatim answers, labelled.
   */
  readonly cp4Notes?: readonly string[];
  readonly remediation: readonly RemediationOption[];
  /**
   * Exact re-verification with existing Test IDs. `mustBecome` is the verdict
   * each selected record must reach; `mustObserve`, when given, is checked
   * instead — for a characterization whose verdict cannot change, a change is
   * seen as its frozen prediction failing (`not_as_predicted`). An item whose
   * frozen rows cannot show a fix (mustBecome equal to its current verdict, and
   * no mustObserve) is never confirmed by `verify-finding`.
   */
  readonly verification: {
    readonly mustBecome: string;
    readonly mustObserve?: string;
    readonly steps: readonly string[];
    readonly caveat?: string;
  };
}

const isAbsence = (r: RecordView) => r.family.startsWith("F10") && r.controlId.endsWith("#audit:absent");
const LEADERBOARDS = new Set(["F5.leaderboard_weekly_xp.271", "F5.leaderboard_daily_challenge.273", "F5.leaderboard_strategy_accuracy.274", "F5.leaderboard_tournament_wins.275"]);
const PARTIAL_TRAILS = new Set(["F10.public_game_events.079", "F10.public_rate_limit_events.171"]);
const CATALOGUES = new Set(["public.career_nodes", "public.cosmetics", "public.rulesets", "public.tournaments"]);

/**
 * The standard re-run, the same for every item. The `verify-finding` step is
 * added by the renderer, and only for an item whose frozen rows can confirm a fix.
 */
const RERUN = [
  "The fix is made in Arc21 by its author, outside Attest. Attest never changes Arc21 (Amendment A1).",
  "`npm run attest bringup` then `npm run attest seed-extensions` — a fresh build of the changed migrations.",
  "`npm run attest execute-wp3 -- --confirm` — the whole frozen matrix, not only this item's rows, so a fix that breaks something else is seen.",
  "`npm run attest validate-wp3 <new run>` — the new run must pass independent validation.",
];

/** Can `verify-finding` confirm a fix of this item from its frozen rows? */
export function confirmable(spec: ItemSpec): boolean {
  return spec.part !== "limitation" && spec.expectCount > 0 &&
    (spec.verification.mustObserve !== undefined || spec.verification.mustBecome !== spec.expectVerdicts[0]);
}

export const WP5_ITEMS: readonly ItemSpec[] = [
  // ------------------------------------------------------------------------
  // Findings: WP3 failures and gaps
  // ------------------------------------------------------------------------
  {
    key: "leaderboards-private-identity",
    part: "finding",
    title: "Four leaderboard functions return a private-profile player's display name to other signed-in players",
    select: (r) => LEADERBOARDS.has(r.testId),
    expectVerdicts: ["deficient"],
    expectCount: 4,
    supporting: (r) => ["F5.leaderboard_weekly_xp.272", "F5.my_leaderboard_position.301", "F5.player_public_profile.263", "F5.player_public_profile.264"].includes(r.testId) || (r.resource === "public.profiles" && r.testId.startsWith("F1.")),
    resourcesAtRisk: ["public.profiles"],
    whatHappened:
      "Signed in as alice, each of leaderboard_weekly_xp, leaderboard_daily_challenge, leaderboard_strategy_accuracy and " +
      "leaderboard_tournament_wins returned a row for erin — a seeded account whose profile privacy is 'private' — carrying her " +
      "display name next to her score or wins. The approved expectation of each row was a projection with no private-privacy " +
      "account's identity. All four functions are SECURITY DEFINER and join public.profiles with no privacy or block condition " +
      "(Arc21 source, 20260905120000_bounded_client_reads.sql), so the policy that withholds erin's profile row from alice, " +
      "profiles_select_visible, is never consulted.",
    whyItMatters:
      "The approved rows name the escalation: \"returning a private-privacy account's identity\". The frozen WP2 rating makes " +
      "public.profiles High-tier because its privacy column decides who may read the profile (RUBRIC Part 4.2; cp3-tiers.json). " +
      "A player who chose 'private' is still identifiable, by display name, to every signed-in player on four boards. The " +
      "exposure needs no special knowledge: any account can call the functions (anonymous callers are refused, F5.272).",
    contrary: [
      "Arc21 documents this behaviour as intended. `tests/settings/privacy-copy.test.ts` in the Arc21 checkout states that the " +
        "privacy setting \"does NOT take the player off the leaderboards\", calls that \"not a bug\", cites the product " +
        "specification's leaderboard section (\"avatar, display name, value\"; it forbids only \"a private email or account " +
        "identifier\"), and requires the settings note to tell players that leaderboards remain visible.",
      "The WP3 expectation (\"no private-privacy account identity\") was approved at WP3 planning without that context. The WP3 " +
        "verdict stays `deficient` whatever is decided here: it is measured against the frozen expectation and is never re-judged.",
    ],
    limitations: [
      "One private account (erin) and one caller (alice) were exercised per function; 'friends' privacy and a blocked " +
        "relationship were not exercised on the leaderboards.",
      "The source reading (SECURITY DEFINER, no privacy condition) explains the observation; the WP3 records establish only the " +
        "observation itself.",
    ],
    judgment: [
      "Is this an open finding (the product should hide or anonymise private players on leaderboards), or accepted / design-intent " +
        "(Arc21's specification and settings note already say leaderboards stay visible, and the WP3 expectation was stricter than " +
        "the product)? The WP5 status is yours to set; the evidence verdict does not change.",
      "If it is open: one finding across four functions (one root cause), or four?",
    ],
    cp4Notes: [
      "The status is the author's reading of the product, not a change in the evidence: the four WP3 records stay `deficient`, " +
        "because each is measured against its frozen expectation and is never re-judged (J1).",
      "One item and one root cause across the four functions — SECURITY DEFINER joins to public.profiles with no privacy " +
        "condition — not four independent findings (J2).",
      "Remediation option 3 below is the one the decision corresponds to. Options 1 and 2, and the verification procedure, stay " +
        "as reference guidance should the product decision change; bringing the frozen expectation into line with the design " +
        "would be a new planning run approved by the author, never an edit to results.",
    ],
    remediation: [
      {
        option: "Exclude private-privacy accounts from every leaderboard's result except the caller's own row — a privacy condition " +
          "in each function (for example `p.privacy <> 'private' or t.user_id = auth.uid()`).",
        tradeoffs: "Private players vanish from global standings. Applied before ranking, other players' ranks renumber around them; " +
          "applied after, a gap in the rank sequence reveals that a hidden entry exists. Four functions must change consistently, " +
          "and `my_leaderboard_position` must agree with them on who is ranked.",
      },
      {
        option: "Keep private accounts ranked but anonymise their row for everyone except that account: display name replaced " +
          "(for example 'Private player'), avatar withheld; optionally shown in full to friends for 'friends' privacy.",
        tradeoffs: "Standings stay complete and consistent, but the score and rank of a private player are still disclosed, " +
          "unattributed. Needs a single shared helper so the four functions cannot drift apart.",
      },
      {
        option: "Accept as design intent and record it: 'private' governs the profile row and statistics, not competitive " +
          "standings — as the settings note already tells players.",
        tradeoffs: "No code change. The four WP3 rows keep reporting `deficient` against their frozen expectation until that " +
          "expectation is re-approved in a new planning run — a planning change, not a result change.",
      },
    ],
    verification: {
      mustBecome: "effective",
      steps: [
        ...RERUN,
        "Also required unchanged: F5.leaderboard_weekly_xp.272 (anonymous callers refused) and F5.my_leaderboard_position.301 " +
          "(only the caller's own position) must stay `effective`.",
      ],
      caveat: "Only the first two options can be verified this way; the third is a decision, recorded, not a fix.",
    },
  },
  {
    key: "audit-trail-absent",
    part: "finding",
    title: "No who-did-what-when record exists for 17 High-tier resources",
    select: isAbsence,
    expectVerdicts: ["gap"],
    expectCount: 17,
    resourcesAtRisk: [], // filled from the selected records' own resources
    whatHappened:
      "For each resource, a server-side catalog search found no history, versioning or audit relation naming it, no soft-delete " +
      "column, and no DELETE trigger whose function writes a record. The DELETE triggers that do exist on eleven of them are " +
      "guards that refuse a delete; they record nothing about who tried (D3.55). A change to any of these tables — including a " +
      "privileged one — leaves no record of who made it, when, or what the value was before.",
    whyItMatters:
      "The brief's family 10 asks whether a record of who-did-what-when exists for High-tier resources and says that if it does " +
      "not, that is a finding. Each row's approved covers text names what is lost for that resource (for example, public.wallets: " +
      "\"the balance is overwritten in place and carries no attribution for the change\"). Without a trail, a wrong balance, " +
      "seat, entry or setting cannot be attributed or reconstructed from the database itself.",
    contrary: [
      "Two structures in Arc21 are complete trails and pass: private.game_commands (F10.012–.015) and public.wallet_ledger " +
        "(F10.232–.235), which refuses UPDATE for every role, refuses client writes and carries a truncate guard (a server-role " +
        "DELETE is permitted by design, so an account deletion can cascade — see J4's conditions). public.wallets is " +
        "reconstructable from wallet_ledger, as the row's own covers text notes — its row answers the family-10 question for the " +
        "wallets table itself, not for the economy.",
    ],
    limitations: [
      "The search reads the database catalogs only. A trail kept outside the schema — platform logs, pgaudit configured by the " +
        "host, log drains, backups — would not be seen, and Attest did not assess the hosted platform.",
      "The heuristic counts a DELETE trigger as a trail only if its function contains an INSERT INTO. A trigger that records by " +
        "another route (a function call, NOTIFY to a listener) would be missed.",
    ],
    judgment: [
      "Which of the 17 need a trail? The brief asks the question for every High-tier resource; you may reasonably decide that some " +
        "(catalogue tables such as public.rulesets, configuration such as public.rate_limit_policies) need change history and " +
        "others (per-session state) do not. Each exclusion needs a reason in DECISIONS.md.",
      "Is wallet_ledger's reconstruction path sufficient for public.wallets?",
    ],
    cp4Notes: [
      "The 17 WP3 records stay `gap` whatever is decided: the author's rule decides where a trail is required, not whether one " +
        "exists (J3).",
      "The scope table below applies the author's rule to each resource. The application is AI-drafted under Amendment A2, " +
        "conservative where a resource could be read either way, and every exclusion is written up in DECISIONS.md D3.59.",
      "Under J4 no duplicate wallet trail is recommended: remediation options 1 and 2 apply to the resources the rule keeps in " +
        "scope, not to public.wallets, whose coverage instead depends on the three J4 conditions being verified.",
    ],
    remediation: [
      {
        option: "One generic audit trigger writing (table, row id, operation, old and new row as JSONB, auth.uid(), current_user, " +
          "time) into an append-only audit table protected the way wallet_ledger is: append-only guard, truncate guard, no client " +
          "grant.",
        tradeoffs: "Write amplification and storage growth, heaviest on hot tables (game_session_seats, room_members). Secrets " +
          "must be excluded — daily_challenges.seed_secret and career_drill_seeds would otherwise be copied into the log. " +
          "auth.uid() is null for server jobs, so current_user must be recorded too. Needs a retention rule.",
      },
      {
        option: "Targeted history only where integrity matters most (for example seats, room membership, tournament entries and " +
          "matches, rate-limit policies), relying on wallet_ledger for the economy.",
        tradeoffs: "Less cost and less noise; coverage is a judgment that must be written down, and the uncovered tables keep the gap.",
      },
      {
        option: "Platform-level logging (pgaudit or the host's log drains).",
        tradeoffs: "No schema change; statement-level rather than row-level, configured outside the repository, invisible to this " +
          "harness's catalog check, and its retention is someone else's setting.",
      },
    ],
    verification: {
      mustBecome: "characterized",
      mustObserve: "not_as_predicted",
      steps: [
        ...RERUN,
        "Each remediated resource's F10 absence row must report `not_as_predicted` → `characterized`: its frozen prediction was " +
          "\"none found\", and a trail is now found.",
        "The new trail then needs its own rows — does it carry an actor, an action and a time, and can a client change or delete " +
          "it — modelled on F10.public_wallet_ledger.232–.235. That is a planning change the author approves; it cannot be done " +
          "by editing results.",
      ],
      caveat: "The frozen absence rows can show that the absence ended; they cannot show that the new trail is any good. " +
        "`verify-finding` requires all seventeen to change, so a partial remediation is reported row by row as not confirmed.",
    },
  },
  {
    key: "audit-trail-partial",
    part: "finding",
    title: "Two partial trails: game events carry no actor, and rate-limit events record only allowed attempts",
    select: (r) => PARTIAL_TRAILS.has(r.testId),
    expectVerdicts: ["gap"],
    expectCount: 2,
    supporting: (r) => ["F10.public_game_events.080", "F10.public_game_events.081", "F10.public_game_events.082", "F10.public_rate_limit_events.172", "F10.public_rate_limit_events.173", "F10.public_rate_limit_events.174"].includes(r.testId),
    resourcesAtRisk: ["public.game_events", "public.rate_limit_events"],
    whatHappened:
      "public.game_events returned rows carrying an action and a time but has no actor column: recipient_user_id says who a " +
      "seat-scoped event is for, not who caused it. public.rate_limit_events returned rows carrying an actor, an action and a " +
      "time, but by design it records allowed attempts only and is pruned on every consume, so it holds at most one window. " +
      "Clients cannot modify or delete either (six supporting rows, all effective).",
    whyItMatters:
      "The approved rows mark both as partial and as finding candidates: game_events answers what happened when in a session " +
      "but not who did it; rate_limit_events \"cannot answer 'who was refused, when'\" — the question an investigation of abuse " +
      "asks first.",
    limitations: [
      "The actor of a game event may be recoverable by joining to private.game_commands (which does record user_id); WP3 did not " +
        "test that join, so this item does not claim the actor is unrecoverable — only that the event record does not carry it.",
    ],
    judgment: [
      "Is a game event's actor needed in the event itself, or is the join to private.game_commands an adequate trail?",
      "Should refused attempts be recorded at all, given the volume and what they reveal?",
    ],
    cp4Notes: [
      "Both WP3 records stay `gap` against their frozen expectations; the status records that the author accepts the design " +
        "(J5, J6), not that a trail now exists.",
      "J5's acceptance is conditional — the join to private.game_commands must be deterministic and retained — and, as J5 asks " +
        "to be stated, WP3 did not test the join. Read from the catalog afterwards (a read, not a test): no constraint links a " +
        "game event to the command that caused it — the columns a join could use are game_events (game_session_id, " +
        "state_version) and private.game_commands (game_session_id, applied_version), and nothing declares that match " +
        "one-to-one — and private.game_commands.user_id is ON DELETE CASCADE from public.profiles, so deleting an account " +
        "removes its commands and with them the actor of its events. The 'deterministic' condition is unverified; the " +
        "'retained' condition does not hold once the actor's account is deleted.",
      "Refused rate-limit attempts are not required in the application database (J6); aggregated or operational security " +
        "logging outside it remains available if abuse monitoring is ever needed. Remediation option 2 below is therefore not " +
        "recommended under the author's decision.",
    ],
    remediation: [
      {
        option: "Record the actor on each game event server-side (from the command's verified user_id, or a reference to the " +
          "private.game_commands row that caused it).",
        tradeoffs: "Event payloads are published to clients through Realtime: an actor column must not leak into the public " +
          "projection where it would reveal hidden information about other seats.",
      },
      {
        option: "A separate append-only log of refused rate-limit attempts, with its own retention, kept apart from the pruned " +
          "window table.",
        tradeoffs: "Refusals can be high-volume under attack — the very time the log matters — so it needs a bound; and it " +
          "records who was refused, which is itself personal data.",
      },
    ],
    verification: {
      mustBecome: "gap",
      steps: [...RERUN],
      caveat: "Neither frozen row can confirm this fix. F10.079's approved expectation asks only for an action and a time, and " +
        "F10.171's for rows it already returns, so both would still report `gap` after a fix. Verifying one needs the row's " +
        "expectation re-approved to require what is missing (an actor; a refusal record) — a planning change the author approves.",
    },
  },
  {
    key: "push-token-reassignment",
    part: "finding",
    title: "register_push_token lets a signed-in player take over another account's device registration",
    select: (r) => r.testId === "F5.register_push_token.269",
    expectVerdicts: ["deficient"],
    expectCount: 1,
    supporting: (r) => r.resource === "public.push_tokens" || r.testId === "F5.retire_push_token.268",
    resourcesAtRisk: ["public.push_tokens"],
    whatHappened:
      "Signed in as alice, a call to register_push_token with the token string of bob's registered device completed, and " +
      "afterwards the row carrying that token belonged to alice: bob's registration was gone. The function is SECURITY DEFINER " +
      "and its upsert reads `on conflict (token) do update set user_id = v_me` (Arc21 source, " +
      "20260905120000_bounded_client_reads.sql), so an existing row with that token is reassigned to whoever calls it.",
    whyItMatters:
      "The approved row's escalation: registering a token string already belonging to another account reassigns that device's " +
      "registration to the caller, so its previous owner may stop receiving their notifications on it and notifications for the " +
      "caller may be delivered to it instead. The table's own comment says \"A user manages only their own rows\". The frozen WP2 " +
      "rating keeps push_tokens Medium: a bad token \"misroutes that account's notifications, which is a delivery fault rather " +
      "than an authorization or economy change\".",
    contrary: [
      "Reassignment has a legitimate use: when a phone changes hands between accounts (one player signs out, another signs in on " +
        "the same install), the token is the same and should follow the new account. Attest found no Arc21 document saying " +
        "whether a token may move between accounts.",
    ],
    limitations: [
      "The attack needs the victim's token string. Other players' tokens are not readable through the API (F1.158, F4.163 " +
        "effective); how a token could be learned — from the device, logs or a notification payload — was not assessed.",
      "Only the database effect was measured; no push notification was sent or delivered.",
    ],
    judgment: [
      "Is moving a token between accounts intended (device handover), and if so, what should prove the caller holds the device?",
      "Does the frozen Medium tier of push_tokens reflect this consequence? A tier is never changed after results (brief §7); a " +
        "disagreement is recorded in DECISIONS.md as exactly that.",
    ],
    cp4Notes: [
      "Open (J7). The author's requirement — explicit re-registration plus proof of possession or control of the device, or " +
        "another appropriately authenticated handover — corresponds to remediation option 2, with option 1's refusal as the " +
        "behaviour for any caller who cannot give that proof. Option 3 alone would not meet it: it detects a takeover rather " +
        "than preventing it.",
      "The frozen Medium tier of public.push_tokens stands for this assessment (J8): the probe showed a registration moving to " +
        "the caller, not an account takeover or a direct authorization bypass. Any later disagreement with the tier is recorded " +
        "prospectively; WP2 is not changed.",
    ],
    remediation: [
      {
        option: "Refuse cross-account reassignment in the function: update the conflicting row only when it already belongs to " +
          "the caller (`on conflict (token) do update … where push_tokens.user_id = v_me`), and otherwise refuse or ignore; " +
          "have the client retire its token on sign-out (retire_push_token exists).",
        tradeoffs: "A device whose previous account never signed out (app deleted, session expired) cannot register for the new " +
          "account until the old row is retired — the server needs a way to clear a stale row (Arc21 already has a server-only " +
          "deactivate_push_token).",
      },
      {
        option: "Allow reassignment only with proof the caller holds the device — for example a silent push carrying a one-time " +
          "code that the app must echo back before the token is bound.",
        tradeoffs: "Proves possession properly, but adds a round trip, a pending-registration state and a failure mode when push " +
          "delivery is slow.",
      },
      {
        option: "Keep reassignment but make it visible: record it (old owner, new owner, time) and notify the previous owner " +
          "in-app.",
        tradeoffs: "Detects abuse rather than preventing it; the misrouting still happens.",
      },
    ],
    verification: {
      mustBecome: "effective",
      steps: [
        ...RERUN,
        "Also required unchanged: every push_tokens row (F1.157/.158, F2.159/.160, F3.161/.162, F4.163, F6.164/.165) and " +
          "F5.retire_push_token.268 must stay `effective`.",
      ],
    },
  },

  // ------------------------------------------------------------------------
  // Informational: characterizations and WP0 structural observations
  // ------------------------------------------------------------------------
  {
    key: "force-rls-not-set",
    part: "informational",
    title: "Row-level security is enabled but not forced on every Arc21 table: the owner and BYPASSRLS roles are not subject to policies",
    select: (r) => (r.testId.startsWith("F7.") || r.testId.startsWith("F7m.")) && r.verdict === "characterized",
    expectVerdicts: ["characterized"],
    expectCount: 24,
    supporting: (r) => r.testId.startsWith("F7m.") && r.verdict === "effective",
    wp0Kinds: ["rls_enabled_not_forced"],
    resourcesAtRisk: [], // filled from the selected F7 table rows (not the scratch-table mechanism rows)
    riskFrom: (r) => r.testId.startsWith("F7."),
    whatHappened:
      "On all 21 High-tier tables examined, row-level security is enabled and FORCE ROW LEVEL SECURITY is not set; the owner is " +
      "postgres. WP0 found the same on 39 relations. The mechanism rows, on an Attest scratch table, isolate the two exemptions: " +
      "an owner without BYPASSRLS sees every row when FORCE is off; a role with BYPASSRLS that is neither owner nor superuser " +
      "sees every row even with FORCE on. postgres holds BYPASSRLS on this instance.",
    whyItMatters:
      "Every policy Arc21 has applies to client roles only. Any code path that runs as the table owner or as a BYPASSRLS role — " +
      "migrations, SECURITY DEFINER functions owned by postgres, the service role, a leaked server credential — reads and " +
      "writes past every policy. RUBRIC Part 4.6 records this as cross-cutting evidence, not a per-resource vulnerability.",
    contrary: [
      "This is the Supabase default and is what SECURITY DEFINER functions rely on to do server work. FORCE alone would not " +
        "restrict a BYPASSRLS role (F7m.305), so it is not a complete fix on its own.",
    ],
    limitations: [
      "Characterization only: WP3 recorded the configuration and demonstrated the mechanism on a scratch table; it did not attempt " +
        "to misuse a server path against Arc21 data.",
    ],
    judgment: [
      "Accepted as the platform's design (documented), or open (some tables should be FORCED, with definer functions owned by a " +
        "role that is subject to policy)?",
    ],
    cp4Notes: [
      "Informational, not an open Arc21 finding by itself (J9): owners and BYPASSRLS roles sit outside ordinary row-level " +
        "enforcement by PostgreSQL's design. The privileged-role model stays documented and least privilege preserved; FORCE ROW " +
        "LEVEL SECURITY is not required on every table without a concrete need. The 24 characterization records are unchanged.",
    ],
    remediation: [
      {
        option: "FORCE row-level security on the highest-integrity tables and move SECURITY DEFINER functions to a dedicated owner " +
          "role that has explicit policies, instead of postgres.",
        tradeoffs: "Significant rework of every definer function's access; each needs policies granting exactly its server " +
          "operations; migrations become more complex.",
      },
      {
        option: "Accept and document: confine owner and BYPASSRLS use to migrations and reviewed server functions, and keep the " +
          "service-role key off clients.",
        tradeoffs: "No schema change; relies on process and secret handling rather than on the database.",
      },
    ],
    verification: {
      mustBecome: "characterized",
      steps: [...RERUN],
      caveat: "Not confirmable by `verify-finding`. The F7 rows record the configuration: a table that becomes FORCED will report " +
        "`not_as_predicted` → `characterized` against its frozen prediction (FORCE not set) — a detected change, not a pass — " +
        "and the F7m mechanism rows run on an Attest scratch table that no Arc21 change affects.",
    },
  },
  {
    key: "sprint-standings-names",
    part: "informational",
    title: "sprint_standings shows every co-entrant's display name, with no block or privacy check",
    select: (r) => r.testId === "F5.sprint_standings.255",
    expectVerdicts: ["characterized"],
    expectCount: 1,
    supporting: (r) => r.testId === "F5.sprint_standings.254",
    resourcesAtRisk: ["public.profiles"],
    whatHappened:
      "Signed in as alice, who has blocked dave, sprint_standings for a tournament both entered returned dave's display name. The " +
      "function is SECURITY DEFINER and joins public.profiles with no block or privacy filter, as the approved row predicted. A " +
      "non-entrant is refused (F5.254, effective).",
    whyItMatters:
      "The approved row records it as a characterization — co-entrants seeing each other's names in standings is plainly intended " +
      "— and names what it would take to matter: a fellow entrant seeing the name of an account that has blocked them, or of a " +
      "private-privacy account, which profiles_select_visible would have withheld.",
    limitations: ["Exercised with the blocker viewing the blocked player; the reverse direction and a private account were not."],
    judgment: ["Accepted / design-intent (standings must name every entrant), or open (the same question as the leaderboards)?"],
    cp4Notes: [
      "Accepted as design intent, consistently with the leaderboard decision (J10); the characterization record (F5.255) is " +
        "preserved as evidence.",
    ],
    remediation: [
      {
        option: "If it should respect blocks or privacy: the same shared anonymising helper as the leaderboard item.",
        tradeoffs: "A standings table with an unnamed row is harder to follow; a blocked player may still infer who it is.",
      },
    ],
    verification: { mustBecome: "characterized", mustObserve: "not_as_predicted", steps: [...RERUN], caveat: "A change shows as `not_as_predicted` against the frozen prediction that the name IS returned — a detected change, which is all a characterization can show." },
  },
  {
    key: "anonymous-catalogues",
    part: "informational",
    title: "Four catalogue tables are readable without an account",
    select: () => false,
    expectVerdicts: [],
    expectCount: 0,
    supporting: (r) => CATALOGUES.has(r.resource) && r.family.startsWith("F4"),
    wp0Kinds: ["anon_reachable"],
    resourcesAtRisk: ["public.career_nodes", "public.cosmetics", "public.rulesets", "public.tournaments"],
    whatHappened:
      "WP0 found anonymous SELECT on public.career_nodes, public.cosmetics, public.rulesets and public.tournaments, each with a " +
      "policy naming anon. WP3 confirmed the boundary: an anonymous caller reads the active rows and is refused the inactive or " +
      "cancelled row the policy excludes (eight F4 rows, all effective).",
    whyItMatters:
      "RUBRIC Part 4.4 records these as intentionally readable catalogue data whose risk is integrity, not confidentiality. On " +
      "all four, anon holds SELECT and no other privilege (WP0 inventory), so no anonymous write reaches them directly.",
    limitations: ["WP3 did not enumerate every column an anonymous caller receives; the rows establish row-level scope only."],
    judgment: ["Accepted / design-intent, as RUBRIC 4.4 already reasons?"],
    cp4Notes: [
      "Accepted as design intent, consistently with RUBRIC Part 4.4 (J11). The eight F4 records keep guarding the boundary: an " +
        "anonymous caller reads active catalogue rows only.",
    ],
    remediation: [
      {
        option: "None proposed if accepted. If not: require an account for the catalogue reads.",
        tradeoffs: "Signed-out screens (store, career map, tournament list) would stop working.",
      },
    ],
    verification: { mustBecome: "effective", steps: [...RERUN], caveat: "Nothing to confirm: the eight F4 rows already hold, and guard the boundary against drift." },
  },
  {
    key: "realtime-latent-anon-grant",
    part: "informational",
    title: "realtime.messages grants INSERT, SELECT and UPDATE to anon; no policy admits anon today",
    select: () => false,
    expectVerdicts: [],
    expectCount: 0,
    supporting: (r) => r.resource === "realtime.messages",
    wp0Kinds: ["anon_granted_but_no_policy_admits_it"],
    resourcesAtRisk: ["realtime.messages"],
    whatHappened:
      "WP0 found anon holding INSERT, SELECT and UPDATE on realtime.messages with no policy naming anon or PUBLIC, so row " +
      "security refuses every such statement today. WP3's anonymous and cross-seat rows on realtime.messages, including the real " +
      "websocket path, all held (effective).",
    whyItMatters:
      "The grant is latent: it becomes live the moment a permissive policy naming anon or PUBLIC is added, or row security is " +
      "switched off on that table. The grant belongs to the Supabase platform's defaults rather than to an Arc21 migration " +
      "(realtime is a platform schema).",
    limitations: ["Whether Arc21 can or should revoke a platform default was not assessed."],
    judgment: ["Accept as a platform default, or ask for the grant to be revoked where the platform allows it?"],
    cp4Notes: [
      "Informational (J12): no anonymous access is demonstrated today, because no policy admits anon, and the current state is " +
        "not an anonymous-data exposure. Revoking the unused anon INSERT, SELECT and UPDATE grants where the platform permits is " +
        "the preferred defence in depth — remediation option 1 below.",
    ],
    remediation: [
      {
        option: "Revoke anon's privileges on realtime.messages if the platform permits it, or add a restrictive policy that denies " +
          "anon explicitly, so a future permissive policy cannot open it.",
        tradeoffs: "Platform upgrades may re-grant defaults; a restrictive deny-anon policy is the more durable of the two.",
      },
    ],
    verification: { mustBecome: "effective", steps: [...RERUN], caveat: "Nothing to confirm: the realtime rows already hold, and WP4's drift view would flag a new policy that admits anon." },
  },

  // ------------------------------------------------------------------------
  // Limitations: what WP3 could not measure
  // ------------------------------------------------------------------------
  {
    key: "not-measured-grant-before-trigger",
    part: "limitation",
    title: "Two client attempts on the wallet ledger are refused by the grant before its append-only trigger can be reached",
    select: (r) => r.testId === "F9.public_wallets.319" || r.testId === "F9.public_wallets.321",
    expectVerdicts: ["not_measured"],
    expectCount: 2,
    supporting: (r) => r.testId === "F9.public_wallets.320" || r.testId === "F9.public_wallets.322",
    resourcesAtRisk: ["public.wallet_ledger"],
    whatHappened:
      "As alice, an UPDATE and a TRUNCATE of public.wallet_ledger were refused with 42501 by the table grant, so the append-only " +
      "trigger these rows were written to examine never ran for a client. Registered contradiction C2-grant-before-trigger; the " +
      "author chose to keep both rows not measured at Gate A. The trigger itself is exercised on the privileged path, where it refuses " +
      "both (F9.320, F9.322, effective).",
    whyItMatters: "Nothing is exposed: the client is refused earlier than planned. The limitation is only that the trigger is not what refused it.",
    limitations: [],
    judgment: [],
    remediation: [],
    verification: { mustBecome: "not_measured", steps: [] },
  },
  {
    key: "not-measured-deleted-cascade",
    part: "limitation",
    title: "Eleven deleted-account attempts have nothing left to target",
    select: (r) => r.family.startsWith("B") && r.verdict === "not_measured",
    expectVerdicts: ["not_measured"],
    expectCount: 11,
    resourcesAtRisk: [],
    whatHappened:
      "For eleven tables, deleting an account removes every row it owned by foreign-key cascade, so a still-valid token of the " +
      "deleted account has no row of its own left to reach. Registered contradiction C5; at Gate A the author kept these not measured " +
      "rather than manufacture an artificial target. The three tables where rows survive the deletion (a game session's events, " +
      "seats and metadata) were retargeted and all held (B.331–.333, effective).",
    whyItMatters: "The absence of a target is the schema's cascade working as designed; it is not evidence that access was refused.",
    limitations: [],
    judgment: [],
    remediation: [],
    verification: { mustBecome: "not_measured", steps: [] },
  },
];
