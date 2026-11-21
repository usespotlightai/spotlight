import { BadRequestException } from '@nestjs/common';
import {
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page-limits.dto';

export const pageLimitOf = (raw: string | undefined): number => {
  const asked = raw === undefined ? PAGE_LIMIT : Number(raw);

  if (!Number.isInteger(asked) || asked < 1) {
    throw new BadRequestException(
      'Sorry, the page limit must be a whole number above 0.',
    );
  }

  return Math.min(asked, LONGEST_PAGE);
};
