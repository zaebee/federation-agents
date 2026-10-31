import { describe, test, expect } from 'bun:test';
import { isOk, isFailure, mechanismFailure, specFailure, CanonicalizationError } from '../../src/core/errors.js';
import {
  validateCredentialDescriptor,
  validateIdentityVersionDescriptor,
  validateLineageLink,
  validateParticipantRecord,
  validateRuntimeInstanceDescriptor,
} from '../../src/core/entities.js';
import {
  credentialId,
  domainId,
  identityVersionId,
  participantId,
  runtimeInstanceId,
  timestamp,
} from '../../src/core/primitives.js';
import { BASE_TIME, credential, participant } from '../support/fixtures.js';
import type {
  UiaErrorCode,
  ImplementationErrorCode,
  SpecFailure,
  MechanismFailure,
  Failure,
  Result,
} from '../../src/core/errors.js';
import type { DeepReadonly } from '../../src/core/ownership.js';

// Type-level: UiaErrorCode is the exact 8-code union. We assert assignability by
// constructing a value of each code (compile-time check via tsc).
const NORMATIVE_CODES: readonly UiaErrorCode[] = [
  'ERR_INVALID_RELATION',
  'ERR_INVALID_CARDINALITY',
  'ERR_NO_TRAVERSAL_PATH',
  'ERR_MERGE_BRANCH_UNSATISFIED',
  'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
  'ERR_AUTHORITY_BINDING_MISMATCH',
  'CYCLE_DETECTED',
  'PARENT_UNRESOLVED',
];

test('error model: all eight normative codes are assignable to UiaErrorCode', () => {
  expect(NORMATIVE_CODES).toHaveLength(8);
  for (const code of NORMATIVE_CODES) {
    const f: SpecFailure = specFailure(code, 'msg');
    expect(f.kind).toBe('SPEC');
    expect(f.code).toBe(code);
  }
});

test('error model: mechanism codes belong to ImplementationErrorCode, not UiaErrorCode', () => {
  const mech: ImplementationErrorCode = 'S_SELECTOR_INCOMPATIBLE_SCHEME';
  const f: MechanismFailure = mechanismFailure(mech, 'msg');
  expect(f.kind).toBe('MECHANISM');
  expect(f.code).toBe(mech);

  const mech2: ImplementationErrorCode = 'E_APPLICABLE_ASSESSMENTS_UNBRANDED';
  expect(mechanismFailure(mech2, 'msg').code).toBe(mech2);
});

test('error model: Result narrows via discriminant', () => {
  const ok: Result<number> = { ok: true, value: 42 };
  const bad: Result<number> = { ok: false, error: specFailure('CYCLE_DETECTED', 'cycle') };

  if (isOk(ok)) {
    // narrowed
    const v: number = ok.value;
    expect(v).toBe(42);
  } else {
    throw new Error('expected ok');
  }

  if (isFailure(bad)) {
    const e: Failure = bad.error;
    expect(e.kind).toBe('SPEC');
    if (e.kind === 'SPEC') {
      expect(e.code).toBe('CYCLE_DETECTED');
    }
  } else {
    throw new Error('expected failure');
  }
});

test('error model: SpecFailure and MechanismFailure are distinguishable', () => {
  const spec: Failure = specFailure('PARENT_UNRESOLVED', 'unresolved');
  const mech: Failure = mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'unsupported');
  expect(spec.kind).toBe('SPEC');
  expect(mech.kind).toBe('MECHANISM');
  // kind discriminates
  if (spec.kind === 'SPEC') expect(spec.code).toBe('PARENT_UNRESOLVED');
  if (mech.kind === 'MECHANISM') expect(mech.code).toBe('E_OWNERSHIP_UNSUPPORTED');
});

test('error model: CanonicalizationError is an Error subclass', () => {
  const e = new CanonicalizationError('boom');
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe('CanonicalizationError');
  expect(e.message).toBe('boom');
});

// Type-level: DeepReadonly is exported and assignable (compile-time check).
const _deepReadonlyCheck: DeepReadonly<{ a: { b: number[] } }> = { a: { b: [1, 2] } };
void _deepReadonlyCheck;

// Type-level negative: a mechanism error code is not assignable to UiaErrorCode.
// @ts-expect-error intentional type error
const _badNormativeCode: UiaErrorCode = 'E_OWNERSHIP_UNSUPPORTED';
void _badNormativeCode;

function rawCredential(): Record<string, unknown> {
  return {
    credential_id: credentialId('cred-1'),
    issuer_domain: domainId('domain-a'),
    usage: ['SIGNING'],
    algorithm_family: 'ed25519',
    public_key_canonical: 'pk-1',
    not_before: timestamp(BASE_TIME),
  };
}

function rawParticipant(): Record<string, unknown> {
  return {
    id: participantId('participant-a'),
    kind: 'AGENT',
    home_domain: domainId('domain-a'),
    registered_at: timestamp(BASE_TIME),
  };
}

function rawLineageLink(): Record<string, unknown> {
  return {
    parent_version_id: identityVersionId('iv-1'),
    relation: 'CONTINUATION',
  };
}

function rawRuntime(): Record<string, unknown> {
  return {
    id: runtimeInstanceId('runtime-1'),
    identity_version_id: identityVersionId('iv-1'),
    execution_context_ref: 'context-1',
    instantiated_at: timestamp(BASE_TIME),
  };
}

