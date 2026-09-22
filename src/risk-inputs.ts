/**
 * Attest — WP2 scaffold: the factual inputs a risk rubric needs.
 *
 * This module does NOT rate anything. It assembles, per resource, the facts a
 * person needs in order to score it — and stops there. The rubric's dimensions,
 * levels, weights, thresholds and every per-resource score are the author's,
 * for the reason in brief §1.1: a tier the author cannot defend in a room is
 * worth less than no tier at all.
 *
 * The division is deliberate and it is the whole design of this file:
 *
 *   fact       Something the database says. "anon holds SELECT and a policy
 *              names anon." "Eleven relations hold a foreign key to this one."
 *              "This column is server-generated."
 *   judgment   What that is worth. "Anonymous reach scores 3." "Shared state
 *              outweighs reversibility."
 *
 * Everything below is the first kind. `exposure` looks like the second and is
 * not: it is a classification of grants and policies that the catalogs decide,
 * with no opinion about what any class is worth.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APPLICATION_RELATIONS_EXTRA, APPLICATION_SCHEMAS, SQL_DIR,
} from "./config.ts";
import type { Session } from "./db.ts";
import { buildInventory, runProbes, type Inventory } from "./inventory.ts";

const RISK_DIR = join(SQL_DIR, "risk");
const APP_SCHEMAS = [...APPLICATION_SCHEMAS];
const EXTRA_RELS = [...APPLICATION_RELATIONS_EXTRA];

/**
 * EFFECTIVE CURRENT REACHABILITY -- the brief's question, and only that.
 *
 * Three values, matching the brief: reachable by anonymous callers, by any
 * signed-in account, or only server-side. An earlier version of this file
 * invented a fourth value, `anonymous_latent`, for `realtime.messages`, which
 * grants `anon` INSERT/SELECT/UPDATE while every policy on it names
 * `authenticated`.
 *
 * That was a scoring level dressed as a measurement. Whether a granted-but-
 * refused condition deserves its own rung is a rubric decision, and inventing
 * the rung pre-empted it. The underlying condition is not lost: it is recorded
 * as two separate booleans below, so the rubric can treat it however it likes
 * -- or not at all.
 */
export type ExposureClass =
  /** A signed-out caller can actually reach data here today. */
  | "anonymous"
  /** Reachable by any signed-in account. */
  | "authenticated"
  /** No client-presentable role reaches it at all. */
  | "server_only";

export interface ColumnFact {
  readonly name: string;
  readonly isPrimaryKey: boolean;
  readonly type: string;
  readonly notNull: boolean;
  readonly serverGenerated: boolean;
  readonly declaredIntent: string | null;
  /** Client roles holding a column-level privilege here, if any. */
  readonly clientWritable: readonly string[];
}

export interface RelationLink {
  readonly relation: string;
  readonly constraint: string;
  readonly columns: readonly string[];
  readonly onDelete: string;
}

/** An inferred path from a column to `auth.users`. See `inferredIdentityColumns`. */
export interface IdentityLinkage {
  readonly column: string;
  /** e.g. ["public.profiles", "auth.users"] — the relations traversed, in order. */
  readonly via: readonly string[];
  /** Human-readable, e.g. "public.wallets.user_id -> public.profiles.id -> auth.users". */
  readonly path: string;
  readonly hops: number;
}

export interface PolicyFact {
  readonly name: string;
  readonly command: string;
  readonly permissive: string;
  readonly roles: readonly string[];
  readonly hasUsing: boolean;
  readonly hasWithCheck: boolean;
}

export interface RiskInput {
  readonly resource: string;
  readonly schema: string;
  readonly kind: string;
  readonly owner: string;
  /** Arc21's COMMENT on the table. The author's claim, not a measurement. */
  readonly declaredIntent: string | null;

