import { describe, expect, test } from 'bun:test';
import {
  validateIdentityVersionDescriptor,
  type CredentialDescriptor,
  type IdentityVersionDescriptor,
  type LineageLink,
} from '../../src/core/entities.js';
import { descriptorHash, descriptorHashInput } from '../../src/core/hashing.js';
import { CanonicalizationError } from '../../src/core/errors.js';
import { credentialId, domainId, identityVersionId, participantId, timestamp } from '../../src/core/primitives.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import type { JsonValue } from '../../src/core/primitives.js';

const BASE_TIME = 1_700_000_000_000;

function credential(overrides: Partial<CredentialDescriptor> = {}): CredentialDescriptor {
  return {
    credential_id: credentialId('cred-1'),
    issuer_domain: domainId('domain-a'),
    usage: ['SIGNING'],
    algorithm_family: 'ed25519',
    public_key_canonical: 'pk-1',
    not_before: timestamp(BASE_TIME),
    ...overrides,
  };
}

function lineageLink(overrides: Partial<LineageLink> = {}): LineageLink {
  return {
    parent_version_id: identityVersionId('iv-0'),
    relation: 'CONTINUATION',
    ...overrides,
  };
}

function descriptor(overrides: Partial<IdentityVersionDescriptor> = {}): IdentityVersionDescriptor {
  return {
    id: identityVersionId('iv-1'),
    participant_id: participantId('participant-1'),
    version_label: '1.0.0',
    version_scheme: 'SEMVER_2',
    declared_protocols: ['uia-core-001'],
    public_credentials: [credential()],
    lineage: [lineageLink()],
    published_at: timestamp(BASE_TIME),
    ...overrides,
  };
}

