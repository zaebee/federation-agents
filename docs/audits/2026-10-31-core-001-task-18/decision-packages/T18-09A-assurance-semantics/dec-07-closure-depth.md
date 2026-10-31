# T18-DEC-07 — Merge Closure Depth

**Status: OPEN. Recommendation only. Not approved.**
**Related ambiguity:** `AMBIG-A-5` (closure depth).
**Task 17:** N-112 **BLOCKED**; N-109, N-110, N-111 PASS.
**Related but separate:** `A-11` (origin closure), `A-8` (aggregation precedence), `A-10` (scope vs closure), `T18-DEC-15` (parent coverage).

## 1. Decision question

> What is the closure depth inside parent branches?

CORE-001 requires checking “all parent edges” of a merge node on the selected path. It does not state whether a parent branch that is itself a merge node must be closed in turn, or whether closure stops at the direct parent edges.

**Naming note.** `§12 A-5` in `docs/CORE-001.md:1179-1190` is “Valid Merge,” a structural declaration case. It is unrelated to `AMBIG-A-5`, which is closure depth. Do not conflate them.

## 2. Normative evidence

### 2.1 Path validation

**Normative requirement.** `docs/CORE-001.md:794-804` (§8.5):

Each path edge MUST:

1. match `traversal_scope`;
2. have an applicable `ContinuityAssessment`;
3. satisfy `assurance_requirement`;
4. contain no applicable disqualifying Claims;
5. have no unresolved conflict of applicable Assessments.

Absence of an Assessment is not successful validation.

**Interpretation.** Path validation is edge-by-edge. It does not define closure depth.

### 2.2 Merge closure

**Normative requirement.** `docs/CORE-001.md:806-824` (§8.6):

> “Если выбранный путь проходит через IdentityVersion, имеющий отношение `MERGED_FROM`, система MUST проверить все родительские рёбра этого merge-узла.”
>
> “Проверка распространяется на все родительские ветви, включая те, которые не ведут к `V_origin`.”
>
> “Для каждого родительского ребра требуется применимый Assessment, удовлетворяющий `assurance_requirement`.”
>
> “Это правило называется: `ALL_BRANCHES_MUST_SATISFY`.”
>
> “Невыполнение требования хотя бы одной родительской ветвью означает: `ERR_MERGE_BRANCH_UNSATISFIED`.”
>
> “Проверка merge closure не должна ограничиваться только родительскими ветвями, участвующими в конкретном пути к origin.”

**Interpretation.** The text is edge-oriented (“all parent edges of this merge node,” “for each parent edge”). “All parent branches” clearly includes non-origin branches. It does not explicitly say whether a branch that is itself a merge node is recursively expanded.

### 2.3 Diamond lineage

**Normative requirement.** `docs/CORE-001.md:826-846` (§8.7): each diamond path is validated independently; for each merge node on the selected path, all parent edges are checked; if any parent branch fails, the path is ineligible; one fully valid path suffices.

**Interpretation.** Per-path, per-merge-node direct checks. No nested merge depth.

### 2.4 Determinism and cycles

**Normative requirement.** `docs/CORE-001.md:848-870` (§8.8):

- the same declarations, applicable Assessments, revocations, requirements, local policies and temporal context MUST produce the same result;
- the result MUST NOT depend on edge storage order, declaration arrival order, traversal order, or internal optimization;
- a detected cycle in the local graph MUST be handled as a structural conflict, not as a crash.

**Interpretation.** Any recursive closure option must define deterministic traversal and cycle handling. Immediate closure already avoids recursion.

### 2.5 Conformance examples

**Normative example.** `docs/CORE-001.md:1253-1292` (§12 B-3): diamond `D MERGED_FROM B,C`; assessments `D→B`, `B→A`, `D→C`, `C→A`; all merge branches pass. This proves direct branch checking in a diamond, not nested depth.

**Normative example.** `docs/CORE-001.md:1294-1315` (§12 B-4): `D MERGED_FROM B,C`; `D→B` missing/disqualifying; expected `ERR_MERGE_BRANCH_UNSATISFIED`. This proves a direct branch failure fails the path.

