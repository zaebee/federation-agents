import * as fc from 'fast-check';
import type { ContinuityAssessment, Policy } from '../../../src/core/assessment.js';
import type { LineageGraph, Registry } from '../../../src/core/lineage.js';
import { buildLineageGraph, validateDescriptor } from '../../../src/core/lineage.js';
import { identityVersionId } from '../../../src/core/primitives.js';
import type { IdentityVersionID } from '../../../src/core/primitives.js';
import type { TemporalContext } from '../../../src/core/temporal.js';
import type { ConditionalVersionBinding, LineageTraversalScope } from '../../../src/core/traversal.js';
import { descriptor, link, participant, registry } from '../../support/fixtures.js';
import { CTX, EMPTY_POLICY, assessmentRecord, bindingFor } from '../../support/traversal.js';

export type AssessmentMode = 'none' | 'ok' | 'unverified' | 'wrong' | 'untrusted' | 'conflict';

export interface NodeChoice {
  readonly cont: number | null;
  readonly fork: number | null;
  readonly merges: readonly number[];
}

export interface DagSpec {
  readonly nodeCount: number;
  readonly originIndex: number;
  readonly candidateIndex: number;
  readonly scope: LineageTraversalScope;
  readonly participants: readonly number[];
  readonly choices: readonly NodeChoice[];
  readonly modes: readonly AssessmentMode[];
  readonly conflictPolicy: boolean;
}

export interface GeneratedCase {
  readonly spec: DagSpec;
  readonly graph: LineageGraph;
  readonly descriptors: ReturnType<typeof descriptor>[];
  readonly assessments: ContinuityAssessment[];
  readonly binding: ConditionalVersionBinding;
  readonly candidate: IdentityVersionID;
  readonly origin: IdentityVersionID;
  readonly policy: Policy;
  readonly ctx: TemporalContext;
}

export const SCOPES: readonly LineageTraversalScope[] = ['CONTINUATION_ONLY', 'CONTINUATION_AND_FORK', 'FULL_ANCESTRY'];

const PARTICIPANTS = ['participant-a', 'participant-b', 'participant-c', 'participant-d'] as const;

const modeArbitrary = fc.constantFrom<AssessmentMode>('none', 'ok', 'unverified', 'wrong', 'untrusted', 'conflict');

const nodeChoiceArbitrary: fc.Arbitrary<NodeChoice> = fc.record({
  cont: fc.option(fc.nat({ max: 50 }), { nil: null }),
  fork: fc.option(fc.nat({ max: 50 }), { nil: null }),
  merges: fc.array(fc.nat({ max: 50 }), { maxLength: 4 }),
});

/**
 * General bounded DAG generator. Edges always point to a lower node index, so
 * the graph is acyclic by construction. CONTINUATION parents constrain the
 * child's participant, matching §5.2. MERGED_FROM parents are distinct.
 */
export const dagSpecArbitrary: fc.Arbitrary<DagSpec> = fc.integer({ min: 2, max: 7 }).chain((nodeCount) =>
  fc.record({
    nodeCount: fc.constant(nodeCount),
    originIndex: fc.integer({ min: 0, max: nodeCount - 2 }),
    candidateIndex: fc.constant(nodeCount - 1),
    scope: fc.constantFrom(...SCOPES),
    participants: fc.array(fc.integer({ min: 0, max: PARTICIPANTS.length - 1 }), {
      minLength: nodeCount,
      maxLength: nodeCount,
    }),
    choices: fc.array(nodeChoiceArbitrary, { minLength: nodeCount, maxLength: nodeCount }),
    modes: fc.array(modeArbitrary, { minLength: 1, maxLength: 12 }),
    conflictPolicy: fc.boolean(),
  }),
);

function nodeId(index: number): string {
  return `iv-v${index}`;
}

function uniqueIndices(values: readonly number[], bound: number): number[] {
  return [...new Set(values.map((value) => value % bound))];
}

