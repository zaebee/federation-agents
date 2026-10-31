# T18-DEC-16 / T18-DEC-17 — C-2 Subject Model, Assessment Shape and Publication/Retention

**Status: OPEN. Recommendation only. Not approved.**
**Related case:** §12 C-2 / N-143 / `CASE-C-2.a2`.
**Related approved decisions:** `T18-DEC-01` (`REQ-LOCAL`, recording obligation), `T18-DEC-02` (`OWN-ADAPTER` + `VAL-CORE`).
**Related open decisions:** `T18-DEC-13` (grant suppression observability), `T18-DEC-15` (parent coverage), `T18-DEC-17` (publication/retention ownership), `A-14` / issue #65 (cycle breadth in path validation).
**Task 18:** `T18-02B` is blocked only by `T18-DEC-16` (see §8); `T18-DEC-17` is independent and does not block recording.

---

## 1. Decision question

Approved `T18-DEC-01` reads CORE-001 as requiring a local Assessment that records `CYCLE_DETECTED` (§11.2, §12 C-2). It does not say **what that Assessment is about**. Two decisions give that obligation a shape:

| Decision | Question | Sub-parts |
| --- | --- | --- |
| **`T18-DEC-16`** | Is the cycle recorded on the closing edge, on a node, or on the whole strongly connected component, and which values fill the §6.2.1 fields? | 16.a subject model (fixes `subject_version_id`, `parent_version_ids`, `declared_relation`); 16.b shape and provenance (claim list, method fields, construction boundary) |
| **`T18-DEC-17`** | Who persists, publishes and retains the Cycle Assessment? | none — a single boundary question under `T18-DEC-02`'s canonical scope |

They were drafted as one decision with sub-parts 16.a/16.b/16.c. The register has one status per decision, so a partial approval ("model approved, publication still open") was not representable; the split keeps `T18-DEC-16` as the `T18-02B` blocker and `T18-DEC-17` as the publication/retention decision. `T18-02B` cannot start until `T18-DEC-16` is approved; `T18-DEC-17` does not block recording but does block any claim that the evidence is *published* or *retained*.

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
- `T18-DEC-02`: adapter **constructs**; Core **validates** semantically; Core owns **admission** with an immutable registered representation; persistent storage is **caller-managed**; publication and retention remain **OPEN** (`T18-DEC-17`).

**Reading.** Whatever the subject model, the cycle Assessment is constructed by the adapter and admitted by Core, exactly as the C-1 assessment is. The package therefore treats provenance as settled by `T18-DEC-02` and only asks for the model-specific shape. Publication and retention are split into `T18-DEC-17` so that recording does not wait for a storage decision.

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

### Option A — grouped node- and relation-scoped (alternative)

For every node `V` in a cyclic SCC and every `declared_relation` `R` for which `V` has at least one direct parent inside the same SCC, emit one Assessment:

| Field | Value |
| --- | --- |
| `subject_version_id` | `V` |
| `declared_relation` | `R` |
| `parent_version_ids` | the SCC-internal parents of `V` under `R` (fallback), or the complete declared parent set for `(V, R)` (see §7.3) |
| claim | `CYCLE_DETECTED` in `unverified_claims` (recommended; see §7.1) |
| provenance | adapter constructs; `assessment_profile_ref` / `assessment_method_version` / `assessed_by` / `assessed_at` / `evidence_refs` supplied by the caller as in C-1 |

- **Deterministic:** iterate SCCs sorted by their sorted member list; per node iterate relations in canonical order; parents sorted. Emission is a pure function of the graph and the caller's id callback.
- **Schema fit:** no field change; one relation and one subject per record.
- **CORE-003 fit:** every node and every participating parent edge is named, which is exactly the "dependent on this continuity" set that `CASE-C-2.a3` must be able to observe.
- **Cost:** `O(V·R)` records per SCC (small in practice); a two-node mixed-relation cycle yields two records instead of one.
- **Weakness:** §12 C-2's singular "Assessment" becomes N records per cycle. Acceptable if §11.2's "Assessment фиксирует" is read per declaration; the recommended model is Option D.

