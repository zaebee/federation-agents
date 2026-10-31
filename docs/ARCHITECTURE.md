# UIA — Architecture

**Status:** Working Draft — describes the reference implementation, not the protocol.
Normative requirements live in [`CORE-001`](./CORE-001.md).
Product intent lives in [`PRD`](./PRD.md).

This document answers four questions:

- Which layers exist and what may depend on what?
- Which modules exist today, and which are planned?
- How does data move from an untrusted boundary into a domain decision?
- Which properties are architectural invariants rather than conventions?

## 1. Position in the specification series

This repository implements **UIA-CORE-001 only**. The other modules in the series exist as boundaries, not as code.

| Module       | Responsibility                                                                | In this repository |
| ------------ | ----------------------------------------------------------------------------- | ------------------ |
| `UIA-CORE-001` | Identity, credentials, lineage, assessments, local acceptance                | Implemented incrementally |
| `UIA-CORE-002` | Interaction & Event Ledger — events, envelopes, delivery, ledger              | Out of scope; adapters may implement it |
| `UIA-CORE-003` | Authority & Execution — principals, grants, capabilities, JIT authorization   | Out of scope; no grant-producing API exists here |
| `UIA-CORE-004` | Epistemics & Normative Acts — evidence, findings, rulings, reassessment       | Out of scope; evidence is referenced by id only |

The architecture must remain useful **without** CORE-002/003/004: identity, provenance, and local acceptance are meaningful even when no authority system and no ledger exist yet.

## 2. Layers

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Host application / domain policy            (outside this repository) │
│  • trusted assessors          • policy hooks        • signature verifier │
│  • clock, storage, network    • decisions to act    • key management     │
└──────────────────────────────────────────────────────────────────────┘
                    │ explicit inputs: Policy, TemporalContext,
                    │ verifier results, already-fetched records
