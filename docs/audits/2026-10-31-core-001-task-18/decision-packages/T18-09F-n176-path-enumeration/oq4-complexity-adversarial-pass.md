# T18-09F — OQ-4 Complexity Analysis (revision 3)

**Status:** analysis only. **Supersedes revisions 1–2.** Revision 1 wrongly claimed NP-hardness for D2/D4/D6; revision 2 removed that but left D3 open and the mechanism class misclassified. This revision gives polynomial algorithms for **all** classes, marks the one remaining proof obligation (D5 empirical validation), and keeps `T18-DEC-18` PROPOSED / OPEN.
**Normative claim:** none. This is an analysis of the current implementation's decision problems.

## 1. Decision problems

Graph `G`, traversal scope `σ`, scoped edges `E_σ`, candidate `s`, origin `t`. `C` = the nodes in `graph.cycles` (cyclic SCCs). `A` = the subgraph induced by `V \ C` with edges whose endpoints are both outside `C`.

| ID | Exact question |
| --- | --- |
| **D0** | Does a fully valid simple `s→t` path exist? (acceptance / L1) |
| **D1** | Does any simple `s→t` path exist in `σ`? (`ERR_NO_TRAVERSAL_PATH`; `s == t` means no path) |
| **D2** | Does a simple path exist whose first non-satisfied edge has class X (invalid / contested)? |
| **D3** | Does a simple path exist that touches a node of `C`? (`CYCLE_DETECTED` class) |
| **D4** | Does a simple path exist whose edges are all satisfied and whose closure fails? (`ERR_MERGE_BRANCH_UNSATISFIED`) |
| **D5** | What is the canonical (minimum `pathKey`) fully valid simple path? (acceptance witness) |
| **D6** | Does an input-scoped mechanism failure apply? |

## 2. Lemma 1 — cycle preemption

`validatePathWithIndex` checks shape, membership and **cycles before edge assurance**. A path containing any node of `C` returns `CYCLE_DETECTED` immediately; assurance and closure are never evaluated for it.

**Lemma 1.** Every path that reaches assurance or closure classification contains no node of `C`.

**Lemma 2.** `A` is a DAG. Proof: a directed cycle among nodes outside `C` would be an SCC and those nodes would be in `C` by `buildLineageGraph`.

**Lemma 3.** For `u,v ∈ A`, a simple `s→t` path through the edge `u→v` exists iff `reach_A(s,u)` and `reach_A(v,t)`. Proof: (⇐) concatenate a simple `s⇝u` path and a simple `v⇝t` path; a shared vertex `x` would give the directed cycle `x⇝u→v⇝x` in `A` (both segments lie in a DAG), contradiction, so the concatenation is simple. (⇒) the prefix and suffix of the path witness the two reachabilities.

**Lemma 4 (D3).** A simple `s→t` path touching `C` exists iff some `c ∈ C` satisfies `reach(s,c)` and `reach(c,t)`. Proof: (⇒) take the path. (⇐) concatenate walks `s⇝c⇝t`; loop-erase the walk to a simple `s→t` path `P`. If `c` survives, `P` touches `C`. If `c` is erased, the erased closed subwalk has a first vertex `y` that survives in `P`, and that subwalk is a closed walk through `y`, so `y` lies on a cycle; hence `y ∈ C` and `P` touches `C`.

**Lemma 5 (closure semantics as implemented).** For a path edge `e = (m→p, rel)`, `collectEdgeClosureFailures` checks every direct parent edge of `m` except the **exact** edge `(parent = p, relation = rel)`; it only does so when `m` has at least one `MERGED_FROM` parent edge. The exclusion of the path edge is a code fact (`collectBranchFailure`), not a literal §8.6 statement.

