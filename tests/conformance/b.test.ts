import { describe, expect, test } from 'bun:test';
import { evaluateBinding } from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import {
  CTX,
  EMPTY_POLICY,
  assessmentRecord,
  bindingFor,
  chainState,
  diamondState,
  expectNormativeFailure,
  mergeClosureState,
  pathNodes,
} from '../support/traversal.js';

function stateSnapshot(state: { descriptors: readonly unknown[]; graph: unknown }): string {
  return JSON.stringify({ descriptors: state.descriptors, graph: state.graph });
}

describe('§12 Category B: conditional binding and traversal (Task 9 subset)', () => {
  test('B-1 exact anchoring rejects an otherwise bindable candidate', () => {
    const { candidate, graph, descriptors } = chainState();
    const state = { graph, descriptors, assessments: [] };
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: [],
    });
    const before = stateSnapshot(state);

    const result = evaluateBinding(state, binding, identityVersionId('iv-a-2'), EMPTY_POLICY, CTX);

    expect(result).toEqual({
      eligible: false,
      code: 'ERR_AUTHORITY_BINDING_MISMATCH',
      details: {},
    });
    expect(stateSnapshot(state)).toBe(before);
    expect(candidate.id).toBe(identityVersionId('iv-a-2'));
    expect(JSON.stringify(state).toLowerCase()).not.toContain('grant');
  });

  test('B-2 an unsatisfied required claim keeps the version and declaration intact', () => {
    const { candidate, graph, descriptors } = chainState();
    const assessments = [
      assessmentRecord({
        id: 'a-b2',
        subject: 'iv-a-2',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['PARENT_SIGNATURE_MATCH'],
      }),
    ];
    const state = { graph, descriptors, assessments };
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['PARENT_SIGNATURE_MATCH', 'GOVERNANCE_REVIEWED'],
    });
    const before = stateSnapshot(state);
    const candidateBefore = JSON.stringify(candidate);

    const result = evaluateBinding(state, binding, identityVersionId('iv-a-2'), EMPTY_POLICY, CTX);

    expect(result.eligible).toBe(false);
    if (result.eligible) return;
    expect('code' in result).toBe(true);
    if (!('code' in result)) return;
    expect(result.code).toBe('ERR_ASSURANCE_PREDICATE_UNSATISFIED');
    expect(result.details.perPath).toHaveLength(1);
    const outcome = result.details.perPath?.[0].outcome;
    expect(outcome?.status).toBe('INVALID');
    if (outcome?.status !== 'INVALID') return;
    expect(outcome.missing).toEqual(['GOVERNANCE_REVIEWED']);
    expect(outcome.disallowed).toEqual([]);

    expect(stateSnapshot(state)).toBe(before);
    expect(JSON.stringify(candidate)).toBe(candidateBefore);
  });

  test('B-3 diamond lineage yields both valid paths without authority artifacts', () => {
    const { graph, descriptors, assessments } = diamondState();
    const state = { graph, descriptors, assessments };
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['CONT_OK'],
      targetParticipant: 'participant-d',
    });
    const before = stateSnapshot(state);

    const result = evaluateBinding(state, binding, identityVersionId('iv-d'), EMPTY_POLICY, CTX);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.acceptedPaths.map(pathNodes)).toEqual([
      ['iv-d', 'iv-b', 'iv-a-1'],
      ['iv-d', 'iv-c', 'iv-a-1'],
    ]);
    expect(stateSnapshot(state)).toBe(before);
    expect(JSON.stringify(state).toLowerCase()).not.toContain('grant');
  });
});

describe('§12 Category B: merge closure (Task 10)', () => {
  test('B-4 closure-only branch failure preserves path-level and closure evidence', () => {
    const { graph, descriptors, assessments, binding } = mergeClosureState();
    const state = { graph, descriptors, assessments };
    const before = JSON.stringify(state);

    const result = evaluateBinding(state, binding, identityVersionId('iv-d'), EMPTY_POLICY, CTX);

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    const perPath = failure.details.perPath ?? [];
    expect(perPath).toHaveLength(2);

    const pathLevelFailure = perPath.find(
      (item) => JSON.stringify(pathNodes(item.path)) === JSON.stringify(['iv-d', 'iv-b', 'iv-a-1']),
    );
    expect(pathLevelFailure?.outcome.status).toBe('INVALID');
    if (pathLevelFailure?.outcome.status !== 'INVALID') return;
    expect(pathLevelFailure.outcome.missing).toEqual(['OK']);

    const survived = perPath.find(
      (item) => JSON.stringify(pathNodes(item.path)) === JSON.stringify(['iv-d', 'iv-c', 'iv-a-1']),
    );
    expect(survived?.outcome).toEqual({ status: 'VALID' });
    expect(survived?.closure?.status).toBe('UNSATISFIED');
    if (survived?.closure?.status !== 'UNSATISFIED') return;
    expect(survived.closure.failures).toHaveLength(1);
    expect(survived.closure.failures[0].branch).toEqual({
      child: identityVersionId('iv-d'),
      parent: identityVersionId('iv-b'),
      relation: 'MERGED_FROM',
    });
    expect(survived.closure.failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');

    expect(JSON.stringify(state)).toBe(before);
  });

  test('B-5 untrusted positive assessment cannot substitute for the trusted auditor', () => {
    const { graph, descriptors } = chainState();
    const trusted = assessmentRecord({
      id: 'trusted',
      subject: 'iv-a-2',
      parents: ['iv-a-1'],
      relation: 'CONTINUATION',
      verified: [],
      unverified: ['SPEC_MISMATCH'],
      by: 'domain-auditor',
    });
    const untrusted = assessmentRecord({
      id: 'untrusted',
      subject: 'iv-a-2',
      parents: ['iv-a-1'],
      relation: 'CONTINUATION',
      verified: ['SPEC_MISMATCH'],
      by: 'untrusted.org',
    });
    const state = { graph, descriptors, assessments: [trusted, untrusted] };
    const before = JSON.stringify(state);
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['SPEC_MISMATCH'],
      trusted: ['domain-auditor'],
    });

    const result = evaluateBinding(state, binding, identityVersionId('iv-a-2'), EMPTY_POLICY, CTX);

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('ERR_ASSURANCE_PREDICATE_UNSATISFIED');
    const outcome = failure.details.perPath?.[0].outcome;
    expect(outcome?.status).toBe('INVALID');
    if (outcome?.status !== 'INVALID') return;
    expect(outcome.missing).toEqual(['SPEC_MISMATCH']);
    expect('negative' in outcome).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(state).toLowerCase()).not.toContain('grant');
  });

  test('B-6 non-origin direct branch fails closure without checking deeper edges', () => {
    const { graph, descriptors, assessments, binding } = mergeClosureState({
      nonOriginBranch: true,
      missingBranch: 'c',
    });

    const result = evaluateBinding(
      { graph, descriptors, assessments },
      binding,
      identityVersionId('iv-d'),
      EMPTY_POLICY,
      CTX,
    );

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    const survived = failure.details.perPath?.[0];
    expect(survived?.outcome.status).toBe('VALID');
    expect(survived?.closure?.status).toBe('UNSATISFIED');
    if (survived?.closure?.status !== 'UNSATISFIED') return;
    expect(survived.closure.failures).toHaveLength(1);
    expect(String(survived.closure.failures[0].branch.parent)).toBe('iv-c');
    expect(survived.closure.failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');
    expect(survived.closure.failures.some((item) => String(item.branch.parent) === 'iv-x')).toBe(false);
  });

  test('B-7 all assessment arrival permutations produce the same result', () => {
    const { graph, descriptors, assessments, binding } = mergeClosureState();
    const permutations = (items: typeof assessments): (typeof assessments)[] => {
      if (items.length <= 1) return [[...items]];
      return items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
      );
    };

    const results = permutations(assessments).map((ordered) =>
      JSON.stringify(
        evaluateBinding(
          { graph, descriptors, assessments: ordered },
          binding,
          identityVersionId('iv-d'),
          EMPTY_POLICY,
          CTX,
        ),
      ),
    );

    expect(new Set(results).size).toBe(1);
  });
});
