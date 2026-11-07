import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { describe, expect, it } from 'vitest';

const settings = {
  rubric: 'scores: yes-no',
  claims: [],
  passThreshold: 1,
  sample: 0.2,
  minAgreement: 0.6,
};

describe('JudgeSettings', () => {
  it('holds a rubric or claims with rates from 0 to 1', () => {
    expect(JudgeSettings.of(settings).sample).toBe(0.2);
  });

  it('refuses a judge with nothing to judge by', () => {
    expect(() => JudgeSettings.of({ ...settings, rubric: null })).toThrow(
      InconsistentStateError,
    );
  });

  it('refuses a pass threshold, sample or agreement outside 0 to 1', () => {
    expect(() => JudgeSettings.of({ ...settings, passThreshold: 2 })).toThrow(
      InconsistentStateError,
    );
    expect(() => JudgeSettings.of({ ...settings, sample: -0.1 })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      JudgeSettings.of({ ...settings, minAgreement: Number.NaN }),
    ).toThrow(InconsistentStateError);
  });

  it('is equal to settings with the same criteria, sample and agreement', () => {
    expect(
      JudgeSettings.of(settings).equals(JudgeSettings.of({ ...settings })),
    ).toBe(true);
    expect(
      JudgeSettings.of(settings).equals(
        JudgeSettings.of({ ...settings, sample: 0.5 }),
      ),
    ).toBe(false);
  });
});
