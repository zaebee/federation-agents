import { describe, expect, test } from 'bun:test';
import { validateIdentityVersionDescriptor } from '../../src/core/entities.js';
import type { IdentityVersionDescriptor, LineageRelationType } from '../../src/core/entities.js';
import { validateDescriptor } from '../../src/core/lineage.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import { credential, descriptor, expectRejected, link, participant, registry, snapshot } from '../support/fixtures.js';

const alice = participant('participant-a');
const bob = participant('participant-b');

const parentA1 = descriptor({ id: 'iv-a-1', participant: 'participant-a', credentials: [credential('cred-a')] });
const parentA2 = descriptor({ id: 'iv-a-2', participant: 'participant-a' });
const parentB1 = descriptor({ id: 'iv-b-1', participant: 'participant-b' });
const allParticipants = [alice, bob];
const allParents = [parentA1, parentA2, parentB1];

describe('cardinality per relation type', () => {
  const parentIds = ['iv-a-1', 'iv-a-2', 'iv-b-1'] as const;
  const cases: ReadonlyArray<readonly [LineageRelationType, readonly number[], number]> = [
    ['CONTINUATION', [0, 1], 2],
    ['FORKED_FROM', [0, 1], 2],
    ['MERGED_FROM', [0, 2, 3], 1],
  ];

  function childWith(relation: LineageRelationType, count: number): DeepReadonly<IdentityVersionDescriptor> {
    return descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: parentIds.slice(0, count).map((parentId) => link(parentId, relation)),
    });
  }

  for (const [relation, allowedCounts, rejectedCount] of cases) {
    test(`${relation} enforces its cardinality`, () => {
      const reg = registry(allParticipants, allParents);

      for (const count of allowedCounts) {
        expect(validateDescriptor(childWith(relation, count), reg)).toEqual({ status: 'VALID' });
      }
      expectRejected(validateDescriptor(childWith(relation, rejectedCount), reg), 'ERR_INVALID_CARDINALITY');
    });
  }

  test('mixed relation arrays are structurally legal', () => {
    const mixed = descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: [
        link('iv-a-1', 'CONTINUATION'),
        link('iv-a-2', 'FORKED_FROM'),
        link('iv-b-1', 'MERGED_FROM'),
        link('iv-a-1', 'MERGED_FROM'),
      ],
    });

    expect(validateDescriptor(mixed, registry(allParticipants, allParents))).toEqual({ status: 'VALID' });
  });

  test('MERGED_FROM counts distinct parents, not duplicate links', () => {
    const sameParentTwice = descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'MERGED_FROM'), link('iv-a-1', 'MERGED_FROM')],
    });
    const duplicatePlusDistinct = descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'MERGED_FROM'), link('iv-a-1', 'MERGED_FROM'), link('iv-b-1', 'MERGED_FROM')],
    });
    const reg = registry(allParticipants, allParents);

    expectRejected(validateDescriptor(sameParentTwice, reg), 'ERR_INVALID_CARDINALITY');
    expect(validateDescriptor(duplicatePlusDistinct, reg)).toEqual({ status: 'VALID' });
  });
});

