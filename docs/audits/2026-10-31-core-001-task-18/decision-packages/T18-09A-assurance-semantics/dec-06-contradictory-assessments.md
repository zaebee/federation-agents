# T18-DEC-06 — Contradictory Trusted Assessments

**Status: OPEN. Recommendation only. Not approved.**
**Related ambiguity:** `AMBIG-A-4b`.
**Task 17:** N-078 **BLOCKED**, N-107 **BLOCKED**, N-172 **PARTIAL**.
**Related but separate:** N-079 / `T18-DEC-10` (contested-claim decision gating), `A-8` (aggregation precedence), `T18-DEC-15` (parent coverage).

## 1. Decision question

> What predicate defines contradiction between applicable trusted Assessments?

Sub-question raised for project-owner review:

> Can a domain claim conformance with the contradiction semantics of §6.4 without providing a mechanism for detecting contradictions between applicable trusted Assessments?

The conformance question and the recommended answer are developed in §6; §7.5 records the OPEN status. This package does not approve either.

## 2. Normative evidence

### 2.1 Assessment and claims

**Normative requirement.** `docs/CORE-001.md:538-544` (§6.2):

> “Lineage Assessment — неизменяемый документ локальной оценки декларации.”
>
> “Разные домены MAY выпускать различные Assessment относительно одной и той же декларации.”
>
> “Assessment одного домена не обязывает другой домен принять его выводы.”

**Normative requirement.** `docs/CORE-001.md:580-596` (§6.2.2):

> “`verified_claims` содержит Claims, подтверждённые в рамках указанной методики и доступных доказательств.”
>
> “`unverified_claims` содержит Claims, которые не подтверждены, не проверены или не могут быть приняты в рамках указанной оценки.”
>
> “Отсутствие Claim в `verified_claims` MUST NOT интерпретироваться как его подтверждение.”
>
> “Claims являются идентификаторами проверяемых утверждений, а не произвольными строками для числового скоринга.”

**Interpretation.** `unverified_claims` is not a negation. Absence is neither confirmation nor negation. Different claim arrays are not, by themselves, contradiction. `PARENT_SIGNATURE_MATCH`, `DESCRIPTOR_HASH_CONFIRMED`, `ROOT_GOVERNANCE_ATTESTED`, `SOURCE_SPEC_EVALUATED`, `PARENT_UNRESOLVED`, `CYCLE_DETECTED` and `KEY_COMPROMISED` are examples of claim identifiers, not a closed claim logic.

### 2.2 Supersession and applicable-assessment selection

**Normative requirement.** `docs/CORE-001.md:616-633` (§6.3):

- an Assessment MUST NOT change after publication;
- one Assessment may directly supersede at most one other;
- supersession chains MUST NOT contain cycles;
- the old Assessment MUST be preserved as historical;
- supersession does not delete or rewrite decisions previously based on the old assessment;
- selection of the Assessment applicable to a specific decision is determined by local policy considering scope, time, assessor trust and evidence;
- “Самый новый Assessment не становится автоматически самым авторитетным.”

**Interpretation.** Supersession alone does not automatically resolve a contradiction, and the newest Assessment is not automatically authoritative. Whether a policy may treat a superseding Assessment as resolving a conflict is an OPEN policy question, not a normative default.

### 2.3 Trusted assessors and `CONTESTED`

**Normative requirement.** `docs/CORE-001.md:635-661` (§6.4):

- a domain using external assessments MUST explicitly define trusted assessors;
- `required_claims` is a conjunction;
- `disallowed_claims` blocks a claim;
- `trusted_assessors` identifies domains whose assessments may be considered;
- “Если два применимых доверенных Assessment противоречат друг другу, система MUST NOT выбирать победителя автоматически по большинству.”
- “Противоречие переводит соответствующий Claim в локальное состояние `CONTESTED`.”
- dependent decisions cannot rely on that claim until local normative resolution;
- an untrusted domain’s assessment gets no priority merely for being newer or positive.

**Interpretation.** The obligation is about **applicable trusted** Assessments and a **corresponding Claim**. The text does not define the predicate that establishes contradiction, the claim scope, or the conflict diagnostic.

### 2.4 Edge-level assurance

**Normative requirement.** `docs/CORE-001.md:794-804` (§8.5):

