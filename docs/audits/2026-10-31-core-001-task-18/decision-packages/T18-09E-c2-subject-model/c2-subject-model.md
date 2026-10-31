# T18-DEC-16 — C-2 Subject Model, Assessment Shape and Publication/Retention

**Status: OPEN. Recommendation only. Not approved.**
**Related case:** §12 C-2 / N-143 / `CASE-C-2.a2`.
**Related approved decisions:** `T18-DEC-01` (`REQ-LOCAL`, recording obligation), `T18-DEC-02` (`OWN-ADAPTER` + `VAL-CORE`).
**Related open decisions:** `T18-DEC-13` (grant suppression observability), `T18-DEC-15` (parent coverage), `A-14` / issue #65 (cycle breadth in path validation).
**Task 18:** `T18-02B` is blocked only by this decision (see §8).

---

## 1. Decision question

Approved `T18-DEC-01` reads CORE-001 as requiring a local Assessment that records `CYCLE_DETECTED` (§11.2, §12 C-2). It does not say **what that Assessment is about**. `T18-DEC-16` has three named sub-parts:

| Sub-part | Question | Why it is one decision |
| --- | --- | --- |
| **16.a Subject model** | Is the cycle recorded on the closing edge, on a node, or on the whole strongly connected component? | Fixes `subject_version_id`, `parent_version_ids` and `declared_relation` |
| **16.b Shape and provenance** | Which values fill the §6.2.1 fields, which claim list receives `CYCLE_DETECTED`, and which boundary constructs the record? | Follows from 16.a; must satisfy the §6.2.2 claim split |
| **16.c Publication and retention** | Who persists, publishes and retains the cycle Assessment? | `T18-DEC-02` leaves persistent storage caller-managed while publication and retention stay OPEN |

`T18-02B` (C-2.a2 adapter emission) cannot start until 16.a and 16.b are approved; 16.c does not block recording but does block any claim that the evidence is *published* or *retained*.

---

## 2. Normative evidence

### 2.1 §11.2 Cycle Detection (`docs/CORE-001.md:1051-1064`)

> Локальный граф MUST быть проверен на циклические связи.
>
> При обнаружении цикла:
> - исходные декларации сохраняются;
> - Assessment фиксирует `CYCLE_DETECTED`;
> - цикл не принимается как корректное доказательство преемственности;
> - домен MUST NOT применять зависимые от такой преемственности гранты;
> - домен MAY продолжить обработку сообщений в режиме Read-Only или Non-Consequential Interaction, если это разрешено локальной политикой.

**Reading.** The trigger is graph-level ("локальный граф MUST быть проверен"), not path-level. The recording obligation is stated with the indefinite subject "Assessment", and the consequence is about grants that depend on the continuity of the cyclic declarations. The text does not choose edge, node or component.

### 2.2 §12 C-2 case (`docs/CORE-001.md:1409-1428`)

> **C-2. Cycle Detection.** Preconditions: в графе обнаружен цикл `V1 → V2 → V1`. Input: получена декларация, замыкающая цикл. Expected Result: Assessment фиксирует `CYCLE_DETECTED`; зависимые от преемственности Grants не применяются; домен MAY разрешить Read-Only взаимодействие. Forbidden Side Effects: система не аварийно завершается; участники не удаляются глобально; исторические декларации не стираются.

**Reading.** Two readings compete:

- the **declaration that closes the cycle** is the input, which suggests an edge subject;
- the **graph-level detection** in §11.2, which suggests a component- or node-level record.

"Получена декларация, замыкающая цикл" is receipt-order language. §8.8 (`docs/CORE-001.md:848-871`) forbids an evaluation result that depends on declaration arrival order, so "the edge whose arrival closed the cycle" cannot be adopted literally without becoming order-dependent. Any edge-based model has to define the closing edge structurally, not temporally.

### 2.3 Assessment shape and claim semantics (§6.2.1, §6.2.2; `docs/CORE-001.md:546-597`)

- A `ContinuityAssessment` has exactly one `subject_version_id`, one `declared_relation` from `LineageRelationType`, a `parent_version_ids` array, and the claim lists.
- `verified_claims` "содержит Claims, подтверждённые в рамках указанной методики и доступных доказательств".
- `unverified_claims` "содержит Claims, которые не подтверждены, не проверены или не могут быть приняты в рамках указанной оценки".
- `CYCLE_DETECTED` is one of the enumerated example claims.
- Absence from `verified_claims` must not be read as confirmation.

**Reading.** The schema cannot express a *set of nodes* as a subject and cannot express a *mixed relation set*: one `subject_version_id` and one `declared_relation` are mandatory. A component-scoped model therefore needs a schema change (or an artificial anchor), while edge- and node-scoped models fit the existing schema.

