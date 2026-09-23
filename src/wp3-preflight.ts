/**
 * Attest — preflight for a WP3 run.
 *
 * Everything that must hold before 345 probes are allowed to touch the
 * instance. The checks fall into three groups and they fail for different
 * reasons:
 *
 *   the plan is intact        it is exactly the approved matrix (D3.35), with no
 *                             placeholder, bundled probe or identity that
 *                             disagrees with its own operation (D3.33)
 *   the world matches it      fixtures exist, roles have the properties the
 *                             plan assumes, the schema is the one planned
 *                             against, Realtime is healthy, every probe could
 *                             produce a verdict that means something (D3.36),
 *                             and Arc21 was not touched (D3.32)
 *   the author has spoken     every negative's intent sentence is the
 *                             author's, not the harness's
 *
 * The third group only gates a real execution (`forExecution`). Planning runs
 * pass with drafts in place, because reviewing drafts is what happens between
 * planning and execution.
 *
 * Preflight never repairs anything. A failed check is reported and the run does
 * not start.
 */
import type { Session } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import type { Wp3Plan } from "./wp3-plan.ts";
import { validatePlan } from "./wp3-validate-plan.ts";
import type { RiskInput } from "./risk-inputs.ts";
import { deriveAll, type ExecSpec } from "./wp3-exec.ts";
import { IMPLEMENTED_KEYS, verifySeedExtensions } from "./seed-extensions.ts";
import { loadIntentStore, validateIntents, requiresIntent } from "./author-intents.ts";
import {
  findContradictions,
  summarizeContradictions,
  checkIdentityConsistency,
  identitySubject,
  type IdentityCheck,
} from "./plan-contradictions.ts";
import { DB } from "./config.ts";
import { readSchemaVersion } from "./schema-version.ts";
import { loadApprovedManifest, compareToApproved, manifestReproducible, type ApprovedComparison } from "./wp3-approved.ts";
import { auditReadiness, checkAssertionCoverage, type ReadinessCheck } from "./wp3-readiness.ts";
import { checkScratchRoleProperties } from "./wp3-execute.ts";
import {
  captureArc21State,
  compareArc21State,
  describeArc21State,
  type Arc21SourceState,
  type Arc21Comparison,
} from "./arc21-guard.ts";
import { signJwt } from "./jwt.ts";

export interface Check {
  readonly group: "plan" | "world" | "author";
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
  /** Only gates a real execution, not a planning run. */
  readonly executionOnly?: boolean;
}

export interface PreflightResult {
  readonly checks: readonly Check[];
  readonly passed: boolean;
  readonly specs: ReadonlyMap<string, ExecSpec>;
  readonly blockedTestIds: readonly string[];
  /** The per-row structural blockers (D3.36), in full. */
  readonly readiness: readonly ReadinessCheck[];
  readonly identity: readonly IdentityCheck[];
  readonly approved: ApprovedComparison | null;
  readonly arc21: { readonly pre: Arc21SourceState | null; readonly post: Arc21SourceState | null; readonly comparison: Arc21Comparison | null };
}

const LOOPBACK = /^(127\.0\.0\.1|::1|localhost)$/;

export const REALTIME_HEALTH_URL =
  process.env.ATTEST_REALTIME_URL ?? "http://127.0.0.1:54321/realtime/v1/api/tenants/realtime-dev/health";
export const REST_URL = process.env.ATTEST_REST_URL ?? "http://127.0.0.1:54321/rest/v1/";

/** The role properties F7 and every control test rest on. Pure, so it can be proven by inversion. */
export function rolePropertiesHold(p: {
  postgresBypassRls: boolean;
  authenticatorBypassRls: boolean;
  authenticatorSuperuser: boolean;
}): boolean {
  return p.postgresBypassRls && !p.authenticatorBypassRls && !p.authenticatorSuperuser;
}

