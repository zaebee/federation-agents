# Decision Register Proposal — T18-01

**Status:** Proposal only. The existing Task 18 decision register is not modified. Both entries are **OPEN**.

**Labels:** requirement outcomes `REQ-LOCAL`, `REQ-EXTERNAL`, `REQ-NONE`; ownership `OWN-CORE`, `OWN-ADAPTER`; validation `VAL-CORE`, `VAL-ADAPTER`, `VAL-CORE-CONSTRUCTION`; remediation paths `PATH-A`, `PATH-B`, `PATH-C`.

## T18-DEC-01

| Field | Proposed content |
| --- | --- |
| ID | `T18-DEC-01` |
| Question | Does CORE-001 require a local Assessment recording `PARENT_UNRESOLVED` for an unresolved parent and `CYCLE_DETECTED` for a detected cycle? |
| Current status | **OPEN** |
| Normative evidence | §11.1 line 1037 (“локальная оценка MUST фиксировать”), lines 1042–1047 (example); §11.2 line 1058 (“Assessment фиксирует”); §12 C-1 line 1403; C-2 line 1423; §6.2.1 lines 546–575; §6.2.2 lines 594–595 |
| Implementation evidence | `lineage.ts:146/177/278/340` (detection); `traversal.ts:486` (CYCLE_DETECTED result); `assessment.ts:18/336` (type/registration); `errors.ts:16–17` (codes); no assessment derivation; see `implementation-analysis.md` §1.2 and §5 |
| Possible outcomes | `REQ-LOCAL` (required at local-assessment level); `REQ-EXTERNAL` (required only as an external document); `REQ-NONE` (not required) |
| Recommendation | `REQ-LOCAL`; not approved |
| Decision owner | spec editor |
| Action required | Approve the reading; if `REQ-LOCAL`, clarify the minimum assessment shape and the C-2 subject model |
| Consequence if `REQ-LOCAL` | C-1/C-2.a2 are assessment-evidence gaps, not detection gaps; DEC-02 selects `OWN-*` |
| Consequence if `REQ-EXTERNAL`/`REQ-NONE` | `PATH-C`: requires `T18-SPEC-01` clarification/amendment and a conformance re-audit; no implementation task |

## T18-DEC-02

| Field | Proposed content |
| --- | --- |
| ID | `T18-DEC-02` |
| Question | Which boundary owns Assessment construction and registration/publication, and which boundary validates the Assessment contract? |
| Current status | **OPEN** |
| Normative evidence | §11.1 “локальная оценка”; §10.1 line 995 (`assessed_at` is a domain action); §6.2.1 assessment fields |
| Implementation evidence | `registerAssessment` public via `src/core/index.ts:17` → `src/index.ts:6` → package root; `buildLineageGraph` public via `src/core/index.ts:12`; no factory/validator; `registerAssessment` accepts malformed object (reproducible probe in `implementation-analysis.md` §1.2); `deepCopy`/`deepFreeze` are ownership only |
| Possible outcomes | `OWN-CORE` + `VAL-CORE` or `VAL-CORE-CONSTRUCTION`; `OWN-ADAPTER` + `VAL-CORE` or `VAL-ADAPTER` |
| Recommendation | `OWN-ADAPTER` + `VAL-CORE`, with validation enforced at registration or via a guarded validated-registration API; not approved |
| Decision owner | spec editor + project owner |
| Action required | Approve ownership, validation enforcement boundary, and C-2 subject model |
| Consequence for `PATH-A` | Core-owned construction/registration; new API with explicit provenance/time; AEBE from Core |
| Consequence for `PATH-B` | Adapter-owned construction/registration; `VAL-CORE`, `VAL-ADAPTER`, or `VAL-CORE-CONSTRUCTION`; AEBE from adapter |

## Rules

- Neither entry is APPROVED or CLOSED.
- A recommendation is not a decision.
- The existing Task 18 decision register remains unchanged until the project owner approves an amendment.
- A normative amendment goes through `T18-SPEC-01`; this package does not edit `docs/CORE-001.md`.
