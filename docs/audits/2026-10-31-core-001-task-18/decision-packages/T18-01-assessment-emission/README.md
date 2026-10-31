# T18-01 — Assessment Emission Decision Package

**Status:** Investigation and decision package. No decision is approved. No implementation or normative change is made.
**Repository revision inspected:** `main` / `057805d` (Task 18 merged).
**Task 17 audit revision:** `2a83c65`.
**Normative source:** `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3.

## 1. Objective and scope

This package supports a project-owner decision on two questions:

- **T18-DEC-01** — Assessment recording obligation (OPEN; canonical wording in `decision-register-proposal.md`).
- **T18-DEC-02** — Assessment construction/registration and validation ownership (OPEN; canonical wording in `decision-register-proposal.md`).

The package covers C-1 (orphan/unresolved parent) and C-2.a2 (Assessment with `CYCLE_DETECTED`). C-2.a3 (dependent grant suppression) is a separate CORE-003 question and is not resolved here.

## 2. Files and areas inspected

| Area | Evidence |
| --- | --- |
| Normative text | `docs/CORE-001.md` §11.1 (1031–1049), §11.2 (1051–1063), §12 C-1 (1390–1407), C-2 (1409–1431), §6.2.1 (546–575), §6.2.2 (594–595), §10.1 (987–997), §16 (1624–1639) |
| Assessment types and functions | `src/core/assessment.ts:18` (`ContinuityAssessment`), `:138` (`assessEdge`), `:262` (`evaluateAssurance`), `:336` (`registerAssessment`) |
| Graph and cycle detection | `src/core/lineage.ts:143–147`, `:177`, `:278`, `:340` |
| Traversal cycle result | `src/core/traversal.ts:62–63`, `:429`, `:460`, `:486`, `:801` |
| Error codes | `src/core/errors.ts:16–17` |
| Public exports | `src/core/index.ts:12`, `:17`, `:18–25`; `src/index.ts:6`; `package.json` `exports["."]` |
| Tests | `tests/conformance/c.test.ts:10–11`; `tests/unit/lineage-graph.test.ts:144`, `:173`; `tests/support/traversal.ts:29–51` |

## 3. Executive conclusion

- CORE-001 requires the local assessment to **record** the unresolved-parent and cycle conditions. The text does not specify the assessment boundary, subject/provenance for a cycle, or a registration/publication mechanism.
- Detection is implemented. Assessment construction, validation, registration and publication are separate concerns and are not all implemented.
- `registerAssessment` **is publicly exported** through `src/core/index.ts:17` and the package root. There is **no public Assessment factory or semantic validator**. Registration is not an API boundary gap.
- Public `registerAssessment` can be called without a validator. A probe accepted a malformed Assessment. This is an explicit architectural risk.
- The C-2 Assessment subject model (SCC, node, or edge) is **not specified**. It remains an explicit open question.

## 4. Decision status

| Decision | Subject | Status | Recommendation |
| --- | --- | --- | --- |
| **T18-DEC-01** | Assessment recording obligation | **OPEN** | Required at the local-assessment level; not approved |
| **T18-DEC-02** | Construction/registration and validation ownership | **OPEN** | `OWN-ADAPTER` plus `VAL-CORE`; not approved |

## 5. Recommended next action

1. Project owner decides T18-DEC-01 and T18-DEC-02, including the validation-owner question.
2. If emission is required, choose the C-2 Assessment subject model in a separate specification clarification or an explicitly approved local policy.
3. Only then create conditional implementation tasks (T18-02A/B/C) and produce AEBE.
4. Keep C-2.a3 separate; C-2 remains BLOCKED until CORE-003 provides grant-suppression evidence.

## 6. Task 17 baseline (unchanged)

- Overall: 152 PASS, 8 PARTIAL, 7 BLOCKED, 8 NOT COVERED, 0 FAIL.
- §12: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED.
- C-1 is NOT COVERED; C-2 is BLOCKED; C-2.a1 PASS; C-2.a2 NOT COVERED; C-2.a3 BLOCKED.

These are historical facts. This package does not rewrite them.

## 7. Package map

| File | Contents |
| --- | --- |
| `README.md` | Objective, scope, conclusion, decision status, next action |
| `normative-analysis.md` | C-1 and C-2.a2 normative text and interpretation |
| `implementation-analysis.md` | Execution paths, public API, validation behavior, feasibility |
| `decision-recommendation.md` | `OWN-*` ownership options and `VAL-*` validation owners |
| `decision-register-proposal.md` | Exact proposed T18-DEC-01/02 entries, both OPEN |
| `remediation-branch-map.md` | `PATH-A/B/C`, AEBE, T18-13 dependency |

## 8. No-change statement

No source code, tests, `docs/CORE-001.md`, Task 17 audit artifacts, or existing Task 18 decision statuses were modified. No implementation commit or merge to `main` was made. The documentation package is proposed in PR #39 on branch `docs/t18-01-assessment-emission-package`.
