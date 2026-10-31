# T18-09F — Decision-Ready Revision (not approved)

**Status:** decision-support revision of the draft package. **`T18-DEC-18` remains PROPOSED / OPEN.** This document does not approve it, register it, or change any status.
**Reviewed revision:** `f1d52e1` (`main`).
**Companion:** `adversarial-review.md` (the review that produced the required outcomes below), `remaining-owner-questions.md` (the questions that still need an owner decision).

Each of the six sections below has the same shape: **exact statement → normative anchor → counterexample → proposed resolution → compatibility impact → closure evidence.** Nothing here is a resolution until the owner approves it.

---

## 1. Contract equivalence — what is the normative result?

### 1.1 Exact statement

The result has **three layers**, and only the first two are normative:

| Layer | Content | Status |
| --- | --- | --- |
| **L1 — normative validity** | `eligible` plus, when false, the top-level failure code required by §8.4/§8.6. Acceptance means at least one fully valid path exists (§8.7). | **normative** |
| **L2 — mandatory evidence** | Acceptance: one canonical accepted witness (path node/edge sequence), the per-edge assurance outcomes for that path, and the closure evidence for every merge node on it (§8.6). Rejection: a witness sufficient to establish that no fully valid path exists, plus the top-level code. Mechanism: the mechanism failure. | **normative evidence** |
| **L3 — diagnostics** | The complete path list and every per-path outcome. | **optional, not part of validity** |

Classification of the current fields:

- **`acceptedPaths`** is currently the list of **all** fully valid paths (B-3 asserts two). Under Reading B it is **diagnostic**; the normative witness is one canonical accepted path.
- **`details.perPath`** is **diagnostic**, except for the specific failure evidence that L2 requires: the failing edge/closure branch implied by the top-level code. Full per-path arrays are not mandatory evidence.

### 1.2 Normative anchor

§8.4: a candidate may satisfy the binding "если существует хотя бы один допустимый путь". §8.7: the candidate is recognised "если существует хотя бы один полностью допустимый путь". §8.8's `MUST NOT` is conditional on an equivalent computation. No sentence in §8.4–§8.8 requires returning every discovered path; the full list is an implementation-provided diagnostic.

### 1.3 Counterexample

B-3 asserts `acceptedPaths` equals **both** diamond paths. If L3 is declared diagnostic but B-3 is left unchanged, one document says the list is optional evidence while the conformance corpus requires it — the contract and the corpus contradict, and no implementation can satisfy N-176 and B-3 together.

### 1.4 Proposed resolution

Adopt the L1/L2/L3 split. `T18-SPEC-01` must state which layer `acceptedPaths`/`details.perPath` belong to (this decision cannot be inferred from §8.8 alone) and that L3 is outside the validity contract. The normative validity API returns L1+L2 only.

### 1.5 Compatibility impact

Breaking for callers that read `acceptedPaths` or `perPath` as validity evidence; B-3/B-4/B-6 require revision (see §5). Additive alternative: introduce a **versioned** compact result type and keep the current type as legacy diagnostics (see §5.4).

### 1.6 Closure evidence

`T18-SPEC-01` text defining L1/L2/L3; a re-audit of the affected §12 cases; tests that assert L1/L2 without reading L3.

---

## 2. Canonical acceptance witness

### 2.1 Exact statement

The canonical accepted witness is the **minimum fully valid simple path under the existing canonical path order**, not "the first path DFS happens to return". The current order is the lexicographic order of `pathKey` (per-edge `child\0parent\0relation`, joined by `\x01`), which is independent of storage and traversal order (§8.8).

A compact algorithm may find it with **ordered best-first search over prefixes**:

- frontier ordered by `pathKey(prefix)`, which is a monotone lower bound: any extension of a prefix has a key `>= pathKey(prefix)`;
- a prefix is expanded by appending one edge in canonical edge order;
- a prefix is pruned when the assurance result for an already-traversed edge is not `VALID`, or when the prefix cannot reach the origin within the scope (reverse reachability);
- the first complete path whose edges are all `VALID` and whose merge closure on the path is `SATISFIED` is the canonical accepted witness.

