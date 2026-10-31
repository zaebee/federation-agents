# T18-09F — Complexity Proof (D0–D6b)

**Status:** proof document for the decision package. **D5 remains OPEN** as a proof sketch with named proof and test obligations. No implementation is authorised by this document.

**Source of truth for D0–D6b:** `oq4-complexity-adversarial-pass.md` revision 3.1 §1. This document uses exactly those definitions; it does not introduce a second taxonomy.

## 0. Environment assumptions

Every equivalence claim below assumes the `Policy` callbacks (`applicableAssessments`, `conflictPredicate`) are **deterministic and pure**: the same arguments produce the same result, with no observable side effects and no exceptions. The TypeScript type does not enforce this. A callback that depends on call count, wall-clock time or external state makes even the legacy traversal order-dependent (§8.8) and the compact equivalence undefined. Exceptions thrown by callbacks propagate (they are not `MECHANISM` outcomes) and are outside this proof.

## 1. Definitions (revision 3.1 taxonomy)

Graph `G`, traversal scope `σ`, scoped edges `E_σ`, candidate `s`, origin `t`.
`C` = the set of nodes in `graph.cycles` (cyclic SCCs).
`A` = the subgraph induced by `V \ C` with edges whose endpoints are both outside `C`.

| ID | Exact question |
| --- | --- |
| **D0** | Does a fully valid simple `s→t` path exist? (acceptance / L1) |
| **D1** | Does any simple `s→t` path exist in `σ`? (`ERR_NO_TRAVERSAL_PATH`; `s == t` means no path) |
| **D2** | Does a simple path exist whose first non-satisfied edge has class X (invalid / contested)? |
| **D3** | Does a simple path exist that touches a node of `C`? (`CYCLE_DETECTED` class) |
| **D4** | Does a simple path exist whose edges are all satisfied and whose closure fails? (`ERR_MERGE_BRANCH_UNSATISFIED`) |
| **D5** | What is the canonical (minimum `pathKey`) fully valid simple path? (acceptance witness) |
| **D6a** | Does a pre-discovery mechanism failure apply independently of graph reachability? (duplicate descriptor id, missing candidate, selector compilation, version-label validation) |
| **D6b** | Does an edge-evaluation mechanism failure apply on a path that survives cycle preemption and reaches `assessEdge` with malformed data? |

## 2. Lemma 1 — cycle preemption (corrected)

`reachableToOrigin()` is a reverse-reachability prepass over **scope-permitted** edges. It does **not** remove nodes that belong to cyclic SCCs. `discoverPaths()` therefore enumerates simple paths that may pass through `C`; it only refuses to repeat a node already on the current path.

`validatePathWithIndex()` checks shape, membership and **cycles before edge assurance**. A path containing any node of `C` returns `CYCLE_DETECTED` immediately; assurance and closure are never evaluated for it.

**Lemma 1.** Every path that reaches assurance or closure classification contains no node of `C`.

**Correction relative to the previous draft:** it is wrong to describe `A` as "the graph `discoverPaths` already computes" or to say that `reachableToOrigin` excludes cycles. `A` is defined here explicitly as `G[V \ C]`; it is the domain of the assurance/closure decision problems, not the output domain of discovery. Cycle paths are classified separately by D3.

## 3. Lemmas 2–6

### Lemma 2 — `A` is a DAG

A directed cycle among nodes outside `C` would be an SCC and those nodes would be in `C` by `buildLineageGraph`. Therefore `A` is acyclic.

### Lemma 3 — prefix/suffix reachability in `A`

For `u,v ∈ A`, a simple `s→t` path through the edge `u→v` exists iff `reach_A(s,u)` and `reach_A(v,t)`.

Proof: (⇐) concatenate a simple `s⇝u` path and a simple `v⇝t` path; a shared vertex `x` would give the directed cycle `x⇝u→v⇝x` in `A` (both segments lie in a DAG), contradiction, so the concatenation is simple. (⇒) the prefix and suffix of the path witness the two reachabilities.

### Lemma 4 — D3

A simple `s→t` path touching `C` exists iff some `c ∈ C` satisfies `reach(s,c)` and `reach(c,t)`.

Proof: (⇒) take the path. (⇐) concatenate walks `s⇝c⇝t`; chronologically loop-erase the walk (stack algorithm, §7.1) to a simple `s→t` path `P`. If the pivot `c` survives, `P` touches `C`.

If `c` is erased, follow the chain of erasures:

