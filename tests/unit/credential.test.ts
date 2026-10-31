import { describe, expect, test } from 'bun:test';
import type {
  FutureAuthorizationInput,
  HistoricalSignatureInput,
  SignatureTemporalPolicy,
  SignatureVerificationOutcome,
  SignatureVerifier,
} from '../../src/core/credential.js';
import {
  evaluateCredentialUsage,
  evaluateHistoricalSignature,
  revocationSubjectRef,
  signedAtSubjectRef,
  validateCredentialRevocationRecord,
} from '../../src/core/credential.js';
import { credentialId, runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import { trustOutcome } from '../../src/core/temporal.js';
import { credential } from '../support/fixtures.js';
import {
  COMPROMISE_AT,
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
  trustContext,
  trustInput,
} from '../support/credential.js';

const credentialValue = signingCredential();
const binding = identityBinding();
const revocation = revocationFixture();
const signedRef = signedSubject(credentialValue, binding);
const compromiseRef = compromiseSubject(revocation);

function evaluate(
  overrides: Partial<HistoricalSignatureInput> = {},
  verification: SignatureVerificationOutcome = { status: 'VERIFIED' },
  verifier: SignatureVerifier = staticVerifier(verification),
) {
  return evaluateHistoricalSignature(
    {
      credential: credentialValue,
      requested_usage: 'SIGNING',
      signed_at: timestamp(SIGNED_AT),
      subject_binding: binding,
      revocation,
      policy: signaturePolicy(),
      ctx: contextFor(),
      ...overrides,
    },
    verifier,
  );
}

describe('§4.4 credential revocation record', () => {
  test('validates and freezes all normative fields', () => {
    const record = revocationFixture({
      compromise_time_basis: 'EXTERNAL_EVIDENCE',
      compromise_time_evidence_refs: ['evidence-1'],
      evidence_refs: ['evidence-1', 'evidence-2'],
    });

    expect(record.reason).toBe('CONFIRMED_COMPROMISE');
    expect(record.compromise_effective_at).toBe(timestamp(COMPROMISE_AT));
    expect(record.compromise_time_basis).toBe('EXTERNAL_EVIDENCE');
    expect(record.evidence_refs).toEqual(['evidence-1', 'evidence-2']);
    expect(Object.isFrozen(record)).toBe(true);
  });

  test('rejects unknown fields instead of stripping them', () => {
    const result = validateCredentialRevocationRecord({
      credential_id: 'cred-1',
      revoked_by_domain: 'domain-a',
      revoked_at: REVOKED_AT,
      reason: 'ROTATION',
      evidence_refs: [],
      unknown: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('rejects a missing evidence_refs, an invalid reason and present-undefined optionals', () => {
    const missing = validateCredentialRevocationRecord({
      credential_id: 'cred-1',
      revoked_by_domain: 'domain-a',
      revoked_at: REVOKED_AT,
      reason: 'ROTATION',
    });
    expect(missing.ok).toBe(false);

    const invalidReason = validateCredentialRevocationRecord({
      credential_id: 'cred-1',
      revoked_by_domain: 'domain-a',
      revoked_at: REVOKED_AT,
      reason: 'UNKNOWN',
      evidence_refs: [],
    });
    expect(invalidReason.ok).toBe(false);

    const undefinedOptional = validateCredentialRevocationRecord({
      credential_id: 'cred-1',
      revoked_by_domain: 'domain-a',
      revoked_at: REVOKED_AT,
      reason: 'ROTATION',
      evidence_refs: [],
      compromise_time_basis: undefined,
    });
    expect(undefinedOptional.ok).toBe(false);
  });

  test('content-derived revocation subjects change with optional content', () => {
    const plain = revocationSubjectRef(revocation);
    const withEvidence = revocationSubjectRef(revocationFixture({ evidence_refs: ['evidence-1'] }));

    expect(plain.startsWith('revocation:sha256:')).toBe(true);
    expect(withEvidence).not.toBe(plain);
    expect(revocationSubjectRef(revocation)).toBe(plain);
  });
});

describe('§4.3 credential usage', () => {
  test('permits every declared usage', () => {
    const all = credential('cred-all', { usage: ['AUTHENTICATION', 'SIGNING', 'ENCRYPTION'] });

    for (const usage of ['AUTHENTICATION', 'SIGNING', 'ENCRYPTION'] as const) {
      expect(evaluateCredentialUsage(all, usage)).toEqual({ status: 'PERMITTED', usage });
    }
  });

  test('denies a known but undeclared usage', () => {
    expect(evaluateCredentialUsage(credentialValue, 'AUTHENTICATION')).toEqual({
      status: 'USAGE_DENIED',
      usage: 'AUTHENTICATION',
    });
  });

  test('reports an unknown usage value as unsupported', () => {
    expect(evaluateCredentialUsage(credentialValue, 'LOGIN')).toEqual({
      status: 'USAGE_UNSUPPORTED',
      usage: 'LOGIN',
    });
  });
});

describe('§10 temporal trust outcomes and subject binding', () => {
  test('maps ASSESSED, NOT_ASSESSED, UNAVAILABLE and missing entries exactly', () => {
    const ctx = trustContext({
      [signedRef]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: signedRef, value: SIGNED_AT, trusted: true }),
      },
      [`${signedRef}-false`]: {
        SIGNED_AT: trustInput({
          field: 'SIGNED_AT',
          subject: `${signedRef}-false`,
          value: SIGNED_AT,
          trusted: false,
        }),
      },
      [`${signedRef}-unavailable`]: { SIGNED_AT: { status: 'UNAVAILABLE', reason: 'no time source' } },
    });

    expect(trustOutcome(ctx, 'SIGNED_AT', signedRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUSTED',
    });
    expect(trustOutcome(ctx, 'SIGNED_AT', `${signedRef}-false`, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNTRUSTED',
    });
    expect(trustOutcome(ctx, 'SIGNED_AT', `${signedRef}-unknown`, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });
    expect(trustOutcome(ctx, 'SIGNED_AT', `${signedRef}-unavailable`, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUST_ASSESSMENT_UNAVAILABLE',
    });
  });

  test('treats any binding mismatch as TRUST_ASSESSMENT_UNAVAILABLE', () => {
    const matching = trustInput({ field: 'SIGNED_AT', subject: signedRef, value: SIGNED_AT, trusted: true });
    const byValue = trustContext({ [signedRef]: { SIGNED_AT: matching } });
    expect(trustOutcome(byValue, 'SIGNED_AT', signedRef, timestamp(SIGNED_AT + 1))).toEqual({
      ok: true,
      value: 'TRUST_ASSESSMENT_UNAVAILABLE',
    });

    const wrongSubject = trustContext({
      [signedRef]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: 'other-subject', value: SIGNED_AT, trusted: true }),
      },
    });
    expect(trustOutcome(wrongSubject, 'SIGNED_AT', signedRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUST_ASSESSMENT_UNAVAILABLE',
    });

    const wrongField = trustContext({
      [signedRef]: {
        SIGNED_AT: trustInput({ field: 'ASSESSED_AT', subject: signedRef, value: SIGNED_AT, trusted: true }),
      },
    });
    expect(trustOutcome(wrongField, 'SIGNED_AT', signedRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUST_ASSESSMENT_UNAVAILABLE',
    });
  });

  test('rejects malformed field refs but keeps standard and extension refs distinct', () => {
    const ctx = trustContext({});
    const invalid = trustOutcome(ctx, 'signed-at', signedRef, timestamp(SIGNED_AT));
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.error.code).toBe('E_TEMPORAL_FIELD_REF_INVALID');

    const exact = trustContext({
      [signedRef]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: signedRef, value: SIGNED_AT, trusted: true }),
        signed_at: trustInput({ field: 'signed_at', subject: signedRef, value: SIGNED_AT, trusted: false }),
      },
    });
    expect(trustOutcome(exact, 'SIGNED_AT', signedRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUSTED',
    });
    expect(trustOutcome(exact, 'signed_at', signedRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNTRUSTED',
    });
  });

  test('never reuses trust across credentials with the same signed_at value', () => {
    const credentialA = signingCredential('cred-a');
    const credentialB = signingCredential('cred-b');
    const subjectA = signedAtSubjectRef(credentialA, identityBinding('iv-a'));
    const subjectB = signedAtSubjectRef(credentialB, identityBinding('iv-b'));

    const ctx = trustContext({
      [subjectA]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: subjectA, value: SIGNED_AT, trusted: true }),
      },
      [subjectB]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: subjectB, value: SIGNED_AT, trusted: false }),
      },
    });

    expect(trustOutcome(ctx, 'SIGNED_AT', subjectA, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'TRUSTED',
    });
    expect(trustOutcome(ctx, 'SIGNED_AT', subjectB, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNTRUSTED',
    });

    const unassessed = trustContext({
      [subjectA]: { SIGNED_AT: { status: 'NOT_ASSESSED' } },
    });
    expect(trustOutcome(unassessed, 'SIGNED_AT', subjectB, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });

    const unavailable = trustContext({
      [subjectA]: { SIGNED_AT: { status: 'UNAVAILABLE', reason: 'time source' } },
    });
    expect(trustOutcome(unavailable, 'SIGNED_AT', subjectB, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });
  });

  test('subject references encode credential and binding components unambiguously', () => {
    const first = credential('a/runtime-instance:b', { usage: ['SIGNING'], not_before: timestamp(0) });
    const second = credential('a', { usage: ['SIGNING'], not_before: timestamp(0) });
    const firstRef = signedAtSubjectRef(first, {
      kind: 'RUNTIME_INSTANCE',
      runtime_instance_id: runtimeInstanceId('c'),
    });
    const secondRef = signedAtSubjectRef(second, {
      kind: 'RUNTIME_INSTANCE',
      runtime_instance_id: runtimeInstanceId('b/runtime-instance:c'),
    });

    expect(firstRef).not.toBe(secondRef);
    const ctx = trustContext({
      [firstRef]: {
        SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject: firstRef, value: SIGNED_AT, trusted: true }),
      },
    });
    expect(trustOutcome(ctx, 'SIGNED_AT', secondRef, timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });
  });

  test('own-property lookup ignores inherited Object.prototype fields', () => {
    const ctx = trustContext({ subject: {} });
    expect(trustOutcome(ctx, 'constructor', 'subject', timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });
    expect(trustOutcome(ctx, 'toString', 'subject', timestamp(SIGNED_AT))).toEqual({
      ok: true,
      value: 'UNASSESSED',
    });
  });

  test('a missing subject binding makes signed_at trust unavailable without inventing a subject', () => {
    const result = expectOk(evaluate({ subject_binding: undefined }));

    expect(result.temporal.signed_at).toBe('TRUST_ASSESSMENT_UNAVAILABLE');
    expect(result.historical).toEqual({
      status: 'TEMPORAL_TRUST_ASSESSMENT_UNAVAILABLE',
      fields: ['SIGNED_AT'],
    });
    expect(result.claim_status).toBeUndefined();
  });
});

