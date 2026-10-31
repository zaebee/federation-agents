# T18-09F — OQ-4 Complexity Analysis (revision 3.1)

**Status:** analysis only. **Supersedes revisions 1–2.** Revision 1 wrongly claimed NP-hardness for D2/D4/D6; revision 2 removed that but left D3 open and the mechanism class misclassified. Revision 3 gives polynomial algorithms for **all** classes; revision 3.1 splits mechanism into D6a (pre-discovery) and D6b (edge-evaluation), correcting the overbroad claim that every mechanism outcome requires `reach_A(s,t)`. D5 remains a proof sketch; `T18-DEC-18` stays PROPOSED / OPEN.
**Normative claim:** none. This is an analysis of the current implementation's decision problems.

## 0. Environment assumptions (required for every equivalence claim)

All proofs below assume the `Policy` callbacks (`applicableAssessments`, `conflictPredicate`) are **deterministic and pure**: the same arguments produce the same result, with no observable side effects and no exceptions. The TypeScript type does not enforce this. A callback that depends on call count, wall-clock time or external state makes even the legacy traversal order-dependent (§8.8) and the equivalence claim undefined. Exceptions thrown by callbacks propagate (they are not `MECHANISM` outcomes) and are outside the equivalence claim.

If the owner does not want to freeze this assumption, it becomes a separate decision (`OQ-12`): a pure/deterministic `Policy` contract, or an explicit exclusion of impure hooks from N-176 equivalence.

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
| **D6a** | Does a pre-discovery mechanism failure apply independently of graph reachability? (duplicate descriptor id, missing candidate, selector compilation, version-label validation) |
| **D6b** | Does an edge-evaluation mechanism failure apply on a path that survives cycle preemption and reaches `assessEdge` with malformed data? |

## 2. Lemma 1 — cycle preemption

`validatePathWithIndex` checks shape, membership and **cycles before edge assurance**. A path containing any node of `C` returns `CYCLE_DETECTED` immediately; assurance and closure are never evaluated for it.

**Lemma 1.** Every path that reaches assurance or closure classification contains no node of `C`.

**Lemma 2.** `A` is a DAG. Proof: a directed cycle among nodes outside `C` would be an SCC and those nodes would be in `C` by `buildLineageGraph`.

**Lemma 3.** For `u,v ∈ A`, a simple `s→t` path through the edge `u→v` exists iff `reach_A(s,u)` and `reach_A(v,t)`. Proof: (⇐) concatenate a simple `s⇝u` path and a simple `v⇝t` path; a shared vertex `x` would give the directed cycle `x⇝u→v⇝x` in `A` (both segments lie in a DAG), contradiction, so the concatenation is simple. (⇒) the prefix and suffix of the path witness the two reachabilities.

**Lemma 4 (D3).** A simple `s→t` path touching `C` exists iff some `c ∈ C` satisfies `reach(s,c)` and `reach(c,t)`. Proof: (⇒) take the path. (⇐) concatenate walks `s⇝c⇝t`; chronologically loop-erase the walk to a simple `s→t` path `P`. If the pivot `c` survives, `P` touches `C`. If `c` is erased, follow the chain of erasures: when `c` is erased, the truncation closes a cycle at a vertex `x` that remains on the stack, and the removed closed subwalk starts/ends at `x` and contains `c`, so `x` and `c` are in the same SCC and `x ∈ C`. If `x` is later erased, it is removed by a later cycle closure at a vertex `y` that remains, and that cycle contains `x`, so `y` is in the same SCC and `y ∈ C`. Each transition is later in the original walk; finitely many edges imply the chain terminates at a vertex of `C` that is never erased. Thus `P` touches `C`; the original pivot need not survive.

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

The witness is built by BFS predecessor paths `s⇝c` and `c⇝t`, concatenated into a directed walk, then **chronologically loop-erased** with a vertex stack: for each edge `(u,v)`, if `v` already appears at stack index `i`, pop everything after `i`; otherwise push `v`. First-occurrence deduplication is **not** loop erasure and can invent non-edges (e.g. `s→a→b→c→a→d→t` must erase to `s→a→d→t`, not `s→a→b→c→d→t`).

Invariant after each edge: the stack is a contiguous directed walk (every adjacent pair is a real traversed edge) with no repeated vertex. By induction, appending via `(u,v)` preserves contiguity; truncating at an earlier `v` keeps a prefix and makes `v` the top, so the next edge continues correctly. By Lemma 4 the simple result touches `C`; if the pivot is erased, the chain-of-erasure argument shows the final surviving cyclic vertex may be reached through later closures, so the original pivot need not survive.

