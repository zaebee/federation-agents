import { describe, expect, test } from 'bun:test';
import {
  assessEdge,
  evaluateAssurance,
  registerAssessment,
  type ApplicableAssessments,
  type AssuranceResult,
  type ContinuityAssessment,
  type ContinuityAssuranceRequirement,
  type EdgeRef,
  type Policy,
} from '../../src/core/assessment.js';
import type { TemporalContext } from '../../src/core/temporal.js';
import { assessmentId, domainId, identityVersionId, timestamp } from '../../src/core/primitives.js';
import type { DeepReadonly } from '../../src/core/ownership.js';

const BASE_TIME = 1_700_000_000_000;

const EDGE: EdgeRef = {
  child: identityVersionId('iv-child'),
  parent: identityVersionId('iv-parent'),
  relation: 'CONTINUATION',
};

const CTX: TemporalContext = {
  basis: 'ASSESSED_AT',
  declared: {},
  trust: {},
};

function outcome(result: AssuranceResult) {
  if ('kind' in result) {
    throw new Error(`unexpected mechanism failure: ${result.code}`);
  }
  return result;
}

function unsatisfied(result: AssuranceResult) {
  const value = outcome(result);
  if (value.status !== 'UNSATISFIED') {
    throw new Error(`expected UNSATISFIED, got ${value.status}`);
  }
  return value;
}

function trustedRequirement(overrides: Partial<ContinuityAssuranceRequirement> = {}): ContinuityAssuranceRequirement {
  return requirement({ trusted_assessors: [domainId('domain-a')], ...overrides });
}

function evaluateTrusted(
  assessments: readonly ContinuityAssessment[],
  overrides: Partial<ContinuityAssuranceRequirement> = {},
  policyValue: Policy = policy(),
): AssuranceResult {
  return evaluateAssurance(applicable(assessments), trustedRequirement(overrides), policyValue, CTX);
}

function unsatisfiedResult(missing: string[], disallowed: string[] = []) {
  return {
    status: 'UNSATISFIED' as const,
    code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED' as const,
    missing,
    disallowed,
    note: 'required-claim-not-verified; no-negative-finding-established' as const,
  };
}

function assessment(overrides: Partial<ContinuityAssessment> = {}): ContinuityAssessment {
  return {
    assessment_id: assessmentId('assessment-1'),
    subject_version_id: identityVersionId('iv-child'),
    parent_version_ids: [identityVersionId('iv-parent')],
    declared_relation: 'CONTINUATION',
    assessment_profile_ref: 'profile-1',
    assessment_method_version: '1.0.0',
    verified_claims: [],
    unverified_claims: [],
    evidence_refs: [],
    assessed_by: domainId('domain-a'),
    assessed_at: timestamp(BASE_TIME),
    ...overrides,
  };
}

function requirement(overrides: Partial<ContinuityAssuranceRequirement> = {}): ContinuityAssuranceRequirement {
  return { required_claims: [], ...overrides };
}

function policy(overrides: Partial<Policy> = {}): Policy {
  return { ...overrides };
}

function applicable(
  assessments: readonly ContinuityAssessment[],
  policyValue: Policy = policy(),
  edge: EdgeRef = EDGE,
  ctx: TemporalContext = CTX,
): ApplicableAssessments {
  const result = assessEdge(edge, assessments, policyValue, ctx);
  if (!result.ok) {
    throw new Error(`edge must be assessable: ${result.error.message}`);
  }
  return result.value;
}

// Compile-time: a structurally identical object literal is not a branded ApplicableAssessments.
// @ts-expect-error ApplicableAssessments requires the module-private brand
const _forgedApplicable: ApplicableAssessments = { edge: EDGE, assessments: [], unresolved: true };
void _forgedApplicable;

