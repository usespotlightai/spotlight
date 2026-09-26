import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const DELIVERING = Retry.backoff({
  most: 8,
  firstMs: 2_000,
  longestMs: 60 * 60 * 1000,
});

export const MOST_DELIVERY_ATTEMPTS = DELIVERING.most;

export const nextDeliveryAttempt = (attempts: number, now: Date): Date | null =>
  DELIVERING.after(attempts, now);
