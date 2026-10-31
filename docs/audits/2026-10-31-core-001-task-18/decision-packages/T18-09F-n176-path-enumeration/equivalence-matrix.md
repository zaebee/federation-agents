# T18-09F — Equivalence Matrix (current vs proposed compact)

**Status:** decision-support. **L1/L2/L3 are a hypothesis of Reading B, not an approved normative classification.** `T18-DEC-18` remains PROPOSED / OPEN.

Every "current result" below was checked against `evaluateBinding()`, `evaluateOnePath()` and `summarizePaths()` in `src/core/traversal.ts` (post-#24), not inferred from the option descriptions.

## 1. Current aggregation (code facts)

`evaluateBinding()`:

1. Runs input prechecks (duplicate descriptor id, candidate lookup, participant/selector). These return `MECHANISM` or `ERR_AUTHORITY_BINDING_MISMATCH` before discovery.
2. Discovers paths (sorted by `pathKey`) and evaluates them in order with `evaluateOnePath()`.
3. If **any** path evaluation returns a `Result` error (mechanism), `evaluateBinding()` returns `MECHANISM` immediately — even if an earlier path was fully accepted.
4. Otherwise `summarizePaths()` applies:
   - `accepted.length > 0` → `eligible: true` (closure/cycle/contested failures on other paths do not change L1);
   - else any `closure.status === 'UNSATISFIED'` → `ERR_MERGE_BRANCH_UNSATISFIED`;
   - else any `outcome.status === 'CYCLE_DETECTED'` → `CYCLE_DETECTED`;
   - else any `outcome.status === 'CONTESTED'` → `kind: CONTESTED`;
   - else → `ERR_ASSURANCE_PREDICATE_UNSATISFIED`.

This order is a code fact. A-8 is OPEN; the order is an implementation compatibility rule, not a normative precedence table.

**Scratch verification (not a committed test):** Cases A and C were reproduced with a temporary evaluator against the current source. Case A returned `eligible: true`, accepted `iv-d→iv-c→iv-a`, with another path `VALID` + `closure: UNSATISFIED`. Case C returned `eligible: false`, `kind: CONTESTED`, with outcomes `CONTESTED` and `INVALID`. These outputs are the basis for the corrected expected results below.

## 2. Layer hypothesis (Reading B)

| Layer | Content | Status in this document |
| --- | --- | --- |
| L1 — normative validity | `eligible` plus the top-level code required by §8.4/§8.6 | hypothesis |
| L2 — mandatory evidence | acceptance: one accepted witness (selection mode per `owner-decision-summary.md` OD-3) + per-edge assurance + closure for that path; rejection: top-level code + class witness; mechanism: input-scoped failure | hypothesis |
| L3 — diagnostics | complete path list and per-path outcomes | hypothesis (optional) |

## 3. Cases

### Case A — accepted path + closure failure on another path

**Graph:** `A` origin; `C CONTINUATION A`; `X CONTINUATION A`; `Y CONTINUATION A`; `B MERGED_FROM X,Y`; `D MERGED_FROM B,C`. Assessments are satisfied for `D→B`, `D→C`, `B→X`, `X→A`, `Y→A`, `C→A`; `B→Y` is missing.

**Paths:** `D→B→X→A` is `VALID` with `closure: UNSATISFIED` (the other parent of `B`, `Y`, has no applicable assessment). `D→B→Y→A` is `INVALID` (the `B→Y` edge itself has no assessment). `D→C→A` is `VALID` with `closure: SATISFIED`.

**Current result (reproduced):** `eligible: true`. `acceptedPaths` contains `D→C→A`. `details.perPath` contains all three records, including `VALID` + `closure: UNSATISFIED` for `D→B→X→A`.

**Proposed result:** `eligible: true`, with the fully valid path as the accepted witness (selection mode per OD-3). The closure failure on the other path is L3 diagnostic and is not required for L1.

**Equivalence argument:** `summarizePaths()` checks `accepted.length > 0` first. A closure failure on another path cannot suppress acceptance. The compact algorithm must therefore search for **existence** of a fully valid path (D0), not for "no path has a closure failure". This is the corrected reading: the previous draft's "eligible: false" was wrong.

**Gap:** none for L1. If the caller requires the closure failure as diagnostic evidence, it comes from the separate diagnostics API.

### Case B — accepted path + cycle-related failure on another path

**Graph:** candidate merges into a cyclic branch (`X↔Y`) and a clean branch (`good→origin`). Assessments satisfy the clean branch.

**Current result:** `eligible: true`. `acceptedPaths` contains the clean path. `details.perPath` contains a `CYCLE_DETECTED` record for the cyclic path and a `VALID`/`SATISFIED` record for the clean path.

**Proposed result:** `eligible: true`, with the clean path as the accepted witness (selection mode per OD-3). The cyclic path is L3 diagnostic.

**Equivalence argument:** L1 is identical because eligibility depends on existence of one fully valid path (§8.7). The compact algorithm must not let the cyclic path suppress acceptance. D0/D2 reachability in `A` finds the clean path; D3 classifies the cyclic path only for diagnostics.

**Gap:** none for L1. Cycle diagnostics are L3.

### Case C — contested + assurance, no accepted path

**Graph:** diamond `D MERGED_FROM B,C`; `B FORKED_FROM A`; `C CONTINUATION A`. Assessments: `D→B` has two applicable assessments and `Policy.conflictPredicate` returns true → `CONTESTED`; `D→C` and `B→A` are satisfied; `C→A` has `verified: []` → `INVALID`.

**Paths:** `D→B→A` is `CONTESTED`; `D→C→A` is `INVALID` (assurance failure at `C→A`). No fully valid path.

**Current result (reproduced):** `eligible: false`, `kind: CONTESTED`. `summarizePaths()` checks contested **before** the assurance fallback, and there is no closure or cycle outcome.

**Proposed result:** `eligible: false`, `kind: CONTESTED`, with a contested witness (failing edge + contested claims).

**Equivalence argument:** the compact algorithm must reproduce the current aggregation order: closure > cycle > contested > assurance. A compact result that returns `ERR_ASSURANCE_PREDICATE_UNSATISFIED` here would not be equivalent. This is a code-compatibility rule, not an A-8 resolution.

**Gap:** the compact algorithm must decide "is there a path whose first non-satisfied edge is contested?" (D2) and prefer it over assurance. D2 gives that class existence.

### Case D — multiple failure classes with different top-level outcomes

**Graph:** no accepted path; outcomes include closure failure, cycle, contested and assurance failure.

**Current result:** `ERR_MERGE_BRANCH_UNSATISFIED` (closure outranks cycle, contested and assurance).

**Proposed result:** `ERR_MERGE_BRANCH_UNSATISFIED`, with a closure branch witness.

**Equivalence argument:** same aggregation order. If the graph has cycle + contested but no closure, current result is `CYCLE_DETECTED`; if contested + assurance only, current result is `CONTESTED` (Case C); if only assurance, `ERR_ASSURANCE_PREDICATE_UNSATISFIED`. The compact algorithm must implement the same ordered class checks (D4, D3, D2).

**Gap:** the compact algorithm must not choose the first failing path by discovery order. It must check classes in the code's order.

### Case E1 — pre-discovery mechanism failure (D6a)

**Graph:** any graph; the candidate cannot reach the origin, and the binding's `selector_expression` is invalid for the candidate's `version_scheme` (or the candidate's `version_label` is invalid).

**Current result:** `MECHANISM`. `precheckCandidate()` runs before `discoverPaths()`; the invalid selector/label is returned as a mechanism failure even though no candidate→origin path exists.

**Proposed result:** `MECHANISM` with the same input-scoped error.

**Equivalence argument:** D6a. The failure is independent of graph reachability; a compact implementation must run the same prechecks before any reachability query.

**Gap:** none for L1. The compact API must not defer selector/label validation until after reachability.

### Case E2 — edge-evaluation mechanism failure (D6b)

**Graph:** candidate path exists; the assessment array is malformed (e.g., duplicate assessment ids); `reach_A(s,t)` holds and at least one acyclic path reaches an edge where `assessEdge` consults the malformed data.

**Current result:** `MECHANISM`, even if another path would be fully valid. `evaluateBinding()` returns on the first `evaluateOnePath()` `Result` error; `summarizePaths()` is never reached. If no path survives cycle preemption, or no surviving path reaches the malformed data, the result is the ordinary cycle/no-path/assurance outcome, not `MECHANISM`.

**Proposed result:** `MECHANISM` under the same condition; otherwise cycle/no-path.

**Equivalence argument:** D6b. This mechanism class is input-scoped but path-sensitive: it requires at least one acyclic path reaching `assessEdge`. The compact algorithm must not report `MECHANISM` merely because the input is malformed if every path is cycle-preempted.

**Gap:** D6b is polynomial but the condition must be implemented exactly; otherwise a compact API could change a cycle outcome into `MECHANISM`.

### Case F — deterministic witness under graph/edge permutation

**Graph:** any graph with at least one fully valid path; `nodes` and `edges` arrays reversed.

**Current result:** `eligible: true`; `acceptedPaths[0]` is the `pathKey`-minimum fully valid path (paths are discovered in sorted `pathKey` order and `accepted` preserves that order). P1/P2 verify storage-order invariance on bounded DAGs.

**Proposed result:** `eligible: true`, with the same accepted-witness edge sequence under the chosen OD-3 mode.

**Equivalence argument:** if the compact witness is defined as the `pathKey`-minimum fully valid path (D5), L2 evidence is identical. D5 is OPEN; until its encoding/oracle/invariance obligations close, this equivalence is not certified. The fallback is an explicit owner choice: "any valid witness" (weaker L2 determinism).

**Gap:** D5. Also, `pathKey` collisions between distinct paths are not ruled out by proof (see `complexity-proof.md` §9.2).

### Case G — no path

**Graph:** candidate cannot reach origin under the scope.

**Current result:** `eligible: false`, code `ERR_NO_TRAVERSAL_PATH`, empty `details`.

**Proposed result:** `eligible: false`, code `ERR_NO_TRAVERSAL_PATH`, with a `NO_PATH` rejection witness carrying `candidate`, `origin`, `scope`, and `evidence: 'REACHABILITY_RECHECK'`. It is not a cut certificate; verification reruns reachability in the supplied graph/scope. Legacy v1 keeps empty `details`.

**Equivalence argument:** D1 reachability; no enumeration needed.

**Gap:** none for L1. The evidence is independently verifiable only by rerunning reachability; a cut certificate is a future option, not v2.

### Case I — authority mismatch

**Graph:** any graph; the candidate exists, but `candidate.participant_id !== binding.target_participant_id` (or the selector does not match the candidate's version label).

**Current result:** `eligible: false`, code `ERR_AUTHORITY_BINDING_MISMATCH`, empty `details`. This is returned by `precheckCandidate()` before discovery.

**Proposed result:** `eligible: false`, code `ERR_AUTHORITY_BINDING_MISMATCH`, with an `AUTHORITY_MISMATCH` rejection witness carrying `targetParticipantId`, `candidateParticipantId`, `selectorExpression`, `versionScheme`, `versionLabel`, and `evidence: 'PRECHECK_FACTS'`.

**Equivalence argument:** L1 identical. The precheck facts are independently verifiable by re-running the participant/selector/label checks; they are not merely a repetition of the code.

**Gap:** none for L1. The exact field set is an API decision (`owner-decision-summary.md` OD-9).

### Case H — cycle without valid path

**Graph:** candidate and origin are in the same cyclic SCC; no acyclic path exists.

**Current result:** `eligible: false`, code `CYCLE_DETECTED`. For each cyclic path, `cycleForPath()` unions every SCC whose node set intersects that path and sorts the result; `details.perPath` contains those per-path unions.

**Proposed result:** `eligible: false`, code `CYCLE_DETECTED`, with a **minimal existence witness**: one concrete cyclic path (or a cyclic node `c` plus `s⇝c⇝t` witness) proving that some simple candidate→origin path touches `C`.

**Equivalence argument:** L1 (code) is identical. The v2 witness does **not** promise the per-path `cycleForPath()` union, a global union over all cyclic paths, or a minimum-cardinality cycle. If legacy diagnostic equivalence is required, it comes from v1 `details.perPath`; v2 must not claim it.

**Gap:** A-14 is unresolved; v2 preserves the top-level `CYCLE_DETECTED` code but narrows the diagnostic witness by design.

## 4. Summary of gaps

| Gap | Status |
| --- | --- |
| Compact rejection witness must reproduce top-level code without enumerating all paths | D4/D3/D2 polynomial; witness selection needs specification |
| Accepted path must dominate other-path closure/cycle/contested failures | code fact; compact D0 must be existence-based |
| No-path evidence | reachability recheck; cut certificate not in v2 |
| Authority-mismatch evidence | precheck facts (participant, selector, scheme, label) |
| Pre-discovery mechanism (D6a) | independent of reachability; must run before discovery |
| Edge-evaluation mechanism vs cycle (D6b) | polynomial, conditional on `reach_A(s,t)` and a path reaching `assessEdge` |
| A-8 aggregation order | implementation compatibility rule, not resolved |
| A-14 cycle reporting | preserved as-is, not resolved |
| D5 accepted-witness selection | proof sketch, three obligations open; OD-3 chooses the mode |
| `\u0000`/`\u0001` in ids | collision not proven impossible; oracle obligation |

## 5. What this matrix does not establish

- It does not establish that Reading B is normatively correct. L1/L2/L3 are a hypothesis.
- It does not establish that the compact API produces the same L1 as the legacy API; that requires a table-driven oracle comparison, which is a future test obligation.
- It does not resolve A-8, A-14, or N-176.
- It does not authorize implementation.