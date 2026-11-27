import { BadRequestException } from '@nestjs/common';

export const setupInput = (
  value: unknown,
): { repository: string; folder: string } | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'object' ||
    !('repository' in value) ||
    !('folder' in value) ||
    typeof value.repository !== 'string' ||
    typeof value.folder !== 'string'
  ) {
    throw new BadRequestException(
      'Field setup must contain a repository and a folder, both text.',
    );
  }

  return { repository: value.repository, folder: value.folder };
};
