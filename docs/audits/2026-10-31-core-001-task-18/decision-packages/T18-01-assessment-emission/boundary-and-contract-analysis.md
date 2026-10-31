# Boundary and Contract Analysis — T18-01 Supplement

**Status:** Investigation supplement. No decision approved. No implementation or normative change.
**Revision inspected:** `main` / `057805d`.

## 1. Public API verification

### 1.1 Export path

```
src/core/assessment.ts:336  export function registerAssessment(...)
src/core/index.ts:17        export { assessEdge, evaluateAssurance, registerAssessment } from './assessment.js'
src/index.ts:6              export * from './core/index.js'
package.json exports["."]  -> ./build/index.js (types ./build/index.d.ts)
```

`registerAssessment` is a **public package API**, not an internal-only export. An external host adapter can import it from the package root:

```ts
import { buildLineageGraph, registerAssessment } from 'uia-core-001-refimpl';
```

`buildLineageGraph` is public at `src/core/index.ts:12`. `ContinuityAssessment` is a public type at `src/core/index.ts:18–25`.

### 1.2 What is missing

There is **no public Assessment factory** and **no public semantic validator**. Registration is not an API boundary gap; the gap is construction/validation.

### 1.3 Distinction

| Concern | Status |
| --- | --- |
| Public package API | `registerAssessment`, `buildLineageGraph`, types |
| Internal module export | `assessment.ts` also exports directly; the public barrel re-exports it |
| Test-only helper | `tests/support/traversal.ts:29–51` builds a literal; not a contract |

## 2. Validation boundary

### 2.1 What is checked

`registerAssessment` (`assessment.ts:336`):

- `deepCopy` (`ownership.ts:37`) rejects unsupported JS structures (functions, symbols, non-plain prototypes, accessors, non-enumerable properties, cycles, sparse arrays, arrays with extra own properties);
- `deepFreeze`;
- self-supersession rejected;
- duplicate `assessment_id` rejected;
- unknown `supersedes_assessment_id` rejected;
- supersession cycle rejected.

`assessEdge` (`assessment.ts:138`): duplicate ids, edge triple filter, sort, brand. No field validation.

`evaluateAssurance` (`assessment.ts:262`): brand check, trusted filtering, `verified_claims` read. No field validation.

### 2.2 What is not checked

- required fields and presence;
- non-empty/well-formed IDs;
- runtime enum validity for `declared_relation`;
- array-of-string shape for parents/claims/evidence;
- finite `assessed_at`;
- profile/method presence;
- duplicate parents, empty parents, self-parent;
- claim identifier shape;
- provenance consistency.

Deep copy/freeze is ownership, not semantic validation.

### 2.3 Probe

```json
{
  "registerAssessmentPublic": "function",
  "validatorPublic": "undefined",
  "buildGraphPublic": "function",
  "acceptedMalformed": true,
  "valueLength": 1
}
```

A malformed object with empty IDs, empty parent list, empty profile/method, empty claims, empty domain and timestamp `0` was accepted by `registerAssessment`.

### 2.4 Validation bypass

Public `registerAssessment` can be called without a validator. A separate validator only works if every caller follows `validate → register`; nothing enforces that convention.

| Enforcement model | Bypass risk | Required change |
| --- | --- | --- |
| Separate validator only | High | New validator; documentation; no enforcement |
| Validation inside `registerAssessment` | Low | Runtime validation of the object; behavior change for malformed typed inputs; tests |
| New validated-registration API | Low for the new API; old path remains a bypass unless guarded | New API plus guard/deprecation of the old path |

**Proposal, not approved:** validate inside `registerAssessment` (or a new validated-registration function that guards the old path). The project owner must choose the enforcement boundary.

## 3. Minimum Assessment contract

### 3.1 C-1

| Field | Minimum value |
| --- | --- |
| `assessment_id` | local unique id |
| `subject_version_id` | child version |
| `parent_version_ids` | missing parent(s) |
| `declared_relation` | declared relation |
| `verified_claims` | empty |
| `unverified_claims` | includes `PARENT_UNRESOLVED` |
| `assessment_profile_ref` | local profile |
| `assessment_method_version` | local method |
| `evidence_refs` | descriptor/observation refs |
| `assessed_by` | local domain |
| `assessed_at` | local timestamp |
| `supersedes_assessment_id` | optional, after parent arrives |

Invariants: exact claim; parent genuinely absent; graph/descriptors unchanged; provenance local; no authority consequence.

### 3.2 C-2 models

| Model | Subject | Parents | Determinism | Duplicates | Downstream |
| --- | --- | --- | --- | --- | --- |
| SCC | representative (not specified) | all/representative parents | representative-dependent | one id per SCC | ambiguous subject |
| Node | each node | that node’s parents | sorted nodes | one id per node | natural subject; duplicate edges |
| Edge | edge child | edge parent | sorted edges | one id per edge | granular; clearest edge interpretation |

CORE-001 does not specify the model. This is an **explicit specification question**. Edge-level may be recommended for determinism, but it is not selected.

## 4. Terms

| Term | Meaning |
| --- | --- |
| Construction | Creating the Assessment object; no public factory |
| Validation | Enforcing the field/invariant contract; no public validator |
| Registration | Appending through `registerAssessment`; duplicate/supersession checks only |
| Publication | Making it available downstream; `registerAssessment` returns an array; no store/API |
| Downstream consumption | `assessEdge`/`evaluateAssurance`; grants are CORE-003 |

Registration does not validate; returning an array is not publication.

## 5. Validation owners

| Option | API/contract | Invariants | Tests | Risk |
| --- | --- | --- | --- | --- |
| A. Core validator called by adapter | `validateContinuityAssessment(value: unknown)` | required fields; types; enum; finite timestamps; string arrays; no unknown fields | valid/malformed; ownership; registration after validation | bypass unless registration enforces |
| B. Adapter validator under contract | documented contract | same | adapter contract tests; AEBE rejection | inconsistent adapters |
| C. Core construction + validation | `create...Assessment` with explicit provenance | same plus derivation | construction/validation/AEBE | larger API; policy/time inputs |

## 6. Updated AEBE

AEBE must identify:

1. construction owner;
2. validation owner;
3. registration/publication mechanism;
4. public API used (package root; internal import is a gap);
5. positive evidence (claim, subject, parents, relation, provenance);
6. negative evidence (resolved parent; acyclic graph);
7. validation evidence (malformed rejected);
8. provenance (`assessed_by`, `assessed_at`, profile/method, evidence refs);
9. C-2 model;
10. revision and exact command.

A hand-constructed fixture is not AEBE.

## 7. Proposed decision wording

- **T18-DEC-01:** “Does CORE-001 require a local Assessment recording `PARENT_UNRESOLVED` for an unresolved parent and `CYCLE_DETECTED` for a detected cycle?” — **OPEN**; recommend required at local-assessment level.
- **T18-DEC-02:** “Which boundary owns Assessment construction and registration/publication, and which boundary validates the Assessment contract?” — **OPEN**; recommend adapter construction/registration plus Core validator (Option A).

## 8. NOT VERIFIED

- No adapter implementation; actual adapter behavior unobserved.
- No assessment store/publication API.
- No test for C-1/C-2 Assessment emission.
- No runtime validation of claim arrays; malformed values may fail later.
- C-2 subject/provenance not specified.
- Whether “Assessment” means `ContinuityAssessment` is an interpretation.
