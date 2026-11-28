import { BadRequestException } from '@nestjs/common';

export const requiredIdsInput = (value: unknown, what: string): string[] => {
  if (
    Array.isArray(value) &&
    value.every((each): each is string => typeof each === 'string')
  ) {
    return value;
  }

  throw new BadRequestException(`Field ${what} must be a list of ids.`);
};
