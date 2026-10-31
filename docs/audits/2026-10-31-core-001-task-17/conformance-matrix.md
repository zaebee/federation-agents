# §12 Conformance Matrix — Task 17 Audit

**Specification:** `docs/CORE-001.md` §12, UIA-CORE-001 Rev 0.3.3.
**Audit base:** commit `9c38bbd`.
**Rule:** each case is decomposed into individual assertions. A case is not `PASS` unless every applicable assertion is supported by evidence. A case whose decisive assertion is unverified is `NOT COVERED`; a case with some verified and some unverified assertions is `PARTIAL`; a case with a `BLOCKED` decisive assertion is `BLOCKED`. Assertion IDs are audit identifiers (`CASE-<case>.<n>`), not specification identifiers.

## Case rollup

| Case | Spec | Assertions | Status | Reason |
| --- | --- | --- | --- | --- |
| A-1 | §12 A-1 | 5 | PASS | all assertions supported |
| A-2 | §12 A-2 | 3 | PASS | all assertions supported |
| A-3 | §12 A-3 | 4 | PASS | all assertions supported |
| A-4 | §12 A-4 | 2 | PASS | all assertions supported |
| A-5 | §12 A-5 | 3 | PASS | all assertions supported |
| B-1 | §12 B-1 | 3 | PASS | result asserted; AMBIG-A-2 caveat on how `EXACT` is expressed |
| B-2 | §12 B-2 | 4 | PASS | all assertions supported |
| B-3 | §12 B-3 | 4 | PASS | all assertions supported |
| B-4 | §12 B-4 | 7 | PASS | closure code and per-path evidence asserted; two additional mixed-relation variants |
| B-5 | §12 B-5 | 6 | PASS | all assertions supported, including adversarial hook |
| B-6 | §12 B-6 | 3 | PASS | closure failure asserted; deeper edge not checked |
| B-7 | §12 B-7 | 1 | PASS | all six permutations produce one result |
| C-1 | §12 C-1 | 4 | NOT COVERED | Assessment with `PARENT_UNRESOLVED` absent; graph-level assertions pass separately |
| C-2 | §12 C-2 | 5 | BLOCKED | Assessment with `CYCLE_DETECTED` absent; grant suppression is a CORE-003 boundary |
| D-1 | §12 D-1 | 5 | PARTIAL | event separation and descriptor immutability are proven; actual independent execution is not observable |
| D-2 | §12 D-2 | 4 | BLOCKED | the normative object is a Ruling (CORE-004); the test substitutes Local Acceptance |
| D-3 | §12 D-3 | 4 | PASS | all assertions supported; trust precondition noted in N-040 |
| D-4 | §12 D-4 | 3 | PARTIAL | contested result and no-inference asserted; the mandatory policy callback is the additional assessment, but its outcome is not asserted |

**Result: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED.** Task 16 reported 16/18; the assertion-level audit does not support counting D-1, D-2 or D-4 as fully covered. See `registers.md` F-003, T-004 and T-014.

Experimental tests are excluded from this matrix. `tests/experimental/nested-merge-recursion.test.ts` and `tests/experimental/origin-merge-closure.test.ts` pin BLOCKED interpretations and are not conformance evidence.

---

## Category A — Structural lineage validation

Test file: `tests/conformance/a.test.ts`.

### A-1 — Valid Continuation

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-A-1.a1` | Declaration is accepted | `A-1 valid CONTINUATION is accepted without side effects` | `validateDescriptor` returns `{status:'VALID'}` | none | PASS |
| `CASE-A-1.a2` | Previous version is not deleted | same | registry snapshot unchanged | registry is an in-memory fixture; no deletion API exists | PASS |
| `CASE-A-1.a3` | Previous version gets no automatic DEPRECATED status | same | snapshot contains no `DEPRECATED`; parent has no `status` key | string-based check, adequate for the record shape | PASS |
| `CASE-A-1.a4` | Authority is not inherited | same | snapshot contains no `grant`; child has no credentials | negative surface only; no authority type exists | PASS |
| `CASE-A-1.a5` | Parent record and child credentials are unchanged | same | parent still has `cred-parent`; child has `[]` | none | PASS |

### A-2 — Cross-Participant Continuation Rejection

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-A-2.a1` | Result is `ERR_INVALID_RELATION` | `A-2 cross-participant CONTINUATION is rejected without state mutation` | exact code and `parent_version_id` | none | PASS |
| `CASE-A-2.a2` | The declaration is not accepted as a valid CONTINUATION edge | same | result has only `status`, `code`, `parent_version_id`; registry unchanged | the graph is not built in this test; the rejected edge is not inserted anywhere | PASS |
| `CASE-A-2.a3` | No state mutation | same | registry snapshot unchanged | none | PASS |

