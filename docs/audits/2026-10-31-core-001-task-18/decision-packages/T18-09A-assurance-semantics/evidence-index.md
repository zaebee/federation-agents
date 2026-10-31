# T18-09A — Evidence Index

**Revision:** `454af8c` (`main`, T18-02A merged).
**Purpose:** Trace every material conclusion in this package to a normative section, implementation symbol, test, or Task 17 row.
**Status:** Both decisions remain **OPEN**.

## 1. Labeling convention

Statements in this package use these labels:

| Label | Meaning |
| --- | --- |
| **Normative requirement** | Required by `docs/CORE-001.md`; line range cited |
| **Current implementation behavior** | What the code at `454af8c` does; symbol and line range cited |
| **Test evidence** | A test that proves the stated behavior; exact test name and line cited |
| **Interpretation** | A reading of the normative text; not approved |
| **Recommendation** | A project-owner input; not approved |
| **OPEN question** | The specification does not determine the answer |

Implementation behavior is not normative meaning. A passing test is not proof of a normative interpretation when the specification leaves that interpretation BLOCKED.

## 2. Normative sources

| Source | Line range | Used for |
| --- | --- | --- |
| §6.2 Assessment | `docs/CORE-001.md:538-544` | Assessment is a local, immutable evaluation of a declaration; different domains may differ; no automatic acceptance |
| §6.2.1 ContinuityAssessment | `docs/CORE-001.md:546-576` | Record shape: `assessment_id`, `supersedes_assessment_id`, subject, parents, relation, profile/method, claims, evidence, assessor, time |
| §6.2.2 Claim semantics | `docs/CORE-001.md:578-596` | `verified_claims` vs `unverified_claims`; absence is not confirmation; claims are identifiers; example claim set |
| §6.2.3 Reproducibility | `docs/CORE-001.md:598-606` | Profile and method version identify the evaluation method |
| §6.2.4 Evidence refs | `docs/CORE-001.md:608-614` | Evidence references do not establish truth or sufficiency; CORE-004 owns evidence semantics |
| §6.3 Supersession | `docs/CORE-001.md:616-633` | One predecessor, no cycles, old record preserved, no automatic rewrite, local policy selects applicable assessment, newest not automatically authoritative |
| §6.4 Conflicting assessors | `docs/CORE-001.md:635-661` | Trusted assessors, required/disallowed claims, no majority vote, `CONTESTED`, dependent decisions, untrusted priority rule |
| §8.5 Path validation | `docs/CORE-001.md:794-804` | Per-edge conditions, including no unresolved conflict; absence is not success |
| §8.6 Merge closure | `docs/CORE-001.md:806-824` | All parent edges of a merge node on the path; all branches, including non-origin; per-edge assessment; `ERR_MERGE_BRANCH_UNSATISFIED` |
| §8.7 Diamond lineage | `docs/CORE-001.md:826-846` | Independent paths; per-merge-node parent-edge checks; one fully valid path suffices |
| §8.8 Determinism | `docs/CORE-001.md:848-870` | Same input set → same result; no order dependence; cycles as structural conflict |
| §12 A-5 Valid Merge | `docs/CORE-001.md:1179-1190` | Structural MERGED_FROM case; **not** closure depth |
| §12 B-3 Diamond | `docs/CORE-001.md:1253-1292` | Direct branch assessments in a diamond |
| §12 B-4 Merge closure failure | `docs/CORE-001.md:1294-1315` | Direct branch failure → closure code |
| §12 B-5 Trusted/untrusted | `docs/CORE-001.md:1317-1335` | Untrusted positive assessment does not override trusted refusal |
| §12 B-6 Non-origin branch | `docs/CORE-001.md:1337-1365` | Non-origin direct branch checked; deeper edge not specified |
| §12 B-7 Arrival order | `docs/CORE-001.md:1367-1386` | Delivery order does not change result |

## 3. Implementation symbols

### 3.1 Assessment

