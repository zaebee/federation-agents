import { describe, expect, test } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { descriptor, link, participant, plainGraph, registry, snapshot } from '../support/fixtures.js';

describe('§12 Category C: federation lineage handling', () => {
  test('C-1 delayed parent is preserved and reported, then resolved by a new graph', () => {
    const alice = participant('participant-a');
    const child = descriptor({
      id: 'iv-child',
      participant: 'participant-a',
      lineage: [link('iv-parent', 'CONTINUATION')],
    });
    const childBefore = JSON.stringify(child);
    const reg = registry([alice], [child]);
    const before = snapshot(reg);

    const graph = buildLineageGraph(reg);

    expect(graph.nodes.map(String)).toEqual(['iv-child']);
    expect(plainGraph(graph).edges).toEqual([{ child: 'iv-child', parent: 'iv-parent', relation: 'CONTINUATION' }]);
    expect(plainGraph(graph).unresolvedParents).toEqual([['iv-child', ['iv-parent']]]);
    expect(plainGraph(graph).cycles).toEqual([]);
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(child)).toBe(childBefore);
    expect(reg.versions()[0]).toBe(child);
    expect(Object.keys(graph).sort()).toEqual(['cycles', 'edges', 'nodes', 'unresolvedParents']);

    const parent = descriptor({ id: 'iv-parent', participant: 'participant-a' });
    const regWithParent = registry([alice], [parent, child]);
    const resolved = buildLineageGraph(regWithParent);

    expect(resolved.nodes.map(String)).toEqual(['iv-child', 'iv-parent']);
    expect(plainGraph(resolved).unresolvedParents).toEqual([]);
    expect(plainGraph(resolved).cycles).toEqual([]);
    expect(JSON.stringify(child)).toBe(childBefore);
    // The earlier graph is a snapshot, not a live view.
    expect(plainGraph(graph).unresolvedParents).toEqual([['iv-child', ['iv-parent']]]);
    expect(graph.nodes.map(String)).toEqual(['iv-child']);
  });

  test('C-2 a cycle is detected without discarding or rewriting declarations', () => {
    const alice = participant('participant-a');
    const v1 = descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] });
    const v2 = descriptor({ id: 'iv-v2', participant: 'participant-a', lineage: [link('iv-v1', 'CONTINUATION')] });
    const v1Before = JSON.stringify(v1);
    const v2Before = JSON.stringify(v2);
    const reg = registry([alice], [v1, v2]);
    const before = snapshot(reg);

    const graph = buildLineageGraph(reg);

    expect(plainGraph(graph).cycles).toEqual([['iv-v1', 'iv-v2']]);
    expect(graph.nodes.map(String)).toEqual(['iv-v1', 'iv-v2']);
    expect(graph.edges).toHaveLength(2);
    expect(plainGraph(graph).unresolvedParents).toEqual([]);
    expect(snapshot(reg)).toBe(before);
    expect(JSON.stringify(v1)).toBe(v1Before);
    expect(JSON.stringify(v2)).toBe(v2Before);
    // Cycle information is data, not an exception and not a graph-level error code.
    expect('code' in graph).toBe(false);

    const acyclic = buildLineageGraph(
      registry([alice], [v1, descriptor({ id: 'iv-v2', participant: 'participant-a' })]),
    );
    expect(plainGraph(acyclic).cycles).toEqual([]);
  });
});
