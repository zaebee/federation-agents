// Structural lineage validation for UIA-CORE-001 §5 (Task 6).
//
// Scope is deliberately limited to the structural rules of §5.2:
// per-relation cardinality, the CONTINUATION same-participant constraint, and
// self-parent rejection. Graph construction, delayed-parent resolution and
// cycle detection belong to Task 7 and live in a later part of this module.
//
// `validateDescriptor` is pure: it never mutates the descriptor or Registry,
// never inserts anything, and never normalizes or drops declared links.

import type { IdentityVersionDescriptor, LineageLink, LineageRelationType, ParticipantRecord } from './entities.js';
import { deepFreeze } from './ownership.js';
import type { DeepReadonly } from './ownership.js';
import type { IdentityVersionID } from './primitives.js';

/**
 * Read-only view of a domain's known participants and identity versions.
 *
 * Registry contents are assumed consistent: duplicate version ids are a caller
 * error and their behavior is unspecified, not a supported case.
 */
export interface Registry {
  participants(): readonly DeepReadonly<ParticipantRecord>[];
  versions(): readonly DeepReadonly<IdentityVersionDescriptor>[];
}

/** Result of the §5.2 structural rules. */
export type StructuralResult =
  | { readonly status: 'VALID' }
  | {
      readonly status: 'REJECTED';
      readonly code: 'ERR_INVALID_RELATION' | 'ERR_INVALID_CARDINALITY';
      readonly parent_version_id?: IdentityVersionID;
    };

interface CardinalityRule {
  readonly min: number;
  readonly max: number;
}

const CARDINALITY: Readonly<Record<LineageRelationType, CardinalityRule>> = {
  CONTINUATION: { min: 1, max: 1 },
  FORKED_FROM: { min: 1, max: 1 },
  MERGED_FROM: { min: 2, max: Number.POSITIVE_INFINITY },
};

const RELATIONS: readonly LineageRelationType[] = ['CONTINUATION', 'FORKED_FROM', 'MERGED_FROM'];

function findVersion(
  registry: Registry,
  versionId: IdentityVersionID,
): DeepReadonly<IdentityVersionDescriptor> | undefined {
  return registry.versions().find((version) => version.id === versionId);
}

function findSelfParent(descriptor: DeepReadonly<IdentityVersionDescriptor>): IdentityVersionID | undefined {
  return descriptor.lineage.find((link) => link.parent_version_id === descriptor.id)?.parent_version_id;
}

/**
 * Effective count per relation. MERGED_FROM joins distinct parent lines, so
 * duplicate links to one parent count once (§5.2).
 */
function relationCounts(lineage: readonly DeepReadonly<LineageLink>[]): Readonly<Record<LineageRelationType, number>> {
  const counts: Record<LineageRelationType, number> = {
    CONTINUATION: 0,
    FORKED_FROM: 0,
    MERGED_FROM: 0,
  };
  const mergedParents = new Set<IdentityVersionID>();

  for (const link of lineage) {
    if (link.relation === 'MERGED_FROM') {
      mergedParents.add(link.parent_version_id);
    } else {
      counts[link.relation] += 1;
    }
  }
  counts.MERGED_FROM = mergedParents.size;
  return counts;
}

function violatesCardinality(counts: Readonly<Record<LineageRelationType, number>>): boolean {
  return RELATIONS.some((relation) => {
    const count = counts[relation];
    if (count === 0) {
      return false;
    }
    const rule = CARDINALITY[relation];
    return count < rule.min || count > rule.max;
  });
}

function findContinuationViolation(
  descriptor: DeepReadonly<IdentityVersionDescriptor>,
  registry: Registry,
): IdentityVersionID | undefined {
  const continuation = descriptor.lineage.find((link) => link.relation === 'CONTINUATION');
  if (continuation === undefined) {
    return undefined;
  }
  const parent = findVersion(registry, continuation.parent_version_id);
  if (parent === undefined) {
    return undefined;
  }
  return parent.participant_id === descriptor.participant_id ? undefined : continuation.parent_version_id;
}

