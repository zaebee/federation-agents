// Temporal context contracts for UIA-CORE-001 §10 (Global Constraint 10).
//
// Types plus the four-outcome trust derivation used by credential evaluation.
// Trust itself is always supplied externally; the core never produces it.

import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { DomainID, TemporalFieldRef, Timestamp } from './primitives.js';
import { validateTemporalFieldRef } from './primitives.js';

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

export type TemporalTrustOutcome = 'TRUSTED' | 'UNTRUSTED' | 'UNASSESSED' | 'TRUST_ASSESSMENT_UNAVAILABLE';

/**
 * Resolves external trust for one exact `(subject_ref, field, timestamp_value)`.
 *
 * - missing entry or NOT_ASSESSED -> UNASSESSED
 * - UNAVAILABLE -> TRUST_ASSESSMENT_UNAVAILABLE
 * - ASSESSED with any binding mismatch -> TRUST_ASSESSMENT_UNAVAILABLE
 * - ASSESSED matching -> TRUSTED / UNTRUSTED
 *
 * Field comparison is exact: no case folding and no standard/extension aliasing.
 */
export function trustOutcome(
  ctx: TemporalContext,
  field: TemporalFieldRef,
  subjectRef: string,
  timestampValue: Timestamp,
): Result<TemporalTrustOutcome> {
  const validated = validateTemporalFieldRef(field);
  if (!validated.ok) {
    return validated;
  }
  if (typeof subjectRef !== 'string' || subjectRef.length === 0) {
    return {
      ok: false,
      error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', 'Trust subject_ref must be a non-empty string'),
    };
  }

  const subjectTrust = Object.prototype.hasOwnProperty.call(ctx.trust, subjectRef) ? ctx.trust[subjectRef] : undefined;
  const entry =
    subjectTrust !== undefined && Object.prototype.hasOwnProperty.call(subjectTrust, validated.value)
      ? subjectTrust[validated.value]
      : undefined;
  if (entry === undefined || entry.status === 'NOT_ASSESSED') {
    return { ok: true, value: 'UNASSESSED' };
  }
  if (entry.status === 'UNAVAILABLE') {
    return { ok: true, value: 'TRUST_ASSESSMENT_UNAVAILABLE' };
  }

  const assessment = entry.assessment;
  if (
    assessment.field !== validated.value ||
    assessment.subject_ref !== subjectRef ||
    assessment.timestamp_value !== timestampValue
  ) {
    return { ok: true, value: 'TRUST_ASSESSMENT_UNAVAILABLE' };
  }
  return { ok: true, value: assessment.trusted ? 'TRUSTED' : 'UNTRUSTED' };
}
