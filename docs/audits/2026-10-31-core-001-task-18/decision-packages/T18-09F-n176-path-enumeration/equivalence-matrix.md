# T18-09F — Equivalence Matrix (current vs proposed compact)

**Status:** decision-support. **L1/L2/L3 are a hypothesis of Reading B, not an approved normative classification.** `T18-DEC-18` remains PROPOSED / OPEN.

This matrix compares the **current** evaluator (`BindingResult`, `acceptedPaths`, `details.perPath`) with a **proposed compact** evaluator under Reading B. For each case it states the current result, the proposed result, and the argument for equivalence. Where the argument is incomplete, the gap is stated.

## 1. Layer hypothesis (Reading B)

| Layer | Content | Status in this document |
| --- | --- | --- |
| L1 — normative validity | `eligible` plus the top-level code required by §8.4/§8.6 | hypothesis |
| L2 — mandatory evidence | acceptance: one canonical accepted witness + per-edge assurance + closure for that path; rejection: top-level code + class witness; mechanism: input-scoped failure | hypothesis |
| L3 — diagnostics | complete path list and per-path outcomes | hypothesis (optional) |

## 2. Adversarial cases

### Case A — accepted path + closure failure on another path

**Graph:** diamond `D MERGED_FROM B,C; B,C CONTINUATION A`. One branch (`B`) has a satisfied closure; the other (`C`) has an unsatisfied closure-only branch.

**Current result:** `eligible: false`, code `ERR_MERGE_BRANCH_UNSATISFIED`. `details.perPath` has two records; the path through `C` has `outcome: VALID`, `closure: UNSATISFIED`; the path through `B` has `outcome: VALID`, `closure: SATISFIED`. `acceptedPaths` is empty.

**Proposed result:** `eligible: false`, code `ERR_MERGE_BRANCH_UNSATISFIED`. L2 rejection witness: the failing branch identity (child/parent/relation of the unsatisfied closure branch) and the path that carried it. `acceptedPaths` (L3) may be empty or omitted.

**Equivalence argument:** L1 (code) is identical. L2 requires the failing branch identity, which the current result also carries in `details.perPath[...].closure.failures`. The compact result must reproduce at least one failing branch identity; it cannot drop it. **Gap:** if multiple paths fail for different branches, the compact result must still reproduce the top-level code; the current code does this by scanning all paths. The compact algorithm must prove it finds at least one failing branch without enumerating all paths, or accept that rejection L2 requires a class-existence search (D4, polynomial).

### Case B — accepted path + cycle-related failure on another path

**Graph:** candidate merges into a cyclic branch (`X↔Y`) and a clean branch (`good→origin`). Assessments satisfy the clean branch.

**Current result:** `eligible: true` (the clean path is accepted). `details.perPath` contains a `CYCLE_DETECTED` record for the cyclic path and a `VALID`/`SATISFIED` record for the clean path. `acceptedPaths` contains the clean path.

**Proposed result:** `eligible: true`. L2 acceptance witness: the clean path. The cyclic path is not required for L1 or L2; it is L3 diagnostic.

**Equivalence argument:** L1 is identical because eligibility depends on existence of one fully valid path (§8.7). The compact result must not let the cyclic path suppress acceptance. **Gap:** the compact algorithm must evaluate the clean path without first discovering the cyclic one; reachability in `A` (Lemma 1) already excludes cyclic SCC nodes from simple paths, so the clean path is found by reachability. This is polynomial (D0/D2). The cyclic path's `CYCLE_DETECTED` outcome is L3 and may be omitted, but only if the caller does not require it as diagnostic evidence.

### Case C — multiple failure classes with different top-level outcomes

**Graph:** two paths: one fails assurance (missing claim), one is contested; no accepted path.

**Current result:** `eligible: false`, code `ERR_ASSURANCE_PREDICATE_UNSATISFIED` (assurance outranks contested in the current aggregation order: closure > cycle > contested > assurance). `details.perPath` has both records.

**Proposed result:** `eligible: false`, code `ERR_ASSURANCE_PREDICATE_UNSATISFIED`. L2 rejection witness: the failing edge and missing/disallowed claims for the assurance-failing path (or a class witness that identifies which class won).