/**
 * Applies the §5.2 structural rules to a descriptor that has already passed the
 * Task 4 boundary validator.
 *
 * Missing parents are not rejected: delayed-parent handling belongs to Task 7.
 * When a CONTINUATION parent is present, its participant must match the child's.
 */
export function validateDescriptor(
  descriptor: DeepReadonly<IdentityVersionDescriptor>,
  registry: Registry,
): StructuralResult {
  const selfParent = findSelfParent(descriptor);
  if (selfParent !== undefined) {
    return { status: 'REJECTED', code: 'ERR_INVALID_RELATION', parent_version_id: selfParent };
  }

  if (violatesCardinality(relationCounts(descriptor.lineage))) {
    return { status: 'REJECTED', code: 'ERR_INVALID_CARDINALITY' };
  }

  const continuationViolation = findContinuationViolation(descriptor, registry);
  if (continuationViolation !== undefined) {
    return { status: 'REJECTED', code: 'ERR_INVALID_RELATION', parent_version_id: continuationViolation };
  }

  return { status: 'VALID' };
}

export interface LineageEdge {
  readonly child: IdentityVersionID;
  readonly parent: IdentityVersionID;
  readonly relation: LineageRelationType;
}

export interface LineageGraph {
  readonly nodes: readonly IdentityVersionID[];
  readonly edges: readonly DeepReadonly<LineageEdge>[];
  readonly unresolvedParents: readonly (readonly [IdentityVersionID, readonly IdentityVersionID[]])[];
  readonly cycles: readonly (readonly IdentityVersionID[])[];
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareEdges(a: LineageEdge, b: LineageEdge): number {
  return (
    compareStrings(a.child, b.child) || compareStrings(a.parent, b.parent) || compareStrings(a.relation, b.relation)
  );
}

function collectEdges(versions: readonly DeepReadonly<IdentityVersionDescriptor>[]): LineageEdge[] {
  const edges: LineageEdge[] = [];
  for (const version of versions) {
    for (const lineage of version.lineage) {
      edges.push({
        child: version.id,
        parent: lineage.parent_version_id,
        relation: lineage.relation,
      });
    }
  }
  edges.sort(compareEdges);
  return edges;
}

function collectUnresolvedParents(
  nodes: ReadonlySet<IdentityVersionID>,
  edges: readonly LineageEdge[],
): LineageGraph['unresolvedParents'] {
  const missingByChild = new Map<IdentityVersionID, Set<IdentityVersionID>>();

  for (const edge of edges) {
    if (nodes.has(edge.parent)) {
      continue;
    }
    let missing = missingByChild.get(edge.child);
    if (missing === undefined) {
      missing = new Set<IdentityVersionID>();
      missingByChild.set(edge.child, missing);
    }
    missing.add(edge.parent);
  }

  return [...missingByChild.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([child, parents]) => [child, [...parents].sort(compareStrings)] as const);
}

/** Deduplicated adjacency for cycle detection only; `edges` keeps duplicates. */
function buildAdjacency(
  nodes: readonly IdentityVersionID[],
  edges: readonly LineageEdge[],
): Map<IdentityVersionID, IdentityVersionID[]> {
  const adjacency = new Map<IdentityVersionID, Set<IdentityVersionID>>();
  for (const node of nodes) {
    adjacency.set(node, new Set<IdentityVersionID>());
  }
  for (const edge of edges) {
    adjacency.get(edge.child)?.add(edge.parent);
  }

  const sorted = new Map<IdentityVersionID, IdentityVersionID[]>();
  for (const [node, parents] of adjacency) {
    sorted.set(node, [...parents].sort(compareStrings));
  }
  return sorted;
}

function finishOrder(
  nodes: readonly IdentityVersionID[],
  adjacency: ReadonlyMap<IdentityVersionID, readonly IdentityVersionID[]>,
): IdentityVersionID[] {
  const visited = new Set<IdentityVersionID>();
  const order: IdentityVersionID[] = [];

  for (const start of nodes) {
    if (visited.has(start)) {
      continue;
    }
    visited.add(start);
    const stack: Array<{ node: IdentityVersionID; next: number }> = [{ node: start, next: 0 }];

    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (frame === undefined) {
        break;
      }
      const parents = adjacency.get(frame.node) ?? [];

      if (frame.next >= parents.length) {
        order.push(frame.node);
        stack.pop();
        continue;
      }

      const parent = parents[frame.next];
      frame.next += 1;
      if (!visited.has(parent) && adjacency.has(parent)) {
        visited.add(parent);
        stack.push({ node: parent, next: 0 });
      }
    }
  }