1. When `c` is erased, the truncation closes a cycle at some vertex `x` that remains on the stack: the removed closed subwalk starts and ends at `x` and contains `c`.
2. A closed walk from `x` through `c` back to `x` means `x` and `c` lie in the same SCC. Hence `x ∈ C`.
3. If `x` is later erased, it is removed by a subsequent cycle closure at some vertex `y` that remains on the stack. That closed subwalk contains `x`, so `y` lies in the same SCC as `x` (and `c`); hence `y ∈ C`.
4. Each such transition occurs later in the original walk. Since the walk has finitely many edges, the chain terminates at a vertex of `C` that is never erased. Therefore the final `P` contains at least one vertex of `C`.

This argument does not require the original pivot `c` to survive, and it does not rely on a "first surviving vertex of one erased cycle": the surviving cyclic vertex may be reached through a chain of later erasures.

This makes D3 polynomial: forward and reverse reachability in the full graph `G`, intersect with `C`.

### Lemma 5 — closure semantics as implemented

For a path edge `e = (m→p, rel)`, `collectEdgeClosureFailures` checks every direct parent edge of `m` except the **exact** edge `(parent = p, relation = rel)`; it only does so when `m` has at least one `MERGED_FROM` parent edge. The exclusion of the path edge is a code fact (`collectBranchFailure`), not a literal §8.6 statement. The terminal origin is never a `child` of a path edge, so its parent edges are not checked (endpoint exception, OQ-11).

### Lemma 6 — D4

Let `m` be a non-origin node on a path, `e = (m→p, rel)` the path edge, and `B(m,e)` the other parent edges of `m` (with `m` having a `MERGED_FROM` parent edge). Closure fails iff some `b ∈ B(m,e)` fails branch evaluation.

A simple path with all edges satisfied and closure failing exists iff there are `m`, `e`, `b` with: `reach_{valid}(s,m)`, `e` satisfied, `reach_{valid}(p,t)`, `m` has a `MERGED_FROM` parent edge, `b ≠ e`, and `b` fails. All reachability is in `A`; the conditions are checked over `(m, e, b)` — polynomial.

## 4. D0 — acceptance

D0 is existence of an `s→t` path in the subgraph `H` of `A` whose edges are satisfied and whose source-node closure is satisfied (Lemma 5). Reachability in `H` is polynomial. This is the compact counterpart of `summarizePaths` returning `eligible: true` when `accepted.length > 0`.

## 5. D1 — existence

D1 is reachability in the scope-filtered graph, with the special case `s == t` → no path. Polynomial. This reproduces `ERR_NO_TRAVERSAL_PATH`.

## 6. D2 — first non-satisfied edge class

Fix the requirement, policy and context; by Lemma 1 every relevant path lies in `A`. Define, per edge `e`, its edge-assurance result `R(e) ∈ {SATISFIED, INVALID, CONTESTED}` (mechanism failures are input-scoped, §9). For a class `X`, let `E_X = {e : R(e) has class X}` and `E_valid = {e : R(e) = SATISFIED}`.

**Claim.** A simple path whose first non-satisfied edge has class `X` exists iff there is `e* = (u→v) ∈ E_X` with `reach_{E_valid}(s,u)` and `reach_A(v,t)`.

Proof (⇐): take a simple `s⇝u` path in `E_valid` and a simple `v⇝t` path in `A`; concatenate through `e*`. By Lemma 3 the result is simple; all its edges before `e*` are `SATISFIED`, and `e*` is class `X`, so the first non-satisfied edge is `e*`. (⇒): in the witness path, the prefix before `e*` lies in `E_valid` and reaches `u`; the suffix starts at `v` and reaches `t` in `A`.

**Match with `validatePathWithIndex`.** Shape/membership, then cycle check, then edges in path order; the first edge whose `evaluateEdgeAssurance` is not `SATISFIED` produces the outcome. Lemma 1 removes the cycle case. The claim's prefix/suffix conditions are exactly "all earlier edges satisfied, `e*` not". D2 is polynomial: two reachability computations plus one scan of `E_X`.

## 7. D3 — cycle class and chronological loop erasure

Lemma 4 gives the polynomial decision. The witness is built by BFS predecessor paths `s⇝c` and `c⇝t`, concatenated into a directed walk, then **chronologically loop-erased**. Complexity is expected `O(|V|+|E|)` with a vertex→index hash map, or `O((|V|+|E|) log |V|)` with a deterministic balanced tree. D3 is separate from D2: a cycle-preempted path never reaches assurance, so it cannot be classified by the first non-satisfied edge.

### 7.1 Chronological loop erasure (not first-occurrence deduplication)

