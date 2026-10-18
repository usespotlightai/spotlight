import {
  type Agreement,
  headlineOf,
  type TrendPoint,
} from '@insights/domain/services/judge-agreement';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';

export const MIN_PAIRS = 10;

export const HIDDEN_REASONS = [
  'no-judge',
  'unreadable-rubric',
  'too-few-pairs',
  'no-agreement',
  'below-min-agreement',
] as const;

type HiddenReason = (typeof HIDDEN_REASONS)[number];

export const AGREEMENT_MEASURES = ['kappa', 'spearman'] as const;

type AgreementMeasure = (typeof AGREEMENT_MEASURES)[number];

export interface JudgeCalibration {
  readonly qualified: boolean;
  readonly measure: AgreementMeasure | null;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly minAgreement: number | null;
  readonly hiddenReason: HiddenReason | null;
}

const hidden = (
  because: HiddenReason,
  rest: Omit<JudgeCalibration, 'qualified' | 'hiddenReason'>,
): JudgeCalibration => ({ qualified: false, hiddenReason: because, ...rest });

export const unreadableRubricCalibration = (
  minAgreement: number,
): JudgeCalibration =>
  hidden('unreadable-rubric', {
    measure: null,
    agreement: null,
    pairs: 0,
    minAgreement,
  });

export const calibrationOf = (
  judge: {
    readonly minAgreement: number;
    readonly scale: ScoreScale;
    readonly agreement: Agreement;
  } | null,
): JudgeCalibration => {
  if (!judge) {
    return hidden('no-judge', {
      measure: null,
      agreement: null,
      pairs: 0,
      minAgreement: null,
    });
  }

  const measure: AgreementMeasure =
    judge.scale.categorical || judge.scale.byClaims ? 'kappa' : 'spearman';
  const agreement = headlineOf(judge.scale, judge.agreement);
  const known = {
    measure,
    agreement,
    pairs: judge.agreement.pairs,
    minAgreement: judge.minAgreement,
  };

  if (judge.agreement.pairs < MIN_PAIRS) {
    return hidden('too-few-pairs', known);
  }
  if (agreement === null) {
    return hidden('no-agreement', known);
  }
  if (agreement < judge.minAgreement) {
    return hidden('below-min-agreement', known);
  }

  return { qualified: true, hiddenReason: null, ...known };
};

export const showsJudgeOf = (
  calibration: JudgeCalibration,
  current: string | null,
  rubricVersion: string | null,
): boolean =>
  calibration.qualified && current !== null && rubricVersion === current;

export const trendShownOf = (
  trend: readonly TrendPoint[],
  shown: boolean,
): TrendPoint[] =>
  trend.map((point) => (shown ? point : { ...point, judge: null }));