  // --- "what the data is" ---
  readonly columns: readonly ColumnFact[];
  readonly columnCount: number;
  /**
   * Columns holding a foreign key DIRECTLY to `auth.users`. Measured, not
   * inferred: in Arc21 only `public.profiles.id` qualifies.
   */
  readonly directIdentityColumns: readonly string[];
  /**
   * Columns that reach `auth.users` through one or more intermediate relations.
   *
   * This is an INFERENCE, and it is labelled as one everywhere it is reported.
   * The inference is: a relation whose PRIMARY KEY is a foreign key to an
   * identity relation is itself an identity relation, so a column pointing at
   * it is naming a person. In Arc21 that resolves `public.profiles`, and the
   * thirty-odd tables carrying `user_id -> profiles.id` resolve through it.
   *
   * It is kept separate from `directIdentityColumns` rather than merged,
   * because "this column IS a user id" and "this column reaches a user id in
   * two hops" are different claims, and a rubric may reasonably weigh a
   * one-to-one identity table differently from a direct reference. The path is
   * recorded so the reasoning can be checked rather than trusted.
   */
  readonly inferredIdentityColumns: readonly IdentityLinkage[];

  // --- "exposure" ---
  /** Effective current reachability. The brief's three values, nothing more. */
  readonly exposure: ExposureClass;
  readonly exposureDetail: string;
  /** Raw fact: does a signed-out caller hold any privilege here? */
  readonly anonymousGrantExists: boolean;
  /** Raw fact: does any policy currently admit `anon` or `PUBLIC`? */
  readonly anonymousPolicyPermits: boolean;
  /**
   * Effective READ path, from grants and policies together.
   *
   * The rubric scores read and write exposure separately and picks the one the
   * driving failure mode calls for, so both are computed here rather than
   * collapsed. Derived from the catalogs only: a trigger that refuses writes is
   * reported separately in `refusingTriggers`, because whether it actually
   * refuses is settled by executing a statement (WP3), not by reading its name.
   */
  readonly effectiveReadExposure: ExposureClass;
  /** Effective WRITE path, from grants and policies together. Same caveat. */
  readonly effectiveWriteExposure: ExposureClass;
  readonly reachableBy: Readonly<Record<string, readonly string[]>>;
  readonly columnReachableBy: Readonly<Record<string, readonly string[]>>;

  // --- "blast radius" and "integrity impact" ---
  readonly references: readonly RelationLink[];
  readonly referencedBy: readonly RelationLink[];
  readonly referencedByCount: number;
  /** Inbound links that CASCADE: one deleted row here removes rows elsewhere. */
  readonly cascadingInbound: readonly RelationLink[];
  /**
   * SECURITY DEFINER functions whose body names this relation.
   *
   * HEURISTIC: a text match on the function source. It will miss a relation
   * reached through dynamic SQL and will over-report one named in a comment.
   * It is here to show which server-side code paths touch a resource, not to
   * decide anything.
   */
  readonly writtenByDefinerFunctions: readonly string[];

  // --- "reversibility" ---
  readonly refusingTriggers: readonly string[];
  /** Triggers whose name or function suggests append-only enforcement. HEURISTIC. */
  readonly appendOnlyGuards: readonly string[];

  // --- control surface, for costing test depth ---
  readonly rlsEnabled: boolean;
  readonly rlsForced: boolean;
  readonly policies: readonly PolicyFact[];
  readonly policyCount: number;
  readonly commandsWithPolicy: readonly string[];
  readonly realtimePublished: boolean;
}

export interface RiskInputs {
  readonly resources: readonly RiskInput[];
  readonly counts: Readonly<Record<string, number>>;
}

const s = (v: unknown) => String(v ?? "");

