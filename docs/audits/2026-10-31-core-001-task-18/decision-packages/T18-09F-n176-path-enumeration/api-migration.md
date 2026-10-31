# T18-09F — API Migration Proposal (Reading B, versioned)

**Status:** proposal for a subsequent, separately authorised PR. **No code change is made by this document.** `BindingResult` is not silently replaced.

## 1. Principle

Keep `BindingResult` (v1) unchanged and frozen. Add a versioned compact API (`v2`) alongside it. The legacy API remains supported during a deprecation window. Diagnostics are a separate, caller-controlled API.

## 2. Accepted witness is neutral until D5 is decided

`CanonicalPathWitness` is **not** used in the v2 type. The owner has not chosen whether the witness must be the `pathKey`-minimum path, a deterministic non-minimum path, or an arbitrary valid path. The type therefore carries an explicit `selection` discriminant.

```ts
type WitnessSelection =
  | 'PATH_KEY_MINIMUM'          // D5 closed: canonical under pathKey
  | 'DETERMINISTIC_NON_MINIMUM'; // deterministic, storage-independent, not pathKey-minimum

interface AcceptedPathWitness {
  readonly selection: WitnessSelection;
  readonly scope: LineageTraversalScope;
  readonly edges: readonly DeepReadonly<LineageEdge>[];
}
```

The type deliberately has **no** non-deterministic mode. §8.8 requires identical results for identical inputs independent of storage, declaration arrival and node traversal order, so a witness selected by a non-deterministic rule is not a valid implementation option. `ARBITRARY_VALID` is therefore not a type member; the valid fallback is `DETERMINISTIC_NON_MINIMUM`, whose selection rule must be specified and storage-order-independent.

No v2 guarantee of canonicality is exposed unless D5 is closed.

## 3. Proposed types (sketch, not implemented)

### 3.1 Compact validity result

```ts
type BindingResultV2 =
  | { readonly eligible: true;
      readonly acceptedWitness: AcceptedPathWitness;
      readonly perEdge: readonly EdgeAssuranceRecord[];
      readonly closure: MergeClosureResult; }
  | { readonly eligible: false; readonly kind: 'MECHANISM'; readonly error: MechanismFailure; }
  | { readonly eligible: false; readonly kind: 'CONTESTED';
      readonly contestedWitness: RejectionWitness; }
  | { readonly eligible: false; readonly code: BindingFailureCode;
      readonly rejection: RejectionWitness; };
```

`BindingFailureCode` is unchanged (no new code). `perEdge` records the assurance outcome for each edge of the accepted witness. `closure` is the immediate merge closure for that witness.

### 3.2 Rejection witness

```ts
type RejectionWitness =
  | { readonly kind: 'NO_PATH';
      readonly code: 'ERR_NO_TRAVERSAL_PATH';
      readonly candidate: IdentityVersionID;
      readonly origin: IdentityVersionID;
      readonly scope: LineageTraversalScope;
      readonly evidence: 'REACHABILITY_RECHECK'; }
  | { readonly kind: 'AUTHORITY_MISMATCH';
      readonly code: 'ERR_AUTHORITY_BINDING_MISMATCH';
      readonly targetParticipantId: ParticipantID;
      readonly candidateParticipantId: ParticipantID;
      readonly selectorExpression: string;
      readonly versionScheme: string;
      readonly versionLabel: string;
      readonly evidence: 'PRECHECK_FACTS'; }
  | { readonly kind: 'ASSURANCE';
      readonly code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED';
      readonly failingEdge: EdgeRef;
      readonly missing: readonly string[];
      readonly disallowed: readonly string[]; }
  | { readonly kind: 'CONTESTED';
      readonly code: 'CONTESTED';
      readonly failingEdge: EdgeRef;
      readonly contestedClaims: readonly string[]; }
  | { readonly kind: 'CLOSURE';
      readonly code: 'ERR_MERGE_BRANCH_UNSATISFIED';
      readonly failingBranch: EdgeRef; }
  | { readonly kind: 'CYCLE';
      readonly code: 'CYCLE_DETECTED';
      readonly cycleWitness: CycleWitness; };
```

