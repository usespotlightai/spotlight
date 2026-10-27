import { BadRequestException } from '@nestjs/common';

export const draftGenerationInput = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  throw new BadRequestException(
    'Field draftGeneration must be a whole number from zero, or null.',
  );
};
