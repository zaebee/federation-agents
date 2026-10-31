// Credential usage, revocation and historical signature evaluation for UIA-CORE-001
// §4.1–§4.4 and §10 (Task 13).
//
// The result keeps independent dimensions: usage, cryptographic verification,
// revocation reason, temporal trust, historical validity and future
// authorization eligibility. A verified signature is not proof of authority;
// this module never creates a grant.

import { canonicalSha256 } from './canonical.js';
import type { CredentialDescriptor, CredentialUsage } from './entities.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze, validateJsonValue } from './ownership.js';
import type {
  CredentialID,
  DomainID,
  IdentityVersionID,
  JsonValue,
  RuntimeInstanceID,
  TemporalFieldRef,
  Timestamp,
} from './primitives.js';
import type { TemporalContext, TemporalTrustOutcome } from './temporal.js';
import { trustOutcome } from './temporal.js';

export type RevocationReason =
  'ROTATION' | 'KEY_LOST' | 'SUSPECTED_COMPROMISE' | 'CONFIRMED_COMPROMISE' | 'ADMINISTRATIVE';

export interface CredentialRevocationRecord {
  credential_id: CredentialID;
  revoked_by_domain: DomainID;
  revoked_at: Timestamp;
  reason: RevocationReason;
  compromise_effective_at?: Timestamp;
  compromise_time_basis?: string;
  compromise_time_evidence_refs?: string[];
  evidence_refs: string[];
}

export type CredentialSubjectBinding =
  | { readonly kind: 'IDENTITY_VERSION'; readonly identity_version_id: IdentityVersionID }
  | { readonly kind: 'RUNTIME_INSTANCE'; readonly runtime_instance_id: RuntimeInstanceID };

export type CredentialUsageEvaluation =
  | { readonly status: 'PERMITTED'; readonly usage: CredentialUsage }
  | { readonly status: 'USAGE_DENIED'; readonly usage: string }
  | { readonly status: 'USAGE_UNSUPPORTED'; readonly usage: string };

export type SignatureVerificationOutcome =
  | { readonly status: 'VERIFIED' }
  | { readonly status: 'INVALID' }
  | { readonly status: 'CRYPTO_UNAVAILABLE'; readonly reason?: string }
  | { readonly status: 'CRYPTO_UNSUPPORTED'; readonly reason?: string };

export interface SignatureVerificationInput {
  readonly credential: DeepReadonly<CredentialDescriptor>;
  readonly signed_at: Timestamp;
  readonly payload_ref?: string;
}

export interface SignatureVerifier {
  verify(input: SignatureVerificationInput): SignatureVerificationOutcome;
}

export type FutureAuthorizationOutcome =
  'AUTHORIZABLE' | 'NOT_AUTHORIZABLE' | 'POLICY_DEPENDENT' | 'REQUIRES_ASSESSMENT';

export interface CompromiseTimeInput {
  readonly credential: DeepReadonly<CredentialDescriptor>;
  readonly subject_binding?: CredentialSubjectBinding;
  readonly revocation: DeepReadonly<CredentialRevocationRecord>;
  readonly signed_at: Timestamp;
  readonly signed_at_trust: TemporalTrustOutcome;
  readonly compromise_trust: TemporalTrustOutcome;
}

export interface FutureAuthorizationInput {
  readonly credential: DeepReadonly<CredentialDescriptor>;
  readonly subject_binding?: CredentialSubjectBinding;
  readonly revocation?: DeepReadonly<CredentialRevocationRecord>;
  readonly signed_at: Timestamp;
  readonly usage: CredentialUsageEvaluation;
  readonly verification: SignatureVerificationOutcome;
  readonly revocation_reason?: RevocationReason;
  readonly temporal: {
    readonly signed_at: TemporalTrustOutcome;
    readonly compromise_effective_at?: TemporalTrustOutcome;
  };
  readonly reassessment_required: boolean;
}

export interface SignatureTemporalPolicy {
  acceptCompromiseTime(input: CompromiseTimeInput): boolean;
  evaluateFutureAuthorization(input: FutureAuthorizationInput): FutureAuthorizationOutcome;
}

