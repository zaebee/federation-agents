import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as fc from 'fast-check';
import { registerAssessment } from '../../src/core/assessment.js';
import { validateIdentityVersionDescriptor } from '../../src/core/entities.js';
import { buildLineageGraph } from '../../src/core/lineage.js';
import { assessmentId, identityVersionId } from '../../src/core/primitives.js';
import { discoverPaths, evaluateBinding } from '../../src/core/traversal.js';
import type { BindingResult } from '../../src/core/traversal.js';
import { descriptor, link, participant, registry } from '../support/fixtures.js';
import { CTX, EMPTY_POLICY, assessmentRecord, bindingFor } from '../support/traversal.js';
import type { GeneratedCase } from './support/dag-fixtures.js';
import { dagSpecArbitrary } from './support/dag-fixtures.js';
import { buildCase } from './support/dag-fixtures.js';
import { collectExportedNames } from './support/export-surface.js';
import { normalizeProduction } from './support/normalize.js';

const SEED_ORDER = 12_101;
const SEED_ARRIVAL = 12_102;
const SEED_IMMUTABILITY = 12_103;
const SEED_CYCLES = 12_104;

function normalizedPaths(result: ReturnType<typeof discoverPaths>): unknown {
  if (!result.ok) {
    return { ok: false, kind: result.error.kind, code: result.error.code };
  }
  const paths = result.value
    .map((path) => ({
      scope: path.scope,
      edges: path.edges.map((edge) => [String(edge.child), String(edge.parent), edge.relation]),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return { ok: true, paths };
}

function stateOf(generated: GeneratedCase) {
  return { graph: generated.graph, descriptors: generated.descriptors, assessments: generated.assessments };
}

function graphFingerprint(graph: ReturnType<typeof buildLineageGraph>): string {
  return JSON.stringify({
    nodes: graph.nodes.map(String).sort(),
    edges: graph.edges
      .map((edge) => [String(edge.child), String(edge.parent), edge.relation])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    cycles: graph.cycles.map((cycle) => cycle.map(String).sort()),
  });
}

function participantIdsOf(versions: readonly { readonly participant_id: unknown }[]): string[] {
  return [...new Set(versions.map((version) => String(version.participant_id)))];
}

function graphWithStorageOrder(generated: GeneratedCase, reverse: boolean): ReturnType<typeof buildLineageGraph> {
  const versions = reverse ? [...generated.descriptors].reverse() : generated.descriptors;
  const participantIds = participantIdsOf(versions);
  if (reverse) {
    participantIds.reverse();
  }
  return buildLineageGraph(
    registry(
      participantIds.map((id) => participant(id)),
      versions,
    ),
  );
}

function graphWithReversedLineage(generated: GeneratedCase): ReturnType<typeof buildLineageGraph> {
  const versions = generated.descriptors.map((value) =>
    descriptor({
      id: String(value.id),
      participant: String(value.participant_id),
      versionLabel: String(value.version_label),
      lineage: [...value.lineage].reverse(),
    }),
  );
  return buildLineageGraph(
    registry(
      participantIdsOf(versions).map((id) => participant(id)),
      versions,
    ),
  );
}

function failureOrder(result: BindingResult): Record<string, string[]> {
  const perPath = result.eligible ? result.details.perPath : 'details' in result ? (result.details.perPath ?? []) : [];
  return Object.fromEntries(
    perPath
      .map((item) => {
        const key = JSON.stringify({
          scope: item.path.scope,
          edges: item.path.edges.map((edge) => [String(edge.child), String(edge.parent), edge.relation]),
        });
        const failures =
          item.closure?.status === 'UNSATISFIED'
            ? item.closure.failures.map(
                (failure) =>
                  `${String(failure.branch.child)}|${String(failure.branch.parent)}|${failure.branch.relation}`,
              )
            : [];
        return [key, failures] as const;
      })
      .sort((left, right) => left[0].localeCompare(right[0])),
  );
}

function compareInvariances(generated: GeneratedCase, variant: GeneratedCase): void {
  expect(graphFingerprint(variant.graph)).toBe(graphFingerprint(generated.graph));

  const baseDiscovered = discoverPaths(
    generated.graph,
    generated.binding.traversal_scope,
    generated.candidate,
    generated.origin,
  );
  const variantDiscovered = discoverPaths(
    variant.graph,
    variant.binding.traversal_scope,
    variant.candidate,
    variant.origin,
  );
  expect(normalizedPaths(variantDiscovered)).toEqual(normalizedPaths(baseDiscovered));

  const baseResult = evaluateBinding(
    stateOf(generated),
    generated.binding,
    generated.candidate,
    generated.policy,
    generated.ctx,
  );
  const variantResult = evaluateBinding(
    stateOf(variant),
    variant.binding,
    variant.candidate,
    variant.policy,
    variant.ctx,
  );
  expect(normalizeProduction(variantResult)).toEqual(normalizeProduction(baseResult));
  expect(failureOrder(variantResult)).toEqual(failureOrder(baseResult));

  for (const failures of Object.values(failureOrder(baseResult))) {
    expect([...failures]).toEqual([...failures].sort((left, right) => left.localeCompare(right)));
  }
}

function withAssessments(generated: GeneratedCase, assessments: GeneratedCase['assessments']): GeneratedCase {
  return { ...generated, assessments };
}

function evaluateCase(
  graph: ReturnType<typeof buildLineageGraph>,
  descriptors: ReturnType<typeof descriptor>[],
  assessments: GeneratedCase['assessments'],
  binding: ReturnType<typeof bindingFor>,
  candidate: ReturnType<typeof identityVersionId>,
): BindingResult {
  return evaluateBinding({ graph, descriptors, assessments }, binding, candidate, EMPTY_POLICY, CTX);
}

function chainFixture(extraVersions: readonly ReturnType<typeof descriptor>[] = []) {
  const a = participant('participant-a');
  const b = participant('participant-b');
  const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
  const candidate = descriptor({
    id: 'iv-b',
    participant: 'participant-a',
    lineage: [link('iv-a-1', 'CONTINUATION')],
  });
  const versions = [origin, candidate, ...extraVersions];
  return {
    graph: buildLineageGraph(registry([a, b], versions)),
    descriptors: versions,
    assessments: [
      assessmentRecord({
        id: 'b-a',
        subject: 'iv-b',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
    ],
    binding: bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-a',
    }),
    candidate: identityVersionId('iv-b'),
  };
}

function successorAssessment(id: string, supersedes: string): GeneratedCase['assessments'][number] {
  return {
    ...assessmentRecord({
      id,
      subject: 'iv-c',
      parents: ['iv-p'],
      relation: 'CONTINUATION',
      verified: ['OK'],
    }),
    supersedes_assessment_id: assessmentId(supersedes),
  };
}

describe('P1/P2/P3: invariance under storage, lineage and assessment order', () => {
  test('P1 registry and node storage order are irrelevant', () => {
    fc.assert(
      fc.property(dagSpecArbitrary, (spec) => {
        const generated = buildCase(spec);
        compareInvariances(generated, { ...generated, graph: graphWithStorageOrder(generated, true) });
      }),
      { numRuns: 50, seed: SEED_ORDER },
    );
  }, 15_000);

  test('P2 descriptor lineage order is irrelevant and closure failure order is canonical', () => {
    fc.assert(
      fc.property(dagSpecArbitrary, (spec) => {
        const generated = buildCase(spec);
        compareInvariances(generated, { ...generated, graph: graphWithReversedLineage(generated) });
      }),
      { numRuns: 50, seed: SEED_ORDER + 1 },
    );
  }, 15_000);

  test('P3 assessment arrival order is irrelevant', () => {
    fc.assert(
      fc.property(dagSpecArbitrary, (spec) => {
        const generated = buildCase(spec);
        compareInvariances(generated, withAssessments(generated, [...generated.assessments].reverse()));
      }),
      { numRuns: 50, seed: SEED_ARRIVAL },
    );
  }, 15_000);
});

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return Object.values(value).every(isDeepFrozen);
}

describe('P5/P6: immutability of registered state', () => {
  test('P5 graph construction and evaluation do not mutate descriptors or assessments', () => {
    fc.assert(
      fc.property(dagSpecArbitrary, (spec) => {
        const generated = buildCase(spec);
        const descriptorSnapshot = JSON.stringify(generated.descriptors);
        const assessmentSnapshot = JSON.stringify(generated.assessments);
        expect(generated.descriptors.every(isDeepFrozen)).toBe(true);

        discoverPaths(generated.graph, generated.binding.traversal_scope, generated.candidate, generated.origin);
        evaluateBinding(stateOf(generated), generated.binding, generated.candidate, generated.policy, generated.ctx);

        expect(JSON.stringify(generated.descriptors)).toBe(descriptorSnapshot);
        expect(JSON.stringify(generated.assessments)).toBe(assessmentSnapshot);
      }),
      { numRuns: 50, seed: SEED_IMMUTABILITY },
    );
  }, 15_000);

  test('P5 caller mutation after validation cannot reach the stored descriptor', () => {
    const source = {
      id: 'iv-mutable',
      participant_id: 'participant-a',
      version_label: '1.0.0',
      version_scheme: 'SEMVER_2',
      declared_protocols: [] as string[],
      public_credentials: [] as unknown[],
      lineage: [{ parent_version_id: 'iv-parent', relation: 'CONTINUATION' }],
      published_at: 1_700_000_000_000,
    };
    const validated = validateIdentityVersionDescriptor(source);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const stored = validated.value;
    const before = JSON.stringify(stored);

    const firstLink = source.lineage[0];
    if (firstLink === undefined) {
      throw new Error('fixture must contain a lineage link');
    }
    firstLink.relation = 'FORKED_FROM';
    source.lineage.push({ parent_version_id: 'iv-other', relation: 'FORKED_FROM' });
    source.declared_protocols.push('mutated');
    source.participant_id = 'participant-b';

    expect(JSON.stringify(stored)).toBe(before);
    expect(isDeepFrozen(stored)).toBe(true);
  });

  test('P6 registerAssessment is copy-on-write and preserves supersession history', () => {
    const existing = [
      assessmentRecord({
        id: 'a-1',
        subject: 'iv-c',
        parents: ['iv-p'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
    ];
    const successor = successorAssessment('a-2', 'a-1');
    const before = JSON.stringify(existing);

    const registered = registerAssessment(existing, successor);

    expect(registered.ok).toBe(true);
    expect(JSON.stringify(existing)).toBe(before);
    if (!registered.ok) return;
    expect(registered.value).toHaveLength(2);
    expect(registered.value[0]).toEqual(existing[0]);
    expect(registered.value[1]).toEqual(successor);
  });

  test('P6 closing a supersession cycle is rejected without mutating history', () => {
    const a2 = successorAssessment('a-2', 'a-1');
    const closing = successorAssessment('a-1', 'a-2');
    const before = JSON.stringify([a2]);

    const rejected = registerAssessment([a2], closing);

    expect(rejected.ok).toBe(false);
    expect(JSON.stringify([a2])).toBe(before);
    if (rejected.ok) return;
    expect(rejected.error.kind).toBe('SPEC');
    if (rejected.error.kind === 'SPEC') {
      expect(rejected.error.code).toBe('CYCLE_DETECTED');
    }
  });

  // P5/P6 lifecycle coverage (revocations, Local Acceptance) remains deferred to Tasks 13-15.
});

describe('P8: cycles never yield eligibility by themselves', () => {
  test('a candidate whose only path lies in a cycle is not eligible', () => {
    const alice = participant('participant-a');
    const v1 = descriptor({
      id: 'iv-v1',
      participant: 'participant-a',
      lineage: [link('iv-v2', 'CONTINUATION')],
    });
    const v2 = descriptor({
      id: 'iv-v2',
      participant: 'participant-a',
      lineage: [link('iv-v1', 'CONTINUATION')],
    });
    const graph = buildLineageGraph(registry([alice], [v1, v2]));
    const binding = bindingFor({
      origin: 'iv-v2',
      selector: '>=1.0.0',
      scope: 'CONTINUATION_ONLY',
      claims: ['OK'],
      targetParticipant: 'participant-a',
    });
    const assessments = [
      assessmentRecord({
        id: 'a-cycle',
        subject: 'iv-v1',
        parents: ['iv-v2'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
    ];

    const result = evaluateBinding(
      { graph, descriptors: [v1, v2], assessments },
      binding,
      identityVersionId('iv-v1'),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.eligible).toBe(false);
    if (result.eligible || !('code' in result)) return;
    expect(result.code).toBe('CYCLE_DETECTED');
  });

  test('an unrelated cycle does not invalidate an acyclic path', () => {
    const c1 = descriptor({ id: 'iv-c1', participant: 'participant-b', lineage: [link('iv-c2', 'CONTINUATION')] });
    const c2 = descriptor({ id: 'iv-c2', participant: 'participant-b', lineage: [link('iv-c1', 'CONTINUATION')] });
    const fixture = chainFixture([c1, c2]);

    const result = evaluateCase(
      fixture.graph,
      fixture.descriptors,
      fixture.assessments,
      fixture.binding,
      fixture.candidate,
    );

    expect(result.eligible).toBe(true);
  });

  test('a cyclic path is retained while an alternative acyclic path remains eligible', () => {
    const a = participant('participant-a');
    const b = participant('participant-b');
    const origin = descriptor({ id: 'iv-a-1', participant: 'participant-a' });
    const x = descriptor({ id: 'iv-x', participant: 'participant-b', lineage: [link('iv-y', 'CONTINUATION')] });
    const y = descriptor({
      id: 'iv-y',
      participant: 'participant-b',
      lineage: [link('iv-x', 'CONTINUATION'), link('iv-a-1', 'CONTINUATION')],
    });
    const good = descriptor({ id: 'iv-good', participant: 'participant-a', lineage: [link('iv-a-1', 'CONTINUATION')] });
    const candidate = descriptor({
      id: 'iv-d',
      participant: 'participant-d',
      lineage: [link('iv-x', 'MERGED_FROM'), link('iv-good', 'MERGED_FROM')],
    });
    const graph = buildLineageGraph(registry([a, b], [origin, x, y, good, candidate]));
    const binding = bindingFor({
      origin: 'iv-a-1',
      selector: '>=1.0.0',
      scope: 'FULL_ANCESTRY',
      claims: ['OK'],
      targetParticipant: 'participant-d',
    });
    const assessments = [
      assessmentRecord({ id: 'd-x', subject: 'iv-d', parents: ['iv-x'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({ id: 'd-g', subject: 'iv-d', parents: ['iv-good'], relation: 'MERGED_FROM', verified: ['OK'] }),
      assessmentRecord({
        id: 'good-a',
        subject: 'iv-good',
        parents: ['iv-a-1'],
        relation: 'CONTINUATION',
        verified: ['OK'],
      }),
      assessmentRecord({ id: 'x-y', subject: 'iv-x', parents: ['iv-y'], relation: 'CONTINUATION', verified: ['OK'] }),
      assessmentRecord({ id: 'y-x', subject: 'iv-y', parents: ['iv-x'], relation: 'CONTINUATION', verified: ['OK'] }),
      assessmentRecord({ id: 'y-a', subject: 'iv-y', parents: ['iv-a-1'], relation: 'CONTINUATION', verified: ['OK'] }),
    ];

    const result = evaluateBinding(
      { graph, descriptors: [origin, x, y, good, candidate], assessments },
      binding,
      identityVersionId('iv-d'),
      EMPTY_POLICY,
      CTX,
    );

    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.details.perPath.some((item) => item.outcome.status === 'CYCLE_DETECTED')).toBe(true);
    expect(result.acceptedPaths.length).toBeGreaterThan(0);
  });

  test('cycling pairs placed away from the chain never invalidate the chain', () => {
    const pairs = [
      [1, 2],
      [1, 3],
      [2, 3],
    ] as const;

    fc.assert(
      fc.property(fc.constantFrom(...pairs), ([first, second]) => {
        const cycleFirst = descriptor({
          id: `iv-c${first}`,
          participant: 'participant-b',
          lineage: [link(`iv-c${second}`, 'CONTINUATION')],
        });
        const cycleSecond = descriptor({
          id: `iv-c${second}`,
          participant: 'participant-b',
          lineage: [link(`iv-c${first}`, 'CONTINUATION')],
        });
        const fixture = chainFixture([cycleFirst, cycleSecond]);
        const result = evaluateCase(
          fixture.graph,
          fixture.descriptors,
          fixture.assessments,
          fixture.binding,
          fixture.candidate,
        );
        expect(result.eligible).toBe(true);
      }),
      { numRuns: 3, seed: SEED_CYCLES },
    );
  }, 15_000);
});

describe('P9: public core surface exposes no grant-producing API', () => {
  test('no exported identifier from the public entry transitively suggests grants', () => {
    const exported = collectExportedNames(resolve(import.meta.dir, '../../src/index.ts'));

    expect(exported.size).toBeGreaterThan(20);
    expect(exported.has('evaluateBinding')).toBe(true);
    expect(exported.has('UIA_CORE_001_REVISION')).toBe(true);

    const offenders = [...exported].filter((name) => /grant|capabilit|permission/i.test(name));
    expect(offenders).toEqual([]);
    // Limitation: this guard inspects the exported surface/names only; it does
    // not prove that no implementation body can mint authority indirectly.
  });

  test('regression: local named exports and namespace members are detected through barrels', () => {
    const directory = mkdtempSync(join(tmpdir(), 'uia-p9-'));
    try {
      writeFileSync(
        join(directory, 'danger.ts'),
        'const grantAuthority = () => {};\nconst harmless = 1;\nexport { grantAuthority, harmless as publicHarmless };\n',
      );
      writeFileSync(join(directory, 'barrel.ts'), "export * from './danger.js';\n");
      writeFileSync(
        join(directory, 'entry.ts'),
        "export * from './barrel.js';\nexport * as danger from './danger.js';\n",
      );

      const exported = collectExportedNames(join(directory, 'entry.ts'));

      expect(exported.has('grantAuthority')).toBe(true);
      expect(exported.has('publicHarmless')).toBe(true);
      expect(exported.has('danger')).toBe(true);
      expect([...exported].filter((name) => /grant/i.test(name))).toEqual(['grantAuthority']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
