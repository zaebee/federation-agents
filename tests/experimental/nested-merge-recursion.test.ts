import { test, expect } from 'bun:test';
import { evaluateAt, nestedMergeState } from '../support/traversal.js';

// BLOCKED / NON-CONFORMANCE (A-5).
//
// Rev 0.3.3 §8.6 defines immediate closure only: for merge nodes ON the path,
// every direct parent edge must satisfy the requirement. It does not define
// closure depth inside closure-only branches. This file documents that
// boundary; it is excluded from the §12 conformance suite and from Task 10
// completion criteria.

test('BLOCKED (A-5, non-conformance): immediate closure does not descend into closure-only merge C', () => {
  const { graph, descriptors, assessments, binding } = nestedMergeState();
  const result = evaluateAt({ graph, descriptors, assessments }, binding);

  // Immediate closure validates only D's direct parents. C is closure-only and
  // is not expanded, so C's own parents E and F are never inspected.
  expect(result.eligible).toBe(true);
  if (!result.eligible) return;
  expect(result.acceptedPaths.map((path) => String(path.edges[0].parent))).toEqual(['iv-b']);
});

test.todo('BLOCKED (A-5, non-conformance): recursive closure would also require C→E and C→F');
