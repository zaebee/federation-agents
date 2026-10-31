// Shared emission helpers for the experimental reference adapters.
//
// Internal to `src/adapters`; not exported through the package root.

import type { ContinuityAssessment } from '../core/assessment.js';
import type { Result } from '../core/errors.js';
import { mechanismFailure } from '../core/errors.js';
import type { DeepReadonly } from '../core/ownership.js';
import { validateJsonValue } from '../core/ownership.js';
import type { AssessmentID } from '../core/primitives.js';

export interface AssessmentEmission {
  readonly assessments: readonly DeepReadonly<ContinuityAssessment>[];
  readonly registered: readonly DeepReadonly<ContinuityAssessment>[];
}

export function mechanismRejection(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

export function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Runs the caller-owned id callback, converts a throw into a mechanism failure,
 * and validates the returned value as a non-empty string.
 */
export function readAssessmentId(callback: () => unknown, context: string): Result<AssessmentID> {
  let id: unknown;
  try {
    id = callback();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return mechanismRejection(`assessmentIdFor threw while constructing a ${context} candidate: ${reason}`);
  }
  const idValue = validateJsonValue(id);
  if (!idValue.ok || typeof idValue.value !== 'string' || idValue.value.length === 0) {
    return mechanismRejection('assessmentIdFor must return a non-empty string');
  }
  return { ok: true, value: idValue.value as AssessmentID };
}

/**
 * Selects the records emitted by this invocation from the canonical admitted
 * representation (selected by candidate id, not by array position) and freezes
 * the emission.
 */
export function freezeEmission(
  registered: readonly DeepReadonly<ContinuityAssessment>[],
  candidateIds: ReadonlySet<AssessmentID>,
): AssessmentEmission {
  const assessments = Object.freeze(registered.filter((assessment) => candidateIds.has(assessment.assessment_id)));
  return Object.freeze({ assessments, registered });
}
