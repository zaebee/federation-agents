// Descriptor hashing with the explicit §7.1 projection (Task 4).
//
// The projection is deliberately field-by-field: the hash covers exactly the
// eight normative fields and never the whole descriptor object, so transport
// envelopes, signatures, ledger metadata, assessments, revocations and
// acceptance records cannot influence it.
//
// Nested records (credentials, lineage links) are projected through their own
// declared field lists for the same reason: an unknown nested property must not
// silently become part of the hash. Unknown properties are rejected earlier, at
// the descriptor validation boundary (see entities.ts).

import { canonicalize } from './canonical.js';
import type { CredentialDescriptor, IdentityVersionDescriptor, LineageLink } from './entities.js';
import { validateIdentityVersionDescriptor } from './entities.js';
import { CanonicalizationError } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import type { JsonValue } from './primitives.js';
import { sha256Hex } from './sha256.js';

type JsonObject = { [key: string]: JsonValue };

function projectCredential(credential: DeepReadonly<CredentialDescriptor>): JsonObject {
  const projected: JsonObject = {
    credential_id: credential.credential_id,
    issuer_domain: credential.issuer_domain,
    usage: credential.usage.map((usage) => usage),
    algorithm_family: credential.algorithm_family,
    public_key_canonical: credential.public_key_canonical,
    not_before: credential.not_before,
  };
  if (credential.not_after !== undefined) {
    projected.not_after = credential.not_after;
  }
  if (credential.revocation_endpoint_ref !== undefined) {
    projected.revocation_endpoint_ref = credential.revocation_endpoint_ref;
  }
  return projected;
}

function projectLineageLink(link: DeepReadonly<LineageLink>): JsonObject {
  const projected: JsonObject = {
    parent_version_id: link.parent_version_id,
    relation: link.relation,
  };
  if (link.declared_rationale !== undefined) {
    projected.declared_rationale = link.declared_rationale;
  }
  if (link.continuity_proof_ref !== undefined) {
    projected.continuity_proof_ref = link.continuity_proof_ref;
  }
  return projected;
}

/**
 * Builds the §7.1 hash input: exactly `id`, `participant_id`, `version_label`,
 * `version_scheme`, `declared_protocols`, `public_credentials`, `lineage`,
 * `published_at`.
 *
 * Re-validates the descriptor before projecting and throws
 * `CanonicalizationError` if it is not a valid descriptor (including a
 * present-`undefined` property smuggled past the boundary), rather than
 * silently omitting fields or hashing a subset of a wrapper object.
 */
export function descriptorHashInput(descriptor: DeepReadonly<IdentityVersionDescriptor>): JsonValue {
  const validated = validateIdentityVersionDescriptor(descriptor);
  if (!validated.ok) {
    throw new CanonicalizationError(validated.error.message);
  }
  const source = validated.value;

  return {
    id: source.id,
    participant_id: source.participant_id,
    version_label: source.version_label,
    version_scheme: source.version_scheme,
    declared_protocols: source.declared_protocols.map((protocol) => protocol),
    public_credentials: source.public_credentials.map(projectCredential),
    lineage: source.lineage.map(projectLineageLink),
    published_at: source.published_at,
  };
}

/**
 * Returns `urn:hash:sha256:<64 lowercase hex>` for the §7.1 projection.
 *
 * Uses the Task 3 canonicalization and SHA-256 implementations; no runtime
 * crypto APIs are involved.
 */
export function descriptorHash(descriptor: DeepReadonly<IdentityVersionDescriptor>): `urn:hash:sha256:${string}` {
  const canonical = canonicalize(descriptorHashInput(descriptor));
  const digest = sha256Hex(new TextEncoder().encode(canonical));
  return `urn:hash:sha256:${digest}`;
}
