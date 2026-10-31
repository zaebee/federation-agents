# CORE-001 Requirement Matrix — Task 17 Audit

**Specification:** `docs/CORE-001.md`, UIA-CORE-001 Rev 0.3.3.
**Audit base:** commit `9c38bbd` (Task 16 merged).
**Method:** every normative statement is extracted from the specification, assigned an audit ID, traced to source, and matched to verification evidence. Audit IDs (`N-###`) are not specification identifiers.

## Legend

| Field | Values |
| --- | --- |
| `Strength` | `MUST`, `MUST NOT`, `SHALL`, `SHOULD`, `MAY`, `INVARIANT`, `READINESS` |
| `Scope` | `CORE-001`, `CORE-002 boundary`, `CORE-003 boundary`, `CORE-004 boundary`, `external` |
| `Impl` | `PRESENT`, `PARTIAL`, `ABSENT`, `EXTERNAL`, `N/A` |
| `Verif` | `EVIDENCED`, `PARTIAL`, `NONE` |
| `Status` | `PASS`, `FAIL`, `PARTIAL`, `BLOCKED`, `NOT COVERED` |

`Impl` and `Verif` are independent. A missing test is not evidence of a missing implementation; a passing test is not evidence of the full normative property.

Evidence shorthand: `C:` = source location; `T:` = test file and test name.

## §0–§1 — Scope, ontology, axioms

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-001 | §0.1 | Identity, Lineage, Assessment, Acceptance and Authority are distinct entities | INVARIANT | CORE-001 | separate modules and types; no authority type | PRESENT | C: `src/core/index.ts`; T: `export-surface.ts` via P9 | EVIDENCED | PASS |
| N-002 | §1.1 | Participant kinds are HUMAN, AGENT, SERVICE, EXTERNAL_SYSTEM | MUST | CORE-001 | `ParticipantKind` union and validator | PRESENT | C: `entities.ts:33`, `entities.ts:431`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-003 | §1.2 | IdentityVersion is an immutable snapshot; a new version does not change earlier ones | MUST | CORE-001 | owned frozen descriptors; no mutation API | PRESENT | C: `entities.ts:366`; T: `ownership.test.ts`, A-1 | EVIDENCED | PASS |
| N-004 | §1.3 | One IdentityVersion may have several RuntimeInstances; one failure does not change others | MUST | CORE-001 | runtime registry, separate events | PRESENT | C: `runtime.ts:133`, `runtime.ts:161`; T: `d.test.ts::D-1` | EVIDENCED | PASS |
| N-005 | §1.4 | IdentityVersion, Participant and RuntimeInstance do not become AuthorityPrincipal automatically | MUST NOT | CORE-003 boundary | no authority type or grant API | PRESENT | C: `src/core/index.ts`; T: P9 | EVIDENCED | PASS |
| N-006 | §1.5 | Each IdentityVersion belongs to exactly one Participant | MUST | CORE-001 | single `participant_id` field | PRESENT | C: `entities.ts:84`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-007 | §1.5 | Lineage links IdentityVersions, not abstract Participants | MUST | CORE-001 | `parent_version_id` only | PRESENT | C: `entities.ts:74` | EVIDENCED | PASS |
| N-008 | §1.5 | Lineage may cross Participant boundaries | MAY | CORE-001 | FORKED_FROM and MERGED_FROM accept any participant | PRESENT | C: `lineage.ts:116`; T: A-3, A-5 | EVIDENCED | PASS |
| N-009 | §1.5 | Creation, continuation, fork or merge does not create authority | MUST NOT | CORE-001 | no grant-producing API | PRESENT | C: `src/core/index.ts`; T: P9 | EVIDENCED | PASS |
| N-010 | §1.5 | Identity does not imply memory, reputation, obligation or responsibility inheritance | MUST NOT | CORE-001 | no such fields or transfer logic | PRESENT | C: `entities.ts`; T: A-1, A-3, A-5 | EVIDENCED | PASS |
| N-011 | §1.5 | A runtime start or restart is not a new IdentityVersion | MUST NOT | CORE-001 | runtime descriptor references a version; no version creation | PRESENT | C: `runtime.ts:133`; T: `runtime.test.ts` | EVIDENCED | PASS |

## §2 — Identity and lineage invariants

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-012 | §2.1 | Lineage does not inherit capabilities, access, grants, obligations, reputation, memory, responsibility or execution permissions | MUST NOT | CORE-001 | no inheritance logic; no grant type | PRESENT | C: `src/core/`; T: A-1, A-3, A-5, P9 | EVIDENCED | PASS |
| N-013 | §2.2 | Identity Lineage Graph and Authority Relationship Graph are separate; a lineage edge must not create an authority edge | MUST | CORE-001 | only lineage graph exists; no authority graph | PRESENT | C: `lineage.ts:143`; T: P9 | EVIDENCED | PASS |
| N-014 | §2.3 | Declaration, Assessment and Local Acceptance are separate entities | MUST | CORE-001 | separate record types and modules | PRESENT | C: `entities.ts:84`, `assessment.ts:18`, `acceptance.ts:25` | EVIDENCED | PASS |
| N-015 | §2.3 | None of declaration, assessment or acceptance modifies the declaration, replaces another entity, obliges other domains or creates authority | MUST NOT | CORE-001 | immutable records; per-call policy; no grant API | PRESENT | C: `ownership.ts:147`; T: A-1, `assessment.test.ts`, P9 | EVIDENCED | PASS |

