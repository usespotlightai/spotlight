export const STATION_JUDGES = Symbol('INSIGHTS_STATION_JUDGES');

export interface StationJudge {
  readonly teamId: string;
  readonly lineId: string;
  readonly rubric: string | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly rubricVersion: string;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface StationJudgesPort {
  judgeAt(stationId: string): Promise<StationJudge | null>;

  judgesOnTeam(teamId: string): Promise<ReadonlyMap<string, StationJudge>>;
}
