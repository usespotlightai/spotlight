import { BadRequestException } from '@nestjs/common';

export const givenSetup = (
  given: unknown,
): { repository: string; folder: string } | null => {
  if (given === undefined || given === null) {
    return null;
  }

  const { repository, folder } = given as Record<string, unknown>;

  if (
    typeof given !== 'object' ||
    typeof repository !== 'string' ||
    typeof folder !== 'string'
  ) {
    throw new BadRequestException(
      'Field setup must contain a repository and a folder, both text.',
    );
  }

  return { repository, folder };
};
