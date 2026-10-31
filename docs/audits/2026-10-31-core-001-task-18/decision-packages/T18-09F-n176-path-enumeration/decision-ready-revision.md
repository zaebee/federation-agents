# T18-09F — Decision-Ready Revision (not approved)

**Status:** decision-support revision of the draft package. **`T18-DEC-18` remains PROPOSED / OPEN.** This document does not approve it, register it, or change any status.
**Reviewed revision:** `f1d52e1` (`main`).
**Complexity source of truth:** `oq4-complexity-adversarial-pass.md` revision 3. Where this document and the earlier revisions differ, revision 3 governs. **D2/D3/D4/D6 are polynomial; D5 is a proof sketch with named empirical obligations and is not certified until those obligations are met.**
**Companions:** `adversarial-review.md`, `remaining-owner-questions.md`, `oq4-complexity-adversarial-pass.md`.

Each section follows the same shape: **exact statement → normative anchor → counterexample → proposed resolution → compatibility impact → closure evidence.**

---

## 1. Contract equivalence — what is the normative result?

### 1.1 Exact statement

Three layers; only the first two are normative:

| Layer | Content | Status |
| --- | --- | --- |
| **L1 — normative validity** | `eligible` plus, when false, the top-level code required by §8.4/§8.6. Acceptance means at least one fully valid path exists (§8.7). | **normative** |
| **L2 — mandatory evidence** | Acceptance: one canonical accepted witness (node/edge sequence), the per-edge assurance results for that path, and the closure results for the merge nodes on it (§8.6). Rejection: the class witness required by the returned code plus the top-level code. Mechanism: the input-scoped mechanism failure. | **mandatory evidence** |
| **L3 — diagnostics** | The complete path list and every per-path outcome. | **optional, not validity** |

Classification of the current fields:

- **`acceptedPaths`** currently lists **all** fully valid paths (B-3 asserts two). Under Reading B it is **L3 diagnostic**; the normative witness is one canonical accepted path.
- **`details.perPath`** is **L3 diagnostic**, except the specific failure evidence L2 requires for the returned code: for `ERR_MERGE_BRANCH_UNSATISFIED`, the failing branch identity; for assurance/contested, the failing edge class.

### 1.2 Normative anchor

§8.4: a candidate may satisfy the binding "если существует хотя бы один допустимый путь". §8.7: recognition requires "хотя бы один полностью допустимый путь". §8.8's `MUST NOT` is conditional on an equivalent computation. No sentence requires returning every discovered path.

### 1.3 Counterexample

B-3 asserts `acceptedPaths` equals **both** diamond paths. If L3 is declared diagnostic while B-3 remains unchanged, the contract and the corpus contradict: no implementation satisfies N-176 and B-3 simultaneously.

### 1.4 Proposed resolution (L1/L2/L3 boundaries and corpus)

| Corpus case | What it validates | Which layer |
| --- | --- | --- |
| B-3 (both diamond paths) | legacy `acceptedPaths` (L3 list) | **legacy API only** |
| B-4 / B-6 (per-path closure evidence) | failing path + closure branch identity | **L2 mandatory evidence**, plus L3 list on the legacy API |
| new v2 cases (acceptance) | one canonical witness + per-edge assurance + closure for that path | **L2** |
| new v2 cases (rejection) | top-level code + class witness | **L2** |
| diagnostics tests | full per-path list, bounded/truncated result | **L3 only** |

**Mandatory vs diagnostic:** L2 is what a conformance claim may rely on; L3 may be absent or truncated without changing L1. **Do not infer normative equivalence from a smaller result structure:** the v2 API must be shown to produce the same L1 (code/eligibility) as the legacy API by a table-driven oracle comparison, not by asserting that fewer fields mean the same thing.

### 1.5 Compatibility impact

Breaking for callers that read `acceptedPaths`/`perPath` as validity evidence; B-3 needs a v2 counterpart, B-4/B-6 can keep the legacy per-path assertion and add an L2-based one. The versioned API (Option 5.B) keeps the legacy type unchanged.

### 1.6 Closure evidence

`T18-SPEC-01` text defining L1/L2/L3 and the mandatory diagnostics split; a table-driven L1 equivalence test legacy vs v2; the corpus mapping above; a re-audit of the affected §12 cases.

---

## 2. Canonical acceptance witness

### 2.1 Exact statement

The canonical witness is the **minimum fully valid simple path under the existing `pathKey` order**, not the first path a DFS returns. `pathKey` is the per-edge `child\0parent\0relation` joined by `\x01`; this order is independent of storage and adjacency order.

Algorithm (Lemma 1–2 of `oq4` §2): valid paths lie in the acyclic induced subgraph `A`. Build `H`: an edge is allowed iff its assurance is `SATISFIED` and the closure of its source node, evaluated with that edge as the path edge, is satisfied. Then greedily extend the current prefix with the smallest outgoing allowed edge that still has an `H`-path to the origin; feasibility is reachability in the DAG `H`.

### 2.2 Normative anchor

§8.8 determinism and independence from storage/arrival/traversal order; §8.7 one fully valid path.

