/**
 * Independent brute-force reference model for the IMMEDIATE-closure contract.
 *
 * Independence boundary:
 * - This module NEVER calls `discoverPaths`, `validatePath`,
 *   `validateMergeClosure` or `evaluateBinding`.
 * - It reuses only Task 8 assessment primitives (`assessEdge`,
 *   `evaluateAssurance`) so that policy/trust semantics are not re-implemented.
 * - Path enumeration, closure-branch selection and top-level aggregation are
 *   implemented here from the graph edges.
 *
 * Boundaries kept explicit:
 * - DAG only: cyclic graphs are rejected by the oracle and tested separately.
 * - Immediate closure only: closure-only branches are never recursed (A-5).
 * - The terminal origin is never an `edge.child`, so it is not closed (A-11).
 * - Aggregation follows current implementation behavior; this does not resolve
 *   the normative precedence question A-8.
 */
import type {
  ContinuityAssessment,
  ContinuityAssuranceRequirement,
  EdgeRef,
  Policy,
} from '../../../src/core/assessment.js';
import { assessEdge, evaluateAssurance } from '../../../src/core/assessment.js';
import type { LineageGraph } from '../../../src/core/lineage.js';
import type { IdentityVersionID } from '../../../src/core/primitives.js';
import type { TemporalContext } from '../../../src/core/temporal.js';
import type { ConditionalVersionBinding, LineageTraversalScope } from '../../../src/core/traversal.js';

export type Relation = 'CONTINUATION' | 'FORKED_FROM' | 'MERGED_FROM';
export type EdgeTriple = readonly [string, string, Relation];

export interface NormalizedFailure {
  readonly branch: EdgeTriple;
  readonly reason: 'NO_APPLICABLE_ASSESSMENT' | 'ASSURANCE_UNSATISFIED' | 'CONTESTED';
  readonly missing?: readonly string[];
  readonly disallowed?: readonly string[];
  readonly contestedClaims?: readonly string[];
}

export interface NormalizedPath {
  readonly key: string;
  readonly scope: string;
  readonly edges: readonly EdgeTriple[];
  readonly outcome: {
    readonly status: string;
    readonly code?: string;
    readonly missing?: readonly string[];
    readonly disallowed?: readonly string[];
    readonly contestedClaims?: readonly string[];
  };
  readonly closure?: {
    readonly status: string;
    readonly code?: string;
    readonly failures?: readonly NormalizedFailure[];
  };
}

export type NormalizedResult =
  | { readonly kind: 'eligible'; readonly accepted: readonly string[]; readonly perPath: readonly NormalizedPath[] }
  | { readonly kind: 'no-path' }
  | { readonly kind: 'failure'; readonly code: string; readonly perPath: readonly NormalizedPath[] }
  | { readonly kind: 'contested'; readonly perPath: readonly NormalizedPath[] }
  | { readonly kind: 'mechanism'; readonly message: string };

export interface OracleInput {
  readonly graph: LineageGraph;
  readonly binding: ConditionalVersionBinding;
  readonly candidate: IdentityVersionID;
  readonly assessments: readonly ContinuityAssessment[];
  readonly policy: Policy;
  readonly ctx: TemporalContext;
}

export type OracleResult =
  { readonly ok: true; readonly result: NormalizedResult } | { readonly ok: false; readonly error: string };

interface SimpleEdge {
  readonly child: IdentityVersionID;
  readonly parent: IdentityVersionID;
  readonly relation: Relation;
}

interface EdgeAssessment {
  readonly status: 'SATISFIED' | 'NO_APPLICABLE' | 'UNSATISFIED' | 'CONTESTED';
  readonly missing?: readonly string[];
  readonly disallowed?: readonly string[];
  readonly contestedClaims?: readonly string[];
}

type EdgeEvaluation =
  { readonly ok: true; readonly value: EdgeAssessment } | { readonly ok: false; readonly error: string };

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function permitted(scope: LineageTraversalScope, relation: Relation): boolean {
  if (scope === 'CONTINUATION_ONLY') {
    return relation === 'CONTINUATION';
  }
  if (scope === 'CONTINUATION_AND_FORK') {
    return relation === 'CONTINUATION' || relation === 'FORKED_FROM';
  }
  return true;
}

function triple(edge: SimpleEdge): EdgeTriple {
  return [String(edge.child), String(edge.parent), edge.relation];
}

function edgeKey(edge: SimpleEdge): string {
  return triple(edge).join('\u0000');
}

export function pathKey(scope: string, edges: readonly EdgeTriple[]): string {
  return JSON.stringify({ scope, edges });
}

function sortedEdges(edges: readonly SimpleEdge[]): SimpleEdge[] {
  return [...edges].sort(
    (left, right) =>
      compareStrings(String(left.child), String(right.child)) ||
      compareStrings(String(left.parent), String(right.parent)) ||
      compareStrings(left.relation, right.relation),
  );
}

