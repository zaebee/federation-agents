// RFC 8785 (JCS) canonicalization for UIA-CORE-001.
//
// Provides deterministic JSON canonicalization over the strict JsonValue data
// model defined in primitives.ts, plus SHA-256 hashing of the UTF-8 bytes of
// the canonical string. Canonicalization, UTF-8 encoding and hashing are kept
// as separate steps (see canonicalSha256 for a convenience composition).

import type { JsonValue } from './primitives.js';
import { CanonicalizationError } from './errors.js';
import { sha256Hex } from './sha256.js';
import { validateJsonValue } from './ownership.js';

// ---------------------------------------------------------------------------
// Validation (delegated to ownership's strict JSON validator; CanonicalizationError
// is thrown instead of returning a Result, since canonicalize() returns string)
// ---------------------------------------------------------------------------

function validate(value: unknown): JsonValue {
  const result = validateJsonValue(value);
  if (!result.ok) {
    throw new CanonicalizationError(result.error.message);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serialize(value: JsonValue): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      parts.push(serialize(item));
    }
    return '[' + parts.join(',') + ']';
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ':' + serialize((value as Record<string, JsonValue>)[k]));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new CanonicalizationError('Unsupported value during serialization');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function canonicalize(value: JsonValue): string {
  // Defensive validation even though the type is JsonValue: callers may cast.
  // The serializer operates exclusively on the owned, validated representation.
  const validated = validate(value);
  return serialize(validated);
}

export function canonicalSha256(value: JsonValue): string {
  return sha256Hex(new TextEncoder().encode(canonicalize(value)));
}
