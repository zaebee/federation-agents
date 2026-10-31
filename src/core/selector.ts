// Versioned selector mechanism for UIA-CORE-001 §8.2.
//
// This grammar is an implementation mechanism, NOT normative protocol
// semantics (plan ambiguity A-1). Its version label is
// `uia-ref-selector@1`; any assessment or documentation quoting the grammar
// must identify it by that label.
//
// SemVer selectors support `=x`, `*`, and `&&`-joined comparators
// `> >= < <= ^ ~`. CONTENT_HASH and OPAQUE_TAG support `*` and `=label`, where
// the label is taken verbatim so every valid label round-trips; range
// selectors are reported as a MechanismFailure with
// S_SELECTOR_INCOMPATIBLE_SCHEME.

import type { VersionScheme } from './entities.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import { deepFreeze } from './ownership.js';
import { hasLoneSurrogate } from './primitives.js';
import {
  compareSemVer,
  incrementDecimal,
  isVersionScheme,
  parseSemVer,
  type SemVer,
  type VersionLabel,
} from './version-scheme.js';

export const SELECTOR_MECHANISM_VERSION = 'uia-ref-selector@1' as const;

export type SelectorOperator = '=' | '>' | '>=' | '<' | '<=' | '^' | '~';

const COMPILED_SELECTOR_BRAND: unique symbol = Symbol('uia-ref-selector@1');

/** Raised when a value not produced by `compileSelector` reaches `selectorMatches`. */
export class InvalidCompiledSelectorError extends Error {
  constructor(message = 'CompiledSelector must be produced by compileSelector') {
    super(message);
    this.name = 'InvalidCompiledSelectorError';
  }
}

export interface SelectorComparator {
  readonly op: SelectorOperator;
  /** Version text for SEMVER_2, or the exact label text for the other schemes. */
  readonly text: string;
  /** Parsed form; present for SEMVER_2 comparators and absent for exact opaque labels. */
  readonly version?: SemVer;
}

export interface CompiledSelector {
  readonly [COMPILED_SELECTOR_BRAND]: true;
  readonly mechanism: typeof SELECTOR_MECHANISM_VERSION;
  readonly scheme: VersionScheme;
  readonly kind: 'WILDCARD' | 'COMPARATORS';
  readonly comparators: readonly SelectorComparator[];
}

const OPERATORS: readonly SelectorOperator[] = ['>=', '<=', '=', '>', '<', '^', '~'];

const RANGE_PREFIXES: ReadonlySet<string> = new Set(['>', '<', '^', '~']);

function syntaxFailure(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_SELECTOR_SYNTAX_INVALID', message) };
}

function incompatibleScheme(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('S_SELECTOR_INCOMPATIBLE_SCHEME', message) };
}