### Option D — one Assessment per affected lineage edge (recommended)

For every edge `(child → parent)` whose endpoints are both inside the same cyclic SCC, emit one Assessment:

| Field | Value |
| --- | --- |
| `subject_version_id` | child of the edge |
| `declared_relation` | relation of the edge |
| `parent_version_ids` | `[parent of the edge]` |
| claim | `CYCLE_DETECTED` in `unverified_claims` (see §7.1) |
| provenance | adapter constructs; profile/method/by/at/evidence_refs supplied by the caller, as in C-1 |

- **Adopts the earlier recommendation.** The T18-01 package recommended "one Assessment per affected lineage edge" (`decision-packages/T18-01-assessment-emission/decision-recommendation.md` §4, `normative-analysis.md` §2.4). This package does not replace that recommendation; it takes it as Option D and adds the shape, provenance and adversarial analysis the earlier proposal left open.
- **Deterministic:** edges are sorted by `(child, parent, relation)`; no canonical-DFS mechanism is needed.
- **Schema fit:** no field change; one subject, one relation and one parent per record.
- **CORE-003 fit:** each record names exactly one participating declaration edge, so grant suppression can be mapped per declaration without expanding a grouped parent array.
- **Cost:** `|E(SCC)|` records, bounded by the component's internal edge count; a two-node mixed-relation cycle yields two records.
- **Weakness:** this is the most records of the fixed-schema models, and §12 C-2's singular "Assessment" becomes several records per cycle. That is the same granularity the earlier package recommended and is acceptable under the per-declaration reading of §11.2.

**Why not Option A?** A grouped `(node, relation)` record is defensible and yields fewer records, but it nominally covers several edges at once and needs the still-OPEN `T18-DEC-15` parent-set question settled for its `parent_version_ids`. The per-edge model keeps each claim tied to exactly one declaration and preserves the recommendation already on record.

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

| Criterion | D (per edge, recommended) | A (node/relation) | B (closing edge) | C (component) |
| --- | --- | --- | --- | --- |
| Fits §6.2.1 schema unchanged | yes | yes | yes | **no** |
| Deterministic without new mechanism | yes | yes | **no** (needs canonical-DFS mechanism) | yes |
| Records every participating declaration | yes | yes | no | yes (as members) |
| CORE-003 observability of dependent grants | strongest (edge-precise) | strong | weak | strong |
| Records per cycle | `\|E(SCC)\|` | N (node·relation) | 1 | 1 |
| Aligns with the T18-01 recommendation | yes | no | partly | no |
| §12 singular "Assessment" reading | strained (many records) | strained | strong | strong |

---

## 5. Adversarial cases

| Case | Option D (per edge, recommended) | Option A | Option B | Option C |
| --- | --- | --- | --- | --- |
| Two-node cycle with mixed relations (`A CONTINUATION B`, `B FORKED_FROM A`) | two records, one per edge: `(A, CONTINUATION, [B])`, `(B, FORKED_FROM, [A])` | two records: `(A, CONTINUATION, [B])`, `(B, FORKED_FROM, [A])` | one back edge from canonical DFS, loses the other relation | one record, relation undefined |
| Three-node cycle `A→B→C→A` (edges `B→A`, `C→B`, `A→C`) | three records: `(B, R, [A])`, `(C, R, [B])`, `(A, R, [C])` | three records, each naming its SCC parent | one back edge | one record |
| Two disjoint cycles | two SCCs; one record per internal edge of each | two SCCs, records per SCC | per SCC | per SCC |
| SCC with several internal cycles | every internal edge gets one record; no multiplicity ambiguity | all nodes/relations covered | several back edges, multiplicity unclear | one record, loses structure |
| Node with both SCC-internal and external parents | only the SCC-internal edge gets a record; the external-parent edge is not cyclic, so it is not recorded by C-2 | §7.3 sub-decision: SCC-internal only vs complete declared set | back-edge parent only | members only |
| Path traverses a cyclic node without using a cycle edge (A-14) | graph-level per-edge records exist for the cycle edges; the acyclic path gets none and binding-level rejection is unchanged | graph-level Assessment exists; binding-level rejection unchanged | no Assessment on that path, but the SCC is still cyclic — model and A-14 diverge | same as A |
| New declaration closes a cycle among existing nodes | rebuilt graph → new SCC; adapter invoked on the new snapshot; earlier Assessments are historical and not rewritten | same | same | same |
| A cycle can never be undone (edges immutable, declarations never deleted) | claim monotone; supersession not needed for structural facts | claim monotone; supersession not needed | same | same |
| Self-loop preserved by the structural builder (invalid per §5.2) | one-node SCC; one record `(V, R, [V])`; §7.5 sub-decision | one-node SCC; `(V, R, [V])` record | no back edge distinct from forward edge | one record |
| Duplicate emission on repeated invocation with admitted records | Core rejects duplicate `assessment_id` (existing admission rule); caller passes `existing` | same | same | same |
| `CYCLE_DETECTED` also present in `verified_claims` | rejected by the #49 overlap/claim rule; adapter sets unverified only | same | same | same |

