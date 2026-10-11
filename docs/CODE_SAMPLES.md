# Attest — Code samples

Seven excerpts from the assessment harness. They show implementation safeguards and classification rules, not certification or a current security assessment of Arc21. Frozen evidence and its historical target remain in the repository.

Reviewed October 11, 2026. Every code block below is a contiguous, verbatim excerpt from source at commit `5cee5f2`. Links pin the exact file and line range. Separate ranges have separate blocks; no code is rewritten or elided inside a block.

The older Drive source copy remains a historical archive. Current source is in GitHub; private repositories require existing access.

## 1. Refusing vacuous RLS tests

The client role and claims are set explicitly, then probed. Superusers are refused; BYPASSRLS is allowed only for the deliberate over-privilege demonstration.

[src/db.ts, lines 143–172](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/db.ts#L143-L172)

```ts
export async function roleSession(opts: RoleSessionOptions): Promise<Session> {
  const { role, claims = null, allowRlsBypass = false } = opts;
  const label = opts.label ?? role;

  const client = new pg.Client({ ...DB, ...LOGINS.client });
  await client.connect();

  try {
    // Role names cannot be parameterised; this is a format(%I) equivalent.
    await client.query(`set role ${quoteIdent(role)}`);
    // Claims can be, and are.
    await client.query(`select set_config('request.jwt.claims', $1, false)`, [
      claims === null ? "" : JSON.stringify(claims),
    ]);

    const identity = await probeIdentity(client, label, claims);

    if (identity.isSuperuser) {
      throw new Error(
        `refusing to test as a superuser: ${identity.currentUser}. ` +
          `Every row-level security check would pass without being enforced.`,
      );
    }
    if (identity.bypassesRls && !allowRlsBypass) {
      throw new Error(
        `refusing to test as ${identity.currentUser}: it holds BYPASSRLS. ` +
          `Row-level security would not be applied and every test would pass vacuously. ` +
          `Pass allowRlsBypass only for a deliberate over-privilege demonstration.`,
      );
    }
```

## 2. Testing whether weakening changes the observation

The probe runs after each controlled weakening and compares the broken and intact outcomes. Over-privileged identities are recorded separately to expose tests that do not discriminate.

[src/wp1.ts, lines 424–450](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/wp1.ts#L424-L450)

```ts
    // 2. weaken, stage by stage
    for (const [i, stage] of spec.stages.entries()) {
      await stage.weakening.apply(admin);
      applied.push(stage.weakening);
      const r = await runProbe(spec, ctx, spec.probeAs, `broken-${i + 1}`, admin);
      note(`after weakening ${i + 1}: ${stage.weakening.what}`, r, stage.expectAfter);
    }

    const brokenOutcome = timeline[timeline.length - 1]?.outcome ?? "";
    const intactOutcome = timeline[0]?.outcome ?? "";
    const detected = brokenOutcome !== intactOutcome;

    // 3. over-privileged, fully broken
    const overPrivileged: ProbeResult[] = [];
    for (const id of OVER_PRIVILEGED) {
      const r = await runProbe(spec, ctx, id, "broken", admin);
      records.push(r);
      const before = opIntact.get(id.label);
      overPrivileged.push({
        identityLabel: id.label,
        bypassesRls: r.identity.bypassesRls,
        intact: before?.actual ?? "?",
        broken: r.actual,
        intactMessage: before?.detail.message ?? null,
        brokenMessage: r.detail.message,
        discriminates: (before?.actual ?? "?") !== r.actual,
      });
```

## 3. Keeping unavailable measurements out of passes

Harness failures, registered contradictions, failed premises and unreached controls are classified before ordinary verdicts. An absent control is a gap rather than a successful probe.

[src/wp3-evaluate.ts, lines 591–622](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/wp3-evaluate.ts#L591-L622)

```ts
  if (worst("harness").length) {
    return { claims, observation: "harness_error", verdict: "not_measured", verdictReason: `the harness, not the database, answered: ${reasons(worst("harness"))}` };
  }
  if (ob.contradiction) {
    return { claims, observation: "blocked_contradiction", verdict: "not_measured", verdictReason: `registered contradiction ${ob.contradiction.id}: ${ob.contradiction.reason}` };
  }
  if (badPremises.length || worst("precondition").length) {
    return {
      claims, observation: "precondition_failed", verdict: "not_measured",
      verdictReason: `a premise did not hold, so the probe could not measure its claim: ${[...badPremises.map((p) => `${p.describe}: ${p.detail}`), reasons(worst("precondition"))].filter(Boolean).join(" | ")}`,
    };
  }
  if (worst("not_reached").length) {
    return { claims, observation: "control_not_reached", verdict: "not_measured", verdictReason: `the control this row names was not reached: ${reasons(worst("not_reached"))}` };
  }
  const bad = claims.filter((c) => c.status === "unmet");
  if (bad.length) {
    return {
      claims, observation: "not_as_predicted",
      verdict: t.polarity === "characterization" ? "characterized" : "deficient",
      verdictReason: t.polarity === "characterization"
        ? `the recorded fact differs from the plan's prediction: ${reasons(bad)}`
        : `the control was exercised and did not hold: ${reasons(bad)}`,
    };
  }
  return {
    claims, observation: "as_predicted", verdict: t.verdictWhenPredicted,
    verdictReason: t.verdictWhenPredicted === "effective" ? "every claim met"
      : t.verdictWhenPredicted === "characterized" ? "a fact was recorded; no control was asserted either way"
      : "the control does not exist to be exercised — this is an absence, not a pass",
  };
}
```

## 4. Recording both policy expressions

The inventory records USING and WITH CHECK separately, alongside command, policy role set and permissiveness. These are inventory facts; the probe and its preconditions determine the observation.

[sql/inventory/02_policies.sql, lines 16–40](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/sql/inventory/02_policies.sql#L16-L40)

```sql
select
  n.nspname || '.' || c.relname                   as resource,
  p.polname                                       as policy_name,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
  end                                             as command,
  case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as permissive,
  coalesce(
    (select array_agg(r.rolname::text order by r.rolname)
     from pg_roles r where r.oid = any (p.polroles)),
    array['PUBLIC']
  )                                               as roles,
  pg_get_expr(p.polqual,      p.polrelid)         as using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid)         as with_check_expr,
  obj_description(p.oid, 'pg_policy')             as declared_intent
