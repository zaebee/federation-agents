import { describe, expect, test } from 'bun:test';
import type {
  AcceptanceApplicabilityPolicy,
  AcceptanceLifecycleState,
  LifecyclePolicy,
  LifecyclePolicyInput,
  LocalAcceptanceRecord,
} from '../../src/core/acceptance.js';
import {
  applyLifecycle,
  createLocalAcceptanceLifecycleEvent,
  createLocalAcceptanceRecord,
  isAcceptable,
} from '../../src/core/acceptance.js';
import { appendAcceptance, appendLifecycleEvent, createAcceptanceLedger } from '../../src/core/ledger.js';
import { acceptanceId, assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import type { TemporalContext } from '../../src/core/temporal.js';
import { BASE_TIME } from '../support/fixtures.js';
import {
  acceptanceQuery,
  acceptanceRecord,
  applicabilityPolicy,
  lifecycleEvent,
  lifecyclePolicy,
} from '../support/acceptance.js';

function expectOk<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected success');
  }
  return result.value;
}

function rawAcceptance(overrides: Record<string, unknown> = {}) {
  return {
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
  };
}

const ctx = {
  basis: 'DECIDED_AT',
  declared: { DECIDED_AT: timestamp(BASE_TIME) },
  trust: {},
} as const;

describe('LocalAcceptanceRecord construction', () => {
  test('builds ACCEPTED and REJECTED decisions as frozen owned records', () => {
    const accepted = acceptanceRecord();
    const rejected = acceptanceRecord({
      acceptance_id: acceptanceId('accept-2'),
      decision: 'REJECTED',
    });

    expect(accepted.decision).toBe('ACCEPTED');
    expect(rejected.decision).toBe('REJECTED');
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.grounding_assessments)).toBe(true);
  });

  test('rejects missing, invalid and unknown fields', () => {
    const missing = rawAcceptance();
    delete (missing as { decided_at?: unknown }).decided_at;
    expect(createLocalAcceptanceRecord(missing).ok).toBe(false);

    expect(createLocalAcceptanceRecord(rawAcceptance({ decision: 'MAYBE' })).ok).toBe(false);
    expect(createLocalAcceptanceRecord(rawAcceptance({ unknown: true })).ok).toBe(false);
    expect(createLocalAcceptanceRecord(rawAcceptance({ grounding_assessments: ['a-1', 2] })).ok).toBe(false);
    expect(createLocalAcceptanceRecord(rawAcceptance({ grounding_assessments: 'a-1' })).ok).toBe(false);
  });

  test('rejects unsupported structures and caller mutation cannot reach the record', () => {
    expect(createLocalAcceptanceRecord(null).ok).toBe(false);
    expect(createLocalAcceptanceRecord(() => undefined).ok).toBe(false);
    expect(createLocalAcceptanceRecord(new Map()).ok).toBe(false);

    const source = rawAcceptance();
    const record = expectOk(createLocalAcceptanceRecord(source));
    const before = JSON.stringify(record);
    source.context_scope = 'mutated';
    (source.grounding_assessments as unknown as string[]).push('a-2');

    expect(JSON.stringify(record)).toBe(before);
  });

  test('deep freeze prevents nested mutation', () => {
    const record = acceptanceRecord();
    expect(() => {
      (record.grounding_assessments as unknown as string[]).push('a-2');
    }).toThrow();
  });
});

describe('LocalAcceptanceLifecycleEvent construction', () => {
  test('accepts every normative lifecycle state', () => {
    const states: readonly AcceptanceLifecycleState[] = ['ACTIVE', 'SUSPENDED', 'REINSTATED', 'REVOKED', 'EXPIRED'];
    for (const state of states) {
      expect(lifecycleEvent({ new_state: state }).new_state).toBe(state);
    }
  });

  test('rejects unknown fields, invalid state, timestamp and evidence refs', () => {
    const invalid = [
      { ...lifecycleEvent(), unknown: true },
      { ...lifecycleEvent(), new_state: 'DELETED' },
      { ...lifecycleEvent(), effective_at: 'later' },
      { ...lifecycleEvent(), evidence_refs: 'evidence-1' },
      { ...lifecycleEvent(), evidence_refs: ['evidence-1', 2] },
      { ...lifecycleEvent(), transition_reason: undefined },
    ];

    for (const value of invalid) {
      expect(createLocalAcceptanceLifecycleEvent(value).ok).toBe(false);
    }
  });

  test('event ownership is frozen', () => {
    const event = lifecycleEvent();
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.evidence_refs)).toBe(true);
  });
});

