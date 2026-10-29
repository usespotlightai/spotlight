import type { UnreplayableReasonCode } from '@work/application/contracts/unreplayable-reason.contract';

export const REPLAYABLE_RUNS = Symbol('REPLAYABLE_RUNS');

export interface Replayability {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly unreplayableReason: UnreplayableReasonCode | null;
  readonly reason: string | null;
}

export interface RunSummary extends Replayability {
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: Date | null;
  readonly origin: string | null;
}

export interface RecentRun extends Replayability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
  readonly origin: string | null;
}

export interface ReplayableRunsPort {
  summaries(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly RunSummary[]>;

  recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentRun[]>;
}
