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
type FieldKind = 'string' | 'timestamp' | 'string_array' | 'decision' | 'state';

function invalid(path: string, message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', `${path}: ${message}`) };
}

function firstUnknownField(object: JsonObject, allowed: readonly string[]): string | undefined {
  return Object.keys(object).find((key) => !allowed.includes(key));
}

function readField(object: JsonObject, key: string, path: string, kind: FieldKind): Result<JsonValue> {
  const value = object[key];
  if (kind === 'string') {
    return typeof value === 'string' ? { ok: true, value } : invalid(path, 'expected string');
  }
  if (kind === 'timestamp') {
    return typeof value === 'number' && Number.isFinite(value)
      ? { ok: true, value }
      : invalid(path, 'expected finite timestamp');
  }
  if (kind === 'string_array') {
    if (!Array.isArray(value)) {
      return invalid(path, 'expected array of strings');
    }
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') {
        return invalid(path, 'expected array of strings');
      }
      out.push(item);
    }
    return { ok: true, value: out };
  }
  if (kind === 'decision') {
    return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value)
      ? { ok: true, value }
      : invalid(path, `expected one of: ${DECISIONS.join(', ')}`);
  }
  return typeof value === 'string' && (STATES as readonly string[]).includes(value)
    ? { ok: true, value }
    : invalid(path, `expected one of: ${STATES.join(', ')}`);
}

function readObject(value: unknown): Result<JsonObject> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  if (typeof json.value !== 'object' || json.value === null || Array.isArray(json.value)) {
    return invalid('$', 'expected object');
  }
  return { ok: true, value: json.value as JsonObject };
}

/** Validates an untrusted §9.1 acceptance record into an owned frozen copy. */
export function createLocalAcceptanceRecord(value: unknown): Result<DeepReadonly<LocalAcceptanceRecord>> {
  const object = readObject(value);
  if (!object.ok) return object;
  const unknown = firstUnknownField(object.value, ACCEPTANCE_FIELDS);
  if (unknown !== undefined) return invalid(`$.${unknown}`, 'unknown field');

  const acceptanceId = readField(object.value, 'acceptance_id', '$.acceptance_id', 'string');
  if (!acceptanceId.ok) return acceptanceId;
  const subject = readField(object.value, 'subject_version_id', '$.subject_version_id', 'string');
  if (!subject.ok) return subject;
  const domain = readField(object.value, 'accepting_domain', '$.accepting_domain', 'string');
  if (!domain.ok) return domain;
  const context = readField(object.value, 'context_scope', '$.context_scope', 'string');
  if (!context.ok) return context;
  const grounding = readField(object.value, 'grounding_assessments', '$.grounding_assessments', 'string_array');
  if (!grounding.ok) return grounding;
  const decision = readField(object.value, 'decision', '$.decision', 'decision');
  if (!decision.ok) return decision;
  const policy = readField(object.value, 'policy_rule_ref', '$.policy_rule_ref', 'string');
  if (!policy.ok) return policy;
  const principal = readField(object.value, 'decided_by_principal', '$.decided_by_principal', 'string');
  if (!principal.ok) return principal;
  const decidedAt = readField(object.value, 'decided_at', '$.decided_at', 'timestamp');
  if (!decidedAt.ok) return decidedAt;

  const record: LocalAcceptanceRecord = {
    acceptance_id: acceptanceId.value as AcceptanceID,
    subject_version_id: subject.value as IdentityVersionID,
    accepting_domain: domain.value as DomainID,
    context_scope: context.value as string,
    grounding_assessments: grounding.value as AssessmentID[],
    decision: decision.value as AcceptanceDecision,
    policy_rule_ref: policy.value as string,
    decided_by_principal: principal.value as string,
    decided_at: decidedAt.value as Timestamp,
  };
  return { ok: true, value: deepFreeze(record) };
}

/** Validates an untrusted §9.3 lifecycle event into an owned frozen copy. */
export function createLocalAcceptanceLifecycleEvent(
  value: unknown,
): Result<DeepReadonly<LocalAcceptanceLifecycleEvent>> {
  const object = readObject(value);
  if (!object.ok) return object;
  const unknown = firstUnknownField(object.value, EVENT_FIELDS);
  if (unknown !== undefined) return invalid(`$.${unknown}`, 'unknown field');

  const eventId = readField(object.value, 'event_id', '$.event_id', 'string');
  if (!eventId.ok) return eventId;
  const acceptanceId = readField(object.value, 'acceptance_id', '$.acceptance_id', 'string');
  if (!acceptanceId.ok) return acceptanceId;
  const newState = readField(object.value, 'new_state', '$.new_state', 'state');
  if (!newState.ok) return newState;
  const reason = readField(object.value, 'transition_reason', '$.transition_reason', 'string');
  if (!reason.ok) return reason;
  const evidence = readField(object.value, 'evidence_refs', '$.evidence_refs', 'string_array');
  if (!evidence.ok) return evidence;
  const effectiveAt = readField(object.value, 'effective_at', '$.effective_at', 'timestamp');
  if (!effectiveAt.ok) return effectiveAt;

  const event: LocalAcceptanceLifecycleEvent = {
    event_id: eventId.value as string,
    acceptance_id: acceptanceId.value as AcceptanceID,
    new_state: newState.value as AcceptanceLifecycleState,
    transition_reason: reason.value as string,
    evidence_refs: evidence.value as string[],
    effective_at: effectiveAt.value as Timestamp,
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
