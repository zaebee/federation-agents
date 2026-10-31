// Non-production benchmark harness for the T18-09F N-176 decision package.
// Run from the repository root:
//   bun run docs/audits/2026-10-31-core-001-task-18/decision-packages/T18-09F-n176-path-enumeration/benchmark-harness.ts <k>
// It prints one JSON record per invocation. Use a fresh process per k/run so RSS
// deltas are not polluted by earlier graphs.

import { buildLineageGraph } from '../../../../../src/core/lineage.js';
import { identityVersionId } from '../../../../../src/core/primitives.js';
import { discoverPaths } from '../../../../../src/core/traversal.js';
import { descriptor, link, participant, registry } from '../../../../../tests/support/fixtures.js';

function buildGraph(k: number) {
  const alice = participant('participant-a');
  const origin = descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' });
  const lefts = Array.from({ length: k }, (_, i) =>
    descriptor({
      id: `iv-l-${i}`,
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link(`iv-base-${i + 1}`, 'FORKED_FROM')],
    }),
  );
  const rights = Array.from({ length: k }, (_, i) =>
    descriptor({
      id: `iv-r-${i}`,
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage: [link(`iv-base-${i + 1}`, 'FORKED_FROM')],
    }),
  );
  const bases = Array.from({ length: k + 1 }, (_, i) =>
    descriptor({
      id: `iv-base-${i}`,
      participant: 'participant-a',
      versionLabel: '1.0.0',
      lineage:
        i < k
          ? [link(`iv-l-${i}`, 'MERGED_FROM'), link(`iv-r-${i}`, 'MERGED_FROM')]
          : [link('iv-origin', 'CONTINUATION')],
    }),
  );
  const versions = [origin, ...bases, ...lefts, ...rights];
  const graph = buildLineageGraph(registry([alice], versions));
  return { graph, candidate: 'iv-base-0', origin: 'iv-origin' };
}

const k = Number(process.argv[2]);
if (!Number.isInteger(k) || k < 1) {
  throw new Error('usage: benchmark-harness.ts <k>');
}

const { graph, candidate, origin } = buildGraph(k);
const before = process.memoryUsage().rss;
const t0 = performance.now();
const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId(candidate), identityVersionId(origin));
const t1 = performance.now();
const after = process.memoryUsage().rss;

console.log(
  JSON.stringify({
    k,
    nodes: graph.nodes.length,
    expectedPaths: 2 ** k,
    actualPaths: result.ok ? result.value.length : 'ERR',
    timeMs: Math.round(t1 - t0),
    rssDeltaMB: Math.round((after - before) / 1024 / 1024),
    rssAfterMB: Math.round(after / 1024 / 1024),
  }),
);