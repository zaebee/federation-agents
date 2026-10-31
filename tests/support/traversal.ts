import { expect } from 'bun:test';
import type { ContinuityAssessment, ContinuityAssuranceRequirement, Policy } from '../../src/core/assessment.js';
import type { Result } from '../../src/core/errors.js';
import type { LineageRelationType } from '../../src/core/entities.js';
import { evaluateBinding } from '../../src/core/index.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import type { TemporalContext } from '../../src/core/temporal.js';
import type {
  BindingResult,
  ConditionalVersionBinding,
  LineageTraversalScope,
  MergeClosureBranchFailure,
  Path,
} from '../../src/core/traversal.js';
import { assessmentId, domainId, identityVersionId, participantId, timestamp } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from './fixtures.js';

export const BASE_TIME = 1_700_000_000_000;

export const CTX: TemporalContext = {
  basis: 'ASSESSED_AT',
  declared: {},
  trust: {},
};

export const EMPTY_POLICY: Policy = {};

export function assessmentRecord(input: {
  readonly id: string;
  readonly subject: string;
  readonly parents: readonly string[];
  readonly relation: LineageRelationType;
  readonly verified?: readonly string[];
  readonly unverified?: readonly string[];
  readonly by?: string;
}): ContinuityAssessment {
  return {
    assessment_id: assessmentId(input.id),
    subject_version_id: identityVersionId(input.subject),
    parent_version_ids: input.parents.map((parent) => identityVersionId(parent)),
    declared_relation: input.relation,
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    verified_claims: input.verified ?? [],
    unverified_claims: input.unverified ?? [],
    evidence_refs: [],
    assessed_by: domainId(input.by ?? 'domain-a'),
    assessed_at: timestamp(BASE_TIME),
  };
}

export function requirementFor(
  claims: readonly string[],
  trusted: readonly string[] = ['domain-a'],
): ContinuityAssuranceRequirement {
  return {
    required_claims: claims,
    trusted_assessors: trusted.map((domain) => domainId(domain)),
  };
}

export function bindingFor(input: {
  readonly origin: string;
  readonly selector: string;
  readonly scope: LineageTraversalScope;
  readonly claims: readonly string[];
  readonly targetParticipant?: string;
  readonly trusted?: readonly string[];
}): ConditionalVersionBinding {
  return {
    target_participant_id: participantId(input.targetParticipant ?? 'participant-a'),
    origin_version_id: identityVersionId(input.origin),
    selector_expression: input.selector,
    traversal_scope: input.scope,
    assurance_requirement: requirementFor(input.claims, input.trusted),
  };
}

export function pathNodes(path: Path): string[] {
  const nodes: string[] = [String(path.edges[0].child)];
  for (const edge of path.edges) {
    nodes.push(String(edge.parent));
  }
  return nodes;
}

export const chainAssessment = assessmentRecord({
  id: 'a-chain',
  subject: 'iv-a-2',
  parents: ['iv-a-1'],
  relation: 'CONTINUATION',
  verified: ['CONT_OK'],
});

export function chainState(): {
  origin: ReturnType<typeof descriptor>;
  candidate: ReturnType<typeof descriptor>;
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
} {
  const alice = participant('participant-a');
  const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
  const candidate = descriptor({
    id: 'iv-a-2',
    participant: 'participant-a',
    versionLabel: '1.1.0',
    lineage: [link('iv-a-1', 'CONTINUATION')],
  });
  return {
    origin,
    candidate,
    graph: buildLineageGraph(registry([alice], [origin, candidate])),
    descriptors: [origin, candidate],
    assessments: [chainAssessment],
  };
}

export function diamondState(): {
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
} {
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
  return {
    graph: buildLineageGraph(registry([alice, bob, dave], [a, b, c, d])),
    descriptors: [a, b, c, d],
    assessments: [
      assessmentRecord({
        id: 'a-db',
        subject: 'iv-d',
        parents: ['iv-b'],
        relation: 'MERGED_FROM',
        verified: ['CONT_OK'],
      }),
      assessmentRecord({
        id: 'a-dc',
        subject: 'iv-d',
        parents: ['iv-c'],
        relation: 'MERGED_FROM',
        verified: ['CONT_OK'],
      }),
      assessmentRecord({
        id: 'a-ba',
        subject: 'iv-b',
        parents: ['iv-a-1'],
        relation: 'FORKED_FROM',
        verified: ['CONT_OK'],
      }),
      assessmentRecord({
        id: 'a-ca',
        subject: 'iv-c',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['CONT_OK'],
      }),
    ],
  };
}

