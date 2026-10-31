# UIA — Roadmap

**Status:** Working Draft.
**As of:** 2026-10-30.
**Scope:** the `UIA-CORE-001` protocol module and its reference implementation in this repository.

This roadmap is ordered by dependency and correctness, not by calendar. It deliberately contains no dates: a phase is done when its exit criteria are met and the evidence is in the repository, not when a date arrives.

Status here is derived from code and tests. The task checkboxes in the [implementation plan](./superpowers/plans/2026-10-30-uia-core-001-implementation.md) are not authoritative.

## 1. Status legend

| Status   | Meaning                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Done     | Implemented in `src/`, covered by tests, checks green                    |
| Next     | The current focus; unblocked and specified                              |
| Planned  | Specified enough to schedule, not started                               |
| Blocked  | Cannot be completed without a specification clarification               |
| Deferred | Belongs to another module (CORE-002/003/004) or to infrastructure work  |

## 2. Phase overview

| Phase | Theme                              | Plan tasks | Status  |
| ----- | ---------------------------------- | ---------- | ------- |
| P0    | Foundations                        | 1–3        | Done    |
| P1    | Identity, lineage, assessment, traversal | 4–11  | Next    |
| P2    | Credentials, runtime, acceptance   | 13–15      | Planned |
| P3    | Verification hardening             | 12, 17     | Planned |
| P4    | Mechanism documentation            | 16         | Planned |
| P5    | Interoperability demonstration     | —          | Planned |
| P6    | Independent validation & security profile | —   | Deferred |

Phases are sequential at the level of dependencies, not of effort: P1 and P4 can overlap, but no phase may claim conformance for a module that does not exist.

## 3. P0 — Foundations (Done)

**Scope:** project scaffold, error model, primitives, ownership, RFC 8785 canonicalization, pure-TS SHA-256.

**Exit criteria — met:**

