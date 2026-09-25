/**
 * Attest — identifying the harness itself.
 *
 * Every evidence record already says which schema it describes. It also has to
 * say which version of the tool produced it, for a reason that becomes acute in
 * WP4: drift detection compares one run's output to another's, and a difference
 * between two runs can come from the schema changing or from the harness
 * changing. Without this field those two are indistinguishable, and a
 * refactoring of the inventory would be reported as Arc21 gaining or losing
 * controls.
 *
 * It is a content hash over the harness's own sources rather than a version
 * number someone has to remember to bump.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";

export interface HarnessVersion {
  readonly version: string;
  readonly sourcesSha256: string;
  readonly fileCount: number;
}

async function filesUnder(dir: string, ext: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(full, ext)));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

export async function readHarnessVersion(): Promise<HarnessVersion> {
  const pkg = JSON.parse(await readFile(join(ATTEST_ROOT, "package.json"), "utf8")) as {
    version?: string;
  };
  // `rubric/*.ts` is code the planner and executor import — the fixture ids, the
  // F5 specifications, the intent drafts, the frozen ratings — so it is part of
  // the tool. It was left out until 2026-09-25 (D3.55); a run recorded before
  // then was hashed over src/, sql/ and the seed only. The rubric's JSON files
  // are inputs, not code, and each is checked on its own (the approved
  // manifest's equality gate; the intent store, per record).
  const files = [
    ...(await filesUnder(join(ATTEST_ROOT, "src"), ".ts")),
    ...(await filesUnder(join(ATTEST_ROOT, "rubric"), ".ts")),
    ...(await filesUnder(join(ATTEST_ROOT, "sql"), ".sql")),
    join(ATTEST_ROOT, "seed", "seed.sql"),
  ].sort();

  const rollup = createHash("sha256");
  for (const f of files) {
    rollup.update(createHash("sha256").update(await readFile(f)).digest("hex"));
  }

  return {
    version: pkg.version ?? "0.0.0",
    sourcesSha256: rollup.digest("hex"),
    fileCount: files.length,
  };
}