describe('entity constructors', () => {
  test('participant record is owned, frozen and typed', () => {
    const record = participant('participant-a', 'SERVICE');

    expect(record.id as string).toBe('participant-a');
    expect(record.kind).toBe('SERVICE');
    expect(Object.isFrozen(record)).toBe(true);
  });

  test('participant record rejects unknown fields and unknown kinds', () => {
    expect(validateParticipantRecord({ ...rawParticipant(), extra: true }).ok).toBe(false);
    expect(validateParticipantRecord({ ...rawParticipant(), kind: 'ROBOT' }).ok).toBe(false);
    expect(validateParticipantRecord({ ...rawParticipant(), id: 42 }).ok).toBe(false);
    expect(validateParticipantRecord({ ...rawParticipant(), id: undefined }).ok).toBe(false);
  });

  test('credential descriptor accepts presence and absence of optional fields', () => {
    const withOptional = credential('cred-1', {
      not_after: timestamp(BASE_TIME + 1),
      revocation_endpoint_ref: 'https://domain-a/revoke',
    });

    expect(withOptional.not_after as number | undefined).toBe(BASE_TIME + 1);
    expect(withOptional.revocation_endpoint_ref).toBe('https://domain-a/revoke');
    expect(Object.isFrozen(withOptional)).toBe(true);
    expect(validateCredentialDescriptor(rawCredential()).ok).toBe(true);
  });

  test('credential descriptor rejects present-undefined optional fields', () => {
    expect(validateCredentialDescriptor({ ...rawCredential(), not_after: undefined }).ok).toBe(false);
    expect(validateCredentialDescriptor({ ...rawCredential(), revocation_endpoint_ref: undefined }).ok).toBe(false);
  });

  test('credential descriptor rejects unknown fields and malformed values', () => {
    expect(validateCredentialDescriptor({ ...rawCredential(), injected: true }).ok).toBe(false);
    expect(validateCredentialDescriptor({ ...rawCredential(), usage: ['SIGNING', 'ROTATION'] }).ok).toBe(false);
    expect(validateCredentialDescriptor({ ...rawCredential(), not_before: 'now' }).ok).toBe(false);
  });

  test('lineage link accepts optional fields and rejects undefined/unknown ones', () => {
    const withOptional = validateLineageLink({
      ...rawLineageLink(),
      declared_rationale: 'planned rotation',
      continuity_proof_ref: 'proof-1',
    });

    expect(withOptional.ok).toBe(true);
    if (!withOptional.ok) return;
    expect(withOptional.value.declared_rationale).toBe('planned rotation');
    expect(Object.isFrozen(withOptional.value)).toBe(true);

    expect(validateLineageLink({ ...rawLineageLink(), declared_rationale: undefined }).ok).toBe(false);
    expect(validateLineageLink({ ...rawLineageLink(), note: 'x' }).ok).toBe(false);
    expect(validateLineageLink({ ...rawLineageLink(), relation: 'PARENT' }).ok).toBe(false);
  });

  test('runtime descriptor accepts an optional ephemeral key and rejects undefined/unknown ones', () => {
    const withoutKey = validateRuntimeInstanceDescriptor(rawRuntime());
    const withKey = validateRuntimeInstanceDescriptor({ ...rawRuntime(), ephemeral_public_key: 'ephemeral-pk' });

    expect(withoutKey.ok).toBe(true);
    expect(withKey.ok).toBe(true);
    if (!withKey.ok) return;
    expect(withKey.value.ephemeral_public_key).toBe('ephemeral-pk');
    expect(Object.isFrozen(withKey.value)).toBe(true);

    expect(validateRuntimeInstanceDescriptor({ ...rawRuntime(), ephemeral_public_key: undefined }).ok).toBe(false);
    expect(validateRuntimeInstanceDescriptor({ ...rawRuntime(), execution_context_ref: undefined }).ok).toBe(false);
    expect(validateRuntimeInstanceDescriptor({ ...rawRuntime(), injected: true }).ok).toBe(false);
  });

  test('caller mutation after construction does not affect owned records', () => {
    const raw = rawCredential();
    const result = validateCredentialDescriptor(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    raw.algorithm_family = 'mutated';
    (raw.usage as string[]).push('ENCRYPTION');

    expect(result.value.algorithm_family).toBe('ed25519');
    expect(result.value.usage).toEqual(['SIGNING']);
  });
});

function rawDescriptor(): Record<string, unknown> {
  return {
    id: identityVersionId('iv-1'),
    participant_id: participantId('participant-a'),
    version_label: '1.0.0',
    version_scheme: 'SEMVER_2',
    declared_protocols: [],
    public_credentials: [],
    lineage: [],
    published_at: timestamp(BASE_TIME),
  };
}

describe('identifier discipline', () => {
  test('descriptor identifiers must be non-empty', () => {
    for (const field of ['id', 'participant_id', 'version_label'] as const) {
      const result = validateIdentityVersionDescriptor({ ...rawDescriptor(), [field]: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('MECHANISM');
        expect(result.error.message).toContain('expected non-empty string');
      }
    }
  });

  test('participant, credential, lineage and runtime identifiers must be non-empty', () => {
    expect(validateParticipantRecord({ ...rawParticipant(), id: '' }).ok).toBe(false);
    expect(validateParticipantRecord({ ...rawParticipant(), home_domain: '' }).ok).toBe(false);
    expect(validateCredentialDescriptor({ ...rawCredential(), credential_id: '' }).ok).toBe(false);
    expect(validateCredentialDescriptor({ ...rawCredential(), public_key_canonical: '' }).ok).toBe(false);
    expect(validateLineageLink({ ...rawLineageLink(), parent_version_id: '' }).ok).toBe(false);
    expect(validateRuntimeInstanceDescriptor({ ...rawRuntime(), id: '' }).ok).toBe(false);
  });

  test('two descriptors cannot collide through an empty id, because neither validates', () => {
    const first = validateIdentityVersionDescriptor({ ...rawDescriptor(), id: '' });
    const second = validateIdentityVersionDescriptor({ ...rawDescriptor(), id: '', version_label: '2.0.0' });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
  });
});
