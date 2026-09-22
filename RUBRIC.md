# RUBRIC — risk rating and test-depth allocation

**Authored by the author (WP2).** Attest supplied the facts — `evidence/runs/<run-id>/risk-inputs.md`,
one dossier per resource, read from the database. The dimensions, levels, architecture,
combination rules and every judgment below are the author's.

The result this produces is an **assurance-priority tier**, not a complete enterprise
cybersecurity risk score. The model does not estimate attacker frequency, financial loss, or full
exploit likelihood.

---

# Part 1 — The five dimensions

## Dimension 1 — Data criticality

*"What is this data?"* Rates the importance of the information itself, independently from how easy
it currently is to reach.

| Level | What qualifies |
|---|---|
| **Low** | Public, reference, presentation, or cosmetic data. Disclosure has little consequence. Incorrect values may be annoying or visible but do not directly confer authority or corrupt important state. *Examples: cosmetic catalogue descriptions, public reference/configuration data where correctness is not security-critical.* |
| **Medium** | User-specific private or operational data. Progression, preferences, ordinary account state, or application records whose disclosure/change could materially affect a user but do not themselves grant security authority or define authoritative system state. |
| **High** | Credentials, secrets, authorization/security state. Authoritative economy or ledger state. Authoritative game/session state. Hidden game information whose disclosure enables cheating. Security/audit evidence. Other data where unauthorized disclosure or corruption can directly enable unauthorized access, cheating, or material corruption of system truth. |

## Dimension 2 — Blast radius

*"How far can one failure spread?"*

| Level | What qualifies |
|---|---|
| **Low — one user** | Direct consequence is confined primarily to one account/user and that user's records. |
| **Medium — shared state** | Consequence affects multiple participants in a shared object or context: one game/session, social relationship, room, or shared workflow. |
| **High — system-wide / all users** | Shared/global data can affect arbitrary users, many future sessions, or the application as a whole. |

**The number of foreign-key relationships alone does not determine blast radius.** The question is
what state is actually affected if the control fails.

## Dimension 3 — Integrity impact

*"How damaging is an unauthorized change?"*

| Level | What qualifies |
|---|---|
| **Low** | Cosmetic/display-only or otherwise isolated state. Does not alter authorization, economy, authoritative results, security controls, or downstream decisions. |
| **Medium** | Can materially corrupt per-user state or non-authoritative shared behavior. Repair may be required and users may observe incorrect behavior, but the change does not establish access rights or overwrite authoritative security/economy/game truth. |
| **High** | Can alter access/authorization decisions. Can modify authoritative economy/ledger state. Can change authoritative shared game/session state or outcomes. Can corrupt security controls, audit/security evidence, or other state relied upon for security-sensitive decisions. |

## Dimension 4 — Reversibility

*"Can we reliably put it back?"*

| Level | What qualifies |
|---|---|
| **Low** | There is an established authoritative source or deterministic process that can restore the state accurately with little ambiguity. Repair does not destroy historical truth. |
| **Medium** | Recovery is reasonably possible, but requires reconciliation, replay, manual repair, or nontrivial work. Or the recovery mechanism is only partially established. |
| **High** | The corrupted/deleted information may itself be the authoritative source or history. No reliable reconstruction path is established. Recovery could lose information or leave uncertainty about the correct prior state. |

**Unknown evidence rule.** An unknown does not automatically mean High. However, **Low
reversibility must be positively supported.** If recovery is not established, use **Medium** with
evidence mark `U` unless known facts justify High.

## Dimension 5 — Exposure

*"Who can currently reach the operation that matters?"* Use the **effective current access path**,
not merely the existence of a grant.

| Level | What qualifies |
|---|---|
| **Low — server-only** | The risk-driving operation is confined to trusted/server-side code or a privileged backend connection. |
| **Medium — authenticated** | Any authenticated application user can reach the relevant operation, subject to the control being assessed. |
| **High — anonymous** | No account is required to reach the relevant operation. |

**When read and write exposure differ, record them separately** and score the exposure
corresponding to the failure mode driving the risk:

- confidentiality concern → effective **read** exposure;
- integrity concern → effective **write** exposure;
- if both independently matter → the **more exposed** relevant path.

An intended anonymous read of harmless public data should not make an integrity-only risk look
anonymously writable.

**Latent grants are recorded separately** rather than silently changing the effective exposure
classification.

## Evidence sufficiency

