import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const TRIALABLE_RUNS = Symbol('REPLAYS_TRIALABLE_RUNS');

export interface RunReplayability {
  readonly runId: RunId;
  readonly taskId: TaskId | null;
  readonly stationId: StationId | null;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly reason: string | null;
}

export interface RunSummary extends RunReplayability {
  readonly title: string | null;
  readonly endedAt: Date | null;
}

export interface PickableRun extends RunReplayability {
  readonly endedAt: Date;
}

export interface TrialableRunsPort {
  runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]>;

  recentAt(
    workspaceId: WorkspaceId,
    stationId: StationId,
    max: number,
  ): Promise<readonly PickableRun[]>;
}
