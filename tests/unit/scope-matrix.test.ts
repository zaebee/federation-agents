import { describe, expect, test } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { discoverPaths, evaluateBinding } from '../../src/core/traversal.js';
import type {
  BindingResult,
  ConditionalVersionBinding,
  LineageTraversalScope,
  MergeClosureResult,
  PathOutcome,
} from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import {
  CTX,
  EMPTY_POLICY,
  assessmentRecord,
  bindingFor,
  chainState,
  diamondState,
  expectNormativeFailure,
  mergeClosureState,
  nestedMergeState,
  pathNodes,
} from '../support/traversal.js';

const SCOPES: readonly LineageTraversalScope[] = ['CONTINUATION_ONLY', 'CONTINUATION_AND_FORK', 'FULL_ANCESTRY'];
const RESTRICTED_SCOPES: readonly LineageTraversalScope[] = ['CONTINUATION_ONLY', 'CONTINUATION_AND_FORK'];

type MergeRelation = 'CONTINUATION' | 'FORKED_FROM' | 'MERGED_FROM';
type EntryRelation = 'CONTINUATION' | 'FORKED_FROM';

interface MergeState {
  readonly graph: LineageGraph;
  readonly descriptors: ReturnType<typeof descriptor>[];
  readonly assessments: ReturnType<typeof assessmentRecord>[];
}

function scopeBinding(
  scope: LineageTraversalScope,
  origin: string,
  targetParticipant: string,
  claims: readonly string[] = ['OK'],
): ConditionalVersionBinding {
  return bindingFor({ origin, selector: '>=1.0.0', scope, claims, targetParticipant });
}

function perPathOf(result: BindingResult): readonly PathOutcome[] {
  if (result.eligible) {
    return result.details.perPath;
  }
  if (!('details' in result)) {
    throw new Error('expected per-path details');
  }
  return result.details.perPath ?? [];
}

function evaluateD(
  state: MergeState,
  scope: LineageTraversalScope,
  targetParticipant: string,
  claims: readonly string[] = ['OK'],
): BindingResult {
  return evaluateBinding(
    state,
    scopeBinding(scope, 'iv-a-1', targetParticipant, claims),
    identityVersionId('iv-d'),
    EMPTY_POLICY,
    CTX,
  );
}

function expectMergeClosureFailure(
  result: BindingResult,
  expectedPathRelations: readonly MergeRelation[],
): Extract<MergeClosureResult, { status: 'UNSATISFIED' }> {
  const failure = expectNormativeFailure(result);
  expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
  const perPath = failure.details.perPath ?? [];
  expect(perPath).toHaveLength(1);
  expect(perPath[0].path.edges.map((edge) => edge.relation)).toEqual([...expectedPathRelations]);
  expect(perPath[0].outcome).toEqual({ status: 'VALID' });
  expect(perPath[0].closure?.status).toBe('UNSATISFIED');
  if (perPath[0].closure?.status !== 'UNSATISFIED') {
    throw new Error('expected an UNSATISFIED closure');
  }
  return perPath[0].closure;
}

function mixedState(options: {
  readonly entryRelation: EntryRelation;
  readonly parentBRelation: MergeRelation;
  readonly parentCRelation: MergeRelation;
}): MergeState {
  const candidateParticipant = options.entryRelation === 'CONTINUATION' ? 'participant-a' : 'participant-d';
  const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
  const b = descriptor({
    id: 'iv-b',
    participant: options.parentBRelation === 'CONTINUATION' ? candidateParticipant : 'participant-b',
  });
  const c = descriptor({
    id: 'iv-c',
    participant: options.parentCRelation === 'CONTINUATION' ? candidateParticipant : 'participant-c',
  });
  const candidate = descriptor({
    id: 'iv-d',
    participant: candidateParticipant,
    versionLabel: '2.0.0',
    lineage: [
      link('iv-a-1', options.entryRelation),
      link('iv-b', options.parentBRelation),
      link('iv-c', options.parentCRelation),
    ],
  });
  const participants = [
    participant('participant-a'),
    participant('participant-b'),
    participant('participant-c'),
    participant('participant-d'),
  ];
  return {
    graph: buildLineageGraph(registry(participants, [origin, b, c, candidate])),
    descriptors: [origin, b, c, candidate],
    assessments: [
      assessmentRecord({
        id: 'd-entry',
        subject: 'iv-d',
        parents: ['iv-a-1'],
        relation: options.entryRelation,
        verified: ['OK'],
      }),
    ],
  };
}