/** Exhaustive DFS over scope-permitted simple paths from candidate to origin. */
function enumeratePaths(
  graph: LineageGraph,
  scope: LineageTraversalScope,
  candidate: IdentityVersionID,
  origin: IdentityVersionID,
): SimpleEdge[][] {
  const outbound = new Map<string, SimpleEdge[]>();
  for (const edge of graph.edges) {
    if (!permitted(scope, edge.relation)) {
      continue;
    }
    const key = String(edge.child);
    const list = outbound.get(key) ?? [];
    list.push({ child: edge.child, parent: edge.parent, relation: edge.relation });
    outbound.set(key, list);
  }
  for (const list of outbound.values()) {
    list.sort(
      (left, right) =>
        compareStrings(String(left.parent), String(right.parent)) || compareStrings(left.relation, right.relation),
    );
  }

  if (candidate === origin) {
    return [];
  }

  const paths: SimpleEdge[][] = [];
  const visited = new Set<string>([String(candidate)]);
  const stack: SimpleEdge[] = [];

  const walk = (node: IdentityVersionID): void => {
    if (node === origin) {
      paths.push([...stack]);
      return;
    }
    for (const edge of outbound.get(String(node)) ?? []) {
      const parentKey = String(edge.parent);
      if (visited.has(parentKey)) {
        continue;
      }
      visited.add(parentKey);
      stack.push(edge);
      walk(edge.parent);
      stack.pop();
      visited.delete(parentKey);
    }
  };

  walk(candidate);
  return paths.sort((left, right) =>
    compareStrings(pathKey(scope, left.map(triple)), pathKey(scope, right.map(triple))),
  );
}

function evaluateEdge(
  edge: SimpleEdge,
  assessments: readonly ContinuityAssessment[],
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): EdgeEvaluation {
  const reference: EdgeRef = edge;
  const applicable = assessEdge(reference, assessments, policy, ctx);
  if (!applicable.ok) {
    return { ok: false, error: applicable.error.message };
  }
  if (applicable.value.unresolved) {
    return {
      ok: true,
      value: {
        status: 'NO_APPLICABLE',
        missing: [...requirement.required_claims].sort(compareStrings),
        disallowed: [],
      },
    };
  }

  const assurance = evaluateAssurance(applicable.value, requirement, policy, ctx);
  if ('kind' in assurance) {
    return { ok: false, error: assurance.message };
  }
  if (assurance.status === 'SATISFIED') {
    return { ok: true, value: { status: 'SATISFIED' } };
  }
  if (assurance.status === 'UNSATISFIED') {
    return {
      ok: true,
      value: { status: 'UNSATISFIED', missing: assurance.missing, disallowed: assurance.disallowed },
    };
  }
  return { ok: true, value: { status: 'CONTESTED', contestedClaims: assurance.contestedClaims } };
}

function directParents(graph: LineageGraph, child: IdentityVersionID): SimpleEdge[] {
  const seen = new Set<string>();
  const parents: SimpleEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.child !== child) {
      continue;
    }
    const key = edgeKey(edge);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    parents.push({ child: edge.child, parent: edge.parent, relation: edge.relation });
  }
  return sortedEdges(parents);
}

function failureOutcome(value: EdgeAssessment): NormalizedPath['outcome'] {
  if (value.status === 'CONTESTED') {
    return { status: 'CONTESTED', contestedClaims: value.contestedClaims };
  }
  return {
    status: 'INVALID',
    code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
    missing: value.missing,
    disallowed: value.disallowed,
  };
}

function closureFailure(branch: SimpleEdge, value: EdgeAssessment): NormalizedFailure {
  if (value.status === 'NO_APPLICABLE') {
    return { branch: triple(branch), reason: 'NO_APPLICABLE_ASSESSMENT' };
  }
  if (value.status === 'UNSATISFIED') {
    return {
      branch: triple(branch),
      reason: 'ASSURANCE_UNSATISFIED',
      missing: value.missing,
      disallowed: value.disallowed,
    };
  }
  return { branch: triple(branch), reason: 'CONTESTED', contestedClaims: value.contestedClaims };
}

function validateOnePath(
  path: readonly SimpleEdge[],
  graph: LineageGraph,
  requirement: ContinuityAssuranceRequirement,
  assessments: readonly ContinuityAssessment[],
  policy: Policy,
  ctx: TemporalContext,
):
  | {
      readonly ok: true;
      readonly outcome: NormalizedPath['outcome'];
      readonly closure?: NonNullable<NormalizedPath['closure']>;
    }
  | { readonly ok: false; readonly error: string } {
  for (const edge of path) {
    const evaluation = evaluateEdge(edge, assessments, requirement, policy, ctx);
    if (!evaluation.ok) {
      return evaluation;
    }
    if (evaluation.value.status === 'SATISFIED') {
      continue;
    }
    return { ok: true, outcome: failureOutcome(evaluation.value) };
  }

  const closure = immediateClosure(path, graph, requirement, assessments, policy, ctx);
  if (!closure.ok) {
    return closure;
  }
  return { ok: true, outcome: { status: 'VALID' }, closure: closure.closure };
}

