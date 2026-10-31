// Minimal descriptor types and structural validation for Task 4.
//
// Scope is deliberately narrow: only the records referenced by the §7.1
// hashing projection — IdentityVersionDescriptor, CredentialDescriptor and
// LineageLink. ParticipantRecord, RuntimeInstanceDescriptor, registries, the
// lineage graph and normative lineage rules belong to later tasks.
//
// This validator establishes the boundary contract required by Task 4:
// strict JSON, required fields present and well-typed, unknown fields
// rejected, optional fields either absent or valid (never present-undefined),
// and an owned, deep-frozen copy on success.

import type { Result } from './errors.js';
import { invalidInput as invalid, requireNonEmptyString, requireString } from './validation.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze, validateJsonValue } from './ownership.js';
import type {
  CredentialID,
  DomainID,
  IdentityVersionID,
  JsonValue,
  ParticipantID,
  RuntimeInstanceID,
  Timestamp,
} from './primitives.js';

export type VersionScheme = 'SEMVER_2' | 'CONTENT_HASH' | 'OPAQUE_TAG';

export type CredentialUsage = 'AUTHENTICATION' | 'SIGNING' | 'ENCRYPTION';

export type LineageRelationType = 'CONTINUATION' | 'FORKED_FROM' | 'MERGED_FROM';

export type ParticipantKind = 'HUMAN' | 'AGENT' | 'SERVICE' | 'EXTERNAL_SYSTEM';

export interface ParticipantRecord {
  id: ParticipantID;

  kind: ParticipantKind;

  home_domain: DomainID;

  registered_at: Timestamp;
}

export interface RuntimeInstanceDescriptor {
  id: RuntimeInstanceID;

  identity_version_id: IdentityVersionID;

  execution_context_ref: string;

  ephemeral_public_key?: string;

  instantiated_at: Timestamp;
}

export interface CredentialDescriptor {
  credential_id: CredentialID;

  issuer_domain: DomainID;

  usage: CredentialUsage[];

  algorithm_family: string;

  public_key_canonical: string;

  not_before: Timestamp;
  not_after?: Timestamp;

  revocation_endpoint_ref?: string;
}

export interface LineageLink {
  parent_version_id: IdentityVersionID;

  relation: LineageRelationType;

  declared_rationale?: string;

  continuity_proof_ref?: string;
}

export interface IdentityVersionDescriptor {
  id: IdentityVersionID;
  participant_id: ParticipantID;

  version_label: string;
  version_scheme: VersionScheme;

  declared_protocols: string[];

  public_credentials: CredentialDescriptor[];

  lineage: LineageLink[];

  published_at: Timestamp;
}

const DESCRIPTOR_FIELDS: readonly string[] = [
  'id',
  'participant_id',
  'version_label',
  'version_scheme',
  'declared_protocols',
  'public_credentials',
  'lineage',
  'published_at',
];

const PARTICIPANT_FIELDS: readonly string[] = ['id', 'kind', 'home_domain', 'registered_at'];

const RUNTIME_FIELDS: readonly string[] = [
  'id',
  'identity_version_id',
  'execution_context_ref',
  'ephemeral_public_key',
  'instantiated_at',
];

const CREDENTIAL_FIELDS: readonly string[] = [
  'credential_id',
  'issuer_domain',
  'usage',
  'algorithm_family',
  'public_key_canonical',
  'not_before',
  'not_after',
  'revocation_endpoint_ref',
];

const LINEAGE_FIELDS: readonly string[] = [
  'parent_version_id',
  'relation',
  'declared_rationale',
  'continuity_proof_ref',
];

export const VERSION_SCHEMES: readonly VersionScheme[] = ['SEMVER_2', 'CONTENT_HASH', 'OPAQUE_TAG'];

const CREDENTIAL_USAGES: readonly CredentialUsage[] = ['AUTHENTICATION', 'SIGNING', 'ENCRYPTION'];

const LINEAGE_RELATIONS: readonly LineageRelationType[] = ['CONTINUATION', 'FORKED_FROM', 'MERGED_FROM'];

const PARTICIPANT_KINDS: readonly ParticipantKind[] = ['HUMAN', 'AGENT', 'SERVICE', 'EXTERNAL_SYSTEM'];

