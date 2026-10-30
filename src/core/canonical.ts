// RFC 8785 (JCS) canonicalization for UIA-CORE-001.
//
// Provides deterministic JSON canonicalization over the strict JsonValue data
// model defined in primitives.ts, plus SHA-256 hashing of the UTF-8 bytes of
// the canonical string. Canonicalization, UTF-8 encoding and hashing are kept
// as separate steps (see canonicalSha256 for a convenience composition).

import type { JsonValue } from './primitives.js';
import { CanonicalizationError } from './errors.js';
import { sha256Hex } from './sha256.js';

// ---------------------------------------------------------------------------
// Validation (throws CanonicalizationError on any invalid input)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function hasLoneSurrogate(value: string): boolean {
  let i = 0;
  while (i < value.length) {
    const cp = value.codePointAt(i);
    if (cp === undefined) return true;
    if (cp >= 0xd800 && cp <= 0xdfff) return true;
    i += cp > 0xffff ? 2 : 1;
  }
  return false;
}

function validateString(value: string): void {
  if (hasLoneSurrogate(value)) {
    throw new CanonicalizationError('String contains lone surrogate or invalid Unicode');
  }
}

function validate(value: unknown, seen: WeakSet<object>): void {
  if (value === null) return;
  const t = typeof value;
  if (t === 'boolean') return;
  if (t === 'string') {
    validateString(value as string);
    return;
  }
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new CanonicalizationError('Non-finite number is not a valid JSON value');
    }
    return;
  }
  if (Array.isArray(value)) {
    validateArray(value, seen);
    return;
  }
  if (isPlainObject(value)) {
    validateObject(value, seen);
    return;
  }
  throw new CanonicalizationError(`Unsupported value type: ${t}`);
}

function validateArray(value: unknown[], seen: WeakSet<object>): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new CanonicalizationError('Array must have Array.prototype');
  }
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new CanonicalizationError('Array must not have symbol-keyed properties');
  }
  const ownKeys = Object.getOwnPropertyNames(value);
  const indexSet = new Set<string>();
  for (const key of ownKeys) {
    if (key === 'length') continue;
    const num = Number(key);
    if (!/^\d+$/.test(key) || String(num) !== key || num >= value.length) {
      throw new CanonicalizationError(`Array must not have non-index own property: ${key}`);
    }
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable || !('value' in desc)) {
      throw new CanonicalizationError(`Invalid property descriptor at index ${key}`);
    }
    indexSet.add(key);
  }
  for (let i = 0; i < value.length; i++) {
    if (!indexSet.has(String(i))) {
      throw new CanonicalizationError(`Sparse array: missing index ${i}`);
    }
  }
  if (seen.has(value)) {
    throw new CanonicalizationError('Cyclic reference detected');
  }
  seen.add(value);
  for (let i = 0; i < value.length; i++) {
    validate(value[i], seen);
  }
  seen.delete(value);
}

function validateObject(value: Record<string, unknown>, seen: WeakSet<object>): void {
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new CanonicalizationError('Object must have Object.prototype');
  }
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new CanonicalizationError('Object must not have symbol-keyed properties');
  }
  const ownKeys = Object.getOwnPropertyNames(value);
  for (const key of ownKeys) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
      throw new CanonicalizationError(`Invalid property descriptor: ${key}`);
    }
    validateString(key);
  }
  if (seen.has(value)) {
    throw new CanonicalizationError('Cyclic reference detected');
  }
  seen.add(value);
  for (const key of ownKeys) {
    validate(value[key], seen);
  }
  seen.delete(value);
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serialize(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(serialize).join(',') + ']';
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + serialize(value[k])).join(',') + '}';
  }
  throw new CanonicalizationError('Unsupported value during serialization');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function canonicalize(value: JsonValue): string {
  // Defensive validation even though the type is JsonValue: callers may cast.
  validate(value, new WeakSet<object>());
  return serialize(value);
}

export function canonicalSha256(value: JsonValue): string {
  return sha256Hex(new TextEncoder().encode(canonicalize(value)));
}
