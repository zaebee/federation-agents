# UIA — Roadmap

**Status:** Working Draft.
**As of:** 2026-10-31, reconciled with the Task 17 conformance audit and the Task 18 disposition.
**Scope:** the `UIA-CORE-001` protocol module and its reference implementation in this repository.

Current counts and the readiness label are maintained in [`STATUS.md`](../STATUS.md); this roadmap answers *in what order*, not *how far*.

This roadmap is ordered by dependency and correctness, not by calendar. It deliberately contains no dates: a phase is done when its exit criteria are met and the evidence is in the repository, not when a date arrives.

Status here is derived from code and tests. The [implementation plan](./superpowers/plans/2026-10-30-uia-core-001-implementation.md) is a **historical tracker** of how each task was closed (task → PR); its checkboxes are not authoritative.

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
| P1    | Identity, lineage, assessment, traversal | 4–11  | In progress |
| P2    | Credentials, runtime, acceptance   | 13–15      | In progress |
| P3    | Verification hardening             | 12, 17     | In progress |
| P4    | Mechanism documentation            | 16         | Done    |
| P5    | Interoperability demonstration     | —          | Planned |
| P6    | Independent validation & security profile | —   | Deferred |

Phases are sequential at the level of dependencies, not of effort: P1 and P4 can overlap, but no phase may claim conformance for a module that does not exist.

**Why P1–P3 are not Done.** Implementation is complete through immediate merge closure, and the suites are green, but phase exit is a conformance question. The Task 17 audit keeps §12 C-1 as NOT COVERED (evidence postdates it), C-2 and D-2 as BLOCKED, and D-1/D-4 as PARTIAL; P3's exit criteria ("every §12 case passes") therefore cannot be met yet. Implementation completion and conformance are separate axes, and this roadmap tracks both.

## 3. P0 — Foundations (Done)

**Scope:** project scaffold, error model, primitives, ownership, RFC 8785 canonicalization, pure-TS SHA-256.

**Exit criteria — met:**

- `bun test`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run build` all green.
- `src/core/` typechecks with `"types": []` and imports no runtime API.
- Normative and mechanism error codes are distinct types; mechanism codes cannot appear in `UiaErrorCode`.
- Canonicalization rejects the full list of unsupported structures, including accessors, symbol keys, non-plain prototypes, cycles, and lone surrogates in values and keys.
- Deep copy and recursive deep freeze are tested against caller mutation.

**Evidence:** `tests/unit/{scaffold,canonical,sha256,ownership}.test.ts`, plus error-model and `DeepReadonly` type assertions in `entities.test.ts`.

## 4. P1 — Identity, lineage, assessment, traversal (In progress)

The protocol core is implemented through immediate merge closure and scope × closure consistency. P1 remains open only for the C-series cases: C-1 has passing tests since T18-02A but still carries a NOT COVERED audit status pending a re-audit, while C-2 is BLOCKED on the C-2 subject-model decision and on grant suppression, which belongs to CORE-003.

| Task | Status  | Deliverable                                                          | Exit criterion |
| ---- | ------- | -------------------------------------------------------------------- | -------------- |
| 4    | Done    | Descriptor hashing with the explicit §7.1 projection                  | §7.1 key set asserted; wrappers cannot change the hash |
| 5    | Done    | Version schemes and a versioned selector mechanism                    | SEMVER_2 / CONTENT_HASH / OPAQUE_TAG rules and exact-match fallback tested |
| 6    | Done    | Entities and structural validation (§5)                               | Corpus A-1…A-5 pass |
| 7    | Done    | Lineage graph: delayed parents, cycles (§11)                          | Graph-level C-1/C-2 behaviour; binding-level recording is a separate open item |
| 8    | Done    | Assessments: edge binding, unverified-claim semantics (§6)             | Unit-level assessment semantics and the B-5 conformance refusal |
| 9    | Done    | Traversal phases 1 and 2                                              | Corpus B-1…B-3 pass; phases testable in isolation |
| 10   | Done    | Immediate merge closure                                               | Corpus B-4…B-7 pass; per-path outcomes preserved |
| 11   | Done    | Scope × closure consistency                                           | Structural argument asserted by test |

**Exit criteria for P1:**

- The A, B, and C conformance suites pass against the exact §12 fixtures.
- Every failure carries a normative code and, where applicable, per-path details.
- No authority-producing API exists; no lineage edge creates a grant.
- Immutability of descriptors and assessments is demonstrated, not assumed.

**Deliberately excluded from P1:** recursive merge closure, contradiction detection, and merge-typed origin closure — see §8.

## 5. P2 — Credentials, runtime, acceptance (In progress — D-2 BLOCKED)

| Task | Status | Deliverable                                                          | Exit criterion |
| ---- | ------ | -------------------------------------------------------------------- | -------------- |
| 13   | Done   | Credential usage, revocation reasons, historical signature semantics  | Corpus D-3 passes; D-4 is PARTIAL in the audit (contested result proven, the second MUST not asserted); the four temporal trust outcomes stay distinct |
| 14   | Done   | Runtime instance lifecycle                                           | Corpus D-1 passes as PARTIAL in the audit (event separation proven; independent execution is not observable within CORE-001) |
| 15   | Done   | Local Acceptance and lifecycle                                       | Corpus D-2 is BLOCKED: the normative object is a Ruling (CORE-004), and the test substitutes a Local Acceptance record |

**Exit criteria for P2:**

- Signature verification stays injectable; the core reports crypto outcome and temporal validity separately.
- `UNTRUSTED`, `UNASSESSED`, and `TRUST_ASSESSMENT_UNAVAILABLE` are distinguishable in every public result.
- Acceptance never produces authority and never binds another domain.

## 6. P3 — Verification hardening (In progress)

| Task | Status | Deliverable                                                          |
| ---- | ------ | -------------------------------------------------------------------- |
| 12   | Done   | Property-based tests: determinism, order independence, brute-force equivalence |
| 17   | Done (audit) | Assertion-level conformance audit: 175 requirements inventoried, 152 PASS / 8 PARTIAL / 7 BLOCKED / 8 NOT COVERED / 0 FAIL; readiness `NOT_READY` |

The audit replaced Task 17's planned "final report and tag": no `uia-core-001-refimpl-0.1.0` tag was created, and no full-conformance claim was made. Its findings were dispositioned in Task 18 (`docs/audits/2026-10-31-core-001-task-18/`), which is now the live remediation track.

**Exit criteria for P3:**

- Every §12 case A-1…D-4 passes.
- Equivalent input sets produce identical results regardless of edge insertion order, descriptor arrival order, and traversal implementation.
- Immediate closure agrees with a brute-force reference on random DAGs.
- `format:check` is green, and `format` is never run as part of verification.

## 7. P4 — Mechanism documentation (Done)

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
| All Category C federation tests pass                       | P1 (C-1 evidence pending re-audit; C-2 BLOCKED) |
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
