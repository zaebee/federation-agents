# T18-09F — API Migration Proposal (Reading B, versioned)

**Status:** proposal for a subsequent, separately authorised PR. **No code change is made by this document.** `BindingResult` is not silently replaced.

## 1. Principle

Keep `BindingResult` (v1) unchanged and frozen. Add a versioned compact API (`v2`) alongside it. The legacy API remains supported during a deprecation window. Diagnostics are a separate, caller-controlled API.

## 2. Accepted witness is neutral until D5 is decided

`CanonicalPathWitness` is **not** used in the v2 type. The owner has not chosen whether the witness must be the `pathKey`-minimum path, a deterministic non-minimum path, or an arbitrary valid path. The type therefore carries an explicit `selection` discriminant.

```ts
type WitnessSelection =
  | 'PATH_KEY_MINIMUM'          // D5 closed: canonical under pathKey
  | 'DETERMINISTIC_NON_MINIMUM' // deterministic, but not proven pathKey-minimum
  | 'ARBITRARY_VALID';          // any fully valid path

interface AcceptedPathWitness {
  readonly selection: WitnessSelection;
  readonly scope: LineageTraversalScope;
  readonly edges: readonly DeepReadonly<LineageEdge>[];
}
```

No v2 guarantee of canonicality is exposed unless D5 is closed. If the owner chooses `ARBITRARY_VALID`, the API must not call the field `canonical` or document it as minimum.

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

### 3.3 Evidence vs diagnostics vs repeated code

- **Independently verifiable evidence:** `ASSURANCE`, `CONTESTED` and `CLOSURE` witnesses can be re-checked by evaluating the named edge/branch against the supplied assessments, policy and context. `AUTHORITY_MISMATCH` carries the precheck facts so the caller can verify the mismatch directly.
- **NO_PATH:** the witness is **not** a cut certificate. It states `evidence: 'REACHABILITY_RECHECK'` and the inputs; verification reruns reachability in the supplied graph/scope. A cut certificate is a possible future addition, not part of v2.
- **CYCLE:** see §3.4; the witness is an existence witness, not a full per-path union.
- **Repeating the top-level code alone is not sufficient evidence.** Each rejection kind above carries at least the facts named in its branch.
- **Diagnostics** (the complete path list and all per-path outcomes) remain in the separate diagnostic API (§4), not in `RejectionWitness`.

### 3.4 Cycle witness scope

`cycleForPath()` in the current code computes a **per-path union**: for one path, it unions every SCC whose node set intersects that path and sorts the nodes. It does not compute a global union over every discovered path.

The v2 witness is deliberately narrower: a **minimal existence witness** — one concrete cyclic path (or a cyclic node `c` plus `s⇝c⇝t` witness) proving that some simple candidate→origin path touches `C`. It does **not** promise:

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

The v2 type supports three modes, chosen by the owner:

1. **`PATH_KEY_MINIMUM`** — only if D5's exact encoding, oracle and invariance obligations are closed.
2. **`DETERMINISTIC_NON_MINIMUM`** — a deterministic rule (e.g., first DFS path under a fixed traversal order), documented as non-minimum.
3. **`ARBITRARY_VALID`** — any fully valid path; weakest L2 determinism.

The owner decision is `owner-decision-summary.md` OD-3. The v2 API shape does not depend on which mode is chosen, but the documented guarantee does.

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