| Symbol | File:lines | Relevance |
| --- | --- | --- |
| `appliesToEdge` | `src/core/assessment.ts:310-316` | Edge applicability: subject, relation, parent membership |
| `assessEdge` | `src/core/assessment.ts:335-373` | Deep copy, duplicate-ID rejection, applicability filter, sort, policy narrowing, freeze, brand |
| `narrowByPolicy` | `src/core/assessment.ts:380-398` | Policy can only select core IDs; cannot inject altered or untrusted Assessments |
| `trustedAssessors` | `src/core/assessment.ts:400-402` | `trusted_assessors ?? trustedAssessorDefault ?? []`; empty trusts none |
| `differingClaims` | `src/core/assessment.ts:404-423` | Symmetric difference of `verified_claims`; ignores `unverified_claims` |
| `collectContestedClaims` | `src/core/assessment.ts:431-452` | Pairwise predicate over trusted Assessments; union of differing verified claims |
| `evaluateAssurance` | `src/core/assessment.ts:459-504` | Brand check, trust filter, conflict check, verified union, missing/disallowed |
| Conflict block | `src/core/assessment.ts:475-480` | Only explicit `Policy.conflictPredicate` can produce `CONTESTED` |
| Verified union | `src/core/assessment.ts:482-487` | Only `verified_claims` contribute |
| Missing/disallowed | `src/core/assessment.ts:489-491` | `required_claims` and `disallowed_claims` |
| `registerAssessment` | `src/core/assessment.ts:721-734` | Copy-on-write, validation, context-required rejection; supersession history preserved |

### 3.2 Traversal

| Symbol | File:lines | Relevance |
| --- | --- | --- |
| `evaluateEdgeAssurance` | `src/core/traversal.ts:391-427` | Shared Phase 2/3 edge evaluation; maps `CONTESTED` |
| `validatePath` | `src/core/traversal.ts:460-469` | Public Phase 2 entry |
| `validatePathWithIndex` | `src/core/traversal.ts:471-526` | Per-edge path validation; returns `CONTESTED` for a contested edge |
| `directParentBranches` | `src/core/traversal.ts:527-540` | Full adjacency; all relations; dedupe/sort |
| `evaluateClosureBranch` | `src/core/traversal.ts:541-574` | Branch assurance; missing/unsatisfied/contested reasons |
| `collectBranchFailure` | `src/core/traversal.ts:580-605` | Skips exact path edge; dedupes failures |
| `collectEdgeClosureFailures` | `src/core/traversal.ts:607-628` | Triggers closure when a direct `MERGED_FROM` branch exists; checks all direct branches |
| `collectClosureFailures` | `src/core/traversal.ts:630-648` | Loops path edges only; no recursion |
| `closureResult` | `src/core/traversal.ts:650-667` | Flat sorted failure list |
| `validateMergeClosure` | `src/core/traversal.ts:674-692` | Immediate-only Phase 3 |
| `evaluateOnePath` | `src/core/traversal.ts:709-731` | Closure only after a VALID path |
| `summarizePaths` | `src/core/traversal.ts:759-795` | Aggregation: accepted path → closure → cycle → contested → assurance |

### 3.3 Implementation documentation

| Source | Line | Relevance |
| --- | --- | --- |
| `docs/implementation.md:724` | `unverified_claims` not read by assurance evaluation |
| `docs/implementation.md:730` | No latest-wins; predecessor stays applicable |
| `docs/implementation.md:1432` | Aggregation is not a normative precedence table; A-8 OPEN |
| `docs/implementation.md:1440-1447` | Scope governs discovery only; closure is scope-independent |
| `docs/implementation.md:1451-1453` | Immediate closure only; recursive closure BLOCKED (A-5) |
| `docs/implementation.md:1468` | A-11 origin closure separate |
| `docs/implementation.md:1556` | P7 oracle reuses implementation; immediate-only; DAGs ≤ 7 |
| `docs/implementation.md:1605` | Stale C-1/C-2 sentence after T18-02A (reported discrepancy) |
| `docs/implementation.md:1630-1631` | `ID-T10` immediate closure and aggregation order |
| `docs/implementation.md:1655-1656` | A-4b and A-5 BLOCKED descriptions |
| `docs/implementation.md:1659` | A-8 OPEN |
| `docs/implementation.md:1662` | A-11 BLOCKED |
| `docs/implementation.md:1667-1668` | Semantics that remain BLOCKED |
| `docs/implementation.md:1761-1783` | Proposed A-4b/A-5 clarifications |
| `docs/implementation.md:1785` | A-11 proposed clarification |

## 4. Test inventory

### 4.1 DEC-06 tests