#### 3.2.1 `CycleWitness` shape

```ts
interface CycleWitness {
  // A concrete, simple candidate->origin path whose node sequence includes
  // `cyclicNode`. It is the result of loop-erasing the reachability walk,
  // not the raw concatenated walk.
  readonly path: {
    readonly scope: LineageTraversalScope;
    readonly edges: readonly DeepReadonly<LineageEdge>[];
  };
  readonly cyclicNode: IdentityVersionID;
  readonly cycle: readonly IdentityVersionID[]; // one SCC entry from graph.cycles
  readonly verification: 'SIMPLE_PATH_AND_SCC';
}
```

**Deterministic construction and selection rule (contract):**

1. Work with `C = nodes in graph.cycles`. `graph.cycles` is already a deterministically sorted list of sorted SCCs; do not reorder it.
2. Choose the first `c ∈ C` (in `graph.cycles` order, then node order) with `reach(s,c)` and `reach(c,t)`.
3. Build `s⇝c` and `c⇝t` with BFS over adjacency whose outgoing edges are sorted by `(parent, relation)` (the order used by `adjacencyFor`), so predecessor choice is storage-order-independent.
4. Concatenate the two walks and **chronologically loop-erase** them with a vertex stack plus an `index: vertex -> stack position` table: start `[s]`; for each edge `(u,v)`, if `v` is in `index` at position `i`, pop everything after `i` and delete those indices; otherwise push `v` and record its index. Do **not** keep only first occurrences: that can invent a non-edge (e.g. `s→a→b→c→a→d→t` must become `s→a→d→t`, not `s→a→b→c→d→t`). Invariant after each edge: the stack is a contiguous directed walk with no repeated vertex, every adjacent pair is an edge actually traversed, and `index` maps every stack vertex to its exact position. The index table gives expected O(|V|+|E|) with a hash map, or O((|V|+|E|) log |V|) with a deterministic balanced tree; linear stack scans are O(|V|·|E|) and are not the intended algorithm.
5. Scan that final simple path in candidate→origin order and select the **first** node belonging to `C`. Lemma 4 guarantees that at least one such node survives; the original pivot `c` may have been erased, and the surviving cyclic node may be reached through a chain of later erasures, so never assume the original pivot survives.
6. `cycle` is exactly one entry of `graph.cycles` — the SCC containing the selected surviving node — not a union of SCCs.
7. `verification: 'SIMPLE_PATH_AND_SCC'` states which checks the caller should rerun.

**Determinism status:** the rule above is deterministic if steps 2–4 use the stated canonical order. If an implementation cannot guarantee that adjacency order or predecessor choice is storage-independent, it must record a missing determinism proof obligation; it must not claim §8.8 determinism. This rule concerns the `CycleWitness` only and does not close D5.

**Verification requirements (independently checkable):**

1. The implementation starts from the D3 reachability walk, chronologically loop-erases it (stack algorithm in the construction rule), and only then selects the witness node. The raw concatenated walk is never exposed.
2. `path.edges` is contiguous, scope-permitted, candidate→origin, and contains no repeated node (a simple path).
3. The path's node sequence contains `cyclicNode`.
4. `cycle` is exactly one entry of `graph.cycles` — the SCC containing the surviving `cyclicNode`.
5. `verification: 'SIMPLE_PATH_AND_SCC'` states which checks the caller should rerun.

This is an existence witness: it proves that some simple path touches `C`. It does not claim to be the `cycleForPath()` per-path union or a global union.

### 3.3 Evidence vs diagnostics vs repeated code

