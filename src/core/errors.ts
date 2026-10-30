// Error model for UIA-CORE-001 Rev 0.3.3.
//
// Normative protocol errors (UiaErrorCode) are kept strictly separate from
// implementation/mechanism errors (ImplementationErrorCode). A Failure is a
// discriminated union so callers can narrow reliably via its `kind` field.

import type { JsonValue } from './primitives.js';

export type UiaErrorCode =
  | 'ERR_INVALID_RELATION'
  | 'ERR_INVALID_CARDINALITY'
  | 'ERR_NO_TRAVERSAL_PATH'
  | 'ERR_MERGE_BRANCH_UNSATISFIED'
  | 'ERR_ASSURANCE_PREDICATE_UNSATISFIED'
  | 'ERR_AUTHORITY_BINDING_MISMATCH'
  | 'CYCLE_DETECTED'
  | 'PARENT_UNRESOLVED';

export type ImplementationErrorCode =
  | 'S_SELECTOR_INCOMPATIBLE_SCHEME'
  | 'E_APPLICABLE_ASSESSMENTS_UNBRANDED'
  | 'E_TEMPORAL_FIELD_REF_INVALID'
  | 'E_CANONICALIZATION_UNSUPPORTED'
  | 'E_OWNERSHIP_UNSUPPORTED'
  | 'E_JSON_VALUE_INVALID'
  | 'E_UNKNOWN_BOUNDARY_REJECTED';

export interface SpecFailure {
  readonly kind: 'SPEC';
  readonly code: UiaErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export interface MechanismFailure {
  readonly kind: 'MECHANISM';
  readonly code: ImplementationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type Failure = SpecFailure | MechanismFailure;

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Failure };

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok === true;
}

export function isFailure<T>(r: Result<T>): r is { ok: false; error: Failure } {
  return r.ok === false;
}

// Canonicalization is out of scope for Task 2 (Task 3). This error type is
// provided here so downstream modules can throw/return it without depending
// on the canonicalizer. It is a mechanism error, never a normative state.
export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

// Convenience constructors (mechanism failures only at this layer; spec
// failures are constructed by domain modules with their own context).
export function mechanismFailure(code: ImplementationErrorCode, message: string): MechanismFailure {
  return { kind: 'MECHANISM', code, message };
}

export function specFailure(code: UiaErrorCode, message: string): SpecFailure {
  return { kind: 'SPEC', code, message };
}