| Test | File:line | What it proves | Limit |
| --- | --- | --- | --- |
| `default configuration never yields CONTESTED` | `tests/unit/assessment.test.ts:457` | No default conflict detection; differing verified claims are independent | Does not define what contradiction should be |
| `an explicit predicate is the only source of CONTESTED` | `tests/unit/assessment.test.ts:472` | Explicit predicate produces `CONTESTED`; `contestedClaims` is verified-set difference | Predicate is arbitrary; not normative |
| `a false predicate leaves the result uncontested` | `tests/unit/assessment.test.ts:486` | Predicate false → no conflict | No semantic definition |
| `an explicit predicate may declare conflict with no differing claims` | `tests/unit/assessment.test.ts:497` | `contestedClaims` can be empty; diagnostic is not the predicate reason | Diagnostic limitation |
| `untrusted assessments never create CONTESTED` | `tests/unit/assessment.test.ts:441` | Trust filter precedes conflict | B-5 scope only |
| `B-5 untrusted positive assessment cannot substitute for the trusted auditor` | `tests/conformance/b.test.ts:192` | Untrusted positive assessment does not override trusted refusal | Not a contradiction predicate |
| `B-5 adversarial policy hook cannot promote the untrusted assessment` | `tests/conformance/b.test.ts:203` | Policy narrowing cannot reintroduce untrusted | Not a conflict-scope rule |
| `B-7 all assessment arrival permutations produce the same result` | `tests/conformance/b.test.ts:253` | Order independence | Three-assessment set only |
| `aggregates mixed CONTESTED and INVALID paths as CONTESTED with all outcomes` | `tests/unit/traversal-phases.test.ts:472` | Path-level contested aggregation | Does not define predicate |
| `does not mask a closure failure with a valid path-level outcome` | `tests/unit/traversal-phases.test.ts:504` | Closure failure outranks path-level contested | A-8 OPEN |
| `aggregates mixed CYCLE_DETECTED and CONTESTED paths as CYCLE_DETECTED` | `tests/unit/traversal-phases.test.ts:523` | Cycle outranks contested | A-8 OPEN |
| `represents an all-contested outcome distinctly` | `tests/unit/traversal-phases.test.ts:575` | All-contested path yields `kind: 'CONTESTED'` | Does not define predicate |

### 4.2 DEC-07 tests

| Test | File:line | What it proves | Limit |
| --- | --- | --- | --- |
| `reports the closure-only branch that fails assurance` | `tests/unit/traversal-phases.test.ts:332` | Direct closure branch failure is retained | Direct only |
| `is satisfied for a path without merge nodes` | `tests/unit/traversal-phases.test.ts:358` | No merge → closure SATISFIED | No depth |
| `keeps path-level VALID distinct from closure failure` | `tests/unit/traversal-phases.test.ts:370` | Path and closure phases are separate | No recursion |
| `propagates mechanism failures instead of turning them into branch failures` | `tests/unit/traversal-phases.test.ts:397` | Mechanism failure is not a closure branch failure | No depth |
| `does not descend into a closure-only branch` | `tests/unit/traversal-phases.test.ts:413` | Immediate-only behavior | Pins implementation, not norm |
| `B-4 closure-only branch failure preserves path-level and closure evidence` | `tests/conformance/b.test.ts:122` | Direct branch failure and per-path evidence | No deeper edge |
| `B-4 a merge node reached through CONTINUATION still closes its merge parents` | `tests/conformance/b.test.ts:158` | Merge node recognized through a non-merge path edge | Direct only |
| `B-4 mixed direct parent relations are all closed` | `tests/conformance/b.test.ts:219` | All direct relations checked | Direct only |
| `B-6 non-origin direct branch fails closure without checking deeper edges` | `tests/conformance/b.test.ts:239` | Non-origin direct branch checked; deeper edge not checked | Deeper edge is implementation behavior, not norm (`conformance-matrix.md:150`) |
| `BLOCKED (A-5, non-conformance): immediate closure does not descend into closure-only merge C` | `tests/experimental/nested-merge-recursion.test.ts:12` | Pins immediate-only behavior | Excluded from conformance |
| `BLOCKED (A-5, non-conformance): recursive closure would also require C→E and C→F` | `tests/experimental/nested-merge-recursion.test.ts:23` | Recursive expectation is todo | Not normative |
| `BLOCKED (A-11, non-conformance): a MERGED_FROM origin is not closed` | `tests/experimental/origin-merge-closure.test.ts:18` | A-11 separate behavior | Excluded from conformance |

`B-4 a merge node reached through CONTINUATION still closes its merge parents` pins the current **node-property trigger**. It does not settle whether §8.6 requires that trigger; `DEC-07-TRIGGER` remains OPEN.

### 4.3 Property and scope tests