  return order;
}

function reverseAdjacency(
  nodes: readonly IdentityVersionID[],
  adjacency: ReadonlyMap<IdentityVersionID, readonly IdentityVersionID[]>,
): Map<IdentityVersionID, IdentityVersionID[]> {
  const reverse = new Map<IdentityVersionID, IdentityVersionID[]>();
  for (const node of nodes) {
    reverse.set(node, []);
  }
  for (const [child, parents] of adjacency) {
    for (const parent of parents) {
      reverse.get(parent)?.push(child);
    }
  }
  for (const children of reverse.values()) {
    children.sort(compareStrings);
  }
  return reverse;
}

function stronglyConnectedComponents(
  nodes: readonly IdentityVersionID[],
  adjacency: ReadonlyMap<IdentityVersionID, readonly IdentityVersionID[]>,
): IdentityVersionID[][] {
  const order = finishOrder(nodes, adjacency);
  const reverse = reverseAdjacency(nodes, adjacency);
  const assigned = new Set<IdentityVersionID>();
  const components: IdentityVersionID[][] = [];

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const start = order[index];
    if (assigned.has(start)) {
      continue;
    }

    const component: IdentityVersionID[] = [];
    const stack: IdentityVersionID[] = [start];
    assigned.add(start);

    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) {
        break;
      }
      component.push(node);
      for (const child of reverse.get(node) ?? []) {
        if (!assigned.has(child)) {
          assigned.add(child);
          stack.push(child);
        }
      }
    }

    component.sort(compareStrings);
    components.push(component);
  }

  components.sort((a, b) => compareStrings(a[0], b[0]));
  return components;
}

function isCyclicComponent(
  component: readonly IdentityVersionID[],
  adjacency: ReadonlyMap<IdentityVersionID, readonly IdentityVersionID[]>,
): boolean {
  if (component.length > 1) {
    return true;
  }
  const node = component[0];
  return (adjacency.get(node) ?? []).includes(node);
}

/**
 * Builds an immutable lineage graph snapshot from a Registry.
 *
 * Declared edges are preserved exactly, including duplicates and references to
 * parents that are not registered yet. Unresolved parents are grouped by child
 * and deduplicated for diagnostics only. Cycles are reported as sorted strongly
 * connected components (a self-loop is a one-node component); they do not
 * remove nodes or edges. `CYCLE_DETECTED` belongs to the assessment boundary of
 * a later traversal task and is not emitted here.
 */
export function buildLineageGraph(registry: Registry): LineageGraph {
  const versions = registry.versions();
  const nodes = [...new Set(versions.map((version) => version.id))].sort(compareStrings);
  const nodeSet = new Set(nodes);
  const edges = collectEdges(versions);
  const unresolvedParents = collectUnresolvedParents(nodeSet, edges);
  const adjacency = buildAdjacency(nodes, edges);
  const cycles = stronglyConnectedComponents(nodes, adjacency).filter((component) =>
    isCyclicComponent(component, adjacency),
  );

  return deepFreeze({ nodes, edges, unresolvedParents, cycles }) as LineageGraph;
}
