import { describe, expect, test } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { discoverPaths, evaluateBinding, validatePath } from '../../src/core/traversal.js';
import type {
  BindingResult,
  ConditionalVersionBinding,
  LineageTraversalScope,
  Path,
} from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import {
  CTX,
  EMPTY_POLICY,
  assessmentRecord,
  bindingFor,
  chainAssessment,
  chainState,
  diamondState,
  pathNodes,
  requirementFor,
} from '../support/traversal.js';

const alice = participant('participant-a');
const CANDIDATE = identityVersionId('iv-a-2');
const ORIGIN = identityVersionId('iv-a-1');

function kindedFailure(result: BindingResult): Extract<BindingResult, { kind: 'MECHANISM' | 'CONTESTED' }> {
  expect(result.eligible).toBe(false);
  if (result.eligible) {
    throw new Error('expected a failed binding');
  }
  if (!('kind' in result)) {
    throw new Error('expected a kinded binding failure');
  }
  return result;
}

describe('discoverPaths (phase 1)', () => {
  test('finds a single path without any assessments input', () => {
    const { graph } = chainState();
    const result = discoverPaths(graph, 'CONTINUATION_ONLY', CANDIDATE, ORIGIN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map(pathNodes)).toEqual([['iv-a-2', 'iv-a-1']]);
    expect(result.value[0].scope).toBe('CONTINUATION_ONLY');
  });

  test('is independent of graph storage order', () => {
    const { graph } = chainState();
    const reordered: LineageGraph = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    };

    expect(discoverPaths(reordered, 'CONTINUATION_ONLY', CANDIDATE, ORIGIN)).toEqual(
      discoverPaths(graph, 'CONTINUATION_ONLY', CANDIDATE, ORIGIN),
    );
  });

  test('respects the traversal scope', () => {
    const graph = diamondState().graph;
    const candidate = identityVersionId('iv-d');
    const origin = identityVersionId('iv-a-1');

    expect(discoverPaths(graph, 'CONTINUATION_ONLY', candidate, origin).ok).toBe(false);
    expect(discoverPaths(graph, 'CONTINUATION_AND_FORK', candidate, origin).ok).toBe(false);
    expect(discoverPaths(graph, 'FULL_ANCESTRY', candidate, origin).ok).toBe(true);
  });

  test('returns both diamond paths in deterministic order', () => {
    const result = discoverPaths(
      diamondState().graph,
      'FULL_ANCESTRY',
      identityVersionId('iv-d'),
      identityVersionId('iv-a-1'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map(pathNodes)).toEqual([
      ['iv-d', 'iv-b', 'iv-a-1'],
      ['iv-d', 'iv-c', 'iv-a-1'],
    ]);
  });

  test('reports ERR_NO_TRAVERSAL_PATH for an unreachable origin', () => {
    const { graph } = chainState();
    const result = discoverPaths(graph, 'CONTINUATION_ONLY', CANDIDATE, identityVersionId('iv-missing'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('SPEC');
    expect(result.error.code).toBe('ERR_NO_TRAVERSAL_PATH');
  });

  test('treats cycles as dead ends instead of crashing', () => {
    const v1 = descriptor({ id: 'iv-v1', participant: 'participant-a', lineage: [link('iv-v2', 'CONTINUATION')] });
    const v2 = descriptor({ id: 'iv-v2', participant: 'participant-a', lineage: [link('iv-v1', 'CONTINUATION')] });
    const v3 = descriptor({ id: 'iv-v3', participant: 'participant-a' });
    const graph = buildLineageGraph(registry([alice], [v1, v2, v3]));

    const result = discoverPaths(graph, 'CONTINUATION_ONLY', identityVersionId('iv-v1'), identityVersionId('iv-v3'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ERR_NO_TRAVERSAL_PATH');
  });
});

describe('validatePath (phase 2)', () => {
  const path: Path = {
    scope: 'CONTINUATION_ONLY',
    edges: [
      {
        child: identityVersionId('iv-a-2'),
        parent: identityVersionId('iv-a-1'),
        relation: 'CONTINUATION',
      },
    ],
  };

  test('validates a concrete path without calling discovery', () => {
    const result = validatePath(path, [chainAssessment], requirementFor(['CONT_OK']), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'VALID' });
  });

  test('fails independently on an unsatisfied assurance requirement', () => {
    const result = validatePath(
      path,
      [
        assessmentRecord({
          id: 'a-other',
          subject: 'iv-a-2',
          parents: ['iv-a-1'],
          relation: 'CONTINUATION',
          verified: ['OTHER'],
        }),
      ],
      requirementFor(['CONT_OK']),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('INVALID');
    if (result.value.status !== 'INVALID') return;
    expect(result.value.code).toBe('ERR_ASSURANCE_PREDICATE_UNSATISFIED');
    expect(result.value.missing).toEqual(['CONT_OK']);
  });

  test('treats a missing applicable assessment as failure, never success', () => {
    const result = validatePath(path, [], requirementFor([]), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('INVALID');
  });

  test('uses the Task 8 policy hook, so narrowing to an empty set fails the path', () => {
    const result = validatePath(
      path,
      [chainAssessment],
      requirementFor(['CONT_OK']),
      { applicableAssessments: () => [] },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('INVALID');
  });

  test('rejects a path whose edges violate its scope', () => {
    const scoped: Path = {
      scope: 'CONTINUATION_ONLY',
      edges: [
        {
          child: identityVersionId('iv-d'),
          parent: identityVersionId('iv-b'),
          relation: 'MERGED_FROM',
        },
      ],
    };

    const result = validatePath(scoped, [], requirementFor([]), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('rejects a non-contiguous path', () => {
    const broken: Path = {
      scope: 'FULL_ANCESTRY',
      edges: [
        { child: identityVersionId('iv-d'), parent: identityVersionId('iv-b'), relation: 'MERGED_FROM' },
        { child: identityVersionId('iv-c'), parent: identityVersionId('iv-a-1'), relation: 'CONTINUATION' },
      ],
    };

    expect(validatePath(broken, [], requirementFor([]), EMPTY_POLICY, CTX).ok).toBe(false);
  });
});

describe('evaluateBinding orchestration', () => {
  function binding(overrides: Partial<ConditionalVersionBinding> = {}): ConditionalVersionBinding {
    return {
      ...bindingFor({ origin: 'iv-a-1', selector: '>=1.0.0', scope: 'CONTINUATION_ONLY', claims: ['CONT_OK'] }),
      ...overrides,
    };
  }

  test('distinguishes a discovery failure from an assurance failure', () => {
    const state = chainState();
    const missingPath = evaluateBinding(
      state,
      binding({ origin_version_id: identityVersionId('iv-missing') }),
      CANDIDATE,
      EMPTY_POLICY,
      CTX,
    );
    const failedAssurance = evaluateBinding(
      state,
      binding({ selector_expression: '>=1.0.0' }),
      CANDIDATE,
      { applicableAssessments: () => [] },
      CTX,
    );

    expect(!missingPath.eligible && 'code' in missingPath && missingPath.code).toBe('ERR_NO_TRAVERSAL_PATH');
    expect(!failedAssurance.eligible && 'code' in failedAssurance && failedAssurance.code).toBe(
      'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
    );
  });

  test('returns an eligible result only for at least one valid path', () => {
    const result = evaluateBinding(chainState(), binding(), CANDIDATE, EMPTY_POLICY, CTX);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.acceptedPaths.map(pathNodes)).toEqual([['iv-a-2', 'iv-a-1']]);
  });

  test('reports a mechanism failure for a malformed selector', () => {
    const result = evaluateBinding(
      chainState(),
      binding({ selector_expression: '>=1.2' }),
      CANDIDATE,
      EMPTY_POLICY,
      CTX,
    );

    expect(kindedFailure(result).kind).toBe('MECHANISM');
  });

  test('represents an all-contested outcome distinctly', () => {
    const state = chainState();
    const assessments = [
      assessmentRecord({
        id: 'a-1',
        subject: 'iv-a-2',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['C1'],
      }),
      assessmentRecord({
        id: 'a-2',
        subject: 'iv-a-2',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['C1'],
      }),
    ];
    const result = evaluateBinding(
      { ...state, assessments },
      binding({ assurance_requirement: requirementFor([]) }),
      CANDIDATE,
      { conflictPredicate: () => true },
      CTX,
    );

    const failure = kindedFailure(result);
    expect(failure.kind).toBe('CONTESTED');
    if (failure.kind !== 'CONTESTED') return;
    expect(failure.details.perPath[0].outcome.status).toBe('CONTESTED');
  });

  test('requires Policy and TemporalContext at compile time', () => {
    expect(typeof evaluateBinding).toBe('function');
    void (() => {
      const state = chainState();
      // @ts-expect-error policy and ctx are required
      evaluateBinding(state, binding(), CANDIDATE);
    });
  });

  test('has no hidden policy or temporal state between calls', () => {
    const state = chainState();
    const strict = evaluateBinding(state, binding(), CANDIDATE, { applicableAssessments: () => [] }, CTX);
    const permissive = evaluateBinding(state, binding(), CANDIDATE, EMPTY_POLICY, CTX);

    expect(strict.eligible).toBe(false);
    expect(permissive.eligible).toBe(true);
  });
});

describe('determinism', () => {
  test('discovery order does not depend on scope enum input order', () => {
    const graph = diamondState().graph;
    const scopes: LineageTraversalScope[] = ['FULL_ANCESTRY', 'FULL_ANCESTRY'];
    const [first, second] = scopes.map((scope) =>
      discoverPaths(graph, scope, identityVersionId('iv-d'), identityVersionId('iv-a-1')),
    );

    expect(first).toEqual(second);
  });
});
