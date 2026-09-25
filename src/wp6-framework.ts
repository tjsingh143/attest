/**
 * Attest — WP6: the framework mapping specification (D3.60).
 *
 * A STUDY / CONTROL-MAPPING EXERCISE. It maps what Attest tested in Arc21 — a
 * personal application, not a regulated system — to NIST SP 800-53 Rev. 5 control
 * identifiers and to four 21 CFR Part 11 provisions, and says for each what the
 * evidence shows and, at greater length, what it does not. It is not compliance,
 * validation, certification or an audit, and it does not claim that Arc21 meets
 * any control.
 *
 * PROVENANCE. Every rationale, "demonstrates", "does not demonstrate", limitation
 * and "arguable" text here is AI-DRAFTED (Claude) under Amendment A2 — the brief
 * originally reserved the rationales to the author, and A2 withdrew that
 * reservation prospectively. None of it is the author's writing.
 *
 * What is NOT drafted: every quoted control statement comes from
 * rubric/framework-sources.json (NIST's OSCAL catalog, the eCFR), every number is
 * computed from the evidence (evidence-facts.ts), and every cited Test ID is
 * resolved from the official WP3 run. `attest wp6` and `attest validate-wp6`
 * refuse a mapping whose evidence does not bear it out (support rules in
 * wp6-mapping.ts).
 */
import type { Facts, VerdictCounts } from "./evidence-facts.ts";

/** Which WP3 records a mapping cites. Selected by what they test, never by verdict. */
export type RecordSelector =
  | { readonly family: string }
  | { readonly controlIdSuffix: string }
  | { readonly testIds: readonly string[] }
  | { readonly testIdPrefix: string };

/** Evidence that is not a WP3 record. */
export type Artifact = "wp0-inventory" | "wp1-validation" | "wp3-validation" | "wp4-drift" | "wp5-audit-scope" | "arc21-guard" | "cp3-tiers";

/** evidenced: the tested behaviour is what the statement describes, and every cited record held. */
export type Support = "evidenced" | "partial" | "not_mapped";

/** The facts a mapping's prose may use: the whole evidence, and the counts of its own cited records. */
export interface MappingContext {
  readonly f: Facts;
  /** Verdict counts of the records one selector (by index in `records`) resolves to. */
  readonly sel: (i: number) => VerdictCounts;
  /** Verdict counts over every record the mapping cites. */
  readonly all: VerdictCounts;
}

export interface FrameworkMappingSpec {
  /** "NIST:AC-3" or "P11:11.10(d)" — the key into rubric/framework-sources.json. */
  readonly ref: string;
  readonly inBriefMinimum: boolean;
  /** An Arc21 control, or an activity of Attest itself (CA-2, CA-7). */
  readonly subject: "arc21" | "attest";
  readonly support: Support;
  readonly records: readonly RecordSelector[];
  readonly artifacts: readonly Artifact[];
  readonly relevance: string;
  readonly demonstrates: (c: MappingContext) => readonly string[];
  readonly doesNotDemonstrate: (c: MappingContext) => readonly string[];
  readonly limitations: (c: MappingContext) => readonly string[];
  readonly arguable?: string;
  /** Results that touch the subject but are NOT evidence for it (not_mapped entries only). */
  readonly adjacent?: string;
}

const pct = (n: number, d: number) => (d ? `${n} of ${d}` : "0");
const heldOf = (v: VerdictCounts) => `${v.effective} of ${v.total} held`;

