import { describe, expect, test } from 'bun:test';
import { evaluateBinding } from '../../src/core/traversal.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import {
  CTX,
  EMPTY_POLICY,
  assessmentRecord,
  bindingFor,
  b5State,
  chainState,
  diamondState,
  evaluateAt,
  expectB5Refusal,
  expectClosureFailure,
  expectNormativeFailure,
  forkAssessment,
  fullAncestryBinding,
  mergeAssessment,
  mergeClosureState,
  mergeSkeleton,
  pathNodes,
} from '../support/traversal.js';

const alice = participant('participant-a');
const bob = participant('participant-b');

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

  test('B-4 a merge node reached through CONTINUATION still closes its merge parents', () => {
    const a = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const b = descriptor({ id: 'iv-b', participant: 'participant-b', versionLabel: '1.0.0' });
    const c = descriptor({ id: 'iv-c', participant: 'participant-c', versionLabel: '1.0.0' });
    const d = descriptor({
      id: 'iv-d',
      participant: 'participant-a',
      versionLabel: '2.0.0',
      lineage: [link('iv-a-1', 'CONTINUATION'), link('iv-b', 'MERGED_FROM'), link('iv-c', 'MERGED_FROM')],
    });
    const carol = participant('participant-c');
    const graph = buildLineageGraph(registry([alice, bob, carol], [a, b, c, d]));
    const assessments = [
      assessmentRecord({
        id: 'da',
        subject: 'iv-d',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
    ];
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-a',
    });

    const result = evaluateAt({ graph, descriptors: [a, b, c, d], assessments }, binding);

    expectClosureFailure(result, ['iv-b', 'iv-c']);
  });

  test('B-5 untrusted positive assessment cannot substitute for the trusted auditor', () => {
    const { state, binding } = b5State();
    const before = JSON.stringify(state);

    const result = evaluateBinding(state, binding, identityVersionId('iv-a-2'), EMPTY_POLICY, CTX);

    expectB5Refusal(result);
    expect(JSON.stringify(state)).toBe(before);
    expect(JSON.stringify(state).toLowerCase()).not.toContain('grant');
  });

  test('B-5 adversarial policy hook cannot promote the untrusted assessment', () => {
    const { state, binding } = b5State();
    const before = JSON.stringify(state);

    const result = evaluateBinding(
      state,
      binding,
      identityVersionId('iv-a-2'),
      { applicableAssessments: (_edge, assessments) => assessments },
      CTX,
    );

    expectB5Refusal(result);
    expect(JSON.stringify(state)).toBe(before);
  });

  test('B-4 mixed direct parent relations are all closed', () => {
    const { alice, bob, dave, a, b, d } = mergeSkeleton([link('iv-e', 'CONTINUATION')]);
    const c = descriptor({ id: 'iv-c', participant: 'participant-b', versionLabel: '1.0.0' });
    const e = descriptor({ id: 'iv-e', participant: 'participant-d', versionLabel: '1.0.0' });
    const graph = buildLineageGraph(registry([alice, bob, dave], [a, b, c, d, e]));
    const assessments = [mergeAssessment('db', 'iv-b'), mergeAssessment('dc', 'iv-c'), forkAssessment()];
    const binding = fullAncestryBinding();

    const result = evaluateAt({ graph, descriptors: [a, b, c, d, e], assessments }, binding);

    const failures = expectClosureFailure(result, ['iv-e']);
    expect(failures).toHaveLength(1);
    expect(failures[0].branch).toEqual({
      child: identityVersionId('iv-d'),
      parent: identityVersionId('iv-e'),
      relation: 'CONTINUATION',
    });
    expect(failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');
  });

  test('B-6 non-origin direct branch fails closure without checking deeper edges', () => {
    const { graph, descriptors, assessments, binding } = mergeClosureState({
      nonOriginBranch: true,
      missingBranch: 'c',
    });

    const result = evaluateAt({ graph, descriptors, assessments }, binding);

    const failures = expectClosureFailure(result, ['iv-c']);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');
    expect(failures.some((item) => String(item.branch.parent) === 'iv-x')).toBe(false);
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
      JSON.stringify(evaluateAt({ graph, descriptors, assessments: ordered }, binding)),
    );

    expect(new Set(results).size).toBe(1);
  });
});
