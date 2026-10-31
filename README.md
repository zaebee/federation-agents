# UIA — Universal Identity Architecture

**Identity. Provenance. Trust. Without inherited authority.**

UIA is an architectural and protocol initiative for identity, provenance, and trust in federated environments.

It explores how humans, AI agents, services, and external systems can establish persistent identities, publish immutable identity versions, declare relationships between versions, and let independent domains evaluate those declarations under their own policies.

The central idea is simple:

**Identity is not authority. Provenance is not proof. Trust is not universal.**

This repository (`federation-agents`) contains the TypeScript reference implementation of the first normative module, `UIA-CORE-001 Rev 0.3.3` (package `uia-core-001-refimpl`).

## The problem

Federated systems increasingly consist of independently operated participants: humans, autonomous agents, services, organizations, and external systems.

Traditional identity and authentication mechanisms answer important but limited questions:

- Which identifier is being presented?
- Does a signature correspond to a public key?
- Is a credential currently valid?
- Has an identity been recognized by a particular provider?

But federation introduces additional questions:

- Is this identity version a continuation of another?
- What evidence supports that claim?
- Which parts of the claimed provenance have actually been verified?
- Can a domain evaluate an identity without trusting the domain that originally issued it?
- Can a participant evolve, fork, or merge without implicitly inheriting authority?
- Can historical decisions remain intact when new evidence appears?

UIA investigates the protocol foundations needed to answer these questions explicitly.

## Core architectural principles

### 1. Identity and authority are separate

A Participant or IdentityVersion does not automatically possess capabilities, permissions, or authority.

Authority requires a separate, explicit mechanism.

### 2. Identity versions are immutable

An IdentityVersion is a snapshot of declared identity properties.

Changes produce new versions. Historical descriptors are never silently rewritten.

### 3. Provenance is explicitly declared

Identity versions can declare relationships such as:

- `CONTINUATION`
- `FORKED_FROM`
- `MERGED_FROM`

These relationships form an Identity Lineage Graph.

A lineage declaration is not automatically evidence that the declared relationship is true.

### 4. Assessment is separate from declaration

Domains can independently evaluate provenance claims.

Assessments preserve the distinction between verified claims, unverified claims, and unresolved conditions.

One domain's assessment does not dictate another domain's conclusion.

### 5. Acceptance is local

A domain may recognize an identity version for a particular context under its own policies.

Local Acceptance is not universal trust and does not automatically grant authority.

### 6. History is preserved

Assessments, revocations, lifecycle events, and acceptance decisions are separate artifacts.

New information can change future evaluations without rewriting historical records.

### 7. Uncertainty must remain explicit

Missing evidence is not proof of failure.

A valid cryptographic signature is not proof of the truth of its payload.

An unavailable verification mechanism is not equivalent to a negative verification result.

UIA aims to preserve these distinctions instead of collapsing them into a single trust score.

## Current implementation

The implementation is developed incrementally against the normative specification, with unit and conformance suites; property-based tests are part of the implementation plan.

Implemented so far:

- Strict TypeScript domain primitives: branded identifiers, temporal field references, a strict JSON data model.
- Immutable, deeply readonly domain records: structural deep copy at construction, recursive deep freeze, rejection of unsupported values.
- Explicit separation of normative protocol errors (`ERR_INVALID_RELATION`, `ERR_NO_TRAVERSAL_PATH`, …) from implementation/mechanism errors.
- RFC 8785 JSON Canonicalization Scheme over a strict data model.
- Pure TypeScript SHA-256, with no runtime crypto dependency.
- IdentityVersion descriptor types with structural validation: required fields and enum values, strict JSON, unknown-field rejection, and an owned, deep-frozen copy.
- Entity constructors for §3–§5 — Participant, IdentityVersion, RuntimeInstance, Credential and Lineage records — all owned and deeply frozen.
- Structural lineage validation (§5.2): per-relation cardinality, distinct merge parents, the `CONTINUATION` same-participant constraint, and self-parent rejection, covered by the A-1…A-5 conformance cases.
- Lineage graph construction: preserved declarations, delayed-parent resolution with `unresolvedParents`, and deterministic strongly connected component cycle detection (graph-level C-1/C-2; binding-level recording remains open).
- Continuity assessments: edge-bound applicability, policy narrowing without expansion, trusted-assessor filtering, spec-literal unverified-claim semantics, explicit-only `CONTESTED`, and copy-on-write supersession.
- Conditional version binding and three-phase traversal (§8): scope-filtered path discovery, per-path validation, and immediate merge closure over every direct parent edge of merge nodes on a path.
- §12 B-series conformance (B-1…B-7), including per-path outcomes and the trusted-assessor refusal in B-5.
- Descriptor hashing over the explicit §7.1 projection, pinned by a known-answer test.
- Version label validation: strict SemVer 2.0.0 for `SEMVER_2`, non-empty labels for `CONTENT_HASH` and `OPAQUE_TAG` (no format or ordering inferred).
- The versioned `uia-ref-selector@1` mechanism — exact match, wildcard, comparators, `&&` composition — with factory-provenance checks on compiled selectors.

