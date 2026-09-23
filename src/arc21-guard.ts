/**
 * Attest — the Arc21 source-state guard.
 *
 * Arc21 is a read-only assessment target (DECISIONS D3.31). Attest may read its
 * source and rebuild a disposable database from its migrations; it may never
 * change a file in the checkout, stage anything, commit anything or move a ref.
 * That boundary used to be a property of how the code happened to be written —
 * every write Attest makes goes under `evidence/` or `rubric/` — and this module
 * makes it a property that is checked.
 *
 * ## The checkout is allowed to be dirty
 *
 * The author works in the Arc21 tree, and at the time of writing it carries 36
 * modified tracked files and 23 untracked ones, one of which is a migration.
 * Requiring a clean tree would mean either refusing to run or cleaning someone
 * else's work, and both are wrong. So the guard does not ask "is Arc21 clean?".
 * It asks "is Arc21 exactly as it was before Attest ran?" — it fingerprints the
 * state before, fingerprints it after, and fails if they differ. Pre-existing
 * changes are neither reverted nor attributed to Attest.
 *
 * ## What the fingerprint covers
 *
 *   branch, HEAD, every ref           no commit, branch, tag or stash appeared
 *   the index (`ls-files -s`)         nothing was staged or unstaged
 *   worktree diff vs index            no tracked file's content changed
 *   staged diff vs HEAD               ditto, for the staged half
 *   `status --porcelain`              the overall shape, as git reports it
 *   untracked files, with content     no untracked file was added, removed or
 *                                     edited — including the uncommitted migration
 *   ignored entries (names only)      no new ignored path appeared, which is where
 *                                     a stray credential or token file would land
 *
 * Contents of ignored DIRECTORIES are not hashed — `node_modules/` alone would
 * make that slow — so a write inside an already-ignored directory is not seen.
 * The one known writer of that kind is the Supabase CLI, which maintains
 * `supabase/.temp/` when `bringup` runs `supabase db reset` in the Arc21 tree.
 * That is tool metadata in a gitignored directory, not Arc21 source.
 *
 * ## Reading without writing
 *
 * `git status` refreshes the index's stat cache and writes it back when it can
 * take the lock. That is not a content change, but it is a write into Arc21's
 * `.git`, so every git invocation here runs with `GIT_OPTIONAL_LOCKS=0`, which
 * tells git not to. `schema-version.ts` uses the same environment.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { SUT_REPO } from "./config.ts";

const run = promisify(execFile);

/** The environment for every git command pointed at Arc21. */
export const READ_ONLY_GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  LC_ALL: "C",
};

/** Exit code for a harness safety violation, distinct from an ordinary failure. */
export const ARC21_GUARD_EXIT_CODE = 3;

export interface Arc21SourceState {
  readonly capturedAt: string;
  readonly repo: string;
  readonly branch: string;
  readonly head: string;
  readonly refsSha256: string;
  readonly indexSha256: string;
  readonly unstagedDiffSha256: string;
  readonly stagedDiffSha256: string;
  readonly statusSha256: string;
  /** `git diff --name-status HEAD`: the tracked files that differ from HEAD. */
  readonly trackedModified: readonly string[];
  /** Untracked, not ignored, with the sha256 of each file's content. */
  readonly untracked: readonly { readonly path: string; readonly sha256: string }[];
  /** `git status --ignored`, names only; ignored directories are collapsed. */
  readonly ignoredEntries: readonly string[];
  /** One digest over every component above. */
  readonly fingerprint: string;
}

const sha256 = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

async function git(repo: string, ...args: string[]): Promise<Buffer> {
  const { stdout } = await run("git", ["-C", repo, ...args], {
    env: READ_ONLY_GIT_ENV,
    encoding: "buffer",
    maxBuffer: 1 << 30,
  });
  return stdout as unknown as Buffer;
}

/**
 * Fingerprint the Arc21 checkout. Reads only.
 *
 * Throws if the checkout cannot be read as a git repository. The callers treat
 * that as a failure: a guard that cannot see is not a guard.
 */
