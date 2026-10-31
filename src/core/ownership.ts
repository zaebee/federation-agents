// Ownership and immutability utilities for UIA-CORE-001 Rev 0.3.3.
//
// Global Constraint 5: deep copy on construction, recursive deep freeze,
// reject unsupported structures, unknown-boundary validation helper.
//
// Generic ownership copying (deepCopy) is NOT automatically strict JSON
// validation. Strict JSON validation is provided separately by
// validateJsonValue (below) and must be invoked where the specification
// requires a JSON value. Do not conflate the two.
//
// All three walks are iterative. A boundary that accepts untrusted input is
// exactly where deeply nested values arrive, so nesting depth must not be able
// to exhaust the call stack: depth is data, not control flow. Completed
// sub-results are memoised by source identity, so a subtree shared between
// several parents is copied/validated once rather than once per path to it;
// a back edge to a node on the current path is still rejected as a cycle.

import type { JsonValue } from './primitives.js';
import { hasLoneSurrogate } from './primitives.js';
import type { Failure, Result } from './errors.js';
import { mechanismFailure } from './errors.js';

// Primitive types (including branded strings and numbers) are returned as-is;
// mapping them would turn a branded ID into a structural object type.
export type DeepReadonly<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends (infer A)[]
    ? readonly DeepReadonly<A>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

const OWNERSHIP_UNSUPPORTED = 'E_OWNERSHIP_UNSUPPORTED' as const;
const UNKNOWN_BOUNDARY_REJECTED = 'E_UNKNOWN_BOUNDARY_REJECTED' as const;

function rejectUnsupported(message: string): Result<never> {
  return { ok: false, error: mechanismFailure(OWNERSHIP_UNSUPPORTED, message) };
}

function ownershipFailure(message: string): Failure {
  return mechanismFailure(OWNERSHIP_UNSUPPORTED, message);
}

function jsonFailure(message: string): Failure {
  return mechanismFailure('E_JSON_VALUE_INVALID', message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

// ---------------------------------------------------------------------------
// Iterative deep copy
// ---------------------------------------------------------------------------

interface CopyFrame {
  readonly source: object;
  readonly target: Record<string, unknown> | unknown[];
  readonly keys: readonly string[];
  next: number;
}

// A value that has already been resolved: a finished copy, a frame that still
// needs its children appended, or a rejection.
type PreparedCopy =
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'frame'; readonly frame: CopyFrame }
  | { readonly kind: 'error'; readonly error: Failure };

function validateArrayOwnKeys(input: unknown[]): Result<void> {
  const symbols = Object.getOwnPropertySymbols(input);
  if (symbols.length > 0) {
    return rejectUnsupported('Array must not have symbol-keyed properties');
  }
  const ownKeys = Object.getOwnPropertyNames(input);
  const indexSet = new Set<string>();
  for (const key of ownKeys) {
    if (key === 'length') continue;
    const num = Number(key);
    if (!/^\d+$/.test(key) || String(num) !== key || num >= input.length) {
      return rejectUnsupported(`Array must not have non-index own property: ${key}`);
    }
    indexSet.add(key);
  }
  for (let i = 0; i < input.length; i++) {
    if (!indexSet.has(String(i))) {
      return rejectUnsupported(`Sparse array: missing index ${i}`);
    }
  }
  for (let i = 0; i < input.length; i++) {
    const desc = Object.getOwnPropertyDescriptor(input, String(i));
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable || !('value' in desc)) {
      return rejectUnsupported(`Invalid property descriptor at index ${i}`);
    }
  }
  return { ok: true, value: undefined };
}

function arrayCopyFrame(source: unknown[]): Result<CopyFrame> {
  if (Object.getPrototypeOf(source) !== Array.prototype) {
    return rejectUnsupported('Array must have Array.prototype');
  }
  const keyResult = validateArrayOwnKeys(source);
  if (!keyResult.ok) return keyResult as Result<CopyFrame>;
  const keys: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    keys.push(String(index));
  }
  return { ok: true, value: { source, target: [], keys, next: 0 } };
}

function objectCopyFrame(source: Record<string, unknown>): Result<CopyFrame> {
  if (Object.getOwnPropertySymbols(source).length > 0) {
    return rejectUnsupported('Object must not have symbol-keyed properties');
  }
  const keys = Object.getOwnPropertyNames(source);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined || !descriptor.enumerable) {
      return rejectUnsupported(`Invalid property descriptor: ${key}`);
    }
  }
  return { ok: true, value: { source, target: {}, keys, next: 0 } };
}

