import { BadRequestException } from '@nestjs/common';

export const draftGenerationInput = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  throw new BadRequestException(
    'Field draftGeneration must be a number, or null.',
  );
};
