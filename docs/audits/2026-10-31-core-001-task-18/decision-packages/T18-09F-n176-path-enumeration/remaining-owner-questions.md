# T18-09F — Remaining Owner Questions

**Status:** input for the project owner. `T18-DEC-18` remains **PROPOSED / OPEN**; nothing here is approved or registered.
**Basis:** `decision-ready-revision.md` (six required outcomes), `adversarial-review.md`, and `oq4-complexity-adversarial-pass.md` **revision 3.1** (all classes polynomial; D5 proof obligations named; mechanism split into D6a/D6b).

## Option schemes (do not conflate)

| Scheme | Meaning |
| --- | --- |
| **Reading A / Reading B** | Normative reading of §8.8: full per-path result normative (A) vs validity + mandatory evidence, paths diagnostic (B). |
| **Option 5.A / Option 5.B** | API migration: replace `BindingResult` (5.A) vs add a versioned compact API, keep the legacy one (5.B). |
| **Legacy Options A–D** | Engineering options in `n176-path-enumeration.md` §5: A cap, B compact, C lazy, D hybrid. "Option D" in `adversarial-review.md` means this legacy hybrid. |
| **R1–R4** | Reading/complexity policy in OQ-10 (complexity is no longer the differentiator). |
| ~~mechanism (a)/(b)~~ | **Withdrawn** — no path-scoped mechanism class exists (`oq4` §7). |

## OQ-1 — Which reading of §8.8 governs?

- **A:** the full per-path list is normative evidence.
- **B:** the normative result is validity plus mandatory evidence; the full list is diagnostics.

**Preferred: B (R2).** §8.4/§8.7 define validity by the existence of one fully valid path; no sentence requires returning every path. The complexity analysis now supports B: all decision classes (D0–D4, D6a, D6b) are polynomial and D5 is a proof obligation, so the compact result does not need the exponential path set. **If A:** no API change; B-3/B-4 keep their meaning; `2^k` output remains an explicit availability risk; N-176 would be recorded as "conditional not triggered" rather than PASS.

## OQ-2 — API strategy under Reading B: replace or version?

- **Option 5.A — replace:** change `BindingResult`; revise B-3/B-4/B-6.
- **Option 5.B — version:** add a compact result type/function; keep the current API as deprecated legacy.

**Recommended: Option 5.B.** It cannot break existing callers and keeps the legacy corpus meaningful during migration.

## OQ-3 — Conformance corpus: revise B-3/B-4/B-6 or keep them on the legacy API?

If OQ-2 chooses **Option 5.B**, keep B-3/B-4/B-6 on the legacy API and add v2 cases for L1/L2. If **Option 5.A**, revise the corpus through `T18-SPEC-01` before implementation.

**Recommended: Option 5.B + add v2 cases; do not rewrite the legacy assertions in the same step.**

## OQ-4 — Is the compact rejection proof polynomial? (resolved)

Yes. `oq4` revision 3.1 proves:

- **D1** reachability; **D0** reachability on the valid subgraph;
- **D2** first-failing-edge class: `(u→v)` in class X with `reach_{valid}(s,u)` and `reach_A(v,t)` — two reachability computations;
- **D3** cycle-class existence: ∃ cyclic `c` with `reach(s,c)` and `reach(c,t)`; a walk through `c` loop-erases to a simple path that still touches a cyclic node (Lemma 4);
- **D4** closure failure: triple `(merge node, path edge, failing branch)` with reachability; general over parent counts;
- **D6a** pre-discovery mechanisms (duplicate id, missing candidate, selector/label validation) are independent of reachability;
- **D6b** edge-evaluation mechanisms: malformed assessments produce `MECHANISM` only if `reach_A(s,t)` and a path reaches `assessEdge`;
- **D5** accepted-witness selection: `pathKey`-minimum (greedy on the acyclic subgraph) or `DETERMINISTIC_NON_MINIMUM` with a specified storage-order-independent rule; a non-deterministic/arbitrary witness is not valid under §8.8. The greedy is a **proof sketch with proof and test obligations** (see OQ-10 / decision-ready §2.4), not yet certified.

**Recommended: accept the polynomial analysis for D0–D4/D6a/D6b; treat D5 as a proof obligation before implementation is called complete.**

## OQ-5 — Does A-8 stay OPEN, with the current precedence as an implementation rule?

**Recommended: yes.** The compact implementation reproduces `MECHANISM (input-scoped) > closure > cycle > contested > assurance` as current behaviour. A-8 is not resolved; if it is later decided differently, the result changes with the decision.

## OQ-6 — Mechanism failures (withdrawn)

Withdrawn. The code does not catch throwing `Policy` hooks; they propagate as uncaught caller errors. The only reachable `MECHANISM` results are input-scoped (`assessEdge` candidate validation, selector/candidate prechecks). No path-scoped class exists and no owner choice is needed unless hook error semantics are deliberately changed — a separate decision.

## OQ-7 — Diagnostics API policy

Who owns the bound, what is returned when it is reached, and is the diagnostics API part of the package-root surface?

**Recommended: caller-owned bound, separate API, explicit "truncated" result; validity is never affected.**

## OQ-8 — Resource target and benchmark acceptance

`k=16` is a **benchmark target**, not a proof of complexity. The executed record is `benchmark-record.md`: source revision `9e29b36…`, harness revision `d947991…`, Bun 1.4.2 on AMD EPYC-Rome (4 cores), median of three runs `k=16` → 65 536 paths / 2 305 ms / 458 MiB RSS delta. The record also includes the `k=12` storage-order reversal check. This is empirical resource-exhaustion evidence, not a complexity bound.