| Test | File:line | What it proves | Limit |
| --- | --- | --- | --- |
| `P1 registry and node storage order are irrelevant` | `tests/property/traversal-invariance.test.ts:209` | Storage-order invariance | Implementation invariance |
| `P2 descriptor lineage order is irrelevant and closure failure order is canonical` | `tests/property/traversal-invariance.test.ts:219` | Lineage/closure order invariance | Implementation invariance |
| `P3 assessment arrival order is irrelevant` | `tests/property/traversal-invariance.test.ts:229` | Assessment-order invariance | Implementation invariance |
| `P6 registerAssessment is copy-on-write and preserves supersession history` | `tests/property/traversal-invariance.test.ts:299` | Supersession history preserved | No conflict semantics |
| `P8: cycles never yield eligibility by themselves` | `tests/property/traversal-invariance.test.ts:341-454` | Cycle handling | Model-bounded |
| `general bounded DAGs match the brute-force reference` | `tests/property/merge-closure-dag.test.ts:64` | P7 immediate-closure oracle | Oracle reuses implementation; DAGs ≤ 7; immediate-only |
| Scope vs closure tests | `tests/unit/scope-matrix.test.ts` | Scope filters discovery only; closure independent | No depth rule |

## 5. Task 17 mapping

| Requirement | Task 17 text | Status | Source |
| --- | --- | --- | --- |
| N-078 | Two applicable trusted Assessments that contradict move the claim to `CONTESTED` | **BLOCKED** | `docs/audits/2026-10-31-core-001-task-17/requirement-matrix.md:127` |
| N-107 | Every edge must not have an unresolved conflict of applicable Assessments | **BLOCKED** | `requirement-matrix.md:166` |
| N-109 | For every merge node on the selected path, all direct parent edges are checked | **PASS** | `requirement-matrix.md:168` |
| N-110 | Closure extends to branches not leading to origin | **PASS** | `requirement-matrix.md:169` |
| N-111 | A failing branch yields `ERR_MERGE_BRANCH_UNSATISFIED` | **PASS** | `requirement-matrix.md:170` |
| N-112 | Closure depth inside parent branches is defined | **BLOCKED** | `requirement-matrix.md:171` |
| N-172 | Missing and contradictory assessments have been checked | **PARTIAL** | `requirement-matrix.md:256` |
| N-079 | Dependent decisions cannot rely on a contested claim until local resolution | **NOT COVERED** | `requirement-matrix.md:128`; separate `T18-DEC-10` |

§12 case statuses (`conformance-matrix.md:16-22`): B-3 PASS, B-4 PASS, B-5 PASS, B-6 PASS, B-7 PASS. These are historical Task 17 statuses and are not changed by this package.

## 6. Task 18 status references

| Source | Line | Content |
| --- | --- | --- |
| `decision-register.md:4` | 2 APPROVED (DEC-01/02); 13 OPEN |
| `decision-register.md:27` | T18-DEC-06 OPEN |
| `decision-register.md:28` | T18-DEC-07 OPEN |
| `decision-register.md:36` | T18-DEC-15 OPEN |
| `decision-register.md:96-97` | AMBIG-A-4b/A-5 BLOCKED |
| `disposition-matrix.md:29` | N-078 BLOCKED |
| `disposition-matrix.md:32` | N-107 BLOCKED |
| `disposition-matrix.md:33` | N-112 BLOCKED |
| `disposition-matrix.md:43` | N-172 PARTIAL |
| `remediation-roadmap.md:54` | T18-09A decisions recorded, not approved |
| `remediation-roadmap.md:57` | T18-09D depends on T18-09A |
| `remediation-roadmap.md:129-131` | DEC-06/07 → T18-09A; DEC-06 → T18-09D |
| `remediation-roadmap.md:158` | Assurance critical path |

## 7. Property/oracle limitations

- P7 (`tests/property/merge-closure-dag.test.ts`) reuses `assessEdge`/`evaluateAssurance`; it is implementation-invariance evidence, not independent semantic proof (`docs/implementation.md:1556`).
- P7 is limited to DAGs ≤ 7 nodes, immediate closure only, origin excluded (A-11), and mirrors the implementation's aggregation without resolving A-8.
- P1-P3 and B-7 prove order independence, not the correctness of a conflict predicate.
- The experimental nested-merge and origin-closure tests are excluded from §12 coverage and must not be cited as conformance.

## 8. Known documentation discrepancy

`docs/implementation.md:1605` says “It does not establish C-1 or C-2.” This is stale after T18-02A added a real C-1 conformance test and AEBE evidence. It is recorded here only; this package does not fix it and does not change the historical Task 17 C-1 status.

## 9. Verification commands

Documentation-only validation:

```text
git status --porcelain
git diff --check
git diff --stat
```

No tests are required for this package. Existing tests are cited as evidence, not re-executed. All line references were verified against `454af8c` before writing.
