# T18-09E — Evidence Index

**Purpose:** trace every statement in `c2-subject-model.md` to a normative, implementation, test or Task 17/18 source.
**Repository revision:** `2d26d43`.

## 1. Normative sources (`docs/CORE-001.md`)

| Location | Text / requirement | Used for |
| --- | --- | --- |
| §11.2 `:1051-1064` | Local graph MUST be checked for cycles; on detection the declarations are preserved, an Assessment records `CYCLE_DETECTED`, the cycle is not proof, dependent grants MUST NOT be applied, read-only continuation MAY be allowed | Trigger is graph-level; recording obligation; grant consequence |
| §12 C-2 `:1409-1428` | Precondition: `V1 → V2 → V1`; input: a declaration closing the cycle; expected: Assessment records `CYCLE_DETECTED`, dependent grants not applied; forbidden: crash, global deletion, erasure | "Closing declaration" wording vs graph-level trigger |
| §6.2.1 `:546-577` | `ContinuityAssessment` shape: one `subject_version_id`, one `declared_relation`, `parent_version_ids`, claim lists | Schema constraint: no set subject, no mixed relation |
| §6.2.2 `:578-597` | verified vs unverified claim semantics; `CYCLE_DETECTED` as example claim; absence is not confirmation | Claim polarity sub-decision (§7.1) |
| §8.8 `:848-871` | Result MUST NOT depend on declaration arrival order, storage order, traversal order | Rejects a temporally-defined "closing edge" |
| §13 `:1460-1500` | Authority separation; no automatic grant; line independence | No grant implications from the model itself |
| §14.2 `:1572-1586` | CORE-001/CORE-003 boundary | Grant suppression is CORE-003 (`T18-DEC-13`) |

## 2. Approved decisions (`docs/audits/2026-10-31-core-001-task-18/decision-register.md`)

| Location | Decision | Used for |
| --- | --- | --- |
| §3 `T18-DEC-01` | `REQ-LOCAL` — local Assessment recording `PARENT_UNRESOLVED` and `CYCLE_DETECTED` is required | Establishes the obligation this decision shapes |
| §3 `T18-DEC-02` | `OWN-ADAPTER` + `VAL-CORE` — adapter constructs, Core validates and admits, storage caller-managed, publication/retention OPEN | Provenance and 16.c framing |
| §3 `T18-DEC-15` | OPEN — parent coverage (complete declared set vs covered subset) | §7.3 sub-decision |
| `T18-DEC-13` | OPEN — grant suppression observability (CORE-003) | C-2 case remains blocked after this decision |

## 3. Task 17 audit sources

| Location | Content | Used for |
| --- | --- | --- |
| `conformance-matrix.md` §C-2 | `CASE-C-2.a1…a5`; a2 "The assessment records `CYCLE_DETECTED`" NOT COVERED; a3 grants BLOCKED; case status BLOCKED | What remains after the model decision |
| `requirement-matrix.md` `N-143` | NOT COVERED — traversal returns `CYCLE_DETECTED`; no assessment records it | Target requirement for `T18-02B` |
| `requirement-matrix.md` `N-145` | BLOCKED — dependent grants not applied | CORE-003 boundary |
| `requirement-matrix.md` `N-168` | NOT COVERED — all Category C tests | Readiness impact (unchanged here) |

## 4. Task 18 disposition and roadmap sources

| Location | Content | Used for |
| --- | --- | --- |
| `disposition-matrix.md` row `N-143` | `SPECIFICATION_DECISION`; `T18-02B` blocked; PASS only with AEBE | Blocker chain |
| `disposition-matrix.md` row `N-145` | cross-spec dependency on CORE-003 (`T18-DEC-13`) | Case remains BLOCKED after the model |
| `remediation-roadmap.md` row `T18-02B` | "BLOCKED until C-2 model approved" | The gap this package names as `T18-DEC-16` |
| `remediation-roadmap.md` critical path | `T18-02B → AEBE → T18-13` | Why an unregistered decision was on the critical path |

## 5. Implementation sources (`src/`)

| Location | Behaviour | Used for |
| --- | --- | --- |
| `src/core/lineage.ts:356` | sorted SCCs in the graph (`cycles`) | Graph-level subject candidate set |
| `src/core/traversal.ts:423` | `buildCycleIndex` maps every SCC node to its component | Current cycle semantics |
| `src/core/traversal.ts:490` | `cycleForPath` returns the union of touched cycles | Current binding-level result |
| `src/core/assessment.ts:60` | `BLOCKED_ASSESSMENT_CLAIMS = {'CYCLE_DETECTED'}` — generic admission rejects the claim while C-2 is blocked | Admission-path consequence of approving the model |
| `src/core/assessment.ts:66` | `claimListsFailure` — blocked and overlap claim rules | Claim-polarity interaction (§7.1) |
| `src/core/assessment.ts:645` | `validateOrphanClaims` — C-1 contextual rules (mirror for the cycle path) | Precedent for contextual admission |
| `src/core/assessment.ts:804` | `registerOrphanAssessments` — C-1 atomic batch validation/admission | Precedent for the `T18-02B` path |
| `src/adapters/orphan-assessment.ts:109` | `emitOrphanAssessment` — adapter constructs before Core admission | Precedent for the cycle adapter |

## 6. Test sources (`tests/`)

| Location | Content | Used for |
| --- | --- | --- |
| `tests/conformance/c.test.ts:66` | `test.todo('C-2 ...')` | No C-2 assessment evidence today |
| `tests/unit/lineage-graph.test.ts` | SCC detection, declarations preserved | `CASE-C-2.a1/a4/a5` already PASS |
| `tests/unit/assessment-validation.test.ts` | generic validator rejects `CYCLE_DETECTED`; claim overlap rule | Current admission behaviour |
| `tests/unit/traversal-phases.test.ts` | binding-level `CYCLE_DETECTED` per path | Current behaviour vs proposed graph-level model |

## 7. How to verify this index

1. Check that every quoted normative sentence still matches `docs/CORE-001.md` at the cited line range (line numbers drift; the section is authoritative).
2. Check that implementation lines still show the described behaviour (`grep` the symbol; line numbers drift).
3. The recommendation in `c2-subject-model.md` is an interpretation; where this index cites implementation evidence it establishes current behaviour only, never normative meaning.
