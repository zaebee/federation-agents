# T18-09F — N-176 Path Enumeration Decision Package

**Status:** DRAFT — decision-support only. **Not approved.** Decision-ready revision added (`decision-ready-revision.md`); the complexity analysis (`oq4-complexity-adversarial-pass.md`, revision 3) now proves D0/D2/D3/D4/D6 polynomial and leaves D5 polynomial as a proof sketch with named empirical obligations. `T18-DEC-18` remains PROPOSED / OPEN.
**Proposed decision:** `T18-DEC-18` — path-enumeration and equivalent-result semantics.
**Repository revision:** `f1d52e1` (`main`; Task 17 audit revision 2 merged).
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
| `adversarial-review.md` | Review of the draft against §8.4/§8.7/§8.8, the code and B-3/B-4/B-6; nine findings |
| `decision-ready-revision.md` | The six required outcomes (contract equivalence, canonical witness, rejection proof, A-8 preservation, compatibility/migration, resource behaviour), each with statement, anchor, counterexample, resolution, compatibility impact and closure evidence |
| `remaining-owner-questions.md` | The owner questions (OQ-1…OQ-10), with recommendations and consequences where one is defensible |
| `oq4-complexity-adversarial-pass.md` | Revision 3: class-by-class decision problems, cycle-preemption lemma, complete polynomial arguments for D0/D2/D3/D4/D6 (D3 via walk + loop erasure), D5 proof sketch with empirical obligations, D6 withdrawn, owner options R1–R4, and an explicit correction history |

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

These three points are developed in `decision-ready-revision.md` §1–§4. The questions that still need an owner decision are listed in `remaining-owner-questions.md`; they are choices between readings and API strategies, not analysis gaps.


## 6. Summary

- **Normative requirement.** §8.8 permits memoisation and dynamic programming and forbids requiring explicit enumeration of all possible paths when the result can be computed equivalently.
- **Current implementation.** `discoverPaths` materialises every simple candidate→origin path; `evaluateBinding` validates every discovered path; the public `BindingResult` exposes `acceptedPaths` and `details.perPath` for every path. The enumeration is therefore an output lower bound, not only an internal implementation detail.
- **Measured risk.** A chain of `k` merge diamonds yields `2^k` paths. Issue #25 records `k=16` → 65 536 paths / ~2.7 s; roughly 61 nodes can reach ~1 M paths. Input size is linear; output is exponential.
- **Core ambiguity.** Whether `acceptedPaths` and `details.perPath` are part of the required normative result. If they are, N-176's conditional may not bite. If a compact validity result is equivalent, the current implementation violates N-176.
- **Preferred direction (not approved; specified in `decision-ready-revision.md`; not a claim that it is the only complete contract).** Adopt Reading B with a compact binding result: one canonical accepted path plus closure evidence for acceptance; a class-existence rejection proof that reproduces the current top-level code — polynomial for D0/D2/D3/D4/D6, with D5 as a proof sketch plus empirical obligations (`oq4-complexity-adversarial-pass.md`); diagnostics outside the required validity path. A versioned API is recommended over silently changing `BindingResult`. No new normative error code; A-8 precedence and A-14 remain OPEN. The remaining choices are in `remaining-owner-questions.md`.
- **What this package does not do.** It does not approve `T18-DEC-18`, change Task 17 statuses, resolve A-8, change closure depth, or authorise implementation.
