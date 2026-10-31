# DEC-06 — Owner Decision Addendum v2.5

**Status:** PROPOSED — awaiting explicit owner decision
**Scope:** Governance, normative direction, and decision boundaries
**Implementation:** Not authorized
**CORE-001 changes:** None in this document
**Task statuses:** No changes; no status may change without a separate re-audit
**D1–D6:** Proposals; no implicit approval
**N1–N11:** Proposals; N2 and N5 have no normative effect until a separate specification amendment is approved

This document is the final structural-consistency pass over v2.3/v2.4. It does not
reopen governance decisions. EP-2 and BP-1 remain PROPOSED. N2 and N5 remain
PENDING SPEC AMENDMENT. No new proposal is APPROVED.

**Status legend**

| Status | Meaning |
|---|---|
| **APPROVED** | Explicitly approved by the owner |
| **PROPOSED** | Recommendation awaiting owner approval |
| **OPEN** | Unresolved design or normative question |
| **PENDING SPEC AMENDMENT** | Cannot take normative effect until a separate amendment is approved and re-audited |

---

## 1. Status and purpose

This addendum turns the approved direction into a precise, testable record contract
without changing CORE-001, authorising implementation, or changing any Task 17 or
Task 18 status.

It makes four boundaries explicit:

1. **Conformance layers.** CORE-001 implementation conformance, receiving-domain
   policy conformance, and external normative judgment are different claims.
2. **Principle scope.** Evidence Preservation and Branch Preservation remain
   approved principles; their enforcement boundary requires an explicit owner
   decision.
3. **EvaluationRecord contract.** The record distinguishes context dispositions
   from exclusion, binds to its supplied input, defines expected pair coverage,
   separates pair coverage from predicate execution, and states its origin honestly.
4. **Predicate limits.** Declared inputs, deterministic execution, access isolation,
   and semantic correctness are different properties.

No proposed text in this document is already normative.

**Approval provenance.** Evidence Preservation, Branch Preservation, and No
Implicit Reconciliation are treated as owner-provided direction for this addendum.
This repository does not contain a separate signed decision record that establishes
their approval; recording that provenance in the decision register is still
required. This addendum does not re-approve them or create provenance by assertion.

---

## 2. Final structural corrections

The v2.3/v2.4 review identified four blocking contract defects and four important
clarifications. v2.5 resolves them as follows.

| ID | Defect | v2.5 correction |
|---|---|---|
| **B1** | `keys(pair_evaluations)` was undefined for an array | Defines `PairKey` and `pairKey(pair, pair_order)`; all duplicate detection, coverage accounting, and missing-pair derivation use `PairKey` |
| **B2** | `SymmetryCheck.match: boolean` could not represent failed comparisons | Replaces it with derived `comparison: MATCH / MISMATCH / INCONCLUSIVE`; adds observed and attestation-grade symmetry statuses |
| **B3** | Origin and symmetry shared `mechanism_ref` / `evidence_ref` | Separates `origin_verification`, `structural_validation`, and `symmetry_verification` evidence references |
| **B4** | Record-id uniqueness was duplicated in the prior draft's E17 and E22 | Keeps uniqueness only in E17; E22 now covers structural/evidence validation separation |
| **C1** | Context sets could be stored independently of facts | Removes stored context sets; defines them as derived projections of `context_disposition_facts` |
| **C2** | `PairEvaluation` had no pair identity | Defines `PairKey` once and uses it in E9–E11 and all derived views |
| **C3** | `RULE_SELECTED` inputs could be insufficient | Defines rule input as `considered` IDs plus Assessment records resolved through `input_set_ref`, `context_ref`, and `policy_ref`; evidence must bind rule version, input, and output |
| **C4** | `symmetry_checks` had no invariants | Defines uniqueness, expected-pair membership, forward-status consistency, derived comparison, and coverage rules for observed, verified, violated, attested, and inconclusive symmetry |

No governance status changes. No CORE-001 scope expansion.

---

## 3. Conformance layers and guarantee boundaries

### 3.1 Three conformance layers

| Layer | Subject | Question | Who judges | What it does not establish |
|---|---|---|---|---|
| **CORE-001 implementation conformance** | The implementation | Does it fulfil requirements explicitly assigned to CORE-001? | Core conformance evidence and re-audit | Policy legitimacy; input completeness; predicate semantic correctness |
| **Receiving-domain policy conformance** | The receiving policy | Does it follow its declared applicability, exclusion, conflict-handling, and preservation obligations? | Receiving domain and external examination; not core alone | That the policy is appropriate, sufficiently specified, or non-pretextual |
| **External normative judgment** | Policy and its authority | Is the policy legitimate, appropriate, and authorised? | External normative authority; outside CORE-001 | That CORE-001 verified or endorsed the judgment |

**Non-implications:**

- CORE-001 implementation conformance does not prove policy conformance.
- Policy conformance does not prove external legitimacy.
- A conforming CORE-001 implementation cannot prevent a receiving policy from
  suppressing a conflict.
- A conforming policy does not make the core's record complete.

### 3.2 Guarantee boundary

| Layer | CORE-001 guarantee | Not guaranteed by CORE-001 |
|---|---|---|
| Structural applicability | Structural candidates can be identified from the supplied input according to the existing edge triple | Completeness of the supplied input; criteria outside the edge triple |
| Context applicability | Context disposition facts can be recorded with basis/provenance | Normative legitimacy or completeness of the criteria |
| Expected pair coverage | Expected, terminal, failed, and derived missing pairs can be identified under a declared construction or rule | That the pair universe is normatively complete for the domain; set-level consistency |
| Predicate mechanism | Predicate identity/version, declared inputs, deterministic execution, defined failure behaviour, pair ordering, and both Assessment records can be constrained and recorded | Access isolation from closures/globals/ambient state; semantic correctness |
| Conflict finding | A configured predicate result can be recorded with both Assessment identities | That the finding proves a true contradiction |
| Absence of finding | The record can state that no configured predicate reported a conflict | That no contradiction exists |
| Exclusion disclosure | Context-inapplicable and excluded-from-consideration dispositions can be recorded with reasons, rule references, and provenance | That the reason is true, complete, or non-pretextual |
| EvaluationRecord | A core-produced or structurally validated record can satisfy defined structural invariants | That the applicable set or pair universe is complete; that the record represents what actually happened |
| Resolution | The core does not select a winner or resolve a conflict | That a caller or external authority will not select one |
| Branch handling | The core does not orchestrate or reconcile multiple evaluation contexts | That caller-side branch selection is legitimate or preserved |
| Comparability | Evaluation identities and declared inputs can be distinguished | That two evaluations are comparable or substitutable |

**A record is evidence of an evaluation, not a ruling.** A finding is not a
resolution.

---

## 4. Evidence Preservation and Branch Preservation scope decision

### 4.1 Approved principles

The owner has approved Evidence Preservation, Branch Preservation, and No Implicit
Reconciliation. These remain approved direction. This document does not revoke or
weaken them by implication.

### 4.2 Separate scope decision required

v1 described Evidence Preservation as "the core preserves what it receives." That
is narrower than the approved principle. It may be the correct enforcement boundary,
but adopting it silently would change the principle's meaning. The same applies to
Branch Preservation.

### 4.3 Evidence Preservation options

| Option | Meaning | Consequence | Status |
|---|---|---|---|
| **EP-1 — Strong core guarantee** | Core independently establishes completeness and non-pretextual exclusion | Requires an independent applicability oracle and legitimacy standard; not available | **PROPOSED — not recommended** |
| **EP-2 — Bounded core guarantee + policy obligation + disclosure** | Core preserves declared inputs/facts, records dispositions and findings, does not select; policy owns completeness/legitimacy; external judgment evaluates policy | Makes the limit explicit; supports examination without claiming prevention | **PROPOSED — recommended** |
| **EP-3 — Policy-only** | Policy self-certifies; no core disclosure contract | Weakest auditability; conflicts with evidence intent | **PROPOSED — not recommended** |

### 4.4 Branch Preservation options

| Option | Meaning | Consequence | Status |
|---|---|---|---|
| **BP-1 — Core preserves single-evaluation records; caller/adapter owns multi-context preservation** | CORE-001 does not orchestrate or reconcile contexts | Clear boundary; caller obligations belong elsewhere | **PROPOSED — recommended** |
| **BP-2 — Core guarantees caller branch preservation and selection** | Requires fork orchestration and selection semantics | Outside CORE-001 scope; introduces authority semantics | **PROPOSED — not recommended** |
| **BP-3 — No branch preservation obligation** | Conflicts may be discarded without record | Contradicts evidence intent | **PROPOSED — not recommended** |

### 4.5 Proposed boundary if EP-2 and BP-1 are approved

