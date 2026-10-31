import { describe, expect, test } from 'bun:test';
import { emitCycleAssessments } from '../../src/index.js';
import type { CycleAssessmentRequest } from '../../src/index.js';
import type { ContinuityAssessment } from '../../src/core/assessment.js';
import { registerAssessment, registerCycleAssessments, registerOrphanAssessments } from '../../src/core/assessment.js';
import type { LineageRelationType } from '../../src/core/entities.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import { descriptor, link, participant, plainGraph, registry } from '../support/fixtures.js';
import { continuityAssessment } from '../support/assessment-builder.js';

const BASE_TIME = 1_700_000_000_000;

function cycleGraph(): LineageGraph {
  const alice = participant('participant-a');
  const a = descriptor({
    id: 'iv-a',
    participant: 'participant-a',
    lineage: [link('iv-b', 'CONTINUATION'), link('iv-d', 'FORKED_FROM')],
  });
  const b = descriptor({ id: 'iv-b', participant: 'participant-a', lineage: [link('iv-a', 'FORKED_FROM')] });
  const c = descriptor({ id: 'iv-c', participant: 'participant-a', lineage: [link('iv-a', 'CONTINUATION')] });
  const d = descriptor({ id: 'iv-d', participant: 'participant-a' });
  return buildLineageGraph(registry([alice], [a, b, c, d]));
}

function emit(
  graph: LineageGraph,
  overrides: Partial<CycleAssessmentRequest> = {},
): ReturnType<typeof emitCycleAssessments> {
  return emitCycleAssessments({
    graph,
    existing: [],
    assessmentIdFor: (subject: string, relation: LineageRelationType, parent: string) =>
      assessmentId(`c2-${subject}-${relation}-${parent}`),
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(BASE_TIME),
    evidence_refs: ['cycle-evidence'],
    ...overrides,
  });
}

function candidate(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return continuityAssessment({
    assessment_id: assessmentId('cycle-1'),
    subject_version_id: identityVersionId('iv-a'),
    parent_version_ids: [identityVersionId('iv-b')],
    unverified_claims: ['CYCLE_DETECTED'],
    ...overrides,
  });
}

