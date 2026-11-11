import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

export const DELIVERING = Retry.backoff({
  maxAttempts: 8,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});
