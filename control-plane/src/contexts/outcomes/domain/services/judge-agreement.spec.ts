import {
  agreementOf,
  cohensKappa,
  confusionOf,
  coverageOf,
  meanAbsoluteError,
  type ScorePair,
  spearman,
  trendOf,
} from '@outcomes/domain/services/judge-agreement';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { describe, expect, it } from 'vitest';

const repeated = (judge: number, human: number, count: number): ScorePair[] =>
  Array.from({ length: count }, () => ({ judge, human }));

const TEXTBOOK = [
  ...repeated(1, 1, 20),
  ...repeated(1, 0, 5),
  ...repeated(0, 1, 10),
  ...repeated(0, 0, 15),
];

const numbered = (judge: readonly number[], human: readonly number[]) =>
  judge.map((each, at) => ({ judge: each, human: human[at] ?? 0 }));

describe('judge agreement', () => {
  it('works out Cohen’s kappa: 0.7 observed over 0.5 by chance is 0.4', () => {
    expect(cohensKappa([0, 1], TEXTBOOK)).toBeCloseTo(0.4, 10);
  });

  it('gives kappa 1 for perfect agreement and none where chance explains all', () => {
    expect(
      cohensKappa([0, 1], [...repeated(1, 1, 3), ...repeated(0, 0, 2)]),
    ).toBe(1);
    expect(cohensKappa([0, 1], repeated(1, 1, 4))).toBeNull();
  });

  it('works out Spearman’s correlation, ranking ties by their mean', () => {
    expect(spearman(numbered([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]))).toBeCloseTo(1);
    expect(spearman(numbered([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]))).toBeCloseTo(
      -1,
    );
    expect(spearman(numbered([1, 2, 3, 4, 5], [5, 6, 7, 8, 7]))).toBeCloseTo(
      8 / Math.sqrt(95),
      10,
    );
  });

  it('has no correlation where either side never changes', () => {
    expect(spearman(numbered([3, 3, 3], [1, 2, 3]))).toBeNull();
  });

  it('works out the mean absolute error', () => {
    expect(meanAbsoluteError(numbered([3, 5, 1], [4, 5, 3]))).toBe(1);
  });

  it('counts pairs into a confusion matrix, judge by row and people by column', () => {
    expect(confusionOf([0, 1], TEXTBOOK).cells).toEqual([
      [15, 10],
      [5, 20],
    ]);
  });

  it('measures yes or no scores by kappa and numbers by correlation', () => {
    const yesNo = agreementOf(ScoreScale.yesNo(), TEXTBOOK);
    const numbers = agreementOf(
      ScoreScale.oneToFive(),
      numbered([1, 2, 3, 4, 5], [2, 2, 3, 5, 5]),
    );

    expect(yesNo.kappa).toBeCloseTo(0.4);
    expect(yesNo.spearman).toBeNull();
    expect(yesNo.observed).toBeCloseTo(0.7);
    expect(numbers.kappa).toBeNull();
    expect(numbers.spearman).toBeGreaterThan(0.9);
    expect(numbers.mae).toBeCloseTo(0.4);
    expect(numbers.confusion.cells).toHaveLength(5);
  });

  it('follows both scores day by day', () => {
    expect(
      trendOf([
        { at: new Date('2026-09-29T09:00:00Z'), judge: 1, human: 1 },
        { at: new Date('2026-09-29T17:00:00Z'), judge: 0, human: null },
        { at: new Date('2026-09-30T09:00:00Z'), judge: 1, human: 0 },
      ]),
    ).toEqual([
      { day: '2026-09-29', judged: 2, judge: 0.5, labelled: 1, people: 1 },
      { day: '2026-09-30', judged: 1, judge: 1, labelled: 1, people: 0 },
    ]);
  });

  it('counts the runs with both scores, and those with only one', () => {
    expect(
      coverageOf([
        { judged: true, labelled: true },
        { judged: true, labelled: false },
        { judged: false, labelled: true },
        { judged: false, labelled: false },
        { judged: false, labelled: true },
      ]),
    ).toEqual({ runs: 5, both: 1, judgeOnly: 1, peopleOnly: 2, neither: 1 });
  });
});
