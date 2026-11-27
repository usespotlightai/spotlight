import { BadRequestException } from '@nestjs/common';

const INVALID_SURVEY =
  'Field survey must contain a jobFunction as text, and a referralSource as text or null.';

export const signupSurveyInput = (
  value: unknown,
): { jobFunction: string; referralSource: string | null } => {
  if (typeof value !== 'object' || value === null) {
    throw new BadRequestException(INVALID_SURVEY);
  }

  const jobFunction: unknown = Reflect.get(value, 'jobFunction');
  const referralSource: unknown = Reflect.get(value, 'referralSource') ?? null;

  if (
    typeof jobFunction !== 'string' ||
    (referralSource !== null && typeof referralSource !== 'string')
  ) {
    throw new BadRequestException(INVALID_SURVEY);
  }

  return { jobFunction, referralSource };
};
