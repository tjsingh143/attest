/**
 * Attest — the overclaiming lint (brief §7; D3.60).
 *
 * Brief §7 is absolute: nothing may state or imply that Arc21 is compliant with
 * anything or is a regulated system, that the harness is validated or qualified,
 * that the audit was independent, or that the author has GxP, validation, audit,
 * regulatory or compliance experience. WP6 and WP7 generate prose, so the prose is
 * checked: a sentence that uses one of those claims must also negate it in the
 * same sentence ("is not a Part 11 system", "no independent assessor"), and a few
 * phrasings are refused outright. Both the generators and the independent
 * validators run it; prove-gates breaks it with sentences it must refuse.
 */

/** Terms that turn a sentence into a compliance, validation or independence claim. */
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
];

/** Refused however they are phrased. */
const NEVER: readonly RegExp[] = [
  /\bArc21 (is|was|has been) (compliant|certified|validated)\b/i,
  /\b(is|are) (fully )?(compliant|certified) with\b/i,
  /\bachieve[sd]? compliance\b/i,
  /\bremediated by Attest\b(?![^.]*\b(never|not|no)\b)/i,
];

const NEGATION = /\b(not|no|never|nor|none|neither|without|cannot|isn't|aren't|doesn't|don't|wasn't|won't|nothing|nobody|n't)\b|\bno\b/i;

export interface LintProblem {
  readonly where: string;
  readonly sentence: string;
  readonly why: string;
}

/** Split prose into sentences; markdown punctuation and list markers are harmless. */
export function sentences(text: string): string[] {
  return text
    .replace(/`[^`]*`/g, (m) => m.replace(/[.;:!?]/g, " "))
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function lintClaims(text: string, where: string): LintProblem[] {
  const out: LintProblem[] = [];
  for (const s of sentences(text)) {
    for (const re of NEVER) if (re.test(s)) out.push({ where, sentence: s.slice(0, 240), why: `refused phrasing (${re.source})` });
    const risky = RISKY.find((re) => re.test(s));
    if (risky && !NEGATION.test(s)) out.push({ where, sentence: s.slice(0, 240), why: `a compliance, validation or independence claim with no negation in the sentence (${risky.source})` });
  }
  return out;
}

/** Words in running prose (markdown syntax stripped), for the one-page checks. */
export function wordCount(text: string): number {
  return text.replace(/[#>*_`|[\]()-]/g, " ").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