| Mark | Meaning |
|---|---|
| `E` | established by repository/database evidence |
| `P` | partially established |
| `U` | unknown / not established |

**Evidence sufficiency is metadata, not a sixth risk factor.** It does not add points and does not
automatically raise a tier. It tells the reader how strongly the underlying judgment is supported.

---

# Part 2 — Rubric architecture

**A qualitative hybrid model: rule-based impact classification + exposure matrix + an explicit
high-impact floor. No numeric weights.**

Reasons:

1. The five dimensions are ordinal judgments, not measurements on a common mathematical scale.
2. A weighted sum would imply artificial precision — claiming the gap between Low and Medium
   integrity is quantitatively comparable to the gap between authenticated and anonymous exposure.
3. Important consequences could be averaged away by low exposure.
4. A qualitative model with explicit rules is easier to explain, audit, and challenge.
5. This project is allocating assurance/testing depth, not attempting to calculate financial
   enterprise risk.

NIST supports qualitative models where levels and combination rules are clearly defined and
annotated (SP 800-30 Rev. 1, Appendix D). The rubric therefore uses explicit rules instead of
hidden arithmetic.

---

# Part 3 — Determining the tier

## Step 1 — Derive impact from the first four dimensions

**High impact** if any of:

- Data criticality = High; **or**
- Integrity impact = High; **or**
- Reversibility = High **and** at least one of Data, Blast radius or Integrity is Medium or High.

**Medium impact** if:

- it does not meet a High condition; **and**
- at least one of Data criticality, Blast radius, Integrity impact or Reversibility is Medium or High.

**Low impact** only when all four consequence dimensions are Low.

This deliberately prevents severe data or integrity consequences from being averaged away.

## Step 2 — Combine impact with exposure

| Impact | Server-only | Authenticated | Anonymous |
|---|---|---|---|
| **Low** | Low | Low | Medium |
| **Medium** | Medium | Medium | High |
| **High** | High | High | High |

**The deliberate rule: high impact cannot be reduced below High solely because the resource is
server-only.** This rubric determines assurance rigor. A severe consequence still deserves
rigorous assurance even where exposure is narrow. Exposure can elevate lower-impact resources when
the relevant operation is broadly reachable, but narrow exposure does not erase severe
consequence.

## Uncertainty

`E`/`P`/`U` does not mathematically change the tier. However, **a resource cannot receive a Low
value on a dimension merely because the necessary evidence is absent.** Where facts are genuinely
unknown, select the lowest classification that can actually be defended from known evidence and
mark it `U`; for reversibility that will normally mean **Medium/`U`** rather than Low/`U`.

Every non-obvious final tier receives a one-sentence rationale in `DECISIONS.md`.

---

# Part 4 — Resolved ambiguous cases

These five were decided by the author before any resource was scored, and the scorer implements
them as stated.

## 4.1 `realtime.messages` — exposure is Authenticated

Current RLS policies require `authenticated`; anonymous grants exist underneath them but anonymous
users currently match no applicable policy. Recorded separately:

- anonymous table grant exists = **yes**
- anonymous policy permits access = **no**
- effective current exposure = **authenticated**

The latent grant is defense-in-depth evidence, not current anonymous reachability.

## 4.2 `public.profiles` — blast radius is One user

Although 24 relations depend on `profiles`, most dependent state belongs to that same user, and
shared-game references use `SET NULL` rather than propagating profile edits into shared
authoritative state. The client can update only six self-owned profile fields, and display names
are copied into seat records rather than continuously propagating.

The large dependency count is relevant context, but it does not by itself turn a profile edit into
system-wide blast radius.

## 4.3 `public.game_session_seats` — blast radius is Shared state

A seat is not merely one user's private record. Session participation is used to authorize access
to game sessions, events, hand records, settled player hands, and the realtime game topic. A bad
seat state can therefore affect authorization and visibility for multiple participants in that
shared session.

Not all-users/system-wide, because the effect is scoped to the relevant session.

## 4.4 Catalogue resources — do not collapse confidentiality and integrity

They are intentionally readable catalogue data, so their **data confidentiality is Low**.

For integrity:

- **`rulesets`: High integrity impact** — corrupted rules can alter blackjack behavior and the
  rules used by sessions/tournaments and recorded hands.
- **`cosmetics`: Medium integrity impact** — corruption can break valid loadouts/rewards and affect
  many users, but does not control game outcomes or authorization.

