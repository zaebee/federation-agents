# T18-09F — API Migration Proposal (Reading B, versioned)

**Status:** proposal for a subsequent, separately authorised PR. **No code change is made by this document.** `BindingResult` is not silently replaced.

## 1. Principle

Keep `BindingResult` (v1) unchanged and frozen. Add a versioned compact API (`v2`) alongside it. The legacy API remains supported during a deprecation window. Diagnostics are a separate, caller-controlled API.

## 2. Proposed types (sketch, not implemented)

### 2.1 Compact validity result

```ts
type BindingResultV2 =
  | { readonly eligible: true;
      readonly acceptedWitness: CanonicalPathWitness;
      readonly perEdge: readonly EdgeAssuranceRecord[];
      readonly closure: MergeClosureResult; }
  | { readonly eligible: false; readonly kind: 'MECHANISM'; readonly error: MechanismFailure; }
  | { readonly eligible: false; readonly kind: 'CONTESTED';
      readonly contestedWitness: RejectionWitness; }
  | { readonly eligible: false; readonly code: BindingFailureCode;
      readonly rejection: RejectionWitness; };
```

`BindingFailureCode` is unchanged (no new code). `CanonicalPathWitness` is a single `Path` (the `pathKey`-minimum fully valid path) plus its scope. `perEdge` records the assurance outcome for each edge of that path. `closure` is the immediate merge closure for that path.

### 2.2 Rejection witness

```ts
interface RejectionWitness {
  readonly code: BindingFailureCode;
  readonly failingEdge?: EdgeRef;          // assurance / contested
  readonly missing?: readonly string[];
  readonly disallowed?: readonly string[];
  readonly contestedClaims?: readonly string[];
  readonly failingBranch?: EdgeRef;        // closure
  readonly cycle?: readonly IdentityVersionID[]; // cycle
}
```

The witness must be sufficient to reproduce the top-level code without enumerating all paths. For `ERR_MERGE_BRANCH_UNSATISFIED` it carries at least one failing branch identity. For `CYCLE_DETECTED` it carries the combined cycle node set (current `cycleForPath` behaviour). For mechanism, the input-scoped failure.

### 2.3 Diagnostic enumeration (separate API)

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

## 3. Functions

- `evaluateBindingV2(state, binding, candidateID, policy, ctx): BindingResultV2` — compact.
- `evaluateBinding` (v1) — unchanged, delegates or reimplements; kept for compatibility.
- `discoverPaths` (v1) — unchanged.
- `discoverPathsDiagnostic` — new, L3 only.

## 4. Canonical witness selection

The witness is the `pathKey`-minimum fully valid path (D5). Until D5 is closed, the implementation may:
- compute it by the greedy algorithm if D5 is accepted as a proof sketch; or
- fall back to full enumeration for the witness only (preserving L1, sacrificing the polynomial claim).

The choice is an owner decision; the API shape does not depend on it.

## 5. Compatibility and deprecation

- v1 types and functions remain exported and unchanged.
- v1 is marked deprecated in documentation only after v2 ships and conformance cases exist.
- B-3 (both diamond paths in `acceptedPaths`) remains valid for v1.
- New conformance cases are added for v2: acceptance witness, rejection witness, diagnostic truncation, storage-order invariance.
- B-4/B-6 keep their v1 per-path assertions and gain L2-based assertions.

## 6. Exports

- Package root exports both v1 and v2 types/functions.
- No existing export is removed in the first versioned release.
- A future major version may remove v1 after the deprecation window.

## 7. What this proposal does not do

- Does not resolve A-8 or A-14.
- Does not introduce a new normative error code.
- Does not change `CORE-001.md`.
- Does not implement anything. Implementation requires a separately authorised PR after `T18-DEC-18` is approved.