**Equivalence argument:** L1 identical only if the compact algorithm uses the **same aggregation order** as the current code: `MECHANISM > closure > cycle > contested > assurance`. This order is an implementation compatibility rule (A-8 is OPEN); it is not a normative precedence table. The compact result must reproduce it exactly or the top-level code changes. **Gap:** the current order is not derived from §8; it is a local aggregation rule. Reading B cannot silently replace it with a different (e.g., lexicographically first failing path) order without changing observable results. This is explicitly left as an implementation compatibility rule, not a resolution of A-8.

### Case D — input-scoped mechanism failure

**Graph:** candidate path exists, but the assessment array is malformed (e.g., duplicate assessment ids) and at least one simple path avoids every cyclic SCC (`reach_A(s,t)` holds).

**Current result:** `eligible: false`, `kind: MECHANISM`, with the mechanism error. Even if another path would be accepted, the mechanism failure wins (current code returns MECHANISM if any path fails with a mechanism error during sequential evaluation; note evaluation order is sorted path order).

**Proposed result:** `eligible: false`, `kind: MECHANISM`, with the same mechanism error.

**Equivalence argument:** L1 identical. The mechanism failure is input-scoped (D6, §7 of `oq4`), not path-scoped. The compact algorithm must detect malformed input before or independently of path enumeration. **Gap:** the current code detects it during path validation, which requires reaching `assessEdge` on at least one acyclic path. If no such path exists (all paths cyclic), the current code returns a cycle outcome, not MECHANISM. The compact algorithm must preserve this conditional (D6) and must not report MECHANISM merely because the input is malformed.

### Case E — deterministic witness under graph/edge permutation

**Graph:** any graph with at least one fully valid path, with `nodes` and `edges` arrays reversed.

**Current result:** `eligible: true`, `acceptedPaths` contains the `pathKey`-minimum path, in the same order regardless of storage. Verified by P1/P2 on bounded DAGs; not yet verified on the exponential merge-diamond shape.

**Proposed result:** `eligible: true`, with the same canonical witness edge sequence.

**Equivalence argument:** L1 identical if the compact algorithm's witness selection is storage-independent. The greedy algorithm (D5) selects by `pathKey` order, which is storage-independent by construction. **Gap:** D5 is a proof sketch; the single-edge string comparison may disagree with full-path `pathKey` comparison when ids contain `\u0000` or `\u0001` (see `complexity-proof.md` §4.2). Until the oracle and invariance tests are executed, this equivalence is not certified.

### Case F — no path

**Graph:** candidate cannot reach origin under the scope.

**Current result:** `eligible: false`, code `ERR_NO_TRAVERSAL_PATH`, empty `details`.

**Proposed result:** `eligible: false`, code `ERR_NO_TRAVERSAL_PATH`, empty details.

**Equivalence argument:** L1 identical. This is reachability (D1), polynomial, no enumeration needed.

### Case G — cycle without valid path

**Graph:** candidate and origin are in the same cyclic SCC; no acyclic path exists.

**Current result:** `eligible: false`, code `CYCLE_DETECTED`, with the combined cycle nodes. `details.perPath` contains the cyclic path(s).

**Proposed result:** `eligible: false`, code `CYCLE_DETECTED`, with the combined cycle nodes. L2 rejection witness: the cycle node set. L3 path list optional.

**Equivalence argument:** L1 identical. Cycle detection is on `graph.cycles` (SCC), independent of path enumeration. The compact algorithm must not resolve A-14 (which cycle is reported when multiple SCCs intersect the path); it must reproduce the current `cycleForPath` behaviour: collect every cycle whose node set intersects the path, union their node sets, sort. **Gap:** none for L1; A-14 remains OPEN as a normative question.

## 3. Summary of gaps

| Gap | Status |
| --- | --- |
| Compact rejection witness must reproduce top-level code without enumerating all paths | D4 polynomial, but the specific witness selection needs specification |
| Mechanism precedence vs cycle (D6) | polynomial, conditional on `reach_A` |
| A-8 aggregation order | implementation compatibility rule, not resolved |
| A-14 cycle reporting | preserved as-is, not resolved |
| D5 canonical witness | proof sketch, three obligations open |
| `\u0000`/`\u0001` in ids | ambiguity in `pathKey` encoding; needs test or encoding revision |

## 4. What this matrix does not establish

- It does not establish that Reading B is normatively correct. L1/L2/L3 are a hypothesis.
- It does not establish that the compact API produces the same L1 as the legacy API; that requires a table-driven oracle comparison, which is a future test obligation.
- It does not resolve A-8, A-14, or N-176. Those remain OPEN.