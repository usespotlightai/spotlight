export const STATION_JUDGE_CALIBRATIONS = Symbol('STATION_JUDGE_CALIBRATIONS');

type PublishedCalibrationState = 'qualified' | 'unmeasured' | 'failing';

export interface PublishedCalibration {
  readonly state: PublishedCalibrationState;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly minPairs: number;
  readonly minAgreement: number | null;
}

export interface CalibratedStation {
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly rubricVersion: string;
}

export interface StationJudgeCalibrationsPort {
  calibrationOf(
    station: CalibratedStation,
  ): Promise<PublishedCalibration | null>;
}