describe('ApplicableAssessments brand', () => {
  test('rejects an unbranded structural lookalike before assurance logic', () => {
    const unbranded = {
      edge: EDGE,
      assessments: [assessment()],
      unresolved: false,
    } as unknown as ApplicableAssessments;

    const result = evaluateAssurance(unbranded, requirement({ required_claims: ['C1'] }), policy(), CTX);

    expect('kind' in result).toBe(true);
    if (!('kind' in result)) return;
    expect(result.kind).toBe('MECHANISM');
    expect(result.code).toBe('E_APPLICABLE_ASSESSMENTS_UNBRANDED');
  });

  test('rejects a forged ordinary brand property', () => {
    const forged = {
      edge: EDGE,
      assessments: [],
      unresolved: true,
      __brand: 'ApplicableAssessments',
    } as unknown as ApplicableAssessments;

    const result = evaluateAssurance(forged, requirement(), policy(), CTX);

    expect('kind' in result).toBe(true);
    if (!('kind' in result)) return;
    expect(result.code).toBe('E_APPLICABLE_ASSESSMENTS_UNBRANDED');
  });

  test('rejects an object inheriting a branded applicable set', () => {
    const valid = applicable([assessment()]);
    const inherited = Object.create(valid) as ApplicableAssessments;

    const result = evaluateAssurance(inherited, requirement(), policy(), CTX);

    expect('kind' in result).toBe(true);
    if (!('kind' in result)) return;
    expect(result.code).toBe('E_APPLICABLE_ASSESSMENTS_UNBRANDED');
  });

  test('does not run assurance hooks for an unbranded value', () => {
    let calls = 0;
    const conflicting = policy({
      conflictPredicate: () => {
        calls += 1;
        return true;
      },
    });
    const unbranded = {
      edge: EDGE,
      assessments: [assessment(), assessment()],
      unresolved: false,
    } as unknown as ApplicableAssessments;

    const result = evaluateAssurance(unbranded, requirement(), conflicting, CTX);

    expect('kind' in result).toBe(true);
    expect(calls).toBe(0);
  });

  test('accepts a value produced by assessEdge', () => {
    const value = applicable([assessment({ verified_claims: ['C1'] })]);

    const result = evaluateAssurance(
      value,
      requirement({ required_claims: ['C1'], trusted_assessors: [domainId('domain-a')] }),
      policy(),
      CTX,
    );

    expect(result).toEqual({ status: 'SATISFIED' });
  });
});

describe('edge binding', () => {
  test('accepts an exactly matching assessment and preserves the edge', () => {
    const value = applicable([assessment()]);

    expect(value.assessments).toHaveLength(1);
    expect(value.unresolved).toBe(false);
    expect(value.edge).toEqual(EDGE);
  });

  test('rejects a different child subject', () => {
    const value = applicable([assessment({ subject_version_id: identityVersionId('iv-other') })]);

    expect(value.assessments).toEqual([]);
    expect(value.unresolved).toBe(true);
  });

  test('rejects a different relation', () => {
    const value = applicable([assessment({ declared_relation: 'FORKED_FROM' })]);

    expect(value.assessments).toEqual([]);
  });

  test('rejects a different parent', () => {
    const value = applicable([assessment({ parent_version_ids: [identityVersionId('iv-other')] })]);

    expect(value.assessments).toEqual([]);
  });

  test('applies a multi-parent assessment to each matching merge edge', () => {
    const mergeEdge: EdgeRef = { ...EDGE, relation: 'MERGED_FROM' };
    const multiParent = assessment({
      declared_relation: 'MERGED_FROM',
      parent_version_ids: [identityVersionId('iv-parent'), identityVersionId('iv-other')],
    });

    expect(applicable([multiParent], policy(), mergeEdge).assessments).toHaveLength(1);
    expect(
      applicable([multiParent], policy(), { ...mergeEdge, parent: identityVersionId('iv-other') }).assessments,
    ).toHaveLength(1);
  });
});