First-occurrence deduplication is **wrong**: it can invent edges. For walk `s→a→b→c→a→d→t`, keeping the first occurrence gives `s→a→b→c→d→t`, but edge `c→d` may not exist.

The correct operation maintains a stack of vertices and processes the walk edge by edge:

```text
stack = [s]
index = { s: 0 }                 // vertex -> its current stack position
for each edge (u, v) in the walk:
    assert stack.top() == u
    if v in index:
        i = index[v]
        for each w in stack after i:  // pop suffix
            delete index[w]
            pop w
    else:
        index[v] = stack.length
        push v
```

**Invariant after each processed edge:** the stack is a contiguous directed walk in the original graph (every adjacent pair is an edge actually traversed) with no repeated vertex, and `index` maps every vertex on the stack to its exact position. Appending a new `v` preserves contiguity via edge `(u,v)` and records its index; truncating at a previous `v` keeps a prefix, makes `v` the new top, and deletes the indices of exactly the removed suffix, so the next edge continues from `v`.

**Complexity:** with a hash map for `index`, membership and position lookup are expected O(1); each vertex is pushed once and popped at most once, so the loop-erasure pass is expected O(|V|+|E|). If a strict deterministic worst-case bound is required rather than expected-hash, replace the hash map with a balanced search tree, giving O((|V|+|E|) log |V|); the algorithm does not change. The earlier text that scanned the stack linearly would have been O(|V|·|E|) and is not the intended bound.

For `s→a→b→c→a→d→t`, the stack evolves to `s→a→d→t`: the cycle `a→b→c→a` is removed, `c` is erased, and `a` survives as the cyclic node. The result is the simple path required by Lemma 4; it still touches `C` by the chain-of-erasure argument in Lemma 4 (the surviving cyclic vertex may be reached through later erasures).

**Required test (specification only, not executed):** walk with a repeated intermediate vertex, e.g. `s→a→b→c→a→d→t` with pivot `c`. Assert the final witness edges are exactly `s→a`, `a→d`, `d→t`; every edge exists in the graph; no vertex repeats; the witness contains a member of `C` (here `a`, even though pivot `c` was erased). This tests chronological erasure, not first-occurrence deduplication.

**Determinism:** the stack result is determined by the walk order. The walk order must itself be deterministic (see `api-migration.md` §3.2.1: sorted adjacency, BFS predecessor choice). If that cannot be guaranteed, determinism is an open proof obligation, not a claim.

## 8. D4 — closure failure

Lemma 6 gives the polynomial decision over triples `(m, e, b)`. The number of triples is `O(Σ out-degree²)`; with precomputed reachability sets, the decision is polynomial.

**Normative discrepancies** (not resolved here): the code skips the exact path edge in closure; the terminal origin is not closed. Both are recorded in `oq4` §5 and OQ-11; D4 is proved under the current code semantics (E), and the literal-origin variant (I) is also polynomial.

## 9. D5 — canonical witness (OPEN)

### 9.1 Algorithm (proof sketch, not certified)

Valid paths are `s→t` paths in `H`. Maintain a prefix `P` ending at `m`. If `m == t`, stop. Otherwise consider outgoing edges of `m` in `pathKey` order; pick the first edge `e: m→v` such that there is an `H`-path from `v` to `t`. Feasibility is plain reachability in `H`, so each query is `O(|V|+|E|)`; at most `|E|` queries. Total `O(|E|·(|V|+|E|))` per witness, polynomial **if** the greedy is correct.

### 9.2 Exact `pathKey` encoding

`pathKey(path)` (in `src/core/traversal.ts`) is:

```
path.edges.map(e => `${e.child}\u0000${e.parent}\u0000${e.relation}`).join('\u0001')
```

Comparison is ordinary lexicographic string comparison (`compareStrings`). Properties:

- The separator `\u0000` and joiner `\u0001` are valid characters in an `IdentityVersionID` (IDs are unvalidated strings at the traversal layer). The encoding is not self-delimiting.
- **Same-candidate injectivity is not proven.** A collision would require two distinct simple paths from the same `s` to the same `t` whose concatenated triples produce the same string. The first triple's `child` is `s` in both, so a collision must arise in the remaining fields; the fixed relation tokens make a collision less obvious, but no proof is recorded. The previous draft's claim that "ties imply identical paths" was an assumption, not a proof.
- If two distinct paths do collide, `Array.prototype.sort` stability is not a defined tie-break for the public contract; the current code would return whichever order discovery produced, which may depend on storage order. This is a reason to keep D5 OPEN.

### 9.3 Why D5 is NOT closed

