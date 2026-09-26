# The local database and its backups

Attest rebuilds a *disposable* database, but the database is not Attest's alone: it is the
Supabase CLI's local stack for the Arc21 project (`arc21`), which the author's own Arc21 checkouts
use too. This note records what that database holds now, what each backup in `.local-backups/`
is, how the backups were verified, and how to restore one. Nothing here was restored over the
shared database: that is the author's step, and Attest does not overwrite a database it has not
proven it can put back.

`.local-backups/` is gitignored and is never committed — the dumps hold the author's own
development data.

## What the shared database holds now

Checked read-only on 2026-09-26 (`supabase_db_arc21`, PostgreSQL 17.6, image
`public.ecr.aws/supabase/postgres:17.6.1.159`): **Attest's baseline build** — the 59 migrations
of the protected Arc21 checkout, rebuilt by `npm run attest bringup` on 2026-09-26, the Attest
seed and its fixtures, and the five synthetic Attest accounts (`alice`, `bob`, `carol`, `dave`,
`erin` at `attest.test`). None of the author's development work is in it; the only other sessions
were the stack's own services.

## The backups

| File | Taken | What it is | SHA-256 (prefix) |
|---|---|---|---|
| `arc21-dev-20260921-112205.dump` | 2026-09-21, before Attest's first rebuild (`DECISIONS.md` D0.1) | `pg_dump -Fc` of the author's development database as Attest first found it: 60 migrations applied (the last, `20260915120000`, from the author's other checkout), 1,010 accounts | `0e195911ec251821` |
| `db-reset-20260921-112229.log` | 2026-09-21 | the output of the first `supabase db reset` Attest ran, straight after that dump | `3f40fa2bbc44edbf` |
| `arc21-shared-stack-before-wp3-20260924-172900.dump` | 2026-09-24 17:29 UTC, before the WP3 preparation rebuilt the stack (D3.50) | `pg_dump -Fc` of the shared stack after it had drifted back to the author's development state: 60 migrations, 7 accounts | `c52f4aa453ed60d8` |

## How they were verified (2026-09-26)

Into a **scratch container** of the same image — never the shared database:

1. `pg_restore --list` reads each dump: 1,492 and 1,484 table-of-contents entries.
2. A throwaway container (`docker run -d --name attest-restore-check -e POSTGRES_PASSWORD=<random>
   public.ecr.aws/supabase/postgres:17.6.1.159`, no host port published) received each dump into a
   fresh database of its own (`pg_restore -U supabase_admin -d <db>`).
3. The first attempt restored the application data read back in step 4, but reported errors for
   two roles that the full stack's Realtime and Functions services create and the bare image lacks
   (`supabase_realtime_admin`, `supabase_functions_admin`). With those two roles created first
   (`create role … nologin`), **both dumps restored with exit status 0 and no error.**
4. Read back from the restored copies: 60 applied migrations each (latest `20260915120000`);
   1,010 and 7 accounts respectively; 46 row-level security policies in `public` and `private`.
5. The container was removed (`docker rm -f attest-restore-check`); the shared database still
   held the 59-migration Attest baseline afterwards.

## Restoring over the shared database — the author's step

Not done, and not tested against the running stack: restoring over it replaces everything Attest
built, and any other client of the stack should be stopped first. A conservative sequence:

1. Verify the dump in a scratch container first, exactly as above.
2. Stop whatever else uses the stack (the app, the other checkout's tooling).
3. Restore as the stack's superuser, replacing the current objects:
   `docker exec -i supabase_db_arc21 pg_restore -U supabase_admin -d postgres --clean --if-exists < .local-backups/<file>.dump`,
   then restart the stack (`supabase stop && supabase start` in the Arc21 checkout) so its
   services reconnect to the restored schema.
4. Check it: the applied migrations, the account count and the policy count should match the
   figures above for that dump.

After a restore, the next `npm run attest bringup` (or `run`) rebuilds the stack from Arc21's
migrations again — Attest will refuse to plan against the restored database, because it is not a
build of the protected checkout's migration files (D3.50) — so take a fresh dump first if the
restored state matters.
