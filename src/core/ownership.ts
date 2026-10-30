// Ownership and immutability utilities for UIA-CORE-001 Rev 0.3.3.
//
// Global Constraint 5: deep copy on construction, recursive deep freeze,
// reject unsupported structures, unknown-boundary validation helper.
//
// Generic ownership copying (deepCopy) is NOT automatically strict JSON
// validation. Strict JSON validation is provided separately by
// validateJsonValue (below) and must be invoked where the specification
// requires a JSON value. Do not conflate the two.

import type { JsonValue } from './primitives.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';

export type DeepReadonly<T> = T extends (infer A)[]
  ? readonly DeepReadonly<A>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

const OWNERSHIP_UNSUPPORTED = 'E_OWNERSHIP_UNSUPPORTED' as const;
const UNKNOWN_BOUNDARY_REJECTED = 'E_UNKNOWN_BOUNDARY_REJECTED' as const;

function rejectUnsupported(message: string): Result<never> {
  return { ok: false, error: mechanismFailure(OWNERSHIP_UNSUPPORTED, message) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export function deepCopy<T>(value: T): Result<T> {
  const result = copyValue(value, new WeakSet<object>());
  if (!result.ok) return result as Result<T>;
  return { ok: true, value: result.value as T };
}

function copyValue(input: unknown, seen: WeakSet<object>): Result<unknown> {
  if (input === null) return { ok: true, value: null };
  const t = typeof input;
  if (t === 'undefined' || t === 'string' || t === 'number' || t === 'boolean') {
    return { ok: true, value: input };
  }
  if (t === 'bigint' || t === 'symbol' || t === 'function') {
    return rejectUnsupported(`Unsupported value type: ${t}`);
  }
  if (Array.isArray(input)) {
    return copyArray(input, seen);
  }
  if (isPlainObject(input)) {
    return copyObject(input, seen);
  }
  return rejectUnsupported('Unsupported object: prototype must be Object.prototype');
}

function copyArray(input: unknown[], seen: WeakSet<object>): Result<unknown> {
  if (Object.getPrototypeOf(input) !== Array.prototype) {
    return rejectUnsupported('Array must have Array.prototype');
  }
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
  if (seen.has(input)) {
    return rejectUnsupported('Cyclic reference detected');
  }
  seen.add(input);
  const out: unknown[] = [];
  for (let i = 0; i < input.length; i++) {
    const r = copyValue(input[i], seen);
    if (!r.ok) {
      seen.delete(input);
      return r;
    }
    out[i] = r.value;
  }
  seen.delete(input);
  return { ok: true, value: out };
}

function copyObject(input: Record<string, unknown>, seen: WeakSet<object>): Result<unknown> {
  const ownKeys = Object.getOwnPropertyNames(input);
  const symbols = Object.getOwnPropertySymbols(input);
  if (symbols.length > 0) {
    return rejectUnsupported('Object must not have symbol-keyed properties');
  }
  for (const key of ownKeys) {
    const desc = Object.getOwnPropertyDescriptor(input, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
      return rejectUnsupported(`Invalid property descriptor: ${key}`);
    }
  }
  if (seen.has(input)) {
    return rejectUnsupported('Cyclic reference detected');
  }
  seen.add(input);
  const out: Record<string, unknown> = {};
  for (const key of ownKeys) {
    const r = copyValue(input[key], seen);
    if (!r.ok) {
      seen.delete(input);
      return r;
    }
    out[key] = r.value;
  }
  seen.delete(input);
  return { ok: true, value: out };
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  const seen = new WeakSet<object>();

  function freeze(val: unknown): void {
    if (val === null || typeof val !== 'object') {
      return;
    }
    if (seen.has(val)) {
      return;
    }
    seen.add(val);
    for (const key of Reflect.ownKeys(val as object)) {
      freeze((val as Record<string | symbol, unknown>)[key]);
    }
    Object.freeze(val);
  }

  freeze(value);
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

// Strict JSON validation (distinct from generic ownership copying).
// Rejects undefined, NaN, Infinity, -Infinity, functions, symbols, non-plain
// objects, sparse arrays, etc. Does not implement canonicalization (Task 3).
export function validateJsonValue(value: unknown): Result<JsonValue> {
  const seen = new WeakSet<object>();

  function validate(val: unknown): Result<JsonValue> {
    if (val === null) return { ok: true, value: null };
    const t = typeof val;
    if (t === 'boolean') return { ok: true, value: val as boolean };
    if (t === 'string') return { ok: true, value: val as string };
    if (t === 'number') {
      const n = val as number;
      if (!Number.isFinite(n)) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue number must be finite'),
        };
      }
      return { ok: true, value: n };
    }
    if (Array.isArray(val)) {
      if (Object.getPrototypeOf(val) !== Array.prototype) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue array must have Array.prototype'),
        };
      }
      if (seen.has(val)) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'Cyclic reference detected in JsonValue'),
        };
      }
      seen.add(val);
      const out: JsonValue[] = [];
      for (let i = 0; i < val.length; i++) {
        const desc = Object.getOwnPropertyDescriptor(val, String(i));
        if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
          seen.delete(val);
          return {
            ok: false,
            error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue sparse/invalid array at index ${i}`),
          };
        }
        const r = validate(val[i]);
        if (!r.ok) {
          seen.delete(val);
          return r as Result<JsonValue>;
        }
        out.push(r.value);
      }
      for (const key of Object.getOwnPropertyNames(val)) {
        if (key === 'length') continue;
        const num = Number(key);
        if (!/^\d+$/.test(key) || String(num) !== key || num >= val.length) {
          seen.delete(val);
          return {
            ok: false,
            error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue array must not have extra property: ${key}`),
          };
        }
      }
      if (Object.getOwnPropertySymbols(val).length > 0) {
        seen.delete(val);
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue array must not have symbol properties'),
        };
      }
      seen.delete(val);
      return { ok: true, value: out };
    }
    if (isPlainObject(val)) {
      if (seen.has(val)) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'Cyclic reference detected in JsonValue'),
        };
      }
      seen.add(val);
      const ownKeys = Object.getOwnPropertyNames(val);
      for (const key of ownKeys) {
        const desc = Object.getOwnPropertyDescriptor(val, key);
        if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
          seen.delete(val);
          return {
            ok: false,
            error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue object has invalid property: ${key}`),
          };
        }
      }
      if (Object.getOwnPropertySymbols(val).length > 0) {
        seen.delete(val);
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue object must not have symbol properties'),
        };
      }
      const out: { [key: string]: JsonValue } = {};
      for (const key of ownKeys) {
        const r = validate(val[key]);
        if (!r.ok) {
          seen.delete(val);
          return r as Result<JsonValue>;
        }
        out[key] = r.value;
      }
      seen.delete(val);
      return { ok: true, value: out };
    }
    return {
      ok: false,
      error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `Unsupported JsonValue type: ${typeof val}`),
    };
  }

  return validate(value);
}