---

## 6. Interaction with approved and open decisions

| Decision | Interaction |
| --- | --- |
| `T18-DEC-01` (approved) | Establishes the recording obligation this decision gives shape to |
| `T18-DEC-02` (approved) | Adapter constructs, Core validates/admits, storage caller-managed; 16.b (shape) and `T18-DEC-17` (publication/retention) must reference the canonical scope statement, not paraphrase it |
| `T18-DEC-13` (OPEN) | CORE-003 observes grant suppression; Option D gives it the exact participating edge set. C-2 case remains BLOCKED on `CASE-C-2.a3` regardless of 16.a |
| `T18-DEC-15` (OPEN) | Determines whether `parent_version_ids` is the complete declared parent set or the covered subset; 16.b must state which reading the cycle model uses as a **local disposition**, and must not claim it is normative |
| A-14 / #65 | Cycle breadth in **path validation**; graph-level recording here does not resolve it, and vice versa |

---

## 7. Recommended resolution and open sub-decisions

**Recommendation: Option D** — one Assessment per affected lineage edge inside a cyclic SCC (`subject_version_id` = edge child, `parent_version_ids` = `[edge parent]`, `declared_relation` = edge relation), claim `CYCLE_DETECTED` unverified, constructed by the adapter, admitted by Core, persisted by the caller.

Rationale: it adopts the T18-01 recommendation rather than replacing it; no schema change; deterministic by sorted edge order without a new mechanism; each record names exactly one participating declaration, so the claim is edge-precise for CORE-003; and the record count is bounded by the component's internal edge count. Option A is the fallback if the owner prefers fewer records; it was reconsidered as the primary and rejected because one grouped record nominally covers several edges and depends on the OPEN `T18-DEC-15` parent-set question. Option B requires a new canonical-DFS mechanism and loses non-back-edge declarations; Option C needs a `T18-SPEC-01` schema amendment.

### 7.1 Claim polarity (sub-decision)

- **Recommended:** `unverified_claims: ['CYCLE_DETECTED']`, symmetric with the approved C-1 emission (`unverified_claims: ['PARENT_UNRESOLVED']`).
- **Alternative:** `verified_claims` when the domain's `assessment_method_version` names the mechanical SCC computation. This is defensible in the §6.2.2 sense ("подтверждённые в рамках указанной методики"), but it asserts an epistemic status the current evidence does not carry: no evidence refs describe the graph snapshot.
- The specification does not settle this. Whatever the choice, `unverified` is the conservative option and does not prevent `CASE-C-2.a2` ("Assessment records `CYCLE_DETECTED`").

### 7.2 Subject identity and ids

- `assessment_id` remains caller-generated through the adapter callback, as in C-1 (`assessmentIdFor(relation, parents)` generalised to `(subject, relation, parent)` for Option D).
- The callback must be injective across the emitted set; duplicate ids are rejected by Core admission. The adapter does not invent an id scheme.

### 7.3 Parent coverage (interacts with `T18-DEC-15`)

