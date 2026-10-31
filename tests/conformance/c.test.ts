import { describe, expect, test } from 'bun:test';
import { buildLineageGraph, emitOrphanAssessment } from '../../src/index.js';
import type { LineageGraph } from '../../src/index.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import { descriptor, link, participant, plainGraph, registry } from '../support/fixtures.js';

const BASE_TIME = 1_700_000_000_000;

function c1Graph(resolved: boolean): LineageGraph {
  const alice = participant('participant-a');
  const parentA = descriptor({ id: 'iv-a', participant: 'participant-a' });
  const child = descriptor({
    id: 'iv-d',
    participant: 'participant-a',
    lineage: [link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
  });
  const versions = resolved
    ? [parentA, descriptor({ id: 'iv-b', participant: 'participant-a' }), child]
    : [parentA, child];
  return buildLineageGraph(registry([alice], versions));
}

function emit(graph: LineageGraph) {
  return emitOrphanAssessment({
    graph,
    child: identityVersionId('iv-d'),
    existing: [],
    assessmentIdFor: (relation, parents) => assessmentId(`c1-${relation}-${parents.map(String).join('-')}`),
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(BASE_TIME),
    evidence_refs: ['c1-evidence'],
  });
}

describe('§12 Category C: federation and local assessment', () => {
  test('C-1 orphan ingestion records PARENT_UNRESOLVED in an Assessment', () => {
    const graph = c1Graph(false);
    const before = JSON.stringify(graph);

    const result = emit(graph);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.registered).toHaveLength(1);
    expect(result.value.registered[0].unverified_claims).toEqual(['PARENT_UNRESOLVED']);
    expect(result.value.registered[0].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
    expect(plainGraph(graph).unresolvedParents).toEqual([['iv-d', ['iv-b']]]);
    expect(JSON.stringify(graph)).toBe(before);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
  });

  test('C-1 resolved parent produces no PARENT_UNRESOLVED Assessment', () => {
    const graph = c1Graph(true);

    const result = emit(graph);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toEqual([]);
    expect(result.value.registered).toEqual([]);
    expect(plainGraph(graph).unresolvedParents).toEqual([]);
  });

  test.todo('C-2 cycle detection records CYCLE_DETECTED and suppresses dependent grants (Tasks 8–9)');
});
