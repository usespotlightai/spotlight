import { BadRequestException } from '@nestjs/common';

export const choiceInput = (
  value: unknown,
  what: string,
): string | null | undefined => {
  if (value === undefined || value === null || typeof value === 'string') {
    return value;
  }

  throw new BadRequestException(`Field ${what} must be text or null.`);
};