export function cyclePairState(): {
  v1: ReturnType<typeof descriptor>;
  v2: ReturnType<typeof descriptor>;
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessment: ContinuityAssessment;
  binding: ConditionalVersionBinding;
  path: Path;
} {
  const alice = participant('participant-a');
  const v1 = descriptor({
    id: 'iv-v1',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link('iv-v2', 'CONTINUATION')],
  });
  const v2 = descriptor({
    id: 'iv-v2',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link('iv-v1', 'CONTINUATION')],
  });
  return {
    v1,
    v2,
    graph: buildLineageGraph(registry([alice], [v1, v2])),
    descriptors: [v1, v2],
    assessment: assessmentRecord({
      id: 'a-cycle',
      subject: 'iv-v1',
      parents: ['iv-v2'],
      relation: 'CONTINUATION',
      verified: ['OK'],
    }),
    binding: bindingFor({
      origin: 'iv-v2',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['OK'],
    }),
    path: {
      scope: 'CONTINUATION_ONLY',
      edges: [
        {
          child: identityVersionId('iv-v1'),
          parent: identityVersionId('iv-v2'),
          relation: 'CONTINUATION',
        },
      ],
    },
  };
}

export function mergeSkeleton(extraD: readonly ReturnType<typeof link>[] = []): {
  alice: ReturnType<typeof participant>;
  bob: ReturnType<typeof participant>;
  dave: ReturnType<typeof participant>;
  a: ReturnType<typeof descriptor>;
  b: ReturnType<typeof descriptor>;
  d: ReturnType<typeof descriptor>;
} {
  return {
    alice: participant('participant-a'),
    bob: participant('participant-b'),
    dave: participant('participant-d'),
    a: descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' }),
    b: descriptor({
      id: 'iv-b',
      participant: 'participant-b',
      versionLabel: '1.0.0',
      lineage: [link('iv-a-1', 'FORKED_FROM')],
    }),
    d: descriptor({
      id: 'iv-d',
      participant: 'participant-d',
      versionLabel: '2.0.0',
      lineage: [link('iv-b', 'MERGED_FROM'), link('iv-c', 'MERGED_FROM'), ...extraD],
    }),
  };
}

export function mergeAssessment(id: string, parent: string): ContinuityAssessment {
  return assessmentRecord({
    id,
    subject: 'iv-d',
    parents: [parent],
    relation: 'MERGED_FROM',
    verified: ['OK'],
  });
}

export function forkAssessment(): ContinuityAssessment {
  return assessmentRecord({
    id: 'ba',
    subject: 'iv-b',
    parents: ['iv-a-1'],
    relation: 'FORKED_FROM',
    verified: ['OK'],
  });
}

export function mergeClosureState(
  options: { readonly nonOriginBranch?: boolean; readonly missingBranch?: 'b' | 'c' } = {},
): {
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
  binding: ConditionalVersionBinding;
} {
  const { alice, bob, dave, a, b, d } = mergeSkeleton();
  const x = options.nonOriginBranch
    ? descriptor({ id: 'iv-x', participant: 'participant-a', versionLabel: '1.0.0' })
    : undefined;
  const c = descriptor({
    id: 'iv-c',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link(options.nonOriginBranch ? 'iv-x' : 'iv-a-1', 'CONTINUATION')],
  });

  const missingBranch = options.missingBranch ?? 'b';
  const versions = x === undefined ? [a, b, c, d] : [a, b, c, d, x];
  return {
    graph: buildLineageGraph(registry([alice, bob, dave], versions)),
    descriptors: versions,
    assessments: [
      ...(missingBranch === 'c' ? [] : [mergeAssessment('dc', 'iv-c')]),
      assessmentRecord({
        id: 'ca',
        subject: 'iv-c',
        parents: [options.nonOriginBranch ? 'iv-x' : 'iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
      ...(missingBranch === 'b' ? [] : [mergeAssessment('db', 'iv-b')]),
      forkAssessment(),
    ],
    binding: fullAncestryBinding(),
  };
}

export const MERGE_SURVIVING_PATH: Path = {
  scope: 'FULL_ANCESTRY',
  edges: [
    { child: identityVersionId('iv-d'), parent: identityVersionId('iv-c'), relation: 'MERGED_FROM' },
    { child: identityVersionId('iv-c'), parent: identityVersionId('iv-a-1'), relation: 'CONTINUATION' },
  ],
};

export function expectNormativeFailure(result: BindingResult) {
  expect(result.eligible).toBe(false);
  if (result.eligible) {
    throw new Error('expected a failed binding');
  }
  if (!('code' in result)) {
    throw new Error('expected a normative failure');
  }
  return result;
}

export function expectContestedFailure(result: BindingResult) {
  expect(result.eligible).toBe(false);
  if (result.eligible) {
    throw new Error('expected a failed binding');
  }
  if (!('kind' in result) || result.kind !== 'CONTESTED') {
    throw new Error('expected a contested failure');
  }
  return result;
}

export function expectMechanismFailure<T>(result: Result<T>) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('expected a failed result');
  }
  expect(result.error.kind).toBe('MECHANISM');
  return result.error;
}

