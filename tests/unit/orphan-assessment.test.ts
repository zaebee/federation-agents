import { describe, expect, test } from 'bun:test';
import * as publicApi from '../../src/index.js';
import type { ContinuityAssessment } from '../../src/core/assessment.js';
import { emitOrphanAssessment } from '../../src/adapters/orphan-assessment.js';
import type { LineageRelationType } from '../../src/core/entities.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import { ASSESSMENT_BASE_TIME, continuityAssessment } from '../support/assessment-builder.js';

const alice = participant('participant-a');
const parentA = descriptor({ id: 'iv-a', participant: 'participant-a' });
const parentB = descriptor({ id: 'iv-b', participant: 'participant-a' });
const mixedChild = descriptor({
  id: 'iv-d',
  participant: 'participant-a',
  lineage: [link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
});

const mixedGraph = buildLineageGraph(registry([alice], [parentA, mixedChild]));
const allUnresolvedGraph = buildLineageGraph(registry([alice], [mixedChild]));
const resolvedGraph = buildLineageGraph(registry([alice], [parentA, parentB, mixedChild]));

const multiRelationChild = descriptor({
  id: 'iv-m',
  participant: 'participant-a',
  lineage: [link('iv-a', 'FORKED_FROM'), link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
});
const multiRelationGraph = buildLineageGraph(registry([alice], [multiRelationChild]));

function assessment(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return continuityAssessment({
    assessment_id: assessmentId('existing-1'),
    parent_version_ids: [identityVersionId('iv-a'), identityVersionId('iv-b')],
    declared_relation: 'MERGED_FROM',
    unverified_claims: ['PARENT_UNRESOLVED'],
    ...overrides,
  });
}

function emit(
  graph: LineageGraph,
  child: string,
  existing: readonly ContinuityAssessment[],
  idFor: (relation: LineageRelationType, parents: readonly string[]) => string,
) {
  return emitOrphanAssessment({
    graph,
    child: identityVersionId(child),
    existing,
    assessmentIdFor: (relation, parents) => assessmentId(idFor(relation, parents.map(String))),
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(ASSESSMENT_BASE_TIME),
    evidence_refs: ['evidence-1'],
  });
}

function sequentialIds(): (relation: string, parents: readonly string[]) => string {
  let next = 0;
  return (relation, parents) => `c1-${relation}-${parents.join('-')}-${(next += 1)}`;
}

describe('C-1 reference adapter', () => {
  test('emits one declaration-scoped assessment for mixed resolved and unresolved parents', () => {
    const result = emit(mixedGraph, 'iv-d', [], sequentialIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toHaveLength(1);
    expect(result.value.assessments[0].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
    expect(result.value.assessments[0].declared_relation).toBe('MERGED_FROM');
    expect(result.value.assessments[0].unverified_claims).toEqual(['PARENT_UNRESOLVED']);
    expect(result.value.registered).toHaveLength(1);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
  });

  test('emits one assessment when all declared parents are unresolved', () => {
    const result = emit(allUnresolvedGraph, 'iv-d', [], sequentialIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toHaveLength(1);
    expect(result.value.assessments[0].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
  });

  test('routes an empty batch through Core admission and returns an immutable copy', () => {
    const mutable = assessment();
    const existing = [mutable];
    const result = emit(resolvedGraph, 'iv-d', existing, sequentialIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toEqual([]);
    expect(result.value.registered).not.toBe(existing);
    expect(result.value.registered).toEqual(existing);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
    expect(Object.isFrozen(result.value.registered[0])).toBe(true);
    expect(Object.isFrozen(result.value.assessments)).toBe(true);

    const before = JSON.stringify(result.value.registered);
    existing.push(assessment({ assessment_id: assessmentId('late-1') }));
    (mutable as unknown as { unverified_claims: string[] }).unverified_claims.push('MUTATED');
    expect(JSON.stringify(result.value.registered)).toBe(before);
  });

  test('emits separate assessments for the same parent in different relations', () => {
    const result = emit(multiRelationGraph, 'iv-m', [], sequentialIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toHaveLength(2);
    expect(result.value.assessments.map((item) => item.declared_relation)).toEqual(['FORKED_FROM', 'MERGED_FROM']);
    expect(result.value.assessments[0].parent_version_ids.map(String)).toEqual(['iv-a']);
    expect(result.value.assessments[1].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
    expect(new Set(result.value.assessments.map((item) => item.assessment_id)).size).toBe(2);
  });

  test('returns C-1 assessments in relation-group order even when ids sort differently', () => {
    const result = emit(multiRelationGraph, 'iv-m', [], (relation) =>
      relation === 'FORKED_FROM' ? 'z-forked' : 'a-merged',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments.map((item) => item.declared_relation)).toEqual(['FORKED_FROM', 'MERGED_FROM']);
    expect(result.value.registered.map((item) => String(item.assessment_id))).toEqual(['a-merged', 'z-forked']);
  });

  test('calls assessmentIdFor in deterministic relation and parent order', () => {
    const calls: { relation: string; parents: string[] }[] = [];
    const result = emit(multiRelationGraph, 'iv-m', [], (relation, parents) => {
      calls.push({ relation, parents: [...parents] });
      return `id-${relation}-${parents.join('-')}`;
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      { relation: 'FORKED_FROM', parents: ['iv-a'] },
      { relation: 'MERGED_FROM', parents: ['iv-a', 'iv-b'] },
    ]);
  });

  test('rejects a child that is not in the graph', () => {
    const result = emit(mixedGraph, 'iv-missing', [], sequentialIds());

    expect(result.ok).toBe(false);
  });

  test('callback failure prevents Core admission and leaves existing unchanged', () => {
    const existing = [assessment()];
    const before = JSON.stringify(existing);
    let calls = 0;

    const result = emit(multiRelationGraph, 'iv-m', existing, () => {
      calls += 1;
      if (calls === 2) throw new Error('id callback failed');
      return `c1-${calls}`;
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('id callback failed');
    expect(calls).toBe(2);
    expect(JSON.stringify(existing)).toBe(before);
  });

  test('callback side effects are outside Core atomicity', () => {
    const existing: ContinuityAssessment[] = [];
    let sideEffects = 0;

    const result = emit(multiRelationGraph, 'iv-m', existing, () => {
      sideEffects += 1;
      throw new Error('id callback failed');
    });

    expect(result.ok).toBe(false);
    expect(sideEffects).toBe(1);
    expect(existing).toHaveLength(0);
  });

  test('rejects an invalid callback id', () => {
    const result = emit(mixedGraph, 'iv-d', [], () => '');

    expect(result.ok).toBe(false);
  });

  test('rejects duplicate callback ids within the batch', () => {
    const existing: ContinuityAssessment[] = [];
    const result = emit(multiRelationGraph, 'iv-m', existing, () => 'same-id');

    expect(result.ok).toBe(false);
    expect(existing).toHaveLength(0);
  });

  test('rejects a callback id that collides with existing state', () => {
    const existing = [assessment({ assessment_id: assessmentId('existing-1') })];
    const result = emit(mixedGraph, 'iv-d', existing, () => 'existing-1');

    expect(result.ok).toBe(false);
    expect(existing).toHaveLength(1);
  });

  test('does not mutate the graph or existing array after emission', () => {
    const existing: ContinuityAssessment[] = [];
    const beforeGraph = JSON.stringify(mixedGraph);
    const result = emit(mixedGraph, 'iv-d', existing, sequentialIds());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const registeredBefore = JSON.stringify(result.value.registered);
    existing.push(assessment({ assessment_id: assessmentId('late-1') }));

    expect(JSON.stringify(mixedGraph)).toBe(beforeGraph);
    expect(JSON.stringify(result.value.registered)).toBe(registeredBefore);
  });
});

describe('package-root AEBE surface', () => {
  test('exports the experimental adapter and Core admission functions', () => {
    expect(typeof publicApi.emitOrphanAssessment).toBe('function');
    expect(typeof publicApi.registerOrphanAssessment).toBe('function');
    expect(typeof publicApi.registerOrphanAssessments).toBe('function');
    expect(typeof publicApi.validateContinuityAssessment).toBe('function');
  });

  test('does not export the internal graph provenance guard', () => {
    expect('isBuiltLineageGraph' in publicApi).toBe(false);
  });

  test('package-root adapter produces the exact C-1 claim through Core admission', () => {
    const result = publicApi.emitOrphanAssessment({
      graph: mixedGraph,
      child: identityVersionId('iv-d'),
      existing: [],
      assessmentIdFor: (relation, parents) => assessmentId(`root-${relation}-${parents.map(String).join('-')}`),
      assessment_profile_ref: 'profile-1',
      assessment_method_version: '1.0.0',
      assessed_by: domainId('domain-a'),
      assessed_at: timestamp(ASSESSMENT_BASE_TIME),
      evidence_refs: ['evidence-1'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.registered).toHaveLength(1);
    expect(result.value.registered[0].unverified_claims).toEqual(['PARENT_UNRESOLVED']);
    expect(result.value.registered[0].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
  });
});

test('emits by candidate id, not by position, when an existing id sorts after the candidate', () => {
  const existing = [assessment({ assessment_id: assessmentId('z-1') })];

  const result = emit(mixedGraph, 'iv-d', existing, () => 'a-1');

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.assessments.map((item) => String(item.assessment_id))).toEqual(['a-1']);
  expect(result.value.registered.map((item) => String(item.assessment_id))).toEqual(['a-1', 'z-1']);
});
