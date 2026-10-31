# T18-09E — C-2 Subject Model Decision Package

**Status:** supplemental evidence, alternatives and a recommendation. **`T18-DEC-16` is OPEN and not approved.**
**Repository revision:** `2d26d43` (`main`, Task 17 audit revision 1 merged).
**Task 17 / Task 18:** historical evidence; this package fills a gap in the Task 18 decision register and does not rewrite any prior finding.
**Package type:** documentation only. No source, test, specification, configuration or CI change.

## 1. Scope

This package prepares **one decision with three named sub-parts** — `T18-DEC-16`:

| Sub-part | Question |
| --- | --- |
| **16.a — subject model** | What is the subject of an Assessment that records `CYCLE_DETECTED`: the closing edge, the node, or the strongly connected component? |
| **16.b — exact Assessment shape and provenance** | Which `subject_version_id`, `parent_version_ids`, `declared_relation`, claim list, evidence references and method fields identify that record, and which boundary constructs it? |
| **16.c — publication and retention ownership** | Who owns persistence, publication and retention of the cycle Assessment, given the approved `T18-DEC-02` scope statement? |

The three are folded into one decision because they share one boundary: the answer to 16.a fixes the shape in 16.b, and 16.b is only publishable where 16.c says records live. `T18-DEC-02` already assigns construction (adapter) and validation/admission (Core) and leaves persistent storage caller-managed; 16.c asks only what remains OPEN there — publication and retention.

It records:

- exact normative evidence from `docs/CORE-001.md`;
- current implementation behaviour and where it must change;
- three candidate subject models with trade-offs and adversarial cases;
- a reviewed recommendation and its open sub-decisions;
- the evidence that would close `T18-DEC-16` and unblock `T18-02B`.

It does **not**:

- approve `T18-DEC-16`, `T18-DEC-13` or `T18-DEC-15`;
- change Task 17 statuses or rollups, `docs/CORE-001.md`, or the Task 18 disposition matrix;
- implement or pre-approve `T18-02B`;
- resolve the A-14 cycle-breadth question in path validation (#65) — the subject model here is graph-level recording, not binding-level rejection.

## 2. Decision status

| Decision | Status | Recommendation | Approval |
| --- | --- | --- | --- |
| `T18-DEC-16` — C-2 subject model, shape/provenance, publication/retention | **OPEN** | Option D — one Assessment per affected lineage edge | Not approved |

The recommendation is a project-owner review input, not a normative resolution. It must not be cited as approved semantics.

## 3. Source hierarchy

1. Approved normative specification: `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3.
2. Approved Task 18 decisions and dispositions: `decision-register.md` (`T18-DEC-01`/`02` approved), `disposition-matrix.md`, `remediation-roadmap.md`.
3. Existing implementation and tests at `2d26d43`.
4. Interpretations and recommendations in this package.

Implementation behaviour is never promoted to normative meaning. The fact that the current binding-level traversal reports `CYCLE_DETECTED` does not answer what an Assessment must record.

## 4. Package map

| File | Contents |
| --- | --- |
| `README.md` | Scope, status, source hierarchy, decision status, package map, summary |
| `c2-subject-model.md` | Normative and implementation evidence, models A/B/C, adversarial cases, interaction with approved decisions, recommendation, open sub-decisions, closure evidence |
| `evidence-index.md` | Normative, implementation, test, Task 17/18 source index |

## 5. Summary

- **Normative requirement.** `T18-DEC-01` approved the reading that CORE-001 requires a local Assessment recording `CYCLE_DETECTED` for a detected cycle (§11.2, §12 C-2). `T18-DEC-02` approved the boundary: adapter constructs, Core validates and admits, persistent storage is caller-managed. What the specification does **not** say is what the Assessment's subject is — the closing declaration, the node, or the component — nor what `parent_version_ids` and `declared_relation` mean for a cycle.
- **Current implementation.** The graph reports sorted SCCs; binding-level traversal returns `CYCLE_DETECTED` per path with the union of touched cycles. No Assessment records the claim (`tests/conformance/c.test.ts:66` is a `todo`). Since the #49 change, the generic validator rejects `CYCLE_DETECTED` on every admission path while C-2 is blocked (`src/core/assessment.ts:60`).
- **Why `T18-02B` is blocked.** It needs (i) this decision, and (ii) a contextual admission path for the cycle claim, mirroring the C-1 `registerOrphanAssessments` path — the current generic guard is correct for the generic path but cannot stay absolute once C-2 is decided.
- **Recommendation.** Option D — one Assessment per affected lineage edge inside a cyclic SCC. It adopts the T18-01 package's recommendation rather than replacing it, reuses the approved C-1 adapter/Core boundary, needs no schema change, is deterministic by sorted edge order, and gives CORE-003 the exact participating-edge set it needs for grant suppression (`CASE-C-2.a3`, `T18-DEC-13`).
- **What approval would close.** `N-143` and `CASE-C-2.a2` after `T18-02B` + AEBE; the C-2 **case** remains BLOCKED on `CASE-C-2.a3` (CORE-003, `T18-DEC-13`) even after this decision.
