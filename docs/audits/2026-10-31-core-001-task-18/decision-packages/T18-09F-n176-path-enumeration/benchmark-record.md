# T18-09F — Benchmark Record (empirical evidence)

**Status:** executed benchmark record. This is **empirical evidence of resource-exhaustion risk**, not a proof of complexity and not a normative result.

**Repository revision (exact):** `9e29b3627c9c5daab3a3029d8326dec65c47c161` (`main`, after PR #75 merge).

**Machine / runtime:**
- OS: Debian GNU/Linux 13 (trixie)
- CPU: AMD EPYC-Rome Processor, 4 cores, 1 thread per core
- RAM: 7.6 GiB total (4.7 GiB used, 2.9 GiB available at run time)
- Runtime: Bun 1.4.2 (Linux x64)
- Node.js present for tooling: v22.19.0 (not used by the benchmark)

**Generator:** merge-diamond chain per `benchmark-procedure.md` §1–§2. Source: temporary harness `/home/zaebee/.opencode/plan/bench-n176.ts` (not committed; reconstructed below). It uses only public helpers: `descriptor`, `link`, `participant`, `registry`, `buildLineageGraph`, `identityVersionId`, `discoverPaths`.

**Measurement method:**
- For each `k`, build `G(k)`, then call `discoverPaths(graph, 'FULL_ANCESTRY', iv-base-0, iv-origin)` once.
- `timeMs`: `performance.now()` around the single call.
- `rssDeltaMB`: `process.memoryUsage().rss` immediately before and after the call, converted to MiB.
- `rssAfterMB`: RSS after the call.
- No warm-up, no repeated runs, no aggregation beyond the single recorded value. This record is therefore a point measurement; it should be re-run with warm-up and repetitions before any performance claim is treated as stable.
- The process was otherwise idle; no concurrency.

**Scope of measurement:** `discoverPaths` only. It does **not** measure `evaluateBinding`, assessment applicability, or closure. It does **not** measure peak heap, only RSS delta. It does not prove polynomial or exponential complexity.

**Results:**

| k | nodes `3k+2` | expected paths `2^k` | actual paths | time (ms) | RSS delta (MiB) | RSS after (MiB) |
|---:|---:|---:|---:|---:|---:|---:|
| 12 | 38 | 4 096 | 4 096 | 157 | 35 | 63 |
| 14 | 44 | 16 384 | 16 384 | 581 | 81 | 144 |
| 16 | 50 | 65 536 | 65 536 | 1 789 | 352 | 497 |
| 18 | 56 | 262 144 | 262 144 | 9 669 | 1 479 | 1 976 |

**Generator (exact):**

```ts
import { descriptor, link, participant, registry } from '.../tests/support/fixtures.js';
import { buildLineageGraph } from '.../src/core/lineage.js';
import { identityVersionId } from '.../src/core/primitives.js';
import { discoverPaths } from '.../src/core/traversal.js';

function buildGraph(k: number) {
  const alice = participant('participant-a');
  const origin = descriptor({ id: 'iv-origin', participant: 'participant-a', versionLabel: '1.0.0' });
  const lefts = Array.from({ length: k }, (_, i) =>
    descriptor({ id: `iv-l-${i}`, participant: 'participant-a', versionLabel: '1.0.0',
      lineage: [link(`iv-base-${i + 1}`, 'FORKED_FROM')] }));
  const rights = Array.from({ length: k }, (_, i) =>
    descriptor({ id: `iv-r-${i}`, participant: 'participant-a', versionLabel: '1.0.0',
      lineage: [link(`iv-base-${i + 1}`, 'FORKED_FROM')] }));
  const bases = Array.from({ length: k + 1 }, (_, i) =>
    descriptor({
      id: `iv-base-${i}`, participant: 'participant-a', versionLabel: '1.0.0',
      lineage: i < k
        ? [link(`iv-l-${i}`, 'MERGED_FROM'), link(`iv-r-${i}`, 'MERGED_FROM')]
        : [link('iv-origin', 'CONTINUATION')],
    }));
  const versions = [origin, ...bases, ...lefts, ...rights];
  const graph = buildLineageGraph(registry([alice], versions));
  return { graph, candidate: 'iv-base-0', origin: 'iv-origin' };
}

for (const k of [12, 14, 16, 18]) {
  const { graph, candidate, origin } = buildGraph(k);
  const before = process.memoryUsage().rss;
  const t0 = performance.now();
  const result = discoverPaths(graph, 'FULL_ANCESTRY', identityVersionId(candidate), identityVersionId(origin));
  const t1 = performance.now();
  const after = process.memoryUsage().rss;
  // record result.value.length, t1-t0, (after-before)/1024/1024, after/1024/1024
}
```

**Interpretation (bounded):**
- The path count is exactly `2^k` for each `k`, confirming the output lower bound.
- Time and memory grow roughly in proportion to the number of paths on this shape. This is **empirical evidence** of a resource-exhaustion risk for untrusted participants; it is not a complexity proof and does not establish that a compact equivalent computation exists.
- `k=20` (1 048 576 paths) was not run in this record; the procedure permits it but it was omitted to avoid a multi-GiB allocation on this machine. The trend from k=12..18 is sufficient to size the risk.

**Determinism check (procedure §6):** not executed in this record; the graph's `nodes`/`edges` arrays were not reversed in this run. The existing property tests (`traversal-invariance.test.ts` P1/P2) cover storage-order invariance on bounded DAGs, but not this exponential shape. A follow-up should run the reversal check on at least k=12.