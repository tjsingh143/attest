/**
 * Attest — bring up a disposable instance.
 *
 * Three steps, in this order and for these reasons:
 *
 *   1. Rebuild the database from the Arc21 migrations. Not "connect to
 *      whatever is running": the instance this harness found running when it
 *      was first pointed at Arc21 had a migration applied that existed in no
 *      file and was missing two policies its migrations create. Auditing that
 *      would have produced evidence about a schema stored nowhere.
 *   2. Record the schema version and confirm the instance agrees with the
 *      files. If it does not, stop -- there is nothing worth measuring.
 *   3. Apply Attest's own seed. The seed lives in this repository, never in
 *      the Arc21 tree, so running the harness cannot change the system under
 *      test.
 *
 * This is destructive by design and refuses to run anywhere but a local
 * instance. See assertLocalTarget().
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DB, SEED_DIR, SUT_REPO } from "./config.ts";
import { adminSession, withSession, type Session } from "./db.ts";
import { readAppliedState, readSchemaVersion, type AppliedState, type SchemaVersion } from "./schema-version.ts";

const run = promisify(execFile);

/**
 * Refuse to point the harness at anything but a loopback address.
 *
 * The harness deliberately attempts unauthorized reads and writes and then
 * drops the database and rebuilds it. Both are defensible against a disposable
 * local instance and indefensible anywhere else, so the check is here rather
 * than in a README.
 */
export function assertLocalTarget(): void {
  const local = new Set(["127.0.0.1", "::1", "localhost"]);
  if (!local.has(DB.host)) {
    throw new Error(
      `Attest refuses to run against ${DB.host}. This harness rebuilds the database from ` +
        `migrations and deliberately attempts unauthorized statements; it is only ever ` +
        `pointed at a disposable local instance.`,
    );
  }
}

export interface BringupResult {
  readonly resetSeconds: number;
  /**
   * Each failed `supabase db reset` attempt before the one that succeeded, with
   * the phase it failed in. Empty on an ordinary rebuild (D3.55).
   */
  readonly resetRetries: readonly string[];
  readonly schemaVersion: SchemaVersion;
  readonly applied: AppliedState;
  readonly seededCounts: Readonly<Record<string, number>>;
}

/**
 * `supabase db reset --local`, run inside the Arc21 repository.
 *
 * Retried — at most three times, with a growing pause — unless the failure is a
 * SQL error raised by a migration, which would fail the same way again. The
 * second official WP3 run (20260925T010904Z) was aborted by a reset that applied
 * every migration and then failed while the CLI health-checked a restarted
 * container on a heavily loaded host; the first WP4 run (20260925T021927Z) lost
 * its first state to three failures on a host at load average ~128, one of them
 * while the CLI was still initialising the schema (D3.55, D3.56). Neither was a
 * migration error. Retrying cannot hide a bad state — whatever a reset produces
 * is then checked like every other rebuild: the applied migrations against the
 * files, and in a WP3 run the fixtures and the canonical digests.
 */
const RESET_ATTEMPTS = 4;

/** Where a failed reset stopped, from the CLI's own output; only a SQL error from a migration is final. */
export function resetFailurePhase(out: string): { retryable: boolean; phase: string } {
  const lines = out.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("{"));
  const sqlError = lines.find((l) => /^ERROR:/.test(l) || /\(SQLSTATE [0-9A-Z]{5}\)/.test(l));
  if (sqlError) return { retryable: false, phase: `a migration raised a SQL error (${sqlError.slice(0, 160)})` };
  const lastStep = [...lines].reverse().find((l) => /\.\.\.$/.test(l)) ?? "no step recorded";
  const detail = lines.filter((l) => /container|health|timed out|timeout|refused|reset by peer|EOF/i.test(l)).slice(-2).join(" / ");
  return { retryable: true, phase: `during "${lastStep}" with no SQL error${detail ? ` (${detail})` : ""}` };
}

