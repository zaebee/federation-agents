import { describe, expect, test } from 'bun:test';
import { validateDescriptor } from '../../src/core/lineage.js';
import { credential, descriptor, expectRejected, link, participant, registry, snapshot } from '../support/fixtures.js';

describe('§12 Category A: structural lineage validation', () => {
  test('A-1 valid CONTINUATION is accepted without side effects', () => {
    const alice = participant('participant-a');
    const parentCredential = credential('cred-parent');
    const parent = descriptor({ id: 'iv-a-1', participant: 'participant-a', credentials: [parentCredential] });
    const child = descriptor({
      id: 'iv-a-2',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const reg = registry([alice], [parent, child]);
    const before = snapshot(reg);

    const result = validateDescriptor(child, reg);

    expect(result).toEqual({ status: 'VALID' });
    expect(snapshot(reg)).toBe(before);
    expect(parent.public_credentials.map((entry) => entry.credential_id as string)).toEqual(['cred-parent']);
    expect(child.public_credentials).toEqual([]);
    expect(Object.keys(parent)).not.toContain('status');
    expect(JSON.stringify(reg)).not.toContain('DEPRECATED');
    expect(JSON.stringify(reg).toLowerCase()).not.toContain('grant');
  });

  test('A-2 cross-participant CONTINUATION is rejected without state mutation', () => {
    const alice = participant('participant-a');
    const bob = participant('participant-b');
    const parent = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
    const child = descriptor({
      id: 'iv-b-1',
      participant: 'participant-b',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const reg = registry([alice, bob], [parent, child]);
    const before = snapshot(reg);

    const result = validateDescriptor(child, reg);

    expectRejected(result, 'ERR_INVALID_RELATION', 'iv-a-1');
    expect(snapshot(reg)).toBe(before);
    expect(alice).toBe(reg.participants()[0]);
    expect(parent).toBe(reg.versions()[0]);
    // Task 7 owns graph state; until then the result must not expose any.
    expect(Object.keys(result).sort()).toEqual(['code', 'parent_version_id', 'status']);
    expect('edges' in result).toBe(false);
    expect('relations' in result).toBe(false);
  });

  test('A-3 cross-participant FORKED_FROM is accepted without inheritance', () => {
    const alice = participant('participant-a');
    const bob = participant('participant-b');
    const ancestor = descriptor({ id: 'iv-a-1', participant: 'participant-a', credentials: [credential('cred-a')] });
    const child = descriptor({
      id: 'iv-b-1',
      participant: 'participant-b',
      lineage: [link('iv-a-1', 'FORKED_FROM')],
    });
    const reg = registry([alice, bob], [ancestor, child]);
    const before = snapshot(reg);

    const result = validateDescriptor(child, reg);

    expect(result).toEqual({ status: 'VALID' });
    expect(snapshot(reg)).toBe(before);
    expect(ancestor.public_credentials.map((entry) => entry.credential_id as string)).toEqual(['cred-a']);
    expect(child.public_credentials).toEqual([]);
    expect(JSON.stringify(reg).toLowerCase()).not.toContain('grant');
  });

  test('A-4 FORKED_FROM cardinality violation is rejected and leaves Registry unchanged', () => {
    const alice = participant('participant-a');
    const firstParent = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
    const secondParent = descriptor({ id: 'iv-a-2', participant: 'participant-a' });
    const child = descriptor({
      id: 'iv-a-3',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'FORKED_FROM'), link('iv-a-2', 'FORKED_FROM')],
    });
    const reg = registry([alice], [firstParent, secondParent, child]);
    const before = snapshot(reg);
    const childBefore = JSON.stringify(child);

    const result = validateDescriptor(child, reg);

    expectRejected(result, 'ERR_INVALID_CARDINALITY');
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(child)).toBe(childBefore);
  });

  test('A-5 valid MERGED_FROM is accepted without unioning credentials or authority', () => {
    const alice = participant('participant-a');
    const bob = participant('participant-b');
    const firstParent = descriptor({ id: 'iv-a-1', participant: 'participant-a', credentials: [credential('cred-a')] });
    const secondParent = descriptor({
      id: 'iv-b-1',
      participant: 'participant-b',
      credentials: [credential('cred-b')],
    });
    const child = descriptor({
      id: 'iv-a-2',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'MERGED_FROM'), link('iv-b-1', 'MERGED_FROM')],
    });
    const reg = registry([alice, bob], [firstParent, secondParent, child]);
    const before = snapshot(reg);

    const result = validateDescriptor(child, reg);

    expect(result).toEqual({ status: 'VALID' });
    expect(snapshot(reg)).toBe(before);
    expect(firstParent.public_credentials.map((entry) => entry.credential_id as string)).toEqual(['cred-a']);
    expect(secondParent.public_credentials.map((entry) => entry.credential_id as string)).toEqual(['cred-b']);
    expect(child.public_credentials).toEqual([]);
    expect(JSON.stringify(reg).toLowerCase()).not.toContain('grant');
  });
});
