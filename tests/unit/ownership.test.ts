import { test, expect } from 'bun:test';
import { deepCopy, deepFreeze, validateUnknown, validateJsonValue } from '../../src/core/ownership.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import { STANDARD_TEMPORAL_FIELDS } from '../../src/core/primitives.js';

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

// validateUnknown establishes ownership
test('ownership: validateUnknown returns an owned copy, not the original', () => {
  const src = { a: { b: [1, 2] } };
  const r = validateUnknown(src, (v): v is { a: { b: number[] } } => typeof v === 'object' && v !== null);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.value).not.toBe(src);
    expect(r.value.a).not.toBe(src.a);
    expect(r.value.a.b).not.toBe(src.a.b);
  }
});

test('ownership: validateUnknown result is isolated from original mutations', () => {
  const src: { a: { b: number[] } } = { a: { b: [1, 2] } };
  const r = validateUnknown(src, (v): v is { a: { b: number[] } } => typeof v === 'object' && v !== null);
  expect(r.ok).toBe(true);
  if (r.ok) {
    src.a.b.push(999);
    src.a = { b: [0] };
    expect(r.value.a.b).toEqual([1, 2]);
  }
});

test('ownership: validateUnknown rejects unsupported structures', () => {
  const r = validateUnknown(
    { fn: () => 1 } as unknown,
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('MECHANISM');
});

test('ownership: validateUnknown rejects non-string input for string guard', () => {
  const r = validateUnknown(42, (v): v is string => typeof v === 'string');
  expect(r.ok).toBe(false);
});

// deepCopy array hardening
test('ownership: deepCopy rejects sparse arrays', () => {
  const arr = new Array(3);
  arr[0] = 1;
  arr[2] = 3;
  const r = deepCopy(arr);
  expect(r.ok).toBe(false);
});

test('ownership: deepCopy rejects non-standard numeric array keys (01, out of bounds)', () => {
  const arr: unknown[] = [1, 2];
  Object.defineProperty(arr, '01', { value: 3, enumerable: true, writable: true, configurable: true });
  const r1 = deepCopy(arr);
  expect(r1.ok).toBe(false);

  const arr2: unknown[] = [1, 2];
  Object.defineProperty(arr2, '5', { value: 3, enumerable: true, writable: true, configurable: true });
  const r2 = deepCopy(arr2);
  expect(r2.ok).toBe(false);
});

test('ownership: deepFreeze freezes symbol-keyed and non-enumerable properties', () => {
  const sym = Symbol('s');
  const obj: Record<string | symbol, unknown> = { a: { b: 1 } };
  Object.defineProperty(obj, sym, { value: { c: 2 }, enumerable: false, writable: true, configurable: true });
  const frozen = deepFreeze(obj);
  expect(Object.isFrozen((frozen as Record<string | symbol, unknown>)[sym])).toBe(true);
  // non-enumerable nested still frozen
  expect(Object.isFrozen((frozen as { a: { b: number } }).a)).toBe(true);
});

test('ownership: validateJsonValue rejects cyclic structures', () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  const r = validateJsonValue(obj);
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects unsafe getter without invoking it', () => {
  const obj: Record<string, unknown> = {};
  let counter = 0;
  Object.defineProperty(obj, 'x', {
    get() {
      counter++;
      return 1;
    },
    enumerable: true,
  });
  const r = validateJsonValue(obj);
  expect(r.ok).toBe(false);
  expect(counter).toBe(0);
});

test('ownership: deepCopy rejects accessor element without invoking getter', () => {
  const arr: unknown[] = [1, 2];
  let counter = 0;
  Object.defineProperty(arr, '0', {
    get() {
      counter++;
      return 999;
    },
    enumerable: true,
  });
  const r = deepCopy(arr);
  expect(r.ok).toBe(false);
  expect(counter).toBe(0);
});

test('ownership: deepCopy rejects non-enumerable indexed property', () => {
  const arr: unknown[] = [1, 2];
  Object.defineProperty(arr, '0', { value: 999, writable: true, enumerable: false, configurable: true });
  const r = deepCopy(arr);
  expect(r.ok).toBe(false);
});

// deepFreeze cycle safety
test('ownership: deepFreeze handles cyclic structures without stack overflow', () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  let result: unknown;
  expect(() => {
    result = deepFreeze(obj);
  }).not.toThrow();
  expect(Object.isFrozen(result)).toBe(true);
});

test('ownership: deepFreeze handles cyclic arrays', () => {
  const arr: unknown[] = [1];
  (arr as unknown as Record<string, unknown>)[1] = arr;
  let result: unknown;
  expect(() => {
    result = deepFreeze(arr);
  }).not.toThrow();
  expect(Object.isFrozen(result)).toBe(true);
});

// validateJsonValue strict JSON
test('ownership: validateJsonValue accepts valid JSON', () => {
  const r = validateJsonValue({ a: [1, 2, null, true, 'x'] });
  expect(r.ok).toBe(true);
});

