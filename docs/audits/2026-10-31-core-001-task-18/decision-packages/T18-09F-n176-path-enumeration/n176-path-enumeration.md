# N-176 — Path Enumeration and Equivalent-Result Semantics

**Status:** DRAFT / analysis only. `T18-DEC-18` is proposed, not approved.
**Related:** issue #25, issue #53, audit revision 1, A-8, T18-SPEC-01.

---

## 1. Decision question

> Does CORE-001 require a binding result that exposes every discovered candidate→origin path, or can an equivalent normative result be computed without materialising the full path set?

The answer determines whether the current implementation violates N-176 and what result contract a non-enumerating implementation must preserve.

Sub-questions:

1. What counts as the “result” whose equivalence §8.8 requires?
2. Are `acceptedPaths` and `details.perPath` normative output, diagnostic output, or implementation detail?
3. If a compact result is sufficient, what must it contain for acceptance and rejection?
4. How are B-4 closure evidence, B-6 non-origin branches and B-7 determinism preserved?
5. Does a resource cap satisfy N-176, or only mitigate it?
6. What happens when the graph is large enough that even a non-enumerating proof is expensive?
7. Does the answer require a CORE-001 clarification through `T18-SPEC-01`?

---

## 2. Normative evidence

### 2.1 §8.8 — determinism and non-enumeration

`docs/CORE-001.md:848-870`:

> “Реализации MUST возвращать одинаковый результат для одинакового набора:
> - Lineage Declarations;
> - применимых Assessments;
> - Credential Revocation Records;
> - Assurance Requirements;
> - локальных политик;
> - временного контекста проверки.”
>
> “Результат MUST NOT зависеть от:
> - порядка хранения рёбер;
> - порядка поступления уже доступных деклараций;
> - порядка обхода узлов;
> - внутреннего алгоритма оптимизации.”
>
> “Реализация MAY использовать мемоизацию, динамическое программирование и другие методы оптимизации.”
>
> “Она MUST NOT требовать явного перечисления всех возможных путей, если результат может быть вычислен эквивалентным способом.”

The `MUST NOT` is conditional:

- **Antecedent:** the result can be computed by an equivalent method without explicit enumeration.
- **Obligation:** the implementation must not require explicit enumeration.

It does not say “must not expose paths.” It says “must not require explicit enumeration of all possible paths” when an equivalent computation exists. The distinction between *requiring* enumeration and *offering diagnostics* is central.

### 2.2 §8.4 / §8.7 — one accepted path suffices

`docs/CORE-001.md:788-792` and `:826-846` establish that paths are evaluated independently and a candidate may satisfy binding if at least one fully valid path exists.

This creates a possible compact acceptance result:

- acceptance needs **one** fully valid path with its closure evidence;
- additional accepted paths are not necessary to establish eligibility.

It does not automatically define rejection: proving that no path is valid still requires a sound, deterministic argument.

### 2.3 §8.5 / §8.6 — per-edge evidence

Path validation is per edge (`§8.5`), and merge closure is per direct branch (`§8.6`). A compact result must preserve enough edge/branch evidence to explain an acceptance or rejection, but need not enumerate every path that shares the same failing edge.

### 2.4 Audit revision 1 — N-176

`docs/audits/2026-10-31-core-001-task-17-revision-1/README.md:20-31` records:

- N-176 status **PARTIAL**;
- §8.8 aggregate **PASS → PARTIAL**;
- current evidence: `collectPaths`/`discoverPaths` materialise every simple path and `evaluateBinding` validates each;
- measurement: a chain of `k` merge diamonds yields `2^k` paths (`k=16` → 65 536 paths / ~2.7 s);
- no test asserts N-176.

The revision explicitly leaves open whether the public per-path result makes enumeration part of the required result. That is the decision this package addresses.

---

## 3. Current implementation behavior

### 3.1 Discovery materialises every simple path

`src/core/traversal.ts:307-359` (`collectPaths`) uses an explicit DFS stack and pushes a `Path` for every simple candidate→origin route. `discoverPaths` (`:361-389`) sorts and returns all paths.

### 3.2 Binding validates every discovered path

`evaluateBinding` (`src/core/traversal.ts:902-...`) calls `discoverPaths`, then loops over every discovered path, calls `evaluateOnePath`, and accumulates `accepted` and `outcomes`. The result includes:

- `acceptedPaths: readonly Path[]`;
- `details.perPath: readonly PathOutcome[]` for failures and accepted paths.

`BindingResult` (`src/core/traversal.ts:109-125`) makes path materialisation part of the public result shape.

### 3.3 Why this is an output lower bound

The issue is not only internal memory:

- a caller can receive every path and every per-path outcome;
- the implementation must therefore create them before returning;
- a linear-size descriptor can produce exponentially many paths.

The current implementation therefore **requires** explicit enumeration for its public result. The open question is whether that result is normatively required or whether a compact equivalent exists.

---

## 4. The two readings of §8.8

