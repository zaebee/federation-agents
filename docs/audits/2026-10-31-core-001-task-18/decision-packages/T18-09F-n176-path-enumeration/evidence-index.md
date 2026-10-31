# T18-09F — Evidence Index

**Status:** DRAFT. N-176 remains PARTIAL. `T18-DEC-18` is proposed, not approved.
**Purpose:** Trace every material conclusion in this package to a normative section, implementation symbol, test, issue, or Task 17/18 artifact.

## 1. Labeling convention

| Label | Meaning |
| --- | --- |
| **Normative requirement** | Required by `docs/CORE-001.md`; line range cited |
| **Current implementation behavior** | What the code at `e01d77c` does; symbol and line range cited |
| **Test evidence** | A test that proves the stated behavior; exact test name and line cited |
| **Interpretation** | A reading of the normative text; not approved |
| **Recommendation** | Decision-support input; not approved |
| **OPEN question** | The specification or owner decision does not determine the answer |

Implementation behavior is not normative meaning. A passing test is not proof that N-176 is satisfied.

## 2. Normative sources

| Source | Line range | Used for |
| --- | --- | --- |
| §8.4 Path Discovery | `docs/CORE-001.md:776-792` | Multiple paths are independent; one valid path can satisfy binding |
| §8.5 Path Validation | `docs/CORE-001.md:794-804` | Per-edge validation and no unresolved conflict |
| §8.6 Merge Closure | `docs/CORE-001.md:806-824` | All parent branches; `ERR_MERGE_BRANCH_UNSATISFIED` |
| §8.7 Diamond Lineage | `docs/CORE-001.md:826-846` | One fully valid path suffices |
| §8.8 Determinism | `docs/CORE-001.md:848-870` | Same input set → same result; no order dependence; MAY memoise/DP; MUST NOT require explicit enumeration when equivalent |
| §12 B-4/B-6/B-7 | `docs/CORE-001.md:1294-1386` | Closure failure, non-origin branch, arrival order |

## 3. Implementation symbols

| Symbol | File:lines | Relevance |
| --- | --- | --- |
| `Path` / `PathSet` | `src/core/traversal.ts:40-45` | Path materialisation and public path list |
| `BindingResult` | `src/core/traversal.ts:109-125` | `acceptedPaths` and `details.perPath` expose every path |
| `collectPaths` | `src/core/traversal.ts:307-359` | Explicit DFS; pushes every simple path |
| `discoverPaths` | `src/core/traversal.ts:361-389` | Returns all discovered paths, sorted |
| `evaluateBinding` | `src/core/traversal.ts:902-...` | Validates every discovered path and returns per-path outcomes |
| `adjudicate` / `summarizePaths` | `src/core/traversal.ts:759-795` | Aggregation after all paths are evaluated |
| `reachableToOrigin` | `src/core/traversal.ts` | Scope-filtered reachability, but does not avoid path enumeration |

## 4. Test inventory

| Test | File:line | What it proves | Limit |
| --- | --- | --- | --- |
| `finds a single path without any assessments input` | `tests/unit/traversal-phases.test.ts:89` | `discoverPaths` returns a path | Single path |
| `is independent of graph storage order` | `tests/unit/traversal-phases.test.ts:97` | Discovery result sorted/deterministic | Small graph |
| `P1 registry and node storage order are irrelevant` | `tests/property/traversal-invariance.test.ts:209` | Storage-order invariance | Does not measure path count |
| `P2 descriptor lineage order is irrelevant and closure failure order is canonical` | `tests/property/traversal-invariance.test.ts:219` | Lineage/closure order invariance | Does not measure path count |
| `P3 assessment arrival order is irrelevant` | `tests/property/traversal-invariance.test.ts:229` | Assessment-order invariance | Does not measure path count |
| `B-7 all assessment arrival permutations produce the same result` | `tests/conformance/b.test.ts:253` | Arrival-order independence for a fixture | Small fixture |
| `B-4 closure-only branch failure preserves path-level and closure evidence` | `tests/conformance/b.test.ts:122` | Closure evidence is retained | Direct branch |
| `B-6 non-origin direct branch fails closure without checking deeper edges` | `tests/conformance/b.test.ts:239` | Non-origin branch checked | Direct only |
| `P8: cycles never yield eligibility by themselves` | `tests/property/traversal-invariance.test.ts:341` | Cycles are structural, not eligibility | Does not measure enumeration |

**Gap:** no test constructs the `2^k` merge-diamond chain or asserts a resource bound. The audit revision records the measured `k=16` case from issue #25, not a repository test.

## 5. Issue and audit evidence

| Source | Content |
| --- | --- |
| Issue #25 | `discoverPaths` enumerates every simple path; `2^k` merge-diamond growth; options: cap, non-enumerating validity, caller limit; acceptance criteria |
| Issue #25 comment | §8.8 `MUST NOT`; measurement `k=12` 4 096 / 173 ms, `k=14` 16 384 / 722 ms, `k=16` 65 536 / 2 672 ms; 61 nodes ≈ 1 M paths |
| Issue #53 / audit revision 1 | Inventories N-176; §8.8 PASS → PARTIAL; leaves the per-path-result reading open |
| `docs/audits/2026-10-31-core-001-task-17-revision-1/README.md:20-31` | N-176 row, measurement, effect on §8.8 |
| `STATUS.md:23` | N-176 new and not yet dispositioned by Task 18 |
| `docs/audits/2026-10-31-core-001-task-18/remediation-roadmap.md:48` | T18-03 is test-only; no N-176 task exists yet |
| `benchmark-procedure.md` (this package) | Reproducible `G(k)` merge-diamond construction, expected `2^k` counts and measurement procedure |

## 6. Task 17/18 mapping

| Requirement | Task 17 status | Source |
| --- | --- | --- |
| N-115 determinism | PASS | `requirement-matrix.md` |
| N-116 storage/delivery order independence | PASS | `requirement-matrix.md` |
| N-117 cycle is structural conflict | PASS | `requirement-matrix.md` |
| §8.8 aggregate | **PARTIAL** in audit revision 1 | `docs/audits/2026-10-31-core-001-task-17-revision-1/README.md` |
| N-176 non-enumeration | **PARTIAL** | audit revision 1 |
| N-172 missing/contradictory assessments | PARTIAL | Task 17 matrix; separate DEC-06 |

## 7. Verification commands

Documentation-only validation:

```text
git status --porcelain
git diff --check
git diff --stat
```

No tests are required for this package. Existing tests are cited as evidence, not re-executed.