test('ownership: deepCopy preserves __proto__ as own data key', () => {
  const src = JSON.parse('{"__proto__":{"x":1}}') as Record<string, unknown>;
  const r = deepCopy(src);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(Object.prototype.hasOwnProperty.call(r.value, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(r.value)).toBe(Object.prototype);
  }
});

test('ownership: validateJsonValue preserves __proto__ as own data key', () => {
  const src = JSON.parse('{"__proto__":{"x":1}}') as unknown;
  const r = validateJsonValue(src);
  expect(r.ok).toBe(true);
  if (r.ok && r.value !== null && typeof r.value === 'object' && !Array.isArray(r.value)) {
    expect(Object.prototype.hasOwnProperty.call(r.value, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(r.value)).toBe(Object.prototype);
  }
});

test('ownership: validateJsonValue rejects undefined', () => {
  const r = validateJsonValue({ a: undefined });
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects NaN', () => {
  const r = validateJsonValue(NaN);
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects Infinity', () => {
  const r = validateJsonValue(Infinity);
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects -Infinity', () => {
  const r = validateJsonValue(-Infinity);
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects functions', () => {
  const r = validateJsonValue(() => 1);
  expect(r.ok).toBe(false);
});

test('ownership: validateJsonValue rejects lone surrogate in string value', () => {
  const r = validateJsonValue('\ud800');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe('E_JSON_VALUE_INVALID');
});

test('ownership: validateJsonValue rejects lone surrogate in object key', () => {
  const obj: Record<string, unknown> = {};
  Object.defineProperty(obj, '\ud800', { value: 1, enumerable: true, writable: true, configurable: true });
  const r = validateJsonValue(obj);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe('E_JSON_VALUE_INVALID');
});

// STANDARD_TEMPORAL_FIELDS frozen at runtime
test('ownership: STANDARD_TEMPORAL_FIELDS is frozen at runtime', () => {
  expect(Object.isFrozen(STANDARD_TEMPORAL_FIELDS)).toBe(true);
  expect(() => {
    (STANDARD_TEMPORAL_FIELDS as string[]).push('X');
  }).toThrow();
});

// Iterative traversal and memoisation (#45)
test('ownership: deeply nested objects do not exhaust the stack', () => {
  const depth = 20_000;
  let nested: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < depth; i += 1) nested = { next: nested };

  expect(validateJsonValue(nested).ok).toBe(true);

  const copied = deepCopy(nested);
  expect(copied.ok).toBe(true);
  const frozen = deepFreeze(copied.ok ? copied.value : {});

  let node: unknown = frozen;
  let steps = 0;
  while (typeof node === 'object' && node !== null && 'next' in node) {
    node = (node as Record<string, unknown>).next;
    steps += 1;
  }
  expect(steps).toBe(depth);
  expect(Object.isFrozen(node)).toBe(true);
});

test('ownership: deeply nested arrays do not exhaust the stack', () => {
  const depth = 20_000;
  let nested: unknown[] = [1];
  for (let i = 0; i < depth; i += 1) nested = [nested];

  expect(validateJsonValue(nested).ok).toBe(true);
  const copied = deepCopy(nested);
  expect(copied.ok).toBe(true);

  let node: unknown = copied.ok ? copied.value : null;
  let steps = 0;
  while (Array.isArray(node) && Array.isArray(node[0])) {
    node = node[0];
    steps += 1;
  }
  expect(steps).toBe(depth);
});

test('ownership: shared subtrees cost work linear in distinct nodes, not in paths', () => {
  const depth = 24;
  let shared: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < depth; i += 1) shared = { left: shared, right: shared };

  const started = performance.now();
  const copied = deepCopy(shared);
  const validated = validateJsonValue(shared);
  const elapsed = performance.now() - started;

  expect(copied.ok).toBe(true);
  expect(validated.ok).toBe(true);
  // Work proportional to 2^depth paths would not finish; distinct-node work does.
  expect(elapsed).toBeLessThan(1_500);

  const seen = new Set<unknown>();
  const stack: unknown[] = copied.ok ? [copied.value] : [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current !== 'object' || current === null || seen.has(current)) continue;
    seen.add(current);
    for (const value of Object.values(current)) stack.push(value);
  }
  expect(seen.size).toBeGreaterThanOrEqual(depth + 1);
  expect(seen.size).toBeLessThanOrEqual(2 * depth + 2);
});

// Type-level: DeepReadonly applies recursively (compile-time check).
const _typeCheck: DeepReadonly<{ a: { b: number[] } }> = { a: { b: [1, 2] } };
void _typeCheck;

// Type-level negative assertions (must fail to compile; @ts-expect-error ensures they do).
const _ro: DeepReadonly<{ a: { b: number } }> = { a: { b: 1 } };
// @ts-expect-error intentional type error
_ro.a = { b: 2 };
// @ts-expect-error intentional type error
_ro.a.b = 2;

const _roArr: DeepReadonly<{ a: number[] }> = { a: [1, 2] };
// @ts-expect-error intentional type error
_roArr.a[0] = 9;
// @ts-expect-error intentional type error
_roArr.a.push(3);
