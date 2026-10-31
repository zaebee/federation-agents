# T18-09F — Remaining Owner Questions

**Status:** input for the project owner. `T18-DEC-18` remains **PROPOSED / OPEN**; nothing here is approved or registered.
**Basis:** `decision-ready-revision.md` (the six required outcomes) and `adversarial-review.md`.

These are the choices that cannot be settled by engineering judgement or by reading §8.4–§8.8 alone. Each is phrased as a question with the recommended answer and the consequence of choosing otherwise.

## OQ-1 — Which reading of §8.8 governs? (the decision that gates everything else)

- **A:** the full per-path list is normative evidence.
- **B:** the normative result is validity plus mandatory evidence; the full list is diagnostics.

**Recommended: B.** §8.4/§8.7 define validity by the existence of one fully valid path, and no sentence requires returning every path. **If A:** no API change is needed and B-3/B-4 keep their meaning, but the `2^k` output remains an explicit availability risk; N-176 would be recorded as "conditional not triggered" rather than PASS.

## OQ-2 — API strategy under Reading B: replace or version?

- **5.A replace:** change `BindingResult`; revise B-3/B-4/B-6.
- **5.B version:** add a compact result type/function; keep the current API as deprecated legacy.

**Recommended: 5.B.** A versioned addition cannot break existing callers and keeps the old conformance corpus meaningful during migration.

## OQ-3 — Conformance corpus: revise B-3/B-4/B-6 or keep them on the legacy API?

If OQ-2 is 5.B, the cheapest path is: keep B-3/B-4/B-6 on the legacy API and add v2 cases for L1/L2. If 5.A, the corpus must be revised through `T18-SPEC-01` before implementation.

**Recommended: 5.B + add v2 cases; do not rewrite the legacy assertions in the same step.**

## OQ-4 — Rejection proof: polynomiality is **not established** (claim withdrawn)

The earlier proposal — per-class reachability + one witness per class, called polynomial — has been withdrawn. `oq4-complexity-adversarial-pass.md` shows:

- D1 (no path) is polynomial (reachability);
- D2 (a simple path through a specified failing edge), D3 (a simple path through a specified cyclic node) and D4 (a closure failure tied to a specified incoming edge) reduce from directed 2-disjoint paths, which is NP-complete;
- the expanded-state `(node, incoming edge)` reachability allows walks with repeated nodes and therefore does not prove simple-path existence;
- the canonical acceptance witness (D5) has a plausible polynomial strategy but no proof.

**No recommendation is made here.** The owner must choose between R1–R4 in `oq4` §5 (see OQ-10).

## OQ-5 — Does A-8 stay OPEN, with the current precedence as an implementation rule?

**Recommended: yes.** The compact implementation must reproduce `MECHANISM > closure > cycle > contested > assurance` exactly as current behaviour, while recording that the precedence is not normative. If A-8 is later decided differently, the result changes with the decision.

## OQ-6 — Mechanism failures: new sub-decision N176-13 (now classified)

The errors split into two classes:

- **input-scoped** (decided once, polynomial): malformed assessment array rejected by `assessEdge`, selector compilation, candidate precheck, graph-builder checks;
- **path-scoped** (NP-hard to detect exhaustively): a policy hook that throws only for particular edges — deciding whether any simple path reaches such an edge is D2 (`oq4` §2).

**Recommended: the compact validity API supports input-scoped mechanism failures only; policy hooks must be total for that API (a throwing hook is a caller/configuration bug, diagnosed at the edge level).** This is an observable difference from the current API and must be recorded in the contract and migration notes, not treated as an internal optimisation.

## OQ-7 — Diagnostics API policy

Who owns the bound, what is returned when it is reached, and is the diagnostics API part of the package-root surface?

**Recommended: caller-owned bound, separate API, explicit "truncated" result; validity is never affected.**

## OQ-8 — Resource target and benchmark acceptance

`k=16` is a **benchmark target**, not a proof of polynomiality: it does not exclude an exponential worst case on other graph families. The current evidence is `k=16` → 65 536 paths / ~2.7 s from a scratch run.

**Recommended: keep `k=16` as the conformance-oriented benchmark target, attach an executed record (date, revision, machine, counts), and state explicitly that the benchmark does not establish a complexity bound. Under R2 (exact but exponential rejection) the target may pass while the worst case remains exponential.**

## OQ-10 — Complexity policy (new; gates OQ-4)

The owner must choose one of the `oq4` §5 options:

- **R1:** Reading A (per-path result normative) — no API break, no NP-hard decision problem, exponential output accepted as an availability risk with any cap outside conformance;
- **R2:** Reading B with exact but exponential rejection search — compact API, worst case exponential, satisfies only the letter of "does not require enumerating all paths" if the owner accepts that reading;
- **R3:** Reading B with walk/state-based rejection semantics — polynomial but **changes observable results** and needs a spec amendment plus corpus revision;
- **R4:** defer N-176, keep it PARTIAL and clarify §8.8's intent in `T18-SPEC-01`.

**No recommendation is made.** R1 is the only option whose contract is complete and provably deterministic today; R2 is the only option that keeps Reading B; R3 trades semantic equivalence for polynomiality; R4 keeps the status honest.

## OQ-9 — Audit consequence

How will N-176 be recorded after implementation?

- Reading B + accepted implementation → N-176 PASS, §8.8 PARTIAL → PASS, via a re-audit revision.
- Reading A → N-176 "conditional not triggered" (not PASS-through-violation); the audit must record that mapping explicitly.

**Recommended: decide the audit wording together with OQ-1, not after implementation.**

---

## What is already settled by the decision-ready revision (no owner choice needed)

- The three-layer result model (L1/L2/L3) and the classification of `acceptedPaths`/`details.perPath` as diagnostics under Reading B (OQ-1 presupposes it).
- The canonical witness is the `pathKey` minimum, not the first DFS path.
- The rejection proof is class-existence based, not a single failing edge.
- The validity API must not be resource-capped; caps belong to diagnostics.
- No new normative error code.
