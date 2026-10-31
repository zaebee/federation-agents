// Assessment mechanism for UIA-CORE-001 §6 (Task 8).
//
// Scope: edge-bound applicability, assurance evaluation over trusted
// assessments, supersession registration, and a local policy hook. Traversal,
// merge closure and binding evaluation belong to Tasks 9–10.
//
// A-4b remains BLOCKED: no default contradiction rule exists. `CONTESTED` is
// reachable only through an explicitly configured Policy.conflictPredicate.

import type { LineageRelationType } from './entities.js';
import type { MechanismFailure, Result } from './errors.js';
import { mechanismFailure, specFailure } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import { deepCopy, deepFreeze } from './ownership.js';
import type { AssessmentID, DomainID, IdentityVersionID, Timestamp } from './primitives.js';
import type { TemporalContext } from './temporal.js';

export interface ContinuityAssessment {
  readonly assessment_id: AssessmentID;
  readonly supersedes_assessment_id?: AssessmentID;
  readonly subject_version_id: IdentityVersionID;
  readonly parent_version_ids: readonly IdentityVersionID[];
  readonly declared_relation: LineageRelationType;
  readonly assessment_profile_ref: string;
  readonly assessment_method_version: string;
  readonly verified_claims: readonly string[];
  readonly unverified_claims: readonly string[];
  readonly evidence_refs: readonly string[];
  readonly assessed_by: DomainID;
  readonly assessed_at: Timestamp;
}

export interface ContinuityAssuranceRequirement {
  readonly required_claims: readonly string[];
  readonly disallowed_claims?: readonly string[];
  readonly trusted_assessors?: readonly DomainID[];
}

export interface EdgeRef {
  readonly child: IdentityVersionID;
  readonly parent: IdentityVersionID;
  readonly relation: LineageRelationType;
}

export interface Policy {
  readonly trustedAssessorDefault?: readonly DomainID[];

  readonly applicableAssessments?: (
    edgeRef: EdgeRef,
    assessments: readonly DeepReadonly<ContinuityAssessment>[],
    ctx: TemporalContext,
  ) => readonly DeepReadonly<ContinuityAssessment>[];

  readonly conflictPredicate?: (
    left: DeepReadonly<ContinuityAssessment>,
    right: DeepReadonly<ContinuityAssessment>,
    edgeRef: EdgeRef,
    ctx: TemporalContext,
  ) => boolean;
}

const APPLICABLE_ASSESSMENTS_BRAND: unique symbol = Symbol('uia-ref-applicable-assessments');

// Runtime factory provenance, mirroring compiled selectors: the symbol brand is
// nominal typing only, while identity in this set proves assessEdge built the value.
const APPLICABLE_ASSESSMENTS: WeakSet<object> = new WeakSet<object>();

export interface ApplicableAssessments {
  readonly [APPLICABLE_ASSESSMENTS_BRAND]: true;
  readonly edge: EdgeRef;
  readonly assessments: readonly DeepReadonly<ContinuityAssessment>[];
  readonly unresolved: boolean;
}

export type AssuranceResult =
  | { readonly status: 'SATISFIED' }
  | {
      readonly status: 'UNSATISFIED';
      readonly code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED';
      readonly missing: readonly string[];
      readonly disallowed: readonly string[];
      readonly note: 'required-claim-not-verified; no-negative-finding-established';
    }
  | { readonly status: 'CONTESTED'; readonly contestedClaims: readonly string[] }
  | MechanismFailure;

const UNSATISFIED_NOTE = 'required-claim-not-verified; no-negative-finding-established' as const;

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareAssessments(
  left: DeepReadonly<ContinuityAssessment>,
  right: DeepReadonly<ContinuityAssessment>,
): number {
  return compareStrings(left.assessment_id, right.assessment_id);
}