### 2.4 Approved boundary (`T18-DEC-01`, `T18-DEC-02`)

- `T18-DEC-01`: the recording obligation exists and does not by itself assign construction or publication to Core.
- `T18-DEC-02`: adapter **constructs**; Core **validates** semantically; Core owns **admission** with an immutable registered representation; persistent storage is **caller-managed**; publication and retention remain **OPEN**.

**Reading.** Whatever the subject model, the cycle Assessment is constructed by the adapter and admitted by Core, exactly as the C-1 assessment is. The package therefore treats provenance as settled by `T18-DEC-02` and only asks for the model-specific shape.

### 2.5 What the specification does not define

1. Whether the cycle subject is an edge, a node or a component.
2. Whether every declaration participating in a cycle gets its own Assessment or only a closing one.
3. Whether the claim is `verified` (the local domain mechanically computed the SCC) or `unverified` (a structural condition the domain records but does not claim to have "verified" in the evidence sense).
4. What `parent_version_ids` means for a cycle: the complete declared parent set of the subject (`T18-DEC-15` OPEN) or only the parents that participate in the cycle.
5. How overlapping cycles inside one SCC are represented and counted.
6. Whether a self-loop from a structurally built graph (invalid per §5.2, but preserved by the structural builder) is a one-node SCC for this purpose.

---

## 3. Current implementation behaviour (`2d26d43`)

