# UIA — Product Requirements Document

**Document status:** Working Draft — not approved. This document does not define normative protocol behavior; `docs/CORE-001.md` does.
**Project:** Universal Identity Architecture
**Version:** 0.1
**Date:** 2026-10-30

---

## 1. Product vision

Build an open, composable protocol foundation for identity, provenance, and independently governed trust in federated environments.

UIA should make it possible for independently operated participants — humans, AI agents, services, and external systems — to establish persistent identities, publish immutable identity versions, declare their provenance, and allow independent domains to evaluate and recognize them without relying on a universal authority.

The system should make trust decisions explainable and preserve the distinction between what is declared, what is verified, what is accepted, and what is authorized.

### Vision statement

**A federation where participants can establish identity and demonstrate provenance without requiring everyone to trust the same authority.**

### 1.1. Positioning

**UIA — identity without central authority.**
A protocol foundation for verifiable provenance and independently governed trust across federated systems.

| Concern    | Question                     |
| ---------- | ---------------------------- |
| Identity   | Who is the participant?      |
| Provenance | Where did this version come from? |
| Assessment | What can be verified?        |
| Acceptance | What does this domain recognize? |
| Authority  | What is explicitly permitted? |

**Working assumption:** UIA is a general identity protocol for any kind of participant in federated systems. AI agents are the first and most demanding use case, not the definition of the protocol.

This assumption is a product decision to be confirmed, not a normative requirement.

## 2. Problem statement

The emerging agent ecosystem is increasingly distributed.

Agents can be created by different organizations, run on different infrastructures, use different models, change their implementations, delegate work, fork into independent instances, or merge capabilities and responsibilities through external processes.

Existing identity and authentication systems do not, by themselves, provide a complete model for these relationships.

In particular, the following concerns are often conflated:

- Identity and execution instance.
- Identity continuity and identity similarity.
- Provenance declaration and verified provenance.
- Cryptographic authentication and factual truth.
- Trust assessment and normative acceptance.
- Identity relationships and authority delegation.
- Historical validity and future authorization.

These conflations create ambiguity when agents and services interact across administrative boundaries.

UIA addresses this problem by providing explicit protocol-level separation between these concepts.

## 3. Target environment

UIA is intended for federated environments containing independently operated participants.

Potential participant categories:

- HUMAN — people participating in federated systems.
- AGENT — autonomous or semi-autonomous AI agents.
- SERVICE — independently operated software services.
- EXTERNAL_SYSTEM — external platforms and systems.

Potential adopting organizations:

- AI agent infrastructure providers.
- Multi-agent platform developers.
- Organizations operating internal agent ecosystems.
- Federated service networks.
- Developers building agent identity and trust infrastructure.

These are target-market hypotheses, not validated customer segments.

## 4. Primary jobs to be done

### JTBD-1: Establish persistent identity

As a system operator, I want to identify a logical participant independently of its current runtime instance, so that process restarts and infrastructure changes do not automatically create new identities.

### JTBD-2: Publish identity evolution

As an agent developer, I want to publish immutable versions of an identity, so that changes to declared identity properties do not rewrite historical versions.

### JTBD-3: Declare provenance

As an identity publisher, I want to declare how a new identity version relates to previous versions, so that other domains can inspect the claimed history.

### JTBD-4: Evaluate provenance independently

As a receiving domain, I want to evaluate provenance using my own policies and available evidence, so that external declarations do not become automatically trusted facts.

### JTBD-5: Preserve historical decisions

As a domain operator, I want subsequent evidence and assessments to coexist with previous decisions, so that the system maintains an auditable history.

### JTBD-6: Separate identity from authority

As a security architect, I want identity lineage to remain independent from permission delegation, so that a newly derived identity cannot inherit authority merely because of its ancestry.

## 5. Product principles

The following principles are foundational product constraints.

| Principle              | Requirement                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Identity separation    | Participant, IdentityVersion, and RuntimeInstance are distinct      |
| Immutable history      | Published descriptors and historical decisions are not mutated      |
| Explicit provenance    | Relationships are declared rather than inferred as facts            |
| Evidence-first         | Assessment results preserve evidence and uncertainty                |
| Domain sovereignty     | Each domain controls its own acceptance policies                    |
| No implicit authority  | Lineage never grants permissions                                    |
| Determinism            | Equivalent inputs and policies produce reproducible outcomes        |
| Mechanism transparency | Implementation mechanisms do not silently define protocol semantics |

## 6. Conceptual domain model

UIA separates five major concerns.

### 6.1. Identity

Describes who a participant is and which immutable version of its declared identity is being referenced.

Primary entities:

- Participant
- IdentityVersion
- RuntimeInstance

### 6.2. Credentials

Describe cryptographic relationships between identity or runtime contexts and public keys.

Credentials support authentication and signature verification within their declared usage.

They do not independently establish authority or factual truth.

### 6.3. Provenance

Describes declared relationships between identity versions.

Primary concepts:

- Lineage Declaration
- Lineage Graph
- CONTINUATION
- FORKED_FROM
- MERGED_FROM

### 6.4. Assessment

Describes a domain's evaluation of declarations and evidence.

Assessments are contextual and independently governed.

They do not rewrite the underlying declarations.

### 6.5. Acceptance and Authority

Local Acceptance records a domain's decision to recognize an identity version in a particular context.

Authority is a separate concern and must be established through explicit grants and delegation mechanisms.

## 7. Functional scope

### 7.1. Current foundational scope: CORE-001

The first protocol module establishes:

