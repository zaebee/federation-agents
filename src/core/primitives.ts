// Primitive domain types for UIA-CORE-001 Rev 0.3.3.

import { mechanismFailure } from './errors.js';
import type { Result } from './errors.js';

// ---------------------------------------------------------------------------
// Branded identifiers (nominally distinct strings)
// ---------------------------------------------------------------------------

type Brand<T, B extends string> = T & { readonly __brand: B };

export type ParticipantID = Brand<string, 'ParticipantID'>;
export type IdentityVersionID = Brand<string, 'IdentityVersionID'>;
export type RuntimeInstanceID = Brand<string, 'RuntimeInstanceID'>;
export type CredentialID = Brand<string, 'CredentialID'>;
export type AssessmentID = Brand<string, 'AssessmentID'>;
export type AcceptanceID = Brand<string, 'AcceptanceID'>;
export type DomainID = Brand<string, 'DomainID'>;

// Branded to avoid the redundant-alias finding (S6564) and to keep the
// temporal value nominally distinct from arbitrary numbers.
export type Timestamp = number & { readonly __brand: 'Timestamp' };

export function timestamp(value: number): Timestamp {
  return value as Timestamp;
}

// Convenience constructors (identity casts; validation of format is the caller's
// responsibility at the boundary, except where a validator is provided).
export function participantId(value: string): ParticipantID {
  return value as ParticipantID;
}
export function identityVersionId(value: string): IdentityVersionID {
  return value as IdentityVersionID;
}
export function runtimeInstanceId(value: string): RuntimeInstanceID {
  return value as RuntimeInstanceID;
}
export function credentialId(value: string): CredentialID {
  return value as CredentialID;
}
export function assessmentId(value: string): AssessmentID {
  return value as AssessmentID;
}
export function acceptanceId(value: string): AcceptanceID {
  return value as AcceptanceID;
}
export function domainId(value: string): DomainID {
  return value as DomainID;
}

// ---------------------------------------------------------------------------
// Strict JSON value type (data model; runtime enforcement lives in
// validateJsonValue in ownership.ts (Task 2) and canonical.ts (Task 3), but the
// type is declared here so ownership/canonicalization can share it)
// ---------------------------------------------------------------------------

export type JsonValue = null | boolean | string | number | readonly JsonValue[] | { readonly [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Temporal field references
// ---------------------------------------------------------------------------

export type TemporalBasis = 'ASSERTED_AT' | 'SIGNED_AT' | 'INGESTED_AT' | 'ASSESSED_AT' | 'DECIDED_AT';

// The five standard kinds are reserved well-known references. Extension refs are
// arbitrary strings that are validated at runtime. The type allows both, with
// autocomplete for the standard kinds.
export type TemporalFieldRef = TemporalBasis | (string & { readonly __temporalFieldExt?: never });

export const STANDARD_TEMPORAL_FIELDS: readonly TemporalBasis[] = Object.freeze([
  'ASSERTED_AT',
  'SIGNED_AT',
  'INGESTED_AT',
  'ASSESSED_AT',
  'DECIDED_AT',
]);

const EXT_REF_REGEX = /^[A-Za-z]\w*(\.[A-Za-z]\w*)*$/;

export function hasLoneSurrogate(value: string): boolean {
  let i = 0;
  while (i < value.length) {
    const cp = value.codePointAt(i);
    if (cp === undefined) return true;
    if (cp >= 0xd800 && cp <= 0xdfff) {
      // A surrogate code point at this position means a lone surrogate:
      // a valid pair would have produced a code point above 0xFFFF.
      return true;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return false;
}

export function validateTemporalFieldRef(value: unknown): Result<TemporalFieldRef> {
  if (typeof value !== 'string' || value.length === 0) {
    return {
      ok: false,
      error: mechanismFailure('E_TEMPORAL_FIELD_REF_INVALID', 'TemporalFieldRef must be a non-empty string'),
    };
  }
  // No whitespace or control characters (C0 and C1 ranges).
  // eslint-disable-next-line no-control-regex
  if (/\s|[\x00-\x1F\x7F-\x9F]/.test(value)) {
    return {
      ok: false,
      error: mechanismFailure(
        'E_TEMPORAL_FIELD_REF_INVALID',
        'TemporalFieldRef must not contain whitespace or control characters',
      ),
    };
  }
  if (hasLoneSurrogate(value)) {
    return {
      ok: false,
      error: mechanismFailure('E_TEMPORAL_FIELD_REF_INVALID', 'TemporalFieldRef must not contain lone surrogates'),
    };
  }

  // Standard refs are reserved well-known references.
  if ((STANDARD_TEMPORAL_FIELDS as readonly string[]).includes(value)) {
    return { ok: true, value: value as TemporalBasis };
  }

  // Extension refs must be well-formed and cannot redefine a standard ref
  // (already excluded above, since standard names are handled).
  if (!EXT_REF_REGEX.test(value)) {
    return {
      ok: false,
      error: mechanismFailure(
        'E_TEMPORAL_FIELD_REF_INVALID',
        String.raw`TemporalFieldRef extension must match ^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$`,
      ),
    };
  }

  return { ok: true, value: value as TemporalFieldRef };
}
