/**
 * Attest — WP1 mechanism demonstrations.
 *
 * Two things the deliberate-break scenarios cannot show on their own.
 *
 * 1. WHO THE HARNESS IS. Every identity it can open, with its privilege level
 *    read back out of the database, plus executed probes of which roles can
 *    reach which other roles. "The tests run unprivileged" is a claim; this is
 *    the transcript.
 *
 * 2. WHAT "ENABLED BUT NOT FORCED" ACTUALLY DOES. Every one of Arc21's 39
 *    tables has row-level security enabled and none has it forced. That is a
 *    fact, not yet a verdict, and the difference matters: the question is not
 *    whether the setting is missing but whether anyone who benefits from its
 *    absence is reachable. Rather than assert an answer, this builds a scratch
 *    table owned by a role that holds no BYPASSRLS, shows the owner reading
 *    rows a policy excludes, turns FORCE on, and shows the same role now
 *    subject to the same policy. Then it asks the reachability question about
 *    Arc21's actual owner and answers it by executing it.
 *
 * The scratch table and the role that owns it are created and dropped inside
 * this module. Nothing in Arc21 is touched.
 */
import type { Session } from "./db.ts";
import { adminSession, roleSession } from "./db.ts";
import { execute, summarize, type Outcome } from "./evidence.ts";
import { openIdentity, type IdentitySpec } from "./wp1.ts";

const ALICE = "00000000-0000-4000-8000-00000000000a";

// ---------------------------------------------------------------------------
// 1. Identity transcript
// ---------------------------------------------------------------------------

export interface IdentityProof {
  readonly label: string;
  readonly currentUser: string;
  readonly sessionUser: string;
  readonly isSuperuser: boolean;
  readonly bypassesRls: boolean;
  readonly authUid: string | null;
  readonly ownsAnyApplicationTable: boolean;
}

export interface EscalationProbe {
  readonly from: string;
  readonly statement: string;
  readonly outcome: string;
  readonly permitted: boolean;
  /** True if the harness broke rather than the database refusing. Not a result. */
  readonly harnessError: boolean;
  readonly consequence: string;
}

export interface IdentityEvidence {
  readonly identities: readonly IdentityProof[];
  readonly escalation: readonly EscalationProbe[];
  readonly guardRefusal: { readonly attempted: string; readonly refused: boolean; readonly message: string };
}

const PROBE_IDENTITIES: readonly IdentitySpec[] = [
  { kind: "client", role: "authenticated", sub: ALICE, label: "authenticated:alice" },
  { kind: "client", role: "anon", label: "anon" },
  { kind: "service_role", label: "service_role" },
  { kind: "admin", label: "admin(postgres)" },
];

