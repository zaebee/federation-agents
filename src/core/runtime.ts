// RuntimeInstance lifecycle decomposition for UIA-CORE-001 §3.3 and D-1.
//
// CORE-001 deliberately does not define the CORE-002 event format. This module
// provides only the minimal D-1 representation: a registry of runtime
// descriptors, one failure event kind, and a lifecycle state that is separate
// from the event. Recording a failure never transitions lifecycle state.

import type { RuntimeInstanceDescriptor } from './entities.js';
import { validateRuntimeInstanceDescriptor } from './entities.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze, validateJsonValue } from './ownership.js';
import type { JsonValue, RuntimeInstanceID } from './primitives.js';

const RUNTIME_REGISTRY_BRAND: unique symbol = Symbol('uia-ref-runtime-registry');
const RUNTIME_EVENT_BRAND: unique symbol = Symbol('uia-ref-runtime-event');

const RUNTIME_REGISTRIES: WeakSet<object> = new WeakSet<object>();
const RUNTIME_EVENTS: WeakSet<object> = new WeakSet<object>();

export type RuntimeLifecycleState = 'RUNNING';

/** Minimal D-1 event; CORE-002 owns the full event format. */
export interface RuntimeLifecycleEvent {
  readonly [RUNTIME_EVENT_BRAND]: true;
  readonly runtime_instance_id: RuntimeInstanceID;
  readonly kind: 'FAILURE';
}

export interface RuntimeRegistry {
  readonly [RUNTIME_REGISTRY_BRAND]: true;
  runtimes(): readonly DeepReadonly<RuntimeInstanceDescriptor>[];
  events(): readonly DeepReadonly<RuntimeLifecycleEvent>[];
  stateOf(id: RuntimeInstanceID): RuntimeLifecycleState | undefined;
}

type JsonObject = { readonly [key: string]: JsonValue };

const EVENT_FIELDS: readonly string[] = ['runtime_instance_id', 'kind'];

function invalid(path: string, message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', `${path}: ${message}`) };
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: JsonValue | undefined, path: string): Result<string> {
  if (typeof value !== 'string') {
    return invalid(path, 'expected string');
  }
  return { ok: true, value };
}

function rejectUnknownFields(value: JsonObject, allowed: readonly string[], path: string): Result<void> {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return invalid(`${path}.${key}`, 'unknown field');
    }
  }
  return { ok: true, value: undefined };
}

function brandedEvent(runtimeInstanceId: RuntimeInstanceID): DeepReadonly<RuntimeLifecycleEvent> {
  const event = { runtime_instance_id: runtimeInstanceId, kind: 'FAILURE' } as RuntimeLifecycleEvent;
  Object.defineProperty(event, RUNTIME_EVENT_BRAND, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  deepFreeze(event);
  RUNTIME_EVENTS.add(event);
  return event;
}

/** Validates the minimal failure event and returns an owned branded copy. */
export function createRuntimeLifecycleEvent(value: unknown): Result<DeepReadonly<RuntimeLifecycleEvent>> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  if (!isJsonObject(json.value)) {
    return invalid('$', 'expected object');
  }
  const known = rejectUnknownFields(json.value, EVENT_FIELDS, '$');
  if (!known.ok) return known;
  const runtimeInstanceId = requireString(json.value.runtime_instance_id, '$.runtime_instance_id');
  if (!runtimeInstanceId.ok) return runtimeInstanceId;
  if (runtimeInstanceId.value.length === 0) {
    return invalid('$.runtime_instance_id', 'expected non-empty string');
  }
  if (json.value.kind !== 'FAILURE') {
    return invalid('$.kind', 'expected FAILURE');
  }
  return { ok: true, value: brandedEvent(runtimeInstanceId.value as RuntimeInstanceID) };
}

function cloneRuntime(
  descriptor: DeepReadonly<RuntimeInstanceDescriptor>,
): Result<DeepReadonly<RuntimeInstanceDescriptor>> {
  return validateRuntimeInstanceDescriptor(descriptor);
}

function cloneEvent(event: DeepReadonly<RuntimeLifecycleEvent>): DeepReadonly<RuntimeLifecycleEvent> {
  return brandedEvent(event.runtime_instance_id);
}

function makeRegistry(
  runtimes: readonly DeepReadonly<RuntimeInstanceDescriptor>[],
  events: readonly DeepReadonly<RuntimeLifecycleEvent>[],
): RuntimeRegistry {
  const frozenRuntimes = Object.freeze([...runtimes]);
  const frozenEvents = Object.freeze([...events]);
  const registry = {
    runtimes: () => frozenRuntimes,
    events: () => frozenEvents,
    stateOf: (id: RuntimeInstanceID): RuntimeLifecycleState | undefined =>
      frozenRuntimes.some((runtime) => runtime.id === id) ? 'RUNNING' : undefined,
  } as RuntimeRegistry;
  Object.defineProperty(registry, RUNTIME_REGISTRY_BRAND, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  deepFreeze(registry);
  RUNTIME_REGISTRIES.add(registry);
  return registry;
}

/**
 * Builds a runtime registry from untrusted descriptors. Descriptors are
 * validated, copied and frozen; duplicate runtime IDs are rejected.
 */
export function createRuntimeRegistry(value: unknown): Result<RuntimeRegistry> {
  const json = validateJsonValue(value);
  if (!json.ok) return json;
  if (!Array.isArray(json.value)) {
    return invalid('$', 'expected array of RuntimeInstanceDescriptor values');
  }
  const runtimes: DeepReadonly<RuntimeInstanceDescriptor>[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < json.value.length; index += 1) {
    const validated = validateRuntimeInstanceDescriptor(json.value[index]);
    if (!validated.ok) return validated;
    const id = String(validated.value.id);
    if (seen.has(id)) {
      return invalid(`$[${index}].id`, `duplicate RuntimeInstanceID: ${id}`);
    }
    seen.add(id);
    runtimes.push(validated.value);
  }

  return { ok: true, value: makeRegistry(runtimes, []) };
}

/**
 * Copy-on-write event recording. The original registry, its descriptors and
 * existing events are never mutated or shared with the returned registry.
 * Unknown runtimes and forged registry/event values are rejected.
 */
export function recordRuntimeEvent(
  registry: RuntimeRegistry,
  event: DeepReadonly<RuntimeLifecycleEvent>,
): Result<RuntimeRegistry> {
  if (!RUNTIME_REGISTRIES.has(registry as object)) {
    return invalid('$registry', 'expected a registry produced by createRuntimeRegistry');
  }
  if (!RUNTIME_EVENTS.has(event as object)) {
    return invalid('$event', 'expected an event produced by createRuntimeLifecycleEvent');
  }
  if (!registry.runtimes().some((runtime) => runtime.id === event.runtime_instance_id)) {
    return invalid('$event.runtime_instance_id', 'unknown RuntimeInstanceID');
  }

  const runtimes: DeepReadonly<RuntimeInstanceDescriptor>[] = [];
  for (const runtime of registry.runtimes()) {
    const cloned = cloneRuntime(runtime);
    if (!cloned.ok) return cloned;
    runtimes.push(cloned.value);
  }

  const events = registry.events().map(cloneEvent);
  events.push(cloneEvent(event));
  return { ok: true, value: makeRegistry(runtimes, events) };
}
