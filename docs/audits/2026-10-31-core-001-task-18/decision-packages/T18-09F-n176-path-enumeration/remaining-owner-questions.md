# T18-09F — Remaining Owner Questions

**Status:** input for the project owner. `T18-DEC-18` remains **PROPOSED / OPEN**; nothing here is approved or registered.
**Basis:** `decision-ready-revision.md` (the six required outcomes), `adversarial-review.md` and `oq4-complexity-adversarial-pass.md` (revision 2, after the independent complexity review).

## Option schemes (do not conflate)

| Scheme | Meaning |
| --- | --- |
| **Reading A / Reading B** | Normative reading of §8.8: full per-path result is normative (A) vs validity + mandatory evidence, paths are diagnostics (B). |
| **Option 5.A / Option 5.B** | API migration: replace `BindingResult` (5.A) vs add a versioned compact API and keep the legacy one (5.B). |
| **Legacy Options A–D** | Engineering options in `n176-path-enumeration.md` §5: A cap, B compact, C lazy, D hybrid. "Option D" in `adversarial-review.md` means this legacy hybrid. |
| **R1–R4** | Complexity/reading policy in OQ-10. |
| ~~mechanism (a)/(b)~~ | **Withdrawn** — no path-scoped mechanism class exists (`oq4` §4). |

## OQ-1 — Which reading of §8.8 governs?

- **A:** the full per-path list is normative evidence.
- **B:** the normative result is validity plus mandatory evidence; the full list is diagnostics.

**Preferred: B (R2).** §8.4/§8.7 define validity by the existence of one fully valid path, and no sentence requires returning every path. The complexity pass now supports this: acceptance and assurance/closure rejection are compact and polynomial; only the cycle-class question (D3) remains open. **If A:** no API change is needed and B-3/B-4 keep their meaning, but the `2^k` output remains an explicit availability risk; N-176 would be recorded as "conditional not triggered" rather than PASS.

## OQ-2 — API strategy under Reading B: replace or version?

- **Option 5.A — replace:** change `BindingResult`; revise B-3/B-4/B-6.
- **Option 5.B — version:** add a compact result type/function; keep the current API as deprecated legacy.

**Recommended: Option 5.B.** A versioned addition cannot break existing callers and keeps the old conformance corpus meaningful during migration.

## OQ-3 — Conformance corpus: revise B-3/B-4/B-6 or keep them on the legacy API?

If OQ-2 chooses **Option 5.B**, keep B-3/B-4/B-6 on the legacy API and add v2 cases for L1/L2. If **Option 5.A**, the corpus must be revised through `T18-SPEC-01` before implementation.

**Recommended: Option 5.B + add v2 cases; do not rewrite the legacy assertions in the same step.**

## OQ-4 — Is the compact rejection proof polynomial? (corrected)

After the **cycle-preemption lemma** (`oq4` §2): a path that reaches assurance/closure classification contains no cyclic-SCC node, so it lies in a DAG. There:

- **D0** acceptance existence — polynomial (reachability on valid edges);
- **D2** first-failing-edge class — polynomial (reach `s⇝u` on valid edges, then `v⇝t`);
- **D4** closure failure — polynomial (state `(merge node, outgoing path edge)`);
- **D5** canonical witness — polynomial proof sketch (greedy on the DAG with reachability feasibility);
- **D6** path-scoped mechanism — **does not exist**: mechanism results are input-scoped; a throwing `Policy` hook propagates and is not a mechanism outcome;
- **D3** cycle-class existence (a simple path through a cyclic node) — **OPEN, complexity not established**; the earlier 2-disjoint-paths reduction was unsound because the hard instances carry cycles that preempt.

**Recommended: accept the compact proof for D0/D2/D4/D5, with D3 explicitly documented as the only open class.** If the owner requires D3 to be polynomial before any decision, R1/R4 apply (OQ-10).

## OQ-5 — Does A-8 stay OPEN, with the current precedence as an implementation rule?

**Recommended: yes.** Because mechanism failures are input-scoped (decided once) and the other classes are compact per OQ-4, the compact implementation reproduces `MECHANISM > closure > cycle > contested > assurance` exactly as current behaviour for D0/D2/D4/D5. D3 remains the only case where the computation may not be compact. A-8 is not resolved; if it is later decided differently, the result changes with the decision.

## OQ-6 — Mechanism failures (withdrawn)

This question is **withdrawn**. Revision 1 assumed path-scoped mechanism failures (e.g. a policy hook throwing only for some edges). The code does not catch such throws: they propagate as uncaught caller errors. The only reachable `MECHANISM` results are input-scoped (`assessEdge` candidate-array validation, selector/candidate prechecks), which are polynomial. There is no owner choice here unless the project decides to *change* hook error semantics — a separate decision, not part of N-176.

## OQ-7 — Diagnostics API policy

Who owns the bound, what is returned when it is reached, and is the diagnostics API part of the package-root surface?

**Recommended: caller-owned bound, separate API, explicit "truncated" result; validity is never affected.**

## OQ-8 — Resource target and benchmark acceptance

`k=16` is a **benchmark target**, not a proof of complexity: it does not exclude an exponential worst case on other graph families (specifically D3). The current evidence is `k=16` → 65 536 paths / ~2.7 s from a scratch run.

**Recommended: keep `k=16` as the conformance-oriented benchmark target, attach an executed record (date, revision, machine, counts), and state explicitly that the benchmark does not establish a complexity bound.**

## OQ-9 — Audit consequence

How will N-176 be recorded after implementation?

- Reading B + accepted implementation → N-176 PASS, §8.8 PARTIAL → PASS, via a re-audit revision.
- Reading A → N-176 "conditional not triggered" (not PASS-through-violation); the audit must record that mapping explicitly.

**Recommended: decide the audit wording together with OQ-1, not after implementation.**

## OQ-10 — Complexity/reading policy (relates to OQ-4)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative. | No API break; exponential output accepted as an availability risk; no D3 question. |
| **R2 — Reading B, exact** | Compact API; D0/D2/D4/D5 polynomial; D3 exact search (complexity open) or cycle-enumeration fallback for that class. | Satisfies N-176 except possibly D3; D3's bound must be stated, not hidden. |
| **R3 — Reading B, semantic change** | Redefine the cycle-class verdict over expanded state/walks. | Polynomial, but changes observable results; needs `T18-SPEC-01` and corpus revision. |
| **R4 — Defer** | Keep N-176 PARTIAL; clarify §8.8 and D3 in `T18-SPEC-01`. | No decision now; honest about D3. |

**Recommended: R2**, consistent with the OQ-1 preference, with D3 documented as the one open class. **R1 is the fallback** if the owner requires a fully specified contract before any further proof work; R3 only if a semantic change is acceptable; R4 if the owner wants the spec clarified first.

---

## What is settled by the decision-ready revision (no owner choice needed)

- The three-layer result model (L1 validity / L2 mandatory evidence / L3 diagnostics) and the classification of `acceptedPaths`/`details.perPath` as L3 under Reading B.
- The canonical witness is the `pathKey` minimum, found by greedy minimisation on the acyclic subgraph (proof sketch; needs tests).
- The rejection proof is class-existence based; D0/D2/D4/D5 are polynomial; D3 is open; D6 does not exist.
- Mechanism failures are input-scoped; `N176-13` is withdrawn.
- The validity API must not be resource-capped; caps belong to diagnostics.
- No new normative error code.