**Normative example.** `docs/CORE-001.md:1337-1365` (§12 B-6): `D MERGED_FROM B,C`; `C→X` does not lead to origin; missing `D→C` rejects the path. This proves non-origin direct branches are checked. It does **not** require checking `C→X`.

**Normative example.** `docs/CORE-001.md:1367-1386` (§12 B-7): arrival order does not change the result.

**Task 17 note.** `docs/audits/2026-10-31-core-001-task-17/conformance-matrix.md:150` states that the B-6 test’s “deeper edge `C→X` is not checked” is immediate-closure behavior, **not** an additional normative requirement; recursive depth is `AMBIG-A-5 BLOCKED`.

### 2.6 What the specification does not define

**OPEN questions.** CORE-001 does not define:

- whether closure stops at direct parent edges or descends into their ancestry;
- whether a parent branch that is itself a `MERGED_FROM` node must be closed in turn;
- whether “branch” means one edge or a subtree;
- whether closure applies to merge nodes that appear only in closure-only branches;
- whether the terminal origin is closed when it is `MERGED_FROM` (`A-11`, separate);
- how cycles in closure-only branches are handled;
- whether closure is bounded by `traversal_scope`;
- the failure shape for recursive closure (tree vs flat list);
- resource bounds for deep/wide graphs.

**Interpretation.** “All parent edges of this merge node” and “for each parent edge” support the direct-edge reading. “All parent branches” could mean subtrees, supporting recursion. The specification does not resolve it.

## 3. Implementation evidence

### 3.1 Direct branches

**Current implementation behavior.** `directParentBranches` (`src/core/traversal.ts:527-540`) reads the **full graph adjacency** for `edge.child`, deduplicates by `(parent, relation)`, and sorts. It includes all relations, not just `MERGED_FROM`.

### 3.2 Closure trigger

**Current implementation behavior.** `collectEdgeClosureFailures` (`traversal.ts:607-628`) triggers closure when any direct branch of `edge.child` has relation `MERGED_FROM` (`:617`). The relation of the path edge itself is irrelevant; a merge node reached through `CONTINUATION` or `FORKED_FROM` still triggers closure.

**OPEN sub-decision (trigger semantics).** This is a node-property trigger: a merge node is an IdentityVersion with at least one incoming `MERGED_FROM` parent edge in the lineage graph. The relation of the path edge used to reach it does not matter. Whether §8.6 normatively requires this node-property reading, rather than requiring the path edge itself to be `MERGED_FROM`, is a separate question. It is not resolved by the immediate-vs-recursive depth choice. See §6 and §7.1.

### 3.3 Exact path edge exclusion

**Current implementation behavior.** `collectBranchFailure` (`traversal.ts:580-605`) skips only the exact `(parent, relation)` edge already validated by Phase 2 (`:589-591`). Different relations to the same parent are not collapsed. Failures are deduplicated by `(child, parent, relation)`.

### 3.4 Branch evaluation

**Current implementation behavior.** `evaluateClosureBranch` (`traversal.ts:541-574`) calls the same `evaluateEdgeAssurance`; a missing assessment, unsatisfied assurance, or `CONTESTED` result becomes a branch failure with reason `NO_APPLICABLE_ASSESSMENT`, `ASSURANCE_UNSATISFIED`, or `CONTESTED`.

### 3.5 No recursion

**Current implementation behavior.** `collectClosureFailures` (`traversal.ts:630-648`) loops only over `path.edges`; for each, it checks direct branches. It does not recurse into a branch’s own parents. `validateMergeClosure` (`traversal.ts:674-692`) is therefore **immediate-only**. The comment at `:669-672` states this explicitly.

Consequences:

- a closure-only branch that is itself a merge node is not expanded;
- a deeper missing assessment in a closure-only branch is not seen;
- a cycle in a closure-only branch is not traversed; `validateMergeClosure` does not use the cycle index;
- `validatePath` does check cycles on the path (`traversal.ts:429-453`, `:471-490`).

### 3.6 Scope independence

