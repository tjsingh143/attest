/**
 * Attest — configuration.
 *
 * Everything that is environment-specific lives here, so that the rest of the
 * harness contains no host names, no ports and no assumptions about where the
 * system under test is running.
 */
import { resolve } from "node:path";

/** Repository root of the harness itself. */
export const ATTEST_ROOT = resolve(import.meta.dirname, "..");

/**
 * The system under test: a local copy of the Arc21 repository. Attest reads
 * two things from it and writes nothing: the migration files (to compute a
 * schema version) and its git metadata. It is the checkout the read-only guard
 * protects (D3.31, D3.32) — always this tree, whatever a run rebuilds from: the
 * guard fingerprints it before and after every command.
 */
export const ARC21_CHECKOUT = process.env.ATTEST_ARC21_CHECKOUT
  ? resolve(process.env.ATTEST_ARC21_CHECKOUT)
  : resolve(ATTEST_ROOT, "arc21 copy");

/**
 * Where a run's migrations come from. Normally the protected checkout itself.
 * WP4 points it at an Attest-owned scratch directory holding a historical
 * schema state reconstructed from Arc21's git history (D3.56) — so a
 * historical rebuild never checks anything out in, or writes anything to, the
 * protected checkout.
 */
export const SUT_REPO = process.env.ATTEST_SUT_REPO
  ? resolve(process.env.ATTEST_SUT_REPO)
  : ARC21_CHECKOUT;

export const SUT_MIGRATIONS_DIR = resolve(SUT_REPO, "supabase/migrations");

/** Where evidence is written. One directory per run. */
export const EVIDENCE_ROOT = resolve(ATTEST_ROOT, "evidence");
export const RUNS_ROOT = resolve(EVIDENCE_ROOT, "runs");

/** Where the seed that Attest owns lives. Attest never seeds through the SUT repo. */
export const SEED_DIR = resolve(ATTEST_ROOT, "seed");

export const SQL_DIR = resolve(ATTEST_ROOT, "sql");

/**
 * The disposable local instance.
 *
 * `host`/`port` are the Supabase CLI's published Postgres port for the local
 * stack. There is no production connection string anywhere in this repository
 * and there is not meant to be: the harness deliberately attempts unauthorized
 * reads and writes, so it may only ever point at an instance that can be thrown
 * away and rebuilt from migrations.
 */
export const DB = {
  host: process.env.ATTEST_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.ATTEST_DB_PORT ?? 54322),
  database: process.env.ATTEST_DB_NAME ?? "postgres",
} as const;

/**
 * Login roles available on the instance.
 *
 * `postgres` holds BYPASSRLS on this instance, which is exactly why it is
 * confined to catalog reads and seeding. `authenticator` holds neither
 * BYPASSRLS nor superuser and is NOINHERIT, so it is the only honest way to
 * reach `anon` / `authenticated` / `service_role`. See src/db.ts.
 */
export const LOGINS = {
  admin: {
    user: process.env.ATTEST_ADMIN_USER ?? "postgres",
    password: process.env.ATTEST_ADMIN_PASSWORD ?? "postgres",
  },
  client: {
    user: process.env.ATTEST_CLIENT_USER ?? "authenticator",
    password: process.env.ATTEST_CLIENT_PASSWORD ?? "postgres",
  },
} as const;

/**
 * Schemas that belong to the application, as opposed to the platform
 * (Supabase Auth, Storage, Realtime's own machinery, extensions).
 *
 * This list is the one hand-written thing in the inventory and it is a
 * judgment call, recorded in DECISIONS.md. Everything downstream of it —
 * every table, policy, grant and function — is read from the catalogs.
 *
 * `realtime` is NOT in this list, but `realtime.messages` is pulled in
 * separately by the policy probe, because Arc21 authors policies on it. See
 * APPLICATION_RELATIONS_EXTRA.
 */
export const APPLICATION_SCHEMAS = ["public", "private"] as const;

/**
 * Relations outside the application schemas that the application nonetheless
 * controls, and which therefore belong in the inventory.
 */
export const APPLICATION_RELATIONS_EXTRA = ["realtime.messages"] as const;

/**
 * Roles a client can actually present to the database. A grant to one of these
 * is reachable from outside the server; a grant to anything else is not.
 */
export const CLIENT_ROLES = ["anon", "authenticated"] as const;

/** Client roles plus the server's own role. All three are reachable via `authenticator`. */
export const REACHABLE_ROLES = ["anon", "authenticated", "service_role"] as const;
