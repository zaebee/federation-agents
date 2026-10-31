# UIA — Threat Model

**Status:** Working Draft — first pass, not a security proof.
**Scope:** `UIA-CORE-001 Rev 0.3.3` protocol semantics and the reference implementation in this repository.
**Out of scope:** CORE-002 (events, transport, ledger), CORE-003 (authority, execution), CORE-004 (evidence, rulings). Their threats are named only where CORE-001 depends on them.

This document records what we protect, from whom, what the protocol already enforces, what the implementation enforces today, and what remains unmitigated. It is meant to be attacked in review: every "mitigated" claim should be falsifiable by a test or by a precise spec citation. Each status names the basis: protocol, implemented, planned, blocked, or an external dependency.

Normative requirements come from [`CORE-001`](./CORE-001.md). Implementation structure comes from [`ARCHITECTURE.md`](./ARCHITECTURE.md). Where this document and the specification disagree, the specification wins.

## 1. Assets

| Asset                     | Why it matters                                                        |
| ------------------------- | --------------------------------------------------------------------- |
| Identity continuity truth | Whether a version really continues, forks from, or merges another     |
| Descriptor integrity      | Published identity versions are never silently rewritten              |
| Assessment integrity      | A domain's evaluation reflects evidence, not attacker preference       |
| Acceptance history        | Decisions remain auditable and are not retroactively rewritten         |
| Historical signatures     | Past evidence can be judged separately from future authorization      |
| Domain sovereignty        | One domain cannot force another to accept its conclusion               |
| Availability              | Adversarial graphs or inputs cannot stall evaluation                   |
| Auditability              | A third party can reconstruct why a decision was made                  |

## 2. Trust boundaries

```text
 publisher ──declaration──▶┐
                           │
 transport / storage ─────▶│  domain intake        ◀── untrusted content
                           │  (parse, validate, own)
 external assessor ───────▶│
                           ▼
                    domain policy (trusted code)
                           │
                           ▼
                    decision to accept / reject
                           │
                           ▼
                    execution of an action      ◀── CORE-003 boundary
```

The important line is **domain intake**. Everything above it is data from someone else, including declarations signed with valid keys. Everything below it is local policy, which this repository treats as trusted code supplied by the host.

## 3. Adversary model

An attacker may:

- publish arbitrary identity versions and lineage declarations, signed with keys they control;
- hold a key that was legitimately issued, and later lose control of it;
- produce assessments, with or without being trusted by the victim domain;
- replay, reorder, delay, or withhold messages (CORE-002 territory);
- operate a domain that makes self-serving acceptance decisions;
- craft pathological graphs, deeply nested JSON, or oversized payloads;
- be an integrator who misuses the library: treats acceptance as permission, casts with `any`, or skips validation.

An attacker is **not** assumed to:

- break SHA-256 preimage or collision resistance;
- break RFC 8785 canonicalization in a deployed implementation;
- read or modify the victim domain's local policy;
- mount side-channel or physical attacks;
- compromise the host operating system.

## 4. Threat catalogue

### A. Identity and authority

**T-01 Authority laundering through lineage.** An attacker derives a new version from a trusted participant and claims the ancestor's permissions.
*Mitigation:* lineage creates no authority edge (INV-ID-01, §2.1); identity and authority graphs are separate (§2.2); no grant-producing API exists in this repository.
*Status:* protocol-level; implementation has no authority surface to misuse. Residual risk: a host may treat Local Acceptance as authorization — that is an integration error, not a protocol allowance.

**T-02 Identity substitution across participants.** A version claims `CONTINUATION` from another participant's version.
*Mitigation:* `CONTINUATION` requires exactly one parent and the same `participant_id`; violation is `ERR_INVALID_RELATION` / `ERR_INVALID_CARDINALITY`.
*Status:* protocol; enforcement planned with the lineage module.

**T-03 Local acceptance treated as universal trust.** A domain accepts a version and third parties assume everyone must.
*Mitigation:* acceptance is a local act, scoped to a context, and never binds other domains (§6.4, §9.2); assessments may differ per domain.
*Status:* protocol. Residual risk: no technical mechanism can stop a host from publishing its acceptance as if it were global.

**T-04 Runtime impersonation.** A process claims to be a legitimate runtime of a version, or a compromised runtime acts on its behalf.
*Mitigation:* `RuntimeInstance` is distinct from `IdentityVersion`; credentials must be bound to a version or runtime, not to an abstract participant (§1.3, §4.2); restarts do not create new identity versions.
*Status:* protocol boundary. Residual risk: no runtime attestation and no key custody in this repository; that is CORE-002 and infrastructure work.

### B. Provenance and assessment

**T-05 Forged provenance declaration.** A publisher declares a relationship that is not true.
*Mitigation:* a declaration is a claim, not evidence; assessment is a separate artifact with `verified_claims` / `unverified_claims`; missing evidence never becomes success (§6.2.2, §8.5).
*Status:* protocol + planned implementation. Residual risk: a trusted but careless assessor can still verify weak claims; the evidence model belongs to CORE-004.