## §3 — Immutable descriptors

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-016 | §3 | Dynamic state (availability, runtime state, locks, current assessments) must not be written by mutating the original descriptor | MUST NOT | CORE-001 | records frozen; events separate | PRESENT | C: `ownership.ts:147`, `runtime.ts:161`; T: D-1 | EVIDENCED | PASS |
| N-017 | §3.1 | ParticipantRecord has `id`, `kind`, `home_domain`, `registered_at` | MUST | CORE-001 | type and validator | PRESENT | C: `entities.ts:35`, `entities.ts:418`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-018 | §3.2 | IdentityVersionDescriptor has the eight declared fields | MUST | CORE-001 | type and validator | PRESENT | C: `entities.ts:84`, `entities.ts:366`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-019 | §3.2 | SEMVER_2 version labels correspond to Semantic Versioning 2.0.0 | MUST | CORE-001 | `parseSemVer`/`validateVersionLabel`; not enforced by the descriptor validator | PARTIAL | C: `version-scheme.ts:47`; T: `version-scheme.test.ts`; descriptor acceptance accepts any string label | PARTIAL | PARTIAL |
| N-020 | §3.2 | CONTENT_HASH label contains a content hash identifier | MUST | CORE-001 | non-empty only; format unspecified (A-7) | PARTIAL | C: `version-scheme.ts:62`; T: `version-scheme.test.ts` | PARTIAL | BLOCKED |
| N-021 | §3.2 | OPAQUE_TAG is an arbitrary string with no universal comparison semantics | MUST | CORE-001 | exact-match only; no ordering | PRESENT | C: `version-scheme.ts:62`, `selector.ts:185`; T: `selector.test.ts` | EVIDENCED | PASS |
| N-022 | §3.2 | Range selector expressions use only compatible version schemes | MUST | CORE-001 | non-SemVer range prefixes rejected with `S_SELECTOR_INCOMPATIBLE_SCHEME` | PRESENT | C: `selector.ts:199`; T: `selector.test.ts` | EVIDENCED | PASS |
| N-023 | §3.2 | OPAQUE_TAG permits exact matching only unless local policy defines another mechanism | MUST | CORE-001 | exact-match and wildcard only | PRESENT | C: `selector.ts:185`; T: `selector.test.ts` | EVIDENCED | PASS |
| N-024 | §3.2 | CONTENT_HASH is not interpreted as SemVer | MUST NOT | CORE-001 | separate non-SemVer path | PRESENT | C: `selector.ts:223`; T: `version-scheme.test.ts` | EVIDENCED | PASS |
| N-025 | §3.3 | RuntimeInstanceDescriptor has `id`, `identity_version_id`, `execution_context_ref`, optional `ephemeral_public_key`, `instantiated_at` | MUST | CORE-001 | type and validator | PRESENT | C: `entities.ts:45`, `entities.ts:485`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-026 | §3.3 | Heartbeat, stop, failure, restart and other runtime changes are separate lifecycle events | MUST | CORE-002 boundary | minimal `FAILURE` event; no state transition | PARTIAL | C: `runtime.ts:25`, `runtime.ts:161`; T: `runtime.test.ts`, D-1 | PARTIAL | PARTIAL |
| N-027 | §3.3 | CORE-001 does not define the full runtime event format; CORE-002 does | BOUNDARY | CORE-002 boundary | not implemented, by design | N/A | C: `runtime.ts` header | EVIDENCED | PASS |

