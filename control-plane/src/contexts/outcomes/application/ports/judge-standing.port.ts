export const JUDGE_STANDING = Symbol('JUDGE_STANDING');

export interface TeamOfStations {
  readonly workspaceId: string;
  readonly teamId: string;
}

export interface StationOnLine {
  readonly lineId: string;
  readonly stationId: string;
}

export interface JudgeStandingShape {
  readonly stationId: string;
  readonly rubricVersion: string | null;
  readonly trusted: boolean;
  readonly measure: 'kappa' | 'spearman' | null;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly trust: number | null;
  readonly hiddenBecause:
    | 'no-judge'
    | 'unreadable-rubric'
    | 'too-few-pairs'
    | 'no-agreement'
    | 'below-trust'
    | null;
}

export interface JudgeStandingPort {
  standingsOf(
    team: TeamOfStations,
    stations: readonly StationOnLine[],
  ): Promise<readonly JudgeStandingShape[]>;
}
