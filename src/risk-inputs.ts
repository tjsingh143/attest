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
 * How a resource is reached from outside the server. Decided by the grant
 * surface and the policy set together, because either one alone gives the wrong
 * answer -- see WP0 D0.13.
 */
export type ExposureClass =
  /** A signed-out caller holds a grant and a policy admits them (or RLS is off). */
  | "anonymous"
  /** A signed-out caller holds a grant, but no policy admits them. Denied today. */
  | "anonymous_latent"
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
   * The columns that say whose row this is.
   *
   * Computed transitively, because in Arc21 almost nothing points at
   * `auth.users` directly: `public.profiles.id` is a foreign key to
   * `auth.users` AND is `profiles`' own primary key, which makes `profiles` an
   * identity relation, and the thirty-odd tables carrying `user_id ->
   * profiles.id` are therefore naming a person too. A one-hop version of this
   * reported almost every table as having no owner, which is the opposite of
   * the truth and would have made "blast radius" unscoreable.
   */
  readonly identityColumns: readonly string[];

  // --- "exposure" ---
  readonly exposure: ExposureClass;
  readonly exposureDetail: string;
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
  for (const p of raw.policies) {
    const key = s(p.resource);
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
  for (let pass = 0; pass < 5; pass++) {
    let grew = false;
    for (const [resource, links] of outbound) {
      if (identityRelations.has(resource)) continue;
      const pk = pkColumns.get(resource) ?? new Set<string>();
      if (pk.size === 0) continue;
      const isIdentity = links.some(
        (l) =>
          identityRelations.has(l.relation) &&
          l.columns.length === pk.size &&
          l.columns.every((c) => pk.has(c)),
      );
      if (isIdentity) { identityRelations.add(resource); grew = true; }
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
      identityColumns: [
        ...new Set(
          links.filter((l) => identityRelations.has(l.relation)).flatMap((l) => l.columns),
        ),
      ].sort(),

      exposure: exposure.klass,
      exposureDetail: exposure.detail,
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
  for (const e of ["anonymous", "anonymous_latent", "authenticated", "server_only"] as const) {
    counts[`exposure.${e}`] = resources.filter((r) => r.exposure === e).length;
  }
  counts.totalPolicies = resources.reduce((a, r) => a + r.policyCount, 0);

  return { inventory, inputs: { resources, counts } };
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

  if (anonGrant && observations.includes("anon_reachable")) {
    return {
      klass: "anonymous",
      detail: `anon holds ${(reachableBy["anon"] ?? reachableBy["PUBLIC"] ?? []).join(", ")} and a policy names anon or PUBLIC`,
    };
  }
  if (anonGrant && observations.includes("anon_granted_but_no_policy_admits_it")) {
    return {
      klass: "anonymous_latent",
      detail: `anon holds ${(reachableBy["anon"] ?? []).join(", ")}, but no policy admits anon — refused today by row security alone`,
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