**Recommended: keep `k=16` as the conformance-oriented benchmark target, cite the executed `benchmark-record.md`, and state that it does not establish a bound.**

## OQ-11 — Is the terminal origin subject to merge closure?

**Status: OPEN — owner/specification decision, not a prerequisite for merging this documentation package.** It is follow-up specification work; merging the package does not accept either semantics and does not authorise implementation.

Closure runs for the `child` of each path edge; the origin is never a child, so a merge-node origin is not checked today. §8.6/§8.7 do not state whether the endpoint counts.

- **Semantics E (current code):** origin is an endpoint, not a node the path passes through; excluded.
- **Semantics I (literal):** origin is checked; since it has no outgoing path edge, all its parent edges are closure branches (the last path edge is already validated by §8.5).

**Owner/spec-editor choice required.** Both are polynomial for D4; the proof and a conformance test must state the choice. This is a normative question, not an implementation detail.

## OQ-12 — Are Policy callbacks pure and deterministic?

**Status: OPEN — owner/specification decision, not a prerequisite for merging this documentation package.** It is follow-up specification work; merging the package does not accept either contract and does not authorise implementation.

The equivalence proofs (including D4's path-edge exclusion and any memoisation) assume `applicableAssessments` and `conflictPredicate` are pure: same inputs → same result, no side effects, no exceptions. The type does not enforce this, and a callback that depends on call order/state makes even the legacy traversal order-dependent.

**Verified source behavior at `9e29b3627c9c5daab3a3029d8326dec65c47c161`:** `policy.applicableAssessments` is invoked directly from `assessEdge()` / `narrowByPolicy()`, and `policy.conflictPredicate` is invoked directly from contested-claim collection. These callback invocations are not individually wrapped in `try/catch`; an exception thrown by either callback propagates to the caller and is not converted into a mechanism failure.

**Documentation discrepancy:** `docs/implementation.md` §1.6 currently says policy callbacks are guarded individually and a throwing one becomes a mechanism failure. That statement is stale and contradicts the current source behavior. It requires a separate documentation correction; this PR does not modify `docs/implementation.md` or source.

**Owner/spec-editor choice required:** either freeze a pure/deterministic/non-throwing Policy contract with stated exception handling, or explicitly exclude callback exceptions from the N-176 equivalence claim. Without this, "equivalent result" is undefined. OQ-12 remains OPEN.

## OQ-9 — Audit consequence

Reading B may establish a path toward N-176 PASS, but **adoption of Reading B or acceptance of an implementation does not itself change N-176 status**. N-176 may be changed to PASS only through a separate audit revision that verifies:

- the owner's explicit approval of the normative interpretation;
- exact L1/L2 equivalence under the approved contract;
- closure of D5 or approval of a deterministic non-minimum witness rule consistent with §8.8;
- resolution of OQ-11 and OQ-12, or their explicit and justified exclusion from the equivalence claim;
- the required conformance tests;
- a successful re-audit of the resulting package and implementation.

Reading A may instead keep N-176 as "conditional not triggered" (not PASS-through-violation). **Implementation acceptance alone never changes N-176 or §8.8 status.** This document does not mark N-176 PASS or §8.8 PASS.

**Recommended: decide the wording together with OQ-1, not after implementation.**

## OQ-10 — Reading/API policy (relates to OQ-4)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative. | No API break; exponential output accepted as availability risk; no compact-rejection work. |
| **R2 — Reading B, exact** | Compact API; D0–D4/D6a/D6b polynomial; D5 proof obligations first. | Satisfies N-176; needs `T18-SPEC-01`, versioned API, corpus additions. |
| **R3 — Reading B, semantic change** | Walk/state-based cycle class. | **Not needed**: D3 is polynomial under current semantics. |
| **R4 — Defer** | Keep N-176 PARTIAL; clarify §8.8 and D4/§8.6 in `T18-SPEC-01`. | No decision now; honest fallback. |

**Recommended: R2** (consistent with OQ-1). Implementation under R2 would first need OQ-11 (terminal origin), OQ-12 (Policy purity) and the D5 obligations resolved — but **merging this documentation package does not require or imply any of those resolutions**, and does not authorise implementation. **R1 is the fallback**; R3 is unnecessary; R4 if the owner wants spec clarification first.

---

## What is settled by this revision (no owner choice needed)

- Three-layer model L1/L2/L3 and the diagnostics classification under Reading B.
- D0/D2/D3/D4/D6a/D6b are polynomial; D6a is reachability-independent and D6b has no path-scoped class; `N176-13` withdrawn.
- The D4/§8.6 path-edge discrepancy is a specification-wording issue (path edge already validated by §8.5), not an implementation change. Terminal-origin closure (OQ-11) and Policy purity (OQ-12) are **not** settled and are listed below.
- Validity API must not be resource-capped; caps belong to diagnostics.
- No new normative error code.

## What still needs proof or an owner decision

- **D5**: formal write-up + oracle/permutation tests before calling it certified polynomial.
- **Reading A vs B**, **5.A vs 5.B**, **diagnostics policy**, **benchmark record**, **N-176 audit wording** — owner choices above.
- **D4/§8.6 clarification** — spec-editor choice, via `T18-SPEC-01`.
- **OQ-11**: terminal-origin closure semantics and a conformance test.
- **OQ-12**: pure/deterministic Policy contract, or explicit exclusion of impure hooks.
