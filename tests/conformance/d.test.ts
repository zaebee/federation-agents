import { describe, expect, test } from 'bun:test';
import type { FutureAuthorizationInput, SignatureTemporalPolicy } from '../../src/core/credential.js';
import { registerAssessment } from '../../src/core/assessment.js';
import { evaluateCredentialUsage, evaluateHistoricalSignature } from '../../src/core/credential.js';
import { appendAcceptance, createAcceptanceLedger } from '../../src/core/ledger.js';
import { createRuntimeLifecycleEvent, createRuntimeRegistry, recordRuntimeEvent } from '../../src/core/runtime.js';
import { acceptanceId, assessmentId, runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import { BASE_TIME, credential as credentialFixture, descriptor } from '../support/fixtures.js';
import { acceptanceRecord } from '../support/acceptance.js';
import {
  REVOKED_AT,
  SIGNED_AT,
  compromiseSubject,
  contextFor,
  expectD3Invalid,
  expectOk,
  identityBinding,
  revocationFixture,
  signedSubject,
  signingCredential,
  signaturePolicy,
  staticVerifier,
  trustInput,
} from '../support/credential.js';
import { assessmentRecord } from '../support/traversal.js';
import { runtimeDescriptor } from '../support/runtime.js';

const credential = signingCredential();
const binding = identityBinding();
const signedRef = signedSubject(credential, binding);
const revocation = revocationFixture();

function evaluate(revocationValue = revocation, policy: SignatureTemporalPolicy = signaturePolicy()) {
  return evaluateHistoricalSignature(
    {
      credential,
      requested_usage: 'SIGNING',
      signed_at: timestamp(SIGNED_AT),
      subject_binding: binding,
      revocation: revocationValue,
      policy,
      ctx: contextFor(),
    },
    staticVerifier({ status: 'VERIFIED' }),
  );
}

describe('§12 Category D: credential revocation', () => {
  test('D-3 retrospective confirmed compromise invalidates only the compromised claim', () => {
    const credentialSnapshot = JSON.stringify(credential);
    const revocationSnapshot = JSON.stringify(revocation);

    const result = expectOk(evaluate());

    expect(result.verification).toEqual({ status: 'VERIFIED' });
    expect(result.usage).toEqual({ status: 'PERMITTED', usage: 'SIGNING' });
    expectD3Invalid(result);

    expect(JSON.stringify(credential)).toBe(credentialSnapshot);
    expect(JSON.stringify(revocation)).toBe(revocationSnapshot);
    expect(Object.isFrozen(credential)).toBe(true);
    expect(Object.isFrozen(revocation)).toBe(true);
  });

  test('D-3 does not infer invalidity when either timestamp is untrusted', () => {
    const untrustedSigned = contextFor({
      signed: trustInput({
        field: 'SIGNED_AT',
        subject: signedRef,
        value: SIGNED_AT,
        trusted: false,
      }),
    });
    const result = expectOk(
      evaluateHistoricalSignature(
        {
          credential,
          requested_usage: 'SIGNING',
          signed_at: timestamp(SIGNED_AT),
          subject_binding: binding,
          revocation,
          policy: signaturePolicy(),
          ctx: untrustedSigned,
        },
        staticVerifier({ status: 'VERIFIED' }),
      ),
    );

    expect(result.historical).toEqual({
      status: 'TEMPORAL_TRUST_UNTRUSTED',
      fields: ['SIGNED_AT'],
    });
    expect(result.claim_status).toBeUndefined();
    expect(result.historical.status).not.toBe('INVALID');
  });

  test('D-3 evidence gate rejection yields CONTESTED_COMPROMISED, not INVALID', () => {
    const result = expectOk(evaluate(revocation, signaturePolicy({ acceptCompromiseTime: () => false })));

    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
  });

  test('D-4 unknown compromise time is contested and never inferred from revoked_at', () => {
    let acceptCalls = 0;
    let futureCalls = 0;
    let observed: FutureAuthorizationInput | undefined;
    const unknownTime = revocationFixture({
      reason: 'CONFIRMED_COMPROMISE',
      compromise_effective_at: undefined,
    });
    const result = expectOk(
      evaluate(
        unknownTime,
        signaturePolicy({
          acceptCompromiseTime: () => {
            acceptCalls += 1;
            return true;
          },
          evaluateFutureAuthorization: (input) => {
            futureCalls += 1;
            observed = input;
            return 'NOT_AUTHORIZABLE';
          },
        }),
      ),
    );

    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
    expect(result.claim_status).not.toBe('CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE');
    expect(result.temporal.compromise_effective_at).toBeUndefined();
    expect(result.revocation_reason).toBe('CONFIRMED_COMPROMISE');
    expect(result.reassessment_required).toBe(false);
    expect(result.usage).toEqual({ status: 'PERMITTED', usage: 'SIGNING' });
    expect(result.verification).toEqual({ status: 'VERIFIED' });
    expect(result.future_authorizable).toBe('NOT_AUTHORIZABLE');
    expect(acceptCalls).toBe(0);
    expect(futureCalls).toBe(1);

    expect(observed?.revocation_reason).toBe('CONFIRMED_COMPROMISE');
    expect(observed?.revocation?.revoked_at).toBe(timestamp(REVOKED_AT));
    expect(observed?.revocation?.compromise_effective_at).toBeUndefined();
    expect(observed?.temporal).toEqual({ signed_at: 'TRUSTED' });
    expect(observed?.reassessment_required).toBe(false);
    expect(observed?.usage).toEqual({ status: 'PERMITTED', usage: 'SIGNING' });
    expect(observed?.verification).toEqual({ status: 'VERIFIED' });

    expect(JSON.stringify(unknownTime)).not.toContain('compromise_effective_at');
  });

  // This test proves the historical/future separation and policy-context delivery only.
  // It does not prove that REQUIRES_ASSESSMENT is a sufficient additional normative
  // assessment, nor that an arbitrary future-authorization policy is correct.
  test('D-4 contested history does not become an automatic future authorization decision', () => {
    let futureCalls = 0;
    const unknownTime = revocationFixture({
      reason: 'CONFIRMED_COMPROMISE',
      compromise_effective_at: undefined,
    });
    const result = expectOk(
      evaluate(
        unknownTime,
        signaturePolicy({
          evaluateFutureAuthorization: () => {
            futureCalls += 1;
            return 'REQUIRES_ASSESSMENT';
          },
        }),
      ),
    );

    expect(futureCalls).toBe(1);
    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    // REQUIRES_ASSESSMENT is a policy outcome, not an execution authorization.
    expect(result.future_authorizable).toBe('REQUIRES_ASSESSMENT');
    expect(result.claim_status).toBeUndefined();
    expect(result.temporal.compromise_effective_at).toBeUndefined();
    expect(result).not.toHaveProperty('grant');
  });
});

function expectRuntimeOk<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected runtime operation to succeed');
  }
  return result.value;
}