function brandedSelector(fields: {
  readonly mechanism: typeof SELECTOR_MECHANISM_VERSION;
  readonly scheme: VersionScheme;
  readonly kind: 'WILDCARD' | 'COMPARATORS';
  readonly comparators: readonly SelectorComparator[];
}): CompiledSelector {
  const selector = { ...fields } as unknown as CompiledSelector;
  Object.defineProperty(selector, COMPILED_SELECTOR_BRAND, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  return deepFreeze(selector);
}

function assertCompiledSelector(selector: CompiledSelector): void {
  if (
    selector === null ||
    typeof selector !== 'object' ||
    (selector as unknown as Record<symbol, unknown>)[COMPILED_SELECTOR_BRAND] !== true
  ) {
    throw new InvalidCompiledSelectorError();
  }
}

function wildcardSelector(scheme: VersionScheme): CompiledSelector {
  return brandedSelector({
    mechanism: SELECTOR_MECHANISM_VERSION,
    scheme,
    kind: 'WILDCARD',
    comparators: [],
  });
}

function exactSelector(scheme: VersionScheme, label: string): CompiledSelector {
  return brandedSelector({
    mechanism: SELECTOR_MECHANISM_VERSION,
    scheme,
    kind: 'COMPARATORS',
    comparators: [{ op: '=', text: label }],
  });
}

function splitOperator(segment: string): { readonly op: SelectorOperator; readonly operand: string } | undefined {
  for (const op of OPERATORS) {
    if (segment.startsWith(op)) {
      return { op, operand: segment.slice(op.length) };
    }
  }
  return undefined;
}

function upperBoundText(op: '^' | '~', version: SemVer): string {
  if (op === '~') {
    return `${version.major}.${incrementDecimal(version.minor)}.0`;
  }
  if (version.major !== '0') {
    return `${incrementDecimal(version.major)}.0.0`;
  }
  if (version.minor !== '0') {
    return `0.${incrementDecimal(version.minor)}.0`;
  }
  return `0.0.${incrementDecimal(version.patch)}`;
}

/** Builds a release-version bound from text produced by `upperBoundText`. */
function upperBoundVersion(text: string): SemVer {
  const [major, minor, patch] = text.split('.');
  return Object.freeze({ text, major, minor, patch, prerelease: Object.freeze([]), build: Object.freeze([]) });
}

function expandRange(op: '^' | '~', version: SemVer): readonly SelectorComparator[] {
  const upperText = upperBoundText(op, version);
  return [
    { op: '>=', text: version.text, version },
    { op: '<', text: upperText, version: upperBoundVersion(upperText) },
  ];
}

function parseSemverComparator(segment: string): Result<readonly SelectorComparator[]> {
  const split = splitOperator(segment);
  if (split === undefined) {
    return syntaxFailure(`Selector segment must start with an operator: ${JSON.stringify(segment)}`);
  }
  const { op, operand } = split;

  if (operand.length === 0) {
    return syntaxFailure(`Selector operator ${op} requires an operand`);
  }
  if (/\s/.test(operand)) {
    return syntaxFailure(`Selector operand must not contain whitespace: ${JSON.stringify(operand)}`);
  }

  const version = parseSemVer(operand);
  if (version === undefined) {
    return syntaxFailure(`Selector operand is not a SemVer 2.0.0 version: ${JSON.stringify(operand)}`);
  }

  if (op === '^' || op === '~') {
    return { ok: true, value: expandRange(op, version) };
  }

  return { ok: true, value: [{ op, text: operand, version }] };
}

/**
 * CONTENT_HASH and OPAQUE_TAG: `*` or `=label`, with the label taken exactly as
 * written. Splitting on `&&` and whitespace rejection are deliberately not
 * applied here, so any label accepted by `validateVersionLabel` round-trips.
 */
function compileNonSemverSelector(value: string, scheme: VersionScheme): Result<CompiledSelector> {
  if (value.trim() === '*') {
    return { ok: true, value: wildcardSelector(scheme) };
  }

  const probe = value.trimStart();
  if (probe.startsWith('=')) {
    const label = probe.slice(1);
    if (label.length === 0) {
      return syntaxFailure('Exact selector requires a label');
    }
    return { ok: true, value: exactSelector(scheme, label) };
  }

  if (RANGE_PREFIXES.has(probe.charAt(0))) {
    return incompatibleScheme(`${scheme} supports only exact match and wildcard selectors`);
  }

  return syntaxFailure(`Selector must be "*" or "=" followed by an exact label for ${scheme}`);
}

/**
 * Parses and validates a selector expression for a given version scheme.
 * The result is a frozen, owned record carrying a module-private runtime
 * brand; it cannot be reproduced from a plain object.
 */
export function compileSelector(value: unknown, scheme: VersionScheme): Result<CompiledSelector> {
  if (!isVersionScheme(scheme)) {
    return syntaxFailure(`Unknown version scheme: ${String(scheme)}`);
  }
  if (typeof value !== 'string') {
    return syntaxFailure('Selector must be a string');
  }
  if (hasLoneSurrogate(value)) {
    return syntaxFailure('Selector must not contain lone surrogates');
  }

  if (scheme !== 'SEMVER_2') {
    return compileNonSemverSelector(value, scheme);
  }

  const expression = value.trim();
  if (expression.length === 0) {
    return syntaxFailure('Selector must not be empty');
  }
  if (expression === '*') {
    return { ok: true, value: wildcardSelector(scheme) };
  }

  const segments = expression.split('&&').map((segment) => segment.trim());
  if (segments.some((segment) => segment.length === 0)) {
    return syntaxFailure('Selector must not contain empty && segments');
  }

  const comparators: SelectorComparator[] = [];
  for (const segment of segments) {
    const parsed = parseSemverComparator(segment);
    if (!parsed.ok) {
      return parsed;
    }
    comparators.push(...parsed.value);
  }

  return {
    ok: true,
    value: brandedSelector({
      mechanism: SELECTOR_MECHANISM_VERSION,
      scheme,
      kind: 'COMPARATORS',
      comparators,
    }),
  };
}

function matchesComparator(comparator: SelectorComparator, labelVersion: SemVer, labelText: string): boolean {
  if (comparator.op === '=') {
    return labelText === comparator.text;
  }
  if (comparator.version === undefined) {
    return false;
  }

  const order = compareSemVer(labelVersion, comparator.version);
  switch (comparator.op) {
    case '>':
      return order > 0;
    case '>=':
      return order >= 0;
    case '<':
      return order < 0;
    case '<=':
      return order <= 0;
    default:
      // `^` and `~` are expanded during compilation and never reach matching.
      return false;
  }
}

/**
 * Evaluates a compiled selector against a validated label.
 *
 * Throws `InvalidCompiledSelectorError` when the selector was not produced by
 * `compileSelector`; a forged object is never treated as a valid selector or
 * as a wildcard. Returns `false` for a scheme mismatch.
 *
 * Exact (`=`) comparison is full string identity, including build metadata;
 * all other operators use SemVer precedence, which ignores build metadata.
 */
export function selectorMatches(selector: CompiledSelector, label: VersionLabel): boolean {
  assertCompiledSelector(selector);

  if (selector.scheme !== label.scheme) {
    return false;
  }
  if (selector.kind === 'WILDCARD') {
    return true;
  }

  if (selector.scheme !== 'SEMVER_2') {
    const exact = selector.comparators[0];
    if (exact?.op !== '=') {
      return false;
    }
    return label.label === exact.text;
  }

  const labelVersion = parseSemVer(label.label);
  if (labelVersion === undefined) {
    return false;
  }

  for (const comparator of selector.comparators) {
    if (!matchesComparator(comparator, labelVersion, label.label)) {
      return false;
    }
  }
  return true;
}