describe('policy narrowing', () => {
  test('may narrow the applicable set', () => {
    const first = assessment({ assessment_id: assessmentId('a-1') });
    const second = assessment({ assessment_id: assessmentId('a-2') });
    const narrowed = applicable([first, second], policy({ applicableAssessments: () => [first] }));

    expect(narrowed.assessments.map((item) => String(item.assessment_id))).toEqual(['a-1']);
  });

  test('cannot expand the set with an unrelated assessment', () => {
    const applicableAssessment = assessment({ assessment_id: assessmentId('a-1') });
    const unrelated = assessment({
      assessment_id: assessmentId('a-2'),
      subject_version_id: identityVersionId('iv-other'),
    });
    const narrowed = applicable(
      [applicableAssessment],
      policy({ applicableAssessments: () => [applicableAssessment, unrelated] }),
    );

    expect(narrowed.assessments.map((item) => String(item.assessment_id))).toEqual(['a-1']);
  });

  test('cannot introduce an assessment that was filtered out by the edge triple', () => {
    const foreign = assessment({ assessment_id: assessmentId('a-foreign'), declared_relation: 'FORKED_FROM' });
    const narrowed = applicable([foreign], policy({ applicableAssessments: () => [foreign] }));

    expect(narrowed.assessments).toEqual([]);
    expect(narrowed.unresolved).toBe(true);
  });

  test('orders applicable assessments by id before invoking the hook', () => {
    const first = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] });
    const second = assessment({ assessment_id: assessmentId('b-1'), verified_claims: ['C2'] });
    const hook: Policy['applicableAssessments'] = (_edge, assessments) => assessments.slice(0, 1);

    const forward = applicable([first, second], policy({ applicableAssessments: hook }));
    const reversed = applicable([second, first], policy({ applicableAssessments: hook }));

    expect(forward.assessments.map((item) => String(item.assessment_id))).toEqual(['a-1']);
    expect(reversed.assessments.map((item) => String(item.assessment_id))).toEqual(['a-1']);
  });

  test('rejects duplicate candidate assessment ids', () => {
    const result = assessEdge(
      EDGE,
      [assessment({ assessment_id: assessmentId('a-1') }), assessment({ assessment_id: assessmentId('a-1') })],
      policy(),
      CTX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('a hook cannot inject altered claims under a known id', () => {
    const genuine = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] });
    const forged = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['FORGED'] });
    const narrowed = applicable([genuine], policy({ applicableAssessments: () => [forged] }));

    expect(narrowed.assessments[0].verified_claims).toEqual(['C1']);
    expect(evaluateAssurance(narrowed, trustedRequirement({ required_claims: ['FORGED'] }), policy(), CTX)).toEqual(
      unsatisfiedResult(['FORGED']),
    );
  });

  test('discarded assessments are not consumed by assurance evaluation', () => {
    const applicableAssessment = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] });
    const foreign = assessment({
      assessment_id: assessmentId('a-foreign'),
      declared_relation: 'FORKED_FROM',
      verified_claims: ['C2'],
    });
    const narrowed = applicable([applicableAssessment], policy({ applicableAssessments: () => [foreign] }));

    const result = evaluateAssurance(
      narrowed,
      requirement({ required_claims: ['C2'], trusted_assessors: [domainId('domain-a')] }),
      policy(),
      CTX,
    );

    expect(result).toEqual({
      status: 'UNSATISFIED',
      code: 'ERR_ASSURANCE_PREDICATE_UNSATISFIED',
      missing: ['C2'],
      disallowed: [],
      note: 'required-claim-not-verified; no-negative-finding-established',
    });
  });
});

describe('required and disallowed claims', () => {
  test('is satisfied when every required claim is verified', () => {
    const result = evaluateTrusted([assessment({ verified_claims: ['C1', 'C2'] })], {
      required_claims: ['C1', 'C2'],
    });

    expect(result).toEqual({ status: 'SATISFIED' });
  });

  test('an unverified claim is missing, not refuted', () => {
    const result = evaluateTrusted([assessment({ verified_claims: ['C1'], unverified_claims: ['C2'] })], {
      required_claims: ['C1', 'C2'],
    });

    expect(result).toEqual(unsatisfiedResult(['C2']));
    expect('negative' in result).toBe(false);
    expect('refuted' in result).toBe(false);
    expect(outcome(result).status).not.toBe('CONTESTED');
  });

  test('a verified disallowed claim vetoes the requirement', () => {
    const result = evaluateTrusted([assessment({ verified_claims: ['C1', 'BAD'] })], {
      required_claims: ['C1'],
      disallowed_claims: ['BAD'],
    });

    expect(result).toEqual(unsatisfiedResult([], ['BAD']));
  });

  test('an unverified disallowed claim is not a veto', () => {
    const result = evaluateTrusted([assessment({ verified_claims: ['C1'], unverified_claims: ['BAD'] })], {
      required_claims: ['C1'],
      disallowed_claims: ['BAD'],
    });

    expect(result).toEqual({ status: 'SATISFIED' });
  });
});