type JsonObject = { readonly [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(value: JsonObject, allowed: readonly string[], path: string): Result<void> {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return invalid(`${path}.${key}`, 'unknown field');
    }
  }
  return { ok: true, value: undefined };
}

function requireObject(value: JsonValue | undefined, path: string): Result<JsonObject> {
  if (value === undefined || !isJsonObject(value)) {
    return invalid(path, 'expected object');
  }
  return { ok: true, value };
}

function optionalString(value: JsonValue | undefined, path: string): Result<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requireString(value, path);
}

function requireTimestamp(value: JsonValue | undefined, path: string): Result<Timestamp> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(path, 'expected finite timestamp');
  }
  return { ok: true, value: value as Timestamp };
}

function optionalTimestamp(value: JsonValue | undefined, path: string): Result<Timestamp | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requireTimestamp(value, path);
}

function requireEnum<T extends string>(value: JsonValue | undefined, allowed: readonly T[], path: string): Result<T> {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return invalid(path, `expected one of: ${allowed.join(', ')}`);
  }
  return { ok: true, value: value as T };
}

function requireStringArray(value: JsonValue | undefined, path: string): Result<string[]> {
  if (!Array.isArray(value)) {
    return invalid(path, 'expected array of strings');
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = requireString(value[i], `${path}[${i}]`);
    if (!item.ok) return item;
    out.push(item.value);
  }
  return { ok: true, value: out };
}

function requireObjectArray(value: JsonValue | undefined, path: string): Result<JsonObject[]> {
  if (!Array.isArray(value)) {
    return invalid(path, 'expected array of objects');
  }
  const out: JsonObject[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = requireObject(value[i], `${path}[${i}]`);
    if (!item.ok) return item;
    out.push(item.value);
  }
  return { ok: true, value: out };
}

function requireEnumArray<T extends string>(
  value: JsonValue | undefined,
  allowed: readonly T[],
  path: string,
): Result<T[]> {
  if (!Array.isArray(value)) {
    return invalid(path, 'expected array');
  }
  const out: T[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = requireEnum(value[i], allowed, `${path}[${i}]`);
    if (!item.ok) return item;
    out.push(item.value);
  }
  return { ok: true, value: out };
}

function validateCredential(value: JsonValue, path: string): Result<CredentialDescriptor> {
  const object = requireObject(value, path);
  if (!object.ok) return object;

  const known = rejectUnknownFields(object.value, CREDENTIAL_FIELDS, path);
  if (!known.ok) return known;

  const credentialId = requireNonEmptyString(object.value.credential_id, `${path}.credential_id`);
  if (!credentialId.ok) return credentialId;

  const issuerDomain = requireNonEmptyString(object.value.issuer_domain, `${path}.issuer_domain`);
  if (!issuerDomain.ok) return issuerDomain;

  const usage = requireEnumArray(object.value.usage, CREDENTIAL_USAGES, `${path}.usage`);
  if (!usage.ok) return usage;
  const usages: CredentialUsage[] = usage.value;

  const algorithmFamily = requireNonEmptyString(object.value.algorithm_family, `${path}.algorithm_family`);
  if (!algorithmFamily.ok) return algorithmFamily;

  const publicKey = requireNonEmptyString(object.value.public_key_canonical, `${path}.public_key_canonical`);
  if (!publicKey.ok) return publicKey;

  const notBefore = requireTimestamp(object.value.not_before, `${path}.not_before`);
  if (!notBefore.ok) return notBefore;

  const notAfter = optionalTimestamp(object.value.not_after, `${path}.not_after`);
  if (!notAfter.ok) return notAfter;

  const revocationRef = optionalString(object.value.revocation_endpoint_ref, `${path}.revocation_endpoint_ref`);
  if (!revocationRef.ok) return revocationRef;

  const credential: CredentialDescriptor = {
    credential_id: credentialId.value as CredentialID,
    issuer_domain: issuerDomain.value as DomainID,
    usage: usages,
    algorithm_family: algorithmFamily.value,
    public_key_canonical: publicKey.value,
    not_before: notBefore.value,
  };
  if (notAfter.value !== undefined) {
    credential.not_after = notAfter.value;
  }
  if (revocationRef.value !== undefined) {
    credential.revocation_endpoint_ref = revocationRef.value;
  }
  return { ok: true, value: credential };
}

