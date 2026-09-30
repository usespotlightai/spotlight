import { rubricVersionOf } from '@outcomes/application/dto/station-judge.dto';
import { agreementOf } from '@outcomes/domain/services/judge-agreement';
import type { RubricReport } from '@outcomes/domain/services/judge-report';
import type { JudgeStanding } from '@outcomes/domain/services/judge-standing';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const TRUSTED: JudgeStanding = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.9,
  pairs: 12,
  trust: 0.5,
  hiddenBecause: null,
};

const reportOf = (rubricVersion: string): RubricReport => ({
  rubricVersion,
  scale: ScoreScale.yesNo(),
  judged: 4,
  agreement: agreementOf(ScoreScale.yesNo(), []),
  trend: [
    { day: '2026-09-30', judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
  ],
  firstAt: new Date('2026-09-30T10:00:00.000Z'),
  lastAt: new Date('2026-09-30T12:00:00.000Z'),
});

const judgeOnTrend = (
  rubricVersion: string,
  standing: JudgeStanding,
): (number | null)[] =>
  rubricVersionOf(reportOf(rubricVersion), CURRENT, standing).trend.map(
    (each) => each.judge,
  );

describe('rubricVersionOf', () => {
  it('draws the judge’s trend for the current rubric while its judge is trusted', () => {
    expect(judgeOnTrend(CURRENT, TRUSTED)).toEqual([0.75]);
  });

  it('leaves the judge out of the trend of an earlier rubric', () => {
    expect(judgeOnTrend(EARLIER, TRUSTED)).toEqual([null]);
  });

  it('leaves the judge out of the trend while it is not trusted', () => {
    expect(
      judgeOnTrend(CURRENT, {
        ...TRUSTED,
        trusted: false,
        hiddenBecause: 'below-trust',
      }),
    ).toEqual([null]);
  });
});