## §4 — Credential semantics

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-028 | §4 | A Credential links a public key to an identity or runtime in a context; it is not authority | INVARIANT | CORE-001 | credential record and subject binding; no grant | PRESENT | C: `entities.ts:57`, `credential.ts:41`; T: P9 | EVIDENCED | PASS |
| N-029 | §4.1 | A valid signature proves only the key relation, not controller, prior compromise, intent, authority, runtime legitimacy or payload truth | MUST NOT | CORE-001 | verifier outcome reported separately; no attribution claim | PRESENT | C: `credential.ts:50`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-030 | §4.2 | CredentialDescriptor has the declared fields | MUST | CORE-001 | type and validator | PRESENT | C: `entities.ts:57`, `entities.ts:456`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-031 | §4.2 | A Credential is linked to a specific IdentityVersion or RuntimeInstance | MUST | CORE-001 | embedded in descriptor; explicit subject binding for evaluation | PRESENT | C: `entities.ts:84`, `credential.ts:41` | EVIDENCED | PASS |
| N-032 | §4.2 | A Credential must not belong to an abstract Participant without key context | MUST NOT | CORE-001 | no participant-level credential field | PRESENT | C: `entities.ts:35`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-033 | §4.2 | `issuer_domain` does not by itself prove trust in that domain | MUST NOT | CORE-001 | no trust inference from issuer | PRESENT | C: `credential.ts`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-034 | §4.3 | Credential usage outside the declared purpose is prohibited by local verification | MUST | CORE-001 | `evaluateCredentialUsage` denies undeclared usage | PRESENT | C: `credential.ts:299`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-035 | §4.4 | Revocation is a separate event and does not modify the original descriptor | MUST | CORE-001 | separate record; no mutation | PRESENT | C: `credential.ts:30`, `credential.ts:248`; T: D-3 | EVIDENCED | PASS |
| N-036 | §4.4 | RevocationReason has ROTATION, KEY_LOST, SUSPECTED_COMPROMISE, CONFIRMED_COMPROMISE, ADMINISTRATIVE | MUST | CORE-001 | union and validator | PRESENT | C: `credential.ts:27`, `credential.ts:148`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-037 | §4.4.1 | ROTATION: pre-revocation signatures may remain historically valid under temporal and cryptographic conditions | MAY | CORE-001 | policy-driven historical result | PRESENT | C: `credential.ts:460`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-038 | §4.4.1 | KEY_LOST: historical signatures require local policy and evidence interpretation | MUST | CORE-001 | distinct `KEY_LOST_POLICY_REQUIRED` outcome | PRESENT | C: `credential.ts:503`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-039 | §4.4.1 | SUSPECTED_COMPROMISE: dependent assessments should be marked for reassessment; suspicion is not proof | SHOULD | CORE-001 | `reassessment_required` flag; no invalidation | PRESENT | C: `credential.ts:689`, `credential.ts:506`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-040 | §4.4.1 | CONFIRMED_COMPROMISE with an accepted `compromise_effective_at`: signatures at or after that time are unusable | MUST | CORE-001 | implemented, but additionally requires both timestamps to be `TRUSTED` | PARTIAL | C: `credential.ts:441`; T: D-3, `credential.test.ts` | PARTIAL | PARTIAL |
| N-041 | §4.4.1 | Unknown compromise time: historical signatures become `CONTESTED_COMPROMISED` and are not sufficient for continuity or future authorization | MUST | CORE-001 | explicit contested outcome; future outcome is policy-supplied | PRESENT | C: `credential.ts:448`; T: D-4, `credential.test.ts` | PARTIAL | PARTIAL |
| N-042 | §4.4.1 | `compromise_effective_at` is a claim requiring evidence; its presence does not make it trustworthy | MUST NOT | CORE-001 / external | trust supplied externally; acceptance policy required | PRESENT | C: `credential.ts:554`, `temporal.ts:55`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-043 | §4.4.1 | ADMINISTRATIVE does not imply prior signatures were compromised | MUST NOT | CORE-001 | no compromise path for ADMINISTRATIVE | PRESENT | C: `credential.ts:503`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-044 | §4.4.2 | Historical validity and future authorization are distinct results | MUST | CORE-001 | separate `historical` and `future_authorizable` fields | PRESENT | C: `credential.ts:122`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-045 | §4.4.2 | Retrospective validity depends on signing time, revocation time, reason, compromise time, evidence and local policy | MUST | CORE-001 | all factors are supplied to the policy or used in selection | PRESENT | C: `credential.ts:478`, `credential.ts:597`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-046 | §4.4.2 | Revocation must not delete the CredentialDescriptor or IdentityVersionDescriptor | MUST NOT | CORE-001 | no deletion API; records immutable | PRESENT | C: `credential.ts`; T: D-3, `ownership.test.ts` | EVIDENCED | PASS |

## §5 — Lineage graph

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-047 | §5 | All lineage edges are directed Child to Parent | MUST | CORE-001 | edge construction child to parent | PRESENT | C: `lineage.ts:160`; T: `lineage-graph.test.ts` | EVIDENCED | PASS |
| N-048 | §5.1 | LineageLink has `parent_version_id`, `relation`, optional `declared_rationale`, optional `continuity_proof_ref` | MUST | CORE-001 | type and validator | PRESENT | C: `entities.ts:74`, `entities.ts:471`; T: `entities.test.ts` | EVIDENCED | PASS |
| N-049 | §5.2 | CONTINUATION has exactly one parent and the same Participant | MUST | CORE-001 | cardinality and participant check | PRESENT | C: `lineage.ts:51`, `lineage.ts:116`; T: A-1, A-2 | EVIDENCED | PASS |
| N-050 | §5.2 | FORKED_FROM has exactly one parent, any Participant | MUST | CORE-001 | cardinality; no participant constraint | PRESENT | C: `lineage.ts:51`; T: A-3, A-4 | EVIDENCED | PASS |
| N-051 | §5.2 | MERGED_FROM has two or more parents, any Participant | MUST | CORE-001 | cardinality minimum 2 | PRESENT | C: `lineage.ts:51`; T: A-5 | EVIDENCED | PASS |
| N-052 | §5.2 | A new version does not automatically invalidate or deprecate the old one | MUST NOT | CORE-001 | no status field | PRESENT | C: `entities.ts:84`; T: A-1 | EVIDENCED | PASS |
| N-053 | §5.2 | FORKED_FROM does not transfer authority, credentials, responsibility or reputation | MUST NOT | CORE-001 | no transfer logic | PRESENT | C: `lineage.ts`; T: A-3 | EVIDENCED | PASS |
| N-054 | §5.2 | MERGED_FROM does not automatically union authority or Participants | MUST NOT | CORE-001 | no union logic | PRESENT | C: `lineage.ts`; T: A-5 | EVIDENCED | PASS |
| N-055 | §5.2 | Each parent relation is a separate LineageLink | MUST | CORE-001 | array of links | PRESENT | C: `entities.ts:84`; T: A-5 | EVIDENCED | PASS |
| N-056 | §5.3 | DERIVED_FROM is not a LineageLink type and is not in the identity graph | MUST NOT | CORE-001 | relation union has three members only | PRESENT | C: `entities.ts:31`; T: `entities.test.ts` | EVIDENCED | PASS |

