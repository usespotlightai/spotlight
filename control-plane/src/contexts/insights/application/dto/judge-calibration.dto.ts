import {
  agreementReadingOf,
  type CorrelationReading,
  type KappaReading,
} from '@insights/domain/services/agreement-reading';
import {
  type AgreementMeasure,
  failingOf,
  type HiddenReason,
  type JudgeCalibration,
  MIN_PAIRS,
} from '@insights/domain/services/judge-calibration';

export interface JudgeCalibrationDto {
  readonly qualified: boolean;
  readonly measure: AgreementMeasure | null;
  readonly agreement: number | null;
  readonly reading: KappaReading | CorrelationReading | null;
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
  measure: calibration.measure,
  agreement: calibration.agreement,
  reading: agreementReadingOf(calibration.measure, calibration.agreement),
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