Three obligations from `oq4` §6 remain open:

1. **Written proof for the exact encoding.** The lexicographic induction is stated for an abstract order over triples. It must be shown that single-edge string comparison agrees with full-path `pathKey` comparison, including ids containing `\u0000`/`\u0001`. This has not been written.
2. **Oracle tests.** No test compares the greedy witness against exhaustive enumeration on small generated DAGs. The existing property tests check storage-order invariance and immutability, not witness minimality.
3. **Invariance tests.** No test reverses `nodes`/`edges` arrays on the exponential merge-diamond shape and compares the canonical witness. P1/P2 cover bounded DAGs only.

Closure-constraint handling is **not** an independent D5 obligation: `H` is defined with closure in its edge-allowance rule, and Lemma 3 plus Lemma 5 establish that `H` represents exactly the fully valid paths. The open D5 issues are the three above.

**Conclusion: D5 remains OPEN.** The greedy is a plausible polynomial construction and the proposed direction, but it is a proof sketch, not a certified result. No implementation should rely on it until the three obligations are closed, or the owner explicitly chooses `DETERMINISTIC_NON_MINIMUM` with a specified storage-order-independent rule as L2 evidence (`owner-decision-summary.md` OD-3). A non-deterministic/arbitrary witness is not a valid §8.8 option.

### 9.4 Required oracle cases (specification only, not executed)

- **Witness minimality:** for all generated DAGs up to 7 nodes, compute the minimum `pathKey` path by exhaustive enumeration and compare the full edge sequence to the greedy witness.
- **Encoding collisions:** generate ids containing `\u0000` and `\u0001`; enumerate pairs of distinct simple paths from the same candidate/origin and record any equal `pathKey`. If a collision exists, record the exact counterexample and do not claim canonical witness uniqueness.
- **Permutation:** for the merge-diamond shape at `k=12`, reverse `nodes` and `edges` arrays; assert identical witness edge sequence and identical path count.

## 10. D6a/D6b — input-scoped mechanism failures

### 10.1 D6a — pre-discovery mechanism failures

`evaluateBinding()` calls `precheckCandidate()` before `discoverPaths()`. The following return `MECHANISM` before any graph reachability is consulted:

- duplicate descriptor id;
- candidate descriptor not supplied;
- selector compilation failure;
- version-label validation failure.

D6a is independent of `reach_A(s,t)`: it can return `MECHANISM` even when no candidate→origin path exists. It is polynomial in input size (duplicate-id scan, selector compilation, version-label validation); it is not constant-time in the input.

### 10.2 D6b — edge-evaluation mechanism failures

Candidate-array validation inside `assessEdge` is reached only while evaluating an edge of a path. A throwing `Policy` hook propagates and is not a mechanism outcome.

The earlier condition "malformed assessments and at least one path exists (D1)" is incorrect: `validatePathWithIndex` returns `CYCLE_DETECTED` before `assessEdge` is called. If every existing path touches a cyclic SCC, malformed assessments never reach validation and the observable result is a cycle outcome.

**Correct condition:** prechecks pass, the assessment array is malformed, `reach_A(s,t)` holds, and at least one simple path that avoids every cyclic SCC reaches an edge where `assessEdge` consults the malformed data. If no such path exists, the cycle (or no-path, or ordinary assurance) outcome wins. `reach_A` is a reachability query on the acyclic induced subgraph (Lemma 2); locating a path that reaches a malformed edge is another reachability query on the same subgraph, so D6b remains polynomial.

## 11. Result table

| ID | Result | Basis |
| --- | --- | --- |
| D0 | polynomial | reachability in `H ⊆ A` |
| D1 | polynomial | reachability in `G` with scope filter |
| D2 | polynomial | prefix/suffix reachability in `A` |
| D3 | polynomial | Lemma 4; walk + loop erasure |
| D4 | polynomial | Lemma 6; triple scan + reachability |
| D5 | **OPEN** | greedy proof sketch; §9.3 obligations |
| D6a | polynomial in input size | pre-discovery prechecks, independent of reachability |
| D6b | polynomial | malformed assessments require `reach_A(s,t)` and a path reaching `assessEdge` |

## 12. Consequence for the recommendation

D0, D1, D2, D3, D4, D6a and D6b are polynomial with stated lemmas. D5 is a proof sketch with three open obligations. A compact implementation that needs a canonical witness must not be authorised until D5 is closed or the witness requirement is relaxed to `DETERMINISTIC_NON_MINIMUM` with a specified storage-order-independent rule. Reading R2 (compact API) is therefore conditional on that owner decision.