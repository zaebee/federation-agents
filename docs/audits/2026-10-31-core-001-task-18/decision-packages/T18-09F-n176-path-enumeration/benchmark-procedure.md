# N-176 — Reproducible Merge-Diamond Benchmark Procedure

**Status:** DRAFT / documentation only. No executable benchmark is committed by this package.
**Purpose:** Make the `2^k` path-growth claim in N-176 reproducible from a stated graph construction rather than a scratch script.

---

## 1. Graph construction

For a chain length `k ≥ 1`, build a lineage graph `G(k)` with:

- one `origin`;
- bases `base_0 … base_k`;
- left/right branch nodes `l_0 … l_{k-1}` and `r_0 … r_{k-1}`.

Node count: `1 + (k + 1) + 2k = 3k + 2`.

Edges, for every `i` in `0 … k-1`:

```text
base_i  MERGED_FROM  l_i
base_i  MERGED_FROM  r_i
l_i     FORKED_FROM  base_{i+1}
r_i     FORKED_FROM  base_{i+1}
```

Final edge:

```text
base_k  CONTINUATION  origin
```

All nodes use the same participant where the relation requires continuity
(`base_k → origin`); branch nodes are otherwise unconstrained by the benchmark.
The candidate is `base_0`; the origin is `origin`; traversal scope is
`FULL_ANCESTRY`.

## 2. Why the path count is `2^k`

At each layer `i`, a path must choose either `l_i` or `r_i`, then continue from
`base_{i+1}`. The choices are independent across `k` layers, so the number of
simple `base_0 → origin` paths is exactly `2^k`.

## 3. Expected counts

| `k` | Nodes `3k+2` | Expected paths `2^k` |
| ---: | ---: | ---: |
| 12 | 38 | 4 096 |
| 14 | 44 | 16 384 |
| 16 | 50 | 65 536 |
| 20 | 62 | 1 048 576 |

Issue #25 records approximately:

- `k=12` → 4 096 paths / 173 ms;
- `k=14` → 16 384 paths / 722 ms;
- `k=16` → 65 536 paths / 2 672 ms.

Those timings are environment-specific (Bun 1.4.2, scratch script) and are not a
contractual performance target. The path counts are the reproducible part.

## 4. Procedure

1. Build `G(k)` with the node/edge construction in §1.
2. Call `discoverPaths(graph, 'FULL_ANCESTRY', base_0, origin)`.
3. Record:
   - `result.ok`;
   - `result.value.length`;
   - wall-clock time;
   - peak memory if available.
4. Repeat for `k = 12, 14, 16` (optionally `20`) and verify the path count is
   exactly `2^k`.
5. For binding-level measurement, supply a trivial assessment set and call
   `evaluateBinding`; record `details.perPath.length` and time. The assessment
   fixture must not change the path count.

A minimal Bun/TypeScript harness should use the repository's existing
`descriptor`, `registry`, `buildLineageGraph`, `identityVersionId`, and
`discoverPaths` helpers; it must not depend on private internals.

## 5. What this benchmark does and does not prove

**Proves:** the current implementation returns `2^k` paths for this linear-size
graph, so path enumeration is an output lower bound.

**Does not prove:** that a compact equivalence is possible, what the compact
witness should be, or any normative conclusion. Those are the `T18-DEC-18`
questions.

**Regression use:** once a non-enumerating result is implemented, this graph is
the resource-exhaustion regression fixture. The test should assert completion
without a path-proportional output, not merely a faster enumeration.

## 6. Determinism checks

For each `k`, also reverse the graph's `nodes` and `edges` arrays and compare the
result. The path count must be identical; canonical witness ordering, if any,
must not depend on storage order (B-7 / §8.8).
