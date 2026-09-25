/**
 * Attest — WP4 schema states, reconstructed without touching Arc21 (D3.56).
 *
 * The brief asks for runs "across deliberately different schema states". The
 * honest source of different states is Arc21's own history: each commit that
 * changed `supabase/migrations` is a schema the author actually had. Each state
 * here is written into an Attest-owned scratch directory (`.wp4-states/`,
 * gitignored), and a run rebuilds the disposable database from THAT directory
 * (`ATTEST_SUT_REPO`), never from the protected checkout:
 *
 *   git-commit      `git archive <commit> supabase` — read-only: it writes the
 *                   tar to a file Attest owns and changes nothing in the repo;
 *                   no checkout, no worktree, no ref, no index refresh
 *                   (GIT_OPTIONAL_LOCKS=0)
 *   working-tree    a file copy of the checkout's `supabase/` as it stands,
 *                   uncommitted migration included (the WP3 state), without the
 *                   Supabase CLI's own gitignored metadata
 *   controlled      the working tree plus ONE Attest-authored migration, which
 *                   exists only in the scratch copy — a deliberate change made
 *                   to prove the detector sees it, never a finding about Arc21
 *
 * Every attest command fingerprints the protected checkout before and after
 * (D3.32), so a state reconstruction that touched it would fail as a harness
 * safety violation.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ARC21_CHECKOUT, ATTEST_ROOT } from "./config.ts";
import { READ_ONLY_GIT_ENV } from "./arc21-guard.ts";

const run = promisify(execFile);

export const STATES_ROOT = join(ATTEST_ROOT, ".wp4-states");

export type StateSource =
  | { readonly kind: "git-commit"; readonly commit: string }
  | { readonly kind: "working-tree" }
  | { readonly kind: "controlled"; readonly migration: { readonly filename: string; readonly sql: string } };

export interface StateSpec {
  /** Short, sortable name; the order of the drift chain. */
  readonly name: string;
  readonly label: string;
  readonly why: string;
  readonly source: StateSource;
  /** Execute the compatible approved probes in this state (the WP3 results are reused for the current state). */
  readonly runProbes: boolean;
}

/**
 * The Attest-authored migration of the controlled state. It simulates the
 * mistake the brief names — a table added with no policy — and is never part
 * of Arc21.
 */
export const CONTROLLED_MIGRATION = {
  filename: "20260924000000_attest_wp4_unprotected_table.sql",
  sql: `-- ============================================================================
-- ATTEST-OWNED. WP4 drift-detector validation (DECISIONS D3.56).
--
-- This file exists only in an Attest scratch copy of the schema, under
-- .wp4-states/. It is not, and must never become, part of Arc21. It simulates
-- the mistake continuous control monitoring exists to catch: a developer adds a
-- table and forgets row-level security and a policy. The table holds one
-- synthetic row.
-- ============================================================================
create table public.attest_wp4_unprotected_notes (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid,
  body       text not null,
  created_at timestamptz not null default now()
);
insert into public.attest_wp4_unprotected_notes (author_id, body)
values (null, 'Synthetic row written by an Attest-only migration. If a client can read this, the table has no control.');
`,
} as const;

export const WP4_STATES: readonly StateSpec[] = [
  {
    name: "H1-009464c",
    label: "Arc21 at 009464c (45 migrations), 2026-08-30 — before Realtime channel authorization",
    why: "the last committed state before 20260831120000_realtime_channel_authorization added Arc21's policies on realtime.messages",
    source: { kind: "git-commit", commit: "009464c" },
    runProbes: true,
  },
  {
    name: "H2-4f9f7a6",
    label: "Arc21 at 4f9f7a6 (53 migrations), 2026-09-02 — before the least-privilege hardening",
    why: "the last committed state before 20260904120000_least_privilege_and_entry_visibility, Arc21's own authorization hardening",
    source: { kind: "git-commit", commit: "4f9f7a6" },
    runProbes: true,
  },
  {
    name: "C-current",
    label: "Arc21's working tree (59 migrations, one uncommitted) — the state the WP3 assessment ran against",
    why: "the current state; its results are the official WP3 run's, not re-executed",
    source: { kind: "working-tree" },
    runProbes: false,
  },
  {
    name: "T-controlled",
    label: "the current state plus one Attest-only migration adding a table with no row-level security and no policy",
    why: "a deliberate, controlled change proving the detector catches a new unprotected resource on the next run, without anyone looking for it",
    source: { kind: "controlled", migration: CONTROLLED_MIGRATION },
    runProbes: false,
  },
];

export interface MaterializedState {
  readonly name: string;
  readonly dir: string;
  readonly source: StateSource;
  readonly provenance: string;
  readonly migrations: readonly { readonly filename: string; readonly sha256: string }[];
  /** sha256 over each migration file's sha256 in filename order — the same identifier as D0.2. */
  readonly migrationSetSha256: string;
}

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

async function hashMigrations(dir: string): Promise<{ migrations: { filename: string; sha256: string }[]; set: string }> {
  const mdir = join(dir, "supabase", "migrations");
  const names = (await readdir(mdir)).filter((n) => n.endsWith(".sql")).sort();
  const migrations: { filename: string; sha256: string }[] = [];
  const roll = createHash("sha256");
  for (const n of names) {
    const h = sha256(await readFile(join(mdir, n)));
    migrations.push({ filename: n, sha256: h });
    roll.update(h);
  }
  return { migrations, set: roll.digest("hex") };
}

/** Write one state into `.wp4-states/<name>/`, replacing whatever was there. */
export async function materialize(spec: StateSpec): Promise<MaterializedState> {
  const dir = join(STATES_ROOT, spec.name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let provenance: string;
  const src = spec.source;
  if (src.kind === "git-commit") {
    const full = (await run("git", ["-C", ARC21_CHECKOUT, "rev-parse", "--verify", `${src.commit}^{commit}`], { env: READ_ONLY_GIT_ENV })).stdout.trim();
    const tar = join(STATES_ROOT, `${spec.name}.tar`);
    await run("git", ["-C", ARC21_CHECKOUT, "archive", "--format=tar", "-o", tar, full, "supabase"], { env: READ_ONLY_GIT_ENV });
    await run("tar", ["-xf", tar, "-C", dir]);
    await rm(tar, { force: true });
    provenance = `git archive of commit ${full} (read-only; nothing checked out in the protected checkout)`;
  } else {
    await cp(join(ARC21_CHECKOUT, "supabase"), join(dir, "supabase"), {
      recursive: true,
      // The Supabase CLI's own gitignored metadata is not schema.
      filter: (p) => !/[/\\]supabase[/\\]\.(temp|branches)([/\\]|$)/.test(p),
    });
    provenance = "a file copy of the protected checkout's supabase/ directory as it stands, uncommitted migration included";
    if (src.kind === "controlled") {
      await writeFile(join(dir, "supabase", "migrations", src.migration.filename), src.migration.sql);
      provenance += `, plus the Attest-only migration ${src.migration.filename}`;
    }
  }
  const { migrations, set } = await hashMigrations(dir);
  return { name: spec.name, dir, source: src, provenance, migrations, migrationSetSha256: set };
}
