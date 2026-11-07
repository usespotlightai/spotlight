import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunEventView } from '@work/application/ports/run-stream.port';

export const RUN_EVENT_READER = Symbol('RUN_EVENT_READER');

export interface RunEventReaderPort {
  eventsSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    max: number,
  ): Promise<RunEventView[]>;

  lastOfType(
    runId: RunId,
    attempt: number,
    type: string,
  ): Promise<RunEventView | null>;
}