export async function preflight(
  plan: Wp3Plan,
  resources: readonly RiskInput[],
  opts: { forExecution: boolean; expectedSchemaSha?: string; arc21Pre?: Arc21SourceState },
): Promise<PreflightResult> {
  const checks: Check[] = [];
  const add = (group: Check["group"], name: string, passed: boolean, detail: string, executionOnly = false) =>
    checks.push({ group, name, passed, detail, executionOnly });

  // The Arc21 read-only guard brackets preflight too. The CLI brackets every
  // command, and passes its own "before" in; standing alone, preflight takes one.
  let arc21Pre: Arc21SourceState | null = opts.arc21Pre ?? null;
  let arc21PreError = "";
  if (!arc21Pre) {
    try {
      arc21Pre = await captureArc21State();
    } catch (err) {
      arc21PreError = (err as Error).message;
    }
  }

  // ======================================================================
  // 1. the plan is intact
  // ======================================================================
  const ids = plan.tests.map((t) => t.testId);
  const unique = new Set(ids);
  add("plan", "the plan carries 345 Test IDs", ids.length === 345, `${ids.length}`);
  add("plan", "every Test ID is unique", unique.size === ids.length, `${unique.size} unique of ${ids.length}`);

  const pol = { positive: 0, negative: 0, characterization: 0 } as Record<string, number>;
  for (const t of plan.tests) pol[t.polarity] = (pol[t.polarity] ?? 0) + 1;
  const sum = pol.positive! + pol.negative! + pol.characterization!;
  add(
    "plan",
    "polarity accounting reconciles",
    sum === ids.length && pol.positive === 63 && pol.negative === 240 && pol.characterization === 42,
    `${pol.positive} positive + ${pol.negative} negative + ${pol.characterization} characterization = ${sum}` +
      (pol.positive === 63 && pol.negative === 240 && pol.characterization === 42
        ? " — the frozen 63/240/42"
        : " — DIFFERS from the frozen 63/240/42; a change here is a contradiction to surface, not a number to accept"),
  );

  // The approved matrix, frozen (D3.35). A count cannot tell the approved 345
  // from 344 of them plus a substitute; this can.
  const manifest = await loadApprovedManifest();
  let approved: ApprovedComparison | null = null;
  if (!manifest) {
    add("plan", "the plan is the approved matrix", false, "rubric/wp3-approved-matrix.json is missing, so there is nothing to compare against");
  } else {
    approved = compareToApproved(plan, manifest);
    const a = approved;
    add(
      "plan",
      "the plan is the approved matrix: same Test IDs, same order, no frozen field changed",
      a.missing.length === 0 && a.extra.length === 0 && a.duplicated.length === 0 && !a.orderChanged && a.frozenDrift.length === 0,
      a.missing.length || a.extra.length || a.duplicated.length || a.orderChanged || a.frozenDrift.length
        ? [
            a.missing.length ? `${a.missing.length} approved Test ID(s) missing: ${a.missing.slice(0, 4).join(", ")}` : "",
            a.extra.length ? `${a.extra.length} Test ID(s) not in the approved matrix: ${a.extra.slice(0, 4).join(", ")}` : "",
            a.duplicated.length ? `${a.duplicated.length} duplicated: ${a.duplicated.slice(0, 4).join(", ")}` : "",
            a.orderChanged ? "the Test IDs are the approved set but in a different order" : "",
            a.frozenDrift.length ? `${a.frozenDrift.length} row(s) whose operation, expected, covers or other frozen field changed: ${a.frozenDrift.slice(0, 4).join(", ")}` : "",
          ].filter(Boolean).join("; ")
        : `${manifest.rows.length} approved Test IDs present in order; ${manifest.frozenFields.length} frozen fields unchanged on every row`,
    );
    const idCorr = manifest.corrections.filter((c) => c.field === "identity").length;
    const fxCorr = manifest.corrections.filter((c) => c.field === "fixture").length;
    add(
      "plan",
      "identities and fixtures differ from the approved run only by the listed corrections",
      a.identityDrift.length === 0 && a.fixtureDrift.length === 0,
      a.identityDrift.length || a.fixtureDrift.length
        ? [
            a.identityDrift.length ? `${a.identityDrift.length} unlisted identity change(s): ${a.identityDrift.slice(0, 3).join("; ")}` : "",
            a.fixtureDrift.length ? `${a.fixtureDrift.length} unlisted fixture change(s): ${a.fixtureDrift.slice(0, 4).join(", ")}` : "",
          ].filter(Boolean).join("; ")
        : `every identity and fixture matches the manifest, which lists ${idCorr} identity and ${fxCorr} fixture correction(s) to the approved run`,
    );
    const repro = await manifestReproducible(manifest);
    add(
      "plan",
      "the approved manifest is reproducible from the approved run plus its listed corrections",
      repro === null || repro.ok,
      repro === null
        ? `evidence/runs/${manifest.sourceRunId}/ is no longer in the tree; the manifest records its sha256 (${manifest.sourceMatrixSha256.slice(0, 16)}…) and git history holds it`
        : repro.detail,
    );
  }

  const semantic = validatePlan(plan, resources);
  add(
    "plan",
    "no placeholder, multi-probe or multi-identity row",
    semantic.length === 0,
    semantic.length ? `${semantic.length} issue(s): ${semantic.slice(0, 3).map((i) => `${i.testId} ${i.check}`).join("; ")}` : "semantic validation clean",
  );

  // Every planned row has exactly one implementation, and nothing else does.
  const { specs, failures } = deriveAll(plan);
  add(
    "plan",
    "implemented Test IDs equal planned Test IDs",
    failures.length === 0 && specs.size === ids.length,
    failures.length
      ? `${failures.length} row(s) have no executable derivation: ${failures.slice(0, 3).map((f) => f.testId).join(", ")}`
      : `${specs.size} of ${ids.length} derived, no extras`,
  );
  const extra = [...specs.keys()].filter((k) => !unique.has(k));
  add("plan", "no implementation without a planned row", extra.length === 0, extra.length ? extra.join(", ") : "none");

  // One Test ID, one probe — asserted over the derived specs, not the prose.
  const multi = [...specs.values()].filter((s) => {
    const dml = new Set([...s.statement.matchAll(/\b(insert|update|delete|truncate)\b/gi)].map((m) => m[1]!.toLowerCase()));
    return dml.size > 1;
  });
  add("plan", "one derived probe issues one mutating command", multi.length === 0, multi.length ? multi.map((s) => s.testId).join(", ") : "none bundles two");

  // Contradictions inside the approved plan.
  const contradictions = findContradictions(plan);
  const blocked = contradictions.map((c) => c.testId);
  add(
    "plan",
    "no Test ID carries an unresolved plan contradiction",
    contradictions.length === 0,
    contradictions.length
      ? summarizeContradictions(contradictions)
          .map((g) => `${g.id}: ${g.count} row(s) blocked — ${g.testIds.slice(0, 4).join(", ")}${g.count > 4 ? ", …" : ""}`)
          .join(" | ")
      : "none",
  );

  // C1's positive proof (D3.33), over every row rather than only F5.
  const identity = checkIdentityConsistency(plan);
  const badIdentity = identity.filter((c) => c.problems.length > 0);
  const f5 = identity.filter((c) => c.testId.startsWith("F5."));
  const f5Named = f5.filter((c) => identitySubject(c.identity) !== null);
  add(
    "plan",
    "every row's identity agrees with its operation, its expected result and the executor's caller",
    badIdentity.length === 0,
    badIdentity.length
      ? `${badIdentity.length} row(s): ${badIdentity.slice(0, 3).map((c) => `${c.testId} — ${c.problems[0]}`).join("; ")}`
      : `all ${identity.length} rows; F5: ${f5.length} rows, each one identity, the executor deriving exactly it ` +
        `(${f5Named.filter((c) => c.identity === "authenticated:alice").length} alice, ` +
        `${f5Named.filter((c) => c.identity === "authenticated:carol").length} carol, ` +
        `${f5Named.filter((c) => c.identity === "anon").length} anon)`,
  );

  const coverage = checkAssertionCoverage(plan, specs);
  add("plan", `[${coverage.id}] ${coverage.name}`, coverage.passed, coverage.detail);

  // ======================================================================
  // 2. the world matches it
  // ======================================================================
  add(
    "world",
    "the target is a disposable local instance",
    LOOPBACK.test(DB.host),
    `${DB.host}:${DB.port}/${DB.database}` +
      (LOOPBACK.test(DB.host) ? "" : " — REFUSED: this harness attempts unauthorized reads and writes"),
  );

  const sv = await readSchemaVersion();
  add(
    "world",
    "the schema under test is the one the plan was built against",
    !opts.expectedSchemaSha || sv.migrationSetSha256 === opts.expectedSchemaSha,
    `${sv.migrationSetSha256.slice(0, 16)}… over ${sv.migrationCount} migrations` +
      (opts.expectedSchemaSha && sv.migrationSetSha256 !== opts.expectedSchemaSha ? ` — expected ${opts.expectedSchemaSha.slice(0, 16)}…` : ""),
  );

  // The dirty checkout is a fact about the evidence, not a blocker. It is
  // recorded rather than normalised: the schema hash is computed from the
  // migration files as they are on disk, so a hash match means the files are
  // the planned ones whether or not they are committed.
  const git = sv.git;
  add(
    "world",
    "the system under test's git state is captured",
    typeof git?.commit === "string" && git.commit.length > 0,
    git
      ? `commit ${(git.commit ?? "(unknown)").slice(0, 12)} on ${git.branch}, dirty=${git.dirty}` +
        (git.uncommittedMigrations?.length
          ? `, ${git.uncommittedMigrations.length} uncommitted migration(s): ${git.uncommittedMigrations.join(", ")} — recorded on every evidence record, not normalised away`
          : ", no uncommitted migrations")
      : "no git metadata available",
  );

  // Seed extensions: required == implemented, and each verified live.
  const required = plan.seedExtensions.map((e) => e.key).sort();
  const implemented = [...IMPLEMENTED_KEYS].sort();
  const missingImpl = required.filter((k) => !implemented.includes(k));
  const extraImpl = implemented.filter((k) => !required.includes(k));
  add(
    "world",
    "every required seed extension has an implementation",
    missingImpl.length === 0 && extraImpl.length === 0,
    missingImpl.length || extraImpl.length
      ? `${missingImpl.length} unimplemented (${missingImpl.join(", ")}), ${extraImpl.length} implemented but not required (${extraImpl.join(", ")})`
      : `${required.length} required, ${implemented.length} implemented, sets equal`,
  );

  let readiness: ReadinessCheck[] = [coverage];
  let admin: Session | null = null;
  try {
    admin = await adminSession("preflight");

    const fixtureResults = await verifySeedExtensions(admin);
    const badFixtures = fixtureResults.filter((r) => !r.ok);
    add(
      "world",
      "every required fixture exists in the rebuilt instance",
      badFixtures.length === 0,
      badFixtures.length
        ? `${badFixtures.length} of ${fixtureResults.length} not satisfied: ${badFixtures.slice(0, 3).map((r) => `${r.key} (${r.detail})`).join("; ")}`
        : `all ${fixtureResults.length} verified live`,
    );

    // Every derived spec must name things that exist.
    const catalogIssues = await validateSpecsAgainstCatalog(admin, specs);
    add(
      "world",
      "every derived probe names a relation, column and function that exists",
      catalogIssues.length === 0,
      catalogIssues.length ? `${catalogIssues.length}: ${catalogIssues.slice(0, 3).join("; ")}` : `${specs.size} specs validated against the catalogs`,
    );

    // F7 assumes specific role properties. Assert them rather than trusting.
    const { rows } = await admin.query(
      `select rolname, rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname in ('postgres','authenticator','anon','authenticated','service_role')`,
    );
    const byRole = new Map(rows.map((r) => [r.rolname as string, r]));
    const pg = byRole.get("postgres");
    const authr = byRole.get("authenticator");
    add(
      "world",
      "role properties match what the plan assumes",
      rolePropertiesHold({
        postgresBypassRls: pg?.rolbypassrls === true,
        authenticatorBypassRls: authr?.rolbypassrls !== false,
        authenticatorSuperuser: authr?.rolsuper !== false,
      }),
      `postgres: bypassrls=${pg?.rolbypassrls} (F7 depends on this being true), ` +
        `authenticator: superuser=${authr?.rolsuper} bypassrls=${authr?.rolbypassrls} (control tests depend on both being false)`,
    );

    // The F7 mechanism's own scratch roles: built, measured and dropped.
    const scratch = await checkScratchRoleProperties(admin);
    add("world", "the F7 scratch roles can be built with exactly the properties the mechanism rests on", scratch.ok, scratch.detail);

    // The role-scoped session must genuinely be unprivileged. Open one.
    let scoped = "not attempted";
    let scopedOk = false;
    try {
      const s = await roleSession({ role: "authenticated", claims: { sub: "00000000-0000-4000-8000-00000000000a", role: "authenticated" }, label: "preflight:alice" });
      scopedOk = !s.identity.isSuperuser && !s.identity.bypassesRls && s.identity.authUid !== null;
      scoped = `current_user=${s.identity.currentUser}, superuser=${s.identity.isSuperuser}, bypassrls=${s.identity.bypassesRls}, auth.uid()=${s.identity.authUid ? "present" : "NULL"}`;
      await s.close();
    } catch (err) {
      scoped = `could not open a role-scoped session: ${(err as Error).message}`;
    }
    add("world", "a role-scoped session is genuinely unprivileged", scopedOk, scoped);

    // Would each verdict mean what it says? (D3.36)
    readiness = await auditReadiness(admin, plan, specs);
    for (const r of readiness.filter((x) => x.id !== coverage.id)) {
      add("world", `[${r.id}] ${r.name}`, r.passed, r.detail);
    }
  } finally {
    await admin?.close().catch(() => {});
  }

  // Realtime and PostgREST are only needed when the socket and HTTP cases run.
  const needsRealtime = [...specs.values()].some((s) => s.kind === "socket");
  if (needsRealtime) {
    const h = await realtimeHealthy(REALTIME_HEALTH_URL);
    add("world", "the local Realtime service is healthy and accepts a locally signed key", h.ok, h.detail, true);
    const ws = typeof (globalThis as { WebSocket?: unknown }).WebSocket === "function";
    add(
      "world",
      "this Node runtime has the global WebSocket the F8 socket probes use",
      ws,
      ws ? `Node ${process.version}: global WebSocket present` : `Node ${process.version} has no global WebSocket`,
      true,
    );
  }
  const needsHttp = [...specs.values()].some((s) => s.kind === "http");
  if (needsHttp) {
    const reach = await reachable(REST_URL);
    add("world", "the local PostgREST endpoint is reachable", reach.ok, reach.detail, true);
  }

  // ======================================================================
  // 3. the author has spoken
  // ======================================================================
  const store = await loadIntentStore();
  for (const v of validateIntents(plan, store, opts.forExecution)) {
    add("author", v.check, v.passed, v.detail, !v.blocksPlanningToo);
  }
  const needed = plan.tests.filter(requiresIntent).length;
  const drafts = store?.intents.filter((e) => e.provenance === "ai_draft").length ?? 0;
  add(
    "author",
    "no AI draft is permitted in a real run",
    // A missing store is not "no drafts": it is no sentences at all, and must
    // not read as the gate being satisfied.
    !opts.forExecution || (store !== null && drafts === 0),
    store === null
      ? "there is no canonical intent store, so none of the required sentences exists"
      : drafts === 0
        ? `none of the ${needed} intents is an ai_draft`
        : `${drafts} of ${needed} are still ai_draft — review them, then set provenance to user_reviewed_ai_draft or user_authored`,
    true,
  );

  // ======================================================================
  // last: Arc21 is exactly as preflight found it (D3.32)
  // ======================================================================
  let arc21Post: Arc21SourceState | null = null;
  let arc21Cmp: Arc21Comparison | null = null;
  if (arc21Pre) {
    try {
      arc21Post = await captureArc21State();
      arc21Cmp = compareArc21State(arc21Pre, arc21Post);
    } catch (err) {
      arc21PreError = `could not re-read the checkout: ${(err as Error).message}`;
    }
  }
  add(
    "world",
    "the Arc21 checkout is exactly as it was before preflight (read-only target)",
    arc21Cmp?.identical === true,
    arc21Cmp
      ? arc21Cmp.identical
        ? `unchanged — ${describeArc21State(arc21Post!)}`
        : `HARNESS SAFETY VIOLATION: ${arc21Cmp.differences.join("; ")}`
      : `the checkout could not be fingerprinted: ${arc21PreError}`,
  );

  const effective = checks.filter((c) => opts.forExecution || !c.executionOnly);
  return {
    checks,
    passed: effective.every((c) => c.passed),
    specs,
    blockedTestIds: blocked,
    readiness,
    identity,
    approved,
    arc21: { pre: arc21Pre, post: arc21Post, comparison: arc21Cmp },
  };
}

