# T18-09F — Owner Decision Summary

**Status:** decision support. `T18-DEC-18` is **not registered or approved** by this document.

## Decisions required

| # | Decision | Options | Recommendation (not approved) | Consequence if alternative |
| --- | --- | --- | --- | --- |
| OD-1 | Reading of §8.8 `MUST NOT` | R1 (per-path output normative) / R2 (validity normative, enumeration diagnostic) / R3 (changed walk semantics) / R4 (defer) | R2, conditional on D5 or a non-canonical witness | R1: N-176 not triggered, API unchanged, exponential risk accepted. R3: unnecessary unless semantics cannot be preserved (current analysis says they can). R4: N-176 stays PARTIAL. |
| OD-2 | API strategy | replace `BindingResult` / versioned compact API / defer | versioned compact API | Replace breaks B-3/B-4/B-6 and all callers; defer leaves N-176 PARTIAL. |
| OD-3 | Accepted witness | `pathKey`-minimum (D5) / deterministic non-minimum / any valid path / none | `pathKey`-minimum if D5 closes; otherwise an explicit deterministic-non-minimum or any-valid choice | Any valid path weakens determinism evidence; none drops L2 acceptance evidence. |
| OD-4 | Rejection witness sufficiency | class-existence proof / first failing path / all failing paths | class-existence proof (polynomial D4) | First failing path depends on traversal order; all failing paths is exponential. |
| OD-5 | A-8 aggregation order in compact API | preserve current order / redefine | preserve current order as implementation compatibility rule | Redefining changes observable top-level codes. |
| OD-6 | A-14 cycle witness scope | minimal existence witness / per-path `cycleForPath()` union / global union | minimal existence witness; legacy per-path union only in v1 diagnostics | Promising per-path or global union without implementing it would be a false equivalence claim. |
| OD-7 | Mechanism classes | preserve D6a pre-discovery + D6b edge-evaluation / simplify | preserve the split | Simplifying may report MECHANISM when current code reports cycle, or omit pre-discovery failures. |
| OD-8 | No-path rejection evidence | reachability recheck / cut certificate | reachability recheck in v2; cut certificate as a future addition | A cut certificate is independently verifiable but requires additional implementation and format. |
| OD-9 | Authority-mismatch evidence | precheck facts / code only | precheck facts (target vs candidate participant, selector, scheme, label) | Code-only evidence is not independently verifiable. |
| OD-10 | Diagnostics cap | caller-owned with explicit truncation / fixed default / none | caller-owned, optional, never affects validity | A cap in validity violates §8.8 determinism. |
| OD-11 | Benchmark target | record only / set threshold | record only | A threshold becomes a contractual performance target not supported by proof. |
| OD-12 | N-176 audit wording | PARTIAL until decision / FAIL | PARTIAL until decision | FAIL would assert a violation before the conditional is resolved. |

## Consequences of each alternative (Reading A vs B)

- **Reading A (R1):** `acceptedPaths` and `perPath` are normative. N-176's conditional does not apply; no API change; exponential output remains an explicit availability risk accepted by the owner. Conformance corpus unchanged.
- **Reading B (R2):** validity is normative; enumeration is diagnostic. Requires versioned compact API, corpus additions, and closure of D5 or acceptance of a non-canonical witness. Satisfies N-176 if an equivalent computation is shown.
- **Reading R3:** not recommended. Current analysis (Lemmas 1–6) shows validity can be computed without enumerating all paths; R3 is only needed if that analysis is shown to be wrong.
- **Reading R4:** leaves N-176 PARTIAL; no implementation; exponential risk unaddressed.

## D5 status

D5 is **OPEN**. The greedy witness is a proof sketch with three open obligations: written proof for the exact `pathKey` encoding (including `\u0000`/`\u0001`), oracle tests, and invariance tests. In particular, same-candidate `pathKey` injectivity for distinct paths is **not proven**; the oracle must enumerate pairs of distinct paths and record any collision. See `complexity-proof.md` §9. No implementation should depend on D5 until it is closed or the owner explicitly chooses "any valid witness" as L2 evidence.

## Evidence index

- Normative: `docs/CORE-001.md` §§8.4, 8.6, 8.7, 8.8.
- Implementation: `src/core/traversal.ts` (post-#24).
- Conformance: B-3, B-4, B-6 in `tests/conformance/b.test.ts`.
- Audit: N-176, audit revision 1; A-8, A-14.
- Package: `decision-ready-revision.md`, `complexity-proof.md`, `equivalence-matrix.md`, `api-migration.md`, `benchmark-record.md`, `oq4-complexity-adversarial-pass.md`.

## What this summary does not do

- Does not approve or register `T18-DEC-18`.
- Does not resolve A-8 or A-14.
- Does not change any status file, register, or specification.
- Does not authorise implementation.