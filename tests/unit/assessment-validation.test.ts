import { describe, expect, test } from 'bun:test';
import {
  assessEdge,
  evaluateAssurance,
  registerAssessment,
  registerOrphanAssessment,
  registerOrphanAssessments,
  validateContinuityAssessment,
  type ContinuityAssessment,
  type EdgeRef,
} from '../../src/core/assessment.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import type { TemporalContext } from '../../src/core/temporal.js';
import { descriptor, link, participant, plainGraph, registry } from '../support/fixtures.js';

const BASE_TIME = 1_700_000_000_000;
const CTX: TemporalContext = { basis: 'ASSESSED_AT', declared: {}, trust: {} };

const alice = participant('participant-a');
const resolvedParent = descriptor({ id: 'iv-a', participant: 'participant-a' });
const orphanChild = descriptor({
  id: 'iv-d',
  participant: 'participant-a',
  lineage: [link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
});
const mixedGraph = buildLineageGraph(registry([alice], [resolvedParent, orphanChild]));

function assessment(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return {
    assessment_id: assessmentId('assessment-1'),
    subject_version_id: identityVersionId('iv-d'),
    parent_version_ids: [identityVersionId('iv-a')],
    declared_relation: 'CONTINUATION',
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    verified_claims: [],
    unverified_claims: [],
    evidence_refs: [],
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(BASE_TIME),
    ...overrides,
  };
}

function orphanAssessment(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return assessment({
    assessment_id: assessmentId('c1-1'),
    subject_version_id: identityVersionId('iv-d'),
    parent_version_ids: [identityVersionId('iv-a'), identityVersionId('iv-b')],
    declared_relation: 'MERGED_FROM',
    unverified_claims: ['PARENT_UNRESOLVED'],
    ...overrides,
  });
}

describe('generic assessment validation', () => {
  test('accepts a valid assessment as an owned frozen copy', () => {
    const input = assessment();
    const result = validateContinuityAssessment(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(input);
    expect(result.value).not.toBe(input);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.parent_version_ids)).toBe(true);
  });

  test('rejects malformed unknown input', () => {
    expect(validateContinuityAssessment({ assessment_id: 1 }).ok).toBe(false);
    expect(validateContinuityAssessment(null).ok).toBe(false);
    expect(validateContinuityAssessment('assessment').ok).toBe(false);
  });

  test('rejects unknown fields', () => {
    const result = validateContinuityAssessment({ ...assessment(), extra: true });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
  });

  test('rejects duplicate and self parents', () => {
    const duplicate = assessment({
      parent_version_ids: [identityVersionId('iv-a'), identityVersionId('iv-a')],
    });
    const selfParent = assessment({ parent_version_ids: [identityVersionId('iv-d')] });

    expect(validateContinuityAssessment(duplicate).ok).toBe(false);
    expect(validateContinuityAssessment(selfParent).ok).toBe(false);
  });

  test('rejects non-finite assessed_at', () => {
    expect(validateContinuityAssessment(assessment({ assessed_at: timestamp(Number.NaN) })).ok).toBe(false);
  });

  test('rejects empty claim and evidence strings', () => {
    expect(validateContinuityAssessment(assessment({ verified_claims: [''] })).ok).toBe(false);
    expect(validateContinuityAssessment(assessment({ unverified_claims: [''] })).ok).toBe(false);
    expect(validateContinuityAssessment(assessment({ evidence_refs: [''] })).ok).toBe(false);
  });

  test('rejects accessor properties and symbols', () => {
    const withAccessor = { ...assessment() };
    Object.defineProperty(withAccessor, 'assessment_id', {
      get: () => assessmentId('assessment-1'),
      enumerable: true,
    });
    const withSymbol = { ...assessment(), [Symbol('extra')]: true };

    expect(validateContinuityAssessment(withAccessor).ok).toBe(false);
    expect(validateContinuityAssessment(withSymbol).ok).toBe(false);
  });
});

