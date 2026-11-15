import { InvalidStationJudgeError } from '@lines/domain/exceptions/invalid-station-judge.error';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { describe, expect, it } from 'vitest';

const JUDGE = {
  claims: ['It adds a test.', ' It touches one file. '],
  sample: 0.2,
  minAgreement: 0.6,
};

const errorOf = (over: Record<string, unknown>) => {
  try {
    StationJudge.of({ ...JUDGE, ...over });
  } catch (error) {
    return error;
  }

  throw new Error('it was accepted');
};

describe('StationJudge', () => {
  it('keeps its claims trimmed, with its sample and minimum agreement, passing on every claim by default', () => {
    expect(StationJudge.of(JUDGE)).toMatchObject({
      claims: ['It adds a test.', 'It touches one file.'],
      passThreshold: 1,
      sample: 0.2,
      minAgreement: 0.6,
    });
  });

  it('takes a pass threshold above 0 up to 1, and a sample and a minimum agreement anywhere from 0 to 1', () => {
    expect(() =>
      StationJudge.of({
        ...JUDGE,
        passThreshold: 0.01,
        sample: 0,
        minAgreement: 1,
      }),
    ).not.toThrow();
    expect(() =>
      StationJudge.of({
        ...JUDGE,
        passThreshold: 1,
        sample: 1,
        minAgreement: 0,
      }),
    ).not.toThrow();
  });

  it('has the same claims as another judge with the same claims and pass threshold, whatever its sample', () => {
    const judge = StationJudge.of(JUDGE);

    expect(judge.sameClaimsAs(StationJudge.of({ ...JUDGE, sample: 1 }))).toBe(
      true,
    );
    expect(
      judge.sameClaimsAs(StationJudge.of({ ...JUDGE, passThreshold: 0.5 })),
    ).toBe(false);
    expect(
      judge.sameClaimsAs(
        StationJudge.of({ ...JUDGE, claims: ['It adds a test.'] }),
      ),
    ).toBe(false);
  });

  it('versions its criteria by its claims and pass threshold together', () => {
    expect(StationJudge.of(JUDGE).criteria).not.toBe(
      StationJudge.of({ ...JUDGE, claims: ['It adds a test.'] }).criteria,
    );
    expect(StationJudge.of(JUDGE).criteria).not.toBe(
      StationJudge.of({ ...JUDGE, passThreshold: 0.5 }).criteria,
    );
    expect(
      StationJudge.of(JUDGE).equals(
        StationJudge.of({ ...JUDGE, passThreshold: 1 }),
      ),
    ).toBe(true);
  });

  it.each([
    ['claims', { claims: [] }],
    ['claims', { claims: Array.from({ length: 21 }, () => 'A claim.') }],
    ['claims', { claims: ['x'.repeat(501)] }],
    ['claims', { claims: ['   '] }],
    ['passThreshold', { passThreshold: 1.5 }],
    ['passThreshold', { passThreshold: 0 }],
    ['passThreshold', { passThreshold: -0.5 }],
    ['sample', { sample: 1.5 }],
    ['sample', { sample: -0.1 }],
    ['sample', { sample: Number.NaN }],
    ['minAgreement', { minAgreement: 2 }],
  ] as const)('rejects a %s it cannot judge by, naming it', (field, over) => {
    const error = errorOf(over);

    expect(error).toBeInstanceOf(InvalidStationJudgeError);
    expect((error as InvalidStationJudgeError).field).toBe(field);
  });
});
