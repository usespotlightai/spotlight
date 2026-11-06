import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT = Symbol('RATE_LIMIT');

export interface RateLimit {
  readonly name: string;
  readonly max: number;
  readonly windowSeconds: number;
}

export const RateLimited = (limit: RateLimit) => SetMetadata(RATE_LIMIT, limit);
