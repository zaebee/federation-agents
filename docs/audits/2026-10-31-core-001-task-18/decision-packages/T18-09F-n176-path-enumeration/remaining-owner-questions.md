# T18-09F — Remaining Owner Questions

**Status:** input for the project owner. `T18-DEC-18` remains **PROPOSED / OPEN**; nothing here is approved or registered.
**Basis:** `decision-ready-revision.md` (six required outcomes), `adversarial-review.md`, and `oq4-complexity-adversarial-pass.md` **revision 3** (all classes polynomial; D5 proof obligations named).

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

**Preferred: B (R2).** §8.4/§8.7 define validity by the existence of one fully valid path; no sentence requires returning every path. The complexity analysis now supports B: all decision classes (D0–D6) are polynomial, so the compact result does not need the exponential path set. **If A:** no API change; B-3/B-4 keep their meaning; `2^k` output remains an explicit availability risk; N-176 would be recorded as "conditional not triggered" rather than PASS.

## OQ-2 — API strategy under Reading B: replace or version?

- **Option 5.A — replace:** change `BindingResult`; revise B-3/B-4/B-6.
- **Option 5.B — version:** add a compact result type/function; keep the current API as deprecated legacy.

**Recommended: Option 5.B.** It cannot break existing callers and keeps the legacy corpus meaningful during migration.

## OQ-3 — Conformance corpus: revise B-3/B-4/B-6 or keep them on the legacy API?

If OQ-2 chooses **Option 5.B**, keep B-3/B-4/B-6 on the legacy API and add v2 cases for L1/L2. If **Option 5.A**, revise the corpus through `T18-SPEC-01` before implementation.

**Recommended: Option 5.B + add v2 cases; do not rewrite the legacy assertions in the same step.**

## OQ-4 — Is the compact rejection proof polynomial? (resolved)

Yes. `oq4` revision 3 proves:

- **D1** reachability; **D0** reachability on the valid subgraph;
- **D2** first-failing-edge class: `(u→v)` in class X with `reach_{valid}(s,u)` and `reach_A(v,t)` — two reachability computations;
- **D3** cycle-class existence: ∃ cyclic `c` with `reach(s,c)` and `reach(c,t)`; a walk through `c` loop-erases to a simple path that still touches a cyclic node (Lemma 4);
- **D4** closure failure: triple `(merge node, path edge, failing branch)` with reachability; general over parent counts;
- **D6** input-scoped mechanisms only;
- **D5** canonical witness: greedy on the acyclic subgraph; **proof sketch with empirical obligations** (see OQ-10 / decision-ready §2.4), not yet certified.

**Recommended: accept the polynomial analysis for D0–D4/D6; treat D5 as a proof obligation before implementation is called complete.**

## OQ-5 — Does A-8 stay OPEN, with the current precedence as an implementation rule?

**Recommended: yes.** The compact implementation reproduces `MECHANISM (input-scoped) > closure > cycle > contested > assurance` as current behaviour. A-8 is not resolved; if it is later decided differently, the result changes with the decision.

## OQ-6 — Mechanism failures (withdrawn)

Withdrawn. The code does not catch throwing `Policy` hooks; they propagate as uncaught caller errors. The only reachable `MECHANISM` results are input-scoped (`assessEdge` candidate validation, selector/candidate prechecks). No path-scoped class exists and no owner choice is needed unless hook error semantics are deliberately changed — a separate decision.

## OQ-7 — Diagnostics API policy

Who owns the bound, what is returned when it is reached, and is the diagnostics API part of the package-root surface?

**Recommended: caller-owned bound, separate API, explicit "truncated" result; validity is never affected.**

## OQ-8 — Resource target and benchmark acceptance

`k=16` is a **benchmark target**, not a proof of complexity. The current evidence is `k=16` → 65 536 paths / ~2.7 s from a scratch run.

**Recommended: keep `k=16` as the conformance-oriented benchmark target, attach an executed record (date, revision, machine, counts), and state that it does not establish a bound.**

## OQ-9 — Audit consequence

- Reading B + accepted implementation → N-176 PASS, §8.8 PARTIAL → PASS, via a re-audit revision.
- Reading A → N-176 "conditional not triggered" (not PASS-through-violation).

**Recommended: decide the wording together with OQ-1, not after implementation.**

## OQ-10 — Reading/API policy (relates to OQ-4)

| Option | Meaning | Consequence |
| --- | --- | --- |
| **R1 — Reading A** | Per-path result normative. | No API break; exponential output accepted as availability risk; no compact-rejection work. |
| **R2 — Reading B, exact** | Compact API; D0–D4/D6 polynomial; D5 proof obligations first. | Satisfies N-176; needs `T18-SPEC-01`, versioned API, corpus additions. |
| **R3 — Reading B, semantic change** | Walk/state-based cycle class. | **Not needed**: D3 is polynomial under current semantics. |
| **R4 — Defer** | Keep N-176 PARTIAL; clarify §8.8 and D4/§8.6 in `T18-SPEC-01`. | No decision now; honest fallback. |

**Recommended: R2** (consistent with OQ-1). **R1 is the fallback** if the owner wants no API change; R3 is unnecessary; R4 only if the owner wants spec clarification first.

---

## What is settled by this revision (no owner choice needed)

- Three-layer model L1/L2/L3 and the diagnostics classification under Reading B.
- D0/D2/D3/D4/D6 are polynomial; D6 has no path-scoped class; `N176-13` withdrawn.
- The D4/§8.6 discrepancy is a specification-wording issue (path edge already validated by §8.5), not an implementation change.
- Validity API must not be resource-capped; caps belong to diagnostics.
- No new normative error code.

## What still needs proof or an owner decision

- **D5**: formal write-up + oracle/permutation tests before calling it certified polynomial.
- **Reading A vs B**, **5.A vs 5.B**, **diagnostics policy**, **benchmark record**, **N-176 audit wording** — owner choices above.
- **D4/§8.6 clarification** — spec-editor choice, via `T18-SPEC-01`.
