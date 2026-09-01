import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export const TRACE_PARENT = Symbol('TRACE_PARENT');

/**
 * Names a run to whatever tracing its harness does of its own.
 *
 * The rule is the domain's: every run that worked one task belongs to that
 * task's trace, and each is its own span within it. How that is written down
 * is not, so it is asked for rather than worked out here.
 */
export interface TraceParentPort {
  /** The same run must be named the same way every time it is asked. */
  for(taskId: TaskId, runId: RunId): string;
}
