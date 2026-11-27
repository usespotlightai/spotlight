import type { SetHealthDto } from '@replays/application/dto/replays.dto';

export interface ImprovementFreshDto {
  readonly tasks: number;
  readonly heldOutTasks: number;
  readonly enough: boolean;
}

export interface ImprovementSetDto extends SetHealthDto {
  readonly tasks: number;
  readonly fewestTasks: number;
  readonly bigEnough: boolean;
  readonly fresh: ImprovementFreshDto | null;
  readonly minGain: number;
}

export interface ImprovementScoringDto {
  readonly judge: boolean;
  readonly check: boolean;
  readonly scores: boolean;
}

export type ImprovementRunProgress = 'waiting' | 'running' | 'ended';

export interface ImprovementRunDto {
  readonly runId: string | null;
  readonly originalRunId: string;
  readonly taskId: string;
  readonly taskTitle: string | null;
  readonly progress: ImprovementRunProgress;
  readonly succeeded: boolean | null;
}

export interface ImprovementReplayDto {
  readonly replayId: string;
  readonly candidate: string;
  readonly live: boolean;
  readonly state: string;
  readonly runs: readonly ImprovementRunDto[];
}

export interface ImprovementSearchDto {
  readonly searchId: string;
  readonly state: string;
  readonly trigger: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly result: string | null;
  readonly replays: readonly ImprovementReplayDto[];
}

export interface ImprovementSkipDto {
  readonly reason: string;
  readonly at: string;
  readonly text: string;
  readonly retryAt: string;
}

export interface StationImprovementDto {
  readonly set: ImprovementSetDto | null;
  readonly scoring: ImprovementScoringDto | null;
  readonly lastSearch: ImprovementSearchDto | null;
  readonly nextSearchAt: string | null;
  readonly lastSkip: ImprovementSkipDto | null;
}