/**
 * Immediate closure for one path edge: if the child is a merge node, check all
 * direct parent edges except the exact path edge. No recursion.
 */
function closureFailuresForEdge(
  edge: SimpleEdge,
  graph: LineageGraph,
  requirement: ContinuityAssuranceRequirement,
  assessments: readonly ContinuityAssessment[],
  policy: Policy,
  ctx: TemporalContext,
):
  | { readonly ok: true; readonly failures: readonly NormalizedFailure[] }
  | { readonly ok: false; readonly error: string } {
  const parents = directParents(graph, edge.child);
  if (!parents.some((parent) => parent.relation === 'MERGED_FROM')) {
    return { ok: true, failures: [] };
  }

  const failures: NormalizedFailure[] = [];
  for (const branch of parents) {
    if (branch.parent === edge.parent && branch.relation === edge.relation) {
      continue;
    }
    const evaluation = evaluateEdge(branch, assessments, requirement, policy, ctx);
    if (!evaluation.ok) {
      return evaluation;
    }
    if (evaluation.value.status !== 'SATISFIED') {
      failures.push(closureFailure(branch, evaluation.value));
    }
  }
  return { ok: true, failures };
}

/** Immediate closure over all path edges; closure-only branches are not recursed. */
function immediateClosure(
  path: readonly SimpleEdge[],
  graph: LineageGraph,
  requirement: ContinuityAssuranceRequirement,
  assessments: readonly ContinuityAssessment[],
  policy: Policy,
  ctx: TemporalContext,
):
  | { readonly ok: true; readonly closure: NonNullable<NormalizedPath['closure']> }
  | { readonly ok: false; readonly error: string } {
  const failures = new Map<string, NormalizedFailure>();

  for (const edge of path) {
    const collected = closureFailuresForEdge(edge, graph, requirement, assessments, policy, ctx);
    if (!collected.ok) {
      return collected;
    }
    for (const failure of collected.failures) {
      const key = failure.branch.join('\u0000');
      if (!failures.has(key)) {
        failures.set(key, failure);
      }
    }
  }

  const ordered = [...failures.values()].sort(
    (left, right) =>
      compareStrings(left.branch[0], right.branch[0]) ||
      compareStrings(left.branch[1], right.branch[1]) ||
      compareStrings(left.branch[2], right.branch[2]),
  );
  return ordered.length === 0
    ? { ok: true, closure: { status: 'SATISFIED' } }
    : {
        ok: true,
        closure: { status: 'UNSATISFIED', code: 'ERR_MERGE_BRANCH_UNSATISFIED', failures: ordered },
      };
}

/**
 * Brute-force immediate-closure reference.
 *
 * Aggregation mirrors the current implementation: fully accepted path wins;
 * then closure failure, cycle, contested, assurance. This is implementation
 * behavior used to detect regressions; A-8 remains OPEN.
 */
export function runOracle(input: OracleInput): OracleResult {
  const { graph, binding, candidate, assessments, policy, ctx } = input;

  if (graph.cycles.length > 0) {
    return { ok: false, error: 'oracle is DAG-only; cyclic graph passed to the immediate-closure oracle' };
  }

  const paths = enumeratePaths(graph, binding.traversal_scope, candidate, binding.origin_version_id);
  const perPath: NormalizedPath[] = [];
  for (const path of paths) {
    const evaluated = validateOnePath(path, graph, binding.assurance_requirement, assessments, policy, ctx);
    if (!evaluated.ok) {
      return evaluated;
    }
    const edges = path.map(triple);
    perPath.push({
      key: pathKey(binding.traversal_scope, edges),
      scope: binding.traversal_scope,
      edges,
      outcome: evaluated.outcome,
      ...(evaluated.closure === undefined ? {} : { closure: evaluated.closure }),
    });
  }

  const accepted = perPath
    .filter((item) => item.outcome.status === 'VALID' && item.closure?.status === 'SATISFIED')
    .map((item) => item.key)
    .sort(compareStrings);
  if (accepted.length > 0) {
    return { ok: true, result: { kind: 'eligible', accepted, perPath } };
  }
  if (paths.length === 0) {
    return { ok: true, result: { kind: 'no-path' } };
  }
  if (perPath.some((item) => item.closure?.status === 'UNSATISFIED')) {
    return { ok: true, result: { kind: 'failure', code: 'ERR_MERGE_BRANCH_UNSATISFIED', perPath } };
  }
  if (perPath.some((item) => item.outcome.status === 'CONTESTED')) {
    return { ok: true, result: { kind: 'contested', perPath } };
  }
  return {
    ok: true,
    result: { kind: 'failure', code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED', perPath },
  };
}
