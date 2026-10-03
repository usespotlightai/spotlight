import type {
  Coverage,
  TrendPoint,
} from '@outcomes/domain/services/judge-agreement';
import type { RubricReport } from '@outcomes/domain/services/judge-report';
import {
  type JudgeStanding,
  showsJudgeOf,
  trendShownOf,
} from '@outcomes/domain/services/judge-standing';
import type { ScoreKind } from '@outcomes/domain/value-objects/score-scale.vo';

export interface ClaimAgreementDto {
  readonly index: number;
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
}

export interface AgreementDto {
  readonly pairs: number;
  readonly observed: number | null;
  readonly kappa: number | null;
  readonly spearman: number | null;
  readonly mae: number | null;
  readonly claims: readonly ClaimAgreementDto[];
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
  readonly trend: readonly TrendPoint[];
  readonly firstAt: string;
  readonly lastAt: string;
}

export interface StationJudgeSettingsDto {
  readonly rubricVersion: string;
  readonly kind: ScoreKind | null;
  readonly claims: readonly string[];
  readonly passShare: number;
  readonly sample: number;
  readonly trust: number;
}

export interface StationJudgeDto {
  readonly stationId: string;
  readonly judge: StationJudgeSettingsDto | null;
  readonly standing: JudgeStanding;
  readonly versions: readonly RubricVersionDto[];
  readonly coverage: Coverage;
}

const CLAIM_LABELS: Readonly<Record<number, string>> = {
  0: 'not met',
  1: 'met',
};

export const rubricVersionOf = (
  report: RubricReport,
  current: string | null,
  standing: JudgeStanding,
): RubricVersionDto => ({
  rubricVersion: report.rubricVersion,
  kind: report.scale.kind,
  current: report.rubricVersion === current,
  judged: report.judged,
  agreement: {
    pairs: report.agreement.pairs,
    observed: report.agreement.observed,
    kappa: report.agreement.kappa,
    spearman: report.agreement.spearman,
    mae: report.agreement.mae,
    claims: report.agreement.claims.map((each) => ({ ...each })),
  },
  confusion: {
    labels: report.agreement.confusion.values.map((each) =>
      report.scale.byClaims
        ? (CLAIM_LABELS[each] ?? String(each))
        : report.scale.labelOf(each),
    ),
    cells: report.agreement.confusion.cells,
  },
  trend: trendShownOf(
    report.trend,
    showsJudgeOf(standing, current, report.rubricVersion),
  ),
  firstAt: report.firstAt.toISOString(),
  lastAt: report.lastAt.toISOString(),
});
