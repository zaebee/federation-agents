import type { ContinuityAssessment } from '../../src/core/assessment.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';

export const ASSESSMENT_BASE_TIME = 1_700_000_000_000;

/** Shared ContinuityAssessment builder for unit tests. */
export function continuityAssessment(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return {
    assessment_id: assessmentId('assessment-1'),
    subject_version_id: identityVersionId('iv-d'),
    parent_version_ids: [identityVersionId('iv-a')],
    declared_relation: 'CONTINUATION',
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    verified_claims: [],
    unverified_claims: [],
    evidence_refs: [],
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(ASSESSMENT_BASE_TIME),
    ...overrides,
  };
}
