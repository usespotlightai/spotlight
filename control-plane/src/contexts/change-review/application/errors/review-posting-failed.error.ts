import type { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';

export class ReviewPostingFailedError extends Error {
  constructor(
    readonly failure: DeliveryFailure,
    readonly cause: unknown = null,
  ) {
    super(`Posting to GitHub failed: ${failure.code}`);
    this.name = 'ReviewPostingFailedError';
  }
}