┌──────────────────────────────────────────────────────────────────────┐
│ Public API — src/index.ts                                             │
│  typed barrel only; no unvalidated `unknown`, no `any`                │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Domain core — src/core/                                               │
│  pure functions • immutable records • discriminated results           │
│  no node:*, no bun:*, no filesystem, network, process, env, clock     │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ Adapters — planned, outside src/core/                                 │
│  signature verification • ledger persistence • transport • storage     │
└──────────────────────────────────────────────────────────────────────┘
```

| Layer            | Responsibility                                                       | May depend on            |
| ---------------- | -------------------------------------------------------------------- | ------------------------ |
| Domain policy    | Chooses trusted assessors, applies local rules, decides to act       | Public API               |
| Public API       | Stable typed surface, revision constant                              | Domain core              |
| Domain core      | CORE-001 semantics as pure functions over owned values               | Language/WHATWG only     |
| Adapters         | Untrusted I/O, crypto, persistence, transport                        | Public API, runtime APIs |

### 2.1. Boundary rules

1. **The core is runtime-free.** `src/core/` may not import `node:*`, `bun:*`, or Node core modules, and may not use the `process` or `Buffer` globals. This is enforced twice: `tsconfig.core.json` typechecks the core with `"types": []`, and ESLint restricts imports and globals under `src/core/`.
2. **Policy arrives as an argument.** There is no global policy object and no implicit `now`. The evaluation API — `evaluateBinding`, `assessEdge`, `evaluateAssurance` — takes `Policy` and `TemporalContext` explicitly; `evaluateHistoricalSignature` (credentials) will follow the same rule. No module may read them from ambient state.
3. **Adapters translate, they do not decide.** An adapter may parse JSON, verify a signature, or load a record, but it must hand validated domain values to the core — never raw transport objects.
4. **No layer may invent authority.** No function in this repository returns a grant, capability, or permission. Those belong to CORE-003.

## 3. Module map

Status reflects the repository, not the plan. `Planned` means the file does not exist yet.

| Module                    | Spec     | Status      | Responsibility                                                        |
| ------------------------- | -------- | ----------- | --------------------------------------------------------------------- |
| `core/primitives.ts`      | §1, §3, §10 | Implemented | Branded IDs, `Timestamp`, strict `JsonValue`, `TemporalFieldRef`, lone-surrogate check |
| `core/errors.ts`          | §0.2, §12 | Implemented | `Result<T>`, 8 normative codes, mechanism codes, `Failure` union        |
| `core/ownership.ts`       | §3, §13  | Implemented | `DeepReadonly`, `deepCopy`, `deepFreeze`, strict JSON validation, unknown boundary |
| `core/canonical.ts`       | §7.2     | Implemented | RFC 8785 JCS over the strict data model, SHA-256 composition           |
| `core/sha256.ts`          | §7.2     | Implemented | Pure TypeScript SHA-256                                                |
| `core/entities.ts`        | §3–§5    | Implemented | §3–§5 records with owned, deeply frozen constructors and strict boundary validation |
| `core/hashing.ts`         | §7.1     | Implemented | Explicit 8-field descriptor projection, `urn:hash:sha256:…`, pinned known-answer test |
| `core/version-scheme.ts`  | §3.2     | Implemented | `SEMVER_2` validation, `CONTENT_HASH`/`OPAQUE_TAG` non-empty rules, SemVer parsing and precedence |
| `core/selector.ts`        | §3.2, §8.2 | Implemented | Versioned `uia-ref-selector@1` mechanism with compiled-selector provenance |
| `core/credential.ts`      | §4, §10  | Planned     | Credential usage, revocation reasons, historical signature semantics    |
| `core/lineage.ts`         | §5, §11  | Implemented | §5.2 structural validation, graph snapshots, delayed parents, deterministic SCC cycle detection |
| `core/assessment.ts`      | §6       | Implemented | Edge applicability, policy narrowing, assurance evaluation, copy-on-write supersession |
| `core/temporal.ts`        | §10      | Partial     | Type contracts only (`TemporalContext` and trust inputs); trust derivation is Task 13 |
| `core/traversal.ts`       | §8       | Implemented | Path discovery, path validation, immediate merge closure, binding evaluation |
| `core/acceptance.ts`      | §9       | Planned     | `LocalAcceptanceRecord` and lifecycle transitions                       |
| `core/ledger.ts`          | —        | Planned     | Append-only in-memory stores — a **mechanism**, not protocol semantics  |

`src/index.ts` exports `UIA_CORE_001_REVISION` and re-exports the core barrel. The `ApplicableAssessments` and `CompiledSelector` brands remain module-private and are not exported through `src/index.ts`.

## 4. Data flow

### 4.1. Intake

The validation and ownership steps exist today for every §3–§5 record: `validateJsonValue`, the entity constructors, and `validateIdentityVersionDescriptor`; each rejects unknown fields and returns an owned, deep-frozen copy. Structural lineage validation, lineage graph construction, assessment evaluation and traversal also exist; credentials, acceptance and ledger remain planned. The flow is the contract every future record constructor must follow.

```text
untrusted input (JSON, transport, storage)
        │
        ▼
validateUnknown / validateJsonValue          ← boundary, may reject
        │
        ▼
record constructor: deepCopy → deepFreeze    ← ownership
        │
        ▼
pure evaluation (entities, lineage, assessment, traversal, acceptance)
        │
        ▼
Result<T> = { ok: true; value: T } | { ok: false; error: Failure }
```

Semantic failures — an invalid relation, an unsatisfied assurance predicate, a missing traversal path — are **values**, not exceptions. Callers narrow on `ok` and then on `error.kind`.

### 4.2. Descriptor hashing

> **Status:** implemented. `descriptorHashInput` and `descriptorHash` live in `hashing.ts`; the eight-field projection is pinned by a known-answer test.

```text
IdentityVersionDescriptor
        │  exactly §7.1 fields:
        │  id, participant_id, version_label, version_scheme,
        │  declared_protocols, public_credentials, lineage, published_at
        ▼
descriptorHashInput                        ← explicit projection, never whole-object
        │
        ▼
canonicalize (RFC 8785 JCS)                ← throws CanonicalizationError
        │
        ▼
TextEncoder → UTF-8 bytes
        │
        ▼
sha256Hex (pure TS)
        │
        ▼