describe('§12 Category D: runtime independence', () => {
  test('D-1 rt-1 failure is separate and rt-2 continues RUNNING', () => {
    const identity = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const rt1 = runtimeDescriptor('rt-1', 'iv-a-1');
    const rt2 = runtimeDescriptor('rt-2', 'iv-a-1');
    const registry = expectRuntimeOk(createRuntimeRegistry([rt1, rt2]));
    const signing = credentialFixture('cred-runtime', { usage: ['SIGNING'], not_before: timestamp(0) });

    const identityBefore = JSON.stringify(identity);
    const rt1Before = JSON.stringify(rt1);
    const rt2Before = JSON.stringify(rt2);
    const credentialBefore = JSON.stringify(signing);
    const usageBefore = evaluateCredentialUsage(signing, 'SIGNING');

    const event = expectRuntimeOk(createRuntimeLifecycleEvent({ runtime_instance_id: 'rt-1', kind: 'FAILURE' }));
    const updated = expectRuntimeOk(recordRuntimeEvent(registry, event));

    expect(updated.events()).toEqual([event]);
    expect(updated.stateOf(runtimeInstanceId('rt-2'))).toBe('RUNNING');
    expect(updated.stateOf(runtimeInstanceId('rt-1'))).toBe('RUNNING');
    expect(registry.events()).toEqual([]);
    expect(updated.runtimes().every((runtime) => runtime.identity_version_id === identity.id)).toBe(true);

    expect(JSON.stringify(updated.runtimes()[0])).toBe(rt1Before);
    expect(JSON.stringify(updated.runtimes()[1])).toBe(rt2Before);
    expect(JSON.stringify(identity)).toBe(identityBefore);
    expect(JSON.stringify(signing)).toBe(credentialBefore);
    expect(evaluateCredentialUsage(signing, 'SIGNING')).toEqual(usageBefore);
  });
});