export function b5State(): {
  state: {
    graph: LineageGraph;
    descriptors: ReturnType<typeof descriptor>[];
    assessments: ContinuityAssessment[];
  };
  binding: ConditionalVersionBinding;
} {
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
  return {
    state: { graph, descriptors, assessments: [trusted, untrusted] },
    binding: bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['SPEC_MISMATCH'],
      trusted: ['domain-auditor'],
    }),
  };
}

export function expectB5Refusal(result: BindingResult) {
  const failure = expectNormativeFailure(result);
  expect(failure.code).toBe('ERR_ASSURANCE_PREDICATE_UNSATISFIED');
  const outcome = failure.details.perPath?.[0].outcome;
  if (outcome?.status !== 'INVALID') {
    throw new Error('expected an INVALID assurance outcome');
  }
  expect(outcome.missing).toEqual(['SPEC_MISMATCH']);
  expect('negative' in outcome).toBe(false);
  expect('refuted' in outcome).toBe(false);
  return outcome;
}

export function nestedMergeState(): {
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
  binding: ConditionalVersionBinding;
} {
  const { alice, bob, dave, a, b, d } = mergeSkeleton();
  const e = descriptor({ id: 'iv-e', participant: 'participant-a', versionLabel: '1.0.0' });
  const f = descriptor({ id: 'iv-f', participant: 'participant-a', versionLabel: '1.0.0' });
  const c = descriptor({
    id: 'iv-c',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link('iv-e', 'MERGED_FROM'), link('iv-f', 'MERGED_FROM')],
  });

  return {
    graph: buildLineageGraph(registry([alice, bob, dave], [a, b, c, d, e, f])),
    descriptors: [a, b, c, d, e, f],
    assessments: [mergeAssessment('db', 'iv-b'), mergeAssessment('dc', 'iv-c'), forkAssessment()],
    binding: fullAncestryBinding(),
  };
}

export function expectClosureFailure(
  result: BindingResult,
  expectedParents: readonly string[],
): readonly MergeClosureBranchFailure[] {
  const failure = expectNormativeFailure(result);
  expect(failure.code).toBe('ERR_MERGE_BRANCH_UNSATISFIED');
  const survived = failure.details.perPath?.[0];
  expect(survived?.outcome.status).toBe('VALID');
  expect(survived?.closure?.status).toBe('UNSATISFIED');
  if (survived?.closure?.status !== 'UNSATISFIED') {
    throw new Error('expected an UNSATISFIED closure');
  }
  const parents = survived.closure.failures.map((item) => String(item.branch.parent)).sort();
  expect(parents).toEqual([...expectedParents].sort());
  return survived.closure.failures;
}

export function fullAncestryBinding(targetParticipant = 'participant-d'): ConditionalVersionBinding {
  return bindingFor({
    origin: 'iv-a-1',
    selector: '>=1.0.0',
    scope: 'FULL_ANCESTRY',
    claims: ['OK'],
    targetParticipant,
  });
}

export function evaluateAt(
  state: {
    graph: LineageGraph;
    descriptors: ReturnType<typeof descriptor>[];
    assessments: readonly ContinuityAssessment[];
  },
  binding: ConditionalVersionBinding,
  candidate = 'iv-d',
  policy: Policy = EMPTY_POLICY,
): BindingResult {
  return evaluateBinding(state, binding, identityVersionId(candidate), policy, CTX);
}
