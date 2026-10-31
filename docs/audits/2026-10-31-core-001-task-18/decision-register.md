# Decision Register — Task 18

**Audit base:** `2a83c65`.
**Status of decisions:** 2 APPROVED (`T18-DEC-01`, `T18-DEC-02`); 13 OPEN at the Task 18 baseline, plus `T18-DEC-16` registered after that baseline — **14 OPEN**.

This register records the normative and boundary questions. Approved resolutions are recorded in §3; all other decisions remain OPEN.

## 1. Decision process

1. A decision is proposed with the question, normative anchor, owner and required evidence.
2. The owner records a proposed resolution and its consequences.
3. If the resolution requires a CORE-001 amendment, it goes through separately approved `T18-SPEC-01`.
4. Dependent implementation tasks remain conditional until the decision is approved.
5. Approval is recorded in this register when the project owner explicitly approves. A proposal is not an approval.

Status values: `APPROVED` (explicit project-owner approval recorded here) or `OPEN` (no approved resolution).

## 2. Decisions

| ID | Question | Normative anchor | Distinct from | Owner | Required evidence | Impact if unresolved | Blocks | Resolution | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **T18-DEC-01** | Does CORE-001 require a local Assessment recording `PARENT_UNRESOLVED` for an unresolved parent and `CYCLE_DETECTED` for a detected cycle? | §11.1, §11.2, §12 C-1/C-2 | Implementation-boundary question (`T18-DEC-02`) | spec editor | Normative reading of “локальная оценка MUST фиксировать” and “Assessment фиксирует”; whether the requirement is on the core, the domain, or both | N-138/N-143 remain NOT COVERED; C-1/C-2 cannot be judged | N-138, N-143, C-1, C-2 | `REQ-LOCAL` | **APPROVED** |
| **T18-DEC-02** | Which boundary owns Assessment construction and registration/publication, and which boundary validates the Assessment contract? | §11.1, §11.2, §6.2 | Normative requirement question (`T18-DEC-01`) | spec editor + project owner | Explicit ownership model; if core, API shape and claim derivation; if adapter, contract and boundary evidence | No implementation task is valid; AEBE cannot be produced | T18-02A, T18-02B, T18-02C | `OWN-ADAPTER` + `VAL-CORE` | **APPROVED** |
| **T18-DEC-03** | Is `validateIdentityVersionDescriptor` the semantic boundary for version-label validity? | §3.2, §6.1 | — | spec editor | Decision on structural vs semantic validation boundary; caller contract if not the descriptor validator | N-019 remains PARTIAL; no validation change is justified | N-019, T18-04 | — | OPEN |
| **T18-DEC-04** | Does §4.4.1 require `signed_at` trust before comparing `signed_at` with `compromise_effective_at`? | §4.4.1, §10.1 | **Not** the trusted-time mechanism (`T18-DEC-09`, AMBIG-A-9) | spec editor | Reading of “если compromise_effective_at установлен и принят локальной политикой” together with §10.1; whether trust is a precondition or an additional policy input; decision record and proposed wording; any amendment via T18-SPEC-01 | N-040 remains PARTIAL; current behavior is an implementation decision | N-040, T18-06 | — | OPEN |
| **T18-DEC-05** | Is digest comparison/verification a CORE-001 responsibility or a caller responsibility? | §7.2 | — | project owner | Decision on API boundary; if caller, contract plus evidence that the boundary enforces comparison and rejects mismatch | N-084 remains NOT COVERED; documentation alone is insufficient | N-084, T18-05 | — | OPEN |
| **T18-DEC-06** | What predicate defines contradiction between applicable trusted assessments? | §6.4, AMBIG-A-4b | — | spec editor | Definition of contradiction, including whether differing verified claims suffice; resolution or deferral to CORE-004 | N-078/N-107 remain BLOCKED; N-172 remains PARTIAL | N-078, N-107, N-172, T18-09A | — | OPEN |
| **T18-DEC-07** | What is the closure depth inside parent branches? | §8.6, AMBIG-A-5 | — | spec editor | Choice between immediate-only and recursive closure, with normative wording | N-112 remains BLOCKED; immediate-only remains an interpretation | N-112, T18-09A | — | OPEN |
| **T18-DEC-08** | What grammar identifies a `CONTENT_HASH` label? | §3.2, AMBIG-A-7 | — | spec editor | Label grammar and validation rule | N-020 remains BLOCKED; only non-empty is implemented | N-020, T18-09B | — | OPEN |
| **T18-DEC-09** | What is the trusted-time requirement, and which mechanism may satisfy it? | §10.1, §15.5, AMBIG-A-9 | **Not** the §4.4.1 precondition (`T18-DEC-04`) | spec editor + external owner | Normative definition of what must be trusted, under which conditions, and the interface by which an external mechanism reports trusted/untrusted/unassessed/unavailable | N-128 remains BLOCKED; external delegation is premature | N-128, T18-09C | — | OPEN |
| **T18-DEC-10** | Does CORE-001 own contested-claim decision gating, or does CORE-003/decision layer? | §6.4, §9.2 | — | CORE-003/decision-layer owner | Ownership decision; if CORE-003, the observable boundary and acceptance evidence | N-079 remains NOT COVERED; authority-boundary risk remains unassigned | N-079, T18-08 | — | OPEN |
| **T18-DEC-11** | Which specification owns the full runtime lifecycle event format? | §3.3 | — | CORE-002 owner | CORE-002 event format and CORE-001 boundary | N-026 remains PARTIAL as a CORE-002 boundary | N-026, T18-10 | — | OPEN |
| **T18-DEC-12** | Is D-2’s “Ruling” a CORE-004 object, or is Local Acceptance the intended CORE-001 object? | §12 D-2, §14.3 | — | CORE-004 owner | Cross-spec decision on Ruling vs Local Acceptance; preservation criteria | D-2 and N-156 remain BLOCKED; N-169/N-174 remain PARTIAL | N-156, D-2, N-169, N-174, T18-10 | — | OPEN |
| **T18-DEC-13** | How is grant suppression observed if grants belong to CORE-003? | §11.2, §13, §14.2 | — | CORE-003 owner | CORE-003 acceptance criteria and observable evidence | C-2.a3 remains BLOCKED; C-2 cannot close | N-145, CASE-C-2.a3, T18-10 | — | OPEN |
| **T18-DEC-14** | Who performs independent implementation compatibility, and what evidence closes §16? | §16 | — | project owner | Independent implementation/audit plan and acceptance criteria | N-170/N-175 remain NOT COVERED; readiness cannot be READY | N-170, N-175, T18-11 | — | OPEN |
| **T18-DEC-15** | Does `ContinuityAssessment.parent_version_ids` denote the full declared parent set for `(subject_version_id, declared_relation)`, or only the subset covered by the Assessment? | §6.2, §6.2.1, §5.2, §8.5, §8.6 | `T18-DEC-01` (recording obligation), `T18-DEC-02` (ownership) | spec editor | Normative reading of “оценка декларации”, the plural `parent_version_ids`, per-edge applicability in §8.5/§8.6, and the B-3 per-edge examples; proposed wording; any amendment via `T18-SPEC-01` | Option B remains a local choice; no normative claim about parent coverage; a future clarification may require adapter/validator change | Normative closure of parent-coverage semantics (not T18-02A build) | `OPTION-B-LOCAL` (non-normative local disposition) | **OPEN** |
| **T18-DEC-16** | What is the subject of an Assessment recording `CYCLE_DETECTED` — the closing edge, a node, or the strongly connected component — and what exact shape, provenance and publication/retention ownership identify the record? | §11.2, §12 C-2, §6.2.1, §6.2.2, §8.8 | `T18-DEC-01` (recording obligation, approved), `T18-DEC-02` (boundary, approved), `T18-DEC-13` (grant suppression), `T18-DEC-15` (parent coverage) | spec editor + project owner | `T18-09E` decision package; approval of 16.a/16.b (16.c may remain OPEN for recording); `T18-02B` AEBE from the adapter boundary | `T18-02B` stays BLOCKED; N-143 and CASE-C-2.a2 stay NOT COVERED; C-2 stays BLOCKED | `T18-02B` | recommend Option D — one Assessment per affected lineage edge (`T18-09E` §7); not approved | **OPEN** |

