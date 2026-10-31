import { describe, expect, test } from 'bun:test';
import type { SignatureTemporalPolicy } from '../../src/core/credential.js';
import { evaluateCredentialUsage, evaluateHistoricalSignature } from '../../src/core/credential.js';
import { createRuntimeLifecycleEvent, createRuntimeRegistry, recordRuntimeEvent } from '../../src/core/runtime.js';
import { runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import { credential as credentialFixture, descriptor } from '../support/fixtures.js';
import {
  SIGNED_AT,
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
        }),
      ),
    );

    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
    expect(result.claim_status).not.toBe('CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE');
    expect(result.temporal.compromise_effective_at).toBeUndefined();
    expect(acceptCalls).toBe(0);
    expect(JSON.stringify(unknownTime)).not.toContain('compromise_effective_at');
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
