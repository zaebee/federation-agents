/**
 * Comparison-only normalizer for production `BindingResult` values.
 * The oracle builds the same shape independently; this module is never
 * imported by the oracle.
 */
import type {
  BindingResult,
  MergeClosureResult,
  Path,
  PathOutcome,
  PathValidation,
} from '../../../src/core/traversal.js';
import type { EdgeTriple, NormalizedFailure, NormalizedPath, NormalizedResult } from './merge-oracle.js';
import { pathKey } from './merge-oracle.js';

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function edgesOf(path: Path): readonly EdgeTriple[] {
  return path.edges.map((edge) => [String(edge.child), String(edge.parent), edge.relation] as const);
}

function normalizeClosureFailure(
  failure: Extract<MergeClosureResult, { status: 'UNSATISFIED' }>['failures'][number],
): NormalizedFailure {
  const branch: EdgeTriple = [String(failure.branch.child), String(failure.branch.parent), failure.branch.relation];
  if (failure.reason === 'NO_APPLICABLE_ASSESSMENT') {
    return { branch, reason: failure.reason };
  }
  if (failure.reason === 'ASSURANCE_UNSATISFIED') {
    return { branch, reason: failure.reason, missing: failure.missing, disallowed: failure.disallowed };
  }
  return { branch, reason: failure.reason, contestedClaims: failure.contestedClaims };
}

function normalizeClosure(closure: MergeClosureResult): NonNullable<NormalizedPath['closure']> {
  if (closure.status === 'SATISFIED') {
    return { status: 'SATISFIED' };
  }
  return {
    status: 'UNSATISFIED',
    code: closure.code,
    failures: closure.failures.map(normalizeClosureFailure),
  };
}

function normalizeOutcome(outcome: PathValidation): NormalizedPath['outcome'] {
  if (outcome.status === 'VALID') {
    return { status: 'VALID' };
  }
  if (outcome.status === 'INVALID') {
    return {
      status: 'INVALID',
      code: outcome.code,
      missing: outcome.missing,
      disallowed: outcome.disallowed,
    };
  }
  if (outcome.status === 'CONTESTED') {
    return { status: 'CONTESTED', contestedClaims: outcome.contestedClaims };
  }
  return { status: 'CYCLE_DETECTED', code: outcome.code };
}

export function normalizePathOutcome(item: PathOutcome): NormalizedPath {
  const edges = edgesOf(item.path);
  return {
    key: pathKey(item.path.scope, edges),
    scope: item.path.scope,
    edges,
    outcome: normalizeOutcome(item.outcome),
    ...(item.closure === undefined ? {} : { closure: normalizeClosure(item.closure) }),
  };
}

export function normalizeProduction(result: BindingResult): NormalizedResult {
  if (result.eligible) {
    const perPath = result.details.perPath
      .map(normalizePathOutcome)
      .sort((left, right) => compareStrings(left.key, right.key));
    return {
      kind: 'eligible',
      accepted: result.acceptedPaths.map((path) => pathKey(path.scope, edgesOf(path))).sort(compareStrings),
      perPath,
    };
  }
  if ('kind' in result) {
    if (result.kind === 'MECHANISM') {
      return { kind: 'mechanism', message: result.error.message };
    }
    return {
      kind: 'contested',
      perPath: result.details.perPath
        .map(normalizePathOutcome)
        .sort((left, right) => compareStrings(left.key, right.key)),
    };
  }
  if (result.code === 'ERR_NO_TRAVERSAL_PATH') {
    return { kind: 'no-path' };
  }
  return {
    kind: 'failure',
    code: result.code,
    perPath: (result.details.perPath ?? [])
      .map(normalizePathOutcome)
      .sort((left, right) => compareStrings(left.key, right.key)),
  };
}

/** Canonical failure order: child, parent, relation. */
export function canonicalFailureKeys(closure: Extract<MergeClosureResult, { status: 'UNSATISFIED' }>): string[] {
  return closure.failures
    .map((failure) => `${String(failure.branch.child)}|${String(failure.branch.parent)}|${failure.branch.relation}`)
    .sort(compareStrings);
}