### 2.2 Normative anchor

§8.8 requires the same result for the same input set and independence from storage/arrival/traversal order; §8.7 requires one fully valid path. "Canonical" is our ordering choice and must be stated, because §8.8 does not name one.

### 2.3 Counterexample

DFS order is not `pathKey` order. In a graph where the first DFS branch is longer and lexicographically larger than a later shorter branch, the first DFS-valid path is not the minimum under `pathKey`. A test that only checks "a valid path is returned" cannot detect this.

### 2.4 Proposed resolution

Define the canonical witness by `pathKey` minimum. The correct algorithm is **greedy lexicographic minimisation on the acyclic induced subgraph** (cycle-preemption lemma, `oq4` §2) with DAG-reachability as the feasibility oracle; the best-first prefix search above is a mental model, not the complexity argument. Add an oracle property test: for small random graphs, the compact witness must equal the first element of the full enumeration's accepted list.

### 2.5 Compatibility impact

Witness identity changes the *content* of the accepted list only (L3); L1 stays `eligible: true`. B-3 must be revised to assert **one canonical witness** or to use the diagnostic API for the full list.

### 2.6 Closure evidence

Unit tests for the ordering (two valid branches, different lengths); property test against full enumeration on small graphs; a deterministic-order test that permutes adjacency/storage (the B-7 style, applied to the compact witness).

---

## 3. Rejection proof — what is sufficient, and when paths fail differently?

### 3.1 Exact statement

A rejection witness is sufficient when it establishes **that every simple candidate→origin path contains a failing condition**, and it reproduces the same top-level code the current enumeration produces. After the **cycle-preemption lemma** (`oq4` §2) the proof is compact, and **polynomial for D0/D2/D4/D5**; only **D3** (cycle-class existence) is open, and D6 does not exist as a path-scoped class.

- **per-edge classification** (path-independent): each edge's assurance result (`VALID`, `INVALID` + missing/disallowed, `CONTESTED`);
- **reachability in the acyclic induced subgraph**: cycle-containing routes are preempted to `CYCLE_DETECTED` before assurance/closure, so every path that reaches this classification contains no node of a cyclic SCC (Lemma 1) and lies in a DAG (Lemma 2); in a DAG, reachability decides "through edge `u→v`" (Lemma 3);
- **closure state**: `(merge node, outgoing path edge)`; closure is checked only for a non-origin merge node, and the path edge is excluded from the branch check — a **code fact** in `collectBranchFailure`, not a §8.6 literal statement.

Rejection witnesses per class:

| Class | Witness | Computation |
| --- | --- | --- |
| `ERR_NO_TRAVERSAL_PATH` | no path exists | reverse reachability from origin |
| `ERR_ASSURANCE_PREDICATE_UNSATISFIED` | the first-failing edge class witness; reach `s⇝u` on valid edges, then `v⇝t` in the DAG | polynomial (D2) |
| `CYCLE_DETECTED` | one simple path that touches a cyclic node | **OPEN** — existence of such a simple path (D3); the earlier 2-disjoint-paths reduction was unsound because the hard instances carry cycles that preempt |
| `ERR_MERGE_BRANCH_UNSATISFIED` | one path with closure failure + the failing branch; state `(merge node, outgoing path edge)` | polynomial (D4) |
| `CONTESTED` | one path whose first failing edge is contested | polynomial (D2 variant) |
| `MECHANISM` | input-scoped mechanism failure | polynomial; no path-scoped class exists (§3.4) |

When different paths fail for different reasons, a **single failing edge is not a proof**: the witness must be the class witness in the precedence order of §4, and the proof must show that the higher class does not exist before returning a lower one.

**Corrected claim.** Revision 1 of the complexity pass called D2/D4/D6 NP-hard; that is **withdrawn**. The cycle-preemption lemma makes D0/D2/D4/D5 polynomial, D6 non-existent, and leaves only D3 open. See `oq4-complexity-adversarial-pass.md` §2, §3, §8.

### 3.2 Normative anchor

§8.4/§8.7 define validity by existence of a fully valid path; the top-level codes are specified in §8.5/§8.6 and B-4. A rejection proof that does not establish non-existence is not equivalent to the normative result.

