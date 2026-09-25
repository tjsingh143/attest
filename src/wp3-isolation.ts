/**
 * Attest — probe isolation by rebuild (R7).
 *
 * The author's decision, implemented literally:
 *
 *   STATE-CHANGING PROBE → COMMIT → PRIVILEGED STATE GUARD → REBUILD THE
 *   DISPOSABLE DATABASE → VERIFY THE BASELINE → NEXT PROBE
 *
 * The previous executor ran all 345 probes in autocommit on one instance with
 * nothing restored between them, so a probe that deleted the seeded alice→dave
 * block changed the premise of six probes after it (D3.36). The obvious
 * alternative — one transaction per probe, rolled back — cannot evaluate a
 * privileged state guard without granting `service_role` table privileges,
 * which would change Arc21's grants. Hand-written undo steps were ruled out by
 * the author as the primary mechanism. So a probe that changes state is
 * followed by a full rebuild from Arc21's migrations, the same path `bringup`
 * takes, and the rebuilt baseline is verified before anything else runs.
 *
 * A probe is treated as state-changing when EITHER
 *
 *   - it is statically classified so (`writesWhenControlHolds`, or it applies
 *     a probe-scoped setup), OR
 *   - a whole-database content digest taken after it differs from the one
 *     taken after the last rebuild.
 *
 * The second is what keeps an unexpected write — a control that failed, a
 * refused statement that still advanced a sequence — from leaking into the next
 * probe. It is measured, not assumed.
 *
 * "Verified" means: the schema is the planned one; every baseline fixture's
 * own verification holds; every table holds the same number of rows as it did
 * after the first rebuild of this run; the control surface (policies, grants,
 * triggers, roles, function bodies) digests to the same value; Realtime and
 * PostgREST answer; and Arc21's checkout is exactly as it was before the run.
 * Any failure stops execution — a probe is never run on a baseline that could
 * not be verified.
 */
import type { Session } from "./db.ts";
import { adminSession, withSession } from "./db.ts";
import { bringup } from "./bringup.ts";
import { applySeedExtensions, verifySeedExtensions } from "./seed-extensions.ts";
import { readSchemaVersion } from "./schema-version.ts";
import { captureArc21State, compareArc21State, type Arc21SourceState } from "./arc21-guard.ts";
import { signJwt } from "./jwt.ts";

export const REALTIME_HEALTH =
  process.env.ATTEST_REALTIME_URL ?? "http://127.0.0.1:54321/realtime/v1/api/tenants/realtime-dev/health";
export const REST_BASE = process.env.ATTEST_REST_URL ?? "http://127.0.0.1:54321/rest/v1";

/** Relations whose contents make up "the state". */
const STATE_SCHEMAS = ["public", "private"] as const;
const STATE_EXTRA = ["realtime.messages", "auth.users"] as const;

export async function stateRelations(admin: Session): Promise<string[]> {
  const { rows } = await admin.query(
    `select n.nspname || '.' || c.relname as rel
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1) and c.relkind in ('r','p') and not c.relispartition
      order by 1`,
    [[...STATE_SCHEMAS]],
  );
  return [...rows.map((r) => r.rel as string), ...STATE_EXTRA];
}

/** Per-relation content digest: md5 over every row's text, in a total order. */
export async function stateDigest(admin: Session, rels?: readonly string[]): Promise<Record<string, string>> {
  const list = rels ?? (await stateRelations(admin));
  const parts = list.map(
    (r) => `select '${r}' as rel, md5(coalesce(string_agg(x::text, E'\\n' order by x::text), '')) || ':' || count(*)::text as d from ${r} x`,
  );
  const { rows } = await admin.query(parts.join("\nunion all\n"));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.rel as string] = r.d as string;
  // Sequences advance even when a statement is refused afterwards; include them
  // so a refused-but-sequence-consuming write still counts as a change.
  const seq = await admin.query(
    `select schemaname || '.' || sequencename as s, coalesce(last_value, 0)::text as v
       from pg_sequences where schemaname = any($1) order by 1`,
    [[...STATE_SCHEMAS]],
  );
  for (const r of seq.rows) out[`seq:${r.s as string}`] = r.v as string;
  return out;
}

export function diffDigests(a: Record<string, string>, b: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]).sort();
}

/**
 * The control surface, digested: every policy (and its expressions), every
 * relation's ACL and RLS flags, every function's ACL, definer flag and body,
 * every trigger and whether it is enabled, and the attributes and memberships
 * of the roles a probe can reach. A probe that altered any of it — or a scratch
 * object left behind — changes this value.
 */