### A-3 — Valid Fork

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-A-3.a1` | Declaration is accepted | `A-3 cross-participant FORKED_FROM is accepted without inheritance` | `VALID` | none | PASS |
| `CASE-A-3.a2` | Ancestor is unchanged | same | registry snapshot unchanged; ancestor keeps `cred-a` | none | PASS |
| `CASE-A-3.a3` | Ancestor credentials are not copied | same | child credentials `[]` | none | PASS |
| `CASE-A-3.a4` | Authority is not inherited | same | no `grant` substring | negative surface | PASS |

### A-4 — Fork Cardinality

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-A-4.a1` | Result is `ERR_INVALID_CARDINALITY` | `A-4 FORKED_FROM cardinality violation is rejected and leaves Registry unchanged` | exact code | none | PASS |
| `CASE-A-4.a2` | The invalid descriptor is not registered | same | registry snapshot and child JSON unchanged | registry is a fixture; no registration API exists | PASS |

### A-5 — Valid Merge

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-A-5.a1` | Declaration is accepted under the other structural conditions | `A-5 valid MERGED_FROM is accepted without unioning credentials or authority` | `VALID` | none | PASS |
| `CASE-A-5.a2` | Credentials of both parents are not unioned | same | each parent keeps its own credential; child has none | none | PASS |
| `CASE-A-5.a3` | Authority of both parents is not unioned | same | no `grant` substring | negative surface | PASS |

---

## Category B — Authority binding and traversal

Test file: `tests/conformance/b.test.ts`.

### B-1 — Exact Binding Isolation

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-1.a1` | Candidate `A@1.1.0` is rejected with `ERR_AUTHORITY_BINDING_MISMATCH` | `B-1 exact anchoring rejects an otherwise bindable candidate` | exact result object | the binding is expressed as selector `=1.0.0`; AMBIG-A-2 remains OPEN on how `EXACT` is modelled | PASS |
| `CASE-B-1.a2` | The original Grant is unchanged | same | state snapshot unchanged | no Grant type exists; property holds by absence within CORE-001 | PASS |
| `CASE-B-1.a3` | No new Grant is created automatically | same | no `grant` substring; no grant API | negative surface | PASS |

### B-2 — Unsatisfied Assurance Predicate

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-2.a1` | Result is `ERR_ASSURANCE_PREDICATE_UNSATISFIED` | `B-2 an unsatisfied required claim keeps the version and declaration intact` | exact code | none | PASS |
| `CASE-B-2.a2` | `missing` contains `GOVERNANCE_REVIEWED` and nothing else | same | `missing:['GOVERNANCE_REVIEWED']`, `disallowed:[]` | none | PASS |
| `CASE-B-2.a3` | IdentityVersion remains registered | same | state snapshot unchanged | no registry mutation API exists | PASS |
| `CASE-B-2.a4` | Lineage declaration is not deleted | same | candidate JSON unchanged | none | PASS |

### B-3 — Diamond Lineage

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-3.a1` | Binding succeeds | `B-3 diamond lineage yields both valid paths without authority artifacts` | `eligible:true` | none | PASS |
| `CASE-B-3.a2` | Both paths `D→B→A` and `D→C→A` are accepted | same | exact `acceptedPaths` order | none | PASS |
| `CASE-B-3.a3` | All parent branches of merge node D pass closure | same | success implies closure satisfied | no direct closure assertion; implied by eligibility | PASS |
| `CASE-B-3.a4` | B and C gain no automatic Grant A | same | state unchanged; no `grant` | negative surface | PASS |

