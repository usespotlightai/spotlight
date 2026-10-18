import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const DELIVERING = Retry.backoff({
  maxAttempts: 8,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});

export const MAX_DELIVERY_ATTEMPTS = DELIVERING.maxAttempts;

export const nextDeliveryAttempt = (attempts: number, now: Date): Date | null =>
  DELIVERING.nextAttemptAt(attempts, now);
