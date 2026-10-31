// Local Acceptance for UIA-CORE-001 §9 (Task 15).
//
// A LocalAcceptanceRecord is an immutable normative act. Lifecycle events are
// separate historical records; they never mutate the decision. Transition and
// applicability rules come only from explicitly supplied local policies.

import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze, validateJsonValue } from './ownership.js';
import type {
  AcceptanceID,
  AssessmentID,
  DomainID,
  IdentityVersionID,
  JsonValue,
  TemporalFieldRef,
  Timestamp,
} from './primitives.js';
import { validateTemporalFieldRef } from './primitives.js';
import type { TemporalContext } from './temporal.js';

export type AcceptanceDecision = 'ACCEPTED' | 'REJECTED';

export interface LocalAcceptanceRecord {
  acceptance_id: AcceptanceID;
  subject_version_id: IdentityVersionID;
  accepting_domain: DomainID;
  context_scope: string;
  grounding_assessments: AssessmentID[];
  decision: AcceptanceDecision;
  policy_rule_ref: string;
  decided_by_principal: string;
  decided_at: Timestamp;
}

export type AcceptanceLifecycleState = 'ACTIVE' | 'SUSPENDED' | 'REINSTATED' | 'REVOKED' | 'EXPIRED';

export interface LocalAcceptanceLifecycleEvent {
  event_id: string;
  acceptance_id: AcceptanceID;
  new_state: AcceptanceLifecycleState;
  transition_reason: string;
  evidence_refs: string[];
  effective_at: Timestamp;
}

export type LifecycleTransition =
  | { readonly status: 'TRANSITIONED'; readonly state: AcceptanceLifecycleState }
  | {
      readonly status: 'REJECTED';
      readonly previousState: AcceptanceLifecycleState;
      readonly proposedState: AcceptanceLifecycleState;
    }
  | { readonly status: 'POLICY_REQUIRED' };

export interface LifecyclePolicyInput {
  readonly record: DeepReadonly<LocalAcceptanceRecord>;
  readonly event: DeepReadonly<LocalAcceptanceLifecycleEvent>;
  readonly previousState: AcceptanceLifecycleState;
  readonly basis: TemporalFieldRef;
  readonly declaredAt?: Timestamp;
  readonly effectiveAt: Timestamp;
  readonly ctx: TemporalContext;
}

export interface LifecyclePolicy {
  allowsTransition(input: LifecyclePolicyInput): boolean;
}

export type AcceptanceNotApplicableReason =
  'DECISION_REJECTED' | 'DOMAIN_MISMATCH' | 'CONTEXT_MISMATCH' | 'SUBJECT_MISMATCH' | 'POLICY_REJECTED';

export type AcceptanceApplicability =
  | { readonly status: 'APPLICABLE' }
  | { readonly status: 'NOT_APPLICABLE'; readonly reason: AcceptanceNotApplicableReason }
  | { readonly status: 'POLICY_REQUIRED' };

export interface AcceptanceQuery {
  readonly subject_version_id: IdentityVersionID;
  readonly accepting_domain: DomainID;
  readonly context_scope: string;
}

export interface AcceptanceApplicabilityPolicyInput {
  readonly record: DeepReadonly<LocalAcceptanceRecord>;
  readonly state: AcceptanceLifecycleState;
  readonly query: AcceptanceQuery;
  readonly basis: TemporalFieldRef;
  readonly declaredAt?: Timestamp;
  readonly ctx: TemporalContext;
}

export interface AcceptanceApplicabilityPolicy {
  isApplicable(input: AcceptanceApplicabilityPolicyInput): boolean;
}

const ACCEPTANCE_FIELDS: readonly string[] = [
  'acceptance_id',
  'subject_version_id',
  'accepting_domain',
  'context_scope',
  'grounding_assessments',
  'decision',
  'policy_rule_ref',
  'decided_by_principal',
  'decided_at',
];

const EVENT_FIELDS: readonly string[] = [
  'event_id',
  'acceptance_id',
  'new_state',
  'transition_reason',
  'evidence_refs',
  'effective_at',
];

const DECISIONS: readonly AcceptanceDecision[] = ['ACCEPTED', 'REJECTED'];
const STATES: readonly AcceptanceLifecycleState[] = ['ACTIVE', 'SUSPENDED', 'REINSTATED', 'REVOKED', 'EXPIRED'];

type JsonObject = { readonly [key: string]: JsonValue };

function invalid(path: string, message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', `${path}: ${message}`) };
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: JsonValue | undefined, path: string): Result<JsonObject> {
  if (value === undefined || !isJsonObject(value)) {
    return invalid(path, 'expected object');
  }
  return { ok: true, value };
}

function requireString(value: JsonValue | undefined, path: string): Result<string> {
  if (typeof value !== 'string') {
    return invalid(path, 'expected string');
  }
  return { ok: true, value };
}