**Current implementation behavior.** Scope filters discovery only; closure uses full graph adjacency and is scope-independent (`docs/implementation.md:1440-1447`; `tests/unit/scope-matrix.test.ts`). A parent excluded by `traversal_scope` is still a closure obligation if it is a direct parent of a merge node on the path.

### 3.7 Evidence retention

**Current implementation behavior.** `closureResult` (`traversal.ts:650-667`) returns `SATISFIED` or `UNSATISFIED` with a **flat, sorted list** of branch failures. It does not retain a tree, so recursive depth would require a shape change.

### 3.8 One accepted path and aggregation

**Current implementation behavior.** `evaluateOnePath` (`traversal.ts:709-731`) runs closure only after a `VALID` path-level outcome. `summarizePaths` (`traversal.ts:759-795`) lets an accepted path win; otherwise closure failure outranks cycle and contested. A closure conflict therefore surfaces as `ERR_MERGE_BRANCH_UNSATISFIED`, not necessarily as `kind: 'CONTESTED'`.

### 3.9 Required behavior checklist

| Requirement | Current behavior | Evidence |
| --- | --- | --- |
| Activates closure when a path node has a direct `MERGED_FROM` parent | Yes | `traversal.ts:616-618` |
| Checks all direct parent edges, including relations other than `MERGED_FROM` | Yes | `traversal.ts:527-540`, `:621-626` |
| Skips only the exact path edge already checked | Yes | `traversal.ts:589-591` |
| Checks direct branches that do not lead to origin | Yes | `traversal.ts:527-540`; B-6 |
| Does not recursively expand merge nodes encountered only in closure-only branches | Yes | `traversal.ts:630-648`, `:669-672` |
| Uses full graph adjacency independently of discovery scope | Yes | `traversal.ts:527-540`; `docs/implementation.md:1440-1447` |
| Returns flat branch-failure evidence | Yes | `traversal.ts:650-667` |

### 3.10 Test evidence

`tests/unit/traversal-phases.test.ts`:

- `:332` — `reports the closure-only branch that fails assurance`
- `:358` — `is satisfied for a path without merge nodes`
- `:370` — `keeps path-level VALID distinct from closure failure`
- `:397` — `propagates mechanism failures instead of turning them into branch failures`
- `:413` — `does not descend into a closure-only branch`

`tests/conformance/b.test.ts`:

- `:122` — `B-4 closure-only branch failure preserves path-level and closure evidence`
- `:158` — `B-4 a merge node reached through CONTINUATION still closes its merge parents`
- `:219` — `B-4 mixed direct parent relations are all closed`
- `:239` — `B-6 non-origin direct branch fails closure without checking deeper edges`

Experimental, excluded from conformance:

- `tests/experimental/nested-merge-recursion.test.ts:12` — `BLOCKED (A-5, non-conformance): immediate closure does not descend into closure-only merge C`
- `tests/experimental/nested-merge-recursion.test.ts:23` — todo: recursive closure would require `C→E` and `C→F`
- `tests/experimental/origin-merge-closure.test.ts` — A-11 origin closure, separate.

Property/scope:

- `tests/unit/scope-matrix.test.ts` — scope vs closure.
- `tests/property/merge-closure-dag.test.ts` — P7 immediate-closure oracle; DAGs ≤ 7; oracle reuses implementation (`docs/implementation.md:1556`).
- `tests/property/traversal-invariance.test.ts` — P8 cycles; P1-P3 determinism.

## 4. Options

| Option | Meaning | Normative support | Main risk |
| --- | --- | --- | --- |
| **A — immediate** | For each merge node on the selected path, validate all direct parent edges, excluding the exact path edge; do not recurse into closure-only branches | Literal “all parent edges of this merge node,” “for each parent edge”; B-3/B-4/B-6; current behavior | False negatives: a nested merge or deeper unresolved ancestor in a closure-only branch is not seen |
| **B — recursive** | Continue through parent branches until a defined stopping condition, including nested merge nodes in closure-only branches | “All parent branches” could mean subtrees; not explicit | Requires depth, stopping condition, cycle handling, failure tree; can pull in broad ancestry and reject valid paths; DoS risk |
| **C — bounded/transitive** | Explicit bounded or policy-controlled closure depth | No normative basis for a depth parameter | Arbitrary bound changes semantics; false negatives beyond bound; policy-dependent results; new API |

