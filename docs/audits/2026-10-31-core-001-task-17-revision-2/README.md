# CORE-001 Task 17 — Audit Revision 2

**Revision of:** the Task 17 conformance audit at `9c38bbd` ([`../2026-10-31-core-001-task-17/`](../2026-10-31-core-001-task-17/)), over revision 1 at `1440ca4` ([`../2026-10-31-core-001-task-17-revision-1/`](../2026-10-31-core-001-task-17-revision-1/)).
**Evaluated at:** commit `c0abdf0` (T18-02B merged, PR #71).
**Status:** revision 2. Task 17 artifacts are frozen and are **not** edited; this document supersedes their statuses only where listed below.
**Scope:** the C-2.a2 evidence added by T18-02B — the C-2 Assessment recording `CYCLE_DETECTED`. It moves **N-143** BLOCKED → PASS and **`CASE-C-2.a2`** NOT COVERED → PASS.
**Out of scope:** the C-2 **case verdict** (it stays BLOCKED on `CASE-C-2.a3`, CORE-003 / `T18-DEC-13`), N-145, N-168, D-1/D-2/D-4, every other requirement ID, and source, tests, specification, lockfile and configuration. No code, test or spec change was made to produce this revision.

---

## 1. Method

1. Re-read §11.2 and §12 C-2 in `docs/CORE-001.md`.
2. Re-derived the evidence from the tree at `c0abdf0`: the adapter, Core admission and the conformance/unit tests, plus the AEBE package — not from Task 18 conclusions.
3. Applied the Task 17 legend unchanged: `Impl` ∈ PRESENT / PARTIAL / ABSENT / EXTERNAL / N/A, `Verif` ∈ EVIDENCED / PARTIAL / NONE, `Status` ∈ PASS / FAIL / PARTIAL / BLOCKED / NOT COVERED.
4. Left Task 17 files untouched; every changed status is recorded here.

---

## 2. N-143 re-audit — Assessment records `CYCLE_DETECTED`

Task 17 requirement N-143 (§11.2, MUST): a detected cycle must be recorded by an Assessment. Revision 1 left it BLOCKED because C-2 had no implemented subject model; `T18-DEC-16` was later approved (Option D) and T18-02B implemented it.

| Evidence | Location |
| --- | --- |
| The Assessment is constructed by the adapter boundary, not a test literal | `src/adapters/cycle-assessment.ts:119` (`emitCycleAssessments`) |
| Core validates generically, validates contextually, then admits atomically | `src/core/assessment.ts:921` (`registerCycleAssessments`) |
| The exact claim is recorded as unverified on the affected edge | `tests/conformance/c.test.ts:86` (`C-2 cycle detection records CYCLE_DETECTED in an Assessment`) |
| The recorded representation is immutable and the graph is not mutated | same conformance test (`Object.isFrozen`, byte-identical graph) |
| Edge-scoped shape, determinism, acyclic-edge exclusion, self-loop limitation | `tests/unit/cycle-assessment.test.ts`; AEBE `../../2026-10-31-core-001-task-18/aebe/C-2.a2.md` |

**N-143: BLOCKED → PASS.** The implementation follows the approved `T18-DEC-16` Option D boundary: adapter constructs, Core validates and admits, caller persists (`T18-DEC-02`). This is a recording obligation, not a claim about grants.

**Named limit:** the PASS covers recording only. It does not establish grant suppression (`N-145` / `CASE-C-2.a3`), and the C-2 case verdict stays BLOCKED.

---

## 3. CASE-C-2.a2 re-audit

§12 C-2 ([`CORE-001.md`](../../CORE-001.md) §12) requires cycle detection, an Assessment recording `CYCLE_DETECTED`, no dependent grants, no crash, and preservation of declarations.

| Assertion | Evidence at `c0abdf0` | Status |
| --- | --- | --- |
| `CASE-C-2.a1` `V1 → V2 → V1` detected exactly | `tests/unit/lineage-graph.test.ts::detects V1 <-> V2 and keeps declarations readable` (Task 17 evidence, unchanged) | PASS |
| `CASE-C-2.a2` The Assessment records `CYCLE_DETECTED` | `tests/conformance/c.test.ts:86` via `emitCycleAssessments` → `registerCycleAssessments`; one Assessment per affected edge with `unverified_claims: ['CYCLE_DETECTED']`; graph JSON unchanged; frozen array | **PASS** |
| `CASE-C-2.a3` Dependent grants are not applied | no grant API; CORE-003 / `T18-DEC-13` | BLOCKED |
| `CASE-C-2.a4` The system does not crash | `tests/unit/lineage-graph.test.ts::detects V1 <-> V2 and keeps declarations readable` — no throw, declarations readable (Task 17 evidence, unchanged) | PASS |
| `CASE-C-2.a5` Historical declarations are not erased, participants not globally deleted | same graph test: nodes and edges remain | PASS |

**Case status: BLOCKED** — four assertions pass, but `CASE-C-2.a3` cannot be judged inside CORE-001, so the case verdict does not move. **`CASE-C-2.a2` itself: NOT COVERED → PASS.**

**Named limits, so the PASS is not read as broader than it is:**

- **Self-loop limitation.** A structural self-loop is a one-node cyclic component, but the Assessment contract rejects a subject that is its own parent, so the adapter emits no record for it and documents the gap (AEBE §6). This sub-decision is OPEN.
- **A-14** (path breadth in binding validation) is unrelated to graph-level recording and remains OPEN (#65).
- **`T18-DEC-15`** (parent coverage) remains OPEN; `parent_version_ids = [parent]` is the approved local disposition, not a normative resolution.
- Task 17 statuses are otherwise unchanged; the case remains BLOCKED on CORE-003.

---

## 4. Status changes and rollups

| ID | Before | After | Basis |
| --- | --- | --- | --- |
| N-143 | BLOCKED | **PASS** | §2 |
| `CASE-C-2.a2` | NOT COVERED | **PASS** | §3 |

Rollups (revision 1 → revision 2):

| Rollup | PASS | PARTIAL | BLOCKED | NOT COVERED | Total |
| --- | --- | --- | --- | --- | --- |
| CORE-001 runtime conformance | 139 → **140** | 5 → **5** | 5 → **4** | 3 → **3** | 152 → **152** |
| Cross-spec and external boundaries | 10 → **10** | 1 → **1** | 3 → **3** | 0 → **0** | 14 → **14** |
| §16 readiness | 4 → **4** | 3 → **3** | 1 → **1** | 2 → **2** | 10 → **10** |
| **All requirements** | 153 → **154** | 9 → **9** | 9 → **8** | 5 → **5** | 176 → **176** |

§12 corpus: **14 PASS, 2 PARTIAL (D-1, D-4), 2 BLOCKED (C-2, D-2), 0 NOT COVERED** (18 cases) — unchanged, because the C-2 **case** still depends on `CASE-C-2.a3`.

**Readiness label: `NOT_READY` — unchanged.** C-2 and D-2 are blocked, D-1/D-4 are partial, and §16 independent-implementation evidence is absent.

---

## 5. What this revision does not establish

- Full §12 conformance: the C-2 case remains BLOCKED on `CASE-C-2.a3`; D-2 is BLOCKED; D-1/D-4 remain PARTIAL.
- Grant suppression: that is CORE-003 / `T18-DEC-13`, outside this repository's semantic evidence.
- Readiness: `N-168` is unchanged and the label stays `NOT_READY`.
- Any resolution of `T18-DEC-15`, the self-loop sub-decision, or A-14 / #65.
- Any re-interpretation of Task 17 requirements that are not listed in §4. The Task 17 files remain the historical baseline; revision 1 remains a separate historical revision.

---

## 6. Traceability

- Implementation: T18-02B, PR #71 (`c0abdf0`).
- Evidence package: `docs/audits/2026-10-31-core-001-task-18/aebe/C-2.a2.md`.
- Decisions: `T18-DEC-16` (Option D, approved), `T18-DEC-17`, `T18-DEC-13` (grant suppression).
- Prior audits: `docs/audits/2026-10-31-core-001-task-17/` (frozen), `docs/audits/2026-10-31-core-001-task-17-revision-1/`.
- Status entry point: [`STATUS.md`](../../../STATUS.md).
