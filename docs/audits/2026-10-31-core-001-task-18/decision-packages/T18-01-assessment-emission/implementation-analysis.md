# Implementation Analysis — Assessment Emission

**Revision inspected:** `main` / `057805d`.
**Rule:** statements below are code facts with file/line references, or explicitly labelled interpretation.

## Decision references

- **T18-DEC-01** — **OPEN**; canonical wording in `decision-register-proposal.md`.
- **T18-DEC-02** — **OPEN**; canonical wording in `decision-register-proposal.md`.

## 1. Public API

### 1.1 What is public

| Symbol | Export path | Kind |
| --- | --- | --- |
| `registerAssessment` | `src/core/index.ts:17` → `src/index.ts:6` → package root (`package.json` `exports["."]`) | Public package API |
| `buildLineageGraph` | `src/core/index.ts:12` → package root | Public package API |
| `ContinuityAssessment` | `src/core/index.ts:18–25` (type) → package root | Public type |
| `LineageGraph` | `src/core/index.ts:13` (type) → package root | Public type |
| `assessEdge`, `evaluateAssurance` | `src/core/index.ts:17` | Public package API |

`registerAssessment` is therefore **not** an internal-only export. An external host adapter can import it from the package root. Registration is **not** an API boundary gap.

### 1.2 What is not public

- No `validateContinuityAssessment`.
- No `createContinuityAssessment`.
- No `emitAssessment` or assessment store.
- No public function that derives an orphan/cycle Assessment from `LineageGraph`.

A read-only probe confirmed:

```json
{
  "registerAssessmentPublic": "function",
  "validatorPublic": "undefined",
  "buildGraphPublic": "function",
  "acceptedMalformed": true,
  "valueLength": 1
}
```

The malformed object had empty IDs, empty parent list, empty profile/method, empty claims, empty domain, timestamp `0`.

Reproducible probe (run from the repository root):

```bash
bun -e "
import * as core from './src/index.ts';
const malformed = {
  assessment_id: '', subject_version_id: '', parent_version_ids: [], declared_relation: 'CONTINUATION',
  assessment_profile_ref: '', assessment_method_version: '', verified_claims: [], unverified_claims: [],
  evidence_refs: [], assessed_by: '', assessed_at: 0,
};
const result = core.registerAssessment([], malformed);
console.log(JSON.stringify({
  registerAssessmentPublic: typeof core.registerAssessment,
  validatorPublic: typeof core.validateContinuityAssessment,
  buildGraphPublic: typeof core.buildLineageGraph,
  acceptedMalformed: result.ok,
  valueLength: result.ok ? result.value.length : null,
}));
"
```

## 2. Current execution paths

### 2.1 Orphan/unresolved parent (C-1)

- `buildLineageGraph` (`lineage.ts:340`) collects edges (`:162`) and unresolved parents (`:177`).
- `LineageGraph.unresolvedParents` (`lineage.ts:146`) is a list of `[child, missingParents[]]`, sorted and deduplicated for diagnostics.
- `discoverPaths` (`traversal.ts:308`) builds reverse reachability only over existing nodes; a missing parent cannot be reached, so the candidate has no path and discovery returns `ERR_NO_TRAVERSAL_PATH` (`traversal.ts:172`).
- No code creates an Assessment from `unresolvedParents`.
- `PARENT_UNRESOLVED` exists only as a normative error-code literal (`errors.ts:17`).

### 2.2 Cycle (C-2)

- `buildLineageGraph` computes SCCs (`lineage.ts:278`) and exposes `cycles` (`:147`).
- `validatePath` (`traversal.ts:460`) checks path nodes against the cycle index (`:429`) and returns `CYCLE_DETECTED` (`:486`).
- `evaluateBinding` (`traversal.ts:801`) preserves per-path `CYCLE_DETECTED` and aggregates it (`:776–779`).
- No code creates an Assessment from `cycles`.
- `CYCLE_DETECTED` is a traversal result and a supersession error code (`assessment.ts:109`); it is not an assessment claim.

### 2.3 Assessment registration

`registerAssessment` (`assessment.ts:336`):

1. deep-copies `existing` and `successor` (`deepCopy`, `ownership.ts:37`);
2. deep-freezes the copies;
3. rejects self-supersession;
4. rejects duplicate `assessment_id`;
5. rejects unknown `supersedes_assessment_id`;
6. rejects a supersession cycle;
7. returns a new frozen array.

It does **not** validate field presence, types, enum values, empty strings, timestamp finiteness, claim arrays, or provenance.

`assessEdge` (`assessment.ts:138`) deep-copies candidates, rejects duplicate ids, filters by `(subject, relation, parent)`, sorts, and brands. It also does not validate fields.

