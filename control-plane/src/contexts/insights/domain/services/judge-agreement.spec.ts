import {
  agreedOf,
  agreementOf,
  cohensKappa,
  comparedOf,
  coverageOf,
  f1Of,
  trendOf,
  type VerdictPair,
} from '@insights/domain/services/judge-agreement';
import { describe, expect, it } from 'vitest';

const repeated = (
  judge: boolean,
  human: boolean,
  count: number,
): VerdictPair[] => Array.from({ length: count }, () => ({ judge, human }));

const TEXTBOOK = [
  ...repeated(true, true, 20),
  ...repeated(true, false, 5),
  ...repeated(false, true, 10),
  ...repeated(false, false, 15),
];

const decided = (pairs: readonly VerdictPair[]) =>
  pairs.map((each) => ({
    judge: each.judge ? 1 : 0,
    human: each.human ? 1 : 0,
  }));

describe('judge agreement', () => {
  it('works out Cohen’s kappa: 0.7 observed over 0.5 by chance is 0.4', () => {
    expect(cohensKappa([0, 1], decided(TEXTBOOK))).toBeCloseTo(0.4, 10);
  });

  it('gives kappa 1 for perfect agreement and none where chance explains all', () => {
    expect(
      cohensKappa(
        [0, 1],
        decided([...repeated(true, true, 3), ...repeated(false, false, 2)]),
      ),
    ).toBe(1);
    expect(cohensKappa([0, 1], decided(repeated(true, true, 4)))).toBeNull();
  });

  it('works out the F1 score of a pass against people’s pass', () => {
    expect(f1Of(1, decided(TEXTBOOK))).toBeCloseTo(40 / 55, 10);
    expect(f1Of(1, decided(repeated(false, false, 3)))).toBeNull();
  });

  it('measures the judge’s verdicts against people’s by kappa', () => {
    const agreement = agreementOf(TEXTBOOK);

    expect(agreement.pairs).toBe(50);
    expect(agreement.kappa).toBeCloseTo(0.4);
    expect(agreement.reading).toBe('fair');
    expect(agreement.f1).toBeCloseTo(40 / 55);
    expect(agreement.observed).toBeCloseTo(0.7);
  });

  it('counts verdicts into a confusion matrix, judge by row and people by column', () => {
    const agreement = agreementOf(TEXTBOOK);

    expect(agreement.confusion).toEqual({
      values: [0, 1],
      cells: [
        [15, 10],
        [5, 20],
      ],
    });
    expect(agreedOf(agreement.confusion)).toBe(35);
    expect(comparedOf(agreement.confusion)).toBe(50);
  });

  it('counts how often each side failed and passed a run', () => {
    expect(agreementOf(TEXTBOOK).distribution).toEqual([
      { value: 0, judge: 25, people: 20 },
      { value: 1, judge: 25, people: 30 },
    ]);
  });

  it('knows nothing of agreement with no runs both scored', () => {
    expect(agreementOf([])).toMatchObject({
      pairs: 0,
      observed: null,
      kappa: null,
      reading: null,
    });
  });

  it('follows both pass rates day by day', () => {
    expect(
      trendOf([
        { at: new Date('2026-09-29T09:00:00Z'), judge: true, human: true },
        { at: new Date('2026-09-29T17:00:00Z'), judge: false, human: null },
        { at: new Date('2026-09-30T09:00:00Z'), judge: true, human: false },
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
    ).toEqual({
      runs: 5,
      both: 1,
      judgeOnly: 1,
      peopleOnly: 2,
      neither: 1,
      rates: { both: 0.2, judgeOnly: 0.2, peopleOnly: 0.4, neither: 0.2 },
    });
  });

  it('has no coverage rates without runs', () => {
    expect(coverageOf([]).rates).toEqual({
      both: null,
      judgeOnly: null,
      peopleOnly: null,
      neither: null,
    });
  });
});
