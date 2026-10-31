// Shared boundary-validation helpers.
//
// A helper duplicated per module drifts: an identifier rejected by one entry
// point was accepted by another (#48). The string helpers and the mechanism
// rejection live in one internal module; it is not part of the package barrel.

import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { JsonValue } from './primitives.js';

/** `E_UNKNOWN_BOUNDARY_REJECTED` with a path-qualified message. */
export function invalidInput(path: string, message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', `${path}: ${message}`) };
}

export function requireString(value: JsonValue | undefined, path: string): Result<string> {
  if (typeof value !== 'string') {
    return invalidInput(path, 'expected string');
  }
  return { ok: true, value };
}

export function requireNonEmptyString(value: JsonValue | undefined, path: string): Result<string> {
  const result = requireString(value, path);
  if (!result.ok) {
    return result;
  }
  if (result.value.length === 0) {
    return invalidInput(path, 'expected non-empty string');
  }
  return result;
}