- **Independently verifiable evidence:** `ASSURANCE`, `CONTESTED` and `CLOSURE` witnesses can be re-checked by evaluating the named edge/branch against the supplied assessments, policy and context. `AUTHORITY_MISMATCH` carries the precheck facts so the caller can verify the mismatch directly.
- **NO_PATH:** the witness is **not** a cut certificate. It states `evidence: 'REACHABILITY_RECHECK'` and the inputs; verification reruns reachability in the supplied graph/scope. A cut certificate is a possible future addition, not part of v2.
- **CYCLE:** see §3.4; the witness is an existence witness, not a full per-path union.
- **Repeating the top-level code alone is not sufficient evidence.** Each rejection kind above carries at least the facts named in its branch.
- **Diagnostics** (the complete path list and all per-path outcomes) remain in the separate diagnostic API (§4), not in `RejectionWitness`.

### 3.4 Cycle witness scope

`cycleForPath()` in the current code computes a **per-path union**: for one path, it unions every SCC whose node set intersects that path and sorts the nodes. It does not compute a global union over every discovered path.

The v2 witness is deliberately narrower: a **minimal existence witness** in the shape defined in §3.2.1, with deterministic cyclic-node selection — one concrete, simple candidate→origin path containing the first `C` node on the **final loop-erased path**, plus the SCC entry containing that surviving node. The path is the loop-erased result required by the D3 proof, not the raw concatenated reachability walk; the original reachability pivot may be erased. It does **not** promise:

- the per-path union produced by `cycleForPath()` for any particular legacy path;
- a global union over all cyclic paths;
- a minimum-cardinality cycle.

If a caller needs legacy diagnostic equivalence, it must use the v1 `details.perPath` records. v2 must not be documented as preserving those per-path unions unless that behaviour is actually implemented.

## 4. Diagnostic enumeration (separate API)

```ts
function discoverPathsDiagnostic(
  graph, scope, candidateID, originID,
  options?: { readonly limit?: number }
): Result<PathSetDiagnostic>;
```

- Returns paths in `pathKey` order.
- `limit` is caller-owned. If omitted, a documented default applies.
- Truncation is explicit: the result carries `truncated: boolean` and `returnedCount`/`totalCountEstimate?`.
- A truncated diagnostic result does **not** affect validity (L1). Validity is computed by the compact API, which never consults the diagnostic limit.
- No cap is applied to the validity API.

## 5. Functions

- `evaluateBindingV2(state, binding, candidateID, policy, ctx): BindingResultV2` — compact.
- `evaluateBinding` (v1) — unchanged, delegates or reimplements; kept for compatibility.
- `discoverPaths` (v1) — unchanged.
- `discoverPathsDiagnostic` — new, L3 only.

## 6. Witness selection modes

Three categories must be distinguished; only the first two are valid v2 modes:

1. **`PATH_KEY_MINIMUM`** — only if D5's exact encoding, oracle and invariance obligations are closed.
2. **`DETERMINISTIC_NON_MINIMUM`** — a deterministic rule (e.g., first DFS path under a fixed storage-independent traversal order), documented as non-minimum. This is the valid fallback while D5 is open.
3. **Arbitrary / non-deterministic** — any valid path chosen without a fixed rule. **Not a valid implementation option** under §8.8, because storage/arrival/traversal order could change the witness. It is not a member of `WitnessSelection` and must not be offered as an owner choice.

The owner decision is `owner-decision-summary.md` OD-3. The v2 API shape does not depend on which valid mode is chosen, but the documented guarantee does.

## 7. Compatibility and deprecation

- v1 types and functions remain exported and unchanged.
- v1 is marked deprecated in documentation only after v2 ships and conformance cases exist.
- B-3 (both diamond paths in `acceptedPaths`) remains valid for v1.
- New conformance cases are added for v2: accepted witness, rejection witnesses for each kind, diagnostic truncation, storage-order invariance.
- B-4/B-6 keep their v1 per-path assertions and gain L2-based assertions.

## 8. Exports

- Package root exports both v1 and v2 types/functions.
- No existing export is removed in the first versioned release.
- A future major version may remove v1 after the deprecation window.

## 9. What this proposal does not do

- Does not resolve A-8 or A-14.
- Does not introduce a new normative error code.
- Does not change `CORE-001.md`.
- Does not implement anything. Implementation requires a separately authorised PR after `T18-DEC-18` is approved.