export async function buildRiskInputs(session: Session): Promise<{ inventory: Inventory; inputs: RiskInputs }> {
  const raw = await runProbes(session);
  const inventory = buildInventory(raw);

  const colSql = await readFile(join(RISK_DIR, "01_columns.sql"), "utf8");
  const fkSql = await readFile(join(RISK_DIR, "02_foreign_keys.sql"), "utf8");
  const { rows: colRows } = await session.query(colSql, [APP_SCHEMAS, EXTRA_RELS]);
  const { rows: fkRows } = await session.query(fkSql, [APP_SCHEMAS, EXTRA_RELS]);

  // --- index the raw facts -------------------------------------------------
  const columnsByResource = new Map<string, Record<string, unknown>[]>();
  for (const r of colRows) {
    const key = s(r.resource);
    columnsByResource.set(key, [...(columnsByResource.get(key) ?? []), r]);
  }

  const outbound = new Map<string, RelationLink[]>();
  const inbound = new Map<string, RelationLink[]>();
  for (const r of fkRows) {
    const from = s(r.resource);
    const to = s(r.other_relation);
    const columns = Array.isArray(r.columns) ? r.columns.map(String) : [];
    const link = { relation: to, constraint: s(r.constraint_name), columns, onDelete: s(r.on_delete) };
    outbound.set(from, [...(outbound.get(from) ?? []), link]);
    inbound.set(to, [
      ...(inbound.get(to) ?? []),
      { relation: from, constraint: s(r.constraint_name), columns, onDelete: s(r.on_delete) },
    ]);
  }

  // Which SECURITY DEFINER functions name each relation. See the field comment.
  const definerBodies = raw.routines
    .filter((f) => f.security_definer === true)
    .map((f) => ({ resource: s(f.resource), body: s(f.definition) }));

  const publishedTables = new Set(
    inventory.controls.filter((c) => c.controlKind === "realtime_publication").map((c) => c.resource),
  );

  const policiesByResource = new Map<string, PolicyFact[]>();
  /** Which roles each resource's policies name. Raw fact, used for the two
   *  anonymous booleans rather than for any classification. */
  const policyRoles = new Map<string, Set<string>>();
  for (const p of raw.policies) {
    const key = s(p.resource);
    const named = policyRoles.get(key) ?? new Set<string>();
    for (const role of Array.isArray(p.roles) ? p.roles.map(String) : []) named.add(role);
    policyRoles.set(key, named);
    policiesByResource.set(key, [
      ...(policiesByResource.get(key) ?? []),
      {
        name: s(p.policy_name),
        command: s(p.command),
        permissive: s(p.permissive),
        roles: Array.isArray(p.roles) ? p.roles.map(String) : [],
        hasUsing: p.using_expr !== null && p.using_expr !== undefined,
        hasWithCheck: p.with_check_expr !== null && p.with_check_expr !== undefined,
      },
    ]);
  }

  const observationsByResource = new Map<string, string[]>();
  for (const o of inventory.observations) {
    observationsByResource.set(o.resource, [...(observationsByResource.get(o.resource) ?? []), o.kind]);
  }

  const triggerControls = inventory.controls.filter((c) => c.controlKind === "trigger");

  // --- which relations ARE a person ---------------------------------------
  // `auth.users`, plus any relation whose PRIMARY KEY is a foreign key to one
  // of them. Iterated to a fixed point so a longer chain would also resolve.
  const pkColumns = new Map<string, Set<string>>();
  for (const [resource, cols] of columnsByResource) {
    pkColumns.set(resource, new Set(cols.filter((c) => c.is_primary_key === true).map((c) => s(c.column_name))));
  }
  const identityRelations = new Set<string>(["auth.users"]);
  /** For each identity relation, the chain of relations from it to auth.users. */
  const identityPaths = new Map<string, string[]>([["auth.users", []]]);
  for (let pass = 0; pass < 5; pass++) {
    let grew = false;
    for (const [resource, links] of outbound) {
      if (identityRelations.has(resource)) continue;
      const pk = pkColumns.get(resource) ?? new Set<string>();
      if (pk.size === 0) continue;
      const hit = links.find(
        (l) =>
          identityRelations.has(l.relation) &&
          l.columns.length === pk.size &&
          l.columns.every((c) => pk.has(c)),
      );
      if (hit) {
        identityRelations.add(resource);
        identityPaths.set(resource, [hit.relation, ...(identityPaths.get(hit.relation) ?? [])]);
        grew = true;
      }
    }
    if (!grew) break;
  }

  // --- assemble ------------------------------------------------------------
  const resources: RiskInput[] = [];

  for (const r of inventory.resources) {
    const cols = columnsByResource.get(r.resource) ?? [];
    const obs = observationsByResource.get(r.resource) ?? [];
    const policies = policiesByResource.get(r.resource) ?? [];
    const links = outbound.get(r.resource) ?? [];
    const back = inbound.get(r.resource) ?? [];

    // Which client roles hold a privilege on each column.
    const colWritable = new Map<string, string[]>();
    for (const [key, privs] of Object.entries(r.columnReachableBy)) {
      const [grantee, column] = key.split(":");
      if (!column) continue;
      colWritable.set(column, [
        ...(colWritable.get(column) ?? []),
        `${grantee}: ${privs.join(", ")}`,
      ]);
    }

    const exposure = classifyExposure(r.reachableBy, obs, r.rlsEnabled);
    const anonGrantees = Object.keys(r.reachableBy).filter((g) => g === "anon" || g === "PUBLIC");
    const namedRoles = policyRoles.get(r.resource) ?? new Set<string>();

    const triggers = triggerControls.filter((t) => t.resource === r.resource);

    resources.push({
      resource: r.resource,
      schema: r.schema,
      kind: r.kind,
      owner: r.owner,
      declaredIntent: r.declaredIntent,

      columns: cols.map((c) => ({
        name: s(c.column_name),
        isPrimaryKey: c.is_primary_key === true,
        type: s(c.data_type),
        notNull: c.not_null === true,
        serverGenerated: c.server_generated === true,
        declaredIntent: c.declared_intent === null ? null : s(c.declared_intent),
        clientWritable: colWritable.get(s(c.column_name)) ?? [],
      })),
      columnCount: cols.length,
      directIdentityColumns: [
        ...new Set(links.filter((l) => l.relation === "auth.users").flatMap((l) => l.columns)),
      ].sort(),
      inferredIdentityColumns: links
        .filter((l) => l.relation !== "auth.users" && identityPaths.has(l.relation))
        .flatMap((l) => {
          const tail = identityPaths.get(l.relation) ?? [];
          const via = [l.relation, ...tail];
          return l.columns.map((col) => ({
            column: col,
            via,
            path: `${r.resource}.${col} -> ${via.join(" -> ")}`,
            hops: via.length,
          }));
        })
        .sort((a, b) => a.column.localeCompare(b.column)),

      exposure: exposure.klass,
      exposureDetail: exposure.detail,
      anonymousGrantExists: anonGrantees.length > 0,
      anonymousPolicyPermits: namedRoles.has("anon") || namedRoles.has("PUBLIC"),
      effectiveReadExposure: effectivePath(
        r.reachableBy, r.columnReachableBy, policies, r.rlsEnabled, READ_PRIVS,
      ),
      effectiveWriteExposure: effectivePath(
        r.reachableBy, r.columnReachableBy, policies, r.rlsEnabled, WRITE_PRIVS,
      ),
      reachableBy: r.reachableBy,
      columnReachableBy: r.columnReachableBy,

      references: links,
      referencedBy: back,
      referencedByCount: back.length,
      cascadingInbound: back.filter((l) => l.onDelete === "CASCADE"),
      writtenByDefinerFunctions: definerBodies
        .filter((f) => bodyNames(f.body, r.resource))
        .map((f) => f.resource),

      refusingTriggers: triggers.filter((t) => (t.detail as any).can_refuse === true).map((t) => s((t.detail as any).trigger)),
      appendOnlyGuards: triggers
        .filter((t) => /append_only|immutab|deny_truncate/i.test(s((t.detail as any).function) + s((t.detail as any).trigger)))
        .map((t) => s((t.detail as any).trigger)),

      rlsEnabled: r.rlsEnabled,
      rlsForced: r.rlsForced,
      policies,
      policyCount: policies.length,
      commandsWithPolicy: [...new Set(policies.map((p) => p.command))].sort(),
      realtimePublished: publishedTables.has(r.resource),
    });
  }

  const counts: Record<string, number> = { resources: resources.length };
  for (const e of ["anonymous", "authenticated", "server_only"] as const) {
    counts[`exposure.${e}`] = resources.filter((r) => r.exposure === e).length;
  }
  counts.anonymousGrantExists = resources.filter((r) => r.anonymousGrantExists).length;
  counts.anonymousGrantWithoutPermittingPolicy = resources.filter(
    (r) => r.anonymousGrantExists && !r.anonymousPolicyPermits,
  ).length;
  counts.directIdentity = resources.filter((r) => r.directIdentityColumns.length > 0).length;
  counts.inferredIdentity = resources.filter((r) => r.inferredIdentityColumns.length > 0).length;
  counts.totalPolicies = resources.reduce((a, r) => a + r.policyCount, 0);

  return { inventory, inputs: { resources, counts } };
}

