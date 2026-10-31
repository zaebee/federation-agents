import { describe, expect, test } from 'bun:test';
import type { VersionScheme } from '../../src/core/entities.js';
import {
  InvalidCompiledSelectorError,
  SELECTOR_MECHANISM_VERSION,
  compileSelector,
  selectorMatches,
  type CompiledSelector,
} from '../../src/core/selector.js';
import { validateVersionLabel, type VersionLabel } from '../../src/core/version-scheme.js';

function label(value: string, scheme: VersionScheme = 'SEMVER_2'): VersionLabel {
  const result = validateVersionLabel(value, scheme);
  if (!result.ok) {
    throw new Error(`fixture label must be valid: ${value} (${scheme}): ${result.error.message}`);
  }
  return result.value;
}

function selector(expression: string, scheme: VersionScheme = 'SEMVER_2'): CompiledSelector {
  const result = compileSelector(expression, scheme);
  if (!result.ok) {
    throw new Error(`fixture selector must be valid: ${expression} (${scheme}): ${result.error.message}`);
  }
  return result.value;
}

function matches(expression: string, value: string, scheme: VersionScheme = 'SEMVER_2'): boolean {
  return selectorMatches(selector(expression, scheme), label(value, scheme));
}

function compileFailure(expression: string, scheme: VersionScheme = 'SEMVER_2') {
  const result = compileSelector(expression, scheme);
  if (result.ok) {
    throw new Error(`expected selector ${JSON.stringify(expression)} to be rejected for ${scheme}`);
  }
  return result.error;
}

describe('compiled selector shape', () => {
  test('reports the mechanism version and scheme', () => {
    const compiled = selector('=1.2.3');

    expect(SELECTOR_MECHANISM_VERSION).toBe('uia-ref-selector@1');
    expect(compiled.mechanism).toBe('uia-ref-selector@1');
    expect(compiled.scheme).toBe('SEMVER_2');
    expect(compiled.kind).toBe('COMPARATORS');
  });

  test('wildcard compiles to a wildcard selector', () => {
    expect(selector('*').kind).toBe('WILDCARD');
    expect(selector(' * ').kind).toBe('WILDCARD');
  });

  test('freezes the compiled selector, comparators and parsed versions', () => {
    const compiled = selector('^1.2.3');

    expect(Object.isFrozen(compiled)).toBe(true);
    expect(Object.isFrozen(compiled.comparators)).toBe(true);
    for (const comparator of compiled.comparators) {
      expect(Object.isFrozen(comparator)).toBe(true);
      expect(comparator.version === undefined || Object.isFrozen(comparator.version)).toBe(true);
    }
  });

  test('is deterministic for the same expression', () => {
    const first = selector('>=1.2.0&&<2.0.0');
    const second = selector('>=1.2.0&&<2.0.0');

    expect(selectorMatches(first, label('1.5.0'))).toBe(true);
    expect(selectorMatches(second, label('1.5.0'))).toBe(true);
    expect(selectorMatches(first, label('2.0.0'))).toBe(false);
    expect(selectorMatches(second, label('2.0.0'))).toBe(false);
  });
});

describe('exact and wildcard', () => {
  test('exact selector matches only the same label', () => {
    expect(matches('=1.2.3', '1.2.3')).toBe(true);
    expect(matches('=1.2.3', '1.2.4')).toBe(false);
  });

  test('wildcard matches every label of the same scheme', () => {
    expect(matches('*', '0.0.1')).toBe(true);
    expect(matches('*', '1.0.0-alpha')).toBe(true);
  });

  test('`=` is string identity, so build metadata matters', () => {
    expect(matches('=1.2.3', '1.2.3+build.5')).toBe(false);
    expect(matches('=1.2.3+build.5', '1.2.3+build.5')).toBe(true);
    expect(matches('=1.2.3+build.5', '1.2.3')).toBe(false);
  });
});

