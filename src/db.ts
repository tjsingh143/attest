/**
 * Attest — connection identities.
 *
 * Row-level security is not applied to a superuser, to a role holding
 * BYPASSRLS, or to the owner of a table whose RLS is enabled but not FORCED.
 * On this instance the `postgres` role is all three at once. A harness that
 * connects as `postgres` and finds every control working has discovered
 * nothing except that it was connected as `postgres`.
 *
 * So this module exposes exactly two kinds of connection and makes them hard
 * to confuse:
 *
 *   adminSession()  — `postgres`. Reads the catalogs and writes the seed.
 *                     Never issues a control test. Carries `bypassesRls: true`
 *                     in its identity record so that any evidence produced
 *                     under it is self-labelling.
 *
 *   roleSession()   — `authenticator`, then SET ROLE to a client role, then
 *                     the identity claims. `authenticator` is NOINHERIT, is
 *                     not a superuser, does not hold BYPASSRLS, and is not a
 *                     member of `postgres`, so it cannot climb back out.
 *                     Every control test runs here.
 *
 * `roleSession` verifies its own privilege level after switching and refuses
 * to hand back a session that could pass a test vacuously. That check is the
 * load-bearing line in this file.
 */
import pg from "pg";
import { DB, LOGINS } from "./config.ts";

/** A JWT claim set, as Supabase's `auth.uid()` / `auth.role()` read it. */
export type Claims = Record<string, unknown>;

/**
 * Who a statement actually ran as, read back out of the database rather than
 * asserted by the harness. This record is attached to every piece of evidence.
 */
export interface SessionIdentity {
  /** Label used in evidence, e.g. "authenticated:alice" or "admin(postgres)". */
  readonly label: string;
  /** The role the statement executes as (post-SET ROLE). */
  readonly currentUser: string;
  /** The role that authenticated the connection. */
  readonly sessionUser: string;
  readonly isSuperuser: boolean;
  readonly bypassesRls: boolean;
  /** `auth.uid()` as the database resolves it — null when no identity is present. */
  readonly authUid: string | null;
  /** `auth.role()` as the database resolves it. */
  readonly authRole: string | null;
  /** The raw claims injected, for reproducibility. */
  readonly claims: Claims | null;
}

const IDENTITY_PROBE = `
  select
    current_user::text                                          as current_user,
    session_user::text                                          as session_user,
    (select rolsuper      from pg_roles where rolname = current_user) as is_superuser,
    (select rolbypassrls  from pg_roles where rolname = current_user) as bypasses_rls,
    auth.uid()::text                                            as auth_uid,
    auth.role()::text                                           as auth_role
`;

export interface Session {
  readonly identity: SessionIdentity;
  /** Run a statement. Errors are thrown; callers that want the SQLSTATE catch them. */
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
  close(): Promise<void>;
}

async function probeIdentity(
  client: pg.Client,
  label: string,
  claims: Claims | null,
): Promise<SessionIdentity> {
  const { rows } = await client.query(IDENTITY_PROBE);
  const r = rows[0];
  return {
    label,
    currentUser: r.current_user,
    sessionUser: r.session_user,
    isSuperuser: r.is_superuser === true,
    bypassesRls: r.bypasses_rls === true,
    authUid: r.auth_uid ?? null,
    authRole: r.auth_role ?? null,
    claims,
  };
}

function wrap(client: pg.Client, identity: SessionIdentity): Session {
  return {
    identity,
    query: (sql, params) => client.query(sql, params as unknown[] | undefined),
    close: () => client.end(),
  };
}

/**
 * A connection as `postgres`. Reads catalogs and writes the seed.
 *
 * The returned identity will report `bypassesRls: true` on this instance. That
 * is not a defect to be fixed; it is the fact that makes `roleSession`
 * necessary, and recording it keeps admin-derived output from being mistaken
 * for a control result.
 */
export async function adminSession(label = "admin(postgres)"): Promise<Session> {
  const client = new pg.Client({ ...DB, ...LOGINS.admin });
  await client.connect();
  return wrap(client, await probeIdentity(client, label, null));
}

export interface RoleSessionOptions {
  /** The role to assume: "anon", "authenticated", or "service_role". */
  readonly role: string;
  /** Identity claims. Omit or pass null for a session with no identity at all. */
  readonly claims?: Claims | null;
  /** Evidence label, e.g. "authenticated:alice". Defaults to the role name. */
  readonly label?: string;
  /**
   * Permit a role that bypasses RLS. Only `service_role` needs this, and only
   * for the WP1 demonstration that an over-privileged connection fails to
   * catch a broken control. Control tests never set it.
   */
  readonly allowRlsBypass?: boolean;
}

/**
 * A genuinely unprivileged, role-scoped session carrying a specific identity.
 *
 * Connects as `authenticator` — a LOGIN, NOINHERIT role that is neither a
 * superuser nor BYPASSRLS, and is not a member of `postgres` — then switches
 * into the requested role and installs the claims. Both the role switch and
 * the claims are set with plain `set`, not `set local`, because this session
 * owns its whole connection and no transaction wraps it.
 *
 * Throws if the resulting session could bypass row-level security, unless the
 * caller explicitly asked for that.
 */
export async function roleSession(opts: RoleSessionOptions): Promise<Session> {
  const { role, claims = null, allowRlsBypass = false } = opts;
  const label = opts.label ?? role;

  const client = new pg.Client({ ...DB, ...LOGINS.client });
  await client.connect();

  try {
    // Role names cannot be parameterised; this is a format(%I) equivalent.
    await client.query(`set role ${quoteIdent(role)}`);
    // Claims can be, and are.
    await client.query(`select set_config('request.jwt.claims', $1, false)`, [
      claims === null ? "" : JSON.stringify(claims),
    ]);

    const identity = await probeIdentity(client, label, claims);

    if (identity.isSuperuser) {
      throw new Error(
        `refusing to test as a superuser: ${identity.currentUser}. ` +
          `Every row-level security check would pass without being enforced.`,
      );
    }
    if (identity.bypassesRls && !allowRlsBypass) {
      throw new Error(
        `refusing to test as ${identity.currentUser}: it holds BYPASSRLS. ` +
          `Row-level security would not be applied and every test would pass vacuously. ` +
          `Pass allowRlsBypass only for a deliberate over-privilege demonstration.`,
      );
    }

    return wrap(client, identity);
  } catch (err) {
    await client.end().catch(() => {});
    throw err;
  }
}

/** Double-quote an SQL identifier. */
export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Run `fn` with a session and always close it. */
export async function withSession<T>(
  open: Promise<Session>,
  fn: (s: Session) => Promise<T>,
): Promise<T> {
  const session = await open;
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}
