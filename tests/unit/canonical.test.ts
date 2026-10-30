import { test, expect } from 'bun:test';
import { CanonicalizationError } from '../../src/core/errors.js';
import { canonicalize, canonicalSha256 } from '../../src/core/canonical.js';
import type { JsonValue } from '../../src/core/primitives.js';

test('canonical: RFC 8785 sample object', () => {
  const input = {
    // eslint-disable-next-line no-loss-of-precision
    numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
    string: '\u20ac$\u000f\nA\'B"\\\\/',
    literals: [null, true, false],
  };
  const out = canonicalize(input as JsonValue);
  expect(out.startsWith('{"literals":')).toBe(true);
  expect(out).toContain('"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]');
  expect(out).toContain('"literals":[null,true,false]');
});

test('canonical: simple primitives', () => {
  expect(canonicalize(null as unknown as JsonValue)).toBe('null');
  expect(canonicalize(true as unknown as JsonValue)).toBe('true');
  expect(canonicalize(false as unknown as JsonValue)).toBe('false');
  expect(canonicalize(42 as unknown as JsonValue)).toBe('42');
  expect(canonicalize('hello' as unknown as JsonValue)).toBe('"hello"');
  expect(canonicalize([] as unknown as JsonValue)).toBe('[]');
  expect(canonicalize({} as unknown as JsonValue)).toBe('{}');
});

test('canonical: nested objects sort keys recursively', () => {
  const out = canonicalize({ z: { b: 1, a: 2 }, a: 3 } as unknown as JsonValue);
  expect(out).toBe('{"a":3,"z":{"a":2,"b":1}}');
});

test('canonical: array element order preserved', () => {
  const out = canonicalize({ a: [3, 1, 2] } as unknown as JsonValue);
  expect(out).toBe('{"a":[3,1,2]}');
});

test('canonical: empty arrays and objects', () => {
  expect(canonicalize({ a: [], b: {} } as unknown as JsonValue)).toBe('{"a":[],"b":{}}');
});

test('canonical: UTF-16 key ordering (supplementary chars)', () => {
  // Keys: "\ud83d\ude00" (emoji, two code units) sorts after ASCII by code unit.
  const obj: Record<string, number> = {};
  obj['a'] = 1;
  obj['\ud83d\ude00'] = 2;
  const out = canonicalize(obj as unknown as JsonValue);
  expect(out).toBe('{"a":1,"😀":2}');
});

test('canonical: string escaping control chars, quotes, backslashes', () => {
  const out = canonicalize('a"b\\c\n\t' as unknown as JsonValue);
  expect(out).toBe('"a\\"b\\\\c\\n\\t"');
});

test('canonical: U+2028 and U+2029 handling (ECMAScript JSON.stringify)', () => {
  const s = 'a\u2028b\u2029c';
  const out = canonicalize(s as unknown as JsonValue);
  // ECMAScript JSON.stringify does not escape U+2028/U+2029 (raw).
  expect(out).toBe('"a\u2028b\u2029c"');
});

test('canonical: number edge cases', () => {
  expect(canonicalize(0 as unknown as JsonValue)).toBe('0');
  expect(canonicalize(-0 as unknown as JsonValue)).toBe('0');
  expect(canonicalize(1e30 as unknown as JsonValue)).toBe('1e+30');
  expect(canonicalize(0.002 as unknown as JsonValue)).toBe('0.002');
  expect(canonicalize(1e-27 as unknown as JsonValue)).toBe('1e-27');
  expect(canonicalize(4.5 as unknown as JsonValue)).toBe('4.5');
});

test('canonical: number round-trip known vectors', () => {
  // Appendix B samples
  expect(canonicalize(9007199254740992 as unknown as JsonValue)).toBe('9007199254740992');
  expect(canonicalize(5e-324 as unknown as JsonValue)).toBe('5e-324');
  expect(canonicalize(1.7976931348623157e308 as unknown as JsonValue)).toBe('1.7976931348623157e+308');
});

test('canonical: does not mutate input', () => {
  const input = { z: 1, a: 2 };
  const before = JSON.stringify(input);
  canonicalize(input as unknown as JsonValue);
  expect(JSON.stringify(input)).toBe(before);
});

test('canonical: deterministic across repeated calls', () => {
  const input = { b: { d: 1, c: 2 }, a: [3, 1] };
  const r1 = canonicalize(input as unknown as JsonValue);
  const r2 = canonicalize(input as unknown as JsonValue);
  expect(r1).toBe(r2);
});

test('canonical: insertion order does not affect output', () => {
  const a: Record<string, number> = {};
  a.z = 1;
  a.a = 2;
  const b: Record<string, number> = {};
  b.a = 2;
  b.z = 1;
  expect(canonicalize(a as unknown as JsonValue)).toBe(canonicalize(b as unknown as JsonValue));
});