export async function catalogDigest(admin: Session): Promise<string> {
  const q = await admin.query(`
    select md5(string_agg(line, E'\\n' order by line)) as d from (
      select 'policy ' || schemaname || '.' || tablename || ' ' || policyname || ' ' || cmd || ' ' || permissive || ' ' ||
             roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') as line
        from pg_policies where schemaname in ('public','private','realtime')
      union all
      select 'rel ' || n.nspname || '.' || c.relname || ' ' || coalesce(c.relacl::text, '') || ' ' ||
             c.relrowsecurity::text || ' ' || c.relforcerowsecurity::text || ' ' || pg_get_userbyid(c.relowner)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
      union all
      select 'fn ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' ||
             coalesce(p.proacl::text, '') || ' ' || p.prosecdef::text || ' ' || md5(p.prosrc)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private')
      union all
      select 'trg ' || t.tgrelid::regclass::text || ' ' || t.tgname || ' ' || t.tgenabled::text
        from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
       where not t.tgisinternal and n.nspname in ('public','private')
      union all
      select 'role ' || rolname || ' ' || rolsuper::text || ' ' || rolbypassrls::text || ' ' || rolinherit::text || ' ' ||
             rolcanlogin::text || ' ' || rolcreaterole::text
        from pg_roles where rolname in ('postgres','authenticator','anon','authenticated','service_role') or rolname like 'attest%'
      union all
      select 'member ' || m.roleid::regrole::text || ' <- ' || m.member::regrole::text
        from pg_auth_members m
       where m.roleid::regrole::text in ('anon','authenticated','service_role','postgres','authenticator')
          or m.member::regrole::text in ('anon','authenticated','service_role','authenticator')
          or m.roleid::regrole::text like 'attest%' or m.member::regrole::text like 'attest%'
      union all
      select 'schema ' || nspname || ' ' || coalesce(nspacl::text, '')
        from pg_namespace where nspname in ('public','private','realtime') or nspname like 'attest%'
    ) x`);
  return q.rows[0]!.d as string;
}

/**
 * Rows naming particular accounts, as sorted [relation, row text] pairs: for
 * every state relation, the rows whose text names any of `include` and none of
 * `exclude`. The caller-scoped F5 guards use it — "no row naming bob or carol
 * and not alice changes" — reading each row's full text, so a reference inside
 * a jsonb column counts as much as one in a foreign key. The rows themselves are
 * kept, not a hash, so a guard that fails can say WHICH rows changed.
 * `auth.users` rows are represented by id and md5 only: their text carries
 * password hashes, which have no place in an evidence record.
 */
export async function accountRowsSnapshot(admin: Session, include: readonly string[], exclude: readonly string[]): Promise<string> {
  const rels = await stateRelations(admin);
  const inc = include.map((u) => `x::text like '%${u}%'`).join(" or ");
  const exc = exclude.map((u) => `x::text not like '%${u}%'`).join(" and ") || "true";
  const parts = rels.map((r) => r === "auth.users"
    ? `select '${r}' as rel, 'id=' || x.id::text || ' md5=' || md5(x::text) as t from ${r} x where (${inc}) and ${exc}`
    : `select '${r}' as rel, x::text as t from ${r} x where (${inc}) and ${exc}`);
  const { rows } = await admin.query(`select rel, t from (${parts.join("\nunion all\n")}) y order by rel, t`);
  return JSON.stringify(rows.map((r) => [String(r.rel), String(r.t)]));
}

/** Which rows of two account-row snapshots differ: gone (or altered away), and new (or altered to). */
export function diffAccountRows(before: string, after: string): { removed: [string, string][]; added: [string, string][] } {
  const a = JSON.parse(before || "[]") as [string, string][];
  const b = JSON.parse(after || "[]") as [string, string][];
  const key = (p: [string, string]) => `${p[0]}\t${p[1]}`;
  const inA = new Set(a.map(key)), inB = new Set(b.map(key));
  return { removed: a.filter((p) => !inB.has(key(p))), added: b.filter((p) => !inA.has(key(p))) };
}

export async function rowCounts(admin: Session): Promise<Record<string, number>> {
  const rels = await stateRelations(admin);
  const { rows } = await admin.query(rels.map((r) => `select '${r}' as rel, count(*)::int as n from ${r}`).join("\nunion all\n"));
  return Object.fromEntries(rows.map((r) => [r.rel as string, r.n as number]));
}

