// Ownership and immutability utilities for UIA-CORE-001 Rev 0.3.3.
//
// Global Constraint 5: deep copy on construction, recursive deep freeze,
// reject unsupported structures, unknown-boundary validation helper.

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
  const seen = new WeakSet<object>();

  function copy(input: unknown): Result<unknown> {
    if (input === null) return { ok: true, value: null };
    const t = typeof input;
    if (t === 'undefined' || t === 'string' || t === 'number' || t === 'boolean') {
      return { ok: true, value: input };
    }
    if (t === 'bigint' || t === 'symbol' || t === 'function') {
      return rejectUnsupported(`Unsupported value type: ${t}`);
    }
    if (Array.isArray(input)) {
      if (Object.getPrototypeOf(input) !== Array.prototype) {
        return rejectUnsupported('Array must have Array.prototype');
      }
      const ownKeys = Object.getOwnPropertyNames(input);
      const symbols = Object.getOwnPropertySymbols(input);
      if (symbols.length > 0) {
        return rejectUnsupported('Array must not have symbol-keyed properties');
      }
      for (const key of ownKeys) {
        if (key === 'length') continue;
        if (!/^\d+$/.test(key)) {
          return rejectUnsupported(`Array must not have non-index own property: ${key}`);
        }
      }
      if (seen.has(input)) {
        return rejectUnsupported('Cyclic reference detected');
      }
      seen.add(input);
      const out: unknown[] = [];
      for (let i = 0; i < input.length; i++) {
        const r = copy(input[i]);
        if (!r.ok) {
          seen.delete(input);
          return r;
        }
        out[i] = r.value;
      }
      seen.delete(input);
      return { ok: true, value: out };
    }
    if (isPlainObject(input)) {
      const ownKeys = Object.getOwnPropertyNames(input);
      const symbols = Object.getOwnPropertySymbols(input);
      if (symbols.length > 0) {
        return rejectUnsupported('Object must not have symbol-keyed properties');
      }
      for (const key of ownKeys) {
        const desc = Object.getOwnPropertyDescriptor(input, key);
        if (!desc) continue;
        if (desc.get !== undefined || desc.set !== undefined) {
          return rejectUnsupported(`Accessor property not allowed: ${key}`);
        }
        if (!desc.enumerable) {
          return rejectUnsupported(`Non-enumerable property not allowed: ${key}`);
        }
      }
      if (seen.has(input)) {
        return rejectUnsupported('Cyclic reference detected');
      }
      seen.add(input);
      const out: Record<string, unknown> = {};
      for (const key of ownKeys) {
        const r = copy(input[key]);
        if (!r.ok) {
          seen.delete(input);
          return r;
        }
        out[key] = r.value;
      }
      seen.delete(input);
      return { ok: true, value: out };
    }
    // null handled above; any other object (Date, Map, Set, class instance, null-proto) rejected
    return rejectUnsupported('Unsupported object: prototype must be Object.prototype');
  }

  const result = copy(value);
  if (!result.ok) return result as Result<T>;
  return { ok: true, value: result.value as T };
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== 'object') {
    return value as DeepReadonly<T>;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  Object.freeze(value);
  return value as DeepReadonly<T>;
}

export function validateUnknown<T>(value: unknown, guard: (v: unknown) => v is T): Result<T> {
  if (guard(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    error: {
      kind: 'MECHANISM',
      code: UNKNOWN_BOUNDARY_REJECTED,
      message: 'Input failed validation at the unknown boundary',
    },
  };
}

// Re-export commonly needed types for convenience (type-only).
export type { JsonValue, TemporalFieldRef } from './primitives.js';
