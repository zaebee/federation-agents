import type {
  AcceptanceApplicabilityPolicy,
  AcceptanceQuery,
  LifecyclePolicy,
  LocalAcceptanceLifecycleEvent,
  LocalAcceptanceRecord,
} from '../../src/core/acceptance.js';
import { createLocalAcceptanceLifecycleEvent, createLocalAcceptanceRecord } from '../../src/core/acceptance.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import { acceptanceId, assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import { BASE_TIME } from './fixtures.js';

export function acceptanceRecord(overrides: Partial<LocalAcceptanceRecord> = {}): DeepReadonly<LocalAcceptanceRecord> {
  const result = createLocalAcceptanceRecord({
    acceptance_id: acceptanceId('accept-1'),
    subject_version_id: identityVersionId('iv-a-1'),
    accepting_domain: domainId('domain-a'),
    context_scope: 'default',
    grounding_assessments: [assessmentId('a-1')],
    decision: 'ACCEPTED',
    policy_rule_ref: 'policy-1',
    decided_by_principal: 'principal-a',
    decided_at: timestamp(BASE_TIME),
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`acceptance fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function lifecycleEvent(
  overrides: Partial<LocalAcceptanceLifecycleEvent> = {},
): DeepReadonly<LocalAcceptanceLifecycleEvent> {
  const result = createLocalAcceptanceLifecycleEvent({
    event_id: 'event-1',
    acceptance_id: acceptanceId('accept-1'),
    new_state: 'SUSPENDED',
    transition_reason: 'temporary suspension',
    evidence_refs: ['evidence-1'],
    effective_at: timestamp(BASE_TIME + 10),
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`lifecycle event fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function acceptanceQuery(overrides: Partial<AcceptanceQuery> = {}): AcceptanceQuery {
  return {
    subject_version_id: identityVersionId('iv-a-1'),
    accepting_domain: domainId('domain-a'),
    context_scope: 'default',
    ...overrides,
  };
}

export function lifecyclePolicy(overrides: Partial<LifecyclePolicy> = {}): LifecyclePolicy {
  return {
    allowsTransition: () => true,
    ...overrides,
  };
}

export function applicabilityPolicy(
  overrides: Partial<AcceptanceApplicabilityPolicy> = {},
): AcceptanceApplicabilityPolicy {
  return {
    isApplicable: () => true,
    ...overrides,
  };
}
