# T18-09F — OQ-4 Complexity Adversarial Pass (revision 2)

**Status:** analysis only; **supersedes revision 1** of this pass. Revision 1 claimed NP-hardness for D2/D4/D6; an independent review showed that classification was wrong. **`T18-DEC-18` remains PROPOSED / OPEN.**
**Method:** state the exact decision problem, then give a polynomial argument. Where a reduction is attempted and fails, that is stated instead of a theorem.

## 1. Decision problems

| ID | Exact question |
| --- | --- |
| **D0** | Does a **fully valid** simple path exist? (primary acceptance / L1) |
| **D1** | Does any simple candidate→origin path exist within the scope? (`ERR_NO_TRAVERSAL_PATH`) |
| **D2** | Does a simple path exist whose **first** failing assurance edge has class X (invalid / contested)? |
| **D3** | Does a simple path exist that touches a node of a cyclic SCC? (`CYCLE_DETECTED` class) |
| **D4** | Does a simple path exist whose edges are all valid and whose merge closure fails at some non-origin merge node on it? (`ERR_MERGE_BRANCH_UNSATISFIED`) |
| **D5** | What is the canonical (minimum `pathKey`) fully valid simple path? (acceptance witness) |
| **D6** | Is there a path-scoped mechanism failure? |

## 2. Cycle-preemption lemma (the correction)

`validatePathWithIndex` runs in this order: shape → membership → **cycle check** (`cycleForPath`) → per-edge assurance → closure. A path containing any node of `graph.cycles` returns `CYCLE_DETECTED` **before** assurance or closure is evaluated.

**Lemma 1.** Every path that reaches assurance/closure classification contains no node in a cyclic SCC.

**Lemma 2.** The subgraph induced by nodes that are not in any cyclic SCC is a **DAG**: a directed cycle among them would be reported as an SCC by `buildLineageGraph`.

**Lemma 3.** In a DAG, a simple `s→t` path through an edge `u→v` exists **iff** `s⇝u` and `v⇝t`. Disjointness is automatic: a shared vertex between the two paths would create a directed cycle.

**Corollary.** D0, D2, D4 and D5 are decided on the acyclic induced subgraph and are polynomial; D6 does not exist as a path-scoped class (see §4). The earlier "NP-hard for D2/D4/D6" claim is **withdrawn**: the 2-disjoint-paths hardness requires cycles, and cycle-containing routes are exactly the ones preempted.

## 3. Class-by-class result

| ID | Result | Argument |
| --- | --- | --- |
| **D0** | **Polynomial** | Filter edges by assurance validity; reachability `candidate⇝origin` in the induced DAG. |
| **D1** | **Polynomial** | Scoped reachability; a walk reduces to a simple path by loop erasure (and `discoverPaths` returns no path when `candidate === origin`). |
| **D2** | **Polynomial** | By Lemma 3: reach `s⇝u` using only **valid** edges (so the first failure is on `u→v`), then `v⇝t` in the DAG. Two reachability queries. |
| **D3** | **OPEN — not established** | Existence of a simple `s→t` path through a node of a cyclic SCC. The earlier reduction from directed 2-disjoint paths **fails as sketched**: the hard 2DP instances carry cycles, and a T18 path touching any of them is preempted into the `CYCLE` class independently, so the reduction does not encode the intended question. Complexity for the exact T18 language is unknown. |
| **D4** | **Polynomial** | Closure is checked on the DAG. State `(merge node, outgoing path edge)`; a closure failure is observable only for a non-origin merge node with at least two parents (the path edge is excluded; every other parent edge is checked). With exactly two parents `m→p1` (path edge) and `m→p2` (failing branch), closure fails iff the path leaves `m` through `m→p1`. Isolated to the DAG, this is state reachability, polynomial. Note: the exclusion of the path edge is a **code fact** (`collectBranchFailure`), not a §8.6 literal statement. |
| **D5** | **Polynomial (proof sketch)** | On the DAG, greedy lexicographic minimisation works: pick the smallest next edge such that a valid completion still exists; the feasibility oracle is DAG reachability (the visited set is irrelevant because the DAG has no repeats), and closure state is `(node, outgoing path edge)`. At most `|E|` feasibility queries. A formal proof and tests are still required. |
| **D6** | **Does not exist** | No path-scoped mechanism failure is reachable in `evaluateBinding`. The only reachable `MECHANISM` results are input-scoped: candidate-array validation inside `assessEdge` and selector/candidate prechecks before discovery. A throwing `Policy` hook is **not** caught in `assessEdge`/`evaluateAssurance`; the exception propagates, so it is a caller bug, not a path-scoped mechanism outcome. `N176-13` is therefore withdrawn. |