- **Recommended local disposition:** `parent_version_ids` = `[edge parent]` — exactly the parent of the assessed edge, so the claim is about that declaration and nothing else. For the Option A fallback the list would be the subject's SCC-internal parents under the relation.
- **Tension with `T18-DEC-15`:** C-1 used the complete declared parent set as a local Option B disposition. A domain that reads `parent_version_ids` uniformly may expect the same rule here; the per-edge record uses the covered-subset reading.
- Because `T18-DEC-15` is OPEN, either choice must be recorded as a **local disposition**, not a normative reading.
- **Scope of a `T18-DEC-16` approval:** approving the decision permits the local Option D implementation; it does **not** make the subset reading of `parent_version_ids` normative for CORE-001. `T18-DEC-15` remains OPEN, and its later resolution may require a different `parent_version_ids` rule for the same records.

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
- A-14/#65 remains a separate open decision (cycle breadth in path validation); it is not resolved by this model.

### 7.7 Publication and retention ownership (`T18-DEC-17`)

`T18-DEC-02`'s canonical scope already states: adapter constructs, Core validates and admits, the registered representation is immutable, persistent storage is caller-managed, and publication/retention remain OPEN. `T18-DEC-17` decides the remaining half — who publishes and who retains.

- **What the implementation can and cannot do.** Core returns a frozen admitted array and holds no store; the core has no I/O imports and no record lifecycle. Making Core publish or retain would turn it into a storage service, which is outside the approved `T18-DEC-02` boundary and outside CORE-001's scope.
- **Options.** (a) the caller boundary (domain/adapter caller) owns persistence, publication and retention, and the Core contract ends at the immutable admitted representation; (b) Core gains a publication API and retention policy — a `T18-SPEC-01` boundary change; (c) publication is out of scope and only the returned representation exists — acceptable only if no document claims the evidence is published or retained.
- **Recommended:** (a). It is the only option implementable without changing the approved `T18-DEC-02` scope; the caller records what it is willing to publish and for how long, and the AEBE states what was persisted.
- **What this does not settle:** whether any boundary MUST retain (no such CORE-001 obligation was found), for how long, or whether a publication registry exists. Those remain OPEN under `T18-DEC-17` and cannot be inferred from a `T18-DEC-16` approval.
- **Why it does not block recording:** the §11.2 recording obligation attaches to producing the Assessment; publication and retention concern the evidence trail around it.

---

## 8. Why `T18-02B` is blocked, and what unblocks it

`T18-02B` (C-2.a2 adapter emission + Core validation) needs:

1. **`T18-DEC-16` approved** (subject model and shape/provenance). Publication/retention ownership (`T18-DEC-17`) may remain OPEN for recording but blocks publication/retention claims.
2. **The contextual admission path** for `CYCLE_DETECTED`, mirroring C-1: the generic guard at `src/core/assessment.ts:60` rejects the claim on every path while C-2 is blocked; the approved model turns it into "rejected on the generic path, admitted only through the cycle path".
3. **AEBE from the adapter boundary** (package root, not a hand-constructed fixture), as `T18-02A` did for C-1, with Core validation and admission evidence.

Closure evidence for `T18-DEC-16`: approval recorded in `decision-register.md`, the chosen subject model and shape recorded, `T18-02B` unblocked with the model and shape named in the roadmap, and an AEBE step attached to `T18-13`. Closure evidence for `T18-DEC-17`: an explicit boundary statement for storage, publication and retention, with the AEBE saying what is persisted. Task 17 statuses change only through a re-audit revision, not here.

---

## 9. Limits of this package

- It recommends; it does not approve. No wording here is normative.
- It does not change `docs/CORE-001.md`, Task 17 statuses, the disposition matrix, `T18-02A`, `T18-DEC-13`, `T18-DEC-15` or `T18-DEC-17`.
- It does not implement `T18-02B` and does not pre-approve an adapter API shape beyond the C-1 precedent.
- Option B's canonical-DFS mechanism would need its own documentation and tests; the package does not specify its exact ordering rules beyond "sorted nodes, sorted adjacency, DFS from the smallest node", because that mechanism is only relevant if the owner rejects Option D.
