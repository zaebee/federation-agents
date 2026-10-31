// Traversal phases 1 and 2 for UIA-CORE-001 §8 (Task 9).
//
// Phase 1 (`discoverPaths`) answers scope-permitted reachability only; it never
// consults Assessments. Phase 2 (`validatePath`) validates one concrete path
// through Task 8's edge-bound assessment APIs. Merge Closure Validation is
// Task 10 and is not implemented here.

import {
  assessEdge,
  evaluateAssurance,
  type ContinuityAssessment,
  type ContinuityAssuranceRequirement,
  type EdgeRef,
  type Policy,
} from './assessment.js';
import type { IdentityVersionDescriptor, LineageRelationType } from './entities.js';
import type { Failure, MechanismFailure, Result } from './errors.js';
import { mechanismFailure, specFailure } from './errors.js';
import type { LineageEdge, LineageGraph } from './lineage.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze } from './ownership.js';
import type { IdentityVersionID, ParticipantID } from './primitives.js';
import { compileSelector, selectorMatches } from './selector.js';
import type { TemporalContext } from './temporal.js';
import { validateVersionLabel } from './version-scheme.js';

const TRAVERSAL_SCOPES = ['CONTINUATION_ONLY', 'CONTINUATION_AND_FORK', 'FULL_ANCESTRY'] as const;

export type LineageTraversalScope = (typeof TRAVERSAL_SCOPES)[number];

export interface ConditionalVersionBinding {
  readonly target_participant_id: ParticipantID;
  readonly origin_version_id: IdentityVersionID;
  readonly selector_expression: string;
  readonly traversal_scope: LineageTraversalScope;
  readonly assurance_requirement: ContinuityAssuranceRequirement;
}

export interface Path {
  readonly scope: LineageTraversalScope;
  readonly edges: readonly DeepReadonly<LineageEdge>[];
}

export type PathSet = readonly Path[];

export type PathValidation =
  | { readonly status: 'VALID' }
  | {
      readonly status: 'INVALID';
      readonly code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED';
      readonly edge: EdgeRef;
      readonly missing: readonly string[];
      readonly disallowed: readonly string[];
    }
  | {
      readonly status: 'CONTESTED';
      readonly edge: EdgeRef;
      readonly contestedClaims: readonly string[];
    };

export type FailedPathValidation = Exclude<PathValidation, { readonly status: 'VALID' }>;

export interface FailedPath {
  readonly path: Path;
  readonly outcome: FailedPathValidation;
}

export type BindingFailureCode =
  | 'ERR_AUTHORITY_BINDING_MISMATCH'
  | 'ERR_NO_TRAVERSAL_PATH'
  | 'ERR_ASSURANCE_PREDICATE_UNSATISFIED'
  | 'ERR_MERGE_BRANCH_UNSATISFIED'
  | 'CYCLE_DETECTED';

export type BindingResult =
  | { readonly eligible: true; readonly acceptedPaths: readonly Path[] }
  | { readonly eligible: false; readonly kind: 'MECHANISM'; readonly error: MechanismFailure }
  | {
      readonly eligible: false;
      readonly kind: 'CONTESTED';
      readonly details: { readonly perPath: readonly FailedPath[] };
    }
  | {
      readonly eligible: false;
      readonly code: BindingFailureCode;
      readonly details: { readonly perPath?: readonly FailedPath[] };
    };

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isTraversalScope(value: unknown): value is LineageTraversalScope {
  return typeof value === 'string' && (TRAVERSAL_SCOPES as readonly string[]).includes(value);
}

function relationAllowed(scope: LineageTraversalScope, relation: LineageRelationType): boolean {
  if (scope === 'CONTINUATION_ONLY') {
    return relation === 'CONTINUATION';
  }
  if (scope === 'CONTINUATION_AND_FORK') {
    return relation === 'CONTINUATION' || relation === 'FORKED_FROM';
  }
  return true;
}

function edgeRef(edge: DeepReadonly<LineageEdge>): EdgeRef {
  return {
    child: edge.child,
    parent: edge.parent,
    relation: edge.relation,
  };
}

function frozenPath(scope: LineageTraversalScope, edges: readonly LineageEdge[]): Path {
  return deepFreeze({
    scope,
    edges: edges.map((edge) => ({
      child: edge.child,
      parent: edge.parent,
      relation: edge.relation,
    })),
  }) as Path;
}

function pathKey(path: Path): string {
  return path.edges
    .map((edge) => `${String(edge.child)}\u0000${String(edge.parent)}\u0000${edge.relation}`)
    .join('\u0001');
}

function noPath(candidateID: IdentityVersionID, originID: IdentityVersionID): Result<never> {
  return {
    ok: false,
    error: specFailure(
      'ERR_NO_TRAVERSAL_PATH',
      `No permitted path from ${candidateID} to ${originID} under the selected scope`,
    ),
  };
}

