import type { RuntimeLifecycleEvent, RuntimeRegistry } from '../../src/core/runtime.js';
import { createRuntimeLifecycleEvent, createRuntimeRegistry } from '../../src/core/runtime.js';
import type { DeepReadonly } from '../../src/core/ownership.js';
import type { RuntimeInstanceDescriptor } from '../../src/core/entities.js';
import { validateRuntimeInstanceDescriptor } from '../../src/core/entities.js';
import { identityVersionId, runtimeInstanceId, timestamp } from '../../src/core/primitives.js';
import { BASE_TIME } from './fixtures.js';

export function runtimeDescriptor(
  id: string,
  identityVersion = 'iv-a-1',
  overrides: Partial<RuntimeInstanceDescriptor> = {},
): DeepReadonly<RuntimeInstanceDescriptor> {
  const result = validateRuntimeInstanceDescriptor({
    id: runtimeInstanceId(id),
    identity_version_id: identityVersionId(identityVersion),
    execution_context_ref: `context-${id}`,
    instantiated_at: timestamp(BASE_TIME),
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`runtime fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function failureEvent(runtimeId: string): DeepReadonly<RuntimeLifecycleEvent> {
  const result = createRuntimeLifecycleEvent({
    runtime_instance_id: runtimeId,
    kind: 'FAILURE',
  });
  if (!result.ok) {
    throw new Error(`event fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}

export function runtimeRegistry(...runtimes: DeepReadonly<RuntimeInstanceDescriptor>[]): RuntimeRegistry {
  const result = createRuntimeRegistry(runtimes);
  if (!result.ok) {
    throw new Error(`runtime registry fixture must be valid: ${result.error.message}`);
  }
  return result.value;
}
