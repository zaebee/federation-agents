# UIA-CORE-001 Conformance Audit — Task 17

**Audit base:** commit `9c38bbd` (`main`, Task 16 merged).
**Specification:** `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3, Candidate Draft Normative.
**Audit date:** 2026-10-31.
**Scope:** assertion-level conformance audit of the current reference implementation. Documentation-only deliverable; no source, test, specification, plan, lockfile or configuration was modified.

## Executive summary

| Measure | Result |
| --- | --- |
| Normative requirements inventoried | 175 (`N-001`…`N-175`) |
| Requirements `PASS` | 154 |
| Requirements `PARTIAL` | 7 |
| Requirements `BLOCKED` | 8 |
| Requirements `NOT COVERED` | 6 |
| Requirements `FAIL` | 0 |
| §12 cases `PASS` | 14 of 18 |
| §12 cases `PARTIAL` | 1 (D-4) |
| §12 cases `BLOCKED` | 2 (C-2, D-2) |
| §12 cases `NOT COVERED` | 1 (C-1) |
| Implementation findings | 7 (4 major, 3 minor) |
| Test coverage gaps | 12 |
| Documentation discrepancies | 7 |

**Verdict: CORE-001 conformance is NOT established.** No normative violation was demonstrated (`FAIL = 0`), but 21 applicable requirements are `PARTIAL`, `BLOCKED` or `NOT COVERED`, and 4 of 18 §12 cases are not `PASS`. Under the audit rule, any non-`PASS` applicable requirement prevents a full-conformance claim.

### What is supported by evidence

- Structural lineage validation A-1…A-5, including immutability and the absence of authority artifacts.
- Conditional binding and traversal B-1…B-7, including the B-4 closure code, per-path preservation, B-5 trusted/untrusted isolation, B-6 non-origin branch closure and B-7 arrival-order independence.
- Deterministic path discovery, validation and immediate merge closure, including mixed-relation merge nodes and scope-independent closure.
- Descriptor hashing over the exact §7.1 projection, RFC 8785 canonicalization and SHA-256.
- Four-outcome temporal trust mapping with `(subject_ref, field, value)` binding and no collapsing of `UNTRUSTED`, `UNASSESSED` and `TRUST_ASSESSMENT_UNAVAILABLE`.
- Credential usage denial, revocation reason matrix, D-1 runtime independence, D-3 confirmed compromise, D-4 contested result.
- Local Acceptance record immutability, policy-driven lifecycle, contextual applicability and the in-memory acceptance ledger.
- No grant-producing API, no authority inheritance through lineage, no automatic revocation, no global trusted time.

### What cannot be claimed

- **C-1**: no assessment records `PARENT_UNRESOLVED`.
- **C-2**: no assessment records `CYCLE_DETECTED`; grant suppression is a CORE-003 boundary and cannot be judged here.
- **D-2**: the normative object is a Ruling (CORE-004); the test substitutes a Local Acceptance record.
- **D-4**: the contested result is proven, but the "not sufficient for future authorization" sentence is not asserted or enforced.
- **A-4b**: default conflict detection is absent; `CONTESTED` requires a caller-supplied predicate.
- **A-5**: recursive merge closure is not implemented and not claimed.
- **A-9**: timestamp trust has no in-repo mechanism; it is externally assessed.
- **A-11**: closure over a `MERGED_FROM` origin is unresolved and pinned only by an experimental test.
- **§16**: independent implementation compatibility has not been performed.

## Method

1. **Specification-first extraction.** Every normative statement in `docs/CORE-001.md` was read and mapped to an audit ID `N-###`. Extraction covered MUST/MUST NOT/SHALL/SHOULD/MAY, invariants, field constraints, enumerated §13 prohibitions, and §16 readiness criteria. Keyword counts alone were not used: §13's twelve prohibitions and §3–§6 field rules are not all keyword-prefixed.
2. **Assertion-level §12 decomposition.** Each of the 18 cases was split into Preconditions, Input, Expected Result, Expected State Effects and Forbidden Side Effects. Assertion IDs use `CASE-<case>.<n>`. A case is `PASS` only when every applicable assertion is supported.
3. **Source traceability.** Each requirement was traced from public API through validation, mechanism, result construction and error behavior. Types alone were not treated as evidence; negative and adversarial branches were inspected.
4. **Property and adversarial audit.** P1–P9, the DAG oracle, scope matrix, experimental files, credential/revocation, runtime and acceptance tests were inspected for generator coverage, oracle independence, shrinking and conformance counting.
5. **Ambiguity preservation.** A-1…A-12 statuses were taken from the specification and the approved plan. No ambiguity was resolved through implementation behavior. New issues use `F-###`, `T-###`, `D-###`.
6. **Verification.** All repository scripts were discovered from `package.json` and `.github/workflows/ci.yml`, then run. Results are recorded below.

## §12 result detail

