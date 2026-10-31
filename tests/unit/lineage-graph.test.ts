import { describe, expect, test } from 'bun:test';
import type { IdentityVersionDescriptor } from '../../src/core/entities.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import { descriptor, link, participant, plainGraph, registry, snapshot } from '../support/fixtures.js';

const alice = participant('participant-a');

function cycleOf(ids: readonly string[]): DeepReadonly<IdentityVersionDescriptor>[] {
  return ids.map((id, index) =>
    descriptor({
      id,
      participant: 'participant-a',
      lineage: [link(ids[(index + 1) % ids.length], 'CONTINUATION')],
    }),
  );
}

describe('graph construction', () => {
  test('detects a longer cycle as one sorted component', () => {
    const graph = buildLineageGraph(registry([alice], cycleOf(['iv-v1', 'iv-v2', 'iv-v3'])));

    expect(plainGraph(graph).cycles).toEqual([['iv-v1', 'iv-v2', 'iv-v3']]);
  });

  test('detects multiple independent cycles as separate components', () => {
    const twoCycles = [
      descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v2', participant: 'participant-a', lineage: [link('iv-v1', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v3', participant: 'participant-a', lineage: [link('iv-v4', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v4', participant: 'participant-a', lineage: [link('iv-v3', 'CONTINUATION')] }),
    ];
    const graph = buildLineageGraph(registry([alice], twoCycles));

    expect(plainGraph(graph).cycles).toEqual([
      ['iv-v1', 'iv-v2'],
      ['iv-v3', 'iv-v4'],
    ]);
  });

  test('represents a self-loop as a one-node cyclic component', () => {
    const loop = descriptor({
      id: 'iv-self',
      participant: 'participant-a',
      lineage: [link('iv-self', 'CONTINUATION')],
    });
    const graph = buildLineageGraph(registry([alice], [loop]));

    expect(plainGraph(graph).cycles).toEqual([['iv-self']]);
    expect(plainGraph(graph).edges).toEqual([{ child: 'iv-self', parent: 'iv-self', relation: 'CONTINUATION' }]);
  });

  test('reports unique missing parents per child while keeping duplicate declared edges', () => {
    const orphan = descriptor({
      id: 'iv-child',
      participant: 'participant-a',
      lineage: [link('iv-p1', 'FORKED_FROM'), link('iv-p2', 'MERGED_FROM'), link('iv-p1', 'MERGED_FROM')],
    });
    const graph = buildLineageGraph(registry([alice], [orphan]));

    expect(graph.nodes.map(String)).toEqual(['iv-child']);
    expect(graph.edges).toHaveLength(3);
    expect(plainGraph(graph).unresolvedParents).toEqual([['iv-child', ['iv-p1', 'iv-p2']]]);
  });

  test('keeps declarations that structural validation would reject', () => {
    const bob = participant('participant-b');
    const parent = descriptor({ id: 'iv-a', participant: 'participant-a' });
    const child = descriptor({ id: 'iv-b', participant: 'participant-b', lineage: [link('iv-a', 'CONTINUATION')] });
    const graph = buildLineageGraph(registry([alice, bob], [parent, child]));

    expect(plainGraph(graph).edges).toEqual([{ child: 'iv-b', parent: 'iv-a', relation: 'CONTINUATION' }]);
    expect(plainGraph(graph).cycles).toEqual([]);
  });
});

describe('determinism', () => {
  test('sorts nodes and edges regardless of registry order', () => {
    const v1 = descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] });
    const v2 = descriptor({ id: 'iv-v2', participant: 'participant-a' });
    const forward = buildLineageGraph(registry([alice], [v1, v2]));
    const reversed = buildLineageGraph(registry([alice], [v2, v1]));

    expect(forward).toEqual(reversed);
    expect(forward.nodes.map(String)).toEqual(['iv-v1', 'iv-v2']);
    expect(plainGraph(forward).edges).toEqual([{ child: 'iv-v1', parent: 'iv-v2', relation: 'CONTINUATION' }]);
  });

  test('sorts components and reports equivalent cycles for shuffled input', () => {
    const twoCycles = [
      descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v2', participant: 'participant-a', lineage: [link('iv-v1', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v3', participant: 'participant-a', lineage: [link('iv-v4', 'CONTINUATION')] }),
      descriptor({ id: 'iv-v4', participant: 'participant-a', lineage: [link('iv-v3', 'CONTINUATION')] }),
    ];
    const forward = buildLineageGraph(registry([alice], twoCycles));
    const backwards = buildLineageGraph(registry([alice], [...twoCycles].reverse()));

    expect(forward).toEqual(backwards);
    expect(plainGraph(forward).cycles).toEqual([
      ['iv-v1', 'iv-v2'],
      ['iv-v3', 'iv-v4'],
    ]);
  });
});