async function resetFromMigrations(log: (s: string) => void): Promise<{ seconds: number; retries: string[] }> {
  const started = Date.now();
  const retries: string[] = [];
  for (let attempt = 1; ; attempt++) {
    try {
      await run("supabase", ["db", "reset", "--local"], {
        cwd: SUT_REPO,
        maxBuffer: 32 * 1024 * 1024,
      });
      return { seconds: (Date.now() - started) / 1000, retries };
    } catch (err) {
      const e = err as Error & { stdout?: string; stderr?: string };
      const { retryable, phase } = resetFailurePhase(`${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message}`);
      if (!retryable || attempt >= RESET_ATTEMPTS) throw err;
      retries.push(`attempt ${attempt} failed ${phase}`);
      const pause = 30 * 2 ** (attempt - 1);
      log(`  supabase db reset attempt ${attempt} failed ${phase}; retrying in ${pause}s`);
      await new Promise((r) => setTimeout(r, pause * 1000));
    }
  }
}

async function applySeed(session: Session): Promise<void> {
  const sql = await readFile(join(SEED_DIR, "seed.sql"), "utf8");
  await session.query(sql);
}

/** Read back what the seed produced, so the run record says what it started from. */
async function countSeeded(session: Session): Promise<Record<string, number>> {
  const { rows } = await session.query<{ label: string; n: string }>(`
    select 'auth.users'              as label, count(*)::text as n from auth.users
    union all select 'profiles',              count(*)::text from public.profiles
    union all select 'wallets',               count(*)::text from public.wallets
    union all select 'wallet_ledger',         count(*)::text from public.wallet_ledger
    union all select 'player_stats',          count(*)::text from public.player_stats
    union all select 'loadouts',              count(*)::text from public.loadouts
    union all select 'push_tokens',           count(*)::text from public.push_tokens
    union all select 'notifications',         count(*)::text from public.notifications
    union all select 'career_progress',       count(*)::text from public.career_progress
    union all select 'game_sessions',         count(*)::text from public.game_sessions
    union all select 'game_session_seats',    count(*)::text from public.game_session_seats
    union all select 'friendships',           count(*)::text from public.friendships
    union all select 'blocks',                count(*)::text from public.blocks
    union all select 'private.game_state_private', count(*)::text from private.game_state_private
    order by 1
  `);
  return Object.fromEntries(rows.map((r) => [r.label, Number(r.n)]));
}

export async function bringup(log: (s: string) => void = console.log): Promise<BringupResult> {
  assertLocalTarget();

  log(`  rebuilding ${DB.host}:${DB.port}/${DB.database} from migrations in ${SUT_REPO}`);
  const reset = await resetFromMigrations(log);
  const resetSeconds = reset.seconds;
  log(`  rebuilt in ${resetSeconds.toFixed(1)}s${reset.retries.length ? ` after ${reset.retries.length} retried reset(s)` : ""}`);

  const schemaVersion = await readSchemaVersion();

  return withSession(adminSession(), async (admin) => {
    const applied = await readAppliedState(admin, schemaVersion);

    if (!applied.matches) {
      const detail = [
        applied.appliedWithoutFile.length
          ? `applied in the database with no migration file: ${applied.appliedWithoutFile.join(", ")}`
          : null,
        applied.fileNotApplied.length
          ? `present as a file but not applied: ${applied.fileNotApplied.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("; ");
      throw new Error(
        `the instance is not a build of these migration files (${detail}). ` +
          `Nothing measured against it would describe a schema anyone can reproduce.`,
      );
    }
    log(`  schema version ${schemaVersion.migrationSetSha256.slice(0, 12)} (${schemaVersion.migrationCount} migrations, instance agrees)`);

    await applySeed(admin);
    const seededCounts = await countSeeded(admin);
    log(`  seeded ${seededCounts["auth.users"]} accounts and ${Object.values(seededCounts).reduce((a, b) => a + b, 0)} rows total`);

    return { resetSeconds, resetRetries: reset.retries, schemaVersion, applied, seededCounts };
  });
}