function validateLineageLinkAt(value: JsonValue, path: string): Result<LineageLink> {
  const object = requireObject(value, path);
  if (!object.ok) return object;

  const known = rejectUnknownFields(object.value, LINEAGE_FIELDS, path);
  if (!known.ok) return known;

  const parent = requireNonEmptyString(object.value.parent_version_id, `${path}.parent_version_id`);
  if (!parent.ok) return parent;

  const relation = requireEnum(object.value.relation, LINEAGE_RELATIONS, `${path}.relation`);
  if (!relation.ok) return relation;

  const rationale = optionalString(object.value.declared_rationale, `${path}.declared_rationale`);
  if (!rationale.ok) return rationale;

  const proofRef = optionalString(object.value.continuity_proof_ref, `${path}.continuity_proof_ref`);
  if (!proofRef.ok) return proofRef;

  const link: LineageLink = {
    parent_version_id: parent.value as IdentityVersionID,
    relation: relation.value,
  };
  if (rationale.value !== undefined) {
    link.declared_rationale = rationale.value;
  }
  if (proofRef.value !== undefined) {
    link.continuity_proof_ref = proofRef.value;
  }
  return { ok: true, value: link };
}

function validateCredentialList(value: JsonValue | undefined): Result<CredentialDescriptor[]> {
  const list = requireObjectArray(value, '$.public_credentials');
  if (!list.ok) return list;

  const credentials: CredentialDescriptor[] = [];
  for (let i = 0; i < list.value.length; i += 1) {
    const credential = validateCredential(list.value[i], `$.public_credentials[${i}]`);
    if (!credential.ok) return credential;
    credentials.push(credential.value);
  }
  return { ok: true, value: credentials };
}

function validateLineageList(value: JsonValue | undefined): Result<LineageLink[]> {
  const list = requireObjectArray(value, '$.lineage');
  if (!list.ok) return list;

  const links: LineageLink[] = [];
  for (let i = 0; i < list.value.length; i += 1) {
    const link = validateLineageLinkAt(list.value[i], `$.lineage[${i}]`);
    if (!link.ok) return link;
    links.push(link.value);
  }
  return { ok: true, value: links };
}

/**
 * Validates an untrusted value as an IdentityVersionDescriptor and returns an
 * owned, deeply frozen copy. Rejects present-`undefined` properties (via strict
 * JSON validation) and unknown fields at every level.
 *
 * Deliberately does not enforce normative lineage semantics (cardinality,
 * relation constraints, version-label grammar): those belong to later tasks.
 */
export function validateIdentityVersionDescriptor(value: unknown): Result<DeepReadonly<IdentityVersionDescriptor>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;

  const object = requireObject(json.value, '$');
  if (!object.ok) return object;

  const known = rejectUnknownFields(object.value, DESCRIPTOR_FIELDS, '$');
  if (!known.ok) return known;

  const id = requireNonEmptyString(object.value.id, '$.id');
  if (!id.ok) return id;

  const participant = requireNonEmptyString(object.value.participant_id, '$.participant_id');
  if (!participant.ok) return participant;

  const versionLabel = requireNonEmptyString(object.value.version_label, '$.version_label');
  if (!versionLabel.ok) return versionLabel;

  const versionScheme = requireEnum(object.value.version_scheme, VERSION_SCHEMES, '$.version_scheme');
  if (!versionScheme.ok) return versionScheme;

  const protocols = requireStringArray(object.value.declared_protocols, '$.declared_protocols');
  if (!protocols.ok) return protocols;

  const credentials = validateCredentialList(object.value.public_credentials);
  if (!credentials.ok) return credentials;

  const lineage = validateLineageList(object.value.lineage);
  if (!lineage.ok) return lineage;

  const publishedAt = requireTimestamp(object.value.published_at, '$.published_at');
  if (!publishedAt.ok) return publishedAt;

  const descriptor: IdentityVersionDescriptor = {
    id: id.value as IdentityVersionID,
    participant_id: participant.value as ParticipantID,
    version_label: versionLabel.value,
    version_scheme: versionScheme.value,
    declared_protocols: protocols.value,
    public_credentials: credentials.value,
    lineage: lineage.value,
    published_at: publishedAt.value,
  };
  return { ok: true, value: deepFreeze(descriptor) };
}

