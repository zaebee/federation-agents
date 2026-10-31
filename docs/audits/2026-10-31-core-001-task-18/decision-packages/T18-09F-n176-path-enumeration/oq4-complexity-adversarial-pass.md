# T18-09F — OQ-4 Complexity Adversarial Pass

**Status:** analysis only. **This pass withdraws the polynomiality claim in `decision-ready-revision.md` §3 and §6.** `T18-DEC-18` remains PROPOSED / OPEN.
**Question:** for each rejection/failure class, is the decision problem the compact algorithm must solve polynomial, NP-hard, or not established?
**Method:** state the exact decision problem, then either give a polynomial argument or a reduction sketch from a known NP-complete problem. Where the reduction is not fully formalised for the exact T18 input language, that is stated.

## 1. Decision problems the compact algorithm must solve

| ID | Exact question |
| --- | --- |
| **D1** | Does any simple candidate→origin path exist within the scope? (`ERR_NO_TRAVERSAL_PATH`) |
| **D2** | Does a simple path exist whose **first** failing assurance edge has class X (invalid / contested)? |
| **D3** | Does a simple path exist that touches a node of a cyclic SCC? (`CYCLE_DETECTED`) |
| **D4** | Does a simple path exist whose edges are all valid and whose merge closure fails at some merge node on it? (`ERR_MERGE_BRANCH_UNSATISFIED`) |
| **D5** | What is the canonical (minimum `pathKey`) **fully valid** simple path? (acceptance witness) |
| **D6** | Does any simple path trigger a mechanism failure (path-scoped errors only)? |

The current semantics are **simple paths**: `collectPaths` never revisits a node, and `validatePathShape` rejects a repeated node.

## 2. Class-by-class result

| ID | Result | Basis |
| --- | --- | --- |
| D1 | **Polynomial** | Reachability in the scoped adjacency graph. Any walk can be reduced to a simple path by removing cycles, so reachability decides existence. |
| D2 | **NP-hard** (reduction sketch, structurally exact) | With exactly one INVALID edge `e* = u→v` and all other edges valid, a simple path with the first failure on `e*` exists iff a simple `s→t` path through `e*` exists, which is equivalent to two internally vertex-disjoint directed paths `s→u` and `v→t`. The directed 2-disjoint-paths problem is NP-complete (Fortune–Hopcroft–Wyllie 1980). T18 lineage graphs can encode an arbitrary directed graph: a node with out-degree 1 uses `CONTINUATION`; out-degree ≥ 2 uses `MERGED_FROM` (cardinality ≥ 2); one participant covers the same-participant rule. Other edges are marked valid with assessments. A full formal reduction would still have to pin the relation assignment and the assessment fixture, but no structural obstacle is apparent. |
| D3 | **NP-hard** (same reduction) | "A simple `s→t` path through a specified vertex `v`" is the same 2-disjoint-paths question. Make `v` cyclic with an auxiliary two-cycle `v↔w` off every `s→t` route; then D3 is exactly that question. |
| D4 | **NP-hard** (same reduction) | Mark every edge valid and give merge node `m` two parent edges. Arrange the closure check so that it fails only when the path enters `m` through a specified edge `m→p1` (the branch edge `m→p2` is valid, the branch edge `p1` fails). D4 then asks for a simple path through one specified edge — D2 again. Closure depends only on `(merge node, incoming path edge)`, so this can be encoded without path history. |
| D5 | **Open, no polynomial claim** | Naive best-first search revisits exponentially many prefixes when many lexicographically smaller dead ends exist. A greedy strategy with a feasibility oracle ("does a valid completion exist avoiding the visited set?") is plausible: the oracle is reachability in the product graph `(node, incoming edge)` minus the visited set, which is polynomial per query, and lexicographic minimisation needs at most `|V|` queries. That is a **proof sketch, not a proof**: the closure state, the exact `pathKey` order and the prefix-length ordering must be formalised and tested. This pass does not certify polynomiality. |
| D6 | **Mixed** | Input-scoped failures (malformed assessment array, invalid selector, candidate precheck) are decided once and are polynomial. Path-scoped failures (a policy hook that throws only for some edges) reduce to D2 and are **NP-hard**. |

## 3. The expanded-state walk problem

`(node, incoming edge)` reachability is not by itself a proof about simple paths. A path in the expanded graph can project to a **walk** with repeated nodes:

```text
s → a → m → b → m → t        (expanded state repeats m with a different incoming edge)
```

The projection is not a simple path, and loop-erasure can remove the very state (the incoming edge at `m`) that made closure or the first-failure class observable. Therefore:

- polynomial **state count** does not imply polynomial **visited-prefix count**;
- a reachability answer in the expanded graph must be proved to have a simple-path representative, or the algorithm must search prefixes and can be exponential.

This is the exact gap in `decision-ready-revision.md` §3.1: "reachability facts rather than path lists" was not a proof of polynomiality, and for D2/D3/D4 the underlying question is NP-hard.

## 4. What this means for N-176

An exact compact algorithm under the current **simple-path** semantics cannot be polynomial for D2/D3/D4 unless P = NP. Consequently:

- the claim "the rejection proof is polynomial" is **withdrawn**;
- Reading B can still be implemented exactly, but its worst case is exponential (state/prefix search, not path enumeration). Whether that satisfies §8.8's `MUST NOT` is a normative question — the text forbids *requiring explicit enumeration of all paths*, not exponential search;
- the benchmark (`k=16`) is a **target**, not a complexity proof; it says nothing about other graph families;
- D5's canonical witness is a separate problem from rejection; a correct canonical witness does not imply a polynomial search for it.

## 5. Owner options (replace the previous OQ-4 recommendation)

| Option | What it means | Consequence |
| --- | --- | --- |
| **R1 — Reading A (per-path result normative)** | Declare the full path list required evidence; N-176's conditional is not triggered. | No API break; B-3/B-4 keep their meaning; the `2^k` output remains an explicit availability risk, with any cap outside conformance. |
| **R2 — Reading B with exact but exponential rejection search** | Compact API; acceptance polynomial (if D5 is proven), rejection exact but worst-case exponential. | Satisfies the letter ("does not require enumerating all paths") only if the owner accepts exponential search as "equivalent"; worst case is not better asymptotically than enumeration and must be documented. |
| **R3 — Reading B with a semantic change (walk/state-based rejection)** | Redefine the rejection verdict over the expanded state graph. | Would be polynomial, but changes observable results (may report rejection where a simple path exists or vice versa) and requires `T18-SPEC-01` plus corpus revision; not equivalent to current semantics. |
| **R4 — Defer N-176; record the complexity barrier** | Keep N-176 PARTIAL; do not start implementation; clarify §8.8's intent ("not requiring enumeration" vs complexity) in `T18-SPEC-01`. | No decision now; honest about what is and is not provable. |

**No recommendation is made between R1–R4 in this pass.** The choice is normative: correctness/availability trade-off, or a deferred clarification. What is withdrawn is only the claim that R2 is polynomial.

## 6. Limits of this pass

- D2/D3/D4 reductions are sketched at the level of "the graph shape is encodable"; a formal reduction (exact relation assignment, assessments, single invalid edge) is still a proof obligation before NP-hardness is cited as a theorem for the exact T18 input language.
- D5 has a plausible polynomial strategy but no proof; it must not be called polynomial until proven and tested.
- Nothing here changes `N-176`, the register, `CORE-001.md`, source, tests or statuses.
