import type { RunEventView } from '@application/ports/run-stream.port';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export interface WatchableRun {
  readonly id: string;
  readonly attempt: number;
}

export const RUN_EVENT_READER = Symbol('RUN_EVENT_READER');

export interface RunEventReaderPort {
  findForViewer(runId: RunId, viewerId: UserId): Promise<WatchableRun | null>;

  eventsSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    most: number,
  ): Promise<RunEventView[]>;
}