## §6 — Assessment

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-057 | §6.1 | A lineage declaration is immutable and is not made true or false by another domain's decision | MUST | CORE-001 | frozen descriptor; assessment separate | PRESENT | C: `ownership.ts:147`; T: A-1, D-2 | EVIDENCED | PASS |
| N-058 | §6.2 | Assessments are immutable; different domains may issue different assessments; one assessment does not oblige another domain | MUST | CORE-001 | plain immutable record; per-call policy | PRESENT | C: `assessment.ts:18`; T: `assessment.test.ts`, B-5 | EVIDENCED | PASS |
| N-059 | §6.2.1 | ContinuityAssessment has the twelve declared fields | MUST | CORE-001 | interface declares all twelve fields | PRESENT | C: `assessment.ts:18`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-060 | §6.2.2 | `verified_claims` contains claims confirmed by the method and evidence | MUST | CORE-001 | union of trusted assessments | PRESENT | C: `assessment.ts:284`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-061 | §6.2.2 | `unverified_claims` contains claims not confirmed or not accepted | MUST | CORE-001 | read only as "not verified" | PRESENT | C: `assessment.ts:292`; T: `assessment.test.ts`, B-5 | EVIDENCED | PASS |
| N-062 | §6.2.2 | Absence from `verified_claims` must not be interpreted as confirmation | MUST NOT | CORE-001 | required claims missing → unsatisfied | PRESENT | C: `assessment.ts:293`; T: `assessment.test.ts`, B-2 | EVIDENCED | PASS |
| N-063 | §6.2.2 | Claims are identifiers, not numeric scoring inputs | MUST | CORE-001 | string sets; no score | PRESENT | C: `assessment.ts`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-064 | §6.2.3 | `assessment_profile_ref` and `assessment_method_version` are fixed for reproducibility | MUST | CORE-001 | required fields; records are copied and frozen on registration | PRESENT | C: `assessment.ts:22`, `assessment.ts:336`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-065 | §6.2.4 | `evidence_refs` reference evidence; a reference does not establish truth; Evidence model is CORE-004 | MUST | CORE-001 / CORE-004 boundary | string refs only | PRESENT | C: `assessment.ts:29`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-066 | §6.3 | An assessment must not change after publication | MUST NOT | CORE-001 | copy-on-write registration; no mutation | PRESENT | C: `assessment.ts:336`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-067 | §6.3 | One assessment may directly supersede at most one assessment | MUST | CORE-001 | single `supersedes_assessment_id` | PRESENT | C: `assessment.ts:20`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-068 | §6.3 | A supersession chain must not contain cycles | MUST NOT | CORE-001 | cycle detection on registration | PRESENT | C: `assessment.ts:309`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-069 | §6.3 | The old assessment is preserved as a historical document | MUST | CORE-001 | predecessor retained in the array | PRESENT | C: `assessment.ts:366`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-070 | §6.3 | Supersession does not delete or rewrite decisions previously based on the old assessment | MUST NOT | CORE-001 | supersession returns a new array and never touches decision records | PRESENT | C: `assessment.ts:366`; T: `assessment.test.ts`, D-2 (Local Acceptance as the decision record) | EVIDENCED | PASS |
| N-071 | §6.3 | Selection of the applicable assessment is determined by local policy considering scope, time, trust and evidence | MUST | CORE-001 | `Policy.applicableAssessments` hook | PRESENT | C: `assessment.ts:45`, `assessment.ts:168`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-072 | §6.3 | The newest assessment is not automatically the most authoritative | MUST NOT | CORE-001 | no latest-wins logic | PRESENT | C: `assessment.ts:168`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-073 | §6.4 | A domain using external assessments must explicitly define trusted assessors | MUST | CORE-001 | requirement or policy default; empty set otherwise | PRESENT | C: `assessment.ts:203`; T: `assessment.test.ts`, B-5 | EVIDENCED | PASS |
| N-074 | §6.4 | `required_claims` is a conjunction | MUST | CORE-001 | every required claim must be verified | PRESENT | C: `assessment.ts:293`; T: `assessment.test.ts`, B-2 | EVIDENCED | PASS |
| N-075 | §6.4 | `disallowed_claims` blocks satisfaction | MUST | CORE-001 | verified disallowed claim vetoes | PRESENT | C: `assessment.ts:294`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-076 | §6.4 | `trusted_assessors` defines domains whose assessments count | MUST | CORE-001 | trusted set filtering | PRESENT | C: `assessment.ts:203`; T: `assessment.test.ts`, B-5 | EVIDENCED | PASS |
| N-077 | §6.4 | The system must not automatically choose a winner by majority | MUST NOT | CORE-001 | no majority logic | PRESENT | C: `assessment.ts`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-078 | §6.4 | Two applicable trusted assessments that contradict each other move the claim to `CONTESTED` | MUST | CORE-001 | reachable only via explicit `conflictPredicate`; no default predicate | PARTIAL | C: `assessment.ts:234`; T: `assessment.test.ts` | PARTIAL | BLOCKED |
| N-079 | §6.4 | Decisions dependent on a contested claim cannot rely on it until local resolution | MUST NOT | CORE-001 | no decision engine; conflict detection blocked | ABSENT | none | NONE | BLOCKED |