### 2.3 Counterexample

DFS order is not `pathKey` order: a longer lexicographically larger branch explored first can yield a non-minimal witness. A test that only checks "a valid path is returned" cannot detect this.

### 2.4 Proposed resolution and proof status

Define the witness by `pathKey` minimum; use the greedy algorithm above. **The polynomial claim is qualified:** `oq4` §6 gives the lexicographic induction sketch and lists the outstanding evidence:

- written proof for the exact `pathKey` string encoding;
- oracle comparison against exhaustive enumeration on small generated DAGs;
- invariance under storage/adjacency permutations;
- closure-constraint handling in `H`.

### 2.5 Compatibility impact

Only the accepted-witness content changes (L2); L1 unchanged. B-3 is replaced for v2 by a single-witness assertion, or reads the legacy diagnostic list.

### 2.6 Closure evidence

The four obligations above, plus a unit test with two valid branches of different lengths and a permutation test.

---

## 3. Rejection proof — compact and polynomial, with one normative clarification

### 3.1 Exact statement

After Lemma 1 (cycle preemption) every path that reaches assurance/closure classification lies in the DAG `A`. The decision problems are:

| ID | Question | Result (`oq4` §3–§8) |
| --- | --- | --- |
| D0 | any fully valid path? | polynomial (reachability in the valid subgraph) |
| D1 | any path? | polynomial (`candidate == origin` → no path) |
| D2 | path whose first non-satisfied edge has class X? | polynomial: `reach_{valid}(s,u)` + `reach_A(v,t)` for some `e*=(u→v) ∈ E_X`; proof in `oq4` §3 |
| D3 | path touching a cyclic node? | **polynomial**: ∃ cyclic `c` with `reach(s,c)` and `reach(c,t)`; walk + loop erasure (`oq4` §4) |
| D4 | all edges satisfied and closure fails? | polynomial: triple `(merge node m, path edge e, failing branch b)` + reachability; `oq4` §5 |
| D6 | input-scoped mechanism? | polynomial: prechecks, or malformed assessments **and `reach_A(s,t)`** (a path that survives cycle preemption); no path-scoped class exists |

**Evidence shape:** rejection returns the class witness required by L2 — for D2 the failing edge class, for D3 one witness path touching a cyclic node, for D4 the failing branch identity, for D6 the mechanism failure. A single failing edge is not a proof for a higher-precedence class.

### 3.2 Normative anchor

§8.4/§8.7 validity by existence; §8.5/§8.6 codes; B-4 pins only closure-over-assurance. The top-level precedence is implementation-preserved (§4).

### 3.3 Counterexample

Path 1 fails on an assurance edge, path 2 fails on a closure branch. A compact algorithm that reports "the first failure found" returns a different code from the current one; the class-existence predicates of §3.1 must be evaluated for all classes before applying precedence.

### 3.4 D4 — path edge, terminal origin, Policy purity

Three distinct issues must not be conflated:

1. **Path-edge exclusion.** §8.6 says all parent edges of a merge node on the path are checked; the code skips the exact path edge (`collectBranchFailure`). This is equivalent under §0 (pure/deterministic/exception-free Policy): if the path edge's assurance fails, the path is `INVALID` before closure; if it is satisfied, a re-check yields `SATISFIED` again. **Spec clarification proposed (`T18-SPEC-01`): §8.6 states that the selected path edge is covered by §8.5 and closure checks the remaining edges. No implementation change required.**
2. **Terminal origin.** Closure runs for the `child` of every path edge; the origin is never a child, so a merge-node origin is not checked. §8.6/§8.7 do not say whether the endpoint counts. **This is an unresolved normative question (`OQ-11`):** choose semantics **E** (origin is an endpoint, excluded — current code) or **I** (origin checked; all its parent edges are branches since there is no outgoing path edge). D4 is polynomial under both; the proof and a conformance test must state the choice.
3. **Policy purity.** The proofs rely on Policy callbacks being deterministic, side-effect free and non-throwing; otherwise repeated evaluation in a different order can change results and even the legacy traversal is order-dependent. This is **`OQ-12`**: freeze a pure/deterministic Policy contract or exclude impure hooks from N-176 equivalence.

The D4 decision rule (independent of 2 and 3 once the semantics is fixed): closure fails iff some branch in `B(m,e)` fails, where `B(m,e)` excludes only the exact path edge; under semantics I, add the origin case (all parent edges of `t` are branches).

### 3.5 Mechanism failures

The only reachable `MECHANISM` results are input-scoped (`assessEdge` candidate validation, selector/candidate prechecks). A throwing `Policy` hook is not caught and propagates; it is not a mechanism outcome. **`N176-13` is withdrawn.**

### 3.6 Closure evidence

Oracle tests: compact class predicates vs full enumeration on small graphs (including mixed classes); a test for D3 with a walk-derived witness; a D4 test with more than two parents; an L1 code-equality test.

---

## 4. A-8 precedence — preserved, not resolved

### 4.1 Exact statement