function mechanismRejection(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function cycleRejection(assessmentId: AssessmentID): Result<never> {
  return {
    ok: false,
    error: specFailure('CYCLE_DETECTED', `Supersession chain containing ${assessmentId} would contain a cycle`),
  };
}

function appliesToEdge(assessment: DeepReadonly<ContinuityAssessment>, edge: EdgeRef): boolean {
  return (
    assessment.subject_version_id === edge.child &&
    assessment.declared_relation === edge.relation &&
    assessment.parent_version_ids.includes(edge.parent)
  );
}

function brandedApplicable(value: ApplicableAssessments): ApplicableAssessments {
  Object.defineProperty(value, APPLICABLE_ASSESSMENTS_BRAND, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  deepFreeze(value);
  APPLICABLE_ASSESSMENTS.add(value);
  return value;
}

/**
 * Computes the assessments applicable to one declared edge and applies policy
 * narrowing. The hook may only select members of the core-computed set; any
 * other item is discarded and never reaches assurance evaluation.
 */
export function assessEdge(
  edgeRef: EdgeRef,
  candidateAssessments: readonly ContinuityAssessment[],
  policy: Policy,
  ctx: TemporalContext,
): Result<ApplicableAssessments> {
  const copied = deepCopy(candidateAssessments);
  if (!copied.ok) {
    return copied;
  }

  const seenIds = new Set<AssessmentID>();
  for (const assessment of copied.value) {
    if (seenIds.has(assessment.assessment_id)) {
      return mechanismRejection(`Duplicate assessment_id in candidate assessments: ${assessment.assessment_id}`);
    }
    seenIds.add(assessment.assessment_id);
  }

  const edge: EdgeRef = {
    child: edgeRef.child,
    parent: edgeRef.parent,
    relation: edgeRef.relation,
  };
  const ordered = copied.value.filter((assessment) => appliesToEdge(assessment, edge)).sort(compareAssessments);
  const applicable = deepFreeze(ordered);
  const hook = policy.applicableAssessments;
  const narrowed = (hook === undefined ? applicable : narrowByPolicy(hook(edge, applicable, ctx), applicable))
    .slice()
    .sort(compareAssessments);

  const value = {
    edge,
    assessments: narrowed,
    unresolved: narrowed.length === 0,
  } as unknown as ApplicableAssessments;

  return { ok: true, value: brandedApplicable(value) };
}

/**
 * Accepts only members of the core-computed set. Items are matched by
 * assessment id against the core copy, so a hook cannot inject altered claims
 * under a known id; duplicates are dropped.
 */
function narrowByPolicy(
  selected: readonly DeepReadonly<ContinuityAssessment>[],
  applicable: readonly DeepReadonly<ContinuityAssessment>[],
): readonly DeepReadonly<ContinuityAssessment>[] {
  const coreById = new Map(applicable.map((assessment) => [assessment.assessment_id, assessment]));
  const accepted: DeepReadonly<ContinuityAssessment>[] = [];
  const seen = new Set<AssessmentID>();

  for (const candidate of selected) {
    const core = coreById.get(candidate.assessment_id);
    if (core === undefined || seen.has(core.assessment_id)) {
      continue;
    }
    seen.add(core.assessment_id);
    accepted.push(core);
  }

  return accepted;
}

function trustedAssessors(requirement: ContinuityAssuranceRequirement, policy: Policy): ReadonlySet<DomainID> {
  return new Set(requirement.trusted_assessors ?? policy.trustedAssessorDefault ?? []);
}

function differingClaims(
  left: DeepReadonly<ContinuityAssessment>,
  right: DeepReadonly<ContinuityAssessment>,
): string[] {
  const leftVerified = new Set(left.verified_claims);
  const rightVerified = new Set(right.verified_claims);
  const claims = new Set<string>();

  for (const claim of leftVerified) {
    if (!rightVerified.has(claim)) {
      claims.add(claim);
    }
  }
  for (const claim of rightVerified) {
    if (!leftVerified.has(claim)) {
      claims.add(claim);
    }
  }
  return [...claims];
}

/**
 * A-4b is BLOCKED: only an explicit predicate can declare a conflict. The
 * predicate defines why; `contestedClaims` is a diagnostic of verified claims
 * that differ between the pair, and may be empty when the predicate fires on
 * identical verified claim sets.
 */
function collectContestedClaims(
  assessments: readonly DeepReadonly<ContinuityAssessment>[],
  edge: EdgeRef,
  predicate: NonNullable<Policy['conflictPredicate']>,
  ctx: TemporalContext,
): string[] | undefined {
  const claims = new Set<string>();
  let contested = false;

  for (let left = 0; left < assessments.length; left += 1) {
    for (let right = left + 1; right < assessments.length; right += 1) {
      if (predicate(assessments[left], assessments[right], edge, ctx)) {
        contested = true;
        for (const claim of differingClaims(assessments[left], assessments[right])) {
          claims.add(claim);
        }
      }
    }
  }

  return contested ? [...claims].sort(compareStrings) : undefined;
}

/**
 * Evaluates an assurance requirement against assessments that must have been
 * produced by `assessEdge`. An unbranded value is rejected before any assurance
 * logic runs.
 */
export function evaluateAssurance(
  applicable: ApplicableAssessments,
  requirement: ContinuityAssuranceRequirement,
  policy: Policy,
  ctx: TemporalContext,
): AssuranceResult {
  if (applicable === null || typeof applicable !== 'object' || !APPLICABLE_ASSESSMENTS.has(applicable)) {
    return mechanismFailure(
      'E_APPLICABLE_ASSESSMENTS_UNBRANDED',
      'evaluateAssurance requires a value produced by assessEdge',
    );
  }

  const trusted = trustedAssessors(requirement, policy);
  const assessments = applicable.assessments.filter((assessment) => trusted.has(assessment.assessed_by));

  if (policy.conflictPredicate !== undefined) {
    const contestedClaims = collectContestedClaims(assessments, applicable.edge, policy.conflictPredicate, ctx);
    if (contestedClaims !== undefined) {
      return { status: 'CONTESTED', contestedClaims };
    }
  }

  const verified = new Set<string>();
  for (const assessment of assessments) {
    for (const claim of assessment.verified_claims) {
      verified.add(claim);
    }
  }

  const disallowedClaims = new Set(requirement.disallowed_claims ?? []);
  const missing = requirement.required_claims.filter((claim) => !verified.has(claim)).sort(compareStrings);
  const disallowed = [...verified].filter((claim) => disallowedClaims.has(claim)).sort(compareStrings);

  if (missing.length > 0 || disallowed.length > 0) {
    return {
      status: 'UNSATISFIED',
      code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
      missing,
      disallowed,
      note: UNSATISFIED_NOTE,
    };
  }

  return { status: 'SATISFIED' };
}

function closesSupersessionCycle(
  existing: readonly DeepReadonly<ContinuityAssessment>[],
  successor: DeepReadonly<ContinuityAssessment>,
): boolean {
  const links = new Map<AssessmentID, AssessmentID | undefined>();
  for (const assessment of existing) {
    links.set(assessment.assessment_id, assessment.supersedes_assessment_id);
  }
  links.set(successor.assessment_id, successor.supersedes_assessment_id);

  const seen = new Set<AssessmentID>();
  let current: AssessmentID | undefined = successor.assessment_id;
  while (current !== undefined) {
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = links.get(current);
  }
  return false;
}

/**
 * Registers a successor in a copy-on-write assessment list. A supersession
 * cycle is a normative rejection (`CYCLE_DETECTED`); existing records are never
 * mutated and there is no latest-wins selection.
 */
export function registerAssessment(
  existing: readonly DeepReadonly<ContinuityAssessment>[],
  successor: ContinuityAssessment,
): Result<readonly DeepReadonly<ContinuityAssessment>[]> {
  const copiedExisting = deepCopy(existing);
  if (!copiedExisting.ok) {
    return copiedExisting;
  }
  const registeredExisting = deepFreeze(copiedExisting.value);

  const copied = deepCopy(successor);
  if (!copied.ok) {
    return copied;
  }
  const registered = deepFreeze(copied.value);

  if (registered.supersedes_assessment_id === registered.assessment_id) {
    return cycleRejection(registered.assessment_id);
  }

  if (registeredExisting.some((item) => item.assessment_id === registered.assessment_id)) {
    return mechanismRejection(`Duplicate assessment_id: ${registered.assessment_id}`);
  }

  const predecessor = registered.supersedes_assessment_id;
  if (predecessor !== undefined && !registeredExisting.some((item) => item.assessment_id === predecessor)) {
    return mechanismRejection(`Unknown supersedes_assessment_id: ${predecessor}`);
  }

  if (closesSupersessionCycle(registeredExisting, registered)) {
    return cycleRejection(registered.assessment_id);
  }

  return { ok: true, value: Object.freeze([...registeredExisting, registered]) };
}