const READ_PRIVS = new Set(["SELECT"]);
const WRITE_PRIVS = new Set(["INSERT", "UPDATE", "DELETE"]);

/** Commands a policy governs, expanded so ALL covers everything. */
function policyCovers(command: string, privs: Set<string>): boolean {
  if (command === "ALL") return true;
  return privs.has(command);
}

/**
 * The effective path for a set of privileges: a grant is only reach if a policy
 * also admits the grantee for the matching command (or row security is off).
 *
 * RLS enabled with no policy therefore yields `server_only` whatever the grants
 * say -- which is the deny-by-default case, measured rather than assumed.
 */
function effectivePath(
  tableGrants: Readonly<Record<string, readonly string[]>>,
  columnGrants: Readonly<Record<string, readonly string[]>>,
  policies: readonly PolicyFact[],
  rlsEnabled: boolean,
  privs: Set<string>,
): ExposureClass {
  const holds = (role: string): boolean => {
    const table = tableGrants[role] ?? [];
    if (table.some((p) => privs.has(p))) return true;
    return Object.entries(columnGrants).some(
      ([key, list]) => key.startsWith(`${role}:`) && list.some((p) => privs.has(p)),
    );
  };
  const admitted = (role: string): boolean => {
    if (!rlsEnabled) return true;
    return policies.some(
      (p) => policyCovers(p.command, privs) && (p.roles.includes(role) || p.roles.includes("PUBLIC")),
    );
  };

  for (const role of ["anon", "PUBLIC"]) {
    if (holds(role) && admitted(role)) return "anonymous";
  }
  if (holds("authenticated") && admitted("authenticated")) return "authenticated";
  return "server_only";
}

