/**
 * Attest — identifying the schema under test.
 *
 * Evidence is worthless if you cannot say what it was evidence *about*. The
 * obvious identifier is the commit SHA of the system under test, and on its
 * own it is not good enough here: the Arc21 working tree carries uncommitted
 * changes, and at the time of writing one of them is a migration file that
 * exists in no commit. A run labelled only with a SHA would be claiming to
 * describe a schema that SHA does not produce.
 *
 * So the primary identifier is a content hash over the ordered set of
 * migration files — the thing that actually determines the schema. The git
 * SHA, the branch and a dirty flag are recorded alongside it as context, not
 * as the identifier.
 *
 * The database is also asked what it believes it has applied, and the two are
 * compared. A mismatch means the instance is not a build of these files, which
 * is a condition the harness must refuse to audit through.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { SUT_MIGRATIONS_DIR, SUT_REPO } from "./config.ts";
import type { Session } from "./db.ts";
import { READ_ONLY_GIT_ENV } from "./arc21-guard.ts";

const run = promisify(execFile);

export interface MigrationFile {
  readonly filename: string;
  /** The leading timestamp, which is what Supabase records as the version. */
  readonly version: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface SchemaVersion {
  /** The identifier. sha256 over each file's sha256, in filename order. */
  readonly migrationSetSha256: string;
  readonly migrationCount: number;
  readonly migrations: readonly MigrationFile[];
  readonly git: {
    readonly commit: string | null;
    readonly branch: string | null;
    readonly dirty: boolean;
    /** Migration files not committed to git. These are why a SHA is not enough. */
    readonly uncommittedMigrations: readonly string[];
  };
}

/** Hash the migration directory. Pure function of the files on disk. */
export async function readSchemaVersion(): Promise<SchemaVersion> {
  const names = (await readdir(SUT_MIGRATIONS_DIR))
    .filter((n) => n.endsWith(".sql"))
    .sort();

  const migrations: MigrationFile[] = [];
  for (const filename of names) {
    const body = await readFile(join(SUT_MIGRATIONS_DIR, filename));
    migrations.push({
      filename,
      version: filename.split("_")[0] ?? filename,
      sha256: createHash("sha256").update(body).digest("hex"),
      bytes: body.byteLength,
    });
  }

  const rollup = createHash("sha256");
  for (const m of migrations) rollup.update(m.sha256);

  return {
    migrationSetSha256: rollup.digest("hex"),
    migrationCount: migrations.length,
    migrations,
    git: await readGit(names),
  };
}

async function readGit(migrationNames: readonly string[]) {
  const git = async (...args: string[]) => {
    try {
      // GIT_OPTIONAL_LOCKS=0: `git status` would otherwise refresh and rewrite
      // Arc21's index. Arc21 is read-only to this harness (D3.31).
      const { stdout } = await run("git", ["-C", SUT_REPO, ...args], { env: READ_ONLY_GIT_ENV });
      return stdout.trim();
    } catch {
      return null;
    }
  };

  const commit = await git("rev-parse", "HEAD");
  const branch = await git("rev-parse", "--abbrev-ref", "HEAD");
  const status = await git("status", "--porcelain");

  // `git ls-files` lists only tracked paths, so anything missing from it is
  // a migration git has never seen.
  const tracked = new Set(
    ((await git("ls-files", "supabase/migrations")) ?? "")
      .split("\n")
      .map((p) => p.split("/").pop() ?? "")
      .filter(Boolean),
  );

  return {
    commit,
    branch,
    dirty: status !== null && status.length > 0,
    uncommittedMigrations: migrationNames.filter((n) => !tracked.has(n)),
  };
}

export interface AppliedState {
  readonly appliedVersions: readonly string[];
  /** Applied in the database but with no file on disk. */
  readonly appliedWithoutFile: readonly string[];
  /** On disk but not applied. */
  readonly fileNotApplied: readonly string[];
  readonly matches: boolean;
}

/** Ask the instance what it has applied and compare it to the files. */
export async function readAppliedState(
  session: Session,
  version: SchemaVersion,
): Promise<AppliedState> {
  const { rows } = await session.query<{ version: string }>(
    `select version from supabase_migrations.schema_migrations order by version`,
  );
  const applied = rows.map((r) => r.version);
  const onDisk = new Set(version.migrations.map((m) => m.version));
  const inDb = new Set(applied);

  const appliedWithoutFile = applied.filter((v) => !onDisk.has(v));
  const fileNotApplied = version.migrations
    .map((m) => m.version)
    .filter((v) => !inDb.has(v));

  return {
    appliedVersions: applied,
    appliedWithoutFile,
    fileNotApplied,
    matches: appliedWithoutFile.length === 0 && fileNotApplied.length === 0,
  };
}

/**
 * Why an instance may not be planned or measured against, or null if it may.
 *
 * The WP3 plan is read from the live catalogs, so a plan read from an instance
 * that is not a build of these files describes a schema stored nowhere. Found
 * on 2026-09-24: the local Supabase stack is shared, by project id, with the
 * author's own Arc21 checkout, which had applied a migration this checkout does
 * not have. Preflight built a plan from it, and refused only because that
 * migration happened to drop a policy a planned row reads (D3.50). Pure, so
 * prove-gates can hand it a mismatch without touching a database.
 */
export function unbuiltInstanceReason(applied: AppliedState): string | null {
  if (applied.matches) return null;
  const parts = [
    applied.appliedWithoutFile.length ? `applied in the database with no migration file: ${applied.appliedWithoutFile.join(", ")}` : null,
    applied.fileNotApplied.length ? `present as a file but not applied: ${applied.fileNotApplied.join(", ")}` : null,
  ].filter(Boolean);
  return (
    `the instance is not a build of these migration files (${parts.join("; ")}). ` +
    "Anything read from it would describe a schema stored nowhere. Run `npm run attest bringup` to rebuild it first."
  );
}

/** Short form for filenames and report headers. */
export function shortVersion(v: SchemaVersion): string {
  return v.migrationSetSha256.slice(0, 12);
}