export type TemporalTrustFailureFields = readonly TemporalFieldRef[];

export type HistoricalValidity =
  | { readonly status: 'VALID' }
  | { readonly status: 'INVALID' }
  | { readonly status: 'CONTESTED_COMPROMISED' }
  | { readonly status: 'KEY_LOST_POLICY_REQUIRED' }
  | { readonly status: 'SUSPECTED_COMPROMISE_FLAGGED' }
  | { readonly status: 'TEMPORAL_TRUST_UNTRUSTED'; readonly fields: TemporalTrustFailureFields }
  | { readonly status: 'TEMPORAL_TRUST_UNASSESSED'; readonly fields: TemporalTrustFailureFields }
  | {
      readonly status: 'TEMPORAL_TRUST_ASSESSMENT_UNAVAILABLE';
      readonly fields: TemporalTrustFailureFields;
    }
  | { readonly status: 'USAGE_DENIED'; readonly usage: string }
  | { readonly status: 'USAGE_UNSUPPORTED'; readonly usage: string }
  | { readonly status: 'INVALID_SIGNATURE' }
  | { readonly status: 'CRYPTO_UNAVAILABLE'; readonly reason?: string }
  | { readonly status: 'CRYPTO_UNSUPPORTED'; readonly reason?: string };

export type ClaimStatus = 'CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE';

export interface HistoricalSignatureResult {
  readonly verification: SignatureVerificationOutcome;
  readonly usage: CredentialUsageEvaluation;
  readonly revocation_reason?: RevocationReason;
  readonly temporal: {
    readonly signed_at: TemporalTrustOutcome;
    readonly compromise_effective_at?: TemporalTrustOutcome;
  };
  readonly historical: HistoricalValidity;
  readonly claim_status?: ClaimStatus;
  readonly future_authorizable: FutureAuthorizationOutcome;
  readonly reassessment_required: boolean;
}

export interface HistoricalSignatureInput {
  readonly credential: DeepReadonly<CredentialDescriptor>;
  readonly requested_usage: string;
  readonly signed_at: Timestamp;
  readonly subject_binding?: CredentialSubjectBinding;
  readonly revocation?: DeepReadonly<CredentialRevocationRecord>;
  readonly policy: SignatureTemporalPolicy;
  readonly ctx: TemporalContext;
  readonly payload_ref?: string;
}

const CREDENTIAL_USAGES: readonly CredentialUsage[] = ['AUTHENTICATION', 'SIGNING', 'ENCRYPTION'];
const REVOCATION_REASONS: readonly RevocationReason[] = [
  'ROTATION',
  'KEY_LOST',
  'SUSPECTED_COMPROMISE',
  'CONFIRMED_COMPROMISE',
  'ADMINISTRATIVE',
];
const FUTURE_OUTCOMES: readonly FutureAuthorizationOutcome[] = [
  'AUTHORIZABLE',
  'NOT_AUTHORIZABLE',
  'POLICY_DEPENDENT',
  'REQUIRES_ASSESSMENT',
];

type JsonObject = { readonly [key: string]: JsonValue };

const REVOCATION_FIELDS: readonly string[] = [
  'credential_id',
  'revoked_by_domain',
  'revoked_at',
  'reason',
  'compromise_effective_at',
  'compromise_time_basis',
  'compromise_time_evidence_refs',
  'evidence_refs',
];

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

function optionalString(value: JsonValue | undefined, path: string): Result<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requireString(value, path);
}

function optionalTimestamp(value: JsonValue | undefined, path: string): Result<Timestamp | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requireTimestamp(value, path);
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

function optionalStringArray(value: JsonValue | undefined, path: string): Result<string[] | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return requireStringArray(value, path);
}

function rejectUnknownFields(value: JsonObject, allowed: readonly string[], path: string): Result<void> {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return invalid(`${path}.${key}`, 'unknown field');
    }
  }
  return { ok: true, value: undefined };
}

