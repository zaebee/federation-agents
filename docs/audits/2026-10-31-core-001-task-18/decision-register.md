# Decision Register — Task 18

**Audit base:** `2a83c65`.
**Status of decisions:** 4 APPROVED (`T18-DEC-01`, `T18-DEC-02`, `T18-DEC-16`, `T18-DEC-17`); 13 OPEN at the Task 18 baseline, with no post-baseline decision left OPEN — **13 OPEN**.

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
| **T18-DEC-16** | What is the subject of an Assessment recording `CYCLE_DETECTED` — the closing edge, a node, or the strongly connected component — and what exact Assessment shape and provenance identify the record? | §11.2, §12 C-2, §6.2.1, §6.2.2, §8.8 | Related, not blockers: `T18-DEC-01`/`02` (approved), `T18-DEC-13` (C-2.a3, after recording), `T18-DEC-15` (parent coverage, OPEN), `T18-DEC-17` (publication/retention, approved) | spec editor + project owner | `T18-09E` decision package; approval of the subject model and shape; `T18-02B` AEBE from the adapter boundary | None — approved; `T18-02B` is eligible | `T18-02B` | **Option D** — one Assessment per affected lineage edge; adapter constructs, Core validates/admits, caller persists (canonical record in §3) | **APPROVED** |
| **T18-DEC-17** | Who owns publication and retention of an Assessment, and what does that require for the C-2 evidence? | §6.2, §11.1, §11.2, §12 C-1/C-2 | Related, not blockers: `T18-DEC-02` (canonical scope: storage caller-managed, publication/retention OPEN), `T18-DEC-16` (recording shape, approved) | spec editor + project owner | `T18-09E` decision package §7.7; boundary statement for storage, publication and retention; AEBE statement of what is persisted | None — approved; publication/retention claims now have an owner | readiness/publication claims (`T18-13`, `T18-11`), not `T18-02B` | **Caller boundary** owns persistence, publication and retention; Core ends at the immutable admitted representation (canonical record in §3) | **APPROVED** |

*Column semantics:* **`Distinct from` lists related decisions, not approval prerequisites.** Only **`Blocks`** names what a decision's approval gates — for `T18-DEC-16` that is `T18-02B` only; `T18-DEC-13`, `T18-DEC-15` and `T18-DEC-17` are related questions and do not have to be resolved first.

### T18-DEC-16 — C-2 subject model and Assessment shape/provenance (registered after the baseline, APPROVED)

Registered in response to the independent audit (issue #55) and **approved on 2026-10-31**. Evidence, candidate models, adversarial cases and the analysis are in `decision-packages/T18-09E-c2-subject-model/`; the canonical resolution is §3.

The approved model is **Option D** — one Assessment per affected lineage edge inside a cyclic SCC. Approval permits the local implementation only: it does not make the subset reading of `parent_version_ids` normative (`T18-DEC-15` remains OPEN), and it unblocks `T18-02B` with no other decision as a prerequisite.

### T18-DEC-17 — publication and retention ownership (registered after the baseline, APPROVED)

Split out of the original `T18-DEC-16` draft because the register has one status per decision and `T18-02B` must not wait for a storage decision. **Approved on 2026-10-31**; canonical resolution is §3.

Publication and retention are assigned to the caller boundary; the Core contract ends at the immutable admitted representation. This decision does not block recording and does not change `T18-DEC-16`.

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
- Publication and retention remain separate responsibilities and must be explicitly assigned by the relevant boundary (assigned by `T18-DEC-17`, approved 2026-10-31).
- Downstream consumption does not automatically accept the Assessment as truth or grant authority.

**Scope of approval:** DEC-02 assigns adapter **construction**, Core **semantic validation**, and Core-owned **admission** with an **immutable registered representation**. The adapter constructs candidates and initiates admission through the Core API; it must not mutate admitted state. Persistent storage is **caller-managed**. Publication and retention remained **OPEN at the time of this approval**; `T18-DEC-17` (approved 2026-10-31) subsequently assigned them to the caller boundary. This paragraph is the canonical scope statement; other documents should reference it rather than paraphrase.

### Validation enforcement

Mandatory Core validation at the registration boundary is approved. The implementation design may choose between validation inside `registerAssessment` or a guarded validated-registration API, provided the old public API cannot bypass validation. No further implementation detail is approved by this decision.

### T18-DEC-16 — C-2 subject model and Assessment shape/provenance (APPROVED, 2026-10-31)

- One Assessment per **affected lineage edge** inside a cyclic SCC: `subject_version_id` = child of the edge; `declared_relation` = relation of the edge; `parent_version_ids` = `[parent of the edge]`.
- `CYCLE_DETECTED` is recorded in `unverified_claims` (the conservative polarity).
- Provenance follows `T18-DEC-02`: the adapter constructs the Assessment; Core performs contextual validation and admission; the registered representation is immutable; persistent storage is caller-managed.

**Scope of approval:** permits the local Option D implementation. It does **not** make the subset reading of `parent_version_ids` normative — `T18-DEC-15` remains OPEN and may impose a different rule. It blocks only `T18-02B`; it does not close N-143/CASE-C-2.a2 until `T18-02B` + AEBE, and does not close the C-2 case (`CASE-C-2.a3` is CORE-003 / `T18-DEC-13`).

**Approval record:** project owner, 2026-10-31; the decision comment is in [issue #55](https://github.com/zaebee/federation-agents/issues/55#issuecomment-6547324593), and the record was merged in PR #69.

### T18-DEC-17 — publication and retention ownership (APPROVED, 2026-10-31)

- The **caller boundary** owns persistence, publication and retention of an Assessment.
- The Core contract ends at the immutable admitted representation; Core does not become a storage service.
- Any claim that a record is *published* or *retained* requires caller-side evidence; the AEBE states what was persisted.

**Scope of approval:** consistent with `T18-DEC-02`'s canonical scope (persistent storage caller-managed). It does not gate `T18-02B` and does not change `T18-DEC-16`.

**Approval record:** project owner, 2026-10-31; the decision comment is in [issue #55](https://github.com/zaebee/federation-agents/issues/55#issuecomment-6547324593), and the record was merged in PR #69.

### T18-DEC-15 — parent coverage semantics (OPEN)

CORE-001 does not state whether `ContinuityAssessment.parent_version_ids` must equal the full declared parent set for `(subject_version_id, declared_relation)` or may be the subset covered by the Assessment.

T18-02A uses **Option B** — one Assessment per `(child, relation)`, with the complete declared parent set and at least one parent absent from the local graph — as a **local implementation choice/disposition**. This is not a resolution of the normative question. The question remains OPEN and requires a separate `T18-SPEC-01` clarification before either model is described as normative.

The `Resolution` column is the register's generic field name. For `T18-DEC-15` it records a non-normative local disposition, not a normative resolution.

### Still open

No post-baseline decision remains OPEN: `T18-DEC-16` and `T18-DEC-17` are approved (see §3). The remaining open items are:

- C-2 `CYCLE_DETECTED` admission policy (T18-02B implementation; not part of T18-02A) — unblocked by the `T18-DEC-16` approval.
- Parent-coverage semantics (`T18-DEC-15`) — remains OPEN; the `T18-DEC-16` approval does not resolve it.
- C-2.a3 grant suppression and other cross-specification decisions, including CORE-003 (`T18-DEC-13`).

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
