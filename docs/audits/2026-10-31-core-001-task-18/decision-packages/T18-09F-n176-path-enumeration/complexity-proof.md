# T18-09F — Complexity Proof (D0–D6)

**Status:** proof document for the decision package. **D5 remains OPEN** as a proof sketch with named empirical obligations. No implementation is authorised by this document.

**Source of truth for complexity:** `oq4-complexity-adversarial-pass.md` revision 3. Where this document and earlier revisions differ, revision 3 governs.

## 1. Problem classes

For a given graph `G`, scope, candidate `s`, origin `t`:

- **D0** — does at least one fully valid path exist?
- **D1** — does at least one simple candidate→origin path exist under the scope?
- **D2** — does at least one path exist that satisfies assurance for every edge and closure for every merge node on it?
- **D3** — does at least one path exist whose edges are all satisfied, possibly with cycles erased?
- **D4** — does at least one path exist whose top-level outcome is a given class (assurance failure, contested, closure failure)?
- **D5** — which fully valid path is the minimum under the existing `pathKey` order? (acceptance witness)
- **D6** — under what condition does a malformed assessment array produce a mechanism outcome?

## 2. Result table

| ID | Result | Basis |
| --- | --- | --- |
| D0 | polynomial | reachability in the `valid` subgraph of `A` |
| D1 | polynomial | reachability; `s == t` ⇒ no path |
| D2 | polynomial | Lemmas 1–3; prefix/suffix reachability |
| D3 | polynomial | Lemma 4; walk + loop erasure |
| D4 | polynomial | Lemmas 5–6; triple scan + reachability |
| D5 | polynomial **proof sketch**; empirical obligations open | §4 |
| D6 | polynomial | prechecks; malformed assessments require `reach_A(s,t)` |

## 3. Lemmas

### Lemma 1 — valid paths lie in the acyclic induced subgraph `A`

Scope-permitted edges that can still reach `t` form a DAG `A` after removing nodes that cannot reach `t` and nodes in cyclic SCCs that cannot be on a simple path to `t`. `discoverPaths` already computes this via `reachableToOrigin`. Any simple candidate→origin path is a path in `A`.

### Lemma 2 — reachability in `A` is polynomial

Standard graph reachability (BFS/DFS) on a finite DAG: `O(|V|+|E|)`.

### Lemma 3 — a fully valid path is an `s→t` path in `H`

Define `H` as the subgraph of `A` containing an edge `u→v` iff:
1. the edge's assurance outcome is `SATISFIED`; and
2. the closure of `u`, evaluated with this edge as the path edge, is `SATISFIED`.

Then every fully valid simple path is an `s→t` path in `H`, and every `s→t` path in `H` is fully valid. Closure is evaluated only on direct parent edges of merge nodes (§8.6) and only for the node that is the source of the path edge, so it does not depend on the rest of the path.

### Lemma 4 — cycle erasure (D3)

If an `s→t` walk exists in `A`, loop erasure (remove each cycle when first repeated) yields a simple path. This is polynomial and does not require enumerating all paths.

### Lemma 5–6 (D4)

For a fixed failure class, existence reduces to: is there an `s→t` path in `A` such that every edge fails (or succeeds) in the required way and no edge fails in a higher-priority way. This is a reachability query on a filtered subgraph; the triple scan is over the three classes that the current top-level aggregation considers.

## 4. D5 — greedy canonical witness (OPEN)

### 4.1 Algorithm

Valid paths are `s→t` paths in `H` (Lemma 3). Maintain a prefix `P` ending at `m`. If `m == t`, stop. Otherwise consider outgoing edges of `m` in `pathKey` order; pick the first edge `e: m→v` such that there is an `H`-path from `v` to `t`. Feasibility is plain reachability in the DAG `H`, so each query is `O(|V|+|E|)`; at most `|E|` queries. Total `O(|E|·(|V|+|E|))` per witness, polynomial.

### 4.2 Exact `pathKey` encoding

`pathKey(path)` (in `src/core/traversal.ts`) is:

```
path.edges.map(e => `${e.child}\u0000${e.parent}\u0000${e.relation}`).join('\u0001')
```

