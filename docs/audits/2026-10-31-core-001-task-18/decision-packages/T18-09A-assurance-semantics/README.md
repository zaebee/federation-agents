# T18-09A — Assurance Semantics Decision Package

**Status:** Supplemental evidence, alternatives and recommendations. **Neither decision is approved.**
**Repository revision:** `454af8c` (`main`, T18-02A merged).
**Task 17:** historical evidence; unchanged by this package.
**Package type:** documentation only. No source, test, specification, configuration or CI change.

## 1. Scope

This package prepares two independent normative decisions:

- **T18-DEC-06** — contradictory trusted Assessments / `AMBIG-A-4b`.
- **T18-DEC-07** — merge closure depth / `AMBIG-A-5`.

It records:

- exact normative evidence;
- current implementation behavior;
- test evidence;
- alternatives and trade-offs;
- adversarial cases;
- a reviewed recommendation for each decision;
- unresolved sub-decisions;
- dependencies and required specification work.

It does **not**:

- approve either decision;
- change Task 17 statuses or rollups;
- change the Task 18 disposition matrix, roadmap, decision register or reconciliation notes;
- change `docs/CORE-001.md`;
- change T18-02A or T18-DEC-15;
- implement a contradiction predicate or recursive closure.

## 2. Decision status

| Decision | Status | Recommendation | Approval |
| --- | --- | --- | --- |
| T18-DEC-06 | **OPEN** | Option C — explicit domain-defined contradiction predicate | Not approved |
| T18-DEC-07 | **OPEN** | Option A — immediate closure | Not approved |

The recommendations are project-owner review inputs. They are not normative resolutions and must not be cited as approved semantics.

## 3. Source hierarchy