function pathMechanismFailure(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function adjacencyFor(graph: LineageGraph, scope: LineageTraversalScope): Map<IdentityVersionID, LineageEdge[]> {
  const adjacency = new Map<IdentityVersionID, LineageEdge[]>();

  for (const edge of graph.edges) {
    if (!relationAllowed(scope, edge.relation)) {
      continue;
    }
    const edges = adjacency.get(edge.child) ?? [];
    if (!edges.some((item) => item.parent === edge.parent && item.relation === edge.relation)) {
      edges.push({ child: edge.child, parent: edge.parent, relation: edge.relation });
    }
    adjacency.set(edge.child, edges);
  }

  for (const edges of adjacency.values()) {
    edges.sort((a, b) => compareStrings(a.parent, b.parent) || compareStrings(a.relation, b.relation));
  }
  return adjacency;
}

interface DiscoveryFrame {
  readonly node: IdentityVersionID;
  readonly edges: readonly LineageEdge[];
  next: number;
  readonly visited: ReadonlySet<IdentityVersionID>;
}

interface PrecheckResult {
  readonly ok: true;
}

type CandidatePrecheck =
  | PrecheckResult
  | { readonly ok: false; readonly mismatch: true }
  | { readonly ok: false; readonly mismatch: false; readonly error: MechanismFailure };

function collectPaths(
  adjacency: ReadonlyMap<IdentityVersionID, readonly LineageEdge[]>,
  scope: LineageTraversalScope,
  candidateID: IdentityVersionID,
  originID: IdentityVersionID,
): Path[] {
  const paths: Path[] = [];
  const stack: DiscoveryFrame[] = [
    {
      node: candidateID,
      edges: [],
      next: 0,
      visited: new Set<IdentityVersionID>([candidateID]),
    },
  ];

  while (stack.length > 0) {
    const frame = stack.at(-1);
    if (frame === undefined) {
      break;
    }

    if (frame.node === originID) {
      if (frame.edges.length > 0) {
        paths.push(frozenPath(scope, frame.edges));
      }
      stack.pop();
      continue;
    }

    const edges = adjacency.get(frame.node) ?? [];
    if (frame.next >= edges.length) {
      stack.pop();
      continue;
    }

    const edge = edges[frame.next];
    frame.next += 1;
    if (frame.visited.has(edge.parent)) {
      continue;
    }

    const visited = new Set(frame.visited);
    visited.add(edge.parent);
    stack.push({ node: edge.parent, edges: [...frame.edges, edge], next: 0, visited });
  }

  return paths;
}

/**
 * Phase 1: discovers all simple candidate-to-origin paths permitted by the
 * selected scope. Cycle-forming and unresolved parents are dead ends.
 */
export function discoverPaths(
  graph: LineageGraph,
  scope: LineageTraversalScope,
  candidateID: IdentityVersionID,
  originID: IdentityVersionID,
): Result<PathSet> {
  if (!isTraversalScope(scope)) {
    return pathMechanismFailure(`Unknown traversal scope: ${String(scope)}`);
  }
  if (candidateID === originID) {
    return noPath(candidateID, originID);
  }
  if (!graph.nodes.includes(candidateID) || !graph.nodes.includes(originID)) {
    return noPath(candidateID, originID);
  }

  const paths = collectPaths(adjacencyFor(graph, scope), scope, candidateID, originID);
  if (paths.length === 0) {
    return noPath(candidateID, originID);
  }

  paths.sort((a, b) => compareStrings(pathKey(a), pathKey(b)));
  return { ok: true, value: Object.freeze(paths) };
}

function validatePathShape(path: Path): Result<void> {
  if (!isTraversalScope(path.scope)) {
    return pathMechanismFailure(`Unknown traversal scope: ${String(path.scope)}`);
  }
  if (path.edges.length === 0) {
    return pathMechanismFailure('Path must contain at least one edge');
  }

  const seen = new Set<IdentityVersionID>([path.edges[0].child]);
  for (let index = 0; index < path.edges.length; index += 1) {
    const edge = path.edges[index];
    if (!relationAllowed(path.scope, edge.relation)) {
      return pathMechanismFailure('Path edge violates the traversal scope');
    }
    if (index > 0 && path.edges[index - 1].parent !== edge.child) {
      return pathMechanismFailure('Path edges are not contiguous in candidate-to-origin order');
    }
    if (seen.has(edge.parent)) {
      return pathMechanismFailure('Path contains a cycle');
    }
    seen.add(edge.parent);
  }

  return { ok: true, value: undefined };
}

function validationValue(value: PathValidation): Result<PathValidation> {
  return { ok: true, value: deepFreeze(value) as PathValidation };
}

/**
 * Phase 2: validates one concrete path edge by edge. Task 8 owns assessment
 * applicability and assurance; this function only sequences the calls and
 * preserves the first failing edge.
 */
export function validatePath(
  path: Path,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<PathValidation> {
  const shape = validatePathShape(path);
  if (!shape.ok) {
    return shape;
  }

  for (const edge of path.edges) {
    const reference = edgeRef(edge);
    const applicable = assessEdge(reference, assessments, policy, ctx);
    if (!applicable.ok) {
      return applicable;
    }

    // §8.5(2): absence of an applicable Assessment is never success, even when
    // the requirement happens to list no claims.
    if (applicable.value.unresolved) {
      return validationValue({
        status: 'INVALID',
        code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
        edge: reference,
        missing: [...requirement.required_claims].sort(compareStrings),
        disallowed: [],
      });
    }

    const assurance = evaluateAssurance(applicable.value, requirement, policy, ctx);
    if ('kind' in assurance) {
      return { ok: false, error: assurance };
    }
    if (assurance.status === 'SATISFIED') {
      continue;
    }
    if (assurance.status === 'UNSATISFIED') {
      return validationValue({
        status: 'INVALID',
        code: assurance.code,
        edge: reference,
        missing: assurance.missing,
        disallowed: assurance.disallowed,
      });
    }
    return validationValue({
      status: 'CONTESTED',
      edge: reference,
      contestedClaims: assurance.contestedClaims,
    });
  }

  return validationValue({ status: 'VALID' });
}

function asMechanism(failure: Failure): MechanismFailure {
  if (failure.kind === 'MECHANISM') {
    return failure;
  }
  return mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', failure.message);
}

function mechanismResult(error: MechanismFailure): BindingResult {
  return deepFreeze({ eligible: false, kind: 'MECHANISM', error }) as BindingResult;
}

function mismatchResult(): BindingResult {
  return deepFreeze({ eligible: false, code: 'ERR_AUTHORITY_BINDING_MISMATCH', details: {} }) as BindingResult;
}

/**
 * Orchestrates §8.3 prechecks, path discovery and per-path validation.
 * Merge Closure Validation is deliberately absent until Task 10.
 */
function precheckCandidate(
  candidate: DeepReadonly<IdentityVersionDescriptor>,
  binding: ConditionalVersionBinding,
): CandidatePrecheck {
  if (candidate.participant_id !== binding.target_participant_id) {
    return { ok: false, mismatch: true };
  }

  const compiled = compileSelector(binding.selector_expression, candidate.version_scheme);
  if (!compiled.ok) {
    return { ok: false, mismatch: false, error: asMechanism(compiled.error) };
  }
  const label = validateVersionLabel(candidate.version_label, candidate.version_scheme);
  if (!label.ok) {
    return { ok: false, mismatch: false, error: asMechanism(label.error) };
  }
  if (!selectorMatches(compiled.value, label.value)) {
    return { ok: false, mismatch: true };
  }

  return { ok: true };
}

function summarizePaths(accepted: readonly Path[], failed: readonly FailedPath[]): BindingResult {
  if (accepted.length > 0) {
    return deepFreeze({ eligible: true, acceptedPaths: accepted }) as BindingResult;
  }
  if (failed.length > 0 && failed.every((item) => item.outcome.status === 'CONTESTED')) {
    return deepFreeze({
      eligible: false,
      kind: 'CONTESTED',
      details: { perPath: failed },
    }) as BindingResult;
  }
  return deepFreeze({
    eligible: false,
    code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
    details: { perPath: failed },
  }) as BindingResult;
}

/**
 * Orchestrates §8.3 prechecks, path discovery and per-path validation.
 * Merge Closure Validation is deliberately absent until Task 10.
 */
export function evaluateBinding(
  state: {
    graph: LineageGraph;
    descriptors: readonly DeepReadonly<IdentityVersionDescriptor>[];
    assessments: readonly ContinuityAssessment[];
  },
  binding: ConditionalVersionBinding,
  candidateID: IdentityVersionID,
  policy: Policy,
  ctx: TemporalContext,
): BindingResult {
  const candidate = state.descriptors.find((descriptor) => descriptor.id === candidateID);
  if (candidate === undefined) {
    return mechanismResult(
      mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', `Candidate descriptor ${candidateID} is not supplied`),
    );
  }

  const precheck = precheckCandidate(candidate, binding);
  if (!precheck.ok) {
    return precheck.mismatch ? mismatchResult() : mechanismResult(precheck.error);
  }

  const discovered = discoverPaths(state.graph, binding.traversal_scope, candidateID, binding.origin_version_id);
  if (!discovered.ok) {
    if (discovered.error.kind === 'MECHANISM') {
      return mechanismResult(discovered.error);
    }
    return deepFreeze({ eligible: false, code: 'ERR_NO_TRAVERSAL_PATH', details: {} }) as BindingResult;
  }

  const accepted: Path[] = [];
  const failed: FailedPath[] = [];

  for (const path of discovered.value) {
    const validation = validatePath(path, state.assessments, binding.assurance_requirement, policy, ctx);
    if (!validation.ok) {
      return mechanismResult(asMechanism(validation.error));
    }
    if (validation.value.status === 'VALID') {
      accepted.push(path);
    } else {
      failed.push({ path, outcome: validation.value });
    }
  }

  return summarizePaths(accepted, failed);
}