describe('trusted assessors', () => {
  test('an untrusted positive assessment cannot satisfy a requirement', () => {
    const result = evaluateAssurance(
      applicable([assessment({ assessed_by: domainId('domain-b'), verified_claims: ['C1'] })]),
      requirement({ required_claims: ['C1'], trusted_assessors: [domainId('domain-a')] }),
      policy(),
      CTX,
    );

    expect(unsatisfied(result).missing).toEqual(['C1']);
  });

  test('policy default supplies trusted assessors when the requirement omits them', () => {
    const trusted = evaluateAssurance(
      applicable([assessment({ assessed_by: domainId('domain-a'), verified_claims: ['C1'] })]),
      requirement({ required_claims: ['C1'] }),
      policy({ trustedAssessorDefault: [domainId('domain-a')] }),
      CTX,
    );
    const untrusted = evaluateAssurance(
      applicable([assessment({ assessed_by: domainId('domain-b'), verified_claims: ['C1'] })]),
      requirement({ required_claims: ['C1'] }),
      policy({ trustedAssessorDefault: [domainId('domain-a')] }),
      CTX,
    );

    expect(trusted).toEqual({ status: 'SATISFIED' });
    expect(outcome(untrusted).status).toBe('UNSATISFIED');
  });

  test('no requirement list and no policy default means nothing is trusted', () => {
    const result = evaluateAssurance(
      applicable([assessment({ verified_claims: ['C1'] })]),
      requirement({ required_claims: ['C1'] }),
      policy(),
      CTX,
    );

    expect(outcome(result).status).toBe('UNSATISFIED');
  });

  test('untrusted assessments never create CONTESTED', () => {
    const result = evaluateAssurance(
      applicable([
        assessment({ assessment_id: assessmentId('a-1'), assessed_by: domainId('domain-b'), verified_claims: ['C1'] }),
        assessment({ assessment_id: assessmentId('a-2'), assessed_by: domainId('domain-b'), verified_claims: ['C2'] }),
      ]),
      trustedRequirement(),
      policy({ conflictPredicate: () => true }),
      CTX,
    );

    expect(result).toEqual({ status: 'SATISFIED' });
  });
});

describe('conflict handling (A-4b blocked)', () => {
  test('default configuration never yields CONTESTED', () => {
    const result = evaluateAssurance(
      applicable([
        assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] }),
        assessment({ assessment_id: assessmentId('a-2'), verified_claims: ['C2'] }),
      ]),
      trustedRequirement(),
      policy(),
      CTX,
    );

    expect(result).not.toHaveProperty('status', 'CONTESTED');
    expect(result).toEqual({ status: 'SATISFIED' });
  });

  test('an explicit predicate is the only source of CONTESTED', () => {
    const result = evaluateAssurance(
      applicable([
        assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] }),
        assessment({ assessment_id: assessmentId('a-2'), verified_claims: ['C2'] }),
      ]),
      trustedRequirement(),
      policy({ conflictPredicate: () => true }),
      CTX,
    );

    expect(result).toEqual({ status: 'CONTESTED', contestedClaims: ['C1', 'C2'] });
  });

  test('a false predicate leaves the result uncontested', () => {
    const result = evaluateAssurance(
      applicable([assessment({ verified_claims: ['C1'] })]),
      trustedRequirement(),
      policy({ conflictPredicate: () => false }),
      CTX,
    );

    expect(result).toEqual({ status: 'SATISFIED' });
  });

  test('an explicit predicate may declare conflict with no differing claims', () => {
    const result = evaluateAssurance(
      applicable([
        assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] }),
        assessment({ assessment_id: assessmentId('a-2'), verified_claims: ['C1'] }),
      ]),
      trustedRequirement(),
      policy({ conflictPredicate: () => true }),
      CTX,
    );

    expect(result).toEqual({ status: 'CONTESTED', contestedClaims: [] });
  });
});

