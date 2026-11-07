import type { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';

export class ReviewPostingFailedError extends Error {
  readonly cause: unknown;

  readonly outcomeUnknown: boolean;

  constructor(
    readonly failure: DeliveryFailure,
    {
      cause = null,
      outcomeUnknown = false,
    }: { readonly cause?: unknown; readonly outcomeUnknown?: boolean } = {},
  ) {
    super(`Posting to GitHub failed: ${failure.code}`);
    this.name = 'ReviewPostingFailedError';
    this.cause = cause;
    this.outcomeUnknown = outcomeUnknown;
  }
}
