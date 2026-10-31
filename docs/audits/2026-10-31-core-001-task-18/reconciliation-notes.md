# Task 17 Reconciliation Notes — Task 18

**Purpose:** record clarifications and reclassification proposals discovered while preparing Task 18, without editing the Task 17 audit artifacts.

**Rule:** Task 17 statuses, findings and historical text remain exactly as merged at `2a83c65`. This file is a Task 18 artifact. It does not retroactively change Task 17.

## 1. N-169 text versus conformance matrix

**Observation.** The Task 17 requirement row `N-169` says:

> “D-1, D-3, D-4 pass; D-2 uses Local Acceptance instead of a Ruling”

The Task 17 conformance matrix records:

| Case | Status |
| --- | --- |
| D-1 | PARTIAL |
| D-3 | PASS |
| D-4 | PARTIAL |
| D-2 | BLOCKED |

**Authoritative source for case status:** `docs/audits/2026-10-31-core-001-task-17/conformance-matrix.md`.

**Disposition.** This is a stale explanatory phrase in the requirement matrix, not a status change. Task 18 uses the conformance matrix for case-level status. A future audit revision may correct the phrase; Task 17 is not edited here.

**Impact on Task 18.** N-169 remains PARTIAL, driven by D-2/CORE-004 plus D-1/D-4 evidence. No readiness conclusion is drawn from the stale text.

## 2. N-140 is a MAY requirement

**Observation.** N-140 states: “After the parent arrives, the domain may issue a new assessment.” It is a MAY requirement, but Task 17 marks it NOT COVERED because no assessment-issuing API exists.

**Disposition.** Absence of a MAY capability is an intentional limitation, not a conformance gap. Task 18 classifies N-140 as `INTENTIONAL_LIMITATION` and does not create an implementation task.

**Proposal for a future audit revision.** Reclassify N-140 from NOT COVERED to an intentional limitation / not-applicable capability, with an explicit note that MAY does not create an obligation. This proposal is not applied to Task 17 now.

**Impact on counts.** If a future audit accepts the reclassification, the non-PASS count would drop by one. Task 18 preserves the Task 17 count of 23 and does not pre-empt that decision.

## 3. N-026 is a CORE-002 boundary

**Observation.** N-026 requires heartbeat, stop, failure, restart and other runtime changes to be separate lifecycle events. CORE-001 explicitly defers the full event format to CORE-002.

**Disposition.** N-026 is `CROSS_SPEC_DEPENDENCY` with an `INTENTIONAL_LIMITATION` secondary. It is not a CORE-001 runtime defect. The existing minimal `FAILURE` event is sufficient for D-1, not for the full CORE-002 format.

## 4. Traceability gaps

The following Task 17 non-PASS items have no dedicated `F-###` or `T-###`:

`N-020`, `N-026`, `N-112`, `N-128`, `N-145`, `N-156`, `N-169`, `N-170`, `N-172`, `N-174`, `N-175`.

Reasons:

- specification ambiguity (`N-020`, `N-112`, `N-128`);
- cross-spec boundary (`N-026`, `N-145`, `N-156`, `N-169`, `N-174`);
- external readiness (`N-170`, `N-175`);
- readiness consequence without a dedicated test ID (`N-172`).

This is a traceability observation, not a new finding. Task 18 does not invent register IDs to fill the gap.

## 5. Task 17 preservation statement

- `docs/audits/2026-10-31-core-001-task-17/README.md`: unchanged.
- `requirement-matrix.md`: unchanged.
- `conformance-matrix.md`: unchanged.
- `registers.md`: unchanged.
- Task 17 statuses: 152 PASS, 8 PARTIAL, 7 BLOCKED, 8 NOT COVERED, 0 FAIL.
- Task 17 §12 case statuses: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED.

Any future correction to Task 17 text or status requires a separate audit revision with its own review. Task 18 only records the discrepancy.

## 6. T18-DEC-01 and T18-DEC-02 approval

The project owner approved:

- `T18-DEC-01` = **`REQ-LOCAL`**: CORE-001 requires a local Assessment recording `PARENT_UNRESOLVED` for an unresolved parent and `CYCLE_DETECTED` for a detected cycle. This is a recording obligation; it does not assign construction/publication to Core.
- `T18-DEC-02` = **`OWN-ADAPTER` + `VAL-CORE`**: adapter constructs the Assessment; Core owns semantic validation. See `decision-register.md` §3 for the canonical scope; registration/publication/retention ownership remains OPEN. `T18-02A` is planning-eligible but its acceptance requires the registration-ownership decision.

The canonical approved record is `decision-register.md` §3. The T18-01 package is a historical proposal snapshot; it is not the approval record.

Still OPEN: C-2 subject model (SCC/node/edge; edge-level is a proposal only), exact Assessment shape/provenance, registration/publication/retention ownership details, and C-2.a3 / CORE-003.

## 7. PATH-B correction

The historical T18-01 package listed `VAL-CORE-CONSTRUCTION` as an adapter-path option. It is only compatible with `OWN-CORE` and is not an adapter option. The selected path is `OWN-ADAPTER` + `VAL-CORE`; see `decision-register.md` §3. The historical package text is not rewritten.

## 8. Task ID renumbering

The historical T18-01 package used `T18-02A`/`T18-02B` for the PATH-A Core path and `T18-02C` for the PATH-B adapter path. The approved decision renumbers the adapter scope into:

- `T18-02A` — C-1 adapter emission;
- `T18-02B` — C-2.a2 adapter emission.

`T18-02C` is retired / superseded for historical traceability. Historical package text is not rewritten; this note records the mapping.

## 9. Task 17 historical statuses

Approval of `T18-DEC-01` and `T18-DEC-02` is not conformance evidence and does not change Task 17:

- 152 PASS, 8 PARTIAL, 7 BLOCKED, 8 NOT COVERED, 0 FAIL.
- §12: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED.
- C-1 remains NOT COVERED; C-2 remains BLOCKED.