/**
 * Validates an untrusted value as a ParticipantRecord (§3.1) and returns an
 * owned, deeply frozen copy. Unknown fields and present-`undefined` values are
 * rejected, never coerced.
 */
export function validateParticipantRecord(value: unknown): Result<DeepReadonly<ParticipantRecord>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;

  const object = requireObject(json.value, '$');
  if (!object.ok) return object;

  const known = rejectUnknownFields(object.value, PARTICIPANT_FIELDS, '$');
  if (!known.ok) return known;

  const id = requireNonEmptyString(object.value.id, '$.id');
  if (!id.ok) return id;

  const kind = requireEnum(object.value.kind, PARTICIPANT_KINDS, '$.kind');
  if (!kind.ok) return kind;

  const homeDomain = requireNonEmptyString(object.value.home_domain, '$.home_domain');
  if (!homeDomain.ok) return homeDomain;

  const registeredAt = requireTimestamp(object.value.registered_at, '$.registered_at');
  if (!registeredAt.ok) return registeredAt;

  return {
    ok: true,
    value: deepFreeze({
      id: id.value as ParticipantID,
      kind: kind.value,
      home_domain: homeDomain.value as DomainID,
      registered_at: registeredAt.value,
    }),
  };
}

/**
 * Validates an untrusted value as a CredentialDescriptor (§4.2) and returns an
 * owned, deeply frozen copy. Reuses the credential validation used by §3.2
 * descriptors; there is no second validation path.
 */
export function validateCredentialDescriptor(value: unknown): Result<DeepReadonly<CredentialDescriptor>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;

  const credential = validateCredential(json.value, '$');
  if (!credential.ok) return credential;

  return { ok: true, value: deepFreeze(credential.value) };
}

/**
 * Validates an untrusted value as a LineageLink (§5.1) and returns an owned,
 * deeply frozen copy. Structural lineage rules (cardinality, self-parent,
 * participant constraints) belong to `validateDescriptor`, not here.
 */
export function validateLineageLink(value: unknown): Result<DeepReadonly<LineageLink>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;

  const link = validateLineageLinkAt(json.value, '$');
  if (!link.ok) return link;

  return { ok: true, value: deepFreeze(link.value) };
}

/**
 * Validates an untrusted value as a RuntimeInstanceDescriptor (§3.3) and
 * returns an owned, deeply frozen copy. Runtime lifecycle events are CORE-002.
 */
export function validateRuntimeInstanceDescriptor(value: unknown): Result<DeepReadonly<RuntimeInstanceDescriptor>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;

  const object = requireObject(json.value, '$');
  if (!object.ok) return object;

  const known = rejectUnknownFields(object.value, RUNTIME_FIELDS, '$');
  if (!known.ok) return known;

  const id = requireNonEmptyString(object.value.id, '$.id');
  if (!id.ok) return id;

  const identityVersionId = requireNonEmptyString(object.value.identity_version_id, '$.identity_version_id');
  if (!identityVersionId.ok) return identityVersionId;

  const executionContext = requireNonEmptyString(object.value.execution_context_ref, '$.execution_context_ref');
  if (!executionContext.ok) return executionContext;

  const ephemeralKey = optionalString(object.value.ephemeral_public_key, '$.ephemeral_public_key');
  if (!ephemeralKey.ok) return ephemeralKey;

  const instantiatedAt = requireTimestamp(object.value.instantiated_at, '$.instantiated_at');
  if (!instantiatedAt.ok) return instantiatedAt;

  const descriptor: RuntimeInstanceDescriptor = {
    id: id.value as RuntimeInstanceID,
    identity_version_id: identityVersionId.value as IdentityVersionID,
    execution_context_ref: executionContext.value,
    instantiated_at: instantiatedAt.value,
  };
  if (ephemeralKey.value !== undefined) {
    descriptor.ephemeral_public_key = ephemeralKey.value;
  }

  return { ok: true, value: deepFreeze(descriptor) };
}