describe('§12 Category D: historical Local Acceptance preservation', () => {
  test('D-2 later revocation and superseding assessment leave the Local Acceptance intact', () => {
    const identity = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
    const supporting = assessmentRecord({
      id: 'a-1',
      subject: 'iv-a-1',
      parents: ['iv-parent'],
      relation: 'CONTINUATION',
      verified: ['OK'],
    });
    const acceptance = acceptanceRecord({
      acceptance_id: acceptanceId('accept-d2'),
      grounding_assessments: [assessmentId('a-1')],
    });
    const ledger = expectRuntimeOk(appendAcceptance(createAcceptanceLedger(), acceptance));

    const acceptanceBefore = JSON.stringify(acceptance);
    const supportingBefore = JSON.stringify(supporting);
    const ledgerBefore = JSON.stringify({
      acceptances: ledger.acceptances(),
      events: ledger.lifecycleEvents(),
    });
    const identityBefore = JSON.stringify(identity);
    const credentialBefore = JSON.stringify(credential);

    // Later, independent operations: validate a new revocation and register
    // a superseding assessment. Task 13 evaluation consumes the revocation,
    // not the ContinuityAssessment; the assessment history is preserved here.
    const laterRevocation = revocationFixture({
      revoked_at: timestamp(BASE_TIME + 150),
      evidence_refs: ['d2-later'],
    });
    const superseding = {
      ...assessmentRecord({
        id: 'a-2',
        subject: 'iv-a-1',
        parents: ['iv-parent'],
        relation: 'CONTINUATION',
        unverified: ['OK'],
      }),
      supersedes_assessment_id: assessmentId('a-1'),
    };
    const history = expectRuntimeOk(registerAssessment([supporting], superseding));
    const fresh = expectOk(
      evaluateHistoricalSignature(
        {
          credential,
          requested_usage: 'SIGNING',
          signed_at: timestamp(SIGNED_AT),
          subject_binding: binding,
          revocation: laterRevocation,
          policy: signaturePolicy(),
          ctx: contextFor({ compromiseKey: compromiseSubject(laterRevocation) }),
        },
        staticVerifier({ status: 'VERIFIED' }),
      ),
    );

    expect(laterRevocation).not.toEqual(revocation);
    expect(Number(acceptance.decided_at)).toBeLessThan(Number(laterRevocation.revoked_at));
    expect(fresh.historical).toEqual({ status: 'INVALID' });
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(supporting);
    expect(history[1]).toEqual(superseding);

    expect(JSON.stringify(acceptance)).toBe(acceptanceBefore);
    expect(JSON.stringify(supporting)).toBe(supportingBefore);
    expect(
      JSON.stringify({
        acceptances: ledger.acceptances(),
        events: ledger.lifecycleEvents(),
      }),
    ).toBe(ledgerBefore);
    expect(ledger.acceptances()).toHaveLength(1);
    expect(String(ledger.acceptances()[0]?.acceptance_id)).toBe('accept-d2');
    expect(JSON.stringify(identity)).toBe(identityBefore);
    expect(JSON.stringify(credential)).toBe(credentialBefore);
  });
});
