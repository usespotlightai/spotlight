import { InvalidStationJudgeError } from '@work/domain/exceptions/invalid-station-judge.error';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { describe, expect, it } from 'vitest';

const JUDGE = {
  rubric: 'A good run is small.\n',
  sample: 0.2,
  minAgreement: 0.6,
};

const errorOf = (over: Partial<typeof JUDGE>) => {
  try {
    StationJudge.of({ ...JUDGE, ...over });
  } catch (error) {
    return error;
  }

  throw new Error('it was accepted');
};

describe('StationJudge', () => {
  it('keeps the rubric exactly as written, with its sample and minimum agreement', () => {
    expect(StationJudge.of(JUDGE)).toMatchObject(JUDGE);
  });

  it('takes a rubric scored yes or no, or from 1 to 5', () => {
    expect(() =>
      StationJudge.of({ ...JUDGE, rubric: 'scores: 1-5\nHow well?' }),
    ).not.toThrow();
  });

  it('takes a sample and minimum agreement anywhere from 0 to 1', () => {
    expect(() =>
      StationJudge.of({ ...JUDGE, sample: 0, minAgreement: 1 }),
    ).not.toThrow();
    expect(() =>
      StationJudge.of({ ...JUDGE, sample: 1, minAgreement: 0 }),
    ).not.toThrow();
  });

  it.each([
    ['rubric', { rubric: ' \n' }],
    ['rubric', { rubric: 'x'.repeat(20_001) }],
    ['sample', { sample: 1.5 }],
    ['sample', { sample: -0.1 }],
    ['sample', { sample: Number.NaN }],
    ['minAgreement', { minAgreement: 2 }],
    ['rubric', { rubric: 'scores: 1-10\nHow well?' }],
    ['rubric', { rubric: 'scores: constructor\nHow well?' }],
  ] as const)('rejects a %s out of bounds, naming it', (field, over) => {
    const error = errorOf(over);

    expect(error).toBeInstanceOf(InvalidStationJudgeError);
    expect((error as InvalidStationJudgeError).field).toBe(field);
  });

  it('takes checkable claims, with or without a rubric, passing a run on the share of them it must meet', () => {
    const alone = StationJudge.of({
      claims: ['It adds a test.', ' It touches one file. '],
      passThreshold: 0.5,
      sample: 0.2,
      minAgreement: 0.6,
    });

    expect(alone).toMatchObject({
      rubric: null,
      claims: ['It adds a test.', 'It touches one file.'],
      passThreshold: 0.5,
    });
    expect(
      StationJudge.of({ ...JUDGE, claims: ['It adds a test.'] }).passThreshold,
    ).toBe(1);
  });

  it('takes a rubric beside claims without naming a scale', () => {
    expect(
      StationJudge.of({
        ...JUDGE,
        rubric: 'scores: stars\nGuidance for the claims.',
        claims: ['It adds a test.'],
      }).rubric,
    ).toBe('scores: stars\nGuidance for the claims.');
  });

  it('versions its criteria by its rubric, claims and pass threshold together', () => {
    const claims = ['It adds a test.'];

    expect(StationJudge.of(JUDGE).criteria).not.toBe(
      StationJudge.of({ ...JUDGE, claims }).criteria,
    );
    expect(StationJudge.of({ ...JUDGE, claims }).criteria).not.toBe(
      StationJudge.of({ ...JUDGE, claims, passThreshold: 0.5 }).criteria,
    );
    expect(
      StationJudge.of({ ...JUDGE, claims }).equals(
        StationJudge.of({ ...JUDGE, claims, passThreshold: 1 }),
      ),
    ).toBe(true);
  });

  it.each([
    ['rubric', { rubric: null }],
    ['claims', { rubric: null, claims: [] }],
    ['claims', { claims: Array.from({ length: 21 }, () => 'A claim.') }],
    ['claims', { claims: ['x'.repeat(501)] }],
    ['claims', { claims: ['   '] }],
    ['passThreshold', { claims: ['A claim.'], passThreshold: 1.5 }],
    ['passThreshold', { passThreshold: 0.5 }],
  ] as const)('rejects a %s it cannot judge by, naming it', (field, over) => {
    let error: unknown;

    try {
      StationJudge.of({ ...JUDGE, ...over });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InvalidStationJudgeError);
    expect((error as InvalidStationJudgeError).field).toBe(field);
  });
});