describe('ownership', () => {
  test('graph is deeply frozen and does not alias descriptor links', () => {
    const child = descriptor({
      id: 'iv-child',
      participant: 'participant-a',
      lineage: [link('iv-parent', 'CONTINUATION')],
    });
    const graph = buildLineageGraph(registry([alice], [child]));

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
    expect(Object.isFrozen(graph.edges)).toBe(true);
    expect(Object.isFrozen(graph.edges[0])).toBe(true);
    expect(Object.isFrozen(graph.unresolvedParents)).toBe(true);
    expect(Object.isFrozen(graph.unresolvedParents[0])).toBe(true);
    expect(Object.isFrozen(graph.unresolvedParents[0][1])).toBe(true);
    expect(Object.isFrozen(graph.cycles)).toBe(true);
    expect(graph.edges[0]).not.toBe(child.lineage[0]);
  });

  test('does not mutate Registry and does not retain its arrays', () => {
    const v1 = descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] });
    const v2 = descriptor({ id: 'iv-v2', participant: 'participant-a' });
    const versions = [v1, v2];
    const reg = { participants: () => [alice], versions: () => versions };
    const before = snapshot(reg);

    const graph = buildLineageGraph(reg);
    expect(snapshot(reg)).toBe(before);

    versions.push(descriptor({ id: 'iv-v3', participant: 'participant-a' }));
    expect(graph.nodes).toHaveLength(2);
    expect(graph).toEqual(buildLineageGraph({ participants: () => [alice], versions: () => [v1, v2] }));
  });
});

describe('delayed parents (graph-level C-1)', () => {
  test('preserves an orphan and resolves it in a newly built graph', () => {
    const child = descriptor({
      id: 'iv-child',
      participant: 'participant-a',
      lineage: [link('iv-parent', 'CONTINUATION')],
    });
    const childBefore = JSON.stringify(child);
    const reg = registry([alice], [child]);
    const before = snapshot(reg);

    const graph = buildLineageGraph(reg);

    expect(plainGraph(graph).nodes).toEqual(['iv-child']);
    expect(plainGraph(graph).edges).toEqual([{ child: 'iv-child', parent: 'iv-parent', relation: 'CONTINUATION' }]);
    expect(plainGraph(graph).unresolvedParents).toEqual([['iv-child', ['iv-parent']]]);
    expect(plainGraph(graph).cycles).toEqual([]);
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(child)).toBe(childBefore);

    const parent = descriptor({ id: 'iv-parent', participant: 'participant-a' });
    const resolved = buildLineageGraph(registry([alice], [parent, child]));

    expect(plainGraph(resolved).nodes).toEqual(['iv-child', 'iv-parent']);
    expect(plainGraph(resolved).unresolvedParents).toEqual([]);
    expect(JSON.stringify(child)).toBe(childBefore);
  });
});

describe('cycles (graph-level C-2)', () => {
  test('detects V1 <-> V2 and keeps declarations readable', () => {
    const v1 = descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] });
    const v2 = descriptor({ id: 'iv-v2', participant: 'participant-a', lineage: [link('iv-v1', 'CONTINUATION')] });
    const v1Before = JSON.stringify(v1);
    const v2Before = JSON.stringify(v2);
    const reg = registry([alice], [v1, v2]);
    const before = snapshot(reg);

    const graph = buildLineageGraph(reg);

    expect(plainGraph(graph).cycles).toEqual([['iv-v1', 'iv-v2']]);
    expect(plainGraph(graph).edges).toHaveLength(2);
    expect(plainGraph(graph).unresolvedParents).toEqual([]);
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(v1)).toBe(v1Before);
    expect(JSON.stringify(v2)).toBe(v2Before);

    const acyclic = buildLineageGraph(
      registry([alice], [v1, descriptor({ id: 'iv-v2', participant: 'participant-a' })]),
    );
    expect(plainGraph(acyclic).cycles).toEqual([]);
  });
});
