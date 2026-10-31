import { test } from 'bun:test';

// CORE-001 §12 C-1 and C-2 require an Assessment recording `PARENT_UNRESOLVED`
// or `CYCLE_DETECTED`, and C-2 additionally requires dependent grants to be
// suppressed. Assessments are Task 8 and `evaluateBinding` is Task 9, so these
// conformance cases are intentionally not counted as passing yet.
//
// The graph-level behaviour they depend on (preserved declarations, unresolved
// parents, cycle components) is covered in tests/unit/lineage-graph.test.ts.
test.todo('C-1 orphan ingestion records PARENT_UNRESOLVED in an Assessment (Task 8)');
test.todo('C-2 cycle detection records CYCLE_DETECTED and suppresses dependent grants (Tasks 8–9)');