export const MAPPINGS: readonly FrameworkMappingSpec[] = [
  // --------------------------------------------------------------------------
  // NIST SP 800-53 Rev. 5 — access control
  // --------------------------------------------------------------------------
  {
    ref: "NIST:AC-3",
    inBriefMinimum: true,
    subject: "arc21",
    support: "evidenced",
    records: [{ family: "F1" }, { family: "F2" }, { family: "F3" }, { family: "F4" }, { family: "F6" }, { family: "F8" }, { controlIdSuffix: "#boundary:null-identity" }],
    artifacts: ["wp1-validation"],
    relevance:
      "AC-3 asks the system to enforce approved authorizations for logical access. For a client of Arc21 the enforcement point is PostgreSQL itself: table and column grants decide whether a role may touch a relation at all, and row-level policies decide which rows. The read-isolation, write-isolation, WITH CHECK, anonymous-exposure, column and Realtime families attempt — under role-scoped sessions carrying a real user's identity — exactly the reads and writes the approved WP3 matrix says must be refused or allowed, and the null-identity boundary rows make the same attempts with no identity at all.",
    demonstrates: ({ all, f }) => [
      `${all.total} Test IDs, ${all.effective} effective, ${all.deficient} deficient, ${all.gap} gap: on every direct path tested the database refused what the matrix forbids and allowed what it permits — another user's rows neither readable nor writable, no row attributable to another user, nothing reachable anonymously that the matrix forbids, columns outside the grant refused, Realtime topics admitting only their members.`,
      `The role scoping is load-bearing (WP1): in all ${f.wp1.scenarios} deliberate-break scenarios the role-scoped probe noticed the broken control, while the same statements on over-privileged connections could not tell an intact control from a broken one (${pct(f.wp1.overPrivilegedDiscriminated, f.wp1.overPrivilegedChecks)} checks discriminated).`,
    ],
    doesNotDemonstrate: () => [
      "That the authorizations are \"approved\" by anyone but the author: the approved WP3 matrix is the author's own expectation set, and no organizational access-control policy stands behind it.",
      "Enforcement inside SECURITY DEFINER functions, which happens in each function's body rather than in a policy — that is AC-6 and AC-24 below, where the open finding A4 sits.",
      "Enforcement at the application or HTTP layer (out of scope, brief §4), or in platform schemas Arc21 does not own.",
      "Anything about branches the matrix does not name, or about any other schema version than the one assessed.",
    ],
    limitations: ({ f }) => [
      `One schema version (${f.wp3.migrationCount} migrations, \`${f.wp3.schemaVersion.slice(0, 12)}\`), one disposable local instance, synthetic accounts. Each negative test simulates the attack its approved row names; nothing searched for others.`,
      "Not independent: the author wrote Arc21, the harness and the expectations.",
    ],
    arguable:
      "Why AC-3 and not AC-6: these tests ask whether a request the rules forbid is refused — enforcement. Whether the rules themselves grant more than a role needs is AC-6's question. The column-level family bears on both and is listed under both.",
  },
  {
    ref: "NIST:AC-6",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F5" }, { family: "F6" }, { family: "F7" }],
    artifacts: ["wp0-inventory", "wp1-validation"],
    relevance:
      "AC-6 asks that users, and processes acting on their behalf, hold only the access their tasks need. Arc21's SECURITY DEFINER functions are such processes: each runs with its owner's privileges — the owner is postgres, which bypasses row-level security — on behalf of whichever client calls it. The definer-function family asks whether a client-callable function can be used to reach beyond the caller's own authority; the column family whether grants stop at the columns a role needs; the FORCE family records which roles sit outside row-level policy altogether.",
    demonstrates: ({ sel, f }) => [
      `Definer functions: ${heldOf(sel(0))}; ${sel(0).deficient} did not — register_push_token reassigns another account's device registration to the caller (A4, open), and four leaderboard functions return a private-profile player's display name (A1, accepted by the author as design intent); ${sel(0).characterized} characterized (sprint standings, B2, accepted).`,
      `Column grants: ${heldOf(sel(1))}.`,
      `FORCE / BYPASSRLS: ${sel(2).characterized} characterized records — row-level security is enabled but not forced on every High-tier table, the owner is postgres, and ${f.wp0.rolesBypassRls.length} roles on the instance hold BYPASSRLS (${f.wp0.rolesBypassRls.join(", ")}); the author classed this informational (B1).`,
      `WP0: ${f.wp0.definerFunctions} SECURITY DEFINER functions, ${f.wp0.definerClientCallable} of them callable by a client role; one latent grant (realtime.messages grants INSERT, SELECT and UPDATE to anon, which no policy admits — B4, informational).`,
      `WP1: the login every control test uses can switch into service_role, which bypasses row-level security; what keeps the harness from testing as it is code in the harness, not a property of the database.`,
    ],
    doesNotDemonstrate: ({ f }) => [
      "That any privilege is necessary to accomplish an assigned task: there is no task or role analysis to compare the grants against.",
      "Review of privileged accounts, or who holds the service-role credential: deployment and credential handling are unknown (RUBRIC 4.6).",
      `The ${f.coverage.byKind.security_definer_function!.total - f.coverage.byKind.security_definer_function!.named} server-only SECURITY DEFINER functions no test calls: they are not executable by a client role, so they are outside the definer-function family's question.`,
    ],
    limitations: () => [
      "Each client-callable definer function was exercised on the escalation its approved row names — usually one path through its body, not all of them.",
      "A4 is open; nothing was remediated (Amendment A1).",
    ],
    arguable:
      "Why the definer functions map to AC-6 rather than AC-3: a definer function's refusal is written in its own body and runs with its owner's full privileges, so the question is whether that elevated privilege stays within what the caller may do — least privilege for a process acting on a user's behalf. A4 is where it does not. AC-24 covers the same functions from the decision side.",
  },
  {
    ref: "NIST:AC-24",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F1" }, { family: "F3" }, { testIds: ["F5.leaderboard_weekly_xp.271", "F5.leaderboard_daily_challenge.273", "F5.leaderboard_strategy_accuracy.274", "F5.leaderboard_tournament_wins.275", "F5.sprint_standings.255"] }],
    artifacts: ["wp0-inventory"],
    relevance:
      "AC-24 separates the access-control decision from its enforcement and asks that the decision be applied to each access request before enforcement. In PostgreSQL row-level security the decision is a policy's USING or WITH CHECK expression, evaluated for every row a statement touches; WP0 read every one of those expressions from the catalog.",
    demonstrates: ({ sel, f }) => [
      `WP0: ${f.wp0.policies} policies, each with its USING and WITH CHECK expression as PostgreSQL prints it, read from the live catalog rather than from the migrations.`,
      `Read and write decisions applied per request on the direct table path: ${sel(0).effective + sel(1).effective} of ${sel(0).total + sel(1).total} held.`,
      `On another path the table's decision is not applied: SECURITY DEFINER functions that join public.profiles without its privacy and block decision (${sel(2).deficient} deficient, A1; ${sel(2).characterized} characterized, B2). The author accepted both as intended behaviour at CP4 (J1, J10); the records keep their verdicts.`,
    ],
    doesNotDemonstrate: () => [
      "Organization-defined decisions: Arc21's decisions exist only as code (policies and function bodies) and as the approved matrix; nothing documents them as policy.",
      "Decision logging, or a decision point separate from the database.",
    ],
    limitations: () => ["The records show the outcome of each decision for the tested identities and fixtures; they do not prove an expression correct for every input."],
    arguable:
      "AC-24 versus AC-3: row-level security decides and enforces in one mechanism, so these records could also be read as AC-3 evidence. They are listed here for what they add — the decision expressions read from the catalog, and a path (definer functions) on which the table's decision is bypassed — not as a second count of the same enforcement.",
  },
  {
    ref: "NIST:AC-2",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ controlIdSuffix: "#boundary:deleted-user" }, { testIds: ["B.suite.expired-session"] }, { testIds: ["F7m.role_properties.306"] }],
    artifacts: ["wp0-inventory", "wp1-validation"],
    relevance:
      "AC-2 is mostly an organizational process — account types, managers, prerequisites, approvals, monitoring, reviews, and removal aligned with personnel changes. Attest can speak only to a narrow technical part of it: which roles exist and what they may do, and what the database does when an account is deleted or a session expires.",
    demonstrates: ({ sel, f }) => [
      `WP0: ${f.wp0.roles} roles and their attributes, read from the catalog (${f.wp0.rolesBypassRls.length} hold BYPASSRLS); the role-attributes record re-reads them at assessment time (${sel(2).characterized} characterized).`,
      `Deleted account: ${sel(0).effective} attempts held — after an account is deleted through Arc21's own function, its still-valid token reads nothing of the game-session data that survives the deletion; ${sel(0).not_measured} were not measured, because the deletion leaves nothing of the account's own to target (C1).`,
      `Expired session: refused at the API boundary (${sel(1).effective} effective).`,
    ],
    doesNotDemonstrate: () => [
      "Any account-management process (AC-2 a–l): account types, managers, approvals, monitoring, reviews, or alignment with personnel changes. Arc21's accounts are self-service.",
      "Token revocation: the deleted-account tests rely on the token staying valid until it expires, and show only that it reaches nothing.",
      "Authentication itself (out of scope, brief §4).",
    ],
    limitations: ({ sel }) => [`${sel(0).not_measured} of ${sel(0).total} deleted-account attempts are not measured (C1).`],
  },

  // --------------------------------------------------------------------------
  // NIST SP 800-53 Rev. 5 — audit and accountability
  // --------------------------------------------------------------------------
  {
    ref: "NIST:AU-2",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F10" }],
    artifacts: ["wp5-audit-scope"],
    relevance:
      "AU-2 asks which events the system can log, which it must log, and why that selection is adequate for investigating incidents. The audit-trail family asked, for every High-tier resource, whether any record of who did what and when exists; the author's CP4 rule (J3) is, in effect, a written selection of what must be logged, with its reasons.",
    demonstrates: ({ all, f }) => [
      `${all.total} records — ${all.effective} effective, ${all.gap} gap. Two structures log completely (private.game_commands and public.wallet_ledger), two partially (game events carry no actor; rate-limit events keep allowed attempts only), and seventeen High-tier resources log nothing.`,
      f.wp5.scope
        ? `Under the author's rule, ${f.wp5.scope.trailRequired} of those ${f.wp5.scope.total} require a trail and have none (A2, open); ${f.wp5.scope.excluded} are excluded as transient live state; ${f.wp5.scope.conditional} (public.wallets) depends on J4's conditions, which the evidence establishes only in part.`
        : "The author's scope decision is not recorded.",
    ],
    doesNotDemonstrate: () => [
      "Platform logging — PostgreSQL's own logs, pgaudit, the host's log drains — none was assessed, and none is visible to a catalog search.",
      "Coordination with other functions, or a review cycle for the selection (AU-2 b, e).",
    ],
    limitations: () => ["The absence check is a heuristic over the catalogs (D3.55): a trail kept outside the schema, or written by a trigger that records by another route, would be missed."],
  },
  {
    ref: "NIST:AU-3",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ testIds: ["F10.private_game_commands.012", "F10.public_wallet_ledger.232", "F10.public_game_events.079", "F10.public_rate_limit_events.171"] }],
    artifacts: [],
    relevance:
      "AU-3 lists what an audit record must establish: what happened, when, where, its source, its outcome, and who. The audit-trail family's content probes read the actor, action and time columns of each trail that exists.",
    demonstrates: ({ all }) => [
      `${all.effective} of ${all.total} trails carry an actor, an action and a time (private.game_commands, public.wallet_ledger).`,
      `${all.gap} carry less: public.game_events has an action and a time but no actor — the author accepted the join to private.game_commands as the actor trail, conditionally (A3, J5), a join WP3 did not test and whose command rows are deleted with their account; public.rate_limit_events records allowed attempts only, so a refusal's outcome is never recorded (accepted by the author, J6).`,
    ],
    doesNotDemonstrate: () => [
      "Where an event occurred and its source (AU-3 c, d): not examined.",
      "Outcome, except implicitly: an entry exists because an action was allowed.",
    ],
    limitations: () => ["Content was read for existing rows of four trails; completeness across every event type was not measured."],
  },
  {
    ref: "NIST:AU-9",
    inBriefMinimum: false,
    subject: "arc21",
    support: "partial",
    records: [
      { testIds: ["F10.private_game_commands.013", "F10.private_game_commands.014", "F10.private_game_commands.015", "F10.public_game_events.080", "F10.public_game_events.081", "F10.public_game_events.082", "F10.public_rate_limit_events.172", "F10.public_rate_limit_events.173", "F10.public_rate_limit_events.174", "F10.public_wallet_ledger.233", "F10.public_wallet_ledger.234", "F10.public_wallet_ledger.235"] },
      { testIds: ["F9.public_wallets.320", "F9.public_wallets.322", "F9.public_wallets.319", "F9.public_wallets.321"] },
    ],
    artifacts: [],
    relevance:
      "Not in the brief's minimum list; added because the evidence speaks to it directly. AU-9 asks that audit information be protected from unauthorized access, modification and deletion, and that such attempts raise an alert. The audit-trail family's immutability rows try to change, delete or truncate each trail as an ordinary client; the wallet family's ledger rows try the same on the privileged server path.",
    demonstrates: ({ sel }) => [
      `Client attempts to UPDATE, DELETE or TRUNCATE a trail: ${heldOf(sel(0))}.`,
      `Privileged path: the ledger's own triggers refused an UPDATE and a TRUNCATE (${sel(1).effective} effective); ${sel(1).not_measured} client attempts on the ledger were refused by the grant before its trigger could act and are not measured (C2).`,
    ],
    doesNotDemonstrate: () => [
      "Protection from privileged roles in general: the owner and BYPASSRLS roles pass every policy (B1), and the ledger's guard permits a server-role DELETE by design, so an account's deletion can cascade to its entries (catalog reading, J4).",
      "Alerting (AU-9 b): nothing alerts on an attempt.",
    ],
    limitations: () => ["Four trails exist to protect; the seventeen resources with no trail have nothing to protect (AU-2, AU-12)."],
  },
  {
    ref: "NIST:AU-12",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ testIds: ["F10.private_game_commands.012", "F10.public_wallet_ledger.232", "F10.public_game_events.079", "F10.public_rate_limit_events.171"] }, { controlIdSuffix: "#audit:absent" }],
    artifacts: [],
    relevance:
      "AU-12 asks the system to generate audit records for the events AU-2 selects, with AU-3's content. The audit-trail family's existence probes read whether a trail actually holds records, and its absence probes whether any mechanism could generate one.",
    demonstrates: ({ sel }) => [
      `Records are generated for game commands and ledger entries (${sel(0).effective} effective), and partially for game events and allowed rate-limit attempts (${sel(0).gap} gap).`,
      `For ${sel(1).total} High-tier resources no mechanism generates any record (${sel(1).gap} gap).`,
    ],
    doesNotDemonstrate: () => ["A way to select which events are logged (AU-12 b): no such capability exists in the schema.", "Record generation on platform components."],
    limitations: () => ["Same heuristic limit as AU-2."],
    arguable:
      "AU-2 versus AU-12: AU-2 is the decision about what must be logged; AU-12 is whether records are actually generated. The same audit-trail records bear on both; they are split so that an absence (AU-12) is not confused with the author's scope decision (AU-2).",
  },

  // --------------------------------------------------------------------------
  // NIST SP 800-53 Rev. 5 — change control, integrity
  // --------------------------------------------------------------------------
  {
    ref: "NIST:CM-3",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [],
    artifacts: ["wp4-drift", "arc21-guard"],
    relevance:
      "CM-3 is a process: decide which changes are controlled, review and approve them, record them, and monitor change activity. WP4 is a detective mechanism that could feed such a process: it rebuilds each schema state, inventories its controls, and classifies every difference.",
    demonstrates: ({ f }) => {
      const whole = f.wp4.diffs.find((d) => d.from === f.wp4.states[0]?.name && d.to === "C-current");
      const pf = f.wp4.diffs.reduce((m, d) => m + (d.passToFail ?? 0), 0);
      return [
        `Across ${f.wp4.states.length} schema states, WP4 classified the history ${whole ? `${whole.from} → ${whole.to}` : ""} as ${whole?.added ?? 0} controls added, ${whole?.removed ?? 0} removed, ${whole?.definitionChanged ?? 0} definition changes and ${whole?.attributesChanged ?? 0} attribute changes, with ${pf} approved questions going from pass to fail and ${whole?.failToPass ?? 0} from fail to pass.`,
        `A table added with no row-level control in an Attest-only scratch state was reported on the run that added it (${f.wp4.newUnprotected.map((u) => `\`${u.resource}\`, ${u.clientReachable ? "reachable by a client role" : "not reachable by a client role today"}`).join("; ")}).`,
        `The assessed state's inventory, re-read by WP4, differs from the frozen CP1/CP3 inventory in ${f.wp4.currentVsFrozenDifferences} places.`,
        "Every run is bound to a content hash of the migration set, and every command fingerprints the Arc21 checkout before and after it runs.",
      ];
    },
    doesNotDemonstrate: () => [
      "Any review, approval or change-control board (CM-3 b–d, g): Arc21 has no change-control process, and WP4 sees a change only after it was made.",
      "Security impact analysis before a change (that is CM-4).",
      "Continuous operation: WP4 ran on demand.",
    ],
    limitations: () => ["Historical states answer today's approved questions; a question that did not exist then is recorded as incompatible, never as a pass or a failure."],
    arguable:
      "CM-3 versus CA-7: drift detection is the monitoring half of change control (CM-3 f) and the ongoing-assessment half of continuous monitoring (CA-7). It is listed under both; neither is met as a process.",
  },
  {
    ref: "NIST:SI-7",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F9" }],
    artifacts: [],
    relevance:
      "SI-7 asks for integrity verification tools that detect unauthorized changes to software, firmware and information. The wallet family tests something adjacent: whether the wallet's transactional design keeps the balance consistent with its ledger under concurrent and repeated calls, and whether the ledger refuses being rewritten.",
    demonstrates: ({ all }) => [
      `${all.effective} of ${all.total} held: two overlapping deltas serialised and the balance equalled the ledger sum (F9.316); a repeated idempotency key credited once (F9.317); an over-debit was refused by a CHECK constraint (F9.318); UPDATE and TRUNCATE of the ledger were refused on the privileged path (F9.320, F9.322). ${all.not_measured} are not measured (C2).`,
    ],
    doesNotDemonstrate: () => [
      "An integrity verification tool in SI-7's sense: nothing in Arc21 recomputes balances from the ledger or detects an unauthorized change after the fact; the one reconciliation was performed by the test itself, for one wallet.",
      "Integrity of Arc21's software. (For Attest's own inputs, the harness hash, the migration-set hash and the Arc21 fingerprint are integrity checks of each run — of the assessment, not of Arc21.)",
    ],
    limitations: () => ["One wallet, fixed deltas, two concurrent sessions."],
    arguable:
      "The brief proposed SI-7 for this family. It fits only in part: the family tests integrity-preserving mechanisms (serialisation, idempotency, a constraint, an append-only guard), not detection of unauthorized change. Recorded as partial rather than forced.",
  },

  // --------------------------------------------------------------------------
  // NIST SP 800-53 Rev. 5 — Attest's own activities (not Arc21 controls)
  // --------------------------------------------------------------------------
  {
    ref: "NIST:CA-2",
    inBriefMinimum: false,
    subject: "attest",
    support: "partial",
    records: [{ testIdPrefix: "" }],
    artifacts: ["wp3-validation", "cp3-tiers"],
    relevance:
      "Not in the brief's minimum list; added because it describes what Attest itself is. CA-2 covers the assessment: choose an assessor, write a plan naming the controls, procedures and environment, have it approved, assess whether controls are implemented correctly, operating as intended and producing the desired outcome, report, and share the results.",
    demonstrates: ({ all, f }) => [
      `A written plan — the frozen matrix, ${f.wp3.byPolarity.positive ?? 0} positive, ${f.wp3.byPolarity.negative ?? 0} negative and ${f.wp3.byPolarity.characterization ?? 0} characterization Test IDs, with depth scaled to the frozen WP2 tiers (${Object.entries(f.wp2.byTier).map(([t, n]) => `${n} ${t}`).join(", ")} resources).`,
      `An assessment under role-scoped identities: ${all.total} records (${all.effective} effective, ${all.deficient} deficient, ${all.gap} gap, ${all.characterized} characterized, ${all.not_measured} not measured), ${f.wp3.rebuilds} rebuilds of the disposable database.`,
      `An independent re-derivation of every verdict from the raw records (validate-wp3: ${f.wp3.validationChecksPassed} of ${f.wp3.validationChecks} checks), and a generated report.`,
    ],
    doesNotDemonstrate: () => [
      "Independence (CA-2(1)): the assessor is the author of the system, of the harness and of the plan; under Amendment A2 parts of the narrative are AI-assisted.",
      "Approval of the plan by an authorizing official (CA-2 c): the author approved it.",
      "Assessment of anything outside the data layer.",
    ],
    limitations: () => ["This maps Attest's activity, not a control of Arc21."],
  },
  {
    ref: "NIST:CA-7",
    inBriefMinimum: false,
    subject: "attest",
    support: "partial",
    records: [],
    artifacts: ["wp4-drift"],
    relevance:
      "Not in the brief's minimum list; added because the brief itself calls drift detection the step from a one-time audit to a control program. CA-7 asks for a monitoring strategy with metrics, frequencies, ongoing assessment, analysis, response and reporting. Attest provides a mechanism for the ongoing-assessment part, for one system's data-layer controls.",
    demonstrates: ({ f }) => [
      `The same approved questions asked of ${f.wp4.states.length} schema states in one run, with changes classified by kind and result transitions between states; every check reruns from one command; the dashboard reports the posture.`,
    ],
    doesNotDemonstrate: () => [
      "A strategy, metrics, frequencies or response actions (CA-7 a, b, f): none exist; runs happen on demand.",
      "Monitoring of a live system: every run is against a disposable local rebuild.",
    ],
    limitations: () => ["This maps Attest's activity, not a control of Arc21."],
  },

  // --------------------------------------------------------------------------
  // 21 CFR Part 11 (study mapping only — Arc21 is not a Part 11 system)
  // --------------------------------------------------------------------------
  {
    ref: "P11:11.10(d)",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F1" }, { family: "F4" }, { family: "F8" }, { controlIdSuffix: "#boundary:null-identity" }, { controlIdSuffix: "#boundary:deleted-user" }, { testIds: ["B.suite.expired-session"] }],
    artifacts: [],
    relevance:
      "Read against a study system, \"limiting system access to authorized individuals\" becomes the data-layer question WP3 asks: given an identity — or none, or a deleted account's, or an expired session's — what can it reach. The read, anonymous and Realtime families and the boundary cases put that question directly.",
    demonstrates: ({ all }) => [
      `${all.total} Test IDs: ${all.effective} effective, ${all.not_measured} not measured (C1). No tested identity reached data the matrix forbids.`,
    ],
    doesNotDemonstrate: () => [
      "That Arc21 is a closed system under Part 11 or keeps an electronic record any predicate rule requires (§11.3(b)(4), (6)): it is a personal game, not a regulated system.",
      "Who the \"authorized individuals\" are: nothing authorizes anyone; accounts are self-service.",
      "User authentication (out of scope, brief §4).",
    ],
    limitations: () => ["A study mapping: capped at partial whatever the results, because Part 11's subject — electronic records under FDA predicate rules — does not exist in Arc21."],
    arguable:
      "§11.10(d) versus (g): (d) is who can get at the data at all; (g) is whether an authenticated user may alter a particular record or perform a particular operation. The reach-and-read families are listed under (d); the write, WITH CHECK, column and definer-function families under (g).",
  },
  {
    ref: "P11:11.10(e)",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F10" }, { testIds: ["F9.public_wallets.320", "F9.public_wallets.322"] }],
    artifacts: ["wp5-audit-scope"],
    relevance:
      "§11.10(e) asks for secure, computer-generated, time-stamped audit trails that independently record operator actions creating, modifying or deleting records, that never obscure earlier entries, and that are retained and available for review. The audit-trail family, and the ledger rows of the wallet family, examine exactly those properties where Arc21 has a trail.",
    demonstrates: ({ sel, f }) => [
      `Where Arc21 keeps a trail it has several of the properties: private.game_commands and public.wallet_ledger are computer-generated and time-stamped, ordinary clients cannot change or delete them, and the ledger refuses UPDATE for every role, so a correction is a new entry and earlier entries are not obscured (${sel(1).effective} privileged-path records).`,
      `Where it does not, the gap is the finding: ${sel(0).gap} audit-trail records are gaps${f.wp5.scope ? `, and the author's rule keeps ${f.wp5.scope.trailRequired} resources in scope for a trail they do not have (A2, open)` : ""}.`,
    ],
    doesNotDemonstrate: () => [
      "Retention: game commands and ledger rows are deleted with their account (ON DELETE CASCADE), and a server role may delete ledger rows by design.",
      "Independence of the trail from privileged operators, or availability for agency review and copying.",
      "That Arc21 holds any electronic record within Part 11's scope.",
    ],
    limitations: () => ["A study mapping: capped at partial."],
  },
  {
    ref: "P11:11.10(g)",
    inBriefMinimum: true,
    subject: "arc21",
    support: "partial",
    records: [{ family: "F2" }, { family: "F3" }, { family: "F5" }, { family: "F6" }],
    artifacts: [],
    relevance:
      "§11.10(g) asks for authority checks so that only authorized individuals can alter a record or perform the operation at hand. The write, WITH CHECK, column and definer-function families each put an authority check to that test.",
    demonstrates: ({ all }) => [
      `${all.total} Test IDs: ${all.effective} effective, ${all.deficient} deficient, ${all.characterized} characterized. One deficient authority check is open: register_push_token lets any signed-in caller take over another account's device registration (A4). The other four deficient records are the leaderboard item the author accepted as design intent (A1).`,
    ],
    doesNotDemonstrate: () => [
      "Electronic signatures or signing authority: Arc21 has none.",
      "Device checks (that is §11.10(h), which is not mapped).",
    ],
    limitations: () => ["A study mapping: capped at partial."],
  },
  {
    ref: "P11:11.300",
    inBriefMinimum: true,
    subject: "arc21",
    support: "not_mapped",
    records: [],
    artifacts: [],
    relevance:
      "§11.300 governs the identification codes and passwords behind electronic signatures: uniqueness, periodic revision, loss management for compromised tokens, transaction safeguards, and testing of token devices.",
    demonstrates: () => [],
    doesNotDemonstrate: () => [
      "Everything §11.300 asks. Authentication and credential management are outside Attest's scope (brief §4), Arc21 has no electronic signatures, and no Attest test examines identification codes, passwords or token issuance.",
    ],
    limitations: () => ["Not mapped: the brief listed §11.300 as a candidate, and the evidence does not support a mapping."],
    adjacent:
      "Two results touch session tokens and are named here only so they are not mistaken for §11.300 evidence: an expired JWT is refused at the API boundary (B.suite.expired-session), and a deleted account's still-valid token reads nothing of what survives the deletion (B.331–.333). Neither is an identification-code or password control.",
  },
];

/** The brief's WP6 minimum list, for the completeness check. */
export const BRIEF_MINIMUM: readonly string[] = ["NIST:AC-2", "NIST:AC-3", "NIST:AC-6", "NIST:AC-24", "NIST:AU-2", "NIST:AU-3", "NIST:AU-12", "NIST:CM-3", "NIST:SI-7", "P11:11.10(d)", "P11:11.10(e)", "P11:11.10(g)", "P11:11.300"];
