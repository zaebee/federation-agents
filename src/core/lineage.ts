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
