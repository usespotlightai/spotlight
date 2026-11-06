import { rubricVersionOf } from '@insights/application/dto/station-judge.dto';
import { agreementOf } from '@insights/domain/services/judge-agreement';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import type { RubricReport } from '@insights/domain/services/judge-report';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  measure: 'kappa',
  agreement: 0.9,
  pairs: 12,
  minAgreement: 0.5,
  hiddenReason: null,
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
  it('draws the judge’s trend for every rubric, even while its scores are hidden on runs', () => {
    expect(judgeOnTrend(CURRENT, QUALIFIED)).toEqual([0.75]);
    expect(judgeOnTrend(EARLIER, QUALIFIED)).toEqual([0.75]);
    expect(
      judgeOnTrend(CURRENT, {
        ...QUALIFIED,
        qualified: false,
        hiddenReason: 'below-min-agreement',
      }),
    ).toEqual([0.75]);
  });

  it('holds the trend back until enough runs have both scores', () => {
    const version = rubricVersionOf(reportOf(CURRENT), CURRENT, QUALIFIED);

    expect(version.trendShown).toBe(false);
    expect(version.trendMinPairs).toBe(30);
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
      QUALIFIED,
    );

    expect(version.distribution).toEqual([
      { label: 'no', judge: 1, people: 2 },
      { label: 'yes', judge: 2, people: 1 },
    ]);
  });
});

describe('rubricVersionOf agreement', () => {
  const versionOf = (pairs: { judge: number; human: number }[]) =>
    rubricVersionOf(
      {
        ...reportOf(CURRENT),
        agreement: agreementOf(ScoreScale.yesNo(), pairs),
      },
      CURRENT,
      QUALIFIED,
    ).agreement;

  it('counts the scores that agree, and says how far the pairs are towards the minimum', () => {
    expect(
      versionOf([
        { judge: 1, human: 1 },
        { judge: 1, human: 0 },
        { judge: 0, human: 0 },
      ]),
    ).toMatchObject({
      measured: false,
      pairsProgress: 0.3,
      agreed: 2,
      compared: 3,
    });
  });

  it('marks the agreement measured once enough runs have both scores, and flags kappa below the minimum', () => {
    const agreement = versionOf(
      Array.from({ length: 12 }, (_, at) => ({
        judge: at % 2,
        human: at % 3 === 0 ? 1 : 0,
      })),
    );

    expect(agreement.measured).toBe(true);
    expect(agreement.pairsProgress).toBe(1);
    expect(agreement.belowMinimum).toBe(true);
  });
});