function multiParentState(missing?: 'iv-b' | 'iv-c' | 'iv-e'): MergeState {
  const alice = participant('participant-a');
  const bob = participant('participant-b');
  const carol = participant('participant-c');
  const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
  const b = descriptor({ id: 'iv-b', participant: 'participant-b' });
  const c = descriptor({ id: 'iv-c', participant: 'participant-c' });
  const e = descriptor({ id: 'iv-e', participant: 'participant-a' });
  const candidate = descriptor({
    id: 'iv-d',
    participant: 'participant-a',
    versionLabel: '2.0.0',
    lineage: [
      link('iv-a-1', 'CONTINUATION'),
      link('iv-b', 'MERGED_FROM'),
      link('iv-c', 'MERGED_FROM'),
      link('iv-e', 'CONTINUATION'),
    ],
  });
  const records = [
    assessmentRecord({
      id: 'd-entry',
      subject: 'iv-d',
      parents: ['iv-a-1'],
      relation: 'CONTINUATION',
      verified: ['OK'],
    }),
    assessmentRecord({ id: 'd-b', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
    assessmentRecord({ id: 'd-c', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
    assessmentRecord({ id: 'd-e', subject: 'iv-d', parents: ['iv-e'], relation: 'CONTINUATION', verified: ['OK'] }),
  ];
  return {
    graph: buildLineageGraph(registry([alice, bob, carol], [origin, b, c, e, candidate])),
    descriptors: [origin, b, c, e, candidate],
    assessments: records.filter((record) => String(record.parent_version_ids[0]) !== missing),
  };
}

describe('§8 scope matrix: relation shape × traversal scope', () => {
  test('CONTINUATION chain is discoverable in every scope', () => {
    const state = chainState();

    for (const scope of SCOPES) {
      const result = evaluateBinding(
        state,
        scopeBinding(scope, 'iv-a-1', 'participant-a', ['CONT_OK']),
        identityVersionId('iv-a-2'),
        EMPTY_POLICY,
        CTX,
      );

      expect(result.eligible).toBe(true);
      if (!result.eligible) continue;
      expect(result.acceptedPaths.map(pathNodes)).toEqual([['iv-a-2', 'iv-a-1']]);
      expect(result.acceptedPaths.every((path) => path.scope === scope)).toBe(true);
    }
  });

  test('FORKED_FROM chain is hidden from CONTINUATION_ONLY and visible in wider scopes', () => {
    const state = diamondState();
    const candidate = identityVersionId('iv-b');

    const restricted = evaluateBinding(
      state,
      scopeBinding('CONTINUATION_ONLY', 'iv-a-1', 'participant-b', ['CONT_OK']),
      candidate,
      EMPTY_POLICY,
      CTX,
    );
    const failure = expectNormativeFailure(restricted);
    expect(failure.code).toBe('ERR_NO_TRAVERSAL_PATH');

    for (const scope of ['CONTINUATION_AND_FORK', 'FULL_ANCESTRY'] as const) {
      const result = evaluateBinding(
        state,
        scopeBinding(scope, 'iv-a-1', 'participant-b', ['CONT_OK']),
        candidate,
        EMPTY_POLICY,
        CTX,
      );

      expect(result.eligible).toBe(true);
      if (!result.eligible) continue;
      expect(result.acceptedPaths.map(pathNodes)).toEqual([['iv-b', 'iv-a-1']]);
      expect(result.acceptedPaths[0].edges.map((edge) => edge.relation)).toEqual(['FORKED_FROM']);
    }
  });

  test('MERGED_FROM fan is hidden from restricted scopes and closed under FULL_ANCESTRY', () => {
    const state = diamondState();

    for (const scope of RESTRICTED_SCOPES) {
      const result = evaluateD(state, scope, 'participant-d', ['CONT_OK']);
      const failure = expectNormativeFailure(result);
      expect(failure.code).toBe('ERR_NO_TRAVERSAL_PATH');
      expect(failure.details.perPath).toBeUndefined();
    }

    const result = evaluateD(state, 'FULL_ANCESTRY', 'participant-d', ['CONT_OK']);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    const accepted = result.acceptedPaths.map(pathNodes);
    expect(accepted).toContainEqual(['iv-d', 'iv-b', 'iv-a-1']);
    expect(accepted).toContainEqual(['iv-d', 'iv-c', 'iv-a-1']);
    for (const outcome of result.details.perPath) {
      expect(outcome.outcome).toEqual({ status: 'VALID' });
      expect(outcome.closure).toEqual({ status: 'SATISFIED' });
    }
  });
});

describe('scope governs discovery, not closure', () => {
  test('restricted scopes never disclose MERGED_FROM path edges', () => {
    const fixtures = [chainState(), diamondState(), mergeClosureState(), nestedMergeState()];

    for (const state of fixtures) {
      for (const scope of RESTRICTED_SCOPES) {
        for (const candidate of state.graph.nodes) {
          for (const origin of state.graph.nodes) {
            const discovered = discoverPaths(state.graph, scope, candidate, origin);
            if (!discovered.ok) continue;

            for (const path of discovered.value) {
              expect(path.scope).toBe(scope);
              expect(path.edges.some((edge) => edge.relation === 'MERGED_FROM')).toBe(false);
              if (scope === 'CONTINUATION_ONLY') {
                expect(path.edges.every((edge) => edge.relation === 'CONTINUATION')).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  test('a pure merge-dependent candidate fails at discovery, not at closure', () => {
    const state = diamondState();

    for (const scope of RESTRICTED_SCOPES) {
      const result = evaluateD(state, scope, 'participant-d', ['CONT_OK']);

      const failure = expectNormativeFailure(result);
      expect(failure.code).toBe('ERR_NO_TRAVERSAL_PATH');
      expect(failure.code).not.toBe('ERR_MERGE_BRANCH_UNSATISFIED');
      expect(failure.details.perPath).toBeUndefined();
    }
  });

  test('a mixed-relation merge node is closed over MERGED_FROM parents when reached through a permitted edge', () => {
    const scenarios = [
      { scope: 'CONTINUATION_ONLY', entryRelation: 'CONTINUATION', targetParticipant: 'participant-a' },
      { scope: 'CONTINUATION_AND_FORK', entryRelation: 'FORKED_FROM', targetParticipant: 'participant-d' },
    ] as const;

    for (const scenario of scenarios) {
      const state = mixedState({
        entryRelation: scenario.entryRelation,
        parentBRelation: 'MERGED_FROM',
        parentCRelation: 'MERGED_FROM',
      });
      const result = evaluateD(state, scenario.scope, scenario.targetParticipant);
      const failures = expectMergeClosureFailure(result, [scenario.entryRelation]).failures;
      expect(failures.map((item) => String(item.branch.parent)).sort()).toEqual(['iv-b', 'iv-c']);
      expect(failures.every((item) => item.branch.relation === 'MERGED_FROM')).toBe(true);
      expect(failures.every((item) => item.reason === 'NO_APPLICABLE_ASSESSMENT')).toBe(true);
    }
  });
});

describe('FULL_ANCESTRY immediate closure consistency', () => {
  test('closure checks every direct parent edge and reports only the failing branches', () => {
    for (const scope of ['CONTINUATION_ONLY', 'FULL_ANCESTRY'] as const) {
      for (const missing of ['iv-b', 'iv-c', 'iv-e'] as const) {
        const state = multiParentState(missing);
        const closure = expectMergeClosureFailure(evaluateD(state, scope, 'participant-a'), ['CONTINUATION']);

        expect(closure.failures).toHaveLength(1);
        expect(String(closure.failures[0].branch.parent)).toBe(missing);
        expect(closure.failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');
      }
    }
  });

  test('a merge node whose parent branches all pass has a satisfied closure', () => {
    const state = multiParentState();

    for (const scope of ['CONTINUATION_ONLY', 'FULL_ANCESTRY'] as const) {
      const result = evaluateD(state, scope, 'participant-a');

      expect(result.eligible).toBe(true);
      if (!result.eligible) continue;
      expect(result.details.perPath).toHaveLength(1);
      expect(result.details.perPath[0].outcome).toEqual({ status: 'VALID' });
      expect(result.details.perPath[0].closure).toEqual({ status: 'SATISFIED' });
    }
  });

  test('closure reports only immediate branches, never recursive ones', () => {
    const state = mergeClosureState();
    const result = evaluateD(state, 'FULL_ANCESTRY', 'participant-d');

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    const perPath = failure.details.perPath ?? [];
    const survived = perPath.find((item) => item.outcome.status === 'VALID');
    expect(survived?.closure?.status).toBe('UNSATISFIED');
    if (survived?.closure?.status !== 'UNSATISFIED') return;

    expect(survived.closure.failures).toHaveLength(1);
    expect(String(survived.closure.failures[0].branch.parent)).toBe('iv-b');
    expect(survived.closure.failures.some((item) => String(item.branch.parent) === 'iv-a-1')).toBe(false);
  });
});

describe('bounded mixed-relation enumeration', () => {
  const entryRelations: readonly EntryRelation[] = ['CONTINUATION', 'FORKED_FROM'];
  const parentRelations: readonly MergeRelation[] = ['CONTINUATION', 'FORKED_FROM', 'MERGED_FROM'];

  test('discovery stays scope-permitted and closure stays scope-independent across 18 graphs', () => {
    for (const entryRelation of entryRelations) {
      for (const parentBRelation of parentRelations) {
        for (const parentCRelation of parentRelations) {
          const state = mixedState({ entryRelation, parentBRelation, parentCRelation });
          const targetParticipant = entryRelation === 'CONTINUATION' ? 'participant-a' : 'participant-d';

          for (const scope of SCOPES) {
            const result = evaluateD(state, scope, targetParticipant);
            const entryAllowed =
              scope === 'FULL_ANCESTRY' || entryRelation === 'CONTINUATION' || scope === 'CONTINUATION_AND_FORK';

            if (!entryAllowed) {
              const failure = expectNormativeFailure(result);
              expect(failure.code).toBe('ERR_NO_TRAVERSAL_PATH');
              continue;
            }

            const mergeParentPresent = parentBRelation === 'MERGED_FROM' || parentCRelation === 'MERGED_FROM';
            if (mergeParentPresent) {
              const closure = expectMergeClosureFailure(result, [entryRelation]);
              expect(closure.failures.map((item) => String(item.branch.parent)).sort()).toEqual(['iv-b', 'iv-c']);
              expect(closure.failures.map((item) => item.branch.relation).sort()).toEqual(
                [parentBRelation, parentCRelation].sort(),
              );
            } else {
              expect(result.eligible).toBe(true);
              if (!result.eligible) continue;
              expect(perPathOf(result)).toHaveLength(1);
              expect(perPathOf(result)[0].closure).toEqual({ status: 'SATISFIED' });
            }
          }
        }
      }
    }
  });
});
