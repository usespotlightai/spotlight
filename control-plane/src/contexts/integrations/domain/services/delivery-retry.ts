import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const DELIVERING = Retry.backoff({
  max: 8,
  firstMs: 2_000,
  longestMs: 60 * 60 * 1000,
});

export const MAX_DELIVERY_ATTEMPTS = DELIVERING.max;

export const nextDeliveryAttempt = (attempts: number, now: Date): Date | null =>
  DELIVERING.after(attempts, now);
