import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export const TRACE_PARENT = Symbol('TRACE_PARENT');

export interface TraceParentPort {
  // Must be deterministic: the same run is named the same way every time.
  for(taskId: TaskId, runId: RunId): string;
}