### Reading A — full per-path result is the required result

If `acceptedPaths` and `details.perPath` are part of the normative binding result, then the result itself contains every discovered path. In that reading:

- explicit enumeration is required by the result contract;
- the conditional in N-176 (“if the result can be computed equivalently”) is not satisfied by a compact result, because the compact result is not the same result;
- N-176 does not condemn the implementation, but the specification has an output-size/resource problem that must be resolved by changing the result contract or documenting the limitation.

**Problem:** this reading makes the `MUST NOT` nearly vacuous whenever an API exposes diagnostics. It also leaves the resource-exhaustion risk unaddressed.

### Reading B — the normative result is validity plus sufficient evidence

If the normative result is:

- eligible / not eligible;
- one accepted path (or a canonical acceptance witness);
- a deterministic failure witness for rejection;
- closure evidence for the accepted path and failing branch evidence for rejection;

then an equivalent result can be computed without listing every path. The current implementation violates N-176 because it requires the full set for its public result.

**Problem:** this reading requires a public API change and a precise definition of “sufficient evidence” and “equivalent result.”

### 4.1 The decision cannot be avoided by a cap

A cap on discovered paths (option A) preserves the enumeration requirement and merely converts an exponential result into a bounded failure. It does not satisfy N-176 if an equivalent non-enumerating result exists. A cap may be a temporary mitigation, but not the normative answer.

---

## 5. Options

### Option A — enumeration with a cap

**Mechanism:** stop after `N` discovered paths or validation steps; return an existing `MechanismFailure` (no new normative code).

**Pros:** minimal code change; preserves current public result for small graphs; easy to test.

**Cons:** still requires enumeration; does not satisfy N-176 on Reading B; introduces an arbitrary limit and a failure mode; callers cannot distinguish resource policy from graph invalidity; `N` becomes a compatibility parameter.

**Status:** not recommended as the normative resolution; possible interim mitigation under a separate operational decision.

### Option B — compact non-enumerating validity result

**Mechanism:** decide eligibility and produce a canonical witness without materialising all paths:
- acceptance: one canonical fully valid path plus closure evidence;
- rejection: a deterministic failure witness (edge or closure branch) plus the reason no accepted path exists;
- optional per-path diagnostics are not required for validity.

**Pros:** directly satisfies N-176 on Reading B; resource use follows the graph/proof structure rather than path count; preserves one-accepted-path rule; keeps B-4/B-6 evidence if the witness is chosen carefully.

**Cons:** breaking `BindingResult` change; rejection proof is the hard part; `details.perPath` compatibility; A-8 precedence remains OPEN; needs a precise equivalence definition.

**Status:** recommended direction; requires `T18-SPEC-01` and an API decision.

### Option C — lazy/streaming paths

**Mechanism:** generate paths on demand; stop at the first accepted path; expose an iterator for diagnostics.

**Pros:** avoids materialising all paths on acceptance; preserves a path-oriented diagnostic API.

**Cons:** rejection still requires exhausting the search; a caller that iterates all paths recreates the problem; not a complete answer without non-enumerating rejection.

**Status:** useful component, not sufficient alone.

### Option D — hybrid: early acceptance + non-enumerating rejection + bounded diagnostics

**Mechanism:**
- acceptance: stop at the first canonical fully valid path;
- rejection: use graph/DP/dominance reasoning to prove no path can be fully valid, returning a compact witness;
- diagnostics: optional bounded enumeration, explicitly outside the required validity result.

**Pros:** satisfies N-176 on Reading B; preserves a path witness for acceptance; offers diagnostics without making them mandatory; can retain B-4/B-6 evidence.

**Cons:** most complex; needs a proof/witness contract; risk of divergence between compact decision and diagnostic enumeration; A-8 and closure-depth questions remain OPEN.

**Status:** recommended implementation shape if the owner wants to preserve diagnostics.

---

## 6. Adversarial cases

| # | Case | What happens today | What a compact result must preserve |
| --- | --- | --- | --- |
| 1 | Chain of `k` merge diamonds | `2^k` paths materialised | Reject/accept without path explosion; deterministic witness |
| 2 | First path accepted, many other paths invalid | All paths still validated and returned | Acceptance may return one canonical path; other paths need not be materialised |
| 3 | Every path fails on the same edge | Every path enumerated to discover the repeated failure | One deterministic edge witness can represent the class if the proof is sound |
| 4 | Different paths fail on different edges | Per-path outcomes differ | A failure witness set or a proof that every path contains at least one failing edge |
| 5 | Closure-only branch failure (B-4) | Direct branch failure retained per path | Accepted path’s closure failure must remain visible; top-level code per B-4 |
| 6 | Non-origin branch (B-6) | Branch checked for merge node | Compact closure evidence must retain branch identity |
| 7 | Cycle in graph | Cycle detection / path dead ends | Must not enumerate cyclic paths; cycle outcome preserved |
| 8 | Scope restricts edges | Only scope-permitted paths discovered | Compact reachability must use the same scope semantics |
| 9 | Storage/order permutation (B-7) | Sorted path list | Canonical witness independent of storage order |
| 10 | 61-node `2^16`-path graph | ~65k paths / seconds | Must complete without path-proportional output |
| 11 | Caller needs full diagnostics | Current API returns all paths | Optional bounded diagnostic API; not required for validity |
| 12 | Rejection with no path at all | `ERR_NO_TRAVERSAL_PATH` before path enumeration | Must remain distinct from “paths exist but all fail” |

