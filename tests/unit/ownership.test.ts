import { test, expect } from 'bun:test';
import { deepCopy, deepFreeze, validateUnknown } from '../../src/core/ownership.js';
import type { DeepReadonly } from '../../src/core/ownership.js';

test('ownership: deep copy is structurally equal', () => {
  const src = { a: { b: [1, 2, { c: 3 }] }, d: 'x' };
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.value).toEqual(src);
  }
});

test('ownership: deep copy is reference-disjoint at every level', () => {
  const inner = { c: 3 };
  const src = { a: { b: [1, 2, inner] } };
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.value).not.toBe(src);
    expect(r.value.a).not.toBe(src.a);
    expect(r.value.a.b).not.toBe(src.a.b);
    expect(r.value.a.b[2]).not.toBe(src.a.b[2]);
  }
});

test('ownership: mutating original after copy does not affect copy', () => {
  const src: { a: { b: number[] } } = { a: { b: [1, 2] } };
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    src.a.b.push(999);
    src.a = { b: [0] };
    expect(r.value.a.b).toEqual([1, 2]);
  }
});

test('ownership: deep freeze freezes nested objects and arrays', () => {
  const src = { a: { b: [1, 2] } };
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    const frozen = deepFreeze(r.value);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.a.b)).toBe(true);
  }
});

test('ownership: frozen copy cannot be mutated', () => {
  const src = { a: { b: [1, 2] } };
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    const frozen = deepFreeze(r.value) as { a: { b: number[] } };
    let threw = false;
    try {
      (frozen as { a: { b: number[] } }).a.b.push(999);
    } catch {
      threw = true;
    }
    // Either throws (strict) or silently fails (non-strict); value must be unchanged.
    expect(frozen.a.b).toEqual([1, 2]);
    void threw;
  }
});

// Rejection cases
test('ownership: rejects function-valued property', () => {
  const r = deepCopy({ fn: () => 1 } as unknown);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('MECHANISM');
});

test('ownership: rejects symbol-keyed own property', () => {
  const obj: Record<string, unknown> = { a: 1 };
  Object.defineProperty(obj, Symbol('s'), { value: 2, enumerable: true });
  const r = deepCopy(obj);
  expect(r.ok).toBe(false);
});

test('ownership: rejects accessor property', () => {
  const obj: Record<string, unknown> = {};
  Object.defineProperty(obj, 'x', { get: () => 1, enumerable: true });
  const r = deepCopy(obj);
  expect(r.ok).toBe(false);
});

test('ownership: rejects non-enumerable own property', () => {
  const obj: Record<string, unknown> = { a: 1 };
  Object.defineProperty(obj, 'hidden', { value: 2, enumerable: false });
  const r = deepCopy(obj);
  expect(r.ok).toBe(false);
});

test('ownership: rejects non-Object.prototype (class instance)', () => {
  class Foo {
    x = 1;
  }
  const r = deepCopy(new Foo() as unknown);
  expect(r.ok).toBe(false);
});

test('ownership: rejects null-prototype object', () => {
  const obj = Object.create(null) as Record<string, unknown>;
  obj.a = 1;
  const r = deepCopy(obj);
  expect(r.ok).toBe(false);
});

test('ownership: rejects cyclic input', () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  const r = deepCopy(obj);
  expect(r.ok).toBe(false);
});

test('ownership: rejects array with non-index own property', () => {
  const arr: unknown[] = [1, 2];
  (arr as unknown as Record<string, unknown>).foo = 3;
  const r = deepCopy(arr);
  expect(r.ok).toBe(false);
});

test('ownership: rejects array with symbol-keyed property', () => {
  const arr: unknown[] = [1, 2];
  Object.defineProperty(arr, Symbol('s'), { value: 3, enumerable: true });
  const r = deepCopy(arr);
  expect(r.ok).toBe(false);
});

test('ownership: does not silently omit unsupported properties (rejects)', () => {
  const r = deepCopy(new Map([['a', 1]]) as unknown);
  expect(r.ok).toBe(false);
});

// validateUnknown boundary
test('ownership: validateUnknown accepts valid input via guard', () => {
  const r = validateUnknown(42, (v): v is number => typeof v === 'number');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value).toBe(42);
});

test('ownership: validateUnknown rejects invalid input', () => {
  const r = validateUnknown('nope', (v): v is number => typeof v === 'number');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('MECHANISM');
});

test('ownership: validateUnknown does not cast arbitrary input', () => {
  // guard returns false => rejected, value never exposed
  const r = validateUnknown({ x: 1 }, (v): v is number => typeof v === 'number');
  expect(r.ok).toBe(false);
});

// Type-level: DeepReadonly applies recursively (compile-time check).
const _typeCheck: DeepReadonly<{ a: { b: number[] } }> = { a: { b: [1, 2] } };
void _typeCheck;