- `bun test`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run build` all green.
- `src/core/` typechecks with `"types": []` and imports no runtime API.
- Normative and mechanism error codes are distinct types; mechanism codes cannot appear in `UiaErrorCode`.
- Canonicalization rejects the full list of unsupported structures, including accessors, symbol keys, non-plain prototypes, cycles, and lone surrogates in values and keys.
- Deep copy and recursive deep freeze are tested against caller mutation.

**Evidence:** `tests/unit/{scaffold,canonical,sha256,ownership}.test.ts`, plus error-model and `DeepReadonly` type assertions in `entities.test.ts`.

## 4. P1 — Identity, lineage, assessment, traversal (Next)

This is the semantic core of CORE-001. Until it lands, the repository has foundations but no protocol.

| Task | Status  | Deliverable                                                          | Exit criterion |
| ---- | ------- | -------------------------------------------------------------------- | -------------- |
| 4    | Done    | Descriptor hashing with the explicit §7.1 projection                  | §7.1 key set asserted; wrappers cannot change the hash |
| 5    | Done    | Version schemes and a versioned selector mechanism                    | SEMVER_2 / CONTENT_HASH / OPAQUE_TAG rules and exact-match fallback tested |
| 6    | Done    | Entities and structural validation (§5)                               | Corpus A-1…A-5 pass |
| 7    | Done    | Lineage graph: delayed parents, cycles (§11)                          | Graph-level C-1/C-2 behaviour; full conformance awaits traversal integration (Tasks 9–10) |
| 8    | Done    | Assessments: edge binding, unverified-claim semantics (§6)             | Unit-level assessment semantics; B-5 conformance fixture remains Task 10 |
| 9    | Next    | Traversal phases 1 and 2                                              | Corpus B-1…B-3 pass; phases testable in isolation |
| 10   | Planned | Immediate merge closure                                               | Corpus B-4…B-7 pass; per-path outcomes preserved |
| 11   | Planned | Scope × closure consistency                                           | Structural argument asserted by test |

**Exit criteria for P1:**

- The A, B, and C conformance suites pass against the exact §12 fixtures.
- Every failure carries a normative code and, where applicable, per-path details.
- No authority-producing API exists; no lineage edge creates a grant.
- Immutability of descriptors and assessments is demonstrated, not assumed.

**Deliberately excluded from P1:** recursive merge closure, contradiction detection, and merge-typed origin closure — see §8.

## 5. P2 — Credentials, runtime, acceptance (Planned)

| Task | Deliverable                                                          | Exit criterion |
| ---- | -------------------------------------------------------------------- | -------------- |
| 13   | Credential usage, revocation reasons, historical signature semantics  | Corpus D-3, D-4 pass; the four temporal trust outcomes stay distinct |
| 14   | Runtime instance lifecycle                                           | Corpus D-1 passes; restart does not create a version |
| 15   | Local Acceptance and lifecycle                                       | Corpus D-2 passes; earlier rulings survive new events |

**Exit criteria for P2:**

- Signature verification stays injectable; the core reports crypto outcome and temporal validity separately.
- `UNTRUSTED`, `UNASSESSED`, and `TRUST_ASSESSMENT_UNAVAILABLE` are distinguishable in every public result.
- Acceptance never produces authority and never binds another domain.

## 6. P3 — Verification hardening (Planned)

| Task | Deliverable                                                          |
| ---- | -------------------------------------------------------------------- |
| 12   | Property-based tests: determinism, order independence, brute-force equivalence |
| 17   | Full conformance run with assertion-level verification                 |

**Exit criteria for P3:**

- Every §12 case A-1…D-4 passes.
- Equivalent input sets produce identical results regardless of edge insertion order, descriptor arrival order, and traversal implementation.
- Immediate closure agrees with a brute-force reference on random DAGs.
- `format:check` is green, and `format` is never run as part of verification.

## 7. P4 — Mechanism documentation (Planned)

Task 16 in the plan: `docs/implementation.md`.

It must document what the architecture already separates:

- in-memory ledger, default policies, selector grammar, and the pure-TS SHA-256 as mechanisms;
- the version label attached to the selector mechanism;
- the coverage map from spec requirements to tests;
- the assumptions list and the ambiguities register;
- what a mechanism change would mean for compatibility.

**Exit criterion:** a reader can tell which behaviors are protocol semantics and which are implementation choices, without reading the source.

## 8. Blocked — do not schedule as implementation

These are not "later"; they are undefined in Rev 0.3.3. Implementing them silently would turn an interpretation into a protocol rule.

| ID   | Blocked item                                | Current behavior                                                        |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------- |
| A-4b | Contradiction / `CONTESTED` detection        | No default rule; reachable only via an explicitly configured policy hook |
| A-5  | Recursive merge closure inside branches      | Immediate closure only; recursive interpretation pinned only by an experimental, non-conformance test |
| A-11 | Closure over a `MERGED_FROM` origin node     | Conservative default documented; experimental test only                 |
| A-9  | Trusted-time mechanism for `signed_at`       | Trust arrives only as an external assessment; the core never derives it |

Each requires a specification clarification before it can appear in a roadmap phase. Until then it is excluded from conformance claims, not merely untested.

## 9. P5 — Interoperability demonstration (Planned)

**Goal:** show two independent domains exchanging identity and provenance without shared trust.

Minimum shape:

1. Domain A publishes a descriptor and a continuation.
2. Domain B ingests it, evaluates lineage with its own policy, and records local acceptance.
3. Domain B rejects a version whose assurance requirement is not met — and says exactly why.

**Exit criteria:**

- Neither domain can force acceptance on the other.
- The demonstration runs against the real public API, not test doubles, except where an external verifier is required.
- A written trace shows declarations, assessments, policy, and decision separately.
- No network standard is implied: transport remains CORE-002.

## 10. P6 — Independent validation and security profile (Deferred)

| Item                                  | Why it matters                                                        |
| ------------------------------------- | --------------------------------------------------------------------- |
| Second, independent implementation    | Determinism and closure semantics are only proven across implementations |
| Cross-implementation hash vectors     | Canonicalization divergence is a silent interoperability failure      |
| Threat-model review                   | [`THREAT-MODEL.md`](./THREAT-MODEL.md) is a first pass, not an audit   |
| Input-size and traversal-limit contract | T-17 in the threat model is currently unmitigated                    |
| Production security profile           | Key management, crypto profiles, and deployment guidance do not exist |

## 11. Spec freeze gate

CORE-001 moves from Candidate Draft Normative to Frozen Baseline only when §16 is satisfied. Mapping to this roadmap:

| §16 condition                                              | Phase |
| ---------------------------------------------------------- | ----- |
| All Category A structural tests pass                       | P1    |
| All Category B binding and traversal tests pass            | P1    |
| All Category C federation tests pass                       | P1    |
| All Category D cross-spec integration tests pass           | P2    |
| Independent implementations agree on discovery and closure  | P6    |
| Result independent of storage and delivery order            | P3    |
| Missing and conflicting assessments are covered             | P1, partly blocked by A-4b |
| Temporal credential revocation cases covered                | P2    |
| Immutability of descriptors, assessments, rulings           | P1, P2 |
| Independent semantic compatibility check                    | P6    |

No phase may be marked done on unit tests alone when a conformance case exists for it.

## 12. Explicitly deferred

Out of scope for this roadmap, owned elsewhere:

- CORE-002: envelopes, event ledger, delivery, replay protection.
- CORE-003: authority principals, grants, delegation, JIT authorization, TOCTOU.
- CORE-004: evidence, findings, rulings, reassessment.
- Transport protocols, network interfaces, and service discovery.
- Persistence beyond an in-memory mechanism.
- Key management, HSM integration, and crypto policy.
- Registries, reputation scores, and trust marketplaces.
- Any user interface.

## 13. How this roadmap changes

- A status moves to Done only with a passing test and a green check, not with merged code alone.
- New work is added as a phase with exit criteria; it is not inserted into a phase that is already claiming completion.
- A blocked item moves only when the specification changes, and the change is recorded in the ambiguities register.
- Deferred work moves in only when the owning module has an approved specification.