`evaluateAssurance` (`assessment.ts:262`) checks the brand, filters trusted assessors, reads `verified_claims`, and computes missing/disallowed. It does not validate the assessment shape.

### 2.4 Fields and invariants not checked

`registerAssessment`, `assessEdge` and `evaluateAssurance` do not check:

- required fields and their presence;
- non-empty or well-formed IDs;
- runtime enum validity for `declared_relation`;
- array-of-string shape for `parent_version_ids`, `verified_claims`, `unverified_claims`, `evidence_refs`;
- finite `assessed_at`;
- `assessment_profile_ref` / `assessment_method_version` presence or content;
- duplicate parents, empty parent sets, self-parent assessments;
- claim identifier shape;
- provenance consistency (`assessed_by` domain, `assessed_at` domain time).

Deep copy/freeze is ownership, not semantic validation.

## 3. Minimum C-1 Assessment contract

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

Invariants: exact claim; parent genuinely absent; graph/descriptors unchanged; provenance local; no authority consequence. This is a minimum contract, not an approved C-2 model.

## 4. Terms kept separate

| Term | Meaning today |
| --- | --- |
| Construction | Creating a `ContinuityAssessment` object. No public factory; callers build the literal. |
| Validation | Enforcing the field/invariant contract. No public validator; `deepCopy`/`deepFreeze` are ownership, not semantic validation. |
| Registration | Appending a caller-supplied object through `registerAssessment`; duplicate/supersession checks only. |
| Publication | Making the registered assessment available to other components. `registerAssessment` returns an array; there is no store or publication API. |
| Downstream consumption | `assessEdge`/`evaluateAssurance` for edge assurance; grant consequences are CORE-003. |

These are not interchangeable. In particular, registration does not validate, and returning an array is not a publication mechanism.

## 5. Validation bypass risk

Public `registerAssessment` can be called without any validator. The probe accepted a malformed object. A separate `validateContinuityAssessment` would only work if every caller follows `validate → register`; nothing enforces that convention.

| Enforcement model | Bypass risk | Required change |
| --- | --- | --- |
| Separate validator only | High: callers can call `registerAssessment` directly | New public validator; documentation; tests cannot prove all callers use it |
| Validation inside `registerAssessment` | Low: malformed values are rejected at registration | `registerAssessment` must validate the object at runtime; behavior change for malformed typed inputs; tests for each rejection |
| Validation inside a new construction/registration API | Low for that API, but old `registerAssessment` remains a bypass unless deprecated/guarded | New API plus either guard the old one or document it as unchecked |

**Proposal, not approved:** make `registerAssessment` validate through a shared `validateContinuityAssessment` (or introduce a validated registration function and guard the old one). The project owner must choose the enforcement boundary. Do not assume the `validate → register` convention is sufficient.

## 6. Ownership feasibility

### 6.1 Core construction/registration

- Requires a new API with explicit `assessed_by`, `assessed_at`, profile, method, evidence refs.
- Core has no clock: `temporal.ts` exposes declared/trust values, not `now`.
- Deterministic from graph state plus explicit inputs.
- Directly testable; one validation source if construction validates.
- Adds public surface and duplicates domain policy inputs.

### 6.2 Adapter construction/registration

- Uses public `buildLineageGraph` (`unresolvedParents`, `cycles`) and `registerAssessment`.
- Adapter owns domain identity, clock, profile/method, evidence.
- No new Core API required for registration.
- But validation is absent; adapter must either validate itself or call a new Core validator.
- Different adapters can choose different C-2 models/IDs unless a contract is defined.

### 6.3 No normative emission requirement

- Not supported by §11.2/§12; would require a specification change and re-audit.
- No implementation task should be created under this outcome.

## 7. C-2 model data availability

`LineageGraph.cycles` provides node sets, and `LineageGraph.edges` provides `(child, parent, relation)`. An adapter can derive:

- SCC-level: choose a representative (not specified);
- node-level: one assessment per node, using that node’s parents;
- edge-level: one assessment per edge, using the edge’s child/parent.

The implementation provides enough data for all three, but does not choose one. No implementation task may assume a model before the decision.

## 8. NOT VERIFIED

- No adapter implementation exists; actual adapter behavior cannot be observed.
- No public validator; malformed objects can be registered (probe).
- No assessment store or publication mechanism beyond the returned array.
- No test for C-1/C-2 Assessment emission (`c.test.ts:10–11` are todos).
- No runtime validation of `verified_claims`/`unverified_claims` arrays; malformed claim values could fail later in `evaluateAssurance`.
- The exact C-2 subject/provenance is not specified.