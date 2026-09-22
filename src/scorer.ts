/**
 * Attest — the rubric's rule engine.
 *
 * Implements RUBRIC.md Part 3 and Part 5 exactly. It contains no risk judgment
 * of its own: the levels come from `rubric/ratings.json`, the rules come from
 * the rubric, and this file is the arithmetic-free machinery that joins them.
 *
 * Where the rubric did not specify a constant, the constant is named, commented
 * and surfaced in the CP3 report rather than buried. Those are marked
 * ESTIMATOR CHOICE.
 */
import type { RiskInput } from "./risk-inputs.ts";

export type Level = "Low" | "Medium" | "High";
export type Evidence = "E" | "P" | "U";
export type ExposureClass = "server_only" | "authenticated" | "anonymous";

/** Which failure mode decides which exposure path is scored (RUBRIC.md D5). */
export type FailureMode = "confidentiality" | "integrity" | "both";

export interface Rated {
  readonly level: Level;
  readonly evidence: Evidence;
  readonly why: string;
}

export interface ExposureRating {
  readonly level: Level;
  readonly evidence: Evidence;
  readonly why: string;
  /** Effective read path, recorded separately per the rubric. */
  readonly readExposure: ExposureClass;
  /** Effective write path, recorded separately per the rubric. */
  readonly writeExposure: ExposureClass;
  /** Which failure mode drives the risk, and therefore which path is scored. */
  readonly drivingFailureMode: FailureMode;
  /** Raw fact, recorded separately and never folded into the level. */
  readonly anonymousGrantExists: boolean;
  readonly anonymousPolicyPermits: boolean;
}

export interface ResourceRating {
  readonly resource: string;
  readonly data: Rated;
  readonly blast: Rated;
  readonly integrity: Rated;
  readonly reversibility: Rated;
  readonly exposure: ExposureRating;
  /** Set when the rubric itself decided this case (RUBRIC.md Part 4). */
  readonly preDecidedBy?: string;
}

// ---------------------------------------------------------------------------
// Part 3 Step 1 — impact
// ---------------------------------------------------------------------------

const atLeastMedium = (l: Level) => l === "Medium" || l === "High";

export interface ImpactResult {
  readonly impact: Level;
  /** The clause of Step 1 that fired, quoted closely enough to check. */
  readonly rule: string;
}

export function deriveImpact(r: ResourceRating): ImpactResult {
  const { data, blast, integrity, reversibility } = r;

  // High if data = High; or integrity = High; or reversibility = High AND at
  // least one of Data, Blast or Integrity is Medium or High.
  if (data.level === "High") {
    return { impact: "High", rule: "Data criticality = High" };
  }
  if (integrity.level === "High") {
    return { impact: "High", rule: "Integrity impact = High" };
  }
  if (
    reversibility.level === "High" &&
    (atLeastMedium(data.level) || atLeastMedium(blast.level) || atLeastMedium(integrity.level))
  ) {
    return {
      impact: "High",
      rule: "Reversibility = High and at least one of Data, Blast radius or Integrity is Medium or High",
    };
  }

  // Medium if not High and at least one of the four is Medium or High.
  const anyMedium =
    atLeastMedium(data.level) ||
    atLeastMedium(blast.level) ||
    atLeastMedium(integrity.level) ||
    atLeastMedium(reversibility.level);
  if (anyMedium) {
    const which = [
      atLeastMedium(data.level) ? `Data=${data.level}` : null,
      atLeastMedium(blast.level) ? `Blast=${blast.level}` : null,
      atLeastMedium(integrity.level) ? `Integrity=${integrity.level}` : null,
      atLeastMedium(reversibility.level) ? `Reversibility=${reversibility.level}` : null,
    ].filter(Boolean).join(", ");
    return { impact: "Medium", rule: `Not High; at least one consequence dimension is Medium or High (${which})` };
  }

  return { impact: "Low", rule: "All four consequence dimensions are Low" };
}

// ---------------------------------------------------------------------------
// Part 3 Step 2 — the exposure matrix
// ---------------------------------------------------------------------------

/**
 * Impact × exposure. Transcribed from RUBRIC.md Part 3 Step 2.
 *
 * Note the High row: High impact stays High at every exposure, which is the
 * rubric's explicit floor -- "high impact cannot be reduced below High solely
 * because the resource is server-only".
 */