describe('relation constraints', () => {
  test('self-parent is rejected for every relation type', () => {
    const reg = registry(allParticipants, allParents);

    for (const relation of ['CONTINUATION', 'FORKED_FROM', 'MERGED_FROM'] as const) {
      const child = descriptor({
        id: 'iv-a-3',
        participant: 'participant-a',
        lineage: [link('iv-a-3', relation), ...(relation === 'MERGED_FROM' ? [link('iv-a-1', relation)] : [])],
      });

      expectRejected(validateDescriptor(child, reg), 'ERR_INVALID_RELATION', 'iv-a-3');
    }
  });

  test('self-parent is rejected even when the descriptor is absent from Registry', () => {
    const child = descriptor({ id: 'iv-a-3', participant: 'participant-a', lineage: [link('iv-a-3')] });

    expectRejected(validateDescriptor(child, registry(allParticipants, allParents)), 'ERR_INVALID_RELATION', 'iv-a-3');
  });

  test('cross-participant CONTINUATION with a known parent is rejected', () => {
    const child = descriptor({ id: 'iv-b-2', participant: 'participant-b', lineage: [link('iv-a-1')] });

    expectRejected(validateDescriptor(child, registry(allParticipants, allParents)), 'ERR_INVALID_RELATION', 'iv-a-1');
  });

  test('same-participant CONTINUATION with a known parent is accepted', () => {
    const child = descriptor({ id: 'iv-a-3', participant: 'participant-a', lineage: [link('iv-a-1')] });

    expect(validateDescriptor(child, registry(allParticipants, allParents))).toEqual({ status: 'VALID' });
  });

  test('CONTINUATION with a missing parent is deferred to Task 7, not rejected', () => {
    const child = descriptor({ id: 'iv-a-3', participant: 'participant-a', lineage: [link('iv-unknown')] });

    expect(validateDescriptor(child, registry(allParticipants, allParents))).toEqual({ status: 'VALID' });
  });
});

describe('validation purity', () => {
  test('valid validation does not mutate Registry or the descriptor', () => {
    const child = descriptor({ id: 'iv-a-3', participant: 'participant-a', lineage: [link('iv-a-1')] });
    const reg = registry(allParticipants, [...allParents, child]);
    const before = snapshot(reg);
    const childBefore = JSON.stringify(child);

    expect(validateDescriptor(child, reg)).toEqual({ status: 'VALID' });
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(child)).toBe(childBefore);
  });

  test('rejected validation does not partially mutate Registry', () => {
    const child = descriptor({ id: 'iv-b-2', participant: 'participant-b', lineage: [link('iv-a-1')] });
    const reg = registry(allParticipants, [...allParents, child]);
    const before = snapshot(reg);

    expectRejected(validateDescriptor(child, reg), 'ERR_INVALID_RELATION', 'iv-a-1');
    expect(snapshot(reg)).toBe(before);
  });

  test('cardinality rejection carries no parent_version_id', () => {
    const child = descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: [link('iv-a-1'), link('iv-a-2')],
    });
    const result = validateDescriptor(child, registry(allParticipants, allParents));

    expect(result.status).toBe('REJECTED');
    if (result.status !== 'REJECTED') return;
    expect(result.code).toBe('ERR_INVALID_CARDINALITY');
    expect('parent_version_id' in result).toBe(false);
  });

  test('valid result exposes only its status', () => {
    const child = descriptor({ id: 'iv-a-3', participant: 'participant-a', lineage: [link('iv-a-1')] });

    expect(Object.keys(validateDescriptor(child, registry(allParticipants, allParents)))).toEqual(['status']);
  });
});

describe('boundary composition', () => {
  function rawDescriptor(lineage: readonly Record<string, unknown>[]): Record<string, unknown> {
    return {
      id: 'iv-a-3',
      participant_id: 'participant-a',
      version_label: '1.0.0',
      version_scheme: 'SEMVER_2',
      declared_protocols: [],
      public_credentials: [],
      lineage,
      published_at: 1_700_000_000_000,
    };
  }

  test('untrusted descriptors must be validated before structural validation', () => {
    const raw = rawDescriptor([{ parent_version_id: 'iv-a-1', relation: 'CONTINUATION', injected: true }]);

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });

  test('the validated, owned descriptor is accepted structurally', () => {
    const validated = validateIdentityVersionDescriptor(
      rawDescriptor([{ parent_version_id: 'iv-a-1', relation: 'CONTINUATION' }]),
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validateDescriptor(validated.value, registry(allParticipants, allParents))).toEqual({ status: 'VALID' });
  });

  test('present-undefined nested fields are rejected at the boundary', () => {
    const raw = rawDescriptor([
      { parent_version_id: 'iv-a-1', relation: 'CONTINUATION', declared_rationale: undefined },
    ]);

    expect(validateIdentityVersionDescriptor(raw).ok).toBe(false);
  });
});
