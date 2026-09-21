/**
 * Attest — the control inventory.
 *
 * Reads the access control surface out of the PostgreSQL system catalogs and
 * emits one row per (resource, control) pair. Nothing here is hand-written
 * except the list of which schemas count as "the application" (config.ts), and
 * that choice is recorded in DECISIONS.md.
 *
 * The reason to read it from the catalogs rather than from the migrations or
 * from documentation is not tidiness. Migrations say what was intended to be
 * applied; a catalog says what is there. Those differ more often than anyone
 * expects -- the first instance this harness was pointed at had a migration
 * applied that existed in no file, and was missing two policies its own
 * migrations create.
 *
 * Deliberately NOT done here: any judgment about how bad something is. This
 * module classifies structure, not risk. Risk tiers come from a written rubric
 * (WP2) and findings are narrated by hand (WP5). A gap list that arrived
 * pre-ranked would be the harness quietly writing both.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  APPLICATION_RELATIONS_EXTRA,
  APPLICATION_SCHEMAS,
  CLIENT_ROLES,
  REACHABLE_ROLES,
  SQL_DIR,
} from "./config.ts";
import type { Session } from "./db.ts";

const PROBE_DIR = join(SQL_DIR, "inventory");

const APP_SCHEMAS = [...APPLICATION_SCHEMAS];
const EXTRA_RELS = [...APPLICATION_RELATIONS_EXTRA];
const CLIENT: readonly string[] = [...CLIENT_ROLES];
const REACHABLE = [...REACHABLE_ROLES];
/** PUBLIC is not a role, but a grant to it reaches every role including anon. */
const GRANTEES = [...REACHABLE, "PUBLIC"];

/** Each probe, and the parameters it takes. Kept beside the files it names. */
const PROBES = {
  relations:          { file: "01_relations.sql",           params: [APP_SCHEMAS, EXTRA_RELS] },
  policies:           { file: "02_policies.sql",            params: [APP_SCHEMAS, EXTRA_RELS] },
  tablePrivileges:    { file: "03_table_privileges.sql",    params: [GRANTEES] },
  columnPrivileges:   { file: "04_column_privileges.sql",   params: [GRANTEES] },
  schemaPrivileges:   { file: "05_schema_privileges.sql",   params: [GRANTEES] },
  roles:              { file: "06_roles.sql",               params: [] },
  routines:           { file: "07_routines.sql",            params: [APP_SCHEMAS, GRANTEES] },
  writeGuards:        { file: "08_write_guards.sql",        params: [APP_SCHEMAS, EXTRA_RELS] },
  publications:       { file: "09_publications.sql",        params: [] },
  defaultPrivileges:  { file: "10_default_privileges.sql",  params: [GRANTEES] },
  anonymousReach:     { file: "11_anonymous_reach.sql",     params: [APP_SCHEMAS] },
} as const;

export type ProbeName = keyof typeof PROBES;
export type RawProbes = { readonly [K in ProbeName]: readonly Record<string, unknown>[] };

/** Run every probe. The SQL is loaded from disk so it stays readable on its own. */
export async function runProbes(session: Session): Promise<RawProbes> {
  const out: Record<string, readonly Record<string, unknown>[]> = {};
  for (const [name, probe] of Object.entries(PROBES)) {
    const sql = await readFile(join(PROBE_DIR, probe.file), "utf8");
    const { rows } = await session.query(sql, probe.params as readonly unknown[]);
    out[name] = rows;
  }
  return out as RawProbes;
}

// ---------------------------------------------------------------------------
// The inventory
// ---------------------------------------------------------------------------

/** The kinds of control this system uses. One row per (resource, control) pair. */
export type ControlKind =
  | "rls_enabled"
  | "rls_forced"
  | "policy"
  | "table_grant"
  | "column_grant"
  | "schema_grant"
  | "security_definer_function"
  | "function_execute_grant"
  | "write_guard_trigger"
  | "realtime_publication";