Each path edge MUST:

1. match `traversal_scope`;
2. have an applicable `ContinuityAssessment`;
3. satisfy `assurance_requirement`;
4. contain no applicable disqualifying Claims;
5. have no unresolved conflict of applicable Assessments.

Absence of an Assessment is not successful validation.

**Interpretation.** §8.5 is edge-oriented: conflict is checked for an applicable Assessment set on a path edge. It does not state whether conflict is also declaration- or subject-scoped.

### 2.5 Conformance examples

**Normative example.** `docs/CORE-001.md:1317-1335` (§12 B-5): a trusted auditor records `unverified_claims: ["SPEC_MISMATCH"]`; an untrusted domain issues a positive Assessment. The requirement is refused if the trusted auditor does not verify the required claim; the untrusted positive Assessment does not override.

**Test evidence.** `tests/conformance/b.test.ts:192` — `B-5 untrusted positive assessment cannot substitute for the trusted auditor`; `tests/conformance/b.test.ts:203` — `B-5 adversarial policy hook cannot promote the untrusted assessment`.

**Interpretation.** B-5 proves trust exclusion and missing-claim failure. It does **not** define contradiction. It also confirms that `unverified_claims` is not negative evidence.

**Normative example.** `docs/CORE-001.md:1367-1386` (§12 B-7): the same final set of declarations, Assessments, policies and temporal context must produce the same binding result regardless of arrival order.

**Test evidence.** `tests/conformance/b.test.ts:253` — `B-7 all assessment arrival permutations produce the same result`.

### 2.6 What the specification does not define

**OPEN questions.** CORE-001 does not define:

- a contradiction predicate;
- a claim-incompatibility relation or negation syntax;
- whether differing `verified_claims` suffice for contradiction;
- whether `verified` vs `unverified` is contradiction;
- whether `verified` vs absent is contradiction;
- whether two different assessors matter;
- whether the same assessor contradicting itself matters;
- whether different `assessment_profile_ref` / `assessment_method_version` matter;
- whether supersession removes the older Assessment from applicability;
- whether timestamps or “newer” resolve conflict;
- whether conflict is per claim, edge, declaration, subject or path;
- how `contestedClaims` is computed;
- whether conflict outranks missing/disallowed claims;
- whether a policy hook may narrow away one side of a conflict.

The text says “contradict,” not “differ.” That distinction is the core of `AMBIG-A-4b`.

## 3. Implementation evidence

### 3.1 Applicability

**Current implementation behavior.** `src/core/assessment.ts:310-316`:

```ts
function appliesToEdge(assessment: DeepReadonly<ContinuityAssessment>, edge: EdgeRef): boolean {
  return (
    assessment.subject_version_id === edge.child &&
    assessment.declared_relation === edge.relation &&
    assessment.parent_version_ids.includes(edge.parent)
  );
}
```

`assessEdge` (`assessment.ts:335-373`) deep-copies candidates, rejects duplicate `assessment_id`s, filters by `appliesToEdge`, sorts by `assessment_id`, applies `Policy.applicableAssessments` narrowing, freezes and brands the result.

**Current implementation behavior.** `assessEdge` does not read `supersedes_assessment_id`, `assessed_at`, or trust. An older and a newer Assessment can both be applicable. This matches `docs/implementation.md:730`: “Supersession does not remove the predecessor from applicability and there is no ‘latest wins’ rule.”

### 3.2 Policy narrowing

**Current implementation behavior.** `narrowByPolicy` (`assessment.ts:380-398`) only accepts IDs from the core-computed applicable set. It cannot introduce a new or altered Assessment; it can only select members of that set. Trust filtering later excludes untrusted members, preserving B-5.

**Interpretation.** Because `assessEdge` returns the narrowed set, conflict detection later sees only the post-narrowing set. A policy that drops one of two contradictory trusted Assessments can hide the conflict. Whether that is permitted is an OPEN sub-decision (§7.2).

### 3.3 Trust filtering

**Current implementation behavior.** `trustedAssessors` (`assessment.ts:400-402`):

```ts
requirement.trusted_assessors ?? policy.trustedAssessorDefault ?? []
```

An empty list trusts nothing. `evaluateAssurance` filters to trusted Assessments at `assessment.ts:472-473`.