function buildLineage(
  index: number,
  choice: NodeChoice,
  participants: readonly string[],
  fallbackParticipant: string,
): { lineage: ReturnType<typeof link>[]; participant: string } {
  const contIndex = choice.cont === null ? null : choice.cont % index;
  const forkIndex = choice.fork === null ? null : choice.fork % index;
  const mergeIndices = uniqueIndices(choice.merges, index).filter(
    (parent) => parent !== contIndex && parent !== forkIndex,
  );
  const mergeParents = mergeIndices.length >= 2 ? mergeIndices.slice(0, 3) : [];

  const lineage: ReturnType<typeof link>[] = [];
  if (contIndex !== null) {
    lineage.push(link(nodeId(contIndex), 'CONTINUATION'));
  }
  if (forkIndex !== null) {
    lineage.push(link(nodeId(forkIndex), 'FORKED_FROM'));
  }
  for (const parent of mergeParents) {
    lineage.push(link(nodeId(parent), 'MERGED_FROM'));
  }

  const participantId = contIndex === null ? fallbackParticipant : (participants[contIndex] as string);
  return { lineage, participant: participantId };
}

function assessmentFor(
  edgeIndex: number,
  mode: AssessmentMode,
  edge: {
    readonly child: string;
    readonly parent: string;
    readonly relation: 'CONTINUATION' | 'FORKED_FROM' | 'MERGED_FROM';
  },
): ContinuityAssessment[] {
  if (mode === 'none') {
    return [];
  }
  if (mode === 'conflict') {
    return [
      assessmentRecord({
        id: `a-${edgeIndex}-1`,
        subject: edge.child,
        parents: [edge.parent],
        relation: edge.relation,
        verified: ['OK'],
      }),
      assessmentRecord({
        id: `a-${edgeIndex}-2`,
        subject: edge.child,
        parents: [edge.parent],
        relation: edge.relation,
        unverified: ['OK'],
      }),
    ];
  }
  if (mode === 'unverified') {
    return [
      assessmentRecord({
        id: `a-${edgeIndex}`,
        subject: edge.child,
        parents: [edge.parent],
        relation: edge.relation,
        unverified: ['OK'],
      }),
    ];
  }
  if (mode === 'wrong') {
    return [
      assessmentRecord({
        id: `a-${edgeIndex}`,
        subject: edge.child,
        parents: [edge.parent],
        relation: edge.relation,
        verified: ['OTHER'],
      }),
    ];
  }
  return [
    assessmentRecord({
      id: `a-${edgeIndex}`,
      subject: edge.child,
      parents: [edge.parent],
      relation: edge.relation,
      verified: ['OK'],
      by: mode === 'untrusted' ? 'untrusted.org' : 'domain-a',
    }),
  ];
}

/** Builds a validated graph, descriptors, assessments and binding from a spec. */
export function buildCase(spec: DagSpec): GeneratedCase {
  const participants: string[] = [];
  const descriptors: ReturnType<typeof descriptor>[] = [];
  const participantRecords = PARTICIPANTS.map((id) => participant(id));

  for (let index = 0; index < spec.nodeCount; index += 1) {
    const chosen = PARTICIPANTS[(spec.participants[index] as number) % PARTICIPANTS.length] as string;
    if (index === 0) {
      participants.push(chosen);
      descriptors.push(descriptor({ id: nodeId(index), participant: chosen, versionLabel: '1.0.0' }));
      continue;
    }

    const built = buildLineage(index, spec.choices[index] as NodeChoice, participants, chosen);
    participants.push(built.participant);
    descriptors.push(
      descriptor({
        id: nodeId(index),
        participant: built.participant,
        versionLabel: '1.0.0',
        lineage: built.lineage,
      }),
    );
  }

  const registryValue: Registry = registry(participantRecords, descriptors);
  for (const value of descriptors) {
    const validation = validateDescriptor(value, registryValue);
    if (validation.status !== 'VALID') {
      throw new Error(`generator produced an invalid descriptor: ${validation.code}`);
    }
  }

  const graph = buildGraph(registryValue);
  const assessments: ContinuityAssessment[] = [];
  graph.edges.forEach((edge, index) => {
    const mode = (spec.modes[index % spec.modes.length] as AssessmentMode) ?? 'none';
    assessments.push(
      ...assessmentFor(index, mode, {
        child: String(edge.child),
        parent: String(edge.parent),
        relation: edge.relation,
      }),
    );
  });

  const candidateIndex = spec.candidateIndex;
  const candidate = identityVersionId(nodeId(candidateIndex));
  const origin = identityVersionId(nodeId(spec.originIndex));
  const binding = bindingFor({
    origin: nodeId(spec.originIndex),
    selector: '>=1.0.0',
    scope: spec.scope,
    claims: ['OK'],
    targetParticipant: participants[candidateIndex] as string,
  });

  return {
    spec,
    graph,
    descriptors,
    assessments,
    binding,
    candidate,
    origin,
    policy: spec.conflictPolicy ? { conflictPredicate: () => true } : EMPTY_POLICY,
    ctx: CTX,
  };
}

