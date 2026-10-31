# Disposition Matrix — Task 18

**Audit base:** `2a83c65`. **Task 17 statuses are inputs and are not changed.**
**Scope:** all 23 non-PASS requirements from the Task 17 requirement matrix.

## Legend

| Field | Meaning |
| --- | --- |
| `Primary` | The category that determines the next action |
| `Secondary` | Contributing or conditional category |
| `Risk scope` | Risk dimension, independent of remediation urgency |
| `Req. priority` | Remediation urgency for the requirement (`P1`–`P3`) |
| `Change type` | `code+tests`, `tests`, `specification`, `documentation`, `cross-spec`, `external`, `none`, `conditional` |
| `Proposed transition` | Target status only if the named evidence exists; otherwise the Task 17 status stands |

Conditional implementation work is valid only after a decision establishes CORE-001 ownership.

## 1. Non-PASS requirements (23)

| ID | Task 17 status | Group | Requirement | Primary | Secondary | Risk scope | Req. priority | Conditional outcome / smallest action | Change type | Dependencies | Closure evidence | Proposed transition | Traceability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-004 | PARTIAL | runtime | Runtime independence: one failure does not change others | `INTENTIONAL_LIMITATION` | `DOCUMENTATION_GAP`, `TEST_GAP` | `CORE-001_RUNTIME` | P3 | Document metadata-level independence; no execution semantics | documentation | — | Docs state metadata vs execution; D-1 test annotated | No status change; intentional limitation reported | T-014, CASE-D-1.a2 |
| N-019 | PARTIAL | runtime | `SEMVER_2` labels correspond to SemVer 2.0.0 | `SPECIFICATION_DECISION` | `IMPLEMENTATION_GAP`, `DOCUMENTATION_GAP` | `CORE-001_RUNTIME` | P2 | If CORE-001 owns validation: implement + test. If caller owns: contract + binding-boundary test. If unassigned: unresolved | conditional | T18-DEC-03 | Invalid `SEMVER_2` rejected at the chosen boundary, or documented caller contract plus binding test | PASS only with that evidence; otherwise PARTIAL | F-005, T-005 |
| N-020 | BLOCKED | runtime | `CONTENT_HASH` label contains a content-hash identifier | `SPECIFICATION_DECISION` | — | `CORE-001_RUNTIME` | P3 | Keep BLOCKED; A-7 format decision | specification | T18-DEC-08 | Approved `CONTENT_HASH` grammar | BLOCKED retained until decision | AMBIG-A-7 |
| N-026 | PARTIAL | boundary | Heartbeat/stop/failure/restart are separate lifecycle events | `CROSS_SPEC_DEPENDENCY` | `INTENTIONAL_LIMITATION` | `CROSS_SPEC` | P3 | CORE-002 owns event format; document CORE-001 limitation | cross-spec | T18-DEC-11 | CORE-002 event format accepted; CORE-001 boundary documented | No CORE-001 status change | none (CORE-002 boundary) |
| N-040 | PARTIAL | runtime | Confirmed compromise invalidates signatures at/after accepted compromise time | `SPECIFICATION_DECISION` | `DOCUMENTATION_GAP` | `CORE-001_RUNTIME` | P2 | Decide whether §4.4.1 requires `signed_at` trust before comparison | specification decision | T18-DEC-04 | Decision record and proposed wording; normative amendment via T18-SPEC-01 | PASS only if approved wording confirms current behavior; otherwise PARTIAL | F-006, AMBIG-A-9 (mechanism only) |
| N-041 | PARTIAL | runtime | Unknown compromise time is contested and not sufficient for future authorization | `TEST_GAP` | — | `CORE-001_RUNTIME` | P2 | Test policy input and outcome for unknown compromise time | tests | T-004 | Test asserts revocation/temporal context and non-auto-authorized outcome | PASS if test proves the property | T-004, CASE-D-4.a2 |
| N-078 | BLOCKED | runtime | Contradictory trusted assessments move the claim to `CONTESTED` | `SPECIFICATION_DECISION` | — | `CORE-001_RUNTIME` | P1 | A-4b contradiction predicate | specification | T18-DEC-06 | Approved predicate and conflict semantics | BLOCKED retained until decision | AMBIG-A-4b |
| N-079 | NOT COVERED | runtime | Decisions cannot rely on an unresolved contested claim | `CROSS_SPEC_DEPENDENCY` | `INTENTIONAL_LIMITATION` | `AUTHORITY_BOUNDARY` | P3 | CORE-003/decision layer owns gating; document boundary | cross-spec | T18-DEC-10 | Owner identified; boundary documented; no CORE-001 gating code | No status change; authority-boundary watchlist | T-013 |
| N-084 | NOT COVERED | runtime | Computed digest is compared with the claimed value | `SPECIFICATION_DECISION` | `IMPLEMENTATION_GAP`, `DOCUMENTATION_GAP`, `EXTERNAL_DEPENDENCY` | `CORE-001_RUNTIME` | P3 | If CORE-001 owns: helper + tests. If caller owns: contract + caller-boundary evidence + negative mismatch. If unassigned: unresolved | conditional | T18-DEC-05 | Match, mismatch and malformed cases at the owning boundary; documentation alone insufficient | PASS only with verification evidence; otherwise NOT COVERED | T-011 |
| N-107 | BLOCKED | runtime | Every edge has no unresolved conflict of applicable assessments | `SPECIFICATION_DECISION` | — | `CORE-001_RUNTIME` | P1 | Same as N-078 | specification | T18-DEC-06 | Approved conflict semantics applied to path validation | BLOCKED retained until decision | AMBIG-A-4b |
| N-112 | BLOCKED | runtime | Closure depth inside parent branches is defined | `SPECIFICATION_DECISION` | — | `CORE-001_RUNTIME` | P1 | A-5 closure depth; immediate-only remains | specification | T18-DEC-07 | Approved closure-depth rule | BLOCKED retained until decision | AMBIG-A-5 |
| N-128 | BLOCKED | boundary | `signed_at` is attested only with a trusted-time mechanism | `SPECIFICATION_DECISION` | `EXTERNAL_DEPENDENCY` | `EXTERNAL_READINESS` | P2 | Define normative trusted-time requirement before external mechanism ownership | specification | T18-DEC-09 | Approved requirement and mechanism interface | BLOCKED retained until requirement defined | AMBIG-A-9 |
| N-138 | NOT COVERED | runtime | Local evaluation records `PARENT_UNRESOLVED` | `SPECIFICATION_DECISION` | `IMPLEMENTATION_GAP`, `TEST_GAP` | `CORE-001_RUNTIME` | P1 | DEC-01/02 approved: adapter C-1 emission with Core validation; registration/publication OPEN | conditional | T18-02A, registration-ownership decision | AEBE for C-1 from the adapter; validation enforced; registration owner assigned | PASS only with AEBE; otherwise NOT COVERED | F-001, T-001, CASE-C-1.a3 |
| N-140 | NOT COVERED | runtime | After parent arrival, domain MAY issue a new assessment | `INTENTIONAL_LIMITATION` | audit reclassification | `CORE-001_RUNTIME` | P3 | Do not implement MAY capability; future audit reclassification | none | — | Reconciliation note accepted | No Task 17 status change; intentional limitation reported | T-012 |
| N-143 | NOT COVERED | runtime | An Assessment records `CYCLE_DETECTED` | `SPECIFICATION_DECISION` | `IMPLEMENTATION_GAP`, `TEST_GAP` | `CORE-001_RUNTIME` | P1 | DEC-01/02 approved: adapter C-2.a2 emission after C-2 model decision; C-2 remains BLOCKED | conditional | T18-02B | AEBE for C-2.a2 from the adapter; validation enforced | PASS only with AEBE; **C-2 case remains BLOCKED** | F-002, T-002, CASE-C-2.a2 |
| N-145 | BLOCKED | boundary | Dependent grants are not applied after cycle detection | `CROSS_SPEC_DEPENDENCY` | — | `AUTHORITY_BOUNDARY` | P3 | CORE-003 grant suppression; no CORE-001 code | cross-spec | T18-DEC-13 | CORE-003 acceptance evidence | BLOCKED retained; authority-boundary watchlist | CASE-C-2.a3 |
| N-156 | BLOCKED | boundary | Historical Rulings are not deleted when grounds change | `CROSS_SPEC_DEPENDENCY` | — | `CROSS_SPEC` | P3 | CORE-004 Ruling; D-2 remains BLOCKED | cross-spec | T18-DEC-12 | CORE-004 Ruling model and preservation criteria | BLOCKED retained | F-003, T-003, CASE-D-2.a1 |
| N-168 | NOT COVERED | readiness | All Federation Category C tests pass | `TEST_GAP` | `CROSS_SPEC_DEPENDENCY` | `EXTERNAL_READINESS` | P1 | Independent readiness evidence; not automatic after N-138/N-143 | readiness evidence | T18-13, T18-11, AEBE or re-audit outcome | C-1 PASS and C-2 PASS, or CONDITIONALLY_READY with enumerated limitations and impact | READY / CONDITIONALLY_READY / NOT_READY per roadmap | T-001, T-002 |
| N-169 | PARTIAL | readiness | All Cross-Spec Category D tests pass | `CROSS_SPEC_DEPENDENCY` | `TEST_GAP` | `CROSS_SPEC` | P3 | D-2/CORE-004 plus D-1/D-4 evidence | cross-spec + tests | T18-10 | D-2 disposition and D-1/D-4 evidence accepted | No status change until evidence | F-003, T-004, T-014 |
| N-170 | NOT COVERED | readiness | Independent implementations produce the same discovery/closure results | `EXTERNAL_DEPENDENCY` | — | `EXTERNAL_READINESS` | P3 | Independent implementation/audit | external | T18-DEC-14 | External comparison report and acceptance criteria | No CORE-001 status change | none (external) |
| N-172 | PARTIAL | readiness | Missing and contradictory assessments have been checked | `SPECIFICATION_DECISION` | `TEST_GAP` | `CORE-001_RUNTIME` | P2 | A-4b decision, then missing/contradictory tests | specification + tests | T18-DEC-06, T18-09D | Conflict tests after approved predicate | PASS only with approved semantics and tests | AMBIG-A-4b |
| N-174 | PARTIAL | readiness | Immutability of descriptors, assessments and Rulings has been checked | `CROSS_SPEC_DEPENDENCY` | — | `CROSS_SPEC` | P3 | CORE-004 Ruling immutability | cross-spec | T18-10 | CORE-004 Ruling immutability evidence | No status change until Ruling exists | F-003, T-003 |
| N-175 | NOT COVERED | readiness | Independent semantic compatibility has been checked | `EXTERNAL_DEPENDENCY` | — | `EXTERNAL_READINESS` | P3 | Independent semantic compatibility audit | external | T18-DEC-14 | External compatibility report | No CORE-001 status change | none (external) |