export interface ControlRow {
  readonly resource: string;
  readonly resourceKind: string;
  readonly controlKind: ControlKind;
  /** Stable identity for this (resource, control) pair. Drift detection keys on it. */
  readonly controlId: string;
  /** Whether the control is present and active. */
  readonly present: boolean;
  /** The control's definition, as the database renders it. */
  readonly detail: Readonly<Record<string, unknown>>;
  /** The author's COMMENT, where one exists. Intent, never evidence. */
  readonly declaredIntent: string | null;
}

export interface ResourceRow {
  readonly resource: string;
  readonly schema: string;
  readonly name: string;
  readonly kind: string;
  readonly owner: string;
  readonly rlsEnabled: boolean;
  readonly rlsForced: boolean;
  readonly policyCount: number;
  readonly viewSecurityInvoker: boolean | null;
  /** Client-reachable privileges, grouped by grantee. */
  readonly reachableBy: Readonly<Record<string, readonly string[]>>;
  /** Column-level privileges, grouped by "grantee:column". */
  readonly columnReachableBy: Readonly<Record<string, readonly string[]>>;
  readonly writeGuards: readonly string[];
  readonly declaredIntent: string | null;
}

/**
 * A structural observation about a resource. NOT a finding and NOT ranked --
 * see the module header. `kind` is mechanical; whether it matters is WP2's and
 * WP5's business.
 */
export interface Observation {
  readonly resource: string;
  readonly kind:
    | "rls_disabled_and_reachable"
    | "rls_disabled_not_reachable"
    | "deny_by_default"
    | "grant_without_policy"
    | "rls_enabled_not_forced"
    | "anon_reachable"
    | "public_grant"
    | "view_bypasses_invoker_rls"
    | "write_policy_without_with_check"
    | "security_definer_without_pinned_search_path";
  readonly detail: string;
}

export interface Inventory {
  readonly resources: readonly ResourceRow[];
  readonly controls: readonly ControlRow[];
  readonly roles: readonly Record<string, unknown>[];
  readonly publications: readonly Record<string, unknown>[];
  readonly defaultPrivileges: readonly Record<string, unknown>[];
  /**
   * Everything a signed-out caller can reach, instance-wide, with each row
   * flagged as application-owned or platform-owned. Kept separate from
   * `resources` because the platform rows are not the author's code and are
   * not findings against it -- but leaving them out would make the answer to
   * "what can anon reach" a false one.
   */
  readonly anonymousReach: readonly Record<string, unknown>[];
  readonly observations: readonly Observation[];
  readonly counts: Readonly<Record<string, number>>;
}

const s = (v: unknown): string => String(v ?? "");
const b = (v: unknown): boolean => v === true;
/**
 * Read a Postgres array column.
 *
 * This throws rather than returning an empty array when handed something that
 * is not one, because of a bug this harness shipped with for exactly one run.
 * `array_agg(rolname)` produces `name[]`, not `text[]`; node-postgres has no
 * parser registered for `name[]` and handed back the raw string
 * "{authenticated}". The previous version of this helper tested Array.isArray,
 * found false, and quietly returned []. The inventory then reported that no
 * function in the application schemas was callable by any client role. Sixty-one
 * were.
 *
 * A harness that under-reports controls in silence is worse than one that
 * crashes, because the output still looks like evidence. So it crashes.
 */
const arr = (v: unknown, field: string): string[] => {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map(String);
  throw new Error(
    `probe returned a non-array for "${field}": ${typeof v} ${JSON.stringify(v)}. ` +
      `A Postgres array came back unparsed, which normally means name[] where text[] ` +
      `was intended. Cast it in the probe SQL.`,
  );
};