For the claimed complexity, maintain `index: vertex -> stack position` alongside the stack. The input walk is the concatenation of two simple BFS predecessor paths, each with at most `|V|-1` edges, so the walk has `O(|V|)` edges. Loop erasure processes each input edge once; total pushes are bounded by the walk length plus the initial element, and each push is popped at most once. With a hash map, lookup/update/delete are expected O(1), so loop erasure is expected O(|V|); BFS is O(|V|+|E|), giving expected O(|V|+|E|) overall. A strict deterministic bound uses a balanced tree, O((|V|+|E|) log |V|). Linear stack scans would be O(|V|·|E|) and are not the intended algorithm. **D3 is polynomial**, contrary to revisions 1–2.

**Required test (specification only):** walk with a repeated intermediate vertex (`s→a→b→c→a→d→t`, pivot `c`); assert final edges `s→a`, `a→d`, `d→t`, all edges present, no repeated vertex, and a member of `C` on the final path (here `a`, though pivot `c` was erased).

Note: the earlier reductions failed because they asked for a path through a *specific* cyclic node, while D3 asks for **some** cyclic node; Lemma 4 is what makes the difference.

## 5. D4 — proof, terminal origin, and the normative discrepancies

Under §0, by Lemma 6 existence is decided over triples `(m, e, b)` with reachability in `A`; the number of triples is `O(Σ out-degree²)`, and each reachability query is `O(|V|+|E|)` with precomputed sets, so the decision is polynomial.

**Normative discrepancy.** §8.6 says "for every merge node on the selected path, all its parent edges are additionally checked". The code skips the exact path edge because §8.5 already validated it. These are equivalent: if the path edge's assurance fails, the path is `INVALID` and closure is never evaluated; if it is satisfied, re-checking it in closure would also be satisfied (same edge, same requirement/policy/context). **Resolution proposed: a specification clarification (T18-SPEC-01), not an implementation change** — §8.6 should say that the selected path edge is covered by §8.5 and closure checks the remaining parent edges. This equivalence relies on §0: with impure callbacks, a re-check could return a different result. The proof above is under the declared code semantics; if the owner instead requires a literal re-check, the decision problem is unchanged (the re-check adds no new outcome), only the wording changes.

**Terminal origin (a second normative discrepancy).** `collectClosureFailures` checks closure for the `child` of every path edge. The terminal origin is never a `child`, so if the origin itself is a `MERGE` node, **its parent edges are not checked**. §8.6 speaks of merge nodes "on the selected path" and §8.7 of closure requirements on the selected path; whether the endpoint counts is not stated. The current behaviour is an **endpoint exception**, not a proof:

- **Semantics E (current code):** the origin is an endpoint, not a node the path passes through; closure excludes it. D4 exists as proved above.
- **Semantics I (literal reading):** the origin is checked too; since it has no outgoing path edge, **all** its parent edges are closure branches (the last path edge is already validated by §8.5 and is skipped only as an exact path edge). D4 then adds one case: closure fails iff the path reaches `t` with all edges valid and some parent edge of `t` fails branch evaluation; polynomial (reachability to `t` plus a scan of `t`'s parent edges, plus the non-origin cases).

This must not be silently embedded: **`OQ-11`** asks the spec editor/owner to choose E or I and to add a conformance test. The D4 proof is stated under E (matching the code) and is parameterised by the choice; both cases are polynomial.

## 6. D5 — greedy witness candidate (OPEN; not proven canonical)

Valid paths lie in `A` (Lemma 1) and are all-edge-satisfied. Define `H` on edges that are satisfied and whose source node's closure, evaluated with that edge as the path edge, is satisfied; an edge is allowed iff both hold. A full valid path is exactly an `s→t` path in `H`.

**Greedy.** Maintain a prefix `P` ending at `m`; if `m == t`, stop (the path is complete). Otherwise try outgoing edges of `m` in abstract-triple order; choose the first `e` such that there is an `H`-path from the edge's parent to `t`. Feasibility is plain reachability in `H` (a DAG), so each query is `O(|V|+|E|)`; at most `|E|` queries. The intended claim is that lexicographic induction makes the chosen path the `pathKey`-minimum under the abstract order; this is **not** a proof for the exact `pathKey` string encoding.

**Proof obligations still open (qualified claim):** a written proof of the lexicographic induction for the exact `pathKey` string encoding, oracle tests against exhaustive enumeration on small generated DAGs, and invariance tests under storage/adjacency permutations. Until those proof and test obligations are discharged, the polynomial claim is a proof sketch, not a certified result.

Closure-constraint handling is **not** a separate D5 obligation: `H` is defined with closure in its edge-allowance rule, and Lemma 3 plus Lemma 5 establish that `H` represents exactly the fully valid paths.

## 7. D6a/D6b — input-scoped mechanism failures

The reachable `MECHANISM` results split into two classes.

### D6a — pre-discovery mechanism failures

`evaluateBinding()` runs these before `discoverPaths()`:

- duplicate descriptor id;
- candidate descriptor not supplied;
- selector compilation failure;
- version-label validation failure.

They are independent of graph reachability. A `MECHANISM` is returned even when the candidate cannot reach the origin. This class is polynomial in input size (duplicate-id scan, selector compilation, version-label validation) and must not be conditioned on `reach_A(s,t)`.

### D6b — edge-evaluation mechanism failures

Candidate-array validation inside `assessEdge` is reached only while evaluating an edge of a path. A throwing `Policy` hook is **not** caught and propagates; it is not a mechanism outcome and creates no path-scoped class.

**The earlier condition "malformed assessments and at least one path exists (D1)" is wrong.** `evaluateBinding` evaluates discovered paths one by one; `validatePathWithIndex` returns `CYCLE_DETECTED` before `assessEdge` is called. If every existing path touches a cyclic SCC, a malformed assessment array never reaches validation and the observable result is a cycle outcome, not `MECHANISM`.

Counterexample:

```text
s ───► a ───► b ───► t
       ▲       │
       └───────┘        (a, b are one cyclic SCC)
```

D1 is true (`s→a→b→t` exists), but the only paths are preempted by the cycle check; malformed assessments do not produce `MECHANISM`.

**Correct condition for D6b:** prechecks pass, the assessment array is malformed, **`reach_A(s,t)`** holds, and at least one simple path that avoids every cyclic SCC reaches an edge where `assessEdge` consults the malformed data. If no such path exists, the cycle (or no-path, or ordinary assurance) outcome wins. `reach_A` is a reachability query on the acyclic induced subgraph (Lemma 2); locating a path that reaches a malformed edge is another reachability query on the same subgraph. D6b remains polynomial.

## 8. Result table

| ID | Result |
| --- | --- |
| D0 | polynomial (reachability in `valid` subgraph of `A`) |
| D1 | polynomial (reachability; `s == t` → no path) |
| D2 | polynomial (Lemma 1–3; prefix/suffix reachability) |
| D3 | polynomial (Lemma 4; walk + loop erasure) |
| D4 | polynomial (Lemma 5–6; triple scan + reachability) |
| D5 | polynomial **proof sketch**; proof and test obligations listed in §6 |
| D6a | polynomial in input size: pre-discovery prechecks, independent of reachability |
| D6b | polynomial: malformed assessments require `reach_A(s,t)` and a path reaching `assessEdge` |

**Consequence for N-176:** a compact exact algorithm exists for all classes; the exponential output is not required. Reading B is no longer blocked by a complexity barrier; the remaining choice is normative/API (Reading A vs B, replace vs version).

## 9. Owner options (final)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative. | No API change; `2^k` output accepted as availability risk. |
| **R2 — Reading B, exact** | Compact API; all classes polynomial (D5 proof obligations pending). | Potentially satisfies N-176, subject to the OQ-9 conditions and a separate audit revision; needs `T18-SPEC-01`, versioned API, corpus additions; D5 proof/tests first. **Preferred direction.** |
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
| **3.1** | D6 split into D6a (pre-discovery, independent of reachability) and D6b (edge-evaluation, requires `reach_A(s,t)` and a path reaching `assessEdge`) | corrects the overbroad claim that every mechanism outcome requires `reach_A(s,t)` |

## 11. Limits

- D5 needs the proof and test obligations listed in §6 before it is called certified polynomial.
- The D4 specification clarification is proposed, not applied; §8.6 remains unchanged. Terminal-origin semantics is a separate owner question (`OQ-11`), and Policy purity is the assumption `OQ-12`.
- The terminal-origin choice changes one D4 case; both are polynomial, but the proof text must name the chosen semantics.
- No status, register, `CORE-001.md`, source or test change is made here.