function buildGraph(registryValue: Registry): LineageGraph {
  return buildLineageGraph(registryValue);
}

/** Fixed seven-node shape: mixed relations and a nested merge inside a closure branch. */
export function mixedMergeSpec(
  scope: LineageTraversalScope,
  modes: readonly AssessmentMode[],
  conflictPolicy: boolean,
): DagSpec {
  return {
    nodeCount: 7,
    originIndex: 0,
    candidateIndex: 5,
    scope,
    participants: [0, 1, 2, 3, 0, 1, 2],
    choices: [
      { cont: null, fork: null, merges: [] },
      { cont: null, fork: null, merges: [] },
      { cont: null, fork: null, merges: [] },
      { cont: null, fork: null, merges: [1, 2] },
      { cont: null, fork: null, merges: [] },
      { cont: 0, fork: 6, merges: [3, 4] },
      { cont: null, fork: null, merges: [] },
    ],
    modes,
    conflictPolicy,
  };
}

/** Fixed diamond: D MERGED_FROM B,C; B FORKED_FROM A; C CONTINUATION A. */
export function diamondSpec(
  scope: LineageTraversalScope,
  modes: readonly AssessmentMode[],
  conflictPolicy: boolean,
): DagSpec {
  return {
    nodeCount: 4,
    originIndex: 0,
    candidateIndex: 3,
    scope,
    participants: [0, 1, 0, 3],
    choices: [
      { cont: null, fork: null, merges: [] },
      { cont: null, fork: 0, merges: [] },
      { cont: 0, fork: null, merges: [] },
      { cont: null, fork: null, merges: [1, 2] },
    ],
    modes,
    conflictPolicy,
  };
}

export const mixedMergeCaseArbitrary: fc.Arbitrary<GeneratedCase> = fc
  .record({
    scope: fc.constantFrom(...SCOPES),
    modes: fc.array(modeArbitrary, { minLength: 6, maxLength: 6 }),
    conflictPolicy: fc.boolean(),
  })
  .map((input) => buildCase(mixedMergeSpec(input.scope, input.modes, input.conflictPolicy)));

export const diamondCaseArbitrary: fc.Arbitrary<GeneratedCase> = fc
  .record({
    modes: fc.array(modeArbitrary, { minLength: 4, maxLength: 4 }),
    conflictPolicy: fc.boolean(),
  })
  .map((input) => buildCase(diamondSpec('FULL_ANCESTRY', input.modes, input.conflictPolicy)));

export interface ShapeStats {
  readonly mergeNodes: number;
  readonly mixedRelationNodes: number;
  readonly closureOnlyBranches: number;
  readonly hasCycle: boolean;
}

/** Structural coverage counters used to report what the generator actually produced. */
export function shapeStats(graph: LineageGraph): ShapeStats {
  const parentsByChild = new Map<string, { relation: string; parent: string }[]>();
  for (const edge of graph.edges) {
    const list = parentsByChild.get(String(edge.child)) ?? [];
    list.push({ relation: edge.relation, parent: String(edge.parent) });
    parentsByChild.set(String(edge.child), list);
  }

  let mergeNodes = 0;
  let mixedRelationNodes = 0;
  let closureOnlyBranches = 0;

  for (const parents of parentsByChild.values()) {
    if (!parents.some((parent) => parent.relation === 'MERGED_FROM')) {
      continue;
    }
    mergeNodes += 1;
    if (new Set(parents.map((parent) => parent.relation)).size > 1) {
      mixedRelationNodes += 1;
    }
    for (const parent of parents) {
      if ((parentsByChild.get(parent.parent) ?? []).length > 0) {
        closureOnlyBranches += 1;
      }
    }
  }

  return {
    mergeNodes,
    mixedRelationNodes,
    closureOnlyBranches,
    hasCycle: graph.cycles.length > 0,
  };
}