/** Validates an untrusted §4.4 revocation record and returns an owned frozen copy. */
export function validateCredentialRevocationRecord(value: unknown): Result<DeepReadonly<CredentialRevocationRecord>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  const object = requireObject(json.value, '$');
  if (!object.ok) return object;
  const known = rejectUnknownFields(object.value, REVOCATION_FIELDS, '$');
  if (!known.ok) return known;

  const credential = requireString(object.value.credential_id, '$.credential_id');
  if (!credential.ok) return credential;
  const revokedBy = requireString(object.value.revoked_by_domain, '$.revoked_by_domain');
  if (!revokedBy.ok) return revokedBy;
  const revokedAt = requireTimestamp(object.value.revoked_at, '$.revoked_at');
  if (!revokedAt.ok) return revokedAt;
  const reason = requireString(object.value.reason, '$.reason');
  if (!reason.ok) return reason;
  if (!(REVOCATION_REASONS as readonly string[]).includes(reason.value)) {
    return invalid('$.reason', `expected one of: ${REVOCATION_REASONS.join(', ')}`);
  }
  const effectiveAt = optionalTimestamp(object.value.compromise_effective_at, '$.compromise_effective_at');
  if (!effectiveAt.ok) return effectiveAt;
  const timeBasis = optionalString(object.value.compromise_time_basis, '$.compromise_time_basis');
  if (!timeBasis.ok) return timeBasis;
  const timeEvidence = optionalStringArray(
    object.value.compromise_time_evidence_refs,
    '$.compromise_time_evidence_refs',
  );
  if (!timeEvidence.ok) return timeEvidence;
  const evidence = requireStringArray(object.value.evidence_refs, '$.evidence_refs');
  if (!evidence.ok) return evidence;

  const record: CredentialRevocationRecord = {
    credential_id: credential.value as CredentialID,
    revoked_by_domain: revokedBy.value as DomainID,
    revoked_at: revokedAt.value,
    reason: reason.value as RevocationReason,
    evidence_refs: evidence.value,
  };
  if (effectiveAt.value !== undefined) {
    record.compromise_effective_at = effectiveAt.value;
  }
  if (timeBasis.value !== undefined) {
    record.compromise_time_basis = timeBasis.value;
  }
  if (timeEvidence.value !== undefined) {
    record.compromise_time_evidence_refs = timeEvidence.value;
  }
  return { ok: true, value: deepFreeze(record) };
}

/** Declared usage permits; known-but-undeclared denies; unknown values are unsupported. */
export function evaluateCredentialUsage(
  credential: DeepReadonly<CredentialDescriptor>,
  requestedUsage: string,
): CredentialUsageEvaluation {
  if (!(CREDENTIAL_USAGES as readonly string[]).includes(requestedUsage)) {
    return { status: 'USAGE_UNSUPPORTED', usage: requestedUsage };
  }
  if (!credential.usage.includes(requestedUsage as CredentialUsage)) {
    return { status: 'USAGE_DENIED', usage: requestedUsage };
  }
  return { status: 'PERMITTED', usage: requestedUsage as CredentialUsage };
}

/** Subject binding for signed_at: credential plus the IdentityVersion/RuntimeInstance it belongs to. */
export function signedAtSubjectRef(
  credential: DeepReadonly<CredentialDescriptor>,
  binding: CredentialSubjectBinding,
): string {
  if (binding.kind === 'IDENTITY_VERSION') {
    return `credential:${String(credential.credential_id)}/identity-version:${String(binding.identity_version_id)}`;
  }
  return `credential:${String(credential.credential_id)}/runtime-instance:${String(binding.runtime_instance_id)}`;
}

/** Content-derived revocation subject; no normative revocation_id field is introduced. */
export function revocationSubjectRef(record: DeepReadonly<CredentialRevocationRecord>): string {
  return `revocation:sha256:${canonicalSha256(record as unknown as JsonValue)}`;
}