/** Does this function body name this relation? Text match; see the field comment. */
function bodyNames(body: string, resource: string): boolean {
  const [schema, name] = resource.split(".");
  if (!name) return false;
  const qualified = new RegExp(`\\b${schema}\\.${name}\\b`, "i");
  return qualified.test(body);
}

function classifyExposure(
  reachableBy: Readonly<Record<string, readonly string[]>>,
  observations: readonly string[],
  rlsEnabled: boolean,
): { klass: ExposureClass; detail: string } {
  const grantees = Object.keys(reachableBy);
  const anonGrant = grantees.includes("anon") || grantees.includes("PUBLIC");

  // Effective reachability: a grant alone is not reach if no policy admits it.
  if (anonGrant && observations.includes("anon_reachable")) {
    return {
      klass: "anonymous",
      detail: `anon holds ${(reachableBy["anon"] ?? reachableBy["PUBLIC"] ?? []).join(", ")} and a policy names anon or PUBLIC`,
    };
  }
  if (grantees.includes("authenticated")) {
    return {
      klass: "authenticated",
      detail: `authenticated holds ${(reachableBy["authenticated"] ?? []).join(", ")}${rlsEnabled ? ", filtered by policy" : ", with row-level security OFF"}`,
    };
  }
  if (grantees.length > 0) {
    return { klass: "server_only", detail: `reachable only by ${grantees.join(", ")}, which no client can present` };
  }
  return { klass: "server_only", detail: "no client-presentable role holds any privilege on this resource" };
}