const MATRIX: Record<Level, Record<ExposureClass, Level>> = {
  Low: { server_only: "Low", authenticated: "Low", anonymous: "Medium" },
  Medium: { server_only: "Medium", authenticated: "Medium", anonymous: "High" },
  High: { server_only: "High", authenticated: "High", anonymous: "High" },
};

/** The exposure class actually scored, chosen by the driving failure mode. */
export function scoredExposure(e: ExposureRating): ExposureClass {
  if (e.drivingFailureMode === "confidentiality") return e.readExposure;
  if (e.drivingFailureMode === "integrity") return e.writeExposure;
  // "if both independently matter -> use the more exposed relevant path"
  const rank: Record<ExposureClass, number> = { server_only: 0, authenticated: 1, anonymous: 2 };
  return rank[e.readExposure] >= rank[e.writeExposure] ? e.readExposure : e.writeExposure;
}

const EXPOSURE_AS_LEVEL: Record<ExposureClass, Level> = {
  server_only: "Low",
  authenticated: "Medium",
  anonymous: "High",
};

// ---------------------------------------------------------------------------
// Validation — the uncertainty rule, made enforceable
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  readonly resource: string;
  readonly problem: string;
}

/**
 * "A resource cannot receive a Low value on a dimension merely because the
 * necessary evidence is absent." Encoded as: Low with evidence U is refused.
 * The rubric singles reversibility out, but states the principle generally.
 */