export async function proveIdentities(): Promise<IdentityEvidence> {
  const identities: IdentityProof[] = [];

  for (const spec of PROBE_IDENTITIES) {
    const session = await openIdentity(spec);
    try {
      const { rows } = await session.query<{ owns: boolean }>(
        `select exists (
           select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname in ('public','private') and c.relkind in ('r','p')
             and pg_get_userbyid(c.relowner) = current_user
         ) as owns`,
      );
      identities.push({
        label: session.identity.label,
        currentUser: session.identity.currentUser,
        sessionUser: session.identity.sessionUser,
        isSuperuser: session.identity.isSuperuser,
        bypassesRls: session.identity.bypassesRls,
        authUid: session.identity.authUid,
        ownsAnyApplicationTable: rows[0]?.owns === true,
      });
    } finally {
      await session.close();
    }
  }

  // Escalation, executed rather than assumed. These run on the same login the
  // control tests use, so the answers are about the real connection.
  const escalation: EscalationProbe[] = [];
  const probe = async (stmt: string, consequence: string) => {
    const s = await roleSession({ role: "authenticated", claims: null, label: "escalation-probe" });
    try {
      const out = await execute(s, stmt);
      escalation.push({
        from: "authenticator (the login every control test uses)",
        statement: stmt,
        outcome: summarize(out) + (out.raised ? `: ${out.message}` : ""),
        permitted: !out.raised,
        harnessError: out.harnessError,
        consequence,
      });
    } finally {
      await s.close();
    }
  };

  await probe(
    "set role postgres",
    "postgres owns every application table and holds BYPASSRLS. If this were permitted, the login used for control testing could exempt itself from every policy.",
  );
  await probe(
    "set role service_role",
    "service_role holds BYPASSRLS. This IS permitted: the same login the control tests use can switch into a role exempt from row-level security.",
  );

  // The harness's own refusal, exercised rather than described.
  let refused = false;
  let message = "";
  try {
    const s = await roleSession({ role: "service_role", claims: null });
    await s.close();
  } catch (err) {
    refused = true;
    message = (err as Error).message;
  }

  return {
    identities,
    escalation,
    guardRefusal: {
      attempted: 'roleSession({ role: "service_role" }) without allowRlsBypass',
      refused,
      message,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. What FORCE ROW LEVEL SECURITY changes
// ---------------------------------------------------------------------------

export interface ForceRlsStep {
  readonly as: string;
  readonly state: string;
  readonly statement: string;
  readonly outcome: string;
  readonly meaning: string;
}

export interface ForceRlsEvidence {
  readonly steps: readonly ForceRlsStep[];
  readonly arc21: {
    readonly tablesEnabled: number;
    readonly tablesForced: number;
    readonly owner: string;
    readonly ownerBypassesRls: boolean;
    readonly ownerReachableFromClientLogin: boolean;
    readonly bypassRoleReachableFromClientLogin: boolean;
  };
}

const DEMO_ROLE = "attest_force_demo_owner";
const DEMO_SCHEMA = "attest_wp1_scratch";
const DEMO_TABLE = `${DEMO_SCHEMA}.force_demo`;

/**
 * Isolate the OWNER exemption from the BYPASSRLS exemption.
 *
 * On this instance `postgres` has both at once, so watching it ignore a policy
 * proves nothing about which rule did it. The scratch role below holds
 * NOBYPASSRLS and owns the scratch table, so the only exemption available to it
 * is ownership -- and FORCE is exactly the switch that removes that one.
 */
export async function demonstrateForceRls(admin: Session): Promise<ForceRlsEvidence> {
  const steps: ForceRlsStep[] = [];

  await admin.query(`drop schema if exists ${DEMO_SCHEMA} cascade`);
  await admin.query(`drop owned by ${DEMO_ROLE}`).catch(() => {});
  await admin.query(`drop role if exists ${DEMO_ROLE}`);
  await admin.query(`create role ${DEMO_ROLE} nologin nobypassrls`);
  await admin.query(`grant ${DEMO_ROLE} to current_user with set true`);
  // The demo gets its own schema rather than borrowing `public`. Changing a
  // table's owner requires the incoming owner to hold CREATE on the containing
  // schema, and granting CREATE on an application schema -- even for the length
  // of one demonstration -- is exactly the kind of thing this harness should not
  // be doing to the system it is measuring.
  await admin.query(`create schema ${DEMO_SCHEMA} authorization ${DEMO_ROLE}`);
  await admin.query(`create table ${DEMO_TABLE} (id int primary key, visibility text not null)`);
  await admin.query(
    `insert into ${DEMO_TABLE} (id, visibility) values (1, 'visible'), (2, 'hidden')`,
  );
  await admin.query(`alter table ${DEMO_TABLE} owner to ${DEMO_ROLE}`);
  await admin.query(`alter table ${DEMO_TABLE} enable row level security`);
  await admin.query(
    `create policy only_visible on ${DEMO_TABLE} for select using (visibility = 'visible')`,
  );

  const STMT = `select id from ${DEMO_TABLE}`;

  /** Run the statement as the scratch owner, which holds no BYPASSRLS. */
  const asOwner = async (): Promise<Outcome> => {
    const s = await adminSession("force-demo");
    try {
      await s.query(`set role ${DEMO_ROLE}`);
      return await execute(s, STMT);
    } finally {
      await s.close();
    }
  };

  try {
    steps.push({
      as: `${DEMO_ROLE} (owns the table, no BYPASSRLS, not a superuser)`,
      state: "RLS enabled, NOT forced",
      statement: STMT,
      outcome: summarize(await asOwner()),
      meaning:
        "Both rows. The policy admits one of the two, and the owner is not subject to it. " +
        "This is what 'enabled but not forced' means in practice.",
    });

    await admin.query(`alter table ${DEMO_TABLE} force row level security`);

    steps.push({
      as: `${DEMO_ROLE} (same role, same statement)`,
      state: "RLS enabled AND forced",
      statement: STMT,
      outcome: summarize(await asOwner()),
      meaning:
        "One row. FORCE removes the owner's exemption, and the owner is now filtered by the same policy as anyone else.",
    });

    // And the part that matters on this instance: FORCE does not close the
    // other door.
    await admin.query(`grant usage on schema ${DEMO_SCHEMA} to postgres`);
    await admin.query(`grant select on ${DEMO_TABLE} to postgres`);
    const asBypass = await execute(admin, STMT);
    steps.push({
      as: "postgres (holds BYPASSRLS, is not the owner of this table)",
      state: "RLS enabled AND forced",
      statement: STMT,
      outcome: summarize(asBypass),
      meaning:
        "Both rows, with FORCE on. FORCE closes the OWNER exemption and does nothing about the BYPASSRLS one. " +
        "They are two separate doors and Arc21's tables have both open.",
    });
  } finally {
    await admin.query(`drop schema if exists ${DEMO_SCHEMA} cascade`).catch(() => {});
    // DROP ROLE refuses while the role still holds privileges anywhere, so the
    // grants it was given have to be reaped first.
    await admin.query(`drop owned by ${DEMO_ROLE}`).catch(() => {});
    await admin.query(`drop role if exists ${DEMO_ROLE}`).catch(() => {});
  }

  // Now the Arc21-specific reachability question.
  const { rows: counts } = await admin.query<{ enabled: string; forced: string; owner: string }>(
    `select count(*) filter (where c.relrowsecurity)::text      as enabled,
            count(*) filter (where c.relforcerowsecurity)::text as forced,
            (select pg_get_userbyid(c2.relowner)
               from pg_class c2 join pg_namespace n2 on n2.oid = c2.relnamespace
              where n2.nspname = 'public' and c2.relkind = 'r' limit 1) as owner
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','private') and c.relkind in ('r','p')`,
  );
  const row = counts[0]!;

  const { rows: bypass } = await admin.query<{ b: boolean }>(
    `select rolbypassrls as b from pg_roles where rolname = $1`, [row.owner],
  );

  const canSetRole = async (role: string): Promise<boolean> => {
    const s = await roleSession({ role: "authenticated", claims: null, label: "reachability" });
    try {
      const out = await execute(s, `set role ${role}`);
      return !out.raised && !out.harnessError;
    } finally {
      await s.close();
    }
  };

  return {
    steps,
    arc21: {
      tablesEnabled: Number(row.enabled),
      tablesForced: Number(row.forced),
      owner: row.owner,
      ownerBypassesRls: bypass[0]?.b === true,
      ownerReachableFromClientLogin: await canSetRole(row.owner),
      bypassRoleReachableFromClientLogin: await canSetRole("service_role"),
    },
  };
}