| Responsibility | CORE-001 | Receiving policy | Caller/adapter | Outside current specification |
|---|---|---|---|---|
| Structural applicability | Identifies candidates from supplied input | — | — | — |
| Context criteria | Records disposition facts/version/provenance | Declares and applies criteria | — | Legitimacy of criteria |
| Trust admissibility | Records trust decisions where applicable | Defines trusted set | — | §6.4/§8.5 trust wording |
| Conflict predicate | Constrains mechanism; records pair results/findings | Configures predicate | — | Semantic correctness |
| Context-inapplicability | Records disposition and basis | Owns the declaration | — | Whether basis is a pretext |
| Exclusion from consideration | Records disposition and basis | Owns non-suppression obligation | — | Whether basis is a pretext |
| Single evaluation record | Produces or structurally validates | Supplies policy/context refs | Consumes | Completeness of applicable set |
| Multiple contexts | Does not orchestrate | — | May compose; obligations separate | Comparability and selection legitimacy |
| Resolution | Does not resolve | May seek resolution | May request decision | Resolution authority and representation |

**Status:** EP-2 and BP-1 are **PROPOSED**, not approved. v1's narrower reading is
not adopted.

---

## 5. D1–D6 revised decision table

| ID | Decision | Proposed answer | Status | Depends on | Notes |
|---|---|---|---|---|---|
| **D1a** | Structural applicability | Approve structural applicability as the core-computable layer, strictly limited to the existing edge triple | **PROPOSED** | — | Does not resolve edge-vs-claim, declaration-vs-edge, or DEC-15 parent coverage |
| **D1b** | Declared context applicability | Require policy to identify context criteria, version, and provenance; core records disposition facts; core does not verify legitimacy or completeness | **PROPOSED** | D1a | A criterion created or modified after observing conflict is not independent under N5 |
| **D1c** | Trust admissibility | Keep trust separate from structural/context applicability | **OPEN** | — | §6.4/§8.5 trust wording unresolved |
| **D2** | Conflict-dependent exclusion | Adopt Reading B: exclusion solely because inclusion would trigger conflict is prohibited; recording does not legitimise it | **PROPOSED** | D1a/D1b | Applies to `excluded_from_consideration`, not `context_inapplicable` |
| **D3** | Independent basis/non-suppression | Retain as receiving-policy obligation; reason, rule reference, provenance recorded; legitimacy standard OPEN | **PROPOSED** | D2 | Core cannot prove intent, pretext, or legitimacy |
| **D4** | Evidence requirements | Level 2 as minimum disclosure: declaration metadata plus full disposition/execution trace; Level 3 optional | **PROPOSED** | D1b, D2, D3 | Level 2 is disclosure, not proof |
| **D5** | Predicate contract | Mechanism requirements only; per-pair execution; pair ordering/symmetry declared and verification recorded; semantic correctness OPEN | **PROPOSED** | — | Access isolation not guaranteed by signature alone |
| **D6** | EvaluationRecord | Retain Option B; separate schema-versioned record with disposition facts, input binding, expected pair coverage, origin, and per-pair execution | **PROPOSED** | D4, D5 | Structural contract in §6 |

---

## 6. EvaluationRecord structural contract

### 6.1 Snapshot versus sequence

**Preferred form:** a single-evaluation snapshot representing one completed
evaluation.

A sequence of evaluation events is not part of the CORE-001 MVP. If a caller needs
history, it retains a list of immutable snapshots. A validated record must not be
mutated.

### 6.2 Proposed record shape

Field names are illustrative; the information requirements are the contract.

```ts
interface EvaluationRecord {
  record_schema_version: string;     // e.g. "dec-06-evaluation-record@1"
  record_id: string;                 // identity of this record; unique within a record set
  evaluation_ref: EvaluationRef;     // identity of configuration/input tuple, not a unique execution ID

  input_set_ref: InputSetRef;        // binding to supplied Assessment set; not proof of completeness
  context_ref: ContextRef;           // id / version / digest
  policy_ref: PolicyRef;             // id / version / digest
  predicate_ref?: PredicateRef;      // required when predicate_execution_status ≠ NOT_CONFIGURED
  requirement_ref?: RequirementRef;  // optional; scope OPEN

  structural_candidates: AssessmentID[];

  // Canonical context facts. The sets context_applicable,
  // context_inapplicable, and context_unassessed are derived projections;
  // they are not stored as independent fields.
  context_disposition_facts: ContextDispositionFact[];

  considered: AssessmentID[];
  excluded_from_consideration: AssessmentID[];
  exclusion_facts: ExclusionFromConsiderationFact[];

  expected_pairs: PairRef[];
  pair_construction_mode: 'PAIRWISE_ALL_CONSIDERED' | 'RULE_SELECTED';
  pair_selection_rule_ref?: string;
  pair_selection_rule_version?: string;
  pair_selection_evidence_ref?: string;
  pair_evaluations: PairEvaluation[];   // sole authoritative pair-result source

  context_assessment_status: 'COMPLETE' | 'PARTIAL';
  pair_coverage_status: 'NO_PAIRS' | 'NOT_STARTED' | 'PARTIAL' | 'COVERED' | 'FAILED';
  predicate_execution_status: 'NOT_CONFIGURED' | 'NOT_INVOKED' | 'INVOKED' | 'INVOCATION_FAILED';

  pair_order: 'UNORDERED_CANONICAL' | 'ORDERED';
  symmetry_declaration: 'SYMMETRIC' | 'ASYMMETRIC' | 'UNSPECIFIED';
  symmetry_verification: {
    status:
      | 'NOT_PERFORMED'
      | 'OBSERVED_MATCH'
      | 'OBSERVED_MISMATCH'
      | 'VERIFIED'
      | 'VIOLATION'
      | 'MECHANISM_ASSERTED'
      | 'INCONCLUSIVE';
    mechanism_ref?: string;
    evidence_ref?: string;
  };
  symmetry_checks: SymmetryCheck[];

  claimed_origin: 'CORE_001' | 'EXTERNAL';
  origin_verification: {
    status: 'VERIFIED' | 'UNVERIFIED' | 'UNAVAILABLE';
    mechanism_ref?: string;
    evidence_ref?: string;
  };
  structural_validation: {
    status: 'PASSED' | 'FAILED' | 'NOT_PERFORMED';
    validator_ref?: string;
    evidence_ref?: string;
  };
  evidence_validation: {
    status: 'PASSED' | 'FAILED' | 'NOT_PERFORMED';
    validator_ref?: string;
    evidence_ref?: string;
  };

  provenance?: DeclarationProvenance;
}
```

`EvaluationRef`, `InputSetRef`, `ContextRef`, `PolicyRef`, `PredicateRef`,
`RequirementRef`, and `DeclarationProvenance` are opaque reference types. Each
carries a non-empty identifier and, where the contract states it, a version and/or
digest. Their concrete encoding is API design work; the contract requires only that
the references are resolvable and distinguish the claims they identify.

### 6.3 Context dispositions and derived sets

| Fact disposition | Derived set |
|---|---|
| `CONTEXT_APPLICABLE` | `context_applicable` |
| `CONTEXT_INAPPLICABLE` | `context_inapplicable` |
| `CONTEXT_UNASSESSED` | `context_unassessed` |

The record stores `context_disposition_facts`, not the three sets. The sets are
derived views:

```text
context_applicable   = { f.assessment_id | f.disposition = CONTEXT_APPLICABLE }
context_inapplicable = { f.assessment_id | f.disposition = CONTEXT_INAPPLICABLE }
context_unassessed   = { f.assessment_id | f.disposition = CONTEXT_UNASSESSED }
```

There is exactly one `ContextDispositionFact` per `structural_candidate`. Duplicate
facts are a structural error. A structural candidate with no fact makes the record
structurally invalid.

`context_assessment_status = COMPLETE` means every structural candidate has a fact
and no fact is `CONTEXT_UNASSESSED`. `PARTIAL` means every structural candidate has
a fact and at least one is `CONTEXT_UNASSESSED`. If `structural_candidates` is
empty, `COMPLETE` holds vacuously.

The context sets are pairwise disjoint and partition `structural_candidates`.
`CONTEXT_UNASSESSED` is retained in this contract: if an implementation cannot
determine applicability, it MUST record a `CONTEXT_UNASSESSED` fact and set
`context_assessment_status = PARTIAL`. A record that cannot classify a structural
candidate is structurally invalid; it cannot be `COMPLETE`.

### 6.4 Context inapplicability versus exclusion

| State | Meaning | N3/N4 apply? | Governing obligation |
|---|---|---|---|
| `context_inapplicable` | Policy declares the Assessment outside the evaluation context | **No** — it is not "otherwise applicable" | N1/N5: criteria must be declared, versioned, not post-hoc |
| `excluded_from_consideration` | Assessment is context-applicable but not made available to the predicate | **Yes** — this is the "otherwise applicable" set | N3/N4: exclusion solely because of conflict is prohibited |
| `context_unassessed` | Applicability could not be determined | **No** | Record must not treat it as inapplicable; N1/N5 apply to criteria |

