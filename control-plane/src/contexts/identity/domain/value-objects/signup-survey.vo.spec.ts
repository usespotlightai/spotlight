import { InvalidJobFunctionError } from '@identity/domain/exceptions/invalid-job-function.error';
import { InvalidReferralSourceError } from '@identity/domain/exceptions/invalid-referral-source.error';
import { JOB_FUNCTIONS } from '@identity/domain/value-objects/job-function.vo';
import { SignupSurvey } from '@identity/domain/value-objects/signup-survey.vo';
import { describe, expect, it } from 'vitest';

describe('SignupSurvey', () => {
  it.each(JOB_FUNCTIONS)('accepts the job function %s', (jobFunction) => {
    expect(
      SignupSurvey.of({ jobFunction, referralSource: null }).jobFunction.value,
    ).toBe(jobFunction);
  });

  it('lowercases and trims the job function', () => {
    expect(
      SignupSurvey.of({ jobFunction: ' Founder ', referralSource: null })
        .jobFunction.value,
    ).toBe('founder');
  });

  it('rejects an unknown job function', () => {
    expect(() =>
      SignupSurvey.of({ jobFunction: 'astronaut', referralSource: null }),
    ).toThrow(InvalidJobFunctionError);
  });

  it('trims the referral source', () => {
    expect(
      SignupSurvey.of({ jobFunction: 'data', referralSource: '  A colleague ' })
        .referralSource,
    ).toBe('A colleague');
  });

  it.each([
    ['null', null],
    ['blank', '   '],
  ])('keeps a %s referral source as no answer', (_reason, referralSource) => {
    expect(
      SignupSurvey.of({ jobFunction: 'data', referralSource }).referralSource,
    ).toBeNull();
  });

  it('rejects a referral source over 200 characters', () => {
    expect(() =>
      SignupSurvey.of({ jobFunction: 'data', referralSource: 'a'.repeat(201) }),
    ).toThrow(InvalidReferralSourceError);
  });
});