function validated(overrides: Partial<IdentityVersionDescriptor> = {}): DeepReadonly<IdentityVersionDescriptor> {
  const result = validateIdentityVersionDescriptor(descriptor(overrides));
  if (!result.ok) {
    throw new Error(`fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('projection must be an object');
  }
  return value as Record<string, JsonValue>;
}

describe('descriptor hash projection (§7.1)', () => {
  test('contains exactly the eight normative fields', () => {
    const input = asRecord(descriptorHashInput(validated()));

    expect(Object.keys(input).sort()).toEqual([
      'declared_protocols',
      'id',
      'lineage',
      'participant_id',
      'public_credentials',
      'published_at',
      'version_label',
      'version_scheme',
    ]);
  });

  test('keeps nested credential and lineage structure instead of replacing it with ids', () => {
    const input = asRecord(descriptorHashInput(validated()));

    expect(Array.isArray(input.public_credentials)).toBe(true);
    expect(Array.isArray(input.lineage)).toBe(true);
    expect(input.public_credentials).toEqual([
      {
        credential_id: 'cred-1',
        issuer_domain: 'domain-a',
        usage: ['SIGNING'],
        algorithm_family: 'ed25519',
        public_key_canonical: 'pk-1',
        not_before: BASE_TIME,
      },
    ]);
    expect(input.lineage).toEqual([
      {
        parent_version_id: 'iv-0',
        relation: 'CONTINUATION',
      },
    ]);
  });
});

describe('descriptor validation', () => {
  test('rejects an optional nested field present as undefined', () => {
    const raw = {
      ...descriptor(),
      public_credentials: [{ ...credential(), not_after: undefined }],
    };

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });

  test('accepts the same optional field when absent', () => {
    expect(validateIdentityVersionDescriptor(descriptor()).ok).toBe(true);
  });

  test('rejects an unknown field on the descriptor', () => {
    const raw = { ...descriptor(), envelope: { envelope_id: 'env-1' } };

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });

  test('rejects an unknown field on a credential descriptor', () => {
    const raw = {
      ...descriptor(),
      public_credentials: [{ ...credential(), key_owner: 'someone' }],
    };

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });

  test('rejects an unknown field on a lineage link', () => {
    const raw = {
      ...descriptor(),
      lineage: [{ ...lineageLink(), note: 'trust me' }],
    };

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });
});

describe('descriptor hash stability', () => {
  test('is independent of property insertion order', () => {
    const source = descriptor();
    const entries = Object.entries(source as unknown as Record<string, unknown>);
    const reversed = Object.fromEntries(entries.slice().reverse()) as unknown as IdentityVersionDescriptor;
    const shuffledEntries = [
      entries[3],
      entries[0],
      entries[7],
      entries[1],
      entries[5],
      entries[2],
      entries[6],
      entries[4],
    ];
    const shuffled = Object.fromEntries(shuffledEntries) as unknown as IdentityVersionDescriptor;

    const baseline = descriptorHash(validated());

    for (const candidate of [reversed, shuffled]) {
      const result = validateIdentityVersionDescriptor(candidate);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(descriptorHash(result.value)).toBe(baseline);
    }
  });

  test('is unaffected by metadata outside the §7.1 projection', () => {
    const d = validated();
    const before = descriptorHash(d);

    // Separate artifacts by design (§7.1): none of them is an input to the hash.
    const envelope = { envelope_id: 'env-1', sender: 'domain-a' };
    const signature = { algorithm: 'ed25519', value: 'sig-bytes' };
    const delivery = { received_at: BASE_TIME + 1 };
    const ledger = { ingested_at: BASE_TIME + 2 };
    const assessment = { assessment_id: 'assessment-1', verified_claims: [] };
    const revocation = { credential_id: 'cred-1', reason: 'ROTATION' };
    const acceptance = { acceptance_id: 'acceptance-1', decision: 'ACCEPTED' };
    const lifecycle = { event_id: 'event-1', new_state: 'SUSPENDED' };
    const artifacts = { envelope, signature, delivery, ledger, assessment, revocation, acceptance, lifecycle };

    expect(Object.keys(artifacts)).toHaveLength(8);
    expect(descriptorHash(validated())).toBe(before);

    // A wrapper is not a descriptor: hashing it must fail, not silently hash a subset.
    const wrapper = { descriptor: d, ...artifacts } as unknown as DeepReadonly<IdentityVersionDescriptor>;
    expect(() => descriptorHash(wrapper)).toThrow(CanonicalizationError);
  });

  test('is deterministic and does not mutate its input', () => {
    const d = validated();
    const first = descriptorHash(d);

    expect(descriptorHash(d)).toBe(first);
    expect(descriptorHash(d)).toBe(first);
    expect(Object.isFrozen(d)).toBe(true);
  });

  test('owns a copy: mutating the source object does not change the hash', () => {
    const raw = descriptor();
    const result = validateIdentityVersionDescriptor(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const before = descriptorHash(result.value);
    raw.public_credentials[0].algorithm_family = 'mutated-after-validation';

    expect(descriptorHash(result.value)).toBe(before);
  });

  test('throws instead of omitting a present-undefined field smuggled past validation', () => {
    const base = descriptor();
    const bad = {
      ...base,
      public_credentials: [{ ...base.public_credentials[0], not_after: undefined }],
    } as unknown as DeepReadonly<IdentityVersionDescriptor>;

    expect(() => descriptorHashInput(bad)).toThrow(CanonicalizationError);
  });
});

describe('every §7.1 field affects the hash', () => {
  const mutations: ReadonlyArray<readonly [string, IdentityVersionDescriptor]> = [
    ['id', descriptor({ id: identityVersionId('iv-2') })],
    ['participant_id', descriptor({ participant_id: participantId('participant-2') })],
    ['version_label', descriptor({ version_label: '1.0.1' })],
    ['version_scheme', descriptor({ version_scheme: 'CONTENT_HASH' })],
    ['declared_protocols', descriptor({ declared_protocols: ['uia-core-001', 'extra'] })],
    ['public_credentials', descriptor({ public_credentials: [{ ...credential(), algorithm_family: 'ed448' }] })],
    ['lineage', descriptor({ lineage: [{ ...lineageLink(), relation: 'FORKED_FROM' }] })],
    ['published_at', descriptor({ published_at: timestamp(BASE_TIME + 1) })],
  ];

  for (const [name, mutated] of mutations) {
    test(`changing ${name} changes the hash`, () => {
      const baseline = descriptorHash(validated());
      const result = validateIdentityVersionDescriptor(mutated);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(descriptorHash(result.value)).not.toBe(baseline);
    });
  }

  test('the eight mutations produce eight distinct hashes', () => {
    const hashes = mutations.map(([, mutated]) => {
      const result = validateIdentityVersionDescriptor(mutated);
      if (!result.ok) {
        throw new Error(`mutation fixture must be valid: ${result.error.message}`);
      }
      return descriptorHash(result.value);
    });

    expect(new Set(hashes).size).toBe(mutations.length);
  });
});

describe('hash identifier', () => {
  test('matches urn:hash:sha256:<64 lowercase hex>', () => {
    expect(descriptorHash(validated())).toMatch(/^urn:hash:sha256:[0-9a-f]{64}$/);
  });
});