**Critical note:** N3/N4 do not close the loophole where a policy labels a
conflicting Assessment `context_inapplicable`. That state is governed by N1/N5 and
external judgment. The record makes the state visible; it does not prevent a
pretextual context criterion.

### 6.5 Input-set binding

`input_set_ref` identifies the actual Assessment input set supplied to the
evaluation. It may be:

- a reference to an immutable input manifest;
- a digest of a canonical serialisation of the set;
- both.

**What it establishes:** the record is bound to a specific supplied input set.

**What it does not establish:** that the supplied set was complete, that it
contained every domain-relevant Assessment, or that the policy did not omit an
Assessment before supplying it.

`structural_candidates` must be derived from the input set referenced by
`input_set_ref`.

For external records, validation of the relationship between `input_set_ref` and
recorded IDs requires at least one of:

- the actual input set or a manifest;
- a verifiable membership proof;
- a trusted external reference the validator can resolve.

A digest alone binds the record to the input but does not allow membership
validation without the set.

### 6.6 Disposition evidence contract

```ts
interface ContextDispositionFact {
  assessment_id: AssessmentID;
  disposition: 'CONTEXT_APPLICABLE' | 'CONTEXT_INAPPLICABLE' | 'CONTEXT_UNASSESSED';
  reason: string;
  rule_ref?: string;
  policy_ref?: PolicyRef;
  context_ref?: ContextRef;
  provenance?: string;
}

interface ExclusionFromConsiderationFact {
  assessment_id: AssessmentID;
  reason: string;
  rule_ref?: string;
  policy_ref?: PolicyRef;
  context_ref?: ContextRef;
  provenance?: string;
}
```

No exclusion taxonomy is approved. Facts preserve reason, reference, and
provenance; they do not prove the reason true.

**Fact bijection:**

- the `assessment_id` set of `context_disposition_facts` MUST equal
  `structural_candidates` exactly; extra or missing facts are invalid;
- the `assessment_id` set of `exclusion_facts` MUST equal
  `excluded_from_consideration` exactly; extra or missing facts are invalid.

**Reference inheritance:** in both fact types, an absent `policy_ref` or
`context_ref` inherits the corresponding `EvaluationRecord` reference. If either is
present, it MUST equal the parent record's reference. A fact cannot point to a
different policy or context.

### 6.7 Pair identity and expected coverage

#### PairRef and PairKey

```ts
interface PairRef {
  left: AssessmentID;
  right: AssessmentID;
}

type PairKey = string;

function compareIds(a: AssessmentID, b: AssessmentID): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pairKey(pair: PairRef, order: 'UNORDERED_CANONICAL' | 'ORDERED'): PairKey {
  let first = pair.left;
  let second = pair.right;
  if (order === 'UNORDERED_CANONICAL' && compareIds(first, second) > 0) {
    first = pair.right;
    second = pair.left;
  }
  return JSON.stringify([first, second]);
}
```

`compareIds` uses lexicographic ordering by UTF-16 code unit. `JSON.stringify`
provides an injective encoding for string pairs, so IDs containing delimiters
cannot collide. `AssessmentID` is constrained to a non-empty `string` for this
contract; empty identifiers are invalid, and `compareIds`/`pairKey` are defined only
for that type.

- In `UNORDERED_CANONICAL` mode, `(A, B)` and `(B, A)` have the same `PairKey`.
- In `ORDERED` mode, order is part of the key; reversed pairs are distinct.
- Duplicate expected pairs, duplicate pair evaluations, and reversed duplicates are
  detected by `PairKey`.
- Canonical ordering is ascending `PairKey` for derived views. Stored
  `expected_pairs` and `pair_evaluations` arrays MAY be in any order; E9 constrains
  derived key order, not serialisation order.
- Expected pairs in `UNORDERED_CANONICAL` are stored with `left < right`.

#### Construction modes

| Mode | Required rule fields | Meaning |
|---|---|---|
| `PAIRWISE_ALL_CONSIDERED` | None. `pair_selection_rule_ref`, `pair_selection_rule_version`, and `pair_selection_evidence_ref` MUST be absent | Expected pairs are every unordered distinct pair of `considered`; requires `pair_order = UNORDERED_CANONICAL` |
| `RULE_SELECTED` | `pair_selection_rule_ref`, `pair_selection_rule_version`, and `pair_selection_evidence_ref` MUST be present | Expected pairs are the rule output; may use `ORDERED`, but ordered semantics are OPEN |

For `RULE_SELECTED`:

- the rule input is `considered` plus the corresponding Assessment records resolved
  through `input_set_ref`, `context_ref`, and `policy_ref`;
- `pair_selection_evidence_ref` MUST resolve to an artifact that binds the rule
  version, the input reference, and the output `expected_pairs`;
- every expected pair MUST consist of two distinct IDs in `considered`;
- the rule must be declared and applied without reference to the conflict outcome
  (policy obligation; external judgment);
- the rule does not establish normative completeness of the expected pair universe.

`PAIRWISE_ALL_CONSIDERED` MUST NOT be combined with `pair_order = ORDERED`. The
ordered expected universe is not defined by this contract; it remains OPEN and is
available only through `RULE_SELECTED` with an explicit orientation rule.

For `expected_pairs ⊆ pairs(considered)`:

- `UNORDERED_CANONICAL`: `pairs(considered)` is the set of unordered distinct pairs
  of `considered` IDs;
- `ORDERED`: `pairs(considered)` is the set of ordered pairs of distinct `considered`
  IDs, including both orientations.

`RULE_SELECTED` MAY legitimately yield an empty `expected_pairs`. In that case
`pair_coverage_status = NO_PAIRS`; `predicate_execution_status = NOT_INVOKED` if a
predicate is configured, otherwise `NOT_CONFIGURED`. Empty rule output is not a
configuration error, but the rule refs and evidence remain required.

The default `PAIRWISE_ALL_CONSIDERED` is **PROPOSED**.

#### Derived pair views

`pair_evaluations` is the sole authoritative source. The following are derived, not
stored:

```text
expectedKeys   = { pairKey(p, pair_order) | p ∈ expected_pairs }
evaluatedKeys  = { pairKey(p, pair_order) | p ∈ pair_evaluations }
terminalKeys   = { pairKey(p, pair_order) | p ∈ pair_evaluations,
                   p.status ∈ {CONFLICT, NO_CONFLICT} }
failedKeys     = { pairKey(p, pair_order) | p ∈ pair_evaluations,
                   p.status = FAILED }
missingKeys    = expectedKeys \ evaluatedKeys
terminal_pairs = { p ∈ pair_evaluations | p.status ∈ {CONFLICT, NO_CONFLICT} }
failed_pairs   = { p ∈ pair_evaluations | p.status = FAILED }
missing_pairs  = { e ∈ expected_pairs | pairKey(e, pair_order) ∈ missingKeys }
conflict_findings = projection of terminal_pairs where status = CONFLICT
```

`pair_evaluations` MUST NOT contain a pair whose key is not in `expectedKeys`.
Every expected pair appears at most once in `expected_pairs` and at most once in
`pair_evaluations`. The accounting equation is over keys:

```text
expectedKeys = terminalKeys ⊎ failedKeys ⊎ missingKeys
evaluatedKeys = terminalKeys ⊎ failedKeys
```

where `⊎` is disjoint union. `terminalKeys`, `failedKeys`, and `missingKeys` are
pairwise disjoint, and their union is exactly `expectedKeys`.

#### Pair coverage statuses

| Status | Definition |
|---|---|
| **`NO_PAIRS`** | `expected_pairs` is empty |
| **`NOT_STARTED`** | `expected_pairs` is non-empty and no expected pair appears in `pair_evaluations` |
| **`PARTIAL`** | `expected_pairs` is non-empty; at least one expected pair is terminal; at least one is failed or missing |
| **`COVERED`** | `expected_pairs` is non-empty; every expected pair is terminal; `missing_pairs` is empty; no `FAILED` pair |
| **`FAILED`** | `expected_pairs` is non-empty; no expected pair is terminal; at least one expected pair is `FAILED` |

`PARTIAL` and `FAILED` are mutually exclusive and testable from the derived counts.

### 6.8 Predicate execution statuses

| Status | Definition |
|---|---|
| **`NOT_CONFIGURED`** | No predicate configured. `predicate_ref` is absent. No pair evaluations |
| **`NOT_INVOKED`** | Predicate configured (`predicate_ref` present), but no pair evaluation was attempted |
| **`INVOKED`** | At least one pair was attempted; no pair has status `FAILED` |
| **`INVOCATION_FAILED`** | At least one pair was attempted and has status `FAILED` |

