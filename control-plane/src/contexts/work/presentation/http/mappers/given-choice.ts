import { BadRequestException } from '@nestjs/common';

export const givenChoice = (
  given: unknown,
  what: string,
): string | null | undefined => {
  if (given === undefined || given === null || typeof given === 'string') {
    return given;
  }

  throw new BadRequestException(`Field ${what} must be text or null.`);
};
