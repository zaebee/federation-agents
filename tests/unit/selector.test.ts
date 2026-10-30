import { describe, expect, test } from 'bun:test';
import type { VersionScheme } from '../../src/core/entities.js';
import {
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
  test('supports >, >=, <, <=', () => {
    expect(matches('>1.2.2', '1.2.3')).toBe(true);
    expect(matches('>1.2.3', '1.2.3')).toBe(false);
    expect(matches('>=1.2.3', '1.2.3')).toBe(true);
    expect(matches('>=1.2.3', '1.2.2')).toBe(false);
    expect(matches('<1.2.4', '1.2.3')).toBe(true);
    expect(matches('<1.2.3', '1.2.3')).toBe(false);
    expect(matches('<=1.2.3', '1.2.3')).toBe(true);
    expect(matches('<=1.2.3', '1.2.4')).toBe(false);
  });

  test('compares numerically, not lexicographically', () => {
    expect(matches('>1.9.0', '1.10.0')).toBe(true);
    expect(matches('<1.10.0', '1.9.0')).toBe(true);
    expect(matches('>1.0.9', '1.0.10')).toBe(true);
  });

  test('compares arbitrarily large numeric identifiers without precision loss', () => {
    expect(matches('>99999999999999999998.0.0', '99999999999999999999.0.0')).toBe(true);
    expect(matches('=99999999999999999999.0.0', '99999999999999999999.0.0')).toBe(true);
    expect(matches('<99999999999999999999.0.0', '99999999999999999998.0.0')).toBe(true);
  });

  test('supports && composition', () => {
    expect(matches('>=1.2.0&&<2.0.0', '1.9.9')).toBe(true);
    expect(matches('>=1.2.0&&<2.0.0', '2.0.0')).toBe(false);
    expect(matches('>=1.2.0&&<2.0.0', '1.1.9')).toBe(false);
    expect(matches('>1.2.3&&=1.2.3', '1.2.3')).toBe(false);
  });

  test('supports whitespace around the expression and segments', () => {
    expect(matches('  >=1.2.0 && <2.0.0  ', '1.5.0')).toBe(true);
  });

  test('expands caret ranges for major versions', () => {
    expect(matches('^1.2.3', '1.2.3')).toBe(true);
    expect(matches('^1.2.3', '1.9.9')).toBe(true);
    expect(matches('^1.2.3', '2.0.0')).toBe(false);
    expect(matches('^1.2.3', '1.2.2')).toBe(false);
  });

  test('expands caret ranges for zero-major versions', () => {
    expect(matches('^0.2.3', '0.2.3')).toBe(true);
    expect(matches('^0.2.3', '0.2.9')).toBe(true);
    expect(matches('^0.2.3', '0.3.0')).toBe(false);
    expect(matches('^0.2.3', '0.2.2')).toBe(false);

    expect(matches('^0.0.3', '0.0.3')).toBe(true);
    expect(matches('^0.0.3', '0.0.4')).toBe(false);
  });

  test('expands tilde ranges', () => {
    expect(matches('~1.2.3', '1.2.3')).toBe(true);
    expect(matches('~1.2.3', '1.2.9')).toBe(true);
    expect(matches('~1.2.3', '1.3.0')).toBe(false);
    expect(matches('~1.2.3', '1.2.2')).toBe(false);
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

  for (let i = 0; i < chain.length - 1; i += 1) {
    const lower = chain[i];
    const higher = chain[i + 1];

    test(`${lower} < ${higher}`, () => {
      expect(matches(`>${lower}`, higher)).toBe(true);
      expect(matches(`<${higher}`, lower)).toBe(true);
      expect(matches(`>${higher}`, lower)).toBe(false);
      expect(matches(`<${lower}`, higher)).toBe(false);
    });
  }

  test('numeric prerelease identifiers sort before alphanumeric ones', () => {
    expect(matches('>1.0.0-1', '1.0.0-alpha')).toBe(true);
    expect(matches('>1.0.0-alpha', '1.0.0-1')).toBe(false);
  });

  test('prerelease sorts below the release', () => {
    expect(matches('<1.0.0', '1.0.0-rc.1')).toBe(true);
    expect(matches('>1.0.0-rc.1', '1.0.0')).toBe(true);
  });

  test('ranges do not gate out prereleases (no npm rule)', () => {
    expect(matches('>=1.0.0', '1.1.0-alpha')).toBe(true);
    expect(matches('<2.0.0', '2.0.0-alpha')).toBe(true);
  });

  test('build metadata does not affect precedence', () => {
    expect(matches('>=1.2.3', '1.2.3+build.5')).toBe(true);
    expect(matches('>1.2.3', '1.2.3+build.5')).toBe(false);
    expect(matches('<=1.2.3+build.5', '1.2.3')).toBe(true);
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

    test(`${scheme}: rejects comparator composition as incompatible`, () => {
      const error = compileFailure('=a&&=a', scheme);

      expect(error.kind).toBe('MECHANISM');
      expect(error.code).toBe('S_SELECTOR_INCOMPATIBLE_SCHEME');
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