function requireTimestamp(value: JsonValue | undefined, path: string): Result<Timestamp> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return invalid(path, 'expected finite timestamp');
  }
  return { ok: true, value: value as Timestamp };
}

function requireStringArray(value: JsonValue | undefined, path: string): Result<string[]> {
  if (!Array.isArray(value)) {
    return invalid(path, 'expected array of strings');
  }
  const out: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = requireString(value[index], `${path}[${index}]`);
    if (!item.ok) return item;
    out.push(item.value);
  }
  return { ok: true, value: out };
}

function rejectUnknownFields(value: JsonObject, allowed: readonly string[], path: string): Result<void> {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return invalid(`${path}.${key}`, 'unknown field');
    }
  }
  return { ok: true, value: undefined };
}

/** Validates an untrusted §9.1 acceptance record into an owned frozen copy. */
export function createLocalAcceptanceRecord(value: unknown): Result<DeepReadonly<LocalAcceptanceRecord>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  const object = requireObject(json.value, '$');
  if (!object.ok) return object;
  const known = rejectUnknownFields(object.value, ACCEPTANCE_FIELDS, '$');
  if (!known.ok) return known;

  const acceptanceId = requireString(object.value.acceptance_id, '$.acceptance_id');
  if (!acceptanceId.ok) return acceptanceId;
  const subject = requireString(object.value.subject_version_id, '$.subject_version_id');
  if (!subject.ok) return subject;
  const domain = requireString(object.value.accepting_domain, '$.accepting_domain');
  if (!domain.ok) return domain;
  const context = requireString(object.value.context_scope, '$.context_scope');
  if (!context.ok) return context;
  const grounding = requireStringArray(object.value.grounding_assessments, '$.grounding_assessments');
  if (!grounding.ok) return grounding;
  const decision = requireString(object.value.decision, '$.decision');
  if (!decision.ok) return decision;
  if (!(DECISIONS as readonly string[]).includes(decision.value)) {
    return invalid('$.decision', `expected one of: ${DECISIONS.join(', ')}`);
  }
  const policy = requireString(object.value.policy_rule_ref, '$.policy_rule_ref');
  if (!policy.ok) return policy;
  const principal = requireString(object.value.decided_by_principal, '$.decided_by_principal');
  if (!principal.ok) return principal;
  const decidedAt = requireTimestamp(object.value.decided_at, '$.decided_at');
  if (!decidedAt.ok) return decidedAt;

  const record: LocalAcceptanceRecord = {
    acceptance_id: acceptanceId.value as AcceptanceID,
    subject_version_id: subject.value as IdentityVersionID,
    accepting_domain: domain.value as DomainID,
    context_scope: context.value,
    grounding_assessments: grounding.value as AssessmentID[],
    decision: decision.value as AcceptanceDecision,
    policy_rule_ref: policy.value,
    decided_by_principal: principal.value,
    decided_at: decidedAt.value,
  };
  return { ok: true, value: deepFreeze(record) };
}

/** Validates an untrusted §9.3 lifecycle event into an owned frozen copy. */
export function createLocalAcceptanceLifecycleEvent(
  value: unknown,
): Result<DeepReadonly<LocalAcceptanceLifecycleEvent>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  const object = requireObject(json.value, '$');
  if (!object.ok) return object;
  const known = rejectUnknownFields(object.value, EVENT_FIELDS, '$');
  if (!known.ok) return known;

  const eventId = requireString(object.value.event_id, '$.event_id');
  if (!eventId.ok) return eventId;
  const acceptanceId = requireString(object.value.acceptance_id, '$.acceptance_id');
  if (!acceptanceId.ok) return acceptanceId;
  const newState = requireString(object.value.new_state, '$.new_state');
  if (!newState.ok) return newState;
  if (!(STATES as readonly string[]).includes(newState.value)) {
    return invalid('$.new_state', `expected one of: ${STATES.join(', ')}`);
  }
  const reason = requireString(object.value.transition_reason, '$.transition_reason');
  if (!reason.ok) return reason;
  const evidence = requireStringArray(object.value.evidence_refs, '$.evidence_refs');
  if (!evidence.ok) return evidence;
  const effectiveAt = requireTimestamp(object.value.effective_at, '$.effective_at');
  if (!effectiveAt.ok) return effectiveAt;

  const event: LocalAcceptanceLifecycleEvent = {
    event_id: eventId.value,
    acceptance_id: acceptanceId.value as AcceptanceID,
    new_state: newState.value as AcceptanceLifecycleState,
    transition_reason: reason.value,
    evidence_refs: evidence.value,
    effective_at: effectiveAt.value,
  };
  return { ok: true, value: deepFreeze(event) };
}

function isState(value: unknown): value is AcceptanceLifecycleState {
  return typeof value === 'string' && (STATES as readonly string[]).includes(value);
}

function declaredAtFor(ctx: TemporalContext, basis: TemporalFieldRef): Timestamp | undefined {
  if (!Object.prototype.hasOwnProperty.call(ctx.declared, basis)) {
    return undefined;
  }
  return ctx.declared[basis];
}