Still to come:

- Credential semantics and temporal validation.
- Local Acceptance and lifecycle semantics.
- The remaining §12 conformance corpus (C-1/C-2 and the D-series) and property-based invariance tests.

Implementation progress is tracked task by task in the implementation plan. Not every capability described in the specification is necessarily implemented in the current repository state.

## Getting started

Requirements: Bun 1.4.x.

```bash
bun install

bun test              # unit tests (bun:test)
bun run typecheck     # tsc, including the runtime-free core configuration
bun run lint          # eslint
bun run format:check  # prettier, check only (bun run format writes)
bun run build         # emit ./build
```

Repository layout:

| Path           | Contents                                                          |
| -------------- | ----------------------------------------------------------------- |
| `src/core/`    | Runtime-independent domain core — no `node:*`, no `bun:*` imports |
| `src/index.ts` | Public API barrel                                                 |
| `tests/unit/`  | Unit suites (`bun:test`)                                          |
| `docs/`        | Normative specification, PRD, implementation plan                 |

## Technology

- TypeScript 5.9, strict, ESM via `NodeNext`
- Bun 1.4.x for development, package management, and testing
- Pure TypeScript Core implementation
- RFC 8785 canonicalization
- SHA-256
- `fast-check` for property-based testing
- ESLint 9 + Prettier

Bun is the development and test environment, not part of UIA's domain semantics.

The Core is designed to remain portable across JavaScript runtimes: `src/core/` uses no runtime-specific APIs, and `tsconfig.core.json` typechecks it without Bun or Node types.

Runtime dependencies: none.

## Documentation

| Document                                                                                | Question it answers                                                        |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `README.md`                                                                             | What is this project and why does it exist?                                |
| `docs/PRD.md`                                                                           | What problem are we solving, for whom, and what should the project become? |
| `docs/CORE-001.md`                                                                      | Which semantic and technical contracts are implemented?                    |
| `docs/ARCHITECTURE.md`                                                                  | How is the implementation structured, and where are its boundaries?        |
| `docs/THREAT-MODEL.md`                                                                  | What do we protect, from whom, and what remains unmitigated?               |
| `docs/ROADMAP.md`                                                                       | In what order do the protocol and the implementation develop?              |
| [Implementation plan](docs/superpowers/plans/2026-10-30-uia-core-001-implementation.md) | Which implementation tasks remain?                                         |

The normative specification and implementation are deliberately kept separate.

An implementation mechanism must not silently become a new protocol rule.

The normative specification is currently written in Russian; this README and the PRD are in English.

## Non-goals

UIA-CORE-001 does not attempt to:

- Establish universal trust between domains.
- Create a global identity authority.
- Automatically transfer permissions between identity versions.
- Prove the truth of arbitrary claims through cryptographic signatures.
- Define a universal reputation score.
- Force domains to accept external assessments.
- Treat identity lineage as proof of continuity or authority inheritance.

Related concerns may be addressed by separate specifications.

## Project status

**Experimental protocol and reference implementation.**

The normative specification is currently a Candidate Draft Normative document.

The reference implementation is being developed incrementally. Unit tests and the A/B conformance suites exist today; the C/D conformance cases and property-based tests are not yet present. Some semantic questions are deliberately marked BLOCKED rather than resolved through undocumented implementation assumptions.

## Design philosophy

UIA prefers explicit declarations over implicit assumptions.

It prefers independently verifiable evidence over opaque trust scores.

It preserves uncertainty rather than inventing certainty.

And it separates identity, provenance, assessment, acceptance, and authority even when combining them would be more convenient.

**The goal is not to make every domain trust the same participants. The goal is to make the basis of each domain's decisions explicit, inspectable, and independently governed.**

---

_UIA — a protocol foundation for identity and trust in federated environments._
