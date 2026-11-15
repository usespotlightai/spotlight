import { agreementOf } from '@insights/domain/services/judge-agreement';
import {
  calibrationOf,
  calibrationReadingOf,
  calibrationStateOf,
  failingOf,
  type JudgeCalibration,
  MIN_PAIRS,
  revisesClaimsOf,
  showsJudgeOf,
  TREND_MIN_PAIRS,
  trendReadyOf,
} from '@insights/domain/services/judge-calibration';
import { describe, expect, it } from 'vitest';

const CURRENT = 'c'.repeat(64);

const EARLIER = 'd'.repeat(64);

const QUALIFIED: JudgeCalibration = {
  qualified: true,
  agreement: 0.9,
  pairs: 12,
  minAgreement: 0.5,
  hiddenReason: null,
};

const TREND = [
  { day: '2026-09-30', judged: 4, judge: 0.75, labelled: 3, people: 0.67 },
];

describe('showsJudgeOf', () => {
  it('shows the judge’s values only for the current rubric, and only while it is qualified', () => {
    expect(showsJudgeOf(QUALIFIED, CURRENT, CURRENT)).toBe(true);
    expect(showsJudgeOf(QUALIFIED, CURRENT, EARLIER)).toBe(false);
    expect(showsJudgeOf(QUALIFIED, null, null)).toBe(false);
    expect(
      showsJudgeOf(
        { ...QUALIFIED, qualified: false, hiddenReason: 'too-few-pairs' },
        CURRENT,
        CURRENT,
      ),
    ).toBe(false);
  });
});

const hiddenBy = (
  hiddenReason: NonNullable<JudgeCalibration['hiddenReason']>,
  pairs = 12,
): JudgeCalibration => ({
  ...QUALIFIED,
  qualified: false,
  hiddenReason,
  pairs,
});

describe('calibrationStateOf', () => {
  it.each([
    ['no-judge', 'unmeasured'],
    ['unreadable-rubric', 'failing'],
    ['too-few-pairs', 'unmeasured'],
    ['no-agreement', 'unmeasured'],
    ['below-min-agreement', 'failing'],
  ] as const)('reads a judge hidden by %s as %s', (reason, state) => {
    expect(calibrationStateOf(hiddenBy(reason))).toBe(state);
    expect(failingOf(hiddenBy(reason))).toBe(state === 'failing');
  });

  it('reads a qualified judge as qualified, and never as failing', () => {
    expect(calibrationStateOf(QUALIFIED)).toBe('qualified');
    expect(failingOf(QUALIFIED)).toBe(false);
  });
});

describe('revisesClaimsOf', () => {
  it.each([
    ['no-judge', false],
    ['unreadable-rubric', false],
    ['too-few-pairs', false],
    ['no-agreement', false],
    ['below-min-agreement', true],
  ] as const)(
    'revises the claims of a judge hidden by %s: %s',
    (reason, revises) => {
      expect(revisesClaimsOf(hiddenBy(reason))).toBe(revises);
    },
  );

  it('revises only with at least the minimum of pairs', () => {
    expect(
      revisesClaimsOf(hiddenBy('below-min-agreement', MIN_PAIRS - 1)),
    ).toBe(false);
    expect(revisesClaimsOf(QUALIFIED)).toBe(false);
  });
});

describe('calibrationReadingOf', () => {
  it('reads the calibration of the version it was measured on', () => {
    expect(
      calibrationReadingOf({
        calibration: hiddenBy('below-min-agreement'),
        calibratedVersion: CURRENT,
        requestedVersion: CURRENT,
      }),
    ).toEqual({
      state: 'failing',
      agreement: 0.9,
      pairs: 12,
      minAgreement: 0.5,
    });
  });

  it('reads another rubric version as unmeasured, with no pairs', () => {
    expect(
      calibrationReadingOf({
        calibration: QUALIFIED,
        calibratedVersion: CURRENT,
        requestedVersion: EARLIER,
      }),
    ).toEqual({
      state: 'unmeasured',
      agreement: null,
      pairs: 0,
      minAgreement: 0.5,
    });
  });
});

describe('trendReadyOf', () => {
  it('readies the trend once enough runs have both scores over more than one day', () => {
    expect(trendReadyOf(TREND_MIN_PAIRS, [...TREND, ...TREND])).toBe(true);
    expect(trendReadyOf(TREND_MIN_PAIRS - 1, [...TREND, ...TREND])).toBe(false);
    expect(trendReadyOf(TREND_MIN_PAIRS, TREND)).toBe(false);
  });
});

const verdicts = (count: number, disagreeing = 0) =>
  Array.from({ length: count }, (_, at) => ({
    judge: at % 2 === 0,
    human: at < disagreeing ? at % 2 !== 0 : at % 2 === 0,
  }));

describe('calibrationOf', () => {
  it('qualifies a judge by the kappa of its verdicts against people’s', () => {
    const agreement = agreementOf(verdicts(10), []);

    expect(calibrationOf({ minAgreement: 0.6, agreement })).toEqual({
      qualified: true,
      hiddenReason: null,
      agreement: 1,
      pairs: 10,
      minAgreement: 0.6,
    });
  });

  it('hides a judge with too few pairs, no agreement or agreement below its minimum', () => {
    expect(
      calibrationOf({
        minAgreement: 0.6,
        agreement: agreementOf(verdicts(9), []),
      }).hiddenReason,
    ).toBe('too-few-pairs');
    expect(
      calibrationOf({
        minAgreement: 0.6,
        agreement: agreementOf(
          Array.from({ length: 10 }, () => ({ judge: true, human: true })),
          [],
        ),
      }).hiddenReason,
    ).toBe('no-agreement');
    expect(
      calibrationOf({
        minAgreement: 0.6,
        agreement: agreementOf(verdicts(10, 4), []),
      }).hiddenReason,
    ).toBe('below-min-agreement');
    expect(calibrationOf(null).hiddenReason).toBe('no-judge');
  });

  it('does not let the agreement of one claim decide', () => {
    const agreement = agreementOf(verdicts(10), [
      { judge: [true, false], human: [false, true] },
    ]);

    expect(calibrationOf({ minAgreement: 0.6, agreement }).qualified).toBe(
      true,
    );
  });
});