export function validate(r: ResourceRating): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dims: [string, Rated][] = [
    ["Data criticality", r.data],
    ["Blast radius", r.blast],
    ["Integrity impact", r.integrity],
    ["Reversibility", r.reversibility],
  ];
  for (const [name, d] of dims) {
    if (d.level === "Low" && d.evidence === "U") {
      issues.push({
        resource: r.resource,
        problem: `${name} is Low with evidence U. The rubric refuses a Low assigned because evidence is absent; use the lowest level defensible from known evidence.`,
      });
    }
  }
  if (r.exposure.level !== EXPOSURE_AS_LEVEL[scoredExposure(r.exposure)]) {
    issues.push({
      resource: r.resource,
      problem: `Exposure level ${r.exposure.level} does not match the scored path (${scoredExposure(r.exposure)}).`,
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Part 5 — test-count estimation
// ---------------------------------------------------------------------------

/**
 * ESTIMATOR CHOICES. The rubric defines what a policy branch is and what each
 * tier must cover; it does not fix these numbers. They are named here so they
 * can be argued with, and they are reported in CP3.
 */
export const ESTIMATOR = {
  /** High tier: one positive and one negative per branch. */
  highCasesPerBranch: 2,
  /**
   * High tier boundary cases. The brief requires three to appear somewhere:
   * null or absent identity, an identity for a deleted user, an expired
   * session.
   */
  highBoundaryCases: 3,
  /** Medium tier: a representative positive and negative per important path. */
  mediumCasesPerCommand: 2,
  /** Low tier: recorded exploratory probing -- one read attempt, one write. */
  lowProbes: 2,
} as const;

export interface BranchCount {
  readonly branches: number;
  readonly detail: string;
}

/**
 * Count policy branches per the rubric's definition: materially distinct
 * authorization conditions that can independently change an allow/deny outcome.
 *
 * USING and WITH CHECK are counted separately because the rubric names them as
 * distinct branches. A refusing trigger is counted because it can independently
 * deny an operation the privilege system and the policies would permit. An
 * anonymous grant is counted because "authenticated vs anonymous" is named as a
 * branch. RLS enabled with no policy counts as one branch: the deny-by-default
 * condition itself.
 */
export function countBranches(f: RiskInput): BranchCount {
  const parts: string[] = [];
  let n = 0;

  for (const p of f.policies) {
    if (p.hasUsing) n++;
    if (p.hasWithCheck) n++;
  }
  if (f.policies.length) {
    parts.push(`${n} from ${f.policies.length} policy USING/WITH CHECK condition(s)`);
  }

  if (f.rlsEnabled && f.policies.length === 0) {
    n += 1;
    parts.push("1 for deny-by-default (RLS on, no policy)");
  }

  if (f.refusingTriggers.length) {
    n += f.refusingTriggers.length;
    parts.push(`${f.refusingTriggers.length} refusing trigger(s)`);
  }

  if (f.anonymousGrantExists) {
    n += 1;
    parts.push("1 for anonymous vs authenticated");
  }

  return { branches: Math.max(n, 1), detail: parts.join("; ") || "1 minimum" };
}

export function estimateTests(tier: Level, f: RiskInput): number {
  const { branches } = countBranches(f);
  if (tier === "High") return branches * ESTIMATOR.highCasesPerBranch + ESTIMATOR.highBoundaryCases;
  if (tier === "Medium") {
    const paths = Math.max(f.commandsWithPolicy.length, 1);
    return paths * ESTIMATOR.mediumCasesPerCommand;
  }
  return ESTIMATOR.lowProbes;
}

// ---------------------------------------------------------------------------
// Scoring one resource
// ---------------------------------------------------------------------------

export interface Scored {
  readonly resource: string;
  readonly rating: ResourceRating;
  readonly impact: Level;
  readonly impactRule: string;
  readonly scoredExposure: ExposureClass;
  readonly tier: Level;
  readonly branches: number;
  readonly branchDetail: string;
  readonly tests: number;
  /** Dimensions whose evidence is not fully established. */
  readonly weakEvidence: readonly string[];
}

export function score(rating: ResourceRating, facts: RiskInput): Scored {
  const { impact, rule } = deriveImpact(rating);
  const exposure = scoredExposure(rating.exposure);
  const tier = MATRIX[impact][exposure];
  const { branches, detail } = countBranches(facts);
  const weak = [
    rating.data.evidence !== "E" ? `Data:${rating.data.evidence}` : null,
    rating.blast.evidence !== "E" ? `Blast:${rating.blast.evidence}` : null,
    rating.integrity.evidence !== "E" ? `Integrity:${rating.integrity.evidence}` : null,
    rating.reversibility.evidence !== "E" ? `Reversibility:${rating.reversibility.evidence}` : null,
    rating.exposure.evidence !== "E" ? `Exposure:${rating.exposure.evidence}` : null,
  ].filter((x): x is string => x !== null);

  return {
    resource: rating.resource,
    rating,
    impact,
    impactRule: rule,
    scoredExposure: exposure,
    tier,
    branches,
    branchDetail: detail,
    tests: estimateTests(tier, facts),
    weakEvidence: weak,
  };
}

// ---------------------------------------------------------------------------
// Part 6 — the single alternative exposure interpretation
// ---------------------------------------------------------------------------

export interface SensitivityRow {
  readonly resource: string;
  readonly primaryTier: Level;
  readonly alternativeTier: Level;
  readonly primaryTests: number;
  readonly alternativeTests: number;
  readonly changed: boolean;
}

/**
 * The alternative: treat a resource as Anonymous exposure whenever the
 * anonymous role already holds the underlying grant, even where a policy
 * currently prevents anonymous access. Everything else in the rubric is
 * unchanged.
 */
/**
 * Would this resource's tier be the same at every exposure level?
 *
 * If yes, the exposure dimension did no work for it. Reported rather than
 * corrected: it is a property of the rubric the author wrote, and surfacing it
 * is more useful than quietly absorbing it.
 */
export function exposureIsInert(rating: ResourceRating): boolean {
  const { impact } = deriveImpact(rating);
  const tiers = new Set<Level>([
    MATRIX[impact].server_only, MATRIX[impact].authenticated, MATRIX[impact].anonymous,
  ]);
  return tiers.size === 1;
}

export function scoreAlternative(rating: ResourceRating, facts: RiskInput): Scored {
  if (!rating.exposure.anonymousGrantExists) return score(rating, facts);
  const altExposure: ExposureRating = {
    ...rating.exposure,
    level: "High",
    readExposure: "anonymous",
    writeExposure: "anonymous",
    why: `SENSITIVITY: anonymous grant exists, so treated as anonymous exposure regardless of policy. (${rating.exposure.why})`,
  };
  return score({ ...rating, exposure: altExposure }, facts);
}
