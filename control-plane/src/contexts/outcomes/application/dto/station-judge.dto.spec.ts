import { rubricVersionOf } from '@outcomes/application/dto/station-judge.dto';
import { agreementOf } from '@outcomes/domain/services/judge-agreement';
import type { JudgeCalibration } from '@outcomes/domain/services/judge-calibration';
import type { RubricReport } from '@outcomes/domain/services/judge-report';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const TRUSTED: JudgeCalibration = {
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
  calibration: JudgeCalibration,
): (number | null)[] =>
  rubricVersionOf(reportOf(rubricVersion), CURRENT, calibration).trend.map(
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

describe('rubricVersionOf distribution', () => {
  it('labels each score’s counts the way the confusion is labelled', () => {
    const version = rubricVersionOf(
      {
        ...reportOf(CURRENT),
        agreement: agreementOf(ScoreScale.yesNo(), [
          { judge: 1, human: 1 },
          { judge: 1, human: 0 },
          { judge: 0, human: 0 },
        ]),
      },
      CURRENT,
      TRUSTED,
    );

    expect(version.distribution).toEqual([
      { label: 'no', judge: 1, people: 2 },
      { label: 'yes', judge: 2, people: 1 },
    ]);
  });
});