**Test evidence.** `tests/unit/assessment.test.ts:441` — `untrusted assessments never create CONTESTED`.

### 3.4 Conflict detection

**Current implementation behavior.** `evaluateAssurance` (`assessment.ts:459-504`) runs conflict detection only when `policy.conflictPredicate` is defined (`:475-480`):

```ts
if (policy.conflictPredicate !== undefined) {
  const contestedClaims = collectContestedClaims(assessments, applicable.edge, policy.conflictPredicate, ctx);
  if (contestedClaims !== undefined) {
    return { status: 'CONTESTED', contestedClaims };
  }
}
```

`collectContestedClaims` (`assessment.ts:431-452`) calls the predicate for every pair of trusted applicable Assessments. If any pair fires, it returns the union of `differingClaims`.

`differingClaims` (`assessment.ts:404-423`) compares **only** `verified_claims` sets and returns their symmetric difference. It ignores `unverified_claims`.

**Current implementation behavior.** The default predicate is `undefined`; the default path never produces `CONTESTED`.

**Test evidence.**

- `tests/unit/assessment.test.ts:457` — `default configuration never yields CONTESTED`.
- `tests/unit/assessment.test.ts:472` — `an explicit predicate is the only source of CONTESTED`.
- `tests/unit/assessment.test.ts:486` — `a false predicate leaves the result uncontested`.
- `tests/unit/assessment.test.ts:497` — `an explicit predicate may declare conflict with no differing claims`.

### 3.5 Assurance evaluation

**Current implementation behavior.** `evaluateAssurance` (`assessment.ts:482-491`) unions `verified_claims` from trusted Assessments, computes `missing` against `required_claims`, and computes `disallowed` against `disallowed_claims`. `unverified_claims` is not read at all.

**Current implementation behavior.** The generic validator (`assessment.ts:180-218`) does not reject the same claim appearing in both `verified_claims` and `unverified_claims`; `evaluateAssurance` reads only `verified_claims`. Intra-Assessment overlap is therefore a record-consistency question, not a conflict-predicate result.

**Current implementation behavior.** Conflict is checked before missing/disallowed (`:475-491`). A conflict can therefore return `CONTESTED` before a missing required claim would return `UNSATISFIED`. This precedence is `A-8` OPEN.

**Test evidence.** `tests/unit/assessment.test.ts` `default configuration never yields CONTESTED` shows two trusted Assessments verifying different claims are treated as independent and the union can satisfy the requirement.

### 3.6 Traversal and merge-closure propagation

**Current implementation behavior.** `evaluateEdgeAssurance` (`src/core/traversal.ts:391-427`) calls `assessEdge` and `evaluateAssurance`; `CONTESTED` becomes an edge outcome with `contestedClaims`.

`validatePathWithIndex` (`traversal.ts:471-526`) returns `PathValidation` status `CONTESTED` for a contested path edge and stops.

`validateMergeClosure` (`traversal.ts:674-692`) evaluates every direct parent branch of merge nodes on a VALID path. A contested branch becomes `MergeClosureBranchFailure` reason `CONTESTED` (`traversal.ts:570-573`); any failure makes closure `UNSATISFIED` (`:650-667`).

`summarizePaths` (`traversal.ts:759-795`) aggregates:

| Condition | Top-level result |
| --- | --- |
| Any accepted path | `eligible: true` |
| Any closure `UNSATISFIED` | `ERR_MERGE_BRANCH_UNSATISFIED` |
| Any path `CYCLE_DETECTED` | `CYCLE_DETECTED` |
| Any path `CONTESTED` | `kind: 'CONTESTED'` |
| Otherwise | `ERR_ASSURANCE_PREDICATE_UNSATISFIED` |

**Current implementation behavior.** A closure-branch conflict surfaces as `ERR_MERGE_BRANCH_UNSATISFIED`, not necessarily as top-level `kind: 'CONTESTED'`. A conflict on one path does not invalidate another accepted path. The aggregation order is `ID-T10`, not a normative precedence table; `A-8` remains OPEN (`docs/implementation.md:1432`).

**Test evidence.**

