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

## OQ-4 — Is a polynomial class-existence proof sufficient rejection evidence?

The proposal: per-class reachability + one witness per returned class, with the compatibility precedence of §4. The alternative is an explicit witness path set, which reintroduces enumeration.

**Recommended: accept the polynomial proof shape**, with an oracle property test against full enumeration on small graphs.

## OQ-5 — Does A-8 stay OPEN, with the current precedence as an implementation rule?

**Recommended: yes.** The compact implementation must reproduce `MECHANISM > closure > cycle > contested > assurance` exactly as current behaviour, while recording that the precedence is not normative. If A-8 is later decided differently, the result changes with the decision.

## OQ-6 — Mechanism failures: new sub-decision N176-13

May policy hooks be assumed total (a throwing hook is a caller bug, diagnosed once), or must a mechanism failure on any path remain path-faithful? The latter can require enumeration (simple-path-through-edge existence is not polynomial in general).

**Recommended: input-scoped mechanism failures only; policy hooks are total for the compact validity API; a throwing hook is rejected at configuration/edge level, not by path search.** This must be recorded explicitly, because it is an observable difference from the current implementation.

## OQ-7 — Diagnostics API policy

Who owns the bound, what is returned when it is reached, and is the diagnostics API part of the package-root surface?

**Recommended: caller-owned bound, separate API, explicit "truncated" result; validity is never affected.**

## OQ-8 — Resource target and benchmark acceptance

What must the compact validity path handle without path-proportional memory? The current evidence is `k=16` → 65 536 paths / ~2.7 s from a scratch run.

**Recommended: accept `k=16` as the conformance-oriented target for the benchmark procedure, attach an executed record (date, revision, machine, counts), and document the larger case as an availability note, not a conformance requirement.**

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
