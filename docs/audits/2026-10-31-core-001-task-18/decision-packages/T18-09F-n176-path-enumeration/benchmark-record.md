# T18-09F — Benchmark Record (empirical evidence)

**Status:** executed benchmark record. This is **empirical evidence of resource-exhaustion risk**, not a proof of complexity and not a normative result.

**Source revision measured (exact):** `9e29b3627c9c5daab3a3029d8326dec65c47c161` (`main`, after PR #75 merge).

**Harness revision (exact):** commit that introduced [`benchmark-harness.ts`](./benchmark-harness.ts) in this PR. The harness does not change `src/`, `tests/`, or the public surface; the source revision above and this PR's source tree are identical. To reproduce, check out this PR head (the commit containing the harness) and run the command below from the repository root.

**Harness (saved, runnable):** [`benchmark-harness.ts`](./benchmark-harness.ts). It is a non-production documentation artifact; it is not imported by `src/` or `tests/`.

**Machine / runtime:**
- OS: Debian GNU/Linux 13 (trixie)
- CPU: AMD EPYC-Rome Processor, 4 cores, 1 thread per core
- RAM: 7.6 GiB total (4.7 GiB used, 2.9 GiB available at run time)
- Runtime: Bun 1.4.2 (Linux x64)
- Node.js present for tooling: v22.19.0 (not used by the benchmark)

**Generator:** merge-diamond chain per `benchmark-procedure.md` §1–§2. The saved harness uses only public helpers: `descriptor`, `link`, `participant`, `registry`, `buildLineageGraph`, `identityVersionId`, `discoverPaths`.

**Exact command (from repository root):**

```bash
for k in 12 14 16; do
  for i in 1 2 3; do
    bun run docs/audits/2026-10-31-core-001-task-18/decision-packages/T18-09F-n176-path-enumeration/benchmark-harness.ts "$k"
  done
done
for i in 1 2; do
  bun run docs/audits/2026-10-31-core-001-task-18/decision-packages/T18-09F-n176-path-enumeration/benchmark-harness.ts 18
done
# storage-order reversal check
bun run docs/audits/2026-10-31-core-001-task-18/decision-packages/T18-09F-n176-path-enumeration/benchmark-harness.ts 12 reverse
```

**Measurement method:**
- Each invocation builds one `G(k)` in a fresh process, then calls `discoverPaths(graph, 'FULL_ANCESTRY', iv-base-0, iv-origin)` once.
- `timeMs`: `performance.now()` around the single call.
- `rssDeltaMB`: `process.memoryUsage().rss` immediately before and after the call, converted to MiB.
- `rssAfterMB`: RSS after the call.
- **Warm-up:** none. Each run is a cold process.
- **Repetitions:** 3 for `k = 12, 14, 16`; 2 for `k = 18`. The 18-repeat was limited to two runs because each run allocates ~2 GiB RSS on this 7.6 GiB machine.
- **Aggregation:** median of the recorded runs for time and RSS delta. No outlier removal.
- The process was otherwise idle; no concurrency.

**Scope of measurement:** `discoverPaths` only. It does **not** measure `evaluateBinding`, assessment applicability, or closure. It does **not** measure peak heap, only RSS delta. It does not prove polynomial or exponential complexity.

**Raw results:**

| k | run | nodes `3k+2` | expected paths `2^k` | actual paths | time (ms) | RSS delta (MiB) | RSS after (MiB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 12 | 1 | 38 | 4 096 | 4 096 | 179 | 34 | 63 |
| 12 | 2 | 38 | 4 096 | 4 096 | 145 | 35 | 63 |
| 12 | 3 | 38 | 4 096 | 4 096 | 181 | 34 | 63 |
| 14 | 1 | 44 | 16 384 | 16 384 | 520 | 118 | 147 |
| 14 | 2 | 44 | 16 384 | 16 384 | 442 | 108 | 136 |
| 14 | 3 | 44 | 16 384 | 16 384 | 567 | 115 | 143 |
| 16 | 1 | 50 | 65 536 | 65 536 | 2 305 | 458 | 487 |
| 16 | 2 | 50 | 65 536 | 65 536 | 2 765 | 465 | 494 |
| 16 | 3 | 50 | 65 536 | 65 536 | 1 833 | 426 | 455 |
| 18 | 1 | 56 | 262 144 | 262 144 | 9 606 | 1 970 | 1 999 |
| 18 | 2 | 56 | 262 144 | 262 144 | 9 709 | 1 934 | 1 963 |

**Aggregated (median):**

| k | nodes | paths | time (ms) | RSS delta (MiB) |
|---:|---:|---:|---:|---:|
| 12 | 38 | 4 096 | 179 | 34 |
| 14 | 44 | 16 384 | 520 | 115 |
| 16 | 50 | 65 536 | 2 305 | 458 |
| 18 | 56 | 262 144 | 9 657.5 | 1 952 |

**Interpretation (bounded):**
- The path count is exactly `2^k` for each `k`, confirming the output lower bound.
- Time and memory grow roughly in proportion to the number of paths on this shape. This is **empirical evidence** of a resource-exhaustion risk for untrusted participants; it is not a complexity proof and does not establish that a compact equivalent computation exists.
- `k=20` (1 048 576 paths) was not run; the procedure permits it but it would require a multi-GiB allocation on this machine. The trend from k=12..18 is sufficient to size the risk.

**Storage-order reversal check (procedure §6, executed):** for `k=12`, the harness ran once with the original `nodes`/`edges` arrays and once with both arrays reversed. Both returned 4 096 paths with the same digest `682585051c6b7be9` (SHA-256 prefix over the full ordered path list). Times were 182 ms and 169 ms respectively. This is evidence for the `k=12` shape only; it is not a general determinism proof.