import { expect } from 'bun:test';
import type {
  CredentialRevocationRecord,
  CredentialSubjectBinding,
  FutureAuthorizationOutcome,
  HistoricalSignatureResult,
  SignatureTemporalPolicy,
  SignatureVerificationOutcome,
  SignatureVerifier,
} from '../../src/core/credential.js';
import {
  revocationSubjectRef,
  signedAtSubjectRef,
  validateCredentialRevocationRecord,
} from '../../src/core/credential.js';
import type { Result } from '../../src/core/errors.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import type { TemporalFieldRef } from '../../src/core/primitives.js';
import { domainId, identityVersionId, runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import type { AssessedTrustResult, TemporalContext, TemporalTrustInput } from '../../src/core/temporal.js';
import { credential } from './fixtures.js';

export const SIGNED_AT = 100;
export const COMPROMISE_AT = 80;
export const REVOKED_AT = 150;

export function revocationFixture(
  overrides: Partial<CredentialRevocationRecord> = {},
): DeepReadonly<CredentialRevocationRecord> {
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    credential_id: 'cred-1',
    revoked_by_domain: 'domain-a',
    revoked_at: REVOKED_AT,
    reason: 'CONFIRMED_COMPROMISE',
    compromise_effective_at: COMPROMISE_AT,
    evidence_refs: [],
    ...overrides,
  })) {
    if (value !== undefined) {
      input[key] = value;
    }
  }
  const result = validateCredentialRevocationRecord(input);
  if (!result.ok) {
    throw new Error(`revocation fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function signingCredential(id = 'cred-1') {
  return credential(id, { usage: ['SIGNING'], not_before: timestamp(0) });
}

export function identityBinding(id = 'iv-a'): CredentialSubjectBinding {
  return { kind: 'IDENTITY_VERSION', identity_version_id: identityVersionId(id) };
}

export function runtimeBinding(id = 'rt-a'): CredentialSubjectBinding {
  return { kind: 'RUNTIME_INSTANCE', runtime_instance_id: runtimeInstanceId(id) };
}

export function signedSubject(
  credentialValue: ReturnType<typeof signingCredential>,
  binding: CredentialSubjectBinding = identityBinding(),
): string {
  return signedAtSubjectRef(credentialValue, binding);
}

export function compromiseSubject(record: DeepReadonly<CredentialRevocationRecord>): string {
  return revocationSubjectRef(record);
}

export function assessedTrust(input: {
  readonly field: TemporalFieldRef;
  readonly subject: string;
  readonly value: number;
  readonly trusted: boolean;
}): AssessedTrustResult {
  return {
    status: 'ASSESSED',
    field: input.field,
    subject_ref: input.subject,
    timestamp_value: timestamp(input.value),
    trusted: input.trusted,
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(REVOKED_AT),
    evidence_refs: [],
    policy_ref: 'policy-1',
  };
}

export function trustInput(input: {
  readonly field: TemporalFieldRef;
  readonly subject: string;
  readonly value: number;
  readonly trusted: boolean;
}): TemporalTrustInput {
  return { status: 'ASSESSED', assessment: assessedTrust(input) };
}

export function trustContext(
  entries: Readonly<Record<string, Readonly<Record<string, TemporalTrustInput>> | undefined>>,
  declared: Readonly<Record<string, number>> = {},
): TemporalContext {
  const declaredValues: Record<string, ReturnType<typeof timestamp>> = {};
  for (const [field, value] of Object.entries(declared)) {
    declaredValues[field] = timestamp(value);
  }
  return {
    basis: 'SIGNED_AT',
    declared: declaredValues,
    trust: entries,
  };
}

export function staticVerifier(outcome: SignatureVerificationOutcome): SignatureVerifier {
  return { verify: () => outcome };
}

export function signaturePolicy(overrides: Partial<SignatureTemporalPolicy> = {}): SignatureTemporalPolicy {
  return {
    acceptCompromiseTime: () => true,
    evaluateFutureAuthorization: (): FutureAuthorizationOutcome => 'NOT_AUTHORIZABLE',
    ...overrides,
  };
}

const defaultCredential = signingCredential();
const defaultBinding = identityBinding();
const defaultRevocation = revocationFixture();
const defaultSignedRef = signedAtSubjectRef(defaultCredential, defaultBinding);
const defaultCompromiseRef = revocationSubjectRef(defaultRevocation);

export function contextFor(
  options: {
    readonly signed?: TemporalTrustInput | 'missing';
    readonly compromise?: TemporalTrustInput | 'missing';
    readonly signedValue?: number;
    readonly compromiseValue?: number;
    readonly signedKey?: string;
    readonly compromiseKey?: string;
  } = {},
): TemporalContext {
  const signedValue = options.signedValue ?? SIGNED_AT;
  const compromiseValue = options.compromiseValue ?? COMPROMISE_AT;
  const entries: Record<string, Record<string, TemporalTrustInput>> = {};

  if (options.signed !== 'missing') {
    const key = options.signedKey ?? defaultSignedRef;
    entries[key] = {
      SIGNED_AT: options.signed ?? trustInput({ field: 'SIGNED_AT', subject: key, value: signedValue, trusted: true }),
    };
  }
  if (options.compromise !== 'missing') {
    const key = options.compromiseKey ?? defaultCompromiseRef;
    entries[key] = {
      compromise_effective_at:
        options.compromise ??
        trustInput({
          field: 'compromise_effective_at',
          subject: key,
          value: compromiseValue,
          trusted: true,
        }),
    };
  }

  return trustContext(entries, { SIGNED_AT: signedValue, compromise_effective_at: compromiseValue });
}

export function expectOk<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected success, got ${result.error.message}`);
  }
  return result.value;
}

export function expectD3Invalid(result: HistoricalSignatureResult): void {
  expect(result.temporal).toEqual({
    signed_at: 'TRUSTED',
    compromise_effective_at: 'TRUSTED',
  });
  expect(result.historical).toEqual({ status: 'INVALID' });
  expect(result.claim_status).toBe('CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE');
  expect(result.future_authorizable).toBe('NOT_AUTHORIZABLE');
  expect(result.revocation_reason).toBe('CONFIRMED_COMPROMISE');
}