1. Approved normative specification: `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3.
2. Approved Task 18 decisions and dispositions: `decision-register.md`, `disposition-matrix.md`, `remediation-roadmap.md`.
3. Existing implementation and tests: `src/core/assessment.ts`, `src/core/traversal.ts`, unit/conformance/property/experimental tests.
4. Interpretations and recommendations in this package.

Implementation behavior is never promoted to normative meaning. A passing test is not proof of a normative interpretation when the specification leaves that interpretation BLOCKED.

## 4. Package map

| File | Contents |
| --- | --- |
| `README.md` | Scope, status, source hierarchy, summary, invariants, validation |
| `dec-06-contradictory-assessments.md` | T18-DEC-06 evidence, options, adversarial cases, recommendation, open sub-decisions |
| `dec-07-closure-depth.md` | T18-DEC-07 evidence, options, adversarial graphs, recommendation, open sub-decisions |
| `interaction-matrix.md` | 3×3 interaction matrix and cross-decision analysis |
| `evidence-index.md` | Normative, implementation, test and Task 17 source index |

## 5. Summary of findings

### T18-DEC-06

- **Normative requirement:** §6.4 requires that two applicable trusted Assessments that contradict move the corresponding Claim to local `CONTESTED`, and forbids automatic majority voting.
- **What the specification does not define:** what “contradict” means; whether differing `verified_claims` suffice; whether `verified` vs `unverified` is contradiction; whether absence is negation; whether same/different assessors matter; whether supersession or timestamps resolve conflict; whether conflict is edge- or declaration-scoped; how `contestedClaims` is computed; how conflict interacts with missing/disallowed claims.
- **Current implementation behavior:** `assessEdge` selects by `(subject, relation, parent)` and policy-narrows; `evaluateAssurance` filters trusted Assessments and detects conflict only when `Policy.conflictPredicate` is defined. Default behavior never produces `CONTESTED`. `differingClaims` compares only `verified_claims` symmetric difference; `unverified_claims` is not read by assurance evaluation.
- **Reviewed recommendation:** Option C — keep contradiction semantics domain-defined through an explicit predicate; CORE-001 should state the obligation and require a deterministic local predicate for domains that claim support for §6.4 contradiction semantics. This is not an approval.

### T18-DEC-07

- **Normative requirement:** §8.6 requires checking all parent edges of a merge node on the selected path, including branches that do not lead to origin; a failing branch yields `ERR_MERGE_BRANCH_UNSATISFIED`.
- **What the specification does not define:** whether closure stops at direct parent edges or descends recursively into closure-only branches; whether nested merge nodes in those branches are closed; cycle handling in closure-only branches; scope interaction; failure-evidence shape.
- **Current implementation behavior:** immediate closure only. It checks every direct parent edge of a merge node on the selected path, all relations, skips only the exact path edge, checks non-origin branches, uses full graph adjacency independently of discovery scope, does not recurse, and returns a flat sorted failure list.
- **Reviewed recommendation:** Option A — immediate closure, with a depth clarification; trigger semantics remains a separate OPEN sub-decision (`DEC-07-TRIGGER`). This is not an approval.

## 6. What this package does not decide

- It does not decide whether conflict is edge-scoped or declaration/subject-scoped.
- It does not decide pre- vs post-policy-narrowing conflict detection.
- It does not define the `contestedClaims` diagnostic contract.
- It does not decide conflict vs missing/disallowed precedence (`A-8`).
- It does not decide the required capability/conformance declaration for local contradiction detection.
- It does not decide recursive or bounded closure.
- It does not decide closure trigger semantics (node property vs path-edge relation).
- It does not decide origin closure (`A-11`).
- It does not decide contested-claim decision gating (`N-079` / `T18-DEC-10`).
- It does not change `T18-DEC-15`.

## 7. Cross-cutting invariants

The package preserves:

- Evidence ≠ Finding ≠ Ruling ≠ Execution Authorization.
- External findings do not automatically bind receiving domains.
- Identity lineage does not imply authority inheritance.
- No grant-producing API in CORE-001.
- No automatic revocation semantics.
- B-5 exclusion of untrusted Assessments.
- Policy narrowing cannot reintroduce untrusted Assessments.
- Missing required verified claims remain an `UNSATISFIED` condition when conflict detection does not short-circuit assurance evaluation. Conflict-vs-missing precedence remains OPEN under `A-8`.
- DEC-06 and DEC-07 remain independent.
- T18-02A remains unchanged.
- T18-DEC-15 remains OPEN.
- A-8 and A-11 remain separate.
- N-079 / T18-DEC-10 remains separate.

No implementation or test was changed to make an invariant appear satisfied.

## 8. Task 17 and Task 18 preservation

Task 17 remains historical evidence. Its rollups and requirement statuses are unchanged:

- 152 PASS, 8 PARTIAL, 7 BLOCKED, 8 NOT COVERED, 0 FAIL.
- N-078 **BLOCKED**, N-107 **BLOCKED**, N-112 **BLOCKED**, N-172 **PARTIAL**.
- §12 B-4, B-5, B-6 and B-7 retain their existing statuses.

This package does not change:

- `docs/audits/2026-10-31-core-001-task-17/` files;
- `disposition-matrix.md`;
- `remediation-roadmap.md`;
- `decision-register.md`;
- `reconciliation-notes.md`.

## 9. Known documentation discrepancy

`docs/implementation.md:1605` still says “It does not establish C-1 or C-2.” That sentence is stale after T18-02A added a real C-1 conformance test and AEBE evidence. It is recorded here as an existing documentation discrepancy; it is not fixed by this package and it does not change the Task 17 C-1 status.

## 10. Validation

This package is documentation only. Validation for this build:

- verify repository revision and working-tree state;
- verify every cited line and symbol against `454af8c`;
- verify both decisions remain OPEN;
- verify no Task 17 or existing Task 18 artifact was modified;
- verify no CORE-001, source, test, package or CI configuration was modified;
- run `git diff --check`;
- review `git status` and the complete diff.

No tests are required for a documentation-only package. Existing test evidence is cited, not re-executed.

## 11. Next step

The project owner reviews:

1. the DEC-06 recommendation and its five unresolved sub-decisions;
2. the DEC-07 depth recommendation, the separate `DEC-07-TRIGGER` question, and the proposed clarification text;
3. the interaction matrix and invariant check.

If a decision is approved, the approval is recorded in `decision-register.md`; any normative clarification goes through `T18-SPEC-01`; implementation and tests follow separately. Neither decision is approved by this package.