describe('comparators', () => {
  const comparatorCases: ReadonlyArray<readonly [string, string, boolean]> = [
    ['>1.2.2', '1.2.3', true],
    ['>1.2.3', '1.2.3', false],
    ['>=1.2.3', '1.2.3', true],
    ['>=1.2.3', '1.2.2', false],
    ['<1.2.4', '1.2.3', true],
    ['<1.2.3', '1.2.3', false],
    ['<=1.2.3', '1.2.3', true],
    ['<=1.2.3', '1.2.4', false],
    ['>1.9.0', '1.10.0', true],
    ['<1.10.0', '1.9.0', true],
    ['>1.0.9', '1.0.10', true],
    ['>99999999999999999998.0.0', '99999999999999999999.0.0', true],
    ['=99999999999999999999.0.0', '99999999999999999999.0.0', true],
    ['<99999999999999999999.0.0', '99999999999999999998.0.0', true],
    ['>=1.2.0&&<2.0.0', '1.9.9', true],
    ['>=1.2.0&&<2.0.0', '2.0.0', false],
    ['>=1.2.0&&<2.0.0', '1.1.9', false],
    ['>1.2.3&&=1.2.3', '1.2.3', false],
    ['  >=1.2.0 && <2.0.0  ', '1.5.0', true],
  ];

  test('evaluates comparators, composition and large identifiers', () => {
    for (const [expression, value, expected] of comparatorCases) {
      expect(matches(expression, value)).toBe(expected);
    }
  });

  const rangeCases: ReadonlyArray<readonly [string, string, boolean]> = [
    ['^1.2.3', '1.2.3', true],
    ['^1.2.3', '1.9.9', true],
    ['^1.2.3', '2.0.0', false],
    ['^1.2.3', '1.2.2', false],
    ['^0.2.3', '0.2.3', true],
    ['^0.2.3', '0.2.9', true],
    ['^0.2.3', '0.3.0', false],
    ['^0.2.3', '0.2.2', false],
    ['^0.0.3', '0.0.3', true],
    ['^0.0.3', '0.0.4', false],
    ['~1.2.3', '1.2.3', true],
    ['~1.2.3', '1.2.9', true],
    ['~1.2.3', '1.3.0', false],
    ['~1.2.3', '1.2.2', false],
  ];

  test('expands caret and tilde ranges', () => {
    for (const [expression, value, expected] of rangeCases) {
      expect(matches(expression, value)).toBe(expected);
    }
  });
});

describe('SemVer precedence', () => {
  const chain = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ];

  test('orders the official prerelease chain', () => {
    for (let i = 0; i < chain.length - 1; i += 1) {
      const lower = chain[i];
      const higher = chain[i + 1];

      expect(matches(`>${lower}`, higher)).toBe(true);
      expect(matches(`<${higher}`, lower)).toBe(true);
      expect(matches(`>${higher}`, lower)).toBe(false);
      expect(matches(`<${lower}`, higher)).toBe(false);
    }
  });

  const precedenceCases: ReadonlyArray<readonly [string, string, boolean]> = [
    ['>1.0.0-1', '1.0.0-alpha', true],
    ['>1.0.0-alpha', '1.0.0-1', false],
    ['<1.0.0', '1.0.0-rc.1', true],
    ['>1.0.0-rc.1', '1.0.0', true],
    ['>=1.0.0', '1.1.0-alpha', true],
    ['<2.0.0', '2.0.0-alpha', true],
    ['>=1.2.3', '1.2.3+build.5', true],
    ['>1.2.3', '1.2.3+build.5', false],
    ['<=1.2.3+build.5', '1.2.3', true],
  ];

  test('orders identifiers, prerelease ranges and build metadata', () => {
    for (const [expression, value, expected] of precedenceCases) {
      expect(matches(expression, value)).toBe(expected);
    }
  });
});

describe('OPAQUE_TAG and CONTENT_HASH selectors', () => {
  for (const scheme of ['OPAQUE_TAG', 'CONTENT_HASH'] as const) {
    test(`${scheme}: exact selectors compare the full label`, () => {
      expect(matches('=release-2026', 'release-2026', scheme)).toBe(true);
      expect(matches('=release-2026', 'release-2027', scheme)).toBe(false);
      expect(matches('=1.2.3', '1.2.3+build', scheme)).toBe(false);
    });

    test(`${scheme}: wildcard matches every label`, () => {
      expect(matches('*', 'anything', scheme)).toBe(true);
      expect(matches('*', '01.2.3', scheme)).toBe(true);
    });

    test(`${scheme}: never parses labels as SemVer`, () => {
      expect(matches('=01.2.3', '01.2.3', scheme)).toBe(true);
      expect(matches('=v1.2.3', 'v1.2.3', scheme)).toBe(true);
    });

    for (const expression of ['>1.0.0', '>=1.0.0', '<1.0.0', '<=1.0.0', '^1.0.0', '~1.0.0']) {
      test(`${scheme}: rejects range selector ${expression} as incompatible`, () => {
        const error = compileFailure(expression, scheme);

        expect(error.kind).toBe('MECHANISM');
        expect(error.code).toBe('S_SELECTOR_INCOMPATIBLE_SCHEME');
      });
    }

    test(`${scheme}: exact selector round-trips labels verbatim`, () => {
      for (const value of [' tag ', 'my tag', 'a&&b', '=x', '*', '  ']) {
        expect(matches(`=${value}`, value, scheme)).toBe(true);
      }
    });

    test(`${scheme}: exact operand preserves leading and trailing spaces`, () => {
      expect(matches('= tag ', ' tag ', scheme)).toBe(true);
      expect(matches('= tag ', 'tag', scheme)).toBe(false);
    });

    test(`${scheme}: rejects an empty exact operand`, () => {
      expect(compileFailure('=', scheme).code).toBe('E_SELECTOR_SYNTAX_INVALID');
    });
  }
});

