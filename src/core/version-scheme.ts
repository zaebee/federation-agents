// Version schemes for UIA-CORE-001 §3.2.
//
// SEMVER_2 follows Semantic Versioning 2.0.0 strictly.
// CONTENT_HASH and OPAQUE_TAG have only the normative rule "non-empty":
// A-7 (CONTENT_HASH label format) remains OPEN, and OPAQUE_TAG has no ordering
// semantics. Nothing here infers a format, digest length, or version order for
// those schemes.

import type { VersionScheme } from './entities.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import { hasLoneSurrogate } from './primitives.js';

export interface VersionLabel {
  readonly scheme: VersionScheme;
  readonly label: string;
}

export interface SemVer {
  /** Original label text; exact selectors compare this, not the parsed fields. */
  readonly text: string;
  /** Decimal digit strings without leading zeros, compared without Number precision loss. */
  readonly major: string;
  readonly minor: string;
  readonly patch: string;
  readonly prerelease: readonly string[];
  readonly build: readonly string[];
}

const VERSION_SCHEMES: readonly VersionScheme[] = ['SEMVER_2', 'CONTENT_HASH', 'OPAQUE_TAG'];

const NUMERIC_IDENTIFIER = /^(0|[1-9]\d*)$/;
const DIGITS = /^\d+$/;
const ALPHANUMERIC_IDENTIFIER = /^[0-9A-Za-z-]+$/;
const BUILD_IDENTIFIER = /^[0-9A-Za-z-]+$/;

export function isVersionScheme(value: unknown): value is VersionScheme {
  return typeof value === 'string' && (VERSION_SCHEMES as readonly string[]).includes(value);
}

function invalidLabel(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_VERSION_LABEL_INVALID', message) };
}

/**
 * Validates a version label for a given scheme and returns an owned, frozen
 * label record. The label is preserved verbatim: no trimming, normalization,
 * or format inference.
 */
export function validateVersionLabel(value: unknown, scheme: VersionScheme): Result<VersionLabel> {
  if (!isVersionScheme(scheme)) {
    return invalidLabel(`Unknown version scheme: ${String(scheme)}`);
  }
  if (typeof value !== 'string') {
    return invalidLabel('Version label must be a string');
  }
  if (hasLoneSurrogate(value)) {
    return invalidLabel('Version label must not contain lone surrogates');
  }

  if (scheme === 'SEMVER_2') {
    if (parseSemVer(value) === undefined) {
      return invalidLabel(`Invalid SemVer 2.0.0 label: ${JSON.stringify(value)}`);
    }
  } else if (value.length === 0) {
    return invalidLabel('Version label must not be empty');
  }

  return { ok: true, value: Object.freeze({ scheme, label: value }) };
}

/**
 * Strict Semantic Versioning 2.0.0 parser. Returns `undefined` for any input
 * that does not match the official grammar.
 */
export function parseSemVer(text: string): SemVer | undefined {
  const plusIndex = text.indexOf('+');
  const buildPart = plusIndex === -1 ? undefined : text.slice(plusIndex + 1);
  const coreAndPrerelease = plusIndex === -1 ? text : text.slice(0, plusIndex);

  if (buildPart !== undefined) {
    if (buildPart.length === 0 || buildPart.includes('+') || !buildIdentifiersValid(buildPart)) {
      return undefined;
    }
  }

  const dashIndex = coreAndPrerelease.indexOf('-');
  const prereleasePart = dashIndex === -1 ? undefined : coreAndPrerelease.slice(dashIndex + 1);
  const core = dashIndex === -1 ? coreAndPrerelease : coreAndPrerelease.slice(0, dashIndex);

  if (prereleasePart !== undefined && (prereleasePart.length === 0 || !prereleaseIdentifiersValid(prereleasePart))) {
    return undefined;
  }

  const coreParts = core.split('.');
  if (coreParts.length !== 3) {
    return undefined;
  }
  const [major, minor, patch] = coreParts;
  if (!NUMERIC_IDENTIFIER.test(major) || !NUMERIC_IDENTIFIER.test(minor) || !NUMERIC_IDENTIFIER.test(patch)) {
    return undefined;
  }

  return Object.freeze({
    text,
    major,
    minor,
    patch,
    prerelease: Object.freeze(prereleasePart === undefined ? [] : prereleasePart.split('.')),
    build: Object.freeze(buildPart === undefined ? [] : buildPart.split('.')),
  });
}

function prereleaseIdentifiersValid(value: string): boolean {
  for (const identifier of value.split('.')) {
    if (identifier.length === 0) {
      return false;
    }
    if (DIGITS.test(identifier)) {
      if (!NUMERIC_IDENTIFIER.test(identifier)) {
        return false;
      }
    } else if (!ALPHANUMERIC_IDENTIFIER.test(identifier)) {
      return false;
    }
  }
  return true;
}

function buildIdentifiersValid(value: string): boolean {
  for (const identifier of value.split('.')) {
    if (identifier.length === 0 || !BUILD_IDENTIFIER.test(identifier)) {
      return false;
    }
  }
  return true;
}

type Comparison = -1 | 0 | 1;

/** Compares two decimal digit strings (no leading zeros) without Number precision loss. */
function compareNumericIdentifiers(a: string, b: string): Comparison {
  if (a.length !== b.length) {
    return a.length < b.length ? -1 : 1;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function comparePrereleaseIdentifiers(a: string, b: string): Comparison {
  const aNumeric = DIGITS.test(a);
  const bNumeric = DIGITS.test(b);

  if (aNumeric && bNumeric) {
    return compareNumericIdentifiers(a, b);
  }
  if (aNumeric) {
    return -1;
  }
  if (bNumeric) {
    return 1;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function comparePrerelease(a: readonly string[], b: readonly string[]): Comparison {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1;
  }
  if (b.length === 0) {
    return -1;
  }

  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    const order = comparePrereleaseIdentifiers(a[i], b[i]);
    if (order !== 0) {
      return order;
    }
  }
  if (a.length === b.length) {
    return 0;
  }
  return a.length < b.length ? -1 : 1;
}

/**
 * SemVer 2.0.0 precedence. Build metadata is deliberately ignored, as the
 * specification requires.
 */
export function compareSemVer(a: SemVer, b: SemVer): Comparison {
  const majorOrder = compareNumericIdentifiers(a.major, b.major);
  if (majorOrder !== 0) return majorOrder;

  const minorOrder = compareNumericIdentifiers(a.minor, b.minor);
  if (minorOrder !== 0) return minorOrder;

  const patchOrder = compareNumericIdentifiers(a.patch, b.patch);
  if (patchOrder !== 0) return patchOrder;

  return comparePrerelease(a.prerelease, b.prerelease);
}

/**
 * Exact decimal-string increment. Used for `^` and `~` upper bounds; it never
 * converts a numeric identifier to a JavaScript number, so an "unsafe"
 * increment cannot occur and no bound is silently truncated.
 */
export function incrementDecimal(value: string): string {
  const digits = value.split('');
  let index = digits.length - 1;

  while (index >= 0 && digits[index] === '9') {
    digits[index] = '0';
    index -= 1;
  }
  if (index < 0) {
    return `1${digits.join('')}`;
  }
  digits[index] = String(Number(digits[index]) + 1);
  return digits.join('');
}
