import { describe, expect, test } from 'bun:test';
import type { VersionScheme } from '../../src/core/entities.js';
import { validateVersionLabel } from '../../src/core/version-scheme.js';

const VALID_SEMVER: readonly string[] = [
  '0.0.0',
  '1.0.0',
  '2.1.1',
  '1.2.3-0.3.7',
  '1.0.0-alpha',
  '1.0.0-alpha.1',
  '1.0.0-0.3.7',
  '1.0.0-x.7.z.92',
  '1.0.0-x-y-z.--',
  '1.0.0-alpha+001',
  '1.0.0+20130313144700',
  '1.0.0-beta+exp.sha.5114f85',
  '1.0.0+21AF26D3---117B344092BD',
  '1.2.3+001',
  '1.2.3-0A',
  '99999999999999999999.1.1',
];

const INVALID_SEMVER: readonly string[] = [
  '',
  ' ',
  '1',
  '1.2',
  '1.2.3.4',
  '01.1.1',
  '1.001.1',
  '1.0.00',
  '1.2.3-',
  '1.2.3+',
  '1.2.3-01',
  '1.2.3-00',
  '1.2.3-0123.0123',
  '1.2.3-alpha..',
  '1.2.3-alpha..1',
  '1.2.3-alpha_beta',
  '1.2.3-alpha.',
  '1.2.3-.alpha',
  '1.2.3+.123',
  '1.2.3+..',
  '1.2.3+001.',
  'alpha',
  'alpha.beta',
  'alpha.beta.1',
  'alpha.1',
  'alpha+beta',
  'alpha_beta',
  'beta',
  '-alpha.',
  '+invalid',
  '-invalid',
  '-invalid+invalid',
  'v1.2.3',
  '1.2.3 ',
  ' 1.2.3',
  '1.2.3-раз',
];

function failureCode(scheme: VersionScheme, value: string): string {
  const result = validateVersionLabel(value, scheme);
  if (result.ok) {
    throw new Error(`expected ${JSON.stringify(value)} to be rejected for ${scheme}`);
  }
  return result.error.code;
}

describe('SEMVER_2 validation', () => {
  for (const label of VALID_SEMVER) {
    test(`accepts official valid example ${JSON.stringify(label)}`, () => {
      const result = validateVersionLabel(label, 'SEMVER_2');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scheme).toBe('SEMVER_2');
      expect(result.value.label).toBe(label);
      expect(Object.isFrozen(result.value)).toBe(true);
    });
  }

  for (const label of INVALID_SEMVER) {
    test(`rejects invalid example ${JSON.stringify(label)}`, () => {
      expect(validateVersionLabel(label, 'SEMVER_2').ok).toBe(false);
    });
  }

  test('reports E_VERSION_LABEL_INVALID as a mechanism failure', () => {
    const result = validateVersionLabel('1.2', 'SEMVER_2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_VERSION_LABEL_INVALID');
  });

  test('rejects a non-string label', () => {
    expect(failureCode('SEMVER_2', 123 as unknown as string)).toBe('E_VERSION_LABEL_INVALID');
  });

  test('rejects lone surrogates', () => {
    expect(failureCode('SEMVER_2', '1.2.3-\uD800')).toBe('E_VERSION_LABEL_INVALID');
  });
});

describe('CONTENT_HASH validation', () => {
  test('accepts any non-empty label without inferring a format', () => {
    for (const label of ['abc', 'sha256:abc', '0123deadbeef', 'not-a-hash', '1.2.3']) {
      const result = validateVersionLabel(label, 'CONTENT_HASH');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scheme).toBe('CONTENT_HASH');
      expect(result.value.label).toBe(label);
    }
  });

  test('does not treat a SemVer-shaped label as SemVer', () => {
    const result = validateVersionLabel('01.2.3', 'CONTENT_HASH');

    expect(result.ok).toBe(true);
  });

  test('rejects an empty label', () => {
    expect(failureCode('CONTENT_HASH', '')).toBe('E_VERSION_LABEL_INVALID');
  });

  test('rejects lone surrogates', () => {
    expect(failureCode('CONTENT_HASH', 'abc\uDC00')).toBe('E_VERSION_LABEL_INVALID');
  });

  test('does not trim labels', () => {
    const result = validateVersionLabel(' abc ', 'CONTENT_HASH');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe(' abc ');
  });
});

describe('OPAQUE_TAG validation', () => {
  test('accepts any non-empty label and preserves it verbatim', () => {
    for (const label of ['release-2026', '2.0.0', '10.0.0', '01.2.3', ' tag ']) {
      const result = validateVersionLabel(label, 'OPAQUE_TAG');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scheme).toBe('OPAQUE_TAG');
      expect(result.value.label).toBe(label);
    }
  });

  test('rejects an empty label', () => {
    expect(failureCode('OPAQUE_TAG', '')).toBe('E_VERSION_LABEL_INVALID');
  });

  test('rejects lone surrogates', () => {
    expect(failureCode('OPAQUE_TAG', 'tag\uD800')).toBe('E_VERSION_LABEL_INVALID');
  });
});
