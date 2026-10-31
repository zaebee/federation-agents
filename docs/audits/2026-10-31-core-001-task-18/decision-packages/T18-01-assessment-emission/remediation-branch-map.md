# Remediation Branch Map — T18-01

**Status:** Planning only. Paths are conditional on OPEN decisions. No implementation task is created here.

## Decision references

- **T18-DEC-01:** Does CORE-001 require a local Assessment recording `PARENT_UNRESOLVED` for an unresolved parent and `CYCLE_DETECTED` for a detected cycle? — **OPEN**.
- **T18-DEC-02:** Which boundary owns Assessment construction and registration/publication, and which boundary validates the Assessment contract? — **OPEN**.

## 1. Path A — Core ownership

Applies if T18-DEC-02 selects Core construction/registration.

| Step | Content |
| --- | --- |
| T18-02A | C-1 Core emission: Core API constructs/registers the Assessment from graph state plus explicit provenance/time inputs |
| T18-02B | C-2.a2 Core emission: Core API constructs/registers the `CYCLE_DETECTED` Assessment; the C-2 subject model must be decided first |
| Validation | Core construction should validate; if registration is separate, validation must be enforced at registration or via a guarded API |
| AEBE | Evidence from the Core API, not a hand-constructed fixture |
| T18-13 | Readiness depends on AEBE, T18-10, T18-11 |
| C-2.a3 | Remains separate; C-2 stays BLOCKED |

## 2. Path B — Adapter ownership

Applies if T18-DEC-02 selects adapter construction/registration.

| Step | Content |
| --- | --- |
| T18-02C | Adapter emission evidence: adapter uses public `buildLineageGraph` and `registerAssessment` |
| Validation | Choose A (Core validator called by adapter), B (adapter validator under contract), or C (Core construction/validation); the bypass risk must be addressed |
| AEBE | Evidence from the actual adapter boundary, not a hand-constructed fixture |
| T18-13 | Readiness depends on AEBE, T18-10, T18-11 |
| C-2.a3 | Remains separate; C-2 stays BLOCKED |

### Path B evidence requirements

1. The adapter produces the Assessment from graph state.
2. Exact claim: `PARENT_UNRESOLVED` for C-1; `CYCLE_DETECTED` for C-2.a2.
3. Negative cases: resolved parent produces no `PARENT_UNRESOLVED`; acyclic graph produces no `CYCLE_DETECTED`.
4. Validation: malformed assessments are rejected at the chosen boundary.
5. Registration: the Assessment is registered through public `registerAssessment` (or a new validated API).
6. Publication/retention: the returned array is retained/exposed by the adapter; no Core store is assumed.
7. Graph and descriptors remain unchanged.
8. The C-2 subject model is explicitly identified.
9. Revision and exact test command are recorded.

## 3. Path C — No normative emission requirement

Applies if T18-DEC-01 concludes CORE-001 does not require an Assessment.

- Do not create C-1/C-2.a2 implementation tasks merely to satisfy tests.
- Prepare `T18-SPEC-01` clarification/amendment if the project wants to change the normative text.
- Require explicit approval and a conformance re-audit before changing Task 17 conclusions.
- T18-13 must not treat the issue as resolved before the decision and re-audit.

## 4. AEBE — shared evidence deliverable

AEBE is not an implementation task. It must identify:

| Element | Requirement |
| --- | --- |
| Construction owner | Core or adapter |
| Validation owner | Core validator, adapter validator, or Core construction |
| Registration/publication | Public `registerAssessment` return value, validated API, or adapter store; no invented Core store |
| Public API used | Package root; internal-module import is an API boundary gap |
| Positive evidence | Exact claim, subject, parents, relation, provenance |
| Negative evidence | Resolved parent and acyclic graph produce no corresponding Assessment |
| Validation evidence | Malformed assessments rejected at the chosen boundary |
| Provenance | `assessed_by`, `assessed_at`, profile/method, evidence refs |
| C-2 model | SCC, node, or edge model explicitly identified |
| Reproducibility | Revision and exact command |

A hand-constructed fixture is not AEBE.

## 5. C-2.a3 separation

- C-2.a2 is an Assessment obligation.
- C-2.a3 is a CORE-003 grant-suppression obligation.
- Assessment emission does not create, revoke, or suppress authority.
- C-2 remains BLOCKED until CORE-003 provides observable evidence.
- T18-13 cannot treat C-2 as PASS on AEBE alone.

## 6. T18-13 readiness dependency

T18-13 consumes AEBE, the C-2.a3 disposition, and T18-11 external evidence.

| Outcome | Criteria |
| --- | --- |
| `READY` | C-1 PASS; C-2 PASS; T18-11 completed; N-170/N-175 confirmed; no accepted limitation |
| `CONDITIONALLY_READY` | C-1 PASS; AEBE for C-2.a2; C-2 BLOCKED only on explicitly accepted CORE-003 dependency; T18-11 external dependency explicitly accepted with impact; limitations enumerated |
| `NOT_READY` | Any required evidence absent and not accepted; any CORE-001 implementation gap; unaccepted limitation |

An approved BLOCKED disposition does not imply readiness.

## 7. No task assumes a C-2 model

T18-02B/T18-02C are placeholders conditional on the C-2 subject-model decision. They must not encode SCC-, node-, or edge-level assumptions before approval.