/** Relations, columns and functions a derived probe names must exist. */
async function validateSpecsAgainstCatalog(
  admin: Session,
  specs: ReadonlyMap<string, ExecSpec>,
): Promise<string[]> {
  const issues: string[] = [];

  const rels = new Set<string>();
  for (const s of specs.values()) {
    // INSERT/UPDATE/TRUNCATE targets are always relations.
    for (const m of s.statement.matchAll(/\b(?:into|update|truncate)\s+((?:public|private|realtime)\.[a-z_0-9]+)/gi)) {
      rels.add(m[1]!.toLowerCase());
    }
    // After FROM it may be a function call instead. Capturing the following
    // "(" and testing it in code, rather than using a negative lookahead:
    // against `insert into public.blocks (blocker_id)` a lookahead lets the
    // engine backtrack to `public.block` — which satisfies it — and preflight
    // then reported three relations that do not exist. The bug was real and
    // the check caught it; the check's own regex was what needed fixing.
    for (const m of s.statement.matchAll(/\bfrom\s+((?:public|private|realtime)\.[a-z_0-9]+)(\s*\()?/gi)) {
      if (!m[2]) rels.add(m[1]!.toLowerCase());
    }
  }
  if (rels.size) {
    const { rows } = await admin.query(
      `select n.nspname || '.' || c.relname as rel from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname || '.' || c.relname = any($1)`,
      [[...rels]],
    );
    const found = new Set(rows.map((r) => (r.rel as string).toLowerCase()));
    for (const r of rels) if (!found.has(r)) issues.push(`relation ${r} does not exist`);
  }

  const fns = new Map<string, string>();
  for (const s of specs.values()) if (s.functionCall) fns.set(s.functionCall, s.testId);
  if (fns.size) {
    const { rows } = await admin.query(
      `select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private')`,
    );
    const sigs = new Set(rows.map((r) => r.sig as string));
    for (const [sig, testId] of fns) if (!sigs.has(sig)) issues.push(`${testId}: no function ${sig}`);
  }

  // Placeholders must all be resolved to literals by now — in the statements
  // that are executed verbatim. The composite kinds carry a DESCRIPTION here
  // and their runner builds the real statement (and resolves the fixture) at
  // execution time, recording the concrete form on the evidence record.
  const VERBATIM = new Set(["sql", "rpc", "catalog", "audit_absence"]);
  for (const s of specs.values()) {
    if (/<[^>]{2,80}>/.test(s.statement)) issues.push(`${s.testId}: unresolved placeholder in the derived statement`);
    if (VERBATIM.has(s.kind) && /fixtures\./.test(s.statement)) {
      issues.push(`${s.testId}: an unresolved fixture reference reached an executable statement`);
    }
  }

  // Columns. This check's name has always said "column", and until D3.36 it
  // checked none: a derived statement naming a column that does not exist
  // passed preflight and would have raised 42703 at execution — which
  // MALFORMED_PROBE correctly refuses to count as a refusal, so the row would
  // have been recorded deficient. PREPARE parses and resolves every name and
  // type without executing anything and without consulting a privilege, so
  // compiling each statement as admin is an exact, side-effect-free test of
  // "the probe says something the catalog can mean". TRUNCATE cannot be
  // prepared; its only name, the relation, is checked above.
  for (const s of specs.values()) {
    if (s.kind !== "sql" && s.kind !== "rpc") continue;
    if (/^\s*truncate\b/i.test(s.statement)) continue;
    try {
      await admin.query(`prepare attest_preflight_probe as ${s.statement}`);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      issues.push(`${s.testId}: the derived statement does not compile (${e.code ?? "?"} ${e.message ?? String(err)})`);
      continue;
    } finally {
      await admin.query(`deallocate all`).catch(() => {});
    }
  }

  return issues;
}

export async function reachable(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const ctl = AbortSignal.timeout(4000);
    const res = await fetch(url, { signal: ctl });
    return { ok: true, detail: `${url} -> HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: `${url} unreachable: ${(err as Error).message}` };
  }
}

/**
 * Realtime is healthy, and a key signed here is accepted in front of it.
 *
 * "Reachable" used to mean any HTTP answer, and the tenant health route answers
 * 403 to a request with no key — so a service refusing every client would have
 * passed. Presenting an anon key signed in memory from the local stack's
 * secret checks two things the F8 socket probes rest on: that the service
 * reports itself healthy, and that the harness's signing secret is the one the
 * gateway verifies against. The key is never written anywhere.
 */
export async function realtimeHealthy(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const key = await signJwt({ role: "anon" });
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    let healthy = false;
    try {
      healthy = (JSON.parse(body) as { data?: { healthy?: boolean } }).data?.healthy === true;
    } catch {
      /* not JSON — not healthy */
    }
    return {
      ok: res.status === 200 && healthy,
      detail: `${url} -> HTTP ${res.status}${healthy ? ", healthy: true" : `, not reporting healthy: ${body.slice(0, 80)}`}`,
    };
  } catch (err) {
    return { ok: false, detail: `${url} unreachable: ${(err as Error).message}` };
  }
}

export function renderPreflight(r: PreflightResult, forExecution: boolean): string {
  const L: string[] = [];
  for (const g of ["plan", "world", "author"] as const) {
    const rows = r.checks.filter((c) => c.group === g);
    if (!rows.length) continue;
    L.push(`  ${g}:`);
    for (const c of rows) {
      const gating = !forExecution && c.executionOnly;
      const mark = c.passed ? "ok  " : gating ? "note" : "FAIL";
      L.push(`    ${mark} ${c.name}${gating ? " (execution-only)" : ""}`);
      L.push(`         ${c.detail}`);
    }
  }
  return L.join("\n");
}

/** Every structural blocker, one line per Test ID. */
export function renderReadiness(r: PreflightResult): string {
  const L: string[] = [];
  for (const c of r.readiness.filter((x) => !x.passed)) {
    L.push(`    ${c.id} — ${c.name}: ${c.testIds.length} row(s)`);
    for (const row of c.rows) L.push(`      ${row.testId.padEnd(42)} ${row.why}`);
  }
  return L.join("\n");
}