| Case | Status | Decisive evidence |
| --- | --- | --- |
| A-1…A-5 | PASS | `tests/conformance/a.test.ts`; result, state and forbidden-side-effect assertions |
| B-1…B-7 | PASS | `tests/conformance/b.test.ts`; B-4 closure evidence, B-5 adversarial hook, B-7 permutations |
| C-1 | NOT COVERED | graph-level preservation passes; the `PARENT_UNRESOLVED` assessment assertion is absent |
| C-2 | BLOCKED | graph-level cycle detection passes; the `CYCLE_DETECTED` assessment is absent; grant suppression is CORE-003 |
| D-1 | PASS | `d.test.ts::D-1`; separate event, `RUNNING` state, byte-identical descriptors |
| D-2 | BLOCKED | `d.test.ts::D-2` proves Local Acceptance preservation, not Ruling preservation |
| D-3 | PASS | `d.test.ts::D-3`; `CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE`, frozen records |
| D-4 | PARTIAL | contested result proven; future-authorization sufficiency not asserted |

Task 16 reported 16/18. This audit does not support that count: D-2 is a cross-spec Ruling case, and D-4's sufficiency sentence is not asserted. The correct statement is **14 PASS, 1 PARTIAL, 2 BLOCKED, 1 NOT COVERED**.

## Verification log

Commands run from the repository root on `9c38bbd`:

| Command | Exit | Result |
| --- | --- | --- |
| `bun --version` | 0 | `1.4.2` |
| `node -v` | 0 | `v22.19.0` |
| `bun run check:lockfile` | 0 | `bun.lock matches package.json` |
| `bun run format:check` | 0 | all matched files use Prettier style |
| `bun run lint` | 0 | no findings |
| `bun run typecheck` | 0 | both `tsconfig.json` and `tsconfig.core.json` |
| `bun test` | 0 | 511 tests across 24 files: 507 pass, 4 todo, 0 fail, 3283 `expect()` calls |
| `bun test tests/conformance` | 0 | 23 tests across 4 files: 21 pass, 2 todo, 0 fail |
| `bun test tests/property` | 0 | 21 tests across 2 files: 21 pass, 0 fail |
| `bun test tests/experimental` | 0 | 4 tests across 2 files: 2 pass, 2 todo, 0 fail |
| `bun run build` | 0 | `tsc -p tsconfig.build.json` |
| `git status --porcelain` | 0 | only the audit artifacts are untracked |

**Todo inventory:** C-1 and C-2 in `tests/conformance/c.test.ts`; one recursive-closure expectation in `tests/experimental/nested-merge-recursion.test.ts`; one origin-closure expectation in `tests/experimental/origin-merge-closure.test.ts`.

**Formatting limitation:** `.prettierignore` contains `docs/`, so `format:check` does not inspect these audit files or any other document under `docs/`. There is no Markdown linter configured. The audit files were written to the repository's existing Markdown style by hand.

**Duplication:** no local duplication script or Sonar configuration exists in the repository. SonarCloud is an external GitHub App; it was not run locally and is not part of this audit's evidence.

## Findings

| ID | Severity | Summary |
| --- | --- | --- |
| F-001 | major | No assessment records `PARENT_UNRESOLVED` (§11.1, C-1) |
| F-002 | major | No assessment records `CYCLE_DETECTED` (§11.2, C-2) |
| F-003 | major | D-2 requires a Ruling; the test substitutes Local Acceptance |
| F-007 | major | Future authorization is independent of the historical result; D-4 sufficiency is not enforced or asserted |
| F-004 | minor | `ContinuityAssessment` has no runtime validator |
| F-005 | minor | `SEMVER_2`/non-SemVer label rules are not enforced at descriptor acceptance |
| F-006 | minor | D-3 adds a `signed_at` trust precondition not stated in §4.4.1 |

No finding is a demonstrated normative violation. Details, evidence and recommended actions are in `registers.md`.

## Artifact map

| File | Contents |
| --- | --- |
| `README.md` | Executive summary, method, §12 result detail, verification log, verdict |
| `requirement-matrix.md` | `N-001`…`N-175` with strength, scope, implementation, evidence and status |
| `conformance-matrix.md` | All 18 §12 cases decomposed into assertions with per-assertion status |
| `registers.md` | `F-###` findings, `T-###` test gaps, `D-###` documentation discrepancies, `AMBIG-A-###` register |

## Limits

- This is a static and test-evidence audit, not a formal proof.
- No independent implementation exists for §16 cross-implementation compatibility.
- C-1/C-2 need an implementation design decision; D-2 needs a cross-spec decision; A-4b/A-5/A-9/A-11 need normative clarification.
- The property oracle reuses `assessEdge` and `evaluateAssurance`, so P7 is not independent for assessment semantics.
- P9 is a name-surface guard; it does not inspect function bodies for indirect authority minting.
- A passing test is evidence for its assertions only; the matrix records where an assertion is narrower than the normative sentence.