// Invalid input rejection
test('canonical: rejects undefined (top-level)', () => {
  expect(() => canonicalize(undefined as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects undefined property value', () => {
  expect(() => canonicalize({ a: undefined } as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects NaN', () => {
  expect(() => canonicalize(NaN as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects Infinity', () => {
  expect(() => canonicalize(Infinity as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects -Infinity', () => {
  expect(() => canonicalize(-Infinity as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects BigInt', () => {
  expect(() => canonicalize(1n as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects function', () => {
  expect(() => canonicalize((() => 1) as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects symbol', () => {
  expect(() => canonicalize(Symbol('x') as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects null-prototype object', () => {
  const obj = Object.create(null) as Record<string, unknown>;
  obj.a = 1;
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects class instance', () => {
  class Foo {
    x = 1;
  }
  expect(() => canonicalize(new Foo() as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects Date', () => {
  expect(() => canonicalize(new Date() as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects Map', () => {
  expect(() => canonicalize(new Map() as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects Set', () => {
  expect(() => canonicalize(new Set() as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects sparse array', () => {
  const arr = new Array(3);
  arr[0] = 1;
  arr[2] = 3;
  expect(() => canonicalize(arr as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects array with extra own property', () => {
  const arr: unknown[] = [1, 2];
  Object.defineProperty(arr, 'foo', { value: 3, enumerable: true, writable: true, configurable: true });
  expect(() => canonicalize(arr as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects symbol-keyed property', () => {
  const obj: Record<string, unknown> = { a: 1 };
  Object.defineProperty(obj, Symbol('s'), { value: 2, enumerable: true, writable: true, configurable: true });
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects accessor property', () => {
  const obj: Record<string, unknown> = {};
  Object.defineProperty(obj, 'x', { get: () => 1, enumerable: true });
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects non-enumerable property', () => {
  const obj: Record<string, unknown> = { a: 1 };
  Object.defineProperty(obj, 'hidden', { value: 2, enumerable: false });
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects lone surrogate in string value', () => {
  expect(() => canonicalize('\ud800' as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects lone surrogate in key', () => {
  const obj: Record<string, unknown> = {};
  Object.defineProperty(obj, '\ud800', { value: 1, enumerable: true, writable: true, configurable: true });
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: rejects cyclic structure', () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
});

test('canonical: allows repeated (non-cyclic) references (diamond)', () => {
  const shared = { x: 1 };
  const obj = { a: shared, b: shared };
  const out = canonicalize(obj as unknown as JsonValue);
  expect(out).toBe('{"a":{"x":1},"b":{"x":1}}');
});

test('canonical: getter is not invoked during validation', () => {
  const obj: Record<string, unknown> = {};
  let counter = 0;
  Object.defineProperty(obj, 'x', {
    get() {
      counter++;
      return 1;
    },
    enumerable: true,
  });
  expect(() => canonicalize(obj as unknown as JsonValue)).toThrow(CanonicalizationError);
  expect(counter).toBe(0);
});

test('canonical: inputs unchanged after failure', () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  try {
    canonicalize(obj as unknown as JsonValue);
  } catch {
    /* expected */
  }
  // The original object still has its self-reference and a.
  expect(obj.a).toBe(1);
  expect(obj.self).toBe(obj);
});

// Integration with SHA-256
test('canonical: canonicalSha256 deterministic', () => {
  const v = { a: 1, b: [2, 3] } as unknown as JsonValue;
  const h1 = canonicalSha256(v);
  const h2 = canonicalSha256(v);
  expect(h1).toBe(h2);
  expect(h1).toHaveLength(64);
});

test('canonical: canonicalSha256 differs for different values', () => {
  const h1 = canonicalSha256({ a: 1 } as unknown as JsonValue);
  const h2 = canonicalSha256({ a: 2 } as unknown as JsonValue);
  expect(h1).not.toBe(h2);
});

test('canonical: UTF-8 encoding for non-ASCII affects hash', () => {
  const hAscii = canonicalSha256('a' as unknown as JsonValue);
  const hEuro = canonicalSha256('€' as unknown as JsonValue);
  expect(hAscii).not.toBe(hEuro);
});

// RFC 8785 sorting test data
test('canonical: RFC 8785 property sort test data', () => {
  const obj: Record<string, string> = {};
  obj['\u20ac'] = 'Euro Sign';
  obj['\r'] = 'Carriage Return';
  obj['\ufb33'] = 'Hebrew Letter Dalet With Dagesh';
  obj['1'] = 'One';
  obj['\ud83d\ude00'] = 'Emoji: Grinning Face';
  obj['\u0080'] = 'Control';
  obj['\u00f6'] = 'Latin Small Letter O With Diaeresis';
  const out = canonicalize(obj as unknown as JsonValue);
  const expected =
    '{"\\r":"Carriage Return","1":"One","\u0080":"Control","\u00f6":"Latin Small Letter O With Diaeresis","\u20ac":"Euro Sign","\ud83d\ude00":"Emoji: Grinning Face","\ufb33":"Hebrew Letter Dalet With Dagesh"}';
  expect(out).toBe(expected);
});

test('canonical: serializes validated snapshot, not original input (Proxy)', () => {
  let reads = 0;
  const target = { a: 1 };
  const proxy = new Proxy(target, {
    get(_t, prop, receiver) {
      if (prop === 'a') {
        reads += 1;
        return reads === 1 ? 1 : 999;
      }
      return Reflect.get(target, prop, receiver);
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (prop === 'a') {
        return { value: 1, writable: true, enumerable: true, configurable: true };
      }
      return Object.getOwnPropertyDescriptor(target, prop as string);
    },
    ownKeys() {
      return ['a'];
    },
    has(_t, prop) {
      return prop === 'a';
    },
  });
  const out = canonicalize(proxy as unknown as JsonValue);
  // The validated snapshot carries a=1; the serializer must not re-read the
  // original (which would yield 999 on the second read).
  expect(out).toBe('{"a":1}');
});

test('canonical: no Unicode normalization (NFC vs NFD strings)', () => {
  const nfc = '\u00e9'; // é composed
  const nfd = '\u0065\u0301'; // e + combining acute
  expect(nfc).not.toBe(nfd);
  const outNfc = canonicalize(nfc as unknown as JsonValue);
  const outNfd = canonicalize(nfd as unknown as JsonValue);
  expect(outNfc).not.toBe(outNfd);
  // Each serializes its own code units unchanged.
  expect(outNfc).toBe(JSON.stringify(nfc));
  expect(outNfd).toBe(JSON.stringify(nfd));
});

test('canonical: no Unicode normalization (NFC vs NFD keys)', () => {
  const nfcKey = '\u00e9';
  const nfdKey = '\u0065\u0301';
  const objNfc: Record<string, number> = {};
  objNfc[nfcKey] = 1;
  const objNfd: Record<string, number> = {};
  objNfd[nfdKey] = 1;
  const outNfc = canonicalize(objNfc as unknown as JsonValue);
  const outNfd = canonicalize(objNfd as unknown as JsonValue);
  expect(outNfc).not.toBe(outNfd);
});

test('canonical: exact UTF-16 ordering around supplementary and BMP chars', () => {
  const obj: Record<string, number> = {};
  // U+007F (DEL, single code unit) vs U+0080 (two? no, single) — BMP boundary.
  obj['\u007f'] = 1;
  obj['\u0080'] = 2;
  // Supplementary: U+1F600 (surrogate pair) sorts after BMP by first code unit (0xD83D).
  obj['\ud83d\ude00'] = 3;
  const out = canonicalize(obj as unknown as JsonValue);
  // Order by UTF-16 code units: \u007f (0x7f) < \u0080 (0x80) < \ud83d... (0xd83d)
  expect(out).toBe('{"\u007f":1,"\u0080":2,"\ud83d\ude00":3}');
});

test('canonical: Appendix B number vectors (exponent boundaries and rounding)', () => {
  // From RFC 8785 Appendix B
  expect(canonicalize(0 as unknown as JsonValue)).toBe('0');
  expect(canonicalize(5e-324 as unknown as JsonValue)).toBe('5e-324');
  expect(canonicalize(1.7976931348623157e308 as unknown as JsonValue)).toBe('1.7976931348623157e+308');
  expect(canonicalize(9007199254740992 as unknown as JsonValue)).toBe('9007199254740992');
  expect(canonicalize(-9007199254740992 as unknown as JsonValue)).toBe('-9007199254740992');
  expect(canonicalize(295147905179352830000 as unknown as JsonValue)).toBe('295147905179352830000');
  expect(canonicalize(9.999999999999997e22 as unknown as JsonValue)).toBe('9.999999999999997e+22');
  expect(canonicalize(1e23 as unknown as JsonValue)).toBe('1e+23');
  expect(canonicalize(1.0000000000000001e23 as unknown as JsonValue)).toBe('1.0000000000000001e+23');
  expect(canonicalize(999999999999999700000 as unknown as JsonValue)).toBe('999999999999999700000');
  expect(canonicalize(999999999999999900000 as unknown as JsonValue)).toBe('999999999999999900000');
  expect(canonicalize(1e21 as unknown as JsonValue)).toBe('1e+21');
  expect(canonicalize(9.999999999999997e-7 as unknown as JsonValue)).toBe('9.999999999999997e-7');
  expect(canonicalize(0.000001 as unknown as JsonValue)).toBe('0.000001');
  expect(canonicalize(333333333.3333332 as unknown as JsonValue)).toBe('333333333.3333332');
  expect(canonicalize(333333333.33333325 as unknown as JsonValue)).toBe('333333333.33333325');
  expect(canonicalize(333333333.3333333 as unknown as JsonValue)).toBe('333333333.3333333');
  expect(canonicalize(333333333.3333334 as unknown as JsonValue)).toBe('333333333.3333334');
  expect(canonicalize(333333333.33333343 as unknown as JsonValue)).toBe('333333333.33333343');
  expect(canonicalize(-0.0000033333333333333333 as unknown as JsonValue)).toBe('-0.0000033333333333333333');
  // eslint-disable-next-line no-loss-of-precision
  expect(canonicalize(1424953923781206.2 as unknown as JsonValue)).toBe('1424953923781206.2');
});
