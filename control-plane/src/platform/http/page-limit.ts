import { BadRequestException } from '@nestjs/common';

export interface PageLimits {
  readonly fallback: number;
  readonly longest: number;
}

export const pageLimitOf = (
  raw: string | undefined,
  limits: PageLimits,
): number => {
  const asked = raw === undefined ? limits.fallback : Number(raw);

  if (!Number.isInteger(asked) || asked < 1) {
    throw new BadRequestException(
      'Sorry, the page limit must be a whole number above 0.',
    );
  }

  return Math.min(asked, limits.longest);
};