**Derived `EXECUTED`:**

```text
EXECUTED iff predicate_execution_status = INVOKED
        and pair_coverage_status = COVERED
        and expected_pairs is non-empty
```

`EXECUTED` is a mechanism-coverage label. It does not establish semantic
correctness or successful conflict assessment; the symmetry status is a separate
claim. `OBSERVED_MISMATCH`, `VIOLATION`, and `INCONCLUSIVE` prevent a
verified-symmetry claim, and `MECHANISM_ASSERTED` is attestation only.

**Missing predicate:** `NOT_CONFIGURED` must not require a `predicate_ref`.

**Context blocking:** represented as `predicate_execution_status = NOT_INVOKED` and
`pair_coverage_status = NOT_STARTED` (or `NO_PAIRS` if no pairs). It is never
`INVOCATION_FAILED`.

### 6.9 Pair evaluations, findings, and predicate references

```ts
interface PairEvaluation {
  left: AssessmentID;
  right: AssessmentID;
  status: 'CONFLICT' | 'NO_CONFLICT' | 'FAILED';
  claims?: readonly string[];
  reason?: string;
  predicate_ref: PredicateRef;
}

type ConflictFinding = Pick<
  PairEvaluation,
  'left' | 'right' | 'claims' | 'reason' | 'predicate_ref'
>;
```

`pair_evaluations` is authoritative. `terminal_pairs`, `failed_pairs`,
`missing_pairs`, and `conflict_findings` are derived views, not stored fields. If a
serialised view is produced, it MUST equal the derivation exactly. `FAILED` and
`NO_CONFLICT` pairs produce no findings.

Top-level `predicate_ref` MUST be present whenever
`predicate_execution_status ≠ NOT_CONFIGURED` or `pair_evaluations` is non-empty.
It MUST equal every `PairEvaluation.predicate_ref`, and MUST be absent when
`predicate_execution_status = NOT_CONFIGURED`.

A Finding remains a detection result, not a Ruling or resolution.

### 6.10 Record schema, identity, and validation

| Field | Definition |
|---|---|
| **`record_schema_version`** | Identifies the record contract version (e.g. `dec-06-evaluation-record@1`). Not an evaluation identity |
| **`record_id`** | Identity of this record. Uniqueness is validated across a record set, not by inspecting an isolated record; not globally unique |
| **`evaluation_ref`** | Identity of the evaluation configuration/input tuple. Not a unique execution ID; repeated executions of the same configuration/input may share it. MUST be distinct when `input_set_ref`, `context_ref`, `policy_ref`, `predicate_ref`, or `requirement_ref` differs; exact composition remains OPEN |
| **`context_ref`** | Identity of the policy/context declaration |
| **`input_set_ref`** | Binding to the supplied input set; not proof of completeness |
| **`structural_validation`** | Record-internal consistency validation |
| **`evidence_validation`** | Evidence-dependent validation: input membership, evidence resolvability/relevance, rule-output binding |

**Acceptance rules:**

- `claimed_origin` is self-asserted; it proves nothing by itself.
- `origin_verification.status = VERIFIED` requires non-empty `mechanism_ref` and
  `evidence_ref` supported by that mechanism. If the mechanism is unavailable, use
  `UNAVAILABLE`.
- `structural_validation.status = PASSED` requires non-empty `validator_ref` and
  `evidence_ref`, and satisfaction of the record-internal invariants: E1, E3–E19,
  E20's construction-mode/rule-ref/`expected_pairs ⊆ pairs(considered)` clauses,
  and E21. It does not check E2 or E20's evidence-binding clause.
- `evidence_validation.status = PASSED` requires non-empty `validator_ref` and
  `evidence_ref`, satisfaction of E2 and E20's evidence-binding clause, and
  resolvability of the origin/symmetry evidence references. It MUST also verify
  that every `SymmetryCheck.evidence_ref` contributing to a symmetry status is
  resolvable and relevant, and that a `MECHANISM_ASSERTED` attestation binds the
  claimed `evaluation_ref` and `expected_pairs`. It is separate from structural
  validation.
- `symmetry_verification.status = VERIFIED` requires the `MATCH`-check evidence
  defined in §6.11; `MECHANISM_ASSERTED` requires the attestation evidence defined
  there.
- The origin, structural, evidence, and symmetry references are distinct claims.
  Their `mechanism_ref` / `validator_ref` / `evidence_ref` values MUST be distinct
  and MUST NOT be reused across claims unless a combined-evidence type is defined.
  A reference proves that evidence is identified, not that it is sufficient,
  complete, or legitimate. `VERIFIED` and `PASSED` are producer attestations;
  structural validation establishes record-internal consistency and non-emptiness
  only.
- A record is **core-accepted** only if `claimed_origin = CORE_001`,
  `origin_verification.status = VERIFIED` by the core mechanism, and
  `structural_validation.status = PASSED`. Core acceptance does not imply
  `evidence_validation.status = PASSED`.
- A record is **evidence-validated** only if `evidence_validation.status = PASSED`.
  Evidence validation does not imply core origin or structural acceptance.
- An external record with `claimed_origin = EXTERNAL` and
  `structural_validation.status = PASSED` is structurally validated with external
  origin; there is no separate `structurally_validated_external` field. Structural
  validation does not imply core origin, evidence validation, completeness, policy
  legitimacy, or predicate semantic correctness.

### 6.11 Symmetry verification

```ts
interface SymmetryCheck {
  left: AssessmentID;
  right: AssessmentID;
  forward_status: 'CONFLICT' | 'NO_CONFLICT' | 'FAILED';
  reverse_status: 'CONFLICT' | 'NO_CONFLICT' | 'FAILED';
  evidence_ref?: string;
}
```

`comparison` is derived, not stored:

```text
comparison = MATCH          if forward_status and reverse_status are terminal and equal
             MISMATCH       if forward_status and reverse_status are terminal and differ
             INCONCLUSIVE   if either status is FAILED
```

**`symmetry_checks` invariants:**

- Every check's `pairKey({ left, right }, pair_order)` MUST be in `expectedKeys`.
- No duplicate check for the same `PairKey`.
- `forward_status` MUST equal the `pair_evaluations` status for the same pair
  orientation: the canonical orientation in `UNORDERED_CANONICAL`, or the exact
  `(left, right)` orientation of the check in `ORDERED`.
- `reverse_status` MUST always be evaluated and recorded for the `comparison`
  derivation. It is not an independent expected-pair result and is not counted in
  `terminalKeys`/`failedKeys` unless the reversed pair is itself an expected pair
  (possible only with `RULE_SELECTED` + `ORDERED`); in that case it MUST equal that
  pair's `pair_evaluations` status.
