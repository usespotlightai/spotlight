import { InvalidStationJudgeError } from '@work/domain/exceptions/invalid-station-judge.error';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { describe, expect, it } from 'vitest';

const JUDGE = { rubric: 'A good run is small.\n', sample: 0.2, trust: 0.6 };

const refusal = (over: Partial<typeof JUDGE>) => {
  try {
    StationJudge.of({ ...JUDGE, ...over });
  } catch (error) {
    return error;
  }

  throw new Error('it was accepted');
};

describe('StationJudge', () => {
  it('keeps the rubric exactly as written, with its sample and trust', () => {
    expect(StationJudge.of(JUDGE)).toMatchObject(JUDGE);
  });

  it('takes a rubric scored yes or no, or from 1 to 5', () => {
    expect(() =>
      StationJudge.of({ ...JUDGE, rubric: 'scores: 1-5\nHow well?' }),
    ).not.toThrow();
  });

  it('takes a sample and trust anywhere from 0 to 1', () => {
    expect(() =>
      StationJudge.of({ ...JUDGE, sample: 0, trust: 1 }),
    ).not.toThrow();
    expect(() =>
      StationJudge.of({ ...JUDGE, sample: 1, trust: 0 }),
    ).not.toThrow();
  });

  it.each([
    ['rubric', { rubric: ' \n' }],
    ['rubric', { rubric: 'x'.repeat(20_001) }],
    ['sample', { sample: 1.5 }],
    ['sample', { sample: -0.1 }],
    ['sample', { sample: Number.NaN }],
    ['trust', { trust: 2 }],
    ['rubric', { rubric: 'scores: 1-10\nHow well?' }],
    ['rubric', { rubric: 'scores: constructor\nHow well?' }],
  ] as const)('refuses a %s out of bounds, naming it', (field, over) => {
    const error = refusal(over);

    expect(error).toBeInstanceOf(InvalidStationJudgeError);
    expect((error as InvalidStationJudgeError).field).toBe(field);
  });
});
