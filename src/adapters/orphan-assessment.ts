// Experimental reference adapter for C-1 orphan Assessment emission.
//
// This is not a CORE-001 protocol API and carries no stability guarantee. It
// constructs candidates from a builder-issued lineage graph and submits them to
// Core admission; it does not persist, publish or mutate registered state.

import type { ContinuityAssessment } from '../core/assessment.js';
import { registerOrphanAssessments } from '../core/assessment.js';
import type { LineageRelationType } from '../core/entities.js';
import type { Result } from '../core/errors.js';
import { isBuiltLineageGraph } from '../core/lineage.js';
import type { LineageGraph } from '../core/lineage.js';
import type { DeepReadonly } from '../core/ownership.js';
import type { AssessmentID, DomainID, IdentityVersionID, Timestamp } from '../core/primitives.js';
import type { AssessmentEmission } from './emission.js';
import { compareStrings, freezeEmission, mechanismRejection, readAssessmentId } from './emission.js';

export interface OrphanAssessmentRequest {
  readonly graph: LineageGraph;
  readonly child: IdentityVersionID;
  readonly existing: readonly DeepReadonly<ContinuityAssessment>[];
  readonly assessmentIdFor: (relation: LineageRelationType, parents: readonly IdentityVersionID[]) => AssessmentID;
  readonly assessment_profile_ref: string;
  readonly assessment_method_version: string;
  readonly assessed_by: DomainID;
  readonly assessed_at: Timestamp;
  readonly evidence_refs?: readonly string[];
}

export type OrphanAssessmentEmission = AssessmentEmission;

interface RelationGroup {
  readonly relation: LineageRelationType;
  readonly parents: IdentityVersionID[];
}

function collectRelationGroups(graph: DeepReadonly<LineageGraph>, child: IdentityVersionID): RelationGroup[] {
  const groups = new Map<LineageRelationType, IdentityVersionID[]>();
  for (const edge of graph.edges) {
    if (edge.child !== child) continue;
    const parents = groups.get(edge.relation);
    if (parents === undefined) {
      groups.set(edge.relation, [edge.parent]);
    } else if (!parents.includes(edge.parent)) {
      parents.push(edge.parent);
    }
  }

  return [...groups.entries()]
    .map(([relation, parents]) => ({ relation, parents: [...parents].sort(compareStrings) }))
    .sort((left, right) => compareStrings(left.relation, right.relation));
}

function groupHasUnresolvedParent(group: RelationGroup, graph: DeepReadonly<LineageGraph>): boolean {
  return group.parents.some((parent) => !graph.nodes.includes(parent));
}

function assessmentIdForGroup(request: OrphanAssessmentRequest, group: RelationGroup): Result<AssessmentID> {
  return readAssessmentId(() => request.assessmentIdFor(group.relation, group.parents), 'C-1');
}

function buildCandidate(request: OrphanAssessmentRequest, group: RelationGroup, id: AssessmentID): unknown {
  return {
    assessment_id: id,
    subject_version_id: request.child,
    parent_version_ids: group.parents,
    declared_relation: group.relation,
    assessment_profile_ref: request.assessment_profile_ref,
    assessment_method_version: request.assessment_method_version,
    verified_claims: [],
    unverified_claims: ['PARENT_UNRESOLVED'],
    evidence_refs: request.evidence_refs ?? [],
    assessed_by: request.assessed_by,
    assessed_at: request.assessed_at,
  };
}

/**
 * Emits one declaration-scoped C-1 Assessment per `(child, relation)` group
 * whose declared parent set contains at least one parent absent from the graph.
 *
 * The complete declared parent set is included. `PARENT_UNRESOLVED` is
 * declaration-scoped, not edge-scoped.
 */
export function emitOrphanAssessment(request: OrphanAssessmentRequest): Result<OrphanAssessmentEmission> {
  if (!isBuiltLineageGraph(request.graph)) {
    return mechanismRejection('graph must be produced by buildLineageGraph');
  }
  if (!request.graph.nodes.includes(request.child)) {
    return mechanismRejection('child is not present in the graph');
  }

  const candidates: unknown[] = [];
  const emittedIds: AssessmentID[] = [];
  for (const group of collectRelationGroups(request.graph, request.child)) {
    if (!groupHasUnresolvedParent(group, request.graph)) {
      continue;
    }
    const id = assessmentIdForGroup(request, group);
    if (!id.ok) return id;
    emittedIds.push(id.value);
    candidates.push(buildCandidate(request, group, id.value));
  }

  const admitted = registerOrphanAssessments(candidates, request.graph, request.existing);
  if (!admitted.ok) {
    return admitted;
  }

  return { ok: true, value: freezeEmission(admitted.value, emittedIds) };
}
