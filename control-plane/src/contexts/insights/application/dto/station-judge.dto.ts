import type { JudgeCalibrationDto } from '@insights/application/dto/judge-calibration.dto';
import type { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import type { KappaReading } from '@insights/domain/services/agreement-reading';
import {
  agreedOf,
  type Coverage,
  comparedOf,
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

export interface AgreementDto {
  readonly pairs: number;
  readonly measured: boolean;
  readonly pairsProgress: number;
  readonly agreed: number;
  readonly compared: number;
  readonly belowMinimum: boolean;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly reading: KappaReading | null;
  readonly f1: number | null;
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

export interface ClaimsSourcePullRequestDto {
  readonly number: number;
  readonly url: string;
  readonly title: string;
}

export interface ClaimsSourceDto {
  readonly repository: string;
  readonly sha: string;
  readonly shortSha: string;
  readonly url: string;
  readonly pullRequest: ClaimsSourcePullRequestDto | null;
}

export interface RubricVersionDto {
  readonly rubricVersion: string;
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
  readonly source: ClaimsSourceDto | null;
}

export interface StationJudgeSettingsDto {
  readonly rubricVersion: string;
  readonly readable: boolean;
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

const VERDICT_LABELS: Readonly<Record<number, string>> = {
  0: 'fails',
  1: 'passes',
};

const labelOf = (value: number): string =>
  VERDICT_LABELS[value] ?? String(value);

const sourceOf = (source: ClaimsSource | null): ClaimsSourceDto | null =>
  source && {
    repository: source.commit.repository.value,
    sha: source.commit.sha,
    shortSha: source.commit.shortSha,
    url: source.commit.url,
    pullRequest: source.pullRequest && {
      number: source.pullRequest.number,
      url: source.pullRequest.url,
      title: source.pullRequest.title,
    },
  };

export const rubricVersionOf = (
  report: RubricReport,
  current: string | null,
  calibration: JudgeCalibration,
  source: ClaimsSource | null,
): RubricVersionDto => ({
  rubricVersion: report.rubricVersion,
  current: report.rubricVersion === current,
  judged: report.judged,
  agreement: {
    pairs: report.agreement.pairs,
    measured: measuredOf(report.agreement.pairs),
    pairsProgress: pairsProgressOf(report.agreement.pairs),
    agreed: agreedOf(report.agreement.confusion),
    compared: comparedOf(report.agreement.confusion),
    belowMinimum: belowMinimumOf(
      report.agreement.kappa,
      calibration.minAgreement,
    ),
    observed: report.agreement.observed,
    kappa: report.agreement.kappa,
    reading: report.agreement.reading,
    f1: report.agreement.f1,
  },
  confusion: {
    labels: report.agreement.confusion.values.map(labelOf),
    cells: report.agreement.confusion.cells,
  },
  distribution: report.agreement.distribution.map((each) => ({
    label: labelOf(each.value),
    judge: each.judge,
    people: each.people,
  })),
  trend: report.trend,
  trendShown: trendReadyOf(report.agreement.pairs, report.trend),
  trendMinPairs: TREND_MIN_PAIRS,
  firstAt: report.firstAt.toISOString(),
  lastAt: report.lastAt.toISOString(),
  source: sourceOf(source),
});
