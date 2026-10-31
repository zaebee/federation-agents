# T18-09F — Adversarial Review of the Draft Package

**Status:** review of the draft decision package. **It does not approve `T18-DEC-18`.**
**Reviewed revision:** `f1d52e1` (`main`, Task 17 audit revision 2 merged).
**Method:** every claim in `README.md`, `n176-path-enumeration.md` and `benchmark-procedure.md` was checked against `docs/CORE-001.md` §8.4/§8.7/§8.8, `src/core/traversal.ts`, the §12 conformance corpus and the Task 17 audit. No source or test was changed.

**Post-review correction (revision 3):** the NP-hardness expectations in §2–§3 were corrected by `oq4-complexity-adversarial-pass.md`. Cycle preemption makes D2/D4 polynomial and removes the path-scoped mechanism class (D6); D3 is polynomial too, via a walk-through-cyclic-node reachability lemma (Lemma 4). Only D5 retains a proof obligation. "Option D" in this review means the legacy hybrid option in `n176-path-enumeration.md` §5, not a new scheme.

## 1. What holds up

| Package claim | Check |
| --- | --- |
| N-176 quotes §8.8 correctly and is PARTIAL in audit revision 1 | Confirmed against the revision-1 document |
| `discoverPaths` materialises every simple candidate→origin path | Confirmed (`src/core/traversal.ts:361`) |
| `evaluateBinding` validates every discovered path and aggregates afterwards | Confirmed (`traversal.ts:902`, loop over `discovered.value`, then `summarizePaths`) |
| The public result exposes `acceptedPaths` and `details.perPath` | Confirmed (`BindingResult`, lines ~112–124) |
| A chain of merge diamonds yields `2^k` paths | Structurally plausible; the benchmark procedure is reproducible in shape |
| The decision is about "what counts as the result", not about a cap | Correct framing; §8.8's clause is conditional |

The package is honest about the core issue: if the full per-path list is part of the required result, enumeration is not a violation; if a compact validity result is equivalent, the current API violates N-176. Nothing in this review disputes that.

## 2. Adversarial findings

### F1 (high) — Options B and D are a public-contract change, not an optimisation

**Status: open** — the contract/API decision is still the owner's (Reading B and Option 5.B are proposed).

`discoverPaths` is exported, and two §12 conformance tests pin the current path-list contract as written:

- **B-3** asserts `result.acceptedPaths` equals **both** diamond paths (`[['iv-d','iv-b','iv-a-1'], ['iv-d','iv-c','iv-a-1']]`);
- **B-4** asserts `details.perPath` has **two** entries and inspects their path-level and closure evidence.

A compact result that returns one canonical accepted path cannot pass B-3 as written, and dropping `perPath` breaks B-4/B-6. The package says Option B/D "keeps B-4/B-6 evidence if the witness is chosen carefully", but it does not mention **B-3's two-accepted-paths assertion at all**, and it does not place a conformance-corpus revision in the closure evidence. Approving DEC-18 without a corpus revision would require an implementation to satisfy N-176 and the existing conformance tests simultaneously — which is impossible for B/D as described.

**Required:** `T18-SPEC-01` must revise the B-3/B-4/B-6 expectations (or the decision must preserve a diagnostic API capable of satisfying them), and DEC-18's closure evidence must name that revision and the re-audit.

### F2 (high) — A rejection witness must reproduce the top-level code

**Status: witness contract resolved; A-8 (normative precedence) still open.** `decision-ready-revision.md` §3 now specifies the class-existence predicates (D0/D2/D3/D4/D6), the required class witness per returned code, and the current precedence preserved as an implementation compatibility rule (`MECHANISM > closure > cycle > contested > assurance`). `N176-12` (witness sufficiency) is answered for these classes; `A-8` — whether that precedence is normative — remains OPEN and is not claimed to be resolved by DEC-18.

### F3 (high) — Mechanism-failure precedence (historical finding)

**Status: superseded. No action remains.** This finding was written against revision 1 of the complexity analysis, which assumed path-scoped mechanism failures (for example a `Policy` hook throwing only for some edges). Revision 3 shows that no such class exists: the only reachable `MECHANISM` results are input-scoped (`assessEdge` candidate-array validation, selector/candidate prechecks); a throwing `Policy` hook is not caught and propagates. `N176-13` is withdrawn. The old "Required" action is therefore historical and was removed; the current model is in `oq4` §7 and `decision-ready-revision.md` §3.5.

### F4 (medium) — Option A cannot be recorded as satisfying N-176

**Status: open** — an owner decision; the package still rules out recording a cap as the N-176 resolution.

A cap still requires enumeration, so on Reading B it does not satisfy the `MUST NOT`; and returning a `MechanismFailure` on the cap conflates an operational resource policy with graph/input invalidity. The package says it is not recommended as the normative resolution — DEC-18 should state that explicitly so N-176 cannot be marked PASS by choosing A.