describe('applyLifecycle policy boundary', () => {
  test('explicit policy accepts a transition relative to previous state', () => {
    let observed: LifecyclePolicyInput | undefined;
    const policy: LifecyclePolicy = {
      allowsTransition: (input) => {
        observed = input;
        return input.previousState === 'ACTIVE' && input.event.new_state === 'SUSPENDED';
      },
    };

    const result = expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', ctx, policy));

    expect(result).toEqual({ status: 'TRANSITIONED', state: 'SUSPENDED' });
    expect(observed?.previousState).toBe('ACTIVE');
    expect(observed?.basis).toBe('DECIDED_AT');
    expect(observed?.declaredAt).toBe(timestamp(BASE_TIME));
    expect(observed?.effectiveAt).toBe(timestamp(BASE_TIME + 10));
  });

  test('explicit policy can reject a transition and different policies can disagree', () => {
    const allow = lifecyclePolicy({ allowsTransition: () => true });
    const deny = lifecyclePolicy({ allowsTransition: () => false });

    expect(expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', ctx, allow))).toEqual({
      status: 'TRANSITIONED',
      state: 'SUSPENDED',
    });
    expect(expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', ctx, deny))).toEqual({
      status: 'REJECTED',
      previousState: 'ACTIVE',
      proposedState: 'SUSPENDED',
    });
  });

  test('missing policy is POLICY_REQUIRED, not allow-all or deny-all', () => {
    expect(expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', ctx))).toEqual({
      status: 'POLICY_REQUIRED',
    });
  });

  test('event for another acceptance is a mechanism failure', () => {
    const disconnected = lifecycleEvent({ acceptance_id: acceptanceId('accept-2') });
    expect(applyLifecycle(acceptanceRecord(), disconnected, 'ACTIVE', ctx, lifecyclePolicy()).ok).toBe(false);
  });

  test('throwing policy is a mechanism failure, not REJECTED', () => {
    const policy: LifecyclePolicy = {
      allowsTransition: () => {
        throw new Error('policy crashed');
      },
    };
    const result = applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', ctx, policy);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('TemporalContext basis selects the declared timestamp exposed to policy', () => {
    let observed: LifecyclePolicyInput | undefined;
    const policy = lifecyclePolicy({
      allowsTransition: (input) => {
        observed = input;
        return true;
      },
    });
    const decidedCtx = { basis: 'DECIDED_AT', declared: { DECIDED_AT: timestamp(BASE_TIME) }, trust: {} } as const;
    const assertedCtx = {
      basis: 'ASSERTED_AT',
      declared: { ASSERTED_AT: timestamp(BASE_TIME + 5) },
      trust: {},
    } as const;

    expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', decidedCtx, policy));
    expect(observed?.basis).toBe('DECIDED_AT');
    expect(observed?.declaredAt).toBe(timestamp(BASE_TIME));

    expectOk(applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', assertedCtx, policy));
    expect(observed?.basis).toBe('ASSERTED_AT');
    expect(observed?.declaredAt).toBe(timestamp(BASE_TIME + 5));
  });

  test('presence of trust input is not converted into a trusted decision', () => {
    const untrustedCtx = {
      basis: 'DECIDED_AT',
      declared: { DECIDED_AT: timestamp(BASE_TIME) },
      trust: {
        'accept-1': {
          DECIDED_AT: { status: 'UNAVAILABLE', reason: 'no time source' },
        },
      },
    } as unknown as TemporalContext;

    const result = expectOk(
      applyLifecycle(acceptanceRecord(), lifecycleEvent(), 'ACTIVE', untrustedCtx, lifecyclePolicy()),
    );
    expect(result).toEqual({ status: 'TRANSITIONED', state: 'SUSPENDED' });
  });
});