export function buildInventory(raw: RawProbes): Inventory {
  const controls: ControlRow[] = [];
  const observations: Observation[] = [];

  // --- privileges, indexed by resource -------------------------------------
  const tableGrants = new Map<string, Map<string, string[]>>();
  for (const g of raw.tablePrivileges) {
    const res = s(g.resource);
    const by = tableGrants.get(res) ?? new Map<string, string[]>();
    const list = by.get(s(g.grantee)) ?? [];
    list.push(s(g.privilege));
    by.set(s(g.grantee), list);
    tableGrants.set(res, by);
  }

  const columnGrants = new Map<string, Map<string, string[]>>();
  for (const g of raw.columnPrivileges) {
    const res = s(g.resource);
    const key = `${s(g.grantee)}:${s(g.column_name)}`;
    const by = columnGrants.get(res) ?? new Map<string, string[]>();
    const list = by.get(key) ?? [];
    list.push(s(g.privilege));
    by.set(key, list);
    columnGrants.set(res, by);
  }

  const guards = new Map<string, string[]>();
  for (const t of raw.writeGuards) {
    const res = s(t.resource);
    guards.set(res, [...(guards.get(res) ?? []), s(t.trigger_name)]);
  }

  const policiesByResource = new Map<string, Record<string, unknown>[]>();
  for (const p of raw.policies) {
    const res = s(p.resource);
    policiesByResource.set(res, [...(policiesByResource.get(res) ?? []), p]);
  }

  // Schema USAGE decides whether anything inside a schema is reachable at all.
  const schemaUsage = new Map<string, Set<string>>();
  for (const sp of raw.schemaPrivileges) {
    if (s(sp.privilege) !== "USAGE") continue;
    const set = schemaUsage.get(s(sp.resource)) ?? new Set<string>();
    set.add(s(sp.grantee));
    schemaUsage.set(s(sp.resource), set);
  }

  /** A grantee reaches a resource only if it also holds USAGE on the schema. */
  const reachesSchema = (schema: string, grantee: string): boolean => {
    const set = schemaUsage.get(schema);
    if (!set) return false;
    return set.has(grantee) || set.has("PUBLIC");
  };

  // --- resources -----------------------------------------------------------
  const resources: ResourceRow[] = [];

  for (const r of raw.relations) {
    const resource = s(r.resource);
    const schema = s(r.schema_name);
    const rlsEnabled = b(r.rls_enabled);
    const rlsForced = b(r.rls_forced);
    const policyCount = Number(r.policy_count ?? 0);
    const kind = s(r.rel_kind);

    // Only privileges whose schema is also reachable count as reachable.
    const reachableBy: Record<string, string[]> = {};
    for (const [grantee, privs] of tableGrants.get(resource) ?? []) {
      if (reachesSchema(schema, grantee)) reachableBy[grantee] = [...new Set(privs)].sort();
    }
    const columnReachableBy: Record<string, string[]> = {};
    for (const [key, privs] of columnGrants.get(resource) ?? []) {
      const grantee = key.split(":")[0] ?? "";
      if (reachesSchema(schema, grantee)) columnReachableBy[key] = [...new Set(privs)].sort();
    }

    const row: ResourceRow = {
      resource, schema, name: s(r.rel_name), kind,
      owner: s(r.owner),
      rlsEnabled, rlsForced, policyCount,
      viewSecurityInvoker: r.view_security_invoker === null || r.view_security_invoker === undefined
        ? null : b(r.view_security_invoker),
      reachableBy, columnReachableBy,
      writeGuards: guards.get(resource) ?? [],
      declaredIntent: r.declared_intent === null ? null : s(r.declared_intent),
    };
    resources.push(row);

    // --- controls on this resource ---
    if (kind === "table" || kind === "partitioned_table") {
      controls.push({
        resource, resourceKind: kind, controlKind: "rls_enabled",
        controlId: `${resource}#rls_enabled`, present: rlsEnabled,
        detail: { rls_enabled: rlsEnabled }, declaredIntent: null,
      });
      controls.push({
        resource, resourceKind: kind, controlKind: "rls_forced",
        controlId: `${resource}#rls_forced`, present: rlsForced,
        detail: { rls_forced: rlsForced, owner: row.owner }, declaredIntent: null,
      });
    }

    for (const [grantee, privs] of Object.entries(reachableBy)) {
      controls.push({
        resource, resourceKind: kind, controlKind: "table_grant",
        controlId: `${resource}#grant:${grantee}`, present: true,
        detail: { grantee, privileges: privs }, declaredIntent: null,
      });
    }
    for (const [key, privs] of Object.entries(columnReachableBy)) {
      controls.push({
        resource, resourceKind: kind, controlKind: "column_grant",
        controlId: `${resource}#colgrant:${key}`, present: true,
        detail: { grantee_and_column: key, privileges: privs }, declaredIntent: null,
      });
    }

    // --- observations ---
    const anyReachable = Object.keys(reachableBy).length > 0 || Object.keys(columnReachableBy).length > 0;
    const clientReachable = Object.keys(reachableBy).filter((g) => CLIENT.includes(g) || g === "PUBLIC");
    const anonReachable = clientReachable.includes("anon") || clientReachable.includes("PUBLIC");

    if (kind === "table" || kind === "partitioned_table") {
      if (!rlsEnabled) {
        observations.push({
          resource,
          kind: anyReachable ? "rls_disabled_and_reachable" : "rls_disabled_not_reachable",
          detail: anyReachable
            ? `row-level security is off and the table is reachable by ${Object.keys(reachableBy).join(", ") || "a column grant"}`
            : `row-level security is off; no client-reachable role holds a privilege, so access is refused by the grant surface alone`,
        });
      } else if (policyCount === 0) {
        // Enabled with no policy denies everything to non-owners. That is the
        // most restrictive state there is, not the absence of a control -- and
        // reporting it as a gap would put five false positives at the top of
        // the findings list.
        observations.push({
          resource,
          kind: anyReachable ? "grant_without_policy" : "deny_by_default",
          detail: anyReachable
            ? `row-level security is on with no policy, yet ${Object.keys(reachableBy).join(", ")} holds a grant: the grant says allowed and the policy set says deny. Effectively denied, but the two disagree`
            : `row-level security is on with no policy and no client-reachable grant: every non-owner is denied`,
        });
      }
      if (rlsEnabled && !rlsForced) {
        observations.push({
          resource, kind: "rls_enabled_not_forced",
          detail: `policies are not applied to the table owner (${row.owner}); FORCE ROW LEVEL SECURITY is not set`,
        });
      }
      if (anonReachable) {
        observations.push({
          resource, kind: "anon_reachable",
          detail: `reachable without an account: ${clientReachable
            .filter((g) => g === "anon" || g === "PUBLIC")
            .map((g) => `${g} holds ${(reachableBy[g] ?? []).join(", ")}`)
            .join("; ")}`,
        });
      }
      if (Object.keys(reachableBy).includes("PUBLIC")) {
        observations.push({
          resource, kind: "public_grant",
          detail: `granted to PUBLIC (${(reachableBy["PUBLIC"] ?? []).join(", ")}), which includes every role on the instance`,
        });
      }
    }

    if (kind === "view" && row.viewSecurityInvoker === false && anyReachable) {
      observations.push({
        resource, kind: "view_bypasses_invoker_rls",
        detail: `view is not security_invoker, so the underlying tables' policies are evaluated as its owner (${row.owner}), not as the caller`,
      });
    }
  }

  // --- policies as controls ------------------------------------------------
  for (const p of raw.policies) {
    const resource = s(p.resource);
    const command = s(p.command);
    const hasWithCheck = p.with_check_expr !== null && p.with_check_expr !== undefined;
    controls.push({
      resource, resourceKind: "table", controlKind: "policy",
      controlId: `${resource}#policy:${s(p.policy_name)}`, present: true,
      detail: {
        policy_name: s(p.policy_name), command,
        permissive: s(p.permissive), roles: arr(p.roles, "policies.roles"),
        using_expr: p.using_expr ?? null,
        with_check_expr: p.with_check_expr ?? null,
      },
      declaredIntent: p.declared_intent === null ? null : s(p.declared_intent),
    });

    // A policy governing a write path with no WITH CHECK falls back to USING
    // for UPDATE, and for INSERT permits nothing at all. Recorded because the
    // missing half is not visible from the policy's name.
    if ((command === "INSERT" || command === "UPDATE" || command === "ALL") && !hasWithCheck) {
      observations.push({
        resource, kind: "write_policy_without_with_check",
        detail: `policy ${s(p.policy_name)} (${command}) has no WITH CHECK expression; the rows it permits to be WRITTEN are decided by USING, or by nothing at all on INSERT`,
      });
    }
  }

  // --- functions as controls ----------------------------------------------
  for (const f of raw.routines) {
    const resource = s(f.resource);
    const isDefiner = b(f.security_definer);
    const execBy = arr(f.executable_by, "routines.executable_by");
    const config = arr(f.config, "routines.config");

    if (isDefiner) {
      controls.push({
        resource, resourceKind: "function", controlKind: "security_definer_function",
        controlId: `${resource}#security_definer`, present: true,
        detail: {
          owner: s(f.owner), language: s(f.language),
          config: config.length ? config : null,
          executable_by: execBy,
        },
        declaredIntent: f.declared_intent === null ? null : s(f.declared_intent),
      });

      const pinned = config.some((c) => c.toLowerCase().startsWith("search_path="));
      if (!pinned && execBy.length > 0) {
        observations.push({
          resource, kind: "security_definer_without_pinned_search_path",
          detail: `SECURITY DEFINER, executable by ${execBy.join(", ")}, with no search_path pinned in the function's configuration`,
        });
      }
    }
    if (execBy.length > 0) {
      controls.push({
        resource, resourceKind: "function", controlKind: "function_execute_grant",
        controlId: `${resource}#execute`, present: true,
        detail: { executable_by: execBy, security_definer: isDefiner },
        declaredIntent: null,
      });
    }
  }

  // --- write guards as controls -------------------------------------------
  for (const t of raw.writeGuards) {
    controls.push({
      resource: s(t.resource), resourceKind: "table", controlKind: "write_guard_trigger",
      controlId: `${s(t.resource)}#trigger:${s(t.trigger_name)}`,
      present: s(t.enabled) === "O",
      detail: {
        trigger: s(t.trigger_name), function: s(t.trigger_function),
        timing: s(t.timing), level: s(t.level), events: arr(t.events, "write_guards.events"),
        enabled: s(t.enabled),
      },
      declaredIntent: t.declared_intent === null ? null : s(t.declared_intent),
    });
  }

  // --- realtime publication membership ------------------------------------
  for (const pub of raw.publications) {
    for (const table of arr(pub.tables, "publications.tables")) {
      controls.push({
        resource: table, resourceKind: "table", controlKind: "realtime_publication",
        controlId: `${table}#publication:${s(pub.pubname)}`, present: true,
        detail: { publication: s(pub.pubname) }, declaredIntent: null,
      });
    }
  }

  const counts: Record<string, number> = {
    resources: resources.length,
    controls: controls.length,
    observations: observations.length,
    anonReach: raw.anonymousReach.length,
    anonReachApplication: raw.anonymousReach.filter((r) => r.in_application_schema === true).length,
    anonReachPlatform: raw.anonymousReach.filter((r) => r.in_application_schema !== true).length,
  };
  for (const c of controls) counts[`control.${c.controlKind}`] = (counts[`control.${c.controlKind}`] ?? 0) + 1;
  for (const o of observations) counts[`observation.${o.kind}`] = (counts[`observation.${o.kind}`] ?? 0) + 1;

  return {
    resources,
    controls: controls.sort((a, x) => a.controlId.localeCompare(x.controlId)),
    roles: raw.roles,
    publications: raw.publications,
    defaultPrivileges: raw.defaultPrivileges,
    anonymousReach: raw.anonymousReach,
    observations: observations.sort((a, x) =>
      a.resource.localeCompare(x.resource) || a.kind.localeCompare(x.kind)),
    counts,
  };
}
