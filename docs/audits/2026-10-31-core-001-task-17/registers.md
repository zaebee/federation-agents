# Audit Registers — Task 17

**Base:** commit `9c38bbd`. **Specification:** `docs/CORE-001.md` Rev 0.3.3.

This file contains four registers: implementation findings (`F-###`), test coverage gaps (`T-###`), documentation discrepancies (`D-###`), and the preserved ambiguity register (`AMBIG-A-###`). Findings are recorded, not fixed. No source, test or specification file was changed.

## F — Implementation findings

| ID | Severity | Spec | Finding | Evidence | Impact | Recommended action | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 | major | §11.1, §12 C-1 | No API records `PARENT_UNRESOLVED` in a `ContinuityAssessment` | `errors.ts:17` declares the code; `c.test.ts:10` is a todo; no assessment-emitting function exists in `src/core/index.ts` | C-1 cannot pass; N-138 is `NOT COVERED` | Decide whether the core or a host adapter emits the assessment; if the core, add an assessment-emission API; if an adapter, state it in the specification boundary | open |
| F-002 | major | §11.2, §12 C-2 | No API records `CYCLE_DETECTED` in a `ContinuityAssessment` | `traversal.ts:486` returns the code as a traversal result; `assessment.ts:109` uses it for supersession; `c.test.ts:11` is a todo | C-2 cannot pass; N-143 is `NOT COVERED` | Same decision as F-001, plus a decision on whether traversal results satisfy the "Assessment records" wording | open |
| F-003 | major | §12 D-2, §14.3 | D-2 requires preservation of a historical **Ruling**, but CORE-001 defines no Ruling; the test substitutes a `LocalAcceptanceRecord` | `CORE-001` §12 D-2 (line 1462) and §14.3 (line 1587); `d.test.ts:172`; `acceptance.ts:25` | D-2 is `BLOCKED`; a Local Acceptance preservation property is proven but is not the normative object | Clarify whether D-2's "Ruling" is a CORE-004 object and defer D-2, or state that Local Acceptance is the intended CORE-001 object | open |
| F-004 | minor | §6.2.1, §6.2.3 | `ContinuityAssessment` has no runtime validator; field presence and reproducibility fields are enforced only by the TypeScript type | `assessment.ts:18`; `assessEdge` at `assessment.ts:138` deep-copies candidates but does not validate them; no `validateContinuityAssessment` is exported | A malformed assessment can enter applicability and assurance evaluation; this is a boundary-validation gap (Global Constraint 5), not a requirement violation | Add a boundary validator, or document that assessments are trusted typed inputs and the adapter owns validation | open |
| F-005 | minor | §3.2 | `SEMVER_2` and non-SemVer label rules are enforced on binding precheck, not when a descriptor is accepted | `entities.ts:366` does not call `validateVersionLabel`; `traversal.ts:744` and `traversal.ts:748` do; probe: a descriptor with `version_label: 'not-semver'` is accepted while `validateVersionLabel` rejects it | N-019 is `PARTIAL`, not `FAIL`: `validateIdentityVersionDescriptor` is a structural boundary, and §6.1 treats a declaration as a claim that may be false, so storing an invalid label is not itself a violation; the scheme rule is enforced where the label is used | Validate the label in the descriptor boundary, or document that label validity is checked only at use | open |
| F-006 | minor | §4.4.1 | D-3 adds a `SIGNED_AT` trust precondition that §4.4.1 does not state explicitly | `credential.ts:451` requires both `signedAtTrust` and `compromiseTrust` to be `TRUSTED` before comparing times | N-040 is `PARTIAL`; behavior under an untrusted `signed_at` is an implementation decision, not a literal §4.4.1 outcome | Confirm the precondition in a spec clarifier (it is consistent with §10.1) or document it as an implementation decision | open |

No finding is a demonstrated normative violation; none is marked `FAIL` in the requirement matrix. The findings are gaps in coverage, boundary validation or cross-spec scope.

## T — Test coverage gaps