| Layer | Behaviour | Location |
| --- | --- | --- |
| Graph | sorted strongly connected components, declarations preserved | `src/core/lineage.ts:356` |
| Phase 2 | `CYCLE_DETECTED` when any node of a path is in a cyclic SCC; cycle set = union of touched components | `src/core/traversal.ts:423` (`buildCycleIndex`), `:490` (`cycleForPath`) |
| Phase 3 / binding | per-path results; `evaluateBinding` aggregates and preserves `CYCLE_DETECTED` in `details.perPath` | `src/core/traversal.ts` aggregation |
| Admission | generic validator rejects `CYCLE_DETECTED` in either claim list while C-2 is blocked (change from #49) | `src/core/assessment.ts:60` (`BLOCKED_ASSESSMENT_CLAIMS`), `:66` (`claimListsFailure`) |
| C-1 precedent | adapter constructs a declaration-scoped Assessment; Core validates contextually and admits | `src/adapters/orphan-assessment.ts:109`; `src/core/assessment.ts:645` (`validateOrphanClaims`), `:804` (`registerOrphanAssessments`) |
| C-2 evidence | no Assessment records the claim; conformance test is a `todo` | `tests/conformance/c.test.ts:66` |

**Consequences for `T18-02B`.** Two implementation facts must change: (i) an adapter method that emits cycle Assessments, and (ii) a contextual admission path that admits `CYCLE_DETECTED` only through the approved model, mirroring the C-1 path. The generic guard may not simply be deleted: it is what keeps an arbitrary caller from injecting the claim on any path. This is an implementation consequence of approving `T18-DEC-16`, not a second decision.

---

## 4. Candidate subject models

### Option A — node- and relation-scoped (recommended)

For every node `V` in a cyclic SCC and every `declared_relation` `R` for which `V` has at least one direct parent inside the same SCC, emit one Assessment:

| Field | Value |
| --- | --- |
| `subject_version_id` | `V` |
| `declared_relation` | `R` |
| `parent_version_ids` | the SCC-internal parents of `V` under `R` (recommended), or the complete declared parent set for `(V, R)` (see §7.3) |
| claim | `CYCLE_DETECTED` in `unverified_claims` (recommended; see §7.1) |
| provenance | adapter constructs; `assessment_profile_ref` / `assessment_method_version` / `assessed_by` / `assessed_at` / `evidence_refs` supplied by the caller as in C-1 |

- **Deterministic:** iterate SCCs sorted by their sorted member list; per node iterate relations in canonical order; parents sorted. Emission is a pure function of the graph and the caller's id callback.
- **Schema fit:** no field change; one relation and one subject per record.
- **CORE-003 fit:** every node and every participating parent edge is named, which is exactly the "dependent on this continuity" set that `CASE-C-2.a3` must be able to observe.
- **Cost:** `O(V·R)` records per SCC (small in practice); a two-node mixed-relation cycle yields two records instead of one.
- **Weakness:** §12 C-2's singular "Assessment" becomes N records per cycle. Acceptable if §11.2's "Assessment фиксирует" is read per declaration; the alternative is Option B.

### Option B — canonical closing edge

Emit one Assessment per *back edge* of a canonical traversal of each SCC (deterministic DFS from the smallest node with sorted adjacency):

| Field | Value |
| --- | --- |
| `subject_version_id` | child of the back edge |
| `declared_relation` | relation of the back edge |
| `parent_version_ids` | `[parent of the back edge]` |
| claim | `CYCLE_DETECTED`, unverified (recommended) |

- **Matches the singular reading** of §12 C-2 ("декларация, замыкающая цикл") and yields the fewest records.
- **Deterministic only by mechanism:** "closing" has to be defined as "back edge of a canonical DFS", which the specification does not define. This is the same class of mechanism as `uia-ref-selector@1` and would need a mechanism label and documentation.
- **Weak CORE-003 fit:** a cycle's non-back edges are participating declarations too; a grant attached to them is indistinguishable from a grant on a back edge without recomputing the SCC. It also conflicts with the current binding-level breadth (A-14): a path through a cyclic node is rejected even when it uses no back edge.
- **Ambiguous multiplicity:** an SCC with several cycles has several back edges; "one Assessment per cycle" is ill-defined.

### Option C — component-scoped

One Assessment per SCC, with an anchor subject and all members in `parent_version_ids`.

- **Matches §11.2's graph-level trigger** and is the natural unit for CORE-003.
- **Requires a specification/schema change:** `subject_version_id` must be a single node (anchor choice is artificial) and `declared_relation` must be a single relation while an SCC can mix relations. This cannot be implemented without a `T18-SPEC-01` amendment.
- **Not recommended before such an amendment.**

### Comparison

| Criterion | A (node/relation) | B (closing edge) | C (component) |
| --- | --- | --- | --- |
| Fits §6.2.1 schema unchanged | yes | yes | **no** |
| Deterministic without new mechanism | yes | **no** (needs canonical-DFS mechanism) | yes |
| Records every participating declaration | yes | no | yes (as members) |
| CORE-003 observability of dependent grants | strong | weak | strong |
| Records per cycle | N | 1 | 1 |
| §12 singular "Assessment" reading | strained | strong | strong |

---

## 5. Adversarial cases

| Case | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Two-node cycle with mixed relations (`A CONTINUATION B`, `B FORKED_FROM A`) | two records: `(A, CONTINUATION, [B])`, `(B, FORKED_FROM, [A])` | one back edge from canonical DFS, loses the other relation | one record, relation undefined |
| Three-node cycle `A→B→C→A` | three records, each naming its SCC parent | one back edge | one record |
| Two disjoint cycles | two SCCs, records per SCC | per SCC | per SCC |
| SCC with several internal cycles | all nodes/relations covered | several back edges, multiplicity unclear | one record, loses structure |
| Node with both SCC-internal and external parents | §7.3 sub-decision: SCC-internal only vs complete declared set | back-edge parent only | members only |
| Path traverses a cyclic node without using a cycle edge (A-14) | graph-level Assessment exists; binding-level rejection unchanged | no Assessment on that path, but the SCC is still cyclic — model and A-14 diverge | same as A |
| New declaration closes a cycle among existing nodes | rebuilt graph → new SCC; adapter invoked on the new snapshot; earlier Assessments are historical and not rewritten | same | same |
| A cycle can never be undone (edges immutable, declarations never deleted) | claim monotone; supersession not needed for structural facts | same | same |
| Self-loop preserved by the structural builder (invalid per §5.2) | one-node SCC; `(V, R, [V])` record; §7.5 sub-decision | no back edge distinct from forward edge | one record |
| Duplicate emission on repeated invocation with admitted records | Core rejects duplicate `assessment_id` (existing admission rule); caller passes `existing` | same | same |
| `CYCLE_DETECTED` also present in `verified_claims` | rejected by the #49 overlap/claim rule; adapter sets unverified only | same | same |

---

## 6. Interaction with approved and open decisions

| Decision | Interaction |
| --- | --- |
| `T18-DEC-01` (approved) | Establishes the recording obligation this decision gives shape to |
| `T18-DEC-02` (approved) | Adapter constructs, Core validates/admits, storage caller-managed; 16.b/16.c must reference the canonical scope statement, not paraphrase it |
| `T18-DEC-13` (OPEN) | CORE-003 observes grant suppression; Option A gives it the full node/edge subject set. C-2 case remains BLOCKED on `CASE-C-2.a3` regardless of 16.a |
| `T18-DEC-15` (OPEN) | Determines whether `parent_version_ids` is the complete declared parent set or the covered subset; 16.b must state which reading the cycle model uses as a **local disposition**, and must not claim it is normative |
| A-13 / #64 | Selector wildcard policy; unrelated to the subject model |
| A-14 / #65 | Cycle breadth in **path validation**; graph-level recording here does not resolve it, and vice versa |
| A-15 / #66-#67 | Digest verification boundary; unrelated |

---

## 7. Recommended resolution and open sub-decisions

**Recommendation: Option A** — one Assessment per `(SCC node, declared_relation)` with at least one SCC-internal parent under that relation, claim `CYCLE_DETECTED` unverified, constructed by the adapter, admitted by Core, persisted by the caller.

Rationale: no schema change, no new mechanism, deterministic under §8.8, mirrors the approved C-1 adapter/Core precedent, and gives CORE-003 the complete dependent set. Option B is the fallback if the spec editor insists on the singular "closing declaration" reading; it then requires a documented canonical-DFS mechanism and a justification that the non-back edges' grants can be observed by CORE-003 another way. Option C is deferred until `T18-SPEC-01` can change the Assessment schema.

### 7.1 Claim polarity (sub-decision)

- **Recommended:** `unverified_claims: ['CYCLE_DETECTED']`, symmetric with the approved C-1 emission (`unverified_claims: ['PARENT_UNRESOLVED']`).
- **Alternative:** `verified_claims` when the domain's `assessment_method_version` names the mechanical SCC computation. This is defensible in the §6.2.2 sense ("подтверждённые в рамках указанной методики"), but it asserts an epistemic status the current evidence does not carry: no evidence refs describe the graph snapshot.
- The specification does not settle this. Whatever the choice, `unverified` is the conservative option and does not prevent `CASE-C-2.a2` ("Assessment records `CYCLE_DETECTED`").

### 7.2 Subject identity and ids

- `assessment_id` remains caller-generated through the adapter callback, as in C-1 (`assessmentIdFor(relation, parents)` generalised to `(subject, relation, parents)`).
- The callback must be injective across the emitted set; duplicate ids are rejected by Core admission. The adapter does not invent an id scheme.

### 7.3 Parent coverage (interacts with `T18-DEC-15`)

- **Recommended local disposition:** `parent_version_ids` = the subject's SCC-internal parents under the declared relation. The claim is about cycle participation, so listing a non-cyclic parent would assert something the claim is not about.
- **Consistency argument against:** C-1 used the complete declared parent set as a local Option B disposition. A domain that reads `parent_version_ids` uniformly may expect the same rule here.
- Because `T18-DEC-15` is OPEN, either choice must be recorded as a **local disposition**, not a normative reading.

### 7.4 Emission trigger and idempotency

- The adapter is caller-invoked on a graph snapshot (mirroring C-1: one call per batch, `existing` passed in). Core owns admission; persistence is caller-managed.
- Repeated emission with the same `existing` set is rejected by the duplicate-`assessment_id` rule; there is no automatic re-emission, no background trigger and no retention policy in Core.

### 7.5 Self-loop handling

- §5.2 rejects a self-parent (`ERR_INVALID_RELATION`), so a conforming descriptor cannot create a self-loop. `buildLineageGraph` is deliberately structural and can preserve such a declaration if it bypassed descriptor validation.
- Recommended: the model treats a self-loop as a one-node SCC and emits `(V, R, [V])`; the descriptor-level rejection remains the caller precondition. The alternative — silently ignore self-loops — would hide a structural conflict that §11.2 asks to record.

### 7.6 What approval does not close

- `CASE-C-2.a3` (grant suppression) stays BLOCKED on CORE-003 / `T18-DEC-13`.
- The C-2 **case** stays BLOCKED even after `N-143`/`CASE-C-2.a2` pass.
- `N-168` (§16 readiness) is unaffected.
- A-14/#65 and A-13/#64 remain separate open decisions.

---

## 8. Why `T18-02B` is blocked, and what unblocks it

`T18-02B` (C-2.a2 adapter emission + Core validation) needs:

1. **This decision approved** (16.a/16.b; 16.c may remain OPEN for recording but blocks publication/retention claims).
2. **The contextual admission path** for `CYCLE_DETECTED`, mirroring C-1: the generic guard at `src/core/assessment.ts:60` rejects the claim on every path while C-2 is blocked; the approved model turns it into "rejected on the generic path, admitted only through the cycle path".
3. **AEBE from the adapter boundary** (package root, not a hand-constructed fixture), as `T18-02A` did for C-1, with Core validation and admission evidence.

Closure evidence for `T18-DEC-16`: approval recorded in `decision-register.md`, the chosen sub-part resolutions recorded, `T18-02B` unblocked with the model and shape named in the roadmap, and an AEBE step attached to `T18-13`. Task 17 statuses change only through a re-audit revision, not here.

---

## 9. Limits of this package

- It recommends; it does not approve. No wording here is normative.
- It does not change `docs/CORE-001.md`, Task 17 statuses, the disposition matrix, `T18-02A`, `T18-DEC-13` or `T18-DEC-15`.
- It does not implement `T18-02B` and does not pre-approve an adapter API shape beyond the C-1 precedent.
- Option B's canonical-DFS mechanism would need its own documentation and tests; the package does not specify its exact ordering rules beyond "sorted nodes, sorted adjacency, DFS from the smallest node", because that mechanism is only relevant if the owner rejects Option A.
