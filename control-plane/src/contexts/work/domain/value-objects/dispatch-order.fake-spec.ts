import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';

export const runOrderOf = (
  runId: RunId,
  snapshot: JsonObject = { runId: runId.value },
): DispatchOrder => DispatchOrder.of({ kind: 'run', runId, snapshot });

export const trialOrderOf = (runId: RunId): DispatchOrder =>
  DispatchOrder.of({ kind: 'trial', runId, snapshot: { runId: runId.value } });
