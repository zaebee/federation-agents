# T18-09A — Interaction Matrix: Conflict Semantics × Closure Depth

**Status:** Analysis only. DEC-06 and DEC-07 remain **OPEN**.
**Purpose:** Show how the two independent decisions interact without collapsing them into one decision.

The matrix is not a decision table. Each cell describes current behavior or an OPEN combination. “Current” means verified at `454af8c`; “OPEN” means the specification does not determine the result.

## 1. Matrix

| Conflict semantics | Immediate closure | Recursive closure | Bounded closure |
| --- | --- | --- | --- |
| **No automatic conflict** (Option B) | **Current default.** Edges evaluated: path edges + direct parent edges of merge nodes on the path. `CONTESTED` does not arise from conflict; there is no predicate in this row. Missing/disallowed still produce `UNSATISFIED`. A direct closure branch failure yields `ERR_MERGE_BRANCH_UNSATISFIED`. No deeper conflict. | **OPEN.** Same no-conflict behavior, but recursive closure evaluates more edges and can fail on deeper missing/disallowed assessments. Conflict remains undetected. A deeper failure can invalidate a path that immediate closure would accept. | **OPEN.** Same as recursive but limited by an undefined bound. No normative basis for the bound. |
| **Explicit domain predicate** (Option C) | **Current mechanism.** Edges evaluated: path edges + direct parent edges. `CONTESTED` can arise on a path edge (`PathValidation` status `CONTESTED`) and on a direct closure branch (`MergeClosureBranchFailure` reason `CONTESTED`). A closure conflict yields `ERR_MERGE_BRANCH_UNSATISFIED`, not necessarily top-level `kind: 'CONTESTED'`. Conflict uses the post-`Policy.applicableAssessments` set. A policy can hide conflict by dropping one side. **OPEN** on scope and pre/post narrowing. | **OPEN.** Predicate applies at every recursively visited edge; deeper conflicts can invalidate a path. Requires deterministic traversal, memoization/cycle handling, and a failure tree. A closure conflict still propagates as closure failure. **OPEN** on scope, pre/post narrowing, diagnostics and recursion semantics. | **OPEN.** Predicate applies only within the bound; a conflict beyond the bound is invisible. Bound semantics and policy surface are undefined. No normative basis. |
| **Broad automatic claim-array conflict** (Option A1) | **OPEN / not recommended.** Any verified-set difference on a path edge or direct closure branch becomes `CONTESTED`. This produces false positives for independent observations and makes multi-assessor conjunction requirements hard to satisfy. A closure conflict yields `ERR_MERGE_BRANCH_UNSATISFIED`. No deeper conflict. | **OPEN / not recommended.** Same broad predicate over more recursively visited edges, multiplying false positives. Requires recursion semantics and a failure tree. | **OPEN / not recommended.** Broad predicate within an undefined bound; results depend on the bound. No normative basis. |

## 2. Which edges are evaluated

### Immediate closure

- **Path edges:** `validatePathWithIndex` evaluates each edge on the selected path (`src/core/traversal.ts:471-526`).
- **Direct closure branches:** for every path edge whose child has a direct `MERGED_FROM` branch, `collectEdgeClosureFailures` evaluates every direct parent branch (`traversal.ts:607-628`), skipping only the exact path edge (`traversal.ts:589-591`).
- **Trigger semantics (OPEN):** current behavior treats a node with an incoming `MERGED_FROM` edge as a merge node regardless of the path-edge relation; whether this node-property trigger is normative is a separate sub-decision (`DEC-07-TRIGGER`).
- **Not evaluated:** parents of closure-only branches; nested merge nodes in those branches; cycles inside closure-only branches.

### Recursive closure

- Evaluates the same path edges plus the direct branches, and then continues through parent branches according to a stopping condition that CORE-001 does not define.
- The evaluated set is a superset of immediate closure. This is why recursive closure increases the set of edges where conflict, missing assessments, or disallowed claims can be found.
- It requires an explicit answer to: stop at origin, at visited nodes, at a depth bound, at non-merge nodes, or at a policy condition.

### Bounded closure

- Evaluates a policy- or implementation-defined prefix of the recursive set.
- The bound is not defined by CORE-001. A bound changes which conflicts and missing assessments are observable.
- It is not a normative option without an explicit specification rule.

## 3. Where `CONTESTED` can arise

| Location | Immediate | Recursive | Bounded |
| --- | --- | --- | --- |
| Path edge | `PathValidation` status `CONTESTED` (`traversal.ts:518-522`) | Same | Same within bound |
| Direct closure branch | `MergeClosureBranchFailure` reason `CONTESTED` (`traversal.ts:570-573`) → closure `UNSATISFIED` | Same, plus deeper branches | Same within bound |
| Deeper closure-only branch | Not evaluated | Can produce a branch failure if recursion reaches it | Only within bound |
| Top-level `kind: 'CONTESTED'` | Only when no accepted path, no closure failure, no cycle, and a path-level outcome is `CONTESTED` (`traversal.ts:783-788`) | Same aggregation; closure failures still outrank | Same within bound |