| ID | Requirement or case | Missing evidence | Why it matters | Suggested test (not added) |
| --- | --- | --- | --- | --- |
| T-001 | §11.1, CASE-C-1.a3 | An assessment carrying `PARENT_UNRESOLVED` | C-1's central assertion is untested | Construct an orphan and assert the emitted assessment's `unverified_claims` |
| T-002 | §11.2, CASE-C-2.a2, CASE-C-2.a3 | An assessment carrying `CYCLE_DETECTED`; grant suppression | C-2's central assertions are untested; grant suppression is outside CORE-001 | Defer the grant assertion to CORE-003; test the assessment claim if an API exists |
| T-003 | §12 D-2 | Preservation of a Ruling | No Ruling type exists; the Local Acceptance test is not a substitute | Defer to CORE-004, or add a spec clarifier |
| T-004 | §12 D-4, N-041 | `future_authorizable` and `reassessment_required` for unknown compromise time | The mandatory `evaluateFutureAuthorization` callback receives revocation and temporal context and is the additional assessment, but its outcome is unasserted | Assert the policy input and the outcome for `CONFIRMED_COMPROMISE` without a time |
| T-005 | §6.2.1, F-004 | Runtime rejection of malformed assessments | No validator exists to test | Add a validator test if F-004 is resolved |
| T-006 | §8.8, P7 | Assessment semantics in the oracle | The oracle reuses `assessEdge` and `evaluateAssurance`, so P7 is not independent for applicability/trust | Document the boundary, or build a second assessment oracle |
| T-007 | §13 #1–#4, P9 | Proof that no implementation path mints authority | P9 is name-based and does not inspect bodies | Add a body-level audit or a negative capability test |
| T-008 | B-5 | Direct assertion that the untrusted assessment is excluded from the consumed set | Refusal is strong indirect evidence, but the exclusion is not observed directly | Expose or observe the consumed set, or assert via a hook call log |
| T-009 | D-3 | Direct descriptor immutability assertion | The descriptor is not an input to the evaluation, so the test asserts credential/revocation only | Add a descriptor snapshot to the fixture and assert it after evaluation |
| T-010 | §6.3 #5 | Preservation of decisions based on a superseded assessment | No decision store links assessments to decisions | Defer to the decision-owning layer; document the boundary |
| T-011 | §7.2, N-084 | In-repo comparison against a claimed digest | No comparison or verification function exists; `descriptorHash` only computes the digest, and N-084 is `NOT COVERED` | Add a comparison helper and a known-answer test, or document the comparison as an external responsibility |
| T-012 | §11.1 (MAY) | Issuing a new assessment after a parent arrives | MAY requirement; no API | Not required for conformance; note only |
| T-013 | §6.4, N-079 | Gating of decisions that depend on a contested claim | No decision engine or gating layer exists; conflict detection is separately blocked (N-078) | Defer to the decision-owning layer; document the boundary |
| T-014 | §12 D-1, N-004 | Actual independent execution of `rt-2` | The test proves event separation and descriptor immutability; `stateOf` returns `RUNNING` for every registered runtime | Actual execution is outside CORE-001's observable scope; state that explicitly |

## D — Documentation discrepancies

| ID | Claim | Source A | Source B | Status |
| --- | --- | --- | --- | --- |
| D-001 | §12 coverage is 16/18 | `docs/implementation.md:1425` | This audit: 13 PASS, 2 PARTIAL, 2 BLOCKED, 1 NOT COVERED | open; documentation should be corrected after the audit is accepted |
| D-002 | D-2 is `pass` | `docs/implementation.md:1477` | CORE-001 §12 D-2 requires a Ruling; §14.3 assigns Ruling to CORE-004; the test uses Local Acceptance | open; D-2 should be marked BLOCKED or re-scoped |
| D-003 | D-4 is `pass` | `docs/implementation.md:1481` | D-4's sufficiency sentence is not asserted (`d.test.ts:103`), although the mandatory policy callback exists | open; D-4 should be marked PARTIAL |
| D-004 | Task 17 runs 18 cases | `docs/superpowers/plans/2026-10-30-uia-core-001-implementation.md:561` | C-1/C-2 are `test.todo`; no implementation task closes them | open; the plan should state the expected non-PASS cases |
| D-005 | `assessEdge` deep-copies and rejects duplicate ids | `docs/implementation.md` §2.11 | Accurate; it does not mention the absence of assessment validation | minor omission; update if F-004 is resolved |
| D-006 | P9 checks names and the public surface, not bodies | `docs/implementation.md` §2.18 and §4.6 | Accurate | none |
| D-007 | `docs/ARCHITECTURE.md` is internally inconsistent about A7/§8/§9 | `docs/implementation.md` §9.4 | Verified at `9425d3f`: module map says Implemented, A7/§8/§9 say Target/planned | accurate; separate follow-up |
| D-008 | D-1 is `pass` | `docs/implementation.md:1476` | The test proves event separation and descriptor immutability; `stateOf` returns a constant `RUNNING`, so actual independent execution is not observable | open; D-1 should be marked PARTIAL |