### 3.3 Counterexample

Path 1 fails on edge `e1` (assurance), path 2 fails on a closure branch. Returning either failure alone cannot justify the top-level `ERR_MERGE_BRANCH_UNSATISFIED`: the current code concludes it only because closure failure outranks assurance. A compact algorithm that reports "the first failure found" returns `ERR_ASSURANCE_PREDICATE_UNSATISFIED` on the same input.

### 3.4 Mechanism failures — input-scoped only

Current behaviour: the only reachable `MECHANISM` results are input-scoped — candidate-array validation inside `assessEdge` and selector/candidate prechecks before discovery. These are decided before or once, so they are polynomial and do not depend on which path is chosen.

A throwing `Policy` hook is **not** caught in `assessEdge`/`evaluateAssurance`; the exception propagates as an uncaught caller error. It is therefore not a mechanism outcome, path-scoped or otherwise.

**Resolution:** no path-scoped mechanism class exists, so `N176-13` and the earlier (a)/(b) choice are **withdrawn**. The A-8 compatibility rule (OQ-5) is unaffected: input-scoped mechanism failures can be decided once, and the current `MECHANISM > …` order is preserved exactly.

### 3.5 Closure evidence

Oracle property test: for small graphs with mixed failure classes, the compact top-level code equals the enumeration's code. Negative tests for each class and for combinations (closure + assurance, cycle + closure, contested + assurance). A test for a throwing policy hook that pins the chosen assumption.

---

## 4. A-8 precedence — preserve the current semantics without resolving A-8

### 4.1 Exact statement

A-8 (which top-level code wins when several classes coexist) remains **OPEN** and is not resolved by this decision. The compact implementation reproduces the **current observable behaviour** as a compatibility rule: `MECHANISM` on any evaluated path > closure failure > cycle > contested > assurance unsatisfied. This is an implementation preservation rule, not a normative precedence table. The rule is only implementable together with the complexity outcome: if a class-existence question is NP-hard, the implementation must accept exponential worst-case search or the owner must choose a different reading (`oq4` §5).

### 4.2 Normative anchor

B-4 pins only the closure-over-assurance combination ("top-level `ERR_MERGE_BRANCH_UNSATISFIED` for a surviving path whose merge node fails closure"). A-8 records that the general precedence is not specified. §8.8's determinism requirement makes any rule that depends on traversal order unacceptable.

### 4.3 Counterexample

A graph with one closure-failing path and one cycle path. Current code returns `ERR_MERGE_BRANCH_UNSATISFIED`. A compact search that finds the cycle path first would return `CYCLE_DETECTED` — a different observable result on the same input.

### 4.4 Proposed resolution

Compute **existence per class** (reachability, §3) first, then apply the compatibility rule. In the decision record, state plainly: "the implementation preserves the current order as a compatibility rule; A-8 remains OPEN; a future A-8 decision may change this order and then the result changes with it." This rule is **exactly equivalent to the current API only under OQ-6 option (a)** (path-faithful mechanism failures); under option (b) the MECHANISM component of the order differs for hook throws and the migration notes must say so.

### 4.5 Compatibility impact

No new normative error code. Observable behaviour is preserved for D0/D2/D4/D5/D6, whose decision procedures are polynomial after the cycle-preemption lemma. D3 is the exception: if the cycle-class decision is implemented by exact search, that class may remain exponential; this is a complexity property of the computation method, not a change to the codes.

### 4.6 Closure evidence

A table-driven test that, for every pair of path classes, asserts the compact code equals the enumeration code; a note in the decision record that A-8 stays OPEN.

---

## 5. Compatibility and migration

### 5.1 Exact statement

There are two viable migration shapes; the owner must choose one:

| Shape | Description | Effect on B-3/B-4/B-6 |
| --- | --- | --- |
| **Option 5.A — replace** | Change `BindingResult` to the compact L1/L2 shape; move L3 to a separate diagnostic API. | Corpus must be revised: B-3 asserts one witness, B-4/B-6 read the diagnostic API or the L2 rejection evidence. |
| **Option 5.B — version (recommended)** | Add `BindingResultV2` / `evaluateBindingCompact`; keep the current `evaluateBinding` and `BindingResult` unchanged as legacy diagnostic behaviour, marked deprecated but not removed. | B-3/B-4/B-6 continue to pass on the legacy API; new conformance cases cover v2; no corpus rewrite is forced. |

**Option schemes used in this package (they must not be conflated):** Reading A/B is the normative reading (OQ-1); Option 5.A/5.B is the API migration; the mechanism (a)/(b) choice is **withdrawn** (no path-scoped class); legacy Options A–D in `n176-path-enumeration.md` §5 mean cap / compact / lazy / hybrid, and "Option D" in `adversarial-review.md` refers to that legacy hybrid, not to a new scheme.

### 5.2 Normative anchor

§8.4/§8.7 define the validity result; the public API shape is an implementation choice. §8.8's determinism applies to both versions.

### 5.3 Counterexample

Silently changing the existing `BindingResult` breaks every caller that compiled against it and turns a conformance-preserving test change into a compatibility break. A versioned addition cannot break existing callers.

### 5.4 Proposed resolution (compatibility)

Adopt Option 5.B: new result type, new function, `BindingResult` remains for one deprecation window. `T18-SPEC-01` scope is limited to: L1/L2/L3 definition, canonical order, rejection-witness sufficiency, diagnostics status, and the deprecation note. It does not need to amend §8.4–§8.7 if the owner accepts that the full list was never required; if the owner chooses Reading A instead, no API change is needed and `T18-SPEC-01` should instead state that the full per-path list is normative evidence.

### 5.5 Closure evidence

An API compatibility test that the legacy function still exists and returns the old shape; new conformance cases for v2; `T18-SPEC-01` review.

---

## 6. Resource behaviour

### 6.1 Exact statement

The **validity API must never fail because of an internal resource cap**. Resource exhaustion on the validity path is a bug, not a normative outcome; no existing error code represents "we gave up". After the cycle-preemption lemma, D0/D2/D4/D5 are polynomial; only D3 is open, and an exact D3 search may be exponential, so no cap may be placed on it either (a cap would silently change the verdict). A bound belongs only to the **diagnostics** API, where it is a caller policy with an explicit, documented result.

### 6.2 Normative anchor

§8.4/§8.7 define the result as a property of the graph; a resource-dependent result would violate §8.8 determinism (the same input would produce different results on different machines/loads).

### 6.3 Counterexample

A cap that returns `E_UNKNOWN_BOUNDARY_REJECTED` on a large diamond graph conflates "input is invalid" with "implementation chose a limit", and the same input yields different results on a faster/slower machine — a §8.8 determinism violation.

### 6.4 Proposed resolution

Validity API uncapped; diagnostics API bounded by an explicit caller-owned policy; the bound and its result are documented and not part of conformance.

### 6.5 Closure evidence

A benchmark proving the validity path handles `k=16` (and the documented larger case) without path-proportional memory; a test that a diagnostics bound does not change the validity result.

---

## 7. Summary of proposed resolutions (still not approved)

| # | Proposed resolution | Owner decision needed |
| --- | --- | --- |
| 1 | L1/L2/L3 split; `acceptedPaths`/`perPath` are L3 diagnostics | Yes — Reading B |
| 2 | Canonical witness = `pathKey` minimum via greedy minimisation on the acyclic subgraph (proof sketch) | Implementation detail under Reading B |
| 3 | Class-existence rejection proof + compatible top-level code — polynomial for D0/D2/D4/D5; **D3 open**, D6 non-existent | Yes — see `oq4` §7 (R1–R4) |
| 4 | Keep current precedence as a compatibility rule; A-8 stays OPEN | Yes — confirm A-8 untouched |
| 5 | Versioned new API (Option 5.B), legacy kept for a deprecation window | Yes — API strategy |
| 6 | Validity uncapped; diagnostics bounded by caller policy | Yes — diagnostics policy |
| 7 | Mechanism failures are input-scoped; `N176-13` withdrawn; no owner choice | No — analysis resolved |