- Participant identity.
- Immutable IdentityVersion descriptors.
- Credential semantics.
- Lineage declarations.
- Continuity assessments.
- Conditional version binding.
- Temporal validation.
- Local Acceptance.
- Historical artifact preservation.

### 7.2. Future protocol expansion

The architecture anticipates separate specifications for additional concerns. Scope is taken from `UIA-CORE-001` §14; each specification must be approved before its boundary is final.

| Specification | Intended concern                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| CORE-001      | Identity, Credentials, Lineage, Acceptance                                                                          |
| CORE-002      | Interaction & Event Ledger — events, envelopes, event/claim/artifact provenance, delivery, ledger                    |
| CORE-003      | Authority & Execution — authority principals, grants, capabilities, JIT authorization, delegation, taint tracking    |
| CORE-004      | Epistemics & Normative Acts — evidence, findings, rulings, examination, reassessment                                 |

These boundaries are provisional and must follow the corresponding approved normative specifications.

## 8. Non-functional requirements

These are engineering requirements for the reference implementation, not protocol obligations. Normative requirements remain those of `UIA-CORE-001`.

### Portability

The Core MUST NOT depend on Bun- or Node-specific runtime APIs.

Bun is used as the development and testing environment.

### Determinism

Core operations MUST produce deterministic results for equivalent validated inputs and policies.

### Immutability

Public domain records MUST have explicit ownership and immutability guarantees.

### Type safety

The public TypeScript API MUST avoid unvalidated `unknown` and MUST NOT expose `any`.

### Dependency minimization

The Core should remain free of runtime dependencies.

### Testability

Protocol semantics must be testable through:

- Unit tests.
- Normative conformance tests.
- Property-based tests.
- Explicit regression tests for previously discovered defects.

### Explainability

Results should preserve meaningful distinctions between protocol failures, mechanism failures, missing evidence, and unavailable verification.

## 9. Trust and security model

UIA does not attempt to create a universal trust score.

Instead, it preserves distinct layers:

1. Cryptographic validity.
2. Declared provenance.
3. Evidence supporting provenance.
4. Local epistemic assessment.
5. Local normative acceptance.
6. Explicit authority grants.

A positive result at one layer does not automatically imply a positive result at another.

For example:

A valid signature establishes a cryptographic relationship between a payload and a key. It does not establish that the payload is true, that the key operator was authorized, or that another domain should trust the signer.

### Threat-model considerations

The implementation and future specifications should consider:

- Credential compromise.
- Identity impersonation.
- Forged provenance declarations.
- Malicious or misleading assessments.
- Inconsistent domain policies.
- Replay and stale evidence.
- Conflicting historical information.
- Runtime compromise.
- Attempts to inherit authority through lineage.
- Ambiguous or untrusted timestamps.

A complete threat model and security analysis remain future deliverables.

## 10. Explicit non-goals

UIA is not intended to become:

- A centralized identity provider.
- A universal agent registry.
- A global reputation authority.
- A universal trust scoring service.
- An automatic permission inheritance engine.
- A replacement for cryptographic primitives.
- A guarantee that declared agent behavior matches actual runtime behavior.
- A mechanism that forces independent domains to accept one another's decisions.

## 11. MVP definition

The initial MVP is a portable, testable reference implementation of UIA-CORE-001.

The MVP is considered technically complete when:

- The normative CORE-001 contracts are implemented.
- The specified conformance corpus passes.
- Property-based invariants are tested.
- Historical immutability is demonstrated.
- Normative and implementation-specific behavior are separated.
- Known specification ambiguities are documented.
- The public API is typed and portable.

Passing the implementation test suite does not automatically establish production security or interoperability.

## 12. Success criteria

### Protocol quality

- Every normative requirement has an explicit implementation or documented unresolved status.
- No blocked semantic question is silently converted into a protocol rule.
- Historical artifacts remain immutable.
- No authority inheritance occurs through identity lineage.

### Engineering quality

- Reproducible test results.
- Deterministic behavior.
- No runtime dependencies in Core.
- Strict type checking.
- Portable implementation.

### Ecosystem adoption — future metrics

Potential metrics to evaluate after an interoperable implementation exists:

- Independent implementations.
- Successful cross-domain identity exchanges.
- Number of independent domains using local assessments.
- Number of interoperable agents and services.
- Adoption by agent infrastructure providers.

No adoption targets have been established yet.

## 13. Open product questions

The following questions require further product-level decisions.

1. Is UIA primarily a protocol specification, a developer library, or a complete federation infrastructure?
2. What is the first concrete interoperability scenario?
3. Should the first reference integration target AI-agent frameworks, general services, or organizational identity infrastructure?
4. What is the expected trust and evidence exchange model between independent domains?
5. Which parts of the system should eventually have standard network interfaces?
6. What should constitute the first production-grade security profile?
7. How should conformance and interoperability certification work?
8. What is the minimum viable developer experience for integrating UIA?

These questions should not be resolved implicitly through CORE-001 implementation choices.

## 14. Product strategy

The recommended development sequence is:

1. Establish the normative identity and provenance foundation.
2. Complete and validate the reference implementation.
3. Define the remaining protocol boundaries.
4. Build a minimal interoperability demonstration.
5. Validate the architecture with independent implementations.
6. Develop production-oriented security and deployment profiles.

The initial priority is correctness of semantics, not breadth of features.

---

**Product thesis**

UIA aims to make identity, provenance, trust, acceptance, and authority independently inspectable and independently governed.

Rather than asking every domain to trust the same identity provider, UIA provides a common language for declaring identity and evaluating its history.

The result should be a foundation on which different organizations can cooperate without surrendering their autonomy.
