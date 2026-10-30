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
  const seen = new WeakSet<object>();

  function copy(input: unknown): Result<unknown> {
    if (input === null) return { ok: true, value: null };
    const t = typeof input;
    if (t === 'undefined' || t === 'string' || t === 'number' || t === 'boolean') {
      // Generic ownership copy accepts these primitives as-is. Whether they
      // form a valid JsonValue is decided by validateJsonValue, not here.
      return { ok: true, value: input };
    }
    if (t === 'bigint' || t === 'symbol' || t === 'function') {
      return rejectUnsupported(`Unsupported value type: ${t}`);
    }
    if (Array.isArray(input)) {
      if (Object.getPrototypeOf(input) !== Array.prototype) {
        return rejectUnsupported('Array must have Array.prototype');
      }
      const symbols = Object.getOwnPropertySymbols(input);
      if (symbols.length > 0) {
        return rejectUnsupported('Array must not have symbol-keyed properties');
      }
      const ownKeys = Object.getOwnPropertyNames(input);
      // 'length' is allowed; every other own key must be a dense index.
      const indexSet = new Set<string>();
      for (const key of ownKeys) {
        if (key === 'length') continue;
        if (!/^\d+$/.test(key)) {
          return rejectUnsupported(`Array must not have non-index own property: ${key}`);
        }
        indexSet.add(key);
      }
      // Sparse array detection: every index 0..length-1 must be present.
      for (let i = 0; i < input.length; i++) {
        if (!indexSet.has(String(i))) {
          return rejectUnsupported(`Sparse array: missing index ${i}`);
        }
      }
      // Validate property descriptors for each index without invoking getters.
      for (let i = 0; i < input.length; i++) {
        const desc = Object.getOwnPropertyDescriptor(input, String(i));
        if (!desc) {
          return rejectUnsupported(`Missing descriptor at index ${i}`);
        }
        if (desc.get !== undefined || desc.set !== undefined) {
          return rejectUnsupported(`Accessor property not allowed at index ${i}`);
        }
        if (!desc.enumerable) {
          return rejectUnsupported(`Non-enumerable property not allowed at index ${i}`);
        }
        if (!('value' in desc)) {
          return rejectUnsupported(`Missing data value at index ${i}`);
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
  const seen = new WeakSet<object>();

  function freeze(val: unknown): void {
    if (val === null || typeof val !== 'object') {
      return;
    }
    if (seen.has(val)) {
      return;
    }
    seen.add(val);
    if (Array.isArray(val)) {
      for (const item of val) {
        freeze(item);
      }
    } else {
      for (const key of Object.keys(val as Record<string, unknown>)) {
        freeze((val as Record<string, unknown>)[key]);
      }
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
  if (value === null) return { ok: true, value: null };
  const t = typeof value;
  if (t === 'boolean') return { ok: true, value: value as boolean };
  if (t === 'string') return { ok: true, value: value as string };
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue number must be finite'),
      };
    }
    return { ok: true, value: n };
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      return {
        ok: false,
        error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue array must have Array.prototype'),
      };
    }
    const out: JsonValue[] = [];
    for (let i = 0; i < value.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(value, String(i));
      if (!desc || desc.get || desc.set || !desc.enumerable) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue sparse/invalid array at index ${i}`),
        };
      }
      const r = validateJsonValue(value[i]);
      if (!r.ok) return r as Result<JsonValue>;
      out.push(r.value);
    }
    // reject extra own props
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key === 'length') continue;
      if (!/^\d+$/.test(key)) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue array must not have extra property: ${key}`),
        };
      }
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return {
        ok: false,
        error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue array must not have symbol properties'),
      };
    }
    return { ok: true, value: out };
  }
  if (isPlainObject(value)) {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value)) {
      const r = validateJsonValue(value[key]);
      if (!r.ok) return r as Result<JsonValue>;
      out[key] = r.value;
    }
    // reject non-enumerable/accessor/symbol props (Object.keys only returns enumerable string keys,
    // but check descriptors anyway)
    for (const key of Object.getOwnPropertyNames(value)) {
      const desc = Object.getOwnPropertyDescriptor(value, key);
      if (!desc || desc.get || desc.set || !desc.enumerable) {
        return {
          ok: false,
          error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `JsonValue object has invalid property: ${key}`),
        };
      }
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return {
        ok: false,
        error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', 'JsonValue object must not have symbol properties'),
      };
    }
    return { ok: true, value: out };
  }
  return {
    ok: false,
    error: mechanismFailure('E_OWNERSHIP_UNSUPPORTED', `Unsupported JsonValue type: ${typeof value}`),
  };
}
