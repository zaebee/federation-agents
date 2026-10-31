import { describe, expect, test } from 'bun:test';
import * as fc from 'fast-check';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { discoverPaths, evaluateBinding } from '../../src/core/traversal.js';
import type { BindingResult } from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import {
  CTX,
  EMPTY_POLICY,
  assessmentRecord,
  bindingFor,
  chainState,
  mergeClosureState,
} from '../support/traversal.js';
import type { GeneratedCase } from './support/dag-fixtures.js';
import {
  buildCase,
  dagSpecArbitrary,
  diamondCaseArbitrary,
  mixedMergeCaseArbitrary,
  shapeStats,
} from './support/dag-fixtures.js';
import { runOracle } from './support/merge-oracle.js';
import { normalizeProduction } from './support/normalize.js';

const SEED_GENERAL = 12_001;
const SEED_MIXED = 12_002;
const SEED_DIAMOND = 12_003;
const SEED_STATS = 12_004;

function stateOf(generated: GeneratedCase) {
  return { graph: generated.graph, descriptors: generated.descriptors, assessments: generated.assessments };
}

function assertMatchesOracle(generated: GeneratedCase): void {
  const production = normalizeProduction(
    evaluateBinding(stateOf(generated), generated.binding, generated.candidate, generated.policy, generated.ctx),
  );
  const oracle = runOracle({
    graph: generated.graph,
    binding: generated.binding,
    candidate: generated.candidate,
    assessments: generated.assessments,
    policy: generated.policy,
    ctx: generated.ctx,
  });

  expect(oracle.ok).toBe(true);
  if (!oracle.ok) {
    throw new Error(oracle.error);
  }
  expect(production).toEqual(oracle.result);
}

function expectNotEligible(result: BindingResult): void {
  expect(result.eligible).toBe(false);
}

describe('P7: DAG equivalence against the independent immediate-closure oracle', () => {
  test('general bounded DAGs match the brute-force reference', () => {
    fc.assert(
      fc.property(dagSpecArbitrary, (spec) => {
        assertMatchesOracle(buildCase(spec));
      }),
      { numRuns: 80, seed: SEED_GENERAL },
    );
  }, 15_000);

  test('mixed-relation and nested closure fixtures match the oracle', () => {
    fc.assert(
      fc.property(mixedMergeCaseArbitrary, (generated) => {
        assertMatchesOracle(generated);
      }),
      { numRuns: 60, seed: SEED_MIXED },
    );
  }, 15_000);

  test('diamond multi-path fixtures match the oracle', () => {
    fc.assert(
      fc.property(diamondCaseArbitrary, (generated) => {
        assertMatchesOracle(generated);
      }),
      { numRuns: 40, seed: SEED_DIAMOND },
    );
  }, 15_000);
});

describe('P4: a missing applicable assessment never yields eligibility by itself', () => {
  test('a path edge without an assessment is retained as INVALID', () => {
    const state = chainState();
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['CONT_OK'],
      targetParticipant: 'participant-a',
    });

    const result = evaluateBinding(
      { graph: state.graph, descriptors: state.descriptors, assessments: [] },
      binding,
      identityVersionId('iv-a-2'),
      EMPTY_POLICY,
      CTX,
    );

    expectNotEligible(result);
    if (result.eligible || !('code' in result)) return;
    expect(result.code).toBe('ERR_ASSURANCE_PREDICATE_UNSATISFIED');
    expect(result.details.perPath?.[0]?.outcome.status).toBe('INVALID');
  });

  test('a missing closure branch is retained as a closure failure, not discovery failure', () => {
    const state = mergeClosureState();
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-d',
    });

    const result = evaluateBinding(state, binding, identityVersionId('iv-d'), EMPTY_POLICY, CTX);

    expectNotEligible(result);
    if (result.eligible || !('code' in result)) return;
    expect(result.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
    const survived = result.details.perPath?.find((item) => item.outcome.status === 'VALID');
    expect(survived?.closure?.status).toBe('UNSATISFIED');
  });

  test('a missing assessment on one alternative path does not hide that path', () => {
    const alice = participant('participant-a');
    const bob = participant('participant-b');
    const x = descriptor({
      id: 'iv-x',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'CONTINUATION')],
    });
    const a = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
    const b = descriptor({
      id: 'iv-b',
      participant: 'participant-a',
      lineage: [link('iv-a-1', 'CONTINUATION'), link('iv-x', 'FORKED_FROM')],
    });
    const graph = buildLineageGraph(registry([alice, bob], [a, x, b]));
    const state = {
      graph,
      descriptors: [a, x, b],
      assessments: [
        assessmentRecord({
          id: 'b-a',
          subject: 'iv-b',
          parents: ['iv-a-1'],
          relation: 'CONTINUATION',
          verified: ['OK'],
        }),
        assessmentRecord({
          id: 'x-a',
          subject: 'iv-x',
          parents: ['iv-a-1'],
          relation: 'CONTINUATION',
          verified: ['OK'],
        }),
      ],
    };
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-a',
    });

    const result = evaluateBinding(state, binding, identityVersionId('iv-b'), EMPTY_POLICY, CTX);

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.acceptedPaths).toHaveLength(1);
    expect(result.details.perPath.some((item) => item.outcome.status === 'INVALID')).toBe(true);
  });
});

