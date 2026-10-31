// Traversal phases for UIA-CORE-001 §8 (Tasks 9 and 10).
//
// Phase 1 (`discoverPaths`) answers scope-permitted reachability only; it never
// consults Assessments. Phase 2 (`validatePath`) validates one concrete path
// through Task 8's edge-bound assessment APIs. Phase 3
// (`validateMergeClosure`) closes every direct parent edge of merge nodes on a
// VALID path; closure-only branches are not recursed (A-5).

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
    }
  | {
      readonly status: 'CYCLE_DETECTED';
      readonly code: 'CYCLE_DETECTED';
      readonly cycle: readonly IdentityVersionID[];
    };

export type FailedPathValidation = Exclude<PathValidation, { readonly status: 'VALID' }>;

export type MergeClosureBranchFailure =
  | {
      readonly branch: EdgeRef;
      readonly reason: 'NO_APPLICABLE_ASSESSMENT';
    }
  | {
      readonly branch: EdgeRef;
      readonly reason: 'ASSURANCE_UNSATISFIED';
      readonly missing: readonly string[];
      readonly disallowed: readonly string[];
    }
  | {
      readonly branch: EdgeRef;
      readonly reason: 'CONTESTED';
      readonly contestedClaims: readonly string[];
    };

export type MergeClosureResult =
  | { readonly status: 'SATISFIED' }
  | {
      readonly status: 'UNSATISFIED';
      readonly code: 'ERR_MERGE_BRANCH_UNSATISFIED';
      readonly failures: readonly MergeClosureBranchFailure[];
    };

export interface PathOutcome {
  readonly path: Path;
  readonly outcome: PathValidation;
  readonly closure?: MergeClosureResult;
}

export type FailedPath = PathOutcome & { readonly outcome: FailedPathValidation };

export type BindingFailureCode =
  | 'ERR_AUTHORITY_BINDING_MISMATCH'
  | 'ERR_NO_TRAVERSAL_PATH'
  | 'ERR_ASSURANCE_PREDICATE_UNSATISFIED'
  | 'ERR_MERGE_BRANCH_UNSATISFIED'
  | 'CYCLE_DETECTED';

