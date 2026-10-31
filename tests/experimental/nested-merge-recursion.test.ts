import { test, expect } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { evaluateBinding } from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import { CTX, EMPTY_POLICY, assessmentRecord, bindingFor } from '../support/traversal.js';

// BLOCKED / NON-CONFORMANCE (A-5).
//
// Rev 0.3.3 §8.6 defines immediate closure only: for merge nodes ON the path,
// every direct parent edge must satisfy the requirement. It does not define
// closure depth inside closure-only branches. This file documents that
// boundary; it is excluded from the §12 conformance suite and from Task 10
// completion criteria.

const alice = participant('participant-a');
const bob = participant('participant-b');
const dave = participant('participant-d');

function nestedMergeGraph() {
  const a = descriptor({ id: 'iv-a-1', participant: 'participant-a', versionLabel: '1.0.0' });
  const b = descriptor({
    id: 'iv-b',
    participant: 'participant-b',
    versionLabel: '1.0.0',
    lineage: [link('iv-a-1', 'FORKED_FROM')],
  });
  const e = descriptor({ id: 'iv-e', participant: 'participant-a', versionLabel: '1.0.0' });
  const f = descriptor({ id: 'iv-f', participant: 'participant-a', versionLabel: '1.0.0' });
  const c = descriptor({
    id: 'iv-c',
    participant: 'participant-a',
    versionLabel: '1.0.0',
    lineage: [link('iv-e', 'MERGED_FROM'), link('iv-f', 'MERGED_FROM')],
  });
  const d = descriptor({
    id: 'iv-d',
    participant: 'participant-d',
    versionLabel: '2.0.0',
    lineage: [link('iv-b', 'MERGED_FROM'), link('iv-c', 'MERGED_FROM')],
  });

  return {
    graph: buildLineageGraph(registry([alice, bob, dave], [a, b, c, d, e, f])),
    descriptors: [a, b, c, d, e, f],
  };
}

test('BLOCKED (A-5, non-conformance): immediate closure does not descend into closure-only merge C', () => {
  const { graph, descriptors } = nestedMergeGraph();
  const assessments = [
    assessmentRecord({ id: 'db', subject: 'iv-d', parents: ['iv-b'], relation: 'MERGED_FROM', verified: ['OK'] }),
    assessmentRecord({ id: 'dc', subject: 'iv-d', parents: ['iv-c'], relation: 'MERGED_FROM', verified: ['OK'] }),
    assessmentRecord({ id: 'ba', subject: 'iv-b', parents: ['iv-a-1'], relation: 'FORKED_FROM', verified: ['OK'] }),
  ];
  const binding = bindingFor({
    origin: 'iv-a-1',
    selector: '>=1.0.0',
    scope: 'FULL_ANCESTRY',
    claims: ['OK'],
    targetParticipant: 'participant-d',
  });

  const result = evaluateBinding(
    { graph, descriptors, assessments },
    binding,
    identityVersionId('iv-d'),
    EMPTY_POLICY,
    CTX,
  );

  // Immediate closure validates only D's direct parents. C is closure-only and
  // is not expanded, so C's own parents E and F are never inspected.
  expect(result.eligible).toBe(true);
  if (!result.eligible) return;
  expect(result.acceptedPaths.map((path) => String(path.edges[0].parent))).toEqual(['iv-b']);
});

test.skip('BLOCKED (A-5, non-conformance): recursive closure would also require C→E and C→F', () => {
  // No normative depth is defined by Rev 0.3.3 for closure-only branches.
  // Resolving this requires a spec clarifier, not an implementation choice.
});