## AMBIG — Ambiguities register (preserved)

Statuses are taken from the normative specification and the approved Rev E plan. They are not renamed and not resolved by this audit.

| ID | Status | Unresolved question | What can be concluded | What cannot be concluded | Does the implementation avoid deciding? |
| --- | --- | --- | --- | --- | --- |
| AMBIG-A-1 | OPEN (mechanism) | Required selector syntax and range semantics (§8.2) | The implementation's `uia-ref-selector@1` grammar works as documented | Whether that grammar is the normative one | Yes: the mechanism carries its own version label |
| AMBIG-A-2 | OPEN | What "Binding: EXACT" means as a record field (§12 B-1) | Exact-selector rejection produces the expected result | Whether an exact selector is the normative representation of EXACT | Yes: no binding-mode field was invented |
| AMBIG-A-3 | OPEN | Whether one descriptor may mix relation types (§5.2) | Per-type cardinality is implemented and tested | Whether mixed arrays are normatively legal | Yes: mixed arrays are accepted, not rejected |
| AMBIG-A-4a | Resolved by literal text | Effect of an unverified claim (§6.2.2, §6.4, §8.5) | Unverified required claim means unsatisfied; no negative finding | — | No decision needed |
| AMBIG-A-4b | BLOCKED | What makes two applicable trusted assessments contradict (§6.4) | Default configuration never yields `CONTESTED` | Whether any specific pair is a contradiction; whether dependent decisions are correctly blocked | Yes: no default predicate is shipped |
| AMBIG-A-5 | BLOCKED | Closure depth inside parent branches (§8.6) | Immediate closure is implemented and tested | Whether recursive closure is required; nested-merge behavior | Yes: immediate-only, experimental tests excluded |
| AMBIG-A-6 | OPEN | Mixed relation types (§5.2) | Same as A-3 | Same as A-3 | Yes |
| AMBIG-A-7 | OPEN | `CONTENT_HASH` label format (§3.2) | Non-empty labels are accepted | Whether a label contains a valid content-hash identifier | Yes: no format is inferred |
| AMBIG-A-8 | OPEN | Error-code aggregation across differently failing paths (§8.6, B-4) | The B-4 combination is asserted; per-path outcomes are preserved | Which code wins for every other combination | Yes: the aggregation is labelled implementation behavior |
| AMBIG-A-9 | BLOCKED (external) | Trusted-time mechanism for `signed_at` and other timestamp fields (§10.1) | Trust is consumed as an external four-outcome input bound to `(subject_ref, field, value)` | Whether a timestamp is actually trustworthy | Yes: the core never derives trust |
| AMBIG-A-10 | Resolved by implementation semantics | Scope versus closure exclusion (§8.1 × §8.6) | Scope filters discovery; closure checks direct parents regardless of scope | Whether the specification confirms this reading | Yes: documented as implementation semantics |
| AMBIG-A-11 | BLOCKED | Whether a `MERGED_FROM` terminal origin is closed (§8.6) | The origin is not closed because it is never an `edge.child` | Whether the origin should be closed | Yes: experimental test pins the current behavior |
| AMBIG-A-12 | Out of scope | Cryptographic verification (§4.1) | The verifier is injectable; crypto outcomes are distinct | Identity, authority or timestamp trust from a signature | Yes: no crypto implementation in core |

`AMBIG-A-4a` and `AMBIG-A-10` are resolved by, respectively, literal specification text and approved implementation semantics. Neither resolution closes AMBIG-A-4b, AMBIG-A-5, AMBIG-A-9 or AMBIG-A-11.
