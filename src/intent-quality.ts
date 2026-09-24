/**
 * Attest — quality validation of the AI-drafted intent sentences.
 *
 * The first generation pass is not to be trusted. A draft that reads fluently
 * can still be wrong about the thing that matters: it can call a legitimate
 * shared-session read "another user's row", claim privilege escalation where
 * only an ordinary row policy is being exercised, describe a confidentiality
 * attack against an integrity-only probe, or say the same thing about two
 * probes that simulate materially different attacks.
 *
 * None of those are caught by reading the sentence. They are caught by reading
 * the sentence *against its row*, which is what this module does.
 *
 * Every check here is a statement about correspondence between a draft and the
 * approved matrix row it belongs to. A failure is a defect in the draft, never
 * a reason to change the row.
 */
import type { PlannedTest, Wp3Plan } from "./wp3-plan.ts";
import { requiresIntent } from "./author-intents.ts";
import { effectiveActor } from "./plan-contradictions.ts";

export interface QualityIssue {
  readonly check: string;
  readonly testId: string;
  readonly problem: string;
  readonly draft: string;
}

/** Openers that describe the test rather than the attack. */
const BANNED_OPENERS =
  /^(test|verify|check|ensure|confirm|assert|validate|make sure|demonstrate)s?\b/i;

/** Words that mean "the database said no", which is the expectation, not the attack. */
const OUTCOME_LEAK =
  /\b(sqlstate|42501|23514|returns? (zero|0|no) rows?|raises? an error|is refused with|error code)\b/i;

/** Raw SQL rather than an objective. */
const SQL_PARAPHRASE = /\b(select\s+\*|from\s+public\.|where\s+[a-z_]+\s*=|insert\s+into\s+public\.)/i;

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/** The membership relation a participation policy turns on, if any. */
function membershipKind(t: PlannedTest): "session" | "room" | "tournament" | null {
  if (/is_session_participant/.test(t.covers)) return "session";
  if (/caller_is_room_member/.test(t.covers)) return "room";
  if (/viewer_is_in_tournament/.test(t.covers)) return "tournament";
  return null;
}