**Blast radius for shared catalogue rows can be High/system-wide**, because they are global
resources referenced by many users/sessions.

**For integrity scoring, use write exposure, not anonymous read exposure.** Clients hold only
`SELECT`, and the catalogue tables carry client-write protections, so anonymous/public readability
does not mean anonymous integrity exposure.

## 4.5 `private.game_state_private`

- Data criticality = **High**
- Blast radius = **Shared state** for the affected game/session
- Integrity impact = **High**
- Exposure = **Server-only**
- Reversibility = determined from actual recovery evidence; if no demonstrated
  reconstruction/backup mechanism exists, at least **Medium/`U`**

It contains the authoritative engine state including the future shoe and dealer hole card, and
corruption changes the authoritative state against which commands are validated.

Under the Part 3 rules its impact is High, so its final assurance tier is **High even though it is
server-only**. That result is intentional, not an exception invented afterward.

## 4.6 Cross-cutting privileged-role facts

The absence of `FORCE ROW LEVEL SECURITY` and the `authenticator → service_role` capability remain
**cross-cutting evidence**. They do not automatically change every resource's exposure.

The repository establishes that ordinary client code uses the public Supabase path and contains no
direct database credentials and no arbitrary-SQL path, and that service-role usage found in the
repository is server-side. Deployment and credential handling that cannot be proven remain
**unknown**.

These remain documented contextual risks rather than pre-decided per-resource vulnerabilities.

---

# Part 5 — Tier to assurance activity

The project brief's FDA-inspired mapping. FDA's current Computer Software Assurance guidance
supports scaling assurance rigor with risk, and discusses scripted and hybrid testing for higher
risk and unscripted scenario / error-guessing / exploratory testing for lower risk.

## High tier — robust scripted testing

For **every applicable authorization/control branch**:

- at least one positive case proving legitimate behavior succeeds;
- at least one negative/adversarial case proving prohibited behavior fails;
- applicable boundary cases;
- a complete evidence record with statement/call, identity, expected result, actual result,
  timestamp, schema version and harness version.

High-tier resources require exhaustive coverage of meaningful policy branches.

## Medium tier — limited scripted testing of critical paths

For the important authorization paths / control mechanisms:

- representative positive case;
- representative negative/adversarial case;
- important boundary case where directly relevant.

Exhaustive coverage of every boolean/policy sub-branch is **not** required.

## Low tier — recorded unscripted / exploratory testing

Scenario testing, error guessing, exploratory probing. Testing must still produce an evidence
record, but exhaustive scripted branch coverage is not required.

## Definition of "policy branch"

> A **policy branch** is a materially distinct authorization condition that can independently
> change an allow/deny outcome for an operation.

Examples: own row vs another user's row; authenticated vs anonymous; `SELECT` vs
`INSERT`/`UPDATE`/`DELETE`; `USING` vs `WITH CHECK`; participant vs non-participant.

Do **not** treat every internal SQL boolean expression as a separate branch unless changing that
condition could independently change the authorization outcome.

This definition is also used when estimating test-count cost.

---

# Part 6 — Sensitivity

**One alternative exposure interpretation, every other part of the rubric unchanged.**

| | Exposure rule |
|---|---|
| **Primary rubric** | effective current reachability after grants **and** policies are applied |
| **Alternative** | treat a resource as **Anonymous** exposure whenever the anonymous role already holds the underlying grant, even if a current RLS policy prevents actual anonymous access |

In other words: latent anonymous capability is treated as exposure rather than merely
defense-in-depth context. Applied consistently to **every** resource with that condition, not only
`realtime.messages`.

Reported: resources whose final tier changes, original tier, alternative tier, added/removed test
count caused by the Part 5 assurance mapping, and one short conclusion.

If no resources move, the assurance allocation is robust to this exposure interpretation. If
resources move, this assumption is a material driver of the assurance plan.

No second full rubric, and no varying of multiple assumptions simultaneously.

---

# Part 7 — What this rubric is not

- It produces an **assurance-priority tier**, not an enterprise cybersecurity risk score. It does
  not estimate attacker frequency, financial loss, or exploit likelihood.
- It rates technical controls on one personal application. It is not a risk assessment of an
  organisation, a system, or a process.
- It is not a validated or recognised methodology. The dimensions come from the brief; the levels,
  rules and judgments are one person's.
- The author wrote both the application and the rubric. That is not an independent assessment and
  an auditor would not accept it as one.
- Nothing here is a compliance artifact.