- `tests/unit/traversal-phases.test.ts:472` — `aggregates mixed CONTESTED and INVALID paths as CONTESTED with all outcomes`.
- `tests/unit/traversal-phases.test.ts:504` — `does not mask a closure failure with a valid path-level outcome`.
- `tests/unit/traversal-phases.test.ts:523` — `aggregates mixed CYCLE_DETECTED and CONTESTED paths as CYCLE_DETECTED`.
- `tests/unit/traversal-phases.test.ts:575` — `represents an all-contested outcome distinctly`.

### 3.7 Behavior summary

| Question | Current behavior | Source |
| --- | --- | --- |
| Two trusted Assessments with different verified claims | Independent; verified union; no `CONTESTED` by default | `assessment.ts:482-491`; `assessment.test.ts:457` |
| Explicit predicate | `CONTESTED`; `contestedClaims` is verified-set symmetric difference | `assessment.ts:431-452`; `assessment.test.ts:472` |
| Same vs different assessor | No distinction; both pass trust filter | `assessment.ts:400-402`, `:472-473` |
| Verified vs unverified same claim | No conflict by default; unverified ignored | `assessment.ts:482-487`; `docs/implementation.md:724` |
| Verified vs absent | No conflict by default; absence not confirmation | `docs/CORE-001.md:584` |
| Supersession | Older remains applicable; no latest-wins; no automatic conflict resolution | `docs/implementation.md:730` |
| Timestamps / ordering | The default implementation does not apply timestamp-based conflict resolution. A custom predicate may inspect assessment timestamps and temporal context; no normative precedence rule is currently defined. Sorting is deterministic. | `assessment.ts:431-452`; B-7 |
| Conflict scope | Per edge (`assessEdge` triple) | `assessment.ts:310-316`, `:335-373` |
| Untrusted Assessment | Excluded before conflict | `assessment.test.ts:441` |
| Conflict in closure | Branch reason `CONTESTED` → `ERR_MERGE_BRANCH_UNSATISFIED` | `traversal.ts:570-573`, `:769-774` |
| Conflict vs missing claim | Conflict first; can mask `UNSATISFIED` | `assessment.ts:475-491` |

### 3.8 Diagnostic limitation

**Current implementation behavior.** `contestedClaims` is the union of symmetric differences of `verified_claims` over all pairs for which the predicate returns true. It:

- ignores `unverified_claims`;
- can be empty when the predicate fires on identical verified sets (`assessment.test.ts:497`);
- may not name the actual claim(s) the domain considers disputed;
- is a diagnostic, not a normative claim-resolution result.

**Interpretation.** Symmetric difference of `verified_claims` is not a valid general representation of disputed claims. It is only a heuristic over the current record shape.

## 4. Options

| Option | Meaning | Normative support | Main risk |
| --- | --- | --- | --- |
| **A1 — broad automatic** | Any difference in `verified_claims` between two applicable trusted Assessments is contradiction → `CONTESTED` | Only the word “contradict”; no support for “differ” | False positives: independent observations become conflict; multi-assessor conjunction requirements become hard to satisfy |
| **A2 — narrow automatic** | Same claim verified by one and listed as `unverified` by the other → `CONTESTED` | None; §6.2.2 says unverified includes “not checked”; A-4a/B-5 say unverified is not negative evidence | Normatively wrong; punishes an assessor for not checking a claim |
| **B — independent observations** | No automatic conflict; union verified claims; missing/disallowed decide; `CONTESTED` only via policy | §6.2.2; §6.4 “contradict” not “differ”; B-5; current default | False negatives: a real contradiction is silently unioned unless policy detects it |
| **C — explicit predicate** | Domain-supplied predicate over applicable trusted Assessments; default none; predicate defines incompatibility | §6.3 local policy; §6.4 trusted assessors; current `Policy.conflictPredicate` | No default means N-078/N-107 remain unenforced unless the domain configures it; predicate can hide conflict by narrowing |

## 5. Adversarial cases

