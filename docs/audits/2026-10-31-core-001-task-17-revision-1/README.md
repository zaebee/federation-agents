# CORE-001 Task 17 — Audit Revision 1

**Revision of:** the Task 17 conformance audit at `9c38bbd` ([`../2026-10-31-core-001-task-17/`](../2026-10-31-core-001-task-17/)).
**Evaluated at:** commit `1440ca4`.
**Status:** revision 1. Task 17 artifacts are frozen and are **not** edited; this document supersedes their statuses only where listed below.
**Scope:** two corrections that changed meaning after the Task 17 snapshot — §8.8 contained an uninventoried `MUST NOT` (#53 item 1), and C-1's evidence postdates the audit (T18-02A, #41). Reviewing Category C also resolves two rows that were left NOT COVERED: **N-143** (records `CYCLE_DETECTED`) and **N-168** (§16 "all Category C tests pass") move NOT COVERED → BLOCKED — in both cases **because C-2 is blocked**, not because C-1 changed. They are named here because they feed the rollups in §4.
**Out of scope:** the C-2 **case verdict** (it stays BLOCKED; N-143/N-168 move only because C-2 is blocked), the D-1, D-2 and D-4 statuses, every other requirement ID, and source, tests, specification, lockfile and configuration. No code, test or spec change was made to produce this revision.

---

## 1. Method

1. Re-read §8.8, §11.1, §11.2 and §12 C-1 in `docs/CORE-001.md`.
2. Re-derived the evidence from the tree at `1440ca4`, not from Task 18 conclusions.
3. Applied the Task 17 legend unchanged: `Impl` ∈ PRESENT / PARTIAL / ABSENT / EXTERNAL / N/A, `Verif` ∈ EVIDENCED / PARTIAL / NONE, `Status` ∈ PASS / FAIL / PARTIAL / BLOCKED / NOT COVERED.
4. Left Task 17 files untouched; every changed status is recorded here.

---

## 2. Requirement correction — N-176 (§8.8 non-enumeration)

§8.8 ends with two sentences the Task 17 inventory does not contain:

> Реализация MAY использовать мемоизацию, динамическое программирование и другие методы оптимизации.
> Она **MUST NOT требовать явного перечисления всех возможных путей**, если результат может быть вычислен эквивалентным способом.

Addition to the requirement matrix (same columns as Task 17):

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-176 | §8.8 | An implementation MUST NOT require explicit enumeration of all possible paths when the result can be computed equivalently | MUST NOT | CORE-001 | `discoverPaths` materialises every simple candidate→origin path into a frozen `Path` array and `evaluateBinding` validates each one; the public per-path result exposes them | PRESENT (enumerating) | C: `traversal.ts:307` (`collectPaths`), `traversal.ts:361` (`discoverPaths`), `traversal.ts:902` (`evaluateBinding`); measurement: a chain of `k` merge diamonds yields `2^k` paths (`k=16` → 65 536 paths / 2.7 s); T: none asserts this `MUST NOT` | NONE | PARTIAL |

**Effect on §8.8.** N-115…N-117 (determinism, non-dependence on storage/arrival order, cycle-as-structural-conflict) remain PASS. The §8.8 aggregate status changes **PASS → PARTIAL**: the determinism half is evidenced, the non-enumeration half is not satisfied on the literal reading.

**Why PARTIAL and not FAIL.** The clause is conditional ("если результат может быть вычислен эквивалентным способом"). Whether the public per-path result makes enumeration part of the required result is exactly the open question tracked in #25 / `T18-SPEC-01`; the specification does not settle it. The audit therefore records an incomplete requirement, not a demonstrated violation. This keeps the Task 17 rule intact: a `MUST NOT` that cannot be adjudicated from the text is not silently resolved in either direction.

**Cross-reference:** #25 (bounded or non-enumerating traversal) now carries the conformance side of the same question.

---

## 3. C-1 re-audit

§12 C-1 ([`CORE-001.md`](../../CORE-001.md) §12) requires: the descriptor is preserved; an Assessment records `PARENT_UNRESOLVED`; the declaration is not deleted or rewritten.

| Assertion | Evidence at `1440ca4` | Status |
| --- | --- | --- |
| `CASE-C-1.a1` descriptor preserved | `tests/conformance/c.test.ts:38` asserts the graph JSON is byte-identical after emission; `tests/unit/lineage-graph.test.ts:144` keeps the orphan in `nodes` across rebuilds | PASS |
| `CASE-C-1.a2` parent link preserved | `tests/conformance/c.test.ts:38` asserts `unresolvedParents` is `[['iv-d', ['iv-b']]]`; `lineage-graph.test.ts:144` keeps the edge | PASS |
| `CASE-C-1.a3` Assessment records `PARENT_UNRESOLVED` | `src/adapters/orphan-assessment.ts:109` (`emitOrphanAssessment`) constructs the candidate through `src/core/assessment.ts:804` (`registerOrphanAssessments`, which validates generically and contextually then admits); `tests/conformance/c.test.ts:38` asserts the registered Assessment carries `unverified_claims: ['PARENT_UNRESOLVED']` and the complete declared parent set, and that the registered array is frozen | PASS |
| `CASE-C-1.a4` declaration not deleted or rewritten | `tests/conformance/c.test.ts:38` (graph bytes unchanged); `c.test.ts:54` (a resolved parent produces no Assessment and no unresolved entry) | PASS |

**Case status: PASS.** The boundary is the one Task 18 approved: `T18-DEC-01` (`REQ-LOCAL`) makes the recording a normative obligation, and `T18-DEC-02` (`OWN-ADAPTER` + `VAL-CORE`) assigns construction to the adapter and validation/admission to Core. That is what the evidence shows; the adapter is explicitly not a protocol API, which is a boundary statement, not a gap in the case.

**Named limits, so the PASS is not read as broader than it is:**

- **Retention and publication** of the Assessment remain caller-managed; the publication-ownership question is OPEN and `T18-DEC-15` (parent-coverage semantics) is OPEN. §12 C-1's Expected Result does not require storage, so this does not block the case — but the evidence covers construction and admission, not persistence.
- **The C-2 case verdict is untouched.** C-1 PASS does not imply that an Assessment records `CYCLE_DETECTED`; that case remains BLOCKED on the C-2 subject model and CORE-003 grant suppression. **N-143** and **N-168** move NOT COVERED → BLOCKED for one reason only: **C-2 is blocked**, which makes them unsatisfiable. C-1 PASS is not their trigger, and C-2 was not re-audited.
- **N-143** (Assessment records `CYCLE_DETECTED`) is not closed by this revision: NOT COVERED → **BLOCKED**. **N-168** (§16 "all Category C tests pass") likewise NOT COVERED → **BLOCKED**, because C-2 cannot pass. **N-138** (Assessment records `PARENT_UNRESOLVED`) NOT COVERED → **PASS**.

---

## 4. Status changes and rollups

| ID | Before | After | Basis |
| --- | --- | --- | --- |
| N-138 | NOT COVERED | **PASS** | §3, `c.test.ts:38` |
| N-143 | NOT COVERED | **BLOCKED** | C-2 remains blocked, so the recording obligation cannot be satisfied; the claim is also inadmissible at admission (`docs/implementation.md` §2.11, `validateContinuityAssessment` claim-legality bullet; §4.4 "Why C-2 remains open") |
| N-168 | NOT COVERED | **BLOCKED** | readiness depends on all Category C cases, and C-2 is blocked |
| N-176 | — (new) | **PARTIAL** | §2 |
| §8.8 aggregate | PASS | **PARTIAL** | §2 |

Rollups (Task 17 baseline → revision 1):

| Rollup | PASS | PARTIAL | BLOCKED | NOT COVERED | Total |
| --- | --- | --- | --- | --- | --- |
| CORE-001 runtime conformance | 138 → **139** | 4 → **5** | 4 → **5** | 5 → **3** | 151 → **152** |
| Cross-spec and external boundaries | 10 → **10** | 1 → **1** | 3 → **3** | 0 → **0** | 14 → **14** |
| §16 readiness | 4 → **4** | 3 → **3** | 0 → **1** | 3 → **2** | 10 → **10** |
| **All requirements** | 152 → **153** | 8 → **9** | 7 → **9** | 8 → **5** | 175 → **176** |

§12 corpus: **14 PASS, 2 PARTIAL (D-1, D-4), 2 BLOCKED (C-2, D-2), 0 NOT COVERED** (18 cases).

**Readiness label: `NOT_READY` — unchanged.** C-2 and D-2 are blocked, D-1/D-4 are partial, and §16 independent-implementation evidence is absent.

---

## 5. What this revision does not establish

- Full §12 conformance: C-2 is BLOCKED and D-2 is BLOCKED; D-1 and D-4 remain PARTIAL.
- That the enumeration `MUST NOT` is satisfied: it is PARTIAL pending the §8.8 reading (#25 / `T18-SPEC-01`).
- Any change to the C-2 subject model, grant suppression, trusted time, recursive closure or origin closure.
- Any §16 evidence: no independent implementation has been compared.
- Any re-interpretation of Task 17 requirements that are not listed in §4. The Task 17 files remain the historical baseline.

---

## 6. Traceability

- Issue: #53 (this revision), #25 (path enumeration — the conformance side), #55 (C-2 decision ID).
- Prior audit: `docs/audits/2026-10-31-core-001-task-17/` (frozen).
- Disposition: `docs/audits/2026-10-31-core-001-task-18/` (`T18-DEC-01`, `T18-DEC-02`, `T18-DEC-15`).
- Implementation evidence: #41 (`T18-02A`), `docs/audits/2026-10-31-core-001-task-18/aebe/C-1.md`.
- Status entry point: [`STATUS.md`](../../../STATUS.md).
