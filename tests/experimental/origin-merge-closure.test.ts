import { expect, test } from 'bun:test';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { discoverPaths, evaluateBinding } from '../../src/core/traversal.js';
import { identityVersionId } from '../../src/core/primitives.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import { CTX, EMPTY_POLICY, assessmentRecord, bindingFor } from '../support/traversal.js';

// BLOCKED / NON-CONFORMANCE (A-11).
//
// CORE-001 §8.6 says a selected path that «проходит через» a MERGED_FROM node
// must close all of that node's parent edges. It does not define whether the
// terminal origin node counts as a node the path "passes through".
//
// The current implementation walks path edges and closes `edge.child`. The
// terminal origin is never a child, so its parent branches are not closed.
// This file pins that actual behavior; it is excluded from §12 conformance.

test('BLOCKED (A-11, non-conformance): a MERGED_FROM origin is not closed', () => {
  const alice = participant('participant-a');
  const bob = participant('participant-b');
  const carol = participant('participant-c');
  const p1 = descriptor({ id: 'iv-p1', participant: 'participant-b' });
  const p2 = descriptor({ id: 'iv-p2', participant: 'participant-c' });
  const origin = descriptor({
    id: 'iv-o',
    participant: 'participant-a',
    versionLabel: '2.0.0',
    lineage: [link('iv-p1', 'MERGED_FROM'), link('iv-p2', 'MERGED_FROM')],
  });
  const candidate = descriptor({
    id: 'iv-c',
    participant: 'participant-a',
    versionLabel: '3.0.0',
    lineage: [link('iv-o', 'CONTINUATION')],
  });
  const graph = buildLineageGraph(registry([alice, bob, carol], [p1, p2, origin, candidate]));
  const assessments = [
    assessmentRecord({
      id: 'c-o',
      subject: 'iv-c',
      parents: ['iv-o'],
      relation: 'CONTINUATION',
      verified: ['OK'],
    }),
  ];
  const binding = bindingFor({
    origin: 'iv-o',
    selector: '>=1.0.0',
    scope: 'FULL_ANCESTRY',
    claims: ['OK'],
    targetParticipant: 'participant-a',
  });

  const discovered = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId('iv-c'), identityVersionId('iv-o'));
  expect(discovered.ok).toBe(true);
  if (!discovered.ok) return;
  expect(discovered.value).toHaveLength(1);
  expect(discovered.value[0].edges.map((edge) => edge.relation)).toEqual(['CONTINUATION']);

  const result = evaluateBinding(
    { graph, descriptors: [p1, p2, origin, candidate], assessments },
    binding,
    identityVersionId('iv-c'),
    EMPTY_POLICY,
    CTX,
  );
  expect(result.eligible).toBe(true);
  if (!result.eligible) return;
  expect(result.details.perPath).toHaveLength(1);
  const outcome = result.details.perPath[0];
  expect(outcome.outcome).toEqual({ status: 'VALID' });

  // Closure runs for every VALID path. SATISFIED here means no merge node was
  // found among the path's edge children; it does not mean O's parents passed.
  expect(outcome.closure).toEqual({ status: 'SATISFIED' });

  const originBranches = graph.edges.filter((edge) => edge.child === identityVersionId('iv-o'));
  expect(originBranches.map((edge) => String(edge.parent)).sort()).toEqual(['iv-p1', 'iv-p2']);
  expect(assessments.some((record) => record.subject_version_id === identityVersionId('iv-o'))).toBe(false);
});

test.todo('BLOCKED (A-11, non-conformance): if §8.6 includes the terminal origin, O→P1 and O→P2 would be closed');
