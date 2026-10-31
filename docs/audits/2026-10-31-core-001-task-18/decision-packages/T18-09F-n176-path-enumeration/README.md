# T18-09F — N-176 Path Enumeration Decision Package

**Status:** DRAFT — decision-support only. **Not approved.**
**Proposed decision:** `T18-DEC-18` — path-enumeration and equivalent-result semantics.
**Repository revision:** `e01d77c` (`main`; Task 17 audit revision 1 and T18-09E merged).
**Related:** issue #25, issue #53 / audit revision 1, `AMBIG-A-8`, `T18-SPEC-01`.
**Package type:** documentation only. No source, test, specification, configuration or CI change.

## 1. Scope

This package prepares a decision for **N-176**, the §8.8 `MUST NOT` that was inventoried by Task 17 audit revision 1:

> “Реализация MAY использовать мемоизацию, динамическое программирование и другие методы оптимизации. Она **MUST NOT требовать явного перечисления всех возможных путей**, если результат может быть вычислен эквивалентным способом.”

The decision question is not “how do we cap paths?” It is:

> **Does the binding result require every discovered path, or can the same normative result be computed without materialising the full path set?**

If the full path set is a required part of the result, N-176's conditional clause does not apply in the same way. If an equivalent result can be computed without it, the current implementation's requirement to materialise every simple path violates N-176.

## 2. Proposed decision status

| Item | Status |
| --- | --- |
| N-176 | **PARTIAL** in audit revision 1 |
| `T18-DEC-18` | **PROPOSED / OPEN**; not registered or approved by this package |
| §8.8 aggregate | **PARTIAL** in audit revision 1 |
| Current implementation | Enumerates every simple candidate→origin path |

This package does not edit `decision-register.md`. A proposed register row is included in `n176-path-enumeration.md` §10. Registration remains a separate owner action.

## 3. Source hierarchy

1. `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3 — normative source.
2. `docs/audits/2026-10-31-core-001-task-17-revision-1/README.md` — N-176 and §8.8 revision.
3. `src/core/traversal.ts` — current behavior and result types.
4. `tests/conformance/b.test.ts`, `tests/property/traversal-invariance.test.ts`, `tests/unit/traversal-phases.test.ts` — existing evidence.
5. Issue #25 and issue #53 — design and audit context.
6. This package — interpretations, options and a recommendation; not normative.

## 4. Package map

| File | Contents |
| --- | --- |
| `README.md` | Scope, status, source hierarchy, summary, pre-decision clarification checklist, package map |
| `n176-path-enumeration.md` | Normative analysis, current implementation, options, adversarial cases, recommendation, open sub-decisions, proposed register row, closure evidence |
| `benchmark-procedure.md` | Reproducible merge-diamond generator and measurement procedure for the `2^k` case |
| `evidence-index.md` | Normative, implementation, test and issue source index |

## 5. Pre-decision clarification checklist

Before `T18-DEC-18` can be approved, the owner should settle three points that this package deliberately leaves OPEN.

1. **Define “equivalent result” in three layers.**
   - normative result: eligible / not eligible;
   - mandatory evidence: the acceptance witness and the rejection proof;
   - diagnostics: optional per-path information.
   The package proposes this split but does not approve it.

2. **Classify `acceptedPaths` and `details.perPath`.**
   They are currently part of `BindingResult`. The decision must say whether they are:
   - part of the mandatory normative result; or
   - optional diagnostics outside the validity contract.
   This cannot be inferred from §8.8 alone.

3. **Do not treat “first DFS path” as the canonical witness.**
   The current canonical order is obtained by sorting the full path set. A non-enumerating implementation must define how it finds the same canonical witness without first materialising every path, and must define a deterministic rejection proof when different paths fail for different reasons.

The benchmark procedure is recorded separately so the `2^k` claim can be reproduced without relying on a scratch script.


## 6. Summary

- **Normative requirement.** §8.8 permits memoisation and dynamic programming and forbids requiring explicit enumeration of all possible paths when the result can be computed equivalently.
- **Current implementation.** `discoverPaths` materialises every simple candidate→origin path; `evaluateBinding` validates every discovered path; the public `BindingResult` exposes `acceptedPaths` and `details.perPath` for every path. The enumeration is therefore an output lower bound, not only an internal implementation detail.
- **Measured risk.** A chain of `k` merge diamonds yields `2^k` paths. Issue #25 records `k=16` → 65 536 paths / ~2.7 s; roughly 61 nodes can reach ~1 M paths. Input size is linear; output is exponential.
- **Core ambiguity.** Whether `acceptedPaths` and `details.perPath` are part of the required normative result. If they are, N-176's conditional may not bite. If a compact validity result is equivalent, the current implementation violates N-176.
- **Recommendation (not approved).** Adopt a compact binding result: one canonical accepted path plus closure evidence for acceptance; a deterministic failure witness for rejection; optional bounded diagnostic enumeration outside the required validity path. No new normative error code. A-8 precedence remains OPEN.
- **What this package does not do.** It does not approve `T18-DEC-18`, change Task 17 statuses, resolve A-8, change closure depth, or authorise implementation.