## §7 — Canonicalization and descriptor hash

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-080 | §7.1 | The hash covers exactly the eight declared descriptor fields | MUST | CORE-001 | explicit projection | PRESENT | C: `hashing.ts:64`; T: `hashing.test.ts` | EVIDENCED | PASS |
| N-081 | §7.1 | Envelope, signatures, delivery metadata, ledger metadata, lifecycle events, assessments, revocations and acceptance must not be hashed | MUST NOT | CORE-001 | projection excludes them | PRESENT | C: `hashing.ts:64`; T: `hashing.test.ts` | EVIDENCED | PASS |
| N-082 | §7.2 | The descriptor is serialized with RFC 8785 JCS | MUST | CORE-001 | `canonicalize` | PRESENT | C: `canonical.ts:62`; T: `canonical.test.ts` | EVIDENCED | PASS |
| N-083 | §7.2 | The canonical representation is the SHA-256 input | MUST | CORE-001 | `canonicalSha256` | PRESENT | C: `canonical.ts:69`; T: `sha256.test.ts` | EVIDENCED | PASS |
| N-084 | §7.2 | The digest is compared with the claimed value; any byte mismatch means `DESCRIPTOR_HASH_CONFIRMED` is not confirmed | MUST | CORE-001 | digest computed; comparison is caller-side using `descriptorHash` | PRESENT | C: `hashing.ts:89`; T: `hashing.test.ts` | EVIDENCED | PASS |
| N-085 | §7.2 | The hash identifier includes the algorithm as `urn:hash:<algorithm>:<digest>` | MUST | CORE-001 | `urn:hash:sha256:<hex>` | PRESENT | C: `hashing.ts:89`; T: `hashing.test.ts` | EVIDENCED | PASS |
| N-086 | §7.2 | Credential revocation or a new assessment does not change the descriptor hash | MUST | CORE-001 | hash input excludes them | PRESENT | C: `hashing.ts:64`; T: `hashing.test.ts` | EVIDENCED | PASS |

## §8 — Conditional version binding and traversal

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-087 | §8.1 | CONTINUATION_ONLY permits only CONTINUATION edges | MUST | CORE-001 | scope filter | PRESENT | C: `traversal.ts:136`; T: `scope-matrix.test.ts` | EVIDENCED | PASS |
| N-088 | §8.1 | CONTINUATION_AND_FORK permits CONTINUATION and FORKED_FROM | MUST | CORE-001 | scope filter | PRESENT | C: `traversal.ts:141`; T: `scope-matrix.test.ts` | EVIDENCED | PASS |
| N-089 | §8.1 | FULL_ANCESTRY permits all lineage types | MUST | CORE-001 | scope filter | PRESENT | C: `traversal.ts:144`; T: `scope-matrix.test.ts` | EVIDENCED | PASS |
| N-090 | §8.2 | ConditionalVersionBinding has target participant, origin, selector, scope and assurance requirement | MUST | CORE-001 | interface | PRESENT | C: `traversal.ts:32` | EVIDENCED | PASS |
| N-091 | §8.2 | `origin_version_id` is a mandatory anchor | MUST | CORE-001 | required field | PRESENT | C: `traversal.ts:34`; T: B-1 | EVIDENCED | PASS |
| N-092 | §8.3 | Precheck: candidate participant equals `target_participant_id` | MUST | CORE-001 | precheck | PRESENT | C: `traversal.ts:740`; T: B-1 | EVIDENCED | PASS |
| N-093 | §8.3 | Precheck: version scheme is compatible with the selector | MUST | CORE-001 | `compileSelector` by scheme | PRESENT | C: `traversal.ts:744`; T: `selector.test.ts` | EVIDENCED | PASS |
| N-094 | §8.3 | Precheck: version label satisfies the selector | MUST | CORE-001 | `selectorMatches` | PRESENT | C: `traversal.ts:752`; T: B-1 | EVIDENCED | PASS |
| N-095 | §8.3 | Precheck: a permitted path from candidate to origin exists | MUST | CORE-001 | discovery | PRESENT | C: `traversal.ts:824`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-096 | §8.3 | Precheck: all transitions and merge closure satisfy the assurance requirement | MUST | CORE-001 | phases 2 and 3 | PRESENT | C: `traversal.ts:709`; T: B-2, B-4 | EVIDENCED | PASS |
| N-097 | §8.3 | Failure of any mandatory condition refuses the binding | MUST | CORE-001 | refusal results | PRESENT | C: `traversal.ts:759`; T: B-1, B-2 | EVIDENCED | PASS |
| N-098 | §8.4 | Traversal direction is candidate to parent to origin | MUST | CORE-001 | child to parent edges | PRESENT | C: `traversal.ts:308`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-099 | §8.4 | Discovery uses only edges permitted by the selected scope | MUST | CORE-001 | scope filter | PRESENT | C: `traversal.ts:193`; T: `scope-matrix.test.ts` | EVIDENCED | PASS |
| N-100 | §8.4 | No permitted path yields `ERR_NO_TRAVERSAL_PATH` | MUST | CORE-001 | discovery failure | PRESENT | C: `traversal.ts:172`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-101 | §8.4 | Multiple permitted paths are each considered independently and are not an error | MUST | CORE-001 | path set; per-path outcomes | PRESENT | C: `traversal.ts:801`; T: B-3, B-7 | EVIDENCED | PASS |
| N-102 | §8.4 | A candidate may satisfy binding if at least one path passes validation and closure | MUST | CORE-001 | accepted path rule | PRESENT | C: `traversal.ts:850`; T: B-3 | EVIDENCED | PASS |
| N-103 | §8.5 | Every edge of the path must match the traversal scope | MUST | CORE-001 | shape check | PRESENT | C: `traversal.ts:349`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-104 | §8.5 | Every edge must have an applicable ContinuityAssessment | MUST | CORE-001 | applicability triple | PRESENT | C: `assessment.ts:138`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-105 | §8.5 | Every edge must satisfy the assurance requirement | MUST | CORE-001 | assurance evaluation | PRESENT | C: `assessment.ts:262`; T: B-2 | EVIDENCED | PASS |
| N-106 | §8.5 | Every edge must not contain applicable disqualifying claims | MUST | CORE-001 | disallowed claims | PRESENT | C: `assessment.ts:294`; T: `assessment.test.ts` | EVIDENCED | PASS |
| N-107 | §8.5 | Every edge must not have an unresolved conflict of applicable assessments | MUST | CORE-001 | conflict detection requires a predicate | ABSENT | C: `assessment.ts:234` | NONE | BLOCKED |
| N-108 | §8.5 | Absence of an assessment does not mean successful validation | MUST | CORE-001 | unresolved set fails the path | PRESENT | C: `traversal.ts:402`; T: `traversal-phases.test.ts`, B-2 | EVIDENCED | PASS |
| N-109 | §8.6 | For every merge node on the selected path, all direct parent edges are checked | MUST | CORE-001 | immediate closure | PRESENT | C: `traversal.ts:674`; T: B-4, B-6, `scope-matrix.test.ts` | EVIDENCED | PASS |
| N-110 | §8.6 | Closure extends to branches that do not lead to the origin | MUST | CORE-001 | direct parent branches from full adjacency | PRESENT | C: `traversal.ts:527`; T: B-6 | EVIDENCED | PASS |
| N-111 | §8.6 | A failing branch yields `ERR_MERGE_BRANCH_UNSATISFIED` | MUST | CORE-001 | closure failure | PRESENT | C: `traversal.ts:650`; T: B-4 | EVIDENCED | PASS |
| N-112 | §8.6 | Closure depth inside parent branches is defined | MUST | CORE-001 | not defined by the specification (A-5) | PARTIAL | C: `traversal.ts:674`; experimental file excluded | NONE | BLOCKED |
| N-113 | §8.7 | In a diamond, each path is validated independently and merge closure is applied per merge node | MUST | CORE-001 | per-path phases | PRESENT | C: `traversal.ts:801`; T: B-3, B-4 | EVIDENCED | PASS |
| N-114 | §8.7 | A candidate is a successor if one fully valid path exists and all closure requirements on it are met | MUST | CORE-001 | accepted path rule | PRESENT | C: `traversal.ts:850`; T: B-3, B-4 | EVIDENCED | PASS |
| N-115 | §8.8 | The same input set yields the same result | MUST | CORE-001 | canonical sorting | PRESENT | C: `traversal.ts:334`; T: B-7, P1–P3 | EVIDENCED | PASS |
| N-116 | §8.8 | The result must not depend on edge storage, declaration arrival, traversal order or optimization | MUST NOT | CORE-001 | sorting and normalization | PRESENT | C: `traversal.ts:166`, `lineage.ts:160`; T: P1–P3, B-7 | EVIDENCED | PASS |
| N-117 | §8.8 | A cycle is a structural conflict, not a crash | MUST | CORE-001 | SCC detection; cycle results | PRESENT | C: `lineage.ts:278`, `traversal.ts:429`; T: `lineage-graph.test.ts`, P8 | EVIDENCED | PASS |

