import {
  type KappaReading,
  kappaReadingOf,
} from '@insights/domain/services/agreement-reading';
import {
  failingOf,
  type HiddenReason,
  type JudgeCalibration,
  MIN_PAIRS,
} from '@insights/domain/services/judge-calibration';

export interface JudgeCalibrationDto {
  readonly qualified: boolean;
  readonly agreement: number | null;
  readonly reading: KappaReading | null;
  readonly pairs: number;
  readonly minPairs: number;
  readonly minAgreement: number | null;
  readonly hiddenReason: HiddenReason | null;
  readonly failing: boolean;
}

export interface StationJudgeCalibrationDto extends JudgeCalibrationDto {
  readonly lineId: string;
  readonly stationId: string;
}

export const judgeCalibrationOf = (
  calibration: JudgeCalibration,
): JudgeCalibrationDto => ({
  qualified: calibration.qualified,
  agreement: calibration.agreement,
  reading: kappaReadingOf(calibration.agreement),
  pairs: calibration.pairs,
  minPairs: MIN_PAIRS,
  minAgreement: calibration.minAgreement,
  hiddenReason: calibration.hiddenReason,
  failing: failingOf(calibration),
});

export const stationJudgeCalibrationOf = (
  calibration: {
    readonly lineId: string;
    readonly stationId: string;
  } & JudgeCalibration,
): StationJudgeCalibrationDto => ({
  lineId: calibration.lineId,
  stationId: calibration.stationId,
  ...judgeCalibrationOf(calibration),
});
