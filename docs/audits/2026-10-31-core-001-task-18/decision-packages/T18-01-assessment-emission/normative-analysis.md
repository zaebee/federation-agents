# Normative Analysis — C-1 and C-2.a2

**Normative source:** `docs/CORE-001.md` Rev 0.3.3.
**Rule:** quotations are specification facts; everything labelled “Interpretation” is audit analysis.

## Decision references

- **T18-DEC-01** — **OPEN**; canonical wording in `decision-register-proposal.md`.
- **T18-DEC-02** — **OPEN**; canonical wording in `decision-register-proposal.md`.

## 1. C-1 — unresolved/orphan parent

### 1.1 Exact references

- §11.1 (line 1031) “Delayed Parent Resolution”:
  - line 1037: «локальная оценка MUST фиксировать неразрешённость родителя».
  - lines 1042–1047 example:
    ```
    verified_claims: []

    unverified_claims:
      - PARENT_UNRESOLVED
    ```
  - line 1049: «После получения родительского дескриптора домен MAY выпустить новый Assessment.»
- §12 C-1 (line 1390), expected result line 1403: «Оценка фиксирует `PARENT_UNRESOLVED`.»
- §6.2.1 (line 546) defines `ContinuityAssessment`; §6.2.2 line 594 lists `PARENT_UNRESOLVED` among claim identifiers.

### 1.2 Interpretation

The specification requires the domain’s local assessment to record the unresolved-parent condition. The example uses the `ContinuityAssessment` claim fields, so the natural reading is a `ContinuityAssessment` with `unverified_claims` containing `PARENT_UNRESOLVED`.

The text does **not** state:

- that the Core library must construct or emit the object;
- the assessment subject (though the child is the natural subject);
- the exact parent list (the missing parent or parents);
- the required `assessment_profile_ref`, `assessment_method_version`, `evidence_refs`;
- `assessed_by` / `assessed_at` values;
- whether registration or publication is required.

### 1.3 Obligation separation

| Obligation | Status in CORE-001 | Implementation today |
| --- | --- | --- |
| Detect the condition | Required by §11.1 | `buildLineageGraph` returns `unresolvedParents` (`lineage.ts:146`, `:177`, `:340`) |
| Construct an Assessment | Implied by “локальная оценка” and the example | Type exists (`assessment.ts:18`); no factory |
| Emit/register an Assessment | Not specified as an API obligation | `registerAssessment` is public (`assessment.ts:336`); no derivation from graph |
| Make it available downstream | Not specified | `registerAssessment` returns a new array; no store |
| Apply authority/grant consequence | Not in CORE-001 | CORE-003 |

### 1.4 Explicit, implied, absent, ambiguous

- Claim: **explicit** (`PARENT_UNRESOLVED`).
- Recording obligation: **explicit/implied** (“локальная оценка MUST фиксировать”).
- Assessment type: **implied** by §6.2.1 and the example.
- Emission boundary: **absent**.
- Subject/provenance details: **partially absent**.

### 1.5 Evidence that supports and weakens the reading

**Supports:** §11.1 uses MUST for the local assessment; the example uses `verified_claims`/`unverified_claims`; §12 C-1 repeats the claim; §6.2.2 lists the claim.

**Weakens:** “локальная оценка” is not defined as “the Core library must emit”; the example is illustrative; the specification never names an API or a registration mechanism. A host adapter could satisfy the obligation without the Core emitting.

## 2. C-2.a2 — cycle detection Assessment

### 2.1 Exact references

- §11.2 (line 1051) “Cycle Detection”:
  - line 1053: «Локальный граф MUST быть проверен на циклические связи.»
  - line 1058: «Assessment фиксирует `CYCLE_DETECTED`».
  - line 1060: «домен MUST NOT применять зависимые от такой преемственности гранты».
- §12 C-2 (line 1409), expected result line 1423: «Assessment фиксирует `CYCLE_DETECTED`.»
- §6.2.2 line 595 lists `CYCLE_DETECTED` among claim identifiers.

### 2.2 Interpretation

The specification explicitly requires an Assessment to record `CYCLE_DETECTED`. It does not specify:

- who constructs/emits the Assessment;
- whether there is one Assessment per strongly connected component, per cycle node, or per affected edge;
- which node is the `subject_version_id`;
- the `parent_version_ids` for a cycle;
- provenance (`assessed_by`, `assessed_at`, profile/method, evidence refs);
- registration or publication.

A cycle is a set of nodes, while `ContinuityAssessment.subject_version_id` is a single ID. This is a material shape ambiguity, not a mere implementation detail.

### 2.3 Obligation separation

| Obligation | Status in CORE-001 | Implementation today |
| --- | --- | --- |
| Detect the cycle | Required by §11.2 | `buildLineageGraph.cycles` (`lineage.ts:147`, `:278`, `:340`); `validatePath` returns `CYCLE_DETECTED` (`traversal.ts:486`) |
| Construct an Assessment | Explicit for the record | Type exists; no factory |
| Emit/register an Assessment | Not specified as an API obligation | `registerAssessment` is public; no derivation |
| Make it available downstream | Not specified | Returned array; no store |
| Suppress dependent grants | Required by §11.2, CORE-003 scope | No grant API; `CASE-C-2.a3` BLOCKED |

### 2.4 C-2 Assessment subject models

| Model | Subject | Parent references | Determinism | Duplicate handling | Downstream interpretation |
| --- | --- | --- | --- | --- | --- |
| One per SCC | representative node (not specified) | all cycle parents or representative’s parents | depends on representative choice | one id per SCC | loses per-node detail; subject ambiguous |
| One per cycle node | each node in the SCC | that node’s parents | sorted node order | one id per node | natural for `subject_version_id`; may duplicate edges |
| One per affected edge | edge child | the edge parent | sorted edge order | one id per edge | most granular; clearest edge interpretation |

CORE-001 does not choose among these. This is an **explicit specification question**. A recommendation may favor edge-level for determinism, but it must not be treated as normative or implementation policy without approval.

### 2.5 Evidence that supports and weakens the reading

**Supports:** §11.2 uses “Assessment фиксирует”; §12 C-2 repeats it; §6.2.2 lists `CYCLE_DETECTED` as a claim.

**Weakens:** the specification never defines the assessment subject for a cycle; “Assessment” is not explicitly tied to `ContinuityAssessment` in §11.2; no emission boundary is named.

## 3. C-2.a3 — separate authority obligation

§11.2 line 1060 requires that the domain MUST NOT apply dependent grants. That is a CORE-003 authority-boundary obligation, not an Assessment obligation. An Assessment object does not create, revoke, or suppress authority.

Consequences:

- C-2.a2 (Assessment claim) and C-2.a3 (grant suppression) are independent.
- C-2.a2 can close while C-2.a3 remains BLOCKED.
- C-2 case remains BLOCKED until a3 is resolved.
- T18-DEC-01/02 cannot close C-2.

## 4. DEC-01 reference

Canonical wording is in `decision-register-proposal.md` under `T18-DEC-01`.
Recommendation: **`REQ-LOCAL`** (required at the local-assessment level); status **OPEN**.