### B-4 — Merge Closure Failure

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-4.a1` | Top-level code is `ERR_MERGE_BRANCH_UNSATISFIED` | `B-4 closure-only branch failure preserves path-level and closure evidence` | exact code | aggregation beyond B-4 is A-8 OPEN | PASS |
| `CASE-B-4.a2` | Partial merge admission is forbidden | same | no partial eligibility shape; result is a failure | none | PASS |
| `CASE-B-4.a3` | The invalid branch is not ignored because another branch reaches origin | same | closure failure on `D→B` despite `D→C→A` being valid | none | PASS |
| `CASE-B-4.a4` | Path-level failure and closure failure are both reported | same | `perPath` has two entries: `INVALID` on `D→B→A`, `VALID` plus `UNSATISFIED` closure on `D→C→A` | none | PASS |
| `CASE-B-4.a5` | No state mutation | same | state snapshot unchanged | none | PASS |

Additional B-4-shaped tests:

| Assertion | Normative expectation | Test | What the test proves | Status |
| --- | --- | --- | --- | --- |
| `CASE-B-4.a6` | A merge node reached through a permitted non-merge edge is still closed over its merge parents | `B-4 a merge node reached through CONTINUATION still closes its merge parents` | failures for `iv-b` and `iv-c` | PASS |
| `CASE-B-4.a7` | Mixed direct parent relations are all closed | `B-4 mixed direct parent relations are all closed` | failure for the `CONTINUATION` direct parent `iv-e` | PASS |

### B-5 — Trusted and Untrusted Assessors

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-5.a1` | The requirement is refused when the trusted auditor does not verify the required claim | `B-5 untrusted positive assessment cannot substitute for the trusted auditor` | `ERR_ASSURANCE_PREDICATE_UNSATISFIED`; `missing:['SPEC_MISMATCH']` | none | PASS |
| `CASE-B-5.a2` | The untrusted positive assessment does not override the trusted auditor | same | the untrusted assessment verifies `SPEC_MISMATCH`; if consumed, the result would be `SATISFIED`, so refusal is direct evidence | none | PASS |
| `CASE-B-5.a3` | `unverified_claims` is not negative evidence or a negative finding | same | helper asserts no `negative` or `refuted` field | absence of a field, not a positive test of all possible negative claims | PASS |
| `CASE-B-5.a4` | Neither assessment is mutated | same | state snapshot unchanged | snapshot is JSON-based; the records are plain fixtures | PASS |
| `CASE-B-5.a5` | No Grant is created | same | no `grant` substring; no grant API | negative surface | PASS |
| `CASE-B-5.a6` | A policy hook cannot reintroduce the untrusted assessment | `B-5 adversarial policy hook cannot promote the untrusted assessment` | hook returns the whole applicable set; refusal persists | none | PASS |

### B-6 — Merge Closure with Non-Origin Branch

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-6.a1` | Missing assessment on `D→C` rejects the path through merge node D | `B-6 non-origin direct branch fails closure without checking deeper edges` | closure failure with parent `iv-c` | none | PASS |
| `CASE-B-6.a2` | The failure code is the closure code, not `ERR_NO_TRAVERSAL_PATH` | same | `ERR_MERGE_BRANCH_UNSATISFIED` via helper | none | PASS |
| `CASE-B-6.a3` | The non-origin branch is not ignored | same | exactly one failure, for `iv-c` | none | PASS |

Note: the test also asserts no failure for `iv-x`, i.e. the deeper edge `C→X` is not checked. That is immediate-closure behavior, not an additional normative requirement; recursive depth is AMBIG-A-5 BLOCKED.

### B-7 — Assessment Arrival Order Independence

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-B-7.a1` | The same final data set yields the same binding result regardless of arrival order | `B-7 all assessment arrival permutations produce the same result` | all six permutations of three assessments produce one identical JSON result | only three assessments; larger sets are covered by P3 | PASS |

---

## Category C — Federation and local assessment

Test file: `tests/conformance/c.test.ts`.

### C-1 — Orphan Ingestion

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-C-1.a1` | The descriptor is preserved | `tests/unit/lineage-graph.test.ts::preserves an orphan and resolves it in a newly built graph` | orphan is in `nodes` and survives graph rebuild | graph-level, not the §12 test file | PASS |
| `CASE-C-1.a2` | The parent link is preserved | same | edge remains in `edges`; `unresolvedParents` populated | graph-level | PASS |
| `CASE-C-1.a3` | The assessment records `PARENT_UNRESOLVED` | none (`c.test.ts` todo) | nothing | no API creates such an assessment; the code exists only as an error literal | NOT COVERED |
| `CASE-C-1.a4` | The declaration is not deleted or rewritten | same graph test | declarations remain readable | graph-level | PASS |

**Case status: NOT COVERED.** The graph-level assertions are real but are not a substitute for the Assessment assertion.

### C-2 — Cycle Detection

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-C-2.a1` | `V1 → V2 → V1` is detected exactly | `tests/unit/lineage-graph.test.ts::detects V1 <-> V2 and keeps declarations readable` | one sorted cyclic component containing both nodes | graph-level | PASS |
| `CASE-C-2.a2` | The assessment records `CYCLE_DETECTED` | none (`c.test.ts` todo) | nothing | traversal returns `CYCLE_DETECTED`; no assessment records it | NOT COVERED |
| `CASE-C-2.a3` | Grants dependent on the continuity are not applied | none | nothing | no grant API; downstream CORE-003 behavior is unobservable | BLOCKED |
| `CASE-C-2.a4` | The system does not crash | same graph test | no throw; declarations readable | graph-level | PASS |
| `CASE-C-2.a5` | Historical declarations are not erased and participants are not globally deleted | same graph test | nodes and edges remain | graph-level | PASS |

**Case status: BLOCKED.** The grant-suppression assertion cannot be judged inside CORE-001, and the Assessment assertion is not covered.

---

## Category D — Cross-spec integration