describe('supersession', () => {
  function snapshot(values: readonly DeepReadonly<ContinuityAssessment>[]): string {
    return JSON.stringify(values);
  }

  test('registers a successor without mutating the predecessor or the input array', () => {
    const predecessor = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] });
    const existing = [predecessor];
    const existingBefore = snapshot(existing);
    const successor = assessment({
      assessment_id: assessmentId('a-2'),
      supersedes_assessment_id: assessmentId('a-1'),
      verified_claims: ['C1'],
    });

    const result = registerAssessment(existing, successor);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(snapshot(existing)).toBe(existingBefore);
    expect(existing).toHaveLength(1);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(result.value.every((item) => Object.isFrozen(item))).toBe(true);
  });

  test('rejects a supersession cycle with CYCLE_DETECTED', () => {
    const second = assessment({ assessment_id: assessmentId('a-2'), supersedes_assessment_id: assessmentId('a-1') });
    const third = assessment({ assessment_id: assessmentId('a-3'), supersedes_assessment_id: assessmentId('a-2') });
    const existing = [second, third];
    const before = snapshot(existing);

    // a-2 -> a-1 is outside the chain; closing a-1 -> a-3 -> a-2 -> a-1 is a cycle.
    const closing = assessment({ assessment_id: assessmentId('a-1'), supersedes_assessment_id: assessmentId('a-3') });
    const cycle = registerAssessment(existing, closing);

    expect(cycle.ok).toBe(false);
    if (cycle.ok) return;
    expect(cycle.error.kind).toBe('SPEC');
    expect(cycle.error.code).toBe('CYCLE_DETECTED');
    expect(snapshot(existing)).toBe(before);
  });

  test('rejects a self-superseding assessment', () => {
    const result = registerAssessment(
      [assessment({ assessment_id: assessmentId('a-1') })],
      assessment({ assessment_id: assessmentId('a-1'), supersedes_assessment_id: assessmentId('a-1') }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CYCLE_DETECTED');
  });

  test('does not apply a latest-wins rule', () => {
    const older = assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] });
    const newer = assessment({
      assessment_id: assessmentId('a-2'),
      supersedes_assessment_id: assessmentId('a-1'),
      unverified_claims: ['C1'],
    });

    const result = evaluateTrusted([older, newer], { required_claims: ['C1'] });

    expect(result).toEqual({ status: 'SATISFIED' });
  });

  test('rejects a duplicate assessment id without replacing the record', () => {
    const existing = [assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C1'] })];
    const before = snapshot(existing);

    const result = registerAssessment(
      existing,
      assessment({ assessment_id: assessmentId('a-1'), verified_claims: ['C2'] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
    expect(snapshot(existing)).toBe(before);
  });

  test('rejects an unknown supersession predecessor', () => {
    const result = registerAssessment(
      [],
      assessment({ assessment_id: assessmentId('a-2'), supersedes_assessment_id: assessmentId('a-1') }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });
});

describe('ownership', () => {
  test('owns a copy of assessments and freezes the applicable structure', () => {
    const claims = ['C1'];
    const mutable = assessment({ verified_claims: claims });
    const value = applicable([mutable]);

    claims.push('C2');

    expect(value.assessments[0].verified_claims).toEqual(['C1']);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.edge)).toBe(true);
    expect(Object.isFrozen(value.assessments)).toBe(true);
    expect(Object.isFrozen(value.assessments[0])).toBe(true);
  });

  test('does not retain the caller assessment array', () => {
    const input = [assessment({ verified_claims: ['C1'] })];
    const value = applicable(input);

    input.push(assessment({ assessment_id: assessmentId('a-2') }));

    expect(value.assessments).toHaveLength(1);
  });

  test('does not mutate requirements during evaluation', () => {
    const req = requirement({ required_claims: ['C2', 'C1'], disallowed_claims: ['BAD'] });
    const before = JSON.stringify(req);

    evaluateAssurance(applicable([assessment({ verified_claims: ['C1'] })]), req, policy(), CTX);

    expect(JSON.stringify(req)).toBe(before);
  });
});

describe('B-5 mechanism semantics', () => {
  test('untrusted positive assessments cannot override a trusted assessor missing verification', () => {
    const trusted = assessment({
      assessment_id: assessmentId('trusted'),
      assessed_by: domainId('domain-auditor'),
      verified_claims: [],
      unverified_claims: ['SPEC_MISMATCH'],
    });
    const untrusted = assessment({
      assessment_id: assessmentId('untrusted'),
      assessed_by: domainId('untrusted-org'),
      verified_claims: ['SPEC_MISMATCH'],
    });

    const result = evaluateAssurance(
      applicable([trusted, untrusted]),
      requirement({ required_claims: ['SPEC_MISMATCH'], trusted_assessors: [domainId('domain-auditor')] }),
      policy(),
      CTX,
    );

    expect(result).toEqual(unsatisfiedResult(['SPEC_MISMATCH']));
  });
});
