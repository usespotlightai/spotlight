import { InvalidReferralSourceError } from '@identity/domain/exceptions/invalid-referral-source.error';
import { JobFunction } from '@identity/domain/value-objects/job-function.vo';

const MAX_REFERRAL_SOURCE_LENGTH = 200;

export class SignupSurvey {
  private constructor(
    readonly jobFunction: JobFunction,
    readonly referralSource: string | null,
  ) {}

  static of(answers: {
    jobFunction: string;
    referralSource: string | null;
  }): SignupSurvey {
    const referralSource = answers.referralSource?.trim() || null;

    if (
      referralSource !== null &&
      referralSource.length > MAX_REFERRAL_SOURCE_LENGTH
    ) {
      throw new InvalidReferralSourceError(MAX_REFERRAL_SOURCE_LENGTH);
    }

    return new SignupSurvey(
      JobFunction.of(answers.jobFunction),
      referralSource,
    );
  }
}
