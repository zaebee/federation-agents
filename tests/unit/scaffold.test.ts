import { test, expect } from 'bun:test';
import { UIA_CORE_001_REVISION } from '../../src/index.js';

test('scaffold: public entry point is typed and exposes the spec revision', () => {
  expect(UIA_CORE_001_REVISION).toBe('0.3.3');
});