## 2. Documentation discrepancies (D-001…D-008)

These are not non-PASS requirements. They are Task 17 documentation findings; Task 18 records the remediation owner without editing Task 17.

| ID | Claim | Source A | Source B | Task 18 action | Owner |
| --- | --- | --- | --- | --- | --- |
| D-001 | §12 coverage is 16/18 | `docs/implementation.md:1425` | Task 17: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED | T18-12 documentation reconciliation | project owner |
| D-002 | D-2 is `pass` | `docs/implementation.md:1477` | D-2 requires a Ruling; test uses Local Acceptance | T18-12 after T18-DEC-12 | project owner |
| D-003 | D-4 is `pass` | `docs/implementation.md:1481` | D-4 sufficiency sentence not asserted | T18-12 after T18-03 | project owner |
| D-004 | Task 17 runs 18 cases | plan line 561 | C-1/C-2 are todo; no task closes them | T18-12 plan status correction | project owner |
| D-005 | `assessEdge` deep-copies and rejects duplicate ids | `docs/implementation.md` §2.11 | Accurate; omits absence of assessment validation | T18-12 if F-004 is resolved | project owner |
| D-006 | P9 checks names, not bodies | `docs/implementation.md` §2.18/§4.6 | Accurate | none | — |
| D-007 | ARCHITECTURE.md internally inconsistent | `docs/implementation.md` §9.4 | Verified at `9425d3f` | separate follow-up | project owner |
| D-008 | D-1 is `pass` | `docs/implementation.md:1476` | Metadata-level only; actual execution not observable | T18-12 | project owner |