Comparison is ordinary lexicographic string comparison (`compareStrings`). Important properties:
- The separator `\u0000` is a valid character in an `IdentityVersionID` (IDs are unvalidated strings at the traversal layer). A parent id containing `\u0000` can make a boundary between `child` and `parent` ambiguous in the *string* encoding, even though the nested-key construction in `adjacencyFor` (post-#24) avoids this for deduplication.
- The joiner `\u0001` is likewise a valid character. Two different edge sequences can in principle produce the same `pathKey` string if a field contains `\u0001` or `\u0000` in a way that mimics a boundary. This is a real, if exotic, ambiguity in the *ordering key*, not in the path itself.
- Tie behavior: `Array.prototype.sort` is stable in the runtime, but `pathKey` values for two distinct simple paths cannot be identical unless the edge sequences are identical, because the per-edge triples are concatenated in path order and the path is simple. Therefore ties in `pathKey` imply identical paths; no secondary tie-break is currently defined or needed. A compact implementation must preserve this: if two candidates compare equal under `pathKey`, they are the same path and either may be returned.

### 4.3 Claimed proof

By lexicographic induction on the prefix: the first edge of the minimum path must be the smallest edge (under the `child\0parent\0relation` encoding of that edge, as it appears as the first triple) that admits a completion to `t` in `H`. The greedy choice makes exactly that selection; the argument then recurses on the suffix from the chosen edge's parent. This is the standard lexicographically shortest path in a DAG.

### 4.4 Why D5 is NOT closed

Three obligations from `oq4` §6 remain open:

1. **Written proof for the exact encoding.** The induction above is stated for an abstract lexicographic order over triples. The concrete `pathKey` encoding has the separator-ambiguity property noted in §4.2. A proof must show that the greedy comparison of single edges (`child\0parent\0relation` as a string) agrees with the comparison of full path keys, including when an id contains `\u0000` or `\u0001`. This has not been written.
2. **Oracle tests.** No test currently compares the greedy witness against exhaustive enumeration on small generated DAGs. The existing property tests (`traversal-invariance.test.ts`) check storage-order invariance and immutability, not witness minimality.
3. **Invariance tests.** No test currently reverses `nodes`/`edges` arrays on the exponential merge-diamond shape and compares the canonical witness. P1/P2 cover bounded DAGs only.

**Conclusion: D5 remains OPEN.** The greedy algorithm is a plausible polynomial construction and is the proposed direction, but it is a proof sketch, not a certified result. No implementation should rely on it until the three obligations above are closed. If obligation 1 fails (a counterexample where single-edge string order disagrees with full-path `pathKey` order), the greedy must be revised to compare full prefixes or a different canonical encoding must be chosen.

### 4.5 Proposed test obligations (specification only, not executed)

- **Oracle:** for all generated DAGs up to 7 nodes, compute the minimum `pathKey` path by exhaustive enumeration and compare to the greedy witness; assert equality of the full edge sequence, not just length or count.
- **Invariance:** for the merge-diamond shape at `k=12`, reverse `nodes` and `edges` arrays; assert identical witness edge sequence and identical path count.
- **Encoding:** include generated ids containing `\u0000` and `\u0001`; assert the greedy witness matches exhaustive enumeration. If any mismatch is found, it is a counterexample to obligation 1 and D5 stays OPEN with the counterexample recorded.

## 5. D6 — input-scoped mechanism failures

Reachable `MECHANISM` results are limited to prechecks before discovery (selector compilation, candidate lookup, duplicated descriptor id) and candidate-array validation inside `assessEdge`. A throwing `Policy` hook propagates and is not a mechanism outcome.

The earlier condition "malformed assessments and at least one path exists (D1)" is incorrect: `validatePathWithIndex` returns `CYCLE_DETECTED` before `assessEdge` is called. If every existing path touches a cyclic SCC, malformed assessments never reach validation and the observable result is a cycle outcome.

**Correct condition:** prechecks pass, the assessment array is malformed, and `reach_A(s,t)` holds — at least one simple path avoids every cyclic SCC and therefore reaches `assessEdge`. If no such path exists, the cycle (or no-path) outcome wins. `reach_A` is a reachability query on the acyclic induced subgraph (Lemma 2), so D6 remains polynomial.

## 6. Consequence for the recommendation

D0, D1, D2, D3, D4, D6 are polynomial with stated lemmas. D5 is a proof sketch with three open obligations. A compact implementation that needs a canonical witness must not be authorised until D5 is closed or the witness requirement is dropped. Reading R2 (compact API) is therefore conditional on closing D5 or accepting a non-canonical (any valid) witness as L2 evidence.