describe('generic registration', () => {
  test('admits a valid non-C-1 assessment', () => {
    const result = registerAssessment([], assessment({ unverified_claims: ['OK'] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  test('rejects PARENT_UNRESOLVED from generic registration', () => {
    const result = registerAssessment([], assessment({ unverified_claims: ['PARENT_UNRESOLVED'] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
  });

  test('rejects PARENT_UNRESOLVED in verified claims from generic registration', () => {
    const result = registerAssessment([], assessment({ verified_claims: ['PARENT_UNRESOLVED'] }));

    expect(result.ok).toBe(false);
  });
});

describe('C-1 contextual admission', () => {
  test('admits a declaration-scoped orphan assessment', () => {
    const result = registerOrphanAssessment(orphanAssessment(), mixedGraph, []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].parent_version_ids.map(String)).toEqual(['iv-a', 'iv-b']);
    expect(result.value[0].unverified_claims).toContain('PARENT_UNRESOLVED');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value[0])).toBe(true);
  });

  test('rejects a strict subset of the declared parent set', () => {
    const subset = orphanAssessment({ parent_version_ids: [identityVersionId('iv-b')] });

    expect(registerOrphanAssessment(subset, mixedGraph, []).ok).toBe(false);
  });

  test('rejects an undeclared parent', () => {
    const extra = orphanAssessment({
      parent_version_ids: [identityVersionId('iv-a'), identityVersionId('iv-b'), identityVersionId('iv-c')],
    });

    expect(registerOrphanAssessment(extra, mixedGraph, []).ok).toBe(false);
  });

  test('rejects when all declared parents are resolved', () => {
    const resolvedChild = descriptor({
      id: 'iv-r',
      participant: 'participant-a',
      lineage: [link('iv-a', 'MERGED_FROM'), link('iv-b', 'MERGED_FROM')],
    });
    const resolvedParentB = descriptor({ id: 'iv-b', participant: 'participant-a' });
    const resolvedGraph = buildLineageGraph(registry([alice], [resolvedParent, resolvedParentB, resolvedChild]));
    const candidate = orphanAssessment({ subject_version_id: identityVersionId('iv-r') });

    expect(registerOrphanAssessment(candidate, resolvedGraph, []).ok).toBe(false);
  });

  test('rejects PARENT_UNRESOLVED in verified claims', () => {
    const candidate = orphanAssessment({ verified_claims: ['PARENT_UNRESOLVED'] });

    expect(registerOrphanAssessment(candidate, mixedGraph, []).ok).toBe(false);
  });

  test('rejects CYCLE_DETECTED in a C-1 candidate', () => {
    const candidate = orphanAssessment({ unverified_claims: ['PARENT_UNRESOLVED', 'CYCLE_DETECTED'] });

    expect(registerOrphanAssessment(candidate, mixedGraph, []).ok).toBe(false);
  });

  test('rejects a manually constructed graph', () => {
    const fake: LineageGraph = { nodes: [], edges: [], unresolvedParents: [], cycles: [] };

    expect(registerOrphanAssessment(orphanAssessment(), fake, []).ok).toBe(false);
  });
});

describe('declaration-scoped PARENT_UNRESOLVED', () => {
  test('assessEdge returns the same assessment for resolved and unresolved edges', () => {
    const registered = registerOrphanAssessment(orphanAssessment(), mixedGraph, []);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;

    const resolvedEdge: EdgeRef = {
      child: identityVersionId('iv-d'),
      parent: identityVersionId('iv-a'),
      relation: 'MERGED_FROM',
    };
    const unresolvedEdge: EdgeRef = {
      child: identityVersionId('iv-d'),
      parent: identityVersionId('iv-b'),
      relation: 'MERGED_FROM',
    };

    const appliedResolved = assessEdge(resolvedEdge, registered.value, {}, CTX);
    const appliedUnresolved = assessEdge(unresolvedEdge, registered.value, {}, CTX);
    expect(appliedResolved.ok).toBe(true);
    expect(appliedUnresolved.ok).toBe(true);
    if (!appliedResolved.ok || !appliedUnresolved.ok) return;

    expect(appliedResolved.value.assessments.map((item) => String(item.assessment_id))).toEqual(['c1-1']);
    expect(appliedUnresolved.value.assessments.map((item) => String(item.assessment_id))).toEqual(['c1-1']);
    expect(plainGraph(mixedGraph).unresolvedParents).toEqual([['iv-d', ['iv-b']]]);
    expect(mixedGraph.nodes.map(String)).toContain('iv-a');
    // The claim is declaration-scoped: applicability to D->A does not make D->A unresolved.
    expect(appliedResolved.value.assessments[0].unverified_claims).toContain('PARENT_UNRESOLVED');
    expect(evaluateAssurance(appliedResolved.value, { required_claims: [] }, {}, CTX)).toEqual({
      status: 'SATISFIED',
    });
  });
});

describe('atomic batch admission', () => {
  test('admits all valid candidates as one frozen representation', () => {
    const first = orphanAssessment({ assessment_id: assessmentId('c1-1') });
    const second = orphanAssessment({ assessment_id: assessmentId('c1-2') });
    const result = registerOrphanAssessments([first, second], mixedGraph, []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  test('admits none when one candidate is invalid', () => {
    const good = orphanAssessment({ assessment_id: assessmentId('c1-1') });
    const bad = orphanAssessment({ assessment_id: assessmentId('c1-2'), verified_claims: ['PARENT_UNRESOLVED'] });
    const result = registerOrphanAssessments([good, bad], mixedGraph, []);

    expect(result.ok).toBe(false);
  });

  test('rejects duplicate IDs within the batch', () => {
    const first = orphanAssessment({ assessment_id: assessmentId('c1-1') });
    const second = orphanAssessment({ assessment_id: assessmentId('c1-1') });
    const result = registerOrphanAssessments([first, second], mixedGraph, []);

    expect(result.ok).toBe(false);
  });

  test('rejects duplicate IDs against existing assessments', () => {
    const existing = [orphanAssessment({ assessment_id: assessmentId('c1-1') })];
    const candidate = orphanAssessment({ assessment_id: assessmentId('c1-1') });

    expect(registerOrphanAssessments([candidate], mixedGraph, existing).ok).toBe(false);
  });

  test('rejects unknown supersession references and cycles', () => {
    const unknown = orphanAssessment({
      assessment_id: assessmentId('c1-2'),
      supersedes_assessment_id: assessmentId('missing'),
    });
    expect(registerOrphanAssessments([unknown], mixedGraph, []).ok).toBe(false);

    const first = orphanAssessment({
      assessment_id: assessmentId('c1-1'),
      supersedes_assessment_id: assessmentId('c1-2'),
    });
    const second = orphanAssessment({
      assessment_id: assessmentId('c1-2'),
      supersedes_assessment_id: assessmentId('c1-1'),
    });
    expect(registerOrphanAssessments([first, second], mixedGraph, []).ok).toBe(false);
  });

  test('leaves the caller existing array and members unchanged on failure', () => {
    const existing = [orphanAssessment({ assessment_id: assessmentId('c1-0') })];
    const before = JSON.stringify(existing);
    const bad = orphanAssessment({
      assessment_id: assessmentId('c1-1'),
      verified_claims: ['PARENT_UNRESOLVED'],
    });

    const result = registerOrphanAssessments([bad], mixedGraph, existing);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(existing)).toBe(before);
    expect(Object.isFrozen(existing)).toBe(false);
  });
});

describe('claim legality', () => {
  test('rejects a claim that is both verified and unverified', () => {
    const result = validateContinuityAssessment(assessment({ verified_claims: ['X'], unverified_claims: ['X'] }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
    expect(result.error.message).toContain('must not be both verified and unverified');
  });

  test('a self-contradictory assessment cannot satisfy assurance', () => {
    const registered = registerAssessment([], assessment({ verified_claims: ['X'], unverified_claims: ['X'] }));

    expect(registered.ok).toBe(false);
  });

  test('overlap is rejected even when one of the claims is a contextual claim', () => {
    const result = validateContinuityAssessment(
      assessment({ verified_claims: ['X'], unverified_claims: ['X', 'CYCLE_DETECTED'] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('must not be both verified and unverified');
  });

  test('CYCLE_DETECTED is admitted only through the C-2 contextual path', () => {
    const generic = registerAssessment([], assessment({ unverified_claims: ['CYCLE_DETECTED'] }));

    expect(generic.ok).toBe(false);
    if (generic.ok) return;
    expect(generic.error.message).toContain('requires contextual admission');
    expect(generic.error.message).toContain('registerCycleAssessments');

    const c1 = registerOrphanAssessment(
      orphanAssessment({ unverified_claims: ['PARENT_UNRESOLVED', 'CYCLE_DETECTED'] }),
      mixedGraph,
      [],
    );

    expect(c1.ok).toBe(false);
    if (c1.ok) return;
    expect(c1.error.message).toContain('must not record CYCLE_DETECTED');
  });
});
