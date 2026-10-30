// Versioned selector mechanism for UIA-CORE-001 §8.2.
//
// This grammar is an implementation mechanism, NOT normative protocol
// semantics (plan ambiguity A-1). Its version label is
// `uia-ref-selector@1`; any assessment or documentation quoting the grammar
// must identify it by that label.
//
// Supported forms: `=x`, `*`, and `&&`-joined comparators `> >= < <= ^ ~`.
// Range selectors are incompatible with CONTENT_HASH and OPAQUE_TAG and are
// reported as a MechanismFailure with S_SELECTOR_INCOMPATIBLE_SCHEME.

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

export interface SelectorComparator {
  readonly op: SelectorOperator;
  /** Version text for SEMVER_2, or the exact label text for the other schemes. */
  readonly text: string;
  /** Parsed form; present for SEMVER_2 comparators and absent for exact opaque labels. */
  readonly version?: SemVer;
}

export interface CompiledSelector {
  readonly mechanism: typeof SELECTOR_MECHANISM_VERSION;
  readonly scheme: VersionScheme;
  readonly kind: 'WILDCARD' | 'COMPARATORS';
  readonly comparators: readonly SelectorComparator[];
}

const OPERATORS: readonly SelectorOperator[] = ['>=', '<=', '=', '>', '<', '^', '~'];

const RANGE_OPERATORS: readonly SelectorOperator[] = ['>', '>=', '<', '<=', '^', '~'];

function syntaxFailure(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_SELECTOR_SYNTAX_INVALID', message) };
}

function incompatibleScheme(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('S_SELECTOR_INCOMPATIBLE_SCHEME', message) };
}

function freezeSelector(selector: CompiledSelector): CompiledSelector {
  return deepFreeze(selector);
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

function expandRange(op: '^' | '~', version: SemVer): Result<readonly SelectorComparator[]> {
  const upperText = upperBoundText(op, version);
  const upper = parseSemVer(upperText);
  if (upper === undefined) {
    return syntaxFailure(`Cannot compute a valid ${op} upper bound for ${version.text}`);
  }

  return {
    ok: true,
    value: [
      { op: '>=', text: version.text, version },
      { op: '<', text: upperText, version: upper },
    ],
  };
}

function parseComparatorSegment(segment: string, scheme: VersionScheme): Result<readonly SelectorComparator[]> {
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

  if (scheme !== 'SEMVER_2') {
    if (RANGE_OPERATORS.includes(op)) {
      return incompatibleScheme(
        `Selector ${op} is not compatible with ${scheme}; only exact match and wildcard are supported`,
      );
    }
    return { ok: true, value: [{ op: '=', text: operand }] };
  }

  const version = parseSemVer(operand);
  if (version === undefined) {
    return syntaxFailure(`Selector operand is not a SemVer 2.0.0 version: ${JSON.stringify(operand)}`);
  }

  if (op === '^' || op === '~') {
    return expandRange(op, version);
  }

  return { ok: true, value: [{ op, text: operand, version }] };
}

/**
 * Parses and validates a selector expression for a given version scheme.
 * The result is a frozen, owned record; parsing is separate from matching.
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

  const expression = value.trim();
  if (expression.length === 0) {
    return syntaxFailure('Selector must not be empty');
  }

  if (expression === '*') {
    return {
      ok: true,
      value: freezeSelector({
        mechanism: SELECTOR_MECHANISM_VERSION,
        scheme,
        kind: 'WILDCARD',
        comparators: [],
      }),
    };
  }

  const segments = expression.split('&&').map((segment) => segment.trim());
  if (segments.some((segment) => segment.length === 0)) {
    return syntaxFailure('Selector must not contain empty && segments');
  }

  const comparators: SelectorComparator[] = [];
  for (const segment of segments) {
    const parsed = parseComparatorSegment(segment, scheme);
    if (!parsed.ok) {
      return parsed;
    }
    comparators.push(...parsed.value);
  }

  if (scheme !== 'SEMVER_2' && (comparators.length !== 1 || comparators[0].op !== '=')) {
    return incompatibleScheme(`${scheme} supports only exact match and wildcard selectors`);
  }

  return {
    ok: true,
    value: freezeSelector({
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
 * Returns `false` for a scheme mismatch rather than matching across schemes.
 * Exact (`=`) comparison is full string identity, including build metadata;
 * all other operators use SemVer precedence, which ignores build metadata.
 */
export function selectorMatches(selector: CompiledSelector, label: VersionLabel): boolean {
  if (selector.scheme !== label.scheme) {
    return false;
  }
  if (selector.kind === 'WILDCARD') {
    return true;
  }

  if (selector.scheme !== 'SEMVER_2') {
    const exact = selector.comparators[0];
    return exact !== undefined && exact.op === '=' && label.label === exact.text;
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
