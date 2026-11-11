import type { JudgeCalibrationDto } from '@insights/application/dto/judge-calibration.dto';
import type { KappaReading } from '@insights/domain/services/agreement-reading';
import {
  type AgreementReadings,
  agreedOf,
  type Coverage,
  comparedOf,
  headlineOf,
  type TrendPoint,
} from '@insights/domain/services/judge-agreement';
import {
  belowMinimumOf,
  type JudgeCalibration,
  measuredOf,
  pairsProgressOf,
  TREND_MIN_PAIRS,
  trendReadyOf,
} from '@insights/domain/services/judge-calibration';
import type { RubricReport } from '@insights/domain/services/judge-report';
import type { ScoreKind } from '@insights/domain/value-objects/score-scale.vo';

export interface ClaimAgreementDto {
  readonly index: number;
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly reading: KappaReading | null;
  readonly belowMinimum: boolean;
}

export interface AgreementDto {
  readonly pairs: number;
  readonly measured: boolean;
  readonly pairsProgress: number;
  readonly agreed: number;
  readonly compared: number;
  readonly belowMinimum: boolean;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly spearman: number | null;
  readonly pearson: number | null;
  readonly mae: number | null;
  readonly rmse: number | null;
  readonly f1: number | null;
  readonly readings: AgreementReadings;
  readonly claims: readonly ClaimAgreementDto[];
}

export interface ScoreCountDto {
  readonly label: string;
  readonly judge: number;
  readonly people: number;
}

export interface ConfusionDto {
  readonly labels: readonly string[];
  readonly cells: readonly (readonly number[])[];
}

export interface RubricVersionDto {
  readonly rubricVersion: string;
  readonly kind: ScoreKind;
  readonly current: boolean;
  readonly judged: number;
  readonly agreement: AgreementDto;
  readonly confusion: ConfusionDto;
  readonly distribution: readonly ScoreCountDto[];
  readonly trend: readonly TrendPoint[];
  readonly trendShown: boolean;
  readonly trendMinPairs: number;
  readonly firstAt: string;
  readonly lastAt: string;
}

export interface StationJudgeSettingsDto {
  readonly rubricVersion: string;
  readonly kind: ScoreKind | null;
  readonly claims: readonly string[];
  readonly passThreshold: number;
  readonly sample: number;
  readonly minAgreement: number;
}

export interface StationJudgeDto {
  readonly stationId: string;
  readonly judge: StationJudgeSettingsDto | null;
  readonly calibration: JudgeCalibrationDto;
  readonly versions: readonly RubricVersionDto[];
  readonly coverage: Coverage;
}

const CLAIM_LABELS: Readonly<Record<number, string>> = {
  0: 'not met',
  1: 'met',
};

const labelOf =
  (report: RubricReport) =>
  (value: number): string =>
    report.scale.byClaims
      ? (CLAIM_LABELS[value] ?? String(value))
      : report.scale.labelOf(value);

export const rubricVersionOf = (
  report: RubricReport,
  current: string | null,
  calibration: JudgeCalibration,
): RubricVersionDto => ({
  rubricVersion: report.rubricVersion,
  kind: report.scale.kind,
  current: report.rubricVersion === current,
  judged: report.judged,
  agreement: {
    pairs: report.agreement.pairs,
    measured: measuredOf(report.agreement.pairs),
    pairsProgress: pairsProgressOf(report.agreement.pairs),
    agreed: agreedOf(report.agreement.confusion),
    compared: comparedOf(report.agreement.confusion),
    belowMinimum: belowMinimumOf(
      headlineOf(report.scale, report.agreement),
      calibration.minAgreement,
    ),
    observed: report.agreement.observed,
    kappa: report.agreement.kappa,
    spearman: report.agreement.spearman,
    pearson: report.agreement.pearson,
    mae: report.agreement.mae,
    rmse: report.agreement.rmse,
    f1: report.agreement.f1,
    readings: report.agreement.readings,
    claims: report.agreement.claims.map((each) => ({
      ...each,
      belowMinimum: belowMinimumOf(each.kappa, calibration.minAgreement),
    })),
  },
  confusion: {
    labels: report.agreement.confusion.values.map(labelOf(report)),
    cells: report.agreement.confusion.cells,
  },
  distribution: report.agreement.distribution.map((each) => ({
    label: labelOf(report)(each.value),
    judge: each.judge,
    people: each.people,
  })),
  trend: report.trend,
  trendShown: trendReadyOf(report.agreement.pairs, report.trend),
  trendMinPairs: TREND_MIN_PAIRS,
  firstAt: report.firstAt.toISOString(),
  lastAt: report.lastAt.toISOString(),
});
