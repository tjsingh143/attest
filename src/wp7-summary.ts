/**
 * Attest — WP7 (c): the one-page plain-language summary (D3.61).
 *
 * For a reader with no technical background: what these controls do, why they
 * matter, and what the posture is — no jargon, no SQL. AI-drafted (Amendment A2)
 * and labelled so; every number is computed from the evidence. `validate-reports`
 * checks it for jargon, length and overclaiming, and re-derives its numbers.
 */
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";
import type { Facts } from "./evidence-facts.ts";

export const SUMMARY_PATH = join(ATTEST_ROOT, "SUMMARY.md");

/** Words a non-technical reader should not meet. The one cross-reference line is exempt. */
export const JARGON: readonly RegExp[] = [
  /\bSQL\b/, /\bPostgre(SQL|s)\b/i, /\bRLS\b/, /row-level/i, /SECURITY DEFINER/i, /BYPASSRLS/i, /\bJWT\b/, /\bschema\b/i, /\bmigrations?\b/i,
  /\bcatalogs?\b/i, /\btriggers?\b/i, /\bSupabase\b/i, /\bAPI\b/, /\bHTTP\b/, /\banon\b/, /\bauthenticated\b/, /\bgrants?\b/i, /\bpolic(y|ies)\b/i,
  /\bselect\b/, /\binsert\b/, /\bTest IDs?\b/, /\bWP\d\b/, /\bF\d+\b/, /\bRealtime\b/, /\btoken\b/i, /\bidempoten/i,
];
export const CROSS_REFERENCE = "*For readers of the technical report:";

export function renderSummary(f: Facts): string {
  const bv = f.wp3.byVerdict;
  const deficientOpen = f.wp5.items.filter((i) => i.evidenceClass === "deficient" && i.status === "open");
  const deficientAccepted = f.wp5.items.filter((i) => i.evidenceClass === "deficient" && i.status === "accepted_design_intent");
  const acceptedCount = deficientAccepted.reduce((n, i) => n + i.testIds.length, 0);
  const openCount = deficientOpen.reduce((n, i) => n + i.testIds.length, 0);
  const scope = f.wp5.scope;
  const L = [
    "# Arc21's data protections — a one-page summary",
    "",
    `*For readers without a technical background. Drafted by AI from the assessment's recorded results and not written by the author (Amendment A2); every number comes from the recorded tests. Results as of ${f.wp3.lastTimestamp.slice(0, 10)}.*`,
    "",
    "**What was checked.** Arc21 is a multiplayer card game its author built. Every player has things that should stay theirs: a balance of game chips, friends and blocked players, privacy settings, games in progress. The game's database carries rules that decide who may see or change each of these. The question here was simple: do those rules actually hold when someone tries to get around them?",
    "",
    `**How.** A test program pretended to be different players — and sometimes nobody at all, or a player whose account had just been deleted — and made ${f.wp3.total} attempts, from reading another player's chip balance to rewriting the record of chip movements. Each attempt was written down: what was tried, as whom, what should have happened, what did happen, and when. Before any of that counted, the program proved it could tell a working rule from one broken on purpose, in ${f.wp1.detected} of ${f.wp1.scenarios} deliberate tests.`,
    "",
    "**What was found.**",
    "",
    `- **${bv.effective} of the ${bv.total} attempts behaved exactly as intended.** Every direct attempt to read or change another player's own records, to get at data without signing in, or to change chips outside the game's own rules was stopped. The chip balance stayed correct even when two changes arrived at the same moment.`,
    `- **${bv.deficient} attempts showed a rule not holding.** ${openCount === 1 ? "One is still open" : `${openCount} are still open`}: a signed-in player who knows the long code that identifies another player's phone can use one of the game's own features to take over that phone's alert registration, so its owner may stop getting their alerts. How an attacker could learn that code was not tested. The other ${acceptedCount} show players with a private profile still named on leaderboards; the author decided that is intended, because leaderboards exist to show competitors.`,
    `- **${bv.gap} checks found no record of who changed what.** ${scope ? `For ${scope.trailRequired} kinds of important information — privacy settings, friendships and blocks, game results and prize chips, game rules and abuse limits — the author decided a history of changes should exist, and it does not yet. ` : ""}Without it, nobody could work out afterwards who changed an important setting or result.`,
    `- **${bv.characterized} results are facts rather than passes or fails**, and **${bv.not_measured} could not be measured** — for example, deleting an account removes everything it owned, so there was nothing left to test. Those ${bv.not_measured} are not counted as passes.`,
    "",
    "**What it means.** The direct protections that keep each player's own data to themselves held every time they were tested. The weaknesses are narrower: one built-in feature that lets a player take over another player's phone alerts, and the missing history of changes, which would make it hard to investigate a problem after the fact.",
    "",
    "**What this is not.** Nothing was fixed: the findings are recommendations for the game's author. The author tested their own game with a tool they wrote, so this is not an independent audit, and the game is not a regulated system. It covers the stored data and who can reach it — not passwords, the network, or the app's screens.",
    "",
    `${CROSS_REFERENCE} these are the ${bv.effective} effective, ${bv.deficient} deficient, ${bv.gap} gap, ${bv.characterized} characterized and ${bv.not_measured} not measured results of run ${f.runs.wp3}.*`,
    "",
  ];
  return L.join("\n");
}