export async function captureArc21State(repo: string = SUT_REPO): Promise<Arc21SourceState> {
  let branch: string;
  try {
    branch = (await git(repo, "symbolic-ref", "--short", "-q", "HEAD")).toString().trim();
  } catch {
    branch = "(detached)";
  }
  const head = (await git(repo, "rev-parse", "HEAD")).toString().trim();
  const refs = await git(repo, "for-each-ref", "--format=%(objectname) %(refname)");
  const index = await git(repo, "ls-files", "-s", "-z");
  const unstaged = await git(repo, "diff", "--no-ext-diff", "--no-textconv", "--binary");
  const staged = await git(repo, "diff", "--cached", "--no-ext-diff", "--no-textconv", "--binary");
  const status = await git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all");
  const trackedModified = (await git(repo, "diff", "--name-status", "HEAD"))
    .toString()
    .split("\n")
    .filter(Boolean);

  const untrackedPaths = (await git(repo, "ls-files", "--others", "--exclude-standard", "-z"))
    .toString()
    .split("\0")
    .filter(Boolean)
    .sort();
  const untracked: { path: string; sha256: string }[] = [];
  for (const p of untrackedPaths) {
    const full = join(repo, p);
    const st = await lstat(full);
    const body = st.isSymbolicLink() ? Buffer.from(`symlink:${await readlink(full)}`) : await readFile(full);
    untracked.push({ path: p, sha256: sha256(body) });
  }

  const ignoredEntries = (await git(repo, "status", "--porcelain=v1", "--ignored=traditional", "--untracked-files=normal"))
    .toString()
    .split("\n")
    .filter((l) => l.startsWith("!! "))
    .map((l) => l.slice(3))
    .sort();

  const parts = {
    branch,
    head,
    refsSha256: sha256(refs),
    indexSha256: sha256(index),
    unstagedDiffSha256: sha256(unstaged),
    stagedDiffSha256: sha256(staged),
    statusSha256: sha256(status),
    untracked,
    ignoredEntries,
  };
  return {
    capturedAt: new Date().toISOString(),
    repo,
    ...parts,
    trackedModified,
    fingerprint: sha256(JSON.stringify(parts)),
  };
}

export interface Arc21Comparison {
  readonly identical: boolean;
  /** Each difference in plain words. Empty when identical. */
  readonly differences: readonly string[];
}

/** Compare two fingerprints component by component, and say what moved. */
export function compareArc21State(pre: Arc21SourceState, post: Arc21SourceState): Arc21Comparison {
  const d: string[] = [];
  if (pre.repo !== post.repo) d.push(`the two states describe different checkouts (${pre.repo} vs ${post.repo})`);
  if (pre.branch !== post.branch) d.push(`branch changed: ${pre.branch} -> ${post.branch}`);
  if (pre.head !== post.head) d.push(`HEAD moved: ${pre.head.slice(0, 12)} -> ${post.head.slice(0, 12)} (a commit, checkout or reset happened)`);
  if (pre.refsSha256 !== post.refsSha256) d.push("a ref changed: a branch, tag or stash was created, moved or deleted");
  if (pre.indexSha256 !== post.indexSha256) d.push("the index changed: something was staged or unstaged");
  if (pre.stagedDiffSha256 !== post.stagedDiffSha256) d.push("the staged diff against HEAD changed");
  if (pre.unstagedDiffSha256 !== post.unstagedDiffSha256) d.push("a tracked file's content changed in the working tree");
  if (pre.statusSha256 !== post.statusSha256) d.push("git status reports a different set of changes");

  const before = new Map(pre.untracked.map((u) => [u.path, u.sha256]));
  const after = new Map(post.untracked.map((u) => [u.path, u.sha256]));
  for (const [p, h] of after) {
    if (!before.has(p)) d.push(`untracked file appeared: ${p}`);
    else if (before.get(p) !== h) d.push(`untracked file's content changed: ${p}`);
  }
  for (const p of before.keys()) if (!after.has(p)) d.push(`untracked file disappeared: ${p}`);

  const ib = new Set(pre.ignoredEntries);
  const ia = new Set(post.ignoredEntries);
  for (const p of ia) if (!ib.has(p)) d.push(`ignored path appeared: ${p} — check it is not a credential or artefact written by the harness`);
  for (const p of ib) if (!ia.has(p)) d.push(`ignored path disappeared: ${p}`);

  // The digest is the backstop: if a component differs in a way the named
  // checks above do not describe, the fingerprints still disagree.
  if (d.length === 0 && pre.fingerprint !== post.fingerprint) d.push("the fingerprints differ");
  return { identical: d.length === 0, differences: d };
}

/** One line for logs and evidence. */
export function describeArc21State(s: Arc21SourceState): string {
  return (
    `${s.branch} @ ${s.head.slice(0, 12)}, ${s.trackedModified.length} tracked file(s) differing from HEAD, ` +
    `${s.untracked.length} untracked, fingerprint ${s.fingerprint.slice(0, 16)}…`
  );
}