**Lemma 6 (D4).** Let `m` be a non-origin node on a path, `e = (m→p, rel)` the path edge, and `B(m,e)` the other parent edges of `m` (with `m` having a `MERGED_FROM` parent edge). Closure fails iff some `b ∈ B(m,e)` fails branch evaluation. A simple path with all edges satisfied and closure failing exists iff there are `m`, `e`, `b` with: `reach_{valid}(s,m)`, `e` satisfied, `reach_{valid}(p,t)`, `m` has a `MERGED_FROM` parent edge, `b ≠ e`, and `b` fails. All reachability is in `A`, and the conditions are checked over `(m, e, b)` — polynomial.

## 3. D2 — proof (complete)

Fix the requirement, policy and context; by Lemma 1 every relevant path lies in `A`. Define, per edge `e`, its edge-assurance result `R(e)` ∈ {`SATISFIED`, `INVALID`, `CONTESTED`} (mechanism failures are input-scoped, §7). For a class `X`, let `E_X = {e : R(e) has class X}` and `E_valid = {e : R(e) = SATISFIED}`.

**Claim.** A simple path whose first non-satisfied edge has class `X` exists iff there is `e* = (u→v) ∈ E_X` with `reach_{E_valid}(s,u)` and `reach_A(v,t)`.

Proof (⇐): take a simple `s⇝u` path in `E_valid` (exists by reachability; Lemma 2 makes it simple) and a simple `v⇝t` path in `A`; concatenate through `e*`. By Lemma 3 the result is a simple `s→t` path in `A`; all its edges before `e*` are `SATISFIED`, and `e*` is class `X`, so the first non-satisfied edge is `e*`. (⇒): in the witness path, the prefix before `e*` lies in `E_valid` and reaches `u`; the suffix starts at `v` and reaches `t` in `A`.

**Match with `validatePathWithIndex`.** The order is: shape/membership, cycle check, then edges in path order; the first edge whose `evaluateEdgeAssurance` is not `SATISFIED` produces the outcome. Lemma 1 removes the cycle case. The claim's prefix/suffix conditions are exactly "all earlier edges satisfied, `e*` not"; the resulting path has the same first failure. Therefore the compact predicate is equivalent, not merely a heuristic.

**Algorithm.** Two reachability computations in `A` (forward from `s` in `E_valid`; reverse from `t` in `A`) and one scan of `E_X`: `O(|V|+|E|)`. D2 is polynomial.

## 4. D3 — proof (complete) and algorithm

Lemma 4 gives equivalence with a **walk** through a cyclic node. Algorithm:

1. forward reachability from `s`; reverse reachability to `t`; both in `σ`, in the full graph `G` (cycles allowed);
2. cyclic set `C` from `graph.cycles`;
3. answer yes iff `(forward ∩ reverse ∩ C) ≠ ∅`.

The witness is built by BFS predecessor paths `s⇝c` and `c⇝t`, concatenated and loop-erased; by Lemma 4 the simple result touches `C`. Complexity `O(|V|+|E|)`. **D3 is polynomial**, contrary to revisions 1–2.

Note: the earlier reductions failed because they asked for a path through a *specific* cyclic node, while D3 asks for **some** cyclic node; Lemma 4 is what makes the difference.

## 5. D4 — proof and the normative discrepancy

By Lemma 6, existence is decided over triples `(m, e, b)` with reachability in `A`; the number of triples is `O(Σ out-degree²)`, and each reachability query is `O(|V|+|E|)` with precomputed sets, so the decision is polynomial.

**Normative discrepancy.** §8.6 says "for every merge node on the selected path, all its parent edges are additionally checked". The code skips the exact path edge because §8.5 already validated it. These are equivalent: if the path edge's assurance fails, the path is `INVALID` and closure is never evaluated; if it is satisfied, re-checking it in closure would also be satisfied (same edge, same requirement/policy/context). **Resolution proposed: a specification clarification (T18-SPEC-01), not an implementation change** — §8.6 should say that the selected path edge is covered by §8.5 and closure checks the remaining parent edges. The proof above is under the declared code semantics; if the owner instead requires a literal re-check, the decision problem is unchanged (the re-check adds no new outcome), only the wording changes.

