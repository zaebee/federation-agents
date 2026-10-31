// Experimental reference adapter for C-2 cycle Assessment emission.
//
// This is not a CORE-001 protocol API and carries no stability guarantee. It
// constructs candidates from a builder-issued lineage graph and submits them to
// Core admission; it does not persist, publish or mutate registered state.
//
// Model: T18-DEC-16 Option D (approved 2026-10-31). One Assessment per affected
// lineage edge inside a cyclic strongly connected component:
//   subject_version_id = edge child
//   declared_relation  = edge relation
//   parent_version_ids = [edge parent]
//   unverified_claims  = ['CYCLE_DETECTED']
//
// A structural self-loop cannot be represented: the assessment contract rejects
// a subject that is its own parent (§5.2 also rejects self-parents for
// descriptors). Such an edge stays a graph-level cycle without an Assessment
// until that sub-decision is resolved.

import type { ContinuityAssessment } from '../core/assessment.js';
import { registerCycleAssessments } from '../core/assessment.js';
import type { LineageRelationType } from '../core/entities.js';
import type { Result } from '../core/errors.js';
import { mechanismFailure } from '../core/errors.js';
import { isBuiltLineageGraph } from '../core/lineage.js';
import type { LineageEdge, LineageGraph } from '../core/lineage.js';
import type { DeepReadonly } from '../core/ownership.js';
import { validateJsonValue } from '../core/ownership.js';
import type { AssessmentID, DomainID, IdentityVersionID, Timestamp } from '../core/primitives.js';

export interface CycleAssessmentRequest {
  readonly graph: LineageGraph;
  readonly existing: readonly DeepReadonly<ContinuityAssessment>[];
  readonly assessmentIdFor: (
    subject: IdentityVersionID,
    relation: LineageRelationType,
    parent: IdentityVersionID,
  ) => AssessmentID;
  readonly assessment_profile_ref: string;
  readonly assessment_method_version: string;
  readonly assessed_by: DomainID;
  readonly assessed_at: Timestamp;
  readonly evidence_refs?: readonly string[];
}

export interface CycleAssessmentEmission {
  readonly assessments: readonly DeepReadonly<ContinuityAssessment>[];
  readonly registered: readonly DeepReadonly<ContinuityAssessment>[];
}

interface CycleEdge {
  readonly child: IdentityVersionID;
  readonly parent: IdentityVersionID;
  readonly relation: LineageRelationType;
}

function mechanismRejection(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareEdges(left: CycleEdge, right: CycleEdge): number {
  return (
    compareStrings(left.child, right.child) ||
    compareStrings(left.parent, right.parent) ||
    compareStrings(left.relation, right.relation)
  );
}

/**
 * Edges whose endpoints lie in the same cyclic strongly connected component.
 * Duplicate declarations collapse to one edge; self-loops are excluded because
 * the assessment contract cannot express a subject as its own parent.
 */
function collectAffectedEdges(graph: DeepReadonly<LineageGraph>): CycleEdge[] {
  const componentOf = new Map<IdentityVersionID, number>();
  graph.cycles.forEach((component, index) => {
    for (const node of component) {
      componentOf.set(node, index);
    }
  });

  const seen = new Set<string>();
  const edges: CycleEdge[] = [];
  for (const edge of graph.edges as readonly DeepReadonly<LineageEdge>[]) {
    if (edge.child === edge.parent) continue;
    const component = componentOf.get(edge.child);
    if (component === undefined || componentOf.get(edge.parent) !== component) continue;
    const key = `${edge.child}\u0000${edge.parent}\u0000${edge.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ child: edge.child, parent: edge.parent, relation: edge.relation });
  }
  return edges.sort(compareEdges);
}

function assessmentIdForEdge(request: CycleAssessmentRequest, edge: CycleEdge): Result<AssessmentID> {
  let id: unknown;
  try {
    id = request.assessmentIdFor(edge.child, edge.relation, edge.parent);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return mechanismRejection(`assessmentIdFor threw while constructing a C-2 candidate: ${reason}`);
  }
  const idValue = validateJsonValue(id);
  if (!idValue.ok || typeof idValue.value !== 'string' || idValue.value.length === 0) {
    return mechanismRejection('assessmentIdFor must return a non-empty string');
  }
  return { ok: true, value: idValue.value as AssessmentID };
}

function buildCandidate(request: CycleAssessmentRequest, edge: CycleEdge, id: AssessmentID): unknown {
  return {
    assessment_id: id,
    subject_version_id: edge.child,
    parent_version_ids: [edge.parent],
    declared_relation: edge.relation,
    assessment_profile_ref: request.assessment_profile_ref,
    assessment_method_version: request.assessment_method_version,
    verified_claims: [],
    unverified_claims: ['CYCLE_DETECTED'],
    evidence_refs: request.evidence_refs ?? [],
    assessed_by: request.assessed_by,
    assessed_at: request.assessed_at,
  };
}

/**
 * Emits one declaration-scoped C-2 Assessment per affected lineage edge inside
 * a cyclic strongly connected component (T18-DEC-16 Option D).
 *
 * Emission is deterministic: edges are ordered by `(child, parent, relation)`.
 * An acyclic edge whose endpoint merely belongs to a cycle is not affected and
 * gets no Assessment. The graph and the caller's `existing` array are not
 * mutated.
 */
export function emitCycleAssessments(request: CycleAssessmentRequest): Result<CycleAssessmentEmission> {
  if (!isBuiltLineageGraph(request.graph)) {
    return mechanismRejection('graph must be produced by buildLineageGraph');
  }

  const candidates: unknown[] = [];
  const candidateIds = new Set<AssessmentID>();
  for (const edge of collectAffectedEdges(request.graph)) {
    const id = assessmentIdForEdge(request, edge);
    if (!id.ok) return id;
    candidateIds.add(id.value);
    candidates.push(buildCandidate(request, edge, id.value));
  }

  const admitted = registerCycleAssessments(candidates, request.graph, request.existing);
  if (!admitted.ok) {
    return admitted;
  }

  // The registered representation is sorted by assessment_id, so selecting the
  // emitted records by position would pick up pre-existing records. Select by
  // the candidate IDs instead; the admitted order is preserved.
  const assessments = Object.freeze(admitted.value.filter((assessment) => candidateIds.has(assessment.assessment_id)));
  return { ok: true, value: Object.freeze({ assessments, registered: admitted.value }) };
}