describe('C-2 cycle assessment emission (T18-DEC-16 Option D)', () => {
  test('emits one declaration-scoped assessment per affected edge, deterministically', () => {
    const graph = cycleGraph();
    const before = JSON.stringify(graph);

    const result = emit(graph);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.value.assessments.map((record) => [
        String(record.subject_version_id),
        record.declared_relation,
        record.parent_version_ids.map(String),
      ]),
    ).toEqual([
      ['iv-a', 'CONTINUATION', ['iv-b']],
      ['iv-b', 'FORKED_FROM', ['iv-a']],
    ]);
    for (const record of result.value.assessments) {
      expect(record.verified_claims).toEqual([]);
      expect(record.unverified_claims).toEqual(['CYCLE_DETECTED']);
      expect(record.evidence_refs).toEqual(['cycle-evidence']);
    }
    expect(Object.isFrozen(result.value.assessments)).toBe(true);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
    expect(JSON.stringify(graph)).toBe(before);
    expect(plainGraph(graph).cycles).toEqual([['iv-a', 'iv-b']]);
  });

  test('does not assess an acyclic edge whose endpoint belongs to a cycle', () => {
    const graph = cycleGraph();

    const result = emit(graph);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const subjects = result.value.assessments.map((record) => String(record.subject_version_id));
    expect(subjects).not.toContain('iv-c');
    expect(subjects).not.toContain('iv-d');
  });

  test('a graph without cycles produces no assessment', () => {
    const alice = participant('participant-a');
    const graph = buildLineageGraph(
      registry(
        [alice],
        [
          descriptor({ id: 'iv-a', participant: 'participant-a' }),
          descriptor({ id: 'iv-b', participant: 'participant-a', lineage: [link('iv-a', 'CONTINUATION')] }),
        ],
      ),
    );

    const result = emit(graph);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toEqual([]);
    expect(result.value.registered).toEqual([]);
  });

  test('preserves existing assessments and returns a frozen combined representation', () => {
    const graph = cycleGraph();
    const existing: ContinuityAssessment = candidate({
      assessment_id: assessmentId('existing-1'),
      subject_version_id: identityVersionId('iv-c'),
      parent_version_ids: [identityVersionId('iv-a')],
      unverified_claims: ['UNRELATED'],
    });

    const result = emit(graph, { existing: [existing] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toHaveLength(2);
    expect(result.value.registered).toHaveLength(3);
    expect(result.value.registered.some((record) => record.assessment_id === assessmentId('existing-1'))).toBe(true);
    expect(Object.isFrozen(result.value.registered)).toBe(true);
  });

  test('rejects a duplicate assessment id across the batch', () => {
    const graph = cycleGraph();

    const result = emit(graph, { assessmentIdFor: () => assessmentId('same-id') });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
    expect(result.error.message).toContain('Duplicate assessment_id');
  });

  test('rejects a graph that was not produced by buildLineageGraph', () => {
    const graph = cycleGraph();
    const forged = plainGraph(graph) as unknown as LineageGraph;

    const result = emit(forged);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('buildLineageGraph');
  });

  test('skips a structural self-loop because the assessment contract forbids a self-parent', () => {
    const alice = participant('participant-a');
    const self = descriptor({
      id: 'iv-self',
      participant: 'participant-a',
      lineage: [link('iv-self', 'CONTINUATION')],
    });
    const graph = buildLineageGraph(registry([alice], [self]));

    const result = emit(graph);

    expect(plainGraph(graph).cycles).toEqual([['iv-self']]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toEqual([]);
  });
});

describe('C-2 contextual admission boundary', () => {
  test('generic registration cannot admit a C-2 claim', () => {
    const result = registerAssessment([], candidate());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('requires contextual admission');
    expect(result.error.message).toContain('registerCycleAssessments');
  });

  test('the C-1 contextual path rejects a C-2 claim', () => {
    const alice = participant('participant-a');
    const graph = buildLineageGraph(
      registry(
        [alice],
        [
          descriptor({ id: 'iv-a', participant: 'participant-a' }),
          descriptor({
            id: 'iv-d',
            participant: 'participant-a',
            lineage: [link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
          }),
        ],
      ),
    );
    const c1Candidate = candidate({
      subject_version_id: identityVersionId('iv-d'),
      parent_version_ids: [identityVersionId('iv-a'), identityVersionId('iv-b')],
      declared_relation: 'MERGED_FROM',
      unverified_claims: ['PARENT_UNRESOLVED', 'CYCLE_DETECTED'],
    });

    const result = registerOrphanAssessments([c1Candidate], graph, []);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('must not record CYCLE_DETECTED');
  });

  test('rejects C-2 candidates that violate the contextual boundary', () => {
    const cases: readonly {
      readonly name: string;
      readonly value: ContinuityAssessment;
      readonly message: string;
    }[] = [
      {
        name: 'C-1 claim',
        value: candidate({ unverified_claims: ['CYCLE_DETECTED', 'PARENT_UNRESOLVED'] }),
        message: 'must not record PARENT_UNRESOLVED',
      },
      {
        name: 'two parents',
        value: candidate({ parent_version_ids: [identityVersionId('iv-b'), identityVersionId('iv-c')] }),
        message: 'exactly one parent edge',
      },
      {
        name: 'missing edge',
        value: candidate({
          subject_version_id: identityVersionId('iv-c'),
          parent_version_ids: [identityVersionId('iv-b')],
        }),
        message: 'edge is not present',
      },
      {
        name: 'acyclic edge',
        value: candidate({
          subject_version_id: identityVersionId('iv-c'),
          parent_version_ids: [identityVersionId('iv-a')],
        }),
        message: 'not inside a cyclic',
      },
      {
        name: 'missing subject',
        value: candidate({ subject_version_id: identityVersionId('iv-missing') }),
        message: 'subject iv-missing is not present',
      },
    ];

    for (const testCase of cases) {
      const result = registerCycleAssessments([testCase.value], cycleGraph(), []);

      expect(result.ok, testCase.name).toBe(false);
      if (result.ok) continue;
      expect(result.error.message, testCase.name).toContain(testCase.message);
    }
  });
});
