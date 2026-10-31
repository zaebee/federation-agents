// Public API barrel for UIA-CORE-001 reference implementation.
// Populated incrementally as tasks land. No `any`/`unknown` may be exported unvalidated.

export const UIA_CORE_001_REVISION = '0.3.3' as const;

export * from './core/index.js';

// Experimental reference adapter. Not a CORE-001 protocol API; no stability
// guarantee or compatibility commitment is implied by this package export.
export { emitOrphanAssessment } from './adapters/orphan-assessment.js';
export type { OrphanAssessmentEmission, OrphanAssessmentRequest } from './adapters/orphan-assessment.js';
