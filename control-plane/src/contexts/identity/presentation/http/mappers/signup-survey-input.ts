import { BadRequestException } from '@nestjs/common';

export const signupSurveyInput = (
  value: unknown,
): { jobFunction: string; referralSource: string | null } => {
  const { jobFunction, referralSource = null } = (value ?? {}) as Record<
    string,
    unknown
  >;

  if (
    typeof value !== 'object' ||
    value === null ||
    typeof jobFunction !== 'string' ||
    (referralSource !== null && typeof referralSource !== 'string')
  ) {
    throw new BadRequestException(
      'Field survey must contain a jobFunction as text, and a referralSource as text or null.',
    );
  }

  return { jobFunction, referralSource };
};