async function waitFor(what: string, fn: () => Promise<boolean>, timeoutMs: number): Promise<number> {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await fn()) return Date.now() - t0;
    } catch (err) {
      last = (err as Error).message;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${what} did not become ready within ${timeoutMs / 1000}s${last ? ` (${last})` : ""}`);
}

export interface BaselineEpoch {
  readonly epoch: number;
  readonly rebuiltAt: string;
  readonly durationMs: number;
  readonly schemaVersion: string;
  readonly digest: Readonly<Record<string, string>>;
  readonly catalog: string;
  readonly counts: Readonly<Record<string, number>>;
}

export interface Canonical {
  counts: Record<string, number> | null;
  catalog: string | null;
}

export class BaselineVerificationError extends Error {}

/**
 * Verify the state on `a` IS the canonical baseline: every baseline fixture
 * holds, every table holds the canonical number of rows, and the control
 * surface digests to the canonical value. The first call of a run (canonical
 * empty) establishes the canonical values. Throws BaselineVerificationError.
 */
export async function verifyBaselineState(a: Session, canonical: Canonical, only?: ReadonlySet<string>): Promise<{ counts: Record<string, number>; catalog: string; digest: Record<string, string> }> {
  const bad = (await verifySeedExtensions(a, only)).filter((r) => !r.ok);
  if (bad.length) throw new BaselineVerificationError(`baseline fixtures do not hold: ${bad.map((r) => `${r.key} (${r.detail})`).join("; ")}`);
  const counts = await rowCounts(a);
  const catalog = await catalogDigest(a);
  if (canonical.counts) {
    const moved = Object.keys({ ...counts, ...canonical.counts }).filter((k) => counts[k] !== canonical.counts![k]);
    if (moved.length) throw new BaselineVerificationError(`the baseline's row counts differ from this run's canonical baseline: ${moved.map((k) => `${k} ${canonical.counts![k]} -> ${counts[k]}`).join(", ")}`);
  } else {
    canonical.counts = counts;
  }
  if (canonical.catalog) {
    if (catalog !== canonical.catalog) throw new BaselineVerificationError("the control surface (policies, grants, triggers, roles, function bodies) differs from this run's canonical baseline");
  } else {
    canonical.catalog = catalog;
  }
  const digest = await stateDigest(a);
  return { counts, catalog, digest };
}

/**
 * Rebuild the disposable database and verify the canonical baseline.
 *
 * `canonical` carries the counts and control-surface digest of this run's
 * first rebuild; every later rebuild must reproduce them exactly.
 */
export async function rebuildBaseline(opts: {
  epoch: number;
  expectedSchema: string;
  canonical: Canonical;
  arc21Pre: Arc21SourceState;
  log?: (s: string) => void;
  /** WP4 (D3.56): the baseline fixtures that apply to this schema state. Absent: all. */
  only?: ReadonlySet<string>;
}): Promise<BaselineEpoch> {
  const log = opts.log ?? (() => {});
  const t0 = Date.now();
  await bringup(() => {});
  const sv = await readSchemaVersion();
  if (sv.migrationSetSha256 !== opts.expectedSchema) {
    throw new BaselineVerificationError(`the rebuilt schema is ${sv.migrationSetSha256.slice(0, 12)}…, not the planned ${opts.expectedSchema.slice(0, 12)}…`);
  }
  const verified = await withSession(adminSession("baseline"), async (a) => {
    await applySeedExtensions(a, () => {}, opts.only);
    return verifyBaselineState(a, opts.canonical, opts.only);
  });
  // The services the socket and HTTP probes talk to restart with the database.
  const anonKey = await signJwt({ role: "anon" });
  await waitFor("Realtime", async () => {
    const r = await fetch(REALTIME_HEALTH, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(4000) });
    const body = await r.text();
    return r.status === 200 && /"healthy"\s*:\s*true/.test(body);
  }, 90_000);
  await waitFor("PostgREST", async () => {
    const r = await fetch(`${REST_BASE}/profiles?select=id&limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(4000) });
    await r.text();
    return r.status === 200 || r.status === 401 || r.status === 403;
  }, 60_000);
  // Arc21 is read-only (D3.31). `supabase db reset` runs in its tree, so the
  // checkout is re-fingerprinted after every rebuild, not only at the end.
  const post = await captureArc21State();
  const cmp = compareArc21State(opts.arc21Pre, post);
  if (!cmp.identical) {
    throw new Arc21ChangedError(`HARNESS SAFETY VIOLATION during rebuild ${opts.epoch}: ${cmp.differences.join("; ")}`);
  }
  const durationMs = Date.now() - t0;
  log(`  baseline ${opts.epoch} rebuilt and verified in ${(durationMs / 1000).toFixed(1)}s`);
  return {
    epoch: opts.epoch, rebuiltAt: new Date().toISOString(), durationMs, schemaVersion: sv.migrationSetSha256,
    digest: verified.digest, catalog: verified.catalog, counts: verified.counts,
  };
}

export class Arc21ChangedError extends Error {}