## 6. D5 — greedy canonical witness

Valid paths lie in `A` (Lemma 1) and are all-edge-satisfied. Define `H` on edges that are satisfied and whose source node's closure, evaluated with that edge as the path edge, is satisfied; an edge is allowed iff both hold. A full valid path is exactly an `s→t` path in `H`.

**Greedy.** Maintain a prefix `P` ending at `m`; if `m == t`, stop (the path is complete). Otherwise try outgoing edges of `m` in `pathKey` order; choose the first `e` such that there is an `H`-path from the edge's parent to `t`. Feasibility is plain reachability in `H` (a DAG), so each query is `O(|V|+|E|)`; at most `|E|` queries. By lexicographic induction, the chosen path is the `pathKey`-minimum valid path: the first edge must be the smallest edge admitting a completion, and the argument repeats on the suffix.

**Proof obligations still open (qualified claim):** a written proof of the lexicographic induction for the exact `pathKey` string encoding, oracle tests against exhaustive enumeration on small generated DAGs, and invariance tests under storage/adjacency permutations. Until those tests exist the polynomial claim is a proof sketch, not an empirical certification.

## 7. D6 — input-scoped mechanism failures

The only reachable `MECHANISM` results are input-scoped: selector/candidate prechecks before discovery and candidate-array validation inside `assessEdge` (which fails identically for every evaluated edge). Decision: run the prechecks; if they pass, D6 is "malformed assessment array and at least one path exists" (D1), else no mechanism. Polynomial. A throwing `Policy` hook is **not** caught and propagates; it is not a mechanism outcome and creates no path-scoped class.

## 8. Result table

| ID | Result |
| --- | --- |
| D0 | polynomial (reachability in `valid` subgraph of `A`) |
| D1 | polynomial (reachability; `s == t` → no path) |
| D2 | polynomial (Lemma 1–3; prefix/suffix reachability) |
| D3 | polynomial (Lemma 4; walk + loop erasure) |
| D4 | polynomial (Lemma 5–6; triple scan + reachability) |
| D5 | polynomial **proof sketch**; empirical obligations listed in §6 |
| D6 | polynomial (input-scoped only) |

**Consequence for N-176:** a compact exact algorithm exists for all classes; the exponential output is not required. Reading B is no longer blocked by a complexity barrier; the remaining choice is normative/API (Reading A vs B, replace vs version).

## 9. Owner options (final)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative. | No API change; `2^k` output accepted as availability risk. |
| **R2 — Reading B, exact** | Compact API; all classes polynomial (D5 proof obligations pending). | Satisfies N-176; needs `T18-SPEC-01`, versioned API, corpus additions; D5 proof/tests first. **Preferred direction.** |
| **R3 — Reading B, semantic change** | Walk/state-based cycle class. | No longer necessary: D3 is polynomial under the current semantics. |
| **R4 — Defer** | Keep N-176 PARTIAL; clarify §8.8. | Honest fallback if the owner does not want a decision now. |

**Recommendation (author preference): R2**; R1 is the fallback; R3 is not needed; R4 if the owner wants spec clarification first.

## 10. Correction history

| Revision | Claim | Status |
| --- | --- | --- |
| 1 | D2/D4/D6 NP-hard | **withdrawn** |
| 1 | D3 reduction from 2-disjoint paths | **withdrawn** (unsound: hard instances carry cycles that preempt) |
| 2 | D2/D4/D5 polynomial; D3 open; D6 non-existent | mostly correct, D3 left open |
| **3** | all classes polynomial (D5 proof sketch) | current |

## 11. Limits

- D5 needs the empirical evidence listed in §6 before it is called certified polynomial.
- The D4 specification clarification is proposed, not applied; §8.6 remains unchanged.
- No status, register, `CORE-001.md`, source or test change is made here.