## 5. Adversarial graph cases

| # | Case | A immediate | B recursive | C bounded | Normative status |
| --- | --- | --- | --- | --- | --- |
| 1 | Simple merge, all direct parent assessments present | SATISFIED | SATISFIED | SATISFIED (bound ≥ 1) | Direct edges settled; depth not tested |
| 2 | Direct parent assessment missing | UNSATISFIED (`NO_APPLICABLE_ASSESSMENT`) | UNSATISFIED | UNSATISFIED | §8.6 direct rule; PASS |
| 3 | Direct parent itself has a missing parent | SATISFIED (deeper edge not checked) | UNSATISFIED if recursion covers it | Depends on bound | **OPEN**; A-5 |
| 4 | Deep unresolved ancestor several levels below a merge | SATISFIED (not checked) | UNSATISFIED if recursion covers it | Depends on bound | **OPEN**; A-5 |
| 5 | Nested merge: immediate assessments pass, deeper merge fails | SATISFIED (C not expanded) | UNSATISFIED | Depends on bound | **OPEN**; `nested-merge-recursion.test.ts` pins A |
| 6 | Multiple merge nodes along selected path | Each direct parent set checked | Each plus descendants | Bounded | Direct cases settled; depth open |
| 7 | Same graph reached through different valid paths | Per path; accepted path wins | Per path; accepted path wins | Per path | §8.4/§8.7; no new ambiguity |
| 8 | Mixed relation parent edges | All direct branches checked regardless of relation | Same + recurse | Same up to bound | B-4 test; A-10 |
| 9 | Cyclic graph | Path cycle rejected; closure-only cycle not traversed | Must detect cycles in recursion | Must detect cycles/bound | A safe; B/C need explicit cycle rule |
| 10 | Merge node reached through non-merge relation | Recognized via full adjacency; direct parents closed | Same + recurse | Same | B-4 test; A-10 |
| 11 | Scope excludes a parent from discovery, closure may require it | Closure independent; direct parent checked | Closure independent; recurse | Same up to bound | A-10; discovery may still fail |
| 12 | Large/deep graph | O(path length × direct branches × assessments); bounded | Potentially exponential/stack risk | Bounded by policy | A safest; B/C need resource bounds |

## 6. Reviewed recommendation

**Recommendation (not approved): Option A — immediate closure.**

Proposed normative clarification (not approved):

> Closure is applied to the direct parent edges of every merge node on the selected path. All direct parent edges of that merge node are checked, regardless of their declared relation. Closure is not applied recursively to merge nodes that appear only in closure-only branches.
>
> For this rule, a merge node is an IdentityVersion that has at least one incoming `MERGED_FROM` parent edge in the lineage graph. Closure is triggered whenever the selected path passes through such a node, regardless of the relation of the path edge used to reach it.

**Separate OPEN sub-decision (`DEC-07-TRIGGER`).** The trigger sentence is not implied by immediate closure. If the owner does not approve the node-property definition, the clarification must be split and this package must not treat trigger semantics as resolved.

The text preserves the distinction:

- a direct parent edge of a merge node on the selected path MUST be checked;
- a merge node encountered only inside a closure-only branch is not recursively expanded.

Rationale:

1. The literal text is edge-oriented: “all parent edges of this merge node” and “for each parent edge” (`docs/CORE-001.md:808-812`). It does not say “recursively” or “transitively.”
2. B-3/B-4/B-6 exercise direct branches; B-6’s deeper edge is explicitly implementation behavior, not a normative requirement (`conformance-matrix.md:150`).
3. Immediate closure has clear termination, bounded cost, no cycle recursion, and preserves the existing `MergeClosureResult` shape.
4. Recursive closure requires defining stopping conditions, cycle handling, failure-tree shape, and scope interaction; that is a larger amendment and can reject valid paths by pulling in broad ancestry.
5. Bounded closure has no normative basis; adding a depth parameter would be implementation convenience, not a protocol rule.