### T18-DEC-16 — C-2 subject model (registered after the Task 18 baseline, OPEN)

Registered in response to the independent audit (issue #55). The baseline register listed "C-2 subject model", "exact Assessment shape/provenance" and "publication/retention ownership" as id-less open items; this decision gives them an identifier, an owner, options and closure evidence, folded as named sub-parts:

- **16.a — subject model:** closing edge, node, or strongly connected component;
- **16.b — exact shape and provenance:** `subject_version_id`, `parent_version_ids`, `declared_relation`, claim list, method fields;
- **16.c — publication and retention ownership:** what remains OPEN under `T18-DEC-02`'s canonical scope statement.

Evidence, three candidate models, adversarial cases and a reviewed recommendation are in `decision-packages/T18-09E-c2-subject-model/`. Approval of 16.a/16.b unblocks `T18-02B`; this section approves nothing and does not change any Task 18 baseline status.

## 3. Approved decisions

### T18-DEC-01 — `REQ-LOCAL`

CORE-001 requires a local Assessment recording:

- `PARENT_UNRESOLVED` for an unresolved parent;
- `CYCLE_DETECTED` for a detected cycle.

This is an obligation to record the condition. It does not, by itself, assign construction or publication responsibility to Core. Approval is not conformance evidence and does not change Task 17 statuses.

### T18-DEC-02 — `OWN-ADAPTER` + `VAL-CORE` (Core-owned admission/representation)

- Adapter owns Assessment construction using domain-specific identity, provenance and time context.
- Core owns normative semantic validation.
- Core validation MUST be enforced on every supported registration path.
- A standalone validator that callers can bypass is insufficient.
- An old public registration API MUST NOT remain a validation bypass.
- Publication and retention remain separate responsibilities and must be explicitly assigned by the relevant boundary.
- Downstream consumption does not automatically accept the Assessment as truth or grant authority.

**Scope of approval:** DEC-02 assigns adapter **construction**, Core **semantic validation**, and Core-owned **admission** with an **immutable registered representation**. The adapter constructs candidates and initiates admission through the Core API; it must not mutate admitted state. Persistent storage is **caller-managed**. Publication and retention remain **OPEN**. This paragraph is the canonical scope statement; other documents should reference it rather than paraphrase.

### Validation enforcement

Mandatory Core validation at the registration boundary is approved. The implementation design may choose between validation inside `registerAssessment` or a guarded validated-registration API, provided the old public API cannot bypass validation. No further implementation detail is approved by this decision.

### T18-DEC-15 — parent coverage semantics (OPEN)

CORE-001 does not state whether `ContinuityAssessment.parent_version_ids` must equal the full declared parent set for `(subject_version_id, declared_relation)` or may be the subset covered by the Assessment.

T18-02A uses **Option B** — one Assessment per `(child, relation)`, with the complete declared parent set and at least one parent absent from the local graph — as a **local implementation choice/disposition**. This is not a resolution of the normative question. The question remains OPEN and requires a separate `T18-SPEC-01` clarification before either model is described as normative.

The `Resolution` column is the register's generic field name. For `T18-DEC-15` it records a non-normative local disposition, not a normative resolution.

### Still open

- C-2 Assessment subject model: SCC, node, or edge. Edge-level is a proposal only.
- Exact Assessment data shape and provenance contract.
- Persistent storage, publication and retention ownership.
- C-2 `CYCLE_DETECTED` admission policy (T18-02B; not part of T18-02A).
- Parent-coverage semantics (`T18-DEC-15`).
- C-2.a3 grant suppression and other cross-specification decisions, including CORE-003.

### Path correction

`VAL-CORE-CONSTRUCTION` is only compatible with `OWN-CORE`. It is not a valid option under `OWN-ADAPTER`. The selected path is `OWN-ADAPTER` + `VAL-CORE`.

## 4. Ambiguity mapping

Task 17 ambiguity identifiers are preserved exactly. They are not renamed and not re-scoped.

| Ambiguity | Status | Related Task 18 decision | Note |
| --- | --- | --- | --- |
| AMBIG-A-1 | OPEN (mechanism) | — | Selector grammar remains a versioned mechanism |
| AMBIG-A-2 | OPEN | — | “EXACT” binding mode remains open; B-1 PASS is based on observable result |
| AMBIG-A-3 / AMBIG-A-6 | OPEN | — | Mixed relation types |
| AMBIG-A-4a | Resolved by literal text | — | Unverified claims: no positive support, no negative finding |
| AMBIG-A-4b | BLOCKED | T18-DEC-06 | Contradiction predicate |
| AMBIG-A-5 | BLOCKED | T18-DEC-07 | Closure depth |
| AMBIG-A-7 | OPEN | T18-DEC-08 | `CONTENT_HASH` format |
| AMBIG-A-8 | OPEN | — | Aggregation beyond B-4 |
| AMBIG-A-9 | BLOCKED (external) | T18-DEC-09 | Trusted-time mechanism |
| AMBIG-A-10 | Resolved by implementation semantics | — | Scope vs closure |
| AMBIG-A-11 | BLOCKED | — | Origin closure; no Task 18 decision is created because it is not a non-PASS requirement row |
| AMBIG-A-12 | Out of scope | — | Crypto verification |

`T18-DEC-04` is a Task 18 decision about the §4.4.1 precondition. It is deliberately **not** mapped to AMBIG-A-9, which concerns the mechanism. No new Task 17 ambiguity ID is created.

## 5. Rules

- A decision is not approved because an implementation already behaves a certain way.
- A decision is not approved because a test passes.
- A decision that changes normative text requires `T18-SPEC-01` and a re-audit.
- A decision that assigns responsibility to another specification requires that specification’s owner and acceptance criteria.
- A decision that assigns responsibility to an external system requires an explicit interface and evidence expectations.