export function validateDraftQuality(
  plan: Wp3Plan,
  drafts: ReadonlyMap<string, string>,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const byId = new Map(plan.tests.map((t) => [t.testId, t]));
  const add = (check: string, testId: string, problem: string) =>
    issues.push({ check, testId, problem, draft: drafts.get(testId) ?? "(none)" });

  const required = plan.tests.filter(requiresIntent);
  const requiredIds = new Set(required.map((t) => t.testId));

  // ---- correspondence: the set itself ------------------------------------
  for (const t of required) {
    if (!drafts.has(t.testId)) add("a draft exists for every negative", t.testId, "no draft was generated");
  }
  for (const id of drafts.keys()) {
    if (!requiredIds.has(id)) {
      const t = byId.get(id);
      add(
        "no draft for a row that needs none",
        id,
        t
          ? `this row is ${t.polarity}${t.verdictWhenPredicted === "gap" ? " (a gap assessment, not an attack)" : ""} and must not carry an intent`
          : "this Test ID is not in the matrix at all",
      );
    }
  }

  // ---- per-draft checks ---------------------------------------------------
  for (const t of required) {
    const d = drafts.get(t.testId);
    if (!d) continue;
    const low = d.toLowerCase();
    const fam = t.family.split(" ")[0]!;

    // Exactly one sentence.
    const terminators = (d.match(/[.!?](\s|$)/g) ?? []).length;
    if (terminators !== 1) add("exactly one sentence", t.testId, `${terminators} sentence terminators`);
    if (d.trim().length < 40) add("says something", t.testId, `only ${d.trim().length} characters`);
    if (d.trim().length > 400) add("not materially broader than the probe", t.testId, `${d.trim().length} characters — a one-sentence intent this long is describing more than one probe can prove`);

    if (BANNED_OPENERS.test(d.trim())) add("names the attack, not the test", t.testId, `opens with "${d.trim().split(" ")[0]}"`);

    // A composed sentence can say the same thing twice when the actor phrase
    // and the object phrase both carry the relational clause — "a player
    // holding no seat reads another player's hand at a table where they hold
    // no seat". Reading catches it; no other check here does.
    {
      // Only the part this module composed. Everything after a colon is the
      // planner's own approved `escalationWouldBe` text, and repetition there
      // is the plan's wording, not a defect in the draft.
      const composed = d.includes(": ") ? d.slice(0, d.lastIndexOf(": ")) : d;
      const words = norm(composed).split(" ");
      const seen = new Map<string, number>();
      for (let k = 0; k + 2 < words.length; k++) {
        const tri = `${words[k]} ${words[k + 1]} ${words[k + 2]}`;
        if (/^(the|a|an|of|to|and|that|they|their|it|is|in|on|at|for|with|not|no|so) /.test(tri)) continue;
        seen.set(tri, (seen.get(tri) ?? 0) + 1);
      }
      const repeated = [...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w);
      if (repeated.length) {
        add("says each thing once", t.testId, `repeats "${repeated[0]}" within the sentence`);
      }
      // Two composed fragments can also collide on a single word — "…gets
      // someone in in that room" — which no trigram check sees.
      const doubled = /\b(\w+)\s+\1\b/i.exec(composed);
      if (doubled) add("says each thing once", t.testId, `doubled word: "${doubled[0]}"`);
    }
    // Article agreement: composed fragments meet at "a" + noun, and a noun that
    // starts with a vowel sound produced "naming a other party" in four drafts.
    {
      const aVowel = /\ba (?!u(?:s|ni|uid)|one\b|eu)([aeiou][a-z]*)/i.exec(d);
      const anConsonant = /\ban (?!h(?:our|onest|onou?r))([b-df-hj-np-tv-z][a-z]*)/i.exec(d);
      if (aVowel) add("article agreement", t.testId, `"a ${aVowel[1]}" — the noun takes "an" (or "another")`);
      if (anConsonant) add("article agreement", t.testId, `"an ${anConsonant[1]}" — the noun takes "a"`);
      // Number agreement: "naming a notification ids that is not theirs".
      const aPlural = /\ban? (?:[a-z]+ )?(ids|tokens|rows|notifications|requests|entries)\b/i.exec(d);
      const pluralIs = /\b(ids|tokens|rows|notifications|requests|entries) that is\b/i.exec(d);
      if (aPlural) add("number agreement", t.testId, `"${aPlural[0]}" — a singular article on a plural noun`);
      if (pluralIs) add("number agreement", t.testId, `"${pluralIs[0]}" — a plural noun with a singular verb`);
    }
    if (OUTCOME_LEAK.test(d)) add("describes the objective, not the expected error", t.testId, `mentions the outcome: "${(OUTCOME_LEAK.exec(d) ?? [])[0]}"`);
    if (SQL_PARAPHRASE.test(d)) add("not a paraphrase of the SQL", t.testId, `contains SQL: "${(SQL_PARAPHRASE.exec(d) ?? [])[0]}"`);

    // ---- identity correspondence -----------------------------------------
    // Checked against the EFFECTIVE actor. Where a row's identity column and
    // its operation disagree (contradiction C1), that disagreement is a defect
    // in the plan and is reported there, not charged to the draft.
    const id = effectiveActor(t);
    if (id.startsWith("anon") && !/signed-out|no account|without ever signing in|not signed in/.test(low)) {
      add("actor matches the identity", t.testId, "runs as anon but the sentence does not say the actor is signed out");
    }
    if (!id.startsWith("anon") && /signed-out visitor|no account at all/.test(low) && fam !== "F4") {
      add("actor matches the identity", t.testId, `runs as ${id} but the sentence describes a signed-out actor`);
    }
    if (id.includes("NO claims") && !/no identity|without (any )?identity|no claims/.test(low)) {
      add("actor matches the identity", t.testId, "null-identity boundary, but the sentence does not describe an absent identity");
    }
    if (id.includes("deleted account") && !/deleted|outlived/.test(low)) {
      add("actor matches the identity", t.testId, "deleted-user boundary, but the sentence does not mention the deleted account");
    }
    if (id.includes("server-side") && !/server/.test(low)) {
      add("actor matches the identity", t.testId, "runs on the privileged server path, but the sentence does not say so");
    }

    // ---- defect classes the 2026-09-24 audit found by reading ------------
    // Each is a correspondence between the sentence and the row, and each was
    // present in the store the previous pass handed over.
    //
    // (1) A deleted-user probe reads the deleted account's OWN former rows
    //     (`where <owner column> = dave`); the old drafts said "another
    //     player's", or named the resource with no owner at all. Stated as a
    //     requirement, because the negative form caught six of the fourteen.
    if (id.includes("deleted account") && (!/\bthat account\b|\bthe deleted account's\b/.test(low) || /\banother (player|account|user)('s)?\b|\bbetween two other\b/.test(low))) {
      add("the deleted-user target is the deleted account's own rows", t.testId,
        "the probe filters on the deleted account's own owner column, but the sentence does not place what is read under that account");
    }
    // (2) "that table" / "that room" / "that tournament" before one has been
    //     introduced.
    {
      const m = /\bthat (table|room|tournament)\b/i.exec(d);
      if (m && !new RegExp(`\\b(a|an|the|its|their) (private )?${m[1]}\\b`, "i").test(d.slice(0, m.index))) {
        add("no dangling reference", t.testId, `says "${m[0]}" before any ${m[1]} has been introduced`);
      }
    }
    // (3) The direction of a block. Where the caller is the BLOCKER (alice
    //     blocked dave), a sentence about "someone who has blocked them" states
    //     the opposite relationship from the one the probe exercises.
    if (/alice has blocked/i.test(`${t.operation} ${t.covers}`) && /\b(who|that) ha(s|ve) blocked (them|the caller)\b|\bhas blocked them\b/.test(low)) {
      add("the block's direction matches the probe", t.testId,
        "in this probe the caller is the one who placed the block, but the sentence says the other account blocked the caller");
    }
    // (4) An anonymous caller has no position of its own to compare against.
    if (id.startsWith("anon") && /\b(before or after their own|who else|their own (entry|attempt|score|queue))\b/.test(low)) {
      add("an anonymous actor has no account of its own", t.testId, "describes the anonymous caller as holding an entry, attempt or queue position of their own");
    }
    // (5) "Housekeeping over other accounts' rows" is true of three functions,
    //     and the approved row says so; claiming it anywhere else is false.
    if (/housekeeping/.test(low) && !/other accounts'|expire_stale/i.test(t.covers)) {
      add("no shared effect the function does not have", t.testId,
        "claims housekeeping over other accounts' rows, but the approved row records no such legitimate shared effect for this function");
    }

    // ---- membership semantics (the D3.11 correction) ----------------------
    const mk = membershipKind(t);
    if (mk && id.includes("carol")) {
      const says =
        (mk === "session" && /no seat|not seated|holds no seat/.test(low)) ||
        (mk === "room" && /not a member|no membership/.test(low)) ||
        (mk === "tournament" && /not entered|has not entered|no entry/.test(low));
      if (!says) {
        add(
          "membership, not ownership",
          t.testId,
          `access here is decided by ${mk} membership, so the sentence must turn on the actor not being a ${mk} participant`,
        );
      }
      if (/another (player's|user's|account's) row\b/.test(low)) {
        add(
          "membership, not ownership",
          t.testId,
          "calls this 'another player's row' when access is decided by shared membership — a co-participant's row IS legitimately readable here",
        );
      }
    }

    // ---- escalation claims only where escalation is the subject -----------
    if (/escalat|elevat(e|ed|ing) privile|becomes? an admin|superuser/.test(low) && fam !== "F5") {
      add(
        "no escalation claim on an ordinary policy test",
        t.testId,
        `${fam} exercises an ordinary policy or grant, but the sentence claims privilege escalation`,
      );
    }
    // FORCE and BYPASSRLS belong to F7, which has no negatives at all.
    if (/bypassrls|force row level|forced rls/i.test(d)) {
      add(
        "no FORCE/BYPASSRLS claim outside the F7 mechanism",
        t.testId,
        "mentions FORCE or BYPASSRLS; F7 is characterization-only and carries no attack intents",
      );
    }

    // ---- family-specific --------------------------------------------------
    if (fam === "F4") {
      const isPredicateRow = /the unsatisfied branch of/.test(t.covers);
      if (isPredicateRow && !/withdrawn|retired|cancelled|not published|out of the public/.test(low)) {
        add(
          "intended anonymous reads are not called unauthorized",
          t.testId,
          "this row falsifies the publication predicate, so the sentence must be about reaching content deliberately withheld from the catalogue, not about anonymous reading as such",
        );
      }
      if (!isPredicateRow && /deliberately readable|published by design|readable by design/.test(low)) {
        add(
          "intended anonymous reads are not called unauthorized",
          t.testId,
          "describes the data as intentionally public while asserting an attack against reading it",
        );
      }
    }

    if (fam === "F5") {
      const fn = t.resource.replace(/^public\./, "").split("(")[0]!.trim();
      if (!d.includes(fn)) {
        add("function-specific, not generic", t.testId, `does not name ${fn}(), so it could be about any SECURITY DEFINER function`);
      }
    }

    if (fam === "F6") {
      if (!/column/.test(low)) {
        add("column boundary, not row authorization", t.testId, "F6 tests a column privilege, but the sentence does not mention a column");
      }
      if (/another (player|user|account)'s row|somebody else's row/.test(low)) {
        add(
          "column boundary, not row authorization",
          t.testId,
          "describes reaching another account's row; these probes act on a row the caller legitimately owns and turn on the column grant",
        );
      }
    }

    if (fam === "F8") {
      const socket = /#realtime-socket/.test(t.control);
      if (socket && !/websocket|socket|client/.test(low)) {
        add("socket and SQL layers are distinguished", t.testId, "an integration case, but the sentence does not place it at the client/socket layer");
      }
      if (!socket && /websocket|socket/.test(low)) {
        add("socket and SQL layers are distinguished", t.testId, "a SQL-layer policy test, but the sentence describes a websocket client");
      }
    }

    if (fam === "F9") {
      const wantsIdem = /SAME idempotency key/i.test(t.operation);
      const wantsOverdebit = /debit larger than the balance/i.test(t.operation);
      if (wantsIdem && !/twice|two times|duplicate|retr(y|ied)/.test(low)) {
        add("concurrency/idempotency/over-debit/immutability are distinguished", t.testId, "the idempotency probe's sentence does not describe a repeated application");
      }
      if (wantsOverdebit && !/negative|more than|larger than|overdraw|exceed/.test(low)) {
        add("concurrency/idempotency/over-debit/immutability are distinguished", t.testId, "the over-debit probe's sentence does not describe driving the balance below zero");
      }
      if (!wantsIdem && !wantsOverdebit && !/ledger/.test(low)) {
        add("concurrency/idempotency/over-debit/immutability are distinguished", t.testId, "an append-only ledger probe whose sentence does not mention the ledger");
      }
    }

    if (fam === "F10") {
      if (!/record|trail|ledger|evidence|stream|trace|history/.test(low)) {
        add("audit tampering, not ordinary write isolation", t.testId, "does not describe interfering with a record of what happened");
      }
      if (/no (audit )?trail exists|there is no record|missing audit/.test(low)) {
        add("an absence is not an attack", t.testId, "describes the absence of a trail; those rows are gap assessments and carry no intent");
      }
    }

    // ---- integrity vs confidentiality -------------------------------------
    const v = /\b(insert|update|delete|truncate)\b/i.test(t.operation);
    const readsOnly = /^\s*select/i.test(t.operation) || /\bselect from\b/i.test(t.operation);
    if (v && !readsOnly && /\b(reads?|learns?|sees?|discovers?|obtains?|enumerates?)\b/.test(low) && !/\bto (read|learn|see)\b/.test(low)) {
      const writeWord = /\b(writ|forg|alter|rewrit|delet|erase|creat|inject|chang|plant|destroy|set|add|remov|grant|strip|pad|clear|consume|empt|edit|move|publish|subscrib|regist|claim|trigger|pull|drive|apply|manufactur|sever|redirect|eject|withdraw|conjur|discard|inflat|falsif|revok|resum|jump|flood|take)/.test(low);
      if (!writeWord) {
        add(
          "integrity wording for an integrity probe",
          t.testId,
          "the probe issues a write, but the sentence describes only reading",
        );
      }
    }
    // "a deleted user's credentials" is not a write; strip the boundary
    // wording before looking for write verbs.
    const lowNoDeletedActor = low.replace(/deleted (account|user)('s)?/g, "expired-subject");
    if (readsOnly && !v && /\b(rewrites?|forges?|deletes?|destroys?|injects?|falsifies)\b/.test(lowNoDeletedActor)) {
      add(
        "confidentiality wording for a confidentiality probe",
        t.testId,
        "the probe only reads, but the sentence describes modifying data",
      );
    }

    // ---- generic fallback text escaped ------------------------------------
    if (/they are not entitled to (create|change|remove)|data held in .* that the caller is not entitled to/.test(low)) {
      add("resource-specific, not generic", t.testId, `fell back to generic wording — ${t.resource} has no lexicon entry`);
    }
  }

  // ---- duplicate / near-duplicate wording ---------------------------------
  const entries = [...drafts.entries()].filter(([id]) => requiredIds.has(id));
  const exact = new Map<string, string[]>();
  for (const [id, d] of entries) {
    const k = norm(d);
    exact.set(k, [...(exact.get(k) ?? []), id]);
  }
  for (const [, ids] of exact) {
    if (ids.length < 2) continue;
    // Identical wording is only acceptable when the rows are the same attack on
    // the same resource — which, with one Test ID per probe, they never are.
    add(
      "no two probes share a sentence",
      ids[0]!,
      `${ids.length} probes carry identical wording: ${ids.join(", ")}`,
    );
  }
  // Near-duplicates across DIFFERENT resources hide a materially different
  // objective behind the same words.
  const tok = entries.map(([id, d]) => ({ id, t: byId.get(id)!, s: tokens(d) }));
  for (let i = 0; i < tok.length; i++) {
    for (let j = i + 1; j < tok.length; j++) {
      const a = tok[i]!, b = tok[j]!;
      if (a.t.resource === b.t.resource) continue;
      if (jaccard(a.s, b.s) >= 0.92) {
        add(
          "near-duplicate wording across different resources",
          a.id,
          `reads almost identically to ${b.id} (${a.t.resource} vs ${b.t.resource})`,
        );
      }
    }
  }

  return issues;
}
