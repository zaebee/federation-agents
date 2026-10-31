# T18-09E — C-2 Subject Model Decision Package

**Status:** supplemental evidence, alternatives and the analysis behind an approved decision. **`T18-DEC-16` and `T18-DEC-17` were approved on 2026-10-31**; the canonical record is `decision-register.md` §3. This package remains the evidence and analysis, not the approval record.
**Repository revision:** `2d26d43` (`main`, Task 17 audit revision 1 merged).
**Task 17 / Task 18:** historical evidence; this package fills a gap in the Task 18 decision register and does not rewrite any prior finding.
**Package type:** documentation only. No source, test, specification, configuration or CI change.

## 1. Scope

This package prepares **two decisions**:

| Decision | Question |
| --- | --- |
| **`T18-DEC-16` — C-2 subject model and Assessment shape/provenance** | What is the subject of an Assessment that records `CYCLE_DETECTED` (closing edge, node, or strongly connected component), and which `subject_version_id`, `parent_version_ids`, `declared_relation`, claim list, evidence references and method fields identify that record? |
| **`T18-DEC-17` — publication and retention ownership** | Who owns persistence, publication and retention of the Assessment, given the approved `T18-DEC-02` scope statement? |

The original draft folded these into one decision with sub-parts 16.a/16.b/16.c. The register has a single status per decision (`APPROVED` or `OPEN`), so a partial approval cannot be expressed; the split keeps "16.a/16.b approved → `T18-02B` unblocked" and "publication/retention still OPEN" representable. `T18-DEC-02` already assigns construction (adapter) and validation/admission (Core) and leaves persistent storage caller-managed; `T18-DEC-17` (approved 2026-10-31) assigns the remaining publication/retention question to the caller boundary.

It records:

- exact normative evidence from `docs/CORE-001.md`;
- current implementation behaviour and where it must change;
- candidate subject models with trade-offs and adversarial cases;
- a reviewed recommendation and its open sub-decisions;
- the evidence that would close `T18-DEC-16` and unblock `T18-02B`, and what `T18-DEC-17` must decide before any publication/retention claim.

It does **not**:

- itself approve any decision — the owner approval is recorded in `decision-register.md` §3; `T18-DEC-13` and `T18-DEC-15` remain OPEN;
- change Task 17 statuses or rollups, `docs/CORE-001.md`, or the Task 18 disposition matrix;
- implement or pre-approve `T18-02B`;
- resolve the A-14 cycle-breadth question in path validation (#65) — the subject model here is graph-level recording, not binding-level rejection.

## 2. Decision status

| Decision | Status | Recommendation | Approval |
| --- | --- | --- | --- |
| `T18-DEC-16` — C-2 subject model and Assessment shape/provenance | **APPROVED** | Option D — one Assessment per affected lineage edge | Approved 2026-10-31 (`decision-register.md` §3) |
| `T18-DEC-17` — publication and retention ownership | **APPROVED** | caller-managed storage stands; publication/retention assigned to the caller boundary (see §7.7) | Approved 2026-10-31 (`decision-register.md` §3) |

The recommendations became the approved resolution on 2026-10-31; the register §3 is the normative record. Approving `T18-DEC-16` permits the local Option D implementation; it does not make the subset reading of `parent_version_ids` normative, because `T18-DEC-15` stays OPEN.

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
| `c2-subject-model.md` | Normative and implementation evidence, models A/B/C/D, adversarial cases, interaction with approved decisions, recommendation, open sub-decisions, closure evidence |
| `evidence-index.md` | Normative, implementation, test, Task 17/18 source index |

## 5. Summary

- **Normative requirement.** `T18-DEC-01` approved the reading that CORE-001 requires a local Assessment recording `CYCLE_DETECTED` for a detected cycle (§11.2, §12 C-2). `T18-DEC-02` approved the boundary: adapter constructs, Core validates and admits, persistent storage is caller-managed. What the specification does **not** say is what the Assessment's subject is — the closing declaration, the node, or the component — nor what `parent_version_ids` and `declared_relation` mean for a cycle.
- **Current implementation.** The graph reports sorted SCCs; binding-level traversal returns `CYCLE_DETECTED` per path with the union of touched cycles. No Assessment records the claim (`tests/conformance/c.test.ts:66` is a `todo`). Since the #49 change, the generic validator rejects `CYCLE_DETECTED` on every admission path while C-2 is blocked (`src/core/assessment.ts:60`).
- **Why `T18-02B` was blocked and is now implemented.** It needed (i) `T18-DEC-16` approved — done 2026-10-31 — and (ii) a contextual admission path for the cycle claim, mirroring the C-1 `registerOrphanAssessments` path. Both are done: T18-02B implements Option D and records AEBE (`aebe/C-2.a2.md`); the generic path still rejects the claim, which is admitted only through `registerCycleAssessments`. C-2 remains BLOCKED on `CASE-C-2.a3`.
- **Approved resolution (2026-10-31).** Option D — one Assessment per affected lineage edge inside a cyclic SCC. It adopts the T18-01 package's recommendation rather than replacing it, reuses the approved C-1 adapter/Core boundary, needs no schema change, is deterministic by sorted edge order, and gives CORE-003 the exact participating-edge set it needs for grant suppression (`CASE-C-2.a3`, `T18-DEC-13`).
- **What the approval closes and does not close.** `T18-DEC-16` approval unblocks `T18-02B`; together with its implementation and AEBE it closes `N-143` and `CASE-C-2.a2`. The C-2 **case** remains BLOCKED on `CASE-C-2.a3` (CORE-003, `T18-DEC-13`). `T18-DEC-17` is approved independently and governs claims that the assessment is published or retained.
