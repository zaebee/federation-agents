import { expect } from 'bun:test';
import type { ContinuityAssessment, ContinuityAssuranceRequirement, Policy } from '../../src/core/assessment.js';
import type { Result } from '../../src/core/errors.js';
import type { LineageRelationType } from '../../src/core/entities.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import type { LineageGraph } from '../../src/core/lineage.js';
import type { BindingResult } from '../../src/core/traversal.js';
import type { TemporalContext } from '../../src/core/temporal.js';
import type { ConditionalVersionBinding, LineageTraversalScope, Path } from '../../src/core/traversal.js';
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

export function mergeClosureState(): {
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
  binding: ConditionalVersionBinding;
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
      assessmentRecord({ id: 'dc', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({
        id: 'ca',
        subject: 'iv-c',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
      assessmentRecord({
        id: 'ba',
        subject: 'iv-b',
        parents: ['iv-a-1'],
        relation: 'FORKED_FROM',
        verified: ['OK'],
      }),
    ],
    binding: bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-d',
    }),
  };
}

export function mergeClosureWithSideBranchState(): {
  graph: LineageGraph;
  descriptors: ReturnType<typeof descriptor>[];
  assessments: ContinuityAssessment[];
  binding: ConditionalVersionBinding;
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
  const x = descriptor({ id: 'iv-x', participant: 'participant-a', versionLabel: '1.0.0' });
  const c = descriptor({
    id: 'iv-c',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link('iv-x', 'CONTINUATION')],
  });
  const d = descriptor({
    id: 'iv-d',
    participant: 'participant-d',
    versionLabel: '2.0.0',
    lineage: [link('iv-b', 'MERGED_FROM'), link('iv-c', 'MERGED_FROM')],
  });
  return {
    graph: buildLineageGraph(registry([alice, bob, dave], [a, b, c, d, x])),
    descriptors: [a, b, c, d, x],
    assessments: [
      assessmentRecord({ id: 'db', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({
        id: 'ba',
        subject: 'iv-b',
        parents: ['iv-a-1'],
        relation: 'FORKED_FROM',
        verified: ['OK'],
      }),
    ],
    binding: bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-d',
    }),
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