describe('generator distribution', () => {
  test('covers merges, mixed relations, nested closure branches, multiple paths and assessment states', () => {
    const general = fc.sample(dagSpecArbitrary, { numRuns: 200, seed: SEED_STATS }).map((spec) => buildCase(spec));
    const mixed = fc.sample(mixedMergeCaseArbitrary, { numRuns: 50, seed: SEED_STATS + 1 });
    const diamonds = fc.sample(diamondCaseArbitrary, { numRuns: 50, seed: SEED_STATS + 2 });
    const all = [...general, ...mixed, ...diamonds];

    let mergeNodes = 0;
    let mixedRelationNodes = 0;
    let closureOnlyBranches = 0;
    let multiplePathCases = 0;
    let missingAssessmentCases = 0;
    let satisfiedAssessmentCases = 0;
    let eligibleCases = 0;
    let closureFailureCases = 0;
    const nodeCounts: Record<number, number> = {};

    for (const generated of all) {
      const stats = shapeStats(generated.graph);
      mergeNodes += stats.mergeNodes;
      mixedRelationNodes += stats.mixedRelationNodes;
      closureOnlyBranches += stats.closureOnlyBranches;
      nodeCounts[generated.spec.nodeCount] = (nodeCounts[generated.spec.nodeCount] ?? 0) + 1;
      if (generated.spec.modes.includes('none')) missingAssessmentCases += 1;
      if (generated.spec.modes.includes('ok')) satisfiedAssessmentCases += 1;

      const discovered = discoverPaths(
        generated.graph,
        generated.binding.traversal_scope,
        generated.candidate,
        generated.origin,
      );
      if (discovered.ok && discovered.value.length > 1) {
        multiplePathCases += 1;
      }

      const result = evaluateBinding(
        stateOf(generated),
        generated.binding,
        generated.candidate,
        generated.policy,
        generated.ctx,
      );
      if (result.eligible) {
        eligibleCases += 1;
      }
      if (!result.eligible && 'code' in result && result.code === 'ERR_MERGE_BRANCH_UNSATISFIED') {
        closureFailureCases += 1;
      }
    }

    const summary = {
      cases: all.length,
      nodeCounts,
      mergeNodes,
      mixedRelationNodes,
      closureOnlyBranches,
      multiplePathCases,
      missingAssessmentCases,
      satisfiedAssessmentCases,
      eligibleCases,
      closureFailureCases,
    };
    console.log(`[task-12 generator distribution] ${JSON.stringify(summary)}`);

    expect(mergeNodes).toBeGreaterThan(0);
    expect(mixedRelationNodes).toBeGreaterThan(0);
    expect(closureOnlyBranches).toBeGreaterThan(0);
    expect(multiplePathCases).toBeGreaterThan(0);
    expect(missingAssessmentCases).toBeGreaterThan(0);
    expect(satisfiedAssessmentCases).toBeGreaterThan(0);
    expect(eligibleCases).toBeGreaterThan(0);
    expect(closureFailureCases).toBeGreaterThan(0);
  });
});
