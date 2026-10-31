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
import { isBuiltLineageGraph } from './lineage.js';
import type { LineageGraph } from './lineage.js';
import type { DeepReadonly } from './ownership.js';
import { deepCopy, deepFreeze, validateJsonValue } from './ownership.js';
import type { AssessmentID, DomainID, IdentityVersionID, JsonValue, Timestamp } from './primitives.js';
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

const ASSESSMENT_FIELDS: readonly string[] = [
  'assessment_id',
  'supersedes_assessment_id',
  'subject_version_id',
  'parent_version_ids',
  'declared_relation',
  'assessment_profile_ref',
  'assessment_method_version',
  'verified_claims',
  'unverified_claims',
  'evidence_refs',
  'assessed_by',
  'assessed_at',
];

const ASSESSMENT_RELATIONS: readonly LineageRelationType[] = ['CONTINUATION', 'FORKED_FROM', 'MERGED_FROM'];

// Admission metadata, not claim semantics. This set says only that a claim
// cannot be admitted through the generic path without a contextual validator.
// It is never consulted by assessEdge, evaluateAssurance or Policy.
const CONTEXT_REQUIRED_CLAIMS: ReadonlySet<string> = new Set(['PARENT_UNRESOLVED']);

type JsonObject = { readonly [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: JsonValue | undefined, path: string): Result<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return mechanismRejection(`${path}: expected non-empty string`);
  }
  return { ok: true, value };
}

function requireStringArray(value: JsonValue | undefined, path: string, nonEmpty: boolean): Result<string[]> {
  if (!Array.isArray(value)) {
    return mechanismRejection(`${path}: expected array of strings`);
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || (nonEmpty && item.length === 0)) {
      return mechanismRejection(`${path}: expected array of strings`);
    }
    out.push(item);
  }
  return { ok: true, value: out };
}

function requireTimestamp(value: JsonValue | undefined, path: string): Result<Timestamp> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return mechanismRejection(`${path}: expected finite timestamp`);
  }
  return { ok: true, value: value as Timestamp };
}

/**
 * Validates an untrusted ContinuityAssessment and returns an owned, frozen
 * copy. This is generic structural validation: it does not interpret claim
 * semantics and does not consult a lineage graph.
 */
export function validateContinuityAssessment(value: unknown): Result<DeepReadonly<ContinuityAssessment>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  if (!isJsonObject(json.value)) {
    return mechanismRejection('ContinuityAssessment must be a plain object');
  }

  for (const key of Object.keys(json.value)) {
    if (!ASSESSMENT_FIELDS.includes(key)) {
      return mechanismRejection(`ContinuityAssessment.${key}: unknown field`);
    }
  }

  const assessmentIdValue = requireNonEmptyString(json.value.assessment_id, '$.assessment_id');
  if (!assessmentIdValue.ok) return assessmentIdValue;
  const subject = requireNonEmptyString(json.value.subject_version_id, '$.subject_version_id');
  if (!subject.ok) return subject;
  const profile = requireNonEmptyString(json.value.assessment_profile_ref, '$.assessment_profile_ref');
  if (!profile.ok) return profile;
  const method = requireNonEmptyString(json.value.assessment_method_version, '$.assessment_method_version');
  if (!method.ok) return method;
  const assessedBy = requireNonEmptyString(json.value.assessed_by, '$.assessed_by');
  if (!assessedBy.ok) return assessedBy;
  const assessedAt = requireTimestamp(json.value.assessed_at, '$.assessed_at');
  if (!assessedAt.ok) return assessedAt;

  const parents = requireStringArray(json.value.parent_version_ids, '$.parent_version_ids', true);
  if (!parents.ok) return parents;
  if (parents.value.length === 0) {
    return mechanismRejection('$.parent_version_ids: expected at least one parent');
  }
  if (new Set(parents.value).size !== parents.value.length) {
    return mechanismRejection('$.parent_version_ids: duplicate parent');
  }
  if (parents.value.includes(subject.value)) {
    return mechanismRejection('$.parent_version_ids: subject must not be its own parent');
  }

  const relation = json.value.declared_relation;
  if (typeof relation !== 'string' || !(ASSESSMENT_RELATIONS as readonly string[]).includes(relation)) {
    return mechanismRejection('$.declared_relation: expected CONTINUATION, FORKED_FROM or MERGED_FROM');
  }

  const verified = requireStringArray(json.value.verified_claims, '$.verified_claims', false);
  if (!verified.ok) return verified;
  const unverified = requireStringArray(json.value.unverified_claims, '$.unverified_claims', false);
  if (!unverified.ok) return unverified;
  const evidence = requireStringArray(json.value.evidence_refs, '$.evidence_refs', false);
  if (!evidence.ok) return evidence;

  let supersedes: AssessmentID | undefined;
  if (Object.hasOwn(json.value, 'supersedes_assessment_id')) {
    const supersedesValue = requireNonEmptyString(json.value.supersedes_assessment_id, '$.supersedes_assessment_id');
    if (!supersedesValue.ok) return supersedesValue;
    supersedes = supersedesValue.value as AssessmentID;
  }

  const base: ContinuityAssessment = {
    assessment_id: assessmentIdValue.value as AssessmentID,
    subject_version_id: subject.value as IdentityVersionID,
    parent_version_ids: parents.value.map((parent) => parent as IdentityVersionID),
    declared_relation: relation as LineageRelationType,
    assessment_profile_ref: profile.value,
    assessment_method_version: method.value,
    verified_claims: verified.value,
    unverified_claims: unverified.value,
    evidence_refs: evidence.value,
    assessed_by: assessedBy.value as DomainID,
    assessed_at: assessedAt.value,
  };
  const assessment = supersedes === undefined ? base : { ...base, supersedes_assessment_id: supersedes };
  return { ok: true, value: deepFreeze(assessment) };
}

