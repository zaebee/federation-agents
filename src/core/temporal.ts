// Temporal context contracts for UIA-CORE-001 §10 (Global Constraint 10).
//
// This module carries types only. Trust derivation, the four-outcome helper
// (`trustOutcome`), validation and temporal conformance tests belong to Task 13;
// nothing here decides whether a timestamp is trusted.

import type { DomainID, TemporalFieldRef, Timestamp } from './primitives.js';

/** A trust determination bound to an exact field, subject and timestamp value. */
export interface AssessedTrustResult {
  readonly status: 'ASSESSED';
  readonly field: TemporalFieldRef;
  readonly subject_ref: string;
  readonly timestamp_value: Timestamp;
  readonly trusted: boolean;
  readonly assessed_by: DomainID;
  readonly assessed_at: Timestamp;
  readonly evidence_refs: readonly string[];
  readonly policy_ref: string;
}

/** External trust input states. They are not collapsed into one another. */
export type TemporalTrustInput =
  | { readonly status: 'ASSESSED'; readonly assessment: AssessedTrustResult }
  | { readonly status: 'NOT_ASSESSED' }
  | { readonly status: 'UNAVAILABLE'; readonly reason?: string };

/**
 * Operation context: which declared field governs the operation (`basis`),
 * declared timestamp values, and externally supplied trust inputs keyed by
 * `(subject_ref, field)`.
 */
export interface TemporalContext {
  readonly basis: TemporalFieldRef;
  readonly declared: Readonly<Partial<Record<TemporalFieldRef, Timestamp>>>;
  readonly trust: Readonly<
    Record<string, Readonly<Record<TemporalFieldRef, TemporalTrustInput | undefined>> | undefined>
  >;
}