describe('scheme mismatch', () => {
  test('returns false instead of matching across schemes', () => {
    const semverExact = selector('=1.2.3', 'SEMVER_2');
    const opaqueLabel = label('1.2.3', 'OPAQUE_TAG');

    expect(selectorMatches(semverExact, opaqueLabel)).toBe(false);
  });

  test('wildcard is also scheme-scoped', () => {
    const semverWildcard = selector('*', 'SEMVER_2');

    expect(selectorMatches(semverWildcard, label('anything', 'CONTENT_HASH'))).toBe(false);
  });
});

describe('malformed selectors', () => {
  const malformed = [
    '',
    ' ',
    '=',
    '>=',
    '>',
    '1.2.3',
    '==1.2.3',
    '=>1.2.3',
    '>1.2',
    '>1',
    '>1.2.x',
    '>v1.2.3',
    '>=1.2.3&&',
    '&&>=1.2.3',
    '> =1.2.3',
    '>=1.2.3 || <2.0.0',
    '*&&>=1.2.3',
    '>=1.2.3&&*',
    '~1.2',
    '^1',
    '^1.2.3 || =1.5.0',
  ];

  for (const expression of malformed) {
    test(`rejects ${JSON.stringify(expression)}`, () => {
      const error = compileFailure(expression);

      expect(error.kind).toBe('MECHANISM');
      expect(error.code).toBe('E_SELECTOR_SYNTAX_INVALID');
    });
  }

  test('rejects a non-string selector', () => {
    expect(compileFailure(123 as unknown as string).code).toBe('E_SELECTOR_SYNTAX_INVALID');
  });
});

describe('compiled selector provenance', () => {
  const target = label('1.0.0');
  const compiled = selector('=1.0.0');

  function forged(overrides: Partial<CompiledSelector> = {}): CompiledSelector {
    return {
      mechanism: 'uia-ref-selector@1',
      scheme: 'SEMVER_2',
      kind: 'WILDCARD',
      comparators: [],
      ...overrides,
    } as unknown as CompiledSelector;
  }

  test('rejects a structurally identical manually constructed object', () => {
    expect(() => selectorMatches(forged(), target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects an unknown mechanism version', () => {
    expect(() =>
      selectorMatches(forged({ mechanism: 'uia-ref-selector@2' as unknown as 'uia-ref-selector@1' }), target),
    ).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects a spread copy of a compiled selector', () => {
    const copy = { ...compiled } as unknown as CompiledSelector;

    expect(() => selectorMatches(copy, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects a non-object selector', () => {
    expect(() => selectorMatches(null as unknown as CompiledSelector, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects an object inheriting from a compiled selector', () => {
    const derived = Object.create(compiled) as Record<string, unknown>;

    expect(() => selectorMatches(derived as unknown as CompiledSelector, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects an inheriting object that overrides selector fields', () => {
    const derived = Object.create(compiled) as Record<string, unknown>;
    const overrides = {
      kind: 'WILDCARD',
      scheme: 'OPAQUE_TAG',
      mechanism: 'uia-ref-selector@2',
      comparators: [],
    };
    for (const [key, value] of Object.entries(overrides)) {
      Object.defineProperty(derived, key, { value, writable: true, enumerable: true, configurable: true });
    }

    expect(() => selectorMatches(derived as unknown as CompiledSelector, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects a Proxy around a compiled selector', () => {
    const proxied = new Proxy(compiled, {});

    expect(() => selectorMatches(proxied, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('rejects a Proxy with traps without reading selector fields', () => {
    const trap = () => {
      throw new Error('selector fields must not be read during the provenance check');
    };
    const proxied = new Proxy(compiled, { get: trap, has: trap, getPrototypeOf: trap });

    expect(() => selectorMatches(proxied, target)).toThrow(InvalidCompiledSelectorError);
  });

  test('keeps accepting the original selector after failed attempts', () => {
    expect(() => selectorMatches(Object.create(compiled) as unknown as CompiledSelector, target)).toThrow(
      InvalidCompiledSelectorError,
    );
    expect(() => selectorMatches(new Proxy(compiled, {}), target)).toThrow(InvalidCompiledSelectorError);

    expect(selectorMatches(compiled, target)).toBe(true);
  });
});