function firstContextRequiredClaim(assessment: DeepReadonly<ContinuityAssessment>): string | undefined {
  for (const claim of assessment.verified_claims) {
    if (CONTEXT_REQUIRED_CLAIMS.has(claim)) return claim;
  }
  for (const claim of assessment.unverified_claims) {
    if (CONTEXT_REQUIRED_CLAIMS.has(claim)) return claim;
  }
  return undefined;
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

  const edge: EdgeRef = Object.freeze({
    child: edgeRef.child,
    parent: edgeRef.parent,
    relation: edgeRef.relation,
  });
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

function mapHasCycle(links: ReadonlyMap<AssessmentID, AssessmentID | undefined>, start: AssessmentID): boolean {
  const seen = new Set<AssessmentID>();
  let current: AssessmentID | undefined = start;
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
 * C-1 contextual validation. The Assessment is declaration-scoped: its parent
 * set must equal the complete declared parent set for the subject and relation,
 * and at least one of those parents must be absent from the local graph.
 *
 * This checks consistency with the supplied graph, not descriptor validity and
 * not §5.2 declaration cardinality.
 */
function validateOrphanAssessment(
  candidate: DeepReadonly<ContinuityAssessment>,
  graph: DeepReadonly<LineageGraph>,
): Result<void> {
  const subject = candidate.subject_version_id;
  if (!graph.nodes.includes(subject)) {
    return mechanismRejection('C-1 subject is not present in the graph');
  }

  const listed = candidate.parent_version_ids;
  if (listed.length === 0) {
    return mechanismRejection('C-1 assessment must list at least one parent');
  }
  if (new Set(listed).size !== listed.length) {
    return mechanismRejection('C-1 assessment has duplicate parents');
  }
  if (listed.includes(subject)) {
    return mechanismRejection('C-1 subject must not be its own parent');
  }

  const declared = new Set<IdentityVersionID>();
  for (const edge of graph.edges) {
    if (edge.child === subject && edge.relation === candidate.declared_relation) {
      declared.add(edge.parent);
    }
  }
  if (declared.size === 0) {
    return mechanismRejection('C-1 declaration has no parents for the declared relation');
  }
  if (listed.length !== declared.size || listed.some((parent) => !declared.has(parent))) {
    return mechanismRejection('C-1 parent set must equal the declared parent set for the relation');
  }

  const unresolved = listed.filter((parent) => !graph.nodes.includes(parent));
  if (unresolved.length === 0) {
    return mechanismRejection('C-1 declaration has no unresolved parent');
  }
  for (const parent of unresolved) {
    const recorded = graph.unresolvedParents.some(([child, parents]) => child === subject && parents.includes(parent));
    if (!recorded) {
      return mechanismRejection(`C-1 unresolved parent ${parent} is not recorded in the graph`);
    }
  }

  if (!candidate.unverified_claims.includes('PARENT_UNRESOLVED')) {
    return mechanismRejection('C-1 assessment must record PARENT_UNRESOLVED as unverified');
  }
  if (candidate.verified_claims.includes('PARENT_UNRESOLVED')) {
    return mechanismRejection('C-1 assessment must not record PARENT_UNRESOLVED as verified');
  }
  if (candidate.verified_claims.includes('CYCLE_DETECTED') || candidate.unverified_claims.includes('CYCLE_DETECTED')) {
    return mechanismRejection('C-1 assessment must not claim CYCLE_DETECTED');
  }

  return { ok: true, value: undefined };
}

/**
 * Core admission primitive. Validates duplicate IDs and supersession against
 * the complete prospective state, then returns one frozen representation.
 * Callers must supply already validated candidates.
 */
function admitAssessments(
  existing: readonly DeepReadonly<ContinuityAssessment>[],
  candidates: readonly DeepReadonly<ContinuityAssessment>[],
): Result<readonly DeepReadonly<ContinuityAssessment>[]> {
  if (!Array.isArray(existing) || !Array.isArray(candidates)) {
    return mechanismRejection('Assessment admission requires arrays');
  }

  for (const item of candidates) {
    if (item.supersedes_assessment_id === item.assessment_id) {
      return cycleRejection(item.assessment_id);
    }
  }

  const copiedExisting = deepCopy(existing);
  if (!copiedExisting.ok) {
    return copiedExisting;
  }
  const base = deepFreeze(copiedExisting.value);

  const baseIds = new Set<AssessmentID>();
  for (const item of base) {
    if (baseIds.has(item.assessment_id)) {
      return mechanismRejection(`Duplicate assessment_id in existing state: ${item.assessment_id}`);
    }
    baseIds.add(item.assessment_id);
  }

  const batchIds = new Set<AssessmentID>();
  for (const item of candidates) {
    if (baseIds.has(item.assessment_id) || batchIds.has(item.assessment_id)) {
      return mechanismRejection(`Duplicate assessment_id: ${item.assessment_id}`);
    }
    batchIds.add(item.assessment_id);
  }

  const allIds = new Set<AssessmentID>([...baseIds, ...batchIds]);
  for (const item of candidates) {
    if (item.supersedes_assessment_id !== undefined && !allIds.has(item.supersedes_assessment_id)) {
      return mechanismRejection(`Unknown supersedes_assessment_id: ${item.supersedes_assessment_id}`);
    }
  }

  const links = new Map<AssessmentID, AssessmentID | undefined>();
  for (const item of base) {
    links.set(item.assessment_id, item.supersedes_assessment_id);
  }
  for (const item of candidates) {
    links.set(item.assessment_id, item.supersedes_assessment_id);
  }

  for (const item of candidates) {
    if (mapHasCycle(links, item.assessment_id)) {
      return cycleRejection(item.assessment_id);
    }
  }

  return { ok: true, value: Object.freeze([...base, ...candidates]) };
}

/**
 * Registers a generic successor in a copy-on-write assessment list. Context-
 * required claims are rejected here because no contextual validator has run.
 */
export function registerAssessment(
  existing: readonly DeepReadonly<ContinuityAssessment>[],
  successor: unknown,
): Result<readonly DeepReadonly<ContinuityAssessment>[]> {
  const validated = validateContinuityAssessment(successor);
  if (!validated.ok) {
    return validated;
  }
  const required = firstContextRequiredClaim(validated.value);
  if (required !== undefined) {
    return mechanismRejection(`Claim ${required} requires contextual admission; use registerOrphanAssessments`);
  }
  return admitAssessments(existing, [validated.value]);
}

/**
 * C-1 atomic batch admission. All candidates are validated before any
 * representation is returned; one failure admits none.
 */
export function registerOrphanAssessments(
  candidates: readonly unknown[],
  graph: LineageGraph,
  existing: readonly DeepReadonly<ContinuityAssessment>[],
): Result<readonly DeepReadonly<ContinuityAssessment>[]> {
  if (!isBuiltLineageGraph(graph)) {
    return mechanismRejection('graph must be produced by buildLineageGraph');
  }
  if (!Array.isArray(candidates)) {
    return mechanismRejection('C-1 admission requires an array of candidates');
  }

  const validated: DeepReadonly<ContinuityAssessment>[] = [];
  for (const candidate of candidates) {
    const result = validateContinuityAssessment(candidate);
    if (!result.ok) {
      return result;
    }
    validated.push(result.value);
  }

  for (const candidate of validated) {
    const result = validateOrphanAssessment(candidate, graph);
    if (!result.ok) {
      return result;
    }
  }

  return admitAssessments(existing, validated);
}

/** Convenience wrapper for one C-1 candidate. */
export function registerOrphanAssessment(
  candidate: unknown,
  graph: LineageGraph,
  existing: readonly DeepReadonly<ContinuityAssessment>[],
): Result<readonly DeepReadonly<ContinuityAssessment>[]> {
  return registerOrphanAssessments([candidate], graph, existing);
}