describe('isAcceptable contextual query', () => {
  test('applies only for matching domain, context, subject and explicit policy', () => {
    const record = acceptanceRecord();
    expect(expectOk(isAcceptable(record, 'ACTIVE', acceptanceQuery(), ctx, applicabilityPolicy()))).toEqual({
      status: 'APPLICABLE',
    });
  });

  test('REJECTED decision is not applicable regardless of policy', () => {
    const record = acceptanceRecord({ decision: 'REJECTED' });
    const policy: AcceptanceApplicabilityPolicy = { isApplicable: () => true };
    expect(expectOk(isAcceptable(record, 'ACTIVE', acceptanceQuery(), ctx, policy))).toEqual({
      status: 'NOT_APPLICABLE',
      reason: 'DECISION_REJECTED',
    });
  });

  test('another domain, context or subject is not automatically applicable', () => {
    const record = acceptanceRecord();
    expect(
      expectOk(
        isAcceptable(
          record,
          'ACTIVE',
          acceptanceQuery({ accepting_domain: domainId('domain-b') }),
          ctx,
          applicabilityPolicy(),
        ),
      ),
    ).toEqual({ status: 'NOT_APPLICABLE', reason: 'DOMAIN_MISMATCH' });
    expect(
      expectOk(isAcceptable(record, 'ACTIVE', acceptanceQuery({ context_scope: 'other' }), ctx, applicabilityPolicy())),
    ).toEqual({ status: 'NOT_APPLICABLE', reason: 'CONTEXT_MISMATCH' });
    expect(
      expectOk(
        isAcceptable(
          record,
          'ACTIVE',
          acceptanceQuery({ subject_version_id: identityVersionId('iv-other') }),
          ctx,
          applicabilityPolicy(),
        ),
      ),
    ).toEqual({ status: 'NOT_APPLICABLE', reason: 'SUBJECT_MISMATCH' });
  });

  test('policy rejection and policy absence are explicit outcomes', () => {
    const record = acceptanceRecord();
    expect(
      expectOk(
        isAcceptable(record, 'ACTIVE', acceptanceQuery(), ctx, applicabilityPolicy({ isApplicable: () => false })),
      ),
    ).toEqual({ status: 'NOT_APPLICABLE', reason: 'POLICY_REJECTED' });
    expect(expectOk(isAcceptable(record, 'ACTIVE', acceptanceQuery(), ctx))).toEqual({
      status: 'POLICY_REQUIRED',
    });
  });

  test('ACTIVE is not implicitly applicable and lifecycle state is given to policy', () => {
    let observedState: AcceptanceLifecycleState | undefined;
    const policy: AcceptanceApplicabilityPolicy = {
      isApplicable: (input) => {
        observedState = input.state;
        return input.state === 'ACTIVE';
      },
    };

    expect(expectOk(isAcceptable(acceptanceRecord(), 'SUSPENDED', acceptanceQuery(), ctx, policy))).toEqual({
      status: 'NOT_APPLICABLE',
      reason: 'POLICY_REJECTED',
    });
    expect(observedState).toBe('SUSPENDED');
  });

  test('throwing applicability policy is a mechanism failure', () => {
    const policy: AcceptanceApplicabilityPolicy = {
      isApplicable: () => {
        throw new Error('policy crashed');
      },
    };
    const result = isAcceptable(acceptanceRecord(), 'ACTIVE', acceptanceQuery(), ctx, policy);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
  });
});

describe('acceptance ledger mechanism', () => {
  test('stores decisions and events separately with copy-on-write appends', () => {
    const empty = createAcceptanceLedger();
    const record = acceptanceRecord();
    const withRecord = expectOk(appendAcceptance(empty, record));
    const event = lifecycleEvent();
    const withEvent = expectOk(appendLifecycleEvent(withRecord, event));

    expect(empty.acceptances()).toEqual([]);
    expect(withRecord.acceptances()).toHaveLength(1);
    expect(withRecord.lifecycleEvents()).toEqual([]);
    expect(withEvent.acceptances()).toHaveLength(1);
    expect(withEvent.lifecycleEvents()).toEqual([event]);
    expect(withEvent.acceptances()[0]).not.toBe(record);
    expect(JSON.stringify(withEvent.acceptances()[0])).toBe(JSON.stringify(record));
    expect(Object.isFrozen(withEvent.acceptances())).toBe(true);
    expect(Object.isFrozen(withEvent.lifecycleEvents())).toBe(true);
  });

  test('unknown acceptance events and duplicate acceptance ids are rejected', () => {
    const ledger = expectOk(appendAcceptance(createAcceptanceLedger(), acceptanceRecord()));
    expect(appendLifecycleEvent(createAcceptanceLedger(), lifecycleEvent()).ok).toBe(false);
    expect(appendLifecycleEvent(ledger, lifecycleEvent({ acceptance_id: acceptanceId('accept-2') })).ok).toBe(false);
    expect(appendAcceptance(ledger, acceptanceRecord()).ok).toBe(false);
  });

  test('repeated events are not deduplicated', () => {
    const ledger = expectOk(appendAcceptance(createAcceptanceLedger(), acceptanceRecord()));
    const once = expectOk(appendLifecycleEvent(ledger, lifecycleEvent()));
    const twice = expectOk(appendLifecycleEvent(once, lifecycleEvent()));
    expect(twice.lifecycleEvents()).toHaveLength(2);
  });

  test('caller mutation and returned collections cannot change ledger state', () => {
    const source = rawAcceptance();
    const record = expectOk(createLocalAcceptanceRecord(source));
    const ledger = expectOk(appendAcceptance(createAcceptanceLedger(), record));
    const snapshot = JSON.stringify(ledger.acceptances());

    source.context_scope = 'mutated';
    expect(() => {
      (ledger.acceptances() as unknown as LocalAcceptanceRecord[]).push(record as unknown as LocalAcceptanceRecord);
    }).toThrow();
    expect(JSON.stringify(ledger.acceptances())).toBe(snapshot);
  });
});