| # | Case | A1 | A2 | B | C | Normative status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Two trusted, same edge, one verifies X, other verifies incompatible Y | CONTESTED, X,Y | No conflict (both verified) | No conflict; union X,Y | CONTESTED only if predicate knows X/Y incompatible | **OPEN**: “contradict” undefined; no incompatibility relation |
| 2 | One verifies X, other marks X unverified | CONTESTED | CONTESTED | No conflict; verified X; unverified ignored | Predicate decides; a correct predicate should not treat unverified as negation | **Likely no conflict** under §6.2.2/A-4a; A2 is normatively wrong |
| 3 | One verifies X, other contains X in neither list | CONTESTED | No conflict | No conflict | Predicate decides; likely no | **No conflict**: absence is not confirmation or negation |
| 4 | Same assessor contradicts itself | CONTESTED | Only if verified/unverified | No conflict | Predicate decides | **OPEN**: §6.4 does not exclude same assessor |
| 5 | Different assessors contradict | CONTESTED | Only if verified/unverified | No conflict | Predicate decides; primary case | **OPEN** on predicate |
| 6 | Newer supersedes older contradictory | CONTESTED (both applicable) | Maybe | No conflict; both contribute | Predicate may use supersession chain | **Supersession alone does not resolve**; newest not authoritative (§6.3 #5/#6) |
| 7 | Newer does not supersede older contradictory | CONTESTED | Maybe | No conflict | Predicate decides | **OPEN** |
| 8 | Only claim-array order differs | No conflict | No conflict | No conflict | No conflict | **No conflict**; B-7/§8.8 |
| 9 | Different parent edges of same merge declaration | No cross-edge pair; per-edge only | No cross-edge pair | No cross-edge pair | Predicate sees only same-edge pairs | **OPEN** whether conflict is edge- or declaration-scoped; current is edge-scoped |
| 10 | One trusted, one not | No conflict | No conflict | No conflict | No conflict; untrusted excluded | **No conflict**; B-5 |
| 11 | One applicable, one not | No conflict | No conflict | No conflict | No conflict | **No conflict**; §6.4 “applicable” |
| 12 | Same claim in `verified_claims` and `unverified_claims` within one Assessment | No cross-assessment pair | No cross-assessment pair | No cross-assessment pair | Predicate could inspect within-assessment overlap; current predicate is pairwise across Assessments | **OPEN**; record-consistency question, not resolved by any option |
| 13 | Different `assessment_profile_ref`/method, same claim | CONTESTED if verified sets differ | Maybe | No conflict | Predicate can require same profile/method | **OPEN**; different methods may legitimately differ (§6.2.3) |
| 14 | Policy hook drops one of two contradictory trusted Assessments | No conflict after narrowing | No conflict after narrowing | No conflict after narrowing | No conflict after narrowing | **OPEN**: current conflict detection uses post-narrowing set; policy can hide conflict |
| 15 | Conflict + missing required claim | CONTESTED (conflict first) | CONTESTED | UNSATISFIED (missing) | CONTESTED if predicate fires | **OPEN**: precedence A-8; current conflict runs first |

## 6. Reviewed recommendation

**Recommendation (not approved): Option C — explicit domain-defined contradiction predicate.**

Architectural separation:

1. **CORE-001 defines the normative obligation.** When a domain establishes that applicable trusted Assessments contradict, the corresponding Claim enters local `CONTESTED`; no majority voting; dependent decisions cannot rely on it until local resolution.
2. **CORE-001 implementation provides the mechanism.** The implementation must expose a deterministic way to establish contradiction when the domain configures its claim vocabulary. It must not silently lose an established contradiction through ordering, narrowing, or incorrect diagnostics.
3. **The domain’s local policy defines contradiction** within its claim vocabulary and evidence model. CORE-001 does not define a universal claim-incompatibility logic.
4. **A conformance claim requires the capability.** The canonical statement is the “Conformance claim and predicate absence” paragraph below.

Proposed clarification content (not approved):

> CORE-001 does not define a universal claim-incompatibility relation. A domain that relies on external assessments MUST define, in local policy, a deterministic predicate identifying when two applicable trusted Assessments contradict. The predicate is evaluated for the same edge and the same claim scope; it MUST NOT use majority voting; `unverified_claims` is not by itself a negative assertion; supersession alone does not resolve a contradiction. If no predicate is defined, the implementation cannot establish contradiction; a domain that claims §6.4 support MUST treat that as a configuration/conformance gap, not as compliance.

The “same edge” sentence is a proposed default, not an approved scope decision; §7.1 keeps the scope question OPEN.

**Conformance claim and predicate absence (OPEN).** A domain cannot claim §6.4 support if it cannot execute the corresponding MUST. A general CORE-001 implementation may expose Assessments and assurance evaluation without claiming contradiction detection; a domain that declares reliance on §6.4 must provide a detection mechanism or record the capability as unsupported. Absence of a predicate is a configuration/conformance gap for such a domain, not compliance. Owner question: configuration error vs permissible limited mode; pending. This package does not decide.

**CORE-001 amendment required?** Yes, if N-078/N-107 are to become normative rather than permanently BLOCKED. The amendment can be the clarification above or a cross-spec pointer to CORE-004. If the owner defers to CORE-004, Option B is the conservative CORE-001 position and N-078/N-107 remain BLOCKED with an explicit readiness limitation.

## 7. Unresolved sub-decisions

### 7.1 Conflict scope

**OPEN.** Same edge vs declaration/subject.

- **Same edge:** §8.5 is edge-bound; `assessEdge` is the existing applicability boundary; `ApplicableAssessments` already carries one edge. Current behavior.
- **Declaration/subject:** §6.2 calls the Assessment an evaluation of the declaration; `parent_version_ids` is plural; conflict could be declaration-scoped. This requires a new aggregation and a decision about assessments covering different parent edges.

Do not resolve by implementation convenience.

### 7.2 Pre- vs post-narrowing

**OPEN.** Current conflict detection uses the post-`Policy.applicableAssessments` set.

- **Post-narrowing:** policy narrowing defines applicability; a domain may legitimately exclude an Assessment from consideration.
- **Pre-narrowing:** all core-applicable trusted Assessments participate in conflict detection; narrowing cannot hide a contradiction.

Do not assume every trusted but policy-excluded Assessment must participate. The owner must decide whether narrowing is allowed to remove one side of a conflict.

### 7.3 `contestedClaims` diagnostic

**OPEN.** Current value is the symmetric difference of `verified_claims`; it ignores `unverified_claims`, can be empty, and may not name the disputed claims.

Options:

- predicate returns contested claim IDs or a reason;
- spec defines `contestedClaims` as diagnostic only;
- no claim list is required.

Do not assume symmetric difference is a valid representation.

### 7.4 Conflict vs missing/disallowed precedence

**OPEN (`A-8`).** Current conflict check runs before missing/disallowed. A conflict can mask a missing required claim. The spec does not define precedence.

### 7.5 Required capability/conformance declaration

**OPEN.** See §6 for the canonical conformance-claim position. This package does not decide whether absence of a predicate is a configuration error or a permissible limited mode.

## 8. Consequences if approved

If Option C is approved:

- add a CORE-001 clarification or CORE-004 pointer via `T18-SPEC-01`;
- define the predicate contract (scope, pre/post narrowing, diagnostic, precedence);
- add tests for trusted same/different assessor, verified/unverified, absence, supersession, ordering, closure conflict, policy narrowing, and conflict-vs-missing;
- keep `assessEdge`/`ApplicableAssessments` unless the scope decision requires declaration-level aggregation;
- do not add a universal claim-incompatibility engine.

If Option B is approved:

- keep the default no-conflict behavior;
- N-078/N-107 remain BLOCKED;
- readiness records the cross-spec limitation;
- no implementation change is required for this decision.

## 9. Downstream tasks

- `T18-SPEC-01` — clarification or CORE-004 pointer.
- `T18-09D` — N-172 conflict tests after an approved predicate.
- Follow-up implementation task — predicate contract/diagnostic/precedence, only after approval.
- `T18-13` — readiness consumes the outcome; no automatic PASS.

## 10. Open questions

1. Is contradiction edge-scoped or declaration-scoped?
2. May policy narrowing remove one side of a conflict?
3. What must `contestedClaims` contain?
4. Does conflict outrank missing/disallowed?
5. Must a domain declare contradiction-detection capability to claim §6.4 support?
6. Does supersession ever resolve a conflict, or only local policy?
7. Are same-assessor contradictions in scope?
8. Does a different `assessment_profile_ref`/method affect contradiction?
9. How should a conflict in a closure-only branch be surfaced at top level?
10. Does a domain that does not claim §6.4 support still need to reject a claimed `CONTESTED` result?
