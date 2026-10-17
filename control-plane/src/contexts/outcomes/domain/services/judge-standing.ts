import {
  type Agreement,
  headlineOf,
  type TrendPoint,
} from '@outcomes/domain/services/judge-agreement';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';

export const MIN_PAIRS = 10;

export const HIDING_REASONS = [
  'no-judge',
  'unreadable-rubric',
  'too-few-pairs',
  'no-agreement',
  'below-trust',
] as const;

type HidingReason = (typeof HIDING_REASONS)[number];

export const AGREEMENT_MEASURES = ['kappa', 'spearman'] as const;

type AgreementMeasure = (typeof AGREEMENT_MEASURES)[number];

export interface JudgeStanding {
  readonly trusted: boolean;
  readonly measure: AgreementMeasure | null;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly trust: number | null;
  readonly hiddenBecause: HidingReason | null;
}

const hidden = (
  because: HidingReason,
  rest: Omit<JudgeStanding, 'trusted' | 'hiddenBecause'>,
): JudgeStanding => ({ trusted: false, hiddenBecause: because, ...rest });

export const unreadableRubricStanding = (trust: number): JudgeStanding =>
  hidden('unreadable-rubric', {
    measure: null,
    agreement: null,
    pairs: 0,
    trust,
  });

export const standingOf = (
  judge: {
    readonly trust: number;
    readonly scale: ScoreScale;
    readonly agreement: Agreement;
  } | null,
): JudgeStanding => {
  if (!judge) {
    return hidden('no-judge', {
      measure: null,
      agreement: null,
      pairs: 0,
      trust: null,
    });
  }

  const measure: AgreementMeasure =
    judge.scale.categorical || judge.scale.byClaims ? 'kappa' : 'spearman';
  const agreement = headlineOf(judge.scale, judge.agreement);
  const known = {
    measure,
    agreement,
    pairs: judge.agreement.pairs,
    trust: judge.trust,
  };

  if (judge.agreement.pairs < MIN_PAIRS) {
    return hidden('too-few-pairs', known);
  }
  if (agreement === null) {
    return hidden('no-agreement', known);
  }
  if (agreement < judge.trust) {
    return hidden('below-trust', known);
  }

  return { trusted: true, hiddenBecause: null, ...known };
};

export const showsJudgeOf = (
  standing: JudgeStanding,
  current: string | null,
  rubricVersion: string | null,
): boolean => standing.trusted && current !== null && rubricVersion === current;

export const trendShownOf = (
  trend: readonly TrendPoint[],
  shown: boolean,
): TrendPoint[] =>
  trend.map((point) => (shown ? point : { ...point, judge: null }));