- `comparison` is derived from the two statuses; a serialised value must match.
- `evidence_ref` is mandatory for every check that contributes to `VERIFIED`,
  `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `VIOLATION`, or `INCONCLUSIVE`. A failed or
  incomplete reverse check must retain its `evidence_ref`.
- `symmetry_checks` is a verification trace, not a second source of ordinary pair
  results.

**Symmetry statuses:**

| Status | Definition |
|---|---|
| **`NOT_PERFORMED`** | No checks and no mechanism attestation |
| **`OBSERVED_MATCH`** | `expected_pairs` is non-empty; every expected pair is covered by a `MATCH` check with `evidence_ref`; `symmetry_declaration ≠ SYMMETRIC` |
| **`OBSERVED_MISMATCH`** | At least one `MISMATCH` exists; `symmetry_declaration ≠ SYMMETRIC` |
| **`VERIFIED`** | `pair_order = UNORDERED_CANONICAL`; `expected_pairs` is non-empty; every expected pair is covered by a `MATCH` check with `evidence_ref`; `symmetry_declaration = SYMMETRIC` |
| **`VIOLATION`** | `pair_order = UNORDERED_CANONICAL`; at least one `MISMATCH` with `evidence_ref` exists; `symmetry_declaration = SYMMETRIC` |
| **`MECHANISM_ASSERTED`** | `pair_order = UNORDERED_CANONICAL`; `expected_pairs` is non-empty; `pair_coverage_status = COVERED`; `predicate_execution_status = INVOKED`; `symmetry_declaration = SYMMETRIC`; `mechanism_ref` and `evidence_ref` bind to `evaluation_ref` and `expected_pairs`; no `MISMATCH` check exists; no recorded check has `comparison = INCONCLUSIVE` |
| **`INCONCLUSIVE`** | At least one check with `evidence_ref` was performed; no `MISMATCH`; either not all expected pairs are covered or at least one comparison is `INCONCLUSIVE` |

When `expected_pairs` is empty, `symmetry_verification.status` MUST be `NOT_PERFORMED`; it cannot be `VERIFIED`, `OBSERVED_MATCH`, or `MECHANISM_ASSERTED` vacuously.

**Valid combinations:**

| `pair_order` | `symmetry_declaration` | Allowed `symmetry_verification.status` |
|---|---|---|
| `UNORDERED_CANONICAL` | `SYMMETRIC` | `NOT_PERFORMED`, `VERIFIED`, `VIOLATION`, `MECHANISM_ASSERTED`, `INCONCLUSIVE` |
| `UNORDERED_CANONICAL` | `ASYMMETRIC` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE` |
| `UNORDERED_CANONICAL` | `UNSPECIFIED` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE` |
| `ORDERED` | `ASYMMETRIC` or `UNSPECIFIED` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE`; only `RULE_SELECTED`; ordered semantics OPEN |
| `ORDERED` | `SYMMETRIC` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE`; only `RULE_SELECTED`; `VERIFIED`/`VIOLATION`/`MECHANISM_ASSERTED` not permitted until ordered semantics are approved |

A single canonical evaluation of `(left, right)` cannot establish that
`(right, left)` produces the same result. `VERIFIED` requires full `MATCH` check
coverage and is permitted only in `UNORDERED_CANONICAL` mode. A mechanism guarantee
is represented as `MECHANISM_ASSERTED`, not `VERIFIED`; it is an attestation, not
structural verification, and it requires no `MISMATCH` check. In `ORDERED` mode,
the contract permits observation statuses only until ordered semantics are
approved.

**Precedence:** if any `symmetry_check` has `comparison = MISMATCH`, the status MUST
be `VIOLATION` when `symmetry_declaration = SYMMETRIC`, otherwise
`OBSERVED_MISMATCH`. If any recorded check has `comparison = INCONCLUSIVE`,
`INCONCLUSIVE` takes precedence over `MECHANISM_ASSERTED`; `MECHANISM_ASSERTED` is
permitted only when every recorded check is `MATCH`. `VERIFIED` and
`MECHANISM_ASSERTED` are impossible when a `MISMATCH` or `INCONCLUSIVE` comparison
exists.

### 6.12 Structural invariants

| ID | Invariant |
|---|---|
| **E1** | No duplicate IDs within any single list; all `AssessmentID` values are non-empty strings |
| **E2** | `structural_candidates` contains only IDs present in the input set referenced by `input_set_ref` |
| **E3** | The `assessment_id` set of `context_disposition_facts` equals `structural_candidates` exactly; no extra or missing facts; absent `policy_ref`/`context_ref` inherit the parent, present values equal the parent |
| **E4** | Every structural candidate has exactly one `ContextDispositionFact` |
| **E5** | `context_assessment_status = COMPLETE` implies all facts are `CONTEXT_APPLICABLE` or `CONTEXT_INAPPLICABLE`; `PARTIAL` implies at least one `CONTEXT_UNASSESSED` |
| **E6** | `considered` and `excluded_from_consideration` are disjoint subsets of the derived `context_applicable` set |
| **E7** | `considered` and `excluded_from_consideration` partition the derived `context_applicable` set |
| **E8** | The `assessment_id` set of `exclusion_facts` equals `excluded_from_consideration` exactly; no extra or missing facts; absent `policy_ref`/`context_ref` inherit the parent, present values equal the parent |
| **E9** | `PairKey` canonical ordering holds; `expected_pairs` has no duplicate key in either mode and no reversed-duplicate key in `UNORDERED_CANONICAL` mode |
| **E10** | `expectedKeys = terminalKeys ⊎ failedKeys ⊎ missingKeys` and `evaluatedKeys = terminalKeys ⊎ failedKeys`; no extra pair evaluations |
| **E11** | `pair_evaluations` reference distinct IDs in `considered`; no duplicate `PairKey` |
| **E12** | `pair_coverage_status` matches the definitions in §6.7 |
| **E13** | `predicate_execution_status` matches the definitions in §6.8 |
| **E14** | Only the legal status combinations in §9.2 are permitted |
| **E15** | Derived `conflict_findings` equals the canonical `CONFLICT` projection of `pair_evaluations`; no stored duplicate may conflict with it |
| **E16** | `VERIFIED` requires non-empty `expected_pairs`, full `MATCH` check coverage with `evidence_ref`, `symmetry_declaration = SYMMETRIC`, and `UNORDERED_CANONICAL`; `MECHANISM_ASSERTED` requires `COVERED` + `INVOKED` + `SYMMETRIC` + evidence binding + no `MISMATCH` and no `INCONCLUSIVE` check; any `MISMATCH` forces `VIOLATION` (with `evidence_ref`) or `OBSERVED_MISMATCH`; any `INCONCLUSIVE` check forces `INCONCLUSIVE` over `MECHANISM_ASSERTED`; `ORDERED` permits observation statuses only; `expected_pairs = ∅` implies `NOT_PERFORMED` |
| **E17** | `record_schema_version`, `record_id`, `evaluation_ref`, `input_set_ref`, `context_ref`, and `policy_ref` are present; `record_id` uniqueness is validated at record-set level; `evaluation_ref` is distinct whenever `input_set_ref`, `context_ref`, `policy_ref`, `predicate_ref`, or `requirement_ref` differs |
| **E18** | No winner, preferred, canonical, resolved, selected-branch, or resolution field is present |
| **E19** | `origin_verification.status = VERIFIED` requires non-empty `mechanism_ref` and `evidence_ref`; `structural_validation.status = PASSED` requires non-empty `validator_ref` and `evidence_ref`; `evidence_validation.status = PASSED` requires non-empty `validator_ref` and `evidence_ref`; origin, structural, evidence, and symmetry references MUST be distinct and MUST NOT be reused across claims unless a combined-evidence type is defined; `structural_validation = PASSED` certifies record-internal consistency and non-empty references only, while `evidence_validation = PASSED` is defined separately in §6.10 and §6.13 |
| **E20** | `PAIRWISE_ALL_CONSIDERED` implies no selection-rule refs and `pair_order = UNORDERED_CANONICAL`; `RULE_SELECTED` implies rule ref, version, and evidence ref, `expected_pairs ⊆ pairs(considered)`, and the evidence binds rule version, input, and output |
| **E21** | Top-level `predicate_ref` is present whenever `predicate_execution_status ≠ NOT_CONFIGURED` or `pair_evaluations` is non-empty; it equals every `PairEvaluation.predicate_ref`; it is absent when `predicate_execution_status = NOT_CONFIGURED` |
| **E22** | `structural_validation.status = PASSED` and `evidence_validation.status = PASSED` are independent; neither implies the other |

### 6.13 Validation limits

Structural validation establishes internal consistency only. `structural_validation =
PASSED` certifies record-internal consistency plus non-empty evidence references; it
does not resolve E2, E20 evidence-binding, or E19 reference resolvability/relevance
without the input set, validator access, or external evidence.
`evidence_validation = PASSED` certifies those evidence-dependent checks; it does
not establish policy legitimacy, predicate semantic correctness, or completeness of
the supplied input. Structural validation does not prove:

- completeness of the supplied input;
- that `context_inapplicable` is legitimate;
- that `excluded_from_consideration` is non-pretextual;
- that the expected pair universe is normatively complete;
- that the predicate is semantically correct;
- that the record represents what actually happened.

---

## 7. Predicate contract and limitations

### 7.1 Four distinct properties

| Property | Meaning | CORE-001 guarantee | Status |
|---|---|---|---|
| **Declared inputs** | Input tuple is declared and recorded; includes both Assessment records or declared content, not merely IDs | Can constrain and record call signature | **PROPOSED** |
| **Deterministic execution** | Same declared inputs/context produce the same verdict | Can require and test for a pure function given declared inputs | **PROPOSED** |
| **Access isolation** | No closures, globals, ambient state, or other Assessments | Signature alone cannot guarantee; isolated execution or declarative predicates needed | **OPEN** |
| **Semantic correctness** | Predicate correctly captures the domain's contradiction concept | Not guaranteed; separate verification/normative judgment needed | **OPEN** |

### 7.2 Expected pair universe

- Current implementation evaluates all unordered distinct pairs of the set passed
  to `collectContestedClaims`, one canonical order per pair. This is implementation
  behaviour, not a normative definition.
- CORE-001 Rev 0.3.3 does not define the expected pair universe; **OPEN**.
- Default proposed construction: `PAIRWISE_ALL_CONSIDERED` (§6.7).
- Rule-selected subset: `pair_construction_mode = RULE_SELECTED`; rule ref, version,
  and evidence ref required; normative status **OPEN**.
- Atomic evaluation: not current behaviour; **PROPOSED/OPEN**. If adopted, per-pair
  findings must be preserved or marked unavailable.

### 7.3 Pair ordering and symmetry

- `pair_order` and `symmetry_declaration` are required.
- `symmetry_verification.status` records evidence, not a claim.
- A single canonical evaluation does not verify reversal invariance.
- `VERIFIED` requires full `MATCH` check coverage with `SYMMETRIC` declaration.
- `MECHANISM_ASSERTED` records a mechanism attestation under `SYMMETRIC`; it is
  permitted only in `UNORDERED_CANONICAL` and is not structural verification.
- `OBSERVED_MISMATCH`, `VIOLATION`, and `INCONCLUSIVE` prevent a verified-symmetry
  claim and a successful symmetric conflict assessment claim.
- `ORDERED` semantics remain **OPEN**; `PAIRWISE_ALL_CONSIDERED` is prohibited with
  `ORDERED`.

### 7.4 Partial failure and zero-pair semantics

| Situation | Coverage | Predicate | Success claim |
|---|---|---|---|
| Zero/one considered Assessment | `NO_PAIRS` | `NOT_CONFIGURED` or `NOT_INVOKED` | None |
| Expected pairs, no predicate | `NOT_STARTED` or `NO_PAIRS` | `NOT_CONFIGURED` | None |
| Expected pairs, configured, not attempted | `NOT_STARTED` | `NOT_INVOKED` | None |
| Some terminal, some failed/missing | `PARTIAL` | `INVOKED` or `INVOCATION_FAILED` | None |
| All expected terminal | `COVERED` | `INVOKED` | `EXECUTED` (mechanism) |
| No terminal, at least one failed | `FAILED` | `INVOCATION_FAILED` | None |

`PARTIAL` and `FAILED` are coverage statuses; they are not predicate statuses.
`NO_PAIRS` is a coverage status; it is not a predicate result.

### 7.5 Mechanism requirements

- Stable predicate identity/version.
- Declared input tuple.
- Both Assessment records or declared content.
- Deterministic behaviour for declared inputs.
- Immutable context; no mutation.
- Defined error/non-boolean behaviour maps to `INVOCATION_FAILED`.
- Pair ordering and symmetry declaration/verification recorded.
- Expected pair universe and selection rule recorded.
- No implicit majority, winner, or resolution.
- Per-pair and coverage statuses recorded.

### 7.6 Limits

A declared signature does not prevent closure over the full Assessment list,
globals, a clock, or mutable state. The core can constrain arguments, not prove
isolation. A deterministic, pure, versioned predicate can still be semantically
wrong.

A conflict finding means the configured predicate reported a conflict. It does not
prove contradiction. Absence of a finding does not prove no contradiction.
`NO_PAIRS` means no pair was evaluated; it does not prove no conflict.

---

## 8. Revised normative proposals N1–N11

All N1–N11 are proposals. None is approved. **N2 and N5 are PENDING SPEC
AMENDMENT** and have no normative effect until a separate amendment is approved and
re-audited.

| ID | Proposed effect | Section | Type | Status | Dependency / conflict |
|---|---|---|---|---|---|
| **N1** | Define evaluation context and require identifiable, versioned context criteria/provenance | §6.3 | ADDITION | **PROPOSED** | D1b; no existing definition |
| **N2** | Define applicability separately from final assurance selection for §6.4/§8.5 purposes | §6.3/§6.4 | **REPLACEMENT** | **PENDING SPEC AMENDMENT** | Changes §6.3 #6 operative relationship |
| **N3** | Prohibit excluding a context-applicable Assessment from consideration solely because inclusion would cause conflict | §6.4/§8.5 | ADDITION | **PROPOSED** | D2; applies to `excluded_from_consideration`, not `context_inapplicable` |
| **N4** | Recording an exclusion does not make a conflict-dependent exclusion permissible | §6.4 | ADDITION | **PROPOSED** | D2; normative, not mechanical |
| **N5** | Require independently declared basis/provenance; a post-hoc criterion is not independent | §6.3/§6.4 | ADDITION / partial REPLACEMENT | **PENDING SPEC AMENDMENT** | D3; core cannot prove pretext |
| **N6** | Require disclosure of input-set ref, structural candidates, canonical context-disposition facts, considered, excluded, expected pairs, pair-construction mode/rule/version/evidence, authoritative pair evaluations, coverage/predicate statuses, and derived missing pairs/findings with provenance | §6.4/§8.8 | ADDITION | **PROPOSED** | D4/D6; record contract §6 |
| **N7** | A conflict finding is detection, not truth determination or resolution | §6.4 | CLARIFICATION | **PROPOSED** | Consistent with §6.4 resolution requirement |
| **N8** | No automatic priority within a single CORE-001 evaluation from order, recency, majority, or absence of conflict in a narrowed subset | §6.3/§6.4 | ADDITION | **PROPOSED** | No branch orchestration; caller-side priority outside scope |
| **N9** | Distinguish predicate mechanism correctness from semantic correctness; findings are not proof | §6.4 | ADDITION | **PROPOSED** | D5; semantic correctness OPEN |
| **N10** | Context identity does not establish comparability or substitutability | §6.4/§8.8 | ADDITION | **PROPOSED** | D6; caller comparison outside scope |
| **N11** | An EvaluationRecord does not independently establish completeness of the applicable set or expected pair universe | §6.4/§8.8 | ADDITION | **PROPOSED** | D1b/D4/D6; record is evidence, not proof |

**Explicit notes:** N2 must not be presented as a clarification. N5 must not be
presented as a core-verifiable test. N8 must not regulate caller-side branches.

---

## 9. Conformance invariants, status matrices, and scenarios

### 9.1 Conformance layers by invariant

| Invariant group | Layer | Scenarios |
|---|---|---|
| E1, E2, E9–E14, E20, E21 | CORE-001 implementation / record contract | S12, S17–S21, S23–S24 |
| E3–E8 | Record contract / receiving policy | S1–S3, S15, S16 |
| E15 | CORE-001 implementation / record contract | S9, S13 |
| E16 | CORE-001 implementation / predicate contract | S10, S22 |
| E17–E19, E22 | CORE-001 implementation / claim boundary | S7, S12 |

**A-8 remains OPEN.** No invariant or test may assert which status wins when
conflict, missing claims, or disallowed claims coexist.

### 9.2 Pair coverage × predicate execution combinations

Rows: `pair_coverage_status`. Columns: `predicate_execution_status`.

| Coverage \ Predicate | `NOT_CONFIGURED` | `NOT_INVOKED` | `INVOKED` | `INVOCATION_FAILED` |
|---|---|---|---|---|
| **`NO_PAIRS`** | **Allowed.** No predicate, no pairs. No success claim | **Allowed.** Configured, no pairs. No success claim | **Forbidden.** Invocation implies pairs | **Forbidden.** Failure implies attempted pairs |
| **`NOT_STARTED`** | **Allowed.** Expected pairs exist, no predicate, no attempt. No success claim | **Allowed.** Configured, expected pairs, no attempt (e.g. context blocking). No success claim | **Forbidden.** Invocation implies attempted pairs | **Forbidden.** Failure implies attempted pairs |
| **`PARTIAL`** | **Forbidden.** No predicate cannot yield terminal pairs | **Forbidden.** No invocation cannot yield terminal pairs | **Allowed.** Some terminal, some missing. No full success claim | **Allowed.** Some terminal, some failed/missing. No full success claim |
| **`COVERED`** | **Forbidden.** No predicate cannot cover pairs | **Forbidden.** No invocation cannot cover pairs | **Allowed.** `EXECUTED` mechanism label; semantic success separate | **Forbidden.** A failed pair prevents coverage |
| **`FAILED`** | **Forbidden.** No predicate cannot produce failed pairs | **Forbidden.** No invocation cannot produce failed pairs | **Forbidden.** `INVOKED` requires no failed pairs | **Allowed.** No terminal, at least one failed. No success claim |

**Derived label:** `EXECUTED` iff `predicate_execution_status = INVOKED`,
`pair_coverage_status = COVERED`, and `expected_pairs` is non-empty. `EXECUTED` is
a mechanism-coverage label, not a semantic-correctness claim.

**Zero-pair rule:** `NO_PAIRS` can combine only with `NOT_CONFIGURED` or
`NOT_INVOKED`. It never implies success or absence of conflict.

**Context blocking rule:** context blocking uses `context_assessment_status =
PARTIAL` with `predicate_execution_status = NOT_INVOKED` and
`pair_coverage_status = NOT_STARTED` or `NO_PAIRS`. It is never
`INVOCATION_FAILED`.

**Missing predicate rule:** `NOT_CONFIGURED` requires `predicate_ref` to be absent.
`NO_PAIRS` or `NOT_STARTED` are the only legal coverage statuses with it.

### 9.3 Symmetry status combinations

| `pair_order` | `symmetry_declaration` | Legal `symmetry_verification.status` |
|---|---|---|
| `UNORDERED_CANONICAL` | `SYMMETRIC` | `NOT_PERFORMED`, `VERIFIED`, `VIOLATION`, `MECHANISM_ASSERTED`, `INCONCLUSIVE` |
| `UNORDERED_CANONICAL` | `ASYMMETRIC` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE` |
| `UNORDERED_CANONICAL` | `UNSPECIFIED` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE` |
| `ORDERED` | `ASYMMETRIC` or `UNSPECIFIED` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE`; only `RULE_SELECTED`; ordered semantics OPEN |
| `ORDERED` | `SYMMETRIC` | `NOT_PERFORMED`, `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `INCONCLUSIVE`; only `RULE_SELECTED`; `VERIFIED`/`VIOLATION`/`MECHANISM_ASSERTED` not permitted until ordered semantics are approved |

`VERIFIED` requires full expected-pair coverage by `MATCH` checks with evidence,
`SYMMETRIC` declaration, and `UNORDERED_CANONICAL` mode. `MECHANISM_ASSERTED` requires
full pair coverage, `INVOKED`, `SYMMETRIC`, `UNORDERED_CANONICAL`, and attestation
evidence binding the mechanism to `evaluation_ref` and `expected_pairs`.
`INCONCLUSIVE` takes precedence over `MECHANISM_ASSERTED` when any recorded check is
`INCONCLUSIVE`. `VIOLATION` requires a `MISMATCH` under `SYMMETRIC`;
`OBSERVED_MISMATCH` records a `MISMATCH` without a symmetry claim. `INCONCLUSIVE`
covers partial coverage, a `FAILED` side, or no decisive comparison. A single
canonical evaluation is never `VERIFIED`.

### 9.4 Invariant matrix

| Invariant | Check | Failure consequence |
|---|---|---|
| **E1** | No duplicate IDs in any list; IDs non-empty | Structural invalidation |
| **E2** | Structural candidates derived from `input_set_ref` | Binding invalid; record incomplete |
| **E3** | Context fact IDs equal `structural_candidates` exactly | Structural invalidation |
| **E4** | Exactly one context disposition fact per structural candidate | Structural invalidation |
| **E5** | `COMPLETE`/`PARTIAL` matches fact content | Status invalidation |
| **E6** | Considered/excluded disjoint subsets of derived applicable set | Structural invalidation |
| **E7** | Considered/excluded partition derived applicable set | Structural invalidation |
| **E8** | Exclusion fact IDs equal `excluded_from_consideration` exactly | Structural invalidation |
| **E9** | Pair keys canonical; no duplicate/reversed duplicates | Structural invalidation |
| **E10** | `expectedKeys = terminalKeys ⊎ failedKeys ⊎ missingKeys`; no extras | Coverage invalid |
| **E11** | Pair evaluations reference considered IDs; no duplicate keys | Structural invalidation |
| **E12** | Coverage status matches definitions | Status invalidation |
| **E13** | Predicate status matches definitions | Status invalidation |
| **E14** | Only legal status combinations | Record invalid |
| **E15** | Derived findings equal CONFLICT projection; no stored duplicate | Finding invalid |
| **E16** | Symmetry status matches declaration/coverage/evidence; `INCONCLUSIVE` outranks `MECHANISM_ASSERTED`; `MECHANISM_ASSERTED` is attestation only | Symmetry claim invalid |
| **E17** | Schema version and identity refs present; record-set uniqueness explicit; evaluation_ref bound to constituent refs | Record invalid |
| **E18** | No winner/canonical/resolved/selected-branch/resolution field | Structural invalidation |
| **E19** | VERIFIED/PASSED require mechanism/validator/evidence refs; refs are distinct across origin/structural/evidence/symmetry; structural PASSED is internal only | Status invalid |
| **E20** | Pair-construction mode matches rule refs, `pair_order`, and `expected_pairs ⊆ pairs(considered)` | Record invalid |
| **E21** | Top-level predicate_ref is present and matches pair evaluations when required | Record invalid |
| **E22** | Structural and evidence validation are independent | Claim invalid |

### 9.5 Scenario coverage

| Scenario | What it tests | Expected representation |
|---|---|---|
| **S1** | Predeclared conflict-dependent context criterion | `context_inapplicable`; N3/N4 do not apply; N1/N5 + external judgment |
| **S2** | Legitimate independent context exclusion | Same record shape as S1; no automatic legitimacy |
| **S3** | Context version changed after conflict | Distinct `evaluation_ref`/record; old record retained only if caller keeps it |
| **S4** | Same-assessor conflict ignored by predicate | No conflict finding; same-assessor scope OPEN |
| **S5** | Incomparable profiles/methods | Finding may be recorded; comparability OPEN |
| **S6** | Conflict on irrelevant claim | Finding recorded; edge-vs-claim OPEN |
| **S7** | Temporal/supersession exclusion | `context_inapplicable` or `excluded_from_consideration`; no automatic determination |
| **S8** | Caller selects among records | Outside CORE-001; no core winner |
| **S9** | Set-level contradiction missed pairwise | No finding; pairwise vs set-level OPEN |
| **S10** | Asymmetric predicate | `symmetry_declaration = ASYMMETRIC`; no `VERIFIED` claim |
| **S11** | Conflict with empty claims | Finding with no claims; claim semantics OPEN |
| **S12** | Record omits an applicable Assessment | `input_set_ref` binds supplied input, not completeness |
| **S13** | Closure branch conflict | Finding preserved; A-8 OPEN |
| **S14** | Limited mode without predicate | `NOT_CONFIGURED`; no `predicate_ref`; no success |
| **S15** | Exclusion reason references conflict | `excluded_from_consideration`; N3/N4 apply; recorded, not legitimised |
| **S16** | Declared vs post-hoc context criterion | Facts/provenance recorded; pretext not provable |
| **S17** | Zero or one considered Assessment | `NO_PAIRS` + `NOT_CONFIGURED`/`NOT_INVOKED`; no success/no-conflict claim |
| **S18** | Missing expected pairs | `PARTIAL`; derived missing pairs non-empty; not `EXECUTED` |
| **S19** | Partial predicate failure | `PARTIAL` + `INVOCATION_FAILED`; terminal pair findings remain authoritative detection results; no complete-coverage success claim |
| **S20** | Context blocking | `context_assessment_status = PARTIAL`; `NOT_INVOKED`; `NOT_STARTED`/`NO_PAIRS`; not predicate failure |
| **S21** | Missing predicate | `NOT_CONFIGURED`; no `predicate_ref`; `NO_PAIRS`/`NOT_STARTED`; no success |
| **S22** | Symmetry verification | One canonical order → `NOT_PERFORMED`; full MATCH + `SYMMETRIC` in `UNORDERED_CANONICAL` → `VERIFIED`; full MATCH without `SYMMETRIC` → `OBSERVED_MATCH`; mismatch under `SYMMETRIC` → `VIOLATION`; mismatch without `SYMMETRIC` → `OBSERVED_MISMATCH`; partial/failed comparison → `INCONCLUSIVE`; mechanism attestation → `MECHANISM_ASSERTED`; `ORDERED` → observation statuses only |
| **S23** | Duplicate or reversed pair key | Structural invalidation for duplicate keys in either mode and reversed duplicates under `UNORDERED_CANONICAL` |
| **S24** | Rule-selected pair evidence | `RULE_SELECTED` without rule/version/evidence refs is invalid; expected pairs must be pairs of `considered` IDs; evidence must bind rule version, input, and output |

---

## 10. Remaining OPEN questions

| ID | OPEN question | Why it remains OPEN |
|---|---|---|
| **O-A8** | A-8 precedence: conflict vs missing/disallowed | No normative precedence rule |
| **O-EDGE** | Edge-vs-claim conflict scope | §6.4 "corresponding Claim" vs §8.5 edge model |
| **O-SAME** | Same-assessor conflicts | §6.4 text vs "Conflicting Assessors" title |
| **O-PROFILE** | Profile/method comparability | CORE-001 does not define comparable claims |
| **O-SUPER** | Supersession as selection or resolution | §6.3 preserves history; no resolution rule |
| **O-TIME** | Temporal scope authority | No normative definition of legitimate temporal scope |
| **O-TRUST** | §6.4/§8.5 trust wording | Trusted vs applicable |
| **O-LOCAL** | Meaning/governance of "local" | Outside CORE-001; no organisational definition |
| **O-RES** | Resolution authority/representation | §6.4 requires resolution; no object/authority |
| **O-SEM** | Predicate semantic correctness | Mechanism cannot guarantee contradiction concept |
| **O-SET** | Pairwise vs set-level contradiction | Pairwise contract may miss set-level conflicts |
| **O-EMPTY** | Empty contested-claims semantics | Claim-level vs assessment-level conflict |
| **O-CALLER** | Caller selection/comparability | Outside CORE-001 |
| **O-BP** | Branch Preservation core vs caller obligation | EP-2/BP-1 unresolved |
| **O-L3** | Level 3 audit requirement | Optional/stronger level |
| **O-PRETEXT** | Predeclared vs pretext distinction | Requires external judgment |
| **O-CTXUN** | `CONTEXT_UNASSESSED` retention | Proposed fact/status model |
| **O-PAIR** | Expected pair universe | `PAIRWISE_ALL_CONSIDERED` vs rule-selected |
| **O-NOPAIRS** | `NO_PAIRS` representation | Proposed coverage status |
| **O-BLOCK** | Context blocking behaviour | Whole-evaluation block vs partial execution |
| **O-FIND** | Canonical findings | `pair_evaluations` vs derived `conflict_findings` |
| **O-SYM** | Symmetry verification requirement | Evidence standard, observed/attested statuses, and `INCONCLUSIVE` semantics |
| **O-ORIGIN** | Authenticated origin mechanism | Separate mechanism not assumed |
| **O-PROV** | Provenance of the three approved principles | No separate signed decision record in this repository; decision-register entry required |
| **O-INPUT** | Input-set membership validation | Digest vs manifest/proof |
| **O-INVAR** | Structural invariants normative or API-level | Decision not made |
| **O-ISO** | Access isolation | Declarative/isolated execution not assumed |
| **O-DISCLOSE** | Future caller/adapter disclosure | Outside current scope |
| **O-EPBP** | EP-2/BP-1 approval route | PROPOSED; amendment if normative |
| **O-EVALREF** | `evaluation_ref` composition | Identity tuple not finalised |

---

## 11. Owner decision table

| ID | Question | Proposed answer | Status | Normative effect | Blocks |
|---|---|---|---|---|---|
| **O-1** | Regime | Disclosure-first with bounded mechanical guarantees | **PROPOSED** | Frames package; no direct text change | All boundary decisions |
| **O-2** | Evidence Preservation scope | EP-2 | **PROPOSED** | Explicit scope decision; amendment if normative | Completeness/legitimacy claims |
| **O-3** | Branch Preservation scope | BP-1 | **PROPOSED** | Explicit scope decision | Caller-side claims |
| **D1a** | Structural applicability | Core-computable, existing edge triple only | **PROPOSED** | Clarifies §8.5 edge model; no edge-vs-claim/DEC-15 resolution | Record contract |
| **D1b** | Declared context applicability | Policy declares criteria/version/provenance; core records disposition facts | **PROPOSED** | Policy-layer requirement; may need amendment | S1/S3/S16 |
| **D1c** | Trust admissibility | Keep separate and OPEN | **OPEN** | None | §6.4/§8.5 trust wording |
| **D2** | Conflict-dependent exclusion | Reading B | **PROPOSED** | Policy obligation; core cannot always detect | S1/S15 |
| **D3** | Independent basis/non-suppression | Policy obligation; standard OPEN | **PROPOSED** | No mechanical proof | S1/S2/S3 |
| **D4** | Evidence level | Level 2 minimum; Level 3 optional | **PROPOSED** | Disclosure requirement; not proof | S1/S12 |
| **D5** | Predicate contract | Mechanism requirements; per-pair; ordering/symmetry recorded; semantic correctness OPEN | **PROPOSED** | Mechanism/API; no semantic guarantee | S4/S9/S10/S22 |
| **D6** | EvaluationRecord | Option B; schema-versioned record with disposition facts, input binding, pair coverage, origin, per-pair execution | **PROPOSED** | API design; no normative text change | Record contract |
| **N1** | Evaluation context definition | ADDITION | **PROPOSED** | Requires spec route | D1b |
| **N2** | Applicability vs final selection | REPLACEMENT | **PENDING SPEC AMENDMENT** | No effect until amendment | D1b |
| **N3** | Conflict-dependent exclusion prohibition | ADDITION for `excluded_from_consideration` | **PROPOSED** | Policy obligation | D2 |
| **N4** | Recording does not legitimise | ADDITION | **PROPOSED** | Normative statement | D2 |
| **N5** | Independent basis/provenance | ADDITION/partial REPLACEMENT | **PENDING SPEC AMENDMENT** | No effect until amendment | D3 |
| **N6** | Disclosure of record content | ADDITION | **PROPOSED** | Record requirement | D4/D6 |
| **N7** | Detection is not resolution | CLARIFICATION | **PROPOSED** | Safe clarification | §6.4 |
| **N8** | No automatic priority within one evaluation | ADDITION | **PROPOSED** | Scope-limited | No branch orchestration |
| **N9** | Mechanism vs semantic correctness | ADDITION | **PROPOSED** | Distinction | D5 |
| **N10** | Context identity ≠ comparability | ADDITION | **PROPOSED** | Claim boundary | D6 |
| **N11** | Record does not establish completeness | ADDITION | **PROPOSED** | Claim boundary | D1b/D4/D6 |
| **C-1** | Caller/adapter disclosure | No new obligation | **OPEN** | Outside scope | Future contract |
| **C-2** | `CONTEXT_UNASSESSED` | Retain as mandatory disposition fact for `PARTIAL`; `COMPLETE`/`PARTIAL` status | **PROPOSED** | Record/API | E3–E5 |
| **C-3** | Expected pair universe | `PAIRWISE_ALL_CONSIDERED` default; rule-selected OPEN | **PROPOSED / OPEN** | Record/API | E9/E10/E20 |
| **C-4** | Zero-pair representation | `NO_PAIRS` in coverage status | **PROPOSED** | Record/API | E12 |
| **C-5** | Context blocking behaviour | `CONTEXT_BLOCKING_BEHAVIOR` OPEN; record supports block or partial execution | **OPEN** | Record/API | E14 |
| **C-6** | Canonical pair results | `pair_evaluations` authoritative; other sets derived | **PROPOSED** | Record/API | E10/E15 |
| **C-7** | Symmetry verification | `VERIFIED` only with full `MATCH` checks in `UNORDERED_CANONICAL`; `MECHANISM_ASSERTED` for attestation; `ORDERED` observation-only until approved | **PROPOSED / OPEN** | Record/API | E16 |
| **C-8** | Origin verification | In-process token for core; structural validation for external; authenticated origin OPEN | **PROPOSED / OPEN** | API/security | E17/E19 |
| **C-9** | Two-field status model | Adopt `pair_coverage_status` + `predicate_execution_status` | **PROPOSED** | Record/API | E12–E14 |
| **C-10** | `record_schema_version` | Require it | **PROPOSED** | Record/API | E17 |
| **C-11** | Pair key definition | Adopt `pairKey` with explicit comparator and injective `JSON.stringify` encoding | **PROPOSED** | Record/API | E9–E11 |
| **C-12** | Symmetry status vocabulary | Adopt `OBSERVED_MATCH`, `OBSERVED_MISMATCH`, `VERIFIED`, `VIOLATION`, `MECHANISM_ASSERTED`, `INCONCLUSIVE` | **PROPOSED** | Record/API | E16 |
| **C-13** | Evidence reference separation | Separate origin, structural, and symmetry refs; no reuse across claims | **PROPOSED** | Record/API | E19 |
| **C-14** | Evidence validation separation | Add `evidence_validation`; `structural_validation` is record-internal only | **PROPOSED** | Record/API | E22 |
| **T-1** | Task 17/18 statuses | No change; record implications only | **APPROVED constraint** (owner instruction; provenance O-PROV) | None | Any status change requires re-audit |

---

## 12. Implementation boundary and explicit non-goals

This addendum does not authorise source, test, schema, specification, or task-status
changes; it does not authorise commits, branches, or PRs.

It does not introduce fork orchestration, branch lifecycle, branch selection,
winner, canonical branch, automatic reconciliation, normative resolution,
persistence requirements, universal trust, global arbiter, automatic revocation,
authority inheritance, grant-producing API, or organisational meaning of "local".

It does not claim that implementation conformance proves policy legitimacy, that a
conforming core prevents suppression, that auditability guarantees legitimacy, that
determinism guarantees semantic correctness, that structural validity proves
completeness, that a finding is a resolution, or that proposed text is already
normative.

---

## 13. Recommended next sequence

1. Record explicit owner answers to §11.
2. Approve or reject EP-2/BP-1 separately.
3. Decide C-2 through C-14, especially expected pair universe, `NO_PAIRS`, context
   blocking, canonical pair results, pair key, symmetry verification, and evidence
   validation separation.
4. Split D1/D3/D4/D5/D6 into normative, evidence, API, and runtime work.
5. Route N2/N5 to `T18-SPEC-01`.
6. Define terms used by N1–N11.
7. Finalise the EvaluationRecord contract and acceptance boundary.
8. Finalise the predicate contract and isolation limits.
9. Re-run S1–S24 against revised wording.
10. Record implications for affected requirements. **Do not change statuses without
    a separate re-audit.**

**Stop. No implementation, source changes, tests, commits, branches, or PRs.**
