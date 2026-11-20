import { BadRequestException } from '@nestjs/common';

export const askInput = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  throw new BadRequestException(
    'Field ask must be the position of a note: a whole number, 0 or more.',
  );
};