from pg_policy p
join pg_class c     on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = any ($1::text[])
   or (n.nspname || '.' || c.relname) = any ($2::text[])
order by 1, 2;
```

## 5. Verifying the rebuilt baseline

The baseline setup checks the migration-content hash against the planned schema before applying fixtures and verifying canonical state. Database runs use a disposable target, as described in the reproducibility guide.

[src/wp3-isolation.ts, lines 239–257](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/wp3-isolation.ts#L239-L257)

```ts
export async function rebuildBaseline(opts: {
  epoch: number;
  expectedSchema: string;
  canonical: Canonical;
  arc21Pre: Arc21SourceState;
  log?: (s: string) => void;
  /** WP4 (D3.56): the baseline fixtures that apply to this schema state. Absent: all. */
  only?: ReadonlySet<string>;
}): Promise<BaselineEpoch> {
  const log = opts.log ?? (() => {});
  const t0 = Date.now();
  const b = await bringup((m) => { if (/reset attempt/.test(m)) log(m); });
  const sv = await readSchemaVersion();
  if (sv.migrationSetSha256 !== opts.expectedSchema) {
    throw new BaselineVerificationError(`the rebuilt schema is ${sv.migrationSetSha256.slice(0, 12)}…, not the planned ${opts.expectedSchema.slice(0, 12)}…`);
  }
  const verified = await withSession(adminSession("baseline"), async (a) => {
    await applySeedExtensions(a, () => {}, opts.only);
    return verifyBaselineState(a, opts.canonical, opts.only);
```

## 6. Constraining generated claims

The lint identifies terms that require scrutiny and claims the harness must never make. Its later checks examine context and negation; a word list alone does not validate a report.

[src/claims-lint.ts, lines 15–38](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/claims-lint.ts#L15-L38)

```ts
const RISKY: readonly RegExp[] = [
  /\bcomplian(t|ce)\b/i,
  /\bcertif(y|ied|ies|ication)\b/i,
  /\bGxP\b/,
  /\bCSV\b/,
  /\bcomputer[- ]system validation\b/i,
  /\b(validated|qualified) (system|tool|harness|software|process)\b/i,
  /\bFDA[- ]validat/i,
  /\b(regulatory|audit|compliance|validation)[- ]experience\b/i,
  /\b(meets|satisfies|fulfil(?:s|ls)|achieves) (the |all |every )?(control|requirement|regulation|AC-\d|AU-\d|CM-\d|SI-\d|CA-\d|§ ?11|Part 11)/i,
  /\bindependent (audit|assessment|assessor|review)\b/i,
  /\bPart 11 (system|compliant|compliance|validated)\b/i,
  /\bregulated system\b/i,
  /\bremediated by Attest\b/i,
];

/** Refused however they are phrased. */
const NEVER: readonly RegExp[] = [
  /\bArc21 (is|was|has been) (compliant|certified|validated)\b/i,
  /\b(is|are) (fully )?(compliant|certified) with\b/i,
  /\bachieve[sd]? compliance\b/i,
];

const NEGATION = /\b(not|no|never|nor|none|neither|without|cannot|isn't|aren't|doesn't|don't|wasn't|won't|nothing|nobody|n't)\b|\bno\b/i;
```

## 7. Comparing the protected checkout

Before and after state includes refs, index, tracked differences, status, untracked content and ignored paths. The digest backs up the component comparison. This guard applies to report-only CLI commands too.

[src/arc21-guard.ts, lines 168–196](https://github.com/tjsingh143/attest/blob/5cee5f2dd103219b428d7c04ce42c8289c0beefc/src/arc21-guard.ts#L168-L196)

```ts
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
```
