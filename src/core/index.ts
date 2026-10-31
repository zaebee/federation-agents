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

export {
  assessEdge,
  evaluateAssurance,
  registerAssessment,
  registerCycleAssessment,
  registerCycleAssessments,
  registerOrphanAssessment,
  registerOrphanAssessments,
  validateContinuityAssessment,
} from './assessment.js';
export type {
  ApplicableAssessments,
  AssuranceResult,
  ContinuityAssessment,
  ContinuityAssuranceRequirement,
  EdgeRef,
  Policy,
} from './assessment.js';

export { discoverPaths, evaluateBinding, validateMergeClosure, validatePath } from './traversal.js';
export type {
  BindingFailureCode,
  BindingResult,
  ConditionalVersionBinding,
  FailedPath,
  FailedPathValidation,
  LineageTraversalScope,
  MergeClosureBranchFailure,
  MergeClosureResult,
  Path,
  PathOutcome,
  PathSet,
  PathValidation,
} from './traversal.js';

export {
  applyLifecycle,
  createLocalAcceptanceLifecycleEvent,
  createLocalAcceptanceRecord,
  isAcceptable,
} from './acceptance.js';
export type {
  AcceptanceApplicability,
  AcceptanceApplicabilityPolicy,
  AcceptanceApplicabilityPolicyInput,
  AcceptanceDecision,
  AcceptanceLifecycleState,
  AcceptanceNotApplicableReason,
  AcceptanceQuery,
  LifecyclePolicy,
  LifecyclePolicyInput,
  LifecycleTransition,
  LocalAcceptanceLifecycleEvent,
  LocalAcceptanceRecord,
} from './acceptance.js';

export { appendAcceptance, appendLifecycleEvent, createAcceptanceLedger } from './ledger.js';
export type { AcceptanceLedger } from './ledger.js';

export {
  evaluateCredentialUsage,
  evaluateHistoricalSignature,
  revocationSubjectRef,
  signedAtSubjectRef,
  validateCredentialRevocationRecord,
} from './credential.js';
export type {
  ClaimStatus,
  CompromiseTimeInput,
  CredentialRevocationRecord,
  CredentialSubjectBinding,
  CredentialUsageEvaluation,
  FutureAuthorizationInput,
  FutureAuthorizationOutcome,
  HistoricalSignatureInput,
  HistoricalSignatureResult,
  HistoricalValidity,
  RevocationReason,
  SignatureTemporalPolicy,
  SignatureVerificationInput,
  SignatureVerificationOutcome,
  SignatureVerifier,
  TemporalTrustFailureFields,
} from './credential.js';

export { createRuntimeLifecycleEvent, createRuntimeRegistry, recordRuntimeEvent } from './runtime.js';
export type { RuntimeLifecycleEvent, RuntimeLifecycleState, RuntimeRegistry } from './runtime.js';

export { validateVersionLabel } from './version-scheme.js';
export type { SemVer, VersionLabel } from './version-scheme.js';

export {
  InvalidCompiledSelectorError,
  SELECTOR_MECHANISM_VERSION,
  compileSelector,
  selectorMatches,
} from './selector.js';
export type { CompiledSelector, SelectorComparator, SelectorOperator } from './selector.js';