function prepareCopy(input: unknown, active: Set<object>, memo: Map<object, unknown>): PreparedCopy {
  if (input === null) return { kind: 'value', value: null };
  const type = typeof input;
  if (type === 'undefined' || type === 'string' || type === 'number' || type === 'boolean') {
    return { kind: 'value', value: input };
  }
  if (type !== 'object') {
    return { kind: 'error', error: ownershipFailure(`Unsupported value type: ${type}`) };
  }

  const source = input as object;
  let frame: Result<CopyFrame>;
  if (Array.isArray(source)) {
    frame = arrayCopyFrame(source);
  } else if (isPlainObject(source)) {
    frame = objectCopyFrame(source);
  } else {
    return { kind: 'error', error: ownershipFailure('Unsupported object: prototype must be Object.prototype') };
  }
  if (!frame.ok) return { kind: 'error', error: frame.error };

  if (active.has(source)) {
    return { kind: 'error', error: ownershipFailure('Cyclic reference detected') };
  }
  if (memo.has(source)) {
    return { kind: 'value', value: memo.get(source) };
  }
  active.add(source);
  return { kind: 'frame', frame: frame.value };
}

function assignEntry(
  target: Record<string, unknown> | unknown[] | Record<string, JsonValue> | JsonValue[],
  key: string,
  value: unknown,
): void {
  if (Array.isArray(target)) {
    (target as unknown[])[Number(key)] = value;
    return;
  }
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

export function deepCopy<T>(value: T): Result<T> {
  const active = new Set<object>();
  const memo = new Map<object, unknown>();
  const root = prepareCopy(value, active, memo);
  if (root.kind === 'error') return { ok: false, error: root.error };
  if (root.kind === 'value') return { ok: true, value: root.value as T };

  const stack: CopyFrame[] = [root.frame];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next >= frame.keys.length) {
      memo.set(frame.source, frame.target);
      active.delete(frame.source);
      stack.pop();
      continue;
    }
    const key = frame.keys[frame.next];
    frame.next += 1;
    const child = prepareCopy((frame.source as Record<string, unknown>)[key], active, memo);
    if (child.kind === 'error') return { ok: false, error: child.error };
    assignEntry(frame.target, key, child.kind === 'value' ? child.value : child.frame.target);
    if (child.kind === 'frame') stack.push(child.frame);
  }
  return { ok: true, value: root.frame.target as T };
}

// ---------------------------------------------------------------------------
// Iterative deep freeze (order is irrelevant: Object.freeze is shallow)
// ---------------------------------------------------------------------------

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  const visited = new WeakSet<object>();
  const pending: object[] = [];

  const enqueue = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object' || visited.has(candidate)) return;
    visited.add(candidate);
    pending.push(candidate);
  };

  enqueue(value);
  const reachable: object[] = [];
  while (pending.length > 0) {
    const current = pending.pop() as object;
    reachable.push(current);
    for (const key of Reflect.ownKeys(current)) {
      enqueue((current as Record<string | symbol, unknown>)[key]);
    }
  }
  for (const object of reachable) {
    Object.freeze(object);
  }
  return value as DeepReadonly<T>;
}

export function validateUnknown<T>(value: unknown, guard: (v: unknown) => v is T): Result<T> {
  if (!guard(value)) {
    return {
      ok: false,
      error: {
        kind: 'MECHANISM',
        code: UNKNOWN_BOUNDARY_REJECTED,
        message: 'Input failed validation at the unknown boundary',
      },
    };
  }
  // Establish ownership: copy + recursively freeze before returning.
  const copied = deepCopy(value);
  if (!copied.ok) {
    return copied as Result<T>;
  }
  const frozen = deepFreeze(copied.value);
  return { ok: true, value: frozen as T };
}

// ---------------------------------------------------------------------------
// Strict JSON validation (distinct from generic ownership copying).
// Rejects undefined, NaN, Infinity, -Infinity, functions, symbols, non-plain
// objects, sparse arrays, etc. Does not implement canonicalization (Task 3).
// ---------------------------------------------------------------------------

interface JsonFrame {
  readonly kind: 'array' | 'object';
  readonly source: object;
  readonly target: Record<string, JsonValue> | JsonValue[];
  readonly keys: readonly string[];
  next: number;
}

type PreparedJson =
  | { readonly kind: 'value'; readonly value: JsonValue }
  | { readonly kind: 'frame'; readonly frame: JsonFrame }
  | { readonly kind: 'error'; readonly error: Failure };

function validateJsonPrimitive(val: unknown): Result<JsonValue> | null {
  if (val === null) return { ok: true, value: null };
  const t = typeof val;
  if (t === 'boolean') return { ok: true, value: val as boolean };
  if (t === 'string') {
    if (hasLoneSurrogate(val as string)) {
      return { ok: false, error: jsonFailure('JsonValue string must not contain lone surrogates') };
    }
    return { ok: true, value: val as string };
  }
  if (t === 'number') {
    const n = val as number;
    if (!Number.isFinite(n)) {
      return { ok: false, error: jsonFailure('JsonValue number must be finite') };
    }
    return { ok: true, value: n };
  }
  return null;
}