**T-06 Malicious or captured assessor.** An assessment is produced by a party the victim domain should not trust, or a trusted assessor is compromised.
*Mitigation:* the domain names trusted assessors explicitly (`trusted_assessors`); assessments from untrusted domains get no priority merely for being newer or positive (§6.4); policy can narrow, never expand, the applicable set.
*Status:* planned. Residual risk: trust in assessors is configuration, and configuration can be wrong.

**T-07 Conflicting assessments, or "assessment shopping".** Two applicable trusted assessments disagree; the attacker hopes the newest or most favourable one wins.
*Mitigation:* the specification defines a `CONTESTED` outcome for conflicting claims and forbids an automatic majority vote or "latest wins" (§6.3 #6, §6.4); supersession is a link, not an authority transfer.
*Status:* **partially BLOCKED.** Rev 0.3.3 does not define what makes two applicable assessments contradict each other (A-4b). The reference implementation detects no contradiction automatically; `CONTESTED` is reachable only through an explicitly configured non-default `Policy.conflictPredicate`, which is an extension point, not normative semantics. Any claim that conflict handling works requires the missing clarifier first.

**T-08 Assessment supersession abused to rewrite history.** A new assessment is published to erase an inconvenient earlier one.
*Mitigation:* assessments are immutable; supersession chains are acyclic; old assessments are preserved; earlier decisions are not rewritten (§6.3).
*Status:* protocol + planned implementation.

**T-09 Cycle injection.** A publisher supplies a lineage cycle to make continuity appear provable or to crash the evaluator.
*Mitigation:* cycles are detected and reported as `CYCLE_DETECTED`; declarations are preserved; the cycle is not accepted as proof; no global deletion or process abortion (§11.2).
*Status:* planned. Residual risk: availability — see T-17.

**T-10 Delayed or unresolved parent.** A child arrives before its parent, and the domain treats the missing parent as acceptable.
*Mitigation:* the declaration is stored, the unresolved reference is preserved, and assessment records `PARENT_UNRESOLVED`; absence of evidence is never success (§11.1, §8.5).
*Status:* planned.

### C. Credentials and time

**T-11 Credential compromise and historical signature reuse.** An attacker who obtained a key reuses old signatures, or tries to make compromised signatures look valid.
*Mitigation:* revocation is a separate record and never edits the descriptor; reasons distinguish rotation, loss, suspected, confirmed, and administrative revocation; confirmed compromise with a known effective time invalidates signatures at or after that time; unknown compromise time yields `CONTESTED_COMPROMISED`, which cannot support continuity or future authorization without further assessment (§4.4).
*Status:* protocol; implementation planned. Residual risk: `compromise_effective_at` is itself an assertion that needs evidence, and key management is out of scope.

**T-12 Timestamp manipulation.** A publisher backdates or forward-dates a declaration, or an attacker claims a convenient signing time.
*Mitigation:* `asserted_at` is a claim, never proof of the actual moment; selection of a temporal basis is explicit policy; trust is an external assessment; the four outcomes `TRUSTED`, `UNTRUSTED`, `UNASSESSED`, `TRUST_ASSESSMENT_UNAVAILABLE` are never collapsed (§10).
*Status:* protocol + planned implementation. **BLOCKED (A-9):** Rev 0.3.3 defines no trusted-time mechanism. The core cannot produce trust, only consume it.

**T-13 TOCTOU between decision and execution.** A credential or acceptance is valid at decision time and invalid at execution time.
*Mitigation:* CORE-001 defines the temporal basis for checks and explicitly refuses to claim JIT safety; §10.3 assigns pre-execution checks to CORE-003.
*Status:* external dependency. Residual risk: not mitigable inside this library.

### D. Data integrity and encoding

**T-14 History mutation through aliasing.** A caller keeps a reference to an input object and mutates it after construction.
*Mitigation:* when the ownership layer is applied by constructors, records are copied structurally and frozen recursively, and public record types are `DeepReadonly<T>`; mutation of the caller's original then cannot affect the stored record.
*Status:* **partially implemented.** `validateIdentityVersionDescriptor` now copies and freezes descriptors, and the ownership helpers (`deepCopy`, `deepFreeze`, `DeepReadonly`) are unit-tested; constructors for the remaining record types are still planned. Residual risk: `any` casts or adapters that retain their own mutable copies.

**T-15 Canonicalization divergence.** Two implementations hash "the same" descriptor differently, so `DESCRIPTOR_HASH_CONFIRMED` disagrees or a hash can be smuggled by encoding tricks.
*Mitigation:* **implemented** — RFC 8785 JCS over a strict data model, pure-TS SHA-256, rejection of `undefined`, `NaN`, infinities, `BigInt`, functions, symbols, accessors, symbol keys, non-enumerable own properties, array extra properties, sparse arrays, non-`Object.prototype` prototypes, cycles, and lone surrogates in values and keys; the explicit 8-field §7.1 projection (`descriptorHashInput`), `descriptorHash` returning `urn:hash:sha256:…`, and a pinned known-answer test.
*Status:* implemented and unit-tested (Task 4). Residual risk: correctness depends on cross-implementation vectors and on SHA-256 assumptions.

**T-16 Untrusted input reaching a domain record.** An adapter passes raw JSON, a class instance, or `unknown` straight into a constructor.
*Mitigation:* `validateUnknown` / `validateJsonValue` at the boundary, plus `validateIdentityVersionDescriptor` for the descriptor boundary; typed public API with no `any`; records reject unsupported structures instead of coercing them.
*Status:* implemented for descriptors, version labels and selectors; other record boundaries and adapters are planned, so the end-to-end path is not yet exercised.

### E. Availability and integration

**T-17 Graph or payload exhaustion.** An attacker supplies a huge graph, a diamond explosion, or deeply nested JSON to exhaust CPU or memory during traversal.
*Mitigation (planned):* determinism permits memoization; cycles are dead ends; immediate closure bounds closure work to direct parents.
*Status:* **unmitigated by design gap.** Rev 0.3.3 sets no input limits, and the library defines none. Deployments should enforce descriptor-count, graph-depth, and payload-size limits until an explicit resource-limit contract is defined. This should become an explicit adapter contract.

**T-18 Policy hook abuse.** A caller-supplied hook returns assessments that do not apply to the edge, or a forged "applicable" set.
*Mitigation:* applicable sets are constructed only by `assessEdge` and carry a module-private runtime brand; `evaluateAssurance` rejects unbranded input with `E_APPLICABLE_ASSESSMENTS_UNBRANDED`; hook output is intersected with the applicable set and non-members are discarded and reported.
*Status:* planned. Residual risk: if the brand check is bypassed by a future refactor, nominal binding silently degrades into a convention.

**T-19 Type confusion through a forged compiled selector.** An integrator passes a plain object, a spread copy, an inheriting object, or a Proxy where `selectorMatches` expects a selector produced by `compileSelector`, hoping to steer matching.
*Mitigation:* compiled selectors carry a module-private symbol brand for nominal typing and are registered in a module-private `WeakSet` only after construction and deep freezing; `selectorMatches` accepts a selector by identity in that set, not by property lookup, so inherited brands and Proxies are rejected. Invalid input raises `InvalidCompiledSelectorError` and is never treated as a wildcard.
*Status:* implemented and regression-tested (inheritance, field overrides, Proxy with traps, spread copy, plain forgery). Residual risk: the check is in-process only; it prevents misuse, not a compromised host.

## 5. Security assumptions

The model holds only if these are true:

1. SHA-256 behaves as a collision- and preimage-resistant hash.
2. The canonicalization implementation matches RFC 8785, including number formatting and string escaping.
3. The host domain supplies a correct policy, and policy code is trusted.
4. A `SignatureVerifier` implementation reports cryptographic outcomes honestly; the core does not verify signatures itself.
5. The host does not bypass types with `any`, and validates untrusted input at the boundary.
6. Trust in assessors is configured deliberately, not inferred from message content.
7. Identity descriptors are public; the protocol makes no confidentiality claim.
8. Declared identity properties are not a guarantee that runtime behaviour matches them.

## 6. Residual risks and open questions

| #   | Risk                                                                 | Owner / next step                                          |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| R-1 | Recursive merge closure undefined (A-5); only immediate closure implemented | Spec clarifier; currently excluded from conformance claims |
| R-2 | Contradiction detection undefined (A-4b)                              | Spec clarifier or deferral to CORE-004 findings             |
| R-3 | Merge-typed origin closure undefined (A-11)                           | Spec clarifier                                             |
| R-4 | No trusted-time mechanism (A-9)                                       | CORE-002 or external mechanism                             |
| R-5 | No input-size or traversal limits (T-17)                              | Adapter contract, then tests                                |
| R-6 | No evidence model; assessments reference opaque ids                   | CORE-004                                                   |
| R-7 | No key management, rotation procedure, or crypto profile              | Infrastructure / security profile                          |
| R-8 | No independent implementation has validated interoperability          | Second implementation and cross-checks                     |
| R-9 | No formal security review, fuzzing, or penetration test                | Before any production claim                                |

## 7. What this document does not claim

- It is not a proof that CORE-001 is secure.
- It does not cover CORE-002/003/004 threats.
- It does not rate risks numerically; no threat here is "accepted" by default.
- It does not replace a production security profile, which does not exist yet.

## 8. How to attack this document

Useful review questions:

1. Which "mitigated" item is only a planned test, and does the text say so?
2. Does any mechanism failure look like a protocol rejection to a caller?
3. Can an attacker turn "unverified" into "verified" by omission?
4. Can a host read acceptance as permission without noticing?
5. Which BLOCKED item is being quietly treated as implemented?
6. What happens with zero assessments, duplicated assessments, or a self-assessment?

Answers that require spec changes belong in the ambiguities register of the [implementation plan](./superpowers/plans/2026-10-30-uia-core-001-implementation.md), not in code comments.