---

## 7. Recommendation (not approved)

**Adopt Reading B with a compact validity result, and treat full path enumeration as optional diagnostics.**

Minimum contract:

1. **Acceptance:** return one canonical fully valid path and the closure evidence required by §8.6. The one-accepted-path rule of §8.7 is preserved.
2. **Rejection:** return a deterministic failure witness sufficient to establish that no path is fully valid. The witness may be an edge, a closure branch, or a compact proof object; it must not require listing every path.
3. **Per-path diagnostics:** optional, bounded, explicitly outside the normative validity result. A diagnostic API may still enumerate paths; the validity API must not require it.
4. **Determinism:** canonical ordering of the chosen accepted path and failure witness; no dependence on adjacency/storage order (B-7).
5. **B-4/B-6:** closure evidence for the selected accepted path and failing branch must be retained; the compact result must not lose the branch reason.
6. **No new normative error code.** If an operational cap is retained as a diagnostic boundary, use an existing `MechanismFailure`; do not invent a normative code.
7. **A-8 remains OPEN.** The package does not decide which top-level failure code wins when multiple failure classes coexist.

This recommendation requires `T18-SPEC-01` to define “equivalent result” and whether `acceptedPaths`/`details.perPath` are part of the normative result or diagnostics.

---

## 8. Open sub-decisions

| ID | Question | Status |
| --- | --- | --- |
| **N176-1** | Is the full per-path result normative or diagnostic? | **OPEN** |
| **N176-2** | What is the minimum acceptance witness? One path plus closure evidence, or a set? | **OPEN** |
| **N176-3** | What is the minimum rejection witness? Edge, branch, proof tree, or a deterministic failure set? | **OPEN** |
| **N176-4** | Is a bounded diagnostic enumeration allowed, and with what failure behavior? | **OPEN** |
| **N176-5** | Does the compact result change the public `BindingResult` (breaking), or add a new result type? | **OPEN** |
| **N176-6** | How is A-8 precedence preserved without resolving it? | **OPEN** |
| **N176-7** | Does `T18-SPEC-01` need to clarify §8.8, or can the implementation change under the existing text? | **OPEN** |
| **N176-8** | What resource target is required for the adversarial `2^k` case? | **OPEN** |
| **N176-9** | Is the diagnostic enumeration API subject to its own cap, and who owns that policy? | **OPEN** |

---

## 9. Closure evidence

If the owner chooses Reading B / Option B or D:

- `T18-SPEC-01` clarification of §8.8 “equivalent result” and per-path diagnostics;
- a new/revised result contract with acceptance and rejection witness shapes;
- a deterministic non-enumerating algorithm for acceptance and rejection;
- tests for the `2^k` chain, B-4 closure evidence, B-6 non-origin branch, B-7 determinism, cycles, scope;
- no change to CORE-001 error-code set;
- a resource-exhaustion regression test;
- a re-audit of N-176 and §8.8 aggregate.

If the owner chooses Reading A:

- document that the full per-path result is normative;
- record the output-size/resource limitation explicitly;
- a cap/limit may be operational but does not satisfy N-176;
- N-176 remains PARTIAL or is reclassified with the limitation stated.

---

## 10. Proposed register row (not applied)

The following row is proposed for `decision-register.md`; this package does not edit the register.

| ID | Question | Normative anchor | Distinct from | Owner | Required evidence | Impact if unresolved | Blocks | Resolution | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **T18-DEC-18** | Does §8.8 require a compact binding result rather than materialising every candidate→origin path, and what acceptance/rejection evidence is equivalent? | §8.8, §8.4, §8.5, §8.6, §8.7 | A-8 precedence; DEC-07 closure depth; T18-DEC-14 independent implementation | spec editor + project owner | Decision on “equivalent result,” acceptance/rejection witness, diagnostic enumeration, compatibility; `T18-SPEC-01` wording if needed | N-176 remains PARTIAL; current implementation requires enumeration; resource-exhaustion risk remains | N-176, §8.8 aggregate, any traversal rework | — | **OPEN** |

---

## 11. What this package does not decide

- It does not approve `T18-DEC-18`.
- It does not resolve A-8 precedence.
- It does not change DEC-07 closure depth.
- It does not choose a concrete API shape.
- It does not authorise implementation or a code change.
- It does not change Task 17 statuses; N-176 remains PARTIAL until a decision and re-audit.