## 3. Traceability gaps

No dedicated `F-###`/`T-###` exists for: `N-020`, `N-026`, `N-112`, `N-128`, `N-145`, `N-156`, `N-169`, `N-170`, `N-172`, `N-174`, `N-175`.

They are linked through `AMBIG-*`, cross-spec boundaries, or external-readiness criteria. This is a traceability observation, not a new finding. Task 17 is not edited.

## 4. Reconciliation

| Primary category | Count |
| --- | ---: |
| `SPECIFICATION_DECISION` | 11 |
| `TEST_GAP` | 2 |
| `CROSS_SPEC_DEPENDENCY` | 6 |
| `EXTERNAL_DEPENDENCY` | 2 |
| `INTENTIONAL_LIMITATION` | 2 |
| **Total** | **23** |

| Risk scope | Count |
| --- | ---: |
| `CORE-001_RUNTIME` | 13 |
| `AUTHORITY_BOUNDARY` | 2 |
| `CROSS_SPEC` | 4 |
| `EXTERNAL_READINESS` | 4 |
| **Total** | **23** |

| Requirement priority | Count |
| --- | ---: |
| P1 | 6 |
| P2 | 5 |
| P3 | 12 |
| **Total** | **23** |

## 5. Reading rules

- A `Proposed transition` is not a status change. Task 17 statuses remain as recorded until evidence and a separate audit revision justify a change.
- `INTENTIONAL_LIMITATION` is a Task 18 disposition label, not a CORE-001 status.
- `BLOCKED` items are not implementation tasks until the named decision is approved.
- `NOT COVERED` is not a defect; it means evidence is absent.
