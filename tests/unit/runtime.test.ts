import { describe, expect, test } from 'bun:test';
import type { RuntimeLifecycleEvent, RuntimeRegistry } from '../../src/core/runtime.js';
import { createRuntimeLifecycleEvent, createRuntimeRegistry, recordRuntimeEvent } from '../../src/core/runtime.js';
import { identityVersionId, runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import { BASE_TIME } from '../support/fixtures.js';
import { failureEvent, runtimeDescriptor, runtimeRegistry } from '../support/runtime.js';

function expectOk<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('expected success');
  }
  return result.value;
}

function rawRuntime(id: string) {
  return {
    id: runtimeInstanceId(id),
    identity_version_id: identityVersionId('iv-a-1'),
    execution_context_ref: `context-${id}`,
    instantiated_at: timestamp(BASE_TIME),
  };
}

describe('RuntimeInstance registry', () => {
  test('constructs an immutable registry with RUNNING states', () => {
    const rt1 = runtimeDescriptor('rt-1');
    const rt2 = runtimeDescriptor('rt-2');
    const registry = runtimeRegistry(rt1, rt2);

    expect(registry.runtimes()).toHaveLength(2);
    expect(registry.events()).toEqual([]);
    expect(registry.stateOf(runtimeInstanceId('rt-1'))).toBe('RUNNING');
    expect(registry.stateOf(runtimeInstanceId('rt-2'))).toBe('RUNNING');
    expect(registry.stateOf(runtimeInstanceId('rt-3'))).toBeUndefined();
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.runtimes())).toBe(true);
    expect(Object.isFrozen(registry.events())).toBe(true);
    expect(registry.runtimes().every((runtime) => Object.isFrozen(runtime))).toBe(true);
  });

  test('rejects duplicate RuntimeInstanceIDs', () => {
    const result = createRuntimeRegistry([rawRuntime('rt-1'), rawRuntime('rt-1')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
    expect(result.error.code).toBe('E_UNKNOWN_BOUNDARY_REJECTED');
  });

  test('rejects non-array and structurally invalid descriptors', () => {
    expect(createRuntimeRegistry({}).ok).toBe(false);
    expect(
      createRuntimeRegistry([
        {
          id: runtimeInstanceId('rt-1'),
          identity_version_id: identityVersionId('iv-a-1'),
          instantiated_at: timestamp(BASE_TIME),
        },
      ]).ok,
    ).toBe(false);
  });

  test('copies caller input so later mutation cannot reach the registry', () => {
    const source = rawRuntime('rt-1');
    const registry = expectOk(createRuntimeRegistry([source]));
    const before = JSON.stringify(registry.runtimes()[0]);

    source.execution_context_ref = 'mutated';

    expect(JSON.stringify(registry.runtimes()[0])).toBe(before);
  });
});

describe('RuntimeLifecycleEvent', () => {
  test('validates the minimal FAILURE event', () => {
    const event = failureEvent('rt-1');
    expect(event.runtime_instance_id).toBe(runtimeInstanceId('rt-1'));
    expect(event.kind).toBe('FAILURE');
    expect(Object.isFrozen(event)).toBe(true);
  });

  test('rejects unknown kinds, missing fields, extra fields and empty ids', () => {
    const invalid = [
      { runtime_instance_id: 'rt-1', kind: 'STOPPED' },
      { runtime_instance_id: 'rt-1' },
      { kind: 'FAILURE' },
      { runtime_instance_id: '', kind: 'FAILURE' },
      { runtime_instance_id: 'rt-1', kind: 'FAILURE', timestamp: timestamp(BASE_TIME) },
      { runtime_instance_id: 1, kind: 'FAILURE' },
      null,
      [],
    ];

    for (const value of invalid) {
      const result = createRuntimeLifecycleEvent(value);
      expect(result.ok).toBe(false);
    }
  });

  test('rejects forged registry and event values', () => {
    const registry = runtimeRegistry(runtimeDescriptor('rt-1'));
    const event = failureEvent('rt-1');
    const forgedRegistry = { ...registry } as unknown as RuntimeRegistry;
    const forgedEvent = { ...event } as unknown as RuntimeLifecycleEvent;

    expect(recordRuntimeEvent(forgedRegistry, event).ok).toBe(false);
    expect(recordRuntimeEvent(registry, forgedEvent).ok).toBe(false);
  });
});

describe('recordRuntimeEvent copy-on-write', () => {
  test('records a failure separately without changing lifecycle state or descriptors', () => {
    const rt1 = runtimeDescriptor('rt-1');
    const rt2 = runtimeDescriptor('rt-2');
    const registry = runtimeRegistry(rt1, rt2);
    const descriptorBefore = JSON.stringify(registry.runtimes());

    const event = failureEvent('rt-1');
    const updated = expectOk(recordRuntimeEvent(registry, event));

    expect(updated).not.toBe(registry);
    expect(updated.runtimes()).not.toBe(registry.runtimes());
    expect(updated.events()).not.toBe(registry.events());
    expect(updated.runtimes()[0]).not.toBe(registry.runtimes()[0]);
    expect(updated.events()).toHaveLength(1);
    expect(registry.events()).toHaveLength(0);
    expect(updated.stateOf(runtimeInstanceId('rt-2'))).toBe('RUNNING');
    expect(updated.stateOf(runtimeInstanceId('rt-1'))).toBe('RUNNING');
    expect(JSON.stringify(updated.runtimes())).toBe(descriptorBefore);
    expect(JSON.stringify(registry.runtimes())).toBe(descriptorBefore);
  });

  test('rejects events for unknown runtimes', () => {
    const registry = runtimeRegistry(runtimeDescriptor('rt-1'));
    const result = recordRuntimeEvent(registry, failureEvent('rt-2'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('MECHANISM');
  });

  test('does not deduplicate events because CORE-001 defines no event identity', () => {
    const registry = runtimeRegistry(runtimeDescriptor('rt-1'));
    const event = failureEvent('rt-1');
    const once = expectOk(recordRuntimeEvent(registry, event));
    const twice = expectOk(recordRuntimeEvent(once, event));

    expect(twice.events()).toHaveLength(2);
  });
});