### F5 (medium) — Option C alone is insufficient and is also a breaking API

**Status: partially resolved** — the compact result (Option 5.B) replaces it; lazy diagnostics remain unnecessary for validity.

The public `Result` value is an eager frozen object. Lazy iteration cannot be exposed through `BindingResult` without changing the type, and if `acceptedPaths` remains, a caller that iterates it re-creates the enumeration. C is a useful implementation component, not a resolution by itself.

### F6 (medium) — The package omits the only option that preserves the API: Reading A as a decision

**Status: resolved** — Reading A is R1 in `oq4` §9 and `remaining-owner-questions.md` OQ-10.

The package describes Reading A (the full per-path result is the required result) but does not list it among the decision options. If the project **declares per-path output normative**, §8.8's conditional is not triggered — the result cannot be computed equivalently because the paths are the result — so there is no N-176 violation, no breaking change, and B-3/B-4 keep their meaning. The cost is that the exponential output remains a documented availability risk, with any cap explicitly outside the conformance contract.

This is a legitimate normative choice and must be on the table; presenting only B/C/D biases the decision toward a breaking change.

### F7 (medium) — The decision can silently settle A-14

**Status: open** — A-14 / #65 remains OPEN; the package states it is untouched.

Current binding-level `CYCLE_DETECTED` is the union of cycles touched by **any** path (A-14 / issue #65 is OPEN: an acyclic path through a cyclic node is rejected). A non-enumerating algorithm chooses differently which cycle(s) it observes. DEC-18 must state that it does not resolve A-14 and that cycle reporting remains as currently defined until #65 is decided.

### F8 (low) — Benchmark procedure still needs an executed record

**Status: open** — OQ-8; no executed record yet.

The generator and count formula are sound in shape, but the package cites `k=16` → 65 536 paths / ~2.7 s from a scratch measurement. Approval evidence should record an execution of `benchmark-procedure.md` (date, machine, revision, exact counts/timings) rather than the scratch figure.

### F9 (low) — "Bounded optional diagnostics" hides a policy

**Status: open** — OQ-7; diagnostics policy is an owner decision.

Who sets the bound, what is returned at the bound, and whether the bound is deterministic are all OPEN (`N176-4`, `N176-9`). If diagnostics are part of the public API, the bound becomes an observable contract; the decision should require a separate diagnostics API with an explicit policy owner, not a silent cap in the validity path.

## 3. Recommendation

**Choose Reading B, and treat the public per-path list as diagnostics — but only together with the four conditions below.** Option D is the right implementation shape for that reading; Option B is the smaller variant if the owner wants no diagnostics at all.

1. **API decision first (N176-5):** name the new validity result (canonical accepted witness + rejection witness), and move `acceptedPaths`/`details.perPath` to a separate diagnostic API.
2. **Corpus revision:** revise B-3 (both accepted paths), B-4 and B-6 (per-path evidence) through `T18-SPEC-01`, and re-audit the affected cases.
3. **Witness contract:** use the class-existence predicates (`oq4` §3–§8); mechanism precedence is input-scoped and no longer a separate decision (F3 superseded); state that A-8 and A-14 stay OPEN; record the terminal-origin semantics (OQ-11) and the Policy purity assumption (OQ-12).
4. **Benchmark record:** execute `benchmark-procedure.md` and attach the recorded output before implementation starts.

**Alternative, honestly on the table:** Reading A. It keeps the API and B-3/B-4 unchanged, closes N-176 as "conditional not triggered" rather than PASS-through-violation, and accepts the exponential output as an explicit availability risk with a cap outside conformance. It is the choice to make if API stability outweighs availability.

**Not acceptable:** recording Option A (cap) as the resolution of N-176, or Option C alone as sufficient.

## 4. Recommended `T18-DEC-18` shape (not approved)

One decision with named sub-parts, mirroring `T18-DEC-16`'s split:

- **18.a — reading:** Reading A or Reading B;
- **18.b — result contract:** per-path list normative (A) or diagnostics (B), and whether a new validity result type is added;
- **18.c — witness/rejection contract:** canonical accepted witness, rejection witness, mechanism-failure precedence, and preservation of the top-level code (A-8 untouched);
- **18.d — diagnostics policy:** separate API, bound and owner (if Reading B).

Approval of 18.a/18.b authorises the contract change; 18.c/18.d gate implementation. `N-176` and the §8.8 aggregate change status only through a re-audit revision, never inside this package.

## 5. What this review does not do

- It does not approve `T18-DEC-18`, change `N-176` or §8.8, or change Task 17 statuses.
- It does not change `docs/CORE-001.md`, `src/`, tests or the Task 17 artifacts.
- It does not resolve A-8, A-14 / #65, or closure depth.
- It does not claim the benchmark numbers are reproducible until the procedure is executed and recorded.