describe('§4.1 verifier outcomes remain distinct', () => {
  test('maps INVALID, CRYPTO_UNAVAILABLE and CRYPTO_UNSUPPORTED without collapsing them', () => {
    const invalid = expectOk(evaluate({ revocation: undefined }, { status: 'INVALID' }));
    expect(invalid.verification).toEqual({ status: 'INVALID' });
    expect(invalid.historical).toEqual({ status: 'INVALID_SIGNATURE' });

    const unavailable = expectOk(
      evaluate({ revocation: undefined }, { status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' }),
    );
    expect(unavailable.verification).toEqual({ status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' });
    expect(unavailable.historical).toEqual({ status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' });
    expect(unavailable.historical.status).not.toBe('INVALID_SIGNATURE');

    const unsupported = expectOk(
      evaluate({ revocation: undefined }, { status: 'CRYPTO_UNSUPPORTED', reason: 'algorithm' }),
    );
    expect(unsupported.verification).toEqual({ status: 'CRYPTO_UNSUPPORTED', reason: 'algorithm' });
    expect(unsupported.historical).toEqual({ status: 'CRYPTO_UNSUPPORTED', reason: 'algorithm' });
  });
});

function rawVerifier(value: unknown): SignatureVerifier {
  return { verify: () => value as SignatureVerificationOutcome };
}

describe('verifier runtime validation', () => {
  test('malformed verifier outputs are mechanism failures, never success', () => {
    const malformedArray = Object.assign([], { status: 'VERIFIED' });
    const inherited = Object.create({ status: 'VERIFIED' });
    const malformed: readonly unknown[] = [
      undefined,
      null,
      { status: 'UNKNOWN' },
      { status: 'VERIFIED', reason: 42 },
      { status: 'VERIFIED', reason: 'unexpected' },
      { status: 'VERIFIED', extra: true },
      { status: 'INVALID', reason: 'unexpected' },
      {},
      malformedArray,
      inherited,
    ];

    for (const value of malformed) {
      const result = evaluate({ revocation: undefined }, undefined, rawVerifier(value));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.kind).toBe('MECHANISM');
      expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
    }
  });

  test('all four valid verifier outcomes remain distinct', () => {
    const verified = expectOk(evaluate({ revocation: undefined }, undefined, staticVerifier({ status: 'VERIFIED' })));
    expect(verified.verification).toEqual({ status: 'VERIFIED' });
    expect(verified.historical).toEqual({ status: 'VALID' });

    const invalid = expectOk(evaluate({ revocation: undefined }, undefined, staticVerifier({ status: 'INVALID' })));
    expect(invalid.verification).toEqual({ status: 'INVALID' });
    expect(invalid.historical).toEqual({ status: 'INVALID_SIGNATURE' });

    const unavailable = expectOk(
      evaluate({ revocation: undefined }, undefined, staticVerifier({ status: 'CRYPTO_UNAVAILABLE' })),
    );
    expect(unavailable.verification).toEqual({ status: 'CRYPTO_UNAVAILABLE' });
    expect(unavailable.historical).toEqual({ status: 'CRYPTO_UNAVAILABLE' });

    const unsupported = expectOk(
      evaluate({ revocation: undefined }, undefined, staticVerifier({ status: 'CRYPTO_UNSUPPORTED' })),
    );
    expect(unsupported.verification).toEqual({ status: 'CRYPTO_UNSUPPORTED' });
    expect(unsupported.historical).toEqual({ status: 'CRYPTO_UNSUPPORTED' });
  });
  test('verifier-owned outcome objects are copied and never frozen', () => {
    const shared: { status: SignatureVerificationOutcome['status'] } = { status: 'VERIFIED' };
    const verifier: SignatureVerifier = { verify: () => shared as SignatureVerificationOutcome };

    const first = expectOk(evaluate({ revocation: undefined }, undefined, verifier));
    expect(first.verification).toEqual({ status: 'VERIFIED' });
    expect(Object.isFrozen(shared)).toBe(false);
    expect(Object.isFrozen(first.verification)).toBe(true);

    shared.status = 'INVALID';
    const second = expectOk(evaluate({ revocation: undefined }, undefined, verifier));
    expect(second.verification).toEqual({ status: 'INVALID' });
  });

  test('strict verifier shape accepts optional reason only on crypto outcomes', () => {
    const withReason = expectOk(
      evaluate(
        { revocation: undefined },
        undefined,
        staticVerifier({ status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' }),
      ),
    );
    expect(withReason.verification).toEqual({ status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' });

    const noReason = expectOk(
      evaluate({ revocation: undefined }, undefined, staticVerifier({ status: 'CRYPTO_UNSUPPORTED' })),
    );
    expect(noReason.verification).toEqual({ status: 'CRYPTO_UNSUPPORTED' });
  });
});

describe('revocation subject correspondence', () => {
  test('a revocation for a different credential is a mechanism failure', () => {
    const result = evaluate({
      revocation: revocationFixture({ credential_id: credentialId('cred-2') }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('a matching pair succeeds and no revocation remains supported', () => {
    expect(expectOk(evaluate()).historical).toEqual({ status: 'INVALID' });
    expect(expectOk(evaluate({ revocation: undefined })).historical).toEqual({ status: 'VALID' });
  });
});

describe('§4.4.1 revocation reason matrix', () => {
  test('ROTATION, ADMINISTRATIVE and no revocation allow a trusted historical signature', () => {
    for (const reason of ['ROTATION', 'ADMINISTRATIVE'] as const) {
      const result = expectOk(
        evaluate({
          revocation: revocationFixture({ reason }),
          policy: signaturePolicy({ evaluateFutureAuthorization: () => 'POLICY_DEPENDENT' }),
        }),
      );
      expect(result.historical).toEqual({ status: 'VALID' });
      expect(result.revocation_reason).toBe(reason);
      expect(result.future_authorizable).toBe('POLICY_DEPENDENT');
    }

    const none = expectOk(evaluate({ revocation: undefined }));
    expect(none.historical).toEqual({ status: 'VALID' });
    expect(none.revocation_reason).toBeUndefined();
  });

  test('KEY_LOST requires policy instead of passing or failing automatically', () => {
    const result = expectOk(evaluate({ revocation: revocationFixture({ reason: 'KEY_LOST' }) }));
    expect(result.historical).toEqual({ status: 'KEY_LOST_POLICY_REQUIRED' });
  });

  test('SUSPECTED_COMPROMISE is flagged for reassessment without invalidation', () => {
    const result = expectOk(evaluate({ revocation: revocationFixture({ reason: 'SUSPECTED_COMPROMISE' }) }));
    expect(result.historical).toEqual({ status: 'SUSPECTED_COMPROMISE_FLAGGED' });
    expect(result.reassessment_required).toBe(true);
  });

  test('CONFIRMED_COMPROMISE without a compromise time is contested, not inferred', () => {
    const result = expectOk(
      evaluate({
        revocation: revocationFixture({ reason: 'CONFIRMED_COMPROMISE', compromise_effective_at: undefined }),
      }),
    );
    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
    expect(result.temporal.compromise_effective_at).toBeUndefined();
  });

  test('an unsatisfied evidence gate is contested even with both timestamps trusted', () => {
    const result = expectOk(evaluate({ policy: signaturePolicy({ acceptCompromiseTime: () => false }) }));
    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
  });

  test('ROTATION and ADMINISTRATIVE reject signatures at or after revoked_at', () => {
    for (const reason of ['ROTATION', 'ADMINISTRATIVE'] as const) {
      const atRevocation = expectOk(
        evaluate({
          revocation: revocationFixture({
            reason,
            revoked_at: timestamp(SIGNED_AT),
            compromise_effective_at: undefined,
          }),
        }),
      );
      expect(atRevocation.historical).toEqual({ status: 'SIGNED_AFTER_REVOCATION' });

      const afterRevocation = expectOk(
        evaluate({
          revocation: revocationFixture({
            reason,
            revoked_at: timestamp(90),
            compromise_effective_at: undefined,
          }),
        }),
      );
      expect(afterRevocation.historical).toEqual({ status: 'SIGNED_AFTER_REVOCATION' });
    }
  });

  test('a trusted signature before the accepted compromise time remains historically valid', () => {
    const result = expectOk(
      evaluate({
        signed_at: timestamp(70),
        ctx: contextFor({ signedValue: 70 }),
      }),
    );
    expect(result.historical).toEqual({ status: 'VALID' });
    expect(result.claim_status).toBeUndefined();
  });
});

describe('D-3 retrospective confirmed compromise', () => {
  test('both trusted timestamps and accepted evidence produce D-3 invalidity', () => {
    const result = expectOk(evaluate());

    expectD3Invalid(result);
  });

  function failureMatrix(field: 'SIGNED_AT' | 'compromise_effective_at', subject: string, value: number) {
    return [
      {
        label: 'UNTRUSTED',
        input: trustInput({ field, subject, value, trusted: false }),
        status: 'TEMPORAL_TRUST_UNTRUSTED',
      },
      { label: 'UNASSESSED', input: { status: 'NOT_ASSESSED' } as const, status: 'TEMPORAL_TRUST_UNASSESSED' },
      {
        label: 'UNAVAILABLE',
        input: { status: 'UNAVAILABLE', reason: 'time source' } as const,
        status: 'TEMPORAL_TRUST_ASSESSMENT_UNAVAILABLE',
      },
    ] as const;
  }

  const signedFailures = failureMatrix('SIGNED_AT', signedRef, SIGNED_AT);
  for (const failure of signedFailures) {
    test(`signed_at ${failure.label} preserves uncertainty and does not produce INVALID`, () => {
      const result = expectOk(evaluate({ ctx: contextFor({ signed: failure.input }) }));
      expect(result.historical).toEqual({ status: failure.status, fields: ['SIGNED_AT'] });
      expect(result.claim_status).toBeUndefined();
    });
  }

  const compromiseFailures = failureMatrix('compromise_effective_at', compromiseRef, COMPROMISE_AT);

  for (const failure of compromiseFailures) {
    test(`compromise_effective_at ${failure.label} preserves uncertainty and does not produce INVALID`, () => {
      const result = expectOk(evaluate({ ctx: contextFor({ compromise: failure.input }) }));
      expect(result.historical).toEqual({
        status: failure.status,
        fields: ['compromise_effective_at'],
      });
      expect(result.claim_status).toBeUndefined();
    });
  }

  test('both temporal failures keep both fields, with UNTRUSTED winning the status', () => {
    const result = expectOk(
      evaluate({
        ctx: contextFor({
          signed: { status: 'NOT_ASSESSED' },
          compromise: trustInput({
            field: 'compromise_effective_at',
            subject: compromiseRef,
            value: COMPROMISE_AT,
            trusted: false,
          }),
        }),
      }),
    );

    expect(result.historical).toEqual({
      status: 'TEMPORAL_TRUST_UNTRUSTED',
      fields: ['SIGNED_AT', 'compromise_effective_at'],
    });
  });
});

describe('policy boundaries', () => {
  test('missing or throwing policy callbacks are mechanism failures, not partial results', () => {
    const missingFuture = evaluate({
      policy: { acceptCompromiseTime: () => true } as unknown as SignatureTemporalPolicy,
    });
    expect(missingFuture.ok).toBe(false);

    const throwingAccept = evaluate({
      policy: signaturePolicy({
        acceptCompromiseTime: () => {
          throw new Error('no evidence service');
        },
      }),
    });
    expect(throwingAccept.ok).toBe(false);

    const throwingFuture = evaluate({
      policy: signaturePolicy({
        evaluateFutureAuthorization: () => {
          throw new Error('no policy');
        },
      }),
    });
    expect(throwingFuture.ok).toBe(false);
  });

  test('future authorization is independent from historical validity', () => {
    const result = expectOk(
      evaluate({ policy: signaturePolicy({ evaluateFutureAuthorization: () => 'AUTHORIZABLE' }) }),
    );
    expect(result.historical).toEqual({ status: 'INVALID' });
    expect(result.future_authorizable).toBe('AUTHORIZABLE');
  });

  test('usage denial, SUSPECTED_COMPROMISE and crypto failure are all retained', () => {
    const result = expectOk(
      evaluate(
        {
          requested_usage: 'AUTHENTICATION',
          revocation: revocationFixture({ reason: 'SUSPECTED_COMPROMISE' }),
        },
        { status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' },
      ),
    );

    expect(result.historical).toEqual({ status: 'USAGE_DENIED', usage: 'AUTHENTICATION' });
    expect(result.verification).toEqual({ status: 'CRYPTO_UNAVAILABLE', reason: 'hsm down' });
    expect(result.revocation_reason).toBe('SUSPECTED_COMPROMISE');
    expect(result.reassessment_required).toBe(true);
  });

  test('future policy receives revocation_reason even without a subject binding', () => {
    let observed: FutureAuthorizationInput | undefined;
    const result = evaluate({
      subject_binding: undefined,
      revocation: revocationFixture({ reason: 'SUSPECTED_COMPROMISE' }),
      policy: signaturePolicy({
        evaluateFutureAuthorization: (input) => {
          observed = input;
          return 'REQUIRES_ASSESSMENT';
        },
      }),
    });

    expect(result.ok).toBe(true);
    expect(observed?.revocation_reason).toBe('SUSPECTED_COMPROMISE');
    expect(observed?.revocation?.credential_id).toBe(credentialValue.credential_id);
  });
});

describe('credential validity window', () => {
  function windowContext(credentialValue: ReturnType<typeof credential>) {
    const subject = signedAtSubjectRef(credentialValue, binding);
    return trustContext(
      {
        [subject]: {
          SIGNED_AT: trustInput({ field: 'SIGNED_AT', subject, value: SIGNED_AT, trusted: true }),
        },
      },
      { SIGNED_AT },
    );
  }

  test('signatures before not_before or after not_after are rejected', () => {
    const futureCredential = credential('cred-future', {
      usage: ['SIGNING'],
      not_before: timestamp(200),
      not_after: timestamp(300),
    });
    const futureResult = expectOk(
      evaluate({ credential: futureCredential, revocation: undefined, ctx: windowContext(futureCredential) }),
    );
    expect(futureResult.historical).toEqual({ status: 'OUTSIDE_CREDENTIAL_VALIDITY_WINDOW' });

    const expiredCredential = credential('cred-expired', {
      usage: ['SIGNING'],
      not_before: timestamp(0),
      not_after: timestamp(50),
    });
    const expiredResult = expectOk(
      evaluate({ credential: expiredCredential, revocation: undefined, ctx: windowContext(expiredCredential) }),
    );
    expect(expiredResult.historical).toEqual({ status: 'OUTSIDE_CREDENTIAL_VALIDITY_WINDOW' });
  });

  test('inclusive validity-window boundaries remain valid', () => {
    const boundaryCredential = credential('cred-boundary', {
      usage: ['SIGNING'],
      not_before: timestamp(SIGNED_AT),
      not_after: timestamp(SIGNED_AT),
    });
    const result = expectOk(
      evaluate({ credential: boundaryCredential, revocation: undefined, ctx: windowContext(boundaryCredential) }),
    );
    expect(result.historical).toEqual({ status: 'VALID' });
  });
});

describe('D-4 unknown compromise time', () => {
  test('absent compromise_effective_at is contested and never inferred from revoked_at', () => {
    let acceptCalls = 0;
    const result = expectOk(
      evaluate({
        revocation: revocationFixture({ reason: 'CONFIRMED_COMPROMISE', compromise_effective_at: undefined }),
        policy: signaturePolicy({
          acceptCompromiseTime: () => {
            acceptCalls += 1;
            return true;
          },
        }),
      }),
    );

    expect(result.historical).toEqual({ status: 'CONTESTED_COMPROMISED' });
    expect(result.claim_status).toBeUndefined();
    expect(result.temporal.compromise_effective_at).toBeUndefined();
    expect(acceptCalls).toBe(0);
  });
});

describe('ownership and forbidden side effects', () => {
  test('evaluation does not mutate credential or revocation snapshots', () => {
    const credentialSnapshot = JSON.stringify(credentialValue);
    const revocationSnapshot = JSON.stringify(revocation);

    const result = expectOk(evaluate());

    expect(result.historical).toEqual({ status: 'INVALID' });
    expect(JSON.stringify(credentialValue)).toBe(credentialSnapshot);
    expect(JSON.stringify(revocation)).toBe(revocationSnapshot);
    expect(Object.isFrozen(credentialValue)).toBe(true);
    expect(Object.isFrozen(revocation)).toBe(true);
  });

  test('caller mutation after validation cannot rewrite the stored revocation', () => {
    const source = {
      credential_id: 'cred-1',
      revoked_by_domain: 'domain-a',
      revoked_at: REVOKED_AT,
      reason: 'CONFIRMED_COMPROMISE',
      compromise_effective_at: COMPROMISE_AT,
      evidence_refs: ['evidence-1'],
    };
    const validated = validateCredentialRevocationRecord(source);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const stored = validated.value;
    const before = JSON.stringify(stored);

    source.evidence_refs.push('evidence-2');
    source.compromise_effective_at = 10;

    expect(JSON.stringify(stored)).toBe(before);
    expect(Object.isFrozen(stored)).toBe(true);
  });

  test('historical validity and future authorization remain separately observable', () => {
    const result = expectOk(
      evaluate({
        revocation: revocationFixture({ reason: 'ROTATION' }),
        policy: signaturePolicy({ evaluateFutureAuthorization: () => 'NOT_AUTHORIZABLE' }),
      }),
    );

    expect(result.historical).toEqual({ status: 'VALID' });
    expect(result.future_authorizable).toBe('NOT_AUTHORIZABLE');
  });
});

describe('public boundary hardening', () => {
  test('a non-canonicalizable revocation record is a mechanism failure, not a throw', () => {
    const broken = { ...revocation, revoked_at: Number.NaN } as unknown as typeof revocation;
    let result: ReturnType<typeof evaluateHistoricalSignature> | undefined;
    expect(() => {
      result = evaluate({ revocation: broken });
    }).not.toThrow();
    expect(result?.ok).toBe(false);
    if (result !== undefined && !result.ok) {
      expect(result.error.kind).toBe('MECHANISM');
      expect(result.error.message).toContain('CredentialRevocationRecord is not a JSON value');
    }
  });

  test('non-finite timestamps never throw', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      for (const field of ['revoked_at', 'compromise_effective_at'] as const) {
        const broken = { ...revocation, [field]: value } as unknown as typeof revocation;
        expect(() => evaluate({ revocation: broken })).not.toThrow();
        expect(evaluate({ revocation: broken }).ok).toBe(false);
      }
    }
  });

  test('missing optional fields never throw', () => {
    expect(() => evaluate({ subject_binding: undefined, revocation: undefined })).not.toThrow();
    expect(evaluate({ subject_binding: undefined, revocation: undefined }).ok).toBe(true);
  });

  test('revocationSubjectRef states its precondition by throwing on a non-canonicalizable record', () => {
    const broken = { ...revocation, revoked_at: Number.NaN } as unknown as typeof revocation;
    expect(() => revocationSubjectRef(broken)).toThrow();
  });
});
