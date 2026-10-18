import { BadRequestException } from '@nestjs/common';

export const setupInput = (
  value: unknown,
): { repository: string; folder: string } | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const { repository, folder } = value as Record<string, unknown>;

  if (
    typeof value !== 'object' ||
    typeof repository !== 'string' ||
    typeof folder !== 'string'
  ) {
    throw new BadRequestException(
      'Field setup must contain a repository and a folder, both text.',
    );
  }

  return { repository, folder };
};