A-8 remains **OPEN**. The compact implementation reproduces the current observable order as a compatibility rule: `MECHANISM` (input-scoped) > closure failure > cycle > contested > assurance unsatisfied. No normative precedence table is added.

### 4.2 Normative anchor

B-4 pins only closure-over-assurance. A-8 records that the general precedence is unspecified; §8.8 forbids order-dependent results.

### 4.3 Counterexample

One closure-failing path and one cycle path: current code returns `ERR_MERGE_BRANCH_UNSATISFIED`. A compact search that finds the cycle class first would return `CYCLE_DETECTED` on the same input.

### 4.4 Proposed resolution

Compute class existence per §3.1, then apply the compatibility rule. D3 is polynomial now, so the cycle-class predicate is exact. A future A-8 decision may change the order, and the result changes with it.

### 4.5 Closure evidence

A table-driven test over pairs of path classes asserting the compact code equals the enumeration code; the A-8 register row stays OPEN.

---

## 5. Compatibility and migration

### 5.1 Exact statement

Two shapes; the owner must choose:

| Shape | Description | Effect on B-3/B-4/B-6 |
| --- | --- | --- |
| **Option 5.A — replace** | Change `BindingResult` to L1/L2; move L3 to a diagnostic API. | Corpus must be revised: B-3 asserts one witness; B-4/B-6 read the diagnostic API or L2 evidence. |
| **Option 5.B — version (recommended)** | Add `BindingResultV2` / `evaluateBindingCompact`; keep `BindingResult` as deprecated legacy. | B-3/B-4/B-6 keep passing on legacy; new v2 cases cover L1/L2; no forced corpus rewrite. |

### 5.2 Normative anchor

§8.4/§8.7 define the validity result; the public API shape is an implementation choice. §8.8 applies to both versions.

### 5.3 Counterexample

Silently changing `BindingResult` breaks every compiled caller and turns a corpus-preserving change into a compatibility break.

### 5.4 Proposed resolution

Adopt Option 5.B. `T18-SPEC-01` scope: L1/L2/L3 definition, canonical order, class-witness sufficiency, diagnostics status, deprecation note. If Reading A is chosen, `T18-SPEC-01` instead states that the full per-path list is normative evidence and no new API is introduced.

**Option schemes (do not conflate):** Reading A/B (normative reading); Option 5.A/5.B (API migration); legacy Options A–D in `n176-path-enumeration.md` §5 (cap / compact / lazy / hybrid; "Option D" in `adversarial-review.md` means that legacy hybrid); R1–R4 in `oq4` §9.

### 5.5 Closure evidence

Compatibility test that the legacy function still exists and returns the old shape; v2 conformance cases; `T18-SPEC-01` review.

---

## 6. Resource behaviour

### 6.1 Exact statement

The validity API must never fail because of an internal resource cap. The decision problems in §3 are polynomial (D5 with the proof obligations of §2.4), so no cap is needed on the validity path. A cap belongs only to diagnostics: caller policy, explicit "truncated" result, validity unaffected.

### 6.2 Normative anchor

§8.4/§8.7 define the result as a graph property; a resource-dependent result violates §8.8 determinism.

### 6.3 Counterexample

A cap returning `E_UNKNOWN_BOUNDARY_REJECTED` on a large diamond graph conflates invalid input with an implementation limit and makes the result machine-dependent.

### 6.4 Proposed resolution

Uncapped validity; diagnostics bounded by caller policy. The benchmark (`k=16`) is a target, not a complexity proof (`remaining-owner-questions.md` OQ-8).

### 6.5 Closure evidence

A benchmark record for the validity path at `k=16`; a test that a diagnostics bound cannot change L1.

---

## 7. What is proven, what is sketched, what is the owner's

| # | Item | Status |
| --- | --- | --- |
| 1 | L1/L2/L3 split and `acceptedPaths`/`perPath` as L3 under Reading B | proposed; corpus mapping in §1.4 |
| 2 | Canonical witness = `pathKey` minimum | algorithm proven to be greedy; **empirical obligations** §2.4 |
| 3 | D0/D2/D3/D4/D6 polynomial | **proven** (Lemma 1–6, `oq4` §2–§7) |
| 4 | D5 polynomial | **proof sketch**, qualified §2.4 |
| 5 | A-8 untouched, precedence preserved | proposed implementation rule; A-8 OPEN |
| 6 | Option 5.B versioned API | recommended; owner choice |
| 7 | D4 vs §8.6 | **spec clarification proposed**, no implementation change; owner/spec-editor decision |
| 8 | Mechanism failures input-scoped; N176-13 withdrawn | analysis resolved; no owner choice |
| 9 | Reading A vs B, diagnostics policy, benchmark, audit wording | owner choices (`remaining-owner-questions.md` OQ-1/OQ-7/OQ-8/OQ-9/OQ-10) |
| 10 | Terminal origin in merge closure | **owner/spec-editor choice** (`OQ-11`); both E and I polynomial |
| 11 | Policy callbacks pure/deterministic/no-throw | **assumption §0**, or owner/spec decision `OQ-12`; without it equivalence is undefined |