**Current behavior.** A conflict in a closure branch is reported as `ERR_MERGE_BRANCH_UNSATISFIED`, not necessarily as top-level `kind: 'CONTESTED'`. The closure failure carries the branch reason `CONTESTED` in `details.perPath`.

## 4. Closure failure propagation

- Any direct branch failure makes closure `UNSATISFIED` (`traversal.ts:650-667`).
- `evaluateOnePath` runs closure only after a `VALID` path-level outcome (`traversal.ts:709-731`). A path-level `CONTESTED` does not reach closure.
- `summarizePaths` lets an accepted path win; otherwise closure failure outranks cycle and contested (`traversal.ts:759-795`).
- Therefore, under immediate closure, a conflict on a non-path parent edge can still defeat a path through closure, but it is reported as a closure failure.
- Under recursive closure, a conflict deeper in a closure-only branch can defeat the path only if the recursion reaches that edge and the failure is retained in the result shape.

## 5. Accepted alternative paths

**Current behavior.** If any path is fully accepted, the result is `eligible: true` even if other paths are `CONTESTED` or have closure failures (`traversal.ts:760-765`). This follows §8.4/§8.7: a candidate may satisfy binding if at least one fully valid path exists.

**Interaction.** Conflict or closure depth on one path does not invalidate another fully valid path. Recursive closure can remove a path that immediate closure would accept, but it does not change the “one accepted path suffices” rule. Bounded closure can restore a path by not looking beyond the bound; that is a semantic consequence of the bound, not a conflict rule.

## 6. Why recursive closure increases the evaluated set

Immediate closure checks only direct parent edges of merge nodes on the selected path. Recursive closure continues through those branches. Every additional edge is another place where:

- an applicable Assessment may be missing;
- assurance may be unsatisfied;
- a disallowed claim may appear;
- a trusted contradiction may be found (if a predicate exists).

Thus recursive closure multiplies the effect of both missing-assessment failures and contradictory-assessment failures. It does not change the conflict predicate; it changes the set of edges to which the predicate is applied.

## 7. Why bounded closure has no current normative basis

CORE-001 §8.6 speaks of “all parent edges” and “all parent branches.” It does not define a depth limit, a policy parameter, or a stopping rule. A bound is an implementation or local-policy choice. It can be useful operationally, but it cannot be presented as a CORE-001 default without a specification amendment.

## 8. `ApplicableAssessments` impact

- **DEC-06:** no new `ApplicableAssessments` field is required for the current edge-scoped model. Conflict remains in `evaluateAssurance`; `assessEdge` remains the sole constructor and keeps the brand.
- **DEC-07 immediate:** no change to `ApplicableAssessments`. Closure uses `evaluateEdgeAssurance` per branch.
- **DEC-07 recursive:** a richer closure failure shape (tree or nested evidence) may be required; this is a `MergeClosureResult` change, not an `ApplicableAssessments` change.
- **DEC-07 bounded:** may require a policy/API surface for the bound; not an `ApplicableAssessments` change.

## 9. Independence of the decisions

DEC-06 and DEC-07 answer different questions:

- DEC-06: **what makes two Assessments contradict?**
- DEC-07: **which edges must be evaluated for closure?**

Every combination is conceptually possible:

- no automatic conflict + immediate closure (current default);
- explicit predicate + immediate closure (current mechanism);
- explicit predicate + recursive closure;
- no automatic conflict + recursive closure;
- broad automatic conflict + immediate/recursive/bounded.

Choosing one does not determine the other. The matrix marks combinations that are not normatively defined.

## 10. Unresolved combinations

| Combination | Why unresolved |
| --- | --- |
| Explicit predicate + recursive closure | Predicate scope, recursion stopping condition, cycle handling, failure tree, and pre/post narrowing are all undefined |
| Explicit predicate + bounded closure | Bound semantics and policy surface are undefined |
| Broad automatic conflict + any closure | No normative claim-incompatibility relation; false-positive risk |
| No automatic conflict + recursive closure | Recursive closure can fail on missing/disallowed deeper edges, but conflict remains undetected; readiness impact undefined |
| Any conflict semantics + closure conflict | Top-level aggregation reports closure failure, not necessarily `kind: 'CONTESTED'`; A-8 OPEN |
| Any conflict semantics + policy narrowing | Current conflict detection uses the post-narrowing set; whether narrowing may hide a conflict is OPEN |

## 11. Cross-cutting notes

- **A-8 remains OPEN.** The aggregation order (accepted path → closure → cycle → contested → assurance) is `ID-T10`, not a normative precedence table (`docs/implementation.md:1432`).
- **A-11 remains separate.** Origin closure is not part of DEC-07; see `docs/implementation.md:1468`, `:1662`, `:1785`.
- **N-079 / T18-DEC-10 remains separate.** Conflict detection does not implement contested-claim decision gating.
- **B-5 remains intact.** Untrusted Assessments are excluded before conflict detection.
- **Missing verified claims remain `UNSATISFIED`** when conflict detection does not short-circuit assurance evaluation; conflict-vs-missing precedence remains OPEN under `A-8`.
- **T18-02A remains unchanged.** This matrix does not alter C-1 emission or T18-DEC-15.
