import { describe, expect, test } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import { discoverPaths, evaluateBinding, validateMergeClosure, validatePath } from '../../src/core/traversal.js';
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
  MERGE_SURVIVING_PATH,
  chainAssessment,
  chainState,
  cyclePairState,
  diamondState,
  evaluateAt,
  expectContestedFailure,
  expectMechanismFailure,
  expectNormativeFailure,
  fullAncestryBinding,
  mergeClosureState,
  mergeSkeleton,
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

function diamondBinding(): ConditionalVersionBinding {
  return bindingFor({
    origin: 'iv-a-1',
    selector: '>=1.0.0',
    scope: 'FULL_ANCESTRY',
    claims: ['OK'],
    targetParticipant: 'participant-d',
  });
}

function diamondAssessments(
  config: {
    readonly dbContested?: boolean;
    readonly dcContested?: boolean;
    readonly caClaims?: readonly string[];
  } = {},
) {
  const caClaims = config.caClaims ?? ['OK'];
  const db = config.dbContested
    ? [
        assessmentRecord({ id: 'db1', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
        assessmentRecord({ id: 'db2', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
      ]
    : [assessmentRecord({ id: 'db', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] })];
  const dc = config.dcContested
    ? [
        assessmentRecord({ id: 'dc1', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
        assessmentRecord({ id: 'dc2', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
      ]
    : [assessmentRecord({ id: 'dc', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] })];

  return [
    ...db,
    assessmentRecord({ id: 'ba', subject: 'iv-b', parents: ['iv-a-1'], relation: 'FORKED_FROM', verified: ['OK'] }),
    ...dc,
    assessmentRecord({ id: 'ca', subject: 'iv-c', parents: ['iv-a-1'], relation: 'CONTINUATION', verified: caClaims }),
  ];
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

  test('prunes dead subgraphs for an unreachable origin in stacked diamonds', () => {
    const count = 30;
    const versions = [descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' })];
    for (let index = 0; index < count; index += 1) {
      const base = `iv-base${index}`;
      const next = `iv-base${index + 1}`;
      versions.push(
        descriptor({
          id: `iv-l${index}`,
          participant: 'participant-a',
          versionLabel: '1.0.0',
          lineage: [link(next, 'FORKED_FROM')],
        }),
        descriptor({
          id: `iv-r${index}`,
          participant: 'participant-a',
          versionLabel: '1.0.0',
          lineage: [link(next, 'FORKED_FROM')],
        }),
        descriptor({
          id: base,
          participant: 'participant-a',
          versionLabel: '1.0.0',
          lineage: [link(`iv-l${index}`, 'MERGED_FROM'), link(`iv-r${index}`, 'MERGED_FROM')],
        }),
      );
    }
    versions.push(descriptor({ id: `iv-base${count}`, participant: 'participant-a', versionLabel: '1.0.0' }));
    const graph = buildLineageGraph(registry([alice], versions));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-base0'), identityVersionId('iv-origin'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ERR_NO_TRAVERSAL_PATH');
  });

  test('handles a high-degree reverse adjacency without quadratic deduplication', () => {
    const origin = descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' });
    const children = Array.from({ length: 200 }, (_, index) =>
      descriptor({
        id: `iv-c${index}`,
        participant: 'participant-a',
        versionLabel: '1.0.0',
        lineage: [link('iv-origin', 'FORKED_FROM')],
      }),
    );
    const graph = buildLineageGraph(registry([alice], [origin, ...children]));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-c199'), identityVersionId('iv-origin'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(pathNodes(result.value[0])).toEqual(['iv-c199', 'iv-origin']);
  });

  test('deduplicates duplicate declared edges in a wide merge', () => {
    const origin = descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' });
    const parentCount = 512;
    const parents = Array.from({ length: parentCount }, (_, index) =>
      descriptor({
        id: `iv-p${index}`,
        participant: 'participant-b',
        versionLabel: '1.0.0',
        lineage: [link('iv-origin', 'FORKED_FROM')],
      }),
    );
    const candidate = descriptor({
      id: 'iv-merge',
      participant: 'participant-d',
      versionLabel: '2.0.0',
      lineage: parents.flatMap((_, index) => [
        link(`iv-p${index}`, 'MERGED_FROM'),
        link(`iv-p${index}`, 'MERGED_FROM'),
      ]),
    });
    const dave = participant('participant-d');
    const bob = participant('participant-b');
    const alice = participant('participant-a');
    const graph = buildLineageGraph(registry([alice, bob, dave], [origin, ...parents, candidate]));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-merge'), identityVersionId('iv-origin'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(parentCount);
    const parentsInPaths = new Set(result.value.map((path) => String(path.edges[0].parent)));
    expect(parentsInPaths.size).toBe(parentCount);
  });

  test('discovers a 10,000-edge chain', () => {
    const count = 10_000;
    const alice = participant('participant-a');
    const versions = [descriptor({ id: 'iv-c0', participant: 'participant-a', versionLabel: '1.0.0' })];
    for (let index = 1; index < count; index += 1) {
      versions.push(
        descriptor({
          id: `iv-c${index}`,
          participant: 'participant-a',
          versionLabel: '1.0.0',
          lineage: [link(`iv-c${index - 1}`, 'CONTINUATION')],
        }),
      );
    }
    const graph = buildLineageGraph(registry([alice], versions));

    const result = discoverPaths(
      graph,
      'CONTINUATION_ONLY',
      identityVersionId(`iv-c${count - 1}`),
      identityVersionId('iv-c0'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].edges).toHaveLength(count - 1);
  });

  test('keeps a cycle in one branch from invalidating another branch', () => {
    const a = participant('participant-a');
    const b = participant('participant-b');
    const dave = participant('participant-d');
    const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
    const x = descriptor({ id: 'iv-x', participant: 'participant-b', lineage: [link('iv-y', 'CONTINUATION')] });
    const y = descriptor({
      id: 'iv-y',
      participant: 'participant-b',
      lineage: [link('iv-x', 'CONTINUATION'), link('iv-a-1', 'CONTINUATION')],
    });
    const good = descriptor({ id: 'iv-good', participant: 'participant-a', lineage: [link('iv-a-1', 'CONTINUATION')] });
    const candidate = descriptor({
      id: 'iv-d',
      participant: 'participant-d',
      lineage: [link('iv-x', 'MERGED_FROM'), link('iv-good', 'MERGED_FROM')],
    });
    const graph = buildLineageGraph(registry([a, b, dave], [origin, x, y, good, candidate]));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-d'), identityVersionId('iv-a-1'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map(pathNodes)).toEqual([
      ['iv-d', 'iv-good', 'iv-a-1'],
      ['iv-d', 'iv-x', 'iv-y', 'iv-a-1'],
    ]);
  });

  test('treats visited as path-local across sibling branches', () => {
    const alice = participant('participant-a');
    const bob = participant('participant-b');
    const dave = participant('participant-d');
    const a = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const b = descriptor({
      id: 'iv-b',
      participant: 'participant-b',
      versionLabel: '1.0.0',
      lineage: [link('iv-a-1', 'FORKED_FROM')],
    });
    const c = descriptor({
      id: 'iv-c',
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const d = descriptor({
      id: 'iv-d',
      participant: 'participant-d',
      versionLabel: '2.0.0',
      lineage: [link('iv-b', 'MERGED_FROM'), link('iv-c', 'MERGED_FROM')],
    });
    const graph = buildLineageGraph(registry([alice, bob, dave], [a, b, c, d]));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-d'), identityVersionId('iv-a-1'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  test('handles identity ids containing NUL and separators', () => {
    const alice = participant('participant-a');
    const parentA = 'iv\u0000a';
    const parentB = 'iv\u0001a';
    const origin = descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' });
    const p1 = descriptor({
      id: parentA,
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-origin', 'CONTINUATION')],
    });
    const p2 = descriptor({
      id: parentB,
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-origin', 'CONTINUATION')],
    });
    const candidate = descriptor({
      id: 'iv-cand',
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link(parentA, 'MERGED_FROM'), link(parentB, 'MERGED_FROM')],
    });
    const graph = buildLineageGraph(registry([alice], [origin, p1, p2, candidate]));

    const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-cand'), identityVersionId('iv-origin'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  test('returns deep-frozen paths', () => {
    const { graph } = ((): { graph: ReturnType<typeof buildLineageGraph> } => {
      const alice = participant('participant-a');
      const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
      const candidate = descriptor({
        id: 'iv-a-2',
        participant: 'participant-a',
        versionLabel: '1.1.0',
        lineage: [link('iv-a-1', 'CONTINUATION')],
      });
      return { graph: buildLineageGraph(registry([alice], [origin, candidate])) };
    })();
    const result = discoverPaths(graph, 'CONTINUATION_ONLY', identityVersionId('iv-a-2'), identityVersionId('iv-a-1'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value[0])).toBe(true);
    expect(Object.isFrozen(result.value[0].edges)).toBe(true);
    expect(Object.isFrozen(result.value[0].edges[0])).toBe(true);
  });

  test('is deterministic across repeated discovery', () => {
    const alice = participant('participant-a');
    const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const candidate = descriptor({
      id: 'iv-a-2',
      participant: 'participant-a',
      versionLabel: '1.1.0',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const graph = buildLineageGraph(registry([alice], [origin, candidate]));
    const first = discoverPaths(graph, 'CONTINUATION_ONLY', identityVersionId('iv-a-2'), identityVersionId('iv-a-1'));
    const second = discoverPaths(graph, 'CONTINUATION_ONLY', identityVersionId('iv-a-2'), identityVersionId('iv-a-1'));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
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
  const graph = chainState().graph;
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
    const result = validatePath(path, graph, [chainAssessment], requirementFor(['CONT_OK']), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: 'VALID' });
  });

  test('fails independently on an unsatisfied assurance requirement', () => {
    const result = validatePath(
      path,
      graph,
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
    const result = validatePath(path, graph, [], requirementFor([]), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('INVALID');
  });

  test('uses the Task 8 policy hook, so narrowing to an empty set fails the path', () => {
    const result = validatePath(
      path,
      graph,
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

    const result = validatePath(scoped, graph, [], requirementFor([]), EMPTY_POLICY, CTX);

    expect(expectMechanismFailure(result).code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('detects a cycle in a standalone path through the cycle index', () => {
    const { graph, path: cyclePath, assessment } = cyclePairState();

    const result = validatePath(cyclePath, graph, [assessment], requirementFor(['OK']), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('CYCLE_DETECTED');
    if (result.value.status !== 'CYCLE_DETECTED') return;
    expect(result.value.code).toBe('CYCLE_DETECTED');
    expect(result.value.cycle.map(String)).toEqual(['iv-v1', 'iv-v2']);
  });

  test('rejects a non-contiguous path', () => {
    const broken: Path = {
      scope: 'FULL_ANCESTRY',
      edges: [
        { child: identityVersionId('iv-d'), parent: identityVersionId('iv-b'), relation: 'MERGED_FROM' },
        { child: identityVersionId('iv-c'), parent: identityVersionId('iv-a-1'), relation: 'CONTINUATION' },
      ],
    };

    expect(validatePath(broken, graph, [], requirementFor([]), EMPTY_POLICY, CTX).ok).toBe(false);
  });
});

describe('validateMergeClosure (phase 3)', () => {
  test('reports the closure-only branch that fails assurance', () => {
    const { graph, assessments } = mergeClosureState();

    const result = validateMergeClosure(
      MERGE_SURVIVING_PATH,
      graph,
      assessments,
      requirementFor(['OK']),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('UNSATISFIED');
    if (result.value.status !== 'UNSATISFIED') return;
    expect(result.value.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    expect(result.value.failures).toHaveLength(1);
    expect(result.value.failures[0].branch).toEqual({
      child: identityVersionId('iv-d'),
      parent: identityVersionId('iv-b'),
      relation: 'MERGED_FROM',
    });
    expect(result.value.failures[0].reason).toBe('NO_APPLICABLE_ASSESSMENT');
  });

  test('is satisfied for a path without merge nodes', () => {
    const { graph, assessments } = chainState();
    const plainPath: Path = {
      scope: 'CONTINUATION_ONLY',
      edges: [{ child: identityVersionId('iv-a-2'), parent: identityVersionId('iv-a-1'), relation: 'CONTINUATION' }],
    };

    const result = validateMergeClosure(plainPath, graph, assessments, requirementFor(['CONT_OK']), EMPTY_POLICY, CTX);

    expect(result).toEqual({ ok: true, value: { status: 'SATISFIED' } });
  });

  test('keeps path-level VALID distinct from closure failure', () => {
    const { graph, assessments } = mergeClosureState();
    const pathResult = validatePath(
      MERGE_SURVIVING_PATH,
      graph,
      assessments,
      requirementFor(['OK']),
      EMPTY_POLICY,
      CTX,
    );
    const closure = validateMergeClosure(
      MERGE_SURVIVING_PATH,
      graph,
      assessments,
      requirementFor(['OK']),
      EMPTY_POLICY,
      CTX,
    );

    expect(pathResult.ok).toBe(true);
    if (!pathResult.ok) return;
    expect(pathResult.value).toEqual({ status: 'VALID' });
    expect(closure.ok).toBe(true);
    if (!closure.ok) return;
    expect(closure.value.status).toBe('UNSATISFIED');
  });

  test('propagates mechanism failures instead of turning them into branch failures', () => {
    const { graph, assessments } = mergeClosureState();
    const duplicated = [...assessments, { ...assessments[0] }];

    const result = validateMergeClosure(
      MERGE_SURVIVING_PATH,
      graph,
      duplicated,
      requirementFor(['OK']),
      EMPTY_POLICY,
      CTX,
    );

    expect(expectMechanismFailure(result).code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('does not descend into a closure-only branch', () => {
    const { graph, assessments } = mergeClosureState({ nonOriginBranch: true, missingBranch: 'c' });
    const path: Path = {
      scope: 'FULL_ANCESTRY',
      edges: [
        { child: identityVersionId('iv-d'), parent: identityVersionId('iv-b'), relation: 'MERGED_FROM' },
        { child: identityVersionId('iv-b'), parent: identityVersionId('iv-a-1'), relation: 'FORKED_FROM' },
      ],
    };

    const result = validateMergeClosure(path, graph, assessments, requirementFor(['OK']), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('UNSATISFIED');
    if (result.value.status !== 'UNSATISFIED') return;
    expect(result.value.failures.map((item) => String(item.branch.parent))).toEqual(['iv-c']);
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

  test('aggregates mixed CONTESTED and INVALID paths as CONTESTED with all outcomes', () => {
    const { graph, descriptors } = diamondState();

    const result = evaluateBinding(
      { graph, descriptors, assessments: diamondAssessments({ dbContested: true, caClaims: ['OTHER'] }) },
      diamondBinding(),
      identityVersionId('iv-d'),
      { conflictPredicate: () => true },
      CTX,
    );

    const failure = expectContestedFailure(result);
    expect(failure.details.perPath.map((item) => item.outcome.status).sort()).toEqual(['CONTESTED', 'INVALID']);
  });

  test('preserves failed path outcomes when another path is valid', () => {
    const { graph, descriptors } = diamondState();

    const result = evaluateBinding(
      { graph, descriptors, assessments: diamondAssessments({ caClaims: ['OTHER'] }) },
      diamondBinding(),
      identityVersionId('iv-d'),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.acceptedPaths.map(pathNodes)).toEqual([['iv-d', 'iv-b', 'iv-a-1']]);
    expect(result.details.perPath.map((item) => item.outcome.status).sort()).toEqual(['INVALID', 'VALID']);
  });

  test('does not mask a closure failure with a valid path-level outcome', () => {
    const { graph, descriptors } = diamondState();

    const result = evaluateBinding(
      { graph, descriptors, assessments: diamondAssessments({ dcContested: true }) },
      diamondBinding(),
      identityVersionId('iv-d'),
      { conflictPredicate: () => true },
      CTX,
    );

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    const perPath = failure.details.perPath ?? [];
    expect(perPath.map((item) => item.outcome.status).sort()).toEqual(['CONTESTED', 'VALID']);
    const validPath = perPath.find((item) => item.outcome.status === 'VALID');
    expect(validPath?.closure?.status).toBe('UNSATISFIED');
  });

  test('aggregates mixed CYCLE_DETECTED and CONTESTED paths as CYCLE_DETECTED', () => {
    const a = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const b = descriptor({
      id: 'iv-b',
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-b2', 'FORKED_FROM'), link('iv-a-1', 'CONTINUATION')],
    });
    const b2 = descriptor({
      id: 'iv-b2',
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-b', 'CONTINUATION')],
    });
    const c = descriptor({
      id: 'iv-c',
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const { d } = mergeSkeleton();
    const graph = buildLineageGraph(registry([alice, participant('participant-d')], [a, b, b2, c, d]));
    const assessments = [
      assessmentRecord({ id: 'db', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({ id: 'ba', subject: 'iv-b', parents: ['iv-a-1'], relation: 'CONTINUATION', verified: ['OK'] }),
      assessmentRecord({ id: 'dc1', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({ id: 'dc2', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({ id: 'ca', subject: 'iv-c', parents: ['iv-a-1'], relation: 'CONTINUATION', verified: ['OK'] }),
    ];
    const binding = fullAncestryBinding();

    const result = evaluateAt({ graph, descriptors: [a, b, b2, c, d], assessments }, binding, 'iv-d', {
      conflictPredicate: () => true,
    });

    const failure = expectNormativeFailure(result);
    expect(failure.code).toBe('CYCLE_DETECTED');
    expect(failure.details.perPath?.map((item) => item.outcome.status).sort()).toEqual(['CONTESTED', 'CYCLE_DETECTED']);
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

    const failure = expectContestedFailure(result);
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

describe('path membership against the supplied graph', () => {
  const { graph } = chainState();

  test('rejects a path edge that is not present in the graph', () => {
    const forged: Path = {
      scope: 'CONTINUATION_ONLY',
      edges: [{ child: identityVersionId('iv-a-2'), parent: identityVersionId('iv-ghost'), relation: 'CONTINUATION' }],
    };

    const failure = expectMechanismFailure(validatePath(forged, graph, [], requirementFor([]), EMPTY_POLICY, CTX));
    expect(failure.message).toContain('not present in the supplied graph');
  });

  test('rejects an edge that exists only in a different graph', () => {
    const other = diamondState().graph;
    const path: Path = {
      scope: 'FULL_ANCESTRY',
      edges: [{ child: identityVersionId('iv-d'), parent: identityVersionId('iv-b'), relation: 'MERGED_FROM' }],
    };

    expect(validatePath(path, other, [], requirementFor([]), EMPTY_POLICY, CTX).ok).toBe(true);
    expect(validatePath(path, graph, [], requirementFor([]), EMPTY_POLICY, CTX).ok).toBe(false);
  });

  test('phase 3 rejects a path edge that is not present in the graph', () => {
    const forged: Path = {
      scope: 'FULL_ANCESTRY',
      edges: [{ child: identityVersionId('iv-a-2'), parent: identityVersionId('iv-ghost'), relation: 'CONTINUATION' }],
    };

    const failure = expectMechanismFailure(
      validateMergeClosure(forged, graph, [], requirementFor([]), EMPTY_POLICY, CTX),
    );
    expect(failure.message).toContain('not present in the supplied graph');
  });

  test('discovered paths belong to their graph by construction', () => {
    const { graph: diamond, assessments } = diamondState();
    const discovered = discoverPaths(diamond, 'FULL_ANCESTRY', identityVersionId('iv-d'), identityVersionId('iv-a-1'));

    expect(discovered.ok).toBe(true);
    if (!discovered.ok) return;
    expect(discovered.value.length).toBeGreaterThan(0);
    for (const path of discovered.value) {
      expect(validatePath(path, diamond, assessments, requirementFor(['CONT_OK']), EMPTY_POLICY, CTX).ok).toBe(true);
    }
  });
});

describe('descriptor identity in orchestration', () => {
  test('evaluateBinding rejects duplicate descriptor ids instead of taking the first', () => {
    const { graph, descriptors, assessments } = chainState();

    const result = evaluateBinding(
      { graph, descriptors: [...descriptors, { ...descriptors[0] }], assessments },
      bindingFor({ origin: 'iv-a-1', selector: '>=1.0.0', scope: 'CONTINUATION_ONLY', claims: ['CONT_OK'] }),
      identityVersionId('iv-a-2'),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.eligible).toBe(false);
    if (result.eligible) return;
    if (!('kind' in result) || result.kind !== 'MECHANISM') {
      throw new Error('expected a mechanism failure');
    }
    expect(result.error.message).toContain('Duplicate descriptor id');
  });
});

describe('cycle breadth (A-14)', () => {
  test('an acyclic path through a node in a cyclic SCC is rejected conservatively', () => {
    // A <-> B is a CONTINUATION cycle; C CONTINUATION A; A FORKED_FROM D.
    // The path C->A->D is acyclic, but A belongs to the cyclic SCC.
    const a = descriptor({
      id: 'iv-cyc-a',
      participant: 'participant-a',
      lineage: [link('iv-cyc-b', 'CONTINUATION'), link('iv-cyc-d', 'FORKED_FROM')],
    });
    const b = descriptor({
      id: 'iv-cyc-b',
      participant: 'participant-a',
      lineage: [link('iv-cyc-a', 'CONTINUATION')],
    });
    const c = descriptor({
      id: 'iv-cyc-c',
      participant: 'participant-a',
      lineage: [link('iv-cyc-a', 'CONTINUATION')],
    });
    const d = descriptor({ id: 'iv-cyc-d', participant: 'participant-a' });
    const graph = buildLineageGraph(registry([alice], [a, b, c, d]));

    const discovered = discoverPaths(
      graph,
      'FULL_ANCESTRY',
      identityVersionId('iv-cyc-c'),
      identityVersionId('iv-cyc-d'),
    );
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) return;
    expect(discovered.value).toHaveLength(1);

    // Phase 1 offers the path; Phase 2 rejects it because one of its nodes is in
    // a cycle. This is the conservative reading of §11.2 recorded as A-14 (OPEN).
    const result = validatePath(discovered.value[0], graph, [], requirementFor([]), EMPTY_POLICY, CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('CYCLE_DETECTED');
    if (result.value.status !== 'CYCLE_DETECTED') return;
    expect(result.value.cycle.map(String)).toEqual(['iv-cyc-a', 'iv-cyc-b']);
  });
});
