// Structural lineage validation for UIA-CORE-001 §5 (Task 6).
//
// Scope is deliberately limited to the structural rules of §5.2:
// per-relation cardinality, the CONTINUATION same-participant constraint, and
// self-parent rejection. Graph construction, delayed-parent resolution and
// cycle detection belong to Task 7 and live in a later part of this module.
//
// `validateDescriptor` is pure: it never mutates the descriptor or Registry,
// never inserts anything, and never normalizes or drops declared links.

import type { IdentityVersionDescriptor, LineageRelationType, ParticipantRecord } from './entities.js';
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

function findVersion(
  registry: Registry,
  versionId: IdentityVersionID,
): DeepReadonly<IdentityVersionDescriptor> | undefined {
  return registry.versions().find((version) => version.id === versionId);
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
  for (const link of descriptor.lineage) {
    if (link.parent_version_id === descriptor.id) {
      return { status: 'REJECTED', code: 'ERR_INVALID_RELATION', parent_version_id: link.parent_version_id };
    }
  }

  const counts: Record<LineageRelationType, number> = {
    CONTINUATION: 0,
    FORKED_FROM: 0,
    MERGED_FROM: 0,
  };
  const mergedParents = new Set<IdentityVersionID>();
  for (const link of descriptor.lineage) {
    counts[link.relation] += 1;
    if (link.relation === 'MERGED_FROM') {
      mergedParents.add(link.parent_version_id);
    }
  }

  for (const relation of Object.keys(CARDINALITY) as LineageRelationType[]) {
    // MERGED_FROM joins distinct parent lines: duplicate links to one parent
    // cannot satisfy the minimum of two parents (§5.2).
    const count = relation === 'MERGED_FROM' ? mergedParents.size : counts[relation];
    if (count === 0) {
      continue;
    }
    const rule = CARDINALITY[relation];
    if (count < rule.min || count > rule.max) {
      return { status: 'REJECTED', code: 'ERR_INVALID_CARDINALITY' };
    }
  }

  const continuation = descriptor.lineage.find((link) => link.relation === 'CONTINUATION');
  if (continuation !== undefined) {
    const parent = findVersion(registry, continuation.parent_version_id);
    if (parent !== undefined && parent.participant_id !== descriptor.participant_id) {
      return { status: 'REJECTED', code: 'ERR_INVALID_RELATION', parent_version_id: continuation.parent_version_id };
    }
  }

  return { status: 'VALID' };
}
