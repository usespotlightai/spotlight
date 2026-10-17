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
  readonly origin: string | null;
}

export interface RecentRun extends Replayability {
  readonly title: string;
  readonly state: string;
  readonly endedAt: Date;
  readonly origin: string | null;
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

  durations(runIds: readonly string[]): Promise<ReadonlyMap<string, number>>;

  recentAt(
    workspaceId: string,
    stationId: string,
    max: number,
  ): Promise<readonly RecentRun[]>;
}
