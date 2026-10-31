import { expect } from 'bun:test';
import type {
  CredentialDescriptor,
  IdentityVersionDescriptor,
  LineageLink,
  LineageRelationType,
  ParticipantKind,
  ParticipantRecord,
  VersionScheme,
} from '../../src/core/entities.js';
import {
  validateCredentialDescriptor,
  validateIdentityVersionDescriptor,
  validateLineageLink,
  validateParticipantRecord,
} from '../../src/core/entities.js';
import type { Registry, StructuralResult } from '../../src/core/lineage.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import { credentialId, domainId, identityVersionId, participantId, timestamp } from '../../src/core/primitives.js';

export const BASE_TIME = 1_700_000_000_000;

export function participant(id: string, kind: ParticipantKind = 'AGENT'): DeepReadonly<ParticipantRecord> {
  const result = validateParticipantRecord({
    id: participantId(id),
    kind,
    home_domain: domainId('domain-a'),
    registered_at: timestamp(BASE_TIME),
  });
  if (!result.ok) {
    throw new Error(`participant fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function credential(
  id: string,
  overrides: Partial<CredentialDescriptor> = {},
): DeepReadonly<CredentialDescriptor> {
  const result = validateCredentialDescriptor({
    credential_id: credentialId(id),
    issuer_domain: domainId('domain-a'),
    usage: ['SIGNING'],
    algorithm_family: 'ed25519',
    public_key_canonical: `pk-${id}`,
    not_before: timestamp(BASE_TIME),
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`credential fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function link(parent: string, relation: LineageRelationType = 'CONTINUATION'): DeepReadonly<LineageLink> {
  const result = validateLineageLink({
    parent_version_id: identityVersionId(parent),
    relation,
  });
  if (!result.ok) {
    throw new Error(`lineage fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function descriptor(input: {
  readonly id: string;
  readonly participant: string;
  readonly lineage?: readonly DeepReadonly<LineageLink>[];
  readonly credentials?: readonly DeepReadonly<CredentialDescriptor>[];
  readonly versionLabel?: string;
  readonly versionScheme?: VersionScheme;
}): DeepReadonly<IdentityVersionDescriptor> {
  const result = validateIdentityVersionDescriptor({
    id: identityVersionId(input.id),
    participant_id: participantId(input.participant),
    version_label: input.versionLabel ?? '1.0.0',
    version_scheme: input.versionScheme ?? 'SEMVER_2',
    declared_protocols: [],
    public_credentials: input.credentials ?? [],
    lineage: input.lineage ?? [],
    published_at: timestamp(BASE_TIME),
  });
  if (!result.ok) {
    throw new Error(`descriptor fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function registry(
  participants: readonly DeepReadonly<ParticipantRecord>[],
  versions: readonly DeepReadonly<IdentityVersionDescriptor>[],
): Registry {
  return {
    participants: () => participants,
    versions: () => versions,
  };
}

/** Stable JSON snapshot used to prove the validator does not mutate Registry contents. */
export function snapshot(registryValue: Registry): string {
  return JSON.stringify([registryValue.participants(), registryValue.versions()]);
}

export function expectRejected(
  result: StructuralResult,
  code: 'ERR_INVALID_RELATION' | 'ERR_INVALID_CARDINALITY',
  parentVersionId?: string,
): void {
  expect(result.status).toBe('REJECTED');
  if (result.status !== 'REJECTED') {
    return;
  }
  expect(result.code).toBe(code);
  if (parentVersionId === undefined) {
    expect('parent_version_id' in result).toBe(false);
  } else {
    expect(result.parent_version_id as string | undefined).toBe(parentVersionId);
  }
}
