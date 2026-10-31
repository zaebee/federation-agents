// Experimental reference adapter for C-1 orphan Assessment emission.
//
// This is not a CORE-001 protocol API and carries no stability guarantee. It
// constructs candidates from a builder-issued lineage graph and submits them to
// Core admission; it does not persist, publish or mutate registered state.

import type { ContinuityAssessment } from '../core/assessment.js';
import { registerOrphanAssessments } from '../core/assessment.js';
import type { LineageRelationType } from '../core/entities.js';
import type { Result } from '../core/errors.js';
import { mechanismFailure } from '../core/errors.js';
import { isBuiltLineageGraph } from '../core/lineage.js';
import type { LineageGraph } from '../core/lineage.js';
import type { DeepReadonly } from '../core/ownership.js';
import { validateJsonValue } from '../core/ownership.js';
import type { AssessmentID, DomainID, IdentityVersionID, Timestamp } from '../core/primitives.js';

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

export interface OrphanAssessmentEmission {
  readonly assessments: readonly DeepReadonly<ContinuityAssessment>[];
  readonly registered: readonly DeepReadonly<ContinuityAssessment>[];
}

interface RelationGroup {
  readonly relation: LineageRelationType;
  readonly parents: IdentityVersionID[];
}

function mechanismRejection(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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

  const groups = new Map<LineageRelationType, IdentityVersionID[]>();
  for (const edge of request.graph.edges) {
    if (edge.child !== request.child) continue;
    const parents = groups.get(edge.relation);
    if (parents === undefined) {
      groups.set(edge.relation, [edge.parent]);
    } else if (!parents.includes(edge.parent)) {
      parents.push(edge.parent);
    }
  }

  const ordered: RelationGroup[] = [...groups.entries()]
    .map(([relation, parents]) => ({ relation, parents: [...parents].sort(compareStrings) }))
    .sort((left, right) => compareStrings(left.relation, right.relation));

  const candidates: unknown[] = [];
  for (const group of ordered) {
    if (!group.parents.some((parent) => !request.graph.nodes.includes(parent))) {
      continue;
    }

    let id: unknown;
    try {
      id = request.assessmentIdFor(group.relation, group.parents);
    } catch {
      return mechanismRejection('assessmentIdFor threw while constructing a C-1 candidate');
    }
    const idValue = validateJsonValue(id);
    if (!idValue.ok || typeof idValue.value !== 'string' || idValue.value.length === 0) {
      return mechanismRejection('assessmentIdFor must return a non-empty string');
    }

    candidates.push({
      assessment_id: idValue.value,
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
    });
  }

  if (candidates.length === 0) {
    return { ok: true, value: { assessments: [], registered: request.existing } };
  }

  const admitted = registerOrphanAssessments(candidates, request.graph, request.existing);
  if (!admitted.ok) {
    return admitted;
  }

  const assessments = Object.freeze(admitted.value.slice(request.existing.length));
  return { ok: true, value: { assessments, registered: admitted.value } };
}
