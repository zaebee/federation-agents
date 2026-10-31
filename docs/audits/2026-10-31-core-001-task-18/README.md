# CORE-001 Conformance Gap Disposition — Task 18

**Status:** Planning, disposition and T18-02A/T18-02B implementation record, with T18-03 test evidence. Four decisions approved (`T18-DEC-01`, `T18-DEC-02`, `T18-DEC-16`, `T18-DEC-17`); 13 OPEN. T18-02A and T18-02B are implemented; C-2 remains BLOCKED on `CASE-C-2.a3`.
**Audit base:** commit `2a83c65` (`main`, Task 17 merged).
**Normative source:** `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3.
**Task 17 inputs:** `docs/audits/2026-10-31-core-001-task-17/` (README, requirement matrix, conformance matrix, registers).
**Task 18 artifacts:** this README, `disposition-matrix.md`, `remediation-roadmap.md`, `decision-register.md`, `reconciliation-notes.md`.

## 1. Purpose and scope

Task 17 established what the implementation proves, what it does not, and what remains normatively blocked. Task 18 answers the next question: for each of the 23 non-PASS items, what is missing, what kind of gap is it, what is the smallest valid next step, what must precede it, and what evidence would justify a status change?

Task 18 does not:

- change Task 17 statuses or findings;
- modify `docs/CORE-001.md`, source, tests, or configuration;
- implement remediation;
- infer approvals beyond the two explicitly recorded decisions; all other decisions remain OPEN;
- claim that a plan closes a gap.

## 2. Method

1. Re-read the Task 17 requirement matrix, conformance matrix, and registers at `2a83c65`.
2. Enumerated every non-PASS requirement directly from the matrix (not only from the summary rollup).
3. Reconstructed the §12 non-PASS assertions and their evidence.
4. Classified each item by primary disposition, secondary disposition, risk scope, and remediation priority.
5. Separated normative decisions from implementation, test, documentation, cross-spec, and external work.
6. Defined conditional tasks and independent closure evidence.
7. Recorded Task 17 inconsistencies in `reconciliation-notes.md` without editing Task 17.

## 3. Task 17 baseline (unchanged)

| Status | Count |
| --- | ---: |
| PASS | 152 |
| PARTIAL | 8 |
| BLOCKED | 7 |
| NOT COVERED | 8 |
| FAIL | 0 |
| **Total** | **175** |

| §12 case status | Count |
| --- | ---: |
| PASS | 13 |
| PARTIAL | 2 (D-1, D-4) |
| BLOCKED | 2 (C-2, D-2) |
| NOT COVERED | 1 (C-1) |

Task 17 statuses are preserved exactly. Task 18 uses them as inputs and does not rewrite them.

## 4. Non-PASS reconciliation

23 items: 13 runtime, 4 cross-spec/external boundary, 6 §16 readiness.

| Primary disposition | Count | Items |
| --- | ---: | --- |
| `SPECIFICATION_DECISION` | 11 | N-019, N-020, N-040, N-078, N-084, N-107, N-112, N-128, N-138, N-143, N-172 |
| `TEST_GAP` | 2 | N-041, N-168 |
| `CROSS_SPEC_DEPENDENCY` | 6 | N-026, N-079, N-145, N-156, N-169, N-174 |
| `EXTERNAL_DEPENDENCY` | 2 | N-170, N-175 |
| `INTENTIONAL_LIMITATION` | 2 | N-004, N-140 |
| **Total** | **23** | |

No item has `IMPLEMENTATION_GAP` as its primary disposition. Implementation work is conditional on the relevant decision; DEC-01/02 are approved, all other decisions remain OPEN.

| Risk scope | Count | Items |
| --- | ---: | --- |
| `CORE-001_RUNTIME` | 13 | N-004, N-019, N-020, N-040, N-041, N-078, N-084, N-107, N-112, N-138, N-140, N-143, N-172 |
| `AUTHORITY_BOUNDARY` | 2 | N-079, N-145 |
| `CROSS_SPEC` | 4 | N-026, N-156, N-169, N-174 |
| `EXTERNAL_READINESS` | 4 | N-128, N-168, N-170, N-175 |
| **Total** | **23** | |

| Requirement priority | Count | Items |
| --- | ---: | --- |
| P1 | 6 | N-078, N-107, N-112, N-138, N-143, N-168 |
| P2 | 5 | N-019, N-040, N-041, N-128, N-172 |
| P3 | 12 | N-004, N-020, N-026, N-079, N-084, N-140, N-145, N-156, N-169, N-170, N-174, N-175 |
| **Total** | **23** | |

### 4.1 Approved decisions

- **T18-DEC-01 — `REQ-LOCAL`:** CORE-001 requires a local Assessment recording `PARENT_UNRESOLVED` and `CYCLE_DETECTED`. This is a recording obligation; it does not assign construction/publication to Core.
- **T18-DEC-02 — `OWN-ADAPTER` + `VAL-CORE` (Core-owned admission/representation):** adapter constructs the Assessment; Core owns semantic validation and admission; the registered representation is immutable; persistent storage is caller-managed. DEC-02 left publication/retention **OPEN**; `T18-DEC-17` (approved 2026-10-31) subsequently assigned them to the caller boundary. `T18-02A` is planning- and acceptance-eligible. See `decision-register.md` §3 for the canonical scope and enforcement.
- **T18-DEC-16 — C-2 subject model and Assessment shape/provenance (Option D, approved 2026-10-31):** one Assessment per affected lineage edge inside a cyclic SCC (`subject_version_id` = child, `declared_relation` = edge relation, `parent_version_ids` = `[parent]`, `CYCLE_DETECTED` in `unverified_claims`); adapter constructs, Core validates and admits, caller persists. Unblocks `T18-02B`; does not make the `T18-DEC-15` subset reading normative.
- **T18-DEC-17 — publication and retention ownership (approved 2026-10-31):** the caller boundary owns persistence, publication and retention; the Core contract ends at the immutable admitted representation; publication/retention claims require caller evidence.

Still OPEN: `T18-DEC-15` parent-coverage semantics and C-2.a3 / CORE-003, plus the other Task 18 decisions. `T18-DEC-17` is approved independently and does not gate recording.

**Implemented tasks:** T18-02A (C-1 emission, `aebe/C-1.md`), T18-02B (C-2.a2 emission, `aebe/C-2.a2.md`), and T18-03 (test-only D-4 policy evidence in `tests/conformance/d.test.ts`; N-041/D-4 remain PARTIAL). C-2 stays BLOCKED on `CASE-C-2.a3` (CORE-003).

## 5. Roadmap overview

| Task | Type | Priority | Risk scope |
| --- | --- | --- | --- |
| T18-01 Assessment-emission decision package | specification/design | P1 | `CORE-001_RUNTIME` |
| T18-02A C-1 adapter emission (implemented; acceptance evidence in AEBE) | implementation + tests | P1 | `CORE-001_RUNTIME` |
| T18-02B C-2.a2 adapter emission (implemented; AEBE `aebe/C-2.a2.md`) | implementation + tests | P1 | `CORE-001_RUNTIME` |
| T18-02C Retired / superseded (historical ID; scope split into T18-02A/B) | — | — | `CORE-001_RUNTIME` |
| T18-03 D-4 future-authorization evidence (implemented; D-4 remains PARTIAL) | test-only | P2 | `CORE-001_RUNTIME` |
| T18-04 Version-label boundary (conditional) | decision + implementation/test or docs | P2 | `CORE-001_RUNTIME` |
| T18-05 Digest verification (conditional) | decision + implementation/test or docs | P3 | `CORE-001_RUNTIME` |
| T18-06 Signed-at trust precondition | specification decision + docs | P2 | `CORE-001_RUNTIME` |
| T18-07 Runtime execution limitation | documentation-only | P3 | `CORE-001_RUNTIME` |
| T18-08 Contested-claim gating boundary | cross-spec decision/docs | P3 | `AUTHORITY_BOUNDARY` |
| T18-09A Assurance ambiguity decisions | specification decisions | P1 | `CORE-001_RUNTIME` |
| T18-09B CONTENT_HASH decision | specification decision | P3 | `CORE-001_RUNTIME` |
| T18-09C Trusted-time decision | specification decision | P2 | `EXTERNAL_READINESS` |
| T18-09D N-172 readiness evidence decision | specification decision | P2 | `CORE-001_RUNTIME` |
| T18-09E C-2 subject model decision package (`T18-DEC-16`/`T18-DEC-17`) | specification/design | P1 | `CORE-001_RUNTIME` |
| T18-10 Cross-spec packages | cross-spec integration | P3 | `CROSS_SPEC` |
| T18-11 External readiness | external dependency | P3 | `EXTERNAL_READINESS` |
| T18-12 Documentation reconciliation | documentation-only | P3 | `CORE-001_RUNTIME` |
| T18-13 Readiness closure evidence | readiness/test | P1 | `EXTERNAL_READINESS` |
| T18-SPEC-01 Specification-change package (conditional) | specification | P2 | `CORE-001_RUNTIME` |

Milestones:

- **M0** — decisions registered and owners assigned (T18-DEC-01…15; `T18-DEC-16`/`T18-DEC-17` registered and approved 2026-10-31).
- **M1** — CORE-001 implementation gaps resolved or explicitly dispositioned (T18-02A and T18-02B implemented; C-2 stays BLOCKED on `CASE-C-2.a3`; T18-02C retired / superseded; T18-04, T18-05).
- **M2** — evidence gaps addressed: T18-03 test evidence added; T18-07 pending.
- **M3** — cross-spec packages accepted (T18-08, T18-10).
- **M4** — readiness and external evidence (T18-11, T18-13), documentation reconciliation (T18-12).

Critical path: `T18-DEC-01`/`T18-DEC-02` → T18-01 → T18-02A → AEBE → T18-13; C-2 has T18-02B implemented (`a2` evidence in `aebe/C-2.a2.md`); `CASE-C-2.a3` still needs T18-DEC-13/T18-10; readiness additionally needs T18-11 for N-170/N-175. N-172 is tracked separately as T18-09D (P2).

## 6. Key separations preserved

### N-143 versus C-2

- `N-143` (Assessment records `CYCLE_DETECTED`) can close independently when the claim is produced by the owning boundary.
- `CASE-C-2.a2` can become PASS while `CASE-C-2.a3` (grant suppression) remains BLOCKED.
- **C-2 case remains BLOCKED** until a3 is resolved. Implementing `CYCLE_DETECTED` does not close C-2.

### N-168 readiness

Readiness outcomes are Task 18 reporting labels: `READY`, `CONDITIONALLY_READY`, `NOT_READY`. They are not CORE-001 statuses. An accepted BLOCKED disposition does not imply readiness. `READY` requires T18-11 completion and confirmed N-170/N-175 evidence; `CONDITIONALLY_READY` requires explicit acceptance of the external dependency with its impact; `NOT_READY` applies when required compatibility evidence is absent and not accepted.

### N-084 digest verification

If `T18-DEC-05` assigns verification to callers, N-084 does not close on documentation alone. It requires an explicit caller contract, evidence that the caller boundary performs the comparison, and negative mismatch evidence.

### Specification change boundary

Decision packages may record decisions and prepare proposals. T18-06 in particular records the decision and proposed wording; it does not edit normative text. They cannot modify `docs/CORE-001.md`. Any normative amendment requires separately approved `T18-SPEC-01` and a re-audit of affected Task 17 items.

## 7. Current readiness assessment

**`NOT_READY`.** C-1 is **PASS** (Task 17 audit revision 1, `docs/audits/2026-10-31-core-001-task-17-revision-1/`), C-2 is BLOCKED, D-2 is BLOCKED, D-1 and D-4 are PARTIAL, and independent implementation compatibility is not evidenced. This is a reporting label; it does not change Task 17 statuses.

## 8. Known Task 17 inconsistencies

Recorded in `reconciliation-notes.md`; Task 17 files are untouched.

1. `N-169` text says “D-1, D-3, D-4 pass”, but D-1 and D-4 are PARTIAL. The conformance matrix is authoritative for case status.
2. `N-140` is a MAY requirement marked NOT COVERED; absence of a MAY capability is an intentional limitation, not a conformance gap.
3. `N-026` is a CORE-002 boundary requirement marked PARTIAL in a CORE-001 audit; it is a boundary, not a CORE-001 runtime defect.

## 9. Artifact map

| File | Contents |
| --- | --- |
| `README.md` | Purpose, method, reconciliation summary, roadmap overview, readiness, limits |
| `disposition-matrix.md` | 23 rows with disposition, risk scope, priority, dependencies, closure evidence |
| `remediation-roadmap.md` | Tasks, dependency graph, milestones, critical path, acceptance criteria |
| `decision-register.md` | `T18-DEC-01…17`; 4 APPROVED, 13 OPEN (`T18-DEC-16`/`17` approved 2026-10-31) |
| `decision-packages/` | `T18-01` assessment emission, `T18-09A` assurance decisions, `T18-09E` C-2 subject model (`T18-DEC-16`) |
| `reconciliation-notes.md` | `T18-DEC-01`/`T18-DEC-02` approval, `T18-DEC-15` local disposition, PATH-B correction, N-169 erratum, N-140 reclassification proposal, traceability gaps |
| `aebe/C-1.md` | T18-02A package-root adapter evidence and declaration-scoped claim evidence |
| `aebe/C-2.a2.md` | T18-02B package-root cycle-adapter evidence for `CASE-C-2.a2` |

## 10. Limits

- T18-02A, T18-02B and T18-03 are implemented; no other remediation task is implemented. T18-03 is test-only evidence and does not change N-041/D-4.
- Four decisions are approved (`T18-DEC-01`, `T18-DEC-02`, `T18-DEC-16`, `T18-DEC-17`); all others remain OPEN, including `T18-DEC-15`.
- No Task 17 status is changed.
- No CORE-001 normative text is amended.
- A roadmap is not evidence; closure requires the evidence named in `disposition-matrix.md` and `remediation-roadmap.md`. T18-02A evidence is in `aebe/C-1.md`; T18-02B evidence is in `aebe/C-2.a2.md`.
