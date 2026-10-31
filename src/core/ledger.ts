// Minimal in-memory append-only ledger for Task 15 (mechanism, not CORE-002).
//
// Stores Local Acceptance decisions and lifecycle events separately. It does
// not order, replay, deduplicate events, or derive a current lifecycle state.

import type { LocalAcceptanceLifecycleEvent, LocalAcceptanceRecord } from './acceptance.js';
import { createLocalAcceptanceLifecycleEvent, createLocalAcceptanceRecord } from './acceptance.js';
import type { Result } from './errors.js';
import { mechanismFailure } from './errors.js';
import type { DeepReadonly } from './ownership.js';
import { deepFreeze } from './ownership.js';

const ACCEPTANCE_LEDGER_BRAND: unique symbol = Symbol('uia-ref-acceptance-ledger');
const LEDGERS: WeakSet<object> = new WeakSet<object>();

export interface AcceptanceLedger {
  readonly [ACCEPTANCE_LEDGER_BRAND]: true;
  acceptances(): readonly DeepReadonly<LocalAcceptanceRecord>[];
  lifecycleEvents(): readonly DeepReadonly<LocalAcceptanceLifecycleEvent>[];
}

function invalid(message: string): Result<never> {
  return { ok: false, error: mechanismFailure('E_UNKNOWN_BOUNDARY_REJECTED', message) };
}

function makeLedger(
  acceptances: readonly DeepReadonly<LocalAcceptanceRecord>[],
  events: readonly DeepReadonly<LocalAcceptanceLifecycleEvent>[],
): AcceptanceLedger {
  const frozenAcceptances = Object.freeze([...acceptances]);
  const frozenEvents = Object.freeze([...events]);
  const ledger = {
    acceptances: () => frozenAcceptances,
    lifecycleEvents: () => frozenEvents,
  } as AcceptanceLedger;
  Object.defineProperty(ledger, ACCEPTANCE_LEDGER_BRAND, {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  deepFreeze(ledger);
  LEDGERS.add(ledger);
  return ledger;
}

/** Creates an empty branded acceptance ledger. */
export function createAcceptanceLedger(): AcceptanceLedger {
  return makeLedger([], []);
}

/**
 * Appends a decision record. A duplicate acceptance_id is rejected at the
 * mechanism level because an acceptance_id identifies one immutable record.
 */
export function appendAcceptance(
  ledger: AcceptanceLedger,
  record: DeepReadonly<LocalAcceptanceRecord>,
): Result<AcceptanceLedger> {
  if (!LEDGERS.has(ledger as object)) {
    return invalid('expected a ledger produced by createAcceptanceLedger');
  }
  const validated = createLocalAcceptanceRecord(record);
  if (!validated.ok) return validated;
  if (ledger.acceptances().some((item) => item.acceptance_id === validated.value.acceptance_id)) {
    return invalid(`duplicate acceptance_id: ${String(validated.value.acceptance_id)}`);
  }
  return { ok: true, value: makeLedger([...ledger.acceptances(), validated.value], ledger.lifecycleEvents()) };
}

/**
 * Appends a lifecycle event. Events are not deduplicated and no current state
 * is derived; the event must reference an acceptance already in this ledger.
 */
export function appendLifecycleEvent(
  ledger: AcceptanceLedger,
  event: DeepReadonly<LocalAcceptanceLifecycleEvent>,
): Result<AcceptanceLedger> {
  if (!LEDGERS.has(ledger as object)) {
    return invalid('expected a ledger produced by createAcceptanceLedger');
  }
  const validated = createLocalAcceptanceLifecycleEvent(event);
  if (!validated.ok) return validated;
  if (!ledger.acceptances().some((item) => item.acceptance_id === validated.value.acceptance_id)) {
    return invalid(`unknown acceptance_id: ${String(validated.value.acceptance_id)}`);
  }
  return { ok: true, value: makeLedger(ledger.acceptances(), [...ledger.lifecycleEvents(), validated.value]) };
}
