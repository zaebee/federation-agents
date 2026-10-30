import { test, expect } from 'bun:test';
import { sha256Bytes, sha256Hex } from '../../src/core/sha256.js';

const enc = new TextEncoder();

test('sha256: empty input', () => {
  expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('sha256: abc', () => {
  expect(sha256Hex(enc.encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256: abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', () => {
  const msg = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
  expect(sha256Hex(enc.encode(msg))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('sha256: multi-block message', () => {
  const msg =
    'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu';
  expect(sha256Hex(enc.encode(msg))).toBe('cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
});

test('sha256: padding boundaries 55/56/63/64/65 bytes', () => {
  for (const n of [55, 56, 63, 64, 65]) {
    const input = new Uint8Array(n).fill(0x61);
    const hex = sha256Hex(input);
    expect(hex).toHaveLength(64);
    // Determinism: same input -> same output.
    expect(sha256Hex(input)).toBe(hex);
  }
});

test('sha256: sha256Bytes returns 32 bytes', () => {
  const b = sha256Bytes(enc.encode('abc'));
  expect(b).toBeInstanceOf(Uint8Array);
  expect(b.length).toBe(32);
  // matches hex
  let hex = '';
  for (const byte of b) hex += byte.toString(16).padStart(2, '0');
  expect(hex).toBe(sha256Hex(enc.encode('abc')));
});

test('sha256: large input (multiple blocks) deterministic', () => {
  const input = new Uint8Array(1000).fill(0x41);
  const h1 = sha256Hex(input);
  const h2 = sha256Hex(input);
  expect(h1).toBe(h2);
  expect(h1).toHaveLength(64);
});

test('sha256: known vector for "The quick brown fox jumps over the lazy dog"', () => {
  const msg = 'The quick brown fox jumps over the lazy dog';
  expect(sha256Hex(enc.encode(msg))).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
});