export type BindingResult =
  | {
      readonly eligible: true;
      readonly acceptedPaths: readonly Path[];
      readonly details: { readonly perPath: readonly PathOutcome[] };
    }
  | { readonly eligible: false; readonly kind: 'MECHANISM'; readonly error: MechanismFailure }
  | {
      readonly eligible: false;
      readonly kind: 'CONTESTED';
      readonly details: { readonly perPath: readonly PathOutcome[] };
    }
  | {
      readonly eligible: false;
      readonly code: BindingFailureCode;
      readonly details: { readonly perPath?: readonly PathOutcome[] };
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

function edgeKey(edge: {
  readonly child: IdentityVersionID;
  readonly parent: IdentityVersionID;
  readonly relation: LineageRelationType;
}): string {
  return `${String(edge.child)}\u0000${String(edge.parent)}\u0000${edge.relation}`;
}

type EdgeMembership = ReadonlySet<string>;

function edgeMembership(graph: LineageGraph): EdgeMembership {
  const keys = new Set<string>();
  for (const edge of graph.edges) {
    keys.add(edgeKey(edge));
  }
  return keys;
}

/**
 * A path is meaningful only against the graph it was discovered from. Every
 * edge must exist in that graph; without this check a path assembled from a
 * stale snapshot or from another domain's JSON would validate against any
 * graph that happens to accept its declarations.
 */
function pathMembershipFailure(path: Path, membership: EdgeMembership): Result<void> {
  for (const edge of path.edges) {
    if (!membership.has(edgeKey(edge))) {
      return pathMechanismFailure(
        `Path edge ${String(edge.child)} -[${edge.relation}]-> ${String(edge.parent)} is not present in the supplied graph`,
      );
    }
  }
  return { ok: true, value: undefined };
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

function reachableToOrigin(
  graph: LineageGraph,
  scope: LineageTraversalScope,
  originID: IdentityVersionID,
): ReadonlySet<IdentityVersionID> {
  const reverse = new Map<IdentityVersionID, IdentityVersionID[]>();
  for (const edge of graph.edges) {
    if (!relationAllowed(scope, edge.relation)) {
      continue;
    }
    // Duplicate entries are harmless: `reachable` prevents a node from being
    // queued twice, and total work stays linear in the number of edges.
    const children = reverse.get(edge.parent) ?? [];
    children.push(edge.child);
    reverse.set(edge.parent, children);
  }

  const reachable = new Set<IdentityVersionID>([originID]);
  const queue: IdentityVersionID[] = [originID];
  // A for...of array iterator observes elements appended during iteration,
  // which is what this BFS relies on.
  for (const node of queue) {
    for (const child of reverse.get(node) ?? []) {
      if (!reachable.has(child)) {
        reachable.add(child);
        queue.push(child);
      }
    }
  }
  return reachable;
}

function adjacencyFor(
  graph: LineageGraph,
  scope: LineageTraversalScope,
  reachable: ReadonlySet<IdentityVersionID>,
): Map<IdentityVersionID, LineageEdge[]> {
  const adjacency = new Map<IdentityVersionID, LineageEdge[]>();

  for (const edge of graph.edges) {
    if (!relationAllowed(scope, edge.relation) || !reachable.has(edge.parent)) {
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

type CandidatePrecheck =
  | { readonly ok: true }
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

  const reachable = reachableToOrigin(graph, scope, originID);
  if (!reachable.has(candidateID)) {
    return noPath(candidateID, originID);
  }

  const paths = collectPaths(adjacencyFor(graph, scope, reachable), scope, candidateID, originID);
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

type CycleIndex = ReadonlyMap<IdentityVersionID, readonly IdentityVersionID[]>;

function buildCycleIndex(graph: LineageGraph): CycleIndex {
  const index = new Map<IdentityVersionID, readonly IdentityVersionID[]>();
  for (const cycle of graph.cycles) {
    for (const node of cycle) {
      index.set(node, cycle);
    }
  }
  return index;
}

type EdgeAssuranceOutcome =
  | { readonly status: 'SATISFIED' }
  | { readonly status: 'NO_APPLICABLE_ASSESSMENT' }
  | {
      readonly status: 'UNSATISFIED';
      readonly missing: readonly string[];
      readonly disallowed: readonly string[];
    }
  | { readonly status: 'CONTESTED'; readonly contestedClaims: readonly string[] };

/** Shared Phase 2/3 edge evaluation; Task 8 owns applicability and assurance. */
function evaluateEdgeAssurance(
  branch: EdgeRef,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<EdgeAssuranceOutcome> {
  const applicable = assessEdge(branch, assessments, policy, ctx);
  if (!applicable.ok) {
    return applicable;
  }
  if (applicable.value.unresolved) {
    return { ok: true, value: { status: 'NO_APPLICABLE_ASSESSMENT' } };
  }

  const assurance = evaluateAssurance(applicable.value, requirement, policy, ctx);
  if (assurance.status === 'MECHANISM') {
    // Drop the assurance-only `status` discriminant, but keep every Failure
    // field, including `details` if a mechanism result ever carries one.
    const failure: MechanismFailure = {
      kind: assurance.kind,
      code: assurance.code,
      message: assurance.message,
      ...(assurance.details === undefined ? {} : { details: assurance.details }),
    };
    return { ok: false, error: failure };
  }
  if (assurance.status === 'SATISFIED') {
    return { ok: true, value: { status: 'SATISFIED' } };
  }
  if (assurance.status === 'UNSATISFIED') {
    return {
      ok: true,
      value: {
        status: 'UNSATISFIED',
        missing: assurance.missing,
        disallowed: assurance.disallowed,
      },
    };
  }
  return {
    ok: true,
    value: { status: 'CONTESTED', contestedClaims: assurance.contestedClaims },
  };
}

function cycleForPath(path: Path, index: CycleIndex): readonly IdentityVersionID[] | undefined {
  const cycles = new Set<readonly IdentityVersionID[]>();
  for (const edge of path.edges) {
    const childCycle = index.get(edge.child);
    if (childCycle !== undefined) {
      cycles.add(childCycle);
    }
    const parentCycle = index.get(edge.parent);
    if (parentCycle !== undefined) {
      cycles.add(parentCycle);
    }
  }

  if (cycles.size === 0) {
    return undefined;
  }

  const combined = new Set<IdentityVersionID>();
  for (const cycle of cycles) {
    for (const node of cycle) {
      combined.add(node);
    }
  }
  return [...combined].sort(compareStrings);
}

/**
 * Phase 2: validates one concrete path edge by edge. Task 8 owns assessment
 * applicability and assurance; this function only sequences the calls and
 * preserves the first failing edge.
 */
export function validatePath(
  path: Path,
  graph: LineageGraph,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<PathValidation> {
  const shape = validatePathShape(path);
  if (!shape.ok) {
    return shape;
  }
  const membership = pathMembershipFailure(path, edgeMembership(graph));
  if (!membership.ok) {
    return membership;
  }
  return validatePathWithIndex(path, buildCycleIndex(graph), assessments, requirement, policy, ctx);
}

function validatePathWithIndex(
  path: Path,
  cycleIndex: CycleIndex,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<PathValidation> {
  const shape = validatePathShape(path);
  if (!shape.ok) {
    return shape;
  }

  const cycle = cycleForPath(path, cycleIndex);
  if (cycle !== undefined) {
    return validationValue({ status: 'CYCLE_DETECTED', code: 'CYCLE_DETECTED', cycle });
  }

  for (const edge of path.edges) {
    const reference = edgeRef(edge);
    const outcome = evaluateEdgeAssurance(reference, assessments, requirement, policy, ctx);
    if (!outcome.ok) {
      return outcome;
    }

    if (outcome.value.status === 'SATISFIED') {
      continue;
    }
    if (outcome.value.status === 'NO_APPLICABLE_ASSESSMENT') {
      return validationValue({
        status: 'INVALID',
        code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
        edge: reference,
        missing: [...requirement.required_claims].sort(compareStrings),
        disallowed: [],
      });
    }
    if (outcome.value.status === 'UNSATISFIED') {
      return validationValue({
        status: 'INVALID',
        code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
        edge: reference,
        missing: outcome.value.missing,
        disallowed: outcome.value.disallowed,
      });
    }
    return validationValue({
      status: 'CONTESTED',
      edge: reference,
      contestedClaims: outcome.value.contestedClaims,
    });
  }

  return validationValue({ status: 'VALID' });
}

function directParentBranches(graph: LineageGraph, child: IdentityVersionID): EdgeRef[] {
  const branches = new Map<string, EdgeRef>();
  for (const candidate of graph.edges) {
    if (candidate.child !== child) {
      continue;
    }
    const branch = edgeRef(candidate);
    branches.set(`${String(branch.parent)}\u0000${branch.relation}`, branch);
  }
  return [...branches.values()].sort(
    (a, b) => compareStrings(a.parent, b.parent) || compareStrings(a.relation, b.relation),
  );
}

function evaluateClosureBranch(
  branch: EdgeRef,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<MergeClosureBranchFailure | undefined> {
  const outcome = evaluateEdgeAssurance(branch, assessments, requirement, policy, ctx);
  if (!outcome.ok) {
    return outcome;
  }

  if (outcome.value.status === 'SATISFIED') {
    return { ok: true, value: undefined };
  }
  if (outcome.value.status === 'NO_APPLICABLE_ASSESSMENT') {
    return { ok: true, value: { branch, reason: 'NO_APPLICABLE_ASSESSMENT' } };
  }
  if (outcome.value.status === 'UNSATISFIED') {
    return {
      ok: true,
      value: {
        branch,
        reason: 'ASSURANCE_UNSATISFIED',
        missing: outcome.value.missing,
        disallowed: outcome.value.disallowed,
      },
    };
  }
  return {
    ok: true,
    value: { branch, reason: 'CONTESTED', contestedClaims: outcome.value.contestedClaims },
  };
}

function closureBranchKey(branch: EdgeRef): string {
  return `${String(branch.child)}\u0000${String(branch.parent)}\u0000${branch.relation}`;
}

function collectBranchFailure(
  failures: Map<string, MergeClosureBranchFailure>,
  edge: EdgeRef,
  branch: EdgeRef,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<undefined> {
  if (branch.parent === edge.parent && branch.relation === edge.relation) {
    return { ok: true, value: undefined };
  }
  const key = closureBranchKey(branch);
  if (failures.has(key)) {
    return { ok: true, value: undefined };
  }

  const failure = evaluateClosureBranch(branch, assessments, requirement, policy, ctx);
  if (!failure.ok) {
    return failure;
  }
  if (failure.value !== undefined) {
    failures.set(key, failure.value);
  }
  return { ok: true, value: undefined };
}

function collectEdgeClosureFailures(
  failures: Map<string, MergeClosureBranchFailure>,
  edge: EdgeRef,
  graph: LineageGraph,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<undefined> {
  const branches = directParentBranches(graph, edge.child);
  if (!branches.some((branch) => branch.relation === 'MERGED_FROM')) {
    return { ok: true, value: undefined };
  }

  for (const branch of branches) {
    const collected = collectBranchFailure(failures, edge, branch, assessments, requirement, policy, ctx);
    if (!collected.ok) {
      return collected;
    }
  }
  return { ok: true, value: undefined };
}

function collectClosureFailures(
  path: Path,
  graph: LineageGraph,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<Map<string, MergeClosureBranchFailure>> {
  const failures = new Map<string, MergeClosureBranchFailure>();

  for (const edge of path.edges) {
    const collected = collectEdgeClosureFailures(failures, edge, graph, assessments, requirement, policy, ctx);
    if (!collected.ok) {
      return collected;
    }
  }

  return { ok: true, value: failures };
}

function closureResult(failures: ReadonlyMap<string, MergeClosureBranchFailure>): MergeClosureResult {
  if (failures.size === 0) {
    return deepFreeze({ status: 'SATISFIED' }) as MergeClosureResult;
  }

  const orderedFailures = [...failures.values()].sort(
    (a, b) =>
      compareStrings(a.branch.child, b.branch.child) ||
      compareStrings(a.branch.parent, b.branch.parent) ||
      compareStrings(a.branch.relation, b.branch.relation),
  );
  return deepFreeze({
    status: 'UNSATISFIED',
    code: 'ERR_MERGE_BRANCH_UNSATISFIED',
    failures: orderedFailures,
  }) as MergeClosureResult;
}

/**
 * Phase 3: immediate merge closure. For every MERGED_FROM node on the path,
 * every direct parent edge of that node is checked, whatever its relation.
 * The exact edge already validated by Phase 2 is skipped; closure-only
 * branches are not recursed.
 */
export function validateMergeClosure(
  path: Path,
  graph: LineageGraph,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<MergeClosureResult> {
  const shape = validatePathShape(path);
  if (!shape.ok) {
    return shape;
  }
  const membership = pathMembershipFailure(path, edgeMembership(graph));
  if (!membership.ok) {
    return membership;
  }
  return validateMergeClosureAgainstGraph(path, graph, assessments, requirement, policy, ctx);
}

/** Closure over an already-checked path (evaluateBinding passes discovered paths). */
function validateMergeClosureAgainstGraph(
  path: Path,
  graph: LineageGraph,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<MergeClosureResult> {
  const collected = collectClosureFailures(path, graph, assessments, requirement, policy, ctx);
  if (!collected.ok) {
    return collected;
  }
  return { ok: true, value: closureResult(collected.value) };
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

function evaluateOnePath(
  path: Path,
  graph: LineageGraph,
  cycleIndex: CycleIndex,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): Result<PathOutcome> {
  const validation = validatePathWithIndex(path, cycleIndex, assessments, requirement, policy, ctx);
  if (!validation.ok) {
    return validation;
  }
  if (validation.value.status !== 'VALID') {
    return { ok: true, value: { path, outcome: validation.value } };
  }

  const closure = validateMergeClosureAgainstGraph(path, graph, assessments, requirement, policy, ctx);
  if (!closure.ok) {
    return closure;
  }
  return { ok: true, value: { path, outcome: validation.value, closure: closure.value } };
}

/**
 * §8.3 prechecks: target participant, selector match and version label.
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

function summarizePaths(accepted: readonly Path[], outcomes: readonly PathOutcome[]): BindingResult {
  if (accepted.length > 0) {
    return deepFreeze({
      eligible: true,
      acceptedPaths: accepted,
      details: { perPath: outcomes },
    }) as BindingResult;
  }

  // Task 10 aggregation order: closure failure outranks cycle and contested.
  if (outcomes.some((item) => item.closure?.status === 'UNSATISFIED')) {
    return deepFreeze({
      eligible: false,
      code: 'ERR_MERGE_BRANCH_UNSATISFIED',
      details: { perPath: outcomes },
    }) as BindingResult;
  }
  if (outcomes.some((item) => item.outcome.status === 'CYCLE_DETECTED')) {
    return deepFreeze({
      eligible: false,
      code: 'CYCLE_DETECTED',
      details: { perPath: outcomes },
    }) as BindingResult;
  }
  if (outcomes.some((item) => item.outcome.status === 'CONTESTED')) {
    return deepFreeze({
      eligible: false,
      kind: 'CONTESTED',
      details: { perPath: outcomes },
    }) as BindingResult;
  }
  return deepFreeze({
    eligible: false,
    code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
    details: { perPath: outcomes },
  }) as BindingResult;
}

/**
 * Orchestrates §8.3 prechecks, path discovery, per-path validation and
 * immediate merge closure, then aggregates the per-path outcomes.
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
  const outcomes: PathOutcome[] = [];
  const cycleIndex = buildCycleIndex(state.graph);

  for (const path of discovered.value) {
    const evaluated = evaluateOnePath(
      path,
      state.graph,
      cycleIndex,
      state.assessments,
      binding.assurance_requirement,
      policy,
      ctx,
    );
    if (!evaluated.ok) {
      return mechanismResult(asMechanism(evaluated.error));
    }
    outcomes.push(evaluated.value);
    if (evaluated.value.outcome.status === 'VALID' && evaluated.value.closure?.status === 'SATISFIED') {
      accepted.push(path);
    }
  }

  return summarizePaths(accepted, outcomes);
}
