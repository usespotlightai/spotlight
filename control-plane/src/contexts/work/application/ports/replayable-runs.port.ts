import type { ReplayRefusalCode } from '@work/application/contracts/replay-refusal.contract';

export const REPLAYABLE_RUNS = Symbol('REPLAYABLE_RUNS');

export interface Replayability {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly refusal: ReplayRefusalCode | null;
  readonly reason: string | null;
}

export interface StandingRun extends Replayability {
  readonly title: string | null;
  readonly state: string | null;
  readonly endedAt: Date | null;
}

export interface RecentRun extends Replayability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
}

export interface ReplayableRunsPort {
  check(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly Replayability[]>;

  standing(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<readonly StandingRun[]>;

  recentAt(
    workspaceId: string,
    stationId: string,
    most: number,
  ): Promise<readonly RecentRun[]>;
}