**A-11 remains separate.** This recommendation does not decide whether a terminal origin that is `MERGED_FROM` must be closed. `docs/implementation.md:1468`, `:1662`, `:1785` keep A-11 BLOCKED.

**CORE-001 amendment required?** Yes: a depth clarification for N-112 and, separately, a trigger-semantics clarification if the node-property reading is approved. Without them, N-112 remains BLOCKED and `DEC-07-TRIGGER` remains OPEN.

## 7. If recursive closure is considered

**OPEN.** Option B would require normative definitions for:

1. **Termination:** what stops recursion — origin, already-visited nodes, a depth bound, a branch that is not a merge node, or a policy condition?
2. **Cycle handling:** how cycles in closure-only branches are detected and reported; whether they are `CYCLE_DETECTED`, a closure failure, or a structural conflict.
3. **Scope interaction:** whether recursion follows `traversal_scope` or full graph adjacency; whether a parent excluded from discovery can create a closure obligation recursively.
4. **Resource bounds:** maximum depth, maximum branches, memoization, and behavior on large/wide graphs.
5. **Failure-evidence structure:** a tree of branch failures vs a flat list; ordering and deduplication.
6. **Relationship to §8.5:** whether every recursively visited edge must have an applicable Assessment satisfying the same requirement, or only merge nodes’ direct edges.

Do not add a configurable recursion-depth parameter merely because it is convenient to implement.

### 7.1 Trigger semantics (separate OPEN sub-decision)

**OPEN.** Current implementation triggers closure on a node property: `edge.child` has at least one direct `MERGED_FROM` parent edge, regardless of the relation of the path edge used to reach it. `docs/CORE-001.md:808` says the path passes through an IdentityVersion “имеющий отношение `MERGED_FROM`”; it does not explicitly say whether that means the node has a `MERGED_FROM` parent edge or the path edge itself is `MERGED_FROM`.

The depth decision (immediate vs recursive) does not decide this. A separate owner decision must choose:

- **node-property trigger** (current): any path through a node with an incoming `MERGED_FROM` edge triggers closure;
- **path-edge trigger:** closure triggers only when the path edge itself is `MERGED_FROM`;
- another explicit rule.

The proposed clarification in §6 uses the node-property reading. That sentence is a separate proposal and must not be treated as approved by choosing immediate closure.

## 8. Consequences if approved

If Option A is approved:

- add a CORE-001 depth clarification via `T18-SPEC-01`;
- decide `DEC-07-TRIGGER` separately and, if the node-property reading is approved, add its clarification;
- keep the current `MergeClosureResult` shape;
- add/confirm tests for direct branches, mixed relations, non-origin branches, nested merge non-expansion, scope independence, cycles on path, and large graphs;
- N-112 can be re-audited after the clarification and evidence.

If Option B is approved:

- add a larger CORE-001 amendment defining recursion, termination, cycles, scope and failure shape;
- change `MergeClosureResult` or add a new recursive result type;
- add cycle/resource tests and property tests;
- update the experimental nested-merge test from todo to normative.

If Option C is approved:

- define the bound and its normative basis;
- add policy/API surface;
- test boundary behavior and DoS limits;
- do not present the bound as a CORE-001 default without explicit text.

## 9. Downstream tasks

- `T18-SPEC-01` — §8.6 clarification.
- Follow-up implementation/test task — only after approval.
- `T18-13` — readiness consumes the outcome; no automatic PASS.
- `T18-02B` — independent; blocked on the C-2 subject model, not on DEC-07.

## 10. Open questions

1. Does closure stop at direct parent edges or recurse into closure-only branches?
2. Must a nested merge in a closure-only branch be closed?
3. Does “branch” mean one edge or a subtree?
4. Is closure bounded by `traversal_scope`?
5. How are cycles in closure-only branches handled?
6. What is the failure-evidence shape for recursive closure?
7. Does a direct parent edge with a non-`MERGED_FROM` relation trigger further closure if its parent is a merge node?
8. Does closure trigger when the path reaches a merge node through a non-`MERGED_FROM` edge, or only when the path edge itself is `MERGED_FROM`?
9. Does the terminal origin count as a merge node for closure (A-11)?
