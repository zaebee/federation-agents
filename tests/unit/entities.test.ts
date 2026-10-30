import { test, expect } from 'bun:test';
import { isOk, isFailure, mechanismFailure, specFailure, CanonicalizationError } from '../../src/core/errors.js';
import type {
  UiaErrorCode,
  ImplementationErrorCode,
  SpecFailure,
  MechanismFailure,
  Failure,
  Result,
} from '../../src/core/errors.js';
import type { DeepReadonly } from '../../src/core/ownership.js';

// Type-level: UiaErrorCode is the exact 8-code union. We assert assignability by
// constructing a value of each code (compile-time check via tsc).
const NORMATIVE_CODES: readonly UiaErrorCode[] = [
  'ERR_INVALID_RELATION',
  'ERR_INVALID_CARDINALITY',
  'ERR_NO_TRAVERSAL_PATH',
  'ERR_MERGE_BRANCH_UNSATISFIED',
  'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
  'ERR_AUTHORITY_BINDING_MISMATCH',
  'CYCLE_DETECTED',
  'PARENT_UNRESOLVED',
];

test('error model: all eight normative codes are assignable to UiaErrorCode', () => {
  expect(NORMATIVE_CODES).toHaveLength(8);
  for (const code of NORMATIVE_CODES) {
    const f: SpecFailure = specFailure(code, 'msg');
    expect(f.kind).toBe('SPEC');
    expect(f.code).toBe(code);
  }
});

test('error model: mechanism codes belong to ImplementationErrorCode, not UiaErrorCode', () => {
  const mech: ImplementationErrorCode = 'S_SELECTOR_INCOMPATIBLE_SCHEME';
  const f: MechanismFailure = mechanismFailure(mech, 'msg');
  expect(f.kind).toBe('MECHANISM');
  expect(f.code).toBe(mech);

  const mech2: ImplementationErrorCode = 'E_APPLICABLE_ASSESSMENTS_UNBRANDED';
  expect(mechanismFailure(mech2, 'msg').code).toBe(mech2);
});

test('error model: Result narrows via discriminant', () => {
  const ok: Result<number> = { ok: true, value: 42 };
  const bad: Result<number> = { ok: false, error: specFailure('CYCLE_DETECTED', 'cycle') };

  if (isOk(ok)) {
    // narrowed
    const v: number = ok.value;
    expect(v).toBe(42);
  } else {
    throw new Error('expected ok');
  }

  if (isFailure(bad)) {
    const e: Failure = bad.error;
    expect(e.kind).toBe('SPEC');
    if (e.kind === 'SPEC') {
      expect(e.code).toBe('CYCLE_DETECTED');
    }
  } else {
    throw new Error('expected failure');
  }
});

test('error model: SpecFailure and MechanismFailure are distinguishable', () => {
  const spec: Failure = specFailure('PARENT_UNRESOLVED', 'unresolved');
  const mech: Failure = mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'unsupported');
  expect(spec.kind).toBe('SPEC');
  expect(mech.kind).toBe('MECHANISM');
  // kind discriminates
  if (spec.kind === 'SPEC') expect(spec.code).toBe('PARENT_UNRESOLVED');
  if (mech.kind === 'MECHANISM') expect(mech.code).toBe('E_OWNERSHIP_UNSUPPORTED');
});

test('error model: CanonicalizationError is an Error subclass', () => {
  const e = new CanonicalizationError('boom');
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe('CanonicalizationError');
  expect(e.message).toBe('boom');
});

// Type-level: DeepReadonly is exported and assignable (compile-time check).
const _deepReadonlyCheck: DeepReadonly<{ a: { b: number[] } }> = { a: { b: [1, 2] } };
void _deepReadonlyCheck;

// Type-level negative: a mechanism error code is not assignable to UiaErrorCode.
// @ts-expect-error intentional type error
const _badNormativeCode: UiaErrorCode = 'E_OWNERSHIP_UNSUPPORTED';
void _badNormativeCode;
