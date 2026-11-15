import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import { describe, expect, it } from 'vitest';

const FIELDS = {
  state: 'failing',
  agreement: 0.31,
  pairs: 12,
  minPairs: 10,
  minAgreement: 0.6,
};

describe('JudgeCalibration', () => {
  it('keeps its fields, and fails checks only when it is failing', () => {
    const failing = JudgeCalibration.of(FIELDS);

    expect(failing.toFields()).toEqual(FIELDS);
    expect(failing.fails()).toBe(true);
    expect(
      JudgeCalibration.of({
        ...FIELDS,
        state: 'unmeasured',
        agreement: null,
      }).fails(),
    ).toBe(false);
    expect(JudgeCalibration.of({ ...FIELDS, state: 'qualified' }).fails()).toBe(
      false,
    );
  });

  it.each([
    { state: 'broken' },
    { pairs: -1 },
    { pairs: 1.5 },
    { minPairs: 0 },
    { agreement: 1.2 },
    { agreement: Number.NaN },
    { minAgreement: -0.1 },
    { state: 'qualified', agreement: null },
  ])('refuses stored fields that break its rules: %o', (broken) => {
    expect(() => JudgeCalibration.of({ ...FIELDS, ...broken })).toThrow(
      InvalidReplayCheckError,
    );
  });
});