## 4. Mechanism failures — the corrected reading

- **input-scoped:** malformed assessment array, invalid selector, candidate precheck; decided before or once, polynomial.
- **path-scoped:** none reachable through `evaluateBinding`. The earlier (a)/(b) choice in OQ-6/N176-13 was based on a failure mode that does not exist in the current code; it is withdrawn.
- A throwing `Policy` hook propagates as an exception (an uncaught caller error). If the owner wants a mechanism failure there, that is a **separate semantic change**, not part of N-176.

## 5. D5 canonical witness — corrected justification

The earlier text said the best-first prefix search is the polynomial strategy and that the visited-set oracle is polynomial. Both were imprecise:

- naive best-first can explore exponentially many dead-end prefixes;
- "product graph minus visited set" is not polynomial per query in general.

The correct argument is Lemma 2: a **valid** path lies in the acyclic induced subgraph, where the visited set is irrelevant and greedy edge-by-edge minimisation with DAG-reachability feasibility is polynomial. The best-first description remains a useful mental model but is not the complexity argument.

## 6. What this means for N-176

- **Acceptance** (D0/D5) is compact and polynomial (D5 still needs a formal proof/test).
- **Rejection for assurance and closure** (D2/D4) is compact and polynomial.
- **The only open complexity question is D3** (cycle-class existence). It matters for rejection only when the top-level code could be `CYCLE_DETECTED`: to return a lower code, the implementation must establish that no cycle-class path exists.
- Therefore Reading B is largely implementable compactly; the exponential worst case is confined to graphs where the cycle-class question has to be decided, and its exact complexity is unknown.

## 7. Owner options (revised)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative; N-176 conditional not triggered. | No API break; exponential output accepted as an availability risk; no D3 question. |
| **R2 — Reading B, exact** | Compact API; D0/D2/D4/D5 polynomial; D3 exact search (complexity open) or current-cycle-enumeration fallback for that class. | Satisfies N-176 except possibly the D3 class; D3's worst case must be stated, not hidden. **Preferred direction (OQ-1).** |
| **R3 — Reading B, semantic change** | Redefine the cycle-class verdict over expanded state/walks. | Polynomial, but changes observable results; needs `T18-SPEC-01` and corpus revision. |
| **R4 — Defer** | Keep N-176 PARTIAL; clarify §8.8 and D3 in `T18-SPEC-01`. | No decision now; honest about D3. |

**Recommendation (author preference): R2**, with D3 explicitly documented as the one open class; R1 is the fallback if a fully specified contract is required before any further proof work.

## 8. Explicit corrections to revision 1

| Revision-1 claim | Corrected statement |
| --- | --- |
| D2/D4 are NP-hard | Polynomial (cycle-preemption lemma). |
| D6 path-scoped mechanism is NP-hard | No path-scoped mechanism class exists; input-scoped only. |
| D3 reduction is NP-hard sketch | Reduction **unsound**; complexity not established. |
| Expanded-state walk threatens acceptance/closure | Repeated nodes imply a cycle, so such paths are preempted; the argument applies only to D3. |
| D5 needs the visited-set oracle | D5 works on the acyclic subgraph; greedy feasibility, proof sketch. |
| `N176-13` sub-decision needed | Withdrawn. |

## 9. Limits

- D5 is a proof sketch, not a theorem; it needs a formal write-up and an oracle test against full enumeration.
- D3 complexity is open; no claim is made in either direction.
- The D4 exclusion of the path edge is a code fact; the specification §8.6 text is broader ("all parent edges") and this discrepancy is itself worth a spec clarification.
- Nothing here changes N-176, the register, `CORE-001.md`, source, tests or statuses.