function mechanismResult(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function runVerifier(verifier: SignatureVerifier, input: SignatureVerificationInput): SignatureVerificationOutcome {
  try {
    return verifier.verify(input);
  } catch (error) {
    return { status: 'CRYPTO_UNAVAILABLE', reason: error instanceof Error ? error.message : String(error) };
  }
}

function runAcceptCompromiseTime(policy: SignatureTemporalPolicy, input: CompromiseTimeInput): Result<boolean> {
  if (typeof policy.acceptCompromiseTime !== 'function') {
    return mechanismResult('SignatureTemporalPolicy.acceptCompromiseTime is required');
  }
  try {
    const accepted = policy.acceptCompromiseTime(input);
    if (typeof accepted !== 'boolean') {
      return mechanismResult('SignatureTemporalPolicy.acceptCompromiseTime must return a boolean');
    }
    return { ok: true, value: accepted };
  } catch (error) {
    return mechanismResult(
      `SignatureTemporalPolicy.acceptCompromiseTime failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function runFutureAuthorization(
  policy: SignatureTemporalPolicy,
  input: FutureAuthorizationInput,
): Result<FutureAuthorizationOutcome> {
  if (typeof policy.evaluateFutureAuthorization !== 'function') {
    return mechanismResult('SignatureTemporalPolicy.evaluateFutureAuthorization is required');
  }
  try {
    const outcome = policy.evaluateFutureAuthorization(input);
    if (!(FUTURE_OUTCOMES as readonly string[]).includes(outcome)) {
      return mechanismResult('SignatureTemporalPolicy.evaluateFutureAuthorization returned an unknown outcome');
    }
    return { ok: true, value: outcome };
  } catch (error) {
    return mechanismResult(
      `SignatureTemporalPolicy.evaluateFutureAuthorization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function temporalFailure(signedAt: TemporalTrustOutcome, compromise?: TemporalTrustOutcome): HistoricalValidity {
  const fields: TemporalFieldRef[] = [];
  const outcomes: TemporalTrustOutcome[] = [];
  if (signedAt !== 'TRUSTED') {
    fields.push('SIGNED_AT');
    outcomes.push(signedAt);
  }
  if (compromise !== undefined && compromise !== 'TRUSTED') {
    fields.push('compromise_effective_at');
    outcomes.push(compromise);
  }
  if (outcomes.includes('UNTRUSTED')) {
    return { status: 'TEMPORAL_TRUST_UNTRUSTED', fields };
  }
  if (outcomes.includes('TRUST_ASSESSMENT_UNAVAILABLE')) {
    return { status: 'TEMPORAL_TRUST_ASSESSMENT_UNAVAILABLE', fields };
  }
  return { status: 'TEMPORAL_TRUST_UNASSESSED', fields };
}

function historicalForConfirmed(input: {
  readonly signedAt: Timestamp;
  readonly signedAtTrust: TemporalTrustOutcome;
  readonly compromiseTrust?: TemporalTrustOutcome;
  readonly compromiseEffectiveAt?: Timestamp;
  readonly compromiseAccepted: boolean;
}): HistoricalValidity {
  if (input.compromiseEffectiveAt === undefined) {
    return { status: 'CONTESTED_COMPROMISED' };
  }
  if (input.signedAtTrust !== 'TRUSTED' || input.compromiseTrust !== 'TRUSTED') {
    return temporalFailure(input.signedAtTrust, input.compromiseTrust);
  }
  if (!input.compromiseAccepted) {
    return { status: 'CONTESTED_COMPROMISED' };
  }
  return input.signedAt >= input.compromiseEffectiveAt ? { status: 'INVALID' } : { status: 'VALID' };
}

function historicalForSimpleReason(signedAtTrust: TemporalTrustOutcome): HistoricalValidity {
  return signedAtTrust === 'TRUSTED' ? { status: 'VALID' } : temporalFailure(signedAtTrust);
}

function selectHistorical(input: {
  readonly usage: CredentialUsageEvaluation;
  readonly verification: SignatureVerificationOutcome;
  readonly revocationReason?: RevocationReason;
  readonly signedAt: Timestamp;
  readonly signedAtTrust: TemporalTrustOutcome;
  readonly compromiseTrust?: TemporalTrustOutcome;
  readonly compromiseEffectiveAt?: Timestamp;
  readonly compromiseAccepted: boolean;
}): HistoricalValidity {
  if (input.usage.status === 'USAGE_DENIED') {
    return { status: 'USAGE_DENIED', usage: input.usage.usage };
  }
  if (input.usage.status === 'USAGE_UNSUPPORTED') {
    return { status: 'USAGE_UNSUPPORTED', usage: input.usage.usage };
  }
  const crypto = cryptographicHistorical(input.verification);
  if (crypto !== undefined) {
    return crypto;
  }
  if (input.revocationReason === 'KEY_LOST') {
    return { status: 'KEY_LOST_POLICY_REQUIRED' };
  }
  if (input.revocationReason === 'SUSPECTED_COMPROMISE') {
    return { status: 'SUSPECTED_COMPROMISE_FLAGGED' };
  }
  if (input.revocationReason === 'CONFIRMED_COMPROMISE') {
    return historicalForConfirmed(input);
  }
  return historicalForSimpleReason(input.signedAtTrust);
}

function cryptographicHistorical(verification: SignatureVerificationOutcome): HistoricalValidity | undefined {
  if (verification.status === 'INVALID') {
    return { status: 'INVALID_SIGNATURE' };
  }
  if (verification.status === 'CRYPTO_UNAVAILABLE') {
    return {
      status: 'CRYPTO_UNAVAILABLE',
      ...(verification.reason === undefined ? {} : { reason: verification.reason }),
    };
  }
  if (verification.status === 'CRYPTO_UNSUPPORTED') {
    return {
      status: 'CRYPTO_UNSUPPORTED',
      ...(verification.reason === undefined ? {} : { reason: verification.reason }),
    };
  }
  return undefined;
}

type CompromiseMeasurement =
  | { readonly kind: 'NONE' }
  | {
      readonly kind: 'PRESENT';
      readonly effectiveAt: Timestamp;
      readonly trust: TemporalTrustOutcome;
    };

function resolveSignedAtTrust(input: HistoricalSignatureInput): Result<TemporalTrustOutcome> {
  if (input.subject_binding === undefined) {
    return { ok: true, value: 'TRUST_ASSESSMENT_UNAVAILABLE' };
  }
  return trustOutcome(
    input.ctx,
    'SIGNED_AT',
    signedAtSubjectRef(input.credential, input.subject_binding),
    input.signed_at,
  );
}

function resolveCompromiseMeasurement(input: HistoricalSignatureInput): Result<CompromiseMeasurement> {
  if (input.revocation?.reason !== 'CONFIRMED_COMPROMISE') {
    return { ok: true, value: { kind: 'NONE' } };
  }
  const effectiveAt = input.revocation.compromise_effective_at;
  if (effectiveAt === undefined) {
    return { ok: true, value: { kind: 'NONE' } };
  }
  const trust = trustOutcome(input.ctx, 'compromise_effective_at', revocationSubjectRef(input.revocation), effectiveAt);
  if (!trust.ok) {
    return trust;
  }
  return { ok: true, value: { kind: 'PRESENT', effectiveAt, trust: trust.value } };
}

function resolveCompromiseAcceptance(
  input: HistoricalSignatureInput,
  signedAtTrust: TemporalTrustOutcome,
  compromise: CompromiseMeasurement,
): Result<boolean> {
  if (compromise.kind === 'NONE' || input.revocation === undefined) {
    return { ok: true, value: false };
  }
  return runAcceptCompromiseTime(input.policy, {
    credential: input.credential,
    ...(input.subject_binding === undefined ? {} : { subject_binding: input.subject_binding }),
    revocation: input.revocation,
    signed_at: input.signed_at,
    signed_at_trust: signedAtTrust,
    compromise_trust: compromise.trust,
  });
}

function buildTemporal(
  signedAt: TemporalTrustOutcome,
  compromise: CompromiseMeasurement,
): HistoricalSignatureResult['temporal'] {
  if (compromise.kind === 'NONE') {
    return { signed_at: signedAt };
  }
  return { signed_at: signedAt, compromise_effective_at: compromise.trust };
}

function buildFutureInput(
  input: HistoricalSignatureInput,
  values: {
    readonly usage: CredentialUsageEvaluation;
    readonly verification: SignatureVerificationOutcome;
    readonly temporal: HistoricalSignatureResult['temporal'];
    readonly reassessmentRequired: boolean;
  },
): FutureAuthorizationInput {
  const base: FutureAuthorizationInput = {
    credential: input.credential,
    signed_at: input.signed_at,
    usage: values.usage,
    verification: values.verification,
    temporal: values.temporal,
    reassessment_required: values.reassessmentRequired,
  };
  if (input.subject_binding === undefined && input.revocation === undefined) {
    return base;
  }
  if (input.subject_binding === undefined) {
    return { ...base, revocation: input.revocation };
  }
  if (input.revocation === undefined) {
    return { ...base, subject_binding: input.subject_binding };
  }
  return {
    ...base,
    subject_binding: input.subject_binding,
    revocation: input.revocation,
    revocation_reason: input.revocation.reason,
  };
}

function buildHistoricalResult(
  input: HistoricalSignatureInput,
  values: {
    readonly verification: SignatureVerificationOutcome;
    readonly usage: CredentialUsageEvaluation;
    readonly temporal: HistoricalSignatureResult['temporal'];
    readonly historical: HistoricalValidity;
    readonly future: FutureAuthorizationOutcome;
    readonly reassessmentRequired: boolean;
  },
): HistoricalSignatureResult {
  return {
    verification: values.verification,
    usage: values.usage,
    ...(input.revocation === undefined ? {} : { revocation_reason: input.revocation.reason }),
    temporal: values.temporal,
    historical: values.historical,
    ...(values.historical.status === 'INVALID'
      ? { claim_status: 'CLAIM_FAILED_KEY_COMPROMISED_PRIOR_TO_SIGNATURE' as const }
      : {}),
    future_authorizable: values.future,
    reassessment_required: values.reassessmentRequired,
  };
}

/** Evaluates one historical signature. Policy is mandatory; missing/failing policy is a mechanism failure. */
export function evaluateHistoricalSignature(
  input: HistoricalSignatureInput,
  verifier: SignatureVerifier,
): Result<HistoricalSignatureResult> {
  if (
    typeof input.policy?.acceptCompromiseTime !== 'function' ||
    typeof input.policy?.evaluateFutureAuthorization !== 'function'
  ) {
    return mechanismResult('SignatureTemporalPolicy must provide both callbacks');
  }

  const usage = evaluateCredentialUsage(input.credential, input.requested_usage);
  const verification = runVerifier(verifier, {
    credential: input.credential,
    signed_at: input.signed_at,
    ...(input.payload_ref === undefined ? {} : { payload_ref: input.payload_ref }),
  });

  const signedAtTrust = resolveSignedAtTrust(input);
  if (!signedAtTrust.ok) {
    return signedAtTrust;
  }
  const compromise = resolveCompromiseMeasurement(input);
  if (!compromise.ok) {
    return compromise;
  }
  const accepted = resolveCompromiseAcceptance(input, signedAtTrust.value, compromise.value);
  if (!accepted.ok) {
    return accepted;
  }

  const reassessmentRequired = input.revocation?.reason === 'SUSPECTED_COMPROMISE';
  const temporal = buildTemporal(signedAtTrust.value, compromise.value);
  const future = runFutureAuthorization(
    input.policy,
    buildFutureInput(input, { usage, verification, temporal, reassessmentRequired }),
  );
  if (!future.ok) {
    return future;
  }

  const historical = selectHistorical({
    usage,
    verification,
    ...(input.revocation === undefined ? {} : { revocationReason: input.revocation.reason }),
    signedAt: input.signed_at,
    signedAtTrust: signedAtTrust.value,
    ...(compromise.value.kind === 'PRESENT'
      ? { compromiseTrust: compromise.value.trust, compromiseEffectiveAt: compromise.value.effectiveAt }
      : {}),
    compromiseAccepted: accepted.value,
  });

  return {
    ok: true,
    value: deepFreeze(
      buildHistoricalResult(input, {
        verification,
        usage,
        temporal,
        historical,
        future: future.value,
        reassessmentRequired,
      }),
    ),
  };
}