## §9 — Local Acceptance

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-118 | §9.1 | LocalAcceptanceRecord has the nine declared fields | MUST | CORE-001 | type and validator | PRESENT | C: `acceptance.ts:25`, `acceptance.ts:187`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-119 | §9.1 | LocalAcceptanceRecord is an immutable act | MUST | CORE-001 | copy and freeze | PRESENT | C: `acceptance.ts:223`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-120 | §9.2 | Local Acceptance is not a universal condition for all interactions | MUST NOT | CORE-001 | opt-in query; no middleware | PRESENT | C: `acceptance.ts:343`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-121 | §9.2 | Applicability is determined by domain policy and context | MUST | CORE-001 | contextual query plus policy | PRESENT | C: `acceptance.ts:343`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-122 | §9.2 | One domain is not obliged to recognise a participant because another domain issued an acceptance | MUST NOT | CORE-001 | no cross-domain state | PRESENT | C: `acceptance.ts:359`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-123 | §9.3 | A lifecycle event must not modify the original acceptance record | MUST NOT | CORE-001 | separate event type; no mutation | PRESENT | C: `acceptance.ts:227`, `acceptance.ts:278`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-124 | §9.3 | Transitions are checked against the previous state and local policy | MUST | CORE-001 | policy receives previous state | PRESENT | C: `acceptance.ts:278`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-125 | §9.3 | CORE-001 does not establish a universal automatic transition policy | MUST NOT | CORE-001 | no built-in transition table | PRESENT | C: `acceptance.ts:300`; T: `acceptance.test.ts` | EVIDENCED | PASS |

