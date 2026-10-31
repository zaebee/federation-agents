# Decision Recommendation — T18-01

**All decisions remain OPEN.** This file records a recommendation, not an approved decision.

Labels used here: requirement outcomes `REQ-LOCAL`, `REQ-EXTERNAL`, `REQ-NONE`; ownership `OWN-CORE`, `OWN-ADAPTER`; validation `VAL-CORE`, `VAL-ADAPTER`, `VAL-CORE-CONSTRUCTION`; remediation `PATH-A`, `PATH-B`, `PATH-C`.

## 1. Decision references

| ID | Subject | Status |
| --- | --- | --- |
| **T18-DEC-01** | Assessment recording obligation | **OPEN** |
| **T18-DEC-02** | Construction/registration and validation ownership | **OPEN** |

Canonical wording is in `decision-register-proposal.md`.

## 2. Emission ownership and requirement outcomes

### OWN-CORE — Core-owned construction and registration

| Dimension | Assessment |
| --- | --- |
| Normative fit | Compatible with “local assessment” only if the Core receives domain provenance and time explicitly; the Core is not the domain |
| Advantages | One construction/validation path; deterministic; directly testable; AEBE from Core API |
| Disadvantages | New public API; duplicates domain policy inputs; Core has no clock (`temporal.ts`); expands the Core surface |
| Implementation risk | Requires a new API, explicit `assessed_by`/`assessed_at`/profile/method/evidence inputs, and a C-2 model decision |
| Compatibility risk | New API is additive; existing `registerAssessment` remains unless guarded |
| Unresolved | Exact API shape; C-2 model; whether Core may own local policy inputs |

### OWN-ADAPTER — Adapter-owned construction and registration

| Dimension | Assessment |
| --- | --- |
| Normative fit | Strong: §11.1 says “локальная оценка”; §10.1 says `assessed_at` belongs to a specific domain; adapter owns domain identity/time |
| Advantages | Uses public `buildLineageGraph` and `registerAssessment`; no new Core API for registration; adapter can supply provenance |
| Disadvantages | No public validator; adapters can emit malformed objects; C-2 model can diverge; publication is caller-defined |
| Implementation risk | Needs a validation contract (Core validator or adapter validator); needs deterministic ID rules; needs a publication/retention decision |
| Compatibility risk | Low for Core; high for cross-adapter consistency |
| Unresolved | Validation owner; C-2 model; publication mechanism |

### REQ-NONE — No normative emission requirement (DEC-01 outcome, not ownership)

| Dimension | Assessment |
| --- | --- |
| Normative fit | Weak: §11.2 says “Assessment фиксирует”; §11.1 says the local assessment MUST record; §12 repeats |
| Advantages | No implementation change; avoids API growth |
| Disadvantages | Requires a specification clarification/amendment and re-audit; C-1/C-2.a2 remain NOT COVERED |
| Implementation risk | None directly, but conformance remains unresolved |
| Compatibility risk | Changes the meaning of the existing corpus; needs careful review |
| Unresolved | Whether the normative text can be read as not requiring an Assessment at all |

## 3. Validation owner options

| Option | Description | Bypass risk | Required APIs/tests |
| --- | --- | --- | --- |
| **VAL-CORE** | Public `validateContinuityAssessment`; adapter calls it before registration | High unless registration also validates | validator API; valid/malformed tests; AEBE shows use |
| **VAL-ADAPTER** | Adapter implements the field contract; no Core validator | High across adapters; inconsistent | adapter contract tests; AEBE rejection evidence |
| **VAL-CORE-CONSTRUCTION** | Core creates and validates the Assessment; adapter supplies provenance | Low for the new API; old `registerAssessment` remains a bypass unless guarded | construction API; validation tests; guard/deprecate old path |

**Proposal, not approved:** `VAL-CORE` plus validation inside `registerAssessment` (or a validated registration function that guards the old path). A separate validator alone does not prevent bypass.

## 4. Recommendation

- **T18-DEC-01:** recommend **required at the local-assessment level**; status **OPEN**. The obligation is explicit in §11.1/§11.2/§12; the exact shape is partly unspecified.
- **T18-DEC-02:** recommend **`OWN-ADAPTER` plus `VAL-CORE`**, with validation enforced at registration or through a guarded validated-registration API; status **OPEN**. Adapter ownership is a recommendation, not accepted architecture.
- **C-2 model:** recommend **one Assessment per affected lineage edge** for determinism and subject clarity, but this is a proposal only. It remains an explicit specification question; no task may assume it.
- **C-2.a3:** separate CORE-003; no recommendation can close it here.

## 5. Unresolved questions

1. Does “Assessment” in §11.1/§11.2 mean `ContinuityAssessment` specifically?
2. For C-2, is the subject the SCC representative, each node, or the edge child?
3. Which provenance fields are required for C-1/C-2, and who supplies them?
4. Is publication/retention required, or is the returned array sufficient?
5. Should validation be enforced inside `registerAssessment`, or in a new validated-registration API?
6. Does the project accept adapter ownership with a Core validator, or prefer Core construction/validation?
7. Is a specification clarification required for the C-2 model before AEBE?

## 6. Status statement

No decision is approved. DEC-01 and DEC-02 remain OPEN. The recommendation is input for the project owner, not a resolution.