urn:hash:sha256:<64 hex>
```

Wrappers, envelopes, message signatures, ledger metadata, later assessments, revocations, and acceptance records are **outside** the projection: they must not change the hash.

`canonicalize` throws instead of returning `Result` because it is a mechanism boundary with no protocol-level alternative outcome. Everything with a protocol-level meaning returns a discriminated union.

## 5. Core invariants

The table separates guarantees the repository already provides from properties required of modules that do not exist yet. Treating a target as an implemented guarantee is exactly what the threat model's review questions are meant to catch.

| #   | Invariant              | Status today | Where it is enforced / planned                                              |
| --- | ---------------------- | ------------ | --------------------------------------------------------------------------- |
| A1  | Purity                 | Implemented for existing primitives | `canonical.ts`, `sha256.ts`, `ownership.ts`; required of every future module |
| A2  | Determinism            | Implemented for current modules | Canonicalization, SHA-256, graph construction and traversal are deterministic; B-7 covers assessment arrival permutations |
| A3  | Ownership              | Implemented  | Every §3–§5 constructor copies and freezes; ownership helpers are unit-tested |
| A4  | Error separation       | Implemented  | `errors.ts` type split, asserted in `tests/unit/entities.test.ts`            |
| A5  | Explicit context       | Implemented | `Policy` and `TemporalContext` are explicit parameters of `assessEdge`, `evaluateAssurance`, `validatePath` and `evaluateBinding` |
| A6  | Edge-bound assessments | Implemented  | `ApplicableAssessments` brand plus `WeakSet` provenance, validated by `evaluateAssurance` |
| A7  | Four trust outcomes    | Target       | Planned `credential.ts` and temporal model                                   |
| A8  | Unknown boundary       | Implemented  | `validateUnknown`, `validateJsonValue` and the §3–§5 entity constructors; adapters are not written yet |

A2 does not require enumerating all paths: memoization and dynamic programming are allowed, provided the result is identical.

## 6. Result and error taxonomy

**Normative codes** (`UiaErrorCode`, 8 total) describe protocol states defined by the specification:

`ERR_INVALID_RELATION`, `ERR_INVALID_CARDINALITY`, `ERR_NO_TRAVERSAL_PATH`, `ERR_MERGE_BRANCH_UNSATISFIED`, `ERR_ASSURANCE_PREDICATE_UNSATISFIED`, `ERR_AUTHORITY_BINDING_MISMATCH`, `CYCLE_DETECTED`, `PARENT_UNRESOLVED`.

**Mechanism codes** (`ImplementationErrorCode`) describe implementation limits, currently including `S_SELECTOR_INCOMPATIBLE_SCHEME`, `E_VERSION_LABEL_INVALID`, `E_SELECTOR_SYNTAX_INVALID`, `E_APPLICABLE_ASSESSMENTS_UNBRANDED`, `E_TEMPORAL_FIELD_REF_INVALID`, `E_CANONICALIZATION_UNSUPPORTED`, `E_OWNERSHIP_UNSUPPORTED`, `E_JSON_VALUE_INVALID`, `E_UNKNOWN_BOUNDARY_REJECTED`.

The split is architectural, not cosmetic: a wrong selector scheme is not a protocol rejection, and an unbranded assessment set is not a statement about a participant. Adding a mechanism code must never require changing `UiaErrorCode`.

When several candidate paths fail for different reasons, per-path outcomes are preserved in `details.perPath`; the top-level code is an aggregation, not a normative precedence rule.

## 7. Traversal pipeline

Traversal is split into independently testable phases. The functions below are implemented in `core/traversal.ts`.

| Phase | Function                | Responsibility                                                                 |
| ----- | ----------------------- | ------------------------------------------------------------------------------ |
| 1     | `discoverPaths`         | Scope-permitted edges only; cycles are dead ends; no path → `ERR_NO_TRAVERSAL_PATH` |
| 2     | `validatePath`          | For every edge of one path: `assessEdge`, then `evaluateAssurance`               |
| 3     | `validateMergeClosure`  | For every merge node on the path, every direct parent edge, whatever its relation |
| 4     | `evaluateBinding`       | Aggregates per-path results into a `BindingResult`                               |

Phase 3 implements **immediate closure** only — §8.6's literal text about the parent edges of a merge node. Recursive closure and closure over a merge-typed origin are **BLOCKED** in Rev 0.3.3 and are not claimed as conformance (see §9).

Scope and closure cannot contradict each other: a merge node can appear on a selected path only under `FULL_ANCESTRY`, so closure branches never cross a scope-excluded relation.

## 8. Temporal model (target)

Timestamp **selection** and timestamp **trust** are separate in the design; the implementation of this model is planned with the credential module.

- `TemporalContext.basis` selects which declared field governs an operation (domain policy, §10.2).
- Trust arrives only as an externally assessed `TemporalTrustInput`, bound to a specific `(subject_ref, field, timestamp_value)` triple.
- The core derives one of four outcomes and never collapses them: a missing assessment is not a negative one, an unavailable mechanism is not an absence, and a declared timestamp is never trusted merely because it is present.

There is no clock in the core. Whether "now" matters is a question for the host and for CORE-003's JIT authorization.

## 9. Extension points (target)

| Extension              | Shape                                                              | Constraint                                                       |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Applicable assessments | `Policy.applicableAssessments(edgeRef, assessments, ctx)`           | May narrow, never expand; items outside the edge are discarded and reported |
| Contradiction rule     | `Policy.conflictPredicate`                                          | Undefined by default; Rev 0.3.3 does not define contradiction (BLOCKED A-4b) |
| Signature verification | `SignatureVerifier.evaluate(signature, credential)`                 | Injectable; crypto outcome is reported separately from temporal validity |
| Ledger persistence     | Adapter, or the planned in-memory `core/ledger.ts`                  | Mechanism only; must not alter historical records                 |
| Evidence               | Referenced by id (`evidence_refs`)                                  | Full model belongs to CORE-004                                    |

## 10. Deliberate absences

The architecture omits these on purpose; each omission is a boundary, not an unfinished detail:

- **No authority API** — no grants, capabilities, delegation, or permission checks (CORE-003).
- **No transport or envelope** — no message format, delivery, or event ledger (CORE-002).
- **No storage** — records are values; persistence is an adapter concern.
- **No cryptography in the core** — no signature verification and no key management; SHA-256 is used only as a content digest.
- **No trusted time** — the core consumes trust assessments, it does not produce them.
- **No global policy, reputation, or trust score** — a single number would erase the distinctions the protocol exists to preserve.

## 11. Testing architecture

`tests/unit/`, `tests/conformance/` (A and B suites) and `tests/experimental/` exist today; `tests/property/` is planned (see [`ROADMAP.md`](./ROADMAP.md)).

| Suite                     | Purpose                                                             | Exists | Conformance claim |
| ------------------------- | ------------------------------------------------------------------- | ------ | ----------------- |
| `tests/unit/`             | Module behavior, rejection cases, ownership, canonicalization vectors | Yes    | Yes              |
| `tests/conformance/`      | The §12 corpus A-1…D-4, exact fixtures and side-effect contracts       | Partial (A, B) | Yes, once present |
| `tests/property/`         | Determinism and brute-force equivalence (fast-check)                   | No     | Yes, for immediate closure |
| `tests/experimental/`     | BLOCKED interpretations (recursive closure, origin closure)            | Yes    | **No** — excluded |

A passing test suite does not establish production security or interoperability; see [`THREAT-MODEL.md`](./THREAT-MODEL.md).

## 12. Status

Implemented: primitives, error model, ownership, RFC 8785 canonicalization, SHA-256, the §3–§5 entity model and constructors, §5.2 structural lineage validation, the lineage graph with delayed parents and cycle detection, the §6 assessment mechanism, §7.1 descriptor hashing, version label validation, the `uia-ref-selector@1` mechanism, the type-level temporal contracts, and §8 conditional version binding with three-phase traversal and immediate merge closure.

Planned: temporal trust derivation (Task 13), credentials, acceptance, ledger, and the full C-1/C-2 conformance cases (assessment recording of `PARENT_UNRESOLVED`/`CYCLE_DETECTED`).

Ordering and exit criteria are tracked in [`ROADMAP.md`](./ROADMAP.md) and in the [implementation plan](./superpowers/plans/2026-10-30-uia-core-001-implementation.md).