function jsonObjectKeyFailure(source: Record<string, unknown>): Failure | null {
  for (const key of Object.getOwnPropertyNames(source)) {
    if (hasLoneSurrogate(key)) {
      return jsonFailure(`JsonValue object key must not contain lone surrogates: ${key}`);
    }
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
      return jsonFailure(`JsonValue object has invalid property: ${key}`);
    }
  }
  if (Object.getOwnPropertySymbols(source).length > 0) {
    return jsonFailure('JsonValue object must not have symbol properties');
  }
  return null;
}

function jsonArrayExtraFailure(source: unknown[]): Failure | null {
  for (const key of Object.getOwnPropertyNames(source)) {
    if (key === 'length') continue;
    const index = Number(key);
    if (!/^\d+$/.test(key) || String(index) !== key || index >= source.length) {
      return jsonFailure(`JsonValue array must not have extra property: ${key}`);
    }
  }
  if (Object.getOwnPropertySymbols(source).length > 0) {
    return jsonFailure('JsonValue array must not have symbol properties');
  }
  return null;
}

function jsonArrayFrame(source: unknown[]): JsonFrame {
  const keys: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    keys.push(String(index));
  }
  return { kind: 'array', source, target: [], keys, next: 0 };
}

function prepareJson(input: unknown, active: Set<object>, memo: Map<object, JsonValue>): PreparedJson {
  const primitive = validateJsonPrimitive(input);
  if (primitive !== null) {
    return primitive.ok ? { kind: 'value', value: primitive.value } : { kind: 'error', error: primitive.error };
  }
  if (typeof input !== 'object' || input === null) {
    return { kind: 'error', error: jsonFailure(`Unsupported JsonValue type: ${typeof input}`) };
  }

  const source = input as object;
  const isArray = Array.isArray(source);
  if (isArray) {
    if (Object.getPrototypeOf(source) !== Array.prototype) {
      return { kind: 'error', error: jsonFailure('JsonValue array must have Array.prototype') };
    }
  } else if (!isPlainObject(source)) {
    return { kind: 'error', error: jsonFailure(`Unsupported JsonValue type: ${typeof input}`) };
  }

  if (active.has(source)) {
    return { kind: 'error', error: jsonFailure('Cyclic reference detected in JsonValue') };
  }
  if (memo.has(source)) {
    return { kind: 'value', value: memo.get(source) as JsonValue };
  }
  if (!isArray) {
    const keyFailure = jsonObjectKeyFailure(source);
    if (keyFailure !== null) return { kind: 'error', error: keyFailure };
  }
  active.add(source);
  const frame: JsonFrame = isArray
    ? jsonArrayFrame(source as unknown[])
    : {
        kind: 'object',
        source,
        target: {},
        keys: Object.getOwnPropertyNames(source),
        next: 0,
      };
  return { kind: 'frame', frame };
}

function prepareJsonChild(
  frame: JsonFrame,
  key: string,
  active: Set<object>,
  memo: Map<object, JsonValue>,
): PreparedJson {
  if (frame.kind === 'array') {
    const desc = Object.getOwnPropertyDescriptor(frame.source, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable || !('value' in desc)) {
      return { kind: 'error', error: jsonFailure(`JsonValue sparse/invalid array at index ${key}`) };
    }
    return prepareJson(desc.value, active, memo);
  }
  return prepareJson((frame.source as Record<string, unknown>)[key], active, memo);
}

export function validateJsonValue(value: unknown): Result<JsonValue> {
  const active = new Set<object>();
  const memo = new Map<object, JsonValue>();
  const root = prepareJson(value, active, memo);
  if (root.kind === 'error') return { ok: false, error: root.error };
  if (root.kind === 'value') return { ok: true, value: root.value };

  const stack: JsonFrame[] = [root.frame];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next >= frame.keys.length) {
      if (frame.kind === 'array') {
        const extraFailure = jsonArrayExtraFailure(frame.source as unknown[]);
        if (extraFailure !== null) return { ok: false, error: extraFailure };
      }
      memo.set(frame.source, frame.target as JsonValue);
      active.delete(frame.source);
      stack.pop();
      continue;
    }
    const key = frame.keys[frame.next];
    frame.next += 1;
    const child = prepareJsonChild(frame, key, active, memo);
    if (child.kind === 'error') return { ok: false, error: child.error };
    assignEntry(frame.target, key, child.kind === 'value' ? child.value : child.frame.target);
    if (child.kind === 'frame') stack.push(child.frame);
  }
  return { ok: true, value: root.frame.target as JsonValue };
}