## §10 — Temporal reference model

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-126 | §10 | The five timestamp kinds are distinct and not interchangeable | MUST | CORE-001 | distinct field refs | PRESENT | C: `primitives.ts:64`; T: `ownership.test.ts`, `credential.test.ts` | EVIDENCED | PASS |
| N-127 | §10.1 | `asserted_at` is a declared time and does not prove actual creation time | MUST NOT | CORE-001 | no trust inference | PRESENT | C: `temporal.ts`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-128 | §10.1 | `signed_at` may be considered attested only with an applicable trusted-time mechanism | MUST | external (A-9) | trust arrives only as external assessment | EXTERNAL | C: `temporal.ts:55`; T: `credential.test.ts` | PARTIAL | BLOCKED |
| N-129 | §10.1 | `ingested_at` reflects a local receipt fact | MUST | CORE-001 | field ref only | PRESENT | C: `primitives.ts:64` | EVIDENCED | PASS |
| N-130 | §10.1 | `assessed_at` and `decided_at` refer to actions of a specific domain | MUST | CORE-001 | field refs; records carry domain | PRESENT | C: `primitives.ts:64`, `assessment.ts:30` | EVIDENCED | PASS |
| N-131 | §10.1 | UIA does not assume a single global trusted time | MUST NOT | CORE-001 | no clock; explicit context | PRESENT | C: `temporal.ts`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-132 | §10.2 | A domain must determine which time moment is used for an operation | MUST | CORE-001 | required `TemporalContext.basis` | PRESENT | C: `temporal.ts:35`; T: `acceptance.test.ts` | EVIDENCED | PASS |
| N-133 | §10.2 | Historical signature checking and future authorization may use different temporal rules | MAY | CORE-001 | separate policy callback | PRESENT | C: `credential.ts:93`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-134 | §10.2 | Revocation after signing does not automatically invalidate the historical signature | MUST NOT | CORE-001 | revocation reason and time govern | PRESENT | C: `credential.ts:460`; T: `credential.test.ts` | EVIDENCED | PASS |
| N-135 | §10.2 | Later confirmed compromise may make a historical signature unusable | MAY | CORE-001 | D-3 path | PRESENT | C: `credential.ts:441`; T: D-3 | EVIDENCED | PASS |
| N-136 | §10.3 | JIT execution authorization and TOCTOU handling belong to CORE-003 | BOUNDARY | CORE-003 boundary | not implemented | N/A | C: none | N/A | PASS |

## §11 — Local graph evaluation and federation

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-137 | §11.1 | A child descriptor received before its parent must be stored, and the parent link retained | MUST | CORE-001 | graph preserves declarations | PRESENT | C: `lineage.ts:340`; T: `lineage-graph.test.ts::delayed parents` | EVIDENCED | PASS |
| N-138 | §11.1 | Local evaluation must record the unresolved parent (`PARENT_UNRESOLVED`) | MUST | CORE-001 | no API creates such an assessment; code exists only as an error literal | ABSENT | C: `errors.ts:17`; T: `c.test.ts` todo | NONE | NOT COVERED |
| N-139 | §11.1 | A declaration must not be deleted or changed only because a parent is missing | MUST NOT | CORE-001 | no deletion; immutable | PRESENT | C: `lineage.ts:340`; T: `lineage-graph.test.ts` | EVIDENCED | PASS |
| N-140 | §11.1 | After the parent arrives, the domain may issue a new assessment | MAY | CORE-001 | no assessment-issuing API; graph rebuild only | ABSENT | C: none | NONE | NOT COVERED |
| N-141 | §11.2 | The local graph must be checked for cycles | MUST | CORE-001 | SCC detection | PRESENT | C: `lineage.ts:278`; T: `lineage-graph.test.ts` | EVIDENCED | PASS |
| N-142 | §11.2 | On a cycle, the original declarations are preserved | MUST | CORE-001 | no deletion | PRESENT | C: `lineage.ts:340`; T: `lineage-graph.test.ts` | EVIDENCED | PASS |
| N-143 | §11.2 | An Assessment records `CYCLE_DETECTED` | MUST | CORE-001 | traversal returns `CYCLE_DETECTED`; no assessment records it | PARTIAL | C: `traversal.ts:486`; T: `c.test.ts` todo | NONE | NOT COVERED |
| N-144 | §11.2 | A cycle is not accepted as valid proof of continuity | MUST | CORE-001 | cyclic paths never eligible | PRESENT | C: `traversal.ts:484`; T: P8 | EVIDENCED | PASS |
| N-145 | §11.2 | The domain must not apply grants dependent on such continuity | MUST NOT | CORE-003 boundary | no grant API exists; downstream behavior cannot be observed | ABSENT | C: none | NONE | BLOCKED |
| N-146 | §11.2 | The domain may continue in read-only or non-consequential mode | MAY | CORE-001 / host | host policy; not modelled | N/A | C: none | N/A | PASS |
| N-147 | §11.2 | Cycle detection does not require global blocking or deletion | MUST NOT | CORE-001 | no blocking or deletion API | PRESENT | C: `lineage.ts:340`; T: `lineage-graph.test.ts` | EVIDENCED | PASS |
| N-148 | §11.3 | Each domain decides trusted assessors, accepted assessments, relations, versions and conflict consequences | MUST | CORE-001 | per-call policy; no global state | PRESENT | C: `assessment.ts:45`; T: `assessment.test.ts` | EVIDENCED | PASS |

