# UIA-CORE-001 Rev 0.3.3 — Reference Implementation Plan (Rev E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A testable, pure, dependency-free reference implementation of UIA-CORE-001 Rev 0.3.3 (identity, credentials, lineage graph, continuity assessments, conditional version binding / traversal, local acceptance) passing the full §12 conformance corpus A-1…D-4 plus property-based invariance tests — with traversal exposed as three independently testable phases, **immediate** merge closure as the only normatively implemented closure depth, timestamp trust preserved as a four-outcome value with an explicit input-state model, **edge-bound** assessment applicability enforced nominally rather than structurally, and every semantic gap recorded as an ambiguity, never silently resolved.

**Architecture:** Pure applied-protocol library. All domain logic lives in `src/core/` as pure, deep-copied, deep-frozen (`DeepReadonly`), discriminated-union-returning functions with no Bun/Node/runtime-specific imports (portable to other JS runtimes). Deterministic traversal via explicitly sorted, memoized path discovery → path validation → merge closure validation. The target runtime is Bun 1.4.x: tests run with `bun:test` on TypeScript source; `tsc` remains the typecheck/build tool. `node:crypto` is never used in core — a pure-TS SHA-256 is cross-verified against a crypto implementation in tests (Bun's `node:crypto`-compatible module or Web Crypto), never in `src/core/`.

**Tech Stack:** Bun 1.4.x (runtime, package manager, test runner) + TypeScript 5 (strict, ESM via `NodeNext`). devDependencies (pinned exact): `typescript`, `@types/bun`, `@types/node` (type-only, for ambient Node typings used by cross-check tests), `fast-check`, `eslint@9` + `typescript-eslint`, `prettier`. Test runner: `bun:test` (zero runtime deps). Lockfile: `bun.lock`. Runtime dependencies: **none**.

**Spec:** `docs/CORE-001.md` (UIA-CORE-001 Rev 0.3.3, Candidate Draft Normative). Normative keywords MUST/MUST NOT/SHOULD/MAY per §0.2.

**Revision history:**
- **Rev B** — edge-bound assurance; no invented conflict semantics (BLOCKED); three traversal phases; scope matrix; strict canonicalization; ownership semantics; explicit temporal context; rich result unions; mechanisms-vs-semantics section.
- **Rev C** — unverified-claims semantics made explicit and spec-literal; timestamp selection vs trust separated; merge closure split into immediate (normative) vs recursive (BLOCKED); scope × closure internal contradictions removed; `evaluateBinding` receives `Policy` and `TemporalContext` explicitly; B-4 error classification justified against the exact fixture; `DeepReadonly<T>`; canonicalization hardened; compile-run strategy; Task 10/11 ordering fixed; Task 17 assertion-level verification.
- **Rev D** — temporal trust no longer collapses `trusted:false` into "unassessed" (four outcomes); `evaluateAssurance` accepts only an already edge-bound `ApplicableAssessments`; D-3 returns `INVALID` only when both compared timestamps are trusted; GC-18 reclassified as an aggregation; canonicalization rejects non-enumerable own props and array extra own props; normative vs mechanism error codes separated; B-5 promoted to a conformance case.
- **Rev E** — (1) temporal trust input model made explicit: a discriminated `TemporalTrustInput` with `ASSESSED / NOT_ASSESSED / UNAVAILABLE`, with a deterministic mapping to the four outcomes; timestamp mismatch and mechanism unavailability are distinct and both map to `TRUST_ASSESSMENT_UNAVAILABLE`; (2) temporal trust assessments bound to an exact assertion via `subject_ref` plus `field` + `timestamp_value`, so identical timestamps belonging to different subjects cannot be conflated; D-3 assesses `signed_at` and `compromise_effective_at` separately, the latter bound to its revocation record; the five standard timestamp kinds are not assumed to exhaust all timestamp-bearing fields; (3) `ApplicableAssessments` made genuinely edge-bound via a `unique symbol` brand constructible only through `assessEdge`, with runtime validation in `evaluateAssurance`; (4) minor corrections: B-5 no longer describes `unverified_claims` as negative evidence; `unknown` accepted only at untrusted input boundaries and validated before entering the domain model; lone surrogates validated in object keys as well as string values; `format` and `format:check` scripts separated; D-3 compromise-time trust bound to the exact revocation record.

---

## Global Constraints

Every task implicitly includes these:

1. **Normative source is CORE-001 Rev 0.3.3 only.** No CORE-002/003/004 implementation — only minimal interfaces / test doubles needed to validate CORE-001 boundaries (§14).
2. **No authority inheritance through identity lineage** (INV-ID-01, §2.1). No CORE-001 entity creates or implies an Authority Grant (§13 #1–4). No grant-producing API exists in `src/core/`.
3. **Core runtime independence:** `src/core/` MUST NOT import or use any runtime-specific API — neither `node:*` nor `bun:*` nor any Bun/Node global, filesystem, process, network, or environment API. Only language/runtime-agnostic constructs and WHATWG types (`TextEncoder`, `Uint8Array`, `crypto.subtle` only if explicitly approved as a cross-cutting primitive — default: pure-TS). Bun is the execution environment, not part of UIA domain semantics; runtime-specific functionality belongs in adapters/infrastructure outside `src/core/`. Enforcement: ESLint `no-restricted-imports` for `src/core/**` covering both `node:*` and `bun:*`, plus `tsc` with `types: []` in `tsconfig.core.json`.
4. **Discriminated unions** for every validation / traversal / temporal result; never bare `false`/`null`/thrown exceptions for semantic failures. **Normative error codes** are exactly: `ERR_INVALID_RELATION`, `ERR_INVALID_CARDINALITY`, `ERR_NO_TRAVERSAL_PATH`, `ERR_MERGE_BRANCH_UNSATISFIED`, `ERR_ASSURANCE_PREDICATE_UNSATISFIED`, `ERR_AUTHORITY_BINDING_MISMATCH`, `CYCLE_DETECTED`, `PARENT_UNRESOLVED`. **Mechanism errors** (selector-scheme incompatibility, canonicalization failures, ownership violations, unbranded `ApplicableAssessments`, etc.) live in a separate `ImplementationErrorCode` type and a separate `MechanismFailure` variant; they are never mixed into `UiaErrorCode` and never masquerade as normative protocol states.
5. **Immutable ownership:** public record types are recursive `DeepReadonly<T>` (not shallow `Readonly<T>`). Every record constructor performs a structural deep copy of caller-supplied input, then recursive deep freeze of the copy. Copy rejects (never silently converts): function-valued properties, symbol-keyed own properties, accessor properties, objects on non-`Object.prototype` prototypes (`Map`, `Set`, `Date`, class instances, null-prototype objects — documented choice), cyclic inputs. Records expose plain data arrays only. Mutating the caller's original object after construction MUST NOT affect the stored record (tested). Historical records can never be mutated by later events (§13 #5–8). **Untrusted input boundary:** public entry points MAY accept `unknown` at the boundary, but MUST validate it against the domain model before constructing any record; no `unknown` value may enter `src/core/`'s public record types unvalidated.
6. **Determinism** (§8.8): all graph/assessment iteration in lexicographic ID order. Results MUST NOT depend on: edge insertion order, node storage order, traversal implementation details, arrival order of an otherwise identical final set.
7. **Hashing scope** (§7.1): exactly `id, participant_id, version_label, version_scheme, declared_protocols, public_credentials, lineage, published_at`, built **field-by-field** into an explicit projection object (not whole-object serialization, not stripping). Wrappers/envelopes/signatures/ledger metadata/assessments/revocations/acceptance MUST NOT affect the hash.
8. **Strict canonicalization** (RFC 8785 / I-JSON data model): accepts only null, boolean, finite number, valid-Unicode string, array, plain object (`Object.prototype` only). Rejected with typed `CanonicalizationError` — never coerced, never silently omitted: `undefined` (top-level, property value, or array hole), `NaN`/`±Infinity`, `BigInt`, functions, symbols, accessor properties, symbol-keyed properties, **non-enumerable own string-keyed properties**, **arrays carrying any own property beyond integer indices**, sparse arrays, objects whose prototype is not `Object.prototype` (including null-prototype objects — documented choice), cyclic graphs, and strings (including **object keys**) containing lone surrogates / invalid Unicode (RFC 8785 §3.2.2.2; I-JSON RFC 7493 §2.1).
9. **No invented normative semantics.** Rev 0.3.3 gaps are either implemented strictly per literal text, exposed as a policy hook disabled by default, or **BLOCKED** (recorded, unimplemented, excluded from conformance claims). Blocked areas are listed in the register with proposed minimal clarifications.
10. **Temporal semantics** (§10): the five standard timestamp kinds (`asserted_at`, `signed_at`, `ingested_at`, `assessed_at`, `decided_at`) are distinct declared fields, but they are **not assumed to exhaust** every timestamp-bearing field that may require external trust assessment (e.g., `compromise_effective_at` in §4.4). Timestamps are keyed by an arbitrary field reference (`TemporalFieldRef`, a string; the five standard kinds are reserved well-known refs). There is no `now` parameter in core. **Timestamp selection and timestamp trust are separate:** `TemporalContext.basis` selects which declared field governs an operation (domain policy per §10.2); trust in a timestamp is supplied **only** as an externally assessed input. Trust is preserved as a four-outcome value — **never collapsed**: `TRUSTED` (input state `ASSESSED` with a matching, trusted assessment), `UNTRUSTED` (input state `ASSESSED` with a matching, untrusted assessment — a negative determination, not an absence), `UNASSESSED` (input state `NOT_ASSESSED`), `TRUST_ASSESSMENT_UNAVAILABLE` (input state `UNAVAILABLE`, or an `ASSESSED` input whose binding does not match the declared field/subject/value). The core MUST NOT treat a declared timestamp as trusted merely because it is present, and MUST NOT treat `UNTRUSTED` as `UNASSESSED`, nor `UNAVAILABLE` as `UNASSESSED`.
11. **Assessment semantics, spec-literal:** `unverified_claims` entries provide **no positive support** for `required_claims`, are **not refutation and not negative evidence**, and the absence of a required claim from `verified_claims` makes the requirement unsatisfied (`ERR_ASSURANCE_PREDICATE_UNSATISFIED`) — without establishing any negative finding about that claim (§6.2.2, §6.4, §8.5).
12. **Merge closure depth:** the normatively implemented rule is **immediate closure** — for every `MERGED_FROM` node on a selected path, all of that node's **direct parent edges** must satisfy the assurance requirement (§8.6 literal text «всех родительских рёбер этого merge-узла»). **Recursive closure** is **BLOCKED** — semantics not defined by Rev 0.3.3; tests in `tests/experimental/`, labeled non-conformance, excluded from §12 coverage.
13. **Merge closure and scope exclusion cannot co-occur** in the implemented contract: a merge node can appear on a selected path only under `FULL_ANCESTRY`; closure branches never encounter scope-excluded relations. Task 11 asserts this consistency.
14. **No "latest assessment wins"** (§6.3 #6): applicable-assessment selection is a caller-supplied `Policy` hook; a conservative default is shipped; newer assessments are never auto-promoted.
15. **Missing assessment never equals success** (§8.5, §13 #9); an untrusted positive conclusion never overrides a trusted negative one (§13 #10); conflict never triggers global deletion (§13 #11–12).
16. **Normative/mechanism separation:** in-memory ledger, default policies, selector grammar, pure-TS SHA-256, crypto/ledger test doubles are implementation mechanisms, not semantics; documented with versioning implications in `docs/implementation.md` Task 16. Mechanism-dependent behavior (e.g., selector grammar) has a documented version label.
17. **No unvalidated `unknown` in public domain records or semantic results (replaces prior GC 17):** No public domain record or semantic result may expose unvalidated `unknown`. Boundary adapters MAY accept `unknown` and MUST validate it before domain construction. No exported API may use `any`. (Naming: TypeScript identifiers mirror spec field names verbatim (`snake_case`, `SCREAMING_SNAKE`); public API is strongly typed.)
18. **Error aggregation across competing paths (NOT a normative precedence table):** per-path outcomes are computed independently and always preserved in `BindingResult.details.perPath` (each with its own code, including `CYCLE_DETECTED`). The top-level code is an aggregation whose only pinned combination is the one B-4 fixes; for every other combination A-8 remains open and the aggregation is documented as an implementation choice, not a normative rule. No combination may be silently dropped from `details`.

## Implementation Constraints — Final Gate Clarifications (Rev E)

These are implementation constraints, not normative changes. They do not alter the ambiguities register or the §12 corpus.

### TemporalContext subject scope

One `TemporalContext` is **not** scoped to a single `subject_ref`. Trust is looked up by the composite key `(subject_ref, field)` so that multiple subjects sharing an identical timestamp value cannot collide or reuse one another's trust result. Concretely:

- `TemporalContext.trust` is `Readonly<Record<string /* subject_ref */, Readonly<Record<TemporalFieldRef, TemporalTrustInput | undefined>> | undefined>>`.
- `TemporalContext` carries no single required `subject_ref`; operations that have one subject pass it explicitly to the trust-derivation helper `trustOutcome(ctx, subject_ref, field, declared_value)`.
- D-3 invokes `trustOutcome` twice: once for `SIGNED_AT` with subject = the credential/version, and once for the `compromise_effective_at` field with subject = the revocation record id (or credential+revocation composite). The two assessments are independent; neither may reuse the other's result.
- Test (Task 13): two subjects (e.g., two credentials) sharing the same `signed_at` value, where subject A's trust input is `ASSESSED/trusted:true` and subject B's is `ASSESSED/trusted:false` (or `NOT_ASSESSED`/`UNAVAILABLE`) → `trustOutcome` for A is `TRUSTED` and for B is `UNTRUSTED`/`UNASSESSED`/`TRUST_ASSESSMENT_UNAVAILABLE`; no cross-subject reuse occurs.

### TemporalFieldRef validation

Extension field references are validated at runtime before use:

- Standard refs (`ASSERTED_AT`, `SIGNED_AT`, `INGESTED_AT`, `ASSESSED_AT`, `DECIDED_AT`) are reserved well-known references; an extension ref MUST NOT redefine or collide with a standard ref's semantics.
- Extension refs MUST be non-empty and well-formed: match `/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/` (no whitespace, no control characters, no lone surrogates); empty, malformed, or colliding refs are rejected with `MechanismFailure` (code `E_TEMPORAL_FIELD_REF_INVALID`).
- Validation is applied at every boundary where a `TemporalFieldRef` is accepted (including `TemporalContext` construction and trust derivation).

### ApplicableAssessments runtime brand

- The `unique symbol` brand (`ApplicableAssessmentsBrand`) is **module-private** and is NOT exported through `src/index.ts` or any public barrel.
- The brand is created at runtime via `Object.defineProperty(obj, ApplicableAssessmentsBrand, { value: true, writable: false, enumerable: false, configurable: false })` — a real symbol property, not a type-only assertion.
- `assessEdge` is the sole constructor and deep-freezes the branded result before returning it.
- `evaluateAssurance` validates the brand at runtime: if `input?.[ApplicableAssessmentsBrand] !== true`, it returns `MechanismFailure { kind:'MECHANISM', code:'E_APPLICABLE_ASSESSMENTS_UNBRANDED', ... }` and performs no assurance logic.
- Tests (Task 8): a structurally identical plain object and an object carrying a forged ordinary string property (e.g., `{"__brand":"ApplicableAssessments"}`) are both rejected at runtime; only an object produced by `assessEdge` passes.

### B-5 trusted-assessor isolation (conformance assertions)

In `tests/conformance/b.test.ts` (B-5), the test MUST explicitly assert:

- the untrusted assessment is **excluded from the trusted applicable set** (it does not appear among the assessments `evaluateAssurance` consumes);
- policy narrowing (`Policy.applicableAssessments`) **cannot reintroduce** the untrusted assessment (hook output is intersected with the applicable set; a hook returning the untrusted assessment is silently discarded and reported, never consumed);
- the trusted assessor's missing verified claim is the **actual reason** for `UNSATISFIED` (`missing` contains that exact claim);
- **neither assessment is mutated** (deep-equality of both records before and after).

## Review Focus

1. **Runtime failure must not leak into identity** — D-1 (Task 14): byte-identical descriptor snapshot after rt-1 crash; rt-2 state `RUNNING`.
2. **Supersession must not rewrite history** — D-2 (Task 15) + Task 8 supersession deep-equality assertions.
3. **Immediate vs recursive closure distinction preserved** — corpus (B-4, B-6, B-7) satisfied by immediate closure only; recursive closure stays BLOCKED with experimental tests in `tests/experimental/`, excluded from conformance coverage.
4. **`unverified_claims` neither refutes nor supports** — Task 8 asserts all four parts explicitly and that `ERR_ASSURANCE_PREDICATE_UNSATISFIED` arises from *unverified* required claims without any negative finding being established.
5. **Timestamp presence ≠ trust, and `trusted:false` ≠ unassessed, and unavailable ≠ unassessed** — Task 13 asserts four distinct trust outcomes, the input-state mapping (including mismatch → unavailable), and that D-3's `INVALID` is produced only when both compared timestamps are `TRUSTED` per local policy.

---

## File Structure (final tree)

```
src/
  index.ts                  — public API barrel (typed exports only)
  core/
    primitives.ts           — branded IDs, DomainID, Timestamp, strict JsonValue, TemporalFieldRef
    ownership.ts            — DeepReadonly<T>, deepCopy, deepFreeze, copy validation, unknown-boundary validation helper
    entities.ts             — all §3–§9 records (DeepReadonly, copied, deep-frozen)
    errors.ts               — UiaErrorCode (8 normative), ImplementationErrorCode, Failure union, Result<T>, CanonicalizationError
    canonical.ts            — RFC 8785 JCS over the strict data model
    sha256.ts               — pure-TS SHA-256 (hex out)
    hashing.ts              — explicit §7.1 projection (descriptorHashInput) + urn:hash
    version-scheme.ts       — §3.2 scheme rules
    selector.ts             — minimal, versioned selector mechanism
    credential.ts          — usage + temporal-trust-separated signature semantics (§4, §10)
    lineage.ts              — graph build, cardinality, cycles, delayed parents (§5, §11)
    assessment.ts           — applicability by edge, supersession, assurance (§6)
    traversal.ts            — §8: discoverPaths / validatePath / validateMergeClosure + evaluateBinding
    acceptance.ts           — §9 records + lifecycle + policy hook
    ledger.ts               — append-only in-memory stores (mechanism)
tests/
  unit/
    canonical.test.ts       — RFC 8785 vectors + strict rejection cases (accessors, symbol keys, prototypes, cycles, lone surrogates in values AND keys, sparse arrays, non-enumerable own props, array extra own props)
    sha256.test.ts          — vectors + node:crypto cross-check
    hashing.test.ts         — §7.1 scope, exclusion effects, urn format, exact projection keys
    ownership.test.ts       — DeepReadonly assertions, copy-on-construct, deep freeze, rejection cases, unknown-boundary validation
    entities.test.ts        — field constraints, error discriminants, normative-vs-mechanism split
    version-scheme.test.ts
    selector.test.ts
    lineage.test.ts
    assessment.test.ts      — edge binding via brand (compile-time + runtime), supersession, unverified-claim semantics, assurance, hook narrowing
    traversal-phases.test.ts — three phases exercised independently
    credential.test.ts      — reason matrix, four trust outcomes, input-state mapping, binding, D-3/D-4 units
    acceptance.test.ts
  conformance/
    a.test.ts b.test.ts c.test.ts d.test.ts   — all 18 corpus cases including B-5
  property/
    traversal-invariance.test.ts
    merge-closure-dag.test.ts          — brute-force equivalence (immediate closure only)
  experimental/
    nested-merge-recursion.test.ts     — BLOCKED recursion interpretation; non-conformance
    origin-merge-closure.test.ts       — BLOCKED origin-node closure; non-conformance
docs/
  implementation.md         — architecture, phase contracts, coverage map, assumptions,
                              ambiguities register, mechanisms-vs-semantics, clarifications proposed
package.json  tsconfig.json  eslint.config.mjs  .prettierrc.json
```

## Key public interfaces (exact signatures)

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };
type Failure = SpecFailure | MechanismFailure;
interface SpecFailure { kind: 'SPEC'; code: UiaErrorCode; message: string; details?: Record<string, JsonValue>; }
interface MechanismFailure { kind: 'MECHANISM'; code: ImplementationErrorCode; message: string; details?: Record<string, JsonValue>; }
// UiaErrorCode = the 8 normative codes only; ImplementationErrorCode = mechanism errors
// (incl. S_SELECTOR_INCOMPATIBLE_SCHEME, E_APPLICABLE_ASSESSMENTS_UNBRANDED, canonicalization/ownership errors)

type DeepReadonly<T> = T extends readonly (infer A)[] ? readonly DeepReadonly<A>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

// ---- canonicalization ----
type JsonValue = null | boolean | string | number | readonly JsonValue[] | { readonly [k: string]: JsonValue };
function canonicalize(value: JsonValue): string;   // strict; unsupported inputs → CanonicalizationError
function sha256Hex(input: Uint8Array): string;
function descriptorHashInput(d: DeepReadonly<IdentityVersionDescriptor>): JsonValue;  // explicit 8-field projection
function descriptorHash(d: DeepReadonly<IdentityVersionDescriptor>): `urn:hash:sha256:${string}`;

// ---- temporal context: selection separate from trust (4 outcomes, explicit input states) ----
type TemporalFieldRef = TemporalBasis | (string & {});   // the five standard kinds are reserved well-known refs; other fields (e.g. compromise_effective_at) are allowed
type TemporalBasis = 'ASSERTED_AT' | 'SIGNED_AT' | 'INGESTED_AT' | 'ASSESSED_AT' | 'DECIDED_AT';
interface AssessedTrustResult {
  status: 'ASSESSED';
  field: TemporalFieldRef;            // which timestamp field this result assesses
  subject_ref: string;               // explicit subject/reference binding (e.g. credential id + version, or revocation record id)
  timestamp_value: Timestamp;         // the exact value assessed — result valid only for this value
  trusted: boolean;
  assessed_by: DomainID;
  assessed_at: Timestamp;
  evidence_refs: readonly string[];
  policy_ref: string;
}
type TemporalTrustInput =
  | { status: 'ASSESSED'; assessment: AssessedTrustResult }
  | { status: 'NOT_ASSESSED' }
  | { status: 'UNAVAILABLE'; reason?: string };
type TemporalTrustOutcome =
  | { status: 'TRUSTED'; assessment: AssessedTrustResult }              // input ASSESSED, binding matches, trusted === true
  | { status: 'UNTRUSTED'; assessment: AssessedTrustResult }            // input ASSESSED, binding matches, trusted === false — negative determination, NOT an absence
  | { status: 'UNASSESSED' }                                           // input NOT_ASSESSED (or no entry)
  | { status: 'TRUST_ASSESSMENT_UNAVAILABLE' };                        // input UNAVAILABLE, or ASSESSED with binding mismatch (field/subject/value)
interface TemporalContext {
  basis: TemporalFieldRef;                                                // which declared field governs this operation (domain policy, §10.2)
  declared: Readonly<Record<TemporalFieldRef, Timestamp | undefined>>;    // declared values for all timestamp-bearing fields in scope (standard + others)
  // Trust is keyed by (subject_ref, field) — NOT by field alone — so subjects sharing a timestamp value cannot collide.
  trust: Readonly<Record<string /* subject_ref */, Readonly<Record<TemporalFieldRef, TemporalTrustInput | undefined>> | undefined>>;
}
// Helper (pure): trustOutcome(ctx, subject_ref, field, declared_value): TemporalTrustOutcome — applies the binding rules of GC 10.
// Core derivation (deterministic, pure):
//   trust[field] absent or NOT_ASSESSED              → UNASSESSED
//   trust[field] UNAVAILABLE                        → TRUST_ASSESSMENT_UNAVAILABLE
//   trust[field] ASSESSED with assessment.field !== field
//     or assessment.subject_ref !== requested subject
//     or assessment.timestamp_value !== declared[field] → TRUST_ASSESSMENT_UNAVAILABLE  (mismatch is unavailable, never unassessed)
//   trust[field] ASSESSED, trusted === true         → TRUSTED
//   trust[field] ASSESSED, trusted === false        → UNTRUSTED
// A declared timestamp's presence is never trust; UNTRUSTED is never treated as UNASSESSED;
// UNAVAILABLE is never treated as UNASSESSED.

// ---- edge-bound assurance (nominal brand: constructible only via assessEdge) ----
declare const ApplicableAssessmentsBrand: unique symbol;   // module-private; NOT exported from src/index.ts
type ApplicableAssessments = {
  readonly [ApplicableAssessmentsBrand]: true;              // real runtime symbol property (Object.defineProperty), non-enumerable, frozen
  readonly edge: EdgeRef;
  readonly assessments: readonly DeepReadonly<ContinuityAssessment>[];
  readonly unresolved: boolean;
};
// Created only by assessEdge, which sets the brand via Object.defineProperty(..., {value:true, writable:false, enumerable:false, configurable:false})
// and deep-freezes the result. evaluateAssurance validates the brand at runtime.
interface EdgeRef { child: IdentityVersionID; parent: IdentityVersionID; relation: LineageRelationType; }
function assessEdge(edgeRef: EdgeRef, candidateAssessments: readonly ContinuityAssessment[], policy: Policy, ctx: TemporalContext): Result<ApplicableAssessments>;
  // sole constructor of a branded ApplicableAssessments; applicability computed INSIDE by subject/relation/parent triple
function evaluateAssurance(applicable: ApplicableAssessments, requirement: ContinuityAssuranceRequirement, policy: Policy, ctx: TemporalContext): AssuranceResult;
  // NO EdgeRef parameter: the edge is already bound inside `applicable`. Runtime guard: if the brand symbol is absent/invalid →
  // MechanismFailure { code: 'E_APPLICABLE_ASSESSMENTS_UNBRANDED' } (covers `as any` casts; compile-time test prevents literal construction).
  // AssuranceResult = {status:'SATISFIED'}
  //  | {status:'UNSATISFIED'; code:'ERR_ASSURANCE_PREDICATE_UNSATISFIED'; missing: readonly string[]; disallowed: readonly string[];
  //     note: 'required-claim-not-verified; no-negative-finding-established'}
  //  | {status:'CONTESTED'; contestedClaims: readonly string[]}   // reachable ONLY via configured Policy.conflictPredicate (BLOCKED A-4b, default undefined)

interface Policy {
  trustedAssessorDefault?: readonly DomainID[];
  applicableAssessments? (edgeRef: EdgeRef, assessments: readonly ContinuityAssessment[], ctx: TemporalContext): readonly ContinuityAssessment[];
  // §6.3 #6 hook: may NARROW the applicable set but never expand it. Core re-validates subject/relation/parent
  // membership of every returned item and silently discards (reports in details) any item not applicable to edgeRef.
  conflictPredicate?: (l: ContinuityAssessment, r: ContinuityAssessment, edgeRef: EdgeRef, ctx: TemporalContext) => boolean; // UNDEFINED BY DEFAULT — BLOCKED A-4b
}
interface LineageGraph { nodes: readonly IdentityVersionID[]; edges: readonly DeepReadonly<LineageEdge>[];
  unresolvedParents: readonly (readonly [IdentityVersionID, readonly IdentityVersionID[]])[]; cycles: readonly (readonly IdentityVersionID[])[] }

// ---- traversal: three independently testable phases ----
function discoverPaths(graph: LineageGraph, scope: LineageTraversalScope, candidateID: IdentityVersionID, originID: IdentityVersionID): Result<PathSet>;
  // Phase 1 — scope-permitted edges only; no path → {ok:false, code:'ERR_NO_TRAVERSAL_PATH'}; cycles are dead ends
function validatePath(path: Path, requirement: ContinuityAssuranceRequirement, policy: Policy, ctx: TemporalContext): Result<PathValidation>;
  // Phase 2 — every edge of THIS path: assessEdge + evaluateAssurance
function validateMergeClosure(path: Path, graph: LineageGraph, requirement: ContinuityAssuranceRequirement, policy: Policy, ctx: TemporalContext): Result<MergeClosureResult>;
  // Phase 3 — IMMEDIATE closure: for every MERGED_FROM node ON the path, all its direct parent edges.
  // No scope parameter: a merge node on a path implies FULL_ANCESTRY (its outgoing edges are MERGED_FROM),
  // so closure never traverses a relation excluded by scope — structural argument asserted in Task 11.
function evaluateBinding(
  state: { graph: LineageGraph; descriptors: readonly IdentityVersionDescriptor[] },
  binding: ConditionalVersionBinding,     // supplies assurance_requirement
  candidateID: IdentityVersionID,
  policy: Policy,                         // REQUIRED — no global policy
  ctx: TemporalContext,                   // REQUIRED — no implicit temporal context
): BindingResult;
  // BindingResult = {eligible:true; acceptedPaths: Path[]}
  //  | {eligible:false; code: 'ERR_AUTHORITY_BINDING_MISMATCH'|'ERR_NO_TRAVERSAL_PATH'|'ERR_MERGE_BRANCH_UNSATISFIED'|'ERR_ASSURANCE_PREDICATE_UNSATISFIED'|'CYCLE_DETECTED';
  //     details: { perPath?: readonly {path: Path; code: UiaErrorCode; missing?: readonly string[]; branch?: EdgeRef}[] }}
  // aggregation per Global Constraint 18: only the B-4-pinned combination is asserted by conformance; per-path details always preserved

// ---- credentials ----
function evaluateCredentialUsage(cred: CredentialDescriptor, usage: CredentialUsage): UsageResult;
  // UsageResult = {status:'USAGE_ALLOWED'} | {status:'USAGE_DENIED'; reason:'USAGE_NOT_DECLARED'} | {status:'USAGE_UNSUPPORTED'; reason:'USAGE_NOT_IN_ENUM'}
type SignatureVerificationOutcome =
  | { verdict: 'VERIFIED' }
  | { verdict: 'INVALID' }
  | { verdict: 'CRYPTO_UNAVAILABLE'; verifierError: string }
  | { verdict: 'CRYPTO_UNSUPPORTED' };
  // trust is reported separately (see validity.historical), never folded into the crypto verdict
type SignatureClaimResult = {
  claim: 'PARENT_SIGNATURE_MATCH';
  outcome: SignatureVerificationOutcome;          // cryptographic relation only (§4.1)
  validity: { historical: 'VALID' | 'CONTESTED_COMPROMISED' | 'INVALID' | 'KEY_LOST_POLICY_REQUIRED' | 'SUSPECTED_COMPROMISE_FLAGGED'
                      | 'TEMPORAL_TRUST_UNTRUSTED' | 'TEMPORAL_TRUST_UNASSESSED' | 'TEMPORAL_TRUST_ASSESSMENT_UNAVAILABLE';
              future_authorizable: boolean | 'POLICY_DEPENDENT' };
  // D-3: 'INVALID' is produced ONLY when (a) the crypto outcome is VERIFIED, (b) TemporalTrustOutcome for SIGNED_AT is TRUSTED,
  // (c) TemporalTrustOutcome for the compromise time (bound to the revocation record via subject_ref) is TRUSTED per local policy,
  // and (d) signed_at >= compromise_effective_at. Otherwise the corresponding TEMPORAL_TRUST_* status is reported and no INVALID is produced.
};
interface SignatureVerifier { evaluate(sig: SignatureRecord, cred: CredentialDescriptor): SignatureVerificationOutcome; } // injectable double
function evaluateHistoricalSignature(sig: SignatureRecord, cred: CredentialDescriptor, revocation: CredentialRevocationRecord | undefined,
  policy: SignatureTemporalPolicy, ctx: TemporalContext): SignatureClaimResult;

// ---- acceptance ----
function applyLifecycle(record: DeepReadonly<LocalAcceptanceRecord>, event: DeepReadonly<LocalAcceptanceLifecycleEvent>,
  previousState: AcceptanceLifecycleState, ctx: TemporalContext, policy?: LifecyclePolicy): Result<AcceptanceLifecycleState>;
```

---

## Tasks

### Task 1: Project scaffold (compile-run strategy)

**Files:** Create `package.json`, `tsconfig.json`, `tsconfig.core.json`, `eslint.config.mjs`, `.prettierrc.json`, `src/index.ts`, `tests/unit/scaffold.test.ts`.

**Interfaces:** Produces scripts `test`, `lint`, `format`, `format:check`, `typecheck`; establishes the compile/run contract used by every task.

**Compile/run contract (Bun 1.4.x):**
- `"type": "module"`; TypeScript `module: nodenext` / `moduleResolution: nodenext` for `tsc` typecheck/build.
- Cross-module imports inside `src/` and `tests/` use explicit `.js` suffixes (resolved by `tsc` and by Bun) — lint-enforced.
- `bun run test` = `bun test` — Bun's native test runner executes TypeScript source directly (no `tsc` compile step required for tests); `tsc` is still the type authority (`bun run typecheck`).
- `bun run build` = `tsc -p tsconfig.json` (optional, produces `build/`).
- `bun run typecheck` = `tsc --noEmit`. `tsconfig.core.json` covers `src/core/**` with `types: []` (no runtime types); lint rule bars `node:*` and `bun:*` imports under `src/core/`.
- No `tsx`/`ts-node`/`--experimental-strip-types`; Bun's native TS support is the only runtime TS execution path, and it is confined to tests/adapters, never to `src/core/`.
- **Formatting scripts are separate (review point 4):** `npm run format` writes formatting; `npm run format:check` verifies formatting without writing. Task 17 runs `format:check`, never `format`.

- [ ] **Step 1: Write failing test** — placeholder export exists and is typed.
- [ ] **Step 2: Run** `npm test` → fails.
- [ ] **Step 3: Scaffold** per contract above; devDeps exact-pinned (`typescript@5.x`, `@types/node@20.x`, `fast-check@3.x`, `eslint@9.x`, `typescript-eslint@8.x`, `prettier@3.x` — resolve at install, commit resolved).
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck && npm run format:check` → pass.
- [ ] **Step 5: Commit** `chore: scaffold typescript project (uia-core-001)`.

### Task 2: Error model, primitives, ownership (DeepReadonly, unknown boundary)

**Files:** Create `src/core/errors.ts`, `src/core/primitives.ts`, `src/core/ownership.ts`; Tests `tests/unit/entities.test.ts`, `tests/unit/ownership.test.ts`.

**Interfaces:** Produces `Result<T>`, `UiaErrorCode` (8 normative), `ImplementationErrorCode`, `Failure` union, `CanonicalizationError`, branded IDs, strict `JsonValue`, `TemporalFieldRef`, `DeepReadonly`, copy/freeze primitives, unknown-boundary validation helper; consumed everywhere.

- [ ] **Step 1: Failing tests** — every normative code from Global Constraint 4 present as a literal discriminant of `UiaErrorCode`; mechanism errors (incl. `S_SELECTOR_INCOMPATIBLE_SCHEME`, `E_APPLICABLE_ASSESSMENTS_UNBRANDED`) are `ImplementationErrorCode` literals and never appear in `UiaErrorCode`; `Result` narrows in a match. Ownership: (a) copy of a nested object is structurally equal, reference-disjoint at every level; (b) deep freeze rejects nested mutation; (c) mutating the caller's original after construction does not affect the copy; (d) rejection cases (never silent): function-valued property, symbol-keyed own property, accessor property, object on non-`Object.prototype` prototype, cyclic inputs. (e) type-level: public record literals assign to `DeepReadonly<Record>`. (f) **unknown boundary:** a helper `validateUnknown<T>(value: unknown, guard): Result<T>` is the only path by which untrusted input may enter a domain record; tests assert that an invalid `unknown` is rejected before any record is constructed, and that no domain constructor accepts `unknown` directly.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): result model with normative/mechanism error split, strict primitives, DeepReadonly ownership helpers, unknown boundary`.

### Task 3: RFC 8785 JCS + pure-TS SHA-256 (hardened)

**Files:** Create `src/core/canonical.ts`, `src/core/sha256.ts`; Tests `tests/unit/canonical.test.ts`, `tests/unit/sha256.test.ts`.

**Interfaces:** Produces strict `canonicalize`, `sha256Hex`; consumed by Task 4.

- [ ] **Step 1: Tests** — RFC 8785 Appendix vectors: key sorting (lexicographic UTF-16), nesting, string escaping (`\u2028`, `\\`, quote, control chars), number vectors (`333333333.33333329`, `1E+30`, `-0`, `1e-6`, rounding), idempotence. **Strict rejection cases:** `undefined` (top-level, property value), `NaN`, `±Infinity`, `BigInt`, functions, symbols, accessor properties, symbol-keyed properties, **non-enumerable own string-keyed properties**, **arrays carrying any own property beyond integer indices**, sparse arrays, non-standard prototypes (class instance, `Date`, `Map`, `Set`, null-prototype object — documented choice), cyclic object graphs (deterministic detection with an ancestor set → `CanonicalizationError`, not `RangeError`), lone surrogates / invalid Unicode in **string values and object keys** (RFC 8785 §3.2.2.2; I-JSON RFC 7493 §2.1).
- [ ] **Step 2: Run** → fail.
- [ ] **Step 3: Implement** — ECMAScript `JSON.stringify` number semantics, sorted-key recursion, UTF-8 bytes into SHA-256 (RFC §3.2.2.2). Pre-walk validation pass before serialization; non-enumerable own props and array extra own props rejected; lone-surrogate check applied to keys as well as values.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): hardened RFC 8785 canonicalization and SHA-256`.

### Task 4: Descriptor hash with explicit projection

**Files:** Create `src/core/hashing.ts`, extend entities; Test `tests/unit/hashing.test.ts`.

**Interfaces:** Produces `descriptorHashInput` + `descriptorHash`; consumes Task 3.

- [ ] **Step 1: Tests** — (a) projection key set is exactly the 8 §7.1 fields (assert key set); (b) present-`undefined` optional fields rejected at descriptor validation; (c) hash stable across construction key order; (d) wrappers (envelope/signature/ledger metadata/assessment/revocation/acceptance) leave the hash identical; (e) mutating any hashed field changes the hash; (f) `urn:hash:sha256:<64 hex>`.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): descriptor hash with explicit section-7 projection`.

### Task 5: Version schemes + selectors (versioned mechanism)

**Files:** Create `src/core/version-scheme.ts`, `src/core/selector.ts`; Tests `tests/unit/version-scheme.test.ts`, `tests/unit/selector.test.ts`.

**Interfaces:** Produces `validateVersionLabel`, `compileSelector`, `selectorMatches`; consumed by Tasks 6, 9.

- [ ] **Step 1: Tests** — SEMVER_2 official 2.0.0 cases; CONTENT_HASH non-empty (format unspecified — Ambiguity A-7); OPAQUE_TAG non-empty, no ordering. Selector grammar (**mechanism; version label `uia-ref-selector@1` documented and required in any assessment quoting it**): `=x`, `*`, `&&`-joined comparators `> >= < <= ^ ~`; range vs OPAQUE_TAG/CONTENT_HASH → incompatibility reported as `MechanismFailure` with `S_SELECTOR_INCOMPATIBLE_SCHEME` (never as a `SpecFailure`).
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): version schemes and versioned selector mechanism`.

### Task 6: Entities + structural validation (§5) — A-series

**Files:** Extend `src/core/entities.ts` (all record constructors: copy-on-construct → deep freeze), `src/core/lineage.ts` (`validateDescriptor`); Test `tests/conformance/a.test.ts`, `tests/unit/lineage.test.ts`.

**Interfaces:** Produces `Registry`, `validateDescriptor`; consumed by 7–9.

- [ ] **Step 1: Corpus tests A-1..A-5** — each asserts expected result, state effects, forbidden side effects per §12:
  - A-1: `VALID`; parent present and unchanged (deep-equal of registry record **and caller's pre-construction object**); no DEPRECATED concept; no credential copied; grant-free registry.
  - A-2: `ERR_INVALID_RELATION`; rejected edge absent from graph relations.
  - A-3: `VALID`; ancestor immutable; no ancestor credential duplication.
  - A-4: `ERR_INVALID_CARDINALITY`; descriptor NOT registered (registry deep-equal).
  - A-5: `VALID`; no merged authority/credential union.
- [ ] **Step 2: Run** → fail. **Step 3: Implement** — per-relation cardinality (per-type counts; mixed relation arrays legal — Ambiguity A-3/A-6), participant constraint, self-parent → `ERR_INVALID_RELATION`.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): frozen entities and lineage structural validation (A-series)`.

### Task 7: Lineage graph — delayed parents, cycles (§11) — C-series

**Files:** Modify `src/core/lineage.ts` (`buildLineageGraph`); Test `tests/conformance/c.test.ts`.

- [ ] **Step 1: Corpus tests** — C-1: orphan descriptor stored intact, link retained, `unresolvedParents` populated, no deletion/rewrite/exception. C-2: `V1 → V2 → V1` cycle detected exactly; declarations preserved; no throw; feeding into `evaluateBinding` yields `CYCLE_DETECTED`, never a success; read-only structural queries still answerable.
- [ ] **Step 2: Run** → fail. **Step 3: Implement** (sorted deterministic DFS). **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): lineage graph with delayed parents and cycle detection (C-series)`.

### Task 8: Assessments — edge binding via brand, unverified semantics, B-5 mechanism semantics (§6)

**Files:** Create `src/core/assessment.ts`; Test `tests/unit/assessment.test.ts` (mechanism-level), `tests/conformance/b.test.ts` (B-5 as a conformance case — see Task 10).

**Interfaces:** Produces `assessEdge`, `evaluateAssurance`, `Policy`; consumed by Task 9.

- [ ] **Step 1: Unit tests** —
  - **brand enforcement (review point 3):** `ApplicableAssessments` is a nominal type keyed by a `unique symbol` brand; the only runtime constructor is `assessEdge`. Compile-time test: an ordinary object literal (even with identical fields) does not type-check as `ApplicableAssessments`. Runtime test: `evaluateAssurance` receiving an unbranded value (via `as any`) returns `MechanismFailure { code: 'E_APPLICABLE_ASSESSMENTS_UNBRANDED' }` and never proceeds to assurance logic.
  - **edge binding:** applicability computed inside `assessEdge` by subject/relation/parent triple; a pre-filtered caller array cannot inflate applicability.
  - **hook narrowing:** `Policy.applicableAssessments` may narrow the applicable set but never expand it; core re-validates subject/relation/parent membership of every returned item and discards (reports in details) any item not applicable to that edge; discarded items never cause failure.
  - **unverified-claim semantics (spec-literal, review point 1):** requirement `{required_claims:['C1','C2']}` with applicable assessment `verified_claims:['C1']`, `unverified_claims:['C2']` → `UNSATISFIED` with `missing:['C2']`; tests pin all four parts: unverified ⇒ no positive support ⇒ requirement unsatisfied ⇒ `ERR_ASSURANCE_PREDICATE_UNSATISFIED`, and no negative finding about C2 is established (result carries no negative-evidence field; CONTESTED unreachable here).
  - **supersession:** exactly one predecessor; supersession cycle rejected; superseded record byte-identical after new registration; no "latest wins" — `Policy.applicableAssessments` hook with conservative default.
  - **conflict:** default (no `conflictPredicate`) can NEVER yield `CONTESTED` (blocked A-4b); a configured predicate is the only CONTESTED source; trusted-assessor filtering excludes non-assessor assessments entirely; a trusted assessor's assessment does not "win" merely by being newer or positive (§6.4).
  - **disallowed claims:** veto verified claims; `missing`/`disallowed` sets reported precisely.
  - **B-5 mechanism-level semantics (unit, review point 4):** trusted assessor `domain-auditor` issues an assessment with `unverified_claims:['SPEC_MISMATCH']`; `untrusted.org` issues a positive assessment; when the requirement's required claim is not verified by the trusted assessor, the requirement is unsatisfied, and the untrusted positive assessment does not override the absence of verification by the trusted assessor. `unverified_claims` is treated solely as "not verified" — never as negative evidence or a negative finding. (The normative fixture is exercised as a conformance case in Task 10 / `b.test.ts`.)
  - immutability + ownership contract for assessments.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): nominally edge-bound assessments with spec-literal unverified semantics and hook narrowing`.

**Approved implementation decisions (2026-10-31):**

- `src/core/temporal.ts` is added as a type-only prerequisite for `assessEdge`/`evaluateAssurance`: `AssessedTrustResult`, `TemporalTrustInput`, `TemporalContext`. No `trustOutcome`, trust derivation, runtime validation, or temporal tests — those remain Task 13.
- Supersession is a pure `registerAssessment(existing, successor): Result<readonly ContinuityAssessment[]>`. A supersession cycle returns a `SpecFailure` carrying the existing `CYCLE_DETECTED` code (no new code, no conflation with the Lineage cycle machinery). Existing assessments are copied/frozen and never mutated; there is no latest-wins selection.
- `ApplicableAssessments.unresolved` is `true` only when the final edge-applicable, policy-narrowed assessment set is empty.
- An assessment applies to an edge when `subject_version_id === edge.child`, `declared_relation === edge.relation`, and `edge.parent` is contained in `parent_version_ids`. One assessment with several parents may apply to several merge edges.
- Items discarded by policy narrowing are never exposed or consumed by assurance evaluation; no `discarded` field is added to the public type.
- `AssuranceResult` is `SATISFIED | UNSATISFIED | CONTESTED | MechanismFailure`; the unbranded guard returns before any assurance logic runs.
- Trusted assessors resolve as `requirement.trusted_assessors` → `Policy.trustedAssessorDefault` → empty set. There is no trust-all default.
- Applicable assessments are sorted by `assessment_id` before the policy hook and sorted again before storage; duplicate candidate ids in `assessEdge` are rejected as `E_UNKNOWN_BOUNDARY_REJECTED`.
- The local `EdgeRef` is frozen before it is passed to `Policy.applicableAssessments`; the stored `ApplicableAssessments.edge` is that same frozen value, so a hook cannot rebind the edge.
- `registerAssessment` also rejects a duplicate `assessment_id` and an unknown `supersedes_assessment_id` as `E_UNKNOWN_BOUNDARY_REJECTED`; only a genuine supersession cycle returns `CYCLE_DETECTED`.

### Task 9: Traversal Phases 1+2 — discovery, validation — B-1..B-3

**Files:** Create `src/core/traversal.ts`; Test `tests/conformance/b.test.ts` (B-1..B-3), `tests/unit/traversal-phases.test.ts`.

**Interfaces:** Produces `discoverPaths` / `validatePath` / `evaluateBinding(policy, ctx)`; consumed by Tasks 10–12.

- [ ] **Step 1: Tests** —
  - **phase independence:** `discoverPaths` answers scope-permitted reachability without consulting assessments; `validatePath` consumes a concrete path; both callable and failable independently; `evaluateBinding` orchestrates required `Policy`+`TemporalContext` (no hidden state — compile-checked).
  - B-1: exact anchoring; candidate `A@1.1.0` with verified CONTINUATION → `ERR_AUTHORITY_BINDING_MISMATCH`; grant double unchanged; no new grant (Ambiguity A-2).
  - B-2: required `[PARENT_SIGNATURE_MATCH, GOVERNANCE_REVIEWED]`; assessment verifies only the first → `ERR_ASSURANCE_PREDICATE_UNSATISFIED` with `missing:['GOVERNANCE_REVIEWED']`; version stays registered; declaration intact.
  - B-3 diamond: `eligible:true` with paths `D→B→A`, `D→C→A`; B/C gain no grant artifact.
- [ ] **Step 2: Run** → fail. **Step 3: Implement** — §8.3 prechecks; memoized sorted DFS; per §8.5 items 1–5 for validation.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): path discovery and validation as independent phases (B-1..B-3)`.

### Task 10: Immediate Merge Closure — B-4, B-5, B-6, B-7, phased results

**Files:** Modify `src/core/traversal.ts` (`validateMergeClosure`); Test `tests/conformance/b.test.ts` (B-4, B-5, B-6, B-7), `tests/unit/traversal-phases.test.ts` (phase contrast), `tests/experimental/nested-merge-recursion.test.ts` (BLOCKED, non-conformance).

**Interfaces:** No new API; completes the three-phase model under Global Constraints 12 & 18.

- [ ] **Step 1: Corpus tests with explicit classification —**
  - **B-4 fixture analysis (review point 6).** Graph: D `MERGED_FROM [B, C]`; B `FORKED_FROM` A; C `CONTINUATION` A; origin A. Candidate D. Discovered paths: `D→B→A` and `D→C→A`. Both `D→B` and `D→C` lie **on** discovered paths; relative to the surviving path `D→C→A` (whose edges all pass validation), the failing edge `D→B` is a **closure-only parent branch of merge node D** — §8.6's `ALL_BRANCHES_MUST_SATISFIED` normatively demands it (the same edge simultaneously fails path validation for path `D→B→A` and merge closure for path `D→C→A`). §12 B-4 fixes the top-level code for exactly this configuration: `ERR_MERGE_BRANCH_UNSATISFIED`. Tests assert: (i) top-level code is the **closure code** (per aggregation rule GC-18, scoped to surviving-path closure failure); (ii) **details preserve the path-level failure** (`perPath` entry for `D→B→A` with the assurance failure on `D→B`) — the two failure classes reported, never conflated; (iii) no partial eligibility shape exists.
  - **B-5 (conformance case, review point 4):** trusted assessor `domain-auditor` issues an assessment with `unverified_claims:['SPEC_MISMATCH']`; `untrusted.org` issues a positive assessment; local policy trusts `domain-auditor`. Asserted: refusal to satisfy the requirement when the trusted assessor's applicable assessment does not verify the required claim; the untrusted positive assessment does not override the absence of verification by the trusted assessor; `unverified_claims` is treated solely as "not verified" — never as negative evidence or a negative finding; no mutation of either assessment. Expected result: refusal (requirement unsatisfied) with the untrusted assessment recorded but ineffective. Forbidden side effects: no grant created; trusted assessment not overwritten; no auto-promotion of the newer/positive assessment.
  - **B-6:** `D→C→X` branch never reaches origin; `D→C` assessment missing → rejected; branch C validated though not leading to origin; code is the closure code, not `ERR_NO_TRAVERSAL_PATH`. *(Under immediate closure, the deeper edge `C→X` is NOT itself closed — see BLOCKED note.)*
  - **phase contrast:** a discovery-level failure fixture and a closure-level failure fixture assert mutually exclusive codes per invocation (`ERR_NO_TRAVERSAL_PATH` only from Phase 1; `ERR_MERGE_BRANCH_UNSATISFIED` only from Phase 3).
  - **B-7:** two ingest orderings (A,B,C vs C,A,B) → identical results incl. `acceptedPaths`; all 6 permutations of a 3-element assembly.
  - **BLOCKED / experimental (`tests/experimental/nested-merge-recursion.test.ts`):** extends B-6's graph with C itself `MERGED_FROM [E, F]`. Rev 0.3.3 §8.6 does not define closure depth inside branches; this file pins documented interpretation P-rec (immediate-only, spec-literal) and marks recursive expectations `test('BLOCKED (A-5, non-conformance):…')`. **Excluded from §12 conformance coverage** (Task 16/17).
- [ ] **Step 2: Run** → fail; **Step 3: Implement immediate closure (direct parent edges only) + per-path details + GC-18 aggregation.** **Step 4: Run** → pass (experimental file runs but does not gate conformance).
- [ ] **Step 5: Commit** `feat(core): immediate merge closure with per-path failure reporting (B-4..B-7); recursive closure BLOCKED`.

### Task 11: Scope × merge-closure internal consistency (review point 4)

**Files:** Create `tests/unit/scope-matrix.test.ts`, `tests/experimental/origin-merge-closure.test.ts`.

**Interfaces:** Consumes Tasks 5–10; no production changes expected.

- [ ] **Step 1: Tests** — consistency semantics (from Global Constraints 13, not convenience):
  - Fixture per relation combination (CONTINUATION chain, FORKED_FROM chain, MERGED_FROM fan) × all three scopes:
    - **CONTINUATION_ONLY:** only CONTINUATION edges traversable; candidates behind FORK or MERGE → `ERR_NO_TRAVERSAL_PATH`.
    - **CONTINUATION_AND_FORK:** merge relations excluded → candidate behind a merge node → `ERR_NO_TRAVERSAL_PATH`; assert `ERR_MERGE_BRANCH_UNSATISFIED` **structurally unreachable** in this scope (exhaustive small fixtures + generator check: no path can contain a MERGED_FROM edge).
    - **FULL_ANCESTRY:** all relations traversable; immediate closure applies to merge nodes on the path.
  - **"MERGED_FROM node on a path":** only possible under FULL_ANCESTRY; its closure edges are `MERGED_FROM` (in scope) — asserted.
  - **"closure branch containing a scope-excluded relation":** cannot occur — a closure branch's first edge is the merge node's `MERGED_FROM` edge, which is scope-permitted iff the path exists at all; deeper relations within a branch are only reachable via BLOCKED recursion (A-5), covered by the experimental file, not here. A regression test asserts the internal consistency invariant rather than a synthetic impossible case.
  - **origin is itself a MERGED_FROM node** (`tests/experimental/origin-merge-closure.test.ts`): whether §8.6 («проходит через») counts the terminal origin node as a closed node is **BLOCKED (A-11)**; the experimental file pins the conservative documented default (immediate closure includes the origin) and is labeled non-conformance, excluded from §12 coverage.
- [ ] **Step 2: Run** → observe; **Step 3: fix filters if needed**; **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `test: scope × closure consistency; blocked origin-closure pinned in experiments`.

### Task 12: Property-based tests (fast-check, brute-force equivalence)

**Files:** Create `tests/property/merge-closure-dag.test.ts`; augment `tests/property/traversal-invariance.test.ts`.

**Interfaces:** Consumes 6–11; production changes only on genuine engine bugs.

- [ ] **Step 1: Write property tests** —
  1. graph storage order irrelevant; 2. edge insertion order irrelevant; 3. assessment arrival order irrelevant (identical final sets);
  4. missing applicable assessment on a required edge → never `eligible:true`;
  5. historical descriptors unchanged after revocations/assessments/acceptance; 6. supersession leaves history unchanged;
  7. DAG generator with merge probability p>0: **memoized result == brute-force full path enumeration (≤ 7 nodes) for the IMMEDIATE-closure contract** — including the no-path / assurance / closure code distinction and GC-18 aggregation; extended beyond depth-1 branches is **excluded** (BLOCKED A-5);
  8. cyclic segments never yield `eligible:true`;
  9. static invariant: no `src/core/` module exposes grant-producing API.
- [ ] **Step 2: Run**; fix genuine bugs; document interpretation discoveries. **Step 3: Commit** `test(property): invariance, immediate-closure brute-force equivalence, immutability`.

### Task 13: Credentials — usage, temporal trust separation (4 input states, subject binding) — D-3, D-4

**Files:** Create `src/core/credential.ts`; Test `tests/unit/credential.test.ts`, `tests/conformance/d.test.ts` (D-3, D-4).

**Interfaces:** Produces `SignatureVerifier` double, `evaluateCredentialUsage`, `evaluateHistoricalSignature`, `SignatureTemporalPolicy`; consumes `TemporalContext` (Global Constraint 10).

- [ ] **Step 1: Unit + corpus tests** —
  - ownership: mutating caller-supplied records after evaluation cannot change verdicts;
  - usage: declared-usage denial (`USAGE_DENIED`), undeclared enum (`USAGE_UNSUPPORTED`);
  - reason matrix (§4.4.1): `ROTATION` → past signatures may remain historically `VALID` per policy (`future_authorizable` may be `'POLICY_DEPENDENT'`); `KEY_LOST` → `KEY_LOST_POLICY_REQUIRED` (distinct outcome; never boolean, never auto-failed/auto-passed); `SUSPECTED_COMPROMISE` → `SUSPECTED_COMPROMISE_FLAGGED` (marked for reassessment; not proof, not yet failure); `ADMINISTRATIVE` → no compromise implication;
  - **D-3 (trust-gated, subject-bound):** `signed_at=100`, `CONFIRMED_COMPROMISE`, `compromise_effective_at=80`:
    - when `TemporalTrustOutcome` for `SIGNED_AT` (subject bound to the credential/version) is `TRUSTED` **and** `TemporalTrustOutcome` for `compromise_effective_at` (subject bound to the **revocation record**) is `TRUSTED` per local policy → historical `INVALID` + claim status `CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE`;
    - when either trust outcome is `UNTRUSTED`, `UNASSESSED`, or `TRUST_ASSESSMENT_UNAVAILABLE` → the corresponding `TEMPORAL_TRUST_*` historical status is reported and **no `INVALID` is produced** (uncertainty preserved; comparing two numbers is not itself a historical conclusion);
    - descriptor + revocation record intact afterwards (forbidden side effects asserted);
  - `compromise_effective_at` present but evidence gate unsatisfied → `CONTESTED_COMPROMISED` (never silently accepted);
  - **D-4:** no `compromise_effective_at` → pre-revocation signature → `CONTESTED_COMPROMISED`; explicit assertion that the result is NOT the D-3 failure code — the system never infers `compromise_effective_at = revoked_at`;
  - revocation never deletes CredentialDescriptor or IdentityVersionDescriptor; historical-valid vs future-authorizable always reported separately (§4.4.2);
  - **trust input states (review point 1):** `ASSESSED` / `NOT_ASSESSED` / `UNAVAILABLE` inputs map deterministically to `TRUSTED` / `UNTRUSTED` / `UNASSESSED` / `TRUST_ASSESSMENT_UNAVAILABLE`; `UNAVAILABLE` input → `TRUST_ASSESSMENT_UNAVAILABLE`; `NOT_ASSESSED` input → `UNASSESSED`; `ASSESSED` with binding mismatch (field/subject/value) → `TRUST_ASSESSMENT_UNAVAILABLE` (never `UNASSESSED`); `ASSESSED` with `trusted:true` → `TRUSTED`; `ASSESSED` with `trusted:false` → `UNTRUSTED`;
  - **trust binding (review point 2):** an `AssessedTrustResult` whose `field`, `subject_ref`, or `timestamp_value` does not match the declared field/subject/value it is applied to is never reused — treated as `TRUST_ASSESSMENT_UNAVAILABLE`; the five standard timestamp kinds are not assumed to exhaust all timestamp-bearing fields (e.g., `compromise_effective_at` uses a non-standard field ref bound to its revocation record);
  - verifier failures: `CRYPTO_UNAVAILABLE` / `CRYPTO_UNSUPPORTED` distinct from `INVALID`.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `feat(core): credential semantics with explicit temporal trust input states and subject binding (D-3/D-4)`.

### Task 14: RuntimeInstance lifecycle — D-1

**Files:** Extend entities (registry + minimal event record; format deferred to CORE-002 per §3.3); Test `tests/conformance/d.test.ts` (D-1).

- [ ] **Step 1: Corpus test D-1** — two runtimes on `A@1.0.0`; rt-1 failure recorded as separate event; rt-2 `RUNNING` unchanged; descriptor byte-identical; no authority artifact changed.
- [ ] **Step 2: Run** → fail. **Step 3: Implement.** **Step 4: Run** → pass. **Step 5: Commit** `feat(core): runtime decomposition with separated events (D-1)`.

### Task 15: Local Acceptance + ruling preservation — D-2

**Files:** Create `src/core/acceptance.ts`, `src/core/ledger.ts`; Test `tests/unit/acceptance.test.ts`, `tests/conformance/d.test.ts` (D-2).

**Interfaces:** `createLocalAcceptanceRecord`, `applyLifecycle(…, ctx, policy?)`, `isAcceptable`; acceptance never gates generic interactions (§9.2).

- [ ] **Step 1: Unit tests** — decisions immutable (incl. vs caller-input mutation); events separate, never mutate decisions; transitions validated only relative to the previous state via injected policy — **no universal auto-transition** (§9.3); absent policy ⇒ events recorded, queries demand explicit policy; `TemporalContext.basis` selects which declared timestamp a lifecycle query uses (`effective_at` is declared, not trusted).
- [ ] **Step 2: Corpus test D-2** — historical ruling double stored; later revocation + superseding assessment: ruling byte-identical; superseded assessment byte-identical; fresh evaluation returns compromised/contested result while stored rulings remain untouched.
- [ ] **Step 3: Run** → fail. **Step 4: Implement.** **Step 5: Run** → pass. **Step 6: Commit** `feat(core): local acceptance records and lifecycle (D-2)`.

### Task 16: Docs

**Files:** Create `docs/implementation.md`.

- [ ] **Step 1: Write** —
  1. Architecture overview (module map, data flow, portability).
  2. Module/API reference (per file; signatures + semantics).
  3. **Three phase contracts** — discovery / validation / immediate merge closure: memoized DFS soundness vs brute-force enumeration, cycle guard, GC-18 aggregation (explicitly labeled as an aggregation, not a normative precedence table) with its B-4 derivation, explicit immediate-vs-recursive boundary.
  4. Test coverage mapping — every §12 corpus case ↔ test file/case ↔ spec subsection, **including B-5 as a conformance case**; **explicitly excluding `tests/experimental/` from conformance claims**.
  5. Assumptions register (A- numbering where implementable decisions exist).
  6. **Ambiguities register v5** (verbatim from this plan, kept current).
  7. **Mechanisms vs semantics** — in-memory ledger (no CORE-002 format), replaceable default policies, versioned selector mechanism (`uia-ref-selector@1`), pure-TS SHA-256 (semantics pinned by RFC 8785+SHA-256, not by the implementation), seeded property generators, crypto/ledger test doubles; versioning implications stated; assessments depending on any mechanism must quote its version. Explicit note: temporal trust assessment is an external mechanism; the five standard timestamp kinds do not exhaust timestamp-bearing fields; non-standard fields (e.g., `compromise_effective_at`) are keyed by field ref.
  8. **Proposed minimal normative clarifications** (the BLOCKED items of the register, formulated as spec-change proposals).
- [ ] **Step 2: Commit** `docs: implementation reference, phase contracts, blocked semantics and mechanisms`.

### Task 17: Full conformance run + assertion-level verification

**Files:** None new.

- [ ] **Step 1:** `npm test` — unit + conformance A–D (18 cases, incl. B-5) + property + experimental (experimental run must pass as internal consistency, but does not count toward conformance).
- [ ] **Step 2:** `npm run lint` + `npm run typecheck` + `npm run format:check`.
- [ ] **Step 3: Assertion-level corpus verification (review point 8)** — for **each** of the 18 cases, read the test body and tick a three-part checklist (recorded in the final report):
  - expected **result** assertion (exact code/value from §12);
  - expected **state-effect** assertion (registry/graph/ledger state observable after the operation);
  - **forbidden-side-effect** assertion (immutability deep-equals / absence of grant artifacts / unchanged historical records).
  A case lacking any of the three parts fails the phase and must be fixed before claiming conformance.
- [ ] **Step 4: Final report** — implemented scope, files changed, public APIs, tests executed with results, known limitations, BLOCKED semantics (cannot be claimed conformant), deviations, readiness verdict.
- [ ] **Step 5:** Fixes as separate commits; tag `uia-core-001-refimpl-0.1.0`.

---

## Ambiguities Register (v5)

| # | Spec point | Status | Implemented behavior | Proposed smallest clarification |
|---|---|---|---|---|
| A-1 | §8.2 selector syntax | Open (mechanism) | versioned minimal grammar `uia-ref-selector@1`: `=x`, `*`, `&&`-joined `> >= < <= ^ ~`; OPAQUE_TAG/CONTENT_HASH exact-match only | spec amendment defining required selector syntax/range semantics |
| A-2 | §12 B-1 "Binding: EXACT" | Open | exact-match selector vs origin's label; otherwise-bindable candidate → `ERR_AUTHORITY_BINDING_MISMATCH` | add explicit binding-mode field or define exact-selector semantics |
| A-3 | §5.2 cardinality | Open | per-type counts; mixed-type `lineage` arrays structurally legal | clarify whether one descriptor may mix relation types |
| A-4a | §6.2.2/§6.4/§8.5 unverified-claims effect | **Resolved by spec literal text** | an unverified claim: no positive support, not refutation, not negative evidence; unverified required claim ⇒ requirement unsatisfied (`ERR_ASSURANCE_PREDICATE_UNSATISFIED`) with no negative finding established (tests in Task 8 pin all four parts) | none needed |
| A-4b | §6.4 "два применимых Assessment противоречат друг другу" — contradiction predicate | **BLOCKED** | `CONTESTED` exists in the result type; reachable **only** via explicitly configured non-default `Policy.conflictPredicate`; library ships no rule; default behavior never detects contradiction | define the conflict predicate (e.g., "incompatible verdicts for the same claim on the same edge by applicable trusted assessments") or add `disputed_claims` / defer to CORE-004 Findings with a CORE-001 pointer |
| A-5 | §8.6 closure **depth** inside branches (recursive closure) | **BLOCKED** | **immediate closure only** implemented (direct parent edges of merge nodes on the selected path — §8.6 literal text); nested-merge behavior pinned only in `tests/experimental/nested-merge-recursion.test.ts`, excluded from §12 coverage; implemented default is interpretation P-rec, not a conformance claim | amend §8.6 to define closure depth; options proposed: (a) immediate-only (current implementation), (b) recursive fixpoint over parent branches (`ALL_BRANCHES_MUST_SATISFIED` on all reachable branch edges) — spec must choose |
| A-6 | §5.2 mixed relation types | Open | per-type cardinality (see A-3) | fold into A-3 clarification |
| A-7 | §3.2 CONTENT_HASH label format | Open | non-empty only | define the label grammar |
| A-8 | error-code aggregation when multiple candidate paths fail differently (validation vs closure vs discovery) | Open (derived from B-4) | GC-18: per-path outcomes always preserved in `details.perPath` (each with its own code, incl. `CYCLE_DETECTED`); top-level code is an **aggregation**, not a normative precedence table; only the B-4-pinned combination (`ERR_MERGE_BRANCH_UNSATISFIED` for a surviving path whose merge node fails closure) is asserted by conformance | confirm or replace with a normative precedence rule in a spec clarifier |
| A-9 | §10.1 trusted-time mechanism for `signed_at` (and other timestamp-bearing fields) | **BLOCKED (external dependency)** | core never derives trust; trust arrives only as externally assessed `TemporalTrustInput` bound to a specific field/subject/value via `AssessedTrustResult`; four outcomes preserved (`TRUSTED / UNTRUSTED / UNASSESSED / TRUST_ASSESSMENT_UNAVAILABLE`); `UNTRUSTED` is never collapsed into `UNASSESSED`; `UNAVAILABLE` input and binding mismatch both map to `TRUST_ASSESSMENT_UNAVAILABLE` (never `UNASSESSED`); the five standard timestamp kinds do not exhaust timestamp-bearing fields (e.g., `compromise_effective_at` keyed by field ref bound to its revocation record); mechanism out of scope | define/defer the trusted-time mechanism (candidate: CORE-002) and the interface through which its results are submitted, including how an external mechanism signals unavailability |
| A-10 | §8.1 × §8.6 closure vs scope exclusion | Resolved by structural argument (GC-13) | merge node on a path ⇒ scope is FULL_ANCESTRY; closure edges are `MERGED_FROM` (in scope); narrower scopes: closure error structurally unreachable (asserted, Task 11) | confirm reading in a clarifier |
| A-11 | §8.6 does the **origin** node itself count as a closed node when it is `MERGED_FROM` | **BLOCKED** | conservative documented default: origin's parent edges closed (immediate); pinned only in `tests/experimental/origin-merge-closure.test.ts`, excluded from §12 coverage | clarify whether «проходит через» includes the terminal node |
| A-12 | §4.1 crypto verification | Out of scope by design | injectable `SignatureVerifier` (crypto outcomes VERIFIED/INVALID/CRYPTO_UNAVAILABLE/CRYPTO_UNSUPPORTED); trust reported separately in `validity.historical`; semantics operate on timestamps + policy | none — CORE-002/owner of the envelope |

### Semantics that remain BLOCKED — cannot be claimed conformance

1. **A-4b — conflict/CONTESTED detection:** Rev 0.3.3 does not define what makes two applicable assessments contradict; the library detects no contradiction by default. Any "CONTESTED works" claim requires the clarifier first.
2. **A-5 — recursive merge closure:** only immediate closure is implemented (spec-literal); behavior of nested merges inside non-origin branches is an unverified interpretation, excluded from conformance corpus and from property-test equivalence claims.
3. **A-11 — closure over a MERGED_FROM origin node:** unresolved; conservative default pinned only by an experimental test.
4. **A-9 — trusted-time mechanism for `signed_at` (and other timestamp-bearing fields):** trust can only arrive externally assessed and bound to a specific field/subject/value; the core cannot and does not evaluate trust itself, so any conformance claim involving "certified `signed_at`" requires the external mechanism the spec leaves undefined. (Note: Rev E preserves the *result* of an assessment — `UNTRUSTED` vs `UNASSESSED` vs `TRUST_ASSESSMENT_UNAVAILABLE` are now distinct input states and outcomes — but the *mechanism* producing it remains external.)

Everything else in the §12 corpus (A-1…D-4) is implementable from Rev 0.3.3's literal text and will be tested against the exact fixtures and side-effect contracts specified.

---

## Spec-Requirement Coverage Map (corpus)

| Corpus case | Spec section | Task | Test file |
|---|---|---|---|
| A-1..A-5 | §5.2 | 6 | `tests/conformance/a.test.ts` |
| B-1, B-2, B-3 | §8, §8.5, §8.7 | 9 | `tests/conformance/b.test.ts` |
| B-4, B-5, B-6, B-7 | §8.6, §6.4, §8.8 | 10 | same |
| C-1, C-2 | §11.1, §11.2 | 7 | `tests/conformance/c.test.ts` |
| D-1 | §1.3, §13 #5 | 14 | `tests/conformance/d.test.ts` |
| D-2 | §6.3, §9, §13 #8 | 15 | same |
| D-3, D-4 | §4.4.1 | 13 | same |
| Properties 1–8 (immediate-closure scope) | §8.8, §13 | 12 | `tests/property/*` |
| scope × closure consistency | §8.1, §8.6 | 11 | `tests/unit/scope-matrix.test.ts` |
| phase independence | §8.4–8.6 | 9, 10 | `tests/unit/traversal-phases.test.ts` |
| §7 hashing | §7.1–7.2 | 3, 4 | `tests/unit/hashing.test.ts` |
| §10 temporal | §10.1–10.2 | 13, 15 | `credential.test.ts`, `acceptance.test.ts` |
| §9 acceptance | §9.1–9.3 | 15 | `acceptance.test.ts` |
| recursion/origin-closure interpretation | §8.6 | 10, 11 | `tests/experimental/*` — **excluded from conformance** |

---

## Rev D → Rev E Change Log

1. **Temporal trust input model made explicit (review point 1):** `Partial<Record<TemporalBasis, AssessedTrustResult>>` replaced with `Readonly<Record<TemporalFieldRef, TemporalTrustInput | undefined>>` where `TemporalTrustInput` is a discriminated union `ASSESSED | NOT_ASSESSED | UNAVAILABLE`. Deterministic mapping table documented in Global Constraint 10 and the interface block; `UNAVAILABLE` input and binding mismatch both map to `TRUST_ASSESSMENT_UNAVAILABLE` (never `UNASSESSED`); `NOT_ASSESSED` maps to `UNASSESSED`.
2. **Temporal trust bound to the exact assertion (review point 2):** `AssessedTrustResult` gains `field: TemporalFieldRef` and `subject_ref: string` alongside `timestamp_value`; a trust result is valid only when field, subject, and value all match the declared assertion it is applied to. D-3 now assesses `signed_at` (subject bound to credential/version) and `compromise_effective_at` (subject bound to the revocation record) independently. `TemporalFieldRef` is `TemporalBasis | (string & {})`, so the five standard kinds are reserved well-known refs but do not exhaust timestamp-bearing fields (e.g., `compromise_effective_at`).
3. **`ApplicableAssessments` made genuinely edge-bound (review point 3):** converted from a public structural object type to a nominal type branded with a `unique symbol` (`ApplicableAssessmentsBrand`); `assessEdge` is the sole constructor; `evaluateAssurance` carries a runtime guard returning `MechanismFailure { code: 'E_APPLICABLE_ASSESSMENTS_UNBRANDED' }` for unbranded inputs. Compile-time and runtime tests added (Task 8). Policy-hook narrowing and core re-validation rules preserved.
4. **B-5 wording corrected (review point 4):** `unverified_claims` is no longer described as negative evidence or a negative finding anywhere in the plan or tests; it is "not verified" only, and the untrusted positive assessment does not override the absence of verification by the trusted assessor.
5. **`unknown` boundary clarified (review point 4):** public entry points MAY accept `unknown` at untrusted boundaries but MUST validate before constructing any domain record; no `unknown` may enter `src/core/` public record types unvalidated (Global Constraint 5, Task 2).
6. **Lone surrogates in object keys (review point 4):** canonicalization explicitly rejects lone surrogates / invalid Unicode in object keys as well as string values (Global Constraint 8, Task 3).
7. **Formatting scripts separated (review point 4):** `npm run format` (write) and `npm run format:check` (verify) are distinct; Task 17 runs `format:check` only (Task 1).
8. **D-3 compromise-time trust bound to the exact revocation record (review point 4):** the trust assessment for `compromise_effective_at` carries `subject_ref` = the revocation record id (or credential+revocation composite), so it cannot be reused across revocation records (Task 13).
9. **Interfaces, tasks, coverage map, and ambiguity register updated consistently** to reflect items 1–8; ambiguity A-9 expanded to cover input states, subject binding, and non-standard fields.

---

*Plan Rev E prepared 2026-10-30. No source code written. BLOCKED ambiguities (A-4b, A-5 recursive closure depth, A-11, A-9 mechanism) are explicitly not implementable claims until clarified; nothing will be resolved silently. Implementation starts only after Rev E is approved.*
