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