## §13 — Forbidden side effects

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-149 | §13 #1 | Lineage does not create an Authority Grant | MUST NOT | CORE-001 | no grant API | PRESENT | C: `src/core/index.ts`; T: P9, A-1 | EVIDENCED | PASS |
| N-150 | §13 #2 | Credential does not create an Authority Grant | MUST NOT | CORE-001 | no grant API | PRESENT | C: `src/core/index.ts`; T: P9 | EVIDENCED | PASS |
| N-151 | §13 #3 | Assessment does not create an Authority Grant | MUST NOT | CORE-001 | no grant API | PRESENT | C: `src/core/index.ts`; T: P9, B-5 | EVIDENCED | PASS |
| N-152 | §13 #4 | Local Acceptance does not create an Authority Grant | MUST NOT | CORE-001 | no grant API | PRESENT | C: `acceptance.ts`; T: P9, D-2 | EVIDENCED | PASS |
| N-153 | §13 #5 | IdentityVersion is not changed by Runtime lifecycle events | MUST NOT | CORE-001 | separate event; immutable descriptor | PRESENT | C: `runtime.ts:161`; T: D-1 | EVIDENCED | PASS |
| N-154 | §13 #6 | Historical descriptors are not mutated by later assessments | MUST NOT | CORE-001 | copy-on-write; no mutation | PRESENT | C: `assessment.ts`, `ownership.ts:147`; T: P5, D-2 | EVIDENCED | PASS |
| N-155 | §13 #7 | Historical assessments are not overwritten by supersession | MUST NOT | CORE-001 | predecessor retained | PRESENT | C: `assessment.ts:366`; T: `assessment.test.ts`, P6 | EVIDENCED | PASS |
| N-156 | §13 #8 | Historical Rulings are not deleted when their grounds change | MUST NOT | CORE-004 boundary | no Ruling type; Local Acceptance is not a Ruling | ABSENT | C: none | NONE | BLOCKED |
| N-157 | §13 #9 | Absence of an assessment is not treated as a successful check | MUST NOT | CORE-001 | unresolved fails | PRESENT | C: `traversal.ts:402`; T: `traversal-phases.test.ts` | EVIDENCED | PASS |
| N-158 | §13 #10 | An external positive conclusion does not automatically cancel a local negative conclusion | MUST NOT | CORE-001 | trusted assessor filtering; no override | PRESENT | C: `assessment.ts:203`; T: B-5 | EVIDENCED | PASS |
| N-159 | §13 #11 | One domain's assessment is not imposed on other domains | MUST NOT | CORE-001 | per-call policy; no global store | PRESENT | C: `assessment.ts:45` | EVIDENCED | PASS |
| N-160 | §13 #12 | Conflict detection does not require global deletion of Participant or IdentityVersion | MUST NOT | CORE-001 | no deletion API | PRESENT | C: `src/core/index.ts`; T: P9 | EVIDENCED | PASS |

## §14–§16 — Boundaries and readiness

| ID | Spec | Requirement | Strength | Scope | Implementation | Impl | Verification evidence | Verif | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N-161 | §14 | CORE-001 defines identity and provenance only; CORE-002/003/004 are not implemented | BOUNDARY | CORE-002/003/004 boundary | no such modules | N/A | C: `src/core/index.ts` | EVIDENCED | PASS |
| N-162 | §14.1 | A signed event does not become automatically true or accepted | MUST NOT | CORE-002 boundary | no event acceptance model | N/A | C: none | N/A | PASS |
| N-163 | §14.2 | CORE-001 provides identifiers and context for authority mechanisms but grants nothing | BOUNDARY | CORE-003 boundary | no grant API | PRESENT | C: `src/core/index.ts`; T: P9 | EVIDENCED | PASS |
| N-164 | §14.3 | Evidence, Finding, Ruling and Examination semantics belong to CORE-004 | BOUNDARY | CORE-004 boundary | no such types | N/A | C: none | N/A | PASS |
| N-165 | §15 | The listed open questions remain outside CORE-001 | BOUNDARY | all | not implemented, by design | N/A | C: none | N/A | PASS |
| N-166 | §16 | All structural Category A tests pass | READINESS | CORE-001 | A-1…A-5 | PRESENT | T: `a.test.ts` | EVIDENCED | PASS |
| N-167 | §16 | All Authority Binding and Traversal Category B tests pass | READINESS | CORE-001 | B-1…B-7 | PRESENT | T: `b.test.ts` | EVIDENCED | PASS |
| N-168 | §16 | All Federation Category C tests pass | READINESS | CORE-001 | C-1/C-2 not implemented | ABSENT | T: `c.test.ts` todo | NONE | NOT COVERED |
| N-169 | §16 | All Cross-Spec Category D tests pass | READINESS | CORE-001 / CORE-004 | D-1, D-3, D-4 pass; D-2 uses Local Acceptance instead of a Ruling | PARTIAL | T: `d.test.ts` | PARTIAL | PARTIAL |
| N-170 | §16 | Independent implementations produce the same Path Discovery and Merge Closure results | READINESS | external | no second implementation | ABSENT | none | NONE | NOT COVERED |
| N-171 | §16 | Results do not depend on storage or delivery order | READINESS | CORE-001 | canonical sorting | PRESENT | T: B-7, P1–P3 | EVIDENCED | PASS |
| N-172 | §16 | Missing and contradictory assessments have been checked | READINESS | CORE-001 | missing checked; contradiction blocked | PARTIAL | T: B-2, B-4; A-4b | PARTIAL | PARTIAL |
| N-173 | §16 | Temporal credential revocation cases have been checked | READINESS | CORE-001 | D-3, D-4 | PRESENT | T: `credential.test.ts`, D-3, D-4 | EVIDENCED | PASS |
| N-174 | §16 | Immutability of historical descriptors, assessments and rulings has been checked | READINESS | CORE-001 / CORE-004 | descriptors and assessments checked; no Ruling | PARTIAL | T: P5, P6, D-2 | PARTIAL | PARTIAL |
| N-175 | §16 | Independent semantic compatibility of two implementations has been checked | READINESS | external | not performed | ABSENT | none | NONE | NOT COVERED |

## Summary

| Status | Count |
| --- | --- |
| PASS | 154 |
| PARTIAL | 7 |
| BLOCKED | 8 |
| NOT COVERED | 6 |
| FAIL | 0 |
| **Total** | **175** |

The counts are a rollup of the rows above. `PASS` includes boundary requirements that are satisfied by explicit absence of an out-of-scope mechanism; those rows state that evidence in the `Verification evidence` column. No requirement is marked `FAIL`: no normative violation was demonstrated. `PARTIAL`, `BLOCKED` and `NOT COVERED` prevent a full-conformance claim.
