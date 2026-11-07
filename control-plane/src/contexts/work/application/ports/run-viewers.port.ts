import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const RUN_VIEWERS = Symbol('RUN_VIEWERS');

export interface WatchedRun {
  readonly runId: RunId;
  readonly attempt: number;
}

export interface RunViewersPort {
  watchedBy(runId: RunId, viewer: UserId): Promise<WatchedRun | null>;
}