Test file: `tests/conformance/d.test.ts`.

### D-1 — Runtime Independence

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-D-1.a1` | The failure of `rt-1` is recorded separately | `D-1 rt-1 failure is separate and rt-2 continues RUNNING` | `updated.events()` contains exactly the failure event; original registry has none | none | PASS |
| `CASE-D-1.a2` | `rt-2` continues independent execution | same | `stateOf('rt-2') === 'RUNNING'`; descriptors are unchanged | metadata-level independence only: `stateOf` returns `RUNNING` for every registered runtime, so actual execution is not observable in CORE-001 | PARTIAL |
| `CASE-D-1.a3` | The IdentityVersion is not changed | same | identity JSON unchanged | none | PASS |
| `CASE-D-1.a4` | `rt-2` is not declared failed | same | both runtime descriptors byte-identical | none | PASS |
| `CASE-D-1.a5` | Authority is not automatically revoked | same | credential and usage unchanged; no grant API | negative surface | PASS |

Note: `stateOf('rt-1')` is also `RUNNING` after the failure event. That is the documented D-1 mechanism (events are separate from lifecycle state), not a contradiction of the case.

### D-2 — Historical Ruling Preservation

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-D-2.a1` | The historical Ruling is preserved without mutation | `D-2 later revocation and superseding assessment leave the Local Acceptance intact` | a `LocalAcceptanceRecord` and its ledger are byte-identical | the test object is a Local Acceptance record, not a Ruling | BLOCKED |
| `CASE-D-2.a2` | Future applicability is determined by policy and current checks | same | a fresh evaluation returns `INVALID` | no authority/execution model; CORE-003 boundary | BLOCKED |
| `CASE-D-2.a3` | The Ruling is not deleted or rewritten retroactively | same | acceptance and ledger snapshots unchanged | no Ruling type exists | BLOCKED |
| `CASE-D-2.a4` | A Local Acceptance record and its supporting assessment survive a later revocation and supersession | same | acceptance, supporting assessment and ledger unchanged; supersession history retains both records | this is a real property, but it is not the normative object named by D-2 | PASS |

**Case status: BLOCKED.** CORE-001 §14.3 assigns Ruling to CORE-004. The test demonstrates Local Acceptance preservation, which is valuable but cannot establish D-2 as written. See F-003.

### D-3 — Retrospective Key Compromise

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-D-3.a1` | The claim status is `CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE` | `D-3 retrospective confirmed compromise invalidates only the compromised claim` | exact claim status, historical `INVALID`, both temporal outcomes `TRUSTED` | requires both timestamps trusted; see N-040 | PASS |
| `CASE-D-3.a2` | The original Credential Descriptor is not deleted | same | credential JSON unchanged and frozen | none | PASS |
| `CASE-D-3.a3` | Historical events are not erased | same | revocation JSON unchanged and frozen | none | PASS |
| `CASE-D-3.a4` | Revocation does not modify the IdentityVersionDescriptor | same | credential/revocation snapshots unchanged; the descriptor is not an input to the evaluation | structural: the descriptor is never passed to `evaluateHistoricalSignature`, so no mutation path exists | PASS |

**Case status: PASS with a note.** The core case is asserted; the descriptor-immutability assertion is indirect because the descriptor is not part of the evaluation input.

### D-4 — Unknown Compromise Time

| Assertion | Normative expectation | Test | What the test proves | Gap | Status |
| --- | --- | --- | --- | --- | --- |
| `CASE-D-4.a1` | The signature becomes `CONTESTED_COMPROMISED` | `D-4 unknown compromise time is contested and never inferred from revoked_at` | exact historical status; no claim status; no compromise time in `temporal` | none | PASS |
| `CASE-D-4.a2` | The signature is not a sufficient basis for continuity or future authorization without additional normative assessment | same | only the historical result is asserted; `future_authorizable` is not asserted | the mandatory `evaluateFutureAuthorization` callback receives revocation and temporal context and is the additional assessment; the test does not assert its outcome | NOT COVERED |
| `CASE-D-4.a3` | The system does not infer compromise at `revoked_at` | same | acceptance policy is not called; no `compromise_effective_at` field | none | PASS |

**Case status: PARTIAL.** The contested result is proven; the sufficiency limitation is not.

---

## Excluded from conformance

| File | Interpretation | Why excluded |
| --- | --- | --- |
| `tests/experimental/nested-merge-recursion.test.ts` | AMBIG-A-5: recursive closure inside a closure-only branch | Specification does not define closure depth |
| `tests/experimental/origin-merge-closure.test.ts` | AMBIG-A-11: closure over a `MERGED_FROM` terminal origin | Specification does not define whether the origin is "passed through" |

Both run as internal consistency checks (1 pass, 1 todo each) and are not §12 evidence.
