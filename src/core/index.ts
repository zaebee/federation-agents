// Core domain layer barrel for UIA-CORE-001.
// Populated incrementally. Task 2: errors, primitives, ownership.

export * from './errors.js';
export * from './primitives.js';
export * from './ownership.js';
export * from './canonical.js';
export * from './sha256.js';
export * from './entities.js';
export * from './hashing.js';

export { buildLineageGraph, validateDescriptor } from './lineage.js';
export type { LineageEdge, LineageGraph, Registry, StructuralResult } from './lineage.js';

export * from './temporal.js';

export { assessEdge, evaluateAssurance, registerAssessment } from './assessment.js';
export type {
  ApplicableAssessments,
  AssuranceResult,
  ContinuityAssessment,
  ContinuityAssuranceRequirement,
  EdgeRef,
  Policy,
} from './assessment.js';

export { validateVersionLabel } from './version-scheme.js';
export type { SemVer, VersionLabel } from './version-scheme.js';

export {
  InvalidCompiledSelectorError,
  SELECTOR_MECHANISM_VERSION,
  compileSelector,
  selectorMatches,
} from './selector.js';
export type { CompiledSelector, SelectorComparator, SelectorOperator } from './selector.js';
