import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_TRACE_LINKS = Symbol('RUN_TRACE_LINKS');

export interface RunTraceLinksPort {
  linkActiveSpanTo(runId: RunId): Promise<void>;
}