function policyMechanism(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

/**
 * Evaluates a proposed transition against the explicitly supplied local policy.
 * Missing policy is POLICY_REQUIRED; a throwing policy is a mechanism failure.
 */
export function applyLifecycle(
  record: DeepReadonly<LocalAcceptanceRecord>,
  event: DeepReadonly<LocalAcceptanceLifecycleEvent>,
  previousState: AcceptanceLifecycleState,
  ctx: TemporalContext,
  policy?: LifecyclePolicy,
): Result<LifecycleTransition> {
  const validRecord = createLocalAcceptanceRecord(record);
  if (!validRecord.ok) return validRecord;
  const validEvent = createLocalAcceptanceLifecycleEvent(event);
  if (!validEvent.ok) return validEvent;
  if (!isState(previousState)) {
    return invalid('previousState', 'unknown lifecycle state');
  }
  if (validEvent.value.acceptance_id !== validRecord.value.acceptance_id) {
    return policyMechanism('Lifecycle event does not refer to the supplied acceptance record');
  }

  const validatedBasis = validateTemporalFieldRef(ctx.basis);
  if (!validatedBasis.ok) return validatedBasis;
  const declaredAt = declaredAtFor(ctx, validatedBasis.value);

  if (policy === undefined) {
    return { ok: true, value: { status: 'POLICY_REQUIRED' } };
  }
  if (typeof policy.allowsTransition !== 'function') {
    return policyMechanism('LifecyclePolicy.allowsTransition is required');
  }

  let allowed: boolean;
  try {
    allowed = policy.allowsTransition({
      record: validRecord.value,
      event: validEvent.value,
      previousState,
      basis: validatedBasis.value,
      ...(declaredAt === undefined ? {} : { declaredAt }),
      effectiveAt: validEvent.value.effective_at,
      ctx,
    });
  } catch (error) {
    return policyMechanism(
      `LifecyclePolicy.allowsTransition failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof allowed !== 'boolean') {
    return policyMechanism('LifecyclePolicy.allowsTransition must return a boolean');
  }
  if (!allowed) {
    return {
      ok: true,
      value: {
        status: 'REJECTED',
        previousState,
        proposedState: validEvent.value.new_state,
      },
    };
  }
  return { ok: true, value: { status: 'TRANSITIONED', state: validEvent.value.new_state } };
}

/**
 * Contextual applicability query. Lifecycle state is considered only through
 * the supplied policy; ACTIVE is not implicitly applicable.
 */
export function isAcceptable(
  record: DeepReadonly<LocalAcceptanceRecord>,
  state: AcceptanceLifecycleState,
  query: AcceptanceQuery,
  ctx: TemporalContext,
  policy?: AcceptanceApplicabilityPolicy,
): Result<AcceptanceApplicability> {
  const validRecord = createLocalAcceptanceRecord(record);
  if (!validRecord.ok) return validRecord;
  if (!isState(state)) {
    return invalid('state', 'unknown lifecycle state');
  }

  if (validRecord.value.decision === 'REJECTED') {
    return { ok: true, value: { status: 'NOT_APPLICABLE', reason: 'DECISION_REJECTED' } };
  }
  if (validRecord.value.accepting_domain !== query.accepting_domain) {
    return { ok: true, value: { status: 'NOT_APPLICABLE', reason: 'DOMAIN_MISMATCH' } };
  }
  if (validRecord.value.context_scope !== query.context_scope) {
    return { ok: true, value: { status: 'NOT_APPLICABLE', reason: 'CONTEXT_MISMATCH' } };
  }
  if (validRecord.value.subject_version_id !== query.subject_version_id) {
    return { ok: true, value: { status: 'NOT_APPLICABLE', reason: 'SUBJECT_MISMATCH' } };
  }

  const validatedBasis = validateTemporalFieldRef(ctx.basis);
  if (!validatedBasis.ok) return validatedBasis;
  const declaredAt = declaredAtFor(ctx, validatedBasis.value);

  if (policy === undefined) {
    return { ok: true, value: { status: 'POLICY_REQUIRED' } };
  }
  if (typeof policy.isApplicable !== 'function') {
    return policyMechanism('AcceptanceApplicabilityPolicy.isApplicable is required');
  }

  let applicable: boolean;
  try {
    applicable = policy.isApplicable({
      record: validRecord.value,
      state,
      query,
      basis: validatedBasis.value,
      ...(declaredAt === undefined ? {} : { declaredAt }),
      ctx,
    });
  } catch (error) {
    return policyMechanism(
      `AcceptanceApplicabilityPolicy.isApplicable failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof applicable !== 'boolean') {
    return policyMechanism('AcceptanceApplicabilityPolicy.isApplicable must return a boolean');
  }
  return applicable
    ? { ok: true, value: { status: 'APPLICABLE' } }
    : { ok: true, value: { status: 'NOT_APPLICABLE', reason: 'POLICY_REJECTED